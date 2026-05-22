# Security

`jma-seismic-oracle` is an attestation layer for public JMA seismic data. It is
not an insurance product, payout engine, or emergency alerting system.

## Reporting Issues

Please report security-sensitive issues privately to the maintainers instead of
opening a public issue. Include:

- affected package or service
- reproduction steps
- expected and observed behavior
- any relevant transaction digests, report ids, or source XML links

## Trust Assumptions

Consumers should independently decide whether a specific deployment is trusted.
At minimum, verify:

- the Sui package id
- the shared `Oracle` id
- the kagi `Enclave` id
- the PCR policy for the enclave image
- how source XML is stored and hashed
- whether the signed source reference is a real blob id or a test placeholder

The Move package verifies enclave signatures and prevents duplicate
attestations for the same event id. It does not validate that downstream
business logic is correct.
