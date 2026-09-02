import { db } from './db.js';
import { calcRisk } from '@shared/risk/calcRisk';
import { calcPriorityKey } from '@shared/risk/priorityQueue';

export async function submitReport({ type, severity, description }, corroborationScore = 0.5) {
  const coords = await getCoordinates();
  const priorityKey = calcPriorityKey(corroborationScore, severity / 10, 1.0);

  await db.transaction('rw', db.reports, db.outbox, async () => {
    const localId = await db.reports.add({
      type, severity, description,
      lat: coords.lat, lng: coords.lng,
      status: 'pending',
      synced: false,
      priorityKey,
      createdAt: new Date(),
      payload: { type, severity, description, lat: coords.lat, lng: coords.lng,
                 status: 'pending', priorityKey, createdAt: new Date() },
    });
    await db.outbox.add({
      opType: 'create-report',
      entityLocalId: localId,
      createdAt: new Date(),
      retries: 0,
    });
  });

  renderPendingBadge();
}

async function getCoordinates() {
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
    );
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    const last = await db.session.get('lastKnownLocation');
    return last?.value || { lat: null, lng: null };
  }
}

function renderPendingBadge() {
  const badge = document.getElementById('sync-status');
  if (badge) {
    badge.classList.remove('hidden');
    badge.textContent = 'Pending Sync';
  }
}
