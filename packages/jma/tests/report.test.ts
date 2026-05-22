import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseReport } from "../src/report.ts";
import type { Vxse53Report } from "../src/types.ts";

const FIXTURES = join(import.meta.dir, "__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("parseReport — VXSE53 (Nagano 2026-04-27 fixture)", () => {
  const xml = loadFixture("vxse53_nagano_20260427.xml");
  const report = parseReport(xml);

  test("classifies as VXSE53", () => {
    expect(report.reportKind).toBe("VXSE53");
  });

  test("extracts canonical event metadata", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    expect(report.meta.eventId).toBe("20260427074516");
    expect(report.meta.serial).toBe(1);
    expect(report.meta.status).toBe("通常");
    expect(report.meta.infoType).toBe("発表");
    expect(report.meta.publishingOffice).toBe("気象庁");
  });

  test("extracts hypocenter with coordinate, depth, and magnitude", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    expect(report.hypocenter).not.toBeNull();
    expect(report.hypocenter!.latitude).toBe(36.6);
    expect(report.hypocenter!.longitude).toBe(137.9);
    expect(report.hypocenter!.depthKm).toBe(10);
    expect(report.hypocenter!.magnitude).toBe(3.2);
    expect(report.hypocenterName).toBe("長野県北部");
  });

  test("normalizes max shindo to the integer scale", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    expect(report.maxShindo).toBe("3");
    expect(report.maxShindoScaled).toBe(30);
  });

  test("collects area observations with normalized shindo", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    const nagano_north = report.areaObservations.find((a) => a.areaCode === "420");
    expect(nagano_north).toBeDefined();
    expect(nagano_north!.areaName).toBe("長野県北部");
    expect(nagano_north!.shindo).toBe("3");
    expect(nagano_north!.shindoScaled).toBe(30);

    const nagano_central = report.areaObservations.find((a) => a.areaCode === "421");
    expect(nagano_central).toBeDefined();
    expect(nagano_central!.shindoScaled).toBe(10);
  });

  test("collects all 18 station observations", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    expect(report.stationObservations.length).toBe(18);
  });

  test("station observations include the highest-shindo reading", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    const omachi = report.stationObservations.find(
      (s) => s.stationName === "大町市役所",
    );
    expect(omachi).toBeDefined();
    expect(omachi!.shindo).toBe("3");
    expect(omachi!.shindoScaled).toBe(30);
  });

  test("station observations preserve the JMA non-JMA marker (＊)", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    const annotated = report.stationObservations.filter((s) => s.stationName.includes("＊"));
    expect(annotated.length).toBeGreaterThan(0);
  });

  test("the maximum station shindo equals the report-level max", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    const maxStation = Math.max(...report.stationObservations.map((s) => s.shindoScaled));
    expect(maxStation).toBe(report.maxShindoScaled!);
  });

  test("event timestamps are preserved verbatim from JMA", () => {
    expect(report.reportKind).toBe("VXSE53");
    if (report.reportKind !== "VXSE53") return;
    expect(report.originDateTime).toBe("2026-04-27T07:45:00+09:00");
    expect(report.meta.reportDateTime).toBe("2026-04-27T07:48:00+09:00");
  });
});

describe("parseReport — error handling", () => {
  test("returns UNKNOWN for non-Report XML", () => {
    const result = parseReport("<root><foo>bar</foo></root>");
    expect(result.reportKind).toBe("UNKNOWN");
  });

  test("returns UNKNOWN on garbage input rather than throwing", () => {
    const result = parseReport("not xml at all");
    expect(result.reportKind).toBe("UNKNOWN");
  });
});

describe("parseReport — typing", () => {
  test("Vxse53Report shape is consistent with the SDK type", () => {
    const xml = loadFixture("vxse53_nagano_20260427.xml");
    const r = parseReport(xml);
    expect(r.reportKind).toBe("VXSE53");
    if (r.reportKind === "VXSE53") {
      // Compile-time check via assignment
      const typed: Vxse53Report = r;
      expect(typed.areaObservations).toBeInstanceOf(Array);
      expect(typed.stationObservations).toBeInstanceOf(Array);
    }
  });
});
