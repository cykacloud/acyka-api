"""All four ways to hold a token, and the one thing they have in common.

An access token lives an hour. A library that makes its caller notice that is a
library whose callers each write the same refresh-and-retry loop, slightly
differently — and one of them gets the concurrent case wrong and sends two
refreshes for one expiry, which, because refresh tokens here **rotate and a
reuse kills the family**, signs their users out. So the loop is written once and
``fresh()`` is the whole of what the transport knows about auth.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Protocol
from urllib.parse import urlencode

import httpx

from .errors import AcykaError, Unauthorized

AUTHORIZE = "https://acyka.cc/api/oauth2/authorize"
TOKEN = "https://acyka.cc/api/oauth2/token"
DEVICE = "https://acyka.cc/api/oauth2/device_authorization"


@dataclass(frozen=True, slots=True)
class Endpoints:
    """Where the provider lives. Overridable for a laptop, fixed in practice."""

    authorize: str = AUTHORIZE
    token: str = TOKEN
    device: str = DEVICE


ACYKA = Endpoints()


@dataclass(slots=True)
class Tokens:
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 3600
    scope: str = ""
    refresh_token: str | None = None
    id_token: str | None = None
    #: when the access token stops being usable, worked out on arrival
    expires_at: float = field(default=0.0)

    def __post_init__(self) -> None:
        if not self.expires_at:
            # Sixty seconds early: a token that expires while a request is in
            # flight is a 401 the caller did nothing to deserve, and clock skew
            # between two machines is measured in seconds.
            self.expires_at = time.time() + max(self.expires_in - 60, 0)

    @property
    def live(self) -> bool:
        return bool(self.access_token) and self.expires_at > time.time()

    @classmethod
    def _parse(cls, raw: dict[str, Any]) -> "Tokens":
        return cls(
            access_token=raw["access_token"],
            token_type=raw.get("token_type", "Bearer"),
            expires_in=int(raw.get("expires_in", 3600)),
            scope=raw.get("scope", ""),
            refresh_token=raw.get("refresh_token"),
            id_token=raw.get("id_token"),
        )

    @property
    def scopes(self) -> list[str]:
        return self.scope.split() if self.scope else []


#: Told whenever a token set is replaced, so a caller can put it somewhere.
#:
#: A refresh token **rotates**: the one handed back is the one to keep, and the
#: one that was sent is dead. Storing the original for ever leaves a credential
#: that stops working — and presenting it again is what the server reads as
#: theft, which kills the whole chain.
Keeper = Callable[[Tokens], None]


class Auth(Protocol):
    """What the transport asks of an auth."""

    def fresh(self) -> str: ...

    async def afresh(self) -> str: ...

    def forget(self) -> None: ...

    def scopes(self) -> list[str]: ...


def _refused(response: httpx.Response, endpoint: str) -> AcykaError:
    # The token endpoint speaks RFC 6749 rather than this api's own error shape
    # — ``{"error": "invalid_grant"}`` — because every OAuth library ever
    # written reads that field and nothing else.
    try:
        said = response.json()
    except ValueError:
        said = {}
    return AcykaError(
        response.status_code,
        {
            "message": said.get("error", f"HTTP {response.status_code}"),
            "error_description": said.get("error_description", ""),
        },
        ("POST", endpoint),
    )


def _form(
    client_id: str,
    client_secret: str | None,
    form: dict[str, str],
) -> tuple[dict[str, str], dict[str, str]]:
    headers = {"accept": "application/json"}
    if client_secret:
        # ``client_secret_basic`` rather than the body. Both are in the spec and
        # the api takes either; a header is the one that does not end up in a
        # proxy's access log beside the request line.
        pair = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers["authorization"] = f"Basic {pair}"
    else:
        form = {**form, "client_id": client_id}
    return headers, form


class BearerToken:
    """A token somebody else obtained and handed over.

    No refresh: when it runs out it runs out, and the caller finds out with an
    :class:`~acyka.errors.Unauthorized` rather than having a credential swapped
    underneath them.
    """

    def __init__(self, token: str, granted: Iterable[str] = ()) -> None:
        self._token = token
        self._granted = list(granted)

    def fresh(self) -> str:
        if not self._token:
            raise Unauthorized(401, {"message": "errors.unauthorized"}, ("", ""))
        return self._token

    async def afresh(self) -> str:
        return self.fresh()

    def forget(self) -> None:
        self._token = ""

    def scopes(self) -> list[str]:
        return self._granted


class AppOnly:
    """An application acting for itself.

    No person, no consent screen, no refresh token — there is nothing to
    refresh, because the application can ask for another whenever it likes.

    Only the scopes that are about nobody can be held this way:
    ``catalog:read`` and ``people:read``. Asking for ``lists:read`` here is
    refused at the door rather than minted and then refused by every route.
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        scopes: Iterable[str] = (),
        endpoints: Endpoints = ACYKA,
    ) -> None:
        self._id = client_id
        self._secret = client_secret
        self._asked = list(scopes)
        self._where = endpoints
        self._held: Tokens | None = None
        self._lock = threading.Lock()
        self._alock: asyncio.Lock | None = None

    def _request(self) -> tuple[dict[str, str], dict[str, str]]:
        form = {"grant_type": "client_credentials"}
        if self._asked:
            form["scope"] = " ".join(self._asked)
        return _form(self._id, self._secret, form)

    def fresh(self) -> str:
        if self._held and self._held.live:
            return self._held.access_token
        with self._lock:
            if self._held and self._held.live:
                return self._held.access_token
            headers, form = self._request()
            response = httpx.post(self._where.token, headers=headers, data=form, timeout=30)
            if response.is_error:
                raise _refused(response, self._where.token)
            self._held = Tokens._parse(response.json())
            return self._held.access_token

    async def afresh(self) -> str:
        if self._held and self._held.live:
            return self._held.access_token
        # Made here rather than in ``__init__``: a lock belongs to the loop it
        # was created on, and a client built before the loop exists would hand
        # every task a lock from the wrong one.
        if self._alock is None:
            self._alock = asyncio.Lock()
        async with self._alock:
            if self._held and self._held.live:
                return self._held.access_token
            headers, form = self._request()
            async with httpx.AsyncClient(timeout=30) as http:
                response = await http.post(self._where.token, headers=headers, data=form)
            if response.is_error:
                raise _refused(response, self._where.token)
            self._held = Tokens._parse(response.json())
            return self._held.access_token

    def forget(self) -> None:
        self._held = None

    def scopes(self) -> list[str]:
        return self._held.scopes if self._held else self._asked


class UserToken:
    """A token that acts for a person, kept alive by its refresh token.

    The refresh is **serialised**, which is the whole reason this is a class
    rather than a helper. Four requests that all notice the expiry at once must
    send one refresh between them: the tokens rotate, so two refreshes means the
    second presents one the first has already retired — and the server's only
    safe reading of that is theft. It kills the family, and the person is signed
    out of an application that did nothing wrong.
    """

    def __init__(
        self,
        client_id: str,
        tokens: Tokens,
        client_secret: str | None = None,
        keep: Keeper | None = None,
        endpoints: Endpoints = ACYKA,
    ) -> None:
        self._id = client_id
        self._secret = client_secret
        self._held = tokens
        self._keep = keep
        self._where = endpoints
        self._lock = threading.Lock()
        self._alock: asyncio.Lock | None = None

    @property
    def tokens(self) -> Tokens:
        """What is held, for a caller that stores it themselves."""
        return self._held

    def _request(self) -> tuple[dict[str, str], dict[str, str]]:
        if not self._held.refresh_token:
            raise Unauthorized(
                401,
                {
                    "message": "errors.unauthorized",
                    "error_description": "no refresh token — ask for offline_access",
                },
                ("POST", self._where.token),
            )
        return _form(
            self._id,
            self._secret,
            {"grant_type": "refresh_token", "refresh_token": self._held.refresh_token},
        )

    def _adopt(self, raw: dict[str, Any]) -> str:
        fresh = Tokens._parse(raw)
        # A refresh that answers without a new refresh token is one the server
        # did not rotate; keeping the old one is then right rather than a bug.
        fresh.refresh_token = fresh.refresh_token or self._held.refresh_token
        self._held = fresh
        if self._keep:
            self._keep(fresh)
        return fresh.access_token

    def fresh(self) -> str:
        if self._held.live:
            return self._held.access_token
        with self._lock:
            if self._held.live:
                return self._held.access_token
            headers, form = self._request()
            response = httpx.post(self._where.token, headers=headers, data=form, timeout=30)
            if response.is_error:
                raise _refused(response, self._where.token)
            return self._adopt(response.json())

    async def afresh(self) -> str:
        if self._held.live:
            return self._held.access_token
        if self._alock is None:
            self._alock = asyncio.Lock()
        async with self._alock:
            if self._held.live:
                return self._held.access_token
            headers, form = self._request()
            async with httpx.AsyncClient(timeout=30) as http:
                response = await http.post(self._where.token, headers=headers, data=form)
            if response.is_error:
                raise _refused(response, self._where.token)
            return self._adopt(response.json())

    def forget(self) -> None:
        # The access token, not the refresh one: forgetting is what happens after
        # a 401, and the refresh is the only way back.
        self._held.expires_at = 0.0

    def scopes(self) -> list[str]:
        return self._held.scopes


# ---------------------------- getting a user's token -------------------------


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


@dataclass(frozen=True, slots=True)
class Pkce:
    verifier: str
    challenge: str


def pkce() -> Pkce:
    """A fresh PKCE pair.

    **S256 and never ``plain``.** The api requires it of every client,
    confidential ones included, and offers only ``S256`` in its discovery
    document — a code that leaks from a log, a referer or a browser's history is
    then worth nothing without the verifier, which never leaves the client that
    made it.
    """
    verifier = _b64(os.urandom(32))
    return Pkce(verifier, _b64(hashlib.sha256(verifier.encode()).digest()))


def authorize_url(
    *,
    client_id: str,
    redirect_uri: str,
    scopes: Iterable[str],
    challenge: str,
    state: str | None = None,
    nonce: str | None = None,
    prompt: str | None = None,
    endpoints: Endpoints = ACYKA,
) -> tuple[str, str]:
    """Where to send somebody, and the ``state`` to compare on the way back.

    The state is returned rather than only taken, because a callback with
    nothing to compare against is a callback anybody can forge — so it is
    generated when it is not given, and there is no way to end up without one.
    """
    state = state or secrets.token_urlsafe(24)
    query: dict[str, str] = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes),
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
    }
    if nonce:
        query["nonce"] = nonce
    if prompt:
        query["prompt"] = prompt
    return f"{endpoints.authorize}?{urlencode(query)}", state


def exchange_code(
    *,
    client_id: str,
    code: str,
    redirect_uri: str,
    verifier: str,
    client_secret: str | None = None,
    endpoints: Endpoints = ACYKA,
) -> Tokens:
    """The code from the callback, for a token set."""
    headers, form = _form(
        client_id,
        client_secret,
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": verifier,
        },
    )
    response = httpx.post(endpoints.token, headers=headers, data=form, timeout=30)
    if response.is_error:
        raise _refused(response, endpoints.token)
    return Tokens._parse(response.json())


@dataclass(frozen=True, slots=True)
class DeviceStart:
    device_code: str
    #: the eight characters to put on the screen
    user_code: str
    verification_uri: str
    #: the same address with the code in it, for a QR
    verification_uri_complete: str
    expires_in: int
    #: the floor, in seconds, the server asked to be polled at
    interval: int


def start_device(
    *,
    client_id: str,
    scopes: Iterable[str],
    client_secret: str | None = None,
    endpoints: Endpoints = ACYKA,
) -> DeviceStart:
    """Ask for a code to show on something with no browser."""
    headers, form = _form(client_id, client_secret, {"scope": " ".join(scopes)})
    response = httpx.post(endpoints.device, headers=headers, data=form, timeout=30)
    if response.is_error:
        raise _refused(response, endpoints.device)
    raw = response.json()
    return DeviceStart(
        device_code=raw["device_code"],
        user_code=raw["user_code"],
        verification_uri=raw["verification_uri"],
        verification_uri_complete=raw.get("verification_uri_complete", raw["verification_uri"]),
        expires_in=int(raw.get("expires_in", 600)),
        interval=int(raw.get("interval", 5)),
    )


def await_device(
    *,
    client_id: str,
    device_code: str,
    interval: int = 5,
    client_secret: str | None = None,
    endpoints: Endpoints = ACYKA,
) -> Tokens:
    """Wait for the person to say yes, then hand back their tokens.

    The four names the server can answer with are the whole of what a poller
    needs, and this reads all four: ``authorization_pending`` means keep going,
    ``slow_down`` means keep going and wait longer, ``access_denied`` means
    somebody pressed cancel, and ``expired_token`` means nobody pressed
    anything. A client that cannot tell the first from the third polls into the
    expiry after the answer has already arrived.
    """
    headers, form = _form(
        client_id,
        client_secret,
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": device_code,
        },
    )
    wait = interval

    while True:
        time.sleep(wait)
        response = httpx.post(endpoints.token, headers=headers, data=form, timeout=30)
        if not response.is_error:
            return Tokens._parse(response.json())

        try:
            said = response.json().get("error", "")
        except ValueError:
            said = ""
        if said == "authorization_pending":
            continue
        if said == "slow_down":
            # The server saying the interval was too short. Five seconds more,
            # as the RFC suggests, rather than doubling — this is a person
            # walking to their phone, not a backoff.
            wait += 5
            continue
        raise _refused(response, endpoints.token)
