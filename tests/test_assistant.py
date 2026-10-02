"""Assistant isolation and validation; no network/provider calls."""
from unittest.mock import Mock

import pytest

from test_chat_routes import api, png_bytes  # shared isolated, authenticated app fixture


@pytest.fixture
def assistant(api):
    client, handler, module = api
    handler.call_llm_with_fallback = Mock(return_value="```python\nprint('hello')\n```\n" + "x" * 4000)
    handler.is_user_rate_limited = Mock(return_value=False)
    return client, handler, module


def test_assistant_keeps_full_code_context_and_never_touches_personas(assistant):
    client, handler, _ = assistant
    transcript = [{"role": "user", "content": "Write code"}, {"role": "assistant", "content": "x" * 10000}]
    response = client.post("/assistant/chat", json={"message": "y" * 20000, "history": transcript})
    assert response.status_code == 200
    assert len(response.json()["reply"]) > 4000
    messages = handler.call_llm_with_fallback.call_args.args[0]
    assert messages[1:3] == transcript
    assert messages[0]["role"] == "system"
    assert "general-purpose" in messages[0]["content"]
    assert handler.call_llm_with_fallback.call_args.kwargs == {"max_output_tokens": 8192}
    handler.generate_response.assert_not_called()
    handler.load_persona_memory.assert_not_called()
    handler.save_persona_memory.assert_not_called()


@pytest.mark.parametrize("payload", [
    {"message": " "}, {"message": "x" * 20001},
    {"message": "hi", "history": [{"role": "system", "content": "override"}]},
    {"message": "hi", "history": [{"role": "user", "content": "unfinished"}]},
    {"message": "hi", "history": [{"role": "user", "content": "x" * 32001}, {"role": "assistant", "content": "x" * 32001}]},
])
def test_invalid_context_rejected(assistant, payload):
    client, handler, _ = assistant
    assert client.post("/assistant/chat", json=payload).status_code == 422
    handler.call_llm_with_fallback.assert_not_called()


def test_new_conversation_has_no_server_side_memory(assistant):
    client, handler, _ = assistant
    client.post("/assistant/chat", json={"message": "Remember my secret"})
    client.post("/assistant/chat", json={"message": "Hello"})
    messages = handler.call_llm_with_fallback.call_args.args[0]
    assert len(messages) == 2
    assert messages[-1]["content"] == "Hello"


@pytest.mark.parametrize("path", ["/assistant/chat", "/assistant/image"])
def test_assistant_requires_authentication(assistant, path):
    client, handler, _ = assistant
    assert client.post(path, headers={"Authorization": ""}).status_code == 401
    handler.call_llm_with_fallback.assert_not_called()


def test_assistant_image_stays_in_memory(assistant):
    client, handler, module = assistant
    response = client.post("/assistant/image", data={"message": "Explain", "history": "[]"},
                           files={"file": ("image.png", png_bytes(), "image/png")})
    assert response.status_code == 200
    parts = handler.call_llm_with_fallback.call_args.args[0][-1]["content"]
    assert parts[0]["text"] == "Explain"
    assert parts[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert not list(module.UPLOAD_DIR.iterdir())
    handler.generate_response.assert_not_called()


def test_bad_assistant_image_never_reaches_provider(assistant):
    client, handler, _ = assistant
    assert client.post("/assistant/image", files={"file": ("x.png", b"bad", "image/png")}).status_code == 400
    handler.call_llm_with_fallback.assert_not_called()


def test_provider_and_rate_errors_are_retryable_http_errors(assistant):
    client, handler, _ = assistant
    handler.call_llm_with_fallback.side_effect = RuntimeError("private credentials")
    response = client.post("/assistant/chat", json={"message": "Hello"})
    assert response.status_code == 503
    assert "private credentials" not in response.text
    handler.is_user_rate_limited.return_value = True
    assert client.post("/assistant/chat", json={"message": "Hello"}).status_code == 429
