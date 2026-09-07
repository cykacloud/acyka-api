//! A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
//! profiles, and the lists, shelves and writing of whoever authorised your
//! application.
//!
//! Full documentation, with a playground: <https://dev.acyka.cc>
//!
//! ```no_run
//! use acyka::Acyka;
//!
//! # async fn run() -> acyka::Result<()> {
//! // an application acting for itself: the catalogue, and public profiles
//! let acyka = Acyka::app("acy_…", "…")?;
//!
//! let found = acyka.catalogue().list_titles().q("frieren").limit(5).send().await?;
//! for title in found {
//!     println!("{} {}", title.id, title.title);
//! }
//! # Ok(())
//! # }
//! ```
//!
//! Everything under a namespace is generated from `openapi.json`, which the
//! server writes from annotations on its own handlers. Everything else — the
//! four OAuth flows, the token that renews itself, the backoff that reads the
//! server's own numbers, the paginators, one error variant per refusal, and the
//! webhook check — is written by hand, because none of it is a mechanical
//! function of a document and all of it is the difference between a client that
//! is correct and one that is pleasant.
//!
//! ## A read is a builder
//!
//! `list_titles` takes eleven optional filters. As arguments that is unreadable
//! at the call site and breaks the day a twelfth is added, so every read is a
//! struct that collects what it was given and a `send` that spends it — which is
//! also the only shape that can carry a paginator without repeating every
//! parameter twice.
//!
//! ```no_run
//! # use acyka::Acyka;
//! # use futures_util::TryStreamExt;
//! # async fn run() -> acyka::Result<()> {
//! # let acyka = Acyka::app("acy_…", "…")?;
//! let mut rows = acyka.catalogue().list_titles().genre("Drama").stream();
//! while let Some(title) = rows.try_next().await? {
//!     println!("{}", title.title);
//! }
//! # Ok(())
//! # }
//! ```
//!
//! ## The wire is snake_case
//!
//! `shikimori_id`, `title_orig`, `email_verified` — which is Rust's own
//! convention too, so nothing here is renamed in either direction.

#![forbid(unsafe_code)]
#![warn(missing_debug_implementations)]

pub mod auth;
pub mod core;
pub mod error;
pub mod models;
mod namespaces;
pub mod operations;
pub mod webhooks;

use std::sync::Arc;

pub use auth::{AppOnly, Auth, BearerToken, Endpoints, Tokens, UserToken};
pub use core::{Core, Options};
pub use error::{Error, Pace, Refusal, Result};
pub use models::*;

/// The client.
#[derive(Debug, Clone)]
pub struct Acyka {
    pub(crate) core: Core,
}

impl Acyka {
    /// A client over any [`Auth`], for a caller with somewhere unusual to keep a
    /// token.
    pub fn new(auth: Arc<dyn Auth>, options: Options) -> Result<Self> {
        Ok(Self {
            core: Core::new(auth, options)?,
        })
    }

    /// An application acting for itself — a bot, a cron, anything with no person
    /// in front of it. Mints on demand and stores nothing.
    ///
    /// Only `catalog:read` and `people:read` can be held this way: everything
    /// else on this api is about somebody, and a `client_credentials` token has
    /// nobody to act for.
    pub fn app(client_id: impl Into<String>, client_secret: impl Into<String>) -> Result<Self> {
        Self::new(
            Arc::new(AppOnly::new(client_id, client_secret)),
            Options::default(),
        )
    }

    /// A token that acts for a person, kept alive by its refresh token.
    ///
    /// Give it a [`auth::Keeper`] and store what it hands you: **refresh tokens
    /// rotate**, and presenting a retired one is what the server reads as theft
    /// — it kills the whole chain and signs the person out.
    pub fn user(client_id: impl Into<String>, tokens: Tokens) -> Result<Self> {
        Self::new(
            Arc::new(UserToken::new(client_id, tokens)),
            Options::default(),
        )
    }

    /// A token somebody else obtained. No refresh.
    pub fn token(access_token: impl Into<String>) -> Result<Self> {
        Self::new(Arc::new(BearerToken::new(access_token)), Options::default())
    }

    /// What the last answer said about this client's minute.
    pub fn pace(&self) -> Pace {
        self.core.pace()
    }
}
