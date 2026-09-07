# @acyka/api

A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
profiles, and the lists, shelves and writing of whoever authorised your
application.

Full documentation, with a playground: **[dev.acyka.cc](https://dev.acyka.cc)**

```bash
bun add @acyka/api      # or npm / pnpm / yarn
```

Works anywhere there is `fetch` and `crypto.subtle`: Node 20+, Bun, Deno,
Cloudflare Workers, and browsers.

## Looking things up

A bot has nobody to sign in, so it acts for itself. Register an application at
[acyka.cc/settings/applications](https://acyka.cc/settings/applications), keep
it confidential, and allow it `catalog:read`.

```ts
import { Acyka } from '@acyka/api';

const acyka = Acyka.app({
  clientId: process.env.ACYKA_ID!,
  clientSecret: process.env.ACYKA_SECRET!
});

const found = await acyka.catalogue.listTitles({ q: 'frieren', limit: 5 });
for (const title of found.items) {
  console.log(title.id, title.title, title.year, title.score);
}

const one = await acyka.catalogue.getTitle({ id: 52991, lang: 'ru' });
const cast = await acyka.catalogue.titleCharacters({ id: 52991 });
```

The token is minted when it is first needed and again when it expires. There is
nothing to store and nothing to refresh.

**Only `catalog:read` and `people:read` can be held this way.** Everything else
on this api is about a person, and an application speaking for itself has nobody
to act for.

## Every row, without writing the loop

```ts
for await (const title of acyka.catalogue.listTitlesAll({ genre: 'Drama' })) {
  console.log(title.title);
}
```

It stops when a page comes back shorter than it asked for, rather than when
`total` is reached — the list can grow while it is being read, and counting
against a number from the first page walks off the end.

## Acting for a person

Send them through the authorization code flow. PKCE is required of every client
here, confidential ones included, and only `S256`:

```ts
import { Acyka, authorizeUrl, exchangeCode, pkce } from '@acyka/api';

// 1. before the redirect — keep `verifier` and `state` in the session
const { verifier, challenge } = await pkce();
const state = crypto.randomUUID();

redirect(authorizeUrl({
  clientId, redirectUri: 'https://example.com/callback',
  scopes: ['openid', 'profile', 'lists:read', 'offline_access'],
  challenge, state
}));

// 2. in the callback, after checking `state` matches what you stored
const tokens = await exchangeCode({ clientId, clientSecret, code, redirectUri, verifier });

// 3. and from then on
const theirs = Acyka.user({ clientId, clientSecret }, tokens, (fresh) => save(userId, fresh));
const me = await theirs.account.getMe();
await theirs.library.saveListEntry({
  shikimori_id: 52991,
  body: { title: 'Sousou no Frieren', status: 'watching', episode: 4 }
});
```

**Store what `keep` hands you.** Refresh tokens rotate: the one that comes back
is the one to keep, and presenting a retired one is what the server reads as
theft — it kills the whole chain and signs the person out of an application that
did nothing wrong. Concurrent requests that all notice the same expiry send one
refresh between them; that is why this is a class rather than a helper.

Ask for `offline_access` if you need to act while nobody is watching. Without
it there is no refresh token, which is the consent screen's decision and not
something a client can work around.

## Something with no browser

A television, a terminal, a set-top box:

```ts
import { awaitDevice, startDevice, Acyka } from '@acyka/api';

const started = await startDevice({ clientId, scopes: ['openid', 'lists:read'] });
console.log(`go to ${started.verification_uri} and type ${started.user_code}`);

const tokens = await awaitDevice({
  clientId, deviceCode: started.device_code, interval: started.interval
});
const theirs = Acyka.user({ clientId }, tokens);
```

`awaitDevice` reads all four of the answers the server can give while polling, so
it backs off when told to and stops when somebody presses cancel rather than
polling into the expiry.

## When it says no

Every refusal is a type, because the server answers a **phrase name and never a
sentence** — one screen can be read in five languages, so the set of names is
stable and enumerable in a way prose is not.

```ts
import { Forbidden, NotFound, RateLimited } from '@acyka/api';

try {
  await theirs.library.listMyList();
} catch (err) {
  if (err instanceof Forbidden) {
    // refreshing will not help: the token does not carry it
    console.log('needs the scope', err.scope);
  } else if (err instanceof NotFound) {
    // ...
  } else if (err instanceof RateLimited) {
    console.log('retry in', err.retryAfter, 'seconds');
  }
  throw err;
}
```

`err.code` is the name — `errors.oauthInsufficientScope` — for when you want to
show your own words.

## Pacing itself

Every answer carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`, and a 429 carries `Retry-After`. This client reads them and
waits exactly as long as the server asked, rather than guessing. A 429, a 5xx
and a socket that never answered are retried; a request refused on its merits is
not.

```ts
const acyka = Acyka.app(credentials, {
  retries: 3,        // 0 turns retrying off entirely
  maxWait: 65_000,   // past this a RateLimited is raised rather than slept through
  onPace: ({ remaining, reset }) => metrics.gauge('acyka.left', remaining)
});
```

`maxWait` exists because sleeping a whole window inside one `await` looks exactly
like a hang to whoever is waiting on it.

## Webhooks

Ask to be told, instead of asking. Register an endpoint on your application's
page, then:

```ts
import { verify, BadSignature } from '@acyka/api';

const raw = await request.text();     // the raw text, before any parsing

try {
  const event = await verify({
    body: raw,
    signature: request.headers.get('x-acyka-signature'),
    secret: process.env.ACYKA_WEBHOOK_SECRET!
  });
  if (event.event === 'episode.aired') { /* … */ }
} catch (err) {
  if (err instanceof BadSignature) return new Response(null, { status: 400 });
  throw err;
}
```

Three things this does that are easy to get wrong by hand: it signs over the
**raw** bytes, it compares in constant time, and it checks how old the delivery
is — the timestamp is inside the signed string precisely so that a captured
delivery cannot be replayed a month later.

## What is generated and what is not

The methods and the types come out of `openapi.json`, which the server writes
from annotations on its own handlers — so they are the server's shapes rather
than somebody's reading of a document, and a route that changes shape changes
this library in the same release.

The transport, the four OAuth flows, the refresh, the backoff, the paginators,
the error types and the webhook check are written by hand, because none of them
is a mechanical function of a document and all of them are the difference between
a client that is correct and one that is pleasant.

## The wire is snake_case

`shikimori_id`, `title_orig`, `email_verified`. Nothing here renames a field: a
client that quietly camelCased them would be one whose users cannot read the
reference, cannot paste a `curl` answer into a type, and cannot search the
documentation for what they are holding. Method names are camelCase, because
those are ours to name.

## Licence

MIT.
