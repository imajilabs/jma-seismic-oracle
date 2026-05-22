/**
 * BCS schema for the on-chain `jma_seismic_oracle::shindo::Shindo` type.
 *
 * Wire layout (matches the Move BCS encoding byte-for-byte):
 *
 *     Shindo {
 *         level: u8,          // 0..=7
 *         band:  Option<Band>,
 *     }
 *     Band = enum { Lower, Upper }
 *
 *     Option<T> in BCS = u8 tag (0=None, 1=Some) + payload if Some
 *     enum tag in BCS  = u8 variant index (Lower=0, Upper=1)
 *
 * So a `Shindo` serializes to:
 *     [level u8] [band tag u8] [band variant u8 if Some]
 * — 2 bytes for None, 3 bytes for Some.
 *
 * Used when constructing the canonical bytes that the jma_seismic_oracle enclave
 * signs for `IntentMessage<TriggerPayload>`. Off-chain code parses JMA into
 * a structured `Shindo` (see `./shindo.ts`), then serializes via these BCS
 * schemas to match what the on-chain Move parser expects.
 */

import { bcs } from "@mysten/bcs";
import type { Shindo } from "./shindo.ts";

/** BCS schema for `jma_seismic_oracle::shindo::Band` (enum Lower | Upper). */
export const BandBcs = bcs.enum("Band", {
  Lower: null,
  Upper: null,
});

/**
 * BCS schema for `jma_seismic_oracle::shindo::Shindo`.
 *
 * Note: the on-chain type uses `option::Option<Band>`, which BCS-encodes as
 * either an empty vector (None) or a 1-element vector (Some). We model that
 * with `bcs.option(BandBcs)`.
 */
export const ShindoBcs = bcs.struct("Shindo", {
  level: bcs.u8(),
  band: bcs.option(BandBcs),
});

/**
 * Serialize a structured `Shindo` to canonical BCS bytes matching what the
 * on-chain `jma_seismic_oracle::shindo::Shindo` would deserialize from.
 */
export function serializeShindo(s: Shindo): Uint8Array {
  if (s.level === 5 || s.level === 6) {
    return ShindoBcs.serialize({ level: s.level, band: { [s.band]: true } as any }).toBytes();
  }
  return ShindoBcs.serialize({ level: s.level, band: null }).toBytes();
}
