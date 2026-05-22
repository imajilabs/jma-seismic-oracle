// Copyright (c) imajilabs
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module jma_seismic_oracle::oracle_tests;

use jma_seismic_oracle::oracle::{
    Self,
    TriggerAttestation,
    new_hypocenter,
    new_trigger_payload,
    ensure_attestation_for_testing,
    new_oracle_for_testing,
};
use jma_seismic_oracle::jma_seismic_oracle::test_admin_cap;
use jma_seismic_oracle::shindo;
use std::unit_test::destroy;
use sui::test_scenario;

const ADMIN: address = @0xA0;
const ENCLAVE_PLACEHOLDER: address = @0xE0;

fun sample_payload(event_id: vector<u8>): jma_seismic_oracle::oracle::TriggerPayload {
    let hypo = new_hypocenter(
        366000000, // 36.6 N
        false,
        1379000000, // 137.9 E
        false,
        10000,
        320, // M3.20
    );
    new_trigger_payload(
        event_id,
        1,
        1_700_000_000_000,
        shindo::whole(3), // shindo 3 — no sub-band
        hypo,
        // 32 bytes — placeholder Walrus blob id
        x"0000000000000000000000000000000000000000000000000000000000000001",
        // 32 bytes — placeholder SHA-256 of source XML
        x"0000000000000000000000000000000000000000000000000000000000000002",
    )
}

#[test]
fun test_set_paused_blocks_attestation_creation() {
    let mut scenario = test_scenario::begin(ADMIN);
    let admin_cap = test_admin_cap(scenario.ctx());

    let mut oracle = new_oracle_for_testing(
        object::id_from_address(ENCLAVE_PLACEHOLDER),
        scenario.ctx(),
    );

    oracle::set_paused(&admin_cap, &mut oracle, true);
    assert!(oracle::oracle_paused(&oracle));

    oracle::set_paused(&admin_cap, &mut oracle, false);
    assert!(!oracle::oracle_paused(&oracle));

    destroy(admin_cap);
    destroy(oracle);
    scenario.end();
}

#[test]
fun test_ensure_attestation_creates_shared_trigger() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        let mut oracle = new_oracle_for_testing(
            object::id_from_address(ENCLAVE_PLACEHOLDER),
            scenario.ctx(),
        );
        ensure_attestation_for_testing(
            &mut oracle,
            sample_payload(b"20260427074516"),
            1_700_000_000_500,
        );
        destroy(oracle);
    };

    // Subsequent transaction: the shared TriggerAttestation should be
    // visible and carry the expected fields.
    scenario.next_tx(ADMIN);
    {
        let attestation = scenario.take_shared<TriggerAttestation>();
        assert!(*oracle::event_id(&attestation) == b"20260427074516");
        assert!(oracle::serial(&attestation) == 1);
        let observed = oracle::max_shindo(&attestation);
        assert!(shindo::level(observed) == 3);
        assert!(shindo::band(observed).is_none());
        assert!(shindo::rank(observed) == 30);
        assert!(oracle::occurred_at_ms(&attestation) == 1_700_000_000_000);
        assert!(oracle::attested_at_ms(&attestation) == 1_700_000_000_500);
        test_scenario::return_shared(attestation);
    };

    scenario.end();
}

#[test]
#[expected_failure]
fun test_ensure_attestation_aborts_on_duplicate_event_id() {
    let mut scenario = test_scenario::begin(ADMIN);
    let mut oracle = new_oracle_for_testing(
        object::id_from_address(ENCLAVE_PLACEHOLDER),
        scenario.ctx(),
    );

    ensure_attestation_for_testing(
        &mut oracle,
        sample_payload(b"DUPLICATE-EVENT-ID"),
        1_700_000_000_000,
    );

    // Second call with same event id MUST abort inside derived_object::claim.
    ensure_attestation_for_testing(
        &mut oracle,
        sample_payload(b"DUPLICATE-EVENT-ID"),
        1_700_000_001_000,
    );

    destroy(oracle);
    scenario.end();
}

#[test]
fun test_distinct_event_ids_create_distinct_attestations() {
    let mut scenario = test_scenario::begin(ADMIN);
    let mut oracle = new_oracle_for_testing(
        object::id_from_address(ENCLAVE_PLACEHOLDER),
        scenario.ctx(),
    );

    ensure_attestation_for_testing(
        &mut oracle,
        sample_payload(b"EVENT-A"),
        1_700_000_000_000,
    );
    ensure_attestation_for_testing(
        &mut oracle,
        sample_payload(b"EVENT-B"),
        1_700_000_001_000,
    );

    destroy(oracle);
    scenario.end();
}

#[test, expected_failure(abort_code = oracle::EPaused)]
fun test_ensure_attestation_aborts_when_oracle_paused() {
    let mut scenario = test_scenario::begin(ADMIN);
    let admin_cap = test_admin_cap(scenario.ctx());
    let mut oracle = new_oracle_for_testing(
        object::id_from_address(ENCLAVE_PLACEHOLDER),
        scenario.ctx(),
    );

    oracle::set_paused(&admin_cap, &mut oracle, true);
    ensure_attestation_for_testing(
        &mut oracle,
        sample_payload(b"PAUSED-EVENT"),
        1_700_000_000_000,
    );

    destroy(admin_cap);
    destroy(oracle);
    scenario.end();
}
