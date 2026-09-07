"""``acyka`` — a client for the `acyka <https://acyka.cc>`_ API.

::

    from acyka import Acyka

    # an application acting for itself: the catalogue, and public profiles
    with Acyka.app(client_id="acy_…", client_secret="…") as acyka:
        found = acyka.catalogue.list_titles(q="frieren", limit=5)
        for title in found:
            print(title.id, title.title, title.year)

        for title in acyka.catalogue.list_titles_all(genre="Drama"):
            print(title.title)

Everything under a namespace is generated from ``openapi.json``, which the
server writes from annotations on its own handlers. Everything else — the four
OAuth flows, the token that renews itself, the backoff that reads the server's
own numbers, the paginators, one exception per refusal, and the webhook check —
is written by hand, because none of it is a mechanical function of a document
and all of it is the difference between a client that is correct and one that is
pleasant.

Full documentation, with a playground: https://dev.acyka.cc
"""

from __future__ import annotations

from typing import Any, Iterable

from ._core import AsyncCore, Core, Options, Pace
from .auth import (
    ACYKA,
    AppOnly,
    Auth,
    BearerToken,
    DeviceStart,
    Endpoints,
    Keeper,
    Pkce,
    Tokens,
    UserToken,
    authorize_url,
    await_device,
    exchange_code,
    pkce,
    start_device,
)
from .errors import (
    AcykaError,
    BadRequest,
    Forbidden,
    NotFound,
    RateLimited,
    ServerError,
    Unauthorized,
    Unreachable,
)
from .models import *  # noqa: F401,F403
from .models import SCOPES, Page
from .namespaces import AsyncNamespaces, Namespaces
from .webhooks import BadSignature, Delivery, verify

__version__ = "1.0.0"


class Acyka(Namespaces):
    """The synchronous client."""

    def __init__(self, auth: Auth, options: Options | None = None) -> None:
        self.auth = auth
        self.core = Core(auth, options)
        super().__init__(self.core)

    @classmethod
    def app(
        cls,
        *,
        client_id: str,
        client_secret: str,
        scopes: Iterable[str] = ("catalog:read",),
        options: Options | None = None,
        endpoints: Endpoints = ACYKA,
    ) -> "Acyka":
        """An application acting for itself — a bot, a cron, anything with no
        person in front of it. Mints on demand and stores nothing.

        Only ``catalog:read`` and ``people:read`` can be held this way:
        everything else on this api is about somebody, and a
        ``client_credentials`` token has nobody to act for.
        """
        return cls(AppOnly(client_id, client_secret, scopes, endpoints), options)

    @classmethod
    def user(
        cls,
        *,
        client_id: str,
        tokens: Tokens,
        client_secret: str | None = None,
        keep: Keeper | None = None,
        options: Options | None = None,
        endpoints: Endpoints = ACYKA,
    ) -> "Acyka":
        """A token that acts for a person, kept alive by its refresh token.

        ``keep`` is told every time the set is replaced, and storing what it is
        handed is not optional: **refresh tokens rotate**, and presenting a
        retired one is what the server reads as theft — it kills the whole chain
        and signs the person out.
        """
        return cls(UserToken(client_id, tokens, client_secret, keep, endpoints), options)

    @classmethod
    def token(cls, access_token: str, options: Options | None = None) -> "Acyka":
        """A token somebody else obtained. No refresh."""
        return cls(BearerToken(access_token), options)

    def close(self) -> None:
        self.core.close()

    def __enter__(self) -> "Acyka":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


class AsyncAcyka(AsyncNamespaces):
    """The same client, awaited."""

    def __init__(self, auth: Auth, options: Options | None = None) -> None:
        self.auth = auth
        self.core = AsyncCore(auth, options)
        super().__init__(self.core)

    @classmethod
    def app(
        cls,
        *,
        client_id: str,
        client_secret: str,
        scopes: Iterable[str] = ("catalog:read",),
        options: Options | None = None,
        endpoints: Endpoints = ACYKA,
    ) -> "AsyncAcyka":
        return cls(AppOnly(client_id, client_secret, scopes, endpoints), options)

    @classmethod
    def user(
        cls,
        *,
        client_id: str,
        tokens: Tokens,
        client_secret: str | None = None,
        keep: Keeper | None = None,
        options: Options | None = None,
        endpoints: Endpoints = ACYKA,
    ) -> "AsyncAcyka":
        return cls(UserToken(client_id, tokens, client_secret, keep, endpoints), options)

    @classmethod
    def token(cls, access_token: str, options: Options | None = None) -> "AsyncAcyka":
        return cls(BearerToken(access_token), options)

    async def aclose(self) -> None:
        await self.core.aclose()

    async def __aenter__(self) -> "AsyncAcyka":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()


__all__ = [
    "ACYKA",
    "Acyka",
    "AcykaError",
    "AppOnly",
    "AsyncAcyka",
    "Auth",
    "BadRequest",
    "BadSignature",
    "BearerToken",
    "Delivery",
    "DeviceStart",
    "Endpoints",
    "Forbidden",
    "Keeper",
    "NotFound",
    "Options",
    "Pace",
    "Page",
    "Pkce",
    "RateLimited",
    "SCOPES",
    "ServerError",
    "Tokens",
    "Unauthorized",
    "Unreachable",
    "UserToken",
    "authorize_url",
    "await_device",
    "exchange_code",
    "pkce",
    "start_device",
    "verify",
]
