#pragma once

/// Checking that a delivery came from us.
///
/// Thirty lines, every one of which is a line somebody gets wrong when they
/// write it themselves — which is why it is in the library rather than in the
/// documentation.
///
/// The three that matter:
///
/// - **the raw bytes, not a parsed body.** The signature covers what was sent.
///   Parsing and re-serialising gives a different string the moment key order or
///   number formatting differs, and the check then fails for good reasons that
///   look like bad ones.
/// - **a constant-time compare.** `==` on strings returns as soon as two
///   characters differ, and how long that took measures how much of the
///   signature was right — a hundred requests per byte, and a forgeable
///   signature at the end of it.
/// - **the timestamp.** The signed string is `<t>.<body>`, so a captured
///   delivery signs valid for ever unless somebody checks how old `t` is.

#include <chrono>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>

#include <nlohmann/json.hpp>

#include "acyka/detail/hmac.hpp"

namespace acyka {

/// A delivery that is not ours, or not this minute's.
class bad_signature : public std::runtime_error {
 public:
    explicit bad_signature(const std::string& why)
        : std::runtime_error("the webhook signature did not check out: " + why) {}
};

/// One thing that happened, as it arrives.
struct delivery {
    /// which kind — `list.saved`, `episode.aired`, and five more
    std::string event;
    /// the row that moved, in this door's snake_case
    nlohmann::json data;
};

namespace detail {

/// `t=1700000000,v1=<hex>` as its two halves.
inline bool signature_parts(std::string_view header, std::int64_t& at, std::string& mac) {
    bool seen_t = false;
    bool seen_v1 = false;
    std::size_t from = 0;

    while (from <= header.size()) {
        const auto comma = header.find(',', from);
        const auto piece = header.substr(from, comma == std::string_view::npos ? std::string_view::npos
                                                                              : comma - from);
        const auto equals = piece.find('=');
        if (equals != std::string_view::npos) {
            const auto key = piece.substr(0, equals);
            const auto value = piece.substr(equals + 1);
            if (key == "t") {
                try {
                    at = std::stoll(std::string(value));
                    seen_t = true;
                } catch (const std::exception&) {
                    return false;
                }
            } else if (key == "v1" && !value.empty()) {
                mac = std::string(value);
                seen_v1 = true;
            }
        }
        if (comma == std::string_view::npos) break;
        from = comma + 1;
    }

    return seen_t && seen_v1;
}

}  // namespace detail

/// The delivery, or a `bad_signature`.
///
/// ```cpp
/// const auto event = acyka::verify(raw_body, header, secret);
/// if (event.event == "episode.aired") { /* … */ }
/// ```
inline delivery verify(std::string_view body, std::string_view signature, std::string_view secret,
                       std::int64_t tolerance = 300, std::int64_t now = 0) {
    if (signature.empty()) throw bad_signature("there was no signature header");

    std::int64_t at = 0;
    std::string presented;
    if (!detail::signature_parts(signature, at, presented)) {
        throw bad_signature("the header was not `t=…,v1=…`");
    }

    const std::int64_t seconds =
        now != 0 ? now
                 : std::chrono::duration_cast<std::chrono::seconds>(
                       std::chrono::system_clock::now().time_since_epoch())
                       .count();

    // Both directions. A delivery from the future is a clock that is wrong, and
    // accepting it would mean accepting one whose `t` an attacker chose.
    const std::int64_t age = seconds > at ? seconds - at : at - seconds;
    if (age > tolerance) {
        throw bad_signature("it is " + std::to_string(age) + "s old, and the tolerance is " +
                            std::to_string(tolerance) + "s");
    }

    const std::string signed_over = std::to_string(at) + "." + std::string(body);
    const std::string expected = detail::hmac_sha256_hex(secret, signed_over);

    if (!detail::constant_time_equals(expected, presented)) {
        throw bad_signature("it does not match the body");
    }

    nlohmann::json parsed;
    try {
        parsed = nlohmann::json::parse(body);
    } catch (const nlohmann::json::exception& cause) {
        throw bad_signature(std::string("the body was not json: ") + cause.what());
    }
    if (!parsed.is_object()) throw bad_signature("the body was not an object");

    delivery out;
    out.event = parsed.value("event", std::string{});
    out.data = parsed.contains("data") ? parsed.at("data") : nlohmann::json{};
    return out;
}

}  // namespace acyka
