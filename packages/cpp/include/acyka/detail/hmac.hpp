#pragma once

/// SHA-256 and HMAC, written out rather than linked.
///
/// This is the one place a header-only library has to choose between a
/// dependency and an implementation, and the dependency is the worse deal here:
/// OpenSSL would be forced on everybody who takes this library, on every
/// platform, to verify a webhook signature — and finding OpenSSL from CMake is
/// itself a thing people lose afternoons to.
///
/// SHA-256 is a published algorithm with published test vectors, so "did we get
/// it right" is a question with an exact answer rather than a matter of trust:
/// `tests/hmac_test.cpp` checks it against FIPS 180-4 and the HMAC cases in
/// RFC 4231. Nothing here is novel, and nothing here should ever be edited
/// without those tests going green.

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <string_view>
#include <vector>

namespace acyka::detail {

class sha256 {
 public:
    static constexpr std::size_t block_size = 64;
    static constexpr std::size_t digest_size = 32;

    sha256() { reset(); }

    void reset() {
        state_ = {0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
                  0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u};
        buffered_ = 0;
        counted_ = 0;
    }

    void update(const void* bytes, std::size_t length) {
        const auto* at = static_cast<const std::uint8_t*>(bytes);
        counted_ += length;
        while (length > 0) {
            const auto room = block_size - buffered_;
            const auto taking = length < room ? length : room;
            std::memcpy(buffer_.data() + buffered_, at, taking);
            buffered_ += taking;
            at += taking;
            length -= taking;
            if (buffered_ == block_size) {
                compress(buffer_.data());
                buffered_ = 0;
            }
        }
    }

    void update(std::string_view text) { update(text.data(), text.size()); }

    std::array<std::uint8_t, digest_size> finish() {
        // The padding the standard specifies: a one bit, then zeros, then the
        // length in bits as a big-endian 64.
        const std::uint64_t bits = counted_ * 8;
        update("\x80", 1);
        static const std::uint8_t zero = 0;
        while (buffered_ != 56) update(&zero, 1);

        std::array<std::uint8_t, 8> tail{};
        for (int i = 0; i < 8; ++i) tail[static_cast<std::size_t>(i)] =
            static_cast<std::uint8_t>(bits >> (56 - 8 * i));
        update(tail.data(), tail.size());

        std::array<std::uint8_t, digest_size> out{};
        for (std::size_t i = 0; i < 8; ++i) {
            out[i * 4 + 0] = static_cast<std::uint8_t>(state_[i] >> 24);
            out[i * 4 + 1] = static_cast<std::uint8_t>(state_[i] >> 16);
            out[i * 4 + 2] = static_cast<std::uint8_t>(state_[i] >> 8);
            out[i * 4 + 3] = static_cast<std::uint8_t>(state_[i]);
        }
        return out;
    }

 private:
    static std::uint32_t ror(std::uint32_t value, int by) {
        return (value >> by) | (value << (32 - by));
    }

    void compress(const std::uint8_t* block) {
        static constexpr std::array<std::uint32_t, 64> k = {
            0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u,
            0x923f82a4u, 0xab1c5ed5u, 0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
            0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u, 0xe49b69c1u, 0xefbe4786u,
            0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
            0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u,
            0x06ca6351u, 0x14292967u, 0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
            0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u, 0xa2bfe8a1u, 0xa81a664bu,
            0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
            0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au,
            0x5b9cca4fu, 0x682e6ff3u, 0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
            0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u};

        std::array<std::uint32_t, 64> w{};
        for (std::size_t i = 0; i < 16; ++i) {
            w[i] = (static_cast<std::uint32_t>(block[i * 4]) << 24) |
                   (static_cast<std::uint32_t>(block[i * 4 + 1]) << 16) |
                   (static_cast<std::uint32_t>(block[i * 4 + 2]) << 8) |
                   static_cast<std::uint32_t>(block[i * 4 + 3]);
        }
        for (std::size_t i = 16; i < 64; ++i) {
            const auto s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >> 3);
            const auto s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        auto a = state_[0], b = state_[1], c = state_[2], d = state_[3];
        auto e = state_[4], f = state_[5], g = state_[6], h = state_[7];

        for (std::size_t i = 0; i < 64; ++i) {
            const auto s1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
            const auto ch = (e & f) ^ (~e & g);
            const auto t1 = h + s1 + ch + k[i] + w[i];
            const auto s0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
            const auto maj = (a & b) ^ (a & c) ^ (b & c);
            const auto t2 = s0 + maj;
            h = g;
            g = f;
            f = e;
            e = d + t1;
            d = c;
            c = b;
            b = a;
            a = t1 + t2;
        }

        state_[0] += a;
        state_[1] += b;
        state_[2] += c;
        state_[3] += d;
        state_[4] += e;
        state_[5] += f;
        state_[6] += g;
        state_[7] += h;
    }

    std::array<std::uint32_t, 8> state_{};
    std::array<std::uint8_t, block_size> buffer_{};
    std::size_t buffered_ = 0;
    std::uint64_t counted_ = 0;
};

inline std::string hex(const std::uint8_t* bytes, std::size_t length) {
    static constexpr char digits[] = "0123456789abcdef";
    std::string out;
    out.reserve(length * 2);
    for (std::size_t i = 0; i < length; ++i) {
        out.push_back(digits[bytes[i] >> 4]);
        out.push_back(digits[bytes[i] & 0x0f]);
    }
    return out;
}

inline std::string sha256_hex(std::string_view text) {
    sha256 hash;
    hash.update(text);
    const auto digest = hash.finish();
    return hex(digest.data(), digest.size());
}

/// HMAC-SHA256, as RFC 2104 specifies it.
inline std::array<std::uint8_t, sha256::digest_size> hmac_sha256(std::string_view key,
                                                                 std::string_view message) {
    std::array<std::uint8_t, sha256::block_size> padded{};

    if (key.size() > sha256::block_size) {
        // A key longer than the block is hashed first — which is the step
        // everybody who writes this by hand leaves out, and the reason the RFC
        // 4231 vectors include a 131-byte key.
        sha256 shorten;
        shorten.update(key);
        const auto digest = shorten.finish();
        std::memcpy(padded.data(), digest.data(), digest.size());
    } else {
        std::memcpy(padded.data(), key.data(), key.size());
    }

    std::array<std::uint8_t, sha256::block_size> inner{};
    std::array<std::uint8_t, sha256::block_size> outer{};
    for (std::size_t i = 0; i < sha256::block_size; ++i) {
        inner[i] = static_cast<std::uint8_t>(padded[i] ^ 0x36);
        outer[i] = static_cast<std::uint8_t>(padded[i] ^ 0x5c);
    }

    sha256 first;
    first.update(inner.data(), inner.size());
    first.update(message);
    const auto once = first.finish();

    sha256 second;
    second.update(outer.data(), outer.size());
    second.update(once.data(), once.size());
    return second.finish();
}

inline std::string hmac_sha256_hex(std::string_view key, std::string_view message) {
    const auto digest = hmac_sha256(key, message);
    return hex(digest.data(), digest.size());
}

/// Two strings, compared without saying how far they matched.
///
/// `==` returns as soon as two characters differ, and how long that took
/// measures how much of the signature was right — a hundred requests per byte,
/// and a forgeable signature at the end of it.
inline bool constant_time_equals(std::string_view a, std::string_view b) {
    if (a.size() != b.size()) return false;
    unsigned char differs = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        differs = static_cast<unsigned char>(differs | (a[i] ^ b[i]));
    }
    return differs == 0;
}

}  // namespace acyka::detail
