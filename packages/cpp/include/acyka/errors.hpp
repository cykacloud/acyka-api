#pragma once

/// One type per refusal, out of a set the server keeps small on purpose.
///
/// The api answers `{"message": "errors.oauthInsufficientScope"}` — a **phrase
/// name and never a sentence** — because one screen can be read in five
/// languages and the server does not get to choose which. For a client that is
/// not a limitation but the thing that makes real types possible: a stable,
/// enumerable set of names, instead of matching on prose that changes when
/// somebody rewrites a sentence.

#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

namespace acyka {

/// What the server said about the caller's minute.
struct pace {
    std::optional<std::int64_t> limit;
    std::optional<std::int64_t> remaining;
    /// seconds until the window turns
    std::optional<std::int64_t> reset;
};

/// Anything the api refused, or could not be asked.
class error : public std::runtime_error {
 public:
    error(int status, std::string code, nlohmann::json detail, std::string request)
        : std::runtime_error(code + " (" + std::to_string(status) + " for " + request + ")"),
          status_(status),
          code_(std::move(code)),
          detail_(std::move(detail)),
          request_(std::move(request)) {}

    int status() const noexcept { return status_; }

    /// The phrase name, e.g. `errors.notFound`.
    const std::string& code() const noexcept { return code_; }

    /// The whole body, including the extra fields a refusal owes a reason for.
    const nlohmann::json& detail() const noexcept { return detail_; }

    /// What was asked, for a log that has to be read six months later.
    const std::string& request() const noexcept { return request_; }

    /// A named string out of the extra fields, where there is one.
    std::optional<std::string> field(const char* name) const {
        if (detail_.is_object() && detail_.contains(name) && detail_.at(name).is_string()) {
            return detail_.at(name).get<std::string>();
        }
        return std::nullopt;
    }

    /// Whether asking again could plausibly answer differently.
    virtual bool retryable() const noexcept { return false; }

 private:
    int status_;
    std::string code_;
    nlohmann::json detail_;
    std::string request_;
};

/// No token, an expired one, or one whose application was switched off.
class unauthorized : public error {
 public:
    using error::error;
};

/// The token is good and does not carry what this endpoint wants.
///
/// **Refreshing will not help**, which is why this is not `unauthorized`: the
/// refresh produces the same token with the same scopes and earns the same
/// refusal.
class forbidden : public error {
 public:
    using error::error;

    /// The word that was missing, where the server named it.
    std::optional<std::string> scope() const { return field("scope"); }
};

class not_found : public error {
 public:
    using error::error;
};

/// Refused before anything looked at it.
class bad_request : public error {
 public:
    using error::error;
};

/// The minute is spent.
///
/// `retry_after` is seconds, from the server's own header. This only reaches a
/// caller when the retries are used up or turned off.
class rate_limited : public error {
 public:
    rate_limited(int status, std::string code, nlohmann::json detail, std::string request,
                 std::int64_t retry_after, pace seen)
        : error(status, std::move(code), std::move(detail), std::move(request)),
          retry_after_(retry_after),
          pace_(seen) {}

    std::int64_t retry_after() const noexcept { return retry_after_; }

    const pace& seen() const noexcept { return pace_; }

    bool retryable() const noexcept override { return true; }

 private:
    std::int64_t retry_after_;
    pace pace_;
};

class server_error : public error {
 public:
    using error::error;

    bool retryable() const noexcept override { return true; }
};

/// A status this client has no name for, which is a server that has grown one —
/// and a client that aborted on it would be worse than one that hands it over.
class unexpected : public error {
 public:
    using error::error;
};

/// The request never got an answer: a socket, a timeout, a proxy.
class unreachable : public error {
 public:
    unreachable(std::string request, std::string why)
        : error(0, "errors.unreachable", nlohmann::json::object({{"why", why}}),
                std::move(request)) {}

    bool retryable() const noexcept override { return true; }
};

/// The answer arrived and was not the shape the contract says.
///
/// Its own type rather than folded into `unreachable`, because the two mean
/// opposite things about what to do next: a socket is worth retrying and a shape
/// that does not parse never will be.
class malformed : public error {
 public:
    malformed(std::string request, std::string why)
        : error(0, "errors.malformed", nlohmann::json::object({{"why", why}}),
                std::move(request)) {}
};

/// The token endpoint refused, as RFC 6749 names it.
class oauth_error : public std::runtime_error {
 public:
    oauth_error(std::string name, std::optional<std::string> description)
        : std::runtime_error(description ? name + ": " + *description : name),
          name_(std::move(name)),
          description_(std::move(description)) {}

    const std::string& name() const noexcept { return name_; }

    const std::optional<std::string>& description() const noexcept { return description_; }

 private:
    std::string name_;
    std::optional<std::string> description_;
};

namespace detail {

/// The refusal a status deserves, thrown by `core::call`.
[[noreturn]] inline void refuse(int status, const std::string& code, const nlohmann::json& detail,
                                const std::string& request, std::int64_t retry_after, pace seen) {
    switch (status) {
        case 400:
        case 422:
            throw bad_request(status, code, detail, request);
        case 401:
            throw unauthorized(status, code, detail, request);
        case 403:
            throw forbidden(status, code, detail, request);
        case 404:
            throw not_found(status, code, detail, request);
        case 429:
            throw rate_limited(status, code, detail, request, retry_after, seen);
        default:
            if (status >= 500) throw server_error(status, code, detail, request);
            throw unexpected(status, code, detail, request);
    }
}

}  // namespace detail

}  // namespace acyka
