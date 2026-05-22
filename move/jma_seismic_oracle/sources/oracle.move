// Copyright (c) imajilabs
// SPDX-License-Identifier: Apache-2.0

/// On-chain trigger ingestion for seismic events.
///
/// `Oracle` is a singleton shared object pointing to the registered kagi
/// `Enclave<JMA_SEISMIC_ORACLE>`. Anyone can submit an enclave-signed
/// `TriggerPayload` to `ensure_attestation`; the module verifies the
/// signature and creates a `TriggerAttestation` whose UID is derived from
/// the source event id. Calling twice for the same event id aborts inside
/// `derived_object::claim` — guaranteeing one attestation per event.
///
/// `event_id` is opaque bytes — for the JMA backbone case it's the
/// 14-digit YYYYMMDDhhmmss string of the earthquake origin time, but
/// downstream consumers can use any deterministic identifier.
module jma_seismic_oracle::oracle;

use kagi::enclave::Enclave;
use jma_seismic_oracle::jma_seismic_oracle::{AdminCap, JMA_SEISMIC_ORACLE};
use jma_seismic_oracle::shindo::Shindo;
use sui::derived_object::claim;
use sui::event;

// === Errors ===

const EPaused: u64 = 0;
const EWrongEnclave: u64 = 1;

// === Constants ===

/// Intent prefix for `IntentMessage<TriggerPayload>` per kagi's signing
/// scheme. Distinct from any other intents this package may add later so
/// a misrouted signature can't be reinterpreted as a different message.
const INTENT_TRIGGER: u8 = 1;

// === Structs ===

/// Singleton holding oracle configuration. Created once via `create_oracle`
/// after the kagi enclave has been registered.
public struct Oracle has key {
    id: UID,
    /// ID of the verified `kagi::Enclave<JMA_SEISMIC_ORACLE>` whose signatures
    /// are trusted.
    enclave_id: ID,
    /// Pause flag — when set, `ensure_attestation` aborts.
    paused: bool,
}

/// Canonical hypocenter, recorded for audit. Not interpreted by this module
/// (downstream consumers can run their own logic off the event data referenced
/// by `source_xml_blob`).
public struct Hypocenter has copy, drop, store {
    /// Latitude in 1e7-degree fixed point. Move has no signed integers,
    /// so we encode the sign in a separate flag.
    latitude_e7: u64,
    negative_lat: bool,
    longitude_e7: u64,
    negative_lon: bool,
    /// Depth in metres (always positive).
    depth_m: u32,
    /// Magnitude on JMA's Mj scale, ×100 (e.g. 6_50 = M6.50).
    magnitude_e2: u16,
}

/// What the enclave signs (BCS-encoded inside `IntentMessage<TriggerPayload>`).
public struct TriggerPayload has copy, drop, store {
    event_id: vector<u8>,
    /// Source-system serial / revision number for this event.
    serial: u32,
    occurred_at_ms: u64,
    /// Maximum observed JMA shindo for this event.
    max_shindo: Shindo,
    hypocenter: Hypocenter,
    /// Walrus blob id for the source XML (raw 32 bytes, not base64).
    source_xml_blob: vector<u8>,
    /// SHA-256 of the canonical source XML for independent audit. Optional;
    /// the Walrus blob id alone is sufficient for content addressing.
    source_xml_hash: vector<u8>,
}

/// On-chain attestation. UID derived from `(oracle.id, event_id)` so at
/// most one can ever exist per event. Shared so any user can reference it
/// from downstream transactions.
public struct TriggerAttestation has key {
    id: UID,
    event_id: vector<u8>,
    serial: u32,
    occurred_at_ms: u64,
    attested_at_ms: u64,
    max_shindo: Shindo,
    hypocenter: Hypocenter,
    source_xml_blob: vector<u8>,
    source_xml_hash: vector<u8>,
}

/// Derived-UID key — tying the attestation to its event id under the
/// Oracle's UID.
public struct EventKey(vector<u8>) has copy, drop, store;

// === Events ===

public struct OracleCreated has copy, drop {
    oracle_id: ID,
    enclave_id: ID,
}

public struct TriggerAttested has copy, drop {
    attestation_id: ID,
    event_id: vector<u8>,
    serial: u32,
    max_shindo: Shindo,
    occurred_at_ms: u64,
    attested_at_ms: u64,
}

public struct OraclePaused has copy, drop {
    oracle_id: ID,
    paused: bool,
}

// === Public functions ===

/// Create the singleton Oracle. Caller must hold the AdminCap and reference
/// the verified kagi enclave by id. The Oracle is shared.
public fun create_oracle(
    _: &AdminCap,
    enclave: &Enclave<JMA_SEISMIC_ORACLE>,
    ctx: &mut TxContext,
) {
    let oracle = Oracle {
        id: object::new(ctx),
        enclave_id: object::id(enclave),
        paused: false,
    };
    event::emit(OracleCreated {
        oracle_id: object::id(&oracle),
        enclave_id: oracle.enclave_id,
    });
    transfer::share_object(oracle);
}

/// Submit an enclave-signed trigger payload. If no attestation exists yet
/// for this `event_id`, creates one. If one already exists, this aborts
/// inside `derived_object::claim` — clean replay protection.
///
/// `attested_at_ms` is the kagi intent timestamp; the signature covers
/// `IntentMessage<TriggerPayload> { intent, ts, payload }`.
public fun ensure_attestation(
    oracle: &mut Oracle,
    enclave: &Enclave<JMA_SEISMIC_ORACLE>,
    payload: TriggerPayload,
    attested_at_ms: u64,
    signature: vector<u8>,
) {
    assert!(!oracle.paused, EPaused);
    assert!(object::id(enclave) == oracle.enclave_id, EWrongEnclave);

    enclave.verify_signature(INTENT_TRIGGER, attested_at_ms, payload, &signature);

    let TriggerPayload {
        event_id,
        serial,
        occurred_at_ms,
        max_shindo,
        hypocenter,
        source_xml_blob,
        source_xml_hash,
    } = payload;

    // Idempotent by construction — aborts if an attestation already exists
    // for this event id.
    let attestation_uid = claim(&mut oracle.id, EventKey(event_id));
    let attestation_id = attestation_uid.to_inner();

    let attestation = TriggerAttestation {
        id: attestation_uid,
        event_id,
        serial,
        occurred_at_ms,
        attested_at_ms,
        max_shindo,
        hypocenter,
        source_xml_blob,
        source_xml_hash,
    };

    event::emit(TriggerAttested {
        attestation_id,
        event_id: attestation.event_id,
        serial,
        max_shindo,
        occurred_at_ms,
        attested_at_ms,
    });

    transfer::share_object(attestation);
}

// === Admin ===

public fun set_paused(_: &AdminCap, oracle: &mut Oracle, paused: bool) {
    oracle.paused = paused;
    event::emit(OraclePaused { oracle_id: object::id(oracle), paused });
}

// === Constructors used by callers / PTBs ===

public fun new_hypocenter(
    latitude_e7: u64,
    negative_lat: bool,
    longitude_e7: u64,
    negative_lon: bool,
    depth_m: u32,
    magnitude_e2: u16,
): Hypocenter {
    Hypocenter { latitude_e7, negative_lat, longitude_e7, negative_lon, depth_m, magnitude_e2 }
}

public fun new_trigger_payload(
    event_id: vector<u8>,
    serial: u32,
    occurred_at_ms: u64,
    max_shindo: Shindo,
    hypocenter: Hypocenter,
    source_xml_blob: vector<u8>,
    source_xml_hash: vector<u8>,
): TriggerPayload {
    TriggerPayload {
        event_id,
        serial,
        occurred_at_ms,
        max_shindo,
        hypocenter,
        source_xml_blob,
        source_xml_hash,
    }
}

// === Test helpers ===

/// Test-only attestation creation that skips signature verification.
/// Useful for unit-testing the derived-UID idempotency invariant without
/// needing a known-good ed25519 keypair + signed payload.
#[test_only]
public fun ensure_attestation_for_testing(
    oracle: &mut Oracle,
    payload: TriggerPayload,
    attested_at_ms: u64,
) {
    assert!(!oracle.paused, EPaused);
    let TriggerPayload {
        event_id,
        serial,
        occurred_at_ms,
        max_shindo,
        hypocenter,
        source_xml_blob,
        source_xml_hash,
    } = payload;
    let attestation_uid = claim(&mut oracle.id, EventKey(event_id));
    let attestation_id = attestation_uid.to_inner();
    let attestation = TriggerAttestation {
        id: attestation_uid,
        event_id,
        serial,
        occurred_at_ms,
        attested_at_ms,
        max_shindo,
        hypocenter,
        source_xml_blob,
        source_xml_hash,
    };
    event::emit(TriggerAttested {
        attestation_id,
        event_id: attestation.event_id,
        serial,
        max_shindo,
        occurred_at_ms,
        attested_at_ms,
    });
    transfer::share_object(attestation);
}

#[test_only]
public fun new_oracle_for_testing(enclave_id: ID, ctx: &mut TxContext): Oracle {
    Oracle { id: object::new(ctx), enclave_id, paused: false }
}

// === Accessors ===

public fun event_id(t: &TriggerAttestation): &vector<u8> { &t.event_id }
public fun serial(t: &TriggerAttestation): u32 { t.serial }
public fun occurred_at_ms(t: &TriggerAttestation): u64 { t.occurred_at_ms }
public fun attested_at_ms(t: &TriggerAttestation): u64 { t.attested_at_ms }
public fun max_shindo(t: &TriggerAttestation): &Shindo { &t.max_shindo }
public fun hypocenter(t: &TriggerAttestation): &Hypocenter { &t.hypocenter }
public fun source_xml_blob(t: &TriggerAttestation): &vector<u8> { &t.source_xml_blob }
public fun source_xml_hash(t: &TriggerAttestation): &vector<u8> { &t.source_xml_hash }

public fun oracle_paused(oracle: &Oracle): bool { oracle.paused }
public fun oracle_enclave_id(oracle: &Oracle): ID { oracle.enclave_id }
public fun oracle_intent_trigger(): u8 { INTENT_TRIGGER }
