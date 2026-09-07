"""One request, and everything that happens around it.

The generated methods are thin on purpose — they name a path, a query and a
body, and hand all four of the interesting decisions here:

* **waiting exactly as long as the server asked.** Every answer carries
  ``X-RateLimit-Remaining`` and ``X-RateLimit-Reset``, and a 429 carries
  ``Retry-After``. A client that reads them sleeps the right amount; one that
  guesses either hammers the door or sleeps for no reason.
* **retrying only what is safe to retry.** A 429, a 5xx, and a socket that never
  answered — never a request that was refused on its merits.
* **refreshing once on a 401.** An access token lives an hour, so a long-running
  process will meet one expiring mid-request. One retry with a fresh token; a
  second 401 is a real refusal.
* **turning a body into the right exception.**
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Callable, Mapping

import httpx

from .auth import Auth
from .errors import Unauthorized, Unreachable, refusal

BASE = "https://api.acyka.cc"


@dataclass(frozen=True, slots=True)
class Pace:
    """What the server said about the caller's minute."""

    limit: int | None = None
    remaining: int | None = None
    reset: int | None = None


@dataclass(frozen=True, slots=True)
class Options:
    base_url: str = BASE
    timeout: float = 30.0
    #: how many times a retryable answer is retried; 0 turns it off entirely
    retries: int = 3
    #: the longest this will ever sleep on a 429 before raising, in seconds
    #:
    #: Without a ceiling, a client that has spent its minute and asked for a
    #: hundred pages sleeps the whole window inside one call — which looks
    #: exactly like a hang to whoever is waiting on it.
    max_wait: float = 65.0
    #: told after every answer, so a caller can watch its own budget
    on_pace: Callable[[Pace], None] | None = None
    headers: Mapping[str, str] | None = None


def _number(headers: httpx.Headers, name: str) -> int | None:
    said = headers.get(name)
    if said is None:
        return None
    try:
        return int(said)
    except ValueError:
        return None


def _query(query: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """A query string with nothing that was not asked for in it."""
    if not query:
        return None
    # ``None`` means "not asked for" and is dropped; ``0`` and ``False`` are
    # answers and are sent. A client that dropped falsy values would make
    # ``offset=0`` unsendable and ``score=0`` mean "any score".
    return {k: v for k, v in query.items() if v is not None}


def _pace(response: httpx.Response) -> Pace:
    return Pace(
        limit=_number(response.headers, "x-ratelimit-limit"),
        remaining=_number(response.headers, "x-ratelimit-remaining"),
        reset=_number(response.headers, "x-ratelimit-reset"),
    )


def _said(response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError:
        # A proxy's own 502 is html, and raising a JSON error there tells the
        # caller nothing about what happened.
        return {}
    return body if isinstance(body, dict) else {"message": str(body)}


def _wait_for(response: httpx.Response, attempt: int, pace: Pace) -> float:
    if response.status_code == 429:
        # The server's own number rather than a guess: too little and it is
        # refused again, too much and the client sleeps for nothing.
        asked = _number(response.headers, "retry-after")
        return float(max(1, asked if asked is not None else (pace.reset or 1)))
    return min(2**attempt * 0.25, 4.0)


class Core:
    """The synchronous transport."""

    def __init__(self, auth: Auth, options: Options | None = None, http: httpx.Client | None = None):
        self._auth = auth
        self._o = options or Options()
        self._own = http is None
        self._http = http or httpx.Client(timeout=self._o.timeout)

    def close(self) -> None:
        if self._own:
            self._http.close()

    def call(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any] | None = None,
        body: Any = None,
    ) -> Any:
        where = (method, path)
        refreshed = False
        attempt = 0

        while True:
            headers = {
                "accept": "application/json",
                "user-agent": "acyka-api-py/1",
                **(self._o.headers or {}),
                "authorization": f"Bearer {self._auth.fresh()}",
            }

            try:
                response = self._http.request(
                    method,
                    f"{self._o.base_url}{path}",
                    params=_query(query),
                    json=body,
                    headers=headers,
                )
            except httpx.HTTPError as cause:
                # Nothing answered. Worth one more go for the same reason a 5xx
                # is — a dropped socket during a deploy is a gap, not a refusal.
                if attempt < self._o.retries:
                    time.sleep(min(2**attempt * 0.25, 4.0))
                    attempt += 1
                    continue
                raise Unreachable(where, cause) from cause

            pace = _pace(response)
            if self._o.on_pace:
                self._o.on_pace(pace)

            if not response.is_error:
                if response.status_code == 204 or not response.content:
                    return None
                return response.json()

            said = _said(response)

            if response.status_code == 401 and not refreshed:
                refreshed = True
                self._auth.forget()
                try:
                    self._auth.fresh()
                except Exception:
                    raise Unauthorized(401, said, where) from None
                continue

            if (response.status_code == 429 or response.status_code >= 500) and attempt < self._o.retries:
                wait = _wait_for(response, attempt, pace)
                if wait <= self._o.max_wait:
                    time.sleep(wait)
                    attempt += 1
                    continue

            raise refusal(
                response.status_code,
                said,
                where,
                _number(response.headers, "retry-after") or pace.reset or 0,
                pace.limit,
                pace.remaining,
            )


class AsyncCore:
    """The same transport, awaited.

    A second class rather than one with a flag, because every line that differs
    is a line that has to be awaited — and a client that pretended otherwise
    would block an event loop inside a sleep.
    """

    def __init__(
        self,
        auth: Auth,
        options: Options | None = None,
        http: httpx.AsyncClient | None = None,
    ):
        self._auth = auth
        self._o = options or Options()
        self._own = http is None
        self._http = http or httpx.AsyncClient(timeout=self._o.timeout)

    async def aclose(self) -> None:
        if self._own:
            await self._http.aclose()

    async def call(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any] | None = None,
        body: Any = None,
    ) -> Any:
        where = (method, path)
        refreshed = False
        attempt = 0

        while True:
            headers = {
                "accept": "application/json",
                "user-agent": "acyka-api-py/1",
                **(self._o.headers or {}),
                "authorization": f"Bearer {await self._auth.afresh()}",
            }

            try:
                response = await self._http.request(
                    method,
                    f"{self._o.base_url}{path}",
                    params=_query(query),
                    json=body,
                    headers=headers,
                )
            except httpx.HTTPError as cause:
                if attempt < self._o.retries:
                    await asyncio.sleep(min(2**attempt * 0.25, 4.0))
                    attempt += 1
                    continue
                raise Unreachable(where, cause) from cause

            pace = _pace(response)
            if self._o.on_pace:
                self._o.on_pace(pace)

            if not response.is_error:
                if response.status_code == 204 or not response.content:
                    return None
                return response.json()

            said = _said(response)

            if response.status_code == 401 and not refreshed:
                refreshed = True
                self._auth.forget()
                try:
                    await self._auth.afresh()
                except Exception:
                    raise Unauthorized(401, said, where) from None
                continue

            if (response.status_code == 429 or response.status_code >= 500) and attempt < self._o.retries:
                wait = _wait_for(response, attempt, pace)
                if wait <= self._o.max_wait:
                    await asyncio.sleep(wait)
                    attempt += 1
                    continue

            raise refusal(
                response.status_code,
                said,
                where,
                _number(response.headers, "retry-after") or pace.reset or 0,
                pace.limit,
                pace.remaining,
            )
