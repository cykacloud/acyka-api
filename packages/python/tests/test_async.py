"""The awaited client is the same client, and the test is that it is."""

from __future__ import annotations

import asyncio

import httpx

from acyka import AsyncAcyka, Options
from acyka._core import AsyncCore
from acyka.auth import BearerToken


def answering(body, status=200):
    return httpx.MockTransport(lambda _: httpx.Response(status, json=body))


def test_the_awaited_client_parses_the_same_shapes():
    async def run():
        acyka = AsyncAcyka.token("acya_test")
        acyka.core._http = httpx.AsyncClient(
            transport=answering({"items": [{"id": 1, "title": "t", "kind": "tv", "episodes": 12}]})
        )
        page = await acyka.catalogue.list_titles(q="t")
        await acyka.aclose()
        return page

    page = asyncio.run(run())
    assert page.items[0].title == "t"


def test_and_pages_the_same_way():
    rows = [{"id": i, "title": f"t{i}", "kind": "tv", "episodes": 12} for i in range(1, 6)]
    asked: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        asked.append(request)
        limit = int(request.url.params.get("limit", 30))
        offset = int(request.url.params.get("offset", 0))
        return httpx.Response(200, json={"items": rows[offset : offset + limit], "total": 4000})

    async def run():
        acyka = AsyncAcyka.token("acya_test")
        acyka.core._http = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        seen = [t.id async for t in acyka.catalogue.list_titles_all(limit=10)]
        await acyka.aclose()
        return seen

    # `total` says four thousand and the first page is short, so the loop stops
    # on the page rather than on the count — which is the case a loop written by
    # hand gets wrong.
    assert asyncio.run(run()) == [1, 2, 3, 4, 5]
    assert len(asked) == 1


def test_a_refusal_is_the_same_exception_awaited():
    from acyka import NotFound

    async def run():
        core = AsyncCore(
            BearerToken("acya_test"),
            Options(retries=0),
            httpx.AsyncClient(transport=answering({"message": "errors.notFound"}, 404)),
        )
        try:
            await core.call("GET", "/api/v1/titles/1")
        except NotFound as err:
            return err.code
        finally:
            await core.aclose()
        return None

    assert asyncio.run(run()) == "errors.notFound"
