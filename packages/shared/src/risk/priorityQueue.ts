import { z } from 'zod';

/**
 * Corridor-Criticality Priority Queue key — ARCHITECTURE.md §4.5:
 *
 *   priority_key = severity × corroboration × criticalityWeight
 *
 * Not every segment is equal: a report on NH-27 — the only route into the
 * Barak Valley — outranks an identical-severity report on a redundant side
 * road because criticalityWeight is a first-class multiplier, not a
 * tiebreaker (§10). Higher key = more urgent; sort descending.
 */

/** §4.4: 3+ distinct reporters in one geohash bucket → confirmed, high confidence. */
export const CORROBORATION_CONFIRM_THRESHOLD = 3;

/**
 * Maps a count of DISTINCT reporterIds in the same geohash bucket/window
 * (§4.4 — distinct reporters, not raw pings) to a 0…1 score that saturates
 * at the confirmation threshold.
 */
export function calcCorroborationScore(distinctReporterCount: number): number {
  if (!Number.isInteger(distinctReporterCount) || distinctReporterCount < 0) {
    throw new RangeError(
      `distinctReporterCount must be a non-negative integer, got ${distinctReporterCount}`,
    );
  }
  return Math.min(distinctReporterCount / CORROBORATION_CONFIRM_THRESHOLD, 1);
}

const PriorityInputSchema = z.object({
  /** Report.severity, 1…5 */
  severity: z.number().int().min(1).max(5),
  /** 0…1, see calcCorroborationScore */
  corroborationScore: z.number().min(0).max(1),
  /** Corridor.criticalityWeight, > 0 (NH-27 = 1.0, the maximum) */
  criticalityWeight: z.number().positive(),
});

export type PriorityInput = z.infer<typeof PriorityInputSchema>;

export function calcPriorityKey(input: PriorityInput): number {
  const i = PriorityInputSchema.parse(input);
  return i.severity * i.corroborationScore * i.criticalityWeight;
}

/** Comparator for sorting a report list most-urgent-first. */
export function byPriorityDesc(a: PriorityInput & { priorityKey?: number }, b: PriorityInput & { priorityKey?: number }): number {
  const keyA = a.priorityKey ?? calcPriorityKey(a);
  const keyB = b.priorityKey ?? calcPriorityKey(b);
  return keyB - keyA;
}
