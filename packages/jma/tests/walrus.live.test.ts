/**
 * Live integration test against Walrus mainnet via the aggregator.
 *
 * Skipped by default to keep the unit suite hermetic and offline. Run:
 *   RUN_LIVE_TESTS=1 bun test
 *
 * Flow:
 *   1. Fetch raw bytes from the public aggregator (single whitelistable URL).
 *   2. Re-encode the bytes locally with @mysten/walrus (Reed-Solomon WASM)
 *      and compare to the expected blob id — trustless integrity check.
 *   3. Parse the verified bytes with the jma-seismic-oracle JMA parser and assert the
 *      expected fields.
 *
 * The fixture XML at packages/jma/tests/__fixtures__/vxse53_nagano_20260427.xml
 * was pinned to mainnet under the blob id below. Re-pin and update the
 * constant if that ever lapses.
 *
 *   walrus --context mainnet store \
 *     packages/jma/tests/__fixtures__/vxse53_nagano_20260427.xml \
 *     --epochs max
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AggregatorBlobSource } from "../src/aggregator.ts";
import { fetchReportByBlobId } from "../src/report.ts";
import { assertBlobId, computeBlobId, createWalrusExt } from "../src/walrus.ts";

const MAINNET_BLOB_ID = "4yQmpFxDTrNlElKYlsJNddRxBY86Zw6hFNbUX1XICHE";
const AGGREGATOR_URL = "https://kori.mainnet.unconfirmed.cloud";
const SUI_MAINNET_GRPC = "https://fullnode.mainnet.sui.io:443";
const FIXTURE_PATH = join(import.meta.dir, "__fixtures__", "vxse53_nagano_20260427.xml");

const RUN_LIVE = process.env.RUN_LIVE_TESTS === "1";
const describeLive = RUN_LIVE ? describe : describe.skip;

describeLive("Walrus mainnet — live integration via aggregator", () => {
  test(
    "fetches blob → re-encodes locally → blob id matches → parses to expected VXSE53",
    async () => {
      const source = new AggregatorBlobSource({ baseUrl: AGGREGATOR_URL });
      const ext = createWalrusExt({ network: "mainnet", suiRpcUrl: SUI_MAINNET_GRPC });

      // 1. Fetch via aggregator HTTP.
      const bytes = await source.fetch(MAINNET_BLOB_ID);

      // 2. Trustless integrity: re-encode and compare.
      await assertBlobId(ext, MAINNET_BLOB_ID, bytes);

      // 3. Bytes must equal the local fixture exactly.
      const localBytes = readFileSync(FIXTURE_PATH);
      expect(bytes.length).toBe(localBytes.length);
      expect(bytes.every((b, i) => b === localBytes[i])).toBe(true);

      // 4. Parser end-to-end.
      const { parsed } = await fetchReportByBlobId(source, MAINNET_BLOB_ID);
      expect(parsed.reportKind).toBe("VXSE53");
      if (parsed.reportKind === "VXSE53") {
        expect(parsed.meta.eventId).toBe("20260427074516");
        expect(parsed.meta.serial).toBe(1);
        expect(parsed.maxShindoScaled).toBe(30);
        expect(parsed.hypocenter?.latitude).toBe(36.6);
        expect(parsed.hypocenter?.longitude).toBe(137.9);
        expect(parsed.stationObservations.length).toBe(18);
      }
    },
    120_000,
  );

  test(
    "computeBlobId on the local fixture produces the same blob id Walrus assigned",
    async () => {
      const ext = createWalrusExt({ network: "mainnet", suiRpcUrl: SUI_MAINNET_GRPC });
      const bytes = readFileSync(FIXTURE_PATH);
      const blobId = await computeBlobId(ext, bytes);
      expect(blobId).toBe(MAINNET_BLOB_ID);
    },
    120_000,
  );
});
