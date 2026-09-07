"""The generated parsers, called rather than compiled.

Every other test here drives the transport — what happens to a body, a status
and a header on the way through — with `Me` as the shape on the other end,
because one shape is enough to prove a round trip. That left two whole
categories of generated code never executed, and both were broken:

* **A page of something that is not a shape.** `list_genres` answers
  ``{"items": ["shounen", …]}``, and the parser reaches for `_asis` — which
  lives in `models.py` behind a leading underscore, so the star import in
  `operations.py` skipped it. The method raised `NameError` on its first call.

* **A field typed as an alias.** `PostId` is `str` with a nicer name, and in the
  contract it is a `ref` exactly like `Post` is. The parser could not tell them
  apart and emitted `PostId._parse(...)`, which is `str._parse` and an
  `AttributeError` on the first post anybody read.

Neither is a subtle failure — both are the very first call — and neither was
caught by a suite of thirty-five tests. So this file exists to *call* one
operation of each shape the generator can produce: a shape, a page of shapes, a
page of plain values, a field that is an alias, and an optional field left out.
"""

from __future__ import annotations

import json

import httpx
import pytest

from acyka import Acyka, Options
from acyka.auth import BearerToken


def answering(body) -> Acyka:
    """A client whose every call is answered with one body."""

    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=json.dumps(body),
            headers={"content-type": "application/json"},
        )

    return Acyka(
        BearerToken("acya_test"),
        Options(retries=0),
        http=httpx.Client(transport=httpx.MockTransport(handle)),
    )


def test_a_page_of_plain_strings_parses():
    """`list_genres` is the only operation whose page holds no shape."""
    acyka = answering({"items": ["shounen", "seinen"], "total": 2})
    page = acyka.catalogue.list_genres()
    assert page.items == ["shounen", "seinen"]
    assert page.total == 2
    assert len(page) == 2
    assert list(page) == ["shounen", "seinen"]


def test_a_field_typed_as_an_alias_parses():
    """`Post.id` is a `PostId`, which is a `str` wearing a name."""
    acyka = answering(
        {
            "items": [{"id": "p_1", "body": "hello", "at": "2026-01-01T00:00:00Z"}],
            "total": 1,
        }
    )
    page = acyka.social.list_my_posts()
    post = page.items[0]
    assert post.id == "p_1"
    assert isinstance(post.id, str)
    # left out of the answer, and therefore absent rather than zero
    assert post.shikimori_id is None
    assert post.episode is None


def test_a_shape_parses():
    acyka = answering({"id": "u_1", "nickname": "somebody", "verified": True})
    me = acyka.account.get_me()
    assert me.id == "u_1"
    assert me.nickname == "somebody"
    assert me.verified is True
    # not sent, and therefore absent rather than empty
    assert me.email is None


def test_a_page_of_shapes_parses():
    acyka = answering(
        {
            "items": [{"id": 52991, "title": "Frieren", "kind": "tv", "episodes": 28}],
            "total": 1,
        }
    )
    page = acyka.catalogue.list_titles(q="frieren")
    assert page.items[0].id == 52991
    assert page.items[0].title == "Frieren"
    # every other field of a card is optional, and none was sent
    assert page.items[0].year is None
    assert page.items[0].score is None


def test_the_paging_generator_stops_on_a_short_page():
    """`*_all` walks pages; a page shorter than the window is the end.

    Here because the generator emits it per operation and the sync and async
    halves differ by more than a keyword — `yield from` is a syntax error inside
    an `async def`, so the two are genuinely different code.
    """
    def card(n: int) -> dict:
        return {"id": n, "title": f"t{n}", "kind": "tv", "episodes": 1}

    pages = [
        {"items": [card(n) for n in range(3)], "total": 4},
        {"items": [card(3)], "total": 4},
    ]
    asked: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        asked.append(str(request.url))
        return httpx.Response(
            200,
            content=json.dumps(pages[len(asked) - 1]),
            headers={"content-type": "application/json"},
        )

    acyka = Acyka(
        BearerToken("acya_test"),
        Options(retries=0),
        http=httpx.Client(transport=httpx.MockTransport(handle)),
    )
    got = list(acyka.catalogue.list_titles_all(limit=3))
    assert [t.id for t in got] == [0, 1, 2, 3]
    assert len(asked) == 2
    assert "offset=3" in asked[1]


@pytest.mark.parametrize("name", ["list_genres", "list_titles", "get_me"])
def test_every_generated_method_is_callable(name: str):
    """A method that is not defined is a `NameError` at call time, not at import.

    Python resolves a global when the line runs, so a generated body naming
    something that was never imported passes every check that does not call it —
    which is how `_asis` shipped.
    """
    acyka = answering({"items": [], "total": 0, "id": "u_1", "nickname": "x"})
    for group in (acyka.catalogue, acyka.account, acyka.social):
        method = getattr(group, name, None)
        if method is not None:
            method()
            return
    raise AssertionError(f"{name} is on none of the namespaces")
