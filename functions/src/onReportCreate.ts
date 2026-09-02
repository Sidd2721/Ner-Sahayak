/**
 * onReportCreate — Firestore trigger fired when a new document lands in
 * `reports/{reportId}`.
 *
 * TWO MECHANISMS, NOT ONE — important distinction (see PR description):
 *
 * 1. RETRY DEDUP (handled upstream, not here):
 *    The client submits with a stable, client-generated UUID as the document
 *    ID. `setDoc(ref, data)` is idempotent by doc path — a second submission
 *    of the same UUID overwrites the same document and fires `onCreate` at
 *    most once. This function never sees duplicates from the same submitter.
 *
 * 2. CORROBORATION (handled here, completely separate):
 *    Keys off `geohash + type` (incident proximity), NOT the report UUID.
 *    Two DIFFERENT people reporting the same real-world landslide will have
 *    different UUIDs, different reporterIds, but the same geohash+type bucket.
 *    This function counts distinct reporterIds in that bucket within a 15-min
 *    window to determine whether an incident is corroborated.
 *    Threshold: 3 distinct reporters → status escalates to 'confirmed'.
 *
 * The transaction below makes the bucket-read + score-write atomic so that
 * two near-simultaneous triggers don't both read stale counts and produce an
 * incorrect score.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './lib/admin.ts';
import {
  calcCorroborationScore,
  calcPriorityKey,
  CORROBORATION_CONFIRM_THRESHOLD,
  getCorridor,
} from './lib/shared.ts';

/** Time window for corroboration bucketing (ARCHITECTURE.md §4.4). */
const CORROBORATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const onReportCreate = onDocumentCreated(
  'reports/{reportId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const report = snap.data() as {
      type: string;
      severity: number;
      geohash: string;
      corridorId: string;
      reporterId: string;
      lat: number;
      lng: number;
      createdAt: string;
    };

    const { type, severity, geohash, corridorId, reporterId } = report;

    // Look up the corridor's criticalityWeight from shared seed data.
    // Falls back to 1.0 if corridor not found (safe default — doesn't
    // under-weight an unknown corridor, which is the wrong failure mode here).
    const corridor = getCorridor(corridorId);
    const criticalityWeight = corridor?.criticalityWeight ?? 1.0;

    const reportsRef = adminDb.collection('reports');
    const windowStart = new Date(Date.now() - CORROBORATION_WINDOW_MS);

    // --- MECHANISM 2: CORROBORATION (proximity/incident match) ---
    // The bucket key is `geohash + type`, NOT the report UUID.
    // This is an incident-proximity match: any two reports from different
    // people at the same ~150m cell for the same report type are about the
    // same real-world event, regardless of their individual UUIDs.
    await adminDb.runTransaction(async (txn) => {
      // Query all reports in the same geohash+type bucket within the window.
      // Firestore transactions require all reads before any writes.
      const bucketQuery = reportsRef
        .where('geohash', '==', geohash)
        .where('type', '==', type)
        .where('createdAt', '>=', windowStart.toISOString());

      const bucketSnap = await txn.get(bucketQuery);

      // Collect DISTINCT reporterIds (§4.4: "distinct reporters, not raw count").
      // Include this new report's reporterId in the set.
      const distinctReporters = new Set<string>();
      bucketSnap.docs.forEach((d) => {
        const rid = d.data().reporterId as string | undefined;
        if (rid) distinctReporters.add(rid);
      });
      // The new report is already in Firestore (onCreate fires after write),
      // but add defensively in case the query didn't return it yet.
      distinctReporters.add(reporterId);

      const distinctCount = distinctReporters.size;

      // calcCorroborationScore from packages/shared — never reimplemented here.
      const corroborationScore = calcCorroborationScore(distinctCount);

      // calcPriorityKey from packages/shared — object form as per the actual
      // exported signature (NOT the 3-positional-arg form in the build guide,
      // which was a bug in that doc).
      const priorityKey = calcPriorityKey({
        severity,
        corroborationScore,
        criticalityWeight,
      });

      // Escalate status if threshold reached. Write to ALL docs in the bucket
      // so the whole incident cohort moves to 'confirmed', not just the newest.
      const newStatus =
        distinctCount >= CORROBORATION_CONFIRM_THRESHOLD ? 'confirmed' : 'unconfirmed';

      // Write updated corroboration metadata to every report in the bucket.
      // This ensures the cohort converges: if report A and B were already
      // 'unconfirmed' at score 0.33/0.67, a third report C makes all three
      // 'confirmed' at score 1.0 in one atomic pass.
      let snapUpdated = false;
      for (const doc of bucketSnap.docs) {
        if (doc.id === snap.id) snapUpdated = true;
        const existingSeverity = (doc.data().severity as number) ?? severity;
        const existingPriorityKey = calcPriorityKey({
          severity: existingSeverity,
          corroborationScore,
          criticalityWeight,
        });
        txn.update(doc.ref, {
          corroborationScore,
          priorityKey: existingPriorityKey,
          status: newStatus,
          corroborationUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (!snapUpdated) {
        txn.update(snap.ref, {
          corroborationScore,
          priorityKey,
          status: newStatus,
          corroborationUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // --- Trigger downstream risk score update for the corridor ---
    // Writing a sentinel field on the corridor doc causes onRiskScoreUpdate
    // to re-run the continuity calculation for all downstream districts.
    // This is a lightweight touch, not a full recalculation here.
    const corridorRef = adminDb.doc(`corridors/${corridorId}`);
    await corridorRef.set(
      { lastReportAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  },
);
