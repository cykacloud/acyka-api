# acyka

A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
profiles, and the lists, shelves and writing of whoever authorised your
application.

Full documentation, with a playground: **[dev.acyka.cc](https://dev.acyka.cc)**

```toml
[dependencies]
acyka = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

rustls by default. A client library that drags in openssl makes the choice for
whoever depends on it, and cross-compiling then stops working for reasons that
have nothing to do with this crate — `native-tls` is there if you want it.

## Looking things up

```rust
use acyka::Acyka;

#[tokio::main]
async fn main() -> acyka::Result<()> {
    let acyka = Acyka::app(env!("ACYKA_ID"), env!("ACYKA_SECRET"))?;

    let found = acyka
        .catalogue()
        .list_titles()
        .q("frieren")
        .limit(5)
        .send()
        .await?;

    for title in found {
        println!("{} {} {:?}", title.id, title.title, title.score);
    }
    Ok(())
}
```

The token is minted when it is first needed and again when it expires. There is
nothing to store and nothing to refresh.

**Only `catalog:read` and `people:read` can be held this way.** Everything else
on this api is about a person, and an application speaking for itself has nobody
to act for.

## A read is a builder

`list_titles` takes eleven optional filters. As arguments that is unreadable at
the call site and breaks the day a twelfth is added — so every read is a struct
that collects what it was given and a `send` that spends it. It is also the only
shape that can carry a paginator without repeating every parameter twice:

```rust
use futures_util::TryStreamExt;

let mut rows = acyka.catalogue().list_titles().genre("Drama").stream();
while let Some(title) = rows.try_next().await? {
    println!("{}", title.title);
}
```

It stops when a page comes back shorter than it asked for, rather than when
`total` is reached — the list can grow while it is being read, and counting
against a number from the first page walks off the end. What comes back is
already `Unpin`, so there is nothing to pin.

## Acting for a person

```rust
use acyka::auth::{authorize_url, exchange_code, pkce, Endpoints};
use acyka::{Acyka, UserToken};

// 1. before the redirect — keep `verifier` and `state` in the session
let pair = pkce();
let (url, state) = authorize_url(
    CLIENT_ID,
    "https://example.com/callback",
    &["openid", "profile", "lists:read", "offline_access"],
    &pair.challenge,
    None,
    &Endpoints::default(),
);

// 2. in the callback, after checking `state` matches what you stored
let tokens = exchange_code(
    CLIENT_ID, Some(SECRET), &code,
    "https://example.com/callback", &pair.verifier,
    &Endpoints::default(),
).await?;

// 3. and from then on
let auth = UserToken::new(CLIENT_ID, tokens)
    .secret(SECRET)
    .keep(std::sync::Arc::new(|fresh| save(fresh)));
let theirs = Acyka::new(std::sync::Arc::new(auth), Default::default())?;

let me = theirs.account().get_me().send().await?;
```

`authorize_url` hands the `state` back rather than only taking one, because a
callback with nothing to compare against is a callback anybody can forge — so
there is no way to end up without it.

**Store what the keeper hands you.** Refresh tokens rotate: the one that comes
back is the one to keep, and presenting a retired one is what the server reads as
theft — it kills the whole chain and signs the person out of an application that
did nothing wrong. Tasks that all notice the same expiry send one refresh between
them, because the mutex is held across the exchange.

Ask for `offline_access` if you need to act while nobody is watching. Without it
there is no refresh token, which is the consent screen's decision.

## Something with no browser

```rust
use acyka::auth::{await_device, start_device, Endpoints};

let started = start_device(CLIENT_ID, None, &["openid", "lists:read"], &Endpoints::default()).await?;
println!("go to {} and type {}", started.verification_uri, started.user_code);

let tokens = await_device(
    CLIENT_ID, None, &started.device_code, started.interval, &Endpoints::default()
).await?;
```

## When it says no

One variant per refusal, because the server answers a **phrase name and never a
sentence** — one screen can be read in five languages, so the set of names is
stable and enumerable in a way prose is not.

```rust
use acyka::Error;

match acyka.library().list_my_list().send().await {
    Ok(page) => { /* … */ }
    // refreshing will not help: the token does not carry it
    Err(err @ Error::Forbidden(_)) => eprintln!("needs {:?}", err.scope()),
    Err(Error::RateLimited { retry_after, .. }) => eprintln!("retry in {retry_after}s"),
    Err(err) if err.retryable() => { /* worth another go */ }
    Err(err) => return Err(err),
}
```

`err.code()` is the name — `errors.oauthInsufficientScope` — for when you want
to show your own words. `Error::Unexpected` carries a status this crate has no
variant for, because a server that grows one is not something a client should
panic about.

## Pacing itself

Every answer carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`, and a 429 carries `Retry-After`. This client reads them and
waits exactly as long as the server asked. A 429, a 5xx and a socket that never
answered are retried; a request refused on its merits is not.

```rust
let acyka = Acyka::new(auth, acyka::Options {
    retries: 3,                                  // 0 turns retrying off
    max_wait: std::time::Duration::from_secs(65), // past this a RateLimited is raised
    ..Default::default()
})?;

let left = acyka.pace().remaining;
```

`max_wait` exists because sleeping a whole window inside one `await` looks
exactly like a hang to whoever is waiting on it.

## Webhooks

```rust
use acyka::webhooks::{verify, BadSignature, Delivery};

let event: Delivery<serde_json::Value> = match verify(
    &raw_body,                                  // the raw bytes, before any parsing
    headers.get("x-acyka-signature").and_then(|v| v.to_str().ok()),
    &std::env::var("ACYKA_WEBHOOK_SECRET")?,
    None,
) {
    Ok(event) => event,
    Err(BadSignature::Stale { .. }) => return bad_request(),
    Err(_) => return bad_request(),
};
```

Three things this does that are easy to get wrong by hand: it signs over the
**raw** bytes, it compares with `Mac::verify_slice` rather than `==`, and it
checks how old the delivery is — the timestamp is inside the signed string
precisely so a captured delivery cannot be replayed a month later.

## What is generated and what is not

The structs, the builders and the namespaces come out of `openapi.json`, which
the server writes from annotations on its own handlers.

The transport, the four flows, the refresh, the backoff, the paginators, the
error enum and the webhook check are written by hand — and tested against a real
socket, because what is being tested is what happens to headers, statuses and a
body on the way through.

Two details the generator has to get right and does: models are reached through
a path rather than glob-imported, so a builder named after an operation cannot
shadow a shape named after a thing — `title_staff` answers `TitleStaff`, and both
wanted the same name. And an optional field is `Option<T>` with no default:
absent and zero are different answers, and this api's own rules say a client must
not collapse them.

## The wire is snake_case

`shikimori_id`, `title_orig`, `email_verified` — which is Rust's own convention
too, so nothing here is renamed in either direction.

## Licence

MIT.
