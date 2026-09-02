/**
 * functions/src/index.ts — barrel export for all Cloud Functions.
 * Firebase CLI discovers functions via this file's named exports.
 */
export { onReportCreate } from './onReportCreate.ts';
export { onRiskScoreUpdate } from './onRiskScoreUpdate.ts';
export { syncMutationQueue } from './syncMutationQueue.ts';
