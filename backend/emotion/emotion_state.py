"""
emotion_state.py

Handles loading and saving emotion state safely.
Implemented Atomic Writes to prevent JSON corruption during high concurrency.
"""
import os
import json
import tempfile
import time
from pathlib import Path

from backend.identity import normalize_persona_key, normalize_user_id
from .emotion_types import create_default_state

BASE_DIR = os.path.dirname(__file__)
EMOTION_MEMORY_DIR = os.path.join(BASE_DIR, "memory")

os.makedirs(EMOTION_MEMORY_DIR, exist_ok=True)

def get_emotion_path(persona_key: str, user_id: str) -> str:
    safe_persona_key = normalize_persona_key(persona_key)
    safe_user_id = normalize_user_id(user_id)
    filename = f"{safe_persona_key}__{safe_user_id}.json"

    memory_dir = Path(EMOTION_MEMORY_DIR).resolve()
    path = (memory_dir / filename).resolve()
    if path.parent != memory_dir:
        raise ValueError("Emotion memory path escaped its storage directory.")

    return str(path)

def load_emotion_state(persona_key: str, user_id: str) -> dict:
    path = get_emotion_path(persona_key, user_id)

    if not os.path.exists(path):
        state = create_default_state()
        save_emotion_state(persona_key, user_id, state)
        return state

    try:
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
            # Ensure new keys from types are always present in old saves
            default_state = create_default_state()
            for key, val in default_state.items():
                if key not in state:
                    state[key] = val
            return state
    except (json.JSONDecodeError, IOError):
        # Fallback if file is completely corrupted
        state = create_default_state()
        save_emotion_state(persona_key, user_id, state)
        return state

def save_emotion_state(persona_key: str, user_id: str, state: dict):
    """
    Saves state using an Atomic Write. 
    Writes to a temporary file first, then replaces the actual file.
    Prevents data loss if the system crashes mid-write.
    """
    path = get_emotion_path(persona_key, user_id)
    state["last_updated"] = time.time()
    
    # Create a temporary file in the same directory to ensure same filesystem
    fd, temp_path = tempfile.mkstemp(dir=EMOTION_MEMORY_DIR, text=True)
    
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=4, ensure_ascii=False)
        
        # Atomic replace
        os.replace(temp_path, path)
    except Exception as e:
        # Cleanup temp file on failure
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise e
