// Generated from openapi.json by tools/generate.ts. Do not edit.
#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace acyka {

/// The envelope every collection answers in.
///
/// `total` is there when the caller pages by offset and therefore has to know
/// how far the list goes; a cursor-paged list leaves it out rather than paying
/// for a second count nobody reads.
template <typename T>
struct page {
    std::vector<T> items;
    std::optional<std::int64_t> total;

    auto begin() const { return items.begin(); }
    auto end() const { return items.end(); }
    std::size_t size() const { return items.size(); }
    bool empty() const { return items.empty(); }
};

template <typename T>
void from_json(const nlohmann::json& raw, page<T>& out) {
    out.items = raw.value("items", std::vector<T>{});
    if (raw.contains("total") && !raw.at("total").is_null()) {
        out.total = raw.at("total").get<std::int64_t>();
    }
}

/// A post's id, on the wire as a string and in the database as a bigint.
///
/// Its own type rather than a `String` field, so the conversion happens in one
/// place and a query that forgets it does not compile. JSON has one number type
/// and it is a double; ids near 2^53 are exactly where that stops being an
/// academic point, and a client that silently rounds one reads and edits the
/// wrong row.
using PostId = std::string;

// Forward declarations, so the order the document lists these in does not
// decide whether a shape may mention another.
struct Airing;
struct Appearance;
struct Character;
struct CharacterCard;
struct Collection;
struct CollectionBody;
struct CollectionItem;
struct EntryBody;
struct Episode;
struct ListBody;
struct ListEntry;
struct Me;
struct Person;
struct PersonCard;
struct PersonPage;
struct Post;
struct PostBody;
struct Profile;
struct Refusal;
struct Related;
struct ScoreBody;
struct Stats;
struct Title;
struct TitleCard;
struct TitleCharacter;
struct TitleStaff;
struct Voice;
struct VoicedRole;

/// One episode, on one day.
struct Airing {
    std::int64_t id{};
    std::string title{};
    std::optional<std::string> title_orig;
    std::optional<std::string> poster;
    /// which episode this is, projected: an ongoing series airs weekly, so episode
    /// *n* lands seven times *n − 1* days after the first
    std::int32_t episode{};
    /// `YYYY-MM-DD`, UTC. A date and not a timestamp: nothing here knows the hour
    /// an episode lands, and inventing one would be a lie with a clock on it.
    std::string on{};
    /// whether a dub for it is already playable here, or it is still projected
    bool out{};
};

/// A title a character appears in, and what they are in it.
struct Appearance {
    std::int64_t id{};
    std::string title{};
    std::optional<std::string> title_orig;
    std::optional<std::string> poster;
    std::optional<std::int32_t> year;
    /// `tv` | `movie` | `ova` | `ona` | `special` | `music`
    std::string kind{};
    std::int32_t episodes{};
    /// The one number a reader sees: what the people here think of it and what the
    /// outside number said, weighed against each other.
    std::optional<double> score;
    std::vector<std::string> roles{};
};

/// A character, as its own page.
struct Character {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    /// how many titles carry them
    std::int64_t titles{};
};

struct CharacterCard {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
};

/// A shelf somebody named.
struct Collection {
    std::string code{};
    std::string name{};
    std::string about{};
    std::string icon{};
    std::optional<std::int32_t> hue;
    /// `public` | `unlisted` | `private`
    std::string visibility{};
    /// whether anyone who can read it may also add to it
    bool shared{};
    std::int64_t count{};
    std::int64_t saves{};
    std::string owner{};
    std::optional<std::string> owner_avatar;
    bool owner_verified{};
    std::vector<std::string> covers{};
    std::string at{};
    std::string edited{};
};

struct CollectionBody {
    std::string name{};
    std::optional<std::string> about;
    std::optional<std::string> icon;
    std::optional<std::int32_t> hue;
    std::optional<std::string> visibility;
    std::optional<bool> shared;
};

struct CollectionItem {
    std::int32_t shikimori_id{};
    std::string title{};
    std::optional<std::string> poster;
    std::optional<std::string> added_by;
    std::string at{};
};

struct EntryBody {
    std::string title{};
    std::optional<std::string> poster;
};

/// The preview frames one episode has.
struct Episode {
    std::int32_t episode{};
    std::vector<std::string> shots{};
};

struct ListBody {
    std::string title{};
    std::optional<std::string> poster;
    std::optional<std::string> status;
    std::optional<std::int32_t> episode;
};

/// One row of somebody's list.
///
/// One shape for a caller's own list and for somebody else's, because it is one
/// thing. Two shapes differing by a field would be two unwrappers in every SDK
/// for a row that means exactly the same in both places.
struct ListEntry {
    std::int32_t shikimori_id{};
    std::string title{};
    std::optional<std::string> poster;
    /// `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped`
    std::string status{};
    /// how many they have watched
    std::int32_t episode{};
    /// How many the catalogue holds, so a counter knows where the series stops.
    /// Absent where the catalogue does not carry it or does not know — an
    /// announcement, and a good half of what is airing — and absent means "no
    /// ceiling" rather than "none".
    std::optional<std::int32_t> episodes;
    /// what they thought of it; null for a title they have not judged
    std::optional<std::int32_t> score;
    /// RFC 3339, and a string rather than a timestamp type for a reason that is
    /// about having one shape: this row comes from two places, and the site's own
    /// reader already formats it. A parse on this side to fit a stricter type would
    /// need something to do when it failed, and every honest answer to that is a
    /// lie about when somebody watched something.
    std::string at{};
};

/// An account, as its own token sees it.
///
/// Field for field what `/oauth2/userinfo` would say, in this door's casing,
/// plus the things a claim set has no room for. It exists beside userinfo
/// rather than instead of it because userinfo's shape is fixed by a spec and
/// this one is ours to grow.
struct Me {
    /// A string, and never a number.
    ///
    /// It is an `id_token`'s `sub` on the other door and a JSON number loses
    /// precision in a language that has only doubles — which is most of them,
    /// including the one most of these clients are written in.
    std::string id{};
    std::optional<std::string> nickname;
    std::optional<std::string> avatar;
    std::optional<std::string> banner;
    std::optional<std::string> bio;
    std::optional<bool> verified;
    std::optional<std::string> created_at;
    std::optional<std::string> email;
    std::optional<bool> email_verified;
};

/// Somebody, as small as a person gets on this door.
///
/// The site draws a person with `Name` or `Identity` and hands those components
/// a whole `Wearer` — the colour, the badges, the pattern, the presence. None
/// of that is here, and leaving it out is the decision rather than an omission:
/// a badge is a thing this site invented and may re-invent, and a client that
/// has built a row around `worn.hue` is a client we would have to keep it for.
struct Person {
    std::string nickname{};
    std::optional<std::string> avatar;
    bool verified{};
};

struct PersonCard {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    /// What this person is. All three can be false — most of a crew is none of them
    /// — and several can be true at once.
    bool seyu{};
    bool mangaka{};
    bool producer{};
};

/// A person, as their own page.
struct PersonPage {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    /// What this person is. All three can be false — most of a crew is none of them
    /// — and several can be true at once.
    bool seyu{};
    bool mangaka{};
    bool producer{};
    std::optional<std::string> japanese;
    std::optional<std::string> website;
    std::int64_t titles{};
    std::int64_t roles{};
};

struct Post {
    /// A string for the reason [`Me::id`] is one.
    PostId id{};
    std::string body{};
    std::optional<std::int32_t> shikimori_id;
    std::optional<std::string> title;
    std::optional<std::int32_t> episode;
    std::optional<PostId> parent;
    std::string at{};
};

struct PostBody {
    std::string body{};
    std::optional<std::int32_t> shikimori_id;
    std::optional<std::string> title;
    std::optional<std::int32_t> episode;
    /// Read and ignored.
    ///
    /// A post used to be able to hide behind one flag; `||a phrase||` in the body
    /// does that properly and this door is a contract somebody else's code already
    /// sends. Refusing the field would break a client over a word that no longer
    /// means anything, so it is accepted and dropped.
    std::optional<bool> spoiler;
    std::optional<PostId> parent;
};

/// A public profile.
///
/// Narrower than the site's own, on purpose, and narrower in one direction: the
/// counts an account keeps to itself are **absent** here exactly as they are
/// there, because that decision is made in `social::profile_of`'s query and not
/// by whoever is formatting the answer. Copying the numbers out is safe; asking
/// for them a second way would not be.
struct Profile {
    std::string id{};
    std::string nickname{};
    std::optional<std::string> avatar;
    std::optional<std::string> banner;
    std::optional<std::string> bio;
    std::optional<std::string> about;
    bool verified{};
    /// `user` | `mod` | `admin`
    std::string role{};
    /// The other names this account answers to, in the order they arranged them.
    std::optional<std::vector<std::string>> also;
    std::optional<std::int32_t> followers;
    std::optional<std::int32_t> following;
    std::optional<std::int32_t> titles;
    std::optional<std::int32_t> episodes;
    std::string joined_at{};
};

/// Every refusal on this door, in the one shape they all take.
///
/// `message` is a **phrase name and never a sentence**: one room can hold five
/// languages at once, so the server does not get to choose which one an error
/// is read in. A client shows its own words for the names it knows and the name
/// itself for the ones it does not — which is also why the list of them is
/// stable enough to generate a typed error per name in six languages.
struct Refusal {
    /// e.g. `errors.oauthInsufficientScope`
    std::string message{};
    /// Extra fields a refusal owes a reason for, merged in beside `message` — the
    /// scope that was missing, how long a ban has left. Absent for most.
    std::optional<nlohmann::json> detail;
};

/// A franchise entry: a card, plus where in the sequence the caller was.
struct Related {
    std::int64_t id{};
    std::string title{};
    std::optional<std::string> title_orig;
    std::optional<std::string> poster;
    std::optional<std::int32_t> year;
    /// `tv` | `movie` | `ova` | `ona` | `special` | `music`
    std::string kind{};
    std::int32_t episodes{};
    /// The one number a reader sees: what the people here think of it and what the
    /// outside number said, weighed against each other.
    std::optional<double> score;
    /// whether this row *is* the title that was asked about
    bool current{};
};

struct ScoreBody {
    std::int32_t score{};
    std::optional<std::string> title;
    std::optional<std::string> poster;
};

/// What somebody's watching adds up to.
struct Stats {
    std::int64_t planned{};
    std::int64_t watching{};
    std::int64_t rewatching{};
    std::int64_t paused{};
    std::int64_t done{};
    std::int64_t dropped{};
    std::int64_t episodes{};
    std::int64_t minutes{};
    std::int64_t rated{};
    std::optional<double> average;
};

/// A title, as its own page.
///
/// `wash` is on the site's shape and is not on this one. It is the colour a
/// page tints itself with, computed from the artwork on first read — a fact
/// about how this site draws a screen rather than a fact about the title, and
/// putting it in a frozen contract would be promising a stranger the house's
/// paint.
struct Title {
    std::int64_t id{};
    std::string title{};
    std::optional<std::string> title_orig;
    std::optional<std::string> poster;
    std::optional<std::string> description;
    std::vector<std::string> genres{};
    std::vector<std::string> studios{};
    std::string kind{};
    /// `ongoing` | `released` | `announced`
    std::string status{};
    std::int32_t episodes{};
    std::optional<std::int32_t> duration;
    std::optional<double> score;
    /// And the two halves of that one number, for a caller with room to say so.
    std::optional<double> our_score;
    std::int32_t our_votes{};
    std::optional<std::int32_t> year;
    std::optional<std::string> rating;
    std::vector<std::string> screenshots{};
};

/// A title as it appears in a list.
///
/// `id` is the shikimori id and is the only key this catalogue has ever had. It
/// is a number here rather than a string, unlike the ids above: these are five
/// and six digits and always will be, since they are somebody else's sequence
/// and not ours to outgrow.
struct TitleCard {
    std::int64_t id{};
    std::string title{};
    std::optional<std::string> title_orig;
    std::optional<std::string> poster;
    std::optional<std::int32_t> year;
    /// `tv` | `movie` | `ova` | `ona` | `special` | `music`
    std::string kind{};
    std::int32_t episodes{};
    /// The one number a reader sees: what the people here think of it and what the
    /// outside number said, weighed against each other.
    std::optional<double> score;
};

/// One character in one title.
struct TitleCharacter {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    /// `Main` or `Supporting`, as the source words it
    std::vector<std::string> roles{};
    std::optional<std::vector<Voice>> voices;
};

/// One person on one title, and what they did on it.
struct TitleStaff {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    /// What this person is. All three can be false — most of a crew is none of them
    /// — and several can be true at once.
    bool seyu{};
    bool mangaka{};
    bool producer{};
    std::vector<std::string> roles{};
};

/// Somebody who said the lines, and the language they said them in.
///
/// **`language` absent means nobody has said, which is not the same as "not
/// japanese".** The pass that fills it asks AniList for the japanese cast,
/// which can confirm a voice and can never rule one out. A client that reads
/// this as a boolean will label a chinese dub actress as the original.
struct Voice {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    /// What this person is. All three can be false — most of a crew is none of them
    /// — and several can be true at once.
    bool seyu{};
    bool mangaka{};
    bool producer{};
    /// a BCP-47 tag — `ja` for the original, and the only one written so far
    std::optional<std::string> language;
};

/// A character somebody voiced, and where.
struct VoicedRole {
    std::int64_t id{};
    std::string name{};
    std::optional<std::string> name_orig;
    std::optional<std::string> poster;
    TitleCard title{};
    std::vector<std::string> roles{};
};

// Declared before any is defined, so a shape that contains another does not
// depend on the order the document happened to list them in.
inline void from_json(const nlohmann::json& raw, Airing& out);
inline void to_json(nlohmann::json& raw, const Airing& in);
inline void from_json(const nlohmann::json& raw, Appearance& out);
inline void to_json(nlohmann::json& raw, const Appearance& in);
inline void from_json(const nlohmann::json& raw, Character& out);
inline void to_json(nlohmann::json& raw, const Character& in);
inline void from_json(const nlohmann::json& raw, CharacterCard& out);
inline void to_json(nlohmann::json& raw, const CharacterCard& in);
inline void from_json(const nlohmann::json& raw, Collection& out);
inline void to_json(nlohmann::json& raw, const Collection& in);
inline void from_json(const nlohmann::json& raw, CollectionBody& out);
inline void to_json(nlohmann::json& raw, const CollectionBody& in);
inline void from_json(const nlohmann::json& raw, CollectionItem& out);
inline void to_json(nlohmann::json& raw, const CollectionItem& in);
inline void from_json(const nlohmann::json& raw, EntryBody& out);
inline void to_json(nlohmann::json& raw, const EntryBody& in);
inline void from_json(const nlohmann::json& raw, Episode& out);
inline void to_json(nlohmann::json& raw, const Episode& in);
inline void from_json(const nlohmann::json& raw, ListBody& out);
inline void to_json(nlohmann::json& raw, const ListBody& in);
inline void from_json(const nlohmann::json& raw, ListEntry& out);
inline void to_json(nlohmann::json& raw, const ListEntry& in);
inline void from_json(const nlohmann::json& raw, Me& out);
inline void to_json(nlohmann::json& raw, const Me& in);
inline void from_json(const nlohmann::json& raw, Person& out);
inline void to_json(nlohmann::json& raw, const Person& in);
inline void from_json(const nlohmann::json& raw, PersonCard& out);
inline void to_json(nlohmann::json& raw, const PersonCard& in);
inline void from_json(const nlohmann::json& raw, PersonPage& out);
inline void to_json(nlohmann::json& raw, const PersonPage& in);
inline void from_json(const nlohmann::json& raw, Post& out);
inline void to_json(nlohmann::json& raw, const Post& in);
inline void from_json(const nlohmann::json& raw, PostBody& out);
inline void to_json(nlohmann::json& raw, const PostBody& in);
inline void from_json(const nlohmann::json& raw, Profile& out);
inline void to_json(nlohmann::json& raw, const Profile& in);
inline void from_json(const nlohmann::json& raw, Refusal& out);
inline void to_json(nlohmann::json& raw, const Refusal& in);
inline void from_json(const nlohmann::json& raw, Related& out);
inline void to_json(nlohmann::json& raw, const Related& in);
inline void from_json(const nlohmann::json& raw, ScoreBody& out);
inline void to_json(nlohmann::json& raw, const ScoreBody& in);
inline void from_json(const nlohmann::json& raw, Stats& out);
inline void to_json(nlohmann::json& raw, const Stats& in);
inline void from_json(const nlohmann::json& raw, Title& out);
inline void to_json(nlohmann::json& raw, const Title& in);
inline void from_json(const nlohmann::json& raw, TitleCard& out);
inline void to_json(nlohmann::json& raw, const TitleCard& in);
inline void from_json(const nlohmann::json& raw, TitleCharacter& out);
inline void to_json(nlohmann::json& raw, const TitleCharacter& in);
inline void from_json(const nlohmann::json& raw, TitleStaff& out);
inline void to_json(nlohmann::json& raw, const TitleStaff& in);
inline void from_json(const nlohmann::json& raw, Voice& out);
inline void to_json(nlohmann::json& raw, const Voice& in);
inline void from_json(const nlohmann::json& raw, VoicedRole& out);
inline void to_json(nlohmann::json& raw, const VoicedRole& in);

/// Reading one optional field, leaving it empty when the key is absent.
///
/// `null` is treated as absent as well, and deliberately: this api sends a
/// field it has nothing to say about as a missing key, but a `null` from a
/// proxy or an older build means the same thing to a reader and there is
/// nothing useful to do differently.
template <typename T>
inline void read_opt(const nlohmann::json& raw, const char* key, std::optional<T>& out) {
    if (raw.contains(key) && !raw.at(key).is_null()) {
        out = raw.at(key).get<T>();
    } else {
        out.reset();
    }
}

inline void from_json(const nlohmann::json& raw, Airing& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "title_orig", out.title_orig);
    read_opt(raw, "poster", out.poster);
    out.episode = raw.at("episode").get<std::int32_t>();
    out.on = raw.at("on").get<std::string>();
    out.out = raw.at("out").get<bool>();
}

inline void to_json(nlohmann::json& raw, const Airing& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["title"] = in.title;
    if (in.title_orig.has_value()) raw["title_orig"] = *in.title_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["episode"] = in.episode;
    raw["on"] = in.on;
    raw["out"] = in.out;
}

inline void from_json(const nlohmann::json& raw, Appearance& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "title_orig", out.title_orig);
    read_opt(raw, "poster", out.poster);
    read_opt(raw, "year", out.year);
    out.kind = raw.at("kind").get<std::string>();
    out.episodes = raw.at("episodes").get<std::int32_t>();
    read_opt(raw, "score", out.score);
    out.roles = raw.at("roles").get<std::vector<std::string>>();
}

inline void to_json(nlohmann::json& raw, const Appearance& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["title"] = in.title;
    if (in.title_orig.has_value()) raw["title_orig"] = *in.title_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    if (in.year.has_value()) raw["year"] = *in.year;
    raw["kind"] = in.kind;
    raw["episodes"] = in.episodes;
    if (in.score.has_value()) raw["score"] = *in.score;
    raw["roles"] = in.roles;
}

inline void from_json(const nlohmann::json& raw, Character& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.titles = raw.at("titles").get<std::int64_t>();
}

inline void to_json(nlohmann::json& raw, const Character& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["titles"] = in.titles;
}

inline void from_json(const nlohmann::json& raw, CharacterCard& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
}

inline void to_json(nlohmann::json& raw, const CharacterCard& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
}

inline void from_json(const nlohmann::json& raw, Collection& out) {
    out.code = raw.at("code").get<std::string>();
    out.name = raw.at("name").get<std::string>();
    out.about = raw.at("about").get<std::string>();
    out.icon = raw.at("icon").get<std::string>();
    read_opt(raw, "hue", out.hue);
    out.visibility = raw.at("visibility").get<std::string>();
    out.shared = raw.at("shared").get<bool>();
    out.count = raw.at("count").get<std::int64_t>();
    out.saves = raw.at("saves").get<std::int64_t>();
    out.owner = raw.at("owner").get<std::string>();
    read_opt(raw, "owner_avatar", out.owner_avatar);
    out.owner_verified = raw.at("owner_verified").get<bool>();
    out.covers = raw.at("covers").get<std::vector<std::string>>();
    out.at = raw.at("at").get<std::string>();
    out.edited = raw.at("edited").get<std::string>();
}

inline void to_json(nlohmann::json& raw, const Collection& in) {
    raw = nlohmann::json::object();
    raw["code"] = in.code;
    raw["name"] = in.name;
    raw["about"] = in.about;
    raw["icon"] = in.icon;
    if (in.hue.has_value()) raw["hue"] = *in.hue;
    raw["visibility"] = in.visibility;
    raw["shared"] = in.shared;
    raw["count"] = in.count;
    raw["saves"] = in.saves;
    raw["owner"] = in.owner;
    if (in.owner_avatar.has_value()) raw["owner_avatar"] = *in.owner_avatar;
    raw["owner_verified"] = in.owner_verified;
    raw["covers"] = in.covers;
    raw["at"] = in.at;
    raw["edited"] = in.edited;
}

inline void from_json(const nlohmann::json& raw, CollectionBody& out) {
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "about", out.about);
    read_opt(raw, "icon", out.icon);
    read_opt(raw, "hue", out.hue);
    read_opt(raw, "visibility", out.visibility);
    read_opt(raw, "shared", out.shared);
}

inline void to_json(nlohmann::json& raw, const CollectionBody& in) {
    raw = nlohmann::json::object();
    raw["name"] = in.name;
    if (in.about.has_value()) raw["about"] = *in.about;
    if (in.icon.has_value()) raw["icon"] = *in.icon;
    if (in.hue.has_value()) raw["hue"] = *in.hue;
    if (in.visibility.has_value()) raw["visibility"] = *in.visibility;
    if (in.shared.has_value()) raw["shared"] = *in.shared;
}

inline void from_json(const nlohmann::json& raw, CollectionItem& out) {
    out.shikimori_id = raw.at("shikimori_id").get<std::int32_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "poster", out.poster);
    read_opt(raw, "added_by", out.added_by);
    out.at = raw.at("at").get<std::string>();
}

inline void to_json(nlohmann::json& raw, const CollectionItem& in) {
    raw = nlohmann::json::object();
    raw["shikimori_id"] = in.shikimori_id;
    raw["title"] = in.title;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    if (in.added_by.has_value()) raw["added_by"] = *in.added_by;
    raw["at"] = in.at;
}

inline void from_json(const nlohmann::json& raw, EntryBody& out) {
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "poster", out.poster);
}

inline void to_json(nlohmann::json& raw, const EntryBody& in) {
    raw = nlohmann::json::object();
    raw["title"] = in.title;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
}

inline void from_json(const nlohmann::json& raw, Episode& out) {
    out.episode = raw.at("episode").get<std::int32_t>();
    out.shots = raw.at("shots").get<std::vector<std::string>>();
}

inline void to_json(nlohmann::json& raw, const Episode& in) {
    raw = nlohmann::json::object();
    raw["episode"] = in.episode;
    raw["shots"] = in.shots;
}

inline void from_json(const nlohmann::json& raw, ListBody& out) {
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "poster", out.poster);
    read_opt(raw, "status", out.status);
    read_opt(raw, "episode", out.episode);
}

inline void to_json(nlohmann::json& raw, const ListBody& in) {
    raw = nlohmann::json::object();
    raw["title"] = in.title;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    if (in.status.has_value()) raw["status"] = *in.status;
    if (in.episode.has_value()) raw["episode"] = *in.episode;
}

inline void from_json(const nlohmann::json& raw, ListEntry& out) {
    out.shikimori_id = raw.at("shikimori_id").get<std::int32_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "poster", out.poster);
    out.status = raw.at("status").get<std::string>();
    out.episode = raw.at("episode").get<std::int32_t>();
    read_opt(raw, "episodes", out.episodes);
    read_opt(raw, "score", out.score);
    out.at = raw.at("at").get<std::string>();
}

inline void to_json(nlohmann::json& raw, const ListEntry& in) {
    raw = nlohmann::json::object();
    raw["shikimori_id"] = in.shikimori_id;
    raw["title"] = in.title;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["status"] = in.status;
    raw["episode"] = in.episode;
    if (in.episodes.has_value()) raw["episodes"] = *in.episodes;
    if (in.score.has_value()) raw["score"] = *in.score;
    raw["at"] = in.at;
}

inline void from_json(const nlohmann::json& raw, Me& out) {
    out.id = raw.at("id").get<std::string>();
    read_opt(raw, "nickname", out.nickname);
    read_opt(raw, "avatar", out.avatar);
    read_opt(raw, "banner", out.banner);
    read_opt(raw, "bio", out.bio);
    read_opt(raw, "verified", out.verified);
    read_opt(raw, "created_at", out.created_at);
    read_opt(raw, "email", out.email);
    read_opt(raw, "email_verified", out.email_verified);
}

inline void to_json(nlohmann::json& raw, const Me& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    if (in.nickname.has_value()) raw["nickname"] = *in.nickname;
    if (in.avatar.has_value()) raw["avatar"] = *in.avatar;
    if (in.banner.has_value()) raw["banner"] = *in.banner;
    if (in.bio.has_value()) raw["bio"] = *in.bio;
    if (in.verified.has_value()) raw["verified"] = *in.verified;
    if (in.created_at.has_value()) raw["created_at"] = *in.created_at;
    if (in.email.has_value()) raw["email"] = *in.email;
    if (in.email_verified.has_value()) raw["email_verified"] = *in.email_verified;
}

inline void from_json(const nlohmann::json& raw, Person& out) {
    out.nickname = raw.at("nickname").get<std::string>();
    read_opt(raw, "avatar", out.avatar);
    out.verified = raw.at("verified").get<bool>();
}

inline void to_json(nlohmann::json& raw, const Person& in) {
    raw = nlohmann::json::object();
    raw["nickname"] = in.nickname;
    if (in.avatar.has_value()) raw["avatar"] = *in.avatar;
    raw["verified"] = in.verified;
}

inline void from_json(const nlohmann::json& raw, PersonCard& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.seyu = raw.at("seyu").get<bool>();
    out.mangaka = raw.at("mangaka").get<bool>();
    out.producer = raw.at("producer").get<bool>();
}

inline void to_json(nlohmann::json& raw, const PersonCard& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["seyu"] = in.seyu;
    raw["mangaka"] = in.mangaka;
    raw["producer"] = in.producer;
}

inline void from_json(const nlohmann::json& raw, PersonPage& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.seyu = raw.at("seyu").get<bool>();
    out.mangaka = raw.at("mangaka").get<bool>();
    out.producer = raw.at("producer").get<bool>();
    read_opt(raw, "japanese", out.japanese);
    read_opt(raw, "website", out.website);
    out.titles = raw.at("titles").get<std::int64_t>();
    out.roles = raw.at("roles").get<std::int64_t>();
}

inline void to_json(nlohmann::json& raw, const PersonPage& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["seyu"] = in.seyu;
    raw["mangaka"] = in.mangaka;
    raw["producer"] = in.producer;
    if (in.japanese.has_value()) raw["japanese"] = *in.japanese;
    if (in.website.has_value()) raw["website"] = *in.website;
    raw["titles"] = in.titles;
    raw["roles"] = in.roles;
}

inline void from_json(const nlohmann::json& raw, Post& out) {
    out.id = raw.at("id").get<PostId>();
    out.body = raw.at("body").get<std::string>();
    read_opt(raw, "shikimori_id", out.shikimori_id);
    read_opt(raw, "title", out.title);
    read_opt(raw, "episode", out.episode);
    read_opt(raw, "parent", out.parent);
    out.at = raw.at("at").get<std::string>();
}

inline void to_json(nlohmann::json& raw, const Post& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["body"] = in.body;
    if (in.shikimori_id.has_value()) raw["shikimori_id"] = *in.shikimori_id;
    if (in.title.has_value()) raw["title"] = *in.title;
    if (in.episode.has_value()) raw["episode"] = *in.episode;
    if (in.parent.has_value()) raw["parent"] = *in.parent;
    raw["at"] = in.at;
}

inline void from_json(const nlohmann::json& raw, PostBody& out) {
    out.body = raw.at("body").get<std::string>();
    read_opt(raw, "shikimori_id", out.shikimori_id);
    read_opt(raw, "title", out.title);
    read_opt(raw, "episode", out.episode);
    read_opt(raw, "spoiler", out.spoiler);
    read_opt(raw, "parent", out.parent);
}

inline void to_json(nlohmann::json& raw, const PostBody& in) {
    raw = nlohmann::json::object();
    raw["body"] = in.body;
    if (in.shikimori_id.has_value()) raw["shikimori_id"] = *in.shikimori_id;
    if (in.title.has_value()) raw["title"] = *in.title;
    if (in.episode.has_value()) raw["episode"] = *in.episode;
    if (in.spoiler.has_value()) raw["spoiler"] = *in.spoiler;
    if (in.parent.has_value()) raw["parent"] = *in.parent;
}

inline void from_json(const nlohmann::json& raw, Profile& out) {
    out.id = raw.at("id").get<std::string>();
    out.nickname = raw.at("nickname").get<std::string>();
    read_opt(raw, "avatar", out.avatar);
    read_opt(raw, "banner", out.banner);
    read_opt(raw, "bio", out.bio);
    read_opt(raw, "about", out.about);
    out.verified = raw.at("verified").get<bool>();
    out.role = raw.at("role").get<std::string>();
    read_opt(raw, "also", out.also);
    read_opt(raw, "followers", out.followers);
    read_opt(raw, "following", out.following);
    read_opt(raw, "titles", out.titles);
    read_opt(raw, "episodes", out.episodes);
    out.joined_at = raw.at("joined_at").get<std::string>();
}

inline void to_json(nlohmann::json& raw, const Profile& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["nickname"] = in.nickname;
    if (in.avatar.has_value()) raw["avatar"] = *in.avatar;
    if (in.banner.has_value()) raw["banner"] = *in.banner;
    if (in.bio.has_value()) raw["bio"] = *in.bio;
    if (in.about.has_value()) raw["about"] = *in.about;
    raw["verified"] = in.verified;
    raw["role"] = in.role;
    if (in.also.has_value()) raw["also"] = *in.also;
    if (in.followers.has_value()) raw["followers"] = *in.followers;
    if (in.following.has_value()) raw["following"] = *in.following;
    if (in.titles.has_value()) raw["titles"] = *in.titles;
    if (in.episodes.has_value()) raw["episodes"] = *in.episodes;
    raw["joined_at"] = in.joined_at;
}

inline void from_json(const nlohmann::json& raw, Refusal& out) {
    out.message = raw.at("message").get<std::string>();
    read_opt(raw, "detail", out.detail);
}

inline void to_json(nlohmann::json& raw, const Refusal& in) {
    raw = nlohmann::json::object();
    raw["message"] = in.message;
    if (in.detail.has_value()) raw["detail"] = *in.detail;
}

inline void from_json(const nlohmann::json& raw, Related& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "title_orig", out.title_orig);
    read_opt(raw, "poster", out.poster);
    read_opt(raw, "year", out.year);
    out.kind = raw.at("kind").get<std::string>();
    out.episodes = raw.at("episodes").get<std::int32_t>();
    read_opt(raw, "score", out.score);
    out.current = raw.at("current").get<bool>();
}

inline void to_json(nlohmann::json& raw, const Related& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["title"] = in.title;
    if (in.title_orig.has_value()) raw["title_orig"] = *in.title_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    if (in.year.has_value()) raw["year"] = *in.year;
    raw["kind"] = in.kind;
    raw["episodes"] = in.episodes;
    if (in.score.has_value()) raw["score"] = *in.score;
    raw["current"] = in.current;
}

inline void from_json(const nlohmann::json& raw, ScoreBody& out) {
    out.score = raw.at("score").get<std::int32_t>();
    read_opt(raw, "title", out.title);
    read_opt(raw, "poster", out.poster);
}

inline void to_json(nlohmann::json& raw, const ScoreBody& in) {
    raw = nlohmann::json::object();
    raw["score"] = in.score;
    if (in.title.has_value()) raw["title"] = *in.title;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
}

inline void from_json(const nlohmann::json& raw, Stats& out) {
    out.planned = raw.at("planned").get<std::int64_t>();
    out.watching = raw.at("watching").get<std::int64_t>();
    out.rewatching = raw.at("rewatching").get<std::int64_t>();
    out.paused = raw.at("paused").get<std::int64_t>();
    out.done = raw.at("done").get<std::int64_t>();
    out.dropped = raw.at("dropped").get<std::int64_t>();
    out.episodes = raw.at("episodes").get<std::int64_t>();
    out.minutes = raw.at("minutes").get<std::int64_t>();
    out.rated = raw.at("rated").get<std::int64_t>();
    read_opt(raw, "average", out.average);
}

inline void to_json(nlohmann::json& raw, const Stats& in) {
    raw = nlohmann::json::object();
    raw["planned"] = in.planned;
    raw["watching"] = in.watching;
    raw["rewatching"] = in.rewatching;
    raw["paused"] = in.paused;
    raw["done"] = in.done;
    raw["dropped"] = in.dropped;
    raw["episodes"] = in.episodes;
    raw["minutes"] = in.minutes;
    raw["rated"] = in.rated;
    if (in.average.has_value()) raw["average"] = *in.average;
}

inline void from_json(const nlohmann::json& raw, Title& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "title_orig", out.title_orig);
    read_opt(raw, "poster", out.poster);
    read_opt(raw, "description", out.description);
    out.genres = raw.at("genres").get<std::vector<std::string>>();
    out.studios = raw.at("studios").get<std::vector<std::string>>();
    out.kind = raw.at("kind").get<std::string>();
    out.status = raw.at("status").get<std::string>();
    out.episodes = raw.at("episodes").get<std::int32_t>();
    read_opt(raw, "duration", out.duration);
    read_opt(raw, "score", out.score);
    read_opt(raw, "our_score", out.our_score);
    out.our_votes = raw.at("our_votes").get<std::int32_t>();
    read_opt(raw, "year", out.year);
    read_opt(raw, "rating", out.rating);
    out.screenshots = raw.at("screenshots").get<std::vector<std::string>>();
}

inline void to_json(nlohmann::json& raw, const Title& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["title"] = in.title;
    if (in.title_orig.has_value()) raw["title_orig"] = *in.title_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    if (in.description.has_value()) raw["description"] = *in.description;
    raw["genres"] = in.genres;
    raw["studios"] = in.studios;
    raw["kind"] = in.kind;
    raw["status"] = in.status;
    raw["episodes"] = in.episodes;
    if (in.duration.has_value()) raw["duration"] = *in.duration;
    if (in.score.has_value()) raw["score"] = *in.score;
    if (in.our_score.has_value()) raw["our_score"] = *in.our_score;
    raw["our_votes"] = in.our_votes;
    if (in.year.has_value()) raw["year"] = *in.year;
    if (in.rating.has_value()) raw["rating"] = *in.rating;
    raw["screenshots"] = in.screenshots;
}

inline void from_json(const nlohmann::json& raw, TitleCard& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.title = raw.at("title").get<std::string>();
    read_opt(raw, "title_orig", out.title_orig);
    read_opt(raw, "poster", out.poster);
    read_opt(raw, "year", out.year);
    out.kind = raw.at("kind").get<std::string>();
    out.episodes = raw.at("episodes").get<std::int32_t>();
    read_opt(raw, "score", out.score);
}

inline void to_json(nlohmann::json& raw, const TitleCard& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["title"] = in.title;
    if (in.title_orig.has_value()) raw["title_orig"] = *in.title_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    if (in.year.has_value()) raw["year"] = *in.year;
    raw["kind"] = in.kind;
    raw["episodes"] = in.episodes;
    if (in.score.has_value()) raw["score"] = *in.score;
}

inline void from_json(const nlohmann::json& raw, TitleCharacter& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.roles = raw.at("roles").get<std::vector<std::string>>();
    read_opt(raw, "voices", out.voices);
}

inline void to_json(nlohmann::json& raw, const TitleCharacter& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["roles"] = in.roles;
    if (in.voices.has_value()) raw["voices"] = *in.voices;
}

inline void from_json(const nlohmann::json& raw, TitleStaff& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.seyu = raw.at("seyu").get<bool>();
    out.mangaka = raw.at("mangaka").get<bool>();
    out.producer = raw.at("producer").get<bool>();
    out.roles = raw.at("roles").get<std::vector<std::string>>();
}

inline void to_json(nlohmann::json& raw, const TitleStaff& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["seyu"] = in.seyu;
    raw["mangaka"] = in.mangaka;
    raw["producer"] = in.producer;
    raw["roles"] = in.roles;
}

inline void from_json(const nlohmann::json& raw, Voice& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.seyu = raw.at("seyu").get<bool>();
    out.mangaka = raw.at("mangaka").get<bool>();
    out.producer = raw.at("producer").get<bool>();
    read_opt(raw, "language", out.language);
}

inline void to_json(nlohmann::json& raw, const Voice& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["seyu"] = in.seyu;
    raw["mangaka"] = in.mangaka;
    raw["producer"] = in.producer;
    if (in.language.has_value()) raw["language"] = *in.language;
}

inline void from_json(const nlohmann::json& raw, VoicedRole& out) {
    out.id = raw.at("id").get<std::int64_t>();
    out.name = raw.at("name").get<std::string>();
    read_opt(raw, "name_orig", out.name_orig);
    read_opt(raw, "poster", out.poster);
    out.title = raw.at("title").get<TitleCard>();
    out.roles = raw.at("roles").get<std::vector<std::string>>();
}

inline void to_json(nlohmann::json& raw, const VoicedRole& in) {
    raw = nlohmann::json::object();
    raw["id"] = in.id;
    raw["name"] = in.name;
    if (in.name_orig.has_value()) raw["name_orig"] = *in.name_orig;
    if (in.poster.has_value()) raw["poster"] = *in.poster;
    raw["title"] = in.title;
    raw["roles"] = in.roles;
}

/// Every scope this api offers.
inline const std::vector<std::string>& scopes() {
    static const std::vector<std::string> all = {
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
    return all;
}

}  // namespace acyka
