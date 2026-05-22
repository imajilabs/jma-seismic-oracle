import { describe, expect, test } from "bun:test";
import {
  SHINDO_SCALE,
  compareShindo,
  formatShindo,
  meetsThreshold,
  meetsThresholdStructured,
  parseShindo,
  parseShindoStructured,
  scaledToShindo,
  shindoToScaled,
  type Shindo,
} from "../src/shindo.ts";
import { ShindoBcs, serializeShindo } from "../src/shindo-bcs.ts";

describe("parseShindo", () => {
  test("parses every JMA scale value", () => {
    expect(parseShindo("0")).toBe(0);
    expect(parseShindo("1")).toBe(10);
    expect(parseShindo("2")).toBe(20);
    expect(parseShindo("3")).toBe(30);
    expect(parseShindo("4")).toBe(40);
    expect(parseShindo("5-")).toBe(50);
    expect(parseShindo("5+")).toBe(55);
    expect(parseShindo("6-")).toBe(60);
    expect(parseShindo("6+")).toBe(65);
    expect(parseShindo("7")).toBe(70);
  });

  test("accepts the kanji forms", () => {
    expect(parseShindo("5弱")).toBe(50);
    expect(parseShindo("5強")).toBe(55);
    expect(parseShindo("6弱")).toBe(60);
    expect(parseShindo("6強")).toBe(65);
  });

  test("trims whitespace", () => {
    expect(parseShindo("  3  ")).toBe(30);
    expect(parseShindo("\n5+\n")).toBe(55);
  });

  test("returns null for invalid input", () => {
    expect(parseShindo(null)).toBeNull();
    expect(parseShindo(undefined)).toBeNull();
    expect(parseShindo("")).toBeNull();
    expect(parseShindo("不明")).toBeNull();
    expect(parseShindo("8")).toBeNull(); // not a real shindo
    expect(parseShindo("5")).toBeNull(); // ambiguous (could be 5- or 5+)
  });

  test("preserves the 5弱 vs 5強 distinction", () => {
    // Critical for threshold checks: 5弱 is below 5強.
    expect(parseShindo("5-")).toBeLessThan(parseShindo("5+")!);
    expect(parseShindo("6-")).toBeLessThan(parseShindo("6+")!);
  });
});

describe("formatShindo", () => {
  test("round-trips every scale value through parse + format", () => {
    const inputs = ["0", "1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];
    for (const s of inputs) {
      expect(formatShindo(parseShindo(s))).toBe(s);
    }
  });

  test("returns null for unknown scaled values", () => {
    expect(formatShindo(null)).toBeNull();
    expect(formatShindo(undefined)).toBeNull();
    expect(formatShindo(13)).toBeNull(); // not on the scale
    expect(formatShindo(75)).toBeNull();
  });
});

describe("compareShindo", () => {
  test("orders the scale correctly", () => {
    expect(compareShindo(SHINDO_SCALE.S5_LOWER, SHINDO_SCALE.S5_UPPER)).toBeLessThan(0);
    expect(compareShindo(SHINDO_SCALE.S6_UPPER, SHINDO_SCALE.S5_UPPER)).toBeGreaterThan(0);
    expect(compareShindo(SHINDO_SCALE.S7, SHINDO_SCALE.S7)).toBe(0);
  });
});

describe("meetsThreshold", () => {
  test("6- threshold is met by a 6- station reading", () => {
    expect(meetsThreshold(SHINDO_SCALE.S6_LOWER, SHINDO_SCALE.S6_LOWER)).toBe(true);
  });

  test("6- threshold is met by a 6+ station reading", () => {
    expect(meetsThreshold(SHINDO_SCALE.S6_UPPER, SHINDO_SCALE.S6_LOWER)).toBe(true);
  });

  test("6- threshold is NOT met by a 5+ station reading", () => {
    expect(meetsThreshold(SHINDO_SCALE.S5_UPPER, SHINDO_SCALE.S6_LOWER)).toBe(false);
  });

  test("null observed never meets threshold", () => {
    expect(meetsThreshold(null, 0)).toBe(false);
    expect(meetsThreshold(null, SHINDO_SCALE.S6_LOWER)).toBe(false);
  });
});

describe("structured Shindo (mirrors on-chain jma_seismic_oracle::shindo::Shindo)", () => {
  test("shindoToScaled produces the same ×10 rank for every level/band", () => {
    expect(shindoToScaled({ level: 0 })).toBe(0);
    expect(shindoToScaled({ level: 1 })).toBe(10);
    expect(shindoToScaled({ level: 2 })).toBe(20);
    expect(shindoToScaled({ level: 3 })).toBe(30);
    expect(shindoToScaled({ level: 4 })).toBe(40);
    expect(shindoToScaled({ level: 5, band: "Lower" })).toBe(50);
    expect(shindoToScaled({ level: 5, band: "Upper" })).toBe(55);
    expect(shindoToScaled({ level: 6, band: "Lower" })).toBe(60);
    expect(shindoToScaled({ level: 6, band: "Upper" })).toBe(65);
    expect(shindoToScaled({ level: 7 })).toBe(70);
  });

  test("scaledToShindo + shindoToScaled round-trips every JMA value", () => {
    const cases = [
      SHINDO_SCALE.S0,
      SHINDO_SCALE.S1,
      SHINDO_SCALE.S2,
      SHINDO_SCALE.S3,
      SHINDO_SCALE.S4,
      SHINDO_SCALE.S5_LOWER,
      SHINDO_SCALE.S5_UPPER,
      SHINDO_SCALE.S6_LOWER,
      SHINDO_SCALE.S6_UPPER,
      SHINDO_SCALE.S7,
    ];
    for (const c of cases) {
      const structured = scaledToShindo(c);
      expect(structured).not.toBeNull();
      expect(shindoToScaled(structured!)).toBe(c);
    }
  });

  test("scaledToShindo returns null for invalid input", () => {
    expect(scaledToShindo(null)).toBeNull();
    expect(scaledToShindo(undefined)).toBeNull();
    expect(scaledToShindo(33)).toBeNull();
    expect(scaledToShindo(80)).toBeNull();
  });

  test("parseShindoStructured: JMA string → structured", () => {
    expect(parseShindoStructured("3")).toEqual({ level: 3 });
    expect(parseShindoStructured("5-")).toEqual({ level: 5, band: "Lower" });
    expect(parseShindoStructured("5+")).toEqual({ level: 5, band: "Upper" });
    expect(parseShindoStructured("6弱")).toEqual({ level: 6, band: "Lower" });
    expect(parseShindoStructured("7")).toEqual({ level: 7 });
    expect(parseShindoStructured("不明")).toBeNull();
  });

  test("meetsThresholdStructured preserves the 5弱/5強 distinction", () => {
    const s5_lower: Shindo = { level: 5, band: "Lower" };
    const s5_upper: Shindo = { level: 5, band: "Upper" };

    // 5強 meets 5弱
    expect(meetsThresholdStructured(s5_upper, s5_lower)).toBe(true);
    // 5弱 does NOT meet 5強
    expect(meetsThresholdStructured(s5_lower, s5_upper)).toBe(false);
  });
});

describe("Shindo BCS round-trip — must byte-for-byte match Move encoding", () => {
  test("level 3 (whole) serializes to [3, 0]", () => {
    const bytes = serializeShindo({ level: 3 });
    // BCS: [level u8, band Option tag u8 (0=None)]
    expect(Array.from(bytes)).toEqual([3, 0]);
  });

  test("level 5 Lower serializes to [5, 1, 0]", () => {
    const bytes = serializeShindo({ level: 5, band: "Lower" });
    // BCS: [level u8, Option tag (1=Some), enum tag (0=Lower)]
    expect(Array.from(bytes)).toEqual([5, 1, 0]);
  });

  test("level 5 Upper serializes to [5, 1, 1]", () => {
    const bytes = serializeShindo({ level: 5, band: "Upper" });
    expect(Array.from(bytes)).toEqual([5, 1, 1]);
  });

  test("level 6 Lower serializes to [6, 1, 0]", () => {
    const bytes = serializeShindo({ level: 6, band: "Lower" });
    expect(Array.from(bytes)).toEqual([6, 1, 0]);
  });

  test("level 7 (whole) serializes to [7, 0]", () => {
    const bytes = serializeShindo({ level: 7 });
    expect(Array.from(bytes)).toEqual([7, 0]);
  });

  test("ShindoBcs.parse round-trips every JMA value", () => {
    const cases: Shindo[] = [
      { level: 0 },
      { level: 4 },
      { level: 5, band: "Lower" },
      { level: 5, band: "Upper" },
      { level: 6, band: "Lower" },
      { level: 6, band: "Upper" },
      { level: 7 },
    ];
    for (const c of cases) {
      const bytes = serializeShindo(c);
      const parsed = ShindoBcs.parse(bytes);
      expect(parsed.level).toBe(c.level);
      if ("band" in c) {
        expect(parsed.band).not.toBeNull();
        expect(Object.keys(parsed.band!)[0]).toBe(c.band);
      } else {
        expect(parsed.band).toBeNull();
      }
    }
  });
});
