using System.Net;
using System.Text;
using System.Text.Json;

namespace Acyka;

public sealed record Options
{
    public string BaseUrl { get; init; } = "https://api.acyka.cc";

    public TimeSpan Timeout { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>How many times a retryable answer is retried; 0 turns it off entirely.</summary>
    public int Retries { get; init; } = 3;

    /// <summary>
    /// The longest this will ever wait on a 429 before giving up.
    ///
    /// Without a ceiling, a client that has spent its minute and asked for a
    /// hundred pages awaits the whole window inside one call — which looks
    /// exactly like a hang to whoever is waiting on it.
    /// </summary>
    public TimeSpan MaxWait { get; init; } = TimeSpan.FromSeconds(65);

    /// <summary>Told after every answer, so a caller can watch its own budget.</summary>
    public Action<Pace>? OnPace { get; init; }

    public string UserAgent { get; init; } = "acyka-api-cs/1";
}

/// <summary>
/// One request, and everything that happens around it.
///
/// The generated methods are thin on purpose — they name a path, a query and a
/// body, and hand all four of the interesting decisions here: waiting exactly as
/// long as the server asked, retrying only what is safe to retry, refreshing
/// once on a 401, and turning a body into the right exception.
/// </summary>
public sealed class Core
{
    private static readonly JsonSerializerOptions Wire = new()
    {
        // An optional the caller did not set must not be sent as `"field":
        // null`: on this api absent and null are different answers, and a
        // `PATCH` reads the difference.
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly IAuth _auth;
    private readonly Options _options;
    private readonly HttpClient _http;

    internal Core(IAuth auth, Options options, HttpClient http)
    {
        _auth = auth;
        _options = options;
        _http = http;
        _http.Timeout = options.Timeout;
    }

    /// <summary>What the last answer said about this client's minute.</summary>
    public Pace Pace { get; private set; }

    /// <summary>A path segment, escaped.</summary>
    public static string Escape(string value) => Uri.EscapeDataString(value);

    internal async Task<T> CallAsync<T>(
        HttpMethod method,
        string path,
        (string, object?)[]? query,
        object? body,
        CancellationToken cancellationToken)
    {
        var said = await TextAsync(method, path, query, body, cancellationToken).ConfigureAwait(false);
        try
        {
            return JsonSerializer.Deserialize<T>(said, Wire)!;
        }
        catch (JsonException cause)
        {
            throw new MalformedException($"{method} {path}", cause);
        }
    }

    internal async Task NothingAsync(
        HttpMethod method,
        string path,
        (string, object?)[]? query,
        object? body,
        CancellationToken cancellationToken) =>
        await TextAsync(method, path, query, body, cancellationToken).ConfigureAwait(false);

    private async Task<string> TextAsync(
        HttpMethod method,
        string path,
        (string, object?)[]? query,
        object? body,
        CancellationToken cancellationToken)
    {
        var where = $"{method} {path}";
        var refreshed = false;
        var attempt = 0;

        while (true)
        {
            var url = $"{_options.BaseUrl}{path}{Search(query)}";
            using var request = new HttpRequestMessage(method, url);
            var token = await _auth.FreshAsync(cancellationToken).ConfigureAwait(false);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");
            request.Headers.TryAddWithoutValidation("Accept", "application/json");
            request.Headers.TryAddWithoutValidation("User-Agent", _options.UserAgent);
            if (body is not null)
            {
                request.Content = new StringContent(
                    JsonSerializer.Serialize(body, Wire),
                    Encoding.UTF8,
                    "application/json");
            }

            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception cause) when (cause is HttpRequestException or TaskCanceledException
                && !cancellationToken.IsCancellationRequested)
            {
                // Nothing answered. Worth one more go for the same reason a 5xx
                // is — a dropped socket during a deploy is a gap, not a refusal.
                if (attempt < _options.Retries)
                {
                    await Task.Delay(Backoff(attempt), cancellationToken).ConfigureAwait(false);
                    attempt += 1;
                    continue;
                }
                throw new UnreachableException(where, cause);
            }

            using (response)
            {
                var pace = new Pace(
                    Number(response, "X-RateLimit-Limit"),
                    Number(response, "X-RateLimit-Remaining"),
                    Number(response, "X-RateLimit-Reset"));
                Pace = pace;
                _options.OnPace?.Invoke(pace);

                var said = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                var status = (int)response.StatusCode;

                if (response.IsSuccessStatusCode)
                {
                    return status == 204 ? string.Empty : said;
                }

                // A proxy's own 502 is html, and a parse error there would tell
                // the caller nothing about what happened.
                var (code, detail) = Refusal(said, status);

                if (response.StatusCode == HttpStatusCode.Unauthorized && !refreshed)
                {
                    refreshed = true;
                    _auth.Forget();
                    try
                    {
                        await _auth.FreshAsync(cancellationToken).ConfigureAwait(false);
                        continue;
                    }
                    catch (Exception)
                    {
                        // A second 401 after this is the server saying the
                        // credential is wrong rather than stale.
                        throw new UnauthorizedException(code, detail, where);
                    }
                }

                var retryAfter = (int)(Number(response, "Retry-After") ?? 0);
                var worthRetrying = status == 429 || status >= 500;
                if (worthRetrying && attempt < _options.Retries)
                {
                    var wait = status == 429
                        // The server's own number rather than a guess: too little
                        // and it is refused again, too much and the client waits
                        // for nothing.
                        ? TimeSpan.FromSeconds(Math.Max(Math.Max(retryAfter, pace.Reset ?? 1), 1))
                        : Backoff(attempt);

                    if (wait <= _options.MaxWait)
                    {
                        await Task.Delay(wait, cancellationToken).ConfigureAwait(false);
                        attempt += 1;
                        continue;
                    }
                }

                throw Refusals.Of(
                    status,
                    code,
                    detail,
                    where,
                    Math.Max(retryAfter, (int)(pace.Reset ?? 0)),
                    pace);
            }
        }
    }

    private static (string, JsonElement) Refusal(string said, int status)
    {
        try
        {
            using var parsed = JsonDocument.Parse(said);
            var root = parsed.RootElement.Clone();
            var code = root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("message", out var message)
                && message.ValueKind == JsonValueKind.String
                    ? message.GetString() ?? $"HTTP {status}"
                    : $"HTTP {status}";
            return (code, root);
        }
        catch (JsonException)
        {
            return ($"HTTP {status}", default);
        }
    }

    private static long? Number(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
        && long.TryParse(values.FirstOrDefault(), out var parsed)
            ? parsed
            : null;

    private static TimeSpan Backoff(int attempt) =>
        TimeSpan.FromMilliseconds(Math.Min(250 * Math.Pow(2, Math.Min(attempt, 4)), 4000));

    /// <summary>A query string with nothing that was not asked for in it.</summary>
    private static string Search((string, object?)[]? query)
    {
        if (query is null || query.Length == 0)
        {
            return string.Empty;
        }

        var parts = new List<string>();
        foreach (var (key, value) in query)
        {
            // `null` means "not asked for" and is dropped; `0` and `false` are
            // answers and are sent — a client that dropped falsy values would
            // make `offset=0` unsendable and `score=0` mean "any score".
            if (value is null)
            {
                continue;
            }
            var text = value switch
            {
                bool flag => flag ? "true" : "false",
                double number => number.ToString(System.Globalization.CultureInfo.InvariantCulture),
                _ => value.ToString() ?? string.Empty,
            };
            parts.Add($"{Uri.EscapeDataString(key)}={Uri.EscapeDataString(text)}");
        }

        return parts.Count == 0 ? string.Empty : $"?{string.Join('&', parts)}";
    }
}
