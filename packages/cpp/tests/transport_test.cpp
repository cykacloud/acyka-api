/// The half of the client a document cannot generate.
///
/// A fake `http_transport` rather than a socket, which is the whole reason the
/// transport is a seam: what is being tested is what this code does with
/// headers, statuses and a body, and none of that needs a network.
///
/// No test framework, and deliberately — a header-only library should not make
/// its contributors install one to run three files, and `check` below is nine
/// lines.

#define ACYKA_NO_CURL
#include <chrono>
#include <deque>
#include <iostream>
#include <memory>
#include <string>

#include <acyka/acyka.hpp>

namespace {

int failures = 0;

void check(const char* what, bool passed, const std::string& detail = {}) {
    if (passed) {
        std::cout << "PASS  " << what << '\n';
    } else {
        failures += 1;
        std::cout << "FAIL  " << what << (detail.empty() ? "" : "  — " + detail) << '\n';
    }
}

/// A transport that answers a scripted list and remembers what it was asked.
class scripted : public acyka::http_transport {
 public:
    std::deque<acyka::http_response> answers;
    std::vector<acyka::http_request> asked;

    acyka::http_response send(const acyka::http_request& request) override {
        asked.push_back(request);
        if (answers.empty()) throw std::runtime_error("the script ran out of answers");
        auto next = answers.front();
        answers.pop_front();
        return next;
    }
};

acyka::http_response said(long status, std::string body,
                          std::map<std::string, std::string> headers = {}) {
    acyka::http_response out;
    out.status = status;
    out.body = std::move(body);
    out.headers = std::move(headers);
    return out;
}

/// An auth that hands out a new token each time it is forgotten.
class renewing : public acyka::auth {
 public:
    int refreshes = 0;

    std::string fresh() override { return "acya_" + std::to_string(n_); }

    void forget() override {
        n_ += 1;
        refreshes += 1;
    }

 private:
    int n_ = 0;
};

struct built {
    std::shared_ptr<scripted> http;
    std::shared_ptr<acyka::auth> holder;
    acyka::client acyka;
};

built client(std::deque<acyka::http_response> answers, int retries = 3,
             std::shared_ptr<acyka::auth> holder = nullptr,
             std::chrono::milliseconds max_wait = std::chrono::milliseconds{65000}) {
    auto http = std::make_shared<scripted>();
    http->answers = std::move(answers);
    if (!holder) holder = std::make_shared<acyka::bearer_token>("acya_test");

    acyka::options settings;
    settings.retries = retries;
    settings.max_wait = max_wait;
    return built{http, holder, acyka::client(holder, http, settings)};
}

const char* page_body =
    R"({"items":[{"id":52991,"title":"Sousou no Frieren","kind":"tv","episodes":28,"score":9.1}],"total":1})";

}  // namespace

int main() {
    // --- one request ---------------------------------------------------------
    {
        auto made = client({said(200, page_body)});
        acyka::ListTitlesRequest asking;
        asking.q = "frieren";
        const auto found = made.acyka.catalogue.list_titles(asking);

        check("a read parses the shape", found.items.size() == 1 && *found.total == 1);
        check("and the fields it was sent", found.items[0].title == "Sousou no Frieren");
        // A missing optional stays empty rather than becoming a zero: absent and
        // zero are different answers, and this api's own rules say a client must
        // not collapse them.
        check("a missing optional stays absent", !found.items[0].title_orig.has_value());

        const auto& request = made.http->asked[0];
        bool authorised = false;
        for (const auto& one : request.headers) {
            if (one.first == "Authorization" && one.second == "Bearer acya_test") authorised = true;
        }
        check("the token is sent", authorised);
        check("and the query", request.url.find("q=frieren") != std::string::npos, request.url);
    }

    // --- a parameter nobody asked for ---------------------------------------
    {
        auto made = client({said(200, page_body)});
        acyka::ListTitlesRequest asking;
        asking.offset = 0;
        made.acyka.catalogue.list_titles(asking);

        const auto& url = made.http->asked[0].url;
        // `offset=0` is an answer and is sent; `limit`, never given, is absent —
        // a client that dropped falsy values would make `offset=0` unsendable.
        check("offset=0 is sent", url.find("offset=0") != std::string::npos, url);
        check("and limit is not", url.find("limit") == std::string::npos, url);
    }

    // --- a 204 ---------------------------------------------------------------
    {
        auto made = client({said(204, "")});
        acyka::RemoveListEntryRequest asking;
        asking.shikimori_id = 21;
        made.acyka.library.remove_list_entry(asking);
        check("a 204 answers nothing rather than a parse error", true);
    }

    // --- a refusal becomes a type -------------------------------------------
    {
        auto made = client({said(403, R"({"message":"errors.oauthInsufficientScope","scope":"lists:read"})")}, 0);
        try {
            made.acyka.library.list_my_list({});
            check("a 403 is thrown", false);
        } catch (const acyka::forbidden& refused) {
            check("a 403 is a forbidden", refused.code() == "errors.oauthInsufficientScope");
            // The name alone would leave a caller unable to say *which* scope,
            // which is the one thing they need in order to ask for it.
            check("and it names the scope", refused.scope() == std::optional<std::string>("lists:read"));
            check("and is not worth retrying", !refused.retryable());
        }
    }

    // --- a body that is not json --------------------------------------------
    {
        // A proxy's own 502 is html, and a parse error there would tell the
        // caller nothing about what happened.
        auto made = client({said(502, "<html>502</html>")}, 0);
        try {
            made.acyka.catalogue.list_genres();
            check("a 502 is thrown", false);
        } catch (const acyka::server_error& refused) {
            check("html on a 502 is still a server_error", refused.status() == 502);
            check("and is worth retrying", refused.retryable());
        }
    }

    // --- the pace the server sets -------------------------------------------
    {
        auto made = client({said(200, R"({"items":[]})",
                                 {{"x-ratelimit-limit", "60"},
                                  {"x-ratelimit-remaining", "58"},
                                  {"x-ratelimit-reset", "31"}})});
        made.acyka.catalogue.list_genres();
        const auto& seen = made.acyka.last_pace();
        check("the rate-limit headers are read",
              seen.limit == 60 && seen.remaining == 58 && seen.reset == 31);
    }

    // --- a 429 --------------------------------------------------------------
    {
        auto made = client({said(429, R"({"message":"common.tooOften"})", {{"retry-after", "1"}}),
                            said(200, R"({"items":["Drama"]})")});
        const auto started = std::chrono::steady_clock::now();
        const auto genres = made.acyka.catalogue.list_genres();
        const auto took = std::chrono::steady_clock::now() - started;

        check("a 429 is retried after the wait the server asked for",
              genres.items.size() == 1 && made.http->asked.size() == 2);
        check("and the wait was the server's number",
              took >= std::chrono::milliseconds(900) && took < std::chrono::seconds(3));
    }

    // --- a wait past the ceiling --------------------------------------------
    {
        // Sleeping a whole window inside one call looks exactly like a hang to
        // whoever is waiting on it.
        auto made = client({said(429, R"({"message":"common.tooOften"})", {{"retry-after", "60"}})},
                           3, nullptr, std::chrono::milliseconds{1000});
        try {
            made.acyka.catalogue.list_genres();
            check("a long wait is raised", false);
        } catch (const acyka::rate_limited& refused) {
            check("a wait past the ceiling is raised rather than slept through",
                  refused.retry_after() == 60 && made.http->asked.size() == 1);
        }
    }

    // --- a refusal on its merits --------------------------------------------
    {
        auto made = client({said(400, R"({"message":"errors.badData"})")});
        acyka::SaveListEntryRequest asking;
        asking.shikimori_id = 21;
        try {
            made.acyka.library.save_list_entry(asking);
            check("a 400 is thrown", false);
        } catch (const acyka::bad_request&) {
            check("a refusal on its merits is not retried", made.http->asked.size() == 1);
        }
    }

    // --- a token that expired mid-flight ------------------------------------
    {
        auto holder = std::make_shared<renewing>();
        auto made = client({said(401, R"({"message":"errors.unauthorized"})"), said(200, R"({"id":"1"})")},
                           0, holder);
        made.acyka.account.get_me();

        check("a 401 is refreshed once and retried once",
              holder->refreshes == 1 && made.http->asked.size() == 2);

        std::vector<std::string> sent;
        for (const auto& request : made.http->asked) {
            for (const auto& one : request.headers) {
                if (one.first == "Authorization") sent.push_back(one.second);
            }
        }
        check("and the retry carries the new token",
              sent.size() == 2 && sent[0] == "Bearer acya_0" && sent[1] == "Bearer acya_1");
    }

    // --- and a second 401 ----------------------------------------------------
    {
        // The credential is wrong rather than stale; refreshing produces the
        // same one and the loop would never end.
        auto holder = std::make_shared<renewing>();
        auto made = client({said(401, R"({"message":"errors.unauthorized"})"),
                            said(401, R"({"message":"errors.unauthorized"})")},
                           0, holder);
        try {
            made.acyka.account.get_me();
            check("a second 401 is raised", false);
        } catch (const acyka::unauthorized&) {
            check("a second 401 is raised rather than refreshed again",
                  holder->refreshes == 1 && made.http->asked.size() == 2);
        }
    }

    // --- a body carries only what the caller set ----------------------------
    {
        auto made = client({said(200, R"({"shikimori_id":21,"title":"One Piece","status":"watching","episode":3,"at":"2026-01-01T00:00:00Z"})")});
        acyka::SaveListEntryRequest asking;
        asking.shikimori_id = 21;
        asking.body.title = "One Piece";
        made.acyka.library.save_list_entry(asking);

        // An optional the caller did not set is left out, not sent as `null`:
        // absent and null are different answers on this api, and a `PATCH` reads
        // the difference.
        check("a body carries only what was set", made.http->asked[0].body == R"({"title":"One Piece"})",
              made.http->asked[0].body);
    }

    // --- paging --------------------------------------------------------------
    {
        std::deque<acyka::http_response> pages;
        for (int from : {0, 10, 20}) {
            std::string items;
            for (int id = from + 1; id <= from + 10 && id <= 25; ++id) {
                if (!items.empty()) items += ",";
                items += R"({"id":)" + std::to_string(id) + R"(,"title":"t","kind":"tv","episodes":12})";
            }
            // `total` is a lie on purpose: a loop that counted against it would
            // ask for a page that is not there.
            pages.push_back(said(200, R"({"items":[)" + items + R"(],"total":4000})"));
        }

        auto made = client(std::move(pages), 0);
        acyka::ListTitlesRequest asking;
        asking.limit = 10;
        const auto all = made.acyka.catalogue.list_titles_all(asking);

        check("paging walks every row", all.size() == 25, std::to_string(all.size()));
        // Three pages: ten, ten, five. The fourth is never asked for.
        check("and stops on a short page rather than on total", made.http->asked.size() == 3);
    }

    // --- a socket that never answered ---------------------------------------
    {
        class dead : public acyka::http_transport {
         public:
            int tries = 0;
            acyka::http_response send(const acyka::http_request& request) override {
                tries += 1;
                throw acyka::unreachable(request.url, "connection refused");
            }
        };
        auto http = std::make_shared<dead>();
        acyka::options settings;
        settings.retries = 2;
        acyka::client made(std::make_shared<acyka::bearer_token>("acya_test"), http, settings);
        try {
            made.catalogue.list_genres();
            check("an unreachable api is raised", false);
        } catch (const acyka::unreachable& refused) {
            // A dropped socket during a deploy is a gap, not a refusal, so it is
            // worth trying again — three attempts for two retries.
            check("a socket that never answered is retried and then raised",
                  http->tries == 3 && refused.retryable());
        }
    }

    if (failures > 0) {
        std::cout << failures << " failed\n";
        return 1;
    }
    std::cout << "all good\n";
    return 0;
}
