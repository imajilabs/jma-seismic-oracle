/**
 * AggregatorBlobSource — fetch Walrus blobs over HTTP from a single
 * aggregator endpoint instead of talking to the storage-node committee.
 *
 * Why: storage-node membership rotates every epoch. A constrained oracle signer
 * whitelists outbound network destinations, so a per-epoch shard set is
 * operationally painful. An aggregator collapses that to one stable URL.
 *
 * Trust model: the aggregator is NOT trusted for content integrity. We
 * fetch by blob id, then re-encode the bytes locally (`computeBlobId` from
 * `./walrus`) and compare — a malicious or compromised aggregator can return
 * different bytes, but we'll detect it before parsing. The only thing the
 * aggregator can do unilaterally is refuse service.
 *
 * Aggregator URL convention is the standard Walrus aggregator HTTP API:
 *   GET {baseUrl}/v1/blobs/{blobId}
 */

import { BlobNotFoundError, type BlobSource } from "./blob-source.ts";

export interface AggregatorBlobSourceOptions {
  /**
   * Base URL of the Walrus aggregator. Trailing slash optional.
   * e.g. `https://kori.mainnet.unconfirmed.cloud`
   */
  baseUrl: string;
  /** Optional fetch override for tests. Defaults to the global `fetch`. */
  fetcher?: typeof fetch;
  /** Request timeout in ms. Defaults to 30s. */
  timeoutMs?: number;
}

export class AggregatorBlobSource implements BlobSource {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: AggregatorBlobSourceOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetcher = opts.fetcher ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async fetch(blobId: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/v1/blobs/${encodeURIComponent(blobId)}`;
    return this.fetchUrl(url, blobId);
  }

  private async fetchUrl(url: string, blobIdLabel: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetcher(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/octet-stream, */*",
          "user-agent": "jma-seismic-oracle/0.1 (+https://github.com/imajilabs/jma-seismic-oracle)",
        },
      });
      if (res.status === 404) {
        throw new BlobNotFoundError(blobIdLabel);
      }
      if (!res.ok) {
        throw new Error(
          `Aggregator fetch failed: ${res.status} ${res.statusText} for ${url}`,
        );
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } finally {
      clearTimeout(timer);
    }
  }
}
