// Generated from openapi.json by tools/generate.ts. Do not edit.

package cc.acyka.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * The envelope every collection answers in.
 *
 * `total` is there when the caller pages by offset and therefore has to know
 * how far the list goes; a cursor-paged list leaves it out rather than paying
 * for a second count nobody reads.
 */
@Serializable
public data class Page<T>(
    public val items: List<T> = emptyList(),
    public val total: Long? = null,
) : Iterable<T> {
    override fun iterator(): Iterator<T> = items.iterator()

    public val size: Int get() = items.size

    public fun isEmpty(): Boolean = items.isEmpty()
}

/**
 * A post's id, on the wire as a string and in the database as a bigint.
 *
 * Its own type rather than a `String` field, so the conversion happens in one
 * place and a query that forgets it does not compile. JSON has one number type
 * and it is a double; ids near 2^53 are exactly where that stops being an
 * academic point, and a client that silently rounds one reads and edits the
 * wrong row.
 */
public typealias PostId = String

/**
 * One episode, on one day.
 */
@Serializable
public data class Airing(
    @SerialName("id")
    public val id: Long,
    @SerialName("title")
    public val title: String,
    /** which episode this is, projected: an ongoing series airs weekly, so episode *n* lands seven times *n − 1* days after the first */
    @SerialName("episode")
    public val episode: Int,
    /** `YYYY-MM-DD`, UTC. A date and not a timestamp: nothing here knows the hour an episode lands, and inventing one would be a lie with a clock on it. */
    @SerialName("on")
    public val on: String,
    /** whether a dub for it is already playable here, or it is still projected */
    @SerialName("out")
    public val out: Boolean,
    @SerialName("title_orig")
    public val titleOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

/**
 * A title a character appears in, and what they are in it.
 */
@Serializable
public data class Appearance(
    @SerialName("id")
    public val id: Long,
    @SerialName("title")
    public val title: String,
    /** `tv` | `movie` | `ova` | `ona` | `special` | `music` */
    @SerialName("kind")
    public val kind: String,
    @SerialName("episodes")
    public val episodes: Int,
    @SerialName("roles")
    public val roles: List<String>,
    @SerialName("title_orig")
    public val titleOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("year")
    public val year: Int? = null,
    /** The one number a reader sees: what the people here think of it and what the outside number said, weighed against each other. */
    @SerialName("score")
    public val score: Double? = null,
)

/**
 * A character, as its own page.
 */
@Serializable
public data class Character(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    /** how many titles carry them */
    @SerialName("titles")
    public val titles: Long,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

@Serializable
public data class CharacterCard(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

/**
 * A shelf somebody named.
 */
@Serializable
public data class Collection(
    @SerialName("code")
    public val code: String,
    @SerialName("name")
    public val name: String,
    @SerialName("about")
    public val about: String,
    @SerialName("icon")
    public val icon: String,
    /** `public` | `unlisted` | `private` */
    @SerialName("visibility")
    public val visibility: String,
    /** whether anyone who can read it may also add to it */
    @SerialName("shared")
    public val shared: Boolean,
    @SerialName("count")
    public val count: Long,
    @SerialName("saves")
    public val saves: Long,
    @SerialName("owner")
    public val owner: String,
    @SerialName("owner_verified")
    public val ownerVerified: Boolean,
    @SerialName("covers")
    public val covers: List<String>,
    @SerialName("at")
    public val at: String,
    @SerialName("edited")
    public val edited: String,
    @SerialName("hue")
    public val hue: Int? = null,
    @SerialName("owner_avatar")
    public val ownerAvatar: String? = null,
)

@Serializable
public data class CollectionBody(
    @SerialName("name")
    public val name: String,
    @SerialName("about")
    public val about: String? = null,
    @SerialName("icon")
    public val icon: String? = null,
    @SerialName("hue")
    public val hue: Int? = null,
    @SerialName("visibility")
    public val visibility: String? = null,
    @SerialName("shared")
    public val shared: Boolean? = null,
)

@Serializable
public data class CollectionItem(
    @SerialName("shikimori_id")
    public val shikimoriId: Int,
    @SerialName("title")
    public val title: String,
    @SerialName("at")
    public val at: String,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("added_by")
    public val addedBy: String? = null,
)

@Serializable
public data class EntryBody(
    @SerialName("title")
    public val title: String,
    @SerialName("poster")
    public val poster: String? = null,
)

/**
 * The preview frames one episode has.
 */
@Serializable
public data class Episode(
    @SerialName("episode")
    public val episode: Int,
    @SerialName("shots")
    public val shots: List<String>,
)

@Serializable
public data class ListBody(
    @SerialName("title")
    public val title: String,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("status")
    public val status: String? = null,
    @SerialName("episode")
    public val episode: Int? = null,
)

/**
 * One row of somebody's list.
 *
 * One shape for a caller's own list and for somebody else's, because it is one
 * thing. Two shapes differing by a field would be two unwrappers in every SDK
 * for a row that means exactly the same in both places.
 */
@Serializable
public data class ListEntry(
    @SerialName("shikimori_id")
    public val shikimoriId: Int,
    @SerialName("title")
    public val title: String,
    /** `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped` */
    @SerialName("status")
    public val status: String,
    /** how many they have watched */
    @SerialName("episode")
    public val episode: Int,
    /** RFC 3339, and a string rather than a timestamp type for a reason that is about having one shape: this row comes from two places, and the site's own reader already formats it. A parse on this side to fit a stricter type would need something to do when it failed, and every honest answer to that is a lie about when somebody watched something. */
    @SerialName("at")
    public val at: String,
    @SerialName("poster")
    public val poster: String? = null,
    /** How many the catalogue holds, so a counter knows where the series stops. Absent where the catalogue does not carry it or does not know — an announcement, and a good half of what is airing — and absent means "no ceiling" rather than "none". */
    @SerialName("episodes")
    public val episodes: Int? = null,
    /** what they thought of it; null for a title they have not judged */
    @SerialName("score")
    public val score: Int? = null,
)

/**
 * An account, as its own token sees it.
 *
 * Field for field what `/oauth2/userinfo` would say, in this door's casing,
 * plus the things a claim set has no room for. It exists beside userinfo
 * rather than instead of it because userinfo's shape is fixed by a spec and
 * this one is ours to grow.
 */
@Serializable
public data class Me(
    /** A string, and never a number. It is an `id_token`'s `sub` on the other door and a JSON number loses precision in a language that has only doubles — which is most of them, including the one most of these clients are written in. */
    @SerialName("id")
    public val id: String,
    @SerialName("nickname")
    public val nickname: String? = null,
    @SerialName("avatar")
    public val avatar: String? = null,
    @SerialName("banner")
    public val banner: String? = null,
    @SerialName("bio")
    public val bio: String? = null,
    @SerialName("verified")
    public val verified: Boolean? = null,
    @SerialName("created_at")
    public val createdAt: String? = null,
    @SerialName("email")
    public val email: String? = null,
    @SerialName("email_verified")
    public val emailVerified: Boolean? = null,
)

/**
 * Somebody, as small as a person gets on this door.
 *
 * The site draws a person with `Name` or `Identity` and hands those components
 * a whole `Wearer` — the colour, the badges, the pattern, the presence. None
 * of that is here, and leaving it out is the decision rather than an omission:
 * a badge is a thing this site invented and may re-invent, and a client that
 * has built a row around `worn.hue` is a client we would have to keep it for.
 */
@Serializable
public data class Person(
    @SerialName("nickname")
    public val nickname: String,
    @SerialName("verified")
    public val verified: Boolean,
    @SerialName("avatar")
    public val avatar: String? = null,
)

@Serializable
public data class PersonCard(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    /** What this person is. All three can be false — most of a crew is none of them — and several can be true at once. */
    @SerialName("seyu")
    public val seyu: Boolean,
    @SerialName("mangaka")
    public val mangaka: Boolean,
    @SerialName("producer")
    public val producer: Boolean,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

/**
 * A person, as their own page.
 */
@Serializable
public data class PersonPage(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    /** What this person is. All three can be false — most of a crew is none of them — and several can be true at once. */
    @SerialName("seyu")
    public val seyu: Boolean,
    @SerialName("mangaka")
    public val mangaka: Boolean,
    @SerialName("producer")
    public val producer: Boolean,
    @SerialName("titles")
    public val titles: Long,
    @SerialName("roles")
    public val roles: Long,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("japanese")
    public val japanese: String? = null,
    @SerialName("website")
    public val website: String? = null,
)

@Serializable
public data class Post(
    /** A string for the reason [`Me::id`] is one. */
    @SerialName("id")
    public val id: PostId,
    @SerialName("body")
    public val body: String,
    @SerialName("at")
    public val at: String,
    @SerialName("shikimori_id")
    public val shikimoriId: Int? = null,
    @SerialName("title")
    public val title: String? = null,
    @SerialName("episode")
    public val episode: Int? = null,
    @SerialName("parent")
    public val parent: JsonElement? = null,
)

@Serializable
public data class PostBody(
    @SerialName("body")
    public val body: String,
    @SerialName("shikimori_id")
    public val shikimoriId: Int? = null,
    @SerialName("title")
    public val title: String? = null,
    @SerialName("episode")
    public val episode: Int? = null,
    /** Read and ignored. A post used to be able to hide behind one flag; `||a phrase||` in the body does that properly and this door is a contract somebody else's code already sends. Refusing the field would break a client over a word that no longer means anything, so it is accepted and dropped. */
    @SerialName("spoiler")
    public val spoiler: Boolean? = null,
    @SerialName("parent")
    public val parent: Long? = null,
)

/**
 * A public profile.
 *
 * Narrower than the site's own, on purpose, and narrower in one direction: the
 * counts an account keeps to itself are **absent** here exactly as they are
 * there, because that decision is made in `social::profile_of`'s query and not
 * by whoever is formatting the answer. Copying the numbers out is safe; asking
 * for them a second way would not be.
 */
@Serializable
public data class Profile(
    @SerialName("id")
    public val id: String,
    @SerialName("nickname")
    public val nickname: String,
    @SerialName("verified")
    public val verified: Boolean,
    /** `user` | `mod` | `admin` */
    @SerialName("role")
    public val role: String,
    @SerialName("joined_at")
    public val joinedAt: String,
    @SerialName("avatar")
    public val avatar: String? = null,
    @SerialName("banner")
    public val banner: String? = null,
    @SerialName("bio")
    public val bio: String? = null,
    @SerialName("about")
    public val about: String? = null,
    /** The other names this account answers to, in the order they arranged them. */
    @SerialName("also")
    public val also: List<String>? = null,
    @SerialName("followers")
    public val followers: Int? = null,
    @SerialName("following")
    public val following: Int? = null,
    @SerialName("titles")
    public val titles: Int? = null,
    @SerialName("episodes")
    public val episodes: Int? = null,
)

/**
 * Every refusal on this door, in the one shape they all take.
 *
 * `message` is a **phrase name and never a sentence**: one room can hold five
 * languages at once, so the server does not get to choose which one an error
 * is read in. A client shows its own words for the names it knows and the name
 * itself for the ones it does not — which is also why the list of them is
 * stable enough to generate a typed error per name in six languages.
 */
@Serializable
public data class Refusal(
    /** e.g. `errors.oauthInsufficientScope` */
    @SerialName("message")
    public val message: String,
    /** Extra fields a refusal owes a reason for, merged in beside `message` — the scope that was missing, how long a ban has left. Absent for most. */
    @SerialName("detail")
    public val detail: JsonElement? = null,
)

/**
 * A franchise entry: a card, plus where in the sequence the caller was.
 */
@Serializable
public data class Related(
    @SerialName("id")
    public val id: Long,
    @SerialName("title")
    public val title: String,
    /** `tv` | `movie` | `ova` | `ona` | `special` | `music` */
    @SerialName("kind")
    public val kind: String,
    @SerialName("episodes")
    public val episodes: Int,
    /** whether this row *is* the title that was asked about */
    @SerialName("current")
    public val current: Boolean,
    @SerialName("title_orig")
    public val titleOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("year")
    public val year: Int? = null,
    /** The one number a reader sees: what the people here think of it and what the outside number said, weighed against each other. */
    @SerialName("score")
    public val score: Double? = null,
)

@Serializable
public data class ScoreBody(
    @SerialName("score")
    public val score: Int,
    @SerialName("title")
    public val title: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

/**
 * What somebody's watching adds up to.
 */
@Serializable
public data class Stats(
    @SerialName("planned")
    public val planned: Long,
    @SerialName("watching")
    public val watching: Long,
    @SerialName("rewatching")
    public val rewatching: Long,
    @SerialName("paused")
    public val paused: Long,
    @SerialName("done")
    public val done: Long,
    @SerialName("dropped")
    public val dropped: Long,
    @SerialName("episodes")
    public val episodes: Long,
    @SerialName("minutes")
    public val minutes: Long,
    @SerialName("rated")
    public val rated: Long,
    @SerialName("average")
    public val average: Double? = null,
)

/**
 * A title, as its own page.
 *
 * `wash` is on the site's shape and is not on this one. It is the colour a
 * page tints itself with, computed from the artwork on first read — a fact
 * about how this site draws a screen rather than a fact about the title, and
 * putting it in a frozen contract would be promising a stranger the house's
 * paint.
 */
@Serializable
public data class Title(
    @SerialName("id")
    public val id: Long,
    @SerialName("title")
    public val title: String,
    @SerialName("genres")
    public val genres: List<String>,
    @SerialName("studios")
    public val studios: List<String>,
    @SerialName("kind")
    public val kind: String,
    /** `ongoing` | `released` | `announced` */
    @SerialName("status")
    public val status: String,
    @SerialName("episodes")
    public val episodes: Int,
    @SerialName("our_votes")
    public val ourVotes: Int,
    @SerialName("screenshots")
    public val screenshots: List<String>,
    @SerialName("title_orig")
    public val titleOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("description")
    public val description: String? = null,
    @SerialName("duration")
    public val duration: Int? = null,
    @SerialName("score")
    public val score: Double? = null,
    /** And the two halves of that one number, for a caller with room to say so. */
    @SerialName("our_score")
    public val ourScore: Double? = null,
    @SerialName("year")
    public val year: Int? = null,
    @SerialName("rating")
    public val rating: String? = null,
)

/**
 * A title as it appears in a list.
 *
 * `id` is the shikimori id and is the only key this catalogue has ever had. It
 * is a number here rather than a string, unlike the ids above: these are five
 * and six digits and always will be, since they are somebody else's sequence
 * and not ours to outgrow.
 */
@Serializable
public data class TitleCard(
    @SerialName("id")
    public val id: Long,
    @SerialName("title")
    public val title: String,
    /** `tv` | `movie` | `ova` | `ona` | `special` | `music` */
    @SerialName("kind")
    public val kind: String,
    @SerialName("episodes")
    public val episodes: Int,
    @SerialName("title_orig")
    public val titleOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("year")
    public val year: Int? = null,
    /** The one number a reader sees: what the people here think of it and what the outside number said, weighed against each other. */
    @SerialName("score")
    public val score: Double? = null,
)

/**
 * One character in one title.
 */
@Serializable
public data class TitleCharacter(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    /** `Main` or `Supporting`, as the source words it */
    @SerialName("roles")
    public val roles: List<String>,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    @SerialName("voices")
    public val voices: List<Voice>? = null,
)

/**
 * One person on one title, and what they did on it.
 */
@Serializable
public data class TitleStaff(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    /** What this person is. All three can be false — most of a crew is none of them — and several can be true at once. */
    @SerialName("seyu")
    public val seyu: Boolean,
    @SerialName("mangaka")
    public val mangaka: Boolean,
    @SerialName("producer")
    public val producer: Boolean,
    @SerialName("roles")
    public val roles: List<String>,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

/**
 * Somebody who said the lines, and the language they said them in.
 *
 * **`language` absent means nobody has said, which is not the same as "not
 * japanese".** The pass that fills it asks AniList for the japanese cast,
 * which can confirm a voice and can never rule one out. A client that reads
 * this as a boolean will label a chinese dub actress as the original.
 */
@Serializable
public data class Voice(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    /** What this person is. All three can be false — most of a crew is none of them — and several can be true at once. */
    @SerialName("seyu")
    public val seyu: Boolean,
    @SerialName("mangaka")
    public val mangaka: Boolean,
    @SerialName("producer")
    public val producer: Boolean,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
    /** a BCP-47 tag — `ja` for the original, and the only one written so far */
    @SerialName("language")
    public val language: String? = null,
)

/**
 * A character somebody voiced, and where.
 */
@Serializable
public data class VoicedRole(
    @SerialName("id")
    public val id: Long,
    @SerialName("name")
    public val name: String,
    @SerialName("title")
    public val title: TitleCard,
    @SerialName("roles")
    public val roles: List<String>,
    @SerialName("name_orig")
    public val nameOrig: String? = null,
    @SerialName("poster")
    public val poster: String? = null,
)

/** Every scope this api offers. */
public val SCOPES: List<String> = listOf(
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
)
