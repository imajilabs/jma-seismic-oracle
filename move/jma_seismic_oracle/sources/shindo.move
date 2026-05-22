// Copyright (c) imajilabs
// SPDX-License-Identifier: Apache-2.0

/// JMA seismic intensity (震度) — typed encoding.
///
/// JMA's scale has 10 discrete values:
///   0, 1, 2, 3, 4, 5弱 (Lower 5), 5強 (Upper 5), 6弱 (Lower 6), 6強 (Upper 6), 7
///
/// Levels 0..=4 and 7 are not subdivided. Levels 5 and 6 are subdivided
/// into Lower (弱) and Upper (強). We encode this as a struct with an
/// `Option<Band>` field — `None` for the levels without sub-bands.
///
/// Construction goes through `new(level, band)` (or the `whole/lower/upper`
/// convenience helpers), which rejects invalid combinations like
/// `(3, Upper)` or `(6, None)` at runtime. Outside this module fields
/// are private — no other code can manufacture an invalid `Shindo`.
///
/// Use `meets_threshold(observed, threshold)` for threshold checks.
module jma_seismic_oracle::shindo;

// === Errors ===

const EInvalidShindo: u64 = 0;

// === Types ===

/// Sub-band classification — only present for levels 5 and 6.
public enum Band has copy, drop, store {
    /// 弱 — used for 5弱 and 6弱.
    Lower,
    /// 強 — used for 5強 and 6強.
    Upper,
}

/// JMA shindo value with structured (level, band) decomposition.
public struct Shindo has copy, drop, store {
    level: u8,
    band: Option<Band>,
}

// === Constructors ===

/// Build a `Shindo` from a level and an optional band. Aborts on any
/// (level, band) combination JMA doesn't define.
public fun new(level: u8, band: Option<Band>): Shindo {
    let valid = if (band.is_some()) {
        level == 5 || level == 6
    } else {
        level <= 4 || level == 7
    };
    assert!(valid, EInvalidShindo);
    Shindo { level, band }
}

/// Levels 0..=4 and 7 — no sub-band.
public fun whole(level: u8): Shindo { new(level, option::none()) }

/// 5弱 / 6弱.
public fun lower(level: u8): Shindo { new(level, option::some(Band::Lower)) }

/// 5強 / 6強.
public fun upper(level: u8): Shindo { new(level, option::some(Band::Upper)) }

// === Accessors ===

public fun level(s: &Shindo): u8 { s.level }

public fun band(s: &Shindo): &Option<Band> { &s.band }

// === Comparison ===

/// Sortable rank, on the same ×10 scale used in the off-chain SDK:
///   {whole 0..4, 7}        → 10*level
///   Lower(5/6)             → 10*level
///   Upper(5/6)             → 10*level + 5
///
/// e.g. rank(upper(5)) = 55, rank(lower(6)) = 60, rank(whole(7)) = 70.
public fun rank(s: &Shindo): u8 {
    let base = s.level * 10;
    if (s.band.is_some()) {
        match (s.band.borrow()) {
            Band::Lower => base,
            Band::Upper => base + 5,
        }
    } else {
        base
    }
}

/// Eligibility predicate — does the observed shindo meet or exceed the
/// configured threshold?
public fun meets_threshold(observed: &Shindo, threshold: &Shindo): bool {
    rank(observed) >= rank(threshold)
}
