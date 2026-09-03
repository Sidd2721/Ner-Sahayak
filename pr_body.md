## milestone-3-mobile: Offline PWA

Implements Phase 0 through Phase 12 of the NER Sahayak Offline App System Design.

### Testing Protocol Compliance

| Test | Android Chrome | iOS Safari |
|---|---|---|
| Install to home screen | pending human deploy verification | pending human deploy verification |
| Cold load, WiFi on, first paint < 1s | pending human deploy verification | pending human deploy verification |
| Airplane mode, relaunch, Status Board renders | pending human deploy verification | pending human deploy verification |
| Submit report offline → outbox count = 1 | pending human deploy verification | pending human deploy verification |
| WiFi back on → outbox drains without app being reopened | pending human deploy verification | (expected to need foreground — see A.5) |
| WiFi back on, app foregrounded → outbox drains | pending human deploy verification | pending human deploy verification |
| Language toggle, all 3 languages, offline | pending human deploy verification | pending human deploy verification |
| GPS permission denied → submission still completes | pending human deploy verification | pending human deploy verification |
| Kill app mid-sync, relaunch → no duplicate report in Firestore | pending human deploy verification | pending human deploy verification |

**Notes:**
- Reuses `@shared` logic exclusively via Vite path aliases.
- Implements custom `SyncEngine` with Dexie outbox queue.
- Implements iOS-specific foreground sync fallbacks.
- **DO NOT MERGE** until manual verification on physical devices via Firebase Hosting.
