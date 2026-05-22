# Test fixtures

## `vxse53_nagano_20260427.xml`

Real VXSE53 (震源・震度に関する情報) for the M3.2 Nagano-hokubu earthquake at
2026-04-27 07:45 JST. Used as the canonical parsing fixture.

Pinned to **Walrus mainnet** for the live integration test:

| Field | Value |
|---|---|
| Walrus blob id | `4yQmpFxDTrNlElKYlsJNddRxBY86Zw6hFNbUX1XICHE` |
| Sui object id  | `0xb41301f5e1fd4281c9816dd8767f4d3a508eda7577329e3fc67519e152ffe7a2` |
| Encoding type  | RedStuff / Reed-Solomon |
| Unencoded size | 5.43 KiB |
| Pinned epochs  | max (expiry epoch 82) |

To re-pin (e.g. after expiry):

```sh
walrus --context mainnet store \
  packages/jma/tests/__fixtures__/vxse53_nagano_20260427.xml \
  --epochs max
```

Then update `MAINNET_BLOB_ID` in `tests/walrus.live.test.ts`.

## `feed_eqvol_snapshot.xml`

Snapshot of the JMA `eqvol.xml` Atom feed used for `feed.test.ts`. Captured
once and frozen — purely a parser test, no network or Walrus involvement.
