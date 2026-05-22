import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeed } from "../src/feed.ts";

const FIXTURES = join(import.meta.dir, "__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("parseFeed — eqvol Atom feed snapshot", () => {
  const xml = loadFixture("feed_eqvol_snapshot.xml");
  const entries = parseFeed(xml);

  test("parses every <entry> in the feed", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  test("every entry has the basic Atom fields", () => {
    for (const e of entries) {
      expect(e.id).toMatch(/^https?:\/\//);
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.updated).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof e.link).toBe("string");
    }
  });

  test("classifies VXSE53 entries when present", () => {
    const v53 = entries.filter((e) => e.reportKind === "VXSE53");
    // The snapshot was captured from the live feed, but it always contains
    // some recent earthquake activity, so we can assert at least one VXSE53.
    expect(v53.length).toBeGreaterThan(0);
    for (const e of v53) {
      expect(e.title).toMatch(/震源・震度/);
      expect(e.reportId).not.toBeNull();
      expect(e.reportId).toMatch(/_VXSE53_/);
    }
  });

  test("derives a reportId from the link for entries that point at JMA data files", () => {
    const dataEntries = entries.filter((e) =>
      e.link.startsWith("https://www.data.jma.go.jp/developer/xml/data/"),
    );
    for (const e of dataEntries) {
      expect(e.reportId).not.toBeNull();
      expect(e.reportId).toMatch(/^[0-9]{14}_[0-9]+_[A-Z]{4}[0-9]{2}_[0-9]{6}$/);
    }
  });

  test("sets reportId to null for non-data links", () => {
    const nonDataEntries = entries.filter(
      (e) => !e.link.startsWith("https://www.data.jma.go.jp/developer/xml/data/"),
    );
    for (const e of nonDataEntries) {
      expect(e.reportId).toBeNull();
    }
  });

  test("rejects malformed feed XML rather than silently returning []", () => {
    expect(() => parseFeed("<not-a-feed/>")).toThrow();
  });
});
