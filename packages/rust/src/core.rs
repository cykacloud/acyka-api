//! One request, and everything that happens around it.
//!
//! The generated builders are thin on purpose — they name a path, a query and a
//! body, and hand all four of the interesting decisions here:
//!
//! - **waiting exactly as long as the server asked.** Every answer carries
//!   `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and a 429 carries
//!   `Retry-After`. A client that reads them sleeps the right amount; one that
//!   guesses either hammers the door or sleeps for no reason.
//! - **retrying only what is safe to retry.** A 429, a 5xx, and a socket that
//!   never answered — never a request that was refused on its merits.
//! - **refreshing once on a 401.** An access token lives an hour, so a
//!   long-running process will meet one expiring mid-request.
//! - **turning a body into the right variant.**

use std::sync::{Arc, Mutex};
use std::time::Duration;

use reqwest::{Method, StatusCode};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::auth::Auth;
use crate::error::{Error, Pace, Refusal, Result};

pub const BASE: &str = "https://api.acyka.cc";

/// A path segment, escaped.
///
/// `nickname` reaches a path and a nickname may hold anything a person typed,
/// so this is not decoration: a name with a `/` in it would otherwise address a
/// different route.
pub fn urlencode(value: &str) -> String {
    // The non-alphanumeric set, minus the three characters that are safe in a
    // segment and appear in real nicknames.
    value
        .bytes()
        .flat_map(|b| {
            if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
                vec![b as char]
            } else {
                format!("%{b:02X}").chars().collect()
            }
        })
        .collect()
}

#[derive(Debug, Clone)]
pub struct Options {
    pub base_url: String,
    pub timeout: Duration,
    /// how many times a retryable answer is retried; 0 turns it off entirely
    pub retries: u32,
    /// The longest this will ever sleep on a 429 before giving up.
    ///
    /// Without a ceiling, a client that has spent its minute and asked for a
    /// hundred pages sleeps the whole window inside one `await` — which looks
    /// exactly like a hang to whoever is waiting on it.
    pub max_wait: Duration,
    pub user_agent: String,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            base_url: BASE.to_owned(),
            timeout: Duration::from_secs(30),
            retries: 3,
            max_wait: Duration::from_secs(65),
            user_agent: concat!("acyka-api-rs/", env!("CARGO_PKG_VERSION")).to_owned(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Core {
    http: reqwest::Client,
    auth: Arc<dyn Auth>,
    options: Options,
    /// What the last answer said about the caller's minute.
    ///
    /// Kept here rather than returned beside every answer, because it is a fact
    /// about the client and not about the call: a caller watching its own budget
    /// wants to ask, and forty-three methods each returning a tuple would make
    /// every one of them worse to read.
    last: Arc<Mutex<Pace>>,
}

fn number(headers: &reqwest::header::HeaderMap, name: &str) -> Option<i64> {
    headers.get(name)?.to_str().ok()?.parse().ok()
}

impl Core {
    pub fn new(auth: Arc<dyn Auth>, options: Options) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(options.timeout)
            .build()
            .map_err(Error::Unreachable)?;
        Ok(Self {
            http,
            auth,
            options,
            last: Arc::new(Mutex::new(Pace::default())),
        })
    }

    /// What the caller's last answer said about their minute.
    pub fn pace(&self) -> Pace {
        *self.last.lock().expect("pace")
    }

    async fn once<B: Serialize + ?Sized>(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<&B>,
    ) -> Result<reqwest::Response> {
        let token = self.auth.fresh().await?;
        let mut request = self
            .http
            .request(method, format!("{}{}", self.options.base_url, path))
            .bearer_auth(token)
            .header(reqwest::header::ACCEPT, "application/json")
            .header(reqwest::header::USER_AGENT, &self.options.user_agent);

        if !query.is_empty() {
            request = request.query(query);
        }
        if let Some(body) = body {
            request = request.json(body);
        }

        request.send().await.map_err(Error::Unreachable)
    }

    /// A call that answers something, parsed.
    pub async fn call<T, B>(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<&B>,
    ) -> Result<T>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        let text = self.text(method, path, query, body).await?;
        serde_json::from_str(&text).map_err(Error::Malformed)
    }

    /// A call that answers 204, and therefore nothing.
    pub async fn nothing<B>(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<&B>,
    ) -> Result<()>
    where
        B: Serialize + ?Sized,
    {
        self.text(method, path, query, body).await.map(|_| ())
    }

    async fn text<B>(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<&B>,
    ) -> Result<String>
    where
        B: Serialize + ?Sized,
    {
        let mut refreshed = false;
        let mut attempt = 0u32;

        loop {
            let response = match self.once(method.clone(), path, query, body).await {
                Ok(response) => response,
                Err(err) => {
                    // Nothing answered. Worth one more go for the same reason a
                    // 5xx is — a dropped socket during a deploy is a gap, not a
                    // refusal.
                    if attempt < self.options.retries {
                        tokio::time::sleep(backoff(attempt)).await;
                        attempt += 1;
                        continue;
                    }
                    return Err(err);
                }
            };

            let status = response.status();
            let pace = Pace {
                limit: number(response.headers(), "x-ratelimit-limit"),
                remaining: number(response.headers(), "x-ratelimit-remaining"),
                reset: number(response.headers(), "x-ratelimit-reset"),
            };
            *self.last.lock().expect("pace") = pace;
            let retry_after = number(response.headers(), "retry-after").unwrap_or(0).max(0) as u64;

            if status.is_success() {
                return response.text().await.map_err(Error::Unreachable);
            }

            // A proxy's own 502 is html, and a parse error there would tell the
            // caller nothing about what happened.
            let said = response.text().await.unwrap_or_default();
            let refusal: Refusal = serde_json::from_str(&said).unwrap_or_default();

            if status == StatusCode::UNAUTHORIZED && !refreshed {
                refreshed = true;
                self.auth.forget();
                // A second 401 after this is the server saying the credential is
                // wrong rather than stale, and refreshing again would produce
                // the same one.
                if self.auth.fresh().await.is_ok() {
                    continue;
                }
                return Err(Error::Unauthorized(refusal));
            }

            let worth_retrying = status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error();
            if worth_retrying && attempt < self.options.retries {
                let wait = if status == StatusCode::TOO_MANY_REQUESTS {
                    // The server's own number rather than a guess: too little
                    // and it is refused again, too much and the client sleeps
                    // for nothing.
                    Duration::from_secs(retry_after.max(pace.reset.unwrap_or(1).max(1) as u64))
                } else {
                    backoff(attempt)
                };
                if wait <= self.options.max_wait {
                    tokio::time::sleep(wait).await;
                    attempt += 1;
                    continue;
                }
            }

            return Err(Error::from_status(
                status.as_u16(),
                refusal,
                retry_after.max(pace.reset.unwrap_or(0).max(0) as u64),
                pace,
            ));
        }
    }
}

fn backoff(attempt: u32) -> Duration {
    Duration::from_millis((250u64 << attempt.min(4)).min(4000))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_segment_is_escaped() {
        assert_eq!(urlencode("someone"), "someone");
        // A nickname is whatever a person typed, and a `/` in one would address
        // a different route entirely.
        assert_eq!(urlencode("a/b"), "a%2Fb");
        assert_eq!(urlencode("hello world"), "hello%20world");
        // and the three that are safe in a segment stay readable
        assert_eq!(urlencode("a-b_c.d~e"), "a-b_c.d~e");
    }

    #[test]
    fn the_backoff_climbs_and_then_holds() {
        let waits: Vec<u128> = (0..8).map(|n| backoff(n).as_millis()).collect();
        assert_eq!(waits[0], 250);
        for pair in waits.windows(2) {
            assert!(pair[1] >= pair[0], "the wait got shorter: {pair:?}");
        }
        assert_eq!(*waits.last().expect("some"), 4000);
    }
}
