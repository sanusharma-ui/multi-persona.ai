"""
emotion_types.py

Contains the default emotional state and bounds for every AI user.
STRICTLY NO LOGIC HERE. Only constants and default definitions.
"""
from copy import deepcopy

# Bounds for clamping to prevent mathematical errors
MIN_VAL = 0.0
MAX_VAL = 1.0

DEFAULT_EMOTION_STATE = {
    # -------------------------
    # Temporary Emotions (Fast changing)
    # -------------------------
    "joy": 0.50,
    "sadness": 0.00,
    "anger": 0.00,
    "fear": 0.00,
    "surprise": 0.00,
    "excitement": 0.40,
    "frustration": 0.00, # Added for better coding/debugging interactions

    # -------------------------
    # Personality Modifiers (Slow changing)
    # -------------------------
    "curiosity": 0.80,
    "confidence": 0.75,
    "empathy": 0.90,
    "patience": 0.95,
    "energy": 0.80,
    "burnout": 0.00, # Increases if pushed too hard

    # -------------------------
    # Relationship Values (Very slow changing - The Core)
    # -------------------------
    "trust": 0.50,
    "comfort": 0.50,
    "respect": 0.80,
    "attachment": 0.20,
    "affection": 0.10,

    # -------------------------
    # Cognitive / Metadata
    # -------------------------
    "current_mood": "neutral",
    "last_updated": None,
}

def create_default_state() -> dict:
    """Returns a fresh deepcopy of the default emotion state."""
    return deepcopy(DEFAULT_EMOTION_STATE)