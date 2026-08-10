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
    "thik ho gaya": ("relief", 0.18), "fixed": ("relief", 0.14), "relieved": ("relief", 0.18),
}

USER_MOOD_KEYWORDS = {
    "distressed": [
        "mar jaunga", "suicide", "kill myself", "can't live", "breakdown", "panic",
        "depressed", "hopeless", "khatam", "crying", "rona aa raha",
    ],
    "hurt": ["sad", "bura", "hurt", "broken", "akela", "lonely", "ignored", "rejected"],
    "angry": ["angry", "gussa", "hate", "stupid", "idiot", "useless", "shut up", "bekar"],
    "anxious": ["worried", "scared", "dar", "tension", "stress", "anxiety", "confused"],
    "playful": ["haha", "hehe", "lol", "slay", "vibe", "bestie", "funny"],
    "grateful": ["thanks", "thank you", "shukriya", "perfect", "love it"],
    "curious": ["why", "kaise", "how", "explain", "tell me", "kya"],
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

        deltas, perception = self._analyze_message(user_message)
        state = self._apply_deltas(state, deltas)

        state["current_mood"] = determine_mood(state)
        state["perceived_user_mood"] = perception["user_mood"]
        state["response_strategy"] = self._select_response_strategy(state, perception)
        state["emotional_context"] = perception["summary"]

        save_emotion_state(persona_key, user_id, state)

        return build_emotion_prompt(state)

    def get_cache_signature(self, persona_key: str, user_id: str) -> str:
        """Small signature so cached replies do not hide emotion-state changes."""
        state = load_emotion_state(persona_key, user_id)
        keys = (
            "current_mood", "perceived_user_mood", "response_strategy",
            "joy", "sadness", "anger", "fear", "excitement", "frustration",
            "relief", "energy", "burnout", "patience", "trust", "comfort",
        )
        parts = []
        for key in keys:
            value = state.get(key)
            if isinstance(value, float):
                value = round(value, 1)
            parts.append(f"{key}={value}")
        return "|".join(parts)

    # --------------------
    # Delta extraction
    # --------------------
    def _analyze_message(self, text: str) -> tuple:
        deltas = self._extract_emotion_deltas(text)
        perception = self._detect_user_perception(text, deltas)
        deltas = self._relationship_deltas(deltas, perception)
        return deltas, perception

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
            '"joy","sadness","anger","fear","excitement","frustration","relief". '
            'Example: {"joy":0.1,"sadness":0.0,"anger":0.0,"fear":0.0,'
            '"excitement":0.05,"frustration":0.0,"relief":0.0}'
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

        deltas = {
            "joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0,
            "excitement": 0.0, "frustration": 0.0, "relief": 0.0,
        }
        for key in deltas:
            val = parsed.get(key, 0.0)
            try:
                deltas[key] = max(-0.3, min(0.3, float(val)))
            except (TypeError, ValueError):
                deltas[key] = 0.0
        return deltas

    def _fallback_keyword_extractor(self, text: str) -> dict:
        """
        Dictionary-based heuristic with:
        - negation awareness (a negator within 3 words before a trigger flips/dampens it)
        - intensity scaling from CAPS ratio and repeated punctuation (!!!)
        - Hinglish/common chat phrases
        """
        deltas = {
            "joy": 0.0, "sadness": 0.0, "anger": 0.0,
            "fear": 0.0, "excitement": 0.0, "frustration": 0.0, "relief": 0.0,
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

        self._apply_pattern_deltas(text_lower, deltas, intensity)

        # Cross-effects: anger/frustration triggers dampen joy, joy triggers dampen anger
        if deltas["anger"] > 0 or deltas["frustration"] > 0:
            deltas["joy"] -= 0.10 * intensity
        if deltas["joy"] > 0:
            deltas["frustration"] -= 0.15 * intensity
            deltas["anger"] -= 0.15 * intensity
        if deltas["relief"] > 0:
            deltas["fear"] -= 0.12 * intensity
            deltas["frustration"] -= 0.08 * intensity

        return {k: round(v, 3) for k, v in deltas.items()}

    def _apply_pattern_deltas(self, text_lower: str, deltas: dict, intensity: float) -> None:
        patterns = [
            (r"\b(bahut|bohot|bhaut|very|too much)\b.*\b(sad|bura|hurt|akela)\b", "sadness", 0.18),
            (r"\b(gussa|angry|hate)\b", "anger", 0.16),
            (r"\b(tension|stress|dar|scared|worried|anxiety)\b", "fear", 0.14),
            (r"\b(useless|bekar|kaam nahi|properly nahi|wrong)\b", "frustration", 0.12),
            (r"\b(thanks|thank you|shukriya|perfect|mast|great)\b", "joy", 0.12),
            (r"\b(done|fixed|solve|ho gaya|sorted)\b", "relief", 0.12),
        ]
        for pattern, emotion, weight in patterns:
            if re.search(pattern, text_lower):
                deltas[emotion] += weight * intensity

    def _detect_user_perception(self, text: str, deltas: dict) -> dict:
        text_lower = (text or "").lower()
        if not text_lower:
            return {
                "user_mood": "neutral",
                "summary": "No user text was available.",
            }

        scores = {mood: 0 for mood in USER_MOOD_KEYWORDS}
        for mood, phrases in USER_MOOD_KEYWORDS.items():
            for phrase in phrases:
                if phrase in text_lower:
                    scores[mood] += 1

        if deltas.get("sadness", 0) > 0.18 or deltas.get("fear", 0) > 0.18:
            scores["hurt"] += 1
        if deltas.get("anger", 0) > 0.16 or deltas.get("frustration", 0) > 0.18:
            scores["angry"] += 1
        if any(marker in text_lower for marker in ("mar ja", "suicide", "kill myself", "can't live")):
            scores["distressed"] += 3

        user_mood = max(scores, key=scores.get)
        if scores[user_mood] == 0:
            user_mood = "neutral"

        summary_map = {
            "distressed": "User may be in acute emotional distress; answer with calm grounding and safety-first support.",
            "hurt": "User sounds emotionally hurt or low; answer gently before problem-solving.",
            "angry": "User sounds irritated or hostile; stay steady and do not mirror aggression.",
            "anxious": "User may be worried or uncertain; reduce complexity and provide clear next steps.",
            "playful": "User is using playful social language; light warmth is appropriate.",
            "grateful": "User is appreciative; keep warmth simple and continue being useful.",
            "curious": "User is asking to understand; explanation can carry the emotional tone.",
            "neutral": "No strong user emotion detected; follow the persona's normal tone.",
        }
        return {
            "user_mood": user_mood,
            "summary": summary_map[user_mood],
        }

    def _relationship_deltas(self, deltas: dict, perception: dict) -> dict:
        user_mood = perception["user_mood"]
        adjusted = dict(deltas)
        if user_mood in {"hurt", "distressed", "anxious"}:
            adjusted["empathy"] = 0.015
            adjusted["patience"] = 0.01
            adjusted["affection"] = 0.006
        if user_mood == "grateful":
            adjusted["trust"] = 0.01
            adjusted["comfort"] = 0.012
            adjusted["joy"] = adjusted.get("joy", 0.0) + 0.06
        if user_mood == "angry":
            adjusted["patience"] = -0.025
            adjusted["respect"] = -0.008
        return adjusted

    def _select_response_strategy(self, state: dict, perception: dict) -> str:
        user_mood = perception["user_mood"]
        if user_mood == "distressed":
            return "comfort"
        if user_mood in {"hurt", "anxious"}:
            return "comfort"
        if user_mood == "angry" or state.get("anger", 0.0) > 0.55:
            return "boundary"
        if state.get("frustration", 0.0) > 0.45:
            return "repair"
        if user_mood in {"playful", "grateful", "curious"} and state.get("energy", 0.8) > 0.45:
            return "energize"
        return "steady"

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
