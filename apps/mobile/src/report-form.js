import { db } from './db.js';
import { calcPriorityKey } from '@shared/risk/priorityQueue';
import { encodeGeohash } from '@shared/geo/geohash';
import { NH27_CORRIDOR } from '@shared/constants/corridors';
import { getCachedUser } from './auth.js';
import { renderPendingBadge } from './status-board.js';

/**
 * Report submission — build guide Phase 5, the offline-first write path.
 * One Dexie transaction inserts the report AND its outbox job, so the pair
 * can never diverge. No network call anywhere in this module.
 */

export const REPORT_TYPES = [
  { value: 'road-blocked', key: 'report.type.roadBlocked' },
  { value: 'route-clear', key: 'report.type.routeClear' },
  { value: 'landslide', key: 'report.type.landslide' },
  { value: 'flood', key: 'report.type.flood' },
  { value: 'bridge-damage', key: 'report.type.bridgeDamage' },
  { value: 'other', key: 'report.type.other' },
];

export async function submitReport({ type, severity, description }) {
  const coords = await getCoordinates();
  const user = await getCachedUser();
  // NH-27 carries the maximum criticalityWeight (1.0); corroboration starts
  // at 0 — §4.4 escalation happens server-side as distinct reports arrive.
  const priorityKey = calcPriorityKey({
    severity,
    corroborationScore: 0,
    criticalityWeight: NH27_CORRIDOR.criticalityWeight,
  });
  const createdAt = new Date().toISOString();
  // client-generated UUID at creation; sync is an idempotent upsert on it
  // (ARCHITECTURE.md §10 — duplicate-report-on-offline-retry resolution)
  const reportId = crypto.randomUUID(); // this becomes the Firestore doc ID —
                                          // generated once, here, so every retry
                                          // of the same report targets the same
                                          // doc instead of minting a new one

  await db.transaction('rw', db.reports, db.outbox, async () => {
    const localId = await db.reports.add({
      reportId,
      type, severity, description,
      lat: coords.lat, lng: coords.lng,
      status: 'pending',
      synced: false,
      priorityKey, // kept locally for offline sort/display ordering only
      createdAt: new Date(),
      // corroborationScore and priorityKey are deliberately NOT in this
      // payload — Milestone 2's Firestore rules mark both server-only
      // (computed by the onReportCreate trigger), and reject a client
      // create that includes them. Sending them here would fail, not
      // silently succeed with a wrong value.
      payload: { reportId, type, severity, description, lat: coords.lat, lng: coords.lng,
                 status: 'pending', createdAt: new Date() },
    });
    await db.outbox.add({
      opType: 'create-report',
      entityLocalId: localId,
      createdAt: new Date(),
      retries: 0,
    });
  });

  renderPendingBadge(); // instant UI feedback — no await on network
  return { id: reportId };
}

/**
 * GPS capture with fallback — permission denied or timeout falls back to
 * the last-known cached fix rather than blocking submission entirely
 * (guide Phase 5 checkpoint: submission still completes).
 */
async function getCoordinates() {
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
    );
    const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    await db.session.put({ key: 'lastKnownLocation', value: fix, at: Date.now() });
    return fix;
  } catch {
    const last = await db.session.get('lastKnownLocation');
    return last?.value || { lat: null, lng: null };
  }
}
