# acyka

The API, its documentation, and client libraries for six languages.

Everything here is generated from or written against one file: **`openapi.json`**,
which comes out of the server itself. `acyka-api spec` in
[`cykacloud/acyka`](https://github.com/cykacloud/acyka) writes it from
annotations that sit on the handlers, and a test there drives every path in it
against the real router — so a route that changes shape changes this file in the
same commit, and a path that does not exist cannot be described.

That is the whole reason six libraries are a build step rather than a
maintenance problem. Six hand-written clients reading one prose document start
disagreeing with it, and with each other, in the first month.

```
openapi.json          the contract, copied in by CI from the server's own output
tools/                the generator: one reader, six emitters
apps/docs             dev.acyka.cc — the guides, the reference, the playground
packages/typescript   @acyka/api
packages/python       acyka
packages/rust         acyka
packages/kotlin       cc.acyka:acyka
packages/csharp       Acyka
packages/cpp          acyka, header-only
```

## What is generated and what is not

**Generated:** the types, and one typed method per operation. Those are the parts
that are a mechanical function of the contract, and the parts a human writing
them by hand gets subtly wrong in six different ways.

**Written by hand, once per language:** the transport, and everything that makes
a client pleasant rather than merely correct —

- **the OAuth flows.** All four: the authorization code with PKCE, the refresh
  that rotates, `client_credentials` for a process with no person in it, and the
  device flow for something with no browser.
- **the token that renews itself.** An access token lives an hour. A library that
  makes its caller notice that is a library whose callers all write the same
  retry loop, slightly differently.
- **backing off on the numbers the server sends.** Every answer carries
  `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and the 429 carries
  `Retry-After`. A client that reads them waits exactly as long as it must; one
  that guesses either hammers the door or sleeps for no reason.
- **paginators.** `limit`/`offset` and a `total` is a loop everybody writes and
  somebody gets wrong at the last page.
- **one error type per refusal.** The server answers `{"message": "errors.x"}`
  where `errors.x` is a phrase name and never a sentence, because one screen can
  be read in five languages. That makes the set enumerable, so each language gets
  a real exception type per name instead of string matching.
- **verifying a webhook.** Constant-time, with the timestamp checked, because
  every one of these that is written by hand is written wrong once.

## Building it

```bash
bun install
bun run generate      # openapi.json -> the generated half of all six
bun run check         # types, in every language that has a checker here
bun test
```

The documentation app depends on `@cyka/ui`, which is a **private** repository —
so `apps/docs` will not install for anybody outside the org. Everything under
`packages/` will: the libraries have no dependency on it, and that is deliberate.
