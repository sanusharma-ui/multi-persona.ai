"""Route regression tests. Providers and memory are stubbed; no external calls."""

import importlib.util
import io
import sys
import types
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from PIL import Image


@pytest.fixture
def api(monkeypatch, tmp_path):
    handler = types.ModuleType("backend.groq_handler")
    handler.PERSONAS = {"default": {"name": "Aisha"}, "neo": {"name": "Neo"}}
    handler.generate_response = Mock(return_value="Test response")
    handler.ensure_persona_memory = Mock()
    handler.load_persona_memory = Mock(return_value={"user": {}, "conversations": []})
    handler.save_persona_memory = Mock()
    monkeypatch.setitem(sys.modules, "backend.groq_handler", handler)
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(tmp_path))
    spec = importlib.util.spec_from_file_location("isolated_chat_routes", Path(__file__).parents[1] / "backend" / "main.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    async def verified_account(request):
        token = request.headers.get("authorization", "")
        if token not in {"Bearer alice", "Bearer bob"}:
            raise HTTPException(401, "Please sign in to continue.")
        return token.removeprefix("Bearer ")
    monkeypatch.setattr(module, "authenticate", verified_account)
    with TestClient(module.app) as client:
        client.headers["Authorization"] = "Bearer alice"
        yield client, handler, module


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (2, 2), "blue").save(output, format="PNG")
    return output.getvalue()


def test_conversations_and_users_have_separate_context(api):
    client, handler, _ = api
    scopes = []
    for user, conversation in [("alice", "chat-a"), ("alice", "chat-b"), ("bob", "chat-a"), ("alice", "chat-a")]:
        response = client.post("/chat", json={"message": "Hello"}, headers={"Authorization": f"Bearer {user}", "x-conversation-id": conversation})
        assert response.status_code == 200
        scopes.append(handler.generate_response.call_args.kwargs["user_id"])
    assert len(set(scopes[:3])) == 3
    assert scopes[0] == scopes[3]


def test_client_cannot_spoof_verified_user_scope(api):
    client, handler, _ = api
    assert client.post("/chat", json={"message": "Hello"}, headers={"x-user-id": "bob"}).status_code == 200
    assert handler.generate_response.call_args.kwargs["user_id"] == "alice"


def test_invalid_conversation_rejected_before_generation(api):
    client, handler, _ = api
    response = client.post("/chat", json={"message": "Hello"}, headers={"x-conversation-id": "../invalid"})
    assert response.status_code == 400
    handler.generate_response.assert_not_called()


def test_image_form_prompt_language_and_cleanup(api):
    client, handler, module = api
    response = client.post("/chat/image?mode=neo", data={"message": "What color is this?", "language": "hi"},
                           files={"file": ("image.png", png_bytes(), "image/png")},
                           headers={"x-user-id": "alice", "x-conversation-id": "chat-a"})
    assert response.status_code == 200
    args = handler.generate_response.call_args.kwargs
    assert args["user_message"] == "What color is this?"
    assert args["language"] == "hi"
    assert args["persona_key"] == "neo"
    assert not Path(args["image_path"]).exists()
    assert not list(module.UPLOAD_DIR.iterdir())
    assert "image_path" not in response.json()
    assert "filename" not in response.json()


@pytest.mark.parametrize("method,path", [("POST", "/chat"), ("POST", "/chat/image"), ("GET", "/memory"), ("POST", "/memory/update"), ("GET", "/uploads/private.png")])
def test_private_routes_require_auth_before_side_effects(api, method, path):
    client, handler, _ = api
    response = client.request(method, path, headers={"Authorization": "", "x-user-id": "alice"})
    assert response.status_code == 401
    handler.generate_response.assert_not_called()
    handler.load_persona_memory.assert_not_called()
    handler.save_persona_memory.assert_not_called()


def test_public_routes_do_not_create_anonymous_memory(api):
    client, handler, _ = api
    for path in ["/", "/health", "/modes/list"]:
        assert client.get(path, headers={"Authorization": ""}).status_code == 200
    handler.ensure_persona_memory.assert_not_called()


def test_memory_uses_verified_identity(api):
    client, handler, _ = api
    response = client.get("/memory", headers={"Authorization": "Bearer bob", "x-user-id": "alice"})
    assert response.status_code == 200
    handler.load_persona_memory.assert_called_once_with("default", user_id="bob")
    response = client.post("/memory/update", json={"name": "Bob"}, headers={"Authorization": "Bearer bob", "x-user-id": "alice"})
    assert response.status_code == 200
    assert handler.save_persona_memory.call_args.kwargs["user_id"] == "bob"


def test_cors_preflight_and_auth_failure(api):
    client, _, _ = api
    origin = "http://localhost:5173"
    response = client.options("/chat", headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    response = client.post("/chat", headers={"Origin": origin, "Authorization": ""})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("content,message", [(b"not an image", "Hello"), (b"x" * (5 * 1024 * 1024 + 1), "Hello"), (b"irrelevant", "x" * 2001)],
                         ids=["invalid-image", "oversized-image", "oversized-message"])
def test_invalid_upload_never_reaches_provider(api, content, message):
    client, handler, module = api
    response = client.post("/chat/image", data={"message": message}, files={"file": ("image.png", content, "image/png")})
    assert response.status_code == 400
    handler.generate_response.assert_not_called()
    assert not list(module.UPLOAD_DIR.iterdir())


def test_provider_failure_cleans_upload_and_hides_internal_error(api):
    client, handler, module = api
    handler.generate_response.side_effect = RuntimeError("private-provider-detail")
    response = client.post("/chat/image", files={"file": ("image.png", png_bytes(), "image/png")})
    assert response.status_code == 500
    assert "private-provider-detail" not in response.text
    assert not list(module.UPLOAD_DIR.iterdir())


def test_legacy_image_query_and_shared_text_image_scope(api):
    client, handler, _ = api
    headers = {"x-user-id": "alice", "x-conversation-id": "chat-a"}
    assert client.post("/chat", json={"message": "Hello"}, headers=headers).status_code == 200
    text_scope = handler.generate_response.call_args.kwargs["user_id"]
    response = client.post("/chat/image?message=Describe%20colors&language=hi", headers=headers,
                           files={"file": ("image.png", png_bytes(), "image/png")})
    assert response.status_code == 200
    args = handler.generate_response.call_args.kwargs
    assert args["user_id"] == text_scope
    assert args["user_message"] == "Describe colors"
    assert args["language"] == "hi"
