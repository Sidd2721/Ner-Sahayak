/**
 * syncMutationQueue integration tests — idempotency is the primary concern.
 *
 * MECHANISM 1 (retry-dedup): same client UUID submitted twice must result
 * in exactly one Firestore document and exactly one onReportCreate trigger.
 *
 * Tests call the syncMutationQueue function via its HTTP endpoint in the
 * Functions emulator (port 5001).
 */

import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { initEmulatorApp, clearEmulatorData, createTestUser } from './helpers/emulator.ts';

const FUNCTIONS_EMULATOR = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
const PROJECT_ID = 'sih2026-ce822';

/**
 * Call a Firebase Callable function via the emulator REST endpoint.
 * The emulator exposes callables at:
 *   http://{host}/{project}/{region}/{functionName}
 */
async function callFunction(
  name: string,
  data: unknown,
  idToken?: string,
): Promise<{ ok: boolean; reportId?: string; error?: string }> {
  const url = `http://${FUNCTIONS_EMULATOR}/${PROJECT_ID}/us-central1/${name}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });

  let text = '';
  try {
    text = await res.text();
    const json = JSON.parse(text) as { result?: { ok: boolean; reportId?: string }; error?: { message: string } };
    if (json.error) return { ok: false, error: json.error.message };
    return json.result ?? { ok: false };
  } catch (err: any) {
    throw new Error(`Failed to parse JSON response. Status: ${res.status}. Text: ${text}. Error: ${err.message}`);
  }
}

async function getEmulatorIdToken(uid: string, auth: import('firebase-admin/auth').Auth): Promise<string> {
  const customToken = await auth.createCustomToken(uid);
  const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const res = await fetch(
    `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    },
  );
  const json = (await res.json()) as { idToken?: string };
  return json.idToken ?? '';
}

describe('syncMutationQueue — idempotency', () => {
  const { db, auth } = initEmulatorApp('sync-tests');
  let callerUid: string;
  let idToken: string;

  before(async () => {
    callerUid = await createTestUser(
      auth,
      { email: 'sync-caller@test.com', password: 'pass1234', role: 'citizen' },
      db,
    );
    idToken = await getEmulatorIdToken(callerUid, auth);
  });

  beforeEach(async () => {
    await clearEmulatorData();
    // Re-seed user doc after clear
    await db.doc(`users/${callerUid}`).set({ role: 'citizen', email: 'sync-caller@test.com' });
  });

  after(async () => {
    await clearEmulatorData();
  });

  const makePayload = (uid: string) => ({
    id: 'stable-client-uuid-1234',
    reporterId: uid,
    type: 'road-blocked',
    severity: 3,
    geohash: 'p3wjjt6',
    corridorId: 'nh-27',
    lat: 25.158,
    lng: 93.01,
    status: 'unconfirmed' as const,
    createdAt: new Date().toISOString(),
  });

  it('same client UUID submitted twice → exactly one Firestore document', async () => {
    const payload = makePayload(callerUid);

    const result1 = await callFunction('syncMutationQueue', { id: payload.id, payload }, idToken);
    const result2 = await callFunction('syncMutationQueue', { id: payload.id, payload }, idToken);

    assert.equal(result1.ok, true, 'First submission should succeed');
    assert.equal(result2.ok, true, 'Second submission (retry) should also succeed');
    assert.equal(result1.reportId, 'stable-client-uuid-1234');
    assert.equal(result2.reportId, 'stable-client-uuid-1234');

    // Only one document should exist in Firestore.
    const snap = await db.doc('reports/stable-client-uuid-1234').get();
    assert.ok(snap.exists, 'Document should exist');

    // Count all documents — there should be exactly 1.
    const collection = await db.collection('reports').get();
    assert.equal(collection.size, 1, `Expected exactly 1 document, found ${collection.size}`);
  });

  it('submission rejected when reporterId does not match caller uid', async () => {
    const payload = {
      ...makePayload(callerUid),
      reporterId: 'someone-elses-uid', // tampered
    };

    const result = await callFunction('syncMutationQueue', { id: payload.id, payload }, idToken);
    assert.equal(result.ok, false, 'Should reject mismatched reporterId');
    assert.ok(result.error?.includes('permission-denied') || result.error?.includes('reporterId'),
      `Expected permission-denied error, got: ${result.error}`);
  });

  it('unauthenticated call is rejected', async () => {
    const payload = makePayload(callerUid);
    const result = await callFunction('syncMutationQueue', { id: payload.id, payload }, undefined); // no token
    assert.equal(result.ok, false, 'Should reject unauthenticated calls');
  });

  it('payload with corroborationScore/priorityKey has those fields stripped (not rejected)', async () => {
    const payload = {
      ...makePayload(callerUid),
      corroborationScore: 0.9,  // client trying to set server-only field
      priorityKey: 99.9,
    };

    const result = await callFunction('syncMutationQueue', { id: payload.id, payload }, idToken);
    // Function should succeed but strip the server-only fields.
    assert.equal(result.ok, true, 'Should succeed but strip server-only fields');

    const snap = await db.doc('reports/stable-client-uuid-1234').get();
    assert.ok(snap.exists);
    // corroborationScore is absent OR is 0 (default from Zod schema) — not 0.9.
    const stored = snap.data();
    assert.notEqual(stored?.corroborationScore, 0.9,
      'corroborationScore 0.9 should have been stripped before write');
    assert.notEqual(stored?.priorityKey, 99.9,
      'priorityKey 99.9 should have been stripped before write');
  });
});
