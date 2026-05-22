/**
 * Public types for the @imajilabs/jma-seismic-oracle SDK.
 *
 * Stable shapes — these are consumed by:
 *   - the oracle signer (production trigger ingestion)
 *   - the jma-seismic-oracle dev API (services/jma-ingest)
 *   - the on-chain attestation payload schema (TriggerAttestation)
 *   - any external developer building on the jma-seismic-oracle trigger feed
 *
 * Convention: all timestamps are ISO 8601 strings preserved verbatim from JMA.
 * JMA emits both UTC ("...Z") and JST ("+09:00") forms; we don't normalize on
 * input. Consumers can normalize at the boundary if needed.
 */

/** JMA report type code, e.g. VXSE53 = 震源・震度に関する情報. */
export type ReportKind =
  | "VXSE51" // 震度速報
  | "VXSE52" // 震源に関する情報
  | "VXSE53" // 震源・震度に関する情報
  | "VXSE54" // 推計震度分布図 (paid feeds only)
  | "VXSE61" // 顕著な地震の震源要素更新のお知らせ
  | "VXSE62" // 長周期地震動に関する観測情報
  | "VTSE41" // 津波警報・注意報・予報
  | "VTSE51" // 津波情報
  | "OTHER";

/** Canonical JMA report basename: {YYYYMMDDHHMMSS}_{n}_{TYPE}_{area}. */
export type ReportId = string & { readonly __brand: "ReportId" };

/** A single entry in JMA's eqvol Atom feed. */
export interface FeedEntry {
  /** Atom <id>, the canonical entry identifier (a URI). */
  id: string;
  /** Atom <title>, the human-readable report kind in Japanese. */
  title: string;
  /** Atom <updated>, ISO 8601 timestamp. */
  updated: string;
  /** <author><name>, e.g. "気象庁". */
  author: string;
  /** Direct URL to the underlying XML report. */
  link: string;
  /** Parsed report id if `link` matches the canonical JMA data URL pattern, else null. */
  reportId: ReportId | null;
  /** Classified report type. Falls back to "OTHER" for non-earthquake/tsunami types. */
  reportKind: ReportKind;
}

/** Decimal-degree hypocenter as parsed from `<jmx_eb:Coordinate>`. */
export interface Hypocenter {
  /** Signed decimal degrees, north positive. */
  latitude: number;
  /** Signed decimal degrees, east positive. */
  longitude: number;
  /** Depth in kilometers (positive). null if JMA omitted depth. */
  depthKm: number | null;
  /** Magnitude on JMA's Mj scale, or null if not provided. */
  magnitude: number | null;
}

/** Per-station shindo observation. */
export interface StationObservation {
  /** JMA station code. */
  stationCode: string;
  /** Display name in Japanese. May contain "＊" suffix indicating non-JMA station. */
  stationName: string;
  /** JMA shindo as raw label, e.g. "3", "5+", "5-", "6-", "6+", "7". */
  shindo: string;
  /** Normalized shindo on the integer scale (×10): see `shindo.ts`. */
  shindoScaled: number;
}

/** Per-area aggregated shindo observation (一次細分区域 level — JMA code, ~190 nationwide). */
export interface AreaObservation {
  /** JMA area code (3 digits, e.g. "420" = 長野県北部). */
  areaCode: string;
  /** Display name. */
  areaName: string;
  /** Max shindo string in this area. */
  shindo: string;
  /** Normalized shindo on the integer scale. */
  shindoScaled: number;
}

/** Common metadata across all report types. */
export interface ReportMeta {
  /** JMA EventID — opaque string, but currently `YYYYMMDDhhmmss` of the origin. */
  eventId: string;
  /** Report serial number; increments on revision. null if missing. */
  serial: number | null;
  /** ReportDateTime / Control DateTime as a single ISO timestamp. */
  reportDateTime: string;
  /** ControlStatus (通常 / 訓練 / 試験). */
  status: string | null;
  /** InfoType (発表 / 訂正 / 取消). */
  infoType: string | null;
  /** Editorial office, e.g. "気象庁本庁". */
  editorialOffice: string | null;
  /** Publishing office, e.g. "気象庁". */
  publishingOffice: string | null;
}

/** VXSE53 — 震源・震度に関する情報. */
export interface Vxse53Report {
  reportKind: "VXSE53";
  meta: ReportMeta;
  /** Earthquake origin time. */
  originDateTime: string | null;
  /** Time the shaking arrived at the seismometer (rounded). */
  arrivalDateTime: string | null;
  /** Hypocenter location and magnitude. May be null for partially-reported events. */
  hypocenter: Hypocenter | null;
  /** Geographic name of the hypocenter region. */
  hypocenterName: string | null;
  /** Maximum observed shindo in the report (raw JMA string). */
  maxShindo: string | null;
  /** Maximum observed shindo on the normalized integer scale. */
  maxShindoScaled: number | null;
  /** Per-area aggregated observations (一次細分区域 level). */
  areaObservations: AreaObservation[];
  /** Per-station observations. */
  stationObservations: StationObservation[];
}

/**
 * VXSE54 — 推計震度分布図.
 *
 * NOTE: VXSE54 is only published via JMA's paid redistribution channels, not
 * the public Atom feed. This shape is reserved for when such a source is wired up.
 */
export interface Vxse54Report {
  reportKind: "VXSE54";
  meta: ReportMeta;
  originDateTime: string | null;
  hypocenter: Hypocenter | null;
  maxShindo: string | null;
  maxShindoScaled: number | null;
  /** Raw payload from `<jmx_eb:EstShindoDistribution>` — typically a packed mesh encoding. */
  meshPayload: string | null;
  meshPayloadKind: string | null;
}

/** Anything we recognize as an earthquake/tsunami report but don't yet model. */
export interface UnknownReport {
  reportKind: "UNKNOWN";
  /** The classified kind we *think* it is, even though we don't have a typed parser. */
  inferredKind: ReportKind;
  meta: Partial<ReportMeta>;
}

export type ParsedReport = Vxse53Report | Vxse54Report | UnknownReport;
