"""Route regression tests. Providers and memory are stubbed; no external calls."""

import importlib.util
import io
import sys
import types
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
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
    with TestClient(module.app) as client:
        yield client, handler, module


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (2, 2), "blue").save(output, format="PNG")
    return output.getvalue()


def test_conversations_and_users_have_separate_context(api):
    client, handler, _ = api
    scopes = []
    for user, conversation in [("alice", "chat-a"), ("alice", "chat-b"), ("bob", "chat-a"), ("alice", "chat-a")]:
        response = client.post("/chat", json={"message": "Hello"}, headers={"x-user-id": user, "x-conversation-id": conversation})
        assert response.status_code == 200
        scopes.append(handler.generate_response.call_args.kwargs["user_id"])
    assert len(set(scopes[:3])) == 3
    assert scopes[0] == scopes[3]


def test_legacy_client_keeps_user_scope(api):
    client, handler, _ = api
    assert client.post("/chat", json={"message": "Hello"}, headers={"x-user-id": "alice"}).status_code == 200
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


@pytest.mark.parametrize("content,message", [(b"not an image", "Hello"), (b"x" * (5 * 1024 * 1024 + 1), "Hello"), (b"irrelevant", "x" * 2001)])
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
