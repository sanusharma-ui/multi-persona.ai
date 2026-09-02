"""Canonical identifiers used at request and persistence boundaries."""

from typing import Optional


MAX_IDENTIFIER_LENGTH = 80
_ALLOWED_PUNCTUATION = {"-", "_"}


def normalize_storage_component(
    value: Optional[str],
    *,
    fallback: str,
    max_length: int = MAX_IDENTIFIER_LENGTH,
) -> str:
    """Return a stable, single-path-component identifier.

    Storage identifiers may originate in HTTP headers, so path separators,
    traversal markers, control characters, and punctuation other than ``-``
    and ``_`` are removed before the value reaches a filesystem or Redis key.
    """
    raw = (value or "").strip()
    normalized = "".join(
        character
        for character in raw
        if character.isalnum() or character in _ALLOWED_PUNCTUATION
    )[:max_length]
    return normalized or fallback


def normalize_user_id(user_id: Optional[str]) -> str:
    """Canonicalize a client-provided user identifier."""
    return normalize_storage_component(user_id, fallback="anonymous")


def normalize_persona_key(persona_key: Optional[str]) -> str:
    """Canonicalize a persona key before using it in persistent storage."""
    return normalize_storage_component(persona_key, fallback="default")
