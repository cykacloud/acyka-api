//! All four ways to hold a token, and the one thing they have in common.
//!
//! An access token lives an hour. A library that makes its caller notice that is
//! a library whose callers each write the same refresh-and-retry loop, slightly
//! differently — and one of them gets the concurrent case wrong and sends two
//! refreshes for one expiry, which, because refresh tokens here **rotate and a
//! reuse kills the family**, signs their users out. So the loop is written once
//! and `fresh()` is the whole of what the transport knows about auth.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::Mutex;

use crate::error::{Error, Result};

pub const AUTHORIZE: &str = "https://acyka.cc/api/oauth2/authorize";
pub const TOKEN: &str = "https://acyka.cc/api/oauth2/token";
pub const DEVICE: &str = "https://acyka.cc/api/oauth2/device_authorization";

/// Where the provider lives. Overridable for a laptop, fixed in practice.
#[derive(Debug, Clone)]
pub struct Endpoints {
    pub authorize: String,
    pub token: String,
    pub device: String,
}

impl Default for Endpoints {
    fn default() -> Self {
        Self {
            authorize: AUTHORIZE.to_owned(),
            token: TOKEN.to_owned(),
            device: DEVICE.to_owned(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Tokens {
    pub access_token: String,
    #[serde(default = "bearer")]
    pub token_type: String,
    #[serde(default = "an_hour")]
    pub expires_in: i64,
    #[serde(default)]
    pub scope: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
}

fn bearer() -> String {
    "Bearer".to_owned()
}

fn an_hour() -> i64 {
    3600
}

impl Tokens {
    pub fn scopes(&self) -> Vec<&str> {
        self.scope.split_whitespace().collect()
    }
}

/// A token set with the moment it stops being usable worked out.
#[derive(Debug, Clone)]
struct Held {
    tokens: Tokens,
    expires_at: u64,
}

fn seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

impl Held {
    fn of(tokens: Tokens) -> Self {
        // Sixty seconds early. A token that expires while a request is in flight
        // is a 401 the caller did nothing to deserve, and clock skew between two
        // machines is measured in seconds rather than milliseconds.
        let expires_at = seconds() + tokens.expires_in.max(60).saturating_sub(60) as u64;
        Self { tokens, expires_at }
    }

    fn live(&self) -> bool {
        !self.tokens.access_token.is_empty() && self.expires_at > seconds()
    }
}

/// What the transport asks of an auth.
///
/// A trait rather than an enum, so a caller with somewhere unusual to keep a
/// token — a secrets manager, another process — can write their own without
/// this crate having to have thought of it.
pub trait Auth: std::fmt::Debug + Send + Sync {
    /// A live access token, refreshed or minted if the held one has run out.
    fn fresh<'a>(&'a self) -> Pin<Box<dyn Future<Output = Result<String>> + Send + 'a>>;

    /// Throw away what is held, so the next call mints or refreshes.
    fn forget(&self);

    /// What was granted, if it is known yet.
    fn scopes(&self) -> Vec<String> {
        Vec::new()
    }
}

async fn exchange(
    endpoint: &str,
    form: &[(&str, &str)],
    id: &str,
    secret: Option<&str>,
) -> Result<Tokens> {
    let http = reqwest::Client::new();
    let mut request = http.post(endpoint).header(reqwest::header::ACCEPT, "application/json");

    let mut fields = form.to_vec();
    match secret {
        // `client_secret_basic` rather than the body. Both are in the spec and
        // the api takes either; a header is the one that does not end up in a
        // proxy's access log beside the request line.
        Some(secret) => request = request.basic_auth(id, Some(secret)),
        None => fields.push(("client_id", id)),
    }

    let response = request
        .form(&fields)
        .send()
        .await
        .map_err(Error::Unreachable)?;

    let status = response.status();
    let text = response.text().await.map_err(Error::Unreachable)?;

    if !status.is_success() {
        // The token endpoint speaks RFC 6749 rather than this api's own error
        // shape — `{"error": "invalid_grant"}` — because every OAuth library
        // ever written reads that field and nothing else.
        #[derive(Deserialize, Default)]
        struct Said {
            error: Option<String>,
            error_description: Option<String>,
        }
        let said: Said = serde_json::from_str(&text).unwrap_or_default();
        return Err(Error::Oauth {
            error: said.error.unwrap_or_else(|| format!("HTTP {status}")),
            description: said.error_description,
        });
    }

    serde_json::from_str(&text).map_err(Error::Malformed)
}

/// A token somebody else obtained and handed over.
///
/// No refresh: when it runs out it runs out, and the caller finds out with an
/// `Unauthorized` rather than having a credential swapped underneath them.
#[derive(Debug)]
pub struct BearerToken {
    token: Mutex<String>,
    granted: Vec<String>,
}

impl BearerToken {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            token: Mutex::new(token.into()),
            granted: Vec::new(),
        }
    }
}

impl Auth for BearerToken {
    fn fresh<'a>(&'a self) -> Pin<Box<dyn Future<Output = Result<String>> + Send + 'a>> {
        Box::pin(async move {
            let held = self.token.lock().await;
            if held.is_empty() {
                return Err(Error::Unauthorized(Default::default()));
            }
            Ok(held.clone())
        })
    }

    fn forget(&self) {
        // Nothing to forget: there is no way to get another, and clearing it
        // would turn one 401 into every call failing.
    }

    fn scopes(&self) -> Vec<String> {
        self.granted.clone()
    }
}

/// An application acting for itself.
///
/// No person, no consent screen, no refresh token — there is nothing to refresh,
/// because the application can ask for another whenever it likes.
///
/// Only the scopes that are about nobody can be held this way: `catalog:read`
/// and `people:read`. Asking for `lists:read` here is refused at the door rather
/// than minted and then refused by every route that reads it.
#[derive(Debug)]
pub struct AppOnly {
    client_id: String,
    client_secret: String,
    asked: Vec<String>,
    endpoints: Endpoints,
    held: Mutex<Option<Held>>,
}

impl AppOnly {
    pub fn new(client_id: impl Into<String>, client_secret: impl Into<String>) -> Self {
        Self {
            client_id: client_id.into(),
            client_secret: client_secret.into(),
            asked: vec!["catalog:read".to_owned()],
            endpoints: Endpoints::default(),
            held: Mutex::new(None),
        }
    }

    pub fn scopes(mut self, scopes: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.asked = scopes.into_iter().map(Into::into).collect();
        self
    }

    pub fn endpoints(mut self, endpoints: Endpoints) -> Self {
        self.endpoints = endpoints;
        self
    }
}

impl Auth for AppOnly {
    fn fresh<'a>(&'a self) -> Pin<Box<dyn Future<Output = Result<String>> + Send + 'a>> {
        Box::pin(async move {
            // Held across the exchange, so several tasks that all notice the
            // same expiry mint one token between them rather than one each.
            let mut held = self.held.lock().await;
            if let Some(live) = held.as_ref().filter(|h| h.live()) {
                return Ok(live.tokens.access_token.clone());
            }

            let scope = self.asked.join(" ");
            let mut form = vec![("grant_type", "client_credentials")];
            if !scope.is_empty() {
                form.push(("scope", scope.as_str()));
            }

            let tokens = exchange(
                &self.endpoints.token,
                &form,
                &self.client_id,
                Some(&self.client_secret),
            )
            .await?;
            let access = tokens.access_token.clone();
            *held = Some(Held::of(tokens));
            Ok(access)
        })
    }

    fn forget(&self) {
        // `try_lock`, because this is called from inside a request and blocking
        // there would deadlock against whoever is already refreshing — and if
        // somebody is, the token is being replaced anyway.
        if let Ok(mut held) = self.held.try_lock() {
            *held = None;
        }
    }

    fn scopes(&self) -> Vec<String> {
        self.asked.clone()
    }
}

/// Told whenever a token set is replaced, so a caller can put it somewhere.
///
/// A refresh token **rotates**: the one handed back is the one to keep, and the
/// one that was sent is dead. Storing the original for ever leaves a credential
/// that stops working — and presenting it again is what the server reads as
/// theft, which kills the whole chain.
pub type Keeper = Arc<dyn Fn(&Tokens) + Send + Sync>;

/// A token that acts for a person, kept alive by its refresh token.
///
/// The refresh is **serialised** by the mutex, which is the whole reason this is
/// a type rather than a helper: four requests that all notice the expiry at once
/// must send one refresh between them, because the tokens rotate and the second
/// would present one the first has already retired.
pub struct UserToken {
    client_id: String,
    client_secret: Option<String>,
    endpoints: Endpoints,
    held: Mutex<Held>,
    keep: Option<Keeper>,
}

impl std::fmt::Debug for UserToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // No token in it, and no secret. A `Debug` that prints a credential is a
        // credential in whatever log printed the struct.
        f.debug_struct("UserToken")
            .field("client_id", &self.client_id)
            .finish_non_exhaustive()
    }
}

impl UserToken {
    pub fn new(client_id: impl Into<String>, tokens: Tokens) -> Self {
        Self {
            client_id: client_id.into(),
            client_secret: None,
            endpoints: Endpoints::default(),
            held: Mutex::new(Held::of(tokens)),
            keep: None,
        }
    }

    pub fn secret(mut self, secret: impl Into<String>) -> Self {
        self.client_secret = Some(secret.into());
        self
    }

    pub fn keep(mut self, keep: Keeper) -> Self {
        self.keep = Some(keep);
        self
    }

    pub fn endpoints(mut self, endpoints: Endpoints) -> Self {
        self.endpoints = endpoints;
        self
    }

    /// What is held, for a caller that stores it themselves.
    pub async fn tokens(&self) -> Tokens {
        self.held.lock().await.tokens.clone()
    }
}

impl Auth for UserToken {
    fn fresh<'a>(&'a self) -> Pin<Box<dyn Future<Output = Result<String>> + Send + 'a>> {
        Box::pin(async move {
            let mut held = self.held.lock().await;
            if held.live() {
                return Ok(held.tokens.access_token.clone());
            }

            let Some(refresh) = held.tokens.refresh_token.clone() else {
                return Err(Error::Oauth {
                    error: "invalid_grant".to_owned(),
                    description: Some("no refresh token — ask for offline_access".to_owned()),
                });
            };

            let mut fresh = exchange(
                &self.endpoints.token,
                &[("grant_type", "refresh_token"), ("refresh_token", &refresh)],
                &self.client_id,
                self.client_secret.as_deref(),
            )
            .await?;

            // A refresh that answers without a new refresh token is one the
            // server did not rotate; keeping the old one is then right.
            if fresh.refresh_token.is_none() {
                fresh.refresh_token = Some(refresh);
            }

            let access = fresh.access_token.clone();
            if let Some(keep) = &self.keep {
                keep(&fresh);
            }
            *held = Held::of(fresh);
            Ok(access)
        })
    }

    fn forget(&self) {
        // The access token, not the refresh one: forgetting is what happens
        // after a 401, and the refresh is the only way back.
        if let Ok(mut held) = self.held.try_lock() {
            held.expires_at = 0;
        }
    }
}

/* ------------------------- getting a user's token -------------------------- */

fn b64(raw: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(raw)
}

/// A verifier and the challenge that goes with it, both from the same bytes.
#[derive(Debug, Clone)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

/// A fresh PKCE pair.
///
/// **S256 and never `plain`.** The api requires it of every client, confidential
/// ones included, and offers only `S256` in its discovery document — a code that
/// leaks from a log, a referer or a browser's history is then worth nothing
/// without the verifier, which never leaves the client that made it.
pub fn pkce() -> Pkce {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let verifier = b64(&bytes);
    let challenge = b64(&Sha256::digest(verifier.as_bytes()));
    Pkce {
        verifier,
        challenge,
    }
}

/// Where to send somebody, and the `state` to compare on the way back.
///
/// The state is returned rather than only taken, because a callback with nothing
/// to compare against is a callback anybody can forge — so it is generated when
/// it is not given, and there is no way to end up without one.
pub fn authorize_url(
    client_id: &str,
    redirect_uri: &str,
    scopes: &[&str],
    challenge: &str,
    state: Option<&str>,
    endpoints: &Endpoints,
) -> (String, String) {
    use rand::RngCore;
    let state = state.map(str::to_owned).unwrap_or_else(|| {
        let mut bytes = [0u8; 18];
        rand::thread_rng().fill_bytes(&mut bytes);
        b64(&bytes)
    });

    let query = serde_urlencoded::to_string([
        ("response_type", "code"),
        ("client_id", client_id),
        ("redirect_uri", redirect_uri),
        ("scope", &scopes.join(" ")),
        ("code_challenge", challenge),
        ("code_challenge_method", "S256"),
        ("state", &state),
    ])
    .unwrap_or_default();

    (format!("{}?{}", endpoints.authorize, query), state)
}

/// The code from the callback, for a token set.
pub async fn exchange_code(
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
    endpoints: &Endpoints,
) -> Result<Tokens> {
    exchange(
        &endpoints.token,
        &[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", verifier),
        ],
        client_id,
        client_secret,
    )
    .await
}

/// What a device shows on its screen while it waits.
#[derive(Debug, Clone, Deserialize)]
pub struct DeviceStart {
    pub device_code: String,
    /// the eight characters to put on the screen
    pub user_code: String,
    pub verification_uri: String,
    /// the same address with the code in it, for a QR
    #[serde(default)]
    pub verification_uri_complete: String,
    pub expires_in: i64,
    /// the floor, in seconds, the server asked to be polled at
    pub interval: u64,
}

/// Ask for a code to show on something with no browser.
pub async fn start_device(
    client_id: &str,
    client_secret: Option<&str>,
    scopes: &[&str],
    endpoints: &Endpoints,
) -> Result<DeviceStart> {
    let http = reqwest::Client::new();
    let scope = scopes.join(" ");
    let mut request = http
        .post(&endpoints.device)
        .header(reqwest::header::ACCEPT, "application/json");

    let mut form = vec![("scope", scope.as_str())];
    match client_secret {
        Some(secret) => request = request.basic_auth(client_id, Some(secret)),
        None => form.push(("client_id", client_id)),
    }

    let response = request.form(&form).send().await.map_err(Error::Unreachable)?;
    let status = response.status();
    let text = response.text().await.map_err(Error::Unreachable)?;

    if !status.is_success() {
        return Err(Error::Oauth {
            error: format!("HTTP {status}"),
            description: Some(text),
        });
    }
    serde_json::from_str(&text).map_err(Error::Malformed)
}

/// Wait for the person to say yes, then hand back their tokens.
///
/// The four names the server can answer with are the whole of what a poller
/// needs, and this reads all four: `authorization_pending` means keep going,
/// `slow_down` means keep going and wait longer, `access_denied` means somebody
/// pressed cancel, and `expired_token` means nobody pressed anything. A client
/// that cannot tell the first from the third polls into the expiry after the
/// answer has already arrived.
pub async fn await_device(
    client_id: &str,
    client_secret: Option<&str>,
    device_code: &str,
    interval: u64,
    endpoints: &Endpoints,
) -> Result<Tokens> {
    let mut wait = Duration::from_secs(interval.max(1));

    loop {
        tokio::time::sleep(wait).await;

        match exchange(
            &endpoints.token,
            &[
                (
                    "grant_type",
                    "urn:ietf:params:oauth:grant-type:device_code",
                ),
                ("device_code", device_code),
            ],
            client_id,
            client_secret,
        )
        .await
        {
            Ok(tokens) => return Ok(tokens),
            Err(Error::Oauth { error, description }) => match error.as_str() {
                "authorization_pending" => continue,
                // The server saying the interval was too short. Five seconds
                // more, as the RFC suggests, rather than doubling — this is a
                // person walking to their phone, not a backoff.
                "slow_down" => wait += Duration::from_secs(5),
                _ => return Err(Error::Oauth { error, description }),
            },
            Err(other) => return Err(other),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pkce_pair_is_the_challenge_of_its_own_verifier() {
        let pair = pkce();
        assert_eq!(pair.challenge, b64(&Sha256::digest(pair.verifier.as_bytes())));
        // 32 bytes, base64url with no padding
        assert_eq!(pair.verifier.len(), 43);
        assert!(!pair.verifier.contains('='));
        assert!(!pair.verifier.contains('+'));
        assert_ne!(pkce().verifier, pkce().verifier);
    }

    #[test]
    fn an_authorize_url_always_carries_a_state() {
        let (url, state) = authorize_url(
            "acy_x",
            "https://example.com/cb",
            &["openid", "profile"],
            "chal",
            None,
            &Endpoints::default(),
        );
        // Generated when it was not given, so there is no way to end up with a
        // callback that has nothing to compare against.
        assert!(!state.is_empty());
        assert!(url.contains(&format!("state={state}")));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("scope=openid+profile"));
    }

    /// A `Debug` that prints a credential is a credential in whatever log
    /// printed the struct.
    #[test]
    fn a_user_token_does_not_print_itself() {
        let auth = UserToken::new(
            "acy_x",
            Tokens {
                access_token: "acya_secret".into(),
                token_type: "Bearer".into(),
                expires_in: 3600,
                scope: "openid".into(),
                refresh_token: Some("acyr_secret".into()),
                id_token: None,
            },
        );
        let printed = format!("{auth:?}");
        assert!(!printed.contains("acya_secret"), "{printed}");
        assert!(!printed.contains("acyr_secret"), "{printed}");
    }

    #[test]
    fn a_token_is_treated_as_dead_a_minute_early() {
        // Clock skew between two machines is measured in seconds, and a token
        // that expires mid-flight is a 401 the caller did nothing to deserve.
        let held = Held::of(Tokens {
            access_token: "acya_x".into(),
            token_type: "Bearer".into(),
            expires_in: 30,
            scope: String::new(),
            refresh_token: None,
            id_token: None,
        });
        assert!(!held.live());
    }
}
