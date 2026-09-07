#pragma once

/// All four ways to hold a token, and the one thing they have in common.
///
/// An access token lives an hour. A library that makes its caller notice that is
/// a library whose callers each write the same refresh-and-retry loop, slightly
/// differently — and one of them gets the concurrent case wrong and sends two
/// refreshes for one expiry, which, because refresh tokens here **rotate and a
/// reuse kills the family**, signs their users out. So the loop is written once
/// and `auth::fresh` is the whole of what the transport knows about it.

#include <chrono>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <random>
#include <sstream>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "acyka/core.hpp"
#include "acyka/detail/base64.hpp"
#include "acyka/detail/hmac.hpp"
#include "acyka/errors.hpp"

namespace acyka {

/// Where the provider lives. Overridable for a laptop, fixed in practice.
struct endpoints {
    std::string authorize = "https://acyka.cc/api/oauth2/authorize";
    std::string token = "https://acyka.cc/api/oauth2/token";
    std::string device = "https://acyka.cc/api/oauth2/device_authorization";
};

struct tokens {
    std::string access_token;
    std::string token_type = "Bearer";
    std::int64_t expires_in = 3600;
    std::string scope;
    std::optional<std::string> refresh_token;
    std::optional<std::string> id_token;

    std::vector<std::string> scopes() const {
        std::vector<std::string> out;
        std::istringstream words(scope);
        std::string one;
        while (words >> one) out.push_back(one);
        return out;
    }
};

inline void from_json(const nlohmann::json& raw, tokens& out) {
    out.access_token = raw.at("access_token").get<std::string>();
    out.token_type = raw.value("token_type", std::string{"Bearer"});
    out.expires_in = raw.value("expires_in", std::int64_t{3600});
    out.scope = raw.value("scope", std::string{});
    if (raw.contains("refresh_token") && !raw.at("refresh_token").is_null()) {
        out.refresh_token = raw.at("refresh_token").get<std::string>();
    }
    if (raw.contains("id_token") && !raw.at("id_token").is_null()) {
        out.id_token = raw.at("id_token").get<std::string>();
    }
}

/// Told whenever a token set is replaced, so a caller can put it somewhere.
///
/// A refresh token **rotates**: the one handed back is the one to keep, and the
/// one that was sent is dead. Storing the original for ever leaves a credential
/// that stops working — and presenting it again is what the server reads as
/// theft, which kills the whole chain.
using keeper = std::function<void(const tokens&)>;

namespace detail {

inline std::int64_t now_seconds() {
    return std::chrono::duration_cast<std::chrono::seconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

/// A form-encoded body, and the header a secret goes in.
inline tokens exchange(http_transport& http, const std::string& endpoint,
                       std::vector<std::pair<std::string, std::string>> form,
                       const std::string& client_id,
                       const std::optional<std::string>& client_secret) {
    http_request request;
    request.method = "POST";
    request.url = endpoint;
    request.headers.emplace_back("Accept", "application/json");
    request.headers.emplace_back("Content-Type", "application/x-www-form-urlencoded");

    if (client_secret.has_value()) {
        // `client_secret_basic` rather than the body. Both are in the spec and
        // the api takes either; a header is the one that does not end up in a
        // proxy's access log beside the request line.
        request.headers.emplace_back("Authorization", "Basic " + base64(client_id + ":" + *client_secret));
    } else {
        form.emplace_back("client_id", client_id);
    }

    std::string body;
    for (std::size_t i = 0; i < form.size(); ++i) {
        if (i > 0) body += "&";
        body += urlencode(form[i].first) + "=" + urlencode(form[i].second);
    }
    request.body = body;

    const auto response = http.send(request);
    if (response.status < 200 || response.status >= 300) {
        // The token endpoint speaks RFC 6749 rather than this api's own error
        // shape — `{"error": "invalid_grant"}` — because every OAuth library
        // ever written reads that field and nothing else.
        std::string name = "HTTP " + std::to_string(response.status);
        std::optional<std::string> description;
        try {
            const auto said = nlohmann::json::parse(response.body);
            if (said.is_object()) {
                if (said.contains("error")) name = said.at("error").get<std::string>();
                if (said.contains("error_description")) {
                    description = said.at("error_description").get<std::string>();
                }
            }
        } catch (const nlohmann::json::exception&) {
            if (!response.body.empty()) description = response.body;
        }
        throw oauth_error(name, description);
    }

    try {
        return nlohmann::json::parse(response.body).get<tokens>();
    } catch (const nlohmann::json::exception& cause) {
        throw oauth_error("invalid_grant", cause.what());
    }
}

}  // namespace detail

/// A token somebody else obtained and handed over.
///
/// No refresh: when it runs out it runs out, and the caller finds out with an
/// `unauthorized` rather than having a credential swapped underneath them.
class bearer_token : public auth {
 public:
    explicit bearer_token(std::string token, std::vector<std::string> granted = {})
        : token_(std::move(token)), granted_(std::move(granted)) {}

    std::string fresh() override {
        if (token_.empty()) {
            throw unauthorized(401, "errors.unauthorized", nlohmann::json::object(), "");
        }
        return token_;
    }

    void forget() override {
        // Nothing to forget: there is no way to get another, and clearing it
        // would turn one 401 into every call failing.
    }

    std::vector<std::string> scopes() const override { return granted_; }

 private:
    std::string token_;
    std::vector<std::string> granted_;
};

/// An application acting for itself.
///
/// No person, no consent screen, no refresh token — there is nothing to refresh,
/// because the application can ask for another whenever it likes.
///
/// Only the scopes that are about nobody can be held this way: `catalog:read`
/// and `people:read`.
class app_only : public auth {
 public:
    app_only(std::string client_id, std::string client_secret,
             std::shared_ptr<http_transport> http, std::vector<std::string> asked = {"catalog:read"},
             endpoints where = {})
        : client_id_(std::move(client_id)),
          client_secret_(std::move(client_secret)),
          http_(std::move(http)),
          asked_(std::move(asked)),
          where_(std::move(where)) {}

    std::string fresh() override {
        // Held across the exchange, so several threads that all notice the same
        // expiry mint one token between them rather than one each.
        std::lock_guard<std::mutex> holding(lock_);
        if (held_.has_value() && expires_at_ > detail::now_seconds()) {
            return held_->access_token;
        }

        std::vector<std::pair<std::string, std::string>> form{
            {"grant_type", "client_credentials"}};
        if (!asked_.empty()) {
            std::string scope;
            for (std::size_t i = 0; i < asked_.size(); ++i) {
                if (i > 0) scope += " ";
                scope += asked_[i];
            }
            form.emplace_back("scope", scope);
        }

        held_ = detail::exchange(*http_, where_.token, form, client_id_, client_secret_);
        // Sixty seconds early. A token that expires while a request is in flight
        // is a 401 the caller did nothing to deserve, and clock skew between two
        // machines is measured in seconds rather than milliseconds.
        expires_at_ = detail::now_seconds() + (held_->expires_in > 60 ? held_->expires_in - 60 : 0);
        return held_->access_token;
    }

    void forget() override {
        std::lock_guard<std::mutex> holding(lock_);
        held_.reset();
        expires_at_ = 0;
    }

    std::vector<std::string> scopes() const override { return asked_; }

 private:
    std::string client_id_;
    std::string client_secret_;
    std::shared_ptr<http_transport> http_;
    std::vector<std::string> asked_;
    endpoints where_;
    std::mutex lock_;
    std::optional<tokens> held_;
    std::int64_t expires_at_ = 0;
};

/// A token that acts for a person, kept alive by its refresh token.
///
/// The refresh is **serialised** by the mutex, which is the whole reason this is
/// a type rather than a helper: several requests that all notice the expiry at
/// once must send one refresh between them, because the tokens rotate and the
/// second would present one the first has already retired.
class user_token : public auth {
 public:
    user_token(std::string client_id, tokens held, std::shared_ptr<http_transport> http,
               std::optional<std::string> client_secret = std::nullopt, keeper keep = {},
               endpoints where = {})
        : client_id_(std::move(client_id)),
          client_secret_(std::move(client_secret)),
          http_(std::move(http)),
          keep_(std::move(keep)),
          where_(std::move(where)),
          held_(std::move(held)) {
        expires_at_ = detail::now_seconds() + (held_.expires_in > 60 ? held_.expires_in - 60 : 0);
    }

    std::string fresh() override {
        std::lock_guard<std::mutex> holding(lock_);
        if (!held_.access_token.empty() && expires_at_ > detail::now_seconds()) {
            return held_.access_token;
        }

        if (!held_.refresh_token.has_value()) {
            throw oauth_error("invalid_grant", "no refresh token — ask for offline_access");
        }
        const auto sent = *held_.refresh_token;

        auto got = detail::exchange(
            *http_, where_.token,
            {{"grant_type", "refresh_token"}, {"refresh_token", sent}}, client_id_,
            client_secret_);

        // A refresh that answers without a new refresh token is one the server
        // did not rotate; keeping the old one is then right rather than a bug.
        if (!got.refresh_token.has_value()) got.refresh_token = sent;

        held_ = got;
        expires_at_ = detail::now_seconds() + (held_.expires_in > 60 ? held_.expires_in - 60 : 0);
        if (keep_) keep_(held_);
        return held_.access_token;
    }

    void forget() override {
        // The access token, not the refresh one: forgetting is what happens
        // after a 401, and the refresh is the only way back.
        std::lock_guard<std::mutex> holding(lock_);
        expires_at_ = 0;
    }

    std::vector<std::string> scopes() const override { return held_.scopes(); }

    /// What is held, for a caller that stores it themselves.
    tokens held() {
        std::lock_guard<std::mutex> holding(lock_);
        return held_;
    }

 private:
    std::string client_id_;
    std::optional<std::string> client_secret_;
    std::shared_ptr<http_transport> http_;
    keeper keep_;
    endpoints where_;
    std::mutex lock_;
    tokens held_;
    std::int64_t expires_at_ = 0;
};

/* ------------------------- getting a user's token -------------------------- */

/// A verifier and the challenge that goes with it, both from the same bytes.
struct pkce_pair {
    std::string verifier;
    std::string challenge;
};

/// A fresh PKCE pair.
///
/// **S256 and never `plain`.** The api requires it of every client, confidential
/// ones included, and offers only `S256` in its discovery document — a code that
/// leaks from a log, a referer or a browser's history is then worth nothing
/// without the verifier, which never leaves the client that made it.
inline pkce_pair pkce() {
    // `random_device` and not a seeded engine: this is a credential, and a
    // `mt19937` seeded from the clock is one an attacker who knows roughly when
    // the flow started can walk.
    std::random_device entropy;
    std::string bytes;
    bytes.reserve(32);
    for (int i = 0; i < 32; ++i) {
        bytes.push_back(static_cast<char>(entropy() & 0xff));
    }

    const auto verifier = detail::base64url(bytes);

    detail::sha256 hash;
    hash.update(verifier);
    const auto digest = hash.finish();
    const std::string raw(reinterpret_cast<const char*>(digest.data()), digest.size());

    return pkce_pair{verifier, detail::base64url(raw)};
}

/// Where to send somebody, and the `state` to compare on the way back.
struct authorization {
    std::string url;
    std::string state;
};

/// The state is returned rather than only taken, because a callback with nothing
/// to compare against is a callback anybody can forge — so it is generated when
/// it is not given, and there is no way to end up without one.
inline authorization authorize_url(const std::string& client_id, const std::string& redirect_uri,
                                   const std::vector<std::string>& scopes,
                                   const std::string& challenge, std::string state = {},
                                   const endpoints& where = {}) {
    if (state.empty()) {
        std::random_device entropy;
        std::string bytes;
        for (int i = 0; i < 18; ++i) bytes.push_back(static_cast<char>(entropy() & 0xff));
        state = detail::base64url(bytes);
    }

    std::string scope;
    for (std::size_t i = 0; i < scopes.size(); ++i) {
        if (i > 0) scope += " ";
        scope += scopes[i];
    }

    std::string url = where.authorize;
    url += "?response_type=code";
    url += "&client_id=" + detail::urlencode(client_id);
    url += "&redirect_uri=" + detail::urlencode(redirect_uri);
    url += "&scope=" + detail::urlencode(scope);
    url += "&code_challenge=" + detail::urlencode(challenge);
    url += "&code_challenge_method=S256";
    url += "&state=" + detail::urlencode(state);
    return authorization{url, state};
}

/// The code from the callback, for a token set.
inline tokens exchange_code(http_transport& http, const std::string& client_id,
                            const std::optional<std::string>& client_secret,
                            const std::string& code, const std::string& redirect_uri,
                            const std::string& verifier, const endpoints& where = {}) {
    return detail::exchange(http, where.token,
                            {{"grant_type", "authorization_code"},
                             {"code", code},
                             {"redirect_uri", redirect_uri},
                             {"code_verifier", verifier}},
                            client_id, client_secret);
}

/// What a device shows on its screen while it waits.
struct device_start {
    std::string device_code;
    /// the eight characters to put on the screen
    std::string user_code;
    std::string verification_uri;
    /// the same address with the code in it, for a QR
    std::string verification_uri_complete;
    std::int64_t expires_in = 600;
    /// the floor, in seconds, the server asked to be polled at
    std::int64_t interval = 5;
};

inline void from_json(const nlohmann::json& raw, device_start& out) {
    out.device_code = raw.at("device_code").get<std::string>();
    out.user_code = raw.at("user_code").get<std::string>();
    out.verification_uri = raw.at("verification_uri").get<std::string>();
    out.verification_uri_complete =
        raw.value("verification_uri_complete", out.verification_uri);
    out.expires_in = raw.value("expires_in", std::int64_t{600});
    out.interval = raw.value("interval", std::int64_t{5});
}

/// Ask for a code to show on something with no browser.
inline device_start start_device(http_transport& http, const std::string& client_id,
                                 const std::optional<std::string>& client_secret,
                                 const std::vector<std::string>& scopes,
                                 const endpoints& where = {}) {
    std::string scope;
    for (std::size_t i = 0; i < scopes.size(); ++i) {
        if (i > 0) scope += " ";
        scope += scopes[i];
    }

    http_request request;
    request.method = "POST";
    request.url = where.device;
    request.headers.emplace_back("Accept", "application/json");
    request.headers.emplace_back("Content-Type", "application/x-www-form-urlencoded");
    std::string body = "scope=" + detail::urlencode(scope);
    if (client_secret.has_value()) {
        request.headers.emplace_back(
            "Authorization", "Basic " + detail::base64(client_id + ":" + *client_secret));
    } else {
        body += "&client_id=" + detail::urlencode(client_id);
    }
    request.body = body;

    const auto response = http.send(request);
    if (response.status < 200 || response.status >= 300) {
        throw oauth_error("HTTP " + std::to_string(response.status), response.body);
    }
    return nlohmann::json::parse(response.body).get<device_start>();
}

/// Wait for the person to say yes, then hand back their tokens.
///
/// The four names the server can answer with are the whole of what a poller
/// needs, and this reads all four: `authorization_pending` means keep going,
/// `slow_down` means keep going and wait longer, `access_denied` means somebody
/// pressed cancel, and `expired_token` means nobody pressed anything. A client
/// that cannot tell the first from the third polls into the expiry after the
/// answer has already arrived.
inline tokens await_device(http_transport& http, const std::string& client_id,
                           const std::optional<std::string>& client_secret,
                           const std::string& device_code, std::int64_t interval = 5,
                           const endpoints& where = {}) {
    auto wait = std::chrono::seconds(interval > 0 ? interval : 1);
    for (;;) {
        std::this_thread::sleep_for(wait);
        try {
            return detail::exchange(
                http, where.token,
                {{"grant_type", "urn:ietf:params:oauth:grant-type:device_code"},
                 {"device_code", device_code}},
                client_id, client_secret);
        } catch (const oauth_error& refused) {
            if (refused.name() == "authorization_pending") continue;
            // The server saying the interval was too short. Five seconds more,
            // as the RFC suggests, rather than doubling — this is a person
            // walking to their phone, not a backoff.
            if (refused.name() == "slow_down") {
                wait += std::chrono::seconds(5);
                continue;
            }
            throw;
        }
    }
}

}  // namespace acyka
