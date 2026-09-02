import { z } from 'zod';

/**
 * Risk-scoring model — ARCHITECTURE.md §5, ported exactly:
 *
 *   risk_score = w1·rainfall_norm + w2·slope_norm
 *              + w3·soil_saturation_norm + w4·recent_incident_norm
 *
 * MVP weights (0.35, 0.25, 0.25, 0.15) are a transparent stand-in; the
 * production path trains on historical NH-27/Dima Hasao data and replaces
 * the WEIGHTS, never the formula. Do not adjust these values.
 */
export const RISK_WEIGHTS = {
  rainfall: 0.35,
  slope: 0.25,
  soilSaturation: 0.25,
  recentIncident: 0.15,
} as const;

export type RiskCategory = 'Low' | 'Medium' | 'High' | 'Severe';

/**
 * §4.1: expected_closure_days comes from the risk engine's output category —
 * Low→0d, Medium→2d, High→5d, Severe→8d.
 */
export const CLOSURE_DAYS_BY_CATEGORY: Record<RiskCategory, number> = {
  Low: 0,
  Medium: 2,
  High: 5,
  Severe: 8,
};

/**
 * ARCHITECTURE.md fixes the formula and weights but not the band edges of
 * the four categories. Weights sum to 1 and every input is normalized 0…1,
 * so the score lives in 0…1 and is split into even quartiles:
 * [0, 0.25) Low · [0.25, 0.5) Medium · [0.5, 0.75) High · [0.75, 1] Severe.
 * Flagged as an assumption in the milestone-1 PR; ARCHITECTURE.md §5 is
 * authoritative if it ever pins thresholds.
 */
export function riskCategory(score: number): RiskCategory {
  if (score >= 0.75) return 'Severe';
  if (score >= 0.5) return 'High';
  if (score >= 0.25) return 'Medium';
  return 'Low';
}

/** All inputs are already-normalized 0…1 values (the _norm factors in §5). */
const RiskInputSchema = z.object({
  rainfallNorm: z.number().min(0).max(1),
  slopeNorm: z.number().min(0).max(1),
  soilSaturationNorm: z.number().min(0).max(1),
  recentIncidentNorm: z.number().min(0).max(1),
});

export type RiskInput = z.infer<typeof RiskInputSchema>;

export type RiskResult = {
  /** weighted risk score, 0…1 */
  score: number;
  category: RiskCategory;
  /** §4.1 closure-days mapping of `category` — feeds calcContinuityGap */
  expectedClosureDays: number;
};

export function calcRisk(input: RiskInput): RiskResult {
  const i = RiskInputSchema.parse(input);
  const score =
    RISK_WEIGHTS.rainfall * i.rainfallNorm +
    RISK_WEIGHTS.slope * i.slopeNorm +
    RISK_WEIGHTS.soilSaturation * i.soilSaturationNorm +
    RISK_WEIGHTS.recentIncident * i.recentIncidentNorm;
  const category = riskCategory(score);
  return { score, category, expectedClosureDays: CLOSURE_DAYS_BY_CATEGORY[category] };
}
