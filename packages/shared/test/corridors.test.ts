import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRIDORS,
  NH27_CORRIDOR,
  NH27_CORRIDOR_ID,
  SEED_DISTRICTS,
  getCorridor,
} from '../src/constants/corridors.ts';
import { DistrictSchema } from '../src/schemas/district.ts';

test('seed contains exactly one corridor: NH-27 (Dima Hasao lifeline)', () => {
  assert.equal(CORRIDORS.length, 1);
  assert.equal(NH27_CORRIDOR.id, NH27_CORRIDOR_ID);
  assert.equal(getCorridor('nh-27')!.name, 'NH-27');
  assert.equal(getCorridor('nope'), undefined);
});

test('NH-27 carries the maximum criticality weight (§4.5 single point of failure)', () => {
  assert.equal(NH27_CORRIDOR.criticalityWeight, 1.0);
});

test('waypoints match the ARCHITECTURE.md §2 instrumented chain', () => {
  const names = NH27_CORRIDOR.waypoints.map((w) => w.name);
  for (const expected of ['Guwahati', 'Lumding', 'Maibang', 'Harangajao', 'Mahur', 'Haflong', 'Silchar']) {
    assert.ok(names.includes(expected), `missing waypoint ${expected}`);
  }
  // every waypoint is a valid coordinate
  for (const w of NH27_CORRIDOR.waypoints) {
    assert.ok(w.lat >= -90 && w.lat <= 90 && w.lng >= -180 && w.lng <= 180);
  }
});

test('segments reference known waypoints and cover the documented chokepoints', () => {
  const names = new Set(NH27_CORRIDOR.waypoints.map((w) => w.name));
  for (const s of NH27_CORRIDOR.segments) {
    assert.ok(names.has(s.from), `unknown segment origin ${s.from}`);
    assert.ok(names.has(s.to), `unknown segment destination ${s.to}`);
  }
  const tags = NH27_CORRIDOR.segments.flatMap((s) => s.tags);
  assert.ok(tags.includes('tunnel-chokepoint')); // Maibang tunnel
  assert.ok(tags.filter((t) => t === 'landslide-prone').length >= 2); // Harangajao/Mahur + descent
});

test('districts are the three Barak Valley dependents with §4.1 buffers 4/6/9', () => {
  assert.deepEqual(
    SEED_DISTRICTS.map((d) => d.stockBufferDays).sort((a, b) => a - b),
    [4, 6, 9],
  );
  assert.deepEqual(
    NH27_CORRIDOR.districtIds.sort(),
    [...SEED_DISTRICTS.map((d) => d.id)].sort(),
  );
  for (const d of SEED_DISTRICTS) {
    DistrictSchema.parse(d); // seed rows must satisfy the schema
  }
});

test('NO Majuli/ferry-corridor data anywhere in the seed (historical ROADMAP.md scope)', () => {
  const blob = JSON.stringify({ CORRIDORS, SEED_DISTRICTS }).toLowerCase();
  for (const banned of ['majuli', 'ferry', 'jorhat', 'kamrup', 'neamatighat', 'kamlabari']) {
    assert.ok(!blob.includes(banned), `historical-corridor term "${banned}" found in seed data`);
  }
});
