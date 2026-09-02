import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, haversineKm } from '../src/geo/haversine.ts';
import {
  encodeGeohash,
  decodeGeohash,
  geohashBucket,
  GEOHASH_PRECISION,
} from '../src/geo/geohash.ts';

test('haversine: 1° of longitude at the equator ≈ 111.195 km (R = 6371 km)', () => {
  const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(Math.abs(d - 111.195) < 0.01, `got ${d}`);
});

test('haversine: 1° of latitude anywhere ≈ 111.195 km', () => {
  const d = haversineKm({ lat: 10, lng: 20 }, { lat: 11, lng: 20 });
  assert.ok(Math.abs(d - 111.195) < 0.01, `got ${d}`);
});

test('haversine: zero distance and symmetry', () => {
  const a = { lat: 25.158, lng: 93.01 }; // Haflong
  const b = { lat: 24.818, lng: 92.796 }; // Silchar
  assert.equal(haversineMeters(a, a), 0);
  assert.ok(Math.abs(haversineMeters(a, b) - haversineMeters(b, a)) < 1e-9);
});

test('haversine sanity: Guwahati → Silchar straight-line is ~182 km', () => {
  const d = haversineKm({ lat: 26.1445, lng: 91.7362 }, { lat: 24.818, lng: 92.796 });
  assert.ok(d > 175 && d < 190, `got ${d}`);
});

test('haversine rejects out-of-range coordinates', () => {
  assert.throws(() => haversineMeters({ lat: 91, lng: 0 }, { lat: 0, lng: 0 }), RangeError);
  assert.throws(() => haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 181 }), RangeError);
});

test('geohash: known reference — (42.605, −5.603) at precision 5 is "ezs42"', () => {
  assert.equal(encodeGeohash(42.605, -5.603, 5), 'ezs42');
});

test('geohash: default precision is 7 (~150m cells, §4.4)', () => {
  assert.equal(GEOHASH_PRECISION, 7);
  const hash = geohashBucket(25.158, 93.01);
  assert.equal(hash.length, 7);
});

test('geohash: decode returns a box containing the point, ~153m per side at p7', () => {
  const lat = 25.158;
  const lng = 93.01;
  const box = decodeGeohash(geohashBucket(lat, lng));
  assert.ok(lat >= box.latMin && lat <= box.latMax);
  assert.ok(lng >= box.lngMin && lng <= box.lngMax);

  const latSpanM = (box.latMax - box.latMin) * 111_320;
  assert.ok(latSpanM > 140 && latSpanM < 170, `lat span ${latSpanM}m`);
});

test('geohash bucketing: same ~50m spot shares a bucket, distant spots do not', () => {
  const a = geohashBucket(25.1580, 93.0100);
  const nearby = geohashBucket(25.1583, 93.0102); // ~40m away
  const distant = geohashBucket(25.167, 93.17); // Maibang, ~16km away
  assert.equal(a, nearby);
  assert.notEqual(a, distant);
});

test('geohash rejects invalid input', () => {
  assert.throws(() => encodeGeohash(95, 0), RangeError);
  assert.throws(() => encodeGeohash(0, 0, 0), RangeError);
  assert.throws(() => decodeGeohash('ei!'), RangeError);
});
