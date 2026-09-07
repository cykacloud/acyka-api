"""Generated from openapi.json by tools/generate.ts. Do not edit."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Generic, TypeVar

T = TypeVar("T")


def _asis(value: Any) -> Any:
    return value


@dataclass(frozen=True, slots=True)
class Page(Generic[T]):
    """The envelope every collection answers in.

    ``total`` is there when the caller pages by offset and therefore has to
    know how far the list goes; a cursor-paged list leaves it out rather than
    paying for a second count nobody reads.
    """

    items: list[T]
    total: int | None = None

    @classmethod
    def _parse(cls, raw: Any, row: Any) -> Page[Any]:
        return cls(items=[row(x) for x in raw.get("items", [])], total=raw.get("total"))

    def __iter__(self):
        return iter(self.items)

    def __len__(self) -> int:
        return len(self.items)


#: A post's id, on the wire as a string and in the database as a bigint.
PostId = str


@dataclass(frozen=True, slots=True)
class Airing:
    """One episode, on one day."""

    id: int
    title: str
    #: which episode this is, projected: an ongoing series airs weekly, so episode
    #: *n* lands seven times *n − 1* days after the first
    episode: int
    #: `YYYY-MM-DD`, UTC. A date and not a timestamp: nothing here knows the hour
    #: an episode lands, and inventing one would be a lie with a clock on it.
    on: str
    #: whether a dub for it is already playable here, or it is still projected
    out: bool
    title_orig: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Airing:
        return cls(
            id=raw["id"],
            title=raw["title"],
            episode=raw["episode"],
            on=raw["on"],
            out=raw["out"],
            title_orig=raw.get("title_orig"),
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class Appearance:
    """A title a character appears in, and what they are in it."""

    id: int
    title: str
    #: `tv` | `movie` | `ova` | `ona` | `special` | `music`
    kind: str
    episodes: int
    roles: list[str]
    title_orig: str | None = None
    poster: str | None = None
    year: int | None = None
    #: The one number a reader sees: what the people here think of it and what the
    #: outside number said, weighed against each other.
    score: float | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Appearance:
        return cls(
            id=raw["id"],
            title=raw["title"],
            kind=raw["kind"],
            episodes=raw["episodes"],
            roles=raw["roles"],
            title_orig=raw.get("title_orig"),
            poster=raw.get("poster"),
            year=raw.get("year"),
            score=raw.get("score"),
        )


@dataclass(frozen=True, slots=True)
class Character:
    """A character, as its own page."""

    id: int
    name: str
    #: how many titles carry them
    titles: int
    name_orig: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Character:
        return cls(
            id=raw["id"],
            name=raw["name"],
            titles=raw["titles"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class CharacterCard:
    id: int
    name: str
    name_orig: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> CharacterCard:
        return cls(
            id=raw["id"],
            name=raw["name"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class Collection:
    """A shelf somebody named."""

    code: str
    name: str
    about: str
    icon: str
    #: `public` | `unlisted` | `private`
    visibility: str
    #: whether anyone who can read it may also add to it
    shared: bool
    count: int
    saves: int
    owner: str
    owner_verified: bool
    covers: list[str]
    at: str
    edited: str
    hue: int | None = None
    owner_avatar: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Collection:
        return cls(
            code=raw["code"],
            name=raw["name"],
            about=raw["about"],
            icon=raw["icon"],
            visibility=raw["visibility"],
            shared=raw["shared"],
            count=raw["count"],
            saves=raw["saves"],
            owner=raw["owner"],
            owner_verified=raw["owner_verified"],
            covers=raw["covers"],
            at=raw["at"],
            edited=raw["edited"],
            hue=raw.get("hue"),
            owner_avatar=raw.get("owner_avatar"),
        )


@dataclass(frozen=True, slots=True)
class CollectionBody:
    name: str
    about: str | None = None
    icon: str | None = None
    hue: int | None = None
    visibility: str | None = None
    shared: bool | None = None

    @classmethod
    def _parse(cls, raw: Any) -> CollectionBody:
        return cls(
            name=raw["name"],
            about=raw.get("about"),
            icon=raw.get("icon"),
            hue=raw.get("hue"),
            visibility=raw.get("visibility"),
            shared=raw.get("shared"),
        )


@dataclass(frozen=True, slots=True)
class CollectionItem:
    shikimori_id: int
    title: str
    at: str
    poster: str | None = None
    added_by: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> CollectionItem:
        return cls(
            shikimori_id=raw["shikimori_id"],
            title=raw["title"],
            at=raw["at"],
            poster=raw.get("poster"),
            added_by=raw.get("added_by"),
        )


@dataclass(frozen=True, slots=True)
class EntryBody:
    title: str
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> EntryBody:
        return cls(
            title=raw["title"],
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class Episode:
    """The preview frames one episode has."""

    episode: int
    shots: list[str]

    @classmethod
    def _parse(cls, raw: Any) -> Episode:
        return cls(
            episode=raw["episode"],
            shots=raw["shots"],
        )


@dataclass(frozen=True, slots=True)
class ListBody:
    title: str
    poster: str | None = None
    status: str | None = None
    episode: int | None = None

    @classmethod
    def _parse(cls, raw: Any) -> ListBody:
        return cls(
            title=raw["title"],
            poster=raw.get("poster"),
            status=raw.get("status"),
            episode=raw.get("episode"),
        )


@dataclass(frozen=True, slots=True)
class ListEntry:
    """One row of somebody's list.

    One shape for a caller's own list and for somebody else's, because it is one
    thing. Two shapes differing by a field would be two unwrappers in every SDK
    for a row that means exactly the same in both places.
    """

    shikimori_id: int
    title: str
    #: `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped`
    status: str
    #: how many they have watched
    episode: int
    #: RFC 3339, and a string rather than a timestamp type for a reason that is
    #: about having one shape: this row comes from two places, and the site's own
    #: reader already formats it. A parse on this side to fit a stricter type would
    #: need something to do when it failed, and every honest answer to that is a
    #: lie about when somebody watched something.
    at: str
    poster: str | None = None
    #: How many the catalogue holds, so a counter knows where the series stops.
    #: Absent where the catalogue does not carry it or does not know — an
    #: announcement, and a good half of what is airing — and absent means "no
    #: ceiling" rather than "none".
    episodes: int | None = None
    #: what they thought of it; null for a title they have not judged
    score: int | None = None

    @classmethod
    def _parse(cls, raw: Any) -> ListEntry:
        return cls(
            shikimori_id=raw["shikimori_id"],
            title=raw["title"],
            status=raw["status"],
            episode=raw["episode"],
            at=raw["at"],
            poster=raw.get("poster"),
            episodes=raw.get("episodes"),
            score=raw.get("score"),
        )


@dataclass(frozen=True, slots=True)
class Me:
    """An account, as its own token sees it.

    Field for field what `/oauth2/userinfo` would say, in this door's casing,
    plus the things a claim set has no room for. It exists beside userinfo
    rather than instead of it because userinfo's shape is fixed by a spec and
    this one is ours to grow.
    """

    #: A string, and never a number.
    #:
    #: It is an `id_token`'s `sub` on the other door and a JSON number loses
    #: precision in a language that has only doubles — which is most of them,
    #: including the one most of these clients are written in.
    id: str
    nickname: str | None = None
    avatar: str | None = None
    banner: str | None = None
    bio: str | None = None
    verified: bool | None = None
    created_at: str | None = None
    email: str | None = None
    email_verified: bool | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Me:
        return cls(
            id=raw["id"],
            nickname=raw.get("nickname"),
            avatar=raw.get("avatar"),
            banner=raw.get("banner"),
            bio=raw.get("bio"),
            verified=raw.get("verified"),
            created_at=raw.get("created_at"),
            email=raw.get("email"),
            email_verified=raw.get("email_verified"),
        )


@dataclass(frozen=True, slots=True)
class Person:
    """Somebody, as small as a person gets on this door.

    The site draws a person with `Name` or `Identity` and hands those components
    a whole `Wearer` — the colour, the badges, the pattern, the presence. None
    of that is here, and leaving it out is the decision rather than an omission:
    a badge is a thing this site invented and may re-invent, and a client that
    has built a row around `worn.hue` is a client we would have to keep it for.
    """

    nickname: str
    verified: bool
    avatar: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Person:
        return cls(
            nickname=raw["nickname"],
            verified=raw["verified"],
            avatar=raw.get("avatar"),
        )


@dataclass(frozen=True, slots=True)
class PersonCard:
    id: int
    name: str
    #: What this person is. All three can be false — most of a crew is none of them
    #: — and several can be true at once.
    seyu: bool
    mangaka: bool
    producer: bool
    name_orig: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> PersonCard:
        return cls(
            id=raw["id"],
            name=raw["name"],
            seyu=raw["seyu"],
            mangaka=raw["mangaka"],
            producer=raw["producer"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class PersonPage:
    """A person, as their own page."""

    id: int
    name: str
    #: What this person is. All three can be false — most of a crew is none of them
    #: — and several can be true at once.
    seyu: bool
    mangaka: bool
    producer: bool
    titles: int
    roles: int
    name_orig: str | None = None
    poster: str | None = None
    japanese: str | None = None
    website: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> PersonPage:
        return cls(
            id=raw["id"],
            name=raw["name"],
            seyu=raw["seyu"],
            mangaka=raw["mangaka"],
            producer=raw["producer"],
            titles=raw["titles"],
            roles=raw["roles"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
            japanese=raw.get("japanese"),
            website=raw.get("website"),
        )


@dataclass(frozen=True, slots=True)
class Post:
    #: A string for the reason [`Me::id`] is one.
    id: PostId
    body: str
    at: str
    shikimori_id: int | None = None
    title: str | None = None
    episode: int | None = None
    parent: PostId | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Post:
        return cls(
            id=raw["id"],
            body=raw["body"],
            at=raw["at"],
            shikimori_id=raw.get("shikimori_id"),
            title=raw.get("title"),
            episode=raw.get("episode"),
            parent=raw.get("parent"),
        )


@dataclass(frozen=True, slots=True)
class PostBody:
    body: str
    shikimori_id: int | None = None
    title: str | None = None
    episode: int | None = None
    #: Read and ignored.
    #:
    #: A post used to be able to hide behind one flag; `||a phrase||` in the body
    #: does that properly and this door is a contract somebody else's code already
    #: sends. Refusing the field would break a client over a word that no longer
    #: means anything, so it is accepted and dropped.
    spoiler: bool | None = None
    parent: PostId | None = None

    @classmethod
    def _parse(cls, raw: Any) -> PostBody:
        return cls(
            body=raw["body"],
            shikimori_id=raw.get("shikimori_id"),
            title=raw.get("title"),
            episode=raw.get("episode"),
            spoiler=raw.get("spoiler"),
            parent=raw.get("parent"),
        )


@dataclass(frozen=True, slots=True)
class Profile:
    """A public profile.

    Narrower than the site's own, on purpose, and narrower in one direction: the
    counts an account keeps to itself are **absent** here exactly as they are
    there, because that decision is made in `social::profile_of`'s query and not
    by whoever is formatting the answer. Copying the numbers out is safe; asking
    for them a second way would not be.
    """

    id: str
    nickname: str
    verified: bool
    #: `user` | `mod` | `admin`
    role: str
    joined_at: str
    avatar: str | None = None
    banner: str | None = None
    bio: str | None = None
    about: str | None = None
    #: The other names this account answers to, in the order they arranged them.
    also: list[str] | None = None
    followers: int | None = None
    following: int | None = None
    titles: int | None = None
    episodes: int | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Profile:
        return cls(
            id=raw["id"],
            nickname=raw["nickname"],
            verified=raw["verified"],
            role=raw["role"],
            joined_at=raw["joined_at"],
            avatar=raw.get("avatar"),
            banner=raw.get("banner"),
            bio=raw.get("bio"),
            about=raw.get("about"),
            also=raw.get("also"),
            followers=raw.get("followers"),
            following=raw.get("following"),
            titles=raw.get("titles"),
            episodes=raw.get("episodes"),
        )


@dataclass(frozen=True, slots=True)
class Refusal:
    """Every refusal on this door, in the one shape they all take.

    `message` is a **phrase name and never a sentence**: one room can hold five
    languages at once, so the server does not get to choose which one an error
    is read in. A client shows its own words for the names it knows and the name
    itself for the ones it does not — which is also why the list of them is
    stable enough to generate a typed error per name in six languages.
    """

    #: e.g. `errors.oauthInsufficientScope`
    message: str
    #: Extra fields a refusal owes a reason for, merged in beside `message` — the
    #: scope that was missing, how long a ban has left. Absent for most.
    detail: Any | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Refusal:
        return cls(
            message=raw["message"],
            detail=raw.get("detail"),
        )


@dataclass(frozen=True, slots=True)
class Related:
    """A franchise entry: a card, plus where in the sequence the caller was."""

    id: int
    title: str
    #: `tv` | `movie` | `ova` | `ona` | `special` | `music`
    kind: str
    episodes: int
    #: whether this row *is* the title that was asked about
    current: bool
    title_orig: str | None = None
    poster: str | None = None
    year: int | None = None
    #: The one number a reader sees: what the people here think of it and what the
    #: outside number said, weighed against each other.
    score: float | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Related:
        return cls(
            id=raw["id"],
            title=raw["title"],
            kind=raw["kind"],
            episodes=raw["episodes"],
            current=raw["current"],
            title_orig=raw.get("title_orig"),
            poster=raw.get("poster"),
            year=raw.get("year"),
            score=raw.get("score"),
        )


@dataclass(frozen=True, slots=True)
class ScoreBody:
    score: int
    title: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> ScoreBody:
        return cls(
            score=raw["score"],
            title=raw.get("title"),
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class Stats:
    """What somebody's watching adds up to."""

    planned: int
    watching: int
    rewatching: int
    paused: int
    done: int
    dropped: int
    episodes: int
    minutes: int
    rated: int
    average: float | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Stats:
        return cls(
            planned=raw["planned"],
            watching=raw["watching"],
            rewatching=raw["rewatching"],
            paused=raw["paused"],
            done=raw["done"],
            dropped=raw["dropped"],
            episodes=raw["episodes"],
            minutes=raw["minutes"],
            rated=raw["rated"],
            average=raw.get("average"),
        )


@dataclass(frozen=True, slots=True)
class Title:
    """A title, as its own page.

    `wash` is on the site's shape and is not on this one. It is the colour a
    page tints itself with, computed from the artwork on first read — a fact
    about how this site draws a screen rather than a fact about the title, and
    putting it in a frozen contract would be promising a stranger the house's
    paint.
    """

    id: int
    title: str
    genres: list[str]
    studios: list[str]
    kind: str
    #: `ongoing` | `released` | `announced`
    status: str
    episodes: int
    our_votes: int
    screenshots: list[str]
    title_orig: str | None = None
    poster: str | None = None
    description: str | None = None
    duration: int | None = None
    score: float | None = None
    #: And the two halves of that one number, for a caller with room to say so.
    our_score: float | None = None
    year: int | None = None
    rating: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Title:
        return cls(
            id=raw["id"],
            title=raw["title"],
            genres=raw["genres"],
            studios=raw["studios"],
            kind=raw["kind"],
            status=raw["status"],
            episodes=raw["episodes"],
            our_votes=raw["our_votes"],
            screenshots=raw["screenshots"],
            title_orig=raw.get("title_orig"),
            poster=raw.get("poster"),
            description=raw.get("description"),
            duration=raw.get("duration"),
            score=raw.get("score"),
            our_score=raw.get("our_score"),
            year=raw.get("year"),
            rating=raw.get("rating"),
        )


@dataclass(frozen=True, slots=True)
class TitleCard:
    """A title as it appears in a list.

    `id` is the shikimori id and is the only key this catalogue has ever had. It
    is a number here rather than a string, unlike the ids above: these are five
    and six digits and always will be, since they are somebody else's sequence
    and not ours to outgrow.
    """

    id: int
    title: str
    #: `tv` | `movie` | `ova` | `ona` | `special` | `music`
    kind: str
    episodes: int
    title_orig: str | None = None
    poster: str | None = None
    year: int | None = None
    #: The one number a reader sees: what the people here think of it and what the
    #: outside number said, weighed against each other.
    score: float | None = None

    @classmethod
    def _parse(cls, raw: Any) -> TitleCard:
        return cls(
            id=raw["id"],
            title=raw["title"],
            kind=raw["kind"],
            episodes=raw["episodes"],
            title_orig=raw.get("title_orig"),
            poster=raw.get("poster"),
            year=raw.get("year"),
            score=raw.get("score"),
        )


@dataclass(frozen=True, slots=True)
class Voice:
    """Somebody who said the lines, and the language they said them in.

    **`language` absent means nobody has said, which is not the same as "not
    japanese".** The pass that fills it asks AniList for the japanese cast,
    which can confirm a voice and can never rule one out. A client that reads
    this as a boolean will label a chinese dub actress as the original.
    """

    id: int
    name: str
    #: What this person is. All three can be false — most of a crew is none of them
    #: — and several can be true at once.
    seyu: bool
    mangaka: bool
    producer: bool
    name_orig: str | None = None
    poster: str | None = None
    #: a BCP-47 tag — `ja` for the original, and the only one written so far
    language: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> Voice:
        return cls(
            id=raw["id"],
            name=raw["name"],
            seyu=raw["seyu"],
            mangaka=raw["mangaka"],
            producer=raw["producer"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
            language=raw.get("language"),
        )


@dataclass(frozen=True, slots=True)
class TitleCharacter:
    """One character in one title."""

    id: int
    name: str
    #: `Main` or `Supporting`, as the source words it
    roles: list[str]
    name_orig: str | None = None
    poster: str | None = None
    voices: list[Voice] | None = None

    @classmethod
    def _parse(cls, raw: Any) -> TitleCharacter:
        return cls(
            id=raw["id"],
            name=raw["name"],
            roles=raw["roles"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
            voices=(lambda _v: None if _v is None else [Voice._parse(x) for x in _v])(
                raw.get("voices")
            ),
        )


@dataclass(frozen=True, slots=True)
class TitleStaff:
    """One person on one title, and what they did on it."""

    id: int
    name: str
    #: What this person is. All three can be false — most of a crew is none of them
    #: — and several can be true at once.
    seyu: bool
    mangaka: bool
    producer: bool
    roles: list[str]
    name_orig: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> TitleStaff:
        return cls(
            id=raw["id"],
            name=raw["name"],
            seyu=raw["seyu"],
            mangaka=raw["mangaka"],
            producer=raw["producer"],
            roles=raw["roles"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
        )


@dataclass(frozen=True, slots=True)
class VoicedRole:
    """A character somebody voiced, and where."""

    id: int
    name: str
    title: TitleCard
    roles: list[str]
    name_orig: str | None = None
    poster: str | None = None

    @classmethod
    def _parse(cls, raw: Any) -> VoicedRole:
        return cls(
            id=raw["id"],
            name=raw["name"],
            title=TitleCard._parse(raw["title"]),
            roles=raw["roles"],
            name_orig=raw.get("name_orig"),
            poster=raw.get("poster"),
        )


#: Every scope this api offers.
SCOPES: tuple[str, ...] = (
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
