import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcPriorityKey,
  calcCorroborationScore,
  CORROBORATION_CONFIRM_THRESHOLD,
  byPriorityDesc,
} from '../src/risk/priorityQueue.ts';

test('formula: priority_key = severity × corroboration × criticalityWeight', () => {
  assert.equal(calcPriorityKey({ severity: 5, corroborationScore: 1, criticalityWeight: 1 }), 5);
  assert.equal(calcPriorityKey({ severity: 3, corroborationScore: 0.5, criticalityWeight: 1 }), 1.5);
  assert.equal(calcPriorityKey({ severity: 4, corroborationScore: 0.25, criticalityWeight: 0.5 }), 0.5);
});

test('§10 edge case: NH-27 severity 3 outranks a side road at severity 5', () => {
  const nh27 = calcPriorityKey({ severity: 3, corroborationScore: 1, criticalityWeight: 1.0 });
  const sideRoad = calcPriorityKey({ severity: 5, corroborationScore: 1, criticalityWeight: 0.5 });
  assert.ok(nh27 > sideRoad, `expected ${nh27} > ${sideRoad}`);
});

test('unconfirmed single report (corroboration 0) never outranks a corroborated one', () => {
  const single = calcPriorityKey({ severity: 5, corroborationScore: 0, criticalityWeight: 1.0 });
  const corroborated = calcPriorityKey({ severity: 1, corroborationScore: 1, criticalityWeight: 1.0 });
  assert.ok(corroborated > single);
});

test('§4.4 corroboration saturates at 3 distinct reporters', () => {
  assert.equal(CORROBORATION_CONFIRM_THRESHOLD, 3);
  assert.equal(calcCorroborationScore(0), 0);
  assert.equal(calcCorroborationScore(1), 1 / 3);
  assert.equal(calcCorroborationScore(2), 2 / 3);
  assert.equal(calcCorroborationScore(3), 1);
  assert.equal(calcCorroborationScore(7), 1);
  assert.throws(() => calcCorroborationScore(1.5), RangeError);
  assert.throws(() => calcCorroborationScore(-1), RangeError);
});

test('byPriorityDesc sorts most-urgent first', () => {
  const reports = [
    { severity: 2, corroborationScore: 1, criticalityWeight: 0.5 },
    { severity: 5, corroborationScore: 1, criticalityWeight: 1.0 },
    { severity: 4, corroborationScore: 0.5, criticalityWeight: 1.0 },
  ];
  const sorted = [...reports].sort(byPriorityDesc);
  assert.deepEqual(
    sorted.map((r) => r.severity),
    [5, 4, 2],
  );
});

test('invalid inputs are rejected', () => {
  assert.throws(() => calcPriorityKey({ severity: 6, corroborationScore: 1, criticalityWeight: 1 }));
  assert.throws(() => calcPriorityKey({ severity: 0, corroborationScore: 1, criticalityWeight: 1 }));
  assert.throws(() => calcPriorityKey({ severity: 3, corroborationScore: 1.5, criticalityWeight: 1 }));
  assert.throws(() => calcPriorityKey({ severity: 3, corroborationScore: 1, criticalityWeight: 0 }));
});
