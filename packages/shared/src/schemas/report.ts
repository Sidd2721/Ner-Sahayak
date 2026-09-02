import { z } from 'zod';

/**
 * Report entity — ARCHITECTURE.md §6.
 *
 * `id` is the client-generated UUID created at report time; sync is an
 * idempotent upsert on that id (ARCHITECTURE.md §10, "duplicate report on
 * offline retry" row).
 *
 * REPORT_TYPES: the dual ping of §4.2 ("road-blocked" / "route-clear") plus
 * the disruption kinds the risk model and PS point (b) name (landslide,
 * flood) and the monitored asset classes from PS point (a) (bridge damage).
 * "other" keeps the citizen form usable for anything else.
 */
export const REPORT_TYPES = [
  'road-blocked',
  'route-clear',
  'landslide',
  'flood',
  'bridge-damage',
  'other',
] as const;

/**
 * Triage pipeline state machine (§6: "status is the triage pipeline state
 * machine"). unconfirmed → confirmed is the §4.4 corroboration escalation
 * (3+ distinct reporters in one geohash bucket); resolved reports
 * auto-archive rather than delete (§7).
 */
export const REPORT_STATUSES = [
  'unconfirmed',
  'confirmed',
  'dispatched',
  'resolved',
  'archived',
] as const;

export const ReportSchema = z.object({
  id: z.string().min(1),
  type: z.enum(REPORT_TYPES),
  /** 1 = minor … 5 = corridor-blocking */
  severity: z.number().int().min(1).max(5),
  /** §4.4 corroboration score, 0 (single unconfirmed report) … 1 (3+ distinct reporters) */
  corroborationScore: z.number().min(0).max(1).default(0),
  /** ~150m-precision geohash (§4.4) — see geo/geohash.ts GEOHASH_PRECISION */
  geohash: z.string().min(1),
  corridorId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** optional photo reference (data URL or storage path) — PS point (f) */
  photo: z.string().optional(),
  status: z.enum(REPORT_STATUSES).default('unconfirmed'),
  reporterId: z.string().min(1),
  /** ISO 8601 timestamp, client clock at creation */
  createdAt: z.string().datetime({ offset: true }),
  /** set by the sync engine when the report reaches Firestore; absent while queued */
  syncedAt: z.string().datetime({ offset: true }).optional(),
});

export type Report = z.infer<typeof ReportSchema>;
export type ReportInput = z.input<typeof ReportSchema>;
