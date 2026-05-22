/**
 * BlobSource — abstract content-addressed storage.
 *
 * The single canonical content identifier is the **Walrus blob ID** — a
 * deterministic encoding of the content. The on-chain `TriggerAttestation`
 * carries the blob ID; consumers fetch by that ID from any storage backend
 * (Walrus mainnet/testnet, mirror, local cache) and Walrus's read protocol
 * verifies the returned bytes against the blob ID natively.
 *
 * Production: WalrusBlobSource (queries Walrus storage nodes).
 * Tests: InMemoryBlobSource (string-keyed map; integrity is checked at the
 *        Walrus encoding boundary in the scraper, not here).
 */

export interface BlobSource {
  /** Fetch the bytes for a given Walrus blob id. Throws if not found. */
  fetch(blobId: string): Promise<Uint8Array>;
}

export class BlobNotFoundError extends Error {
  override readonly name = "BlobNotFoundError";
  constructor(public readonly blobId: string) {
    super(`blob not found: ${blobId}`);
  }
}

// ─── In-memory implementation ─────────────────────────────────────────────
// For tests and for a scraper-side cache before confirmation of pinning.

export class InMemoryBlobSource implements BlobSource {
  private readonly blobs = new Map<string, Uint8Array>();

  put(blobId: string, bytes: Uint8Array): void {
    this.blobs.set(blobId, bytes);
  }

  has(blobId: string): boolean {
    return this.blobs.has(blobId);
  }

  size(): number {
    return this.blobs.size;
  }

  async fetch(blobId: string): Promise<Uint8Array> {
    const v = this.blobs.get(blobId);
    if (!v) throw new BlobNotFoundError(blobId);
    // Return a copy so consumers can't mutate the store.
    return new Uint8Array(v);
  }
}
