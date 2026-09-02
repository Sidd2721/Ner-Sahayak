/**
 * syncMutationQueue — HTTPS Callable function (Firebase Functions v2).
 *
 * The idempotent write path for offline-queued reports. The client submits
 * with a stable, client-generated UUID as the document ID; a dropped
 * connection followed by a retry sends the same UUID again. `setDoc` with
 * `{ merge: false }` on the same path overwrites the same document — one
 * Firestore document results, and `onCreate` fires exactly once per unique
 * doc path.
 *
 * This is MECHANISM 1 (retry-dedup), keyed off the report UUID. It is a
 * completely separate concern from MECHANISM 2 (corroboration), which is
 * keyed off geohash+type in onReportCreate.ts and runs after this write
 * lands.
 *
 * Security layered here (belt-and-suspenders on top of firestore.rules):
 * - Caller must be authenticated.
 * - `payload.reporterId` must equal caller's uid.
 * - `corroborationScore` and `priorityKey` are stripped from the payload —
 *   those are server-computed by onReportCreate, not client-supplied.
 * - Payload validated against ReportSchema (Zod) before any write.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from './lib/admin.ts';
import { ReportSchema } from './lib/shared.ts';
import { ZodError } from 'zod';

export const syncMutationQueue = onCall(async (request) => {
  // --- Auth check ---
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to submit a report.');
  }

  const callerUid = request.auth.uid;
  const { id, payload } = request.data as { id?: unknown; payload?: unknown };

  // --- Input shape check ---
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new HttpsError('invalid-argument', '`id` must be a non-empty string (client UUID).');
  }
  if (typeof payload !== 'object' || payload === null) {
    throw new HttpsError('invalid-argument', '`payload` must be an object.');
  }

  // --- Server-computed fields must NOT be present in the client submission ---
  // If they are present, we strip them silently rather than erroring, since
  // a buggy client sending stale cached values should not block a legitimate
  // offline report from syncing.
  const sanitised = { ...(payload as Record<string, unknown>) };
  delete sanitised.corroborationScore;
  delete sanitised.priorityKey;
  delete sanitised.corroborationUpdatedAt;
  delete sanitised.riskCalcAt;

  // --- Ownership check: reporterId must be the caller's own uid ---
  if (sanitised.reporterId !== callerUid) {
    throw new HttpsError(
      'permission-denied',
      'reporterId must match the authenticated caller uid.',
    );
  }

  // --- Schema validation via packages/shared ReportSchema ---
  let parsed: ReturnType<typeof ReportSchema.parse>;
  try {
    parsed = ReportSchema.parse(sanitised);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpsError(
        'invalid-argument',
        `Report payload failed validation: ${err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      );
    }
    throw new HttpsError('internal', 'Unexpected validation error.');
  }

  // --- Idempotent upsert: client UUID is the Firestore document ID ---
  // setDoc with merge:false means:
  //   - First call: creates the document → onReportCreate fires once.
  //   - Subsequent calls with the same id: overwrites the same doc → no
  //     second onCreate trigger → no corroboration double-count.
  //
  // We do NOT use merge:true because a partial re-submit should not preserve
  // stale field values from a previous (possibly corrupt) attempt.
  const docRef = adminDb.doc(`reports/${id}`);
  await docRef.set({
    ...parsed,
    // Ensure syncedAt is recorded server-side, not trusted from client clock.
    syncedAt: new Date().toISOString(),
  });

  return { ok: true, reportId: id };
});
