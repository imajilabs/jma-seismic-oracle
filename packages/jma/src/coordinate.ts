/**
 * JMA encodes hypocenter coordinates in the ISO 6709-ish form:
 *
 *   <jmx_eb:Coordinate>+38.1+142.9-30000/</jmx_eb:Coordinate>
 *
 * This is signed decimal degrees latitude, signed decimal degrees longitude,
 * and (optionally) signed depth in meters. The trailing "/" terminates the
 * coordinate per the spec.
 *
 * Edge cases we have to handle:
 *   - Depth omitted entirely (some preliminary reports)
 *   - Negative latitude (Antarctic-adjacent, doesn't actually happen for Japan
 *     but we don't want to bake in a Japan-only assumption)
 *   - Whitespace, newlines, BOM in the wrapping XML
 */

import type { Hypocenter } from "./types.ts";

const COORD_PATTERN =
  /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?/;

export function parseJmaCoordinate(raw: string | null | undefined): Hypocenter | null {
  if (raw == null) return null;
  const m = raw.match(COORD_PATTERN);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const depthM = m[3] != null ? Number(m[3]) : null;
  const depthKm =
    depthM != null && Number.isFinite(depthM) ? Math.abs(depthM) / 1000 : null;

  return {
    latitude: lat,
    longitude: lon,
    depthKm,
    magnitude: null,
  };
}
