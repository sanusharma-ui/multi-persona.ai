"""Exercise real auth verification against a mocked Supabase HTTP boundary."""
import asyncio

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.auth import authenticate


USER_ID = "3dbd608d-a59b-4ee2-b91e-e0d48108fd48"


def request(authorization="Bearer good-token"):
    return Request({"type": "http", "headers": [(b"authorization", authorization.encode()), (b"x-user-id", b"attacker")]})


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-key")
    state = {"status": 200, "body": {"id": USER_ID, "aud": "authenticated", "is_anonymous": False}, "calls": []}
    def handle(req):
        state["calls"].append(req)
        if state.get("timeout"):
            raise httpx.ReadTimeout("private-network-detail", request=req)
        return httpx.Response(state["status"], json=state["body"])
    original_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original_client(transport=httpx.MockTransport(handle), **kwargs))
    return state


def test_verified_identity_comes_only_from_provider(provider):
    assert asyncio.run(authenticate(request())) == USER_ID
    assert len(provider["calls"]) == 1
    call = provider["calls"][0]
    assert str(call.url) == "https://test.supabase.co/auth/v1/user"
    assert call.headers["Authorization"] == "Bearer good-token"
    assert call.headers["apikey"] == "public-key"


@pytest.mark.parametrize("header", ["", "Basic abc", "Bearer", "Bearer a b", "Bearer " + "x" * 16385])
def test_malformed_or_missing_token_never_calls_provider(provider, header):
    with pytest.raises(HTTPException) as failure:
        asyncio.run(authenticate(request(header)))
    assert failure.value.status_code == 401
    assert not provider["calls"]


@pytest.mark.parametrize("status,expected", [(401, 401), (403, 401), (429, 503), (500, 503)])
def test_rejected_expired_or_unavailable_provider_fails_closed(provider, status, expected):
    provider["status"] = status
    provider["body"] = {"message": "private-provider-detail"}
    with pytest.raises(HTTPException) as failure:
        asyncio.run(authenticate(request()))
    assert failure.value.status_code == expected
    assert "private-provider-detail" not in failure.value.detail


@pytest.mark.parametrize("body", [{"id": "../../victim", "aud": "authenticated"}, {}, None, [], {"id": USER_ID, "aud": "anon"}, {"id": USER_ID, "aud": "authenticated", "is_anonymous": True}])
def test_malformed_or_anonymous_identity_rejected(provider, body):
    provider["body"] = body
    with pytest.raises(HTTPException) as failure:
        asyncio.run(authenticate(request()))
    assert failure.value.status_code in (401, 503)


def test_network_timeout_does_not_leak_details(provider):
    provider["timeout"] = True
    with pytest.raises(HTTPException) as failure:
        asyncio.run(authenticate(request()))
    assert failure.value.status_code == 503
    assert "private-network-detail" not in failure.value.detail


def test_missing_configuration_does_not_fall_back_to_anonymous(provider, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL")
    with pytest.raises(HTTPException) as failure:
        asyncio.run(authenticate(request()))
    assert failure.value.status_code == 503
    assert not provider["calls"]
