import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BlobNotFoundError,
  InMemoryBlobSource,
} from "../src/blob-source.ts";
import { fetchReportByBlobId } from "../src/report.ts";

const FIXTURES = join(import.meta.dir, "__fixtures__");

function loadFixtureBytes(name: string): Uint8Array {
  return readFileSync(join(FIXTURES, name));
}

describe("InMemoryBlobSource", () => {
  test("round-trips a stored blob by id", async () => {
    const src = new InMemoryBlobSource();
    const bytes = new TextEncoder().encode("hello jma-seismic-oracle");
    src.put("any-blob-id", bytes);
    const fetched = await src.fetch("any-blob-id");
    expect(new TextDecoder().decode(fetched)).toBe("hello jma-seismic-oracle");
  });

  test("returned bytes are isolated from the store", async () => {
    const src = new InMemoryBlobSource();
    const bytes = new TextEncoder().encode("immutable");
    src.put("c", bytes);
    const fetched = await src.fetch("c");
    fetched[0] = 0;
    const refetched = await src.fetch("c");
    expect(new TextDecoder().decode(refetched)).toBe("immutable");
  });

  test("throws BlobNotFoundError for unknown id", async () => {
    const src = new InMemoryBlobSource();
    let err: unknown = null;
    try {
      await src.fetch("nope");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BlobNotFoundError);
  });

  test("has() and size() reflect contents", () => {
    const src = new InMemoryBlobSource();
    expect(src.size()).toBe(0);
    expect(src.has("a")).toBe(false);
    src.put("a", new Uint8Array([1, 2, 3]));
    expect(src.has("a")).toBe(true);
    expect(src.size()).toBe(1);
  });
});

describe("fetchReportByBlobId — integrated end-to-end", () => {
  test("fetches XML bytes from a BlobSource and parses to a typed VXSE53 report", async () => {
    const xmlBytes = loadFixtureBytes("vxse53_nagano_20260427.xml");
    const blobId = "walrus://test-fixture-nagano";

    const src = new InMemoryBlobSource();
    src.put(blobId, xmlBytes);

    const { parsed, rawXml } = await fetchReportByBlobId(src, blobId);

    // Bytes round-trip cleanly through UTF-8 encode.
    expect(new TextEncoder().encode(rawXml).length).toBe(xmlBytes.length);
    expect(parsed.reportKind).toBe("VXSE53");
    if (parsed.reportKind === "VXSE53") {
      expect(parsed.meta.eventId).toBe("20260427074516");
      expect(parsed.maxShindoScaled).toBe(30);
      expect(parsed.stationObservations.length).toBe(18);
    }
  });

  test("propagates BlobNotFoundError for unknown blob id", async () => {
    const src = new InMemoryBlobSource();
    let err: unknown = null;
    try {
      await fetchReportByBlobId(src, "nonexistent");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BlobNotFoundError);
  });
});
