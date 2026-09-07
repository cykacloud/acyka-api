package cc.acyka.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * One type per refusal, out of a set the server keeps small on purpose.
 *
 * The api answers `{"message": "errors.oauthInsufficientScope"}` — a **phrase
 * name and never a sentence** — because one screen can be read in five
 * languages and the server does not get to choose which. For a client that is
 * not a limitation but the thing that makes real types possible: a stable,
 * enumerable set of names, instead of matching on prose that changes when
 * somebody rewrites a sentence.
 *
 * Catch the class you can do something about; read [AcykaException.code] for
 * the name when you want to show your own words.
 */
public sealed class AcykaException(
    /** the phrase name, e.g. `errors.notFound` */
    public val code: String,
    public val status: Int,
    /** the whole body, including the extra fields a refusal owes a reason for */
    public val detail: JsonObject,
    /** what was asked, for a log that has to be read six months later */
    public val request: String,
    cause: Throwable? = null,
) : Exception("$code ($status for $request)", cause) {

    /** A named string out of the extra fields, where there is one. */
    public fun field(name: String): String? =
        (detail[name] as? JsonElement)?.let { runCatching { it.jsonPrimitive.content }.getOrNull() }

    /** Whether asking again could plausibly answer differently. */
    public open val retryable: Boolean get() = false
}

/** No token, an expired one, or one whose application was switched off. */
public class Unauthorized(code: String, detail: JsonObject, request: String) :
    AcykaException(code, 401, detail, request)

/**
 * The token is good and does not carry what this endpoint wants.
 *
 * **Refreshing will not help**, which is why this is not [Unauthorized]: the
 * refresh produces the same token with the same scopes and earns the same
 * refusal.
 */
public class Forbidden(code: String, detail: JsonObject, request: String) :
    AcykaException(code, 403, detail, request) {
    /** The word that was missing, where the server named it. */
    public val scope: String? get() = field("scope")
}

public class NotFound(code: String, detail: JsonObject, request: String) :
    AcykaException(code, 404, detail, request)

/** Refused before anything looked at it. */
public class BadRequest(code: String, status: Int, detail: JsonObject, request: String) :
    AcykaException(code, status, detail, request)

/**
 * The minute is spent.
 *
 * [retryAfter] is seconds, from the server's own header. This only reaches a
 * caller when the retries are used up or turned off — otherwise the client
 * waits and tries again by itself.
 */
public class RateLimited(
    code: String,
    detail: JsonObject,
    request: String,
    public val retryAfter: Long,
    public val pace: Pace,
) : AcykaException(code, 429, detail, request) {
    override val retryable: Boolean get() = true
}

public class ServerError(code: String, status: Int, detail: JsonObject, request: String) :
    AcykaException(code, status, detail, request) {
    override val retryable: Boolean get() = true
}

/**
 * A status this client has no name for, which is a server that has grown one —
 * and a client that threw something unhelpful would be worse than one that
 * hands it over.
 */
public class Unexpected(code: String, status: Int, detail: JsonObject, request: String) :
    AcykaException(code, status, detail, request)

/** The request never got an answer: a socket, a timeout, a proxy. */
public class Unreachable(request: String, cause: Throwable) :
    AcykaException("errors.unreachable", 0, JsonObject(emptyMap()), request, cause) {
    override val retryable: Boolean get() = true
}

/**
 * The answer arrived and was not the shape the contract says.
 *
 * Its own type rather than folded into [Unreachable], because the two mean
 * opposite things about what to do next: a socket is worth retrying and a shape
 * that does not parse never will be.
 */
public class Malformed(request: String, cause: Throwable) :
    AcykaException("errors.malformed", 0, JsonObject(emptyMap()), request, cause)

/** The token endpoint refused, as RFC 6749 names it. */
public class OauthException(
    public val error: String,
    public val description: String?,
) : Exception(listOfNotNull(error, description).joinToString(": "))

/** What the server said about the caller's minute. */
public data class Pace(
    val limit: Long? = null,
    val remaining: Long? = null,
    /** seconds until the window turns */
    val reset: Long? = null,
)

/** The shape every refusal on this api takes. */
@Serializable
internal data class RefusalBody(
    @SerialName("message") val message: String = "",
)

internal fun refusal(
    status: Int,
    code: String,
    detail: JsonObject,
    request: String,
    retryAfter: Long,
    pace: Pace,
): AcykaException = when {
    status == 400 || status == 422 -> BadRequest(code, status, detail, request)
    status == 401 -> Unauthorized(code, detail, request)
    status == 403 -> Forbidden(code, detail, request)
    status == 404 -> NotFound(code, detail, request)
    status == 429 -> RateLimited(code, detail, request, retryAfter, pace)
    status >= 500 -> ServerError(code, status, detail, request)
    else -> Unexpected(code, status, detail, request)
}
