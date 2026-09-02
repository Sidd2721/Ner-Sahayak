import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcRisk,
  riskCategory,
  RISK_WEIGHTS,
  CLOSURE_DAYS_BY_CATEGORY,
} from '../src/risk/calcRisk.ts';

test('MVP weights are exactly ARCHITECTURE.md §5: (0.35, 0.25, 0.25, 0.15)', () => {
  assert.equal(RISK_WEIGHTS.rainfall, 0.35);
  assert.equal(RISK_WEIGHTS.slope, 0.25);
  assert.equal(RISK_WEIGHTS.soilSaturation, 0.25);
  assert.equal(RISK_WEIGHTS.recentIncident, 0.15);
  // weights sum to 1, so the score over normalized inputs stays in 0…1
  assert.equal(
    RISK_WEIGHTS.rainfall + RISK_WEIGHTS.slope + RISK_WEIGHTS.soilSaturation + RISK_WEIGHTS.recentIncident,
    1,
  );
});

test('closure-days map is §4.1: Low→0, Medium→2, High→5, Severe→8', () => {
  assert.deepEqual(CLOSURE_DAYS_BY_CATEGORY, { Low: 0, Medium: 2, High: 5, Severe: 8 });
});

test('all-zero inputs → score 0, Low, 0 closure days', () => {
  const r = calcRisk({ rainfallNorm: 0, slopeNorm: 0, soilSaturationNorm: 0, recentIncidentNorm: 0 });
  assert.equal(r.score, 0);
  assert.equal(r.category, 'Low');
  assert.equal(r.expectedClosureDays, 0);
});

test('all-max inputs → score 1, Severe, 8 closure days', () => {
  const r = calcRisk({ rainfallNorm: 1, slopeNorm: 1, soilSaturationNorm: 1, recentIncidentNorm: 1 });
  assert.equal(r.score, 1);
  assert.equal(r.category, 'Severe');
  assert.equal(r.expectedClosureDays, 8);
});

test('manual trace: rainfall=1 alone → 0.35 (Medium, 2d); slope+soil=1 → 0.5 (High, 5d)', () => {
  const rain = calcRisk({ rainfallNorm: 1, slopeNorm: 0, soilSaturationNorm: 0, recentIncidentNorm: 0 });
  assert.equal(rain.score, 0.35);
  assert.equal(rain.category, 'Medium');
  assert.equal(rain.expectedClosureDays, 2);

  const terrain = calcRisk({ rainfallNorm: 0, slopeNorm: 1, soilSaturationNorm: 1, recentIncidentNorm: 0 });
  assert.equal(terrain.score, 0.5);
  assert.equal(terrain.category, 'High');
  assert.equal(terrain.expectedClosureDays, 5);
});

test('manual trace: uniform 0.5 inputs → 0.5 → High', () => {
  const r = calcRisk({ rainfallNorm: 0.5, slopeNorm: 0.5, soilSaturationNorm: 0.5, recentIncidentNorm: 0.5 });
  assert.equal(r.score, 0.5);
  assert.equal(r.category, 'High');
});

test('category band edges are the documented quartile thresholds', () => {
  assert.equal(riskCategory(0), 'Low');
  assert.equal(riskCategory(0.2499), 'Low');
  assert.equal(riskCategory(0.25), 'Medium');
  assert.equal(riskCategory(0.4999), 'Medium');
  assert.equal(riskCategory(0.5), 'High');
  assert.equal(riskCategory(0.7499), 'High');
  assert.equal(riskCategory(0.75), 'Severe');
  assert.equal(riskCategory(1), 'Severe');
});

test('out-of-range normalized input is rejected', () => {
  assert.throws(() => calcRisk({ rainfallNorm: 1.2, slopeNorm: 0, soilSaturationNorm: 0, recentIncidentNorm: 0 }));
  assert.throws(() => calcRisk({ rainfallNorm: -0.1, slopeNorm: 0, soilSaturationNorm: 0, recentIncidentNorm: 0 }));
});
