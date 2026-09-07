#pragma once

/// libcurl behind the transport seam.
///
/// The one this library ships, and the reason it is behind a seam rather than
/// built in: a C++ project has already chosen its HTTP client, and a library
/// that insists on a second one either will not link or drags a duplicate TLS
/// stack into the binary. Include this header only if libcurl is what you want;
/// `ACYKA_NO_CURL` leaves it out of the umbrella header entirely.

#include <chrono>
#include <cstddef>
#include <map>
#include <string>

#include <curl/curl.h>

#include "acyka/core.hpp"

namespace acyka {

class curl_transport : public http_transport {
 public:
    explicit curl_transport(std::chrono::milliseconds timeout = std::chrono::milliseconds{30000})
        : timeout_(timeout) {
        // Once per process, not once per handle: `curl_global_init` is not
        // thread-safe, and calling it per request is the classic way to get a
        // crash under load rather than a slow client.
        static const bool once = [] {
            curl_global_init(CURL_GLOBAL_DEFAULT);
            return true;
        }();
        (void)once;
    }

    http_response send(const http_request& request) override {
        CURL* handle = curl_easy_init();
        if (handle == nullptr) throw unreachable(request.url, "curl_easy_init failed");

        http_response out;
        curl_slist* headers = nullptr;
        for (const auto& one : request.headers) {
            headers = curl_slist_append(headers, (one.first + ": " + one.second).c_str());
        }

        curl_easy_setopt(handle, CURLOPT_URL, request.url.c_str());
        curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, request.method.c_str());
        curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(handle, CURLOPT_TIMEOUT_MS, static_cast<long>(timeout_.count()));
        // No redirect following: every address here is one this client built, so
        // a redirect is a proxy doing something unexpected rather than a hop to
        // take — and following one would resend the bearer token to wherever it
        // pointed.
        curl_easy_setopt(handle, CURLOPT_FOLLOWLOCATION, 0L);
        // curl uses signals for DNS timeouts, which is not safe in a threaded
        // program — and any program taking this library may be one.
        curl_easy_setopt(handle, CURLOPT_NOSIGNAL, 1L);
        curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, &write_body);
        curl_easy_setopt(handle, CURLOPT_WRITEDATA, &out.body);
        curl_easy_setopt(handle, CURLOPT_HEADERFUNCTION, &write_header);
        curl_easy_setopt(handle, CURLOPT_HEADERDATA, &out.headers);

        if (!request.body.empty()) {
            curl_easy_setopt(handle, CURLOPT_POSTFIELDS, request.body.c_str());
            curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE, static_cast<long>(request.body.size()));
        }

        const auto result = curl_easy_perform(handle);
        if (result == CURLE_OK) {
            curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &out.status);
        }

        curl_slist_free_all(headers);
        const std::string why = result == CURLE_OK ? std::string{} : curl_easy_strerror(result);
        curl_easy_cleanup(handle);

        if (result != CURLE_OK) throw unreachable(request.url, why);
        return out;
    }

 private:
    static std::size_t write_body(char* bytes, std::size_t size, std::size_t count, void* into) {
        static_cast<std::string*>(into)->append(bytes, size * count);
        return size * count;
    }

    static std::size_t write_header(char* bytes, std::size_t size, std::size_t count, void* into) {
        const std::size_t length = size * count;
        const std::string line(bytes, length);
        const auto colon = line.find(':');
        if (colon != std::string::npos) {
            auto name = detail::lowered(line.substr(0, colon));
            auto value = line.substr(colon + 1);
            // A header value arrives with a leading space and a trailing CRLF.
            const auto from = value.find_first_not_of(" \t");
            const auto to = value.find_last_not_of(" \t\r\n");
            value = from == std::string::npos ? std::string{} : value.substr(from, to - from + 1);
            static_cast<std::map<std::string, std::string>*>(into)->insert_or_assign(
                std::move(name), std::move(value));
        }
        return length;
    }

    std::chrono::milliseconds timeout_;
};

}  // namespace acyka
