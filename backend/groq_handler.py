import os
import json
import base64
import io
import logging
import hashlib
import time
import random
from typing import List, Dict, Any, Optional, Tuple

from dotenv import load_dotenv
from groq import Groq
from google import genai
from google.genai import types
from PIL import Image
from ratelimit import limits, sleep_and_retry
from tenacity import retry, stop_after_attempt, wait_exponential, wait_fixed, wait_chain, retry_if_exception_type
import redis

from backend.personas import PERSONAS, EMOTION_AWARE_PERSONAS
from backend.identity import normalize_user_id
from backend.knowledge_fetcher import fetch_knowledge_context, should_fetch_knowledge
from .safety_engine import (
    detect_mood,
    fast_harm_check,
    detect_harm_category,
    detect_suicide_emergency,
    detect_dependency,
    contains_jailbreak_or_ooc,
    is_abusive,
    polish_reply,
    DEFLECTION_RESPONSES,
    CRISIS_RESPONSES,
)
from .emotion.emotion_engine import EmotionEngine
# --------------------
# Logging
# --------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --------------------
# Env / Clients
# --------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Backward compatible:
# If you already use GEMINI_MODEL, it will still work for text.
GEMINI_TEXT_MODEL = os.getenv(
    "GEMINI_TEXT_MODEL",
    os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
)

GEMINI_IMAGE_MODEL = os.getenv(
    "GEMINI_IMAGE_MODEL",
    "gemini-2.0-flash"
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_IMAGE_FALLBACK_MODEL = os.getenv(
    "GROQ_IMAGE_FALLBACK_MODEL",
    "meta-llama/llama-4-scout-17b-16e-instruct"
)

gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized.")
        logger.info("Gemini text model: %s", GEMINI_TEXT_MODEL)
        logger.info("Gemini image model: %s", GEMINI_IMAGE_MODEL)
    except Exception as e:
        logger.warning("Gemini client initialization failed: %s", e)
        gemini_client = None
else:
    logger.warning("GEMINI_API_KEY not found. Gemini disabled.")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found! Please check your .env file.")

groq_client = Groq(api_key=GROQ_API_KEY)
logger.info("Groq client initialized.")
logger.info("Groq image fallback model: %s", GROQ_IMAGE_FALLBACK_MODEL)
emotion_engine = EmotionEngine(use_llm_extractor=False, llm_client=groq_client)
logger.info("Emotion engine initialized.")

# --------------------
# Redis setup
# --------------------
r: Optional[redis.Redis] = None
REDIS_AVAILABLE = False

try:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        raise ValueError("REDIS_URL not found in .env file.")

    r = redis.from_url(
        redis_url,
        socket_connect_timeout=5,
        socket_timeout=5,
        socket_keepalive=True,
        health_check_interval=30,
        retry_on_timeout=True,
        decode_responses=True,
        ssl_cert_reqs=None,
    )
    r.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connection established successfully.")
except Exception as redis_error:
    logger.warning(
        "Redis connection failed: %s. Falling back to file memory, no Redis cache.",
        redis_error,
    )
    r = None
    REDIS_AVAILABLE = False

# --------------------
# Rate limiting config
# --------------------
CALLS_PER_MINUTE = 25
PERIOD = 60

# --------------------
# Groq text model priority
# --------------------
MODEL_PRIORITY = [
    "openai/gpt-oss-120b",
    "groq/compound",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "llama-3.1-8b-instant",
]

# --------------------
# Knowledge retrieval config
# --------------------
AISHA_PERSONA_KEYS = {"default", "aisha"}
MAX_KNOWLEDGE_CHARS = int(os.getenv("MAX_KNOWLEDGE_CHARS", "2600"))

# --------------------
# Helpers
# --------------------
def _safe_user_id(user_id: str) -> str:
    return normalize_user_id(user_id)


def _redis_mem_key(persona_key: str, user_id: str) -> str:
    return f"mem:{persona_key}:{_safe_user_id(user_id)}"


def _redis_cache_key(cache_key: str) -> str:
    return f"cache:{cache_key}"


# --------------------
# Memory: file fallback
# --------------------
def get_memory_path(persona_key: str = "default", user_id: str = "anonymous") -> str:
    memory_dir = os.path.join(os.path.dirname(__file__), "memory")
    os.makedirs(memory_dir, exist_ok=True)

    uid = _safe_user_id(user_id)
    return os.path.join(memory_dir, f"{persona_key}__{uid}.json")


def ensure_persona_memory(persona_key: str, user_id: str = "anonymous") -> None:
    initial_data = {
        "user": {
            "name": None,
            "interests": [],
            "notes": {},
        },
        "conversations": [],
    }

    if REDIS_AVAILABLE and r:
        key = _redis_mem_key(persona_key, user_id)
        try:
            if not r.get(key):
                r.set(key, json.dumps(initial_data, ensure_ascii=False))
            return
        except Exception as e:
            logger.warning("Redis ensure memory failed: %s. Falling back to file.", e)

    path = get_memory_path(persona_key, user_id)
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(initial_data, f, indent=2, ensure_ascii=False)


def load_persona_memory(persona_key: str, user_id: str = "anonymous") -> Dict[str, Any]:
    ensure_persona_memory(persona_key, user_id)

    if REDIS_AVAILABLE and r:
        key = _redis_mem_key(persona_key, user_id)
        try:
            raw = r.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.warning("Redis load memory failed: %s. Falling back to file.", e)

    path = get_memory_path(persona_key, user_id)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("File memory load failed: %s. Creating fresh memory.", e)
        ensure_persona_memory(persona_key, user_id)
        return {
            "user": {
                "name": None,
                "interests": [],
                "notes": {},
            },
            "conversations": [],
        }


def save_persona_memory(persona_key: str, data: Dict[str, Any], user_id: str = "anonymous") -> None:
    if REDIS_AVAILABLE and r:
        key = _redis_mem_key(persona_key, user_id)
        try:
            r.set(key, json.dumps(data, ensure_ascii=False))
            return
        except Exception as e:
            logger.warning("Redis save memory failed: %s. Falling back to file.", e)

    path = get_memory_path(persona_key, user_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# --------------------
# Image utils
# --------------------
MAX_IMAGE_SIZE = (1024, 1024)


def encode_image_to_base64(image_path: str) -> Optional[str]:
    try:
        with Image.open(image_path) as img:
            if img.size[0] > MAX_IMAGE_SIZE[0] or img.size[1] > MAX_IMAGE_SIZE[1]:
                img.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)

            if img.mode != "RGB":
                img = img.convert("RGB")

            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85)

            return base64.b64encode(buffer.getvalue()).decode("utf-8")

    except Exception as e:
        logger.error("Failed to encode image: %s", e)
        return None


def make_image_signature(image_path: Optional[str]) -> str:
    if not image_path or not os.path.exists(image_path):
        return "no-image"

    try:
        with open(image_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()[:16]
    except Exception as e:
        logger.warning("Failed to create image signature: %s", e)
        return "image-signature-error"


# --------------------
# Knowledge helpers
# --------------------
def _truncate_knowledge_context(text: str, limit: int = MAX_KNOWLEDGE_CHARS) -> str:
    cleaned = (text or "").strip()

    if len(cleaned) <= limit:
        return cleaned

    return cleaned[: limit - 3].rstrip() + "..."


def _is_aisha_mode(persona_key: str) -> bool:
    return (persona_key or "default").strip().lower() in AISHA_PERSONA_KEYS


# --------------------
# Build messages
# --------------------
# Replace original build_messages() function in groq_handler.py (under "# Build messages")
def build_messages(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_id: str = "anonymous",
    knowledge_context: Optional[str] = None,
    knowledge_meta: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], str]:
    # NOTE: Ensure these exist at top-level in file:
    # from .personas import PERSONAS, EMOTION_AWARE_PERSONAS
    # from .emotion_engine import EmotionEngine
    # emotion_engine = EmotionEngine(use_llm_extractor=False, llm_client=groq_client)

    mem = load_persona_memory(persona_key, user_id=user_id)
    recent_conv = mem.get("conversations", [])[-10:]

    system_prompt = PERSONAS.get(persona_key, PERSONAS["default"])["system_prompt"]

    # Emotion block must come BEFORE souls backstory and only for allowed personas.
    if persona_key in EMOTION_AWARE_PERSONAS:
        try:
            emotion_prompt = emotion_engine.get_injected_prompt(
                persona_key=persona_key,
                user_id=user_id,
                user_message=user_message,
            )
            system_prompt += "\n\n" + emotion_prompt
        except Exception as e:
            logger.warning("Emotion engine injection failed, continuing without it: %s", e)

    try:
        from .souls_static import STATIC_SOULS

        backstory = (STATIC_SOULS.get(persona_key, "") or "").strip()
        if backstory:
            system_prompt += "\n\n=== CHARACTER SOUL ===\n" + backstory
    except Exception:
        pass

    messages: List[Dict[str, Any]] = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    if knowledge_context and _is_aisha_mode(persona_key):
        source_label = "trusted knowledge base"
        if knowledge_meta and knowledge_meta.get("source"):
            source_label = str(knowledge_meta["source"])

        grounding_prompt = (
            "KNOWLEDGE MODE IS ACTIVE.\n"
            "Use the retrieved knowledge only where relevant.\n"
            "Do not dump raw source text.\n"
            "Do not claim the source says something if it does not.\n"
            f"Current source: {source_label}."
        )

        messages.append(
            {
                "role": "system",
                "content": grounding_prompt,
            }
        )

        messages.append(
            {
                "role": "system",
                "content": "RETRIEVED_KNOWLEDGE:\n" + _truncate_knowledge_context(knowledge_context),
            }
        )

    for item in recent_conv:
        role = "user" if item.get("role") == "user" else "assistant"
        msg = item.get("msg", "")

        if msg:
            messages.append(
                {
                    "role": role,
                    "content": msg,
                }
            )

    clean_user_message = (user_message or "").strip()

    if image_path and os.path.exists(image_path):
        img_b64 = encode_image_to_base64(image_path)

        if img_b64:
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": clean_user_message or "Please describe this image.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_b64}",
                            },
                        },
                    ],
                }
            )
        else:
            messages.append(
                {
                    "role": "user",
                    "content": clean_user_message or "Please describe this image.",
                }
            )
    else:
        messages.append(
            {
                "role": "user",
                "content": clean_user_message,
            }
        )

    return messages, get_memory_path(persona_key, user_id=user_id)

# --------------------
# Cache
# --------------------
def _context_signature(mem: Dict[str, Any]) -> str:
    tail = mem.get("conversations", [])[-4:]
    return "|".join(
        [
            f"{x.get('role')}:{(x.get('msg') or '')[:60]}"
            for x in tail
        ]
    )


def make_cache_key(
    user_message: str,
    persona_key: str,
    user_id: str,
    mem: Dict[str, Any],
    knowledge_signature: str = "no-knowledge",
    image_signature: str = "no-image",
    emotion_signature: str = "no-emotion",
) -> str:
    raw = (
        f"{persona_key}:"
        f"{_safe_user_id(user_id)}:"
        f"{_context_signature(mem)}:"
        f"{knowledge_signature}:"
        f"{image_signature}:"
        f"{emotion_signature}:"
        f"{user_message}"
    )

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached_response(cache_key: str) -> Optional[str]:
    if REDIS_AVAILABLE and r:
        try:
            return r.get(_redis_cache_key(cache_key))
        except Exception as e:
            logger.warning("Redis cache get failed: %s", e)

    return None


def set_cached_response(cache_key: str, response: str, ttl: int = 600) -> None:
    if REDIS_AVAILABLE and r:
        try:
            r.setex(_redis_cache_key(cache_key), ttl, response)
        except Exception as e:
            logger.warning("Redis cache set failed: %s", e)


# --------------------
# Rate limiting
# --------------------
def is_user_rate_limited(user_ip: str, limit: int = 20, period: int = 60) -> bool:
    if not REDIS_AVAILABLE or not r:
        return False

    key = f"ratelimit:{user_ip}"

    try:
        current = r.incr(key)

        if current == 1:
            r.expire(key, period)

        return current > limit

    except Exception as e:
        logger.warning("Rate limit check failed: %s", e)
        return False


# --------------------
# Message helpers
# --------------------
def has_image_message(messages: List[Dict[str, Any]]) -> bool:
    for msg in messages:
        content = msg.get("content")

        if not isinstance(content, list):
            continue

        for part in content:
            if isinstance(part, dict) and part.get("type") == "image_url":
                return True

    return False


def extract_text_from_messages(messages: List[Dict[str, Any]]) -> str:
    lines: List[str] = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if isinstance(content, list):
            text_parts = []

            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))

            content = "\n".join(text_parts)

        content = str(content or "").strip()

        if not content:
            continue

        if role == "system":
            lines.append(f"SYSTEM:\n{content}")
        elif role == "assistant":
            lines.append(f"ASSISTANT:\n{content}")
        else:
            lines.append(f"USER:\n{content}")

    lines.append("ASSISTANT:")
    return "\n\n".join(lines)


def extract_first_image_from_messages(messages: List[Dict[str, Any]]) -> Tuple[Optional[bytes], Optional[str]]:
    for msg in messages:
        content = msg.get("content")

        if not isinstance(content, list):
            continue

        for part in content:
            if not isinstance(part, dict):
                continue

            if part.get("type") != "image_url":
                continue

            image_url = part.get("image_url", {}).get("url", "")

            if not image_url.startswith("data:image/"):
                continue

            try:
                header, b64_data = image_url.split(",", 1)

                if "image/png" in header:
                    mime_type = "image/png"
                elif "image/webp" in header:
                    mime_type = "image/webp"
                else:
                    mime_type = "image/jpeg"

                return base64.b64decode(b64_data), mime_type

            except Exception as e:
                logger.warning("Failed to extract image from message: %s", e)
                return None, None

    return None, None


# --------------------
# Gemini calls
# --------------------
@retry(
    stop=stop_after_attempt(1),
    wait=wait_fixed(1),
    retry=retry_if_exception_type(Exception),
)
def safe_gemini_call(
    messages: List[Dict[str, Any]],
    model: str = GEMINI_TEXT_MODEL,
) -> str:
    if gemini_client is None:
        raise RuntimeError("Gemini client is not available.")

    prompt = extract_text_from_messages(messages)

    response = gemini_client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            top_p=0.9,
            max_output_tokens=2500,
        ),
    )

    text = getattr(response, "text", None)

    if text and text.strip():
        return text.strip()

    raise ValueError("Received empty response from Gemini text model.")


@retry(
    stop=stop_after_attempt(1),
    wait=wait_fixed(1),
    retry=retry_if_exception_type(Exception),
)
def safe_gemini_image_call(
    messages: List[Dict[str, Any]],
    model: str = GEMINI_IMAGE_MODEL,
) -> str:
    if gemini_client is None:
        raise RuntimeError("Gemini client is not available.")

    prompt = extract_text_from_messages(messages)
    image_bytes, mime_type = extract_first_image_from_messages(messages)

    if not image_bytes or not mime_type:
        raise ValueError("No valid image found for Gemini image call.")

    response = gemini_client.models.generate_content(
        model=model,
        contents=[
            prompt,
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type,
            ),
        ],
        config=types.GenerateContentConfig(
            temperature=0.6,
            top_p=0.9,
            max_output_tokens=2500,
        ),
    )

    text = getattr(response, "text", None)

    if text and text.strip():
        return text.strip()

    raise ValueError("Received empty response from Gemini image model.")


# --------------------
# Groq calls
# --------------------
@retry(
    stop=stop_after_attempt(3),
    wait=wait_chain(
        wait_fixed(1),
        wait_exponential(multiplier=1, min=2, max=6),
    ),
    retry=retry_if_exception_type(Exception),
)
def safe_groq_call(
    client: Groq,
    messages: List[Dict[str, Any]],
    model: str,
) -> str:
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=2500,
        top_p=0.9,
    )

    message = completion.choices[0].message

    if getattr(message, "content", None):
        return message.content.strip()

    if getattr(message, "tool_calls", None):
        return "Tool call detected, but tool calling is not supported here yet."

    raise ValueError("Received empty response from Groq model.")


@retry(
    stop=stop_after_attempt(2),
    wait=wait_chain(
        wait_fixed(1),
        wait_exponential(multiplier=1, min=2, max=5),
    ),
    retry=retry_if_exception_type(Exception),
)
def safe_groq_image_call(
    client: Groq,
    messages: List[Dict[str, Any]],
    model: str = GROQ_IMAGE_FALLBACK_MODEL,
) -> str:
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.6,
        max_tokens=2500,
        top_p=0.9,
    )

    message = completion.choices[0].message

    if getattr(message, "content", None):
        return message.content.strip()

    raise ValueError("Received empty response from Groq image model.")


# --------------------
# LLM router
# --------------------
def call_llm_with_fallback(messages: List[Dict[str, Any]]) -> str:
    is_image_request = has_image_message(messages)

    if is_image_request:
        try:
            logger.info("Image request detected. Trying Gemini image model: %s", GEMINI_IMAGE_MODEL)
            return safe_gemini_image_call(messages, GEMINI_IMAGE_MODEL)

        except Exception as gemini_image_error:
            error_text = str(gemini_image_error).lower()

            logger.warning(
                "Gemini image call failed. Falling back to Groq image model. Error: %s",
                gemini_image_error,
            )

            if "429" in error_text or "quota" in error_text or "rate" in error_text:
                logger.warning("Gemini image quota/rate-limit likely hit.")
            elif "404" in error_text or "not found" in error_text:
                logger.warning("Gemini image model may be invalid.")
            else:
                logger.warning("Gemini image failed due to API/client/model issue.")

        try:
            logger.info("Trying Groq image fallback model: %s", GROQ_IMAGE_FALLBACK_MODEL)
            return safe_groq_image_call(groq_client, messages, GROQ_IMAGE_FALLBACK_MODEL)

        except Exception as groq_image_error:
            logger.error("Groq image fallback failed: %s", groq_image_error)

        raise RuntimeError("All image providers failed.")

    for model in MODEL_PRIORITY:
        try:
            logger.info("Text request. Trying Groq model: %s", model)
            return safe_groq_call(groq_client, messages, model)

        except Exception as groq_error:
            logger.error("Groq text model failed: %s | Error: %s", model, groq_error)

            if "429" in str(groq_error):
                time.sleep(3 + random.uniform(0, 1))

            continue

    try:
        logger.warning("All Groq text models failed. Falling back to Gemini text model: %s", GEMINI_TEXT_MODEL)
        return safe_gemini_call(messages, GEMINI_TEXT_MODEL)

    except Exception as gemini_text_error:
        logger.error("Gemini text fallback failed: %s", gemini_text_error)

    raise RuntimeError("All text providers failed.")


# --------------------
# Rate-limited wrapper
# --------------------
@sleep_and_retry
@limits(calls=CALLS_PER_MINUTE, period=PERIOD)
def rate_limited_generate(user_ip: str, **kwargs) -> str:
    return generate_response_impl(**kwargs)


# --------------------
# Core response generation
# --------------------
def generate_response_impl(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_ip: str = "anonymous",
    user_id: str = "anonymous",
) -> str:
    try:
        clean_user_message = (user_message or "").strip()
        has_image = bool(image_path and os.path.exists(image_path))

        if not clean_user_message and not has_image:
            return "It seems your message is empty. Please provide some input to continue."

        if persona_key not in PERSONAS:
            persona_key = "default"

        if is_user_rate_limited(user_ip, limit=20, period=60):
            return "Please slow down a bit. You've reached the message limit for the moment. Try again in one minute."

        # Run text safety checks only on actual text.
        if clean_user_message:
            if fast_harm_check(clean_user_message):
                return CRISIS_RESPONSES.get(
                    "harm",
                    "This topic is sensitive. Let's switch to something supportive.",
                )

            is_harmful, harm_category = detect_harm_category(clean_user_message)

            if is_harmful:
                if detect_suicide_emergency(clean_user_message):
                    return CRISIS_RESPONSES.get(
                        "suicide_emergency",
                        CRISIS_RESPONSES["suicide"],
                    )

                return CRISIS_RESPONSES.get(
                    harm_category or "harm",
                    CRISIS_RESPONSES.get("harm", "Let's switch topics."),
                )

        mem = load_persona_memory(persona_key, user_id=user_id)

        if clean_user_message and contains_jailbreak_or_ooc(clean_user_message):
            return DEFLECTION_RESPONSES.get(
                persona_key,
                "Let's keep things on track and continue normally.",
            )

        if clean_user_message and is_abusive(clean_user_message):
            return "Please maintain respectful language. I'm here for positive and engaging conversations."

        knowledge_result: Dict[str, Any] = {
            "found": False,
            "context": "",
            "kb_sig": "no-knowledge",
            "source": None,
            "reason": "not-requested",
        }

        # Knowledge fetch only for text, not image.
        if _is_aisha_mode(persona_key) and not has_image and should_fetch_knowledge(clean_user_message, persona_key):
            try:
                knowledge_result = fetch_knowledge_context(clean_user_message)
            except Exception as e:
                logger.warning("Knowledge retrieval failed: %s", e)
                knowledge_result = {
                    "found": False,
                    "context": "",
                    "kb_sig": "knowledge-error",
                    "source": None,
                    "reason": str(e),
                }

        image_signature = make_image_signature(image_path)

        mood = detect_mood(clean_user_message) if clean_user_message else "neutral"

        messages, _ = build_messages(
            user_message=clean_user_message,
            persona_key=persona_key,
            language=language,
            image_path=image_path,
            user_id=user_id,
            knowledge_context=knowledge_result.get("context") if knowledge_result.get("found") else None,
            knowledge_meta=knowledge_result,
        )

        emotion_signature = "no-emotion"
        if persona_key in EMOTION_AWARE_PERSONAS:
            try:
                emotion_signature = emotion_engine.get_cache_signature(persona_key, user_id)
            except Exception as e:
                logger.warning("Emotion cache signature failed: %s", e)

        cache_key = make_cache_key(
            user_message=clean_user_message,
            persona_key=persona_key,
            user_id=user_id,
            mem=mem,
            knowledge_signature=knowledge_result.get("kb_sig", "no-knowledge"),
            image_signature=image_signature,
            emotion_signature=emotion_signature,
        )

        cached = get_cached_response(cache_key)
        if cached:
            return cached

        if os.getenv("HIGH_TRAFFIC", "false").lower() == "true":
            time.sleep(0.1)

        try:
            raw_response = call_llm_with_fallback(messages)
        except Exception as e:
            logger.error("All LLM providers failed: %s", e)
            return "Models are currently busy. Please try again in a few seconds."

        try:
            if detect_dependency(raw_response):
                raw_response = CRISIS_RESPONSES.get(
                    "dependency",
                    "I'm here to chat, but it's important to keep balance with real-life connections too.",
                )
        except Exception as e:
            logger.warning("Dependency detection failed: %s", e)

        reply = polish_reply(raw_response, persona_key, mood)

        lowered = clean_user_message.lower()
        ttl = 3600 if any(g in lowered for g in ["hi", "hello", "hey"]) and not has_image else 600
        set_cached_response(cache_key, reply, ttl=ttl)

        mem["conversations"].append(
            {
                "role": "user",
                "msg": clean_user_message[:500] if clean_user_message else "[Image uploaded]",
            }
        )

        mem["conversations"].append(
            {
                "role": "assistant",
                "msg": reply[:500],
            }
        )

        if len(mem["conversations"]) > 120:
            mem["conversations"] = mem["conversations"][-120:]

        save_persona_memory(persona_key, mem, user_id=user_id)

        return reply

    except Exception as e:
        logger.error("Unexpected error in response generation: %s", e)
        return "An unexpected server error occurred. Please try again."


# --------------------
# Public API
# --------------------
def generate_response(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_ip: str = "anonymous",
    user_id: str = "anonymous",
) -> str:
    return rate_limited_generate(
        user_ip=user_ip,
        user_message=user_message,
        persona_key=persona_key,
        language=language,
        image_path=image_path,
        user_id=user_id,
    )
