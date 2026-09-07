#pragma once

/// A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
/// profiles, and the lists, shelves and writing of whoever authorised your
/// application.
///
/// ```cpp
/// #include <acyka/acyka.hpp>
///
/// // an application acting for itself: the catalogue, and public profiles
/// auto acyka = acyka::client::app("acy_…", "…");
///
/// acyka::ListTitlesRequest asking;
/// asking.q = "frieren";
/// asking.limit = 5;
/// for (const auto& title : acyka.catalogue.list_titles(asking)) {
///     std::cout << title.id << ' ' << title.title << '\n';
/// }
/// ```
///
/// Everything under a namespace is generated from `openapi.json`, which the
/// server writes from annotations on its own handlers. Everything else — the
/// four OAuth flows, the token that renews itself, the backoff that reads the
/// server's own numbers, the paginators, one exception per refusal, and the
/// webhook check — is written by hand.
///
/// Full documentation, with a playground: <https://dev.acyka.cc>
///
/// ## Header-only, and the transport is a seam
///
/// One include and a `FetchContent` block is the whole integration. libcurl is
/// what ships, behind `http_transport`, because a C++ project has already
/// chosen its HTTP client and a library that insists on a second one either
/// will not link or drags a duplicate TLS stack into the binary. Define
/// `ACYKA_NO_CURL` to leave it out and pass your own.

#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "acyka/auth.hpp"
#include "acyka/core.hpp"
#include "acyka/errors.hpp"
#include "acyka/models.hpp"
#include "acyka/namespaces.hpp"
#include "acyka/operations.hpp"
#include "acyka/webhooks.hpp"

#ifndef ACYKA_NO_CURL
#include "acyka/transport/curl.hpp"
#endif

namespace acyka {

/// The client.
class client : public namespaces {
 public:
    client(std::shared_ptr<auth> holder, std::shared_ptr<http_transport> transport,
           options settings = {})
        : namespaces(std::make_shared<core>(std::move(holder), std::move(transport),
                                            std::move(settings))),
          core_(nullptr) {
        // `namespaces` holds the one that matters; this keeps a handle so
        // `pace()` can be asked without reaching through a namespace.
        core_ = shared_core();
    }

    /// What the last answer said about this client's minute.
    const pace& last_pace() const { return core_->last_pace(); }

    /// The transport, for a caller that wants to reach something not yet generated.
    const std::shared_ptr<core>& transport() const { return core_; }

#ifndef ACYKA_NO_CURL
    /// An application acting for itself — a bot, a cron, anything with no person
    /// in front of it. Mints on demand and stores nothing.
    ///
    /// Only `catalog:read` and `people:read` can be held this way: everything
    /// else on this api is about somebody, and a `client_credentials` token has
    /// nobody to act for.
    static client app(std::string client_id, std::string client_secret,
                      std::vector<std::string> scopes = {"catalog:read"}, options settings = {}) {
        auto transport = std::make_shared<curl_transport>(settings.timeout);
        auto holder = std::make_shared<app_only>(std::move(client_id), std::move(client_secret),
                                                 transport, std::move(scopes));
        return client(std::move(holder), std::move(transport), std::move(settings));
    }

    /// A token that acts for a person, kept alive by its refresh token.
    ///
    /// Give it a `keeper` and store what it hands you: **refresh tokens
    /// rotate**, and presenting a retired one is what the server reads as theft
    /// — it kills the whole chain and signs the person out.
    static client user(std::string client_id, tokens held,
                       std::optional<std::string> client_secret = std::nullopt, keeper keep = {},
                       options settings = {}) {
        auto transport = std::make_shared<curl_transport>(settings.timeout);
        auto holder = std::make_shared<user_token>(std::move(client_id), std::move(held), transport,
                                                   std::move(client_secret), std::move(keep));
        return client(std::move(holder), std::move(transport), std::move(settings));
    }

    /// A token somebody else obtained. No refresh.
    static client token(std::string access_token, options settings = {}) {
        auto transport = std::make_shared<curl_transport>(settings.timeout);
        auto holder = std::make_shared<bearer_token>(std::move(access_token));
        return client(std::move(holder), std::move(transport), std::move(settings));
    }
#endif

 private:
    std::shared_ptr<core> core_;
};

}  // namespace acyka
