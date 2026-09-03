# NER Sahayak — Offline Mobile App: System Design & Complete Build Guide
### Companion to `NER-Sahayak-Web-App-Complete-Build-Guide.md` — that document covers the Control Room web dashboard (Authority-only, online-first). This document covers the **offline-first mobile PWA** (`apps/mobile`) — the app Reporters and field Authority users run on a phone with no reliable signal.

> **Scope assumption**: this follows the NH-27 / Dima Hasao corridor data model from the web-app guide (`reports`, `districts`, `corridorId: 'nh-27'`), not the earlier Majuli/ferry hackathon roadmap. The two source docs disagree on corridor — if Majuli is still in play for this build, the schema section below needs a find-replace, but the architecture underneath doesn't change. Flag it if that assumption's wrong.

---

## PART A — SYSTEM DESIGN

### A.1 Requirements

**Functional**
- Renders the Road/Corridor Status Board and last-known district risk state **with zero network**, from local storage only.
- Reporter can submit a report (type, severity, GPS, description) fully offline; it appears instantly with a "Pending Sync" state.
- Authority role (same app, different login) can see incoming reports, flip corridor status, and Ping vehicle GPS — also usable offline, syncing later.
- Multi-language UI (English / Hindi / Assamese), no live translation calls.
- Auto-syncs to Firestore the moment connectivity returns, without user action.
- Installable to home screen (real PWA, not just a bookmark).

**Non-functional**
- Cold load → first paint of the Status Board in **under ~1s** on a low-end Android on 2G/no signal.
- Must survive the airplane-mode demo/field-use pattern: load once online, then work indefinitely offline.
- Sync must tolerate duplicate sends, out-of-order delivery, and app kill mid-sync (phone locks, call comes in) without losing or duplicating a report.
- Must work on both Android Chrome and iOS Safari — **these have different offline capabilities** (see A.5, this is the single biggest constraint on the design).

**Constraints**
- Reuses `packages/shared` (`calcRisk`, `calcContinuity`, `priorityQueue`, `haversine`, `schemas/report`, `i18n/*`) — logic is never forked into the mobile app.
- The existing `index.html` MVP must keep working. This build extends it into a proper `apps/mobile/` structure; it doesn't replace it in place.
- No UI framework (React/Vue/etc) — vanilla JS. **This still uses Vite as a lightweight bundler/dev-server** (matches the existing MVP), because the code in this guide imports npm packages by bare specifier (`import Dexie from 'dexie'`) and uses a `@shared` path alias into `packages/shared` — neither resolves in a browser without a bundler. "No framework" means no component framework, not no build step; `vite build` is what actually produces the deployable `dist/` folder in Phase 1.

### A.2 High-level design

```
┌─────────────────────────────── PHONE ────────────────────────────────┐
│                                                                        │
│   App Shell (HTML/CSS/JS, installed)                                  │
│        │                                                              │
│        ├── Service Worker  ── precache: shell + i18n bundles          │
│        │                   ── runtime cache: shell revalidation       │
│        │                   (never intercepts Firestore's own traffic) │
│        │                                                              │
│        ├── IndexedDB (Dexie) ── reports (local mirror, read model)    │
│        │                     ── outbox (offline write queue)          │
│        │                     ── corridorState / districts (cache)     │
│        │                     ── session (current role/user)           │
│        │                                                              │
│        └── Sync Engine  ── flush outbox → Firestore when online       │
│                          ── Firestore onSnapshot → merge into Dexie   │
│                          ── Background Sync API (Android) / online    │
│                             event + foreground poll (iOS fallback)    │
│                                                                        │
└──────────────────────────────┬─────────────────────────────────────-─┘
                                │ (only when connectivity exists)
                                ▼
                     Firebase Auth + Firestore
                     (reports / districts / corridors)
```

### A.3 Data flow — report submission

1. Reporter fills form → GPS captured → `calcRisk`/`priorityKey` computed **locally** from `packages/shared` (no server round-trip needed to show the number).
2. Write goes into Dexie in one transaction: insert into `reports` (status: local, synced: false) **and** insert a matching job into `outbox`.
3. UI re-renders from Dexie immediately — "Pending Sync" badge. This step has no network dependency at all.
4. Sync engine wakes (online event, Background Sync callback, or foreground poll) → reads `outbox` FIFO → writes to Firestore.
5. On Firestore ack: mark the `reports` row `synced: true`, delete the `outbox` row, store the server-assigned `remoteId`.
6. On failure (offline again mid-flush, quota error): leave the `outbox` row, back off, retry later. The row is never dropped except by explicit success.

Because creation is the only mutation a Reporter makes, there's no create-side conflict to resolve. Status *transitions* (verify/dispatch/resolve), which only Authority makes, are last-write-wins on server timestamp — the local UI shows an "optimistic" status with a small sync indicator until Firestore confirms it.

### A.4 Caching strategy — three different mechanisms, on purpose

| What | Mechanism | Why not something simpler |
|---|---|---|
| App shell (HTML/CSS/JS) | Service worker, cache-first, versioned cache name | Needs to render with literally zero network |
| Reference data (corridor line coords, district boundaries, i18n strings) | Bundled directly as JS/JSON imports from `packages/shared` — not fetched at all | Removes a whole class of "did the fetch cache correctly" bugs. If it's static and known at build time, don't put it behind a network layer you then have to make offline-safe. |
| Live entity data (reports, districts) | Dexie, hand-synced by the Sync Engine | See A.6 for why this is the one place a real decision was made |

### A.5 The iOS constraint (read this before writing any sync code)

**Background Sync API (`registration.sync.register(...)`) does not exist on iOS Safari.** Android Chrome supports it; iOS does not, and there's no polyfill that actually gets your code woken up in the background there.

Practical effect: on iOS, the app can only flush the outbox while it's *open and foregrounded*. Design around this rather than around the ideal:
- Flush on `online` event.
- Flush on `visibilitychange` → visible (covers "I opened the app back up").
- Flush every ~15–30s via `setInterval` **only while the tab is foregrounded** (don't run a background timer that dies with the tab anyway).
- Register Background Sync on Android as a bonus, not a dependency — the foreground-flush logic must work standalone, because it's the only thing that works on both platforms.

This is a real limitation to say out loud in the demo/roadmap-honesty slide, not something to paper over.

### A.6 Trade-off: Dexie mirror vs. Firestore's built-in offline persistence

Firestore's JS SDK ships `enableIndexedDbPersistence()`, which gives you offline reads/writes almost for free. Two real options:

**Option A — Firestore built-in persistence.** Less code. But: flaky under iOS Safari private browsing (silently fails, no error), and it caches whatever Firestore SDK decides to cache — you don't get to compose it with locally-computed risk numbers or control exactly what's resident for the "renders in <1s with zero network" requirement.

**Option B — Custom Dexie mirror + manual Sync Engine (recommended, matches existing architecture).** More code, but: full control over what's cached and when, works identically on both platforms, and the `outbox` pattern gives an explicit, inspectable queue you can show a judge or debug in the field ("here's exactly what hasn't synced yet"). This is what the rest of this guide builds.

Don't run both at once — enabling Firestore persistence *and* hand-rolling Dexie sync on the same collection is a good way to get two different offline copies of the same data disagreeing with each other.

---

## PART B — BUILD ROADMAP

### PHASE 0 — Prerequisites

- [ ] `packages/shared` exists and exports `calcRisk`, `calcContinuityGap`, `calcPriorityKey`, `haversine`, `schemas/report` — same check as the web-app guide's Phase 0.1. Don't start until that passes.
- [ ] `packages/shared/i18n/en.json` and `hi.json` exist. **`as.json` (Assamese) likely doesn't exist yet** — the source docs mention an Assamese pass but the shared-package file list only shows `en`/`hi`. Create it now if it's missing; don't discover this gap during Hour 3 of a build.
- [ ] Existing `index.html` MVP still loads and works. This build extends it — confirm the baseline before touching it.
- [ ] Two real test phones: one Android Chrome, one iOS Safari. Everything in A.5 above means "works on my Android dev phone" is not a finished state.

### PHASE 1 — Project structure

```bash
mkdir -p apps/mobile/src
cd apps/mobile
npm init -y
npm install dexie firebase
npm install -D vite
```

`apps/mobile/package.json` — add these scripts (the rest of `npm init -y`'s output is fine as-is):
```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

`apps/mobile/vite.config.js` — this is what makes the bare imports (`import Dexie from 'dexie'`) and the `@shared` alias used throughout this guide actually resolve:
```js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: { port: 3001 },
  build: { outDir: 'dist' }, // this is the folder Phase 12 deploys
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
```

`index.html` needs its script tag as a module for Vite to pick it up:
```html
<script type="module" src="/src/main.js"></script>
```

**Checkpoint**: `npm run dev` starts a dev server on :3001 and the page loads without a "Failed to resolve module" console error.

```
apps/mobile/
├── index.html
├── manifest.json
├── sw.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── db.js            # Dexie schema
    ├── sync.js          # Sync engine
    ├── report-form.js   # Reporter submission flow
    ├── status-board.js  # Corridor status rendering
    ├── risk.js          # thin wrapper around packages/shared calcRisk
    ├── i18n.js           # language toggle
    ├── auth.js           # Firebase Auth (session cached for offline)
    └── main.js           # boot sequence
```

`manifest.json`:
```json
{
  "name": "NER Sahayak",
  "short_name": "NER Sahayak",
  "start_url": "/apps/mobile/index.html",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#1d4ed8",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Checkpoint**: Chrome DevTools → Application → Manifest shows no errors, and an "Install" prompt is available.

### PHASE 2 — IndexedDB schema (Dexie)

`src/db.js`:
```js
import Dexie from 'dexie';

export const db = new Dexie('nersahayak');

db.version(1).stores({
  // local mirror / read model — what the UI actually renders from
  reports: '++localId, remoteId, type, status, synced, priorityKey, createdAt',

  // offline write queue — the ONLY path writes take before Firestore ack
  outbox: '++id, opType, entityLocalId, createdAt, retries',

  // singleton-ish cache of corridor-level state (risk, status)
  corridorState: 'corridorId',

  // per-district cache (continuity board data)
  districts: 'id, connectivityStatus, continuityGap',

  // current logged-in role, cached so offline relaunch doesn't need network
  session: 'key'   // row shape: { key: 'currentUser', uid, email, role }
});
```

**Checkpoint**: `db.reports.count()` in the console returns `0` on first load, not an error — confirms the schema opened cleanly.

### PHASE 3 — Service worker

`sw.js`:
```js
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `ner-shell-${CACHE_VERSION}`;

const SHELL_FILES = [
  '/apps/mobile/index.html',
  '/apps/mobile/manifest.json',
  '/apps/mobile/src/main.js',
  '/apps/mobile/src/db.js',
  '/apps/mobile/src/sync.js',
  '/apps/mobile/src/report-form.js',
  '/apps/mobile/src/status-board.js',
  '/apps/mobile/src/risk.js',
  '/apps/mobile/src/i18n.js',
  '/apps/mobile/src/auth.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting(); // don't wait for old tabs to close before activating
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER intercept Firebase/Firestore traffic — let its own SDK handle
  // retries, streaming, and auth headers. Intercepting this breaks
  // real-time listeners in ways that are hard to debug.
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // cache-first for the app shell, fall back to network, then to cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('/apps/mobile/index.html'));
    })
  );
});

// Android only — iOS ignores this event entirely, see A.5
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-outbox') {
    event.waitUntil(self.clients.matchAll().then((clients) => {
      clients.forEach((c) => c.postMessage({ type: 'FLUSH_OUTBOX' }));
    }));
  }
});
```

**Checkpoint**: DevTools → Application → Service Workers shows "activated and running". Background/foreground the browser and confirm the shell still renders with the network tab set to "Offline".

### PHASE 4 — Sync engine

`src/sync.js`:
```js
import { db } from './db.js';
import { getFirestore, collection, addDoc, doc, updateDoc } from 'firebase/firestore';

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
    // iOS fallback: only runs while the tab is actually open (see A.5)
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
            // stop retrying a poison job forever; surface it instead of
            // silently blocking every job behind it
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
```

**Checkpoint**: submit a report with WiFi off → `db.outbox.count()` is `1`. Turn WiFi on, wait ~20s (or foreground the tab) → outbox drains to `0` and the report shows up in the Firestore console.

### PHASE 5 — Report submission (offline-first write path)

`src/report-form.js`:
```js
import { db } from './db.js';
import { calcRisk } from '@shared/risk/calcRisk';
import { calcPriorityKey } from '@shared/priority/priorityQueue';

export async function submitReport({ type, severity, description }, corroborationScore = 0.5) {
  const coords = await getCoordinates(); // see Phase 7
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

  renderPendingBadge(); // instant UI feedback, no await on network
}

async function getCoordinates() {
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
    );
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // permission denied or timeout — fall back to last-known cached fix
    // rather than blocking submission entirely
    const last = await db.session.get('lastKnownLocation');
    return last?.value || { lat: null, lng: null };
  }
}
```

**Checkpoint**: with location permission denied, submission still completes (with `lat/lng: null` or last-known) instead of hanging or erroring.

### PHASE 6 — Corridor Status Board (render from cache, not network)

`src/status-board.js`:
```js
import { db } from './db.js';

export async function renderStatusBoard() {
  const corridor = await db.corridorState.get('nh-27');
  const districts = await db.districts.toArray();

  const el = document.getElementById('status-board');
  el.innerHTML = districts.map((d) => `
    <div class="district-row status-${d.connectivityStatus.toLowerCase()}">
      <span>${d.name}</span>
      <span>${d.connectivityStatus}</span>
      <span>${d.continuityGap}d gap</span>
    </div>
  `).join('');
}

// Live updates from Firestore, when online, merge into the same cache
// the offline render reads from — one source of truth, not two.
export function subscribeCorridorUpdates(fdb, onSnapshot, collection, doc) {
  const ref = doc(fdb, 'corridors', 'nh-27');
  return onSnapshot(ref, async (snap) => {
    if (snap.exists()) {
      await db.corridorState.put({ corridorId: 'nh-27', ...snap.data() });
      renderStatusBoard();
    }
  });
}
```

**Checkpoint**: airplane mode on, kill and relaunch the app. Status Board renders immediately from the last-synced state — no spinner, no blank screen.

### PHASE 7 — Risk engine, wired to the shared formula

`src/risk.js`:
```js
import { calcRisk } from '@shared/risk/calcRisk';

const BANDS = [
  { max: 25, key: 'risk.low' },
  { max: 50, key: 'risk.moderate' },
  { max: 75, key: 'risk.high' },
  { max: 101, key: 'risk.severe' },
];

export function plainLanguageRisk(inputs, t /* i18n translate fn */) {
  const score = calcRisk(inputs); // imported, never re-implemented locally
  const band = BANDS.find((b) => score <= b.max);
  return { score, message: t(band.key) };
}
```

**Checkpoint**: change one input, plain-language line updates, and the score matches what the web dashboard shows for the same inputs — same formula, same result, both surfaces.

### PHASE 8 — Language toggle

- Load `packages/shared/i18n/{en,hi,as}.json` as static imports (bundled, not fetched) — consistent with A.4's "reference data isn't behind a network layer" decision.
- `src/i18n.js` holds current language in `localStorage` (fine for a simple flag — this isn't entity data) and a `t(key)` lookup function.
- Every screen re-renders from its own `render()` function on language change; no partial-translated screens.

**Checkpoint**: toggle through all three languages on the Status Board and the report form with WiFi off. Nothing falls back to English mid-screen — if `as.json` is missing a key, that's the bug to fix, not a silent fallback to ship.

### PHASE 9 — Auth (cached for offline relaunch)

- Firebase Auth's default persistence already writes the session to IndexedDB, so a relaunch offline keeps the user logged in — no custom code needed for that part.
- On successful login, cache `{ uid, email, role }` into `db.session` so role-gated UI (Reporter vs Authority) can render before Firebase Auth's async state even resolves.

```js
import { onAuthStateChanged } from 'firebase/auth';
import { db } from './db.js';

export function initAuth(auth) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await db.session.put({ key: 'currentUser', uid: user.uid, email: user.email });
    }
  });
}

export async function getCachedRole() {
  return (await db.session.get('currentUser'))?.role || null;
}
```

**Checkpoint**: log in once online, then airplane-mode relaunch — the correct role's screen renders, not a login prompt.

### PHASE 10 — Testing protocol

| Test | Android Chrome | iOS Safari |
|---|---|---|
| Install to home screen | | |
| Cold load, WiFi on, first paint < 1s | | |
| Airplane mode, relaunch, Status Board renders | | |
| Submit report offline → outbox count = 1 | | |
| WiFi back on → outbox drains without app being reopened | | *(expected to need foreground — see A.5)* |
| WiFi back on, app foregrounded → outbox drains | | |
| Language toggle, all 3 languages, offline | | |
| GPS permission denied → submission still completes | | |
| Kill app mid-sync, relaunch → no duplicate report in Firestore | | |

Run Lighthouse's PWA audit (Chrome DevTools) and confirm: installable, works offline, fast enough on 3G-throttled load.

### PHASE 11 — Common errors

**"Service worker updates but the app still shows old code"**
→ `skipWaiting()` + `clients.claim()` are in the SW (Phase 3), but the *page* also needs `navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())` once, or users are stuck on a stale controller until manual close.

**"Outbox count grows forever, nothing drains"**
→ Almost always a Firestore rule rejecting the write silently-ish (check the console for a `permission-denied` in `_process`). Re-check the rules from the web-app guide's Phase 0.2 are actually published, not still in test mode.

**"Works on Android, silently does nothing on iOS after going back online in the background"**
→ Expected — this is A.5. iOS has no Background Sync. Confirm the foreground-flush path (visibilitychange, online event, interval) is what's carrying iOS, not the `sync` event registration.

**"IndexedDB blocked / VersionError on schema change"**
→ Another tab has the DB open on an older schema version. Close all other tabs/instances of the app before bumping `db.version(n)`.

**"Firestore persistence errors after adding Dexie"**
→ Don't call `enableIndexedDbPersistence()` if you went with Option B (A.6). Having both running against the same collection is the usual cause of two disagreeing local copies.

### PHASE 12 — Deploy (this is what makes it reachable from an actual phone)

Everything through Phase 11 works on `localhost`. Service workers require HTTPS (`localhost` is exempted for dev, nothing else is) — so a phone needs a real HTTPS URL to visit before any of the offline behavior above is testable on-device.

```bash
# run from the repo root, not from inside apps/mobile — init and
# deploy both need the same firebase.json rules/functions already use
cd apps/mobile && npm install && npm run build && cd ..
firebase init hosting   # public directory: apps/mobile/dist
firebase deploy --only hosting
```

This gives a URL like `https://<project-id>.web.app`. Full walkthrough (including the equivalent for `apps/web`, and the real Firebase keys `dist/` gets built with) is in `NER-Sahayak-API-Keys-Setup-Guide-v2.md`, Part 5.

**Checkpoint**: open the deployed URL on a phone that has never visited it, on cellular data (not the same WiFi as your dev machine — confirms it's actually public, not just resolving on your LAN). Confirm the install prompt appears and the app loads.

---

## Final checklist

- [ ] `packages/shared` imports used for risk/priority/i18n — nothing forked locally
- [ ] `apps/mobile/index.html` (existing MVP) still loads unmodified in its original location
- [ ] Service worker: install → activate → fetch handler explicitly skips Firebase domains
- [ ] Outbox pattern: every offline write goes through `db.outbox`, none write to Firestore directly
- [ ] iOS foreground-flush path tested independently of Background Sync
- [ ] All 3 languages complete, including `as.json` if it didn't already exist
- [ ] Airplane-mode relaunch test passes on both a phone that has and hasn't visited the app before
- [ ] Lighthouse PWA audit: installable + offline-capable

If all checked: the offline app is demo-ready alongside the web dashboard.
