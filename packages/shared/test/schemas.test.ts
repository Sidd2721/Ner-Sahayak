import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReportSchema, REPORT_TYPES, REPORT_STATUSES } from '../src/schemas/report.ts';
import { DistrictSchema, CONNECTIVITY_STATUSES } from '../src/schemas/district.ts';

const validReport = {
  id: 'b3f1c9a2-0000-4000-8000-0123456789ab', // client-generated UUID, §10 idempotency
  type: 'road-blocked',
  severity: 4,
  geohash: 'wh7k1mr',
  corridorId: 'nh-27',
  lat: 25.158,
  lng: 93.01,
  reporterId: 'user-42',
  createdAt: '2026-09-02T10:30:00.000Z',
};

test('ReportSchema accepts a valid report and applies §4.4/§6 defaults', () => {
  const r = ReportSchema.parse(validReport);
  assert.equal(r.corroborationScore, 0); // single unconfirmed report
  assert.equal(r.status, 'unconfirmed'); // triage pipeline entry state
  assert.equal(r.syncedAt, undefined); // absent until synced
});

test('ReportSchema round-trips optional fields', () => {
  const r = ReportSchema.parse({
    ...validReport,
    photo: 'data:image/png;base64,xxxx',
    status: 'confirmed',
    corroborationScore: 1,
    syncedAt: '2026-09-02T10:31:00+05:30',
  });
  assert.equal(r.status, 'confirmed');
  assert.equal(r.corroborationScore, 1);
  assert.ok(r.photo!.startsWith('data:image'));
});

test('ReportSchema rejects bad values', () => {
  assert.throws(() => ReportSchema.parse({ ...validReport, severity: 6 }));
  assert.throws(() => ReportSchema.parse({ ...validReport, severity: 0 }));
  assert.throws(() => ReportSchema.parse({ ...validReport, type: 'meteor' }));
  assert.throws(() => ReportSchema.parse({ ...validReport, lat: 91 }));
  assert.throws(() => ReportSchema.parse({ ...validReport, status: 'rejected' }));
  assert.throws(() => ReportSchema.parse({ ...validReport, createdAt: 'not-a-date' }));
  assert.throws(() => ReportSchema.parse({ ...validReport, reporterId: '' }));
  const { id, ...noId } = validReport;
  void id;
  assert.throws(() => ReportSchema.parse(noId));
});

test('enums cover the §4.2 dual ping and the triage state machine', () => {
  assert.ok(REPORT_TYPES.includes('road-blocked'));
  assert.ok(REPORT_TYPES.includes('route-clear'));
  assert.deepEqual(REPORT_STATUSES, [
    'unconfirmed',
    'confirmed',
    'dispatched',
    'resolved',
    'archived',
  ]);
});

const validDistrict = {
  id: 'cachar-silchar',
  name: 'Cachar (Silchar)',
  connectivityStatus: 'connected',
  currentRiskScore: 0.3,
  stockBufferDays: 4,
  lastUpdated: '2026-09-02T00:00:00.000Z',
};

test('DistrictSchema accepts a valid district', () => {
  const d = DistrictSchema.parse(validDistrict);
  assert.equal(d.stockBufferDays, 4);
});

test('DistrictSchema rejects bad values', () => {
  assert.throws(() => DistrictSchema.parse({ ...validDistrict, currentRiskScore: 1.4 }));
  assert.throws(() => DistrictSchema.parse({ ...validDistrict, stockBufferDays: -1 }));
  assert.throws(() => DistrictSchema.parse({ ...validDistrict, connectivityStatus: 'flaky' }));
  assert.throws(() => DistrictSchema.parse({ ...validDistrict, lastUpdated: 'yesterday' }));
  assert.ok(CONNECTIVITY_STATUSES.includes('isolated'));
});
