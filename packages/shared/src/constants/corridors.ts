import type { District } from '../schemas/district.ts';

/**
 * Corridor seed data — ARCHITECTURE.md §2 (NH-27 Lifeline Corridor, Dima
 * Hasao) only. The historical hackathon corridor (Majuli/ferry, ROADMAP.md)
 * is deliberately absent: superseded by this scope.
 *
 * Every entity here is data, not hardcoded strings in app logic, so the
 * next lifeline road (e.g. NH-29 Dimapur–Kohima) onboards as new rows.
 */

export type CorridorWaypoint = {
  name: string;
  lat: number;
  lng: number;
  note?: string;
};

export type CorridorSegment = {
  id: string;
  from: string;
  to: string;
  tags: ('tunnel-chokepoint' | 'landslide-prone' | 'district-hq')[];
  note?: string;
};

export type Corridor = {
  id: string;
  name: string;
  description: string;
  /**
   * §4.5 criticality multiplier. NH-27 is the documented single point of
   * failure for the three Barak Valley districts — the maximum, 1.0.
   */
  criticalityWeight: number;
  waypoints: CorridorWaypoint[];
  segments: CorridorSegment[];
  /** downstream dependent districts (§4.1 continuity board rows) */
  districtIds: string[];
};

export const NH27_CORRIDOR_ID = 'nh-27';

/**
 * Timestamp of this seed snapshot. Risk-derived UI must label scores
 * "as of" this time (§10) — seeds are never presented as live.
 */
export const SEED_AS_OF = '2026-09-02T00:00:00.000Z';

export const NH27_CORRIDOR: Corridor = {
  id: NH27_CORRIDOR_ID,
  name: 'NH-27',
  description:
    'NH-27 Lifeline Corridor, Dima Hasao — the only road connecting the Barak Valley ' +
    '(Cachar, Hailakandi, Karimganj) to Guwahati and the rest of the Northeast. ' +
    'Cut for days by landslides at Haflong and siltation at the Maibang tunnel in May 2022.',
  criticalityWeight: 1.0,
  waypoints: [
    { name: 'Guwahati', lat: 26.1445, lng: 91.7362, note: 'Corridor start — Assam gateway' },
    { name: 'Lumding', lat: 25.748, lng: 93.167, note: 'Entry junction (Nagaon district)' },
    { name: 'Maibang', lat: 25.167, lng: 93.17, note: 'NH-27 tunnel chokepoint' },
    { name: 'Harangajao', lat: 25.21, lng: 93.09, note: 'Landslide-prone stretch' },
    { name: 'Mahur', lat: 25.09, lng: 93.02, note: 'Landslide-prone stretch' },
    { name: 'Haflong', lat: 25.158, lng: 93.01, note: 'Dima Hasao district HQ' },
    { name: 'Silchar', lat: 24.818, lng: 92.796, note: 'Barak Valley hub — corridor terminus' },
  ],
  segments: [
    {
      id: 'nh-27-guwahati-lumding',
      from: 'Guwahati',
      to: 'Lumding',
      tags: ['district-hq'],
    },
    {
      id: 'nh-27-lumding-maibang',
      from: 'Lumding',
      to: 'Maibang',
      tags: ['tunnel-chokepoint'],
      note: 'Maibang tunnel — siltation chokepoint in the May 2022 closure',
    },
    {
      id: 'nh-27-maibang-harangajao',
      from: 'Maibang',
      to: 'Harangajao',
      tags: ['landslide-prone'],
    },
    {
      id: 'nh-27-harangajao-mahur',
      from: 'Harangajao',
      to: 'Mahur',
      tags: ['landslide-prone'],
      note: 'Harangajao/Mahur stretch — landslide-prone (May 2022)',
    },
    {
      id: 'nh-27-mahur-haflong',
      from: 'Mahur',
      to: 'Haflong',
      tags: ['district-hq'],
    },
    {
      id: 'nh-27-haflong-silchar',
      from: 'Haflong',
      to: 'Silchar',
      tags: ['landslide-prone'],
      note: 'Descent into the Barak Valley — landlocked when NH-27 is cut',
    },
  ],
  districtIds: ['cachar-silchar', 'hailakandi', 'karimganj'],
};

export const CORRIDORS: Corridor[] = [NH27_CORRIDOR];

/**
 * §4.1 seed: Silchar 4d buffer, Hailakandi 6d, Karimganj 9d against the
 * corridor's live risk output. currentRiskScore starts at 0.3 (Medium band)
 * as a neutral seed; the §5 engine's last-published score replaces it.
 */
export const SEED_DISTRICTS: District[] = [
  {
    id: 'cachar-silchar',
    name: 'Cachar (Silchar)',
    connectivityStatus: 'connected',
    currentRiskScore: 0.3,
    stockBufferDays: 4,
    lastUpdated: SEED_AS_OF,
  },
  {
    id: 'hailakandi',
    name: 'Hailakandi',
    connectivityStatus: 'connected',
    currentRiskScore: 0.3,
    stockBufferDays: 6,
    lastUpdated: SEED_AS_OF,
  },
  {
    id: 'karimganj',
    name: 'Karimganj',
    connectivityStatus: 'connected',
    currentRiskScore: 0.3,
    stockBufferDays: 9,
    lastUpdated: SEED_AS_OF,
  },
];

export function getCorridor(id: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.id === id);
}
