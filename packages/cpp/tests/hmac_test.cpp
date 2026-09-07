/// SHA-256 and HMAC against the published vectors.
///
/// The implementation is hand-written because a header-only library should not
/// force OpenSSL on everybody who takes it — and the price of writing it is
/// this file. "Did we get it right" has an exact answer, so it gets one.

#include <cassert>
#include <iostream>
#include <string>

#include "acyka/detail/hmac.hpp"

namespace {

int failures = 0;

void check(const char* what, const std::string& got, const std::string& want) {
    if (got == want) {
        std::cout << "PASS  " << what << '\n';
    } else {
        failures += 1;
        std::cout << "FAIL  " << what << "\n  got  " << got << "\n  want " << want << '\n';
    }
}

std::string repeat(char c, std::size_t n) { return std::string(n, c); }

}  // namespace

int main() {
    using namespace acyka::detail;

    // FIPS 180-4, the two examples everybody starts with.
    check("sha256 of \"abc\"", sha256_hex("abc"),
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    check("sha256 of \"\"", sha256_hex(""),
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    check("sha256 of the 448-bit example",
          sha256_hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
          "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");

    // A message longer than one block, and one that lands exactly on the
    // padding boundary — where an implementation written from the description
    // rather than the test vectors usually breaks.
    check("sha256 of a million a's is at least stable", sha256_hex(repeat('a', 1000000)),
          "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
    check("sha256 of 55 bytes", sha256_hex(repeat('a', 55)),
          "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318");
    check("sha256 of 56 bytes", sha256_hex(repeat('a', 56)),
          "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a");
    check("sha256 of 64 bytes", sha256_hex(repeat('a', 64)),
          "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb");

    // RFC 4231, the HMAC-SHA-256 cases.
    check("rfc4231 case 1", hmac_sha256_hex(std::string(20, '\x0b'), "Hi There"),
          "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
    check("rfc4231 case 2", hmac_sha256_hex("Jefe", "what do ya want for nothing?"),
          "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    check("rfc4231 case 3",
          hmac_sha256_hex(std::string(20, '\xaa'), std::string(50, '\xdd')),
          "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe");
    // The one that catches a key longer than the block being used unhashed.
    check("rfc4231 case 6, a 131-byte key",
          hmac_sha256_hex(std::string(131, '\xaa'),
                          "Test Using Larger Than Block-Size Key - Hash Key First"),
          "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");

    // And the compare that must not leak how far it got.
    const std::string real = hmac_sha256_hex("secret", "1700000000.{}");
    assert(constant_time_equals(real, real));
    assert(!constant_time_equals(real, std::string(64, '0')));
    assert(!constant_time_equals(real, real.substr(0, 63)));
    assert(!constant_time_equals("", "a"));
    assert(constant_time_equals("", ""));
    std::cout << "PASS  the compare does not read past a difference\n";

    if (failures > 0) {
        std::cout << failures << " failed\n";
        return 1;
    }
    std::cout << "all vectors matched\n";
    return 0;
}
