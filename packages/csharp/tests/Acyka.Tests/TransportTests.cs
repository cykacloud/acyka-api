using System.Net;
using System.Text;
using System.Text.Json;
using Acyka;
using Xunit;

namespace Acyka.Tests;

/// <summary>
/// The half of the client a document cannot generate, against a scripted
/// handler rather than a mocked client: what is being tested is what happens to
/// headers, statuses and a body on the way through.
/// </summary>
public class TransportTests
{
    /// <summary>A handler that answers a list and remembers what it was asked.</summary>
    private sealed class Scripted(Queue<HttpResponseMessage> answers) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Asked { get; } = [];

        public List<string> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Asked.Add(request);
            Bodies.Add(request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken));
            return answers.Count > 0
                ? answers.Dequeue()
                : throw new InvalidOperationException("the script ran out of answers");
        }
    }

    private static HttpResponseMessage Said(int status, string body, params (string, string)[] headers)
    {
        var response = new HttpResponseMessage((HttpStatusCode)status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        foreach (var (name, value) in headers)
        {
            response.Headers.TryAddWithoutValidation(name, value);
        }
        return response;
    }

    private static (AcykaClient, Scripted) Client(
        IEnumerable<HttpResponseMessage> answers,
        Options? options = null,
        IAuth? auth = null)
    {
        var handler = new Scripted(new Queue<HttpResponseMessage>(answers));
        var http = new HttpClient(handler);
        return (
            AcykaClient.Of(auth ?? new BearerToken("acya_test"), options ?? new Options(), http),
            handler);
    }

    private const string Page =
        """{"items":[{"id":52991,"title":"Sousou no Frieren","kind":"tv","episodes":28,"score":9.1}],"total":1}""";

    [Fact]
    public async Task A_read_sends_the_token_and_parses_the_shape()
    {
        var (acyka, handler) = Client([Said(200, Page)]);
        var found = await acyka.Catalogue.ListTitlesAsync(q: "frieren");

        Assert.Equal(1, found.Total);
        Assert.Equal("Sousou no Frieren", found.Items[0].Title);
        Assert.Equal(9.1, found.Items[0].Score);
        // A missing optional is null rather than a default: absent and zero are
        // different answers, and this api's own rules say a client must not
        // collapse them.
        Assert.Null(found.Items[0].TitleOrig);
        // and a page enumerates and counts, because that is what it looks like
        Assert.Equal([52991L], found.Items.Select(t => t.Id));

        Assert.Equal("Bearer acya_test", handler.Asked[0].Headers.Authorization!.ToString());
        Assert.Contains("q=frieren", handler.Asked[0].RequestUri!.Query);
    }

    [Fact]
    public async Task A_parameter_that_was_not_asked_for_is_not_sent()
    {
        var (acyka, handler) = Client([Said(200, Page)]);
        await acyka.Catalogue.ListTitlesAsync(offset: 0);

        var query = handler.Asked[0].RequestUri!.Query;
        // `offset=0` is an answer and is sent; `limit`, never given, is absent —
        // a client that dropped falsy values would make `offset=0` unsendable.
        Assert.Contains("offset=0", query);
        Assert.DoesNotContain("limit", query);
    }

    [Fact]
    public async Task A_204_answers_nothing_rather_than_a_parse_error()
    {
        var (acyka, _) = Client([new HttpResponseMessage(HttpStatusCode.NoContent)]);
        await acyka.Library.RemoveListEntryAsync(shikimoriId: 21);
    }

    [Theory]
    [InlineData(400, typeof(BadRequestException))]
    [InlineData(401, typeof(UnauthorizedException))]
    [InlineData(403, typeof(ForbiddenException))]
    [InlineData(404, typeof(NotFoundException))]
    [InlineData(500, typeof(ServerException))]
    public async Task A_refusal_becomes_a_type(int status, Type kind)
    {
        // Twice, because a 401 is refreshed once and retried once — which is
        // right, and is why this list is not one answer long. The others never
        // reach the second.
        var (acyka, _) = Client(
            [
                Said(status, """{"message":"errors.something"}"""),
                Said(status, """{"message":"errors.something"}"""),
            ],
            new Options { Retries = 0 });

        var refused = await Assert.ThrowsAsync(kind, () => acyka.Catalogue.ListGenresAsync());
        // The phrase name and never a sentence of ours: it is the thing that can
        // be looked up, and the only thing that is stable.
        Assert.Equal("errors.something", ((AcykaException)refused).Code);
    }

    [Fact]
    public async Task A_403_names_the_scope_the_server_named()
    {
        var (acyka, _) = Client(
            [Said(403, """{"message":"errors.oauthInsufficientScope","scope":"lists:read"}""")],
            new Options { Retries = 0 });

        var refused = await Assert.ThrowsAsync<ForbiddenException>(() => acyka.Library.ListMyListAsync());
        Assert.Equal("lists:read", refused.Scope);
        // refreshing will not help, so it is not worth retrying
        Assert.False(refused.Retryable);
    }

    [Fact]
    public async Task An_answer_that_is_not_json_still_becomes_the_right_type()
    {
        // A proxy's own 502 is html, and a parse error there would tell the
        // caller nothing about what happened.
        var (acyka, _) = Client(
            [new HttpResponseMessage(HttpStatusCode.BadGateway) { Content = new StringContent("<html>502</html>") }],
            new Options { Retries = 0 });

        var refused = await Assert.ThrowsAsync<ServerException>(() => acyka.Catalogue.ListGenresAsync());
        Assert.Equal(502, refused.Status);
        Assert.True(refused.Retryable);
    }

    [Fact]
    public async Task A_429_waits_as_long_as_retry_after_said_and_then_succeeds()
    {
        var (acyka, handler) = Client([
            Said(429, """{"message":"common.tooOften"}""", ("Retry-After", "1")),
            Said(200, """{"items":["Drama"]}"""),
        ]);

        var started = DateTimeOffset.UtcNow;
        var genres = await acyka.Catalogue.ListGenresAsync();
        var took = DateTimeOffset.UtcNow - started;

        Assert.Equal(["Drama"], genres.Items);
        Assert.Equal(2, handler.Asked.Count);
        // The server's own number rather than a guess: too little and it is
        // refused again, too much and the client waits for nothing.
        Assert.True(took >= TimeSpan.FromMilliseconds(900), $"{took}");
        Assert.True(took < TimeSpan.FromSeconds(3), $"{took}");
    }

    [Fact]
    public async Task A_wait_past_the_ceiling_is_raised_rather_than_slept_through()
    {
        // Waiting a whole window inside one call looks exactly like a hang to
        // whoever is waiting on it.
        var (acyka, handler) = Client(
            [Said(429, """{"message":"common.tooOften"}""", ("Retry-After", "60"))],
            new Options { MaxWait = TimeSpan.FromSeconds(1) });

        var refused = await Assert.ThrowsAsync<RateLimitedException>(() => acyka.Catalogue.ListGenresAsync());
        Assert.Equal(60, refused.RetryAfter);
        Assert.Single(handler.Asked);
    }

    [Fact]
    public async Task The_pace_the_server_sets_is_readable_afterwards()
    {
        var seen = new List<Pace>();
        var (acyka, _) = Client(
            [Said(200, """{"items":[]}""",
                ("X-RateLimit-Limit", "60"),
                ("X-RateLimit-Remaining", "58"),
                ("X-RateLimit-Reset", "31"))],
            new Options { OnPace = seen.Add });

        await acyka.Catalogue.ListGenresAsync();

        Assert.Equal(new Pace(60, 58, 31), acyka.Pace);
        Assert.Equal([new Pace(60, 58, 31)], seen);
    }

    [Fact]
    public async Task A_refusal_on_its_merits_is_not_retried()
    {
        var (acyka, handler) = Client([Said(400, """{"message":"errors.badData"}""")]);
        await Assert.ThrowsAsync<BadRequestException>(
            () => acyka.Library.SaveListEntryAsync(shikimoriId: 21, body: new ListBody(Title: "")));
        Assert.Single(handler.Asked);
    }

    /// <summary>An auth that hands out a new token each time it is forgotten.</summary>
    private sealed class Renewing : IAuth
    {
        private int _n;

        public int Refreshes { get; private set; }

        public Task<string> FreshAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult($"acya_{_n}");

        public void Forget()
        {
            _n += 1;
            Refreshes += 1;
        }
    }

    [Fact]
    public async Task A_token_that_expired_mid_flight_is_refreshed_once_and_retried_once()
    {
        var auth = new Renewing();
        var (acyka, handler) = Client(
            [Said(401, """{"message":"errors.unauthorized"}"""), Said(200, """{"id":"1"}""")],
            new Options { Retries = 0 },
            auth);

        await acyka.Account.GetMeAsync();

        Assert.Equal(1, auth.Refreshes);
        Assert.Equal(
            ["Bearer acya_0", "Bearer acya_1"],
            handler.Asked.Select(r => r.Headers.Authorization!.ToString()));
    }

    [Fact]
    public async Task And_a_second_401_is_raised_rather_than_refreshed_again()
    {
        // The credential is wrong rather than stale; refreshing produces the
        // same one and the loop would never end.
        var auth = new Renewing();
        var (acyka, handler) = Client(
            [
                Said(401, """{"message":"errors.unauthorized"}"""),
                Said(401, """{"message":"errors.unauthorized"}"""),
            ],
            new Options { Retries = 0 },
            auth);

        await Assert.ThrowsAsync<UnauthorizedException>(() => acyka.Account.GetMeAsync());
        Assert.Equal(1, auth.Refreshes);
        Assert.Equal(2, handler.Asked.Count);
    }

    [Fact]
    public async Task An_optional_a_caller_did_not_set_is_not_sent_as_null()
    {
        // On this api absent and null are different answers, and a `PATCH` reads
        // the difference — a body full of nulls would clear every field the
        // caller left alone.
        var (acyka, handler) = Client([
            Said(200,
                """{"shikimori_id":21,"title":"One Piece","status":"watching","episode":3,"at":"2026-01-01T00:00:00Z"}"""),
        ]);

        await acyka.Library.SaveListEntryAsync(shikimoriId: 21, body: new ListBody(Title: "One Piece"));

        Assert.Equal("""{"title":"One Piece"}""", handler.Bodies[0]);
    }

    [Fact]
    public async Task Paging_walks_every_row_and_stops_on_a_short_page()
    {
        static string Rows(int offset, int limit)
        {
            var items = Enumerable.Range(1, 25)
                .Skip(offset)
                .Take(limit)
                .Select(id => $$"""{"id":{{id}},"title":"t{{id}}","kind":"tv","episodes":12}""");
            // `total` is a lie on purpose: a loop that counted against it would
            // ask for a page that is not there.
            return $$"""{"items":[{{string.Join(',', items)}}],"total":4000}""";
        }

        var (acyka, handler) = Client([Said(200, Rows(0, 10)), Said(200, Rows(10, 10)), Said(200, Rows(20, 10))]);

        var seen = new List<long>();
        await foreach (var title in acyka.Catalogue.ListTitlesAllAsync(limit: 10))
        {
            seen.Add(title.Id);
        }

        Assert.Equal(Enumerable.Range(1, 25).Select(n => (long)n), seen);
        // Three pages: ten, ten, five. The fourth is never asked for.
        Assert.Equal(3, handler.Asked.Count);
    }
}
