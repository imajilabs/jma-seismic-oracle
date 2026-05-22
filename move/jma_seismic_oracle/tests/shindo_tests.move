// Copyright (c) imajilabs
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module jma_seismic_oracle::shindo_tests;

use jma_seismic_oracle::shindo;

#[test]
fun test_constructors_yield_expected_levels_and_bands() {
    let s0 = shindo::whole(0);
    assert!(shindo::level(&s0) == 0);
    assert!(shindo::band(&s0).is_none());

    let s4 = shindo::whole(4);
    assert!(shindo::level(&s4) == 4);
    assert!(shindo::band(&s4).is_none());

    let s7 = shindo::whole(7);
    assert!(shindo::level(&s7) == 7);
    assert!(shindo::band(&s7).is_none());

    let s5_lower = shindo::lower(5);
    assert!(shindo::level(&s5_lower) == 5);
    assert!(shindo::band(&s5_lower).is_some());

    let s6_upper = shindo::upper(6);
    assert!(shindo::level(&s6_upper) == 6);
    assert!(shindo::band(&s6_upper).is_some());
}

#[test]
fun test_rank_matches_x10_scale_used_offchain() {
    assert!(shindo::rank(&shindo::whole(0)) == 0);
    assert!(shindo::rank(&shindo::whole(1)) == 10);
    assert!(shindo::rank(&shindo::whole(2)) == 20);
    assert!(shindo::rank(&shindo::whole(3)) == 30);
    assert!(shindo::rank(&shindo::whole(4)) == 40);
    assert!(shindo::rank(&shindo::lower(5)) == 50);
    assert!(shindo::rank(&shindo::upper(5)) == 55);
    assert!(shindo::rank(&shindo::lower(6)) == 60);
    assert!(shindo::rank(&shindo::upper(6)) == 65);
    assert!(shindo::rank(&shindo::whole(7)) == 70);
}

#[test]
fun test_meets_threshold_basic_ordering() {
    let s3 = shindo::whole(3);
    let s5l = shindo::lower(5);
    let s5u = shindo::upper(5);
    let s6l = shindo::lower(6);
    let s7 = shindo::whole(7);

    assert!(shindo::meets_threshold(&s5u, &s5u));
    assert!(shindo::meets_threshold(&s5u, &s5l)); // 5強 meets 5弱
    assert!(!shindo::meets_threshold(&s5l, &s5u)); // 5弱 does NOT meet 5強
    assert!(shindo::meets_threshold(&s7, &s3));
    assert!(!shindo::meets_threshold(&s3, &s6l));
}

#[test]
fun test_5_lower_distinguished_from_5_upper() {
    // The whole point of the structured encoding — these must NOT compare equal.
    let s5l = shindo::lower(5);
    let s5u = shindo::upper(5);
    assert!(shindo::rank(&s5l) != shindo::rank(&s5u));
    assert!(shindo::rank(&s5l) < shindo::rank(&s5u));
}

#[test, expected_failure(abort_code = shindo::EInvalidShindo)]
fun test_rejects_3_with_upper_band() {
    // (3, Upper) — JMA doesn't define this
    let _ = shindo::upper(3);
}

#[test, expected_failure(abort_code = shindo::EInvalidShindo)]
fun test_rejects_3_with_lower_band() {
    let _ = shindo::lower(3);
}

#[test, expected_failure(abort_code = shindo::EInvalidShindo)]
fun test_rejects_5_with_no_band() {
    // (5, None) — JMA always subdivides 5 into 5弱 / 5強
    let _ = shindo::whole(5);
}

#[test, expected_failure(abort_code = shindo::EInvalidShindo)]
fun test_rejects_6_with_no_band() {
    let _ = shindo::whole(6);
}

#[test, expected_failure(abort_code = shindo::EInvalidShindo)]
fun test_rejects_7_with_lower_band() {
    // 7 is never subdivided
    let _ = shindo::lower(7);
}

#[test, expected_failure(abort_code = shindo::EInvalidShindo)]
fun test_rejects_level_8() {
    // JMA scale tops at 7
    let _ = shindo::whole(8);
}
