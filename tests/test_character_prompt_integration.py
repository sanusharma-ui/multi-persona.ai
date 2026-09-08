"""Exercise real prompt/generation code with offline providers and isolated memory."""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest


@pytest.fixture
def handler(monkeypatch, tmp_path):
    import dotenv
    import groq

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setattr(groq, "Groq", Mock())
    monkeypatch.setenv("GROQ_API_KEY", "offline-test-placeholder")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)
    spec = importlib.util.spec_from_file_location(
        "backend._test_groq_handler", Path(__file__).parents[1] / "backend" / "groq_handler.py",
    )
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, spec.name, module)
    spec.loader.exec_module(module)
    module.load_persona_memory = Mock(return_value={"user": {}, "conversations": []})
    module.save_persona_memory = Mock()
    module.get_memory_path = Mock(return_value=str(tmp_path / "memory.json"))
    module.emotion_engine = Mock()
    module.emotion_engine.get_injected_prompt.return_value = "Neutral delivery."
    module.emotion_engine.get_cache_signature.return_value = "neutral"
    module.is_user_rate_limited = Mock(return_value=False)
    module.call_llm_with_fallback = Mock(return_value="Grounded test reply.")
    module.fetch_knowledge_context = Mock(return_value={"found": False, "kb_sig": "none"})
    module.get_cached_response = Mock(return_value=None)
    module.set_cached_response = Mock()
    return module


def test_prompt_keeps_identity_and_only_requested_lore(handler):
    normal, _ = handler.build_messages("Hi", "seven")
    assert "COMIC CANON:" not in normal[0]["content"]
    assert "CHARACTER SOUL" not in normal[0]["content"]
    lore, _ = handler.build_messages("Where do you live?", "seven")
    system = lore[0]["content"]
    assert system.startswith(handler.characters.persona("seven")["system_prompt"])
    assert "Orison Observatory" in system
    assert '"section": "location"' in system
    assert '"section": "story_arc"' not in system


def test_alias_uses_canonical_memory_and_lore(handler):
    messages, _ = handler.build_messages("Where do you live?", "mira", user_id="reader")
    handler.load_persona_memory.assert_called_once_with("mira_time", user_id="reader")
    assert '"character": "mira_time"' in messages[0]["content"]


def test_lore_bypasses_web_but_general_knowledge_does_not(handler):
    handler.generate_response_impl("Where does Seven live?", "default")
    handler.fetch_knowledge_context.assert_not_called()
    messages = handler.call_llm_with_fallback.call_args.args[0]
    assert "Orison Observatory" in messages[0]["content"]
    handler.generate_response_impl("What is photosynthesis?", "default")
    handler.fetch_knowledge_context.assert_called_once_with("What is photosynthesis?")


def test_changed_lore_invalidates_response_cache(handler, monkeypatch):
    from backend import comic

    # Keep conversation/emotion fixed so only the changed canon can alter the key.
    handler.load_persona_memory.side_effect = lambda *args, **kwargs: {"user": {}, "conversations": []}
    handler.generate_response_impl("Where do you live?", "seven")
    first_key = handler.get_cached_response.call_args.args[0]
    monkeypatch.setitem(comic.COMICS["seven"], "location", {"name": "Updated Observatory", "reveal": "public"})
    handler.generate_response_impl("Where do you live?", "seven")
    second_key = handler.get_cached_response.call_args.args[0]
    assert first_key != second_key
    assert "Updated Observatory" in handler.call_llm_with_fallback.call_args.args[0][0]["content"]
