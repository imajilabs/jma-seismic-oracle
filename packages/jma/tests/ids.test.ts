import { describe, expect, test } from "bun:test";
import {
  JMA_DATA_BASE,
  REPORT_ID_PATTERN,
  asReportId,
  isReportId,
  reportIdToUrl,
  reportKindFromId,
  urlToReportId,
} from "../src/ids.ts";
import type { ReportId } from "../src/types.ts";

const VALID_VXSE53 = "20260426224826_0_VXSE53_010000" as ReportId;
const VALID_VXSE54 = "20260426224826_0_VXSE54_010000" as ReportId;
const VALID_HIGHER_SERIAL = "20260426224826_12_VXSE53_010000" as ReportId;

describe("isReportId", () => {
  test("accepts canonical JMA filenames", () => {
    expect(isReportId(VALID_VXSE53)).toBe(true);
    expect(isReportId(VALID_VXSE54)).toBe(true);
    expect(isReportId(VALID_HIGHER_SERIAL)).toBe(true);
  });

  test("rejects malformed ids", () => {
    // would be SSRF vectors if accepted
    expect(isReportId("../../etc/passwd")).toBe(false);
    expect(isReportId("http://evil.example/x")).toBe(false);
    expect(isReportId("20260426_VXSE53_010000")).toBe(false);
    expect(isReportId(`${VALID_VXSE53}.xml`)).toBe(false);
    expect(isReportId(`${VALID_VXSE53}/extra`)).toBe(false);
    expect(isReportId("")).toBe(false);
    expect(isReportId("20260426224826_0_vxse53_010000")).toBe(false); // lowercase
    expect(isReportId("20260426224826_0_VXSE5_010000")).toBe(false); // wrong type length
  });
});

describe("asReportId", () => {
  test("returns the branded type when valid", () => {
    expect(asReportId(VALID_VXSE53)).toBe(VALID_VXSE53);
  });

  test("throws on invalid input", () => {
    expect(() => asReportId("nope")).toThrow(/invalid reportId/);
  });
});

describe("reportIdToUrl", () => {
  test("constructs the canonical JMA URL", () => {
    expect(reportIdToUrl(VALID_VXSE53)).toBe(`${JMA_DATA_BASE}${VALID_VXSE53}.xml`);
  });

  test("rejects ids that don't match the pattern (SSRF prevention)", () => {
    expect(() => reportIdToUrl("../../passwd")).toThrow();
    expect(() => reportIdToUrl("https://evil.example/foo")).toThrow();
  });
});

describe("urlToReportId", () => {
  test("round-trips a canonical id", () => {
    const url = reportIdToUrl(VALID_VXSE53);
    expect(urlToReportId(url)).toBe(VALID_VXSE53);
  });

  test("returns null for non-JMA urls", () => {
    expect(urlToReportId("https://example.com/foo.xml")).toBeNull();
    expect(urlToReportId("not a url")).toBeNull();
  });

  test("returns null for JMA urls that don't match the pattern", () => {
    expect(urlToReportId(`${JMA_DATA_BASE}garbage.xml`)).toBeNull();
    expect(urlToReportId(`${JMA_DATA_BASE}${VALID_VXSE53}.txt`)).toBeNull();
    expect(urlToReportId(JMA_DATA_BASE)).toBeNull();
  });
});

describe("reportKindFromId", () => {
  test("extracts the type code", () => {
    expect(reportKindFromId(VALID_VXSE53)).toBe("VXSE53");
    expect(reportKindFromId(VALID_VXSE54)).toBe("VXSE54");
    expect(reportKindFromId("20260427050037_0_VFVO53_010000")).toBe("VFVO53");
  });

  test("returns null on malformed input", () => {
    expect(reportKindFromId("garbage")).toBeNull();
  });
});

describe("REPORT_ID_PATTERN", () => {
  test("regex source is documented and stable", () => {
    expect(REPORT_ID_PATTERN.source).toBe("^[0-9]{14}_[0-9]+_[A-Z]{4}[0-9]{2}_[0-9]{6}$");
  });
});
