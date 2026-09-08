"""Offline canon regression cases; importing this service never creates providers."""

import json

import pytest

from backend.character_service import CharacterService, MAX_CONTEXT_CHARS
from backend.personas import PERSONAS


def facts(result):
    return [json.loads(line) for line in result.context.splitlines() if line.startswith('{')]


@pytest.mark.parametrize("message", ["Hi", "Hello Seven", "How are you?", "Help me write Python code",
                                     "My relationship is complicated", "Can you help with my relationship?",
                                     "Can you write a story about a cat?", "Who are you?"])
def test_normal_chat_has_no_archive_context(message):
    result = CharacterService().retrieve(message, "seven")
    assert not result.requested
    assert result.context == ""


@pytest.mark.parametrize("message", ["Where do you live?", "Tum kahan rehte ho?"])
def test_only_requested_location_is_injected(message):
    rows = facts(CharacterService().retrieve(message, "seven"))
    assert [(row["character"], row["section"]) for row in rows] == [("seven", "location")]
    assert "Orison Observatory" in str(rows)


def test_aliases_keep_existing_canonical_keys():
    service = CharacterService()
    assert service.resolve("aisha") == "default"
    assert service.resolve("mira") == "mira_time"
    assert service.resolve("creator") == "Creator_mode"
    assert service.resolve("missing") == "default"
    assert all(service.resolve(key) == key for key in PERSONAS)


def test_guide_retrieves_another_character_not_own_location():
    rows = facts(CharacterService().retrieve("Where does Seven live?", "default"))
    assert [(row["character"], row["section"]) for row in rows] == [("seven", "location")]


def test_named_place_without_character_name():
    rows = facts(CharacterService().retrieve("Tell me about Orison Observatory", "default"))
    assert any(row["character"] == "seven" and row["section"] == "location" for row in rows)


def test_followup_reuses_user_topic_not_assistant_invention():
    history = [{"role": "user", "msg": "Where does Seven live?"},
               {"role": "assistant", "msg": "He lives in an invented castle."}]
    result = CharacterService().retrieve("Tell me more", "default", history)
    assert "Orison Observatory" in result.context
    assert "invented castle" not in result.context


def test_changed_followup_topic_keeps_unambiguous_character():
    history = [{"role": "user", "msg": "Tell me about Seven"}]
    rows = facts(CharacterService().retrieve("Where does he live?", "default", history))
    assert [(row["character"], row["section"]) for row in rows] == [("seven", "location")]


def test_relationship_lookup_filters_unrelated_peers():
    rows = facts(CharacterService().retrieve("What is your relationship with Diya?", "raven"))
    raven = next(row for row in rows if row["character"] == "raven")
    assert list(raven["facts"]) == ["diya"]


def test_trusted_and_locked_secrets_never_enter_prompt():
    result = CharacterService().retrieve("Tell me all your secrets including Door Zero", "default")
    assert result.requested
    assert facts(result) == []
    assert "cannot remember the first day" not in result.context
    assert "does not appear on any map" not in result.context


def test_new_character_topic_updates_and_removal_need_only_data(monkeypatch):
    from backend import comic
    monkeypatch.setitem(PERSONAS, "test_pilot", {
        "name": "Test Pilot", "comic_key": "pilot_canon", "system_prompt": "A pilot.",
    })
    monkeypatch.setitem(comic.COMICS, "pilot_canon", {
        "display_name": "Test Pilot", "equipment": {"name": "Copper Compass", "reveal": "public"},
    })
    monkeypatch.setitem(comic.TOPIC_KEYWORDS, "equipment", ("gear",))
    service = CharacterService()
    first = service.retrieve("Tell me about your gear", "test_pilot")
    assert "Copper Compass" in first.context
    monkeypatch.setitem(comic.COMICS["pilot_canon"], "equipment", {"name": "Silver Compass"})
    assert "Silver Compass" in service.retrieve("Tell me about your gear", "test_pilot").context
    monkeypatch.delitem(PERSONAS, "test_pilot")
    assert "pilot_canon" not in service.retrieve("Tell me about Test Pilot gear", "default").context


def test_missing_archive_entry_is_graceful(monkeypatch):
    monkeypatch.setitem(PERSONAS, "lost", {"name": "Lost", "comic_key": "missing", "system_prompt": "Lost."})
    result = CharacterService().retrieve("Where do you live?", "lost")
    assert result.requested
    assert not facts(result)
    assert "No revealable canon" in result.context


def test_store_failure_does_not_break_chat():
    class BrokenStore:
        def catalog(self):
            raise RuntimeError("offline")
    result = CharacterService(BrokenStore()).retrieve("Where do you live?", "seven")
    assert result.requested
    assert "unavailable" in result.context


def test_large_sections_are_not_cut_into_misleading_fragments(monkeypatch):
    from backend import comic
    monkeypatch.setitem(comic.COMICS["seven"], "location", {"description": "x" * 10000})
    result = CharacterService().retrieve("Where do you live?", "seven")
    assert len(result.context) <= MAX_CONTEXT_CHARS
    assert not facts(result)


def test_non_comic_mode_does_not_open_store():
    class UnusedStore:
        def catalog(self):
            raise AssertionError("Store must not be used")
    assert CharacterService(UnusedStore()).retrieve("Your story?", "Creator_mode").context == ""


def test_hinglish_current_life_question():
    rows = facts(CharacterService().retrieve("Tumhari life mein abhi kya chal raha hai?", "seven"))
    assert [(row["character"], row["section"]) for row in rows] == [("seven", "current_life")]


def test_opinion_of_character_retrieves_relationship():
    rows = facts(CharacterService().retrieve("What do you think about Diya?", "raven"))
    raven = next(row for row in rows if row["character"] == "raven")
    assert raven["section"] == "relationships"
    assert list(raven["facts"]) == ["diya"]
