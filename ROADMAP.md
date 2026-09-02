# NER Sahayak — Roadmap & Step-by-Step Execution Plan

Companion to `ARCHITECTURE.md`. That file explains *what* and *why*; this one is strictly *what to do, in what order*.

Guiding rule for every phase below: **never build something that makes the offline demo depend on a new external service.** Each phase adds capability without removing the "still works with zero bars" guarantee from Layer 0.

---

## Phase 0 — Today: the 12-hour hackathon MVP (already built, now rescoped)

You already have `index.html` + `manifest.json` + `sw.js` + `icon.svg` — the seed data is now specifically the **NH-27 corridor through Dima Hasao, Assam** (Lumding → Maibang → Haflong, downstream to Silchar/Hailakandi/Karimganj), not a generic 8-state list, and the app is responsive so it doubles as the control-room dashboard on a laptop — there is no separate desktop build to make. What's left is packaging and rehearsal, not building. **The mobile app on an actual phone is the entire demo — treat every remaining hour as either making that phone experience better or rehearsing it; nothing else earns its place today.**

- [ ] **Hour 0–1: Host it.** Netlify Drop, GitHub Pages, or Vercel (see `README.md`). Get the HTTPS link + QR code.
- [ ] **Hour 1–2: Train the risk-model notebook.** Google Colab, small dataset (Kaggle "landslide susceptibility," ASDMA disaster bulletins, or data.gov.in rainfall/terrain data for Assam). Random Forest or logistic regression, note the feature-importance weights it learns.
- [ ] **Hour 2–3: Wire the trained weights into `calcRisk()`** in `index.html` (isolated and commented for this swap) — this also feeds the Supply Continuity Score automatically (Architecture §4.1), so one swap upgrades two features at once.
- [ ] **Hour 3–4: Walk the full corridor story once, live, on your phone** — log a "Road blocked" report near Maibang as the driver/citizen role, switch to Authority, watch it land, run the risk engine, watch Silchar's Supply Continuity line move. If any step feels clunky one-handed, fix the UI now.
- [ ] **Hour 4–6: Build slides** — open with the real May 2022 Dima Hasao landslide event (Architecture §2) as the "why this matters" anchor before a single screen, architecture diagram, live demo, honesty slide, roadmap slide (this file, condensed to one).
- [ ] **Hour 6–8: Rehearse the live airplane-mode demo on the phone itself** — not a laptop, not a screen share — until you can do it one-handed without narrating each tap.
- [ ] **Hour 8–9: Record a 30–60s screen-capture backup** of the exact demo flow, in case a device/room issue blocks the live version.
- [ ] **Hour 9–10: Dry run in front of one other person**, cold, no coaching — hand them the phone, don't touch it yourself, watch where they get stuck.
- [ ] **Hour 10–12: Buffer + rest.** Do not use this window to add features. A steady one-corridor demo beats a shaky attempt at "all of NER."

## Phase 1 — Week 1–2 (if you carry this past the hackathon): real backend

- [ ] Stand up Firebase (Spark/free tier) or Supabase (free tier) project.
- [ ] Migrate the IndexedDB mutation-queue sync (already structured for this — see `ARCHITECTURE.md` Sec. 4.3/6) to actually push to Firestore/Postgres instead of the current local-only simulation.
- [ ] Add real Auth (Firebase Auth / Supabase Auth) replacing the name-only mock login.
- [ ] Implement idempotent upserts keyed on client-generated UUID (Sec. 10 of the architecture doc — this closes the "duplicate report on retry" edge case for real, not just in the design doc).
- [ ] Stand up the Dispatch Assignment write with the optimistic-concurrency check described in Sec. 10.

## Phase 2 — Month 1: the victim-efficiency layer

This is where the "unique, efficient, helps on-ground victims" pieces from the architecture doc actually get implemented, in order of impact-per-hour:

- [ ] **Triage & Priority Engine** (Sec. 4.5) — cheapest to build, highest leverage. A computed `priorityKey` per report + a sorted/heap query on the dashboard. Half a day of work.
- [ ] **Safe-ping / Need-help split** (Sec. 4.2) — two buttons instead of one form. Trivial to add, immediately reduces dashboard noise.
- [ ] **Geohash deduplication & corroboration scoring** (Sec. 4.4) — bucket incoming reports, count distinct reporters per bucket, surface a confidence badge.
- [ ] **SOS Low-Power Mode** (Sec. 4.1) — battery-aware polling interval switch; test on an actual low-battery device, not just in code review.
- [ ] **SMS/USSD fallback channel** (Sec. 4.3) — evaluate a telecom SMS gateway with an India-friendly free/low-cost tier; this is the step that reaches people without a smartphone at all, so don't skip it if you're serious about "on-ground victims" reach.

## Phase 3 — Month 2–3: dispatch intelligence & peer relay

- [ ] **Dispatch Matching Engine, greedy version** (Sec. 4.6) — nearest-available-resource matching, haversine-based.
- [ ] **Upgrade path: Hungarian-algorithm assignment** once simultaneous-incident volume in a single district makes greedy matching visibly suboptimal (i.e., don't build this before you need it — greedy is correct for MVP scale).
- [ ] **Predictive pre-positioning** (Sec. 4.7) — district risk crossing a threshold pushes a pre-cached alert bundle before any report exists.
- [ ] **Native peer-relay research spike**: prototype Google's **Nearby Connections API** (Bluetooth/BLE/Wi-Fi, fully offline peer-to-peer, no internet round-trip — confirmed current and documented at developers.google.com/nearby) on a native Android build. This is explicitly *not* achievable inside the browser-based PWA (Web Bluetooth can't do background mesh relay), so this phase is where you'd start a native Android/Flutter companion app if the project continues past the hackathon.

## Phase 4 — Month 4+: government-system integration

- [ ] Weather API upgrade from OpenWeatherMap free tier to IMD's official feeds (formal request/partnership needed — flag this as a dependency outside your control, not something to promise a hard date on).
- [ ] Self-hosted OSRM instance (replacing the public demo server, which is rate-limited and not meant for production traffic).
- [ ] District-partitioned scaling per `ARCHITECTURE.md` Sec. 8, once report volume across multiple states is real.
- [ ] Formal data-retention and audit-log policy for `Report`/`DispatchAssignment` records (Sec. 7), since this becomes an official record once government users are on it.

---

## Risk register — what could derail the plan, and the mitigation already built in

| Risk | Mitigation |
|---|---|
| Live demo loses network unexpectedly | Layer 0 has zero external dependency by design — this risk is already engineered away, not just hoped around |
| Judges ask "is the AI real or hardcoded" | Answer directly per the Phase 0 checklist: show the Colab notebook, name the swap point in the code, don't oversell |
| Scope creep — trying to build Phase 2/3 features before the demo | This file exists specifically to stop that: nothing past Phase 0 is needed for tomorrow, don't touch it |
| Temptation to build a separate desktop dashboard "to be safe" | Don't — Architecture §3 made this call deliberately; the responsive PWA already covers it, and a second codebase only creates more that can break before judging |
| Backend chosen later turns out to have a hard free-tier limit | Both Firebase Spark and Supabase free tiers are named because they're genuinely free with no card required at time of writing — reconfirm current limits before Phase 1, since free-tier terms do shift |
| SMS gateway costs money at scale | Flagged explicitly in Phase 2 as "evaluate," not committed — budget it before promising it in a pitch to a ministry-level audience |

---

## One-line summary of "what to do, right now, in order"

**Host Phase 0 → train the notebook → rehearse offline → pitch with the honesty slide → only then start Phase 1.** Everything after Phase 0 is sequenced so you're never forced to add a fragile piece before a demo that doesn't need it.
