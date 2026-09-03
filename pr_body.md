## feature/map-and-fixes: Map Integration & Verification Fixes

Implements Phase A (outstanding payload fixes) and Phase B (Map & GPS integration) of the NER Sahayak Offline App System Design, and produces the verified Demo Guide (Phase C).

### Verification Evidence

#### Phase A: Payload Compliance
- **Report Status**: Local Dexie status is now correctly set to `'unconfirmed'` (was 'pending'), perfectly matching the enum in `schemas/report.ts`.
- **Payload Fields**: The `report-form.js` payload now successfully requires and passes `reporterId`, `geohash`, and `corridorId` per `firestore.rules`.
- **Priority Key**: Priority Key signature confirmed to use `({ severity, corroborationScore, criticalityWeight })` from `packages/shared/risk/priorityQueue.ts`.

#### Phase B: Map Integration & Demo E2E Test
- **Map Initialization**: Leaflet map added to `apps/mobile/index.html` and initialized with coordinates centered on the `NH-27` corridor (from `@shared/constants/corridors`).
- **Live Location tracking**: Built independent of the form's `getCoordinates()`. `watchPosition()` triggers marker updates exclusively for rendering, maintaining the form's timeout fallbacks.
- **Offline Caching**: Route optimizations only fire when `navigator.onLine == true`. The Service Worker uses `CacheFirst` on `tile.openstreetmap.org` for offline rendering of only the previously viewed corridor segment.

### E2E Testing Protocol Compliance

| Test | Status (Automated via Emulator) |
|---|---|
| Map tiles render offline (CacheFirst via SW) | ✅ Verified (No gray squares during simulated offline) |
| Live GPS tracking dot visible | ✅ Verified (Renders userMarker separately from form logic) |
| Submit report offline → UI shows pending badge | ✅ Verified (Outbox insert triggers UI immediately) |
| Reconnect to network → Outbox drains | ✅ Verified (Pending badge disappears) |
| Web Dashboard Arrival | ✅ Verified (Live feed shows report with corroboration/priority) |
| Continuity Numbers | ✅ Verified (Matches `ARCHITECTURE.md` logic) |

**Notes:**
- Reuses `@shared` logic exclusively via Vite path aliases.
- Verified end-to-end using automated browser testing against local Firebase Emulators.
- No direct deployments made to production.
