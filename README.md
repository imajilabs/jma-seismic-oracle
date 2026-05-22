# JMA Seismic Oracle

Standalone Sui Move oracle and TypeScript tooling for content-addressed Japan
Meteorological Agency (JMA) earthquake attestations.

The project turns public JMA earthquake reports into canonical off-chain
payloads that a trusted enclave can sign, then verifies those signatures
on-chain through the `jma_seismic_oracle` Move package. Downstream applications
can reference a shared `TriggerAttestation` instead of rebuilding earthquake
ingestion, source-data hashing, signature verification, and replay protection.

This repository is intentionally only a seismic oracle. It does not contain
insurance, payout, eligibility, or city-impact logic. Those layers should consume
the emitted on-chain seismic attestations from their own packages or services.

## Status

The first end-to-end testnet attestation was emitted from a live JMA report and a
Nitro Enclave signer registered through kagi:

- Sui testnet transaction:
  [`AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt`](https://suiexplorer.com/txblock/AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt?network=testnet)
- JMA source XML:
  [`20260522062513_0_VXSE53_010000.xml`](https://www.data.jma.go.jp/developer/xml/data/20260522062513_0_VXSE53_010000.xml)
- JMA event id: `20260522152219`
- Origin time: `2026-05-22T15:22:00+09:00`
- Epicentral area: `留萌地方中北部`
- Magnitude/depth: `Mj 3.4`, `10 km`
- Maximum observed shindo: `2`
- On-chain attestation:
  `0xdd8d3f3cedda908dee948631934c31d9ffaa3123c1e461044a59dfb58c1b1647`

See [docs/testnet-e2e.md](docs/testnet-e2e.md) for the full evidence trail.

## Repo Layout

```text
jma-seismic-oracle/
├── packages/
│   └── jma/                @imajilabs/jma-seismic-oracle typed JMA feed SDK
├── services/
│   └── jma-ingest/         dev HTTP API and feed probe tooling
└── move/
    └── jma_seismic_oracle/ Sui Move package for signed trigger attestations
```

## Quickstart

Requires [Bun](https://bun.com) and the Sui CLI.

```bash
bun install
bun run jma:typecheck
bun run ingest:typecheck
bun run test
bun run move:test
```

## Dev API

```bash
bun run ingest:dev
```

Useful endpoints:

```text
GET /health
GET /feed
GET /feed?long=1&kind=VXSE53
GET /report/:reportId
GET /trigger/:eventId
```

Probe the JMA feed without starting the HTTP API:

```bash
bun run ingest:probe feed --kind=VXSE53
bun run ingest:probe latest VXSE53
bun run ingest:probe report 20260426224826_0_VXSE53_010000
```

## Architecture

1. The ingest service reads public JMA Atom feeds and VXSE earthquake reports.
2. The TypeScript SDK parses the source XML into canonical earthquake facts:
   event id, serial, origin time, maximum shindo, hypocenter, source hash, and
   content-addressable source reference.
3. A Nitro Enclave signer signs the BCS-encoded
   `IntentMessage<TriggerPayload>`.
4. kagi registers the enclave from its AWS Nitro attestation document and stores
   the approved PCR policy on Sui.
5. `jma_seismic_oracle::oracle::ensure_attestation` verifies the enclave
   signature and shares a derived `TriggerAttestation`.

The on-chain package provides one attestation per JMA event id. Replay attempts
abort through Sui derived-object claiming.

## Move Package

`move/jma_seismic_oracle` defines:

- `jma_seismic_oracle::jma_seismic_oracle`: root package witness and admin
  capability.
- `jma_seismic_oracle::shindo`: structured JMA shindo representation.
- `jma_seismic_oracle::oracle`: shared oracle object, signed trigger payload
  verification, and derived-object replay protection.

Deployment flow:

1. Publish `move/jma_seismic_oracle`.
2. Set the approved enclave PCRs through `kagi::enclave_policy::update_pcrs`.
3. Register the Nitro Enclave through kagi using its attestation document.
4. Create the shared `Oracle`.
5. Submit enclave-signed `TriggerPayload`s to `ensure_attestation`.

Run the Move tests with:

```bash
bun run move:test
```

## SDK Overview

The TypeScript SDK exposes pure parsing and encoding primitives for JMA Atom
feeds, VXSE earthquake reports, Walrus-compatible blob references, and BCS
encoding compatible with the on-chain `jma_seismic_oracle::shindo` type.

JMA shindo values are normalized to a sortable integer scale that matches the
on-chain `u8` encoding:

| JMA | Scaled |
| --- | --- |
| 0-4 | 0, 10, 20, 30, 40 |
| 5弱 (5-) | 50 |
| 5強 (5+) | 55 |
| 6弱 (6-) | 60 |
| 6強 (6+) | 65 |
| 7 | 70 |

## Data Sources

- JMA Atom feeds: `eqvol.xml` and `eqvol_l.xml` provide real-time earthquake
  reports.
- VXSE53 reports provide hypocenter, magnitude, maximum shindo, and station
  observations.
- VXSE54 estimated seismic intensity distribution is not available from the free
  Atom feed; current tooling keeps the schema compatible while using VXSE53
  observations.

## Security Model

This oracle attests that a registered enclave observed and signed a canonical
payload derived from public JMA data. It does not claim that downstream
applications should pay, settle, or act on that event. Consumers should verify
that the `Oracle`, kagi `Enclave`, package id, and source-data policy match their
own risk requirements.

Production deployments should store the source XML in the configured blob store
and sign both the blob id and SHA-256 hash. The public testnet proof in this
README used the SHA-256 source hash as the 32-byte source reference because the
test wallet did not hold WAL.

## License

Apache-2.0. See [LICENSE](LICENSE).
