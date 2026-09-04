import Dexie from 'dexie';

export const db = new Dexie('nersahayak');

db.version(1).stores({
  // local mirror / read model — what the UI actually renders from
  reports: '++localId, reportId, type, status, synced, priorityKey, createdAt, geohash, corridorId, reporterId',

  // offline write queue — the ONLY path writes take before Firestore ack
  outbox: '++id, opType, entityLocalId, createdAt, retries',

  // singleton-ish cache of corridor-level state (risk, status)
  corridorState: 'corridorId',

  // per-district cache (continuity board data)
  districts: 'id, connectivityStatus, continuityGap',

  // current logged-in role, cached so offline relaunch doesn't need network
  session: 'key'   // row shape: { key: 'currentUser', uid, email, role }
});
