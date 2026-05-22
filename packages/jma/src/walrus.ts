/**
 * Walrus content addressing — local blob-id computation.
 *
 * The Walrus blob id is the deterministic Reed-Solomon encoding of the
 * content. Computing it locally lets us verify, without trusting the
 * aggregator or any storage node, that the bytes we received are exactly
 * the bytes that were originally pinned.
 *
 * Operationally this requires:
 *   - a one-time call to a Sui fullnode (gRPC) to discover the on-chain
 *     committee's shard count
 *   - thereafter all encoding is offline via the @mysten/walrus WASM module
 *
 * In a constrained signer this means we whitelist exactly one Sui fullnode URL and
 * one aggregator URL — instead of every Walrus storage node, whose membership
 * changes every epoch.
 *
 * Pattern follows unconfirmedlabs/musicos-audio-ingester.
 */

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { walrus } from "@mysten/walrus";

export type WalrusNetwork = "mainnet" | "testnet";

/** A `WalrusClient` extension over a `SuiGrpcClient`. */
export type WalrusExt = ReturnType<typeof createWalrusExt>;

export interface CreateWalrusExtOptions {
  network: WalrusNetwork;
  /** Full-node base URL for gRPC (e.g. https://fullnode.mainnet.sui.io:443). */
  suiRpcUrl: string;
}

/** Build a Sui gRPC client extended with Walrus. */
export function createWalrusExt(opts: CreateWalrusExtOptions) {
  return new SuiGrpcClient({
    network: opts.network,
    baseUrl: opts.suiRpcUrl,
  }).$extend(walrus());
}

/**
 * Compute the canonical Walrus blob id for given content.
 *
 * Loads the encoder WASM and runs Reed-Solomon encoding locally. The shard
 * count is auto-discovered from the on-chain committee on first call (cached
 * thereafter), so this needs the gRPC URL to be reachable once at startup.
 */
export async function computeBlobId(
  ext: WalrusExt,
  content: Uint8Array,
): Promise<string> {
  const { blobId } = await ext.walrus.encodeBlob(content);
  return blobId;
}

/**
 * Verify that `content` encodes to `expectedBlobId` under the given network.
 * Throws `BlobIdMismatchError` on mismatch.
 */
export async function assertBlobId(
  ext: WalrusExt,
  expectedBlobId: string,
  content: Uint8Array,
): Promise<void> {
  const computed = await computeBlobId(ext, content);
  if (computed !== expectedBlobId) {
    throw new BlobIdMismatchError(expectedBlobId, computed);
  }
}

export class BlobIdMismatchError extends Error {
  override readonly name = "BlobIdMismatchError";
  constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`Walrus blob id mismatch: expected ${expected}, computed ${actual}`);
  }
}
