// Copyright (c) imajilabs
// SPDX-License-Identifier: Apache-2.0

/// `jma_seismic_oracle` — root module.
///
/// Defines the witness type `JMA_SEISMIC_ORACLE` used to instantiate kagi's
/// enclave policy for this package. Any downstream application can depend on
/// this package and consume its `TriggerAttestation`s
/// without re-implementing oracle plumbing.
///
/// The intended deployer flow:
///   1. Publish — `init` creates the EnclavePolicy<JMA_SEISMIC_ORACLE> with
///      empty PCR placeholders, plus an AdminCap and the kagi
///      EnclavePolicyCap<JMA_SEISMIC_ORACLE>.
///   2. Set canonical PCR values via `kagi::enclave_policy::update_pcrs`.
///   3. Register the production jma_seismic_oracle enclave instance with a
///      Nitro attestation document; share the `kagi::Enclave<JMA_SEISMIC_ORACLE>`.
///   4. Create the `Oracle` via `jma_seismic_oracle::oracle::create_oracle`.
module jma_seismic_oracle::jma_seismic_oracle;

use kagi::enclave_policy;

/// One-time witness for the jma_seismic_oracle package. Phantom-parameterizes
/// `kagi::Enclave<JMA_SEISMIC_ORACLE>` and `kagi::EnclavePolicy<JMA_SEISMIC_ORACLE>`.
public struct JMA_SEISMIC_ORACLE has drop {}

/// Capability granting admin control over the jma_seismic_oracle package —
/// creating the Oracle singleton, pausing trigger ingestion, and
/// rotating operators.
public struct AdminCap has key, store {
    id: UID,
}

fun init(otw: JMA_SEISMIC_ORACLE, ctx: &mut TxContext) {
    let admin_cap = AdminCap { id: object::new(ctx) };

    // Create the kagi enclave policy with empty placeholder PCRs. The
    // deployer must call `kagi::enclave_policy::update_pcrs` before
    // registering any production enclave.
    let (policy, policy_cap) = enclave_policy::new(
        otw,
        vector[],
        vector[],
        vector[],
        ctx,
    );

    transfer::public_transfer(admin_cap, ctx.sender());
    transfer::public_transfer(policy_cap, ctx.sender());
    policy.share();
}

#[test_only]
public fun test_admin_cap(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}
