import { describe, expect, test } from "bun:test";
import { parseJmaCoordinate } from "../src/coordinate.ts";

describe("parseJmaCoordinate", () => {
  test("parses a typical Tōhoku-region coordinate with depth", () => {
    const c = parseJmaCoordinate("+38.1+142.9-30000/");
    expect(c).not.toBeNull();
    expect(c!.latitude).toBe(38.1);
    expect(c!.longitude).toBe(142.9);
    expect(c!.depthKm).toBe(30);
  });

  test("parses the Nagano fixture coordinate", () => {
    // From the actual VXSE53 we ingested: +36.6+137.9-10000/
    const c = parseJmaCoordinate("+36.6+137.9-10000/");
    expect(c).not.toBeNull();
    expect(c!.latitude).toBe(36.6);
    expect(c!.longitude).toBe(137.9);
    expect(c!.depthKm).toBe(10);
  });

  test("handles depth omitted", () => {
    const c = parseJmaCoordinate("+35.6+139.7/");
    expect(c).not.toBeNull();
    expect(c!.latitude).toBe(35.6);
    expect(c!.longitude).toBe(139.7);
    expect(c!.depthKm).toBeNull();
  });

  test("handles negative depth sign by taking absolute value", () => {
    // JMA encodes depth as negative meters; we report absolute km.
    expect(parseJmaCoordinate("+35.0+135.0-50000/")?.depthKm).toBe(50);
  });

  test("returns null on garbage", () => {
    expect(parseJmaCoordinate(null)).toBeNull();
    expect(parseJmaCoordinate(undefined)).toBeNull();
    expect(parseJmaCoordinate("")).toBeNull();
    expect(parseJmaCoordinate("not-a-coord")).toBeNull();
  });

  test("magnitude is always null on a coordinate-only parse", () => {
    // Magnitude lives on a sibling element, not the coordinate string.
    expect(parseJmaCoordinate("+36.6+137.9-10000/")?.magnitude).toBeNull();
  });
});
