"""One exception per refusal, out of a set the server keeps small on purpose.

The api answers ``{"message": "errors.oauthInsufficientScope"}`` — a **phrase
name and never a sentence** — because one screen can be read in five languages
and the server does not get to choose which. For a client library that is not a
limitation but the thing that makes real exception types possible: a stable,
enumerable set of names, instead of matching on prose that changes when somebody
rewrites a sentence.

Catch the class you can do something about; read ``.code`` for the name when you
want to show your own words.
"""

from __future__ import annotations

from typing import Any


class AcykaError(Exception):
    """Anything the api refused, or could not be asked."""

    def __init__(
        self,
        status: int,
        detail: dict[str, Any],
        request: tuple[str, str],
    ) -> None:
        #: the phrase name, e.g. ``errors.notFound``
        self.code: str = str(detail.get("message", "")) or f"HTTP {status}"
        super().__init__(self.code)
        self.status = status
        #: the whole body, including the extra fields a refusal owes a reason for
        self.detail = detail
        #: what was asked, for a log that has to be read six months later
        self.method, self.path = request

    def __str__(self) -> str:
        return f"{self.code} ({self.status} for {self.method} {self.path})"


class Unauthorized(AcykaError):
    """No token, an expired one, or one whose application was switched off."""


class Forbidden(AcykaError):
    """The token is good and does not carry what this endpoint wants.

    **Refreshing will not help**, which is why this is not ``Unauthorized``: the
    refresh produces the same token with the same scopes and earns the same
    refusal.
    """

    @property
    def scope(self) -> str | None:
        """The word that was missing, where the server named it."""
        named = self.detail.get("scope")
        return named if isinstance(named, str) else None


class NotFound(AcykaError):
    """There is nothing there, or it is not yours to read."""


class BadRequest(AcykaError):
    """Refused before anything looked at it."""


class RateLimited(AcykaError):
    """The minute is spent.

    ``retry_after`` is seconds, from the server's own header. This only reaches a
    caller when the retries are used up or turned off — otherwise the client
    waits and tries again by itself.
    """

    def __init__(
        self,
        status: int,
        detail: dict[str, Any],
        request: tuple[str, str],
        retry_after: int,
        limit: int | None = None,
        remaining: int | None = None,
    ) -> None:
        super().__init__(status, detail, request)
        self.retry_after = retry_after
        self.limit = limit
        self.remaining = remaining


class ServerError(AcykaError):
    """Something went wrong on our side, or in front of it."""


class Unreachable(AcykaError):
    """The request never got an answer: a socket, a timeout, a proxy."""

    def __init__(self, request: tuple[str, str], cause: BaseException) -> None:
        super().__init__(0, {"message": "errors.unreachable"}, request)
        self.__cause__ = cause


def refusal(
    status: int,
    detail: dict[str, Any],
    request: tuple[str, str],
    retry_after: int = 0,
    limit: int | None = None,
    remaining: int | None = None,
) -> AcykaError:
    if status in (400, 422):
        return BadRequest(status, detail, request)
    if status == 401:
        return Unauthorized(status, detail, request)
    if status == 403:
        return Forbidden(status, detail, request)
    if status == 404:
        return NotFound(status, detail, request)
    if status == 429:
        return RateLimited(status, detail, request, retry_after, limit, remaining)
    if status >= 500:
        return ServerError(status, detail, request)
    return AcykaError(status, detail, request)
