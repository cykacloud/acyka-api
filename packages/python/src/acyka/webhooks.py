"""Checking that a delivery came from us.

Thirty lines, every one of which is a line somebody gets wrong when they write it
themselves — which is why it is in the library rather than in the documentation.

The three that matter:

* **the raw body, not a parsed one.** The signature covers the bytes that were
  sent. ``json.loads`` and then ``json.dumps`` gives a different string the
  moment key order or number formatting differs, and the check then fails for
  good reasons that look like bad ones.
* **a constant-time compare.** ``a == b`` on strings returns as soon as two
  characters differ, and how long that took measures how much of the signature
  was right — a hundred requests per byte, and a forgeable signature at the end
  of it. ``hmac.compare_digest`` does not.
* **the timestamp.** The signed string is ``<t>.<body>``, so a captured delivery
  signs valid for ever unless somebody checks how old ``t`` is.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any


class BadSignature(Exception):
    """A delivery that is not ours, or not this minute's."""

    def __init__(self, why: str) -> None:
        super().__init__(f"the webhook signature did not check out: {why}")


@dataclass(frozen=True, slots=True)
class Delivery:
    #: which kind — ``list.saved``, ``episode.aired``, and five more
    event: str
    #: the row that moved, in this door's snake_case
    data: Any


def _parts(header: str) -> tuple[int, str] | None:
    """``t=1700000000,v1=<hex>`` as its two halves."""
    at: int | None = None
    mac: str | None = None
    for piece in header.split(","):
        key, _, value = piece.partition("=")
        key, value = key.strip(), value.strip()
        if key == "t":
            try:
                at = int(value)
            except ValueError:
                return None
        elif key == "v1":
            mac = value
    return (at, mac) if at is not None and mac else None


def verify(
    *,
    body: str | bytes,
    signature: str | None,
    secret: str,
    tolerance: int = 300,
    now: float | None = None,
) -> Delivery:
    """The delivery, or a :class:`BadSignature`.

    ::

        event = verify(
            body=request.get_data(),          # the raw bytes, before any parsing
            signature=request.headers.get("X-Acyka-Signature"),
            secret=os.environ["ACYKA_WEBHOOK_SECRET"],
        )
    """
    if not signature:
        raise BadSignature("there was no signature header")

    said = _parts(signature)
    if said is None:
        raise BadSignature("the header was not `t=…,v1=…`")
    at, mac = said

    seconds = int(now if now is not None else time.time())
    # Both directions. A delivery from the future is a clock that is wrong, and
    # accepting it would mean accepting one whose ``t`` an attacker chose.
    if abs(seconds - at) > tolerance:
        raise BadSignature(f"it is {abs(seconds - at)}s old, and the tolerance is {tolerance}s")

    raw = body.encode() if isinstance(body, str) else body
    signed = hmac.new(secret.encode(), f"{at}.".encode() + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signed, mac):
        raise BadSignature("it does not match the body")

    said_json = json.loads(raw)
    return Delivery(event=said_json.get("event", ""), data=said_json.get("data"))
