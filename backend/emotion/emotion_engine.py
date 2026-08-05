"""
emotion_engine.py

The Core Engine that ties all emotion modules together.
Designed to be plugged directly into groq_handler.py with zero friction.
"""
import json
import logging
import re

from .emotion_state import load_emotion_state, save_emotion_state
from .emotion_rules import decay_emotions, determine_mood
from .emotion_prompt import build_emotion_prompt
from .emotion_types import MIN_VAL, MAX_VAL

logger = logging.getLogger(__name__)

NEGATIONS = {"not", "no", "never", "nahi", "nhi", "isn't", "wasn't", "don't", "cant", "can't"}

# word -> (emotion, weight)
KEYWORD_MAP = {
    "stupid": ("anger", 0.15), "idiot": ("anger", 0.15), "hate": ("anger", 0.20),
    "useless": ("frustration", 0.15), "dumb": ("anger", 0.10), "shut up": ("anger", 0.20),
    "sad": ("sadness", 0.20), "depressed": ("sadness", 0.25), "broken": ("sadness", 0.15),
    "hurt": ("sadness", 0.15), "crying": ("sadness", 0.20),
    "stop": ("frustration", 0.08), "wrong": ("frustration", 0.10), "error": ("frustration", 0.08),
    "bug": ("frustration", 0.08), "fix it": ("frustration", 0.12),
    "awesome": ("joy", 0.15), "love": ("joy", 0.18), "amazing": ("joy", 0.15),
    "great": ("joy", 0.12), "thanks": ("joy", 0.10), "perfect": ("joy", 0.15),
    "wow": ("excitement", 0.15), "cool": ("excitement", 0.10), "interesting": ("excitement", 0.10),
    "tell me more": ("excitement", 0.12), "scared": ("fear", 0.20), "worried": ("fear", 0.15),
}


class EmotionEngine:
    def __init__(self, use_llm_extractor=False, llm_client=None, llm_model="llama-3.1-8b-instant"):
        """
        use_llm_extractor=False -> ultra-fast regex/keyword based emotion shifts.
        use_llm_extractor=True + llm_client -> a small/fast model classifies the
        message into structured emotion deltas. Falls back to keywords on any failure,
        so this never blocks the main reply path.
        """
        self.use_llm_extractor = use_llm_extractor
        self.llm_client = llm_client
        self.llm_model = llm_model

    def get_injected_prompt(self, persona_key: str, user_id: str, user_message: str) -> str:
        """
        The ONLY function you need to call in groq_handler.py.
        """
        state = load_emotion_state(persona_key, user_id)
        state = decay_emotions(state)

        deltas = self._extract_emotion_deltas(user_message)
        state = self._apply_deltas(state, deltas)

        state["current_mood"] = determine_mood(state)

        save_emotion_state(persona_key, user_id, state)

        return build_emotion_prompt(state)

    # --------------------
    # Delta extraction
    # --------------------
    def _extract_emotion_deltas(self, text: str) -> dict:
        if self.use_llm_extractor and self.llm_client:
            try:
                return self._llm_extractor(text)
            except Exception as e:
                logger.warning("LLM emotion extraction failed, falling back to keywords: %s", e)
                return self._fallback_keyword_extractor(text)
        return self._fallback_keyword_extractor(text)

    def _llm_extractor(self, text: str) -> dict:
        """
        Uses a small/fast Groq model to classify emotion shifts as strict JSON.
        Kept intentionally cheap (small model, low tokens, single message).
        """
        system = (
            "You output ONLY compact JSON, no prose, no markdown fences. "
            "Given a user's chat message, estimate how it should shift an AI "
            'companion\'s emotions, each in range -0.3 to 0.3. Keys: '
            '"joy","sadness","anger","fear","excitement","frustration". '
            'Example: {"joy":0.1,"sadness":0.0,"anger":0.0,"fear":0.0,'
            '"excitement":0.05,"frustration":0.0}'
        )

        completion = self.llm_client.chat.completions.create(
            model=self.llm_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
            max_tokens=120,
        )

        raw = completion.choices[0].message.content.strip()
        raw = re.sub(r"^```json|```$", "", raw).strip()
        parsed = json.loads(raw)

        deltas = {"joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "excitement": 0.0, "frustration": 0.0}
        for key in deltas:
            val = parsed.get(key, 0.0)
            try:
                deltas[key] = max(-0.3, min(0.3, float(val)))
            except (TypeError, ValueError):
                deltas[key] = 0.0
        return deltas

    def _fallback_keyword_extractor(self, text: str) -> dict:
        """
        Dictionary-based heuristic, now with:
        - negation awareness (a negator within 3 words before a trigger flips/dampens it)
        - intensity scaling from CAPS ratio and repeated punctuation (!!!)
        """
        deltas = {
            "joy": 0.0, "sadness": 0.0, "anger": 0.0,
            "fear": 0.0, "excitement": 0.0, "frustration": 0.0,
        }

        if not text:
            return deltas

        intensity = self._intensity_multiplier(text)
        text_lower = text.lower()
        words = re.findall(r"[a-z']+|nahi|nhi", text_lower)

        for phrase, (emotion, weight) in KEYWORD_MAP.items():
            if phrase not in text_lower:
                continue

            idx = text_lower.find(phrase)
            preceding = text_lower[max(0, idx - 20):idx]
            negated = any(neg in preceding.split() for neg in NEGATIONS)

            shift = weight * intensity
            if negated:
                shift *= -0.5  # negated trigger softly reverses/dampens the shift

            deltas[emotion] += shift

        # Cross-effects: anger/frustration triggers dampen joy, joy triggers dampen anger
        if deltas["anger"] > 0 or deltas["frustration"] > 0:
            deltas["joy"] -= 0.10 * intensity
        if deltas["joy"] > 0:
            deltas["frustration"] -= 0.15 * intensity
            deltas["anger"] -= 0.15 * intensity

        return {k: round(v, 3) for k, v in deltas.items()}

    def _intensity_multiplier(self, text: str) -> float:
        """CAPS and repeated punctuation push intensity up to a 1.6x ceiling."""
        letters = [c for c in text if c.isalpha()]
        caps_ratio = (sum(1 for c in letters if c.isupper()) / len(letters)) if letters else 0.0
        exclaim_boost = min(text.count("!"), 3) * 0.1
        caps_boost = 0.3 if caps_ratio > 0.5 and len(letters) > 4 else 0.0
        return min(1.6, 1.0 + exclaim_boost + caps_boost)

    def _apply_deltas(self, state: dict, deltas: dict) -> dict:
        for emotion, shift in deltas.items():
            if emotion in state:
                new_val = state[emotion] + shift
                state[emotion] = round(max(MIN_VAL, min(MAX_VAL, new_val)), 3)
        return state