/**
 * onRiskScoreUpdate — Firestore trigger fired when a corridor document is
 * written (onWrite covers create + update + delete).
 *
 * Responsibilities:
 * 1. Re-run calcRisk on the corridor's current risk inputs (stored on the
 *    corridor doc itself so the function doesn't need an external sensor call).
 * 2. For each downstream district (districtIds on the corridor), fetch
 *    stockBufferDays → calcContinuityGap → write continuityGap +
 *    continuityStatus back to the district doc.
 *
 * Risk inputs are stored on the corridor doc as `riskInputs: RiskInput`.
 * If absent (e.g., a corridor doc that only had `lastReportAt` touched),
 * the function is a no-op — it doesn't guess or use stale cached inputs.
 *
 * ARCHITECTURE.md §10: "expected_closure_days is timestamped with the risk
 * calc it came from; UI must label 'as of [time]'." We write `riskCalcAt`
 * alongside every district update so the UI can honour this requirement.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './lib/admin.ts';
import {
  calcRisk,
  calcContinuityGap,
  continuityStatus,
  getCorridor,
  type RiskInput,
  type RiskCategory,
} from './lib/shared.ts';

export const onRiskScoreUpdate = onDocumentWritten(
  'corridors/{corridorId}',
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return; // corridor deleted — nothing to do

    const corridorId = event.params.corridorId;
    const corridorData = after.data() as {
      riskInputs?: RiskInput;
      districtIds?: string[];
    };

    // If no risk inputs on the doc yet, skip — don't compute on missing data.
    const riskInputs = corridorData.riskInputs;
    if (!riskInputs) return;

    // Re-run the risk formula from packages/shared — never reimplemented.
    const riskResult = calcRisk(riskInputs);
    const riskCalcAt = FieldValue.serverTimestamp();

    // Write back the computed risk score to the corridor doc itself.
    await after.ref.update({
      currentRiskScore: riskResult.score,
      riskCategory: riskResult.category,
      expectedClosureDays: riskResult.expectedClosureDays,
      riskCalcAt,
    });

    // Look up districtIds: prefer what's stored on the corridor doc,
    // fall back to the shared seed (so newly-seeded corridors work before
    // their doc has districtIds written).
    const corridorSeed = getCorridor(corridorId);
    const districtIds: string[] =
      corridorData.districtIds ?? corridorSeed?.districtIds ?? [];

    if (districtIds.length === 0) return;

    // For each downstream district, compute continuity gap and write it back.
    const districtUpdates = districtIds.map(async (districtId) => {
      const districtRef = adminDb.doc(`districts/${districtId}`);
      const districtSnap = await districtRef.get();

      if (!districtSnap.exists) return; // district doc not seeded yet — skip

      const districtData = districtSnap.data() as { stockBufferDays?: number };
      const stockBufferDays = districtData.stockBufferDays;

      // stockBufferDays may be missing on an incompletely seeded doc.
      if (stockBufferDays === undefined || stockBufferDays < 0) return;

      // calcContinuityGap and continuityStatus from packages/shared.
      const gap = calcContinuityGap(stockBufferDays, riskResult.category as RiskCategory);
      const status = continuityStatus(gap);

      await districtRef.update({
        currentRiskScore: riskResult.score,
        continuityGap: gap,
        continuityStatus: status,
        // §10: timestamp the calc so UI can label "as of X" — not live.
        riskCalcAt,
        lastUpdated: new Date().toISOString(),
      });
    });

    await Promise.all(districtUpdates);
  },
);
