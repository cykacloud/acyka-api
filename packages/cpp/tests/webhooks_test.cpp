/// Verification is the one piece of this library that is a security boundary
/// rather than a convenience, so the tests are the attacks.

#define ACYKA_NO_CURL
#include <iostream>
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

const char* secret = "acyw_0123456789abcdef";
const char* body = R"({"event":"list.saved","data":{"shikimori_id":21}})";
constexpr std::int64_t now = 1700000000;

std::string sign(const std::string& over, std::int64_t at, const char* with = secret) {
    return "t=" + std::to_string(at) + ",v1=" +
           acyka::detail::hmac_sha256_hex(with, std::to_string(at) + "." + over);
}

/// Whether a call throws a `bad_signature`, and what it said if so.
bool refused(const std::string& over, const std::string& header, std::string* why = nullptr,
             std::int64_t tolerance = 300) {
    try {
        acyka::verify(over, header, secret, tolerance, now);
        return false;
    } catch (const acyka::bad_signature& bad) {
        if (why != nullptr) *why = bad.what();
        return true;
    }
}

}  // namespace

int main() {
    {
        const auto event = acyka::verify(body, sign(body, now), secret, 300, now);
        check("a delivery that is ours comes back parsed",
              event.event == "list.saved" && event.data["shikimori_id"] == 21);
    }

    check("a body edited after signing",
          refused(R"({"event":"list.saved","data":{"shikimori_id":22}})", sign(body, now)));

    check("a signature made with another secret",
          refused(body, sign(body, now, "acyw_someone_elses")));

    {
        // The whole reason the timestamp is inside the signed string: signing
        // the body alone gives a signature that never stops being valid.
        std::string why;
        const bool threw = refused(body, sign(body, now - 3600), &why);
        check("a replay of a real delivery from an hour ago",
              threw && why.find("3600s old") != std::string::npos, why);
    }

    check("a delivery from the future, which is a clock somebody chose",
          refused(body, sign(body, now + 3600)));

    check("no header at all", refused(body, ""));

    for (const char* nonsense : {"deadbeef", "v1=deadbeef", "t=notanumber,v1=x"}) {
        check("a header in some other shape", refused(body, nonsense), nonsense);
    }

    {
        // The constant-time compare's own case: right length, every byte wrong.
        std::string why;
        const bool threw =
            refused(body, "t=" + std::to_string(now) + ",v1=" + std::string(64, '0'), &why);
        check("a signature of the right length that is wrong",
              threw && why.find("does not match") != std::string::npos, why);
    }

    {
        check("290 seconds is inside the default tolerance", !refused(body, sign(body, now - 290)));
        check("310 is not", refused(body, sign(body, now - 310)));
        // a caller who knows their queue is slow can say so
        std::string why;
        check("and the tolerance moves", !refused(body, sign(body, now - 310), &why, 600));
    }

    if (failures > 0) {
        std::cout << failures << " failed\n";
        return 1;
    }
    std::cout << "all good\n";
    return 0;
}
