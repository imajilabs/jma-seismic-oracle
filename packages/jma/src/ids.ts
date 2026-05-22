/**
 * JMA report id <-> URL helpers.
 *
 * Every JMA XML report has a canonical filename of the form:
 *   {YYYYMMDDHHMMSS}_{n}_{TYPE}_{area}.xml
 *
 * e.g. 20260426224826_0_VXSE53_010000.xml
 *
 * We use the basename (without ".xml") as the public id. This gives us a
 * single immutable identifier we can pass over HTTP, store in logs, and use
 * to dedupe attestations off-chain. SSRF risk is eliminated: only strings
 * matching this exact pattern can be turned into a URL.
 */

import type { ReportId } from "./types.ts";

export const JMA_DATA_BASE = "https://www.data.jma.go.jp/developer/xml/data/";

export const REPORT_ID_PATTERN = /^[0-9]{14}_[0-9]+_[A-Z]{4}[0-9]{2}_[0-9]{6}$/;

export function isReportId(raw: string): raw is ReportId {
  return REPORT_ID_PATTERN.test(raw);
}

export function asReportId(raw: string): ReportId {
  if (!REPORT_ID_PATTERN.test(raw)) {
    throw new Error(`invalid reportId: ${raw}`);
  }
  return raw as ReportId;
}

export function reportIdToUrl(reportId: ReportId | string): string {
  if (!REPORT_ID_PATTERN.test(reportId)) {
    throw new Error(`invalid reportId: ${reportId}`);
  }
  return `${JMA_DATA_BASE}${reportId}.xml`;
}

export function urlToReportId(url: string): ReportId | null {
  if (!url.startsWith(JMA_DATA_BASE)) return null;
  const tail = url.slice(JMA_DATA_BASE.length);
  if (!tail.endsWith(".xml")) return null;
  const id = tail.slice(0, -4);
  return REPORT_ID_PATTERN.test(id) ? (id as ReportId) : null;
}

/** Extract the report kind code from a reportId. e.g. "VXSE53". */
export function reportKindFromId(reportId: string): string | null {
  const m = reportId.match(/^[0-9]{14}_[0-9]+_([A-Z]{4}[0-9]{2})_/);
  return m?.[1] ?? null;
}
