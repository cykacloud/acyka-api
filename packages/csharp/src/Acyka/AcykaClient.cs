namespace Acyka;

/// <summary>
/// A client for the <see href="https://acyka.cc">acyka</see> API — the anime
/// catalogue, public profiles, and the lists, shelves and writing of whoever
/// authorised your application.
///
/// <code>
/// // an application acting for itself: the catalogue, and public profiles
/// var acyka = AcykaClient.App(clientId, clientSecret);
///
/// var found = await acyka.Catalogue.ListTitlesAsync(q: "frieren", limit: 5);
/// foreach (var title in found) Console.WriteLine($"{title.Id} {title.Title}");
///
/// await foreach (var title in acyka.Catalogue.ListTitlesAllAsync(genre: "Drama"))
///     Console.WriteLine(title.Title);
/// </code>
///
/// Everything under a namespace is generated from <c>openapi.json</c>, which the
/// server writes from annotations on its own handlers. Everything else — the
/// four OAuth flows, the token that renews itself, the backoff that reads the
/// server's own numbers, the paginators, one exception per refusal, and the
/// webhook check — is written by hand.
///
/// Full documentation, with a playground: <see href="https://dev.acyka.cc"/>
/// </summary>
public sealed partial class AcykaClient
{
    private AcykaClient(IAuth auth, Options options, HttpClient http)
    {
        Auth = auth;
        Core = new Core(auth, options, http);
        Attach();
    }

    public IAuth Auth { get; }

    /// <summary>The transport, for a caller that wants to reach something not yet generated.</summary>
    public Core Core { get; }

    /// <summary>What the last answer said about this client's minute.</summary>
    public Pace Pace => Core.Pace;

    /// <summary>A client over any <see cref="IAuth"/>.</summary>
    public static AcykaClient Of(IAuth auth, Options? options = null, HttpClient? http = null) =>
        new(auth, options ?? new Options(), http ?? new HttpClient());

    /// <summary>
    /// An application acting for itself — a bot, a cron, anything with no person
    /// in front of it. Mints on demand and stores nothing.
    ///
    /// Only <c>catalog:read</c> and <c>people:read</c> can be held this way:
    /// everything else on this api is about somebody, and a
    /// <c>client_credentials</c> token has nobody to act for.
    /// </summary>
    public static AcykaClient App(
        string clientId,
        string clientSecret,
        IReadOnlyList<string>? scopes = null,
        Options? options = null,
        Endpoints? endpoints = null,
        HttpClient? http = null) =>
        Of(new AppOnly(clientId, clientSecret, scopes, endpoints, http), options, http);

    /// <summary>
    /// A token that acts for a person, kept alive by its refresh token.
    ///
    /// Give it a <see cref="Keeper"/> and store what it hands you: refresh
    /// tokens rotate, and presenting a retired one is what the server reads as
    /// theft — it kills the whole chain and signs the person out.
    /// </summary>
    public static AcykaClient User(
        string clientId,
        Tokens tokens,
        string? clientSecret = null,
        Keeper? keep = null,
        Options? options = null,
        Endpoints? endpoints = null,
        HttpClient? http = null) =>
        Of(new UserToken(clientId, tokens, clientSecret, keep, endpoints, http), options, http);

    /// <summary>A token somebody else obtained. No refresh.</summary>
    public static AcykaClient Token(string accessToken, Options? options = null, HttpClient? http = null) =>
        Of(new BearerToken(accessToken), options, http);
}
