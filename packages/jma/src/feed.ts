/**
 * JMA Atom feed access.
 *
 * JMA publishes earthquake/volcano-related XML reports on two Atom feeds:
 *   - eqvol.xml      — recent / "high frequency" window
 *   - eqvol_l.xml    — extended (long) window
 *
 * The feeds list each report's URL; consumers call the report module to
 * actually parse a specific report.
 */

import { classifyTitle } from "./classify.ts";
import { urlToReportId } from "./ids.ts";
import type { FeedEntry } from "./types.ts";
import { asArray, readJmxText, xmlParser } from "./xml.ts";

export const JMA_FEED_REGULAR = "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml";
export const JMA_FEED_LONG = "https://www.data.jma.go.jp/developer/xml/feed/eqvol_l.xml";

const USER_AGENT = "jma-seismic-oracle/0.1 (+https://github.com/imajilabs/jma-seismic-oracle)";

export interface FetchFeedResult {
  rawXml: string;
  entries: FeedEntry[];
}

export async function fetchFeed(url: string = JMA_FEED_REGULAR): Promise<FetchFeedResult> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/atom+xml, application/xml" },
  });
  if (!res.ok) {
    throw new Error(`JMA feed fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const rawXml = await res.text();
  return { rawXml, entries: parseFeed(rawXml) };
}

/** Parse an Atom feed XML string into typed `FeedEntry`s. Pure function. */
export function parseFeed(xml: string): FeedEntry[] {
  const doc = xmlParser.parse(xml);
  const feed = doc?.feed;
  if (!feed) {
    throw new Error("Atom feed missing <feed> root element");
  }
  return asArray<any>(feed.entry).map(toFeedEntry);
}

function toFeedEntry(e: any): FeedEntry {
  const title = readJmxText(e?.title);
  const links = asArray<any>(e?.link);
  const link =
    links.find((l) => l?.["@_type"] === "application/xml")?.["@_href"] ??
    links[0]?.["@_href"] ??
    "";
  const author = readJmxText(e?.author?.name);
  return {
    id: readJmxText(e?.id),
    title,
    updated: readJmxText(e?.updated),
    author,
    link,
    reportId: urlToReportId(link),
    reportKind: classifyTitle(title),
  };
}
