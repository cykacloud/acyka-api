package cc.acyka.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.parameters
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json as KotlinJson

/**
 * All four ways to hold a token, and the one thing they have in common.
 *
 * An access token lives an hour. A library that makes its caller notice that is
 * a library whose callers each write the same refresh-and-retry loop, slightly
 * differently — and one of them gets the concurrent case wrong and sends two
 * refreshes for one expiry, which, because refresh tokens here **rotate and a
 * reuse kills the family**, signs their users out. So the loop is written once
 * and [Auth.fresh] is the whole of what the transport knows about auth.
 */
public interface Auth {
    /** A live access token, refreshed or minted if the held one has run out. */
    public suspend fun fresh(): String

    /** Throw away what is held, so the next call mints or refreshes. */
    public suspend fun forget()

    /** What was granted, if it is known yet. */
    public fun scopes(): List<String> = emptyList()
}

/** Where the provider lives. Overridable for a laptop, fixed in practice. */
public data class Endpoints(
    val authorize: String = "https://api.acyka.cc/api/oauth2/authorize",
    val token: String = "https://api.acyka.cc/api/oauth2/token",
    val device: String = "https://api.acyka.cc/api/oauth2/device_authorization",
)

@Serializable
public data class Tokens(
    @SerialName("access_token") val accessToken: String,
    @SerialName("token_type") val tokenType: String = "Bearer",
    @SerialName("expires_in") val expiresIn: Long = 3600,
    @SerialName("scope") val scope: String = "",
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("id_token") val idToken: String? = null,
) {
    public val scopes: List<String> get() = scope.split(' ').filter { it.isNotEmpty() }
}

/**
 * Told whenever a token set is replaced, so a caller can put it somewhere.
 *
 * A refresh token **rotates**: the one handed back is the one to keep, and the
 * one that was sent is dead. Storing the original for ever leaves a credential
 * that stops working — and presenting it again is what the server reads as
 * theft, which kills the whole chain.
 */
public fun interface Keeper {
    public fun kept(tokens: Tokens)
}

@Serializable
private data class OauthRefusal(
    @SerialName("error") val error: String = "",
    @SerialName("error_description") val description: String? = null,
)

private val oauthJson = KotlinJson { ignoreUnknownKeys = true }

/** A token set with the moment it stops being usable worked out. */
private class Held(val tokens: Tokens) {
    // Sixty seconds early. A token that expires while a request is in flight is
    // a 401 the caller did nothing to deserve, and clock skew between two
    // machines is measured in seconds rather than milliseconds.
    val expiresAt: Long = System.currentTimeMillis() / 1000 + (tokens.expiresIn - 60).coerceAtLeast(0)

    val live: Boolean
        get() = tokens.accessToken.isNotEmpty() && expiresAt > System.currentTimeMillis() / 1000
}

private suspend fun exchange(
    http: HttpClient,
    endpoint: String,
    form: Map<String, String>,
    clientId: String,
    clientSecret: String?,
): Tokens {
    val response = http.submitForm(
        url = endpoint,
        formParameters = parameters {
            form.forEach { (key, value) -> append(key, value) }
            // `client_secret_basic` is used where there is a secret, so the
            // client id only goes in the body for a public client.
            if (clientSecret == null) append("client_id", clientId)
        },
    ) {
        header(HttpHeaders.Accept, "application/json")
        if (clientSecret != null) {
            // A header rather than the body. Both are in the spec and the api
            // takes either; a header is the one that does not end up in a
            // proxy's access log beside the request line.
            val pair = Base64.getEncoder().encodeToString("$clientId:$clientSecret".toByteArray())
            header(HttpHeaders.Authorization, "Basic $pair")
        }
    }

    if (response.status != HttpStatusCode.OK) {
        // The token endpoint speaks RFC 6749 rather than this api's own error
        // shape — `{"error": "invalid_grant"}` — because every OAuth library
        // ever written reads that field and nothing else.
        val said = runCatching { oauthJson.decodeFromString<OauthRefusal>(response.bodyAsText()) }
            .getOrElse { OauthRefusal(error = "HTTP ${response.status.value}") }
        throw OauthException(said.error.ifEmpty { "HTTP ${response.status.value}" }, said.description)
    }

    return response.body()
}

/**
 * A token somebody else obtained and handed over.
 *
 * No refresh: when it runs out it runs out, and the caller finds out with an
 * [Unauthorized] rather than having a credential swapped underneath them.
 */
public class BearerToken(private val token: String, private val granted: List<String> = emptyList()) : Auth {
    override suspend fun fresh(): String = token

    override suspend fun forget() {
        // Nothing to forget: there is no way to get another, and clearing it
        // would turn one 401 into every call failing.
    }

    override fun scopes(): List<String> = granted
}

/**
 * An application acting for itself.
 *
 * No person, no consent screen, no refresh token — there is nothing to refresh,
 * because the application can ask for another whenever it likes.
 *
 * Only the scopes that are about nobody can be held this way: `catalog:read`
 * and `people:read`. Asking for `lists:read` here is refused at the door rather
 * than minted and then refused by every route that reads it.
 */
public class AppOnly(
    private val clientId: String,
    private val clientSecret: String,
    private val asked: List<String> = listOf("catalog:read"),
    private val endpoints: Endpoints = Endpoints(),
    private val http: HttpClient = defaultHttp(),
) : Auth {
    private val lock = Mutex()
    private var held: Held? = null

    override suspend fun fresh(): String {
        held?.takeIf { it.live }?.let { return it.tokens.accessToken }
        // Held across the exchange, so several coroutines that all notice the
        // same expiry mint one token between them rather than one each.
        return lock.withLock {
            held?.takeIf { it.live }?.let { return@withLock it.tokens.accessToken }
            val form = buildMap {
                put("grant_type", "client_credentials")
                if (asked.isNotEmpty()) put("scope", asked.joinToString(" "))
            }
            val fresh = exchange(http, endpoints.token, form, clientId, clientSecret)
            held = Held(fresh)
            fresh.accessToken
        }
    }

    override suspend fun forget() {
        lock.withLock { held = null }
    }

    override fun scopes(): List<String> = held?.tokens?.scopes ?: asked
}

/**
 * A token that acts for a person, kept alive by its refresh token.
 *
 * The refresh is **serialised** by the mutex, which is the whole reason this is
 * a class rather than a helper: four requests that all notice the expiry at once
 * must send one refresh between them, because the tokens rotate and the second
 * would present one the first has already retired.
 */
public class UserToken(
    private val clientId: String,
    tokens: Tokens,
    private val clientSecret: String? = null,
    private val keep: Keeper? = null,
    private val endpoints: Endpoints = Endpoints(),
    private val http: HttpClient = defaultHttp(),
) : Auth {
    private val lock = Mutex()
    private var held: Held = Held(tokens)

    /** What is held, for a caller that stores it themselves. */
    public val tokens: Tokens get() = held.tokens

    override suspend fun fresh(): String {
        if (held.live) return held.tokens.accessToken
        return lock.withLock {
            if (held.live) return@withLock held.tokens.accessToken

            val refresh = held.tokens.refreshToken
                ?: throw OauthException("invalid_grant", "no refresh token — ask for offline_access")

            var got = exchange(
                http,
                endpoints.token,
                mapOf("grant_type" to "refresh_token", "refresh_token" to refresh),
                clientId,
                clientSecret,
            )
            // A refresh that answers without a new refresh token is one the
            // server did not rotate; keeping the old one is then right.
            if (got.refreshToken == null) got = got.copy(refreshToken = refresh)

            held = Held(got)
            keep?.kept(got)
            got.accessToken
        }
    }

    override suspend fun forget() {
        // Nothing is cleared: `fresh` decides by the clock, and the refresh
        // token is the only way back — throwing it away would turn one 401 into
        // a signed-out application.
        lock.withLock { held = Held(held.tokens.copy(expiresIn = 0)) }
    }

    override fun scopes(): List<String> = held.tokens.scopes
}

/* ------------------------- getting a user's token -------------------------- */

/** A verifier and the challenge that goes with it, both from the same bytes. */
public data class Pkce(val verifier: String, val challenge: String)

private val b64 = Base64.getUrlEncoder().withoutPadding()

/**
 * A fresh PKCE pair.
 *
 * **S256 and never `plain`.** The api requires it of every client, confidential
 * ones included, and offers only `S256` in its discovery document — a code that
 * leaks from a log, a referer or a browser's history is then worth nothing
 * without the verifier, which never leaves the client that made it.
 */
public fun pkce(): Pkce {
    val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
    val verifier = b64.encodeToString(bytes)
    val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())
    return Pkce(verifier, b64.encodeToString(digest))
}

/** Where to send somebody, and the `state` to compare on the way back. */
public data class Authorization(val url: String, val state: String)

/**
 * The state is returned rather than only taken, because a callback with nothing
 * to compare against is a callback anybody can forge — so it is generated when
 * it is not given, and there is no way to end up without one.
 */
@JvmOverloads
public fun authorizeUrl(
    clientId: String,
    redirectUri: String,
    scopes: List<String>,
    challenge: String,
    state: String? = null,
    nonce: String? = null,
    endpoints: Endpoints = Endpoints(),
): Authorization {
    val settled = state ?: b64.encodeToString(ByteArray(18).also { SecureRandom().nextBytes(it) })
    val query = buildList {
        add("response_type" to "code")
        add("client_id" to clientId)
        add("redirect_uri" to redirectUri)
        add("scope" to scopes.joinToString(" "))
        add("code_challenge" to challenge)
        add("code_challenge_method" to "S256")
        add("state" to settled)
        if (nonce != null) add("nonce" to nonce)
    }.joinToString("&") { (k, v) -> "$k=${java.net.URLEncoder.encode(v, "UTF-8")}" }

    return Authorization("${endpoints.authorize}?$query", settled)
}

/** The code from the callback, for a token set. */
@JvmOverloads
public suspend fun exchangeCode(
    clientId: String,
    code: String,
    redirectUri: String,
    verifier: String,
    clientSecret: String? = null,
    endpoints: Endpoints = Endpoints(),
    http: HttpClient = defaultHttp(),
): Tokens = exchange(
    http,
    endpoints.token,
    mapOf(
        "grant_type" to "authorization_code",
        "code" to code,
        "redirect_uri" to redirectUri,
        "code_verifier" to verifier,
    ),
    clientId,
    clientSecret,
)

/** What a device shows on its screen while it waits. */
@Serializable
public data class DeviceStart(
    @SerialName("device_code") val deviceCode: String,
    /** the eight characters to put on the screen */
    @SerialName("user_code") val userCode: String,
    @SerialName("verification_uri") val verificationUri: String,
    /** the same address with the code in it, for a QR */
    @SerialName("verification_uri_complete") val verificationUriComplete: String = "",
    @SerialName("expires_in") val expiresIn: Long = 600,
    /** the floor, in seconds, the server asked to be polled at */
    @SerialName("interval") val interval: Long = 5,
)

/** Ask for a code to show on something with no browser. */
@JvmOverloads
public suspend fun startDevice(
    clientId: String,
    scopes: List<String>,
    clientSecret: String? = null,
    endpoints: Endpoints = Endpoints(),
    http: HttpClient = defaultHttp(),
): DeviceStart {
    val response = http.submitForm(
        url = endpoints.device,
        formParameters = parameters {
            append("scope", scopes.joinToString(" "))
            if (clientSecret == null) append("client_id", clientId)
        },
    ) {
        header(HttpHeaders.Accept, "application/json")
        if (clientSecret != null) {
            val pair = Base64.getEncoder().encodeToString("$clientId:$clientSecret".toByteArray())
            header(HttpHeaders.Authorization, "Basic $pair")
        }
    }
    if (response.status != HttpStatusCode.OK) {
        throw OauthException("HTTP ${response.status.value}", response.bodyAsText())
    }
    return response.body()
}

/**
 * Wait for the person to say yes, then hand back their tokens.
 *
 * The four names the server can answer with are the whole of what a poller
 * needs, and this reads all four: `authorization_pending` means keep going,
 * `slow_down` means keep going and wait longer, `access_denied` means somebody
 * pressed cancel, and `expired_token` means nobody pressed anything. A client
 * that cannot tell the first from the third polls into the expiry after the
 * answer has already arrived.
 */
@JvmOverloads
public suspend fun awaitDevice(
    clientId: String,
    deviceCode: String,
    interval: Long = 5,
    clientSecret: String? = null,
    endpoints: Endpoints = Endpoints(),
    http: HttpClient = defaultHttp(),
): Tokens {
    var wait = interval.coerceAtLeast(1)
    while (true) {
        kotlinx.coroutines.delay(wait * 1000)
        try {
            return exchange(
                http,
                endpoints.token,
                mapOf(
                    "grant_type" to "urn:ietf:params:oauth:grant-type:device_code",
                    "device_code" to deviceCode,
                ),
                clientId,
                clientSecret,
            )
        } catch (refused: OauthException) {
            when (refused.error) {
                "authorization_pending" -> continue
                // The server saying the interval was too short. Five seconds
                // more, as the RFC suggests, rather than doubling — this is a
                // person walking to their phone, not a backoff.
                "slow_down" -> wait += 5
                else -> throw refused
            }
        }
    }
}

/**
 * The client the flows use when the caller has not brought one.
 *
 * `Core.http` rather than a second builder here: the two would drift, and the
 * one that matters is `explicitNulls = false` on the format — a client that
 * built its own without it would send `"scope": null` to the token endpoint.
 */
internal fun defaultHttp(): HttpClient = Core.http(Options())
