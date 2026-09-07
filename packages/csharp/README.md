# Acyka

A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
profiles, and the lists, shelves and writing of whoever authorised your
application.

Full documentation, with a playground: **[dev.acyka.cc](https://dev.acyka.cc)**

```bash
dotnet add package Acyka
```

`net8.0` and `net10.0`. A client library that only builds on the newest runtime
is a client library half its users cannot take.

## Looking things up

```csharp
using Acyka;

var acyka = AcykaClient.App(
    Environment.GetEnvironmentVariable("ACYKA_ID")!,
    Environment.GetEnvironmentVariable("ACYKA_SECRET")!);

var found = await acyka.Catalogue.ListTitlesAsync(q: "frieren", limit: 5);
foreach (var title in found)
{
    Console.WriteLine($"{title.Id} {title.Title} {title.Score}");
}

var one = await acyka.Catalogue.GetTitleAsync(id: 52991, lang: "ru");
```

Everything a read answers with is a `sealed record`: immutable, compared by
value, and `with` gives you a modified copy of a body without a builder.

The token is minted when it is first needed and again when it expires. There is
nothing to store and nothing to refresh.

**Only `catalog:read` and `people:read` can be held this way.** Everything else
on this api is about a person, and an application speaking for itself has nobody
to act for.

## Every row, without writing the loop

```csharp
await foreach (var title in acyka.Catalogue.ListTitlesAllAsync(genre: "Drama"))
{
    Console.WriteLine(title.Title);
}
```

It stops when a page comes back shorter than it asked for, rather than when
`Total` is reached — the list can grow while it is being read, and counting
against a number from the first page walks off the end.

## Acting for a person

```csharp
// 1. before the redirect — keep `Verifier` and `State` in the session
var pair = Flows.Pkce();
var asked = Flows.AuthorizeUrl(
    clientId, "https://example.com/callback",
    ["openid", "profile", "lists:read", "offline_access"],
    pair.Challenge);
Redirect(asked.Url);

// 2. in the callback, after checking `state` matches what you stored
var tokens = await Flows.ExchangeCodeAsync(
    clientId, code, "https://example.com/callback", pair.Verifier, clientSecret);

// 3. and from then on
var theirs = AcykaClient.User(
    clientId, tokens, clientSecret, keep: fresh => Save(userId, fresh));
var me = await theirs.Account.GetMeAsync();
```

`AuthorizeUrl` hands the `State` back rather than only taking one, because a
callback with nothing to compare against is a callback anybody can forge — so
there is no way to end up without it.

**Store what `keep` hands you.** Refresh tokens rotate: the one that comes back
is the one to keep, and presenting a retired one is what the server reads as
theft — it kills the whole chain and signs the person out of an application that
did nothing wrong. Tasks that all notice the same expiry send one refresh between
them, because the semaphore is held across the exchange.

Ask for `offline_access` if you need to act while nobody is watching.

## Something with no browser

```csharp
var started = await Flows.StartDeviceAsync(clientId, ["openid", "lists:read"]);
Console.WriteLine($"go to {started.VerificationUri} and type {started.UserCode}");

var tokens = await Flows.AwaitDeviceAsync(clientId, started.DeviceCode, started.Interval);
```

## When it says no

One exception type per refusal, because the server answers a **phrase name and
never a sentence** — one screen can be read in five languages, so the set of
names is stable and enumerable in a way prose is not.

```csharp
try
{
    await acyka.Library.ListMyListAsync();
}
catch (ForbiddenException refused)
{
    // refreshing will not help: the token does not carry it
    Console.WriteLine($"needs the scope {refused.Scope}");
}
catch (RateLimitedException refused)
{
    Console.WriteLine($"retry in {refused.RetryAfter}s");
}
catch (AcykaException refused) when (refused.Retryable)
{
    // worth another go
}
```

`refused.Code` is the name — `errors.oauthInsufficientScope` — for when you want
to show your own words. `UnexpectedException` carries a status this library has
no type for, because a server that grows one is not something a client should
throw a cast error about.

## Pacing itself

Every answer carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`, and a 429 carries `Retry-After`. This client reads them and
waits exactly as long as the server asked. A 429, a 5xx and a socket that never
answered are retried; a request refused on its merits is not.

```csharp
var acyka = AcykaClient.App(id, secret, options: new Options
{
    Retries = 3,                            // 0 turns retrying off
    MaxWait = TimeSpan.FromSeconds(65),     // past this a RateLimitedException is raised
    OnPace = pace => Gauge("acyka.left", pace.Remaining),
});

Console.WriteLine(acyka.Pace.Remaining);
```

`MaxWait` exists because waiting a whole window inside one call looks exactly
like a hang to whoever is waiting on it.

## Webhooks

```csharp
app.MapPost("/acyka/hook", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var raw = await reader.ReadToEndAsync();          // raw, before any parsing

    try
    {
        var delivered = Webhooks.Verify(
            raw,
            request.Headers["X-Acyka-Signature"],
            Environment.GetEnvironmentVariable("ACYKA_WEBHOOK_SECRET")!);

        if (delivered.Event == "episode.aired") { /* … */ }
    }
    catch (BadSignatureException)
    {
        return Results.BadRequest();
    }

    return Results.NoContent();
});
```

Three things this does that are easy to get wrong by hand: it signs over the
**raw** bytes, it compares with `CryptographicOperations.FixedTimeEquals`, and it
checks how old the delivery is — the timestamp is inside the signed string
precisely so a captured delivery cannot be replayed a month later.

## What is generated and what is not

The records, the methods and the namespaces come out of `openapi.json`, which the
server writes from annotations on its own handlers.

The transport, the four flows, the refresh, the backoff, the paginators, the
exception hierarchy and the webhook check are written by hand — and tested
against a scripted `HttpMessageHandler`, because what is being tested is what
happens to headers, statuses and a body on the way through.

Two details worth naming, both found by running the tests rather than by reading
the code:

`Page<T>` has a `GetEnumerator` and does **not** implement `IEnumerable<T>`.
`System.Text.Json` treats anything implementing that interface as a collection,
and then tries to read `{"items": …}` as a JSON array and throws on every single
answer. C# resolves `foreach` against a public `GetEnumerator` without the
interface, so this costs nothing — use `.Items` for LINQ.

And `DefaultIgnoreCondition = WhenWritingNull`, so an optional the caller did not
set is **left out** rather than sent as `null`. On this api absent and null are
different answers and a `PATCH` reads the difference: a body full of nulls would
clear every field the caller left alone.

## The wire is snake_case, the API is PascalCase

`shikimori_id` on the wire is `ShikimoriId` in C#, and the reference at
[dev.acyka.cc](https://dev.acyka.cc) shows both. `JsonPropertyName` is on every
property rather than only where the two disagree — the day a field arrives
already PascalCase it would silently have none, and nobody would notice until it
disagreed.

## Licence

MIT.
