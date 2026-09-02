/**
 * Geohash encode/decode — ARCHITECTURE.md §4.4: incoming reports are
 * geohashed to ~150m precision and bucketed by type; 3+ independent
 * reporters in one bucket escalate a report to confirmed.
 *
 * Precision 7 gives ~153m × ~153m cells, matching the "~150m" spec.
 */
export const GEOHASH_PRECISION = 7;

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function assertValid(lat: number, lng: number): void {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new RangeError(`invalid coordinates: lat ${lat}, lng ${lng}`);
  }
}

export function encodeGeohash(lat: number, lng: number, precision: number = GEOHASH_PRECISION): string {
  if (!Number.isInteger(precision) || precision < 1 || precision > 12) {
    throw new RangeError(`precision must be an integer 1–12, got ${precision}`);
  }
  assertValid(lat, lng);

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = '';
  let bit = 0; // 0…4, bits accumulated for the current base32 char
  let idx = 0; // value of the current base32 char
  let evenBit = true; // longitude bits and latitude bits interleave, longitude first

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lngMin = mid;
      } else {
        idx = idx * 2;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    bit += 1;
    if (bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

export type GeohashBounds = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

/** Decodes a geohash back to its bounding box (the bucket's extent). */
export function decodeGeohash(geohash: string): GeohashBounds {
  if (!/^[0-9bcdefghjkmnpqrstuvwxyz]+$/.test(geohash)) {
    throw new RangeError(`invalid geohash: ${geohash}`);
  }

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let evenBit = true;

  for (const char of geohash) {
    const idx = BASE32.indexOf(char);
    for (let bit = 4; bit >= 0; bit -= 1) {
      const isSet = (idx >> bit) & 1;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (isSet) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (isSet) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      evenBit = !evenBit;
    }
  }
  return { latMin, latMax, lngMin, lngMax };
}

/**
 * The §4.4 dedup/corroboration bucket key for a report location:
 * the precision-7 geohash (paired with the report type by the caller,
 * since bucketing is "by type" per §4.4).
 */
export function geohashBucket(lat: number, lng: number): string {
  return encodeGeohash(lat, lng, GEOHASH_PRECISION);
}
