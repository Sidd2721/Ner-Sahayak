export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function assertValid(p: LatLng): void {
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
    throw new RangeError(`invalid coordinates: lat ${p.lat}, lng ${p.lng}`);
  }
}

/**
 * Great-circle distance between two points (§4.5 dispatch matching,
 * §4.6 nearest-help ranking) using the haversine formula.
 * @returns distance in meters
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  assertValid(a);
  assertValid(b);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Convenience wrapper — same distance in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b) / 1000;
}
