// Generated from openapi.json by tools/generate.ts. Do not edit.
#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "acyka/core.hpp"
#include "acyka/models.hpp"

namespace acyka {

/// One `{key}` in a path, replaced with what the caller gave.
inline void replace_in(std::string& text, std::string_view what, const std::string& with) {
    const auto at = text.find(what);
    if (at != std::string::npos) text.replace(at, what.size(), with);
}

/// What `calendar` is asked with.
struct CalendarRequest {
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `characterTitles` is asked with.
struct CharacterTitlesRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `characterVoices` is asked with.
struct CharacterVoicesRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `getCharacter` is asked with.
struct GetCharacterRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `getPerson` is asked with.
struct GetPersonRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `getTitle` is asked with.
struct GetTitleRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `listTitles` is asked with.
struct ListTitlesRequest {
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
    /// what to search for
    std::optional<std::string> q;
    /// `ranked` by score, `aired_on` by year; by how watched it is otherwise
    std::optional<std::string> order;
    /// `ongoing` | `released` | `announced`
    std::optional<std::string> status;
    /// `tv` | `movie` | `ova` | `ona` | `special` | `music`
    std::optional<std::string> kind;
    /// comma-separated; every named genre must be on the title
    std::optional<std::string> genre;
    /// at least this
    std::optional<double> score;
    std::optional<std::int32_t> year_from;
    std::optional<std::int32_t> year_to;
    /// the age rating
    std::optional<std::string> rating;
};

/// What `personCharacters` is asked with.
struct PersonCharactersRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `personTitles` is asked with.
struct PersonTitlesRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `randomTitle` is asked with.
struct RandomTitleRequest {
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `relatedTitles` is asked with.
struct RelatedTitlesRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `searchCharacters` is asked with.
struct SearchCharactersRequest {
    /// what to search for
    std::optional<std::string> q;
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
};

/// What `searchPeople` is asked with.
struct SearchPeopleRequest {
    /// what to search for
    std::optional<std::string> q;
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
};

/// What `similarTitles` is asked with.
struct SimilarTitlesRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `titleCharacters` is asked with.
struct TitleCharactersRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `titleEpisodes` is asked with.
struct TitleEpisodesRequest {
    /// the shikimori id
    std::int64_t id{};
};

/// What `titleScreenshots` is asked with.
struct TitleScreenshotsRequest {
    /// the shikimori id
    std::int64_t id{};
};

/// What `titleStaff` is asked with.
struct TitleStaffRequest {
    /// the shikimori id
    std::int64_t id{};
    /// which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`.
    /// Defaults to `en`.
    std::optional<std::string> lang;
};

/// What `addCollectionItem` is asked with.
struct AddCollectionItemRequest {
    /// the shelf's code
    std::string code{};
    /// the shikimori id
    std::int32_t shikimori_id{};
    /// the request body
    EntryBody body{};
};

/// What `collectionItems` is asked with.
struct CollectionItemsRequest {
    /// the shelf's code
    std::string code{};
};

/// What `createCollection` is asked with.
struct CreateCollectionRequest {
    /// the request body
    CollectionBody body{};
};

/// What `getCollection` is asked with.
struct GetCollectionRequest {
    /// the shelf's code
    std::string code{};
};

/// What `listMyList` is asked with.
struct ListMyListRequest {
    /// narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` |
    /// `done` | `dropped`
    std::optional<std::string> status;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `rateListEntry` is asked with.
struct RateListEntryRequest {
    /// the shikimori id
    std::int32_t shikimori_id{};
    /// the request body
    ScoreBody body{};
};

/// What `removeCollectionItem` is asked with.
struct RemoveCollectionItemRequest {
    /// the shelf's code
    std::string code{};
    /// the shikimori id
    std::int32_t shikimori_id{};
};

/// What `removeListEntry` is asked with.
struct RemoveListEntryRequest {
    /// the shikimori id
    std::int32_t shikimori_id{};
};

/// What `saveListEntry` is asked with.
struct SaveListEntryRequest {
    /// the shikimori id
    std::int32_t shikimori_id{};
    /// the request body
    ListBody body{};
};

/// What `unrateListEntry` is asked with.
struct UnrateListEntryRequest {
    /// the shikimori id
    std::int32_t shikimori_id{};
};

/// What `getUser` is asked with.
struct GetUserRequest {
    /// a nickname the account answers to, current or past
    std::string nick{};
};

/// What `searchUsers` is asked with.
struct SearchUsersRequest {
    /// what to search for
    std::optional<std::string> q;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
};

/// What `userCollections` is asked with.
struct UserCollectionsRequest {
    /// a nickname the account answers to, current or past
    std::string nick{};
};

/// What `userFollowers` is asked with.
struct UserFollowersRequest {
    /// a nickname the account answers to, current or past
    std::string nick{};
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `userFollowing` is asked with.
struct UserFollowingRequest {
    /// a nickname the account answers to, current or past
    std::string nick{};
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `userLists` is asked with.
struct UserListsRequest {
    /// a nickname the account answers to, current or past
    std::string nick{};
    /// narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` |
    /// `done` | `dropped`
    std::optional<std::string> status;
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `userStats` is asked with.
struct UserStatsRequest {
    /// a nickname the account answers to, current or past
    std::string nick{};
};

/// What `followUser` is asked with.
struct FollowUserRequest {
    /// who to follow
    std::string nickname{};
};

/// What `listMyFollowing` is asked with.
struct ListMyFollowingRequest {
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `listMyPosts` is asked with.
struct ListMyPostsRequest {
    /// how many rows, 1-100; 30 by default
    std::optional<std::int64_t> limit;
    /// where to carry on from
    std::optional<std::int64_t> offset;
};

/// What `unfollowUser` is asked with.
struct UnfollowUserRequest {
    /// who to stop following
    std::string nickname{};
};

/// What `writePost` is asked with.
struct WritePostRequest {
    /// the request body
    PostBody body{};
};

/// the account a token acts for
class account_api {
 public:
    explicit account_api(std::shared_ptr<core> core) : core_(std::move(core)) {}

    /// It exists beside userinfo rather than instead of it because userinfo's shape
    /// is fixed by the spec and this one is ours to grow.
    ///
    /// `GET /api/v1/me`, needs `profile`
    Me get_me() const {
        const std::string path = "/api/v1/me";
        return core_->call("GET", path, std::string{}, std::string{}, false).get<Me>();
    }

 private:
    std::shared_ptr<core> core_;
};

/// titles, people, characters and what is airing
class catalogue_api {
 public:
    explicit catalogue_api(std::shared_ptr<core> core) : core_(std::move(core)) {}

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
    ///
    /// `GET /api/v1/calendar`, needs `catalog:read`
    page<Airing> calendar(const CalendarRequest& in) const {
        const std::string path = "/api/v1/calendar";
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Airing>>();
    }

    ///
    /// `GET /api/v1/characters/{id}/titles`, needs `catalog:read`
    page<Appearance> character_titles(const CharacterTitlesRequest& in) const {
        std::string path = "/api/v1/characters/{id}/titles";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Appearance>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<Appearance> character_titles_all(CharacterTitlesRequest in, const std::function<bool(const page<Appearance>&)>& on_page = {}) const {
        std::vector<Appearance> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = character_titles(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// Whoever has voiced this character, once each, japanese first.
    ///
    /// `GET /api/v1/characters/{id}/voices`, needs `catalog:read`
    page<Voice> character_voices(const CharacterVoicesRequest& in) const {
        std::string path = "/api/v1/characters/{id}/voices";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Voice>>();
    }

    ///
    /// `GET /api/v1/characters/{id}`, needs `catalog:read`
    Character get_character(const GetCharacterRequest& in) const {
        std::string path = "/api/v1/characters/{id}";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<Character>();
    }

    ///
    /// `GET /api/v1/people/{id}`, needs `catalog:read`
    PersonPage get_person(const GetPersonRequest& in) const {
        std::string path = "/api/v1/people/{id}";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<PersonPage>();
    }

    ///
    /// `GET /api/v1/titles/{id}`, needs `catalog:read`
    Title get_title(const GetTitleRequest& in) const {
        std::string path = "/api/v1/titles/{id}";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<Title>();
    }

    /// The vocabulary the whole catalogue is described in.
    ///
    /// `GET /api/v1/genres`, needs `catalog:read`
    page<std::string> list_genres() const {
        const std::string path = "/api/v1/genres";
        return core_->call("GET", path, std::string{}, std::string{}, false).get<page<std::string>>();
    }

    ///
    /// `GET /api/v1/titles`, needs `catalog:read`
    page<TitleCard> list_titles(const ListTitlesRequest& in) const {
        const std::string path = "/api/v1/titles";
        query_string query;
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        query.add("q", in.q);
        query.add("order", in.order);
        query.add("status", in.status);
        query.add("kind", in.kind);
        query.add("genre", in.genre);
        query.add("score", in.score);
        query.add("year_from", in.year_from);
        query.add("year_to", in.year_to);
        query.add("rating", in.rating);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<TitleCard>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<TitleCard> list_titles_all(ListTitlesRequest in, const std::function<bool(const page<TitleCard>&)>& on_page = {}) const {
        std::vector<TitleCard> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = list_titles(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// The other half of a voice actor: who they have played.
    ///
    /// `GET /api/v1/people/{id}/characters`, needs `catalog:read`
    page<VoicedRole> person_characters(const PersonCharactersRequest& in) const {
        std::string path = "/api/v1/people/{id}/characters";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<VoicedRole>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<VoicedRole> person_characters_all(PersonCharactersRequest in, const std::function<bool(const page<VoicedRole>&)>& on_page = {}) const {
        std::vector<VoicedRole> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = person_characters(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    ///
    /// `GET /api/v1/people/{id}/titles`, needs `catalog:read`
    page<Appearance> person_titles(const PersonTitlesRequest& in) const {
        std::string path = "/api/v1/people/{id}/titles";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Appearance>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<Appearance> person_titles_all(PersonTitlesRequest in, const std::function<bool(const page<Appearance>&)>& on_page = {}) const {
        std::vector<Appearance> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = person_titles(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// One title, at random, out of the ones that can actually be watched here.
    ///
    /// `GET /api/v1/titles/random`, needs `catalog:read`
    TitleCard random_title(const RandomTitleRequest& in) const {
        const std::string path = "/api/v1/titles/random";
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<TitleCard>();
    }

    /// The title asked about is in the list rather than dropped from it, because
    /// the one thing this shelf is for is saying where in a sequence somebody is —
    /// `current` is what lets a client mark it in place.
    ///
    /// `GET /api/v1/titles/{id}/related`, needs `catalog:read`
    page<Related> related_titles(const RelatedTitlesRequest& in) const {
        std::string path = "/api/v1/titles/{id}/related";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Related>>();
    }

    /// A resource of its own rather than a kind inside one `/search`. The site has
    /// a single search window because a person typing wants one box, and it answers
    /// an object of six collections — a shape built for that window. An application
    /// looking for a character wants characters, paged, and asking it to unwrap
    /// five lists it did not want is the `?include=` this api does not have,
    /// backwards.
    ///
    /// `GET /api/v1/characters`, needs `catalog:read`
    page<CharacterCard> search_characters(const SearchCharactersRequest& in) const {
        const std::string path = "/api/v1/characters";
        query_string query;
        query.add("q", in.q);
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<CharacterCard>>();
    }

    ///
    /// `GET /api/v1/people`, needs `catalog:read`
    page<PersonCard> search_people(const SearchPeopleRequest& in) const {
        const std::string path = "/api/v1/people";
        query_string query;
        query.add("q", in.q);
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<PersonCard>>();
    }

    /// The weighting is the whole of what makes this useful rather than "the twelve
    /// most popular titles in the catalogue", and it is not a thing to have two of
    /// — so this is `similar_to`, the same shelf `/similar` in Discord is.
    ///
    /// `GET /api/v1/titles/{id}/similar`, needs `catalog:read`
    page<TitleCard> similar_titles(const SimilarTitlesRequest& in) const {
        std::string path = "/api/v1/titles/{id}/similar";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<TitleCard>>();
    }

    ///
    /// `GET /api/v1/titles/{id}/characters`, needs `catalog:read`
    page<TitleCharacter> title_characters(const TitleCharactersRequest& in) const {
        std::string path = "/api/v1/titles/{id}/characters";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<TitleCharacter>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<TitleCharacter> title_characters_all(TitleCharactersRequest in, const std::function<bool(const page<TitleCharacter>&)>& on_page = {}) const {
        std::vector<TitleCharacter> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = title_characters(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// **Not a list of episodes to watch, and deliberately not one.** Where a dub
    /// can be played and by whom is `/video/streams`, which is somebody else's
    /// files under somebody else's terms and is not on this door at all. This is
    /// what the `shots` pass pulled onto our own storage, and an episode with no
    /// frames is simply absent.
    ///
    /// `GET /api/v1/titles/{id}/episodes`, needs `catalog:read`
    page<Episode> title_episodes(const TitleEpisodesRequest& in) const {
        std::string path = "/api/v1/titles/{id}/episodes";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<page<Episode>>();
    }

    ///
    /// `GET /api/v1/titles/{id}/screenshots`, needs `catalog:read`
    page<std::string> title_screenshots(const TitleScreenshotsRequest& in) const {
        std::string path = "/api/v1/titles/{id}/screenshots";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<page<std::string>>();
    }

    ///
    /// `GET /api/v1/titles/{id}/staff`, needs `catalog:read`
    page<TitleStaff> title_staff(const TitleStaffRequest& in) const {
        std::string path = "/api/v1/titles/{id}/staff";
        replace_in(path, "{id}", detail::urlencode(std::to_string(in.id)));
        query_string query;
        query.add("lang", in.lang);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<TitleStaff>>();
    }

 private:
    std::shared_ptr<core> core_;
};

/// other people, as far as they have agreed to be read
class people_api {
 public:
    explicit people_api(std::shared_ptr<core> core) : core_(std::move(core)) {}

    ///
    /// `GET /api/v1/users/{nick}`, needs `people:read`
    Profile get_user(const GetUserRequest& in) const {
        std::string path = "/api/v1/users/{nick}";
        replace_in(path, "{nick}", detail::urlencode(in.nick));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<Profile>();
    }

    /// People by name.
    ///
    /// `GET /api/v1/users`, needs `people:read`
    page<Person> search_users(const SearchUsersRequest& in) const {
        const std::string path = "/api/v1/users";
        query_string query;
        query.add("q", in.q);
        query.add("limit", in.limit);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Person>>();
    }

    ///
    /// `GET /api/v1/users/{nick}/collections`, needs `people:read`
    page<Collection> user_collections(const UserCollectionsRequest& in) const {
        std::string path = "/api/v1/users/{nick}/collections";
        replace_in(path, "{nick}", detail::urlencode(in.nick));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<page<Collection>>();
    }

    ///
    /// `GET /api/v1/users/{nick}/followers`, needs `people:read`
    page<Person> user_followers(const UserFollowersRequest& in) const {
        std::string path = "/api/v1/users/{nick}/followers";
        replace_in(path, "{nick}", detail::urlencode(in.nick));
        query_string query;
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Person>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<Person> user_followers_all(UserFollowersRequest in, const std::function<bool(const page<Person>&)>& on_page = {}) const {
        std::vector<Person> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = user_followers(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    ///
    /// `GET /api/v1/users/{nick}/following`, needs `people:read`
    page<Person> user_following(const UserFollowingRequest& in) const {
        std::string path = "/api/v1/users/{nick}/following";
        replace_in(path, "{nick}", detail::urlencode(in.nick));
        query_string query;
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Person>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<Person> user_following_all(UserFollowingRequest in, const std::function<bool(const page<Person>&)>& on_page = {}) const {
        std::vector<Person> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = user_following(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// What somebody is watching, if their list is anybody's business.
    ///
    /// `GET /api/v1/users/{nick}/lists`, needs `people:read`
    page<ListEntry> user_lists(const UserListsRequest& in) const {
        std::string path = "/api/v1/users/{nick}/lists";
        replace_in(path, "{nick}", detail::urlencode(in.nick));
        query_string query;
        query.add("status", in.status);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<ListEntry>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<ListEntry> user_lists_all(UserListsRequest in, const std::function<bool(const page<ListEntry>&)>& on_page = {}) const {
        std::vector<ListEntry> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = user_lists(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    ///
    /// `GET /api/v1/users/{nick}/stats`, needs `people:read`
    Stats user_stats(const UserStatsRequest& in) const {
        std::string path = "/api/v1/users/{nick}/stats";
        replace_in(path, "{nick}", detail::urlencode(in.nick));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<Stats>();
    }

 private:
    std::shared_ptr<core> core_;
};

/// somebody's own list and shelves
class library_api {
 public:
    explicit library_api(std::shared_ptr<core> core) : core_(std::move(core)) {}

    ///
    /// `PUT /api/v1/collections/{code}/items/{shikimori_id}`, needs `lists:write`
    CollectionItem add_collection_item(const AddCollectionItemRequest& in) const {
        std::string path = "/api/v1/collections/{code}/items/{shikimori_id}";
        replace_in(path, "{code}", detail::urlencode(in.code));
        replace_in(path, "{shikimori_id}", detail::urlencode(std::to_string(in.shikimori_id)));
        return core_->call("PUT", path, std::string{}, nlohmann::json(in.body).dump(), true).get<CollectionItem>();
    }

    ///
    /// `GET /api/v1/collections/{code}/items`, needs `lists:read`
    page<CollectionItem> collection_items(const CollectionItemsRequest& in) const {
        std::string path = "/api/v1/collections/{code}/items";
        replace_in(path, "{code}", detail::urlencode(in.code));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<page<CollectionItem>>();
    }

    ///
    /// `POST /api/v1/collections`, needs `lists:write`
    Collection create_collection(const CreateCollectionRequest& in) const {
        const std::string path = "/api/v1/collections";
        return core_->call("POST", path, std::string{}, nlohmann::json(in.body).dump(), true).get<Collection>();
    }

    ///
    /// `GET /api/v1/collections/{code}`, needs `lists:read`
    Collection get_collection(const GetCollectionRequest& in) const {
        std::string path = "/api/v1/collections/{code}";
        replace_in(path, "{code}", detail::urlencode(in.code));
        return core_->call("GET", path, std::string{}, std::string{}, false).get<Collection>();
    }

    ///
    /// `GET /api/v1/collections`, needs `lists:read`
    page<Collection> list_my_collections() const {
        const std::string path = "/api/v1/collections";
        return core_->call("GET", path, std::string{}, std::string{}, false).get<page<Collection>>();
    }

    /// It used to answer the whole thing, which is the bug this api's own rules
    /// already name: a caller with four hundred titles got four hundred rows and a
    /// caller with four thousand got four thousand, and the only reason nobody was
    /// hurt by it is that nobody was using this door. `total` is beside the items
    /// because the paging is by offset, which is exactly when a caller has to know
    /// how far the list goes.
    ///
    /// `GET /api/v1/lists`, needs `lists:read`
    page<ListEntry> list_my_list(const ListMyListRequest& in) const {
        const std::string path = "/api/v1/lists";
        query_string query;
        query.add("status", in.status);
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<ListEntry>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<ListEntry> list_my_list_all(ListMyListRequest in, const std::function<bool(const page<ListEntry>&)>& on_page = {}) const {
        std::vector<ListEntry> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = list_my_list(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// The same `plans::domain::rate` the site calls, so the two doors cannot come
    /// to disagree about what a score is — which is the whole reason the domain
    /// exists. What differs is what this surface always differs by: 404 where the
    /// site answers 204 for a delete that removed nothing.
    ///
    /// `PUT /api/v1/lists/{shikimori_id}/score`, needs `lists:write`
    ListEntry rate_list_entry(const RateListEntryRequest& in) const {
        std::string path = "/api/v1/lists/{shikimori_id}/score";
        replace_in(path, "{shikimori_id}", detail::urlencode(std::to_string(in.shikimori_id)));
        return core_->call("PUT", path, std::string{}, nlohmann::json(in.body).dump(), true).get<ListEntry>();
    }

    ///
    /// `DELETE /api/v1/collections/{code}/items/{shikimori_id}`, needs `lists:write`
    void remove_collection_item(const RemoveCollectionItemRequest& in) const {
        std::string path = "/api/v1/collections/{code}/items/{shikimori_id}";
        replace_in(path, "{code}", detail::urlencode(in.code));
        replace_in(path, "{shikimori_id}", detail::urlencode(std::to_string(in.shikimori_id)));
        core_->call("DELETE", path, std::string{}, std::string{}, false);
    }

    ///
    /// `DELETE /api/v1/lists/{shikimori_id}`, needs `lists:write`
    void remove_list_entry(const RemoveListEntryRequest& in) const {
        std::string path = "/api/v1/lists/{shikimori_id}";
        replace_in(path, "{shikimori_id}", detail::urlencode(std::to_string(in.shikimori_id)));
        core_->call("DELETE", path, std::string{}, std::string{}, false);
    }

    ///
    /// `PUT /api/v1/lists/{shikimori_id}`, needs `lists:write`
    ListEntry save_list_entry(const SaveListEntryRequest& in) const {
        std::string path = "/api/v1/lists/{shikimori_id}";
        replace_in(path, "{shikimori_id}", detail::urlencode(std::to_string(in.shikimori_id)));
        return core_->call("PUT", path, std::string{}, nlohmann::json(in.body).dump(), true).get<ListEntry>();
    }

    ///
    /// `DELETE /api/v1/lists/{shikimori_id}/score`, needs `lists:write`
    void unrate_list_entry(const UnrateListEntryRequest& in) const {
        std::string path = "/api/v1/lists/{shikimori_id}/score";
        replace_in(path, "{shikimori_id}", detail::urlencode(std::to_string(in.shikimori_id)));
        core_->call("DELETE", path, std::string{}, std::string{}, false);
    }

 private:
    std::shared_ptr<core> core_;
};

/// their writing, and who they read
class social_api {
 public:
    explicit social_api(std::shared_ptr<core> core) : core_(std::move(core)) {}

    ///
    /// `PUT /api/v1/following/{nickname}`, needs `social:write`
    void follow_user(const FollowUserRequest& in) const {
        std::string path = "/api/v1/following/{nickname}";
        replace_in(path, "{nickname}", detail::urlencode(in.nickname));
        core_->call("PUT", path, std::string{}, std::string{}, false);
    }

    ///
    /// `GET /api/v1/following`, needs `social:read`
    page<Person> list_my_following(const ListMyFollowingRequest& in) const {
        const std::string path = "/api/v1/following";
        query_string query;
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Person>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<Person> list_my_following_all(ListMyFollowingRequest in, const std::function<bool(const page<Person>&)>& on_page = {}) const {
        std::vector<Person> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = list_my_following(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    /// Not the feed: `social:read` is permission to read *this person's* social
    /// life, not everybody's. A timeline of other people's writing is a different
    /// question with a different answer about who may see what, and it is not
    /// behind this word.
    ///
    /// `GET /api/v1/posts`, needs `social:read`
    page<Post> list_my_posts(const ListMyPostsRequest& in) const {
        const std::string path = "/api/v1/posts";
        query_string query;
        query.add("limit", in.limit);
        query.add("offset", in.offset);
        return core_->call("GET", path, query.str(), std::string{}, false).get<page<Post>>();
    }

    /// Every row, gathered a page at a time.
    ///
    /// Stops when a page comes back shorter than it asked for rather than
    /// when `total` is reached: the list can grow while it is being read, and
    /// counting against a number from the first page walks off the end.
    ///
    /// A vector rather than a lazy range, and that is a choice: a coroutine
    /// generator would need C++23 or a dependency, and a callback would put
    /// the caller inside somebody else's loop. The `on_page` hook is there
    /// for whoever cannot hold the whole list.
    std::vector<Post> list_my_posts_all(ListMyPostsRequest in, const std::function<bool(const page<Post>&)>& on_page = {}) const {
        std::vector<Post> all;
        const std::int64_t window = in.limit.value_or(100);
        std::int64_t at = in.offset.value_or(0);
        for (;;) {
            in.limit = window;
            in.offset = at;
            auto got = list_my_posts(in);
            const auto seen = static_cast<std::int64_t>(got.items.size());
            if (on_page && !on_page(got)) return all;
            all.insert(all.end(), got.items.begin(), got.items.end());
            if (seen < window) return all;
            at += seen;
        }
    }

    ///
    /// `DELETE /api/v1/following/{nickname}`, needs `social:write`
    void unfollow_user(const UnfollowUserRequest& in) const {
        std::string path = "/api/v1/following/{nickname}";
        replace_in(path, "{nickname}", detail::urlencode(in.nickname));
        core_->call("DELETE", path, std::string{}, std::string{}, false);
    }

    ///
    /// `POST /api/v1/posts`, needs `social:write`
    Post write_post(const WritePostRequest& in) const {
        const std::string path = "/api/v1/posts";
        return core_->call("POST", path, std::string{}, nlohmann::json(in.body).dump(), true).get<Post>();
    }

 private:
    std::shared_ptr<core> core_;
};

}  // namespace acyka
