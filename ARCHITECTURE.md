# NER Sahayak — System Architecture
### AI-Based Smart Logistics & Accessibility Intelligence Platform for NER
### Design thesis: prove the platform on one real, hard corridor — and make the phone in the judge's hand the whole demo.

---

## 1. Design thesis, stated precisely

The problem statement is about **logistics**, not disaster rescue: essential goods (medicine, food, construction material, agricultural produce) failing to reach remote districts because roads fail. That's the north star for every decision below. Two decisions shape this whole document:

1. **Scope to one real corridor, not "all of NER."** A platform that claims to cover eight states in a 12-hour build is a platform that's shallow everywhere. A platform that's genuinely instrumented for one real, hard, well-documented corridor — with an architecture that visibly generalizes — is a platform judges can stress-test and believe. See Sec. 2.
2. **The mobile app *is* the product; the web dashboard is a view, not a second build.** Judges will pick up a phone, not open a laptop. Every hour spent on a separate desktop dashboard is an hour not spent making the phone experience flawless. See Sec. 3.

Within that scope, three ground-level failures are what the architecture actually targets:
- Field reports and vehicle status can't reach anyone when signal drops — so the app has to be genuinely useful with **zero** connectivity, not "mostly offline."
- Authorities can't tell which of ten incoming reports is the one blocking the *only* road into a valley versus a minor side-road pothole — so reports need a **criticality**, not just a severity.
- Nobody currently connects "the road might close" to "which district will run out of medicine first" — that gap is where Sec. 4.1's Supply Continuity Score lives, and it's the single most distinctive piece of this design.

---

## 2. MVP geographic scope — NH-27 Lifeline Corridor, Dima Hasao, Assam

**Why this exact corridor, not a generic placeholder:** NH-27 through Dima Hasao district is the only road connecting Assam's Barak Valley (Cachar, Hailakandi, Karimganj — Silchar is the valley's hub) to Guwahati and the rest of the Northeast. This is not a hypothetical — in May 2022, landslides at Haflong and siltation at the Maibang tunnel cut this corridor for days: over 25,000 people were affected across seven Assam districts, 17 trains were cancelled or partially cancelled, thousands of passengers were stranded, and parts of Dima Hasao lost power and internet entirely. Buses and helicopters had to be pressed into service. That is the exact scenario this problem statement describes — it already happened, on this exact road, and will happen again.

**Corridor as instrumented in the MVP** (real place names, used in the app's seed data):

```
Guwahati ──── Lumding (entry junction, Nagaon) ──── Maibang (NH-27 tunnel,
   chokepoint) ──── Harangajao / Mahur stretch (landslide-prone) ──── Haflong
   (Dima Hasao HQ) ──── downstream dependents: Silchar/Cachar, Hailakandi,
   Karimganj (Barak Valley — landlocked by these hills when NH-27 is cut)
```

**Why scoping down doesn't reduce problem-statement coverage:** the PS asks for monitoring "across districts and remote locations" — it does not require covering every district in the same build. A single, real, fully-instrumented corridor is the standard way to prove a platform pattern: every entity in the data model (Sec. 6) is a `Corridor`, not a hardcoded NH-27, so the identical schema onboards the next lifeline road — NH-29 between Dimapur and Kohima in Nagaland is a documented analogous case (blocked repeatedly by landslides, described as "the lifeline" for the state capital) — by adding rows, not rewriting logic. That generalization claim is falsifiable and worth saying explicitly to judges, not just implying.

---

## 3. Mobile-app-first consolidation (the thing that actually gets judged)

**Decision:** Layers 0 and 4 (device layer and human-interface layer) are **one responsive PWA**, not a mobile app plus a separate web dashboard. At phone width it's the field/citizen app; opened on a laptop at ≥860px it re-flows into a multi-column control-room dashboard — same data, same offline core, same codebase (`index.html`'s CSS media query does this switch; there is no second product).

**Why this is the correct call, not a shortcut:** the PS's "Expected Solution" lists *"Mobile/web application for field-level reporting and monitoring"* as one bullet, not two separate deliverables. A single responsive shell satisfies that line item completely while concentrating 100% of build and rehearsal time on the one artifact that will actually be judged live — the phone in someone's hand. A second, separately-built desktop dashboard would be pure surface area: more code to break, less polish on the part that matters, for a requirement that's already satisfied.

**What this means concretely for demo day:** rehearse on an actual phone, in an actual hand, with actual thumbs. If the sliders are hard to drag one-handed, that's a real bug — fix it before the pitch, not after.

---

## 4. Layered architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ LAYER 0/4 — THE APP (one responsive PWA — phone-first, desktop-capable) │
│  Citizen/Driver view              Field-Officer/Control-Room view   │
│  · Road-Blocked / Route-Clear ping · Supply Continuity Score (4.1)  │
│  · Geo-tagged incident report      · Corridor-Criticality queue (4.3)│
│  · Nearest help (haversine)        · Dispatch matching (4.5)        │
│  · District status, offline-safe   · Vehicle GPS ping, risk engine  │
│  Local-first storage: IndexedDB mutation queue, zero network calls  │
│  required to function once loaded                                   │
└──────────────────────────┬───────────────────────────────────────┘
                            │ Fallback chain, tried in order (Sec. 4.2)
                            │ 1) Cellular data  2) SMS/USSD  3) Peer relay
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — CONNECTIVITY & SYNC                                       │
│  • Mutation-queue sync (exponential backoff, idempotent writes)     │
│  • Geohash-based report deduplication & corroboration (Sec. 4.4)    │
│  • SMS/USSD gateway bridge for non-smartphone drivers/villagers     │
│  • (Roadmap) Native peer-to-peer relay via Nearby Connections API   │
└──────────────────────────┬───────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│ LAYER 2 — BACKEND (Firebase/Supabase free tier)                     │
│  • Auth (citizen/driver / field-officer / control-room roles)       │
│  • Firestore/Postgres: reports, corridors, districts, vehicles      │
│  • Corridor-Criticality Priority Engine (Sec. 4.3)                  │
│  • Dispatch Matching Engine (Sec. 4.5)                               │
└──────────────────────────┬───────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — INTELLIGENCE                                              │
│  • Route-disruption risk model (trained weights, Sec. 5)            │
│  • Supply Continuity Score engine (Sec. 4.1)                        │
│  • Predictive pre-positioning trigger (Sec. 4.6)                    │
│  • OSRM alternate-route calculation                                 │
└────────────────────────────────────────────────────────────────────┘
```

Each layer degrades independently — this hasn't changed from the earlier draft and remains true: Layer 0/4 alone, with nothing else reachable, still lets a driver log a blockage and a citizen check district status from cached data. Layer 3 (AI) going down never blocks Layer 2 from serving the last-known scores — inference is never on the critical path.

---

## 5. The unique mechanisms — logistics-framed, not generic

### 4.1 Supply Continuity Score — the headline feature
Every dashboard in this space shows "is the road at risk." Almost none answer the actual operational question: **if the road closes, who runs out of essential goods first, and by how many days do we miss it?** This is computed per downstream district as:

```
continuity_gap = stock_buffer_days − expected_closure_days
```

`stock_buffer_days` is the district's on-hand essential-goods buffer (medicine/food, entered by the control room or, eventually, pulled from a transport/inventory database per the PS's integration requirement). `expected_closure_days` comes directly from the risk engine's output category (Sec. 5) — Low→0d, Medium→2d, High→5d, Severe→8d. A district can show **CRITICAL** even while the corridor's live risk score is only Medium, if its buffer is thin — that's the point: this is a genuinely different signal from route risk, not a restyled copy of it, and it's the one number that turns "the road might close" into "Silchar needs a resupply run today, not after it closes." In the MVP it's seeded for Silchar (4d buffer), Hailakandi (6d), Karimganj (9d) against the corridor's live risk output.

### 4.2 Road-Blocked / Route-Clear dual ping
Two distinct one-tap actions on the driver/citizen side: **"Route clear here"** and **"Road blocked/damaged."** This directly implements PS point (a) — real-time accessibility monitoring — as crowd-sourced, continuous signal rather than a single incident form. It also means good news propagates as fast as bad news: a corridor that reopens gets marked clear the moment the first driver through pings it, not whenever an official update eventually arrives.

### 4.3 Multi-channel fallback chain
Cellular data → SMS/USSD → peer relay, tried strictly in that order. This is architected as a chain because the real May 2022 event above is documented as leaving parts of Dima Hasao with **no power or internet for days** — "online or offline" is the wrong model for this terrain; a device can have SMS signal with zero data signal for hours, and handling that distinction is what actually reaches drivers and villagers in the hills instead of silently dropping them.

### 4.4 Geohash deduplication & corroboration scoring
Incoming road-condition reports are geohashed to ~150m precision and bucketed by type; 3+ independent reporters in the same bucket auto-escalate a report from "unconfirmed" to "confirmed — high confidence." This stops a single mistaken or malicious report from triggering a full reroute of essential-goods traffic, while genuinely corroborated blockages get acted on fast — without a human having to phone-verify every single ping.

### 4.5 Corridor-Criticality Priority Queue
Not every road segment is equal. A report on NH-27 — the *only* route into the Barak Valley — is categorically more urgent than a report on a redundant side road, even at identical severity. Each `Corridor` carries a `criticalityWeight` (NH-27 = highest, since it's a documented single point of failure for three districts), and the priority queue sorts on `severity × corroboration × criticalityWeight`, not severity alone. This is the mechanism that actually implements PS point (e) — "high-risk transport corridors" — as a computed ranking instead of a label someone assigns by hand.

### 4.6 Dispatch Matching Engine
When a report is confirmed, the system suggests the nearest free resource of the right type — road-clearance crew, JCB/excavator, or an alternate carrier vehicle already in transit — via haversine distance against a live resource-inventory table. MVP is greedy nearest-available; the documented upgrade path is an assignment-optimization pass (Hungarian algorithm) once multiple simultaneous blockages compete for the same limited crews, which is exactly what happened across seven districts in the real May 2022 event.

### 4.7 Predictive pre-positioning
When a corridor's risk score crosses a threshold, a pre-cached alert bundle pushes to downstream depot managers (Silchar, Hailakandi, Karimganj) *before* any blockage is reported — giving them a head start to pre-position a resupply run while the road is still open, rather than finding out once it's already too late to drive through.

---

## 5. Risk-scoring model (Layer 3 detail)

```
risk_score = w1·rainfall_norm + w2·slope_norm + w3·soil_saturation_norm + w4·recent_incident_norm
```
- MVP weights (0.35, 0.25, 0.25, 0.15) are a transparent, explainable stand-in — shown as-is to judges, not hidden.
- Production path: train on historical NH-27/Dima Hasao rainfall, slope, elevation, and incident data (ASDMA publishes disaster bulletins that are a real starting dataset) and **replace the weights, not the formula.** Inference stays server-side and periodic; devices only ever read the last-published score, so a model outage never blocks a warning from reaching a village.
- This score is also the direct input to the Supply Continuity Score (Sec. 4.1) via the closure-days mapping — the two features are connected, not parallel silos.

---

## 6. Data model (core entities)

| Entity | Key fields | Notes |
|---|---|---|
| `Corridor` | id, name ("NH-27"), segments[], criticalityWeight | NEW — makes Sec. 4.5's priority weighting and the "next corridor" generalization (NH-29, etc.) a config change, not a rewrite |
| `User` | id, name, role (citizen/driver / officer / control-room), phone, lastKnownFix | role drives which of the two views renders |
| `Report` | id, type, severity, corroborationScore, geohash, corridorId, lat/lng, photo, status, reporterId, createdAt, syncedAt | status is the triage pipeline state machine |
| `District` | id, name, connectivityStatus, currentRiskScore, stockBufferDays, lastUpdated | `stockBufferDays` is NEW — feeds Sec. 4.1 |
| `Resource` | id, type(road-crew/excavator/supply-vehicle), lat/lng, status, capacity | feeds Dispatch Matching Engine |
| `DispatchAssignment` | id, reportId, resourceId, assignedAt, eta, assignedBy | audit trail |
| `AlertBroadcast` | id, districtId, riskScoreAtSend, message, sentAt, channel | pre-positioning alerts, Sec. 4.7 |

---

## 7. Security & privacy

- Role-based access control: citizens/drivers read/write their own reports; field officers read all reports on their assigned corridor; control-room has cross-corridor read + resource-write.
- Location data encrypted in transit (HTTPS/TLS) and at rest (native to Firebase/Supabase).
- Resolved reports auto-archive rather than delete, since this becomes a real audit trail once government users are on it.

## 8. Scalability

- Queries are scoped by `corridorId`, not the whole platform — one corridor's monsoon surge in report volume never slows another corridor's dashboard.
- The multi-tenant boundary is the **corridor**, which is a deliberately smaller and more realistic unit than "state" for a region where a single highway can be the whole story.

---

## 9. Verification pass 1 — problem-statement coverage audit (rechecked against the new scope)

| PS requirement | Architecture component | Covered? |
|---|---|---|
| a. Real-time road/bridge/transport monitoring | Road-Blocked/Route-Clear dual ping (4.2), District entity | ✅ |
| b. Predict disruptions (landslide/flood/rain/traffic) | Layer 3 risk model, Sec. 5 | ✅ |
| c. AI alternate routes + delay estimates | OSRM integration, Layer 3 | ✅ (public demo server for MVP; self-host for production) |
| d. GPS tracking of essential-goods vehicles | Resource entity + live GPS ping | ✅ |
| e. Automated alerts for blocked roads/high-risk corridors | Corridor-Criticality Priority Queue (4.5), AlertBroadcast | ✅ |
| f. Field officials upload geo-tagged reports/photos offline | Layer 0/4 offline queue, Report entity | ✅ |
| g. Centralized dashboards (connectivity, bottlenecks, supply gaps, delivery status) | Same responsive PWA at desktop width (Sec. 3) — **Supply Continuity Score (4.1) is the direct answer to "logistics bottlenecks and supply chain gaps"** | ✅ |
| h. Multilingual notifications + offline sync | Pre-bundled i18n + Layer 1 fallback chain | ✅ |

**Re-verified after scoping to one corridor**: nothing dropped out. Narrowing geography narrows *which rows populate the tables*, not *which requirement each component answers* — the same eight checkmarks hold whether the corridor list has one entry or twelve.

## 10. Verification pass 2 — technical/logical consistency audit (rechecked)

| Risk / edge case | Resolution |
|---|---|
| Two officers dispatch different resources to the same report | `DispatchAssignment` write rejected if `Report.status` already `dispatched` (optimistic concurrency) |
| Duplicate report on offline retry | Client-generated UUID at creation; sync is an idempotent upsert |
| Spam/false reports at one geohash | Corroboration requires *distinct* `reporterId`s (Sec. 4.4), not raw count |
| Supply Continuity Score computed on a stale risk score | `expected_closure_days` is timestamped with the risk calc it came from; UI should label "as of [time]," never presented as live if it isn't |
| A minor side-road report and an NH-27 report arrive together | Corridor-Criticality weighting (4.5) resolves the ordering deterministically — this was the one gap in the previous draft (a flat severity sort would have ranked them as ties) and is now closed by making criticality a first-class multiplier, not an afterthought |
| Trained risk model unavailable | Inference is decoupled from the critical path (Sec. 5) — last-known weights keep serving |
| Second corridor (e.g. NH-29) onboarded later | `Corridor` is a first-class entity (Sec. 6) specifically so this is a data row, not a schema change — checked against Sec. 2's generalization claim, and it holds |

**Result of both passes, rechecked**: scoping to the NH-27/Dima Hasao corridor and consolidating to one responsive app removes surface area without removing coverage — every PS requirement still maps to a real component, and the one structural gap the rescoping exposed (criticality vs. plain severity) is now fixed at the architecture level, not left as a TODO.
