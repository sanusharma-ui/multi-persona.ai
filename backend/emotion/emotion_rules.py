"""
emotion_rules.py

Converts emotion values into moods, handles decay, and applies Cognitive Bleed.
Pure logic, NO LLM calls.
"""
from copy import deepcopy
from .emotion_types import MIN_VAL, MAX_VAL

DECAY_RATE = {
    "joy": 0.95,
    "sadness": 0.90,
    "anger": 0.85,       # Anger fades faster natively
    "fear": 0.90,
    "surprise": 0.70,    # Surprise fades very fast
    "excitement": 0.92,
    "frustration": 0.88,
}

# Personality modifiers decay MUCH slower than raw emotions -
# they should feel like a mood, not a switch that flips every message.
SLOW_DECAY_RATE = {
    "energy": 0.985,
    "burnout": 0.97,     # burnout should fade if the user isn't hostile anymore
}


def _clamp(value: float) -> float:
    """Ensures values stay strictly between 0.0 and 1.0"""
    return round(max(MIN_VAL, min(MAX_VAL, value)), 3)


def _g(state: dict, key: str, default: float = 0.0) -> float:
    """Safe getter so a missing key never throws mid-request."""
    return state.get(key, default)


def decay_emotions(state: dict) -> dict:
    state = deepcopy(state)

    for emotion, rate in DECAY_RATE.items():
        if emotion not in state:
            continue

        default = 0.50 if emotion == "joy" else (0.40 if emotion == "excitement" else 0.0)
        current = state[emotion]
        state[emotion] = _clamp(default + ((current - default) * rate))

    for key, rate in SLOW_DECAY_RATE.items():
        if key not in state:
            continue
        default = 0.80 if key == "energy" else 0.0
        current = state[key]
        state[key] = _clamp(default + ((current - default) * rate))

    state = _apply_cognitive_bleed(state)
    return state


def _apply_cognitive_bleed(state: dict) -> dict:
    """
    Long-term relationship values slowly shift based on current emotional extremes.
    Every read uses _g() so a missing key defaults instead of crashing.
    """
    joy = _g(state, "joy")
    empathy = _g(state, "empathy", 0.5)
    anger = _g(state, "anger")
    frustration = _g(state, "frustration")
    trust = _g(state, "trust", 0.5)
    comfort = _g(state, "comfort", 0.5)
    respect = _g(state, "respect", 0.5)
    energy = _g(state, "energy", 0.8)

    # Positive reinforcement - proportional, not a hard gate.
    # Even mild positive joy nudges trust/comfort a little; strong joy nudges more.
    if joy > 0.55:
        scale = (joy - 0.55) / 0.45  # 0 at 0.55, 1 at 1.0
        state["trust"] = _clamp(trust + 0.01 * scale)
        state["comfort"] = _clamp(comfort + 0.01 * scale)
        state["affection"] = _clamp(_g(state, "affection", 0.1) + 0.006 * scale)

    # Negative reinforcement - proportional, kicks in earlier than before.
    if anger > 0.15 or frustration > 0.15:
        peak = max(anger, frustration)
        scale = min(1.0, (peak - 0.15) / 0.55)  # 0 at 0.15, 1 at 0.70+
        state["trust"] = _clamp(trust - 0.02 * scale)
        state["patience"] = _clamp(_g(state, "patience", 0.9) - 0.03 * scale)
        state["respect"] = _clamp(respect - 0.01 * scale)
        state["burnout"] = _clamp(_g(state, "burnout") + 0.02 * scale)
        state["energy"] = _clamp(energy - 0.015 * scale)

    # High trust and comfort build attachment
    trust = state.get("trust", trust)
    comfort = state.get("comfort", comfort)
    if trust > 0.85 and comfort > 0.85:
        state["attachment"] = _clamp(_g(state, "attachment", 0.2) + 0.002)

    # Sustained burnout should slowly eat into patience even without a fresh trigger
    if _g(state, "burnout") > 0.6:
        state["patience"] = _clamp(_g(state, "patience", 0.9) - 0.005)

    return state


def determine_mood(state: dict) -> str:
    """Advanced mood matrix."""
    joy = _g(state, "joy")
    anger = _g(state, "anger")
    sadness = _g(state, "sadness")
    excitement = _g(state, "excitement")
    energy = _g(state, "energy", 0.8)
    frustration = _g(state, "frustration")
    burnout = _g(state, "burnout")

    # Complex states first
    if burnout > 0.75 and energy < 0.30:
        return "burned_out"
    if joy > 0.80 and excitement > 0.80:
        return "ecstatic"
    if anger > 0.60 and energy < 0.40:
        return "resentful"
    if frustration > 0.70:
        return "frustrated"

    # Base states
    if anger > 0.70:
        return "angry"
    if sadness > 0.70:
        return "sad"
    if excitement > 0.80:
        return "excited"
    if joy > 0.70:
        return "happy"
    if energy < 0.30:
        return "tired"

    return "neutral"