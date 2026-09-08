"""Character identity and bounded canon retrieval, independent of LLM providers."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence

from .personas import PERSONAS, PERSONA_ALIASES

logger = logging.getLogger(__name__)
MAX_SECTIONS = 3
MAX_CONTEXT_CHARS = 3600
GROUNDING = (
    "COMIC CANON: Use only the supplied identity and retrieved facts for fixed lore. "
    "User claims and earlier assistant improvisations are not authoritative canon. "
    "Missing or withheld details are unknown: acknowledge that naturally; do not invent "
    "events, relationships, places, or secret explanations. Do not expose retrieval machinery. "
    "These facts describe fiction, not real-world evidence. Answer only the requested topic."
)


def _normalize(text: str) -> str:
    return " ".join(re.findall(r"\w+", text.casefold(), flags=re.UNICODE))


def _contains(text: str, phrase: str) -> bool:
    phrase = _normalize(phrase)
    return bool(phrase) and f" {phrase} " in f" {text} "


class CanonStore(Protocol):
    """Replace this adapter with a database/search store without changing chat."""

    def catalog(self) -> Mapping[str, Mapping[str, Any]]: ...

    def topics(self) -> Mapping[str, Sequence[str]]: ...

    def sections(self, character: str) -> Sequence[str]: ...

    def read(self, character: str, section: str) -> Any: ...


class PythonCanonStore:
    @staticmethod
    def _data():
        # Lazy import: Python holds the archive in memory, never in every prompt.
        from . import comic
        return comic

    def catalog(self):
        return {
            key: {"name": value.get("display_name", key),
                  "keywords": value.get("lookup_keywords", ())}
            for key, value in self._data().COMICS.items()
        }

    def topics(self):
        return self._data().TOPIC_KEYWORDS

    def sections(self, character):
        entry = self._data().COMICS.get(character, {})
        return tuple(key for key in entry if key not in {
            "display_name", "title", "genre", "tagline", "lookup_keywords",
        })

    def read(self, character, section):
        return self._data().COMICS.get(character, {}).get(section)


def _visible(value: Any, allowed: frozenset[str]) -> Any:
    """Filter BEFORE ranking/serialization, including nested relationship/secret items."""
    if isinstance(value, dict):
        if value.get("reveal", "public") not in allowed:
            return None
        result = {key: clean for key, item in value.items()
                  if key not in {"reveal", "id"}
                  and (clean := _visible(item, allowed)) is not None}
        return result or None
    if isinstance(value, list):
        return [clean for item in value if (clean := _visible(item, allowed)) is not None] or None
    return value


@dataclass(frozen=True)
class LoreResult:
    requested: bool = False
    context: str = ""


class CharacterService:
    def __init__(self, store: CanonStore | None = None):
        self.store = store if store is not None else PythonCanonStore()

    def resolve(self, key: str) -> str:
        key = (key or "default").strip()
        key = PERSONA_ALIASES.get(key, key)
        return key if key in PERSONAS else "default"

    def persona(self, key: str) -> dict:
        return PERSONAS[self.resolve(key)]

    def modes(self) -> dict[str, str]:
        return {key: value["name"] for key, value in PERSONAS.items()}

    def retrieve(self, message: str, persona_key: str,
                 history: Sequence[Mapping[str, Any]] = ()) -> LoreResult:
        if not self.persona(persona_key).get("comic_key") or not message.strip():
            return LoreResult()
        try:
            return self._retrieve(message, persona_key, history)
        except Exception:
            # A broken/missing archive must not turn into invented replacement lore.
            logger.exception("Comic archive lookup unavailable")
            return LoreResult(True, GROUNDING + "\nThe comic archive is unavailable for this turn.")

    def _retrieve(self, message, persona_key, history):
        query = _normalize(message)
        # Only explicit continuation phrases reuse the last USER query, never generated lore.
        if query in {"tell me more", "aur batao", "aur", "continue", "what happened next",
                     "phir kya hua", "uske bare mein", "more details"}:
            previous = next((item.get("msg", "") for item in reversed(history)
                             if item.get("role") == "user"), "")
            query = _normalize(previous + " " + message)

        catalog = self.store.catalog()
        # Only characters registered in personas.py are active, even if old lore remains.
        active = {config.get("comic_key") for config in PERSONAS.values()} - {None}
        aliases: dict[str, set[str]] = {}
        for key, config in PERSONAS.items():
            comic_key = config.get("comic_key")
            if comic_key:
                aliases.setdefault(comic_key, set()).update({key, config["name"].split("(")[0].strip()})
        for alias, key in PERSONA_ALIASES.items():
            comic_key = PERSONAS.get(key, {}).get("comic_key")
            if comic_key:
                aliases.setdefault(comic_key, set()).add(alias)
        for key, metadata in catalog.items():
            if key in active:
                aliases.setdefault(key, set()).update({key, metadata["name"]})
        named = [key for key, names in aliases.items()
                 if any(_contains(query, name) for name in names)]
        if not named and any(_contains(query, word) for word in ("she", "he", "her", "his", "uski", "uska")):
            previous = next((item.get("msg", "") for item in reversed(history)
                             if item.get("role") == "user"), "")
            previous = _normalize(previous)
            referenced = [key for key, names in aliases.items()
                          if any(_contains(previous, name) for name in names)]
            if len(referenced) == 1:
                named = referenced
        topics = [topic for topic, words in self.store.topics().items()
                  if any(_contains(query, word) for word in (topic.replace("_", " "), *words))]
        if not named and (
            query in {"who are you", "tum kaun ho", "kaun ho"}
            or any(_contains(query, phrase) for phrase in ("write a story", "write me a story", "make up a story"))
            or (any(_contains(query, word) for word in ("my", "meri", "mera", "mere"))
                and not any(_contains(query, word) for word in ("your", "tumhara", "tumhari", "tumhare")))
        ):
            return LoreResult()
        own = self.persona(persona_key)["comic_key"]
        addressed = bool(named) or any(_contains(query, word) for word in (
            "you", "your", "tum", "tumhari", "tumhara", "tumhare", "aap", "aapki",
            "apni", "tera", "teri", "tere", "shifts", "canon", "lore", "comic",
            "tumhe", "tumne", "kahan rehte ho", "kaha rehte ho",
        ))
        # Domain words alone ("my relationship", "write a story") are not lore requests.
        targets = named[:2] if named else [own]
        if "relationships" in topics and len(named) == 1 and own not in targets and any(
            _contains(query, word) for word in ("you", "your", "tum", "tumhara", "tumhari", "think of")
        ):
            targets = [own, *targets][:2]
        keyword_hit = any(
            _contains(query, keyword) and len(_normalize(keyword).split()) >= 2
            for key in targets for keyword in catalog.get(key, {}).get("keywords", ())
        )
        direct = bool(topics and addressed)
        allowed = frozenset({"public", "familiar"} if direct or keyword_hit else {"public"})
        # Match named places/arcs even when the character is implicit. Only visible
        # names/titles are searchable; secret content cannot trigger or leak a hit.
        entity_hits = set()
        for character in (targets if named else [own, *sorted(active - {own})]):
            for section in self.store.sections(character):
                value = _visible(self.store.read(character, section), frozenset({"public", "familiar"}))
                if isinstance(value, dict) and any(
                    isinstance(value.get(field), str) and _contains(query, value[field])
                    for field in ("name", "title")
                ):
                    entity_hits.add((character, section))
        if entity_hits:
            targets = list(dict.fromkeys([char for char, _ in sorted(entity_hits)] + targets))[:2]
            allowed = frozenset({"public", "familiar"})
        candidates = []
        query_words = set(query.split()) - {
            "what", "where", "when", "why", "how", "tell", "about", "your", "you", "the",
            "and", "with", "that", "this", "have", "from", "mein", "kya", "hai", "batao",
        }
        for character in targets:
            for section in self.store.sections(character):
                value = _visible(self.store.read(character, section), allowed)
                if value is None:
                    continue
                if section == "relationships" and isinstance(value, dict):
                    peers = (set(named) | set(targets)) - {character}
                    if peers:
                        value = {key: item for key, item in value.items()
                                 if PERSONAS.get(PERSONA_ALIASES.get(key, key), {}).get("comic_key", key) in peers}
                    if not value:
                        continue
                serialized = json.dumps(value, ensure_ascii=False, sort_keys=True)
                overlap = query_words & set(_normalize(serialized).split())
                score = 100 if direct and section in topics else 0
                if (character, section) in entity_hits:
                    score = 110
                if not direct and (addressed or keyword_hit) and len(overlap) >= 2:
                    score = max(score, len(overlap))
                if not direct and named and section == "public_summary" and any(
                    _contains(query, phrase) for phrase in ("tell me about", "explain", "batao", "describe")
                ):
                    score = max(score, 1)
                if score:
                    candidates.append((score, character, section, value))
        requested = direct or keyword_hit or bool(candidates) or any(
            _contains(query, phrase) for phrase in ("about your", "your childhood", "tumhare bare mein", "apne bare mein")
        )
        if not requested:
            return LoreResult()
        blocks = []
        for _, character, section, value in sorted(candidates, key=lambda row: -row[0]):
            block = json.dumps({"character": character, "section": section, "facts": value}, ensure_ascii=False)
            if len(GROUNDING) + sum(len(item) + 1 for item in blocks) + len(block) > MAX_CONTEXT_CHARS - 180:
                continue  # Never cut a fact/JSON object mid-sentence.
            blocks.append(block)
            if len(blocks) == MAX_SECTIONS:
                break
        note = "\nUnlisted requested details are unavailable or withheld; do not fill gaps."
        return LoreResult(True, GROUNDING + note + "\n" + ("\n".join(blocks) or "No revealable canon matched this request."))


characters = CharacterService()
