# Testnet E2E Attestation

This document records the first public end-to-end testnet proof for
`jma_seismic_oracle` using a real Walrus source blob id.

## Summary

On May 22, 2026, a temporary AWS Nitro Enclave signed a canonical
`TriggerPayload` derived from a live JMA VXSE53 earthquake report. The raw source
XML was stored on Walrus mainnet, kagi registered the enclave from its Nitro
attestation document, and Sui testnet emitted a `TriggerAttested` event.

- Trigger attestation transaction:
  [`Bcobe2wZTGhD9kGbwAbmSKXghT8TUApf1zwS9woREWVw`](https://suivision.xyz/txblock/Bcobe2wZTGhD9kGbwAbmSKXghT8TUApf1zwS9woREWVw?network=testnet)
- JMA source report:
  <https://www.data.jma.go.jp/developer/xml/data/20260522062513_0_VXSE53_010000.xml>
- Walrus blob id:
  `PfjhcGDgPysLCxkZKmUY0n3177B1MnMDYJ2xwt1zmtc`
- Walrus blob id bytes:
  `3df8e17060e03f2b0b0b19192a6518d27df5efb075327303609db1c2dd739ad7`
- Walrus storage object:
  `0x9aaa5838ec0acbfc023f6a6645ebff236bf9889f9f7a6989600022fd87af540c`
- Report id: `20260522062513_0_VXSE53_010000`
- JMA event id: `20260522152219`
- Trigger attestation object:
  `0xb4ddb61b5e88ced02b4a05cd0716776b63a4a75e4dcc5da479712120aad86356`

The on-chain `source_xml_blob` stores the deterministic 32-byte Walrus blob id.
The Sui `Blob` object id is listed only as storage metadata; it is not the source
identifier signed by the enclave.

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
  `0xdfcdd6cb8bf7cb59a687d8cef0691e4dc99208eed1b3d32ba6f65e9c7838eaa1`
- Oracle:
  `0xa378900eb0abc6718ab854522b53d3b6072dab2f494f2a65cbf38621607d9616`
- Trigger attestation:
  `0xb4ddb61b5e88ced02b4a05cd0716776b63a4a75e4dcc5da479712120aad86356`

## Transaction Trail

- Package publish:
  `GXLKBTUYpJsBtnX4aRT3QHDM5cLy8mmeY2o8nhaiph9H`
- PCR policy update with raw PCR bytes:
  `K2XL1BNRu4fcqdecpdmkSU7AVQiBRKYPv9TkcSJJqGQ`
- Enclave registration:
  `EvuVDddGAqcccfhSmsfqyxEED6HHbPLf22awUqBbLdCJ`
- Oracle creation:
  `BejduCTV1rkFVm27gMbcomHhgu3gC4qSaavQUdU3o3hX`
- Trigger attestation:
  `Bcobe2wZTGhD9kGbwAbmSKXghT8TUApf1zwS9woREWVw`

## Nitro Measurements

The E2E signer ran as a non-debug Nitro Enclave with these measurements:

```text
PCR0 ea71f9dca4122a1d22c5da0baffb351e4dad95e0e946fd61aa6d66024617ec9d57d345fcea2d87d32c870484017200c7
PCR1 4b4d5b3661b3efc12920900c80e126e4ce783c522de6c02a2a5bf7af3a2b9327b86776f188e4be1c1c404a129dbda493
PCR2 c68da48b3e64b99b81cfb0c127fe01f9a28a390e43c49886bb7118faa10e4da35af9abbca4a6a4a8b2f48b34ed46651e
```

The enclave public key registered through kagi was:

```text
5a1873ebdef64f2fc331d12b01b62ae44af959a2ccec07e0be02526ebcc981d6
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
- source XML blob id:
  `PfjhcGDgPysLCxkZKmUY0n3177B1MnMDYJ2xwt1zmtc`
- source XML blob id bytes:
  `3df8e17060e03f2b0b0b19192a6518d27df5efb075327303609db1c2dd739ad7`
- source XML SHA-256:
  `b6be6592bc0bcc932d48612d42b805268e4afe15aeefba7bf47a9e8321fd93c9`

The full signed intent BCS hash was:

```text
86938cf4adc79be5ba4aba90bb6ab3b31bcabfa258bd48347c5fd48063505eae
```

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
