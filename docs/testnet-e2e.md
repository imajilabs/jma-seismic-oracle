# Testnet E2E Attestation

This document records the first public end-to-end testnet proof for
`jma_seismic_oracle`.

## Summary

On May 22, 2026, a temporary AWS Nitro Enclave parsed a live JMA VXSE53
earthquake report, signed the canonical `TriggerPayload`, registered through
kagi, and emitted a Sui testnet `TriggerAttested` event.

- Trigger attestation transaction:
  [`AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt`](https://suiexplorer.com/txblock/AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt?network=testnet)
- JMA source report:
  <https://www.data.jma.go.jp/developer/xml/data/20260522062513_0_VXSE53_010000.xml>
- Report id: `20260522062513_0_VXSE53_010000`
- JMA event id: `20260522152219`
- Attestation object:
  `0xdd8d3f3cedda908dee948631934c31d9ffaa3123c1e461044a59dfb58c1b1647`

## JMA Source Facts

The JMA XML report contains:

- `Control/Title`: `震源・震度に関する情報`
- `Head/Title`: `震源・震度情報`
- `Head/EventID`: `20260522152219`
- `Head/Serial`: `1`
- `ReportDateTime`: `2026-05-22T15:25:00+09:00`
- `OriginTime`: `2026-05-22T15:22:00+09:00`
- `Hypocenter/Area/Name`: `留萌地方中北部`
- Coordinates: `北緯44.1度 東経141.8度 深さ10km`
- Magnitude: `Mj 3.4`
- Maximum observed shindo: `2`
- Forecast comment: no tsunami concern for this earthquake

The on-chain event stores `event_id` as `vector<u8>`. The emitted bytes:

```text
[50, 48, 50, 54, 48, 53, 50, 50, 49, 53, 50, 50, 49, 57]
```

decode as ASCII:

```text
20260522152219
```

which matches the JMA `Head/EventID`.

## Testnet Objects

- Package:
  `0xd5b734ff48a3361c6882b21ed82b7903bf411ef29dc12acc407d4b127f9a2526`
- kagi `EnclavePolicy<JMA_SEISMIC_ORACLE>`:
  `0x0fc581733ef2422906b7bf59353c677a91702bb6975204a4e01a3821e8b6104d`
- kagi `Enclave<JMA_SEISMIC_ORACLE>`:
  `0x153e23828a23e489324ecb39a6458734aa484f5a12fc8dc36d67b86abab68801`
- Oracle:
  `0x77934e19f4d2f12a4ab05f9f63625c703085e2939d76eb92e2d3e9bfb598f678`
- Trigger attestation:
  `0xdd8d3f3cedda908dee948631934c31d9ffaa3123c1e461044a59dfb58c1b1647`

## Transaction Trail

- Package publish:
  `GXLKBTUYpJsBtnX4aRT3QHDM5cLy8mmeY2o8nhaiph9H`
- PCR policy update:
  `AQLy1Zp3bK2VcwyVeNrNsET2CuZHrHPb9WoZNFR2rQ1p`
- Enclave registration:
  `3YqgzSppUMfebvpzucycow4WztVBEuiuuLGuiDRzsbwy`
- Oracle creation:
  `H7n9wETmW7ADqybaAUgGrPeYeRxd34oMJL7f5cXG6jqg`
- Trigger attestation:
  `AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt`

## Nitro Measurements

The E2E signer ran as a non-debug Nitro Enclave with these measurements:

```text
PCR0 092b395daf85706588b36a3eccde0ed0dc07b68465bb13d182fbb8d40040bde2df69555fb51398bf94db554ea8627de8
PCR1 4b4d5b3661b3efc12920900c80e126e4ce783c522de6c02a2a5bf7af3a2b9327b86776f188e4be1c1c404a129dbda493
PCR2 8fc9278fa3b51c237e0991f6f2516571ec4d274dd287be0d880b59f5b9bb81d483ac89ec36b384cd4da0164a0d0a2ddc
```

The enclave public key registered through kagi was:

```text
c0bad4c09c854c7c1e3393eeee55946d6f3a3d1971cb39275a0f11f70dea6f5d
```

## Signed Payload

The enclave signed an `IntentMessage<TriggerPayload>` with:

- intent: `1`
- attested timestamp: `1779430920500`
- event id: `20260522152219`
- serial: `1`
- occurred at: `1779430920000`
- max shindo: `2`
- latitude: `44.1`
- longitude: `141.8`
- depth: `10 km`
- magnitude: `Mj 3.4`
- source XML SHA-256:
  `b6be6592bc0bcc932d48612d42b805268e4afe15aeefba7bf47a9e8321fd93c9`

The testnet proof used that same 32-byte SHA-256 value as `source_xml_blob`.
Production deployments should write the JMA XML to the configured blob store and
sign the actual blob id plus the SHA-256 content hash.

## Verification Commands

Local checks run against this split repo:

```bash
bun run jma:typecheck
bun run ingest:typecheck
bun run test
bun run move:test
```

Result:

```text
TypeScript typechecks passed
JMA SDK tests passed: 76 pass, 2 skipped live Walrus tests
Move tests passed: 15 pass
```
