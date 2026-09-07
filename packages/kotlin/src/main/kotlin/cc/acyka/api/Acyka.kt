package cc.acyka.api

import io.ktor.client.HttpClient

/**
 * A client for the [acyka](https://acyka.cc) API — the anime catalogue, public
 * profiles, and the lists, shelves and writing of whoever authorised your
 * application.
 *
 * ```kotlin
 * // an application acting for itself: the catalogue, and public profiles
 * val acyka = Acyka.app(clientId = "acy_…", clientSecret = "…")
 *
 * val found = acyka.catalogue.listTitles(q = "frieren", limit = 5)
 * found.forEach { println("${it.id} ${it.title}") }
 *
 * acyka.catalogue.listTitlesAll(genre = "Drama").collect { println(it.title) }
 * ```
 *
 * Everything under a namespace is generated from `openapi.json`, which the
 * server writes from annotations on its own handlers. Everything else — the four
 * OAuth flows, the token that renews itself, the backoff that reads the server's
 * own numbers, the paginators, one exception per refusal, and the webhook check
 * — is written by hand.
 *
 * Full documentation, with a playground: <https://dev.acyka.cc>
 */
public class Acyka private constructor(
    public val auth: Auth,
    options: Options,
    http: HttpClient,
) : Namespaces(Core(auth, options, http)) {

    /** What the last answer said about this client's minute. */
    public val pace: Pace get() = core.pace

    public companion object {
        /** A client over any [Auth], for a caller with somewhere unusual to keep a token. */
        @JvmStatic
        @JvmOverloads
        public fun of(auth: Auth, options: Options = Options(), http: HttpClient? = null): Acyka =
            Acyka(auth, options, http ?: Core.http(options))

        /**
         * An application acting for itself — a bot, a cron, anything with no
         * person in front of it. Mints on demand and stores nothing.
         *
         * Only `catalog:read` and `people:read` can be held this way: everything
         * else on this api is about somebody, and a `client_credentials` token
         * has nobody to act for.
         */
        @JvmStatic
        @JvmOverloads
        public fun app(
            clientId: String,
            clientSecret: String,
            scopes: List<String> = listOf("catalog:read"),
            options: Options = Options(),
            endpoints: Endpoints = Endpoints(),
        ): Acyka = of(AppOnly(clientId, clientSecret, scopes, endpoints), options)

        /**
         * A token that acts for a person, kept alive by its refresh token.
         *
         * Give it a [Keeper] and store what it hands you: **refresh tokens
         * rotate**, and presenting a retired one is what the server reads as
         * theft — it kills the whole chain and signs the person out.
         */
        @JvmStatic
        @JvmOverloads
        public fun user(
            clientId: String,
            tokens: Tokens,
            clientSecret: String? = null,
            keep: Keeper? = null,
            options: Options = Options(),
            endpoints: Endpoints = Endpoints(),
        ): Acyka = of(UserToken(clientId, tokens, clientSecret, keep, endpoints), options)

        /** A token somebody else obtained. No refresh. */
        @JvmStatic
        @JvmOverloads
        public fun token(accessToken: String, options: Options = Options()): Acyka =
            of(BearerToken(accessToken), options)
    }
}
