//! The half of the client a document cannot generate, against a real socket.
//!
//! wiremock rather than a mocked `reqwest`: what is being tested is what happens
//! to headers, statuses and a body on the way through, and a fake that stands in
//! for the HTTP layer is a fake that cannot get those wrong in the way a real one
//! can.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use acyka::auth::Auth;
use acyka::{Acyka, Error, Options};
use serde_json::json;
use wiremock::matchers::{header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// A client pointed at a fake, with the retries a test wants.
async fn against(server: &MockServer, retries: u32) -> Acyka {
    Acyka::new(
        Arc::new(acyka::BearerToken::new("acya_test")),
        Options {
            base_url: server.uri(),
            retries,
            max_wait: Duration::from_secs(5),
            ..Options::default()
        },
    )
    .expect("a client")
}

fn a_title() -> serde_json::Value {
    json!({ "items": [{ "id": 52991, "title": "Sousou no Frieren", "kind": "tv", "episodes": 28 }], "total": 1 })
}

#[tokio::test]
async fn a_read_sends_the_token_and_parses_the_shape() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/titles"))
        .and(header("authorization", "Bearer acya_test"))
        .and(header("accept", "application/json"))
        .and(query_param("q", "frieren"))
        .respond_with(ResponseTemplate::new(200).set_body_json(a_title()))
        .expect(1)
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    let page = acyka
        .catalogue()
        .list_titles()
        .q("frieren")
        .send()
        .await
        .expect("a page");

    assert_eq!(page.total, Some(1));
    assert_eq!(page.items[0].title, "Sousou no Frieren");
    // A missing optional is `None` rather than a default: absent and zero are
    // different answers, and this api's own rules say a client must not collapse
    // them.
    assert_eq!(page.items[0].title_orig, None);
}

#[tokio::test]
async fn a_parameter_that_was_not_asked_for_is_not_sent() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/titles"))
        .respond_with(ResponseTemplate::new(200).set_body_json(a_title()))
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    acyka.catalogue().list_titles().offset(0).send().await.expect("a page");

    let asked = &server.received_requests().await.expect("requests")[0];
    let query = asked.url.query().unwrap_or_default();
    // `offset=0` is an answer and is sent; `limit`, never given, is absent —
    // a client that dropped falsy values would make `offset=0` unsendable.
    assert!(query.contains("offset=0"), "{query}");
    assert!(!query.contains("limit"), "{query}");
}

#[tokio::test]
async fn a_204_answers_nothing_rather_than_a_parse_error() {
    let server = MockServer::start().await;
    Mock::given(method("DELETE"))
        .and(path("/api/v1/lists/21"))
        .respond_with(ResponseTemplate::new(204))
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    acyka.library().remove_list_entry(21).send().await.expect("no body");
}

#[tokio::test]
async fn a_refusal_becomes_the_variant_that_says_what_to_do() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/lists"))
        .respond_with(ResponseTemplate::new(403).set_body_json(
            json!({ "message": "errors.oauthInsufficientScope", "scope": "lists:read" }),
        ))
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    let err = acyka.library().list_my_list().send().await.expect_err("refused");

    assert!(matches!(err, Error::Forbidden(_)));
    assert_eq!(err.code(), "errors.oauthInsufficientScope");
    // The name alone would leave a caller unable to say *which* scope, which is
    // the one thing they need in order to ask for it.
    assert_eq!(err.scope(), Some("lists:read"));
    // and refreshing will not help, so it is not worth retrying
    assert!(!err.retryable());
}

#[tokio::test]
async fn an_answer_that_is_not_json_still_becomes_the_right_variant() {
    // A proxy's own 502 is html, and a parse error there would tell the caller
    // nothing about what happened.
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/genres"))
        .respond_with(ResponseTemplate::new(502).set_body_string("<html>502</html>"))
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    let err = acyka.catalogue().list_genres().send().await.expect_err("refused");
    assert!(matches!(err, Error::Server { status: 502, .. }));
    assert!(err.retryable());
}

#[tokio::test]
async fn a_429_waits_as_long_as_retry_after_said_and_then_succeeds() {
    let server = MockServer::start().await;

    // wiremock has no scripted sequence, so the two answers are told apart by
    // how many have been served — which is also what proves the first was retried.
    let served = Arc::new(AtomicUsize::new(0));
    let count = served.clone();
    Mock::given(method("GET"))
        .and(path("/api/v1/genres"))
        .respond_with(move |_: &wiremock::Request| {
            if count.fetch_add(1, Ordering::SeqCst) == 0 {
                ResponseTemplate::new(429)
                    .insert_header("retry-after", "1")
                    .insert_header("x-ratelimit-remaining", "0")
                    .set_body_json(json!({ "message": "common.tooOften" }))
            } else {
                ResponseTemplate::new(200).set_body_json(json!({ "items": ["Drama"] }))
            }
        })
        .mount(&server)
        .await;

    let acyka = against(&server, 3).await;
    let started = Instant::now();
    let genres = acyka.catalogue().list_genres().send().await.expect("a list");
    let took = started.elapsed();

    assert_eq!(genres.items, vec!["Drama".to_owned()]);
    assert_eq!(served.load(Ordering::SeqCst), 2);
    // The server's own number rather than a guess: too little and it is refused
    // again, too much and the client sleeps for nothing.
    assert!(took >= Duration::from_millis(900), "{took:?}");
    assert!(took < Duration::from_secs(3), "{took:?}");
}

#[tokio::test]
async fn a_wait_past_the_ceiling_is_raised_rather_than_slept_through() {
    // Sleeping a whole window inside one await looks exactly like a hang to
    // whoever is waiting on it.
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/genres"))
        .respond_with(
            ResponseTemplate::new(429)
                .insert_header("retry-after", "60")
                .set_body_json(json!({ "message": "common.tooOften" })),
        )
        .expect(1)
        .mount(&server)
        .await;

    let acyka = against(&server, 3).await;
    let err = acyka.catalogue().list_genres().send().await.expect_err("refused");
    match err {
        Error::RateLimited { retry_after, .. } => assert_eq!(retry_after, 60),
        other => panic!("{other:?}"),
    }
}

#[tokio::test]
async fn the_pace_the_server_sets_is_readable_afterwards() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/genres"))
        .respond_with(
            ResponseTemplate::new(200)
                .insert_header("x-ratelimit-limit", "60")
                .insert_header("x-ratelimit-remaining", "58")
                .insert_header("x-ratelimit-reset", "31")
                .set_body_json(json!({ "items": [] })),
        )
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    acyka.catalogue().list_genres().send().await.expect("a list");

    let pace = acyka.pace();
    assert_eq!((pace.limit, pace.remaining, pace.reset), (Some(60), Some(58), Some(31)));
}

/// An auth that hands out a new token each time it is forgotten.
#[derive(Debug)]
struct Renewing {
    n: AtomicUsize,
}

impl Auth for Renewing {
    fn fresh<'a>(
        &'a self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = acyka::Result<String>> + Send + 'a>>
    {
        Box::pin(async move { Ok(format!("acya_{}", self.n.load(Ordering::SeqCst))) })
    }

    fn forget(&self) {
        self.n.fetch_add(1, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn a_token_that_expired_mid_flight_is_refreshed_once_and_retried_once() {
    let server = MockServer::start().await;
    let served = Arc::new(AtomicUsize::new(0));
    let count = served.clone();
    Mock::given(method("GET"))
        .and(path("/api/v1/me"))
        .respond_with(move |_: &wiremock::Request| {
            if count.fetch_add(1, Ordering::SeqCst) == 0 {
                ResponseTemplate::new(401).set_body_json(json!({ "message": "errors.unauthorized" }))
            } else {
                ResponseTemplate::new(200).set_body_json(json!({ "id": "1" }))
            }
        })
        .mount(&server)
        .await;

    let auth = Arc::new(Renewing { n: AtomicUsize::new(0) });
    let acyka = Acyka::new(
        auth.clone(),
        Options {
            base_url: server.uri(),
            retries: 0,
            ..Options::default()
        },
    )
    .expect("a client");

    acyka.account().get_me().send().await.expect("the account");

    assert_eq!(served.load(Ordering::SeqCst), 2);
    let asked = server.received_requests().await.expect("requests");
    let tokens: Vec<_> = asked
        .iter()
        .map(|r| r.headers.get("authorization").expect("header").to_str().expect("ascii"))
        .collect();
    assert_eq!(tokens, vec!["Bearer acya_0", "Bearer acya_1"]);
}

#[tokio::test]
async fn and_a_second_401_is_raised_rather_than_refreshed_again() {
    // The credential is wrong rather than stale; refreshing produces the same
    // one and the loop would never end.
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/me"))
        .respond_with(ResponseTemplate::new(401).set_body_json(json!({ "message": "errors.unauthorized" })))
        .expect(2)
        .mount(&server)
        .await;

    let auth = Arc::new(Renewing { n: AtomicUsize::new(0) });
    let acyka = Acyka::new(
        auth,
        Options {
            base_url: server.uri(),
            retries: 0,
            ..Options::default()
        },
    )
    .expect("a client");

    let err = acyka.account().get_me().send().await.expect_err("refused");
    assert!(matches!(err, Error::Unauthorized(_)));
}

#[tokio::test]
async fn paging_walks_every_row_and_stops_on_a_short_page() {
    use futures_util::TryStreamExt;

    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/titles"))
        .respond_with(|request: &wiremock::Request| {
            let query: std::collections::HashMap<_, _> = request.url.query_pairs().collect();
            let limit: usize = query.get("limit").and_then(|v| v.parse().ok()).unwrap_or(30);
            let offset: usize = query.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
            let rows: Vec<_> = (1..=25usize)
                .skip(offset)
                .take(limit)
                .map(|id| json!({ "id": id, "title": format!("t{id}"), "kind": "tv", "episodes": 12 }))
                .collect();
            // `total` is a lie on purpose: a loop that counted against it would
            // ask for a page that is not there.
            ResponseTemplate::new(200).set_body_json(json!({ "items": rows, "total": 4000 }))
        })
        .mount(&server)
        .await;

    let acyka = against(&server, 0).await;
    let mut rows = acyka.catalogue().list_titles().limit(10).stream();

    let mut seen = Vec::new();
    while let Some(title) = rows.try_next().await.expect("a row") {
        seen.push(title.id);
    }

    assert_eq!(seen, (1..=25).collect::<Vec<i64>>());
    // Three pages: ten, ten, five. The fourth is never asked for.
    assert_eq!(server.received_requests().await.expect("requests").len(), 3);
}
