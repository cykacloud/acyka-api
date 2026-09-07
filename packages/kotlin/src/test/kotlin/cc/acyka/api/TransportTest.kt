package cc.acyka.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

/**
 * The half of the client a document cannot generate, against a fake engine
 * rather than a mocked client: what is being tested is what happens to headers,
 * statuses and a body on the way through.
 */
class TransportTest {

    private val asked = mutableListOf<HttpRequestData>()

    /** A client that answers a scripted list and remembers what it was asked. */
    private fun client(
        answers: MutableList<Triple<Int, String, Map<String, String>>>,
        options: Options = Options(retries = 3),
        auth: Auth = BearerToken("acya_test"),
    ): Acyka {
        val engine = MockEngine { request ->
            asked += request
            val (status, body, headers) = answers.removeFirst()
            respond(
                content = body,
                status = HttpStatusCode.fromValue(status),
                headers = headersOf(
                    *(headers + ("Content-Type" to "application/json"))
                        .map { (k, v) -> k to listOf(v) }
                        .toTypedArray()
                ),
            )
        }
        val http = HttpClient(engine) {
            expectSuccess = false
            install(ContentNegotiation) { json(Json) }
        }
        return Acyka.of(auth, options, http)
    }

    private fun page() =
        """{"items":[{"id":52991,"title":"Sousou no Frieren","kind":"tv","episodes":28,"score":9.1}],"total":1}"""

    @Test
    fun `a read sends the token and parses the shape`() = runTest {
        val acyka = client(mutableListOf(Triple(200, page(), emptyMap())))
        val found = acyka.catalogue.listTitles(q = "frieren")

        assertEquals(1, found.total)
        assertEquals("Sousou no Frieren", found.items[0].title)
        assertEquals(9.1, found.items[0].score)
        // A missing optional is null rather than a default: absent and zero are
        // different answers, and this api's own rules say a client must not
        // collapse them.
        assertNull(found.items[0].titleOrig)
        // and a page iterates and counts, because that is what it looks like
        assertEquals(listOf(52991L), found.map { it.id })

        assertEquals("Bearer acya_test", asked[0].headers["Authorization"])
        assertContains(asked[0].url.toString(), "q=frieren")
    }

    @Test
    fun `a parameter that was not asked for is not sent`() = runTest {
        val acyka = client(mutableListOf(Triple(200, page(), emptyMap())))
        acyka.catalogue.listTitles(offset = 0)

        val url = asked[0].url.toString()
        // `offset=0` is an answer and is sent; `limit`, never given, is absent —
        // a client that dropped falsy values would make `offset=0` unsendable.
        assertContains(url, "offset=0")
        assertTrue(!url.contains("limit"), url)
    }

    @Test
    fun `a 204 answers nothing rather than a parse error`() = runTest {
        val acyka = client(mutableListOf(Triple(204, "", emptyMap())))
        acyka.library.removeListEntry(shikimoriId = 21)
    }

    @Test
    fun `a refusal becomes the type that says what to do`() = runTest {
        val acyka = client(
            mutableListOf(
                Triple(
                    403,
                    """{"message":"errors.oauthInsufficientScope","scope":"lists:read"}""",
                    emptyMap(),
                )
            ),
            Options(retries = 0),
        )

        val refused = assertFailsWith<Forbidden> { acyka.library.listMyList() }
        assertEquals("errors.oauthInsufficientScope", refused.code)
        // The name alone would leave a caller unable to say *which* scope, which
        // is the one thing they need in order to ask for it.
        assertEquals("lists:read", refused.scope)
        // and refreshing will not help, so it is not worth retrying
        assertTrue(!refused.retryable)
    }

    @Test
    fun `an answer that is not json still becomes the right type`() = runTest {
        // A proxy's own 502 is html, and a parse error there would tell the
        // caller nothing about what happened.
        val acyka = client(
            mutableListOf(Triple(502, "<html>502</html>", emptyMap())),
            Options(retries = 0),
        )
        val refused = assertFailsWith<ServerError> { acyka.catalogue.listGenres() }
        assertEquals(502, refused.status)
        assertTrue(refused.retryable)
    }

    @Test
    fun `a 429 waits as long as retry-after said and then succeeds`() = runTest {
        val acyka = client(
            mutableListOf(
                Triple(429, """{"message":"common.tooOften"}""", mapOf("Retry-After" to "1")),
                Triple(200, """{"items":["Drama"]}""", emptyMap()),
            )
        )

        val genres = acyka.catalogue.listGenres()

        assertEquals(listOf("Drama"), genres.items)
        // Two requests: the refusal, and the one after the wait. `runTest` runs
        // the virtual clock forward, so the delay is real to the code and free
        // to the suite.
        assertEquals(2, asked.size)
    }

    @Test
    fun `a wait past the ceiling is raised rather than slept through`() = runTest {
        // Suspending for a whole window inside one call looks exactly like a
        // hang to whoever is waiting on it.
        val acyka = client(
            mutableListOf(Triple(429, """{"message":"common.tooOften"}""", mapOf("Retry-After" to "60"))),
            Options(retries = 3, maxWaitMillis = 1000),
        )
        val refused = assertFailsWith<RateLimited> { acyka.catalogue.listGenres() }
        assertEquals(60, refused.retryAfter)
        assertEquals(1, asked.size)
    }

    @Test
    fun `the pace the server sets is readable afterwards`() = runTest {
        val acyka = client(
            mutableListOf(
                Triple(
                    200,
                    """{"items":[]}""",
                    mapOf(
                        "X-RateLimit-Limit" to "60",
                        "X-RateLimit-Remaining" to "58",
                        "X-RateLimit-Reset" to "31",
                    ),
                )
            )
        )
        acyka.catalogue.listGenres()
        assertEquals(Pace(60, 58, 31), acyka.pace)
    }

    @Test
    fun `a refusal on its merits is not retried`() = runTest {
        val acyka = client(mutableListOf(Triple(400, """{"message":"errors.badData"}""", emptyMap())))
        assertFailsWith<BadRequest> {
            acyka.library.saveListEntry(shikimoriId = 21, body = ListBody(title = ""))
        }
        assertEquals(1, asked.size)
    }

    /** An auth that hands out a new token each time it is forgotten. */
    private class Renewing : Auth {
        var refreshes = 0
        private var n = 0

        override suspend fun fresh(): String = "acya_$n"

        override suspend fun forget() {
            n += 1
            refreshes += 1
        }
    }

    @Test
    fun `a token that expired mid-flight is refreshed once and retried once`() = runTest {
        val auth = Renewing()
        val acyka = client(
            mutableListOf(
                Triple(401, """{"message":"errors.unauthorized"}""", emptyMap()),
                Triple(200, """{"id":"1"}""", emptyMap()),
            ),
            Options(retries = 0),
            auth,
        )

        acyka.account.getMe()

        assertEquals(1, auth.refreshes)
        assertEquals(
            listOf("Bearer acya_0", "Bearer acya_1"),
            asked.map { it.headers["Authorization"] },
        )
    }

    @Test
    fun `and a second 401 is raised rather than refreshed again`() = runTest {
        // The credential is wrong rather than stale; refreshing produces the
        // same one and the loop would never end.
        val auth = Renewing()
        val acyka = client(
            mutableListOf(
                Triple(401, """{"message":"errors.unauthorized"}""", emptyMap()),
                Triple(401, """{"message":"errors.unauthorized"}""", emptyMap()),
            ),
            Options(retries = 0),
            auth,
        )

        assertFailsWith<Unauthorized> { acyka.account.getMe() }
        assertEquals(1, auth.refreshes)
        assertEquals(2, asked.size)
    }

    @Test
    fun `an optional a caller did not set is not sent as null`() = runTest {
        // `explicitNulls = false` on the format. On this api absent and null are
        // different answers, and a `PATCH` reads the difference — a body full of
        // nulls would clear every field the caller left alone.
        val acyka = client(
            mutableListOf(
                Triple(
                    200,
                    """{"shikimori_id":21,"title":"One Piece","status":"watching","episode":3,"at":"2026-01-01T00:00:00Z"}""",
                    emptyMap(),
                )
            )
        )
        acyka.library.saveListEntry(shikimoriId = 21, body = ListBody(title = "One Piece"))

        val sent = (asked[0].body as io.ktor.http.content.TextContent).text
        assertEquals("""{"title":"One Piece"}""", sent)
    }
}
