// Generated from openapi.json by tools/generate.ts. Do not edit.

using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Acyka;

/// <summary>
/// the account a token acts for
/// </summary>
public sealed class AccountApi
{
    private readonly Core _core;

    internal AccountApi(Core core) => _core = core;

    /// <summary>
    /// It exists beside userinfo rather than instead of it because userinfo's shape
    /// is fixed by the spec and this one is ours to grow.
    /// </summary>
    /// <remarks><c>GET /api/v1/me</c>, needs <c>profile</c></remarks>
    public Task<Me> GetMeAsync(CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Me>(HttpMethod.Get, $"/api/v1/me", null, null, cancellationToken);
    }
}

/// <summary>
/// titles, people, characters and what is airing
/// </summary>
public sealed class CatalogueApi
{
    private readonly Core _core;

    internal CatalogueApi(Core core) => _core = core;

    /// <summary>
    /// A projection rather than a schedule: an ongoing series has no per-episode
    /// timetable anywhere upstream, so the day of episode *n* is worked out from
    /// the start date and a seven-day cadence. Irregular shows are wrong by a few
    /// days and this says nothing about it, because a calendar that hid everything
    /// it was not certain of would be an empty page most weeks. `out` is the part
    /// that is not a projection — an episode a dub is already held for is playable
    /// now, whatever the arithmetic says.
    /// 
    /// The site's `?mine=1` is not offered. It narrows to the reader's own shelf,
    /// which is a second way of asking a question `/v1/lists` already answers, and
    /// a filter that means nothing at all for an application speaking for itself.
    /// </summary>
    /// <remarks><c>GET /api/v1/calendar</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<Airing>> CalendarAsync(string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Page<Airing>>(HttpMethod.Get, $"/api/v1/calendar", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/characters/{id}/titles</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<Appearance>> CharacterTitlesAsync(long id, string? lang = null, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<Appearance>>(HttpMethod.Get, $"/api/v1/characters/{Core.Escape(id.ToString()!)}/titles", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="CharacterTitlesAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<Appearance> CharacterTitlesAllAsync(long id, string? lang = null, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await CharacterTitlesAsync(limit: window, offset: at, id: id, lang: lang, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// Whoever has voiced this character, once each, japanese first.
    /// </summary>
    /// <remarks><c>GET /api/v1/characters/{id}/voices</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<Voice>> CharacterVoicesAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Page<Voice>>(HttpMethod.Get, $"/api/v1/characters/{Core.Escape(id.ToString()!)}/voices", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/characters/{id}</c>, needs <c>catalog:read</c></remarks>
    public Task<Character> GetCharacterAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Character>(HttpMethod.Get, $"/api/v1/characters/{Core.Escape(id.ToString()!)}", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/people/{id}</c>, needs <c>catalog:read</c></remarks>
    public Task<PersonPage> GetPersonAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<PersonPage>(HttpMethod.Get, $"/api/v1/people/{Core.Escape(id.ToString()!)}", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/titles/{id}</c>, needs <c>catalog:read</c></remarks>
    public Task<Title> GetTitleAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Title>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}", query, null, cancellationToken);
    }

    /// <summary>
    /// The vocabulary the whole catalogue is described in.
    /// </summary>
    /// <remarks><c>GET /api/v1/genres</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<string>> ListGenresAsync(CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Page<string>>(HttpMethod.Get, $"/api/v1/genres", null, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/titles</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<TitleCard>> ListTitlesAsync(string? lang = null, long? limit = null, long? offset = null, string? q = null, string? order = null, string? status = null, string? kind = null, string? genre = null, double? score = null, int? yearFrom = null, int? yearTo = null, string? rating = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
            ("limit", limit),
            ("offset", offset),
            ("q", q),
            ("order", order),
            ("status", status),
            ("kind", kind),
            ("genre", genre),
            ("score", score),
            ("year_from", yearFrom),
            ("year_to", yearTo),
            ("rating", rating),
        };
        return _core.CallAsync<Page<TitleCard>>(HttpMethod.Get, $"/api/v1/titles", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="ListTitlesAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<TitleCard> ListTitlesAllAsync(string? lang = null, long? limit = null, long? offset = null, string? q = null, string? order = null, string? status = null, string? kind = null, string? genre = null, double? score = null, int? yearFrom = null, int? yearTo = null, string? rating = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await ListTitlesAsync(limit: window, offset: at, lang: lang, q: q, order: order, status: status, kind: kind, genre: genre, score: score, yearFrom: yearFrom, yearTo: yearTo, rating: rating, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// The other half of a voice actor: who they have played.
    /// </summary>
    /// <remarks><c>GET /api/v1/people/{id}/characters</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<VoicedRole>> PersonCharactersAsync(long id, string? lang = null, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<VoicedRole>>(HttpMethod.Get, $"/api/v1/people/{Core.Escape(id.ToString()!)}/characters", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="PersonCharactersAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<VoicedRole> PersonCharactersAllAsync(long id, string? lang = null, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await PersonCharactersAsync(limit: window, offset: at, id: id, lang: lang, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <remarks><c>GET /api/v1/people/{id}/titles</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<Appearance>> PersonTitlesAsync(long id, string? lang = null, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<Appearance>>(HttpMethod.Get, $"/api/v1/people/{Core.Escape(id.ToString()!)}/titles", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="PersonTitlesAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<Appearance> PersonTitlesAllAsync(long id, string? lang = null, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await PersonTitlesAsync(limit: window, offset: at, id: id, lang: lang, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// One title, at random, out of the ones that can actually be watched here.
    /// </summary>
    /// <remarks><c>GET /api/v1/titles/random</c>, needs <c>catalog:read</c></remarks>
    public Task<TitleCard> RandomTitleAsync(string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<TitleCard>(HttpMethod.Get, $"/api/v1/titles/random", query, null, cancellationToken);
    }

    /// <summary>
    /// The title asked about is in the list rather than dropped from it, because
    /// the one thing this shelf is for is saying where in a sequence somebody is —
    /// `current` is what lets a client mark it in place.
    /// </summary>
    /// <remarks><c>GET /api/v1/titles/{id}/related</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<Related>> RelatedTitlesAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Page<Related>>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}/related", query, null, cancellationToken);
    }

    /// <summary>
    /// A resource of its own rather than a kind inside one `/search`. The site has
    /// a single search window because a person typing wants one box, and it answers
    /// an object of six collections — a shape built for that window. An application
    /// looking for a character wants characters, paged, and asking it to unwrap
    /// five lists it did not want is the `?include=` this api does not have,
    /// backwards.
    /// </summary>
    /// <remarks><c>GET /api/v1/characters</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<CharacterCard>> SearchCharactersAsync(string? q = null, string? lang = null, long? limit = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("q", q),
            ("lang", lang),
            ("limit", limit),
        };
        return _core.CallAsync<Page<CharacterCard>>(HttpMethod.Get, $"/api/v1/characters", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/people</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<PersonCard>> SearchPeopleAsync(string? q = null, string? lang = null, long? limit = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("q", q),
            ("lang", lang),
            ("limit", limit),
        };
        return _core.CallAsync<Page<PersonCard>>(HttpMethod.Get, $"/api/v1/people", query, null, cancellationToken);
    }

    /// <summary>
    /// The weighting is the whole of what makes this useful rather than "the twelve
    /// most popular titles in the catalogue", and it is not a thing to have two of
    /// — so this is `similar_to`, the same shelf `/similar` in Discord is.
    /// </summary>
    /// <remarks><c>GET /api/v1/titles/{id}/similar</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<TitleCard>> SimilarTitlesAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Page<TitleCard>>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}/similar", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/titles/{id}/characters</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<TitleCharacter>> TitleCharactersAsync(long id, string? lang = null, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<TitleCharacter>>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}/characters", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="TitleCharactersAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<TitleCharacter> TitleCharactersAllAsync(long id, string? lang = null, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await TitleCharactersAsync(limit: window, offset: at, id: id, lang: lang, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// **Not a list of episodes to watch, and deliberately not one.** Where a dub
    /// can be played and by whom is `/video/streams`, which is somebody else's
    /// files under somebody else's terms and is not on this door at all. This is
    /// what the `shots` pass pulled onto our own storage, and an episode with no
    /// frames is simply absent.
    /// </summary>
    /// <remarks><c>GET /api/v1/titles/{id}/episodes</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<Episode>> TitleEpisodesAsync(long id, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Page<Episode>>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}/episodes", null, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/titles/{id}/screenshots</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<string>> TitleScreenshotsAsync(long id, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Page<string>>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}/screenshots", null, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/titles/{id}/staff</c>, needs <c>catalog:read</c></remarks>
    public Task<Page<TitleStaff>> TitleStaffAsync(long id, string? lang = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("lang", lang),
        };
        return _core.CallAsync<Page<TitleStaff>>(HttpMethod.Get, $"/api/v1/titles/{Core.Escape(id.ToString()!)}/staff", query, null, cancellationToken);
    }
}

/// <summary>
/// other people, as far as they have agreed to be read
/// </summary>
public sealed class PeopleApi
{
    private readonly Core _core;

    internal PeopleApi(Core core) => _core = core;

    /// <remarks><c>GET /api/v1/users/{nick}</c>, needs <c>people:read</c></remarks>
    public Task<Profile> GetUserAsync(string nick, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Profile>(HttpMethod.Get, $"/api/v1/users/{Core.Escape(nick.ToString()!)}", null, null, cancellationToken);
    }

    /// <summary>
    /// People by name.
    /// </summary>
    /// <remarks><c>GET /api/v1/users</c>, needs <c>people:read</c></remarks>
    public Task<Page<Person>> SearchUsersAsync(string? q = null, long? limit = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("q", q),
            ("limit", limit),
        };
        return _core.CallAsync<Page<Person>>(HttpMethod.Get, $"/api/v1/users", query, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/users/{nick}/collections</c>, needs <c>people:read</c></remarks>
    public Task<Page<Collection>> UserCollectionsAsync(string nick, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Page<Collection>>(HttpMethod.Get, $"/api/v1/users/{Core.Escape(nick.ToString()!)}/collections", null, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/users/{nick}/followers</c>, needs <c>people:read</c></remarks>
    public Task<Page<Person>> UserFollowersAsync(string nick, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<Person>>(HttpMethod.Get, $"/api/v1/users/{Core.Escape(nick.ToString()!)}/followers", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="UserFollowersAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<Person> UserFollowersAllAsync(string nick, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await UserFollowersAsync(limit: window, offset: at, nick: nick, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <remarks><c>GET /api/v1/users/{nick}/following</c>, needs <c>people:read</c></remarks>
    public Task<Page<Person>> UserFollowingAsync(string nick, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<Person>>(HttpMethod.Get, $"/api/v1/users/{Core.Escape(nick.ToString()!)}/following", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="UserFollowingAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<Person> UserFollowingAllAsync(string nick, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await UserFollowingAsync(limit: window, offset: at, nick: nick, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// What somebody is watching, if their list is anybody's business.
    /// </summary>
    /// <remarks><c>GET /api/v1/users/{nick}/lists</c>, needs <c>people:read</c></remarks>
    public Task<Page<ListEntry>> UserListsAsync(string nick, string? status = null, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("status", status),
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<ListEntry>>(HttpMethod.Get, $"/api/v1/users/{Core.Escape(nick.ToString()!)}/lists", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="UserListsAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<ListEntry> UserListsAllAsync(string nick, string? status = null, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await UserListsAsync(limit: window, offset: at, nick: nick, status: status, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <remarks><c>GET /api/v1/users/{nick}/stats</c>, needs <c>people:read</c></remarks>
    public Task<Stats> UserStatsAsync(string nick, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Stats>(HttpMethod.Get, $"/api/v1/users/{Core.Escape(nick.ToString()!)}/stats", null, null, cancellationToken);
    }
}

/// <summary>
/// somebody's own list and shelves
/// </summary>
public sealed class LibraryApi
{
    private readonly Core _core;

    internal LibraryApi(Core core) => _core = core;

    /// <remarks><c>PUT /api/v1/collections/{code}/items/{shikimori_id}</c>, needs <c>lists:write</c></remarks>
    public Task<CollectionItem> AddCollectionItemAsync(string code, int shikimoriId, EntryBody body, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<CollectionItem>(HttpMethod.Put, $"/api/v1/collections/{Core.Escape(code.ToString()!)}/items/{Core.Escape(shikimoriId.ToString()!)}", null, body, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/collections/{code}/items</c>, needs <c>lists:read</c></remarks>
    public Task<Page<CollectionItem>> CollectionItemsAsync(string code, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Page<CollectionItem>>(HttpMethod.Get, $"/api/v1/collections/{Core.Escape(code.ToString()!)}/items", null, null, cancellationToken);
    }

    /// <remarks><c>POST /api/v1/collections</c>, needs <c>lists:write</c></remarks>
    public Task<Collection> CreateCollectionAsync(CollectionBody body, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Collection>(HttpMethod.Post, $"/api/v1/collections", null, body, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/collections/{code}</c>, needs <c>lists:read</c></remarks>
    public Task<Collection> GetCollectionAsync(string code, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Collection>(HttpMethod.Get, $"/api/v1/collections/{Core.Escape(code.ToString()!)}", null, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/collections</c>, needs <c>lists:read</c></remarks>
    public Task<Page<Collection>> ListMyCollectionsAsync(CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Page<Collection>>(HttpMethod.Get, $"/api/v1/collections", null, null, cancellationToken);
    }

    /// <summary>
    /// It used to answer the whole thing, which is the bug this api's own rules
    /// already name: a caller with four hundred titles got four hundred rows and a
    /// caller with four thousand got four thousand, and the only reason nobody was
    /// hurt by it is that nobody was using this door. `total` is beside the items
    /// because the paging is by offset, which is exactly when a caller has to know
    /// how far the list goes.
    /// </summary>
    /// <remarks><c>GET /api/v1/lists</c>, needs <c>lists:read</c></remarks>
    public Task<Page<ListEntry>> ListMyListAsync(string? status = null, long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("status", status),
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<ListEntry>>(HttpMethod.Get, $"/api/v1/lists", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="ListMyListAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<ListEntry> ListMyListAllAsync(string? status = null, long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await ListMyListAsync(limit: window, offset: at, status: status, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// The same `plans::domain::rate` the site calls, so the two doors cannot come
    /// to disagree about what a score is — which is the whole reason the domain
    /// exists. What differs is what this surface always differs by: 404 where the
    /// site answers 204 for a delete that removed nothing.
    /// </summary>
    /// <remarks><c>PUT /api/v1/lists/{shikimori_id}/score</c>, needs <c>lists:write</c></remarks>
    public Task<ListEntry> RateListEntryAsync(int shikimoriId, ScoreBody body, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<ListEntry>(HttpMethod.Put, $"/api/v1/lists/{Core.Escape(shikimoriId.ToString()!)}/score", null, body, cancellationToken);
    }

    /// <remarks><c>DELETE /api/v1/collections/{code}/items/{shikimori_id}</c>, needs <c>lists:write</c></remarks>
    public Task RemoveCollectionItemAsync(string code, int shikimoriId, CancellationToken cancellationToken = default)
    {
        return _core.NothingAsync(HttpMethod.Delete, $"/api/v1/collections/{Core.Escape(code.ToString()!)}/items/{Core.Escape(shikimoriId.ToString()!)}", null, null, cancellationToken);
    }

    /// <remarks><c>DELETE /api/v1/lists/{shikimori_id}</c>, needs <c>lists:write</c></remarks>
    public Task RemoveListEntryAsync(int shikimoriId, CancellationToken cancellationToken = default)
    {
        return _core.NothingAsync(HttpMethod.Delete, $"/api/v1/lists/{Core.Escape(shikimoriId.ToString()!)}", null, null, cancellationToken);
    }

    /// <remarks><c>PUT /api/v1/lists/{shikimori_id}</c>, needs <c>lists:write</c></remarks>
    public Task<ListEntry> SaveListEntryAsync(int shikimoriId, ListBody body, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<ListEntry>(HttpMethod.Put, $"/api/v1/lists/{Core.Escape(shikimoriId.ToString()!)}", null, body, cancellationToken);
    }

    /// <remarks><c>DELETE /api/v1/lists/{shikimori_id}/score</c>, needs <c>lists:write</c></remarks>
    public Task UnrateListEntryAsync(int shikimoriId, CancellationToken cancellationToken = default)
    {
        return _core.NothingAsync(HttpMethod.Delete, $"/api/v1/lists/{Core.Escape(shikimoriId.ToString()!)}/score", null, null, cancellationToken);
    }
}

/// <summary>
/// their writing, and who they read
/// </summary>
public sealed class SocialApi
{
    private readonly Core _core;

    internal SocialApi(Core core) => _core = core;

    /// <remarks><c>PUT /api/v1/following/{nickname}</c>, needs <c>social:write</c></remarks>
    public Task FollowUserAsync(string nickname, CancellationToken cancellationToken = default)
    {
        return _core.NothingAsync(HttpMethod.Put, $"/api/v1/following/{Core.Escape(nickname.ToString()!)}", null, null, cancellationToken);
    }

    /// <remarks><c>GET /api/v1/following</c>, needs <c>social:read</c></remarks>
    public Task<Page<Person>> ListMyFollowingAsync(long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<Person>>(HttpMethod.Get, $"/api/v1/following", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="ListMyFollowingAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<Person> ListMyFollowingAllAsync(long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await ListMyFollowingAsync(limit: window, offset: at, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <summary>
    /// Not the feed: `social:read` is permission to read *this person's* social
    /// life, not everybody's. A timeline of other people's writing is a different
    /// question with a different answer about who may see what, and it is not
    /// behind this word.
    /// </summary>
    /// <remarks><c>GET /api/v1/posts</c>, needs <c>social:read</c></remarks>
    public Task<Page<Post>> ListMyPostsAsync(long? limit = null, long? offset = null, CancellationToken cancellationToken = default)
    {
        var query = new (string, object?)[]
        {
            ("limit", limit),
            ("offset", offset),
        };
        return _core.CallAsync<Page<Post>>(HttpMethod.Get, $"/api/v1/posts", query, null, cancellationToken);
    }

    /// <summary>
    /// Every row of <see cref="ListMyPostsAsync"/>, a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when <c>Total</c> is reached: the list can grow while it is being read,
    /// and counting against a number from the first page walks off the end.
    /// </summary>
    public async IAsyncEnumerable<Post> ListMyPostsAllAsync(long? limit = null, long? offset = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var window = limit ?? 100;
        var at = offset ?? 0;
        while (true)
        {
            var page = await ListMyPostsAsync(limit: window, offset: at, cancellationToken: cancellationToken).ConfigureAwait(false);
            foreach (var row in page.Items)
            {
                yield return row;
            }
            if (page.Items.Count < window)
            {
                yield break;
            }
            at += page.Items.Count;
        }
    }

    /// <remarks><c>DELETE /api/v1/following/{nickname}</c>, needs <c>social:write</c></remarks>
    public Task UnfollowUserAsync(string nickname, CancellationToken cancellationToken = default)
    {
        return _core.NothingAsync(HttpMethod.Delete, $"/api/v1/following/{Core.Escape(nickname.ToString()!)}", null, null, cancellationToken);
    }

    /// <remarks><c>POST /api/v1/posts</c>, needs <c>social:write</c></remarks>
    public Task<Post> WritePostAsync(PostBody body, CancellationToken cancellationToken = default)
    {
        return _core.CallAsync<Post>(HttpMethod.Post, $"/api/v1/posts", null, body, cancellationToken);
    }
}
