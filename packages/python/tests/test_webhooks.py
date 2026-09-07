"""Verification is the one piece of this library that is a security boundary
rather than a convenience, so the tests are the attacks."""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest

from acyka import BadSignature, verify

SECRET = "acyw_0123456789abcdef"
BODY = json.dumps({"event": "list.saved", "data": {"shikimori_id": 21}})
NOW = 1_700_000_000


def sign(body: str, at: int, secret: str = SECRET) -> str:
    mac = hmac.new(secret.encode(), f"{at}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"t={at},v1={mac}"


def test_a_delivery_that_is_ours_comes_back_parsed():
    event = verify(body=BODY, signature=sign(BODY, NOW), secret=SECRET, now=NOW)
    assert event.event == "list.saved"
    assert event.data["shikimori_id"] == 21


def test_bytes_as_well_as_a_string():
    # A framework hands over bytes, and a client that only took `str` would make
    # every caller decode — which is the step where the body stops being raw.
    event = verify(body=BODY.encode(), signature=sign(BODY, NOW), secret=SECRET, now=NOW)
    assert event.event == "list.saved"


def test_a_body_edited_after_signing():
    signature = sign(BODY, NOW)
    tampered = json.dumps({"event": "list.saved", "data": {"shikimori_id": 22}})
    with pytest.raises(BadSignature):
        verify(body=tampered, signature=signature, secret=SECRET, now=NOW)


def test_a_signature_made_with_another_secret():
    with pytest.raises(BadSignature):
        verify(body=BODY, signature=sign(BODY, NOW, "acyw_someone_elses"), secret=SECRET, now=NOW)


def test_a_replay_of_a_real_delivery_from_an_hour_ago():
    # The whole reason the timestamp is inside the signed string: signing the
    # body alone gives a signature that never stops being valid.
    with pytest.raises(BadSignature, match="3600s old"):
        verify(body=BODY, signature=sign(BODY, NOW - 3600), secret=SECRET, now=NOW)


def test_a_delivery_from_the_future_which_is_a_clock_somebody_chose():
    with pytest.raises(BadSignature):
        verify(body=BODY, signature=sign(BODY, NOW + 3600), secret=SECRET, now=NOW)


def test_no_header_at_all():
    with pytest.raises(BadSignature, match="no signature header"):
        verify(body=BODY, signature=None, secret=SECRET, now=NOW)


@pytest.mark.parametrize("nonsense", ["", "deadbeef", "v1=deadbeef", "t=notanumber,v1=x"])
def test_a_header_in_some_other_shape(nonsense):
    with pytest.raises(BadSignature):
        verify(body=BODY, signature=nonsense, secret=SECRET, now=NOW)


def test_a_signature_of_the_right_length_that_is_wrong():
    # The constant-time compare's own case: same length, every byte wrong.
    wrong = f"t={NOW},v1={'0' * 64}"
    with pytest.raises(BadSignature, match="does not match"):
        verify(body=BODY, signature=wrong, secret=SECRET, now=NOW)


def test_the_tolerance_is_five_minutes_and_movable():
    verify(body=BODY, signature=sign(BODY, NOW - 290), secret=SECRET, now=NOW)
    older = sign(BODY, NOW - 310)
    with pytest.raises(BadSignature):
        verify(body=BODY, signature=older, secret=SECRET, now=NOW)
    # a caller who knows their queue is slow can say so
    verify(body=BODY, signature=older, secret=SECRET, now=NOW, tolerance=600)
