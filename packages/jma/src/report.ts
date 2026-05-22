/**
 * Parse JMAXML earthquake reports into typed objects.
 *
 * Currently supports:
 *   - VXSE53 — 震源・震度に関する情報
 *   - VXSE54 — 推計震度分布図 (parsed if present, but JMA doesn't publish this
 *     on the free public Atom feed)
 *
 * Anything else returns a typed `UnknownReport` carrying what little metadata
 * we could extract.
 */

import type { BlobSource } from "./blob-source.ts";
import { classifyTitle } from "./classify.ts";
import { parseJmaCoordinate } from "./coordinate.ts";
import { reportIdToUrl } from "./ids.ts";
import { parseShindo } from "./shindo.ts";
import type {
  AreaObservation,
  Hypocenter,
  ParsedReport,
  ReportId,
  ReportKind,
  ReportMeta,
  StationObservation,
  Vxse53Report,
  Vxse54Report,
} from "./types.ts";
import { asArray, pick, readJmxNumber, readJmxText, xmlParser } from "./xml.ts";

const USER_AGENT = "jma-seismic-oracle/0.1 (+https://github.com/imajilabs/jma-seismic-oracle)";

export interface FetchReportResult {
  rawXml: string;
  parsed: ParsedReport;
}

/** Fetch a JMA report by canonical report id. */
export async function fetchReportById(reportId: ReportId | string): Promise<FetchReportResult> {
  const url = reportIdToUrl(reportId);
  return fetchReportByUrl(url);
}

/**
 * Fetch a JMA report from a fully-qualified URL.
 *
 * SECURITY: this trusts the TLS path to the URL. In production the oracle signer
 * should NOT use this — use `fetchReportByBlobId` against a Walrus BlobSource
 * so integrity is content-verified by the Walrus blob-id encoding rather than
 * transport-trusted. This direct path is for the scraper service and for
 * development/debugging only.
 */
export async function fetchReportByUrl(url: string): Promise<FetchReportResult> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/xml" },
  });
  if (!res.ok) {
    throw new Error(`JMA report fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const rawXml = await res.text();
  return { rawXml, parsed: parseReport(rawXml) };
}

/**
 * Fetch a JMA report from a content-addressed BlobSource (typically Walrus),
 * then parse.
 *
 * This is the primary path for a constrained oracle signer: the on-chain
 * TriggerAttestation carries `source_xml_blob` (the Walrus blob id). The
 * signer fetches by that id from a `BlobSource`; Walrus's read
 * protocol verifies the returned bytes against the id natively, so any
 * MITM or storage-node tampering is rejected before we ever parse.
 *
 * In tests this is paired with `InMemoryBlobSource`; the integrity check
 * lives at the Walrus encode/decode boundary, not in the SDK.
 */
export async function fetchReportByBlobId(
  source: BlobSource,
  blobId: string,
): Promise<FetchReportResult> {
  const bytes = await source.fetch(blobId);
  const rawXml = new TextDecoder("utf-8").decode(bytes);
  return { rawXml, parsed: parseReport(rawXml) };
}

/** Parse a JMAXML report from a raw XML string. Pure function — no network. */
export function parseReport(xml: string): ParsedReport {
  const doc = xmlParser.parse(xml);
  const root = pick<any>(doc, "Report", "jmx:Report");
  if (!root) {
    return { reportKind: "UNKNOWN", inferredKind: "OTHER", meta: {} };
  }

  const control = pick<any>(root, "Control", "jmx:Control");
  const head = pick<any>(root, "Head", "jmx:Head");
  const body = pick<any>(root, "Body", "jmx:Body");

  const controlTitle = readJmxText(pick(control, "Title"));
  const headTitle = readJmxText(pick(head, "Title"));
  const reportKind = classifyTitle(controlTitle || headTitle);

  const meta: ReportMeta = {
    eventId: readJmxText(pick(head, "EventID", "jmx_eb:EventID") ?? pick(control, "EventID")),
    serial: readJmxNumber(pick(head, "Serial") ?? pick(control, "Serial")),
    reportDateTime: readJmxText(
      pick(head, "ReportDateTime") ?? pick(control, "DateTime"),
    ),
    status: readJmxText(pick(control, "Status")) || null,
    infoType: readJmxText(pick(head, "InfoType")) || null,
    editorialOffice: readJmxText(pick(control, "EditorialOffice")) || null,
    publishingOffice: readJmxText(pick(control, "PublishingOffice")) || null,
  };

  switch (reportKind) {
    case "VXSE53":
      return parseVxse53(body, meta);
    case "VXSE54":
      return parseVxse54(body, meta);
    default:
      return {
        reportKind: "UNKNOWN",
        inferredKind: reportKind,
        meta,
      };
  }
}

// ─── VXSE53 ───────────────────────────────────────────────────────────────

function parseVxse53(body: any, meta: ReportMeta): Vxse53Report {
  const earthquake = pick<any>(body, "Earthquake", "jmx_eb:Earthquake");
  const hypocenter = readHypocenter(earthquake);
  const hypocenterArea = pick<any>(
    pick<any>(earthquake, "Hypocenter", "jmx_eb:Hypocenter"),
    "Area",
    "jmx_eb:Area",
  );
  const hypocenterName = readJmxText(pick(hypocenterArea, "Name", "jmx_eb:Name")) || null;

  const intensity = pick<any>(body, "Intensity");
  const observation = pick<any>(intensity, "Observation");
  const maxShindo = readJmxText(pick(observation, "MaxInt")) || null;
  const maxShindoScaled = parseShindo(maxShindo);

  const areaObservations: AreaObservation[] = [];
  const stationObservations: StationObservation[] = [];

  for (const pref of asArray<any>(pick(observation, "Pref"))) {
    for (const area of asArray<any>(pick(pref, "Area"))) {
      const areaShindo = readJmxText(pick(area, "MaxInt"));
      areaObservations.push({
        areaCode: readJmxText(pick(area, "Code")),
        areaName: readJmxText(pick(area, "Name")),
        shindo: areaShindo,
        shindoScaled: parseShindo(areaShindo) ?? -1,
      });

      for (const stationGroup of asArray<any>(pick(area, "City"))) {
        for (const st of asArray<any>(pick(stationGroup, "IntensityStation", "Station"))) {
          const stShindo = readJmxText(pick(st, "Int"));
          stationObservations.push({
            stationCode: readJmxText(pick(st, "Code")),
            stationName: readJmxText(pick(st, "Name")),
            shindo: stShindo,
            shindoScaled: parseShindo(stShindo) ?? -1,
          });
        }
      }
    }
  }

  return {
    reportKind: "VXSE53",
    meta,
    originDateTime: readJmxText(pick(earthquake, "OriginTime")) || null,
    arrivalDateTime: readJmxText(pick(earthquake, "ArrivalTime")) || null,
    hypocenter,
    hypocenterName,
    maxShindo,
    maxShindoScaled,
    areaObservations,
    stationObservations,
  };
}

// ─── VXSE54 ───────────────────────────────────────────────────────────────

function parseVxse54(body: any, meta: ReportMeta): Vxse54Report {
  const earthquake = pick<any>(body, "Earthquake", "jmx_eb:Earthquake");
  const hypocenter = readHypocenter(earthquake);

  const intensity = pick<any>(body, "Intensity");
  const maxShindo = readJmxText(pick(pick<any>(intensity, "Observation"), "MaxInt")) || null;
  const distNode = pick<any>(
    intensity,
    "EstShindoDistribution",
    "jmx_eb:EstShindoDistribution",
  ) ?? pick<any>(body, "EstShindoDistribution");

  let meshPayload: string | null = null;
  let meshPayloadKind: string | null = null;
  if (distNode != null) {
    if (typeof distNode === "string") {
      meshPayload = distNode;
    } else if (typeof distNode === "object") {
      const obj = distNode as Record<string, unknown>;
      meshPayload = typeof obj["#text"] === "string" ? (obj["#text"] as string) : null;
      meshPayloadKind =
        (obj["@_codeType"] as string | undefined) ??
        (obj["@_type"] as string | undefined) ??
        null;
    }
  }

  return {
    reportKind: "VXSE54",
    meta,
    originDateTime: readJmxText(pick(earthquake, "OriginTime")) || null,
    hypocenter,
    maxShindo,
    maxShindoScaled: parseShindo(maxShindo),
    meshPayload,
    meshPayloadKind,
  };
}

// ─── shared ───────────────────────────────────────────────────────────────

function readHypocenter(earthquake: any): Hypocenter | null {
  if (earthquake == null) return null;
  const hypocenter = pick<any>(earthquake, "Hypocenter", "jmx_eb:Hypocenter");
  const area = pick<any>(hypocenter, "Area", "jmx_eb:Area");
  const coordRaw = pick<any>(area, "Coordinate", "jmx_eb:Coordinate");
  const coordText =
    typeof coordRaw === "string" ? coordRaw : readJmxText(coordRaw);
  const fromCoord = parseJmaCoordinate(coordText);

  const magNode = pick<any>(earthquake, "Magnitude", "jmx_eb:Magnitude");
  const magnitude = magNode != null ? readJmxNumber(magNode) : null;

  if (fromCoord == null && magnitude == null) return null;
  if (fromCoord == null) {
    return { latitude: NaN, longitude: NaN, depthKm: null, magnitude };
  }
  return { ...fromCoord, magnitude };
}
