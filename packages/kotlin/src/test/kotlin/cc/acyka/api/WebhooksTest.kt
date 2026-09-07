package cc.acyka.api

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Verification is the one piece of this library that is a security boundary
 * rather than a convenience, so the tests are the attacks.
 */
class WebhooksTest {

    private val secret = "acyw_0123456789abcdef"
    private val body = """{"event":"list.saved","data":{"shikimori_id":21}}"""
    private val now = 1_700_000_000L

    private fun sign(body: String, at: Long, secret: String = this.secret): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
        mac.update("$at.".toByteArray())
        mac.update(body.toByteArray())
        return "t=$at,v1=" + mac.doFinal().joinToString("") { "%02x".format(it) }
    }

    @Test
    fun `a delivery that is ours comes back parsed`() {
        val event = Webhooks.verify(body, sign(body, now), secret, now = now)
        assertEquals("list.saved", event.event)
        assertEquals(21, event.data!!.jsonObject["shikimori_id"]!!.jsonPrimitive.content.toInt())
    }

    @Test
    fun `a body edited after signing`() {
        val signature = sign(body, now)
        val tampered = """{"event":"list.saved","data":{"shikimori_id":22}}"""
        assertFailsWith<Webhooks.BadSignature> {
            Webhooks.verify(tampered, signature, secret, now = now)
        }
    }

    @Test
    fun `a signature made with another secret`() {
        assertFailsWith<Webhooks.BadSignature> {
            Webhooks.verify(body, sign(body, now, "acyw_someone_elses"), secret, now = now)
        }
    }

    @Test
    fun `a replay of a real delivery from an hour ago`() {
        // The whole reason the timestamp is inside the signed string: signing
        // the body alone gives a signature that never stops being valid.
        val refused = assertFailsWith<Webhooks.BadSignature> {
            Webhooks.verify(body, sign(body, now - 3600), secret, now = now)
        }
        assertContains(refused.message!!, "3600s old")
    }

    @Test
    fun `a delivery from the future which is a clock somebody chose`() {
        assertFailsWith<Webhooks.BadSignature> {
            Webhooks.verify(body, sign(body, now + 3600), secret, now = now)
        }
    }

    @Test
    fun `no header at all`() {
        for (nothing in listOf(null, "")) {
            assertFailsWith<Webhooks.BadSignature> {
                Webhooks.verify(body, nothing, secret, now = now)
            }
        }
    }

    @Test
    fun `a header in some other shape`() {
        for (nonsense in listOf("deadbeef", "v1=deadbeef", "t=notanumber,v1=x")) {
            assertFailsWith<Webhooks.BadSignature>(nonsense) {
                Webhooks.verify(body, nonsense, secret, now = now)
            }
        }
    }

    @Test
    fun `a signature of the right length that is wrong`() {
        // The constant-time compare's own case: right length, every byte wrong.
        val wrong = "t=$now,v1=" + "0".repeat(64)
        val refused = assertFailsWith<Webhooks.BadSignature> {
            Webhooks.verify(body, wrong, secret, now = now)
        }
        assertContains(refused.message!!, "does not match")
    }

    @Test
    fun `the tolerance is five minutes and movable`() {
        Webhooks.verify(body, sign(body, now - 290), secret, now = now)
        val older = sign(body, now - 310)
        assertFailsWith<Webhooks.BadSignature> { Webhooks.verify(body, older, secret, now = now) }
        // a caller who knows their queue is slow can say so
        Webhooks.verify(body, older, secret, tolerance = 600, now = now)
    }
}

/** The two flows that can be tested without a server. */
class AuthTest {
    @Test
    fun `a pkce pair is the challenge of its own verifier`() {
        val pair = pkce()
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest(pair.verifier.toByteArray())
        val expected = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
        assertEquals(expected, pair.challenge)
        // 32 bytes, base64url with no padding
        assertEquals(43, pair.verifier.length)
        assert(!pair.verifier.contains('='))
        assert(!pair.verifier.contains('+'))
        assert(pkce().verifier != pkce().verifier)
    }

    @Test
    fun `an authorize url always carries a state`() {
        val asked = authorizeUrl(
            clientId = "acy_x",
            redirectUri = "https://example.com/cb",
            scopes = listOf("openid", "profile"),
            challenge = "chal",
        )
        // Generated when it was not given, so there is no way to end up with a
        // callback that has nothing to compare against.
        assert(asked.state.isNotEmpty())
        assertContains(asked.url, "state=${java.net.URLEncoder.encode(asked.state, "UTF-8")}")
        assertContains(asked.url, "code_challenge_method=S256")
        assertContains(asked.url, "scope=openid+profile")
    }
}
