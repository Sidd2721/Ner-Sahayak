import { db } from './db.js';
import { haversineKm } from '@shared/geo/haversine';
import { SEED_DISTRICTS } from '@shared/constants/corridors';
import { getLanguage } from './i18n.js';
import { optimizeRoute } from './map.js';

/**
 * "Find Safe Route" — online-only by design (runbook task).
 *
 * Visibility rule: the button exists in the DOM ONLY while
 * navigator.onLine is true — hidden entirely when offline, never disabled,
 * never erroring. There is deliberately NO offline routing fallback.
 *
 * Click: one-shot GPS fix → nearest HEALTHY district (connectivityStatus
 * 'connected' and continuity not CRITICAL) by haversine from
 * packages/shared → optimizeRoute() (OSRM) draws the route on the map.
 *
 * Note on DISTRICT_COORDS: packages/shared's District entity carries no
 * coordinates (correctly — it's a risk/buffer entity), and packages/shared
 * is outside this task's scope (apps/mobile only), so the representative
 * geographic points live here as presentation-layer data.
 */
const DISTRICT_COORDS = {
  'cachar-silchar': { lat: 24.818, lng: 92.796 }, // Silchar, Barak Valley hub
  hailakandi: { lat: 24.68, lng: 92.56 },
  karimganj: { lat: 24.87, lng: 92.35 },
};

// Local 3-language labels (packages/shared i18n is out of scope for this
// apps/mobile-only task; keys would otherwise need to be added there).
const LABELS = {
  en: { button: 'Find Safe Route', routing: 'Finding route to {{district}}…', routed: 'Route to {{district}} drawn', denied: 'Location permission denied — cannot find a route' },
  hi: { button: 'सुरक्षित मार्ग खोजें', routing: '{{district}} के लिए मार्ग खोजा जा रहा है…', routed: '{{district}} का मार्ग बना दिया गया', denied: 'स्थान की अनुमति नहीं मिली — मार्ग नहीं खोज सकते' },
  as: { button: 'সুৰক্ষিত পথ বিচাৰক', routing: '{{district}}লৈ পথ বিচৰা হৈ আছে…', routed: "{{district}}লৈ পথ আঁকি দিয়া হ'ল", denied: 'স্থানৰ অনুমতি নাই — পথ বিচাৰিব নোৱাৰি' },
};

function label(key, params = {}) {
  const entry = LABELS[getLanguage()] ?? LABELS.en;
  return (entry[key] ?? LABELS.en[key]).replace(/\{\{(\w+)\}\}/g, (_, n) => params[n] ?? `{{${n}}}`);
}

/** Healthy = connected AND continuity not CRITICAL (gap >= 0). */
async function nearestHealthyDistrict(from) {
  let districts = await db.districts.toArray();
  if (districts.length === 0) districts = SEED_DISTRICTS; // offline-safe fallback to seed
  const healthy = districts.filter(
    (d) => d.connectivityStatus === 'connected' && (d.continuityGap == null || d.continuityGap >= 0),
  );
  if (healthy.length === 0) return null;
  let best = null;
  let bestKm = Infinity;
  for (const d of healthy) {
    const coord = DISTRICT_COORDS[d.id];
    if (!coord) continue;
    const km = haversineKm(from, coord);
    if (km < bestKm) {
      bestKm = km;
      best = { district: d, coord, km };
    }
  }
  return best;
}

function getCurrentFix() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { timeout: 8000, enableHighAccuracy: true },
    );
  });
}

export function initSafeRouteButton() {
  if (document.getElementById('safe-route-btn')) return; // idempotent across re-binds

  const mapEl = document.getElementById('map-container');
  if (!mapEl) return;

  const btn = document.createElement('button');
  btn.id = 'safe-route-btn';
  btn.type = 'button';
  btn.className = 'safe-route-btn';
  btn.textContent = label('button');

  const status = document.createElement('span');
  status.id = 'safe-route-status';
  status.className = 'safe-route-status';

  mapEl.insertAdjacentElement('afterend', status);
  mapEl.insertAdjacentElement('afterend', btn);

  const syncVisibility = () => {
    // the ONLY rule: present when online, absent otherwise
    btn.hidden = !navigator.onLine;
    if (!navigator.onLine) status.textContent = '';
  };
  window.addEventListener('online', syncVisibility);
  window.addEventListener('offline', syncVisibility);
  syncVisibility();

  btn.addEventListener('click', async () => {
    if (!navigator.onLine) return; // belt-and-braces; button is hidden offline
    btn.disabled = true;
    try {
      let fix;
      try {
        fix = await getCurrentFix();
      } catch {
        status.textContent = label('denied');
        return;
      }
      const target = await nearestHealthyDistrict(fix);
      if (!target) {
        status.textContent = label('denied');
        return;
      }
      status.textContent = label('routing', { district: target.district.name });
      await optimizeRoute(fix, target.coord); // draws the route on the map
      status.textContent = label('routed', { district: target.district.name });
    } catch (err) {
      console.error('[safe-route] failed', err);
      status.textContent = label('denied');
    } finally {
      btn.disabled = false;
    }
  });
}

/** Refresh labels when the language changes (called from updateTranslations). */
export function updateSafeRouteButton() {
  const btn = document.getElementById('safe-route-btn');
  if (btn) btn.textContent = label('button');
}
