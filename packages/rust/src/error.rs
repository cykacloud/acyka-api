//! One variant per refusal, out of a set the server keeps small on purpose.
//!
//! The api answers `{"message": "errors.oauthInsufficientScope"}` — a **phrase
//! name and never a sentence** — because one screen can be read in five
//! languages and the server does not get to choose which. For a client that is
//! not a limitation but the thing that makes a real enum possible: a stable,
//! enumerable set of names, instead of matching on prose that changes when
//! somebody rewrites a sentence.

use std::collections::BTreeMap;

use serde::Deserialize;

pub type Result<T> = std::result::Result<T, Error>;

/// The shape every refusal on this api takes.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Refusal {
    /// a phrase name, e.g. `errors.notFound`
    #[serde(default)]
    pub message: String,
    /// Extra fields a refusal owes a reason for — the missing scope, a ban's
    /// length. Flattened, because the server merges them in beside `message`.
    #[serde(flatten, default)]
    pub detail: BTreeMap<String, serde_json::Value>,
}

impl Refusal {
    /// A named string out of the extra fields, where there is one.
    pub fn field(&self, name: &str) -> Option<&str> {
        self.detail.get(name).and_then(|v| v.as_str())
    }
}

/// What the caller's minute looks like, off the headers every answer carries.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Pace {
    pub limit: Option<i64>,
    pub remaining: Option<i64>,
    /// seconds until the window turns
    pub reset: Option<i64>,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// No token, an expired one, or one whose application was switched off.
    #[error("unauthorized: {}", .0.message)]
    Unauthorized(Refusal),

    /// The token is good and does not carry what this endpoint wants.
    ///
    /// **Refreshing will not help**, which is why this is not `Unauthorized`:
    /// the refresh produces the same token with the same scopes and earns the
    /// same refusal.
    #[error("forbidden: {}", .0.message)]
    Forbidden(Refusal),

    #[error("not found: {}", .0.message)]
    NotFound(Refusal),

    #[error("refused: {}", .0.message)]
    BadRequest(Refusal),

    /// The minute is spent. `retry_after` is seconds, from the server's own
    /// header — this only reaches a caller when the retries are used up.
    #[error("too many requests, retry in {retry_after}s")]
    RateLimited {
        refusal: Refusal,
        retry_after: u64,
        pace: Pace,
    },

    #[error("server error {status}: {}", .refusal.message)]
    Server { status: u16, refusal: Refusal },

    /// A status this client has no name for, which is a server that has grown
    /// one — and a client that panicked on it would be worse than one that
    /// hands it over.
    #[error("unexpected status {status}: {}", .refusal.message)]
    Unexpected { status: u16, refusal: Refusal },

    /// The request never got an answer: a socket, a timeout, a proxy.
    #[error("could not reach the api")]
    Unreachable(#[source] reqwest::Error),

    /// The answer arrived and was not the shape the contract says.
    ///
    /// Its own variant rather than folded into `Unreachable`, because the two
    /// mean opposite things about what to do next: a socket is worth retrying
    /// and a shape that does not parse never will be.
    #[error("the api answered something this client could not read")]
    Malformed(#[source] serde_json::Error),

    #[error("the token endpoint refused: {error}")]
    Oauth {
        /// as RFC 6749 names it: `invalid_grant`, `invalid_scope`, and the rest
        error: String,
        description: Option<String>,
    },
}

impl Error {
    /// The phrase name, for a caller that wants to show its own words.
    pub fn code(&self) -> &str {
        match self {
            Self::Unauthorized(r)
            | Self::Forbidden(r)
            | Self::NotFound(r)
            | Self::BadRequest(r) => &r.message,
            Self::RateLimited { refusal, .. }
            | Self::Server { refusal, .. }
            | Self::Unexpected { refusal, .. } => &refusal.message,
            Self::Oauth { error, .. } => error,
            Self::Unreachable(_) => "errors.unreachable",
            Self::Malformed(_) => "errors.malformed",
        }
    }

    /// The scope a 403 named, where it named one.
    pub fn scope(&self) -> Option<&str> {
        match self {
            Self::Forbidden(r) => r.field("scope"),
            _ => None,
        }
    }

    /// Whether asking again could plausibly answer differently.
    pub fn retryable(&self) -> bool {
        matches!(
            self,
            Self::RateLimited { .. } | Self::Server { .. } | Self::Unreachable(_)
        )
    }

    pub(crate) fn from_status(status: u16, refusal: Refusal, retry_after: u64, pace: Pace) -> Self {
        match status {
            400 | 422 => Self::BadRequest(refusal),
            401 => Self::Unauthorized(refusal),
            403 => Self::Forbidden(refusal),
            404 => Self::NotFound(refusal),
            429 => Self::RateLimited {
                refusal,
                retry_after,
                pace,
            },
            500..=599 => Self::Server { status, refusal },
            _ => Self::Unexpected { status, refusal },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_refusal_keeps_the_fields_it_came_with() {
        let refusal: Refusal = serde_json::from_str(
            r#"{"message":"errors.oauthInsufficientScope","scope":"lists:write"}"#,
        )
        .expect("parses");
        let err = Error::from_status(403, refusal, 0, Pace::default());
        assert_eq!(err.code(), "errors.oauthInsufficientScope");
        // The name alone would leave a caller unable to say *which* scope, which
        // is the one thing they need in order to ask for it.
        assert_eq!(err.scope(), Some("lists:write"));
        assert!(!err.retryable());
    }

    #[test]
    fn a_refusal_with_nothing_but_a_status_still_has_a_name() {
        let err = Error::from_status(502, Refusal::default(), 0, Pace::default());
        assert!(matches!(err, Error::Server { status: 502, .. }));
        assert!(err.retryable());
    }

    /// A status nobody wrote a variant for is handed over rather than panicked
    /// on: it means the server grew one, which is not the client's to refuse.
    #[test]
    fn an_unknown_status_is_carried_rather_than_lost() {
        let err = Error::from_status(418, Refusal::default(), 0, Pace::default());
        assert!(matches!(err, Error::Unexpected { status: 418, .. }));
    }
}
