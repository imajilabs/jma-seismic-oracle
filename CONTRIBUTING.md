# Contributing

Thanks for helping improve `jma-seismic-oracle`.

## Scope

This repository should stay focused on JMA-sourced seismic attestations:

- JMA feed/report parsing
- canonical trigger payload generation
- content-addressed source references
- enclave signing and verification interfaces
- Sui Move attestation objects

Do not add insurance, payout, eligibility, or city-impact layers here. Those
belong in downstream applications that consume `TriggerAttestation`s.

## Local Checks

Run these before opening a pull request:

```bash
bun install
bun run jma:typecheck
bun run ingest:typecheck
bun run test
bun run move:test
```

The live Walrus tests are skipped by default unless their environment is
configured.

## JMA Fixtures

Use small JMA XML fixtures when adding parser coverage. Keep fixture filenames
close to the JMA report id where possible, and avoid committing large generated
artifacts.

## Move Changes

Move changes should include focused tests under
`move/jma_seismic_oracle/tests`. Keep public entry points narrow and document any
new objects or events in the README.
