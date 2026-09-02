/**
 * onReportCreate integration tests — run against the Firebase emulator.
 *
 * Key behaviours verified:
 *
 * 1. CORROBORATION (two distinct reporters, same geohash+type within 15 min):
 *    - Both reports end up with a combined corroborationScore, NOT two
 *      separate scores of 0.33 each.
 *    - Score is calcCorroborationScore(2) = 0.67 (2 distinct reporters / 3).
 *    - Status stays 'unconfirmed' (threshold is 3 reporters).
 *
 * 2. THREE distinct reporters → status escalates to 'confirmed', score = 1.0.
 *
 * 3. SAME REPORTER TWICE (retry scenario) → counts as 1 distinct reporter,
 *    score stays 0.33. Distinct-reporter dedup works correctly.
 *
 * 4. Different geohash same type → NOT corroborated (separate buckets).
 *
 * These tests write directly to Firestore and wait for the function trigger
 * to settle (polling-based, max 5s per assertion).
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initEmulatorApp, clearEmulatorData, createTestUser } from './helpers/emulator.ts';
import { encodeGeohash } from '../../packages/shared/src/geo/geohash.ts';
import { calcCorroborationScore } from '../../packages/shared/src/risk/priorityQueue.ts';

// Wait for the function trigger to update the documents.
async function poll<T>(
  fn: () => Promise<T | null>,
  { maxMs = 5000, intervalMs = 200 } = {},
): Promise<T> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result !== null) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`poll timed out after ${maxMs}ms`);
}

const CORRIDOR_ID = 'nh-27';
// Haflong coordinates — within NH-27 corridor
const LAT = 25.158;
const LNG = 93.01;
const GEOHASH = encodeGeohash(LAT, LNG);

describe('onReportCreate — corroboration logic', () => {
  const { db, auth } = initEmulatorApp('corroboration-tests');
  let reporterA: string;
  let reporterB: string;
  let reporterC: string;

  before(async () => {
    reporterA = await createTestUser(auth, { email: 'a@test.com', password: 'pass1234', role: 'citizen' }, db);
    reporterB = await createTestUser(auth, { email: 'b@test.com', password: 'pass1234', role: 'citizen' }, db);
    reporterC = await createTestUser(auth, { email: 'c@test.com', password: 'pass1234', role: 'citizen' }, db);
  });

  beforeEach(async () => {
    await clearEmulatorData();
    // Re-seed user docs after clear
    await db.doc(`users/${reporterA}`).set({ role: 'citizen', email: 'a@test.com' });
    await db.doc(`users/${reporterB}`).set({ role: 'citizen', email: 'b@test.com' });
    await db.doc(`users/${reporterC}`).set({ role: 'citizen', email: 'c@test.com' });
  });

  after(async () => {
    await clearEmulatorData();
  });

  it('two distinct reporters → combined corroborationScore 0.67, still unconfirmed', async () => {
    const now = new Date().toISOString();
    const reportId1 = 'report-uuid-1';
    const reportId2 = 'report-uuid-2';

    // Write two reports from DIFFERENT reporters, same geohash+type.
    // These represent two people independently reporting the same landslide.
    await db.doc(`reports/${reportId1}`).set({
      id: reportId1,
      type: 'landslide',
      severity: 4,
      geohash: GEOHASH,
      corridorId: CORRIDOR_ID,
      reporterId: reporterA,   // distinct reporter A
      lat: LAT, lng: LNG,
      status: 'unconfirmed',
      corroborationScore: 0,
      createdAt: now,
    });

    await db.doc(`reports/${reportId2}`).set({
      id: reportId2,
      type: 'landslide',
      severity: 3,
      geohash: GEOHASH,
      corridorId: CORRIDOR_ID,
      reporterId: reporterB,   // distinct reporter B — different person
      lat: LAT, lng: LNG,
      status: 'unconfirmed',
      corroborationScore: 0,
      createdAt: now,
    });

    // Poll until both docs show the combined score.
    const expectedScore = calcCorroborationScore(2); // 0.666...

    const result = await poll(async () => {
      const snap1 = await db.doc(`reports/${reportId1}`).get();
      const snap2 = await db.doc(`reports/${reportId2}`).get();
      const score1 = snap1.data()?.corroborationScore;
      const score2 = snap2.data()?.corroborationScore;
      if (
        Math.abs(score1 - expectedScore) < 0.01 &&
        Math.abs(score2 - expectedScore) < 0.01
      ) {
        return { score1, score2, status1: snap1.data()?.status, status2: snap2.data()?.status };
      }
      return null;
    });

    assert.ok(Math.abs(result.score1 - expectedScore) < 0.01,
      `Report 1 score should be ~${expectedScore}, got ${result.score1}`);
    assert.ok(Math.abs(result.score2 - expectedScore) < 0.01,
      `Report 2 score should be ~${expectedScore}, got ${result.score2}`);
    assert.equal(result.status1, 'unconfirmed',
      'Status should remain unconfirmed with only 2 distinct reporters');
    assert.equal(result.status2, 'unconfirmed');
  });

  it('three distinct reporters → corroborationScore 1.0, status escalates to confirmed', async () => {
    const now = new Date().toISOString();

    for (const [i, reporterId] of [[1, reporterA], [2, reporterB], [3, reporterC]] as const) {
      await db.doc(`reports/report-3r-${i}`).set({
        id: `report-3r-${i}`,
        type: 'road-blocked',
        severity: 5,
        geohash: GEOHASH,
        corridorId: CORRIDOR_ID,
        reporterId,
        lat: LAT, lng: LNG,
        status: 'unconfirmed',
        corroborationScore: 0,
        createdAt: now,
      });
    }

    const result = await poll(async () => {
      const snaps = await Promise.all(
        [1, 2, 3].map((i) => db.doc(`reports/report-3r-${i}`).get())
      );
      const allConfirmed = snaps.every((s) => s.data()?.status === 'confirmed');
      const allScore1 = snaps.every((s) => Math.abs(s.data()?.corroborationScore - 1.0) < 0.01);
      if (allConfirmed && allScore1) return { ok: true };
      return null;
    }, { maxMs: 8000 });

    assert.ok(result.ok, 'All three reports should be confirmed at score 1.0');
  });

  it('same reporter submitting twice (retry) counts as 1 distinct reporter, score 0.33', async () => {
    const now = new Date().toISOString();
    // Two reports from the SAME reporterId — simulates offline retry with
    // a different UUID (e.g., client generated two UUIDs before dedup was wired).
    // The corroboration bucket should only count one distinct reporter.
    await db.doc('reports/retry-1').set({
      id: 'retry-1',
      type: 'flood',
      severity: 3,
      geohash: GEOHASH,
      corridorId: CORRIDOR_ID,
      reporterId: reporterA,
      lat: LAT, lng: LNG,
      status: 'unconfirmed',
      corroborationScore: 0,
      createdAt: now,
    });
    await db.doc('reports/retry-2').set({
      id: 'retry-2',
      type: 'flood',
      severity: 3,
      geohash: GEOHASH,
      corridorId: CORRIDOR_ID,
      reporterId: reporterA, // same reporter
      lat: LAT, lng: LNG,
      status: 'unconfirmed',
      corroborationScore: 0,
      createdAt: now,
    });

    const expectedScore = calcCorroborationScore(1); // 0.333...

    const result = await poll(async () => {
      const s1 = await db.doc('reports/retry-1').get();
      const s2 = await db.doc('reports/retry-2').get();
      const sc1 = s1.data()?.corroborationScore;
      const sc2 = s2.data()?.corroborationScore;
      if (sc1 !== undefined && sc2 !== undefined && sc1 > 0) {
        return { sc1, sc2 };
      }
      return null;
    });

    assert.ok(Math.abs(result.sc1 - expectedScore) < 0.01,
      `Same reporter twice should score ${expectedScore} (1 distinct), got ${result.sc1}`);
    assert.ok(Math.abs(result.sc2 - expectedScore) < 0.01);
  });

  it('different geohash, same type → separate buckets, no cross-corroboration', async () => {
    const now = new Date().toISOString();
    // Guwahati and Haflong — far apart, different geohash cells
    const geohashGuwahati = encodeGeohash(26.1445, 91.7362);

    await db.doc('reports/geo-a').set({
      id: 'geo-a', type: 'landslide', severity: 4,
      geohash: GEOHASH,          // Haflong
      corridorId: CORRIDOR_ID,
      reporterId: reporterA, lat: LAT, lng: LNG,
      status: 'unconfirmed', corroborationScore: 0, createdAt: now,
    });
    await db.doc('reports/geo-b').set({
      id: 'geo-b', type: 'landslide', severity: 4,
      geohash: geohashGuwahati,  // different geohash bucket
      corridorId: CORRIDOR_ID,
      reporterId: reporterB, lat: 26.1445, lng: 91.7362,
      status: 'unconfirmed', corroborationScore: 0, createdAt: now,
    });

    // Wait for function to settle, then check scores are NOT combined.
    await new Promise((r) => setTimeout(r, 3000));

    const snapA = await db.doc('reports/geo-a').get();
    const snapB = await db.doc('reports/geo-b').get();
    const scoreA = snapA.data()?.corroborationScore ?? 0;
    const scoreB = snapB.data()?.corroborationScore ?? 0;

    assert.ok(
      Math.abs(scoreA - calcCorroborationScore(1)) < 0.01,
      `geo-a should score 0.33 (1 reporter in its bucket), got ${scoreA}`,
    );
    assert.ok(
      Math.abs(scoreB - calcCorroborationScore(1)) < 0.01,
      `geo-b should score 0.33 (1 reporter in its bucket), got ${scoreB}`,
    );
  });
});
