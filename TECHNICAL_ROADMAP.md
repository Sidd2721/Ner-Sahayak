# NER Sahayak — Technical Roadmap & Project File Structure

Companion to `ARCHITECTURE.md` (the *why*) and `ROADMAP.md` (the *phase plan*). This file is strictly the *what to code, where, in what order* — for the mobile app, the web app, and the backend, once you move past the single-file hackathon MVP.

---

## 0. Where you actually write the code

Three realistic setups, pick the one that matches your situation:

- **Still solo, still no coding background** — keep doing exactly what got you the MVP: describe one milestone below at a time (in this chat, or in Claude Code if you've moved to a local machine) and have the files generated directly, the same way `index.html` was built. You review and run it; you don't hand-type it.
- **A teammate joins who codes** — get the structure below onto GitHub *today*, even empty. They clone it, open it in VS Code (or Claude Code / Cursor), and work through the milestones in order. Each app folder has its own `package.json`, tied together with npm workspaces at the root (one `npm install` at the root installs everything).
- **Freelancer/mentor picks this up later** — this file *is* the brief you hand them. Section 3 (build order) is written so each milestone is a self-contained, checkable unit of work.

Either way — put this on GitHub now. You'll want a repo link for the submission regardless, and Phase 1 (real backend) needs a real deployable place to live.

---

## 1. Why the structure changes shape between MVP and production

The hackathon MVP is one file on purpose (`ARCHITECTURE.md` §3 — nothing to break before judging). That decision doesn't get reversed here, it gets **graduated**: a single responsive PWA is enough right up until a control-room operator needs things a phone-shell can only approximate — big sortable tables, a real corridor map with live layers, multi-corridor comparison views. That's the point where `apps/web` becomes a real, separate, heavier build — not because the MVP decision was wrong, but because the product outgrew it. `packages/shared` is what stops the two apps from drifting into two different products: the risk formula, the data schemas, and the translations live in exactly one place, imported by both.

---

## 2. Complete project file structure

```
ner-sahayak/
├── apps/
│   ├── mobile/                          # field/citizen/officer app — Layer 0/4, offline-first
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.ts                  # boot(), screen router
│   │   │   ├── db/
│   │   │   │   ├── indexeddb.ts         # open/read/write helpers (ported from the MVP's IDB layer)
│   │   │   │   └── mutationQueue.ts     # offline queue + exponential-backoff sync (Architecture §Layer 1)
│   │   │   ├── screens/
│   │   │   │   ├── Login.ts
│   │   │   │   ├── CitizenHome.ts
│   │   │   │   ├── AuthorityHome.ts
│   │   │   │   ├── ReportModal.ts
│   │   │   │   └── Settings.ts
│   │   │   ├── features/
│   │   │   │   ├── riskEngine.ts        # thin wrapper calling packages/shared/risk
│   │   │   │   ├── supplyContinuity.ts  # thin wrapper calling packages/shared/continuity
│   │   │   │   ├── nearbyHelp.ts        # haversine ranking (Architecture §4-help)
│   │   │   │   ├── vehicleTracking.ts   # GPS ping capture + display
│   │   │   │   └── dedup.ts             # geohash bucketing calls (Architecture §4.4)
│   │   │   ├── i18n/index.ts            # imports packages/shared/i18n
│   │   │   ├── api/client.ts            # replaces the MVP's simulated "Sync now" with real calls
│   │   │   └── styles/tokens.css
│   │   ├── public/{manifest.json, icon.svg}
│   │   ├── sw.ts                        # service worker source
│   │   ├── vite.config.ts               # vite-plugin-pwa for install + offline caching
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                             # control-room dashboard — Layer 4 (heavy), desktop-first
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   ├── page.tsx                 # redirect → /login or /dashboard
│       │   ├── login/page.tsx           # real Firebase Auth
│       │   └── dashboard/
│       │       ├── layout.tsx           # sidebar nav + corridor selector
│       │       ├── page.tsx             # overview: stat cards + corridor map
│       │       ├── reports/
│       │       │   ├── page.tsx         # priority-sorted queue table (Architecture §4.5)
│       │       │   └── [reportId]/page.tsx
│       │       ├── corridors/[corridorId]/page.tsx   # risk engine controls + district list
│       │       ├── continuity/page.tsx  # Supply Continuity Score board (Architecture §4.1)
│       │       ├── vehicles/page.tsx    # vehicle tracking map + ping log
│       │       └── settings/page.tsx
│       ├── components/
│       │   ├── map/CorridorMap.tsx      # Leaflet + OSM tiles, district/report markers
│       │   ├── charts/RiskTrendChart.tsx      # Recharts
│       │   ├── charts/ContinuityGauge.tsx
│       │   ├── tables/ReportsTable.tsx
│       │   ├── tables/VehicleTable.tsx
│       │   ├── cards/StatCard.tsx
│       │   ├── cards/ContinuityCard.tsx
│       │   └── ui/                      # shadcn/ui primitives (button, select, dialog, badge…)
│       ├── lib/
│       │   ├── firebase.ts              # client SDK init
│       │   ├── auth.ts                  # role-based route guards
│       │   ├── api.ts                   # typed wrappers around functions/ callable endpoints
│       │   └── format.ts
│       ├── hooks/
│       │   ├── useReports.ts            # Firestore onSnapshot live query
│       │   ├── useCorridorRisk.ts
│       │   ├── useContinuity.ts
│       │   └── useAuth.ts
│       ├── middleware.ts                # blocks /dashboard routes by role
│       ├── public/
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── functions/                           # Firebase Cloud Functions — Layer 2 backend
│   ├── src/
│   │   ├── index.ts                     # exports every function below
│   │   ├── triggers/
│   │   │   ├── onReportCreate.ts        # corroboration scoring + priority recompute (§4.4, §4.5)
│   │   │   └── onRiskScoreUpdate.ts     # recompute continuity scores, fire AlertBroadcast (§4.1, §4.7)
│   │   ├── callable/
│   │   │   ├── calculateRisk.ts         # server-side risk calc; swap-in point for trained weights (§5)
│   │   │   ├── dispatchMatch.ts         # nearest-resource matching (§4.6)
│   │   │   └── syncMutationQueue.ts     # idempotent upsert endpoint for the offline queue flush
│   │   └── config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── packages/
│   └── shared/                          # single source of truth — imported by mobile, web, functions
│       ├── src/
│       │   ├── schemas/
│       │   │   ├── report.ts            # Zod schema + TS type (Architecture §6)
│       │   │   ├── district.ts
│       │   │   ├── corridor.ts
│       │   │   ├── resource.ts
│       │   │   ├── dispatchAssignment.ts
│       │   │   └── alertBroadcast.ts
│       │   ├── risk/
│       │   │   ├── calcRisk.ts          # ported 1:1 from the MVP's calcRisk()
│       │   │   └── closureDays.ts       # CLOSURE_DAYS_BY_CATEGORY map
│       │   ├── continuity/calcContinuity.ts   # continuity_gap formula (§4.1)
│       │   ├── priority/priorityQueue.ts      # severity × corroboration × criticalityWeight (§4.5)
│       │   ├── geo/{haversine.ts, geohash.ts}
│       │   ├── i18n/{en.json, hi.json}
│       │   └── constants/corridors.ts   # NH-27 seed corridor config (Architecture §2)
│       ├── package.json
│       └── tsconfig.json
│
├── ml/                                  # Layer 3 — training, outside the app runtime
│   ├── notebooks/train_risk_model.ipynb
│   ├── data/README.md                   # where to source ASDMA bulletins / Kaggle dataset
│   ├── export_weights.py
│   └── weights.json                     # consumed by functions/callable/calculateRisk.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── TECHNICAL_ROADMAP.md             # this file
│
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc
├── package.json                         # npm workspaces root
└── README.md
```

---

## 3. Build order — one milestone at a time, nothing started early

Each milestone lists the files it produces and which architecture section it implements, so you can check it off against `ARCHITECTURE.md` directly.

### Milestone 1 — Shared data layer (`packages/shared`)
Do this first; everything else imports from it, so building it out of order means rework later.
- [ ] `schemas/*.ts` — one file per entity in Architecture §6, as Zod schemas (gives you runtime validation *and* TS types from one definition)
- [ ] `risk/calcRisk.ts` — port straight from the MVP's `calcRisk()` function, unchanged logic
- [ ] `continuity/calcContinuity.ts` — port the `continuity_gap` formula (Architecture §4.1)
- [ ] `priority/priorityQueue.ts` — implement `severity × corroboration × criticalityWeight` (§4.5) as a min-heap or sorted-insert structure
- [ ] `geo/haversine.ts`, `geo/geohash.ts`
- [ ] `i18n/en.json`, `i18n/hi.json` — copy the two dictionaries out of the MVP's `index.html`
- [ ] `constants/corridors.ts` — the NH-27 seed data (Lumding/Maibang/Haflong/Silchar/Hailakandi/Karimganj), structured as `Corridor` + `District[]` per the schema, not hardcoded strings

**Done when**: a throwaway test script can import `calcRisk`, `calcContinuity`, and `priorityQueue` and get the same numbers the MVP's UI currently shows.

### Milestone 2 — Backend (`functions/`, maps to `ROADMAP.md` Phase 1)
- [ ] `firebase init` at repo root; Firestore in production mode, Auth enabled
- [ ] `firestore.rules` — role-based access exactly as specified in `ARCHITECTURE.md` §7
- [ ] `callable/calculateRisk.ts` — same formula as shared, but this is where trained weights (from `ml/weights.json`) get loaded instead of the MVP's hardcoded 0.35/0.25/0.25/0.15
- [ ] `triggers/onReportCreate.ts` — on every new `Report` doc: geohash it, count distinct `reporterId`s in the same bucket/window, write `corroborationScore`, recompute its position in the priority queue
- [ ] `triggers/onRiskScoreUpdate.ts` — on `District.currentRiskScore` change: recompute `continuity_gap` for that district, and if it crosses the pre-positioning threshold, write an `AlertBroadcast` doc (§4.7)
- [ ] `callable/dispatchMatch.ts` — greedy nearest-available-`Resource` match (§4.6); leave a clearly marked TODO for the Hungarian-algorithm upgrade, don't build it yet
- [ ] `callable/syncMutationQueue.ts` — accepts the mobile app's queued mutations, upserts by client-generated UUID (idempotent, per `ARCHITECTURE.md` §10)

**Done when**: you can create a `Report` document by hand in the Firebase console and watch `corroborationScore` and the priority ordering update without touching any app code.

### Milestone 3 — Mobile app real sync (`apps/mobile`)
- [ ] Split the MVP's single `index.html` into the module structure in Section 2 above — same logic, same UI, just organized into files (this alone makes the codebase reviewable by a teammate)
- [ ] `api/client.ts` — replace the "Sync now" button's *simulated* status flip with a real call to `syncMutationQueue`
- [ ] `db/mutationQueue.ts` — add real exponential backoff (the MVP's version is a single manual retry via the button)
- [ ] Wire `vite-plugin-pwa` so the build output is still the same zero-dependency-once-loaded bundle the offline demo relied on — **do not lose that property while modularizing**

**Done when**: airplane-mode test from `README.md`'s demo checklist still passes on the modular build, and a report submitted offline actually appears in Firestore once synced — not just flips a local badge.

### Milestone 4 — Web app (`apps/web`, maps to `ROADMAP.md` Phase 3)
Only start this once Milestones 1–3 are solid — the web app is a *view* onto the same backend, not a place to reimplement logic.
- [ ] `lib/firebase.ts`, `lib/auth.ts` — client init + role-gated routes via `middleware.ts`
- [ ] `hooks/useReports.ts` — live `onSnapshot` query, already priority-sorted server-side
- [ ] `components/tables/ReportsTable.tsx` — this replaces the MVP's simple list with sortable/filterable columns
- [ ] `components/map/CorridorMap.tsx` — Leaflet + OSM tiles, markers colored by `District.connectivityStatus`; this is the first place a *real* map (not the MVP's list-based district view) belongs
- [ ] `components/cards/ContinuityCard.tsx` + `continuity/page.tsx` — the Supply Continuity board, now with a trend chart (`ContinuityGauge.tsx`) instead of just today's number
- [ ] `corridors/[corridorId]/page.tsx` — risk-engine sliders, same formula as mobile, calling the same `calculateRisk` callable

**Done when**: a control-room operator can do everything the phone app's Authority view does, plus sort/filter reports and see the corridor on an actual map — without any logic being duplicated (check: is the risk formula imported from `packages/shared`, or retyped? If retyped, stop and fix it).

### Milestone 5 — ML pipeline (`ml/`, maps to `ROADMAP.md` Phase 1 risk-model step, done for real this time)
- [ ] `notebooks/train_risk_model.ipynb` — same approach as the hackathon Colab notebook, now trained on a larger dataset if available
- [ ] `export_weights.py` — writes `ml/weights.json` in the exact shape `functions/callable/calculateRisk.ts` expects
- [ ] Manual step (not automated yet, and that's fine): re-run training periodically, redeploy `weights.json`, redeploy the function

### Milestone 6 — Government-integration hardening (maps to `ROADMAP.md` Phase 4)
- [ ] Swap OpenWeatherMap free tier for IMD's feed once/if that access is granted
- [ ] Self-hosted OSRM instance replacing the public demo server
- [ ] `firestore.indexes.json` — composite index on `corridorId + status + priorityKey` once report volume makes it necessary, not before

---

## 4. Environment variables (create `.env.example` at repo root, fill real values in untracked `.env.local` files per app)

```
# apps/web/.env.local and functions/.env
FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_AUTH_DOMAIN=
OPENWEATHER_API_KEY=
OSRM_BASE_URL=https://router.project-osrm.org   # swap for self-hosted in Phase 4
```
Never commit real keys — `.env.local` and `functions/.env` both belong in `.gitignore` from the first commit.

---

## 5. What not to build yet

Same rule as `ROADMAP.md`: nothing in Milestone 4 (web app) or beyond starts before Milestones 1–3 are done and demoed once for real, not just planned. The fastest way to end up with a half-working mobile app *and* a half-working web app is to work on both at once — this file is ordered specifically to prevent that.

## 6. If you're handed a ready-made "build this exactly" guide

If a step-by-step code guide shows up for this project (from any source — another tool, a teammate, a tutorial), don't run it before checking it against `VERIFICATION_REPORT.md` first. That file documents a real example: a full Vite+React+Firebase build guide that was mostly sound but (a) quietly changed the pilot location, (b) had a Python bug that would crash on first run, and (c) reintroduced exactly the demo-day fragility `ARCHITECTURE.md` §3 was written to avoid. None of that means the guide was worthless — most of it maps directly onto Milestones 1–4 above — it means **verify before you run**, every time, even when the instructions look complete and confident.


