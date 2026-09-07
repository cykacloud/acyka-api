# acyka (C++)

A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
profiles, and the lists, shelves and writing of whoever authorised your
application.

Full documentation, with a playground: **[dev.acyka.cc](https://dev.acyka.cc)**

Header-only, C++20. One include and one `FetchContent` block is the whole
integration:

```cmake
include(FetchContent)
FetchContent_Declare(acyka
    GIT_REPOSITORY https://github.com/cykacloud/acyka-api.git
    GIT_TAG        v1.0.0
    SOURCE_SUBDIR  packages/cpp)
FetchContent_MakeAvailable(acyka)

target_link_libraries(your_app PRIVATE acyka::acyka)
```

It brings `nlohmann/json` — found if your project already has it, fetched if not,
because a library that always fetched would give you two copies — and libcurl for
the transport it ships.

## Looking things up

```cpp
#include <acyka/acyka.hpp>

int main() {
    auto acyka = acyka::client::app(std::getenv("ACYKA_ID"), std::getenv("ACYKA_SECRET"));

    acyka::ListTitlesRequest asking;
    asking.q = "frieren";
    asking.limit = 5;

    for (const auto& title : acyka.catalogue.list_titles(asking)) {
        std::cout << title.id << ' ' << title.title << '\n';
    }
}
```

Every read takes a request struct rather than a parameter list. `list_titles`
has eleven optional filters, and as arguments that is unreadable at the call
site and breaks the day a twelfth is added.

The token is minted when it is first needed and again when it expires. There is
nothing to store and nothing to refresh.

**Only `catalog:read` and `people:read` can be held this way.** Everything else
on this api is about a person, and an application speaking for itself has nobody
to act for.

## Every row

```cpp
acyka::ListTitlesRequest asking;
asking.genre = "Drama";
const auto all = acyka.catalogue.list_titles_all(asking);
```

It stops when a page comes back shorter than it asked for, rather than when
`total` is reached — the list can grow while it is being read, and counting
against a number from the first page walks off the end.

A vector rather than a lazy range, and that is a choice: a coroutine generator
would need C++23 or a dependency, and a callback would put you inside somebody
else's loop. Pass `on_page` if you cannot hold the whole list — return `false`
from it to stop.

## Acting for a person

```cpp
auto http = std::make_shared<acyka::curl_transport>();

// 1. before the redirect — keep `verifier` and `state` in the session
const auto pair = acyka::pkce();
const auto asked = acyka::authorize_url(
    client_id, "https://example.com/callback",
    {"openid", "profile", "lists:read", "offline_access"}, pair.challenge);

// 2. in the callback, after checking `state` matches what you stored
const auto tokens = acyka::exchange_code(
    *http, client_id, secret, code, "https://example.com/callback", pair.verifier);

// 3. and from then on
auto theirs = acyka::client::user(client_id, tokens, secret,
                                  [](const acyka::tokens& fresh) { save(fresh); });
const auto me = theirs.account.get_me();
```

`authorize_url` hands the `state` back rather than only taking one, because a
callback with nothing to compare against is a callback anybody can forge — so
there is no way to end up without it.

**Store what the keeper hands you.** Refresh tokens rotate: the one that comes
back is the one to keep, and presenting a retired one is what the server reads as
theft — it kills the whole chain and signs the person out of an application that
did nothing wrong. Threads that all notice the same expiry send one refresh
between them, because the mutex is held across the exchange.

## When it says no

One exception type per refusal, because the server answers a **phrase name and
never a sentence** — one screen can be read in five languages, so the set of
names is stable and enumerable in a way prose is not.

```cpp
try {
    acyka.library.list_my_list({});
} catch (const acyka::forbidden& refused) {
    // refreshing will not help: the token does not carry it
    std::cerr << "needs " << refused.scope().value_or("?") << '\n';
} catch (const acyka::rate_limited& refused) {
    std::cerr << "retry in " << refused.retry_after() << "s\n";
} catch (const acyka::error& refused) {
    if (!refused.retryable()) throw;
}
```

`refused.code()` is the name — `errors.oauthInsufficientScope` — for when you
want to show your own words. `acyka::unexpected` carries a status this library
has no type for, because a server that grows one is not something a client should
abort about.

## Pacing itself

Every answer carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`, and a 429 carries `Retry-After`. This client reads them and
waits exactly as long as the server asked. A 429, a 5xx and a socket that never
answered are retried; a request refused on its merits is not.

```cpp
acyka::options settings;
settings.retries = 3;                                   // 0 turns retrying off
settings.max_wait = std::chrono::seconds(65);           // past this it raises
settings.on_pace = [](const acyka::pace& seen) { gauge(seen.remaining); };

auto acyka = acyka::client::app(id, secret, {"catalog:read"}, settings);
std::cout << acyka.last_pace().remaining.value_or(-1) << '\n';
```

`max_wait` exists because sleeping a whole window inside one call looks exactly
like a hang to whoever is waiting on it.

## Webhooks

```cpp
try {
    const auto event = acyka::verify(raw_body, header, secret);
    if (event.event == "episode.aired") { /* … */ }
} catch (const acyka::bad_signature&) {
    return bad_request();
}
```

Three things this does that are easy to get wrong by hand: it signs over the
**raw** bytes, it compares in constant time, and it checks how old the delivery
is — the timestamp is inside the signed string precisely so a captured delivery
cannot be replayed a month later.

**The SHA-256 and HMAC are written out rather than linked.** OpenSSL would be
forced on everybody who takes this library, on every platform, to verify one
signature — and finding OpenSSL from CMake is itself a thing people lose
afternoons to. The price of writing it is `tests/hmac_test.cpp`, which checks it
against FIPS 180-4 and the HMAC cases in RFC 4231, including the 131-byte key
that catches an implementation forgetting to hash a long one.

## Bring your own HTTP

`http_transport` is an interface and libcurl is one implementation. A C++
project has already chosen its HTTP client, and a library that insists on a
second one either will not link or drags a duplicate TLS stack into the binary:

```cpp
class my_transport : public acyka::http_transport {
    acyka::http_response send(const acyka::http_request& request) override { /* … */ }
};

acyka::client acyka(std::make_shared<acyka::bearer_token>(token),
                    std::make_shared<my_transport>());
```

`-DACYKA_WITH_CURL=OFF` (or `ACYKA_NO_CURL`) leaves libcurl out entirely. It is
also what makes the tests here run without a socket.

## What is generated and what is not

The structs, the conversions, the request types and the namespaces come out of
`openapi.json`, which the server writes from annotations on its own handlers.

The transport, the four flows, the refresh, the backoff, the paginators, the
exception hierarchy, the SHA-256 and the webhook check are written by hand.

Two details the generator has to get right and does. Every `from_json` and
`to_json` is **declared** before any is defined — these are found by ordinary
lookup, so a `to_json` writing a `std::vector<Voice>` needs `to_json(Voice)`
visible where it is written, and the document lists `TitleCharacter` first;
without it the error lands on a line about `raw["voices"]` and says nothing about
ordering. And a field the server may leave out is `std::optional<T>` with no
default, because absent and zero are different answers.

## The wire is snake_case

`shikimori_id`, `title_orig`, `email_verified` — which is C++'s own convention
here too, so nothing is renamed in either direction.

## Licence

MIT.
