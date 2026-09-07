package cc.acyka.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json as KotlinJson
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * How this client reads and writes JSON.
 *
 * `explicitNulls = false` is the one that matters: an optional a caller did not
 * set must not be sent as `"field": null`, because on this api absent and null
 * are different answers and a `PATCH` reads the difference. `ignoreUnknownKeys`
 * is the other half — a field the server adds must not break a client that was
 * built before it.
 */
public val Json: KotlinJson = KotlinJson {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = false
}

/** A path segment, escaped. */
internal fun urlencode(value: String): String =
    java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20")

public data class Options(
    val baseUrl: String = "https://api.acyka.cc",
    val timeoutMillis: Long = 30_000,
    /** how many times a retryable answer is retried; 0 turns it off entirely */
    val retries: Int = 3,
    /**
     * The longest this will ever sleep on a 429 before giving up, in millis.
     *
     * Without a ceiling, a client that has spent its minute and asked for a
     * hundred pages suspends for the whole window inside one call — which looks
     * exactly like a hang to whoever is waiting on it.
     */
    val maxWaitMillis: Long = 65_000,
    /** told after every answer, so a caller can watch its own budget */
    val onPace: ((Pace) -> Unit)? = null,
    val userAgent: String = "acyka-api-kt/1",
)

/**
 * One request, and everything that happens around it.
 *
 * The generated methods are thin on purpose — they name a path, a query and a
 * body, and hand all four of the interesting decisions here:
 *
 * - **waiting exactly as long as the server asked.** Every answer carries
 *   `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and a 429 carries
 *   `Retry-After`.
 * - **retrying only what is safe to retry.** A 429, a 5xx, and a socket that
 *   never answered — never a request that was refused on its merits.
 * - **refreshing once on a 401.**
 * - **turning a body into the right exception.**
 */
public class Core internal constructor(
    private val auth: Auth,
    private val options: Options,
    private val http: HttpClient,
) {
    /** What the last answer said about this client's minute. */
    @Volatile
    public var pace: Pace = Pace()
        private set

    public suspend inline fun <reified T> call(
        method: String,
        path: String,
        query: List<Pair<String, Any?>> = emptyList(),
        body: Any? = null,
    ): T {
        val text = text(method, path, query, body)
        // A 204 answers nothing, and the generated method's return type is
        // `Unit` — decoding an empty body into it would fail for no reason.
        if (text.isEmpty()) return Unit as T
        return try {
            Json.decodeFromString<T>(text)
        } catch (cause: Throwable) {
            throw Malformed("$method $path", cause)
        }
    }

    @PublishedApi
    internal suspend fun text(
        method: String,
        path: String,
        query: List<Pair<String, Any?>>,
        body: Any?,
    ): String {
        val where = "$method $path"
        var refreshed = false
        var attempt = 0

        while (true) {
            val response: HttpResponse = try {
                http.request("${options.baseUrl}$path") {
                    this.method = HttpMethod.parse(method)
                    header(HttpHeaders.Accept, "application/json")
                    header(HttpHeaders.UserAgent, options.userAgent)
                    header(HttpHeaders.Authorization, "Bearer ${auth.fresh()}")
                    // `null` means "not asked for" and is left out; `0` and
                    // `false` are answers and are sent.
                    query.forEach { (key, value) -> if (value != null) parameter(key, value) }
                    if (body != null) {
                        contentType(ContentType.Application.Json)
                        setBody(body)
                    }
                }
            } catch (cause: Throwable) {
                if (cause is AcykaException) throw cause
                // Nothing answered. Worth one more go for the same reason a 5xx
                // is — a dropped socket during a deploy is a gap, not a refusal.
                if (attempt < options.retries) {
                    delay(backoff(attempt))
                    attempt += 1
                    continue
                }
                throw Unreachable(where, cause)
            }

            val status = response.status.value
            val seen = Pace(
                limit = response.headers["x-ratelimit-limit"]?.toLongOrNull(),
                remaining = response.headers["x-ratelimit-remaining"]?.toLongOrNull(),
                reset = response.headers["x-ratelimit-reset"]?.toLongOrNull(),
            )
            pace = seen
            options.onPace?.invoke(seen)

            val said = response.bodyAsText()

            if (status in 200..299) return if (status == 204) "" else said

            // A proxy's own 502 is html, and a parse error there would tell the
            // caller nothing about what happened.
            val detail = runCatching { Json.parseToJsonElement(said) as? JsonObject }.getOrNull()
                ?: JsonObject(emptyMap())
            val code = runCatching { detail["message"]?.jsonPrimitive?.content }.getOrNull()
                ?: "HTTP $status"

            if (status == 401 && !refreshed) {
                refreshed = true
                auth.forget()
                // A second 401 after this is the server saying the credential is
                // wrong rather than stale, and refreshing again would produce
                // the same one.
                val again = runCatching { auth.fresh() }
                if (again.isSuccess) continue
                throw Unauthorized(code, detail, where)
            }

            val retryAfter = response.headers[HttpHeaders.RetryAfter]?.toLongOrNull() ?: 0
            val worthRetrying = status == 429 || status >= 500
            if (worthRetrying && attempt < options.retries) {
                val wait = if (status == 429) {
                    // The server's own number rather than a guess: too little
                    // and it is refused again, too much and the client sleeps
                    // for nothing.
                    maxOf(retryAfter, seen.reset ?: 1L, 1L) * 1000
                } else {
                    backoff(attempt)
                }
                if (wait <= options.maxWaitMillis) {
                    delay(wait)
                    attempt += 1
                    continue
                }
            }

            throw refusal(status, code, detail, where, maxOf(retryAfter, seen.reset ?: 0L), seen)
        }
    }

    private fun backoff(attempt: Int): Long = minOf(250L shl minOf(attempt, 4), 4000L)

    internal companion object {
        fun http(options: Options): HttpClient = HttpClient {
            expectSuccess = false
            install(ContentNegotiation) { json(Json) }
            install(HttpTimeout) {
                requestTimeoutMillis = options.timeoutMillis
            }
        }
    }
}
