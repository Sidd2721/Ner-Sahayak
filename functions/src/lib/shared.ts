/**
 * Re-export shim: gives every functions/src file a clean `@shared/...`
 * import path that resolves to packages/shared/src at runtime via tsx's
 * path-mapping support (or tsc's paths option at type-check time).
 *
 * Nothing is re-implemented here — this is purely a re-export barrel so
 * the rest of functions/ never needs relative ../../packages paths.
 *
 * tsconfig.json's paths alias handles the `@shared/*` resolution:
 *   "@shared/*": ["../packages/shared/src/*"]
 */

export {
  calcRisk,
  riskCategory,
  RISK_WEIGHTS,
  CLOSURE_DAYS_BY_CATEGORY,
  type RiskInput,
  type RiskResult,
  type RiskCategory,
} from '../../../packages/shared/src/risk/calcRisk.ts';

export {
  calcContinuityGap,
  continuityStatus,
  type ContinuityStatus,
} from '../../../packages/shared/src/risk/calcContinuity.ts';

export {
  calcPriorityKey,
  calcCorroborationScore,
  CORROBORATION_CONFIRM_THRESHOLD,
  byPriorityDesc,
  type PriorityInput,
} from '../../../packages/shared/src/risk/priorityQueue.ts';

export {
  encodeGeohash,
  geohashBucket,
  GEOHASH_PRECISION,
} from '../../../packages/shared/src/geo/geohash.ts';

export {
  ReportSchema,
  REPORT_TYPES,
  REPORT_STATUSES,
  type Report,
  type ReportInput,
} from '../../../packages/shared/src/schemas/report.ts';

export {
  DistrictSchema,
  type District,
} from '../../../packages/shared/src/schemas/district.ts';

export {
  NH27_CORRIDOR,
  NH27_CORRIDOR_ID,
  getCorridor,
  CORRIDORS,
  type Corridor,
} from '../../../packages/shared/src/constants/corridors.ts';
