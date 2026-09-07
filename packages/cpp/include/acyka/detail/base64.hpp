#pragma once

/// Base64, in both of the alphabets this library needs.
///
/// `base64` is for the `Authorization: Basic` header on the token endpoint;
/// `base64url` is for PKCE, where the standard requires the URL-safe alphabet
/// with the padding stripped — a `+`, a `/` or an `=` in a code verifier is a
/// verifier that does not survive being a query parameter.

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

namespace acyka::detail {

inline std::string encode64(std::string_view raw, const char* alphabet, bool pad) {
    std::string out;
    out.reserve(((raw.size() + 2) / 3) * 4);

    std::size_t at = 0;
    while (at + 2 < raw.size()) {
        const auto a = static_cast<unsigned char>(raw[at]);
        const auto b = static_cast<unsigned char>(raw[at + 1]);
        const auto c = static_cast<unsigned char>(raw[at + 2]);
        out.push_back(alphabet[a >> 2]);
        out.push_back(alphabet[((a & 0x03) << 4) | (b >> 4)]);
        out.push_back(alphabet[((b & 0x0f) << 2) | (c >> 6)]);
        out.push_back(alphabet[c & 0x3f]);
        at += 3;
    }

    const auto left = raw.size() - at;
    if (left == 1) {
        const auto a = static_cast<unsigned char>(raw[at]);
        out.push_back(alphabet[a >> 2]);
        out.push_back(alphabet[(a & 0x03) << 4]);
        if (pad) out.append("==");
    } else if (left == 2) {
        const auto a = static_cast<unsigned char>(raw[at]);
        const auto b = static_cast<unsigned char>(raw[at + 1]);
        out.push_back(alphabet[a >> 2]);
        out.push_back(alphabet[((a & 0x03) << 4) | (b >> 4)]);
        out.push_back(alphabet[(b & 0x0f) << 2]);
        if (pad) out.push_back('=');
    }

    return out;
}

inline std::string base64(std::string_view raw) {
    static constexpr char alphabet[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    return encode64(raw, alphabet, true);
}

inline std::string base64url(std::string_view raw) {
    static constexpr char alphabet[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    return encode64(raw, alphabet, false);
}

}  // namespace acyka::detail
