"""Generated from openapi.json by tools/generate.ts. Do not edit."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import asdict, is_dataclass
from typing import Any
from urllib.parse import quote

from .models import *  # noqa: F403
from .models import Page, _asis


def _body(value: Any) -> Any:
    """A request body, as the wire wants it.

    A dataclass goes out with the field names it was declared with, which are
    the api's own snake_case — so this is a rename of nothing and a caller may
    also pass a plain dict.
    """
    if is_dataclass(value) and not isinstance(value, type):
        return {k: v for k, v in asdict(value).items() if v is not None}
    return value



class Account:
    """the account a token acts for"""

    def __init__(self, core: Any) -> None:
        self._core = core

    def get_me(self) -> Me:
        """It exists beside userinfo rather than instead of it because userinfo's shape
        is fixed by the spec and this one is ours to grow.

        ``GET /api/v1/me``, needs ``profile``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/me",
        )
        return Me._parse(raw)


class Catalogue:
    """titles, people, characters and what is airing"""

    def __init__(self, core: Any) -> None:
        self._core = core

    def calendar(self, *, lang: str | None = None) -> Page[Airing]:
        """A projection rather than a schedule: an ongoing series has no per-episode
        timetable anywhere upstream, so the day of episode *n* is worked out from
        the start date and a seven-day cadence. Irregular shows are wrong by a few
        days and this says nothing about it, because a calendar that hid everything
        it was not certain of would be an empty page most weeks. `out` is the part
        that is not a projection — an episode a dub is already held for is playable
        now, whatever the arithmetic says.

        The site's `?mine=1` is not offered. It narrows to the reader's own shelf,
        which is a second way of asking a question `/v1/lists` already answers, and
        a filter that means nothing at all for an application speaking for itself.
        The `viewer` argument below is therefore `None` — it exists to answer that
        filter and there is nothing else it decides.

        18+ is the caller's own switch, like every other read here: a calendar is a
        shelf with dates on it, and it must not be the one page that names a title
        the reader asked not to see.

        ``GET /api/v1/calendar``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/calendar",
            query={
                "lang": lang,
            },
        )
        return Page._parse(raw, Airing._parse)

    def character_titles(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Appearance]:
        """
        ``GET /api/v1/characters/{id}/titles``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/characters/{quote(str(id))}/titles",
            query={
                "lang": lang,
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, Appearance._parse)

    def character_titles_all(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[Appearance]:
        """Every row of :meth:`character_titles`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.character_titles(limit=window, offset=at, id=id, lang=lang)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def character_voices(self, *, id: int, lang: str | None = None) -> Page[Voice]:
        """
        ``GET /api/v1/characters/{id}/voices``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/characters/{quote(str(id))}/voices",
            query={
                "lang": lang,
            },
        )
        return Page._parse(raw, Voice._parse)

    def get_character(self, *, id: int, lang: str | None = None) -> Character:
        """
        ``GET /api/v1/characters/{id}``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/characters/{quote(str(id))}",
            query={
                "lang": lang,
            },
        )
        return Character._parse(raw)

    def get_person(self, *, id: int, lang: str | None = None) -> PersonPage:
        """
        ``GET /api/v1/people/{id}``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/people/{quote(str(id))}",
            query={
                "lang": lang,
            },
        )
        return PersonPage._parse(raw)

    def get_title(self, *, id: int, lang: str | None = None) -> Title:
        """
        ``GET /api/v1/titles/{id}``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}",
            query={
                "lang": lang,
            },
        )
        return Title._parse(raw)

    def list_genres(self) -> Page[str]:
        """
        ``GET /api/v1/genres``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/genres",
        )
        return Page._parse(raw, _asis)

    def list_titles(
        self,
        *,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        q: str | None = None,
        order: str | None = None,
        status: str | None = None,
        kind: str | None = None,
        genre: str | None = None,
        score: float | None = None,
        year_from: int | None = None,
        year_to: int | None = None,
        rating: str | None = None,
    ) -> Page[TitleCard]:
        """
        ``GET /api/v1/titles``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/titles",
            query={
                "lang": lang,
                "limit": limit,
                "offset": offset,
                "q": q,
                "order": order,
                "status": status,
                "kind": kind,
                "genre": genre,
                "score": score,
                "year_from": year_from,
                "year_to": year_to,
                "rating": rating,
            },
        )
        return Page._parse(raw, TitleCard._parse)

    def list_titles_all(
        self,
        *,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        q: str | None = None,
        order: str | None = None,
        status: str | None = None,
        kind: str | None = None,
        genre: str | None = None,
        score: float | None = None,
        year_from: int | None = None,
        year_to: int | None = None,
        rating: str | None = None,
    ) -> Iterator[TitleCard]:
        """Every row of :meth:`list_titles`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.list_titles(
                limit=window,
                offset=at,
                lang=lang,
                q=q,
                order=order,
                status=status,
                kind=kind,
                genre=genre,
                score=score,
                year_from=year_from,
                year_to=year_to,
                rating=rating,
            )
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def person_characters(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[VoicedRole]:
        """
        ``GET /api/v1/people/{id}/characters``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/people/{quote(str(id))}/characters",
            query={
                "lang": lang,
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, VoicedRole._parse)

    def person_characters_all(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[VoicedRole]:
        """Every row of :meth:`person_characters`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.person_characters(limit=window, offset=at, id=id, lang=lang)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def person_titles(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Appearance]:
        """
        ``GET /api/v1/people/{id}/titles``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/people/{quote(str(id))}/titles",
            query={
                "lang": lang,
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, Appearance._parse)

    def person_titles_all(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[Appearance]:
        """Every row of :meth:`person_titles`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.person_titles(limit=window, offset=at, id=id, lang=lang)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def random_title(self, *, lang: str | None = None) -> TitleCard:
        """
        ``GET /api/v1/titles/random``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/titles/random",
            query={
                "lang": lang,
            },
        )
        return TitleCard._parse(raw)

    def related_titles(self, *, id: int, lang: str | None = None) -> Page[Related]:
        """The title asked about is in the list rather than dropped from it, because
        the one thing this shelf is for is saying where in a sequence somebody is —
        `current` is what lets a client mark it in place.

        ``GET /api/v1/titles/{id}/related``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}/related",
            query={
                "lang": lang,
            },
        )
        return Page._parse(raw, Related._parse)

    def search_characters(
        self,
        *,
        q: str | None = None,
        lang: str | None = None,
        limit: int | None = None,
    ) -> Page[CharacterCard]:
        """A resource of its own rather than a kind inside one `/search`. The site has
        a single search window because a person typing wants one box, and it answers
        an object of six collections — a shape built for that window. An application
        looking for a character wants characters, paged, and asking it to unwrap
        five lists it did not want is the `?include=` this api does not have,
        backwards.

        ``GET /api/v1/characters``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/characters",
            query={
                "q": q,
                "lang": lang,
                "limit": limit,
            },
        )
        return Page._parse(raw, CharacterCard._parse)

    def search_people(
        self,
        *,
        q: str | None = None,
        lang: str | None = None,
        limit: int | None = None,
    ) -> Page[PersonCard]:
        """
        ``GET /api/v1/people``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/people",
            query={
                "q": q,
                "lang": lang,
                "limit": limit,
            },
        )
        return Page._parse(raw, PersonCard._parse)

    def similar_titles(self, *, id: int, lang: str | None = None) -> Page[TitleCard]:
        """The weighting is the whole of what makes this useful rather than "the twelve
        most popular titles in the catalogue", and it is not a thing to have two of
        — so this is `similar_to`, the same shelf `/similar` in Discord is.

        ``GET /api/v1/titles/{id}/similar``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}/similar",
            query={
                "lang": lang,
            },
        )
        return Page._parse(raw, TitleCard._parse)

    def title_characters(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[TitleCharacter]:
        """
        ``GET /api/v1/titles/{id}/characters``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}/characters",
            query={
                "lang": lang,
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, TitleCharacter._parse)

    def title_characters_all(
        self,
        *,
        id: int,
        lang: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[TitleCharacter]:
        """Every row of :meth:`title_characters`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.title_characters(limit=window, offset=at, id=id, lang=lang)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def title_episodes(self, *, id: int) -> Page[Episode]:
        """**Not a list of episodes to watch, and deliberately not one.** Where a dub
        can be played and by whom is `/video/streams`, which is somebody else's
        files under somebody else's terms and is not on this door at all. This is
        what the `shots` pass pulled onto our own storage, and an episode with no
        frames is simply absent.

        ``GET /api/v1/titles/{id}/episodes``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}/episodes",
        )
        return Page._parse(raw, Episode._parse)

    def title_screenshots(self, *, id: int) -> Page[str]:
        """
        ``GET /api/v1/titles/{id}/screenshots``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}/screenshots",
        )
        return Page._parse(raw, _asis)

    def title_staff(self, *, id: int, lang: str | None = None) -> Page[TitleStaff]:
        """
        ``GET /api/v1/titles/{id}/staff``, needs ``catalog:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/titles/{quote(str(id))}/staff",
            query={
                "lang": lang,
            },
        )
        return Page._parse(raw, TitleStaff._parse)


class People:
    """other people, as far as they have agreed to be read"""

    def __init__(self, core: Any) -> None:
        self._core = core

    def get_user(self, *, nick: str) -> Profile:
        """
        ``GET /api/v1/users/{nick}``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/users/{quote(str(nick))}",
        )
        return Profile._parse(raw)

    def search_users(self, *, q: str | None = None, limit: int | None = None) -> Page[Person]:
        """
        ``GET /api/v1/users``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/users",
            query={
                "q": q,
                "limit": limit,
            },
        )
        return Page._parse(raw, Person._parse)

    def user_collections(self, *, nick: str) -> Page[Collection]:
        """
        ``GET /api/v1/users/{nick}/collections``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/users/{quote(str(nick))}/collections",
        )
        return Page._parse(raw, Collection._parse)

    def user_followers(
        self,
        *,
        nick: str,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Person]:
        """
        ``GET /api/v1/users/{nick}/followers``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/users/{quote(str(nick))}/followers",
            query={
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, Person._parse)

    def user_followers_all(
        self,
        *,
        nick: str,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[Person]:
        """Every row of :meth:`user_followers`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.user_followers(limit=window, offset=at, nick=nick)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def user_following(
        self,
        *,
        nick: str,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Person]:
        """
        ``GET /api/v1/users/{nick}/following``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/users/{quote(str(nick))}/following",
            query={
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, Person._parse)

    def user_following_all(
        self,
        *,
        nick: str,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[Person]:
        """Every row of :meth:`user_following`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.user_following(limit=window, offset=at, nick=nick)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def user_lists(
        self,
        *,
        nick: str,
        status: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[ListEntry]:
        """
        ``GET /api/v1/users/{nick}/lists``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/users/{quote(str(nick))}/lists",
            query={
                "status": status,
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, ListEntry._parse)

    def user_lists_all(
        self,
        *,
        nick: str,
        status: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[ListEntry]:
        """Every row of :meth:`user_lists`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.user_lists(limit=window, offset=at, nick=nick, status=status)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def user_stats(self, *, nick: str) -> Stats:
        """
        ``GET /api/v1/users/{nick}/stats``, needs ``people:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/users/{quote(str(nick))}/stats",
        )
        return Stats._parse(raw)


class Library:
    """somebody's own list and shelves"""

    def __init__(self, core: Any) -> None:
        self._core = core

    def add_collection_item(
        self,
        *,
        code: str,
        shikimori_id: int,
        body: EntryBody,
    ) -> CollectionItem:
        """
        ``PUT /api/v1/collections/{code}/items/{shikimori_id}``, needs ``lists:write``
        """
        raw = self._core.call(
            "PUT",
            f"/api/v1/collections/{quote(str(code))}/items/{quote(str(shikimori_id))}",
            body=_body(body),
        )
        return CollectionItem._parse(raw)

    def collection_items(self, *, code: str) -> Page[CollectionItem]:
        """
        ``GET /api/v1/collections/{code}/items``, needs ``lists:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/collections/{quote(str(code))}/items",
        )
        return Page._parse(raw, CollectionItem._parse)

    def create_collection(self, *, body: CollectionBody) -> Collection:
        """
        ``POST /api/v1/collections``, needs ``lists:write``
        """
        raw = self._core.call(
            "POST",
            "/api/v1/collections",
            body=_body(body),
        )
        return Collection._parse(raw)

    def get_collection(self, *, code: str) -> Collection:
        """
        ``GET /api/v1/collections/{code}``, needs ``lists:read``
        """
        raw = self._core.call(
            "GET",
            f"/api/v1/collections/{quote(str(code))}",
        )
        return Collection._parse(raw)

    def list_my_collections(self) -> Page[Collection]:
        """
        ``GET /api/v1/collections``, needs ``lists:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/collections",
        )
        return Page._parse(raw, Collection._parse)

    def list_my_list(
        self,
        *,
        status: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[ListEntry]:
        """It used to answer the whole thing, which is the bug this api's own rules
        already name: a caller with four hundred titles got four hundred rows and a
        caller with four thousand got four thousand, and the only reason nobody was
        hurt by it is that nobody was using this door. `total` is beside the items
        because the paging is by offset, which is exactly when a caller has to know
        how far the list goes.

        ``GET /api/v1/lists``, needs ``lists:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/lists",
            query={
                "status": status,
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, ListEntry._parse)

    def list_my_list_all(
        self,
        *,
        status: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[ListEntry]:
        """Every row of :meth:`list_my_list`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.list_my_list(limit=window, offset=at, status=status)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def rate_list_entry(self, *, shikimori_id: int, body: ScoreBody) -> ListEntry:
        """The same `plans::domain::rate` the site calls, so the two doors cannot come
        to disagree about what a score is — which is the whole reason the domain
        exists. What differs is what this surface always differs by: 404 where the
        site answers 204 for a delete that removed nothing.

        ``PUT /api/v1/lists/{shikimori_id}/score``, needs ``lists:write``
        """
        raw = self._core.call(
            "PUT",
            f"/api/v1/lists/{quote(str(shikimori_id))}/score",
            body=_body(body),
        )
        return ListEntry._parse(raw)

    def remove_collection_item(self, *, code: str, shikimori_id: int) -> None:
        """
        ``DELETE /api/v1/collections/{code}/items/{shikimori_id}``, needs ``lists:write``
        """
        self._core.call(
            "DELETE",
            f"/api/v1/collections/{quote(str(code))}/items/{quote(str(shikimori_id))}",
        )
        return None

    def remove_list_entry(self, *, shikimori_id: int) -> None:
        """
        ``DELETE /api/v1/lists/{shikimori_id}``, needs ``lists:write``
        """
        self._core.call(
            "DELETE",
            f"/api/v1/lists/{quote(str(shikimori_id))}",
        )
        return None

    def save_list_entry(self, *, shikimori_id: int, body: ListBody) -> ListEntry:
        """
        ``PUT /api/v1/lists/{shikimori_id}``, needs ``lists:write``
        """
        raw = self._core.call(
            "PUT",
            f"/api/v1/lists/{quote(str(shikimori_id))}",
            body=_body(body),
        )
        return ListEntry._parse(raw)

    def unrate_list_entry(self, *, shikimori_id: int) -> None:
        """
        ``DELETE /api/v1/lists/{shikimori_id}/score``, needs ``lists:write``
        """
        self._core.call(
            "DELETE",
            f"/api/v1/lists/{quote(str(shikimori_id))}/score",
        )
        return None


class Social:
    """their writing, and who they read"""

    def __init__(self, core: Any) -> None:
        self._core = core

    def follow_user(self, *, nickname: str) -> None:
        """
        ``PUT /api/v1/following/{nickname}``, needs ``social:write``
        """
        self._core.call(
            "PUT",
            f"/api/v1/following/{quote(str(nickname))}",
        )
        return None

    def list_my_following(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Person]:
        """
        ``GET /api/v1/following``, needs ``social:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/following",
            query={
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, Person._parse)

    def list_my_following_all(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[Person]:
        """Every row of :meth:`list_my_following`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.list_my_following(limit=window, offset=at)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def list_my_posts(self, *, limit: int | None = None, offset: int | None = None) -> Page[Post]:
        """Not the feed: `social:read` is permission to read *this person's* social
        life, not everybody's. A timeline of other people's writing is a different
        question with a different answer about who may see what, and it is not
        behind this word.

        ``GET /api/v1/posts``, needs ``social:read``
        """
        raw = self._core.call(
            "GET",
            "/api/v1/posts",
            query={
                "limit": limit,
                "offset": offset,
            },
        )
        return Page._parse(raw, Post._parse)

    def list_my_posts_all(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Iterator[Post]:
        """Every row of :meth:`list_my_posts`, a page at a time.

        Stops when a page comes back shorter than it asked for rather than
        when ``total`` is reached: the list can grow while it is being read,
        and counting against a number from the first page walks off the end.
        """
        window = limit or 100
        at = offset or 0
        while True:
            page = self.list_my_posts(limit=window, offset=at)
            yield from page.items
            if len(page.items) < window:
                return
            at += len(page.items)

    def unfollow_user(self, *, nickname: str) -> None:
        """
        ``DELETE /api/v1/following/{nickname}``, needs ``social:write``
        """
        self._core.call(
            "DELETE",
            f"/api/v1/following/{quote(str(nickname))}",
        )
        return None

    def write_post(self, *, body: PostBody) -> Post:
        """
        ``POST /api/v1/posts``, needs ``social:write``
        """
        raw = self._core.call(
            "POST",
            "/api/v1/posts",
            body=_body(body),
        )
        return Post._parse(raw)
