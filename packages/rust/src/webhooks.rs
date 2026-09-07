//! Checking that a delivery came from us.
//!
//! Thirty lines, every one of which is a line somebody gets wrong when they
//! write it themselves — which is why it is in the library rather than in the
//! documentation.
//!
//! The three that matter:
//!
//! - **the raw body, not a parsed one.** The signature covers the bytes that
//!   were sent. Parsing and re-serialising gives a different string the moment
//!   key order or number formatting differs, and the check then fails for good
//!   reasons that look like bad ones.
//! - **a constant-time compare.** `a == b` on bytes returns as soon as two
//!   differ, and how long that took measures how much of the signature was
//!   right — a hundred requests per byte, and a forgeable signature at the end
//!   of it. `Mac::verify_slice` does not.
//! - **the timestamp.** The signed string is `<t>.<body>`, so a captured
//!   delivery signs valid for ever unless somebody checks how old `t` is.

use std::time::{SystemTime, UNIX_EPOCH};

use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::Sha256;

/// A delivery that is not ours, or not this minute's.
#[derive(Debug, thiserror::Error)]
pub enum BadSignature {
    #[error("there was no signature header")]
    Missing,
    #[error("the header was not `t=…,v1=…`")]
    Shape,
    #[error("it is {age}s old, and the tolerance is {tolerance}s")]
    Stale { age: u64, tolerance: u64 },
    #[error("it does not match the body")]
    Mismatch,
    #[error("the body was not the shape a delivery has")]
    Malformed(#[source] serde_json::Error),
}

/// One thing that happened, as it arrives.
#[derive(Debug, Clone, Deserialize)]
pub struct Delivery<T> {
    /// which kind — `list.saved`, `episode.aired`, and five more
    pub event: String,
    /// the row that moved, in this door's snake_case
    pub data: T,
}

/// `t=1700000000,v1=<hex>` as its two halves.
fn parts(header: &str) -> Option<(u64, &str)> {
    let mut at: Option<u64> = None;
    let mut mac: Option<&str> = None;
    for piece in header.split(',') {
        let (key, value) = piece.split_once('=')?;
        match key.trim() {
            "t" => at = value.trim().parse().ok(),
            "v1" => mac = Some(value.trim()),
            _ => {}
        }
    }
    Some((at?, mac?))
}

/// The delivery, or a [`BadSignature`].
///
/// ```no_run
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// use acyka::webhooks::verify;
///
/// let body: &[u8] = b"{\"event\":\"episode.aired\",\"data\":{}}";
/// let event: acyka::webhooks::Delivery<serde_json::Value> =
///     verify(body, Some("t=1,v1=…"), "acyw_…", None)?;
/// println!("{}", event.event);
/// # Ok(())
/// # }
/// ```
pub fn verify<T: serde::de::DeserializeOwned>(
    body: &[u8],
    signature: Option<&str>,
    secret: &str,
    tolerance: Option<u64>,
) -> Result<Delivery<T>, BadSignature> {
    verify_at(body, signature, secret, tolerance, now())
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// The same check with the clock handed in, so the tests can be about the clock.
pub fn verify_at<T: serde::de::DeserializeOwned>(
    body: &[u8],
    signature: Option<&str>,
    secret: &str,
    tolerance: Option<u64>,
    seconds: u64,
) -> Result<Delivery<T>, BadSignature> {
    let header = signature.filter(|s| !s.is_empty()).ok_or(BadSignature::Missing)?;
    let (at, said) = parts(header).ok_or(BadSignature::Shape)?;

    let tolerance = tolerance.unwrap_or(300);
    // Both directions. A delivery from the future is a clock that is wrong, and
    // accepting it would mean accepting one whose `t` an attacker chose.
    let age = seconds.abs_diff(at);
    if age > tolerance {
        return Err(BadSignature::Stale { age, tolerance });
    }

    let expected = hex::decode(said).map_err(|_| BadSignature::Shape)?;

    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("any key length");
    mac.update(at.to_string().as_bytes());
    mac.update(b".");
    mac.update(body);
    mac.verify_slice(&expected).map_err(|_| BadSignature::Mismatch)?;

    serde_json::from_slice(body).map_err(BadSignature::Malformed)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "acyw_0123456789abcdef";
    const BODY: &[u8] = br#"{"event":"list.saved","data":{"shikimori_id":21}}"#;
    const NOW: u64 = 1_700_000_000;

    fn sign(body: &[u8], at: u64, secret: &str) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("key");
        mac.update(at.to_string().as_bytes());
        mac.update(b".");
        mac.update(body);
        format!("t={at},v1={}", hex::encode(mac.finalize().into_bytes()))
    }

    fn check(body: &[u8], header: Option<&str>) -> Result<Delivery<serde_json::Value>, BadSignature> {
        verify_at(body, header, SECRET, None, NOW)
    }

    #[test]
    fn a_delivery_that_is_ours_comes_back_parsed() {
        let event = check(BODY, Some(&sign(BODY, NOW, SECRET))).expect("verifies");
        assert_eq!(event.event, "list.saved");
        assert_eq!(event.data["shikimori_id"], 21);
    }

    #[test]
    fn a_body_edited_after_signing() {
        let header = sign(BODY, NOW, SECRET);
        let tampered = br#"{"event":"list.saved","data":{"shikimori_id":22}}"#;
        assert!(matches!(
            check(tampered, Some(&header)),
            Err(BadSignature::Mismatch)
        ));
    }

    #[test]
    fn a_signature_made_with_another_secret() {
        let header = sign(BODY, NOW, "acyw_someone_elses");
        assert!(matches!(check(BODY, Some(&header)), Err(BadSignature::Mismatch)));
    }

    /// The whole reason the timestamp is inside the signed string: signing the
    /// body alone gives a signature that never stops being valid.
    #[test]
    fn a_replay_of_a_real_delivery_from_an_hour_ago() {
        let header = sign(BODY, NOW - 3600, SECRET);
        assert!(matches!(
            check(BODY, Some(&header)),
            Err(BadSignature::Stale { age: 3600, .. })
        ));
    }

    #[test]
    fn a_delivery_from_the_future_which_is_a_clock_somebody_chose() {
        let header = sign(BODY, NOW + 3600, SECRET);
        assert!(matches!(check(BODY, Some(&header)), Err(BadSignature::Stale { .. })));
    }

    #[test]
    fn no_header_at_all() {
        assert!(matches!(check(BODY, None), Err(BadSignature::Missing)));
        assert!(matches!(check(BODY, Some("")), Err(BadSignature::Missing)));
    }

    #[test]
    fn a_header_in_some_other_shape() {
        for nonsense in ["deadbeef", "v1=deadbeef", "t=notanumber,v1=x"] {
            assert!(
                matches!(check(BODY, Some(nonsense)), Err(BadSignature::Shape)),
                "{nonsense} was accepted"
            );
        }
    }

    /// The constant-time compare's own case: right length, every byte wrong.
    #[test]
    fn a_signature_of_the_right_length_that_is_wrong() {
        let header = format!("t={NOW},v1={}", "0".repeat(64));
        assert!(matches!(check(BODY, Some(&header)), Err(BadSignature::Mismatch)));
    }

    #[test]
    fn the_tolerance_is_five_minutes_and_movable() {
        let older = sign(BODY, NOW - 310, SECRET);
        assert!(check(BODY, Some(&sign(BODY, NOW - 290, SECRET))).is_ok());
        assert!(check(BODY, Some(&older)).is_err());
        // a caller who knows their queue is slow can say so
        assert!(verify_at::<serde_json::Value>(BODY, Some(&older), SECRET, Some(600), NOW).is_ok());
    }
}
