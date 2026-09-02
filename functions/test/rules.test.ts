/**
 * Firestore rules unit tests — run against the rules emulator.
 *
 * Uses @firebase/rules-unit-testing to get client SDKs authenticated as
 * specific users and assert allow/deny on each rule branch.
 *
 * Test matrix:
 *   ✓ Unauthenticated read → denied
 *   ✓ Unauthenticated write → denied
 *   ✓ Authenticated citizen read → allowed
 *   ✓ Citizen CREATE with own reporterId, no server fields → allowed
 *   ✓ Citizen CREATE with another uid as reporterId → denied
 *   ✓ Citizen CREATE with corroborationScore → denied
 *   ✓ Citizen CREATE with priorityKey → denied
 *   ✓ Citizen UPDATE existing report → denied (not Authority)
 *   ✓ Authority UPDATE status field → allowed
 *   ✓ Authority UPDATE corroborationScore → denied (server-only even for Authority)
 *   ✓ DELETE always denied
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDoc, getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const FIRESTORE_EMULATOR_HOST = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').replace('127.0.0.1', 'localhost');
const [host, portStr] = FIRESTORE_EMULATOR_HOST.split(':');
const EMULATOR_PORT = parseInt(portStr ?? '8080', 10);

const VALID_REPORT = {
  id: 'test-report-uuid',
  type: 'landslide',
  severity: 3,
  geohash: 'p3wjjt6',
  corridorId: 'nh-27',
  lat: 25.158,
  lng: 93.01,
  status: 'unconfirmed',
  createdAt: new Date().toISOString(),
};

describe('firestore.rules', () => {
  let testEnv: RulesTestEnvironment;
  const CITIZEN_UID = 'citizen-uid-abc';
  const OFFICER_UID = 'officer-uid-xyz';
  const OTHER_UID = 'other-citizen-uid';

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'sih2026-ce822',
      firestore: {
        rules: readFileSync(RULES_PATH, 'utf8'),
        host,
        port: EMULATOR_PORT,
      },
    });

    // Seed user role docs using the admin context (bypasses rules).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', CITIZEN_UID), { role: 'citizen', email: 'c@test.com' });
      await setDoc(doc(db, 'users', OFFICER_UID), { role: 'officer', email: 'o@test.com' });
      await setDoc(doc(db, 'users', OTHER_UID), { role: 'citizen', email: 'other@test.com' });
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  // ── READ ──────────────────────────────────────────────────────────────

  it('unauthenticated read on reports → denied', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'reports', 'any-doc')));
  });

  it('authenticated citizen can read reports', async () => {
    // Seed a doc first so the read has something to return.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'readable-doc'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID,
      });
    });

    const ctx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'reports', 'readable-doc')));
  });

  // ── CREATE ────────────────────────────────────────────────────────────

  it('citizen CREATE with own reporterId and no server fields → allowed', async () => {
    const ctx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'reports', 'new-report-1'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID, // own uid ✓
        // no corroborationScore, no priorityKey ✓
      }),
    );
  });

  it('citizen CREATE with another uid as reporterId → denied', async () => {
    const ctx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), 'reports', 'new-report-2'), {
        ...VALID_REPORT,
        reporterId: OTHER_UID, // not caller's uid ✗
      }),
    );
  });

  it('citizen CREATE with corroborationScore → denied', async () => {
    const ctx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), 'reports', 'new-report-3'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID,
        corroborationScore: 0.5, // server-only field ✗
      }),
    );
  });

  it('citizen CREATE with priorityKey → denied', async () => {
    const ctx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), 'reports', 'new-report-4'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID,
        priorityKey: 3.5, // server-only field ✗
      }),
    );
  });

  it('unauthenticated CREATE → denied', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'reports', 'new-report-5'), {
        ...VALID_REPORT,
        reporterId: 'anyone',
      }),
    );
  });

  // ── UPDATE ────────────────────────────────────────────────────────────

  it('citizen UPDATE existing report → denied (not Authority)', async () => {
    // Seed the doc first.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'existing-report'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID,
      });
    });

    const ctx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'reports', 'existing-report'), {
        status: 'confirmed',
      }),
    );
  });

  it('Authority (officer) can UPDATE status → allowed', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'auth-update-report'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID,
      });
    });

    const ctx = testEnv.authenticatedContext(OFFICER_UID);
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'reports', 'auth-update-report'), {
        status: 'dispatched',
      }),
    );
  });

  it('Authority UPDATE corroborationScore → denied (server-only, even for Authority)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'corr-update-report'), {
        ...VALID_REPORT,
        reporterId: CITIZEN_UID,
      });
    });

    const ctx = testEnv.authenticatedContext(OFFICER_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'reports', 'corr-update-report'), {
        corroborationScore: 0.8, // server-only ✗
      }),
    );
  });

  // ── DELETE ────────────────────────────────────────────────────────────

  it('DELETE always denied (§7 archive instead)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'delete-target'), {
        ...VALID_REPORT,
        reporterId: OFFICER_UID,
      });
    });

    // Even Authority cannot delete.
    const officerCtx = testEnv.authenticatedContext(OFFICER_UID);
    await assertFails(deleteDoc(doc(officerCtx.firestore(), 'reports', 'delete-target')));

    const citizenCtx = testEnv.authenticatedContext(CITIZEN_UID);
    await assertFails(deleteDoc(doc(citizenCtx.firestore(), 'reports', 'delete-target')));

    const anonCtx = testEnv.unauthenticatedContext();
    await assertFails(deleteDoc(doc(anonCtx.firestore(), 'reports', 'delete-target')));
  });
});
