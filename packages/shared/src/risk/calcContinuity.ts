import { CLOSURE_DAYS_BY_CATEGORY, type RiskCategory } from './calcRisk.ts';

/**
 * Supply Continuity Score — ARCHITECTURE.md §4.1, the headline feature:
 *
 *   continuity_gap = stock_buffer_days − expected_closure_days
 *
 * expected_closure_days derives from the risk engine's output category via
 * CLOSURE_DAYS_BY_CATEGORY. A district can show CRITICAL while the
 * corridor's live risk is only Medium, if its buffer is thin — that is the
 * point of the metric.
 *
 * NOTE (§10): expected_closure_days is only as fresh as the risk calc it
 * came from; callers must label the result "as of" the risk timestamp,
 * never present it as live.
 */

export type ContinuityStatus = 'OK' | 'WATCH' | 'CRITICAL';

/**
 * UI labeling on top of the raw gap (ARCHITECTURE.md names only the
 * CRITICAL state explicitly, for a district that would run out before the
 * road reopens). Thresholds are presentation choices, not architecture:
 *   gap < 0        → CRITICAL (buffer exhausted before expected reopening)
 *   0 ≤ gap ≤ 2    → WATCH   (thin margin once the road reopens)
 *   gap > 2        → OK
 */
export function continuityStatus(gap: number): ContinuityStatus {
  if (gap < 0) return 'CRITICAL';
  if (gap <= 2) return 'WATCH';
  return 'OK';
}

/**
 * @param stockBufferDays  district's on-hand essential-goods buffer in days
 * @param riskCategory     corridor risk category the closure estimate comes from
 * @returns continuity gap in days (negative = district runs out first)
 */
export function calcContinuityGap(
  stockBufferDays: number,
  riskCategory: RiskCategory,
): number {
  if (!Number.isFinite(stockBufferDays) || stockBufferDays < 0) {
    throw new RangeError(`stockBufferDays must be a non-negative number, got ${stockBufferDays}`);
  }
  return stockBufferDays - CLOSURE_DAYS_BY_CATEGORY[riskCategory];
}
