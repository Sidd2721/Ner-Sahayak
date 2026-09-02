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

  el.innerHTML = districts.map((d) => `
    <div class="district-row status-${d.connectivityStatus ? d.connectivityStatus.toLowerCase() : 'ok'}">
      <span>${d.id}</span>
      <span>${d.connectivityStatus || 'OK'}</span>
      <span>${d.continuityGap || 0}d gap</span>
    </div>
  `).join('');
}

export function subscribeCorridorUpdates(fdb, onSnapshot, collection, doc) {
  const ref = doc(fdb, 'corridors', 'nh-27');
  return onSnapshot(ref, async (snap) => {
    if (snap.exists()) {
      await db.corridorState.put({ corridorId: 'nh-27', ...snap.data() });
      renderStatusBoard();
    }
  });
}
