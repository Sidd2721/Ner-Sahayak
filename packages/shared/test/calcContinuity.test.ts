import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcContinuityGap, continuityStatus } from '../src/risk/calcContinuity.ts';
import { SEED_DISTRICTS } from '../src/constants/corridors.ts';

test('formula: continuity_gap = stock_buffer_days − expected_closure_days', () => {
  assert.equal(calcContinuityGap(4, 'Low'), 4);
  assert.equal(calcContinuityGap(4, 'Medium'), 2);
  assert.equal(calcContinuityGap(4, 'High'), -1);
  assert.equal(calcContinuityGap(4, 'Severe'), -4);
});

test('§4.1 seed rows against a High corridor: Silchar −1, Hailakandi +1, Karimganj +4', () => {
  const byId = new Map(SEED_DISTRICTS.map((d) => [d.id, d]));
  assert.equal(calcContinuityGap(byId.get('cachar-silchar')!.stockBufferDays, 'High'), -1);
  assert.equal(calcContinuityGap(byId.get('hailakandi')!.stockBufferDays, 'High'), 1);
  assert.equal(calcContinuityGap(byId.get('karimganj')!.stockBufferDays, 'High'), 4);
});

test('the §4.1 point: a thin-buffer district is CRITICAL while corridor risk is only Medium', () => {
  // buffer 1 day, Medium closure 2 days → gap −1 → CRITICAL
  const gap = calcContinuityGap(1, 'Medium');
  assert.equal(gap, -1);
  assert.equal(continuityStatus(gap), 'CRITICAL');
});

test('status thresholds: negative → CRITICAL, 0…2 → WATCH, >2 → OK', () => {
  assert.equal(continuityStatus(-0.5), 'CRITICAL');
  assert.equal(continuityStatus(0), 'WATCH');
  assert.equal(continuityStatus(2), 'WATCH');
  assert.equal(continuityStatus(2.5), 'OK');
});

test('negative stock buffer input is rejected', () => {
  assert.throws(() => calcContinuityGap(-1, 'Medium'), RangeError);
});
