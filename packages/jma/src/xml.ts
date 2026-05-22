/**
 * Shared XML parser configuration and small helpers.
 *
 * JMAXML uses XML namespaces extensively. fast-xml-parser is configured to
 * preserve prefixes (e.g. `jmx_eb:Coordinate`), so consumers must fall back
 * across both prefixed and unprefixed forms when reading nodes.
 */

import { XMLParser } from "fast-xml-parser";

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
});

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * fast-xml-parser returns either a string (text-only node) or an object with
 * `#text` (when the node has attributes or children). Normalize to string.
 */
export function readJmxText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj["#text"] === "number") return String(obj["#text"]);
  }
  return String(v);
}

/** Read a numeric child, returning null on missing/unparseable. */
export function readJmxNumber(v: unknown): number | null {
  const s = readJmxText(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Look up a node under one or both namespace-prefixed and unprefixed names. */
export function pick<T = unknown>(node: any, ...keys: string[]): T | undefined {
  if (node == null || typeof node !== "object") return undefined;
  for (const k of keys) {
    if (node[k] !== undefined) return node[k] as T;
  }
  return undefined;
}
