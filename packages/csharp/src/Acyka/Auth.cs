using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Web;

namespace Acyka;

/// <summary>
/// What the transport asks of an auth.
///
/// An access token lives an hour. A library that makes its caller notice that is
/// a library whose callers each write the same refresh-and-retry loop, slightly
/// differently — and one of them gets the concurrent case wrong and sends two
/// refreshes for one expiry, which, because refresh tokens here rotate and a
/// reuse kills the family, signs their users out. So the loop is written once and
/// <see cref="FreshAsync"/> is the whole of what the transport knows.
/// </summary>
public interface IAuth
{
    /// <summary>A live access token, refreshed or minted if the held one has run out.</summary>
    Task<string> FreshAsync(CancellationToken cancellationToken = default);

    /// <summary>Throw away what is held, so the next call mints or refreshes.</summary>
    void Forget();

    /// <summary>What was granted, if it is known yet.</summary>
    IReadOnlyList<string> Scopes() => Array.Empty<string>();
}

/// <summary>Where the provider lives. Overridable for a laptop, fixed in practice.</summary>
public sealed record Endpoints(
    string Authorize = "https://api.acyka.cc/api/oauth2/authorize",
    string Token = "https://api.acyka.cc/api/oauth2/token",
    string Device = "https://api.acyka.cc/api/oauth2/device_authorization");

public sealed record Tokens(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("token_type")] string TokenType = "Bearer",
    [property: JsonPropertyName("expires_in")] long ExpiresIn = 3600,
    [property: JsonPropertyName("scope")] string Scope = "",
    [property: JsonPropertyName("refresh_token")] string? RefreshToken = null,
    [property: JsonPropertyName("id_token")] string? IdToken = null)
{
    public IReadOnlyList<string> Scopes =>
        Scope.Split(' ', StringSplitOptions.RemoveEmptyEntries);
}

/// <summary>
/// Told whenever a token set is replaced, so a caller can put it somewhere.
///
/// A refresh token rotates: the one handed back is the one to keep, and the one
/// that was sent is dead. Storing the original for ever leaves a credential that
/// stops working — and presenting it again is what the server reads as theft,
/// which kills the whole chain.
/// </summary>
public delegate void Keeper(Tokens tokens);

internal sealed record Held(Tokens Tokens, long ExpiresAt)
{
    internal static Held Of(Tokens tokens) =>
        // Sixty seconds early. A token that expires while a request is in flight
        // is a 401 the caller did nothing to deserve, and clock skew between two
        // machines is measured in seconds rather than milliseconds.
        new(tokens, DateTimeOffset.UtcNow.ToUnixTimeSeconds() + Math.Max(tokens.ExpiresIn - 60, 0));

    internal bool Live =>
        !string.IsNullOrEmpty(Tokens.AccessToken)
        && ExpiresAt > DateTimeOffset.UtcNow.ToUnixTimeSeconds();
}

internal static class Exchange
{
    private static readonly JsonSerializerOptions Reading = new() { PropertyNameCaseInsensitive = false };

    internal static async Task<Tokens> AtAsync(
        HttpClient http,
        string endpoint,
        IEnumerable<KeyValuePair<string, string>> form,
        string clientId,
        string? clientSecret,
        CancellationToken cancellationToken)
    {
        var fields = form.ToList();
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        if (clientSecret is not null)
        {
            // `client_secret_basic` rather than the body. Both are in the spec
            // and the api takes either; a header is the one that does not end up
            // in a proxy's access log beside the request line.
            var pair = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
            request.Headers.TryAddWithoutValidation("Authorization", $"Basic {pair}");
        }
        else
        {
            fields.Add(new KeyValuePair<string, string>("client_id", clientId));
        }
        request.Content = new FormUrlEncodedContent(fields);
        request.Headers.TryAddWithoutValidation("Accept", "application/json");

        using var response = await http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var said = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
        {
            // The token endpoint speaks RFC 6749 rather than this api's own
            // error shape — `{"error": "invalid_grant"}` — because every OAuth
            // library ever written reads that field and nothing else.
            string error = $"HTTP {(int)response.StatusCode}";
            string? description = null;
            try
            {
                using var parsed = JsonDocument.Parse(said);
                if (parsed.RootElement.TryGetProperty("error", out var name))
                {
                    error = name.GetString() ?? error;
                }
                if (parsed.RootElement.TryGetProperty("error_description", out var why))
                {
                    description = why.GetString();
                }
            }
            catch (JsonException)
            {
                description = said.Length > 0 ? said : null;
            }
            throw new OauthException(error, description);
        }

        return JsonSerializer.Deserialize<Tokens>(said, Reading)
            ?? throw new OauthException("invalid_grant", "the token endpoint answered nothing");
    }
}

/// <summary>
/// A token somebody else obtained and handed over.
///
/// No refresh: when it runs out it runs out, and the caller finds out with an
/// <see cref="UnauthorizedException"/> rather than having a credential swapped
/// underneath them.
/// </summary>
public sealed class BearerToken(string token, IReadOnlyList<string>? granted = null) : IAuth
{
    public Task<string> FreshAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(token);

    public void Forget()
    {
        // Nothing to forget: there is no way to get another, and clearing it
        // would turn one 401 into every call failing.
    }

    public IReadOnlyList<string> Scopes() => granted ?? Array.Empty<string>();
}

/// <summary>
/// An application acting for itself.
///
/// No person, no consent screen, no refresh token — there is nothing to refresh,
/// because the application can ask for another whenever it likes.
///
/// Only the scopes that are about nobody can be held this way:
/// <c>catalog:read</c> and <c>people:read</c>.
/// </summary>
public sealed class AppOnly(
    string clientId,
    string clientSecret,
    IReadOnlyList<string>? scopes = null,
    Endpoints? endpoints = null,
    HttpClient? http = null) : IAuth
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly HttpClient _http = http ?? new HttpClient();
    private readonly Endpoints _where = endpoints ?? new Endpoints();
    private readonly IReadOnlyList<string> _asked = scopes ?? new[] { "catalog:read" };
    private Held? _held;

    public async Task<string> FreshAsync(CancellationToken cancellationToken = default)
    {
        if (_held is { Live: true } live)
        {
            return live.Tokens.AccessToken;
        }

        // Held across the exchange, so several tasks that all notice the same
        // expiry mint one token between them rather than one each.
        await _lock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_held is { Live: true } again)
            {
                return again.Tokens.AccessToken;
            }

            var form = new List<KeyValuePair<string, string>>
            {
                new("grant_type", "client_credentials"),
            };
            if (_asked.Count > 0)
            {
                form.Add(new KeyValuePair<string, string>("scope", string.Join(' ', _asked)));
            }

            var fresh = await Exchange
                .AtAsync(_http, _where.Token, form, clientId, clientSecret, cancellationToken)
                .ConfigureAwait(false);
            _held = Held.Of(fresh);
            return fresh.AccessToken;
        }
        finally
        {
            _lock.Release();
        }
    }

    public void Forget() => _held = null;

    public IReadOnlyList<string> Scopes() => _held?.Tokens.Scopes ?? _asked;
}

/// <summary>
/// A token that acts for a person, kept alive by its refresh token.
///
/// The refresh is serialised by the semaphore, which is the whole reason this is
/// a class rather than a helper: four requests that all notice the expiry at
/// once must send one refresh between them, because the tokens rotate and the
/// second would present one the first has already retired.
/// </summary>
public sealed class UserToken(
    string clientId,
    Tokens tokens,
    string? clientSecret = null,
    Keeper? keep = null,
    Endpoints? endpoints = null,
    HttpClient? http = null) : IAuth
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly HttpClient _http = http ?? new HttpClient();
    private readonly Endpoints _where = endpoints ?? new Endpoints();
    private Held _held = Held.Of(tokens);

    /// <summary>What is held, for a caller that stores it themselves.</summary>
    public Tokens Tokens => _held.Tokens;

    public async Task<string> FreshAsync(CancellationToken cancellationToken = default)
    {
        if (_held.Live)
        {
            return _held.Tokens.AccessToken;
        }

        await _lock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_held.Live)
            {
                return _held.Tokens.AccessToken;
            }

            var refresh = _held.Tokens.RefreshToken
                ?? throw new OauthException("invalid_grant", "no refresh token — ask for offline_access");

            var fresh = await Exchange.AtAsync(
                _http,
                _where.Token,
                new[]
                {
                    new KeyValuePair<string, string>("grant_type", "refresh_token"),
                    new KeyValuePair<string, string>("refresh_token", refresh),
                },
                clientId,
                clientSecret,
                cancellationToken).ConfigureAwait(false);

            // A refresh that answers without a new refresh token is one the
            // server did not rotate; keeping the old one is then right.
            if (fresh.RefreshToken is null)
            {
                fresh = fresh with { RefreshToken = refresh };
            }

            _held = Held.Of(fresh);
            keep?.Invoke(fresh);
            return fresh.AccessToken;
        }
        finally
        {
            _lock.Release();
        }
    }

    public void Forget() =>
        // The access token, not the refresh one: forgetting is what happens
        // after a 401, and the refresh is the only way back.
        _held = _held with { ExpiresAt = 0 };

    public IReadOnlyList<string> Scopes() => _held.Tokens.Scopes;
}

/* ------------------------- getting a user's token -------------------------- */

/// <summary>A verifier and the challenge that goes with it, both from the same bytes.</summary>
public sealed record Pkce(string Verifier, string Challenge);

/// <summary>Where to send somebody, and the <c>state</c> to compare on the way back.</summary>
public sealed record Authorization(string Url, string State);

public static class Flows
{
    private static string B64(byte[] raw) =>
        Convert.ToBase64String(raw).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>
    /// A fresh PKCE pair.
    ///
    /// S256 and never <c>plain</c>. The api requires it of every client,
    /// confidential ones included, and offers only <c>S256</c> in its discovery
    /// document — a code that leaks from a log, a referer or a browser's history
    /// is then worth nothing without the verifier.
    /// </summary>
    public static Pkce Pkce()
    {
        var verifier = B64(RandomNumberGenerator.GetBytes(32));
        var challenge = B64(SHA256.HashData(Encoding.UTF8.GetBytes(verifier)));
        return new Pkce(verifier, challenge);
    }

    /// <summary>
    /// The state is returned rather than only taken, because a callback with
    /// nothing to compare against is a callback anybody can forge — so it is
    /// generated when it is not given, and there is no way to end up without one.
    /// </summary>
    public static Authorization AuthorizeUrl(
        string clientId,
        string redirectUri,
        IReadOnlyList<string> scopes,
        string challenge,
        string? state = null,
        string? nonce = null,
        Endpoints? endpoints = null)
    {
        var where = endpoints ?? new Endpoints();
        var settled = state ?? B64(RandomNumberGenerator.GetBytes(18));

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["response_type"] = "code";
        query["client_id"] = clientId;
        query["redirect_uri"] = redirectUri;
        query["scope"] = string.Join(' ', scopes);
        query["code_challenge"] = challenge;
        query["code_challenge_method"] = "S256";
        query["state"] = settled;
        if (nonce is not null)
        {
            query["nonce"] = nonce;
        }

        return new Authorization($"{where.Authorize}?{query}", settled);
    }

    /// <summary>The code from the callback, for a token set.</summary>
    public static Task<Tokens> ExchangeCodeAsync(
        string clientId,
        string code,
        string redirectUri,
        string verifier,
        string? clientSecret = null,
        Endpoints? endpoints = null,
        HttpClient? http = null,
        CancellationToken cancellationToken = default) =>
        Exchange.AtAsync(
            http ?? new HttpClient(),
            (endpoints ?? new Endpoints()).Token,
            new[]
            {
                new KeyValuePair<string, string>("grant_type", "authorization_code"),
                new KeyValuePair<string, string>("code", code),
                new KeyValuePair<string, string>("redirect_uri", redirectUri),
                new KeyValuePair<string, string>("code_verifier", verifier),
            },
            clientId,
            clientSecret,
            cancellationToken);

    /// <summary>Ask for a code to show on something with no browser.</summary>
    public static async Task<DeviceStart> StartDeviceAsync(
        string clientId,
        IReadOnlyList<string> scopes,
        string? clientSecret = null,
        Endpoints? endpoints = null,
        HttpClient? http = null,
        CancellationToken cancellationToken = default)
    {
        var where = endpoints ?? new Endpoints();
        var client = http ?? new HttpClient();

        var fields = new List<KeyValuePair<string, string>>
        {
            new("scope", string.Join(' ', scopes)),
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, where.Device);
        if (clientSecret is not null)
        {
            var pair = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
            request.Headers.TryAddWithoutValidation("Authorization", $"Basic {pair}");
        }
        else
        {
            fields.Add(new KeyValuePair<string, string>("client_id", clientId));
        }
        request.Content = new FormUrlEncodedContent(fields);
        request.Headers.TryAddWithoutValidation("Accept", "application/json");

        using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var said = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw new OauthException($"HTTP {(int)response.StatusCode}", said);
        }

        return JsonSerializer.Deserialize<DeviceStart>(said)
            ?? throw new OauthException("invalid_request", "the device endpoint answered nothing");
    }

    /// <summary>
    /// Wait for the person to say yes, then hand back their tokens.
    ///
    /// The four names the server can answer with are the whole of what a poller
    /// needs, and this reads all four: <c>authorization_pending</c> means keep
    /// going, <c>slow_down</c> means keep going and wait longer,
    /// <c>access_denied</c> means somebody pressed cancel, and
    /// <c>expired_token</c> means nobody pressed anything.
    /// </summary>
    public static async Task<Tokens> AwaitDeviceAsync(
        string clientId,
        string deviceCode,
        long interval = 5,
        string? clientSecret = null,
        Endpoints? endpoints = null,
        HttpClient? http = null,
        CancellationToken cancellationToken = default)
    {
        var where = endpoints ?? new Endpoints();
        var client = http ?? new HttpClient();
        var wait = TimeSpan.FromSeconds(Math.Max(interval, 1));

        while (true)
        {
            await Task.Delay(wait, cancellationToken).ConfigureAwait(false);
            try
            {
                return await Exchange.AtAsync(
                    client,
                    where.Token,
                    new[]
                    {
                        new KeyValuePair<string, string>("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                        new KeyValuePair<string, string>("device_code", deviceCode),
                    },
                    clientId,
                    clientSecret,
                    cancellationToken).ConfigureAwait(false);
            }
            catch (OauthException refused) when (refused.Error == "authorization_pending")
            {
                continue;
            }
            catch (OauthException refused) when (refused.Error == "slow_down")
            {
                // The server saying the interval was too short. Five seconds
                // more, as the RFC suggests, rather than doubling — this is a
                // person walking to their phone, not a backoff.
                wait += TimeSpan.FromSeconds(5);
            }
        }
    }
}

/// <summary>What a device shows on its screen while it waits.</summary>
public sealed record DeviceStart(
    [property: JsonPropertyName("device_code")] string DeviceCode,
    [property: JsonPropertyName("user_code")] string UserCode,
    [property: JsonPropertyName("verification_uri")] string VerificationUri,
    [property: JsonPropertyName("verification_uri_complete")] string VerificationUriComplete = "",
    [property: JsonPropertyName("expires_in")] long ExpiresIn = 600,
    [property: JsonPropertyName("interval")] long Interval = 5);
