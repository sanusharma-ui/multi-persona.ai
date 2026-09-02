from pathlib import Path

import pytest

from backend.emotion.emotion_state import EMOTION_MEMORY_DIR, get_emotion_path
from backend.identity import normalize_user_id


@pytest.mark.parametrize(
    "malicious_user_id",
    [
        "../../../../frontend/package",
        r"..\..\..\..\frontend\package",
        "/tmp/owned",
        r"C:\temp\owned",
        "user\x00id",
    ],
)
def test_emotion_path_cannot_escape_memory_directory(malicious_user_id):
    memory_dir = Path(EMOTION_MEMORY_DIR).resolve()
    emotion_path = Path(get_emotion_path("raven", malicious_user_id))

    assert emotion_path.parent == memory_dir
    assert emotion_path.suffix == ".json"


def test_persona_key_cannot_escape_memory_directory():
    memory_dir = Path(EMOTION_MEMORY_DIR).resolve()
    emotion_path = Path(get_emotion_path("../../outside", "safe-user"))

    assert emotion_path.parent == memory_dir
    assert emotion_path.name == "outside__safe-user.json"


def test_safe_identifiers_keep_their_existing_storage_name():
    emotion_path = Path(get_emotion_path("Creator_mode", "user_123-abc"))

    assert emotion_path.name == "Creator_mode__user_123-abc.json"
    assert normalize_user_id("user_123-abc") == "user_123-abc"


def test_empty_or_fully_unsafe_user_id_becomes_anonymous():
    assert normalize_user_id("../../") == "anonymous"
    assert normalize_user_id("   ") == "anonymous"
