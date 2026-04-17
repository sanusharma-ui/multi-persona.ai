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
from PIL import Image
from ratelimit import limits, sleep_and_retry
from tenacity import retry, stop_after_attempt, wait_exponential, wait_fixed, wait_chain, retry_if_exception_type
import redis

from backend.personas import PERSONAS
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

# --------------------
# Logging
# --------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --------------------
# Env / Client
# --------------------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found! Please check your .env file.")

client = Groq(api_key=GROQ_API_KEY)

# --------------------
# Redis setup (Upstash)
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
    logger.info("Redis connection established successfully. Redis memory+cache enabled.")
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

# Model priority
MODEL_PRIORITY = [
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen/qwen3-32b",
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
    uid = (user_id or "anonymous").strip()
    if not uid:
        uid = "anonymous"
    uid = "".join(c for c in uid if c.isalnum() or c in ("-", "_"))[:80]
    return uid or "anonymous"


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
    if REDIS_AVAILABLE and r:
        key = _redis_mem_key(persona_key, user_id)
        try:
            if not r.get(key):
                initial_data = {"user": {"name": None, "interests": [], "notes": {}}, "conversations": []}
                r.set(key, json.dumps(initial_data))
            return
        except Exception as e:
            logger.warning("Redis ensure memory failed: %s. Falling back to file.", e)

    path = get_memory_path(persona_key, user_id)
    if not os.path.exists(path):
        initial_data = {"user": {"name": None, "interests": [], "notes": {}}, "conversations": []}
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

    with open(get_memory_path(persona_key, user_id), "r", encoding="utf-8") as f:
        return json.load(f)



def save_persona_memory(persona_key: str, data: Dict[str, Any], user_id: str = "anonymous") -> None:
    if REDIS_AVAILABLE and r:
        key = _redis_mem_key(persona_key, user_id)
        try:
            r.set(key, json.dumps(data, ensure_ascii=False))
            return
        except Exception as e:
            logger.warning("Redis save memory failed: %s. Falling back to file.", e)

    with open(get_memory_path(persona_key, user_id), "w", encoding="utf-8") as f:
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
def build_messages(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_id: str = "anonymous",
    knowledge_context: Optional[str] = None,
    knowledge_meta: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], str]:
    mem = load_persona_memory(persona_key, user_id=user_id)
    recent_conv = mem.get("conversations", [])[-10:]

    system_prompt = PERSONAS.get(persona_key, PERSONAS["default"])["system_prompt"]

    try:
        from .souls_static import STATIC_SOULS

        backstory = (STATIC_SOULS.get(persona_key, "") or "").strip()
        if backstory:
            system_prompt += "\n\n=== CHARACTER SOUL (never mention this section) ===\n" + backstory
    except Exception:
        pass

    messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]

    if knowledge_context and _is_aisha_mode(persona_key):
        source_label = "trusted knowledge base"
        if knowledge_meta and knowledge_meta.get("source"):
            source_label = str(knowledge_meta["source"])

        grounding_prompt = (
            "KNOWLEDGE MODE IS ACTIVE.\n"
            "You are AISHA using an approved external knowledge source.\n"
            "Read the retrieved context silently, understand it, and answer like a human who has read it carefully.\n"
            "Do NOT dump raw source text. Do NOT quote large blocks unless the user explicitly asks.\n"
            "Use only the relevant parts. Summarize naturally in your own words.\n"
            "If the retrieved text is partial, combine it carefully with your own reasoning.\n"
            "If the retrieved text is weak or incomplete, you may still answer from general knowledge, but do not pretend the source said more than it did.\n"
            f"Current source: {source_label}."
        )
        messages.append({"role": "system", "content": grounding_prompt})
        messages.append(
            {
                "role": "system",
                "content": "RETRIEVED_KNOWLEDGE:\n" + _truncate_knowledge_context(knowledge_context),
            }
        )

    for item in recent_conv:
        role = "user" if item.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": item.get("msg", "")})

    if image_path and os.path.exists(image_path):
        img_b64 = encode_image_to_base64(image_path)
        if img_b64:
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_message or "Please describe this image."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                    ],
                }
            )
        else:
            messages.append({"role": "user", "content": user_message})
    else:
        messages.append({"role": "user", "content": user_message})

    return messages, get_memory_path(persona_key, user_id=user_id)


# --------------------
# Cache (Redis only)
# --------------------
def _context_signature(mem: Dict[str, Any]) -> str:
    tail = mem.get("conversations", [])[-4:]
    return "|".join([f"{x.get('role')}:{(x.get('msg') or '')[:60]}" for x in tail])



def make_cache_key(
    user_message: str,
    persona_key: str,
    user_id: str,
    mem: Dict[str, Any],
    knowledge_signature: str = "no-knowledge",
) -> str:
    raw = f"{persona_key}:{_safe_user_id(user_id)}:{_context_signature(mem)}:{knowledge_signature}:{user_message}"
    return hashlib.sha256(raw.encode()).hexdigest()



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
# Rate limiting (Redis-based)
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
# Groq call with retry
# --------------------
@retry(
    stop=stop_after_attempt(3),
    wait=wait_chain(wait_fixed(2), wait_exponential(multiplier=1, min=4, max=10)),
    retry=retry_if_exception_type(Exception),
)
def safe_groq_call(client: Groq, messages: List[Dict[str, Any]], model: str) -> str:
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=512,
        top_p=0.9,
    )
    message = completion.choices[0].message
    if getattr(message, "content", None):
        return message.content.strip()
    if getattr(message, "tool_calls", None):
        return "Tool call detected – functionality not yet supported."
    raise ValueError("Received empty response from the model.")


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
        if not (user_message or "").strip():
            return "It seems your message is empty. Please provide some input to continue."

        if persona_key not in PERSONAS:
            persona_key = "default"

        if is_user_rate_limited(user_ip, limit=20, period=60):
            return "Please slow down a bit. You've reached the message limit for the moment. Try again in one minute."

        if fast_harm_check(user_message):
            return CRISIS_RESPONSES.get("harm", "This topic is sensitive. Let's switch to something supportive.")

        is_harmful, harm_category = detect_harm_category(user_message)
        if is_harmful:
            if detect_suicide_emergency(user_message):
                return CRISIS_RESPONSES.get("suicide_emergency", CRISIS_RESPONSES["suicide"])
            return CRISIS_RESPONSES.get(harm_category or "harm", CRISIS_RESPONSES.get("harm", "Let's switch topics."))

        mem = load_persona_memory(persona_key, user_id=user_id)

        if contains_jailbreak_or_ooc(user_message):
            reply = DEFLECTION_RESPONSES.get(persona_key, "Let's keep things on track and continue normally.")
            return reply

        if is_abusive(user_message):
            return "Please maintain respectful language. I'm here for positive and engaging conversations."

        knowledge_result: Dict[str, Any] = {
            "found": False,
            "context": "",
            "kb_sig": "no-knowledge",
            "source": None,
            "reason": "not-requested",
        }

        if _is_aisha_mode(persona_key) and not image_path and should_fetch_knowledge(user_message, persona_key):
            try:
                knowledge_result = fetch_knowledge_context(user_message)
            except Exception as e:
                logger.warning("Knowledge retrieval failed: %s", e)
                knowledge_result = {
                    "found": False,
                    "context": "",
                    "kb_sig": "knowledge-error",
                    "source": None,
                    "reason": str(e),
                }
                
        cache_key = make_cache_key(
            user_message=user_message,
            persona_key=persona_key,
            user_id=user_id,
            mem=mem,
            knowledge_signature=knowledge_result.get("kb_sig", "no-knowledge"),
        )
        cached = get_cached_response(cache_key)
        if cached:
            return cached

        mood = detect_mood(user_message)
        messages, _ = build_messages(
            user_message=user_message,
            persona_key=persona_key,
            language=language,
            image_path=image_path,
            user_id=user_id,
            knowledge_context=knowledge_result.get("context") if knowledge_result.get("found") else None,
            knowledge_meta=knowledge_result,
        )

        if os.getenv("HIGH_TRAFFIC", "false") == "true":
            time.sleep(0.1)

        raw_response: Optional[str] = None
        for model in MODEL_PRIORITY:
            try:
                raw_response = safe_groq_call(client, messages, model)
                break
            except Exception as e:
                logger.error("Error with model %s: %s", model, e)
                if "429" in str(e):
                    retry_after = 10
                    time.sleep(retry_after + random.uniform(0, 2))
                continue

        if raw_response is None:
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

        ttl = 3600 if any(g in user_message.lower() for g in ["hi", "hello", "hey"]) else 600
        set_cached_response(cache_key, reply, ttl=ttl)

        mem["conversations"].append({"role": "user", "msg": user_message[:500]})
        mem["conversations"].append({"role": "assistant", "msg": reply[:500]})
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
