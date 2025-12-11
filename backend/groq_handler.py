import os
import json
from dotenv import load_dotenv
from groq import Groq
from typing import List, Dict, Any, Optional
import base64
from PIL import Image
import io
from backend.personas import PERSONAS
import logging
import hashlib
import time
import random
from functools import lru_cache
from ratelimit import limits, sleep_and_retry
from tenacity import retry, stop_after_attempt, wait_exponential, wait_fixed, wait_chain, retry_if_exception_type
import redis

# Import safety engine components
from .safety_engine import (
    detect_mood,
    fast_harm_check,
    detect_harm_category,
    detect_suicide_emergency,
    detect_dependency,
    contains_jailbreak_or_ooc,
    is_abusive,
    filter_response_for_mood_killers,
    polish_reply,
    DEFLECTION_RESPONSES,
    CRISIS_RESPONSES,
    DEPENDENCY_REPLACEMENT
)

# Setup logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found! Please check your .env file.")

client = Groq(api_key=GROQ_API_KEY)

# Redis configuration (fallback to in-memory if unavailable)
r: Optional[redis.Redis] = None
REDIS_AVAILABLE = False

# Redis setup with optimized configuration for Upstash
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
        ssl_cert_reqs=None  # Critical for Upstash TLS
    )

    # Test connection
    r.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connection established successfully. Caching enabled.")

except Exception as redis_error:
    logger.warning(f"Redis connection failed: {redis_error}. Falling back to in-memory LRU cache.")
    r = None
    REDIS_AVAILABLE = False

# Rate limiting configuration
CALLS_PER_MINUTE = 25
PERIOD = 60  # seconds

# Model priority list (updated for December 2025: production and stable preview models only)
MODEL_PRIORITY = [
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
]

# Memory handling functions for personas
def get_memory_path(persona_key: str = "default") -> str:
    """Generate the file path for persona memory storage."""
    memory_dir = os.path.join(os.path.dirname(__file__), "memory")
    os.makedirs(memory_dir, exist_ok=True)
    return os.path.join(memory_dir, f"{persona_key}.json")

def ensure_persona_memory(persona_key: str) -> None:
    """Ensure initial memory file exists for the given persona."""
    path = get_memory_path(persona_key)
    if not os.path.exists(path):
        initial_data = {
            "user": {"name": None, "interests": [], "notes": {}},
            "conversations": []
        }
        with open(path, "w", encoding="utf-8") as file:
            json.dump(initial_data, file, indent=2, ensure_ascii=False)

def load_persona_memory(persona_key: str) -> Dict[str, Any]:
    """Load memory data for the specified persona."""
    ensure_persona_memory(persona_key)
    with open(get_memory_path(persona_key), "r", encoding="utf-8") as file:
        return json.load(file)

def save_persona_memory(persona_key: str, data: Dict[str, Any]) -> None:
    """Save memory data for the specified persona."""
    with open(get_memory_path(persona_key), "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

# Image handling utilities
MAX_IMAGE_SIZE = (1024, 1024)

def encode_image_to_base64(image_path: str) -> Optional[str]:
    """Encode an image to base64 string, resizing if necessary for memory efficiency."""
    try:
        with Image.open(image_path) as img:
            # Resize if exceeding max dimensions
            if img.size[0] > MAX_IMAGE_SIZE[0] or img.size[1] > MAX_IMAGE_SIZE[1]:
                img.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
            # Ensure RGB mode for JPEG compatibility
            if img.mode != 'RGB':
                img = img.convert('RGB')
            # Save to buffer with quality optimization
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as error:
        logger.error(f"Failed to encode image: {error}")
        return None

# Message building utilities
    # === INJECT STATIC SOUL (the magic line) ===
    try:
        from .souls_static import STATIC_SOULS
        backstory = STATIC_SOULS.get(persona_key, "").strip()
        if backstory:
            system_prompt += "\n\n=== CHARACTER SOUL (never mention this section) ===\n" + backstory
    except ImportError:
        pass  
def build_messages(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None
) -> tuple[List[Dict[str, Any]], str]:
    """Construct the message history for the Groq API call, incorporating memory and optional image."""
    mem = load_persona_memory(persona_key)
    user_name = mem.get("user", {}).get("name") or "user"
    interests = ', '.join(mem.get("user", {}).get("interests", []) or []) or "no specific interests noted"
    recent_conv = mem.get("conversations", [])[-10:]
    recent_texts = " | ".join([f"{c['role']}:{c['msg'][:50]}" for c in recent_conv]) or "This is the first conversation."
    logger.info(f"Loaded memory for persona '{persona_key}': {recent_texts}")

    system_prompt = PERSONAS.get(persona_key, PERSONAS["default"])["system_prompt"]
    messages = [{"role": "system", "content": system_prompt}]

    # Add recent conversation history
    for item in recent_conv:
        role = "user" if item["role"] == "user" else "assistant"
        messages.append({"role": role, "content": item["msg"]})

    # Handle image if provided
    if image_path and os.path.exists(image_path):
        img_b64 = encode_image_to_base64(image_path)
        if img_b64:
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": user_message or "Please describe this image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]
            })
        else:
            messages.append({"role": "user", "content": user_message})
    else:
        messages.append({"role": "user", "content": user_message})

    return messages, get_memory_path(persona_key)

# Caching utilities
def hash_message(user_message: str, persona_key: str) -> str:
    """Generate a unique hash for the message and persona combination for caching."""
    return hashlib.md5(f"{persona_key}:{user_message}".encode()).hexdigest()

@lru_cache(maxsize=1000)  # In-memory fallback
def get_cached_response(cache_key: str) -> Optional[str]:
    """Retrieve a cached response from Redis (primary) or LRU (fallback)."""
    if REDIS_AVAILABLE and r:
        try:
            cached = r.get(f"grokcache:{cache_key}")
            if cached:
                logger.debug("Cache hit: Response retrieved from Redis.")
                return cached
        except Exception as cache_error:
            logger.warning(f"Redis retrieval failed, falling back to LRU: {cache_error}")
    return None

def set_cached_response(cache_key: str, response: str, ttl: int = 3600) -> None:
    """Store a response in cache with optional TTL (Redis primary, LRU fallback)."""
    if REDIS_AVAILABLE and r:
        try:
            r.setex(f"grokcache:{cache_key}", ttl, response)
            logger.debug(f"Cache set in Redis with TTL: {ttl} seconds.")
        except Exception as cache_error:
            logger.warning(f"Redis storage failed, LRU will handle: {cache_error}")
    # LRU cache is automatically managed by the decorator

# Rate limiting utilities
def is_user_rate_limited(user_ip: str, limit: int = 20, period: int = 60) -> bool:
    """Check if the user IP has exceeded the rate limit (Redis-based)."""
    if not REDIS_AVAILABLE or not r:
        logger.warning("Rate limiting disabled due to unavailable Redis.")
        return False

    key = f"ratelimit:{user_ip}"
    try:
        current = r.incr(key)
        if current == 1:
            r.expire(key, period)
        return current > limit
    except Exception as error:
        logger.warning(f"Rate limit check failed: {error}")
        return False

# Groq API call utilities
@retry(
    stop=stop_after_attempt(3),
    wait=wait_chain(
        wait_fixed(2),
        wait_exponential(multiplier=1, min=4, max=10)
    ),
    retry=retry_if_exception_type(Exception)
)
def safe_groq_call(client: Groq, messages: List[Dict[str, Any]], model: str) -> str:
    """Safely call the Groq API with retry logic and error handling."""
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,  # Balanced creativity
        max_tokens=512,  # Prevent excessively long responses
        top_p=0.9  # Nucleus sampling for response variety
    )
    logger.info(f"API call successful with model: {model}")

    message = completion.choices[0].message
    if message.content:
        return message.content.strip()
    elif message.tool_calls:
        return "Tool call detected – functionality not yet supported."
    else:
        raise ValueError("Received empty response from the model.")

# Rate-limited generation wrapper
@sleep_and_retry
@limits(calls=CALLS_PER_MINUTE, period=PERIOD)  # Global rate limit
def rate_limited_generate(user_ip: str, **kwargs) -> str:
    """Wrapper for rate-limited response generation."""
    return generate_response_impl(**kwargs)

def generate_response_impl(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_ip: str = "anonymous"
) -> str:
    """Core implementation for generating a response with safety, caching, and memory management."""
    try:
        if not user_message.strip():
            return "It seems your message is empty. Please provide some input to continue the conversation."

        # Per-user rate limiting check
        if is_user_rate_limited(user_ip, limit=20):
            return "Please slow down a bit. You've reached the message limit for the moment. Try again in one minute."

        # Safety Layer 1: Input validation for harmful content
        is_harmful, harm_category = detect_harm_category(user_message)
        if is_harmful:
            if detect_suicide_emergency(user_message):
                # Emergency response for suicide-related content
                return CRISIS_RESPONSES.get("suicide_emergency", CRISIS_RESPONSES["suicide"])
            else:
                # General harmful content deflection
                return CRISIS_RESPONSES.get(harm_category, CRISIS_RESPONSES.get("harm", "violence"))

        # Caching: Check for existing response
        cache_key = hash_message(user_message, persona_key)
        cached_response = get_cached_response(cache_key)
        if cached_response:
            logger.info(f"Cache hit for persona '{persona_key}': {user_message[:20]}...")
            return cached_response

        # Additional safety checks
        mood = detect_mood(user_message)
        if contains_jailbreak_or_ooc(user_message):
            reply = DEFLECTION_RESPONSES.get(persona_key, "Let's keep things on track and continue our conversation naturally.")
            set_cached_response(cache_key, reply, ttl=1800)  # Cache for 30 minutes
            return reply

        if is_abusive(user_message):
            reply = "Please maintain respectful language. I'm here for positive and engaging conversations."
            set_cached_response(cache_key, reply)
            return reply

        # Build messages for API
        messages, mem_path = build_messages(user_message, persona_key, language, image_path)

        # Optional traffic throttling
        if os.getenv("HIGH_TRAFFIC", "false") == "true":
            time.sleep(0.1)  # Limit to ~10 requests per second

        # Model chaining with fallbacks
        raw_response = None
        for model in MODEL_PRIORITY:
            try:
                raw_response = safe_groq_call(client, messages, model)
                logger.info(f"Response generated successfully with model: {model}")
                break
            except Exception as error:
                logger.error(f"Error with model {model}: {str(error)}")
                if "429" in str(error):  # Rate limit handling
                    retry_after = 10
                    if "retry-after" in str(error).lower():
                        parts = str(error).split("retry-after=")
                        if len(parts) > 1:
                            try:
                                retry_after = int(parts[1].split()[0])
                            except ValueError:
                                pass
                    logger.warning(f"Rate limit (429) encountered with {model}. Waiting {retry_after} seconds + jitter.")
                    time.sleep(retry_after + random.uniform(0, 2))
                continue  # Proceed to next model

        if raw_response is None:
            logger.error("All models failed.")
            return "It appears the models are currently unavailable. Please try again in 30 seconds."

        # Safety Layer 2: Post-generation dependency check
        if detect_dependency(raw_response):
            raw_response = DEPENDENCY_REPLACEMENT

        # Final safety and polishing
        safe_response = filter_response_for_mood_killers(raw_response)
        if safe_response is None:
            reply = "*Maintains composure and stays in character.*"
        elif is_abusive(safe_response):
            reply = "I must keep responses appropriate. Let's discuss something positive instead."
        else:
            reply = polish_reply(safe_response, mood)

        # Dynamic caching TTL based on message type
        cache_ttl = 3600 if any(greeting in user_message.lower() for greeting in ["hi", "hello", "hey"]) else 600
        set_cached_response(cache_key, reply, ttl=cache_ttl)

        # Update memory
        mem = load_persona_memory(persona_key)
        mem["conversations"].append({"role": "user", "msg": user_message[:200]})
        mem["conversations"].append({"role": "assistant", "msg": reply[:200]})
        if len(mem["conversations"]) > 60:
            mem["conversations"] = mem["conversations"][-60:]
        save_persona_memory(persona_key, mem)

        return reply

    except Exception as error:
        logger.error(f"Unexpected error in response generation: {error}")
        return "An unexpected server error occurred. Please wait 10 seconds and try again."

def generate_response(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_ip: str = "anonymous"
) -> str:
    """Public entry point for generating a response with rate limiting."""
    return rate_limited_generate(user_ip=user_ip, user_message=user_message, persona_key=persona_key, language=language, image_path=image_path)