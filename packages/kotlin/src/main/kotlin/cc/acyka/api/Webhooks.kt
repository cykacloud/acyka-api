package cc.acyka.api

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Checking that a delivery came from us.
 *
 * Thirty lines, every one of which is a line somebody gets wrong when they
 * write it themselves — which is why it is in the library rather than in the
 * documentation.
 *
 * The three that matter:
 *
 * - **the raw body, not a parsed one.** The signature covers the bytes that
 *   were sent. Parsing and re-serialising gives a different string the moment
 *   key order or number formatting differs, and the check then fails for good
 *   reasons that look like bad ones.
 * - **a constant-time compare.** `==` on strings returns as soon as two
 *   characters differ, and how long that took measures how much of the
 *   signature was right — a hundred requests per byte, and a forgeable
 *   signature at the end of it.
 * - **the timestamp.** The signed string is `<t>.<body>`, so a captured
 *   delivery signs valid for ever unless somebody checks how old `t` is.
 */
public object Webhooks {

    /** A delivery that is not ours, or not this minute's. */
    public class BadSignature(why: String) :
        Exception("the webhook signature did not check out: $why")

    /** One thing that happened, as it arrives. */
    public data class Delivery(
        /** which kind — `list.saved`, `episode.aired`, and five more */
        val event: String,
        /** the row that moved, in this door's snake_case */
        val data: JsonElement?,
    )

    /**
     * The delivery, or a [BadSignature].
     *
     * ```kotlin
     * val event = Webhooks.verify(
     *     body = call.receiveText(),                       // raw, before parsing
     *     signature = call.request.header("X-Acyka-Signature"),
     *     secret = System.getenv("ACYKA_WEBHOOK_SECRET"),
     * )
     * ```
     */
    @JvmStatic
    @JvmOverloads
    public fun verify(
        body: ByteArray,
        signature: String?,
        secret: String,
        tolerance: Long = 300,
        now: Long = System.currentTimeMillis() / 1000,
    ): Delivery {
        if (signature.isNullOrEmpty()) throw BadSignature("there was no signature header")

        var at: Long? = null
        var said: String? = null
        for (piece in signature.split(',')) {
            val key = piece.substringBefore('=', "").trim()
            val value = piece.substringAfter('=', "").trim()
            when (key) {
                "t" -> at = value.toLongOrNull()
                "v1" -> said = value.ifEmpty { null }
            }
        }
        val seconds = at ?: throw BadSignature("the header was not `t=…,v1=…`")
        val presented = said ?: throw BadSignature("the header was not `t=…,v1=…`")

        // Both directions. A delivery from the future is a clock that is wrong,
        // and accepting it would mean accepting one whose `t` an attacker chose.
        val age = kotlin.math.abs(now - seconds)
        if (age > tolerance) throw BadSignature("it is ${age}s old, and the tolerance is ${tolerance}s")

        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
        mac.update("$seconds.".toByteArray())
        mac.update(body)
        val expected = mac.doFinal().joinToString("") { "%02x".format(it) }

        if (!constantTimeEquals(expected, presented)) throw BadSignature("it does not match the body")

        val parsed = Json.parseToJsonElement(body.decodeToString())
        val obj = parsed as? JsonObject ?: throw BadSignature("the body was not an object")
        return Delivery(
            event = obj["event"]?.jsonPrimitive?.content ?: "",
            data = obj["data"],
        )
    }

    /** The same, for a caller holding the body as text. */
    @JvmStatic
    @JvmOverloads
    public fun verify(
        body: String,
        signature: String?,
        secret: String,
        tolerance: Long = 300,
        now: Long = System.currentTimeMillis() / 1000,
    ): Delivery = verify(body.toByteArray(), signature, secret, tolerance, now)

    /** Two hex strings, compared without saying how far they matched. */
    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var differs = 0
        for (i in a.indices) differs = differs or (a[i].code xor b[i].code)
        return differs == 0
    }
}
