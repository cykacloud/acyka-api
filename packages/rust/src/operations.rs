//! Generated from openapi.json by tools/generate.ts. Do not edit.

#![allow(clippy::too_many_arguments)]

use futures_util::TryStreamExt;
use reqwest::Method;

use crate::core::{urlencode, Core};
use crate::error::Result;
use crate::models;

/// It exists beside userinfo rather than instead of it because userinfo's shape
/// is fixed by the spec and this one is ours to grow.
///
/// `GET /api/v1/me`, needs `profile`
#[derive(Debug, Clone)]
pub struct GetMe<'a> {
    core: &'a Core,
}

impl<'a> GetMe<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Me> {
        let path = "/api/v1/me".to_owned();
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

/// A projection rather than a schedule: an ongoing series has no per-episode
/// timetable anywhere upstream, so the day of episode *n* is worked out from
/// the start date and a seven-day cadence. Irregular shows are wrong by a few
/// days and this says nothing about it, because a calendar that hid everything
/// it was not certain of would be an empty page most weeks. `out` is the part
/// that is not a projection — an episode a dub is already held for is playable
/// now, whatever the arithmetic says.
///
/// The site's `?mine=1` is not offered. It narrows to the reader's own shelf,
/// which is a second way of asking a question `/v1/lists` already answers, and
/// a filter that means nothing at all for an application speaking for itself.
///
/// `GET /api/v1/calendar`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct Calendar<'a> {
    core: &'a Core,
    lang: Option<String>,
}

impl<'a> Calendar<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Airing>> {
        let path = "/api/v1/calendar".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/characters/{id}/titles`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct CharacterTitles<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> CharacterTitles<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
            limit: None,
            offset: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Appearance>> {
        let path = format!("/api/v1/characters/{}/titles", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::Appearance>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// Whoever has voiced this character, once each, japanese first.
///
/// `GET /api/v1/characters/{id}/voices`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct CharacterVoices<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> CharacterVoices<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Voice>> {
        let path = format!("/api/v1/characters/{}/voices", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/characters/{id}`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct GetCharacter<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> GetCharacter<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Character> {
        let path = format!("/api/v1/characters/{}", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/people/{id}`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct GetPerson<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> GetPerson<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::PersonPage> {
        let path = format!("/api/v1/people/{}", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/titles/{id}`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct GetTitle<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> GetTitle<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Title> {
        let path = format!("/api/v1/titles/{}", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

/// The vocabulary the whole catalogue is described in.
///
/// `GET /api/v1/genres`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct ListGenres<'a> {
    core: &'a Core,
}

impl<'a> ListGenres<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<String>> {
        let path = "/api/v1/genres".to_owned();
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/titles`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct ListTitles<'a> {
    core: &'a Core,
    lang: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    q: Option<String>,
    order: Option<String>,
    status: Option<String>,
    kind: Option<String>,
    genre: Option<String>,
    score: Option<f64>,
    year_from: Option<i32>,
    year_to: Option<i32>,
    rating: Option<String>,
}

impl<'a> ListTitles<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            lang: None,
            limit: None,
            offset: None,
            q: None,
            order: None,
            status: None,
            kind: None,
            genre: None,
            score: None,
            year_from: None,
            year_to: None,
            rating: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// what to search for
    pub fn q(mut self, value: impl Into<String>) -> Self {
        self.q = Some(value.into());
        self
    }

    /// `ranked` by score, `aired_on` by year; by how watched it is otherwise
    pub fn order(mut self, value: impl Into<String>) -> Self {
        self.order = Some(value.into());
        self
    }

    /// `ongoing` | `released` | `announced`
    pub fn status(mut self, value: impl Into<String>) -> Self {
        self.status = Some(value.into());
        self
    }

    /// `tv` | `movie` | `ova` | `ona` | `special` | `music`
    pub fn kind(mut self, value: impl Into<String>) -> Self {
        self.kind = Some(value.into());
        self
    }

    /// comma-separated; every named genre must be on the title
    pub fn genre(mut self, value: impl Into<String>) -> Self {
        self.genre = Some(value.into());
        self
    }

    /// at least this
    pub fn score(mut self, value: impl Into<f64>) -> Self {
        self.score = Some(value.into());
        self
    }

    pub fn year_from(mut self, value: impl Into<i32>) -> Self {
        self.year_from = Some(value.into());
        self
    }

    pub fn year_to(mut self, value: impl Into<i32>) -> Self {
        self.year_to = Some(value.into());
        self
    }

    /// the age rating
    pub fn rating(mut self, value: impl Into<String>) -> Self {
        self.rating = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::TitleCard>> {
        let path = "/api/v1/titles".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        if let Some(value) = &self.q {
            query.push(("q", value.to_string()));
        }
        if let Some(value) = &self.order {
            query.push(("order", value.to_string()));
        }
        if let Some(value) = &self.status {
            query.push(("status", value.to_string()));
        }
        if let Some(value) = &self.kind {
            query.push(("kind", value.to_string()));
        }
        if let Some(value) = &self.genre {
            query.push(("genre", value.to_string()));
        }
        if let Some(value) = &self.score {
            query.push(("score", value.to_string()));
        }
        if let Some(value) = &self.year_from {
            query.push(("year_from", value.to_string()));
        }
        if let Some(value) = &self.year_to {
            query.push(("year_to", value.to_string()));
        }
        if let Some(value) = &self.rating {
            query.push(("rating", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::TitleCard>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// The other half of a voice actor: who they have played.
///
/// `GET /api/v1/people/{id}/characters`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct PersonCharacters<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> PersonCharacters<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
            limit: None,
            offset: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::VoicedRole>> {
        let path = format!("/api/v1/people/{}/characters", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::VoicedRole>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

///
/// `GET /api/v1/people/{id}/titles`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct PersonTitles<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> PersonTitles<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
            limit: None,
            offset: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Appearance>> {
        let path = format!("/api/v1/people/{}/titles", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::Appearance>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// One title, at random, out of the ones that can actually be watched here.
///
/// `GET /api/v1/titles/random`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct RandomTitle<'a> {
    core: &'a Core,
    lang: Option<String>,
}

impl<'a> RandomTitle<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::TitleCard> {
        let path = "/api/v1/titles/random".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

/// The title asked about is in the list rather than dropped from it, because
/// the one thing this shelf is for is saying where in a sequence somebody is —
/// `current` is what lets a client mark it in place.
///
/// `GET /api/v1/titles/{id}/related`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct RelatedTitles<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> RelatedTitles<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Related>> {
        let path = format!("/api/v1/titles/{}/related", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

/// A resource of its own rather than a kind inside one `/search`. The site has
/// a single search window because a person typing wants one box, and it answers
/// an object of six collections — a shape built for that window. An application
/// looking for a character wants characters, paged, and asking it to unwrap
/// five lists it did not want is the `?include=` this api does not have,
/// backwards.
///
/// `GET /api/v1/characters`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct SearchCharacters<'a> {
    core: &'a Core,
    q: Option<String>,
    lang: Option<String>,
    limit: Option<i64>,
}

impl<'a> SearchCharacters<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            q: None,
            lang: None,
            limit: None,
        }
    }

    /// what to search for
    pub fn q(mut self, value: impl Into<String>) -> Self {
        self.q = Some(value.into());
        self
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::CharacterCard>> {
        let path = "/api/v1/characters".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.q {
            query.push(("q", value.to_string()));
        }
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/people`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct SearchPeople<'a> {
    core: &'a Core,
    q: Option<String>,
    lang: Option<String>,
    limit: Option<i64>,
}

impl<'a> SearchPeople<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            q: None,
            lang: None,
            limit: None,
        }
    }

    /// what to search for
    pub fn q(mut self, value: impl Into<String>) -> Self {
        self.q = Some(value.into());
        self
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::PersonCard>> {
        let path = "/api/v1/people".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.q {
            query.push(("q", value.to_string()));
        }
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

/// The weighting is the whole of what makes this useful rather than "the twelve
/// most popular titles in the catalogue", and it is not a thing to have two of
/// — so this is `similar_to`, the same shelf `/similar` in Discord is.
///
/// `GET /api/v1/titles/{id}/similar`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct SimilarTitles<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> SimilarTitles<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::TitleCard>> {
        let path = format!("/api/v1/titles/{}/similar", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/titles/{id}/characters`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct TitleCharacters<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> TitleCharacters<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
            limit: None,
            offset: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::TitleCharacter>> {
        let path = format!("/api/v1/titles/{}/characters", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::TitleCharacter>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// **Not a list of episodes to watch, and deliberately not one.** Where a dub
/// can be played and by whom is `/video/streams`, which is somebody else's
/// files under somebody else's terms and is not on this door at all. This is
/// what the `shots` pass pulled onto our own storage, and an episode with no
/// frames is simply absent.
///
/// `GET /api/v1/titles/{id}/episodes`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct TitleEpisodes<'a> {
    core: &'a Core,
    id: i64,
}

impl<'a> TitleEpisodes<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Episode>> {
        let path = format!("/api/v1/titles/{}/episodes", self.id);
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/titles/{id}/screenshots`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct TitleScreenshots<'a> {
    core: &'a Core,
    id: i64,
}

impl<'a> TitleScreenshots<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<String>> {
        let path = format!("/api/v1/titles/{}/screenshots", self.id);
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/titles/{id}/staff`, needs `catalog:read`
#[derive(Debug, Clone)]
pub struct TitleStaff<'a> {
    core: &'a Core,
    id: i64,
    lang: Option<String>,
}

impl<'a> TitleStaff<'a> {
    pub(crate) fn new(core: &'a Core, id: i64) -> Self {
        Self {
            core,
            id,
            lang: None,
        }
    }

    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    pub fn lang(mut self, value: impl Into<String>) -> Self {
        self.lang = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::TitleStaff>> {
        let path = format!("/api/v1/titles/{}/staff", self.id);
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.lang {
            query.push(("lang", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `PUT /api/v1/collections/{code}/items/{shikimori_id}`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct AddCollectionItem<'a> {
    core: &'a Core,
    code: String,
    shikimori_id: i32,
    body: models::EntryBody,
}

impl<'a> AddCollectionItem<'a> {
    pub(crate) fn new(core: &'a Core, code: &str, shikimori_id: i32, body: models::EntryBody) -> Self {
        Self {
            core,
            code: code.to_owned(),
            shikimori_id,
            body,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::CollectionItem> {
        let path = format!("/api/v1/collections/{}/items/{}", urlencode(&self.code), self.shikimori_id);
        self.core.call(Method::PUT, &path, &[], Some(&self.body)).await
    }
}

///
/// `GET /api/v1/collections/{code}/items`, needs `lists:read`
#[derive(Debug, Clone)]
pub struct CollectionItems<'a> {
    core: &'a Core,
    code: String,
}

impl<'a> CollectionItems<'a> {
    pub(crate) fn new(core: &'a Core, code: &str) -> Self {
        Self {
            core,
            code: code.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::CollectionItem>> {
        let path = format!("/api/v1/collections/{}/items", urlencode(&self.code));
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `POST /api/v1/collections`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct CreateCollection<'a> {
    core: &'a Core,
    body: models::CollectionBody,
}

impl<'a> CreateCollection<'a> {
    pub(crate) fn new(core: &'a Core, body: models::CollectionBody) -> Self {
        Self {
            core,
            body,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Collection> {
        let path = "/api/v1/collections".to_owned();
        self.core.call(Method::POST, &path, &[], Some(&self.body)).await
    }
}

///
/// `GET /api/v1/collections/{code}`, needs `lists:read`
#[derive(Debug, Clone)]
pub struct GetCollection<'a> {
    core: &'a Core,
    code: String,
}

impl<'a> GetCollection<'a> {
    pub(crate) fn new(core: &'a Core, code: &str) -> Self {
        Self {
            core,
            code: code.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Collection> {
        let path = format!("/api/v1/collections/{}", urlencode(&self.code));
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/collections`, needs `lists:read`
#[derive(Debug, Clone)]
pub struct ListMyCollections<'a> {
    core: &'a Core,
}

impl<'a> ListMyCollections<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Collection>> {
        let path = "/api/v1/collections".to_owned();
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

/// It used to answer the whole thing, which is the bug this api's own rules
/// already name: a caller with four hundred titles got four hundred rows and a
/// caller with four thousand got four thousand, and the only reason nobody was
/// hurt by it is that nobody was using this door. `total` is beside the items
/// because the paging is by offset, which is exactly when a caller has to know
/// how far the list goes.
///
/// `GET /api/v1/lists`, needs `lists:read`
#[derive(Debug, Clone)]
pub struct ListMyList<'a> {
    core: &'a Core,
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> ListMyList<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            status: None,
            limit: None,
            offset: None,
        }
    }

    /// narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` |
    /// `done` | `dropped`
    pub fn status(mut self, value: impl Into<String>) -> Self {
        self.status = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::ListEntry>> {
        let path = "/api/v1/lists".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.status {
            query.push(("status", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::ListEntry>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// The same `plans::domain::rate` the site calls, so the two doors cannot come
/// to disagree about what a score is — which is the whole reason the domain
/// exists. What differs is what this surface always differs by: 404 where the
/// site answers 204 for a delete that removed nothing.
///
/// `PUT /api/v1/lists/{shikimori_id}/score`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct RateListEntry<'a> {
    core: &'a Core,
    shikimori_id: i32,
    body: models::ScoreBody,
}

impl<'a> RateListEntry<'a> {
    pub(crate) fn new(core: &'a Core, shikimori_id: i32, body: models::ScoreBody) -> Self {
        Self {
            core,
            shikimori_id,
            body,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::ListEntry> {
        let path = format!("/api/v1/lists/{}/score", self.shikimori_id);
        self.core.call(Method::PUT, &path, &[], Some(&self.body)).await
    }
}

///
/// `DELETE /api/v1/collections/{code}/items/{shikimori_id}`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct RemoveCollectionItem<'a> {
    core: &'a Core,
    code: String,
    shikimori_id: i32,
}

impl<'a> RemoveCollectionItem<'a> {
    pub(crate) fn new(core: &'a Core, code: &str, shikimori_id: i32) -> Self {
        Self {
            core,
            code: code.to_owned(),
            shikimori_id,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<()> {
        let path = format!("/api/v1/collections/{}/items/{}", urlencode(&self.code), self.shikimori_id);
        self.core.nothing(Method::DELETE, &path, &[], None::<&()>).await
    }
}

///
/// `DELETE /api/v1/lists/{shikimori_id}`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct RemoveListEntry<'a> {
    core: &'a Core,
    shikimori_id: i32,
}

impl<'a> RemoveListEntry<'a> {
    pub(crate) fn new(core: &'a Core, shikimori_id: i32) -> Self {
        Self {
            core,
            shikimori_id,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<()> {
        let path = format!("/api/v1/lists/{}", self.shikimori_id);
        self.core.nothing(Method::DELETE, &path, &[], None::<&()>).await
    }
}

///
/// `PUT /api/v1/lists/{shikimori_id}`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct SaveListEntry<'a> {
    core: &'a Core,
    shikimori_id: i32,
    body: models::ListBody,
}

impl<'a> SaveListEntry<'a> {
    pub(crate) fn new(core: &'a Core, shikimori_id: i32, body: models::ListBody) -> Self {
        Self {
            core,
            shikimori_id,
            body,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::ListEntry> {
        let path = format!("/api/v1/lists/{}", self.shikimori_id);
        self.core.call(Method::PUT, &path, &[], Some(&self.body)).await
    }
}

///
/// `DELETE /api/v1/lists/{shikimori_id}/score`, needs `lists:write`
#[derive(Debug, Clone)]
pub struct UnrateListEntry<'a> {
    core: &'a Core,
    shikimori_id: i32,
}

impl<'a> UnrateListEntry<'a> {
    pub(crate) fn new(core: &'a Core, shikimori_id: i32) -> Self {
        Self {
            core,
            shikimori_id,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<()> {
        let path = format!("/api/v1/lists/{}/score", self.shikimori_id);
        self.core.nothing(Method::DELETE, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/users/{nick}`, needs `people:read`
#[derive(Debug, Clone)]
pub struct GetUser<'a> {
    core: &'a Core,
    nick: String,
}

impl<'a> GetUser<'a> {
    pub(crate) fn new(core: &'a Core, nick: &str) -> Self {
        Self {
            core,
            nick: nick.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Profile> {
        let path = format!("/api/v1/users/{}", urlencode(&self.nick));
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

/// People by name.
///
/// `GET /api/v1/users`, needs `people:read`
#[derive(Debug, Clone)]
pub struct SearchUsers<'a> {
    core: &'a Core,
    q: Option<String>,
    limit: Option<i64>,
}

impl<'a> SearchUsers<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            q: None,
            limit: None,
        }
    }

    /// what to search for
    pub fn q(mut self, value: impl Into<String>) -> Self {
        self.q = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Person>> {
        let path = "/api/v1/users".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.q {
            query.push(("q", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }
}

///
/// `GET /api/v1/users/{nick}/collections`, needs `people:read`
#[derive(Debug, Clone)]
pub struct UserCollections<'a> {
    core: &'a Core,
    nick: String,
}

impl<'a> UserCollections<'a> {
    pub(crate) fn new(core: &'a Core, nick: &str) -> Self {
        Self {
            core,
            nick: nick.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Collection>> {
        let path = format!("/api/v1/users/{}/collections", urlencode(&self.nick));
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/users/{nick}/followers`, needs `people:read`
#[derive(Debug, Clone)]
pub struct UserFollowers<'a> {
    core: &'a Core,
    nick: String,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> UserFollowers<'a> {
    pub(crate) fn new(core: &'a Core, nick: &str) -> Self {
        Self {
            core,
            nick: nick.to_owned(),
            limit: None,
            offset: None,
        }
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Person>> {
        let path = format!("/api/v1/users/{}/followers", urlencode(&self.nick));
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::Person>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

///
/// `GET /api/v1/users/{nick}/following`, needs `people:read`
#[derive(Debug, Clone)]
pub struct UserFollowing<'a> {
    core: &'a Core,
    nick: String,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> UserFollowing<'a> {
    pub(crate) fn new(core: &'a Core, nick: &str) -> Self {
        Self {
            core,
            nick: nick.to_owned(),
            limit: None,
            offset: None,
        }
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Person>> {
        let path = format!("/api/v1/users/{}/following", urlencode(&self.nick));
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::Person>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// What somebody is watching, if their list is anybody's business.
///
/// `GET /api/v1/users/{nick}/lists`, needs `people:read`
#[derive(Debug, Clone)]
pub struct UserLists<'a> {
    core: &'a Core,
    nick: String,
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> UserLists<'a> {
    pub(crate) fn new(core: &'a Core, nick: &str) -> Self {
        Self {
            core,
            nick: nick.to_owned(),
            status: None,
            limit: None,
            offset: None,
        }
    }

    /// narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` |
    /// `done` | `dropped`
    pub fn status(mut self, value: impl Into<String>) -> Self {
        self.status = Some(value.into());
        self
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::ListEntry>> {
        let path = format!("/api/v1/users/{}/lists", urlencode(&self.nick));
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.status {
            query.push(("status", value.to_string()));
        }
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::ListEntry>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

///
/// `GET /api/v1/users/{nick}/stats`, needs `people:read`
#[derive(Debug, Clone)]
pub struct UserStats<'a> {
    core: &'a Core,
    nick: String,
}

impl<'a> UserStats<'a> {
    pub(crate) fn new(core: &'a Core, nick: &str) -> Self {
        Self {
            core,
            nick: nick.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Stats> {
        let path = format!("/api/v1/users/{}/stats", urlencode(&self.nick));
        self.core.call(Method::GET, &path, &[], None::<&()>).await
    }
}

///
/// `PUT /api/v1/following/{nickname}`, needs `social:write`
#[derive(Debug, Clone)]
pub struct FollowUser<'a> {
    core: &'a Core,
    nickname: String,
}

impl<'a> FollowUser<'a> {
    pub(crate) fn new(core: &'a Core, nickname: &str) -> Self {
        Self {
            core,
            nickname: nickname.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<()> {
        let path = format!("/api/v1/following/{}", urlencode(&self.nickname));
        self.core.nothing(Method::PUT, &path, &[], None::<&()>).await
    }
}

///
/// `GET /api/v1/following`, needs `social:read`
#[derive(Debug, Clone)]
pub struct ListMyFollowing<'a> {
    core: &'a Core,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> ListMyFollowing<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            limit: None,
            offset: None,
        }
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Person>> {
        let path = "/api/v1/following".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::Person>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

/// Not the feed: `social:read` is permission to read *this person's* social
/// life, not everybody's. A timeline of other people's writing is a different
/// question with a different answer about who may see what, and it is not
/// behind this word.
///
/// `GET /api/v1/posts`, needs `social:read`
#[derive(Debug, Clone)]
pub struct ListMyPosts<'a> {
    core: &'a Core,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl<'a> ListMyPosts<'a> {
    pub(crate) fn new(core: &'a Core) -> Self {
        Self {
            core,
            limit: None,
            offset: None,
        }
    }

    /// how many rows, 1-100; 30 by default
    pub fn limit(mut self, value: impl Into<i64>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// where to carry on from
    pub fn offset(mut self, value: impl Into<i64>) -> Self {
        self.offset = Some(value.into());
        self
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Page<models::Post>> {
        let path = "/api/v1/posts".to_owned();
        let mut query: Vec<(&str, String)> = Vec::new();
        if let Some(value) = &self.limit {
            query.push(("limit", value.to_string()));
        }
        if let Some(value) = &self.offset {
            query.push(("offset", value.to_string()));
        }
        self.core.call(Method::GET, &path, &query, None::<&()>).await
    }

    /// Every row, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    pub fn stream(self) -> impl futures_core::Stream<Item = Result<models::Post>> + Unpin + 'a {
        let window = self.limit.unwrap_or(100);
        let start = self.offset.unwrap_or(0);
        Box::pin(
        futures_util::stream::try_unfold(
            (self, start, false),
            move |(ask, at, done)| async move {
                if done {
                    return Ok(None);
                }
                let page = ask.clone().limit(window).offset(at).send().await?;
                let got = page.items.len() as i64;
                let last = got < window;
                Ok(Some((page.items, (ask, at + got, last))))
            },
        )
        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))
        .try_flatten(),
        )
    }
}

///
/// `DELETE /api/v1/following/{nickname}`, needs `social:write`
#[derive(Debug, Clone)]
pub struct UnfollowUser<'a> {
    core: &'a Core,
    nickname: String,
}

impl<'a> UnfollowUser<'a> {
    pub(crate) fn new(core: &'a Core, nickname: &str) -> Self {
        Self {
            core,
            nickname: nickname.to_owned(),
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<()> {
        let path = format!("/api/v1/following/{}", urlencode(&self.nickname));
        self.core.nothing(Method::DELETE, &path, &[], None::<&()>).await
    }
}

///
/// `POST /api/v1/posts`, needs `social:write`
#[derive(Debug, Clone)]
pub struct WritePost<'a> {
    core: &'a Core,
    body: models::PostBody,
}

impl<'a> WritePost<'a> {
    pub(crate) fn new(core: &'a Core, body: models::PostBody) -> Self {
        Self {
            core,
            body,
        }
    }

    /// Send it.
    pub async fn send(self) -> Result<models::Post> {
        let path = "/api/v1/posts".to_owned();
        self.core.call(Method::POST, &path, &[], Some(&self.body)).await
    }
}

/// the account a token acts for
#[derive(Debug, Clone)]
pub struct Account<'a> {
    pub(crate) core: &'a Core,
}

impl<'a> Account<'a> {

    /// The account, claim by claim, gated exactly as `/oauth2/userinfo` gates them.
    pub fn get_me(&self) -> GetMe<'a> {
        GetMe::new(self.core)
    }
}

/// titles, people, characters and what is airing
#[derive(Debug, Clone)]
pub struct Catalogue<'a> {
    pub(crate) core: &'a Core,
}

impl<'a> Catalogue<'a> {

    /// What comes out this week, and what just did.
    pub fn calendar(&self) -> Calendar<'a> {
        Calendar::new(self.core)
    }

    pub fn character_titles(&self, id: i64) -> CharacterTitles<'a> {
        CharacterTitles::new(self.core, id)
    }

    /// Whoever has voiced this character, once each, japanese first.
    pub fn character_voices(&self, id: i64) -> CharacterVoices<'a> {
        CharacterVoices::new(self.core, id)
    }

    pub fn get_character(&self, id: i64) -> GetCharacter<'a> {
        GetCharacter::new(self.core, id)
    }

    pub fn get_person(&self, id: i64) -> GetPerson<'a> {
        GetPerson::new(self.core, id)
    }

    pub fn get_title(&self, id: i64) -> GetTitle<'a> {
        GetTitle::new(self.core, id)
    }

    /// The vocabulary the whole catalogue is described in.
    pub fn list_genres(&self) -> ListGenres<'a> {
        ListGenres::new(self.core)
    }

    pub fn list_titles(&self) -> ListTitles<'a> {
        ListTitles::new(self.core)
    }

    /// The other half of a voice actor: who they have played.
    pub fn person_characters(&self, id: i64) -> PersonCharacters<'a> {
        PersonCharacters::new(self.core, id)
    }

    pub fn person_titles(&self, id: i64) -> PersonTitles<'a> {
        PersonTitles::new(self.core, id)
    }

    /// One title, at random, out of the ones that can actually be watched here.
    pub fn random_title(&self) -> RandomTitle<'a> {
        RandomTitle::new(self.core)
    }

    /// What it *is*, beside what it is like: the sequels, the films and the recaps
    /// `similar` throws away so a franchise cannot fill its own shelf.
    pub fn related_titles(&self, id: i64) -> RelatedTitles<'a> {
        RelatedTitles::new(self.core, id)
    }

    /// Characters by name.
    pub fn search_characters(&self) -> SearchCharacters<'a> {
        SearchCharacters::new(self.core)
    }

    pub fn search_people(&self) -> SearchPeople<'a> {
        SearchPeople::new(self.core)
    }

    /// What else somebody who liked this would watch.
    pub fn similar_titles(&self, id: i64) -> SimilarTitles<'a> {
        SimilarTitles::new(self.core, id)
    }

    pub fn title_characters(&self, id: i64) -> TitleCharacters<'a> {
        TitleCharacters::new(self.core, id)
    }

    /// The preview frames each episode has.
    pub fn title_episodes(&self, id: i64) -> TitleEpisodes<'a> {
        TitleEpisodes::new(self.core, id)
    }

    pub fn title_screenshots(&self, id: i64) -> TitleScreenshots<'a> {
        TitleScreenshots::new(self.core, id)
    }

    pub fn title_staff(&self, id: i64) -> TitleStaff<'a> {
        TitleStaff::new(self.core, id)
    }
}

/// other people, as far as they have agreed to be read
#[derive(Debug, Clone)]
pub struct People<'a> {
    pub(crate) core: &'a Core,
}

impl<'a> People<'a> {

    pub fn get_user(&self, nick: &str) -> GetUser<'a> {
        GetUser::new(self.core, nick)
    }

    /// People by name.
    pub fn search_users(&self) -> SearchUsers<'a> {
        SearchUsers::new(self.core)
    }

    pub fn user_collections(&self, nick: &str) -> UserCollections<'a> {
        UserCollections::new(self.core, nick)
    }

    pub fn user_followers(&self, nick: &str) -> UserFollowers<'a> {
        UserFollowers::new(self.core, nick)
    }

    pub fn user_following(&self, nick: &str) -> UserFollowing<'a> {
        UserFollowing::new(self.core, nick)
    }

    /// What somebody is watching, if their list is anybody's business.
    pub fn user_lists(&self, nick: &str) -> UserLists<'a> {
        UserLists::new(self.core, nick)
    }

    pub fn user_stats(&self, nick: &str) -> UserStats<'a> {
        UserStats::new(self.core, nick)
    }
}

/// somebody's own list and shelves
#[derive(Debug, Clone)]
pub struct Library<'a> {
    pub(crate) core: &'a Core,
}

impl<'a> Library<'a> {

    pub fn add_collection_item(&self, code: &str, shikimori_id: i32, body: models::EntryBody) -> AddCollectionItem<'a> {
        AddCollectionItem::new(self.core, code, shikimori_id, body)
    }

    pub fn collection_items(&self, code: &str) -> CollectionItems<'a> {
        CollectionItems::new(self.core, code)
    }

    pub fn create_collection(&self, body: models::CollectionBody) -> CreateCollection<'a> {
        CreateCollection::new(self.core, body)
    }

    pub fn get_collection(&self, code: &str) -> GetCollection<'a> {
        GetCollection::new(self.core, code)
    }

    pub fn list_my_collections(&self) -> ListMyCollections<'a> {
        ListMyCollections::new(self.core)
    }

    /// The list, a page at a time.
    pub fn list_my_list(&self) -> ListMyList<'a> {
        ListMyList::new(self.core)
    }

    /// What somebody thought of a title, through a token.
    pub fn rate_list_entry(&self, shikimori_id: i32, body: models::ScoreBody) -> RateListEntry<'a> {
        RateListEntry::new(self.core, shikimori_id, body)
    }

    pub fn remove_collection_item(&self, code: &str, shikimori_id: i32) -> RemoveCollectionItem<'a> {
        RemoveCollectionItem::new(self.core, code, shikimori_id)
    }

    pub fn remove_list_entry(&self, shikimori_id: i32) -> RemoveListEntry<'a> {
        RemoveListEntry::new(self.core, shikimori_id)
    }

    pub fn save_list_entry(&self, shikimori_id: i32, body: models::ListBody) -> SaveListEntry<'a> {
        SaveListEntry::new(self.core, shikimori_id, body)
    }

    pub fn unrate_list_entry(&self, shikimori_id: i32) -> UnrateListEntry<'a> {
        UnrateListEntry::new(self.core, shikimori_id)
    }
}

/// their writing, and who they read
#[derive(Debug, Clone)]
pub struct Social<'a> {
    pub(crate) core: &'a Core,
}

impl<'a> Social<'a> {

    pub fn follow_user(&self, nickname: &str) -> FollowUser<'a> {
        FollowUser::new(self.core, nickname)
    }

    pub fn list_my_following(&self) -> ListMyFollowing<'a> {
        ListMyFollowing::new(self.core)
    }

    /// The caller's own posts.
    pub fn list_my_posts(&self) -> ListMyPosts<'a> {
        ListMyPosts::new(self.core)
    }

    pub fn unfollow_user(&self, nickname: &str) -> UnfollowUser<'a> {
        UnfollowUser::new(self.core, nickname)
    }

    pub fn write_post(&self, body: models::PostBody) -> WritePost<'a> {
        WritePost::new(self.core, body)
    }
}
