import { db } from './db.js';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase.js';

/**
 * Outbox-pattern sync engine — build guide Phase 4 + ARCHITECTURE.md Layer 1.
 *
 * iOS Safari has NO Background Sync API (guide §A.5): the foreground-flush
 * path below — online event, visibilitychange, foreground-only interval —
 * works completely on its own and is the ONLY sync path on iOS. Background
 * Sync (Android) is registered as a bonus, never a dependency.
 *
 * Every Firestore write in the app flows through flush() — UI event
 * handlers never touch Firestore directly.
 */
const OUTBOX_MAX_RETRIES = 8;

export class SyncEngine {
  constructor(fdb) {
    this.fdb = fdb;
    this.flushing = false;
  }

  start() {
    window.addEventListener('online', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.flush();
    });
    // iOS fallback: only ticks while the tab is actually open (§A.5)
    this._interval = setInterval(() => {
      if (navigator.onLine) this.flush();
    }, 20000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'FLUSH_OUTBOX') this.flush();
      });
      // Android bonus — registration is best-effort; absence is fine
      navigator.serviceWorker.ready
        .then((reg) => {
          if ('sync' in reg) reg.sync.register('flush-outbox').catch(() => {});
        })
        .catch(() => {});
    }

    this.flush(); // attempt once on boot
  }

  stop() {
    clearInterval(this._interval);
  }

  async flush() {
    if (this.flushing || !navigator.onLine) return;
    this.flushing = true;
    window.dispatchEvent(new CustomEvent('nersahayak:sync', { detail: { state: 'syncing' } }));
    try {
      const jobs = await db.outbox.orderBy('createdAt').toArray();
      for (const job of jobs) {
        try {
          await this._process(job);
          await db.outbox.delete(job.id);
          window.dispatchEvent(new CustomEvent('nersahayak:sync', { detail: { state: 'progress' } }));
        } catch (err) {
          const retries = (job.retries || 0) + 1;
          if (retries >= OUTBOX_MAX_RETRIES) {
            // stop retrying a poison job forever; surface it instead of
            // silently blocking every job behind it
            console.error('[sync] dropping outbox job after max retries', job, err);
            await db.outbox.delete(job.id);
          } else {
            await db.outbox.update(job.id, { retries });
          }
        }
      }
      window.dispatchEvent(new CustomEvent('nersahayak:sync', { detail: { state: 'idle' } }));
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Create-report is idempotent on the CLIENT-generated UUID
   * (ARCHITECTURE.md §10): the Firestore doc id IS the client UUID, so a
   * crash after the write lands but before the outbox row is deleted can
   * never produce a duplicate — the retry targets the same document.
   *
   * The retry path checks server-side existence FIRST (a plain read, which
   * any authenticated reporter may do): if the doc already exists, the
   * earlier sync DID land, so we mark the local row synced and drop the
   * job. Re-running setDoc on an existing doc would be an UPDATE, which
   * firestore.rules correctly deny to citizens.
   */
  async _process(job) {
    if (job.opType === 'create-report') {
      const local = await db.reports.get(job.entityLocalId);
      // local.reportId is a client-generated UUID (crypto.randomUUID()),
      // set once at creation in report-form.js — using it as the
      // document ID, not Firestore's auto-generated one, is what makes
      // a retry idempotent. addDoc() would mint a new ID on every call,
      // silently duplicating the report if the app dies between the
      // write landing and this outbox row being deleted.
      //
      // BUG FIX: renamed from `ref` to `firestoreRef` to stop shadowing
      // the imported firebase/storage `ref` function. Previously, calling
      // ref(storage, path) on line 116 would throw "TypeError: ref is not
      // a function" because `ref` had been rebound to a DocumentReference.
      // Reproduced and confirmed fixed against the emulator (see verification
      // report, 2026-09-05).
      const firestoreRef = doc(this.fdb, 'reports', local.reportId);
      const existing = await getDoc(firestoreRef);
      if (existing.exists()) {
        // The previous attempt's write already landed — this replay is
        // success, not a fresh write. A citizen's Firestore rules only
        // permit create, not update, so retrying with setDoc again
        // here would be denied. Recognizing "already exists" as done
        // is what makes the retry idempotent instead of failing.
        await db.reports.update(job.entityLocalId, { synced: true });
        return;
      }
      if (local.photoBlob) {
        const storageRef = ref(storage, `reports/${local.reportId}`);
        await uploadBytes(storageRef, local.photoBlob);
        const photoUrl = await getDownloadURL(storageRef);
        local.payload.photoUrl = photoUrl;
      }
      await setDoc(firestoreRef, local.payload);
      await db.reports.update(job.entityLocalId, { remoteId: local.reportId, synced: true });
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
