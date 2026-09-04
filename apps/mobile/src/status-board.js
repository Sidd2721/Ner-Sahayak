import { db } from './db.js';

export async function renderStatusBoard() {
  const corridor = await db.corridorState.get('nh-27');
  const districts = await db.districts.toArray();

  const el = document.getElementById('status-board');
  if (!el) return;

  if (districts.length === 0) {
    el.innerHTML = '<div style="padding:1rem; text-align:center; color:#64748b;">No district data found</div>';
    return;
  }

  el.innerHTML = districts.map((d) => {
    let icon = '🟢';
    let label = d.connectivityStatus || 'OK';
    if (d.connectivityStatus === 'isolated') { icon = '🔴'; }
    else if (d.connectivityStatus === 'degraded') { icon = '🟠'; }
    
    return `
    <div class="district-row status-${d.connectivityStatus ? d.connectivityStatus.toLowerCase() : 'connected'}">
      <span>${d.id}</span>
      <span>${icon} ${label}</span>
      <span>${d.continuityGap || 0}d gap</span>
    </div>
  `}).join('');
}

export function subscribeCorridorUpdates(fdb, onSnapshot, collection, doc) {
  const corridorRef = doc(fdb, 'corridors', 'nh-27');
  const corridorUnsub = onSnapshot(corridorRef, async (snap) => {
    if (snap.exists()) {
      await db.corridorState.put({ corridorId: 'nh-27', ...snap.data() });
      renderStatusBoard();
    }
  });

  const districtsRef = collection(fdb, 'districts');
  const districtsUnsub = onSnapshot(districtsRef, async (snap) => {
    for (const d of snap.docs) {
      await db.districts.put({ id: d.id, ...d.data() });
    }
    renderStatusBoard();
  });

  return () => {
    corridorUnsub();
    districtsUnsub();
  };
}

/**
 * Updates the pending-report badge count in the UI immediately after a report
 * is written to the local IndexedDB outbox — no network call.
 */
export async function renderPendingBadge() {
  const count = await db.outbox.count();
  const badge = document.getElementById('pending-badge');
  if (badge) {
    badge.textContent = count > 0 ? `${count} pending` : '';
    if (count > 0) {
      badge.classList.remove('hidden');
      badge.style.display = 'inline';
    } else {
      badge.classList.add('hidden');
      badge.style.display = 'none';
    }
  }
}
