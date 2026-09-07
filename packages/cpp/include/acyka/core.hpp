#pragma once

/// One request, and everything that happens around it.
///
/// The generated methods are thin on purpose — they name a path, a query and a
/// body, and hand all four of the interesting decisions here:
///
/// - **waiting exactly as long as the server asked.** Every answer carries
///   `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and a 429 carries
///   `Retry-After`.
/// - **retrying only what is safe to retry.** A 429, a 5xx, and a socket that
///   never answered — never a request that was refused on its merits.
/// - **refreshing once on a 401.**
/// - **turning a body into the right exception.**
///
/// ## The transport is a seam
///
/// `http_transport` is an interface and libcurl is one implementation of it.
/// That is not abstraction for its own sake: a C++ project has already chosen
/// its HTTP client, and a library that insists on a second one is a library
/// that either will not link or drags a duplicate TLS stack into the binary.
/// It is also what makes the tests below possible without a socket.

#include <chrono>
#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "acyka/errors.hpp"

namespace acyka {

/// What a transport hands back.
struct http_response {
    long status = 0;
    std::string body;
    /// lowercased names, because a header name is case-insensitive and half the
    /// world's proxies rewrite the casing
    std::map<std::string, std::string> headers;
};

struct http_request {
    std::string method;
    std::string url;
    std::vector<std::pair<std::string, std::string>> headers;
    std::string body;
};

/// Somewhere to send a request.
///
/// Implement it to use the HTTP client a project already has. `curl_transport`
/// in `acyka/transport/curl.hpp` is the one this library ships.
class http_transport {
 public:
    virtual ~http_transport() = default;

    /// Answers, or throws `unreachable`.
    virtual http_response send(const http_request& request) = 0;
};

namespace detail {

/// A path segment or a query value, escaped.
///
/// `nickname` reaches a path and a nickname may hold anything a person typed,
/// so this is not decoration: a name with a `/` in it would otherwise address a
/// different route.
inline std::string urlencode(std::string_view value) {
    static constexpr char digits[] = "0123456789ABCDEF";
    std::string out;
    out.reserve(value.size());
    for (const unsigned char c : value) {
        const bool safe = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                          (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~';
        if (safe) {
            out.push_back(static_cast<char>(c));
        } else {
            out.push_back('%');
            out.push_back(digits[c >> 4]);
            out.push_back(digits[c & 0x0f]);
        }
    }
    return out;
}

inline std::string lowered(std::string text) {
    for (auto& c : text) {
        c = static_cast<char>(c >= 'A' && c <= 'Z' ? c - 'A' + 'a' : c);
    }
    return text;
}

inline std::optional<std::int64_t> number(const std::map<std::string, std::string>& headers,
                                          const char* name) {
    const auto found = headers.find(name);
    if (found == headers.end()) return std::nullopt;
    try {
        return std::stoll(found->second);
    } catch (const std::exception&) {
        return std::nullopt;
    }
}

}  // namespace acyka::detail

/// A query string with nothing that was not asked for in it.
class query_string {
 public:
    /// `std::nullopt` means "not asked for" and is dropped; `0` and `false` are
    /// answers and are sent — a client that dropped falsy values would make
    /// `offset=0` unsendable and `score=0` mean "any score".
    template <typename T>
    void add(const char* name, const std::optional<T>& value) {
        if (!value.has_value()) return;
        std::ostringstream text;
        if constexpr (std::is_same_v<T, bool>) {
            text << (*value ? "true" : "false");
        } else if constexpr (std::is_same_v<T, std::string>) {
            text << *value;
        } else {
            text << *value;
        }
        parts_.emplace_back(name, text.str());
    }

    std::string str() const {
        if (parts_.empty()) return {};
        std::string out = "?";
        for (std::size_t i = 0; i < parts_.size(); ++i) {
            if (i > 0) out += "&";
            out += detail::urlencode(parts_[i].first);
            out += "=";
            out += detail::urlencode(parts_[i].second);
        }
        return out;
    }

 private:
    std::vector<std::pair<std::string, std::string>> parts_;
};

/// What a token is, as far as the transport cares.
class auth {
 public:
    virtual ~auth() = default;

    /// A live access token, refreshed or minted if the held one has run out.
    virtual std::string fresh() = 0;

    /// Throw away what is held, so the next call mints or refreshes.
    virtual void forget() = 0;

    virtual std::vector<std::string> scopes() const { return {}; }
};

struct options {
    std::string base_url = "https://api.acyka.cc";
    std::chrono::milliseconds timeout{30000};
    /// how many times a retryable answer is retried; 0 turns it off entirely
    int retries = 3;
    /// The longest this will ever sleep on a 429 before giving up.
    ///
    /// Without a ceiling, a client that has spent its minute and asked for a
    /// hundred pages sleeps the whole window inside one call — which looks
    /// exactly like a hang to whoever is waiting on it.
    std::chrono::milliseconds max_wait{65000};
    std::string user_agent = "acyka-api-cpp/1";
    /// told after every answer, so a caller can watch its own budget
    std::function<void(const pace&)> on_pace;
};

class core {
 public:
    core(std::shared_ptr<auth> holder, std::shared_ptr<http_transport> transport, options settings)
        : auth_(std::move(holder)), http_(std::move(transport)), options_(std::move(settings)) {}

    /// What the last answer said about this client's minute.
    const pace& last_pace() const noexcept { return pace_; }

    const options& settings() const noexcept { return options_; }

    /// One call, parsed — or `nullptr` json for a 204.
    nlohmann::json call(const char* method, const std::string& path, const std::string& query,
                        const std::string& body, bool has_body) {
        const std::string where = std::string(method) + " " + path;
        const auto said = text(method, path, query, body, has_body, where);
        if (said.empty()) return nlohmann::json{};
        try {
            return nlohmann::json::parse(said);
        } catch (const nlohmann::json::exception& cause) {
            throw malformed(where, cause.what());
        }
    }

 private:
    std::string text(const char* method, const std::string& path, const std::string& query,
                     const std::string& body, bool has_body, const std::string& where) {
        bool refreshed = false;
        int attempt = 0;

        for (;;) {
            http_request request;
            request.method = method;
            request.url = options_.base_url + path + query;
            request.headers.emplace_back("Authorization", "Bearer " + auth_->fresh());
            request.headers.emplace_back("Accept", "application/json");
            request.headers.emplace_back("User-Agent", options_.user_agent);
            if (has_body) {
                request.headers.emplace_back("Content-Type", "application/json");
                request.body = body;
            }

            http_response response;
            try {
                response = http_->send(request);
            } catch (const unreachable&) {
                // Nothing answered. Worth one more go for the same reason a 5xx
                // is — a dropped socket during a deploy is a gap, not a refusal.
                if (attempt < options_.retries) {
                    std::this_thread::sleep_for(backoff(attempt));
                    attempt += 1;
                    continue;
                }
                throw;
            }

            pace_ = pace{detail::number(response.headers, "x-ratelimit-limit"),
                         detail::number(response.headers, "x-ratelimit-remaining"),
                         detail::number(response.headers, "x-ratelimit-reset")};
            if (options_.on_pace) options_.on_pace(pace_);

            if (response.status >= 200 && response.status < 300) {
                return response.status == 204 ? std::string{} : response.body;
            }

            // A proxy's own 502 is html, and a parse error there would tell the
            // caller nothing about what happened.
            nlohmann::json detail = nlohmann::json::object();
            std::string code = "HTTP " + std::to_string(response.status);
            try {
                auto parsed = nlohmann::json::parse(response.body);
                if (parsed.is_object()) {
                    detail = parsed;
                    if (parsed.contains("message") && parsed.at("message").is_string()) {
                        code = parsed.at("message").get<std::string>();
                    }
                }
            } catch (const nlohmann::json::exception&) {
                // left as the status
            }

            if (response.status == 401 && !refreshed) {
                refreshed = true;
                auth_->forget();
                // A second 401 after this is the server saying the credential is
                // wrong rather than stale, and refreshing again would produce
                // the same one.
                try {
                    (void)auth_->fresh();
                    continue;
                } catch (const std::exception&) {
                    throw unauthorized(401, code, detail, where);
                }
            }

            const auto retry_after = detail::number(response.headers, "retry-after").value_or(0);
            const bool worth_retrying = response.status == 429 || response.status >= 500;
            if (worth_retrying && attempt < options_.retries) {
                const auto wait =
                    response.status == 429
                        // The server's own number rather than a guess: too little
                        // and it is refused again, too much and the client
                        // sleeps for nothing.
                        ? std::chrono::milliseconds(
                              std::max<std::int64_t>(
                                  {retry_after, pace_.reset.value_or(1), 1}) * 1000)
                        : backoff(attempt);
                if (wait <= options_.max_wait) {
                    std::this_thread::sleep_for(wait);
                    attempt += 1;
                    continue;
                }
            }

            detail::refuse(static_cast<int>(response.status), code, detail, where,
                           std::max<std::int64_t>(retry_after, pace_.reset.value_or(0)), pace_);
        }
    }

    static std::chrono::milliseconds backoff(int attempt) {
        const auto shift = attempt < 4 ? attempt : 4;
        return std::chrono::milliseconds(std::min<long>(250L << shift, 4000L));
    }

    std::shared_ptr<auth> auth_;
    std::shared_ptr<http_transport> http_;
    options options_;
    pace pace_{};
};

}  // namespace acyka
