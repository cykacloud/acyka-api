"""The half of the client a document cannot generate: waiting the right amount,
retrying the right things, and refreshing exactly once."""

from __future__ import annotations

import json
import time

import httpx
import pytest

from acyka import (
    Acyka,
    BadRequest,
    Forbidden,
    NotFound,
    Options,
    RateLimited,
    ServerError,
    Unauthorized,
)
from acyka._core import Core
from acyka.auth import BearerToken


def scripted(answers: list[httpx.Response]):
    """A transport that answers a list, and remembers what it was asked."""
    asked: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        asked.append(request)
        if not answers:
            raise AssertionError("the script ran out of answers")
        return answers.pop(0)

    return httpx.MockTransport(handle), asked


def core(answers, **options):
    transport, asked = scripted(answers)
    http = httpx.Client(transport=transport)
    return Core(BearerToken("acya_test"), Options(**{"retries": 3, **options}), http), asked


def said(status: int, body, headers=None) -> httpx.Response:
    return httpx.Response(status, json=body, headers=headers or {})


class TestOneRequest:
    def test_sends_the_token_and_asks_for_json(self):
        c, asked = core([said(200, {"items": []})])
        c.call("GET", "/api/v1/titles")

        assert asked[0].headers["authorization"] == "Bearer acya_test"
        assert asked[0].headers["accept"] == "application/json"

    def test_leaves_out_a_parameter_that_was_not_asked_for(self):
        c, asked = core([said(200, {"items": []})])
        c.call("GET", "/api/v1/titles", query={"q": "frieren", "limit": None, "offset": 0})

        # ``None`` means "not asked for" and is dropped; ``0`` is an answer and
        # is sent — dropping falsy values would make ``offset=0`` unsendable.
        assert asked[0].url.params["q"] == "frieren"
        assert asked[0].url.params["offset"] == "0"
        assert "limit" not in asked[0].url.params

    def test_a_204_answers_nothing_rather_than_a_parse_error(self):
        c, _ = core([httpx.Response(204)])
        assert c.call("DELETE", "/api/v1/lists/21") is None


class TestARefusalBecomesAType:
    @pytest.mark.parametrize(
        "status,kind",
        [
            (400, BadRequest),
            (401, Unauthorized),
            (403, Forbidden),
            (404, NotFound),
            (500, ServerError),
        ],
    )
    def test_by_status(self, status, kind):
        c, _ = core([said(status, {"message": "errors.something"})], retries=0)
        with pytest.raises(kind) as raised:
            c.call("GET", "/api/v1/titles")
        # The phrase name and never a sentence of ours: it is the thing that can
        # be looked up, and the only thing that is stable.
        assert raised.value.code == "errors.something"
        assert raised.value.path == "/api/v1/titles"

    def test_a_403_names_the_scope_the_server_named(self):
        c, _ = core(
            [said(403, {"message": "errors.oauthInsufficientScope", "scope": "lists:write"})],
            retries=0,
        )
        with pytest.raises(Forbidden) as raised:
            c.call("GET", "/api/v1/lists")
        assert raised.value.scope == "lists:write"

    def test_an_answer_with_no_json_still_becomes_the_right_type(self):
        # A proxy's own 502 is html, and raising a JSON error there tells the
        # caller nothing about what happened.
        c, _ = core([httpx.Response(502, text="<html>502</html>")], retries=0)
        with pytest.raises(ServerError) as raised:
            c.call("GET", "/api/v1/titles")
        assert raised.value.status == 502


class TestThePaceTheServerSets:
    def test_a_429_waits_as_long_as_retry_after_said(self):
        c, asked = core(
            [
                said(429, {"message": "common.tooOften"}, {"retry-after": "1"}),
                said(200, {"items": [{"id": 1}]}),
            ]
        )
        started = time.monotonic()
        out = c.call("GET", "/api/v1/titles")
        took = time.monotonic() - started

        assert out == {"items": [{"id": 1}]}
        assert len(asked) == 2
        assert 0.9 <= took < 2.5

    def test_a_wait_past_the_ceiling_is_raised_rather_than_slept_through(self):
        # Sleeping a whole window inside one call looks exactly like a hang to
        # whoever is waiting on it.
        c, asked = core(
            [said(429, {"message": "common.tooOften"}, {"retry-after": "60"})],
            max_wait=1.0,
        )
        with pytest.raises(RateLimited) as raised:
            c.call("GET", "/api/v1/titles")
        assert raised.value.retry_after == 60
        assert len(asked) == 1

    def test_the_headers_reach_a_caller_watching_its_own_budget(self):
        seen = []
        c, _ = core(
            [
                said(
                    200,
                    {},
                    {
                        "x-ratelimit-limit": "60",
                        "x-ratelimit-remaining": "58",
                        "x-ratelimit-reset": "31",
                    },
                )
            ],
            on_pace=seen.append,
        )
        c.call("GET", "/api/v1/genres")
        assert (seen[0].limit, seen[0].remaining, seen[0].reset) == (60, 58, 31)

    def test_a_refusal_on_its_merits_is_not_retried(self):
        c, asked = core([said(400, {"message": "errors.badData"})])
        with pytest.raises(BadRequest):
            c.call("PUT", "/api/v1/lists/21", body={})
        assert len(asked) == 1


class TestATokenThatExpiresMidFlight:
    class Renewing:
        """An auth that hands out a new token each time it is forgotten."""

        def __init__(self):
            self.n = 0
            self.refreshes = 0

        def fresh(self):
            return f"acya_{self.n}"

        async def afresh(self):
            return self.fresh()

        def forget(self):
            self.n += 1
            self.refreshes += 1

        def scopes(self):
            return []

    def test_is_refreshed_once_and_retried_once(self):
        auth = self.Renewing()
        transport, asked = scripted(
            [said(401, {"message": "errors.unauthorized"}), said(200, {"id": "1"})]
        )
        c = Core(auth, Options(retries=0), httpx.Client(transport=transport))

        c.call("GET", "/api/v1/me")

        assert auth.refreshes == 1
        assert [r.headers["authorization"] for r in asked] == ["Bearer acya_0", "Bearer acya_1"]

    def test_and_a_second_401_is_raised_rather_than_refreshed_again(self):
        # The credential is wrong rather than stale; refreshing produces the
        # same one and the loop would never end.
        auth = self.Renewing()
        transport, asked = scripted(
            [
                said(401, {"message": "errors.unauthorized"}),
                said(401, {"message": "errors.unauthorized"}),
            ]
        )
        c = Core(auth, Options(retries=0), httpx.Client(transport=transport))

        with pytest.raises(Unauthorized):
            c.call("GET", "/api/v1/me")
        assert auth.refreshes == 1
        assert len(asked) == 2


class TestTheGeneratedHalf:
    def test_a_shape_is_parsed_into_a_dataclass(self):
        transport, _ = scripted(
            [
                said(
                    200,
                    {
                        "items": [
                            {
                                "id": 52991,
                                "title": "Sousou no Frieren",
                                "kind": "tv",
                                "episodes": 28,
                                "score": 9.1,
                            }
                        ],
                        "total": 1,
                    },
                )
            ]
        )
        acyka = Acyka.token("acya_test")
        acyka.core._http = httpx.Client(transport=transport)

        page = acyka.catalogue.list_titles(q="frieren")
        assert page.total == 1
        # Attribute access, not `page["items"][0]["title"]`, which is the whole
        # reason the parsers are generated rather than the dicts handed over.
        assert page.items[0].title == "Sousou no Frieren"
        assert page.items[0].score == 9.1
        # a missing optional is None rather than absent
        assert page.items[0].title_orig is None
        # and a page iterates and counts, because that is what it looks like
        assert len(page) == 1
        assert [t.id for t in page] == [52991]

    def test_a_nested_shape_is_parsed_all_the_way_down(self):
        transport, _ = scripted(
            [
                said(
                    200,
                    {
                        "items": [
                            {
                                "id": 1,
                                "name": "Frieren",
                                "roles": ["Main"],
                                "voices": [
                                    {
                                        "id": 2,
                                        "name": "Atsumi Tanezaki",
                                        "seyu": True,
                                        "mangaka": False,
                                        "producer": False,
                                        "language": "ja",
                                    }
                                ],
                            }
                        ]
                    },
                )
            ]
        )
        acyka = Acyka.token("acya_test")
        acyka.core._http = httpx.Client(transport=transport)

        page = acyka.catalogue.title_characters(id=52991)
        voice = page.items[0].voices[0]
        assert voice.name == "Atsumi Tanezaki"
        assert voice.seyu is True
        # `language` absent would be None, and None means nobody has said —
        # never "not japanese".
        assert voice.language == "ja"

    def test_a_body_goes_out_with_the_api_s_own_field_names(self):
        transport, asked = scripted(
            [
                said(
                    200,
                    {
                        "shikimori_id": 21,
                        "title": "One Piece",
                        "status": "watching",
                        "episode": 3,
                        "at": "2026-01-01T00:00:00Z",
                    },
                )
            ]
        )
        from acyka import ListBody

        acyka = Acyka.token("acya_test")
        acyka.core._http = httpx.Client(transport=transport)

        row = acyka.library.save_list_entry(
            shikimori_id=21, body=ListBody(title="One Piece", status="watching", episode=3)
        )
        sent = json.loads(asked[0].content)
        # snake_case out as well as in: this is a rename of nothing.
        assert sent == {"title": "One Piece", "status": "watching", "episode": 3}
        assert row.episode == 3
