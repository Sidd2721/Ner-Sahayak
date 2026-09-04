import { z } from 'zod';

/**
 * District entity — ARCHITECTURE.md §6.
 * `stockBufferDays` is the §4.1 Supply Continuity input: the district's
 * on-hand essential-goods buffer, entered by the control room.
 */
export const CONNECTIVITY_STATUSES = ['connected', 'degraded', 'isolated'] as const;

export const DistrictSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  connectivityStatus: z.enum(CONNECTIVITY_STATUSES),
  /** last published risk score from the §5 engine, 0…1 */
  currentRiskScore: z.number().min(0).max(1),
  /** on-hand essential-goods buffer in days (§4.1) */
  stockBufferDays: z.number().min(0),
  continuityGap: z.number().optional(),
  continuityStatus: z.string().optional(),
  riskCalcAt: z.any().optional(),
  /** ISO 8601 — UI must label scores "as of" this time (§10) */
  lastUpdated: z.string().datetime({ offset: true }),
});

export type District = z.infer<typeof DistrictSchema>;
export type DistrictInput = z.input<typeof DistrictSchema>;
