/**
 * JMA shindo (seismic intensity) scale normalization.
 *
 * JMA uses 10 discrete steps:
 *   0, 1, 2, 3, 4, 5弱 (5-), 5強 (5+), 6弱 (6-), 6強 (6+), 7
 *
 * On the wire JMA reports these as strings. To make the value:
 *   - sortable
 *   - integer-encodable (Move u8)
 *   - distinguishable between 5弱 / 5強 etc.
 *
 * we use the conventional ×10 integer encoding:
 *   0  -> 0
 *   1  -> 10
 *   2  -> 20
 *   3  -> 30
 *   4  -> 40
 *   5- -> 50      (5弱)
 *   5+ -> 55      (5強)
 *   6- -> 60      (6弱)
 *   6+ -> 65      (6強)
 *   7  -> 70
 *
 * Anything else (bad input, "不明", etc.) returns null.
 */

export const SHINDO_SCALE = {
  S0: 0,
  S1: 10,
  S2: 20,
  S3: 30,
  S4: 40,
  S5_LOWER: 50, // 5弱
  S5_UPPER: 55, // 5強
  S6_LOWER: 60, // 6弱
  S6_UPPER: 65, // 6強
  S7: 70,
} as const;

export type ShindoScaled = (typeof SHINDO_SCALE)[keyof typeof SHINDO_SCALE];

/**
 * Parse a JMA shindo string into the normalized integer scale.
 * Accepts the formats JMA actually emits: "0".."4", "5-", "5+", "6-", "6+", "7".
 * Also accepts the alt-text forms "5弱" / "5強" / "6弱" / "6強".
 */
export function parseShindo(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  switch (s) {
    case "0":
      return 0;
    case "1":
      return 10;
    case "2":
      return 20;
    case "3":
      return 30;
    case "4":
      return 40;
    case "5-":
    case "5弱":
      return 50;
    case "5+":
    case "5強":
      return 55;
    case "6-":
    case "6弱":
      return 60;
    case "6+":
    case "6強":
      return 65;
    case "7":
      return 70;
    default:
      return null;
  }
}

/** Inverse of `parseShindo`. */
export function formatShindo(scaled: number | null | undefined): string | null {
  if (scaled == null) return null;
  switch (scaled) {
    case 0:
      return "0";
    case 10:
      return "1";
    case 20:
      return "2";
    case 30:
      return "3";
    case 40:
      return "4";
    case 50:
      return "5-";
    case 55:
      return "5+";
    case 60:
      return "6-";
    case 65:
      return "6+";
    case 70:
      return "7";
    default:
      return null;
  }
}

/**
 * Compare two shindo readings on the normalized scale.
 * Returns negative if a<b, positive if a>b, zero if equal.
 */
export function compareShindo(a: number, b: number): number {
  return a - b;
}

/** Convenience: is the observed shindo greater than or equal to a threshold? */
export function meetsThreshold(observed: number | null, threshold: number): boolean {
  if (observed == null) return false;
  return observed >= threshold;
}

// ─── Structured Shindo — mirrors the on-chain jma_seismic_oracle::shindo type ──
//
// On chain, JMA's scale is encoded as `Shindo { level: u8, band: Option<Band> }`
// where `band` is `Some` only for levels 5 and 6. The TypeScript
// representation below is a discriminated union that makes invalid
// combinations (like `(level: 3, band: "Upper")`) unrepresentable at the
// type level — TypeScript's structural typing rejects them at compile time.

/** JMA sub-band classification. Only meaningful for levels 5 and 6. */
export type Band = "Lower" | "Upper";

/**
 * Structured JMA shindo value mirroring the on-chain `jma_seismic_oracle::shindo::Shindo`.
 *
 * - Levels 0..=4 and 7 carry no band.
 * - Levels 5 and 6 always carry `Lower` (弱) or `Upper` (強).
 *
 * The discriminated union enforces this at compile time.
 */
export type Shindo =
  | { level: 0 | 1 | 2 | 3 | 4 | 7 }
  | { level: 5 | 6; band: Band };

/** Convert a structured `Shindo` to the ×10 sortable rank used elsewhere. */
export function shindoToScaled(s: Shindo): ShindoScaled {
  if (s.level === 5 || s.level === 6) {
    const base = s.level * 10;
    return (s.band === "Upper" ? base + 5 : base) as ShindoScaled;
  }
  return (s.level * 10) as ShindoScaled;
}

/** Convert a ×10 scaled value to the structured form, or null on invalid input. */
export function scaledToShindo(scaled: number | null | undefined): Shindo | null {
  if (scaled == null) return null;
  switch (scaled) {
    case 0:
      return { level: 0 };
    case 10:
      return { level: 1 };
    case 20:
      return { level: 2 };
    case 30:
      return { level: 3 };
    case 40:
      return { level: 4 };
    case 50:
      return { level: 5, band: "Lower" };
    case 55:
      return { level: 5, band: "Upper" };
    case 60:
      return { level: 6, band: "Lower" };
    case 65:
      return { level: 6, band: "Upper" };
    case 70:
      return { level: 7 };
    default:
      return null;
  }
}

/** Parse a JMA shindo string directly into the structured form. */
export function parseShindoStructured(raw: string | null | undefined): Shindo | null {
  return scaledToShindo(parseShindo(raw));
}

/** Structured version of `meetsThreshold` — same semantics, type-safe inputs. */
export function meetsThresholdStructured(
  observed: Shindo | null,
  threshold: Shindo,
): boolean {
  if (observed == null) return false;
  return shindoToScaled(observed) >= shindoToScaled(threshold);
}
