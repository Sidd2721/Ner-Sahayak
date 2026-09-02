import { db } from './db.js';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

const OUTBOX_MAX_RETRIES = 8;

export class SyncEngine {
  constructor(firestoreDb) {
    this.fdb = firestoreDb;
    this.flushing = false;
  }

  start() {
    window.addEventListener('online', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.flush();
    });
    // iOS fallback: only runs while the tab is actually open
    setInterval(() => { if (navigator.onLine) this.flush(); }, 20000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'FLUSH_OUTBOX') this.flush();
      });
      navigator.serviceWorker.ready.then((reg) => {
        if ('sync' in reg) reg.sync.register('flush-outbox').catch(() => {});
      });
    }
    this.flush(); // attempt once on boot
  }

  async flush() {
    if (this.flushing || !navigator.onLine) return;
    this.flushing = true;
    try {
      const jobs = await db.outbox.orderBy('createdAt').toArray();
      for (const job of jobs) {
        try {
          await this._process(job);
          await db.outbox.delete(job.id);
        } catch (err) {
          const retries = (job.retries || 0) + 1;
          if (retries >= OUTBOX_MAX_RETRIES) {
            console.error('Dropping outbox job after max retries', job, err);
            await db.outbox.delete(job.id);
          } else {
            await db.outbox.update(job.id, { retries });
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  async _process(job) {
    if (job.opType === 'create-report') {
      const local = await db.reports.get(job.entityLocalId);
      const ref = await addDoc(collection(this.fdb, 'reports'), local.payload);
      await db.reports.update(job.entityLocalId, { remoteId: ref.id, synced: true });
    }
    if (job.opType === 'update-status') {
      await updateDoc(doc(this.fdb, 'reports', job.payload.remoteId), {
        status: job.payload.status,
      });
    }
    if (job.opType === 'ping-vehicle') {
      await updateDoc(doc(this.fdb, 'corridors', job.payload.corridorId), {
        vehicleLat: job.payload.lat,
        vehicleLng: job.payload.lng,
        vehiclePingAt: new Date(),
      });
    }
  }
}
