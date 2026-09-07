// Generated from openapi.json by tools/generate.ts. Do not edit.

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Acyka;

/// <summary>
/// The envelope every collection answers in.
///
/// <c>Total</c> is there when the caller pages by offset and therefore has to
/// know how far the list goes; a cursor-paged list leaves it out rather than
/// paying for a second count nobody reads.
/// </summary>
public sealed record Page<T>(
    [property: JsonPropertyName("items")] IReadOnlyList<T> Items,
    [property: JsonPropertyName("total")] long? Total = null
)
{
    /// <summary>
    /// So <c>foreach</c> works on the page itself.
    ///
    /// A method and <b>not</b> <c>IEnumerable&lt;T&gt;</c>, which is what this
    /// was first: <c>System.Text.Json</c> treats anything implementing that
    /// interface as a collection, and then tries to read <c>{"items": …}</c>
    /// as a JSON array and throws on every single answer. C# resolves
    /// <c>foreach</c> against a public <c>GetEnumerator</c> without the
    /// interface, so this costs nothing and the deserialiser sees an object.
    /// For LINQ, use <c>Items</c>.
    /// </summary>
    public IEnumerator<T> GetEnumerator() => Items.GetEnumerator();

    public int Count => Items.Count;
}

/// <summary>
/// One episode, on one day.
/// </summary>
/// <param name="Episode">which episode this is, projected: an ongoing series airs weekly, so episode *n* lands seven times *n − 1* days after the first</param>
/// <param name="On">`YYYY-MM-DD`, UTC. A date and not a timestamp: nothing here knows the hour an episode lands, and inventing one would be a lie with a clock on it.</param>
/// <param name="Out">whether a dub for it is already playable here, or it is still projected</param>
public sealed record Airing(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("episode")] int Episode,
    [property: JsonPropertyName("on")] string On,
    [property: JsonPropertyName("out")] bool Out,
    [property: JsonPropertyName("title_orig")] string? TitleOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>
/// A title a character appears in, and what they are in it.
/// </summary>
/// <param name="Kind">`tv` | `movie` | `ova` | `ona` | `special` | `music`</param>
/// <param name="Score">The one number a reader sees: what the people here think of it and what the outside number said, weighed against each other.</param>
public sealed record Appearance(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("episodes")] int Episodes,
    [property: JsonPropertyName("roles")] IReadOnlyList<string> Roles,
    [property: JsonPropertyName("title_orig")] string? TitleOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("year")] int? Year = null,
    [property: JsonPropertyName("score")] double? Score = null
);

/// <summary>
/// A character, as its own page.
/// </summary>
/// <param name="Titles">how many titles carry them</param>
public sealed record Character(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("titles")] long Titles,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

public sealed record CharacterCard(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>
/// A shelf somebody named.
/// </summary>
/// <param name="Visibility">`public` | `unlisted` | `private`</param>
/// <param name="Shared">whether anyone who can read it may also add to it</param>
public sealed record Collection(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("about")] string About,
    [property: JsonPropertyName("icon")] string Icon,
    [property: JsonPropertyName("visibility")] string Visibility,
    [property: JsonPropertyName("shared")] bool Shared,
    [property: JsonPropertyName("count")] long Count,
    [property: JsonPropertyName("saves")] long Saves,
    [property: JsonPropertyName("owner")] string Owner,
    [property: JsonPropertyName("owner_verified")] bool OwnerVerified,
    [property: JsonPropertyName("covers")] IReadOnlyList<string> Covers,
    [property: JsonPropertyName("at")] string At,
    [property: JsonPropertyName("edited")] string Edited,
    [property: JsonPropertyName("hue")] int? Hue = null,
    [property: JsonPropertyName("owner_avatar")] string? OwnerAvatar = null
);

public sealed record CollectionBody(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("about")] string? About = null,
    [property: JsonPropertyName("icon")] string? Icon = null,
    [property: JsonPropertyName("hue")] int? Hue = null,
    [property: JsonPropertyName("visibility")] string? Visibility = null,
    [property: JsonPropertyName("shared")] bool? Shared = null
);

public sealed record CollectionItem(
    [property: JsonPropertyName("shikimori_id")] int ShikimoriId,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("at")] string At,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("added_by")] string? AddedBy = null
);

public sealed record EntryBody(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>
/// The preview frames one episode has.
/// </summary>
public sealed record Episode(
    [property: JsonPropertyName("episode")] int Episode_,
    [property: JsonPropertyName("shots")] IReadOnlyList<string> Shots
);

public sealed record ListBody(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("status")] string? Status = null,
    [property: JsonPropertyName("episode")] int? Episode = null
);

/// <summary>
/// One row of somebody's list.
/// 
/// One shape for a caller's own list and for somebody else's, because it is one
/// thing. Two shapes differing by a field would be two unwrappers in every SDK
/// for a row that means exactly the same in both places.
/// </summary>
/// <param name="Status">`planned` | `watching` | `rewatching` | `paused` | `done` | `dropped`</param>
/// <param name="Episode">how many they have watched</param>
/// <param name="At">RFC 3339, and a string rather than a timestamp type for a reason that is about having one shape: this row comes from two places, and the site's own reader already formats it. A parse on this side to fit a stricter type would need something to do when it failed, and every honest answer to that is a lie about when somebody watched something.</param>
/// <param name="Episodes">How many the catalogue holds, so a counter knows where the series stops. Absent where the catalogue does not carry it or does not know — an announcement, and a good half of what is airing — and absent means "no ceiling" rather than "none".</param>
/// <param name="Score">what they thought of it; null for a title they have not judged</param>
public sealed record ListEntry(
    [property: JsonPropertyName("shikimori_id")] int ShikimoriId,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("episode")] int Episode,
    [property: JsonPropertyName("at")] string At,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("episodes")] int? Episodes = null,
    [property: JsonPropertyName("score")] int? Score = null
);

/// <summary>
/// An account, as its own token sees it.
/// 
/// Field for field what `/oauth2/userinfo` would say, in this door's casing,
/// plus the things a claim set has no room for. It exists beside userinfo
/// rather than instead of it because userinfo's shape is fixed by a spec and
/// this one is ours to grow.
/// </summary>
/// <param name="Id">A string, and never a number. It is an `id_token`'s `sub` on the other door and a JSON number loses precision in a language that has only doubles — which is most of them, including the one most of these clients are written in.</param>
public sealed record Me(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("nickname")] string? Nickname = null,
    [property: JsonPropertyName("avatar")] string? Avatar = null,
    [property: JsonPropertyName("banner")] string? Banner = null,
    [property: JsonPropertyName("bio")] string? Bio = null,
    [property: JsonPropertyName("verified")] bool? Verified = null,
    [property: JsonPropertyName("created_at")] string? CreatedAt = null,
    [property: JsonPropertyName("email")] string? Email = null,
    [property: JsonPropertyName("email_verified")] bool? EmailVerified = null
);

/// <summary>
/// Somebody, as small as a person gets on this door.
/// 
/// The site draws a person with `Name` or `Identity` and hands those components
/// a whole `Wearer` — the colour, the badges, the pattern, the presence. None
/// of that is here, and leaving it out is the decision rather than an omission:
/// a badge is a thing this site invented and may re-invent, and a client that
/// has built a row around `worn.hue` is a client we would have to keep it for.
/// </summary>
public sealed record Person(
    [property: JsonPropertyName("nickname")] string Nickname,
    [property: JsonPropertyName("verified")] bool Verified,
    [property: JsonPropertyName("avatar")] string? Avatar = null
);

/// <param name="Seyu">What this person is. All three can be false — most of a crew is none of them — and several can be true at once.</param>
public sealed record PersonCard(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("seyu")] bool Seyu,
    [property: JsonPropertyName("mangaka")] bool Mangaka,
    [property: JsonPropertyName("producer")] bool Producer,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>
/// A person, as their own page.
/// </summary>
/// <param name="Seyu">What this person is. All three can be false — most of a crew is none of them — and several can be true at once.</param>
public sealed record PersonPage(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("seyu")] bool Seyu,
    [property: JsonPropertyName("mangaka")] bool Mangaka,
    [property: JsonPropertyName("producer")] bool Producer,
    [property: JsonPropertyName("titles")] long Titles,
    [property: JsonPropertyName("roles")] long Roles,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("japanese")] string? Japanese = null,
    [property: JsonPropertyName("website")] string? Website = null
);

/// <param name="Id">A string for the reason [`Me::id`] is one.</param>
public sealed record Post(
    [property: JsonPropertyName("id")] PostId Id,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("at")] string At,
    [property: JsonPropertyName("shikimori_id")] int? ShikimoriId = null,
    [property: JsonPropertyName("title")] string? Title = null,
    [property: JsonPropertyName("episode")] int? Episode = null,
    [property: JsonPropertyName("parent")] JsonElement? Parent = null
);

/// <param name="Spoiler">Read and ignored. A post used to be able to hide behind one flag; `||a phrase||` in the body does that properly and this door is a contract somebody else's code already sends. Refusing the field would break a client over a word that no longer means anything, so it is accepted and dropped.</param>
public sealed record PostBody(
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("shikimori_id")] int? ShikimoriId = null,
    [property: JsonPropertyName("title")] string? Title = null,
    [property: JsonPropertyName("episode")] int? Episode = null,
    [property: JsonPropertyName("spoiler")] bool? Spoiler = null,
    [property: JsonPropertyName("parent")] long? Parent = null
);

/// <summary>
/// A public profile.
/// 
/// Narrower than the site's own, on purpose, and narrower in one direction: the
/// counts an account keeps to itself are **absent** here exactly as they are
/// there, because that decision is made in `social::profile_of`'s query and not
/// by whoever is formatting the answer. Copying the numbers out is safe; asking
/// for them a second way would not be.
/// </summary>
/// <param name="Role">`user` | `mod` | `admin`</param>
/// <param name="Also">The other names this account answers to, in the order they arranged them.</param>
public sealed record Profile(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("nickname")] string Nickname,
    [property: JsonPropertyName("verified")] bool Verified,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("joined_at")] string JoinedAt,
    [property: JsonPropertyName("avatar")] string? Avatar = null,
    [property: JsonPropertyName("banner")] string? Banner = null,
    [property: JsonPropertyName("bio")] string? Bio = null,
    [property: JsonPropertyName("about")] string? About = null,
    [property: JsonPropertyName("also")] IReadOnlyList<string>? Also = null,
    [property: JsonPropertyName("followers")] int? Followers = null,
    [property: JsonPropertyName("following")] int? Following = null,
    [property: JsonPropertyName("titles")] int? Titles = null,
    [property: JsonPropertyName("episodes")] int? Episodes = null
);

/// <summary>
/// Every refusal on this door, in the one shape they all take.
/// 
/// `message` is a **phrase name and never a sentence**: one room can hold five
/// languages at once, so the server does not get to choose which one an error
/// is read in. A client shows its own words for the names it knows and the name
/// itself for the ones it does not — which is also why the list of them is
/// stable enough to generate a typed error per name in six languages.
/// </summary>
/// <param name="Message">e.g. `errors.oauthInsufficientScope`</param>
/// <param name="Detail">Extra fields a refusal owes a reason for, merged in beside `message` — the scope that was missing, how long a ban has left. Absent for most.</param>
public sealed record Refusal(
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("detail")] JsonElement? Detail = null
);

/// <summary>
/// A franchise entry: a card, plus where in the sequence the caller was.
/// </summary>
/// <param name="Kind">`tv` | `movie` | `ova` | `ona` | `special` | `music`</param>
/// <param name="Current">whether this row *is* the title that was asked about</param>
/// <param name="Score">The one number a reader sees: what the people here think of it and what the outside number said, weighed against each other.</param>
public sealed record Related(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("episodes")] int Episodes,
    [property: JsonPropertyName("current")] bool Current,
    [property: JsonPropertyName("title_orig")] string? TitleOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("year")] int? Year = null,
    [property: JsonPropertyName("score")] double? Score = null
);

public sealed record ScoreBody(
    [property: JsonPropertyName("score")] int Score,
    [property: JsonPropertyName("title")] string? Title = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>
/// What somebody's watching adds up to.
/// </summary>
public sealed record Stats(
    [property: JsonPropertyName("planned")] long Planned,
    [property: JsonPropertyName("watching")] long Watching,
    [property: JsonPropertyName("rewatching")] long Rewatching,
    [property: JsonPropertyName("paused")] long Paused,
    [property: JsonPropertyName("done")] long Done,
    [property: JsonPropertyName("dropped")] long Dropped,
    [property: JsonPropertyName("episodes")] long Episodes,
    [property: JsonPropertyName("minutes")] long Minutes,
    [property: JsonPropertyName("rated")] long Rated,
    [property: JsonPropertyName("average")] double? Average = null
);

/// <summary>
/// A title, as its own page.
/// 
/// `wash` is on the site's shape and is not on this one. It is the colour a
/// page tints itself with, computed from the artwork on first read — a fact
/// about how this site draws a screen rather than a fact about the title, and
/// putting it in a frozen contract would be promising a stranger the house's
/// paint.
/// </summary>
/// <param name="Status">`ongoing` | `released` | `announced`</param>
/// <param name="OurScore">And the two halves of that one number, for a caller with room to say so.</param>
public sealed record Title(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("title")] string Title_,
    [property: JsonPropertyName("genres")] IReadOnlyList<string> Genres,
    [property: JsonPropertyName("studios")] IReadOnlyList<string> Studios,
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("episodes")] int Episodes,
    [property: JsonPropertyName("our_votes")] int OurVotes,
    [property: JsonPropertyName("screenshots")] IReadOnlyList<string> Screenshots,
    [property: JsonPropertyName("title_orig")] string? TitleOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("description")] string? Description = null,
    [property: JsonPropertyName("duration")] int? Duration = null,
    [property: JsonPropertyName("score")] double? Score = null,
    [property: JsonPropertyName("our_score")] double? OurScore = null,
    [property: JsonPropertyName("year")] int? Year = null,
    [property: JsonPropertyName("rating")] string? Rating = null
);

/// <summary>
/// A title as it appears in a list.
/// 
/// `id` is the shikimori id and is the only key this catalogue has ever had. It
/// is a number here rather than a string, unlike the ids above: these are five
/// and six digits and always will be, since they are somebody else's sequence
/// and not ours to outgrow.
/// </summary>
/// <param name="Kind">`tv` | `movie` | `ova` | `ona` | `special` | `music`</param>
/// <param name="Score">The one number a reader sees: what the people here think of it and what the outside number said, weighed against each other.</param>
public sealed record TitleCard(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("episodes")] int Episodes,
    [property: JsonPropertyName("title_orig")] string? TitleOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("year")] int? Year = null,
    [property: JsonPropertyName("score")] double? Score = null
);

/// <summary>
/// One character in one title.
/// </summary>
/// <param name="Roles">`Main` or `Supporting`, as the source words it</param>
public sealed record TitleCharacter(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("roles")] IReadOnlyList<string> Roles,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("voices")] IReadOnlyList<Voice>? Voices = null
);

/// <summary>
/// One person on one title, and what they did on it.
/// </summary>
/// <param name="Seyu">What this person is. All three can be false — most of a crew is none of them — and several can be true at once.</param>
public sealed record TitleStaff(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("seyu")] bool Seyu,
    [property: JsonPropertyName("mangaka")] bool Mangaka,
    [property: JsonPropertyName("producer")] bool Producer,
    [property: JsonPropertyName("roles")] IReadOnlyList<string> Roles,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>
/// Somebody who said the lines, and the language they said them in.
/// 
/// **`language` absent means nobody has said, which is not the same as "not
/// japanese".** The pass that fills it asks AniList for the japanese cast,
/// which can confirm a voice and can never rule one out. A client that reads
/// this as a boolean will label a chinese dub actress as the original.
/// </summary>
/// <param name="Seyu">What this person is. All three can be false — most of a crew is none of them — and several can be true at once.</param>
/// <param name="Language">a BCP-47 tag — `ja` for the original, and the only one written so far</param>
public sealed record Voice(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("seyu")] bool Seyu,
    [property: JsonPropertyName("mangaka")] bool Mangaka,
    [property: JsonPropertyName("producer")] bool Producer,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null,
    [property: JsonPropertyName("language")] string? Language = null
);

/// <summary>
/// A character somebody voiced, and where.
/// </summary>
public sealed record VoicedRole(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("title")] TitleCard Title,
    [property: JsonPropertyName("roles")] IReadOnlyList<string> Roles,
    [property: JsonPropertyName("name_orig")] string? NameOrig = null,
    [property: JsonPropertyName("poster")] string? Poster = null
);

/// <summary>Every scope this api offers.</summary>
public static class Scopes
{
    public static readonly IReadOnlyList<string> All = new[]
    {
        "catalog:read",
        "email",
        "lists:read",
        "lists:write",
        "offline_access",
        "openid",
        "people:read",
        "profile",
        "social:read",
        "social:write",
    };
}
