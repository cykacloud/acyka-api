# acyka

A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
profiles, and the lists, shelves and writing of whoever authorised your
application.

Full documentation, with a playground: **[dev.acyka.cc](https://dev.acyka.cc)**

```bash
pip install acyka
```

Python 3.11+. One dependency, `httpx`, and both a synchronous and an awaited
client.

## Looking things up

A bot has nobody to sign in, so it acts for itself. Register an application at
[acyka.cc/settings/applications](https://acyka.cc/settings/applications), keep
it confidential, and allow it `catalog:read`.

```python
import os
from acyka import Acyka

with Acyka.app(
    client_id=os.environ["ACYKA_ID"],
    client_secret=os.environ["ACYKA_SECRET"],
) as acyka:
    found = acyka.catalogue.list_titles(q="frieren", limit=5)
    for title in found:
        print(title.id, title.title, title.year, title.score)

    one = acyka.catalogue.get_title(id=52991, lang="ru")
    print(one.description)
```

Everything is a frozen dataclass, so it is `title.title` rather than
`title["title"]`, an editor can complete it, and a traceback prints something
readable.

The token is minted when it is first needed and again when it expires. There is
nothing to store and nothing to refresh.

**Only `catalog:read` and `people:read` can be held this way.** Everything else
on this api is about a person, and an application speaking for itself has nobody
to act for.

## Every row, without writing the loop

```python
for title in acyka.catalogue.list_titles_all(genre="Drama"):
    print(title.title)
```

It stops when a page comes back shorter than it asked for, rather than when
`total` is reached — the list can grow while it is being read, and counting
against a number from the first page walks off the end.

## Awaited, for the same api

```python
import asyncio
from acyka import AsyncAcyka

async def main():
    async with AsyncAcyka.app(client_id=..., client_secret=...) as acyka:
        page = await acyka.catalogue.list_titles(q="frieren")
        async for title in acyka.catalogue.list_titles_all(genre="Drama"):
            print(title.title)

asyncio.run(main())
```

Two classes rather than one with a flag, because every line that differs is a
line that has to be awaited — and a client that pretended otherwise would block
an event loop inside a sleep.

## Acting for a person

```python
from acyka import Acyka, authorize_url, exchange_code, pkce

# 1. before the redirect — keep `verifier` and `state` in the session
pair = pkce()
url, state = authorize_url(
    client_id=CLIENT_ID,
    redirect_uri="https://example.com/callback",
    scopes=["openid", "profile", "lists:read", "offline_access"],
    challenge=pair.challenge,
)

# 2. in the callback, after checking `state` matches what you stored
tokens = exchange_code(
    client_id=CLIENT_ID, client_secret=SECRET,
    code=code, redirect_uri="https://example.com/callback",
    verifier=pair.verifier,
)

# 3. and from then on
theirs = Acyka.user(
    client_id=CLIENT_ID, client_secret=SECRET, tokens=tokens,
    keep=lambda fresh: save(user_id, fresh),
)
me = theirs.account.get_me()
```

`authorize_url` hands the `state` back rather than only taking one, because a
callback with nothing to compare against is a callback anybody can forge — so
there is no way to end up without it.

**Store what `keep` hands you.** Refresh tokens rotate: the one that comes back
is the one to keep, and presenting a retired one is what the server reads as
theft — it kills the whole chain and signs the person out of an application that
did nothing wrong. Concurrent calls that all notice the same expiry send one
refresh between them.

Ask for `offline_access` if you need to act while nobody is watching. Without it
there is no refresh token, which is the consent screen's decision.

## Something with no browser

```python
from acyka import Acyka, await_device, start_device

started = start_device(client_id=CLIENT_ID, scopes=["openid", "lists:read"])
print(f"go to {started.verification_uri} and type {started.user_code}")

tokens = await_device(
    client_id=CLIENT_ID, device_code=started.device_code, interval=started.interval
)
theirs = Acyka.user(client_id=CLIENT_ID, tokens=tokens)
```

## When it says no

Every refusal is an exception type, because the server answers a **phrase name
and never a sentence** — one screen can be read in five languages, so the set of
names is stable and enumerable in a way prose is not.

```python
from acyka import Forbidden, NotFound, RateLimited

try:
    acyka.library.list_my_list()
except Forbidden as err:
    # refreshing will not help: the token does not carry it
    print("needs the scope", err.scope)
except NotFound:
    ...
except RateLimited as err:
    print("retry in", err.retry_after, "seconds")
```

`err.code` is the name — `errors.oauthInsufficientScope` — for when you want to
show your own words.

## Pacing itself

Every answer carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`, and a 429 carries `Retry-After`. This client reads them and
waits exactly as long as the server asked, rather than guessing. A 429, a 5xx and
a socket that never answered are retried; a request refused on its merits is not.

```python
from acyka import Acyka, Options

acyka = Acyka.app(
    client_id=..., client_secret=...,
    options=Options(
        retries=3,        # 0 turns retrying off entirely
        max_wait=65.0,    # past this a RateLimited is raised rather than slept through
        on_pace=lambda pace: gauge("acyka.left", pace.remaining),
    ),
)
```

`max_wait` exists because sleeping a whole window inside one call looks exactly
like a hang to whoever is waiting on it.

## Webhooks

```python
import os
from acyka import BadSignature, verify

@app.post("/acyka/hook")
def hook():
    try:
        event = verify(
            body=request.get_data(),           # the raw bytes, before any parsing
            signature=request.headers.get("X-Acyka-Signature"),
            secret=os.environ["ACYKA_WEBHOOK_SECRET"],
        )
    except BadSignature:
        return "", 400

    if event.event == "episode.aired":
        ...
    return "", 204
```

Three things this does that are easy to get wrong by hand: it signs over the
**raw** bytes, it compares with `hmac.compare_digest`, and it checks how old the
delivery is — the timestamp is inside the signed string precisely so that a
captured delivery cannot be replayed a month later.

## What is generated and what is not

The methods, the dataclasses and their parsers come out of `openapi.json`, which
the server writes from annotations on its own handlers — so they are the
server's shapes rather than somebody's reading of a document.

The transport, the four OAuth flows, the refresh, the backoff, the paginators,
the exceptions and the webhook check are written by hand.

The parsers are generated rather than delegated to pydantic, which would be the
largest thing in the package by an order of magnitude for a job that is one
`cls(...)` call per shape.

## The wire is snake_case

`shikimori_id`, `title_orig`, `email_verified` — which is also Python's own
convention, so nothing here is renamed in either direction.

## Licence

MIT.
