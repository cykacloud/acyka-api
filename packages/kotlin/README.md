# acyka (Kotlin / JVM)

A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
profiles, and the lists, shelves and writing of whoever authorised your
application.

Full documentation, with a playground: **[dev.acyka.cc](https://dev.acyka.cc)**

```kotlin
dependencies {
    implementation("cc.acyka:acyka:1.0.0")
}
```

Kotlin 2.2, JVM 17 bytecode, coroutines and ktor. Usable from Java too — the
entry points carry `@JvmStatic` and `@JvmOverloads` — though a `suspend fun` is
a good deal pleasanter from Kotlin.

## Looking things up

```kotlin
val acyka = Acyka.app(clientId = System.getenv("ACYKA_ID"), clientSecret = System.getenv("ACYKA_SECRET"))

val found = acyka.catalogue.listTitles(q = "frieren", limit = 5)
found.forEach { println("${it.id} ${it.title} ${it.score}") }

val one = acyka.catalogue.getTitle(id = 52991, lang = "ru")
```

The token is minted when it is first needed and again when it expires. There is
nothing to store and nothing to refresh.

**Only `catalog:read` and `people:read` can be held this way.** Everything else
on this api is about a person, and an application speaking for itself has nobody
to act for.

## Every row, without writing the loop

```kotlin
acyka.catalogue.listTitlesAll(genre = "Drama").collect { println(it.title) }
```

It stops when a page comes back shorter than it asked for, rather than when
`total` is reached — the list can grow while it is being read, and counting
against a number from the first page walks off the end.

## Acting for a person

```kotlin
// 1. before the redirect — keep `verifier` and `state` in the session
val pair = pkce()
val asked = authorizeUrl(
    clientId = CLIENT_ID,
    redirectUri = "https://example.com/callback",
    scopes = listOf("openid", "profile", "lists:read", "offline_access"),
    challenge = pair.challenge,
)
redirect(asked.url)

// 2. in the callback, after checking `state` matches what you stored
val tokens = exchangeCode(
    clientId = CLIENT_ID, clientSecret = SECRET,
    code = code, redirectUri = "https://example.com/callback",
    verifier = pair.verifier,
)

// 3. and from then on
val theirs = Acyka.user(
    clientId = CLIENT_ID, clientSecret = SECRET, tokens = tokens,
    keep = { fresh -> save(userId, fresh) },
)
val me = theirs.account.getMe()
```

`authorizeUrl` hands the `state` back rather than only taking one, because a
callback with nothing to compare against is a callback anybody can forge — so
there is no way to end up without it.

**Store what the keeper hands you.** Refresh tokens rotate: the one that comes
back is the one to keep, and presenting a retired one is what the server reads as
theft — it kills the whole chain and signs the person out of an application that
did nothing wrong. Coroutines that all notice the same expiry send one refresh
between them, because the mutex is held across the exchange.

Ask for `offline_access` if you need to act while nobody is watching.

## Something with no browser

```kotlin
val started = startDevice(clientId = CLIENT_ID, scopes = listOf("openid", "lists:read"))
println("go to ${started.verificationUri} and type ${started.userCode}")

val tokens = awaitDevice(
    clientId = CLIENT_ID, deviceCode = started.deviceCode, interval = started.interval
)
```

## When it says no

One exception type per refusal, because the server answers a **phrase name and
never a sentence** — one screen can be read in five languages, so the set of
names is stable and enumerable in a way prose is not.

```kotlin
try {
    acyka.library.listMyList()
} catch (refused: Forbidden) {
    // refreshing will not help: the token does not carry it
    println("needs the scope ${refused.scope}")
} catch (refused: RateLimited) {
    println("retry in ${refused.retryAfter}s")
} catch (refused: AcykaException) {
    if (!refused.retryable) throw refused
}
```

`refused.code` is the name — `errors.oauthInsufficientScope` — for when you want
to show your own words. `Unexpected` carries a status this library has no type
for, because a server that grows one is not something a client should throw a
`ClassCastException` about.

## Pacing itself

Every answer carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`, and a 429 carries `Retry-After`. This client reads them and
waits exactly as long as the server asked. A 429, a 5xx and a socket that never
answered are retried; a request refused on its merits is not.

```kotlin
val acyka = Acyka.app(
    clientId = ..., clientSecret = ...,
    options = Options(
        retries = 3,             // 0 turns retrying off
        maxWaitMillis = 65_000,  // past this a RateLimited is raised
        onPace = { pace -> gauge("acyka.left", pace.remaining) },
    ),
)
println(acyka.pace.remaining)
```

`maxWaitMillis` exists because suspending for a whole window inside one call
looks exactly like a hang to whoever is waiting on it.

## Webhooks

```kotlin
val event = try {
    Webhooks.verify(
        body = call.receiveText(),                          // raw, before parsing
        signature = call.request.header("X-Acyka-Signature"),
        secret = System.getenv("ACYKA_WEBHOOK_SECRET"),
    )
} catch (bad: Webhooks.BadSignature) {
    return call.respond(HttpStatusCode.BadRequest)
}

if (event.event == "episode.aired") { /* … */ }
```

Three things this does that are easy to get wrong by hand: it signs over the
**raw** bytes, it compares in constant time, and it checks how old the delivery
is — the timestamp is inside the signed string precisely so a captured delivery
cannot be replayed a month later.

## What is generated and what is not

The data classes, the methods and the namespaces come out of `openapi.json`,
which the server writes from annotations on its own handlers.

The transport, the four flows, the refresh, the backoff, the paginators, the
exception hierarchy and the webhook check are written by hand — and tested
against ktor's fake engine, because what is being tested is what happens to
headers, statuses and a body on the way through.

Two details worth naming. `@SerialName` is on **every** field rather than only
where Kotlin and the wire disagree: the day a field arrives already camelCase it
would silently have no annotation, and nobody would notice until it disagreed.
And `explicitNulls = false` on the format, so an optional the caller did not set
is **left out** rather than sent as `null` — on this api absent and null are
different answers, and a body full of nulls would clear every field the caller
left alone.

## The wire is snake_case, the API is camelCase

`shikimori_id` on the wire is `shikimoriId` in Kotlin, and the reference at
[dev.acyka.cc](https://dev.acyka.cc) shows both. This is the one language here
where the two conventions genuinely differ, so it is also the one where the
mapping is written down on every field.

## Licence

MIT.
