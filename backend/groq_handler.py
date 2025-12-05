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

# Import safety engine
from backend.safety_engine import (
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

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found! Please check your .env file.")

client = Groq(api_key=GROQ_API_KEY)

r = None
REDIS_AVAILABLE = False
# SMART REDIS SETUP (Upstash optimized – no errors guaranteed)
try:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        raise Exception("No REDIS_URL found in .env")

    r = redis.from_url(
        redis_url,
        socket_connect_timeout=5,
        socket_timeout=5,
        socket_keepalive=True,
        health_check_interval=30,
        retry_on_timeout=True,
        decode_responses=True,
        ssl_cert_reqs=None  # Upstash TLS ke liye critical
    )
    
    # Connection test with retry
    r.ping()
    REDIS_AVAILABLE = True
    logger.info("Upstash Redis connected successfully! Ready for caching.")
    
except Exception as redis_err:
    logger.warning(f"Redis connection failed ({redis_err}). Falling back to in-memory LRU cache – no biggie!")
    r = None
    REDIS_AVAILABLE = False

CALLS_PER_MINUTE = 25
PERIOD = 60  # seconds

# UPDATED Dec 2025: Only confirmed available models (production + stable preview)
MODEL_PRIORITY = [
    "llama-3.3-70b-versatile",                   
    "meta-llama/llama-4-scout-17b-16e-instruct"  
    "llama-3.1-8b-instant",                      
]

# MEMORY HANDLING PER PERSONA
def get_memory_path(persona_key: str = "default") -> str:
    memory_dir = os.path.join(os.path.dirname(__file__), "memory")
    os.makedirs(memory_dir, exist_ok=True)
    return os.path.join(memory_dir, f"{persona_key}.json")

def ensure_persona_memory(persona_key: str):
    path = get_memory_path(persona_key)
    if not os.path.exists(path):
        initial = {
            "user": {"name": None, "interests": [], "notes": {}},
            "conversations": []
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(initial, f, indent=2, ensure_ascii=False)

def load_persona_memory(persona_key: str) -> Dict:
    ensure_persona_memory(persona_key)
    with open(get_memory_path(persona_key), "r", encoding="utf-8") as f:
        return json.load(f)

def save_persona_memory(persona_key: str, data: Dict):
    with open(get_memory_path(persona_key), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# IMAGE HANDLING (FIXED: Added thumbnail + quality for memory safety)
MAX_IMAGE_SIZE = (1024, 1024)

def encode_image_to_base64(image_path: str) -> Optional[str]:
    try:
        with Image.open(image_path) as img:
            if img.size[0] > MAX_IMAGE_SIZE[0] or img.size[1] > MAX_IMAGE_SIZE[1]:
                img.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Image encode failed: {e}")
        return None

# MESSAGE BUILDING (PER PERSONA)
def build_messages(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None
):
    mem = load_persona_memory(persona_key)
    user_name = mem.get("user", {}).get("name") or "buddy"
    interests = ', '.join(mem.get("user", {}).get("interests", []) or []) or "nothing"
    recent_conv = mem.get("conversations", [])[-10:]
    recent_texts = " | ".join([f"{c['role']}:{c['msg'][:50]}" for c in recent_conv]) or "First chat."
    logger.info(f"Memory for {persona_key}: {recent_texts}")
    system_prompt = PERSONAS.get(persona_key, PERSONAS["default"])["system_prompt"]
    messages = [{"role": "system", "content": system_prompt}]
    for item in recent_conv:
        role = "user" if item["role"] == "user" else "assistant"
        messages.append({"role": role, "content": item["msg"]})
    if image_path and os.path.exists(image_path):
        img_b64 = encode_image_to_base64(image_path)
        if img_b64:
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": user_message or "Describe this image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]
            })
        else:
            messages.append({"role": "user", "content": user_message})
    else:
        messages.append({"role": "user", "content": user_message})
    return messages, get_memory_path(persona_key)

# Simple hash for caching
def hash_message(user_message: str, persona_key: str) -> str:
    return hashlib.md5(f"{persona_key}:{user_message}".encode()).hexdigest()

# Cache response (Redis primary, LRU fallback)
@lru_cache(maxsize=1000)  # In-memory fallback cache
def get_cached_response(cache_key: str) -> Optional[str]:
    if REDIS_AVAILABLE and r:
        try:
            cached = r.get(f"grokcache:{cache_key}")  # Prefix for organization
            if cached:
                logger.debug("Redis cache HIT – lightning fast!")
                return cached  # Already decoded via decode_responses=True
        except Exception as cache_err:
            logger.warning(f"Redis get failed, using LRU: {cache_err}")
    return None

def set_cached_response(cache_key: str, response: str, ttl: int = 3600):  # 1 hour default
    if REDIS_AVAILABLE and r:
        try:
            r.setex(f"grokcache:{cache_key}", ttl, response)
            logger.debug(f"Redis cache SET (TTL: {ttl}s)")
        except Exception as cache_err:
            logger.warning(f"Redis set failed, LRU will handle: {cache_err}")
    # LRU auto-caches via decorator

# FIXED: Per-user rate limiting (Redis-based)
def is_user_rate_limited(user_ip: str, limit: int = 20, period: int = 60) -> bool:
    if not REDIS_AVAILABLE or not r:
        return False  # Fallback to no limit if no Redis
    key = f"ratelimit:{user_ip}"
    try:
        current = r.incr(key)
        if current == 1:
            r.expire(key, period)
        return current > limit
    except Exception as e:
        logger.warning(f"Per-user rate limit check failed: {e}")
        return False

# Retry decorator for Groq calls (handles 429 with backoff + jitter)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_chain(
        wait_fixed(2),
        wait_exponential(multiplier=1, min=4, max=10)
    ),
    retry=retry_if_exception_type(Exception)
)
def safe_groq_call(client, messages, model):
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,  # Added for balanced creativity
        max_tokens=512,   # Limit to prevent runaway responses
        top_p=0.9         # Nucleus sampling for variety
    )

    logger.info(f"Model {model}: call success")

    # FIXED: Safe access to content, handle tool_calls or empty
    message = completion.choices[0].message
    if message.content:
        return message.content.strip()
    elif message.tool_calls:
        return "Tool call detected – not supported yet."
    else:
        raise ValueError("Empty response from model")

# Rate limiter decorator (global + per-user)
@sleep_and_retry
@limits(calls=CALLS_PER_MINUTE, period=PERIOD)  # Global limit
def rate_limited_generate(user_ip: str, **kwargs):  
    return generate_response_impl(**kwargs)

def generate_response_impl(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_ip: str = "anonymous"  
) -> str:
    try:
        if not user_message.strip():
            return "Blank message? Classic move 🙄"
        
        # FIXED: Added per-user rate limiting
        if is_user_rate_limited(user_ip, limit=20):
            return "Thoda slow bhai, itne jaldi-jaldi msg mat kar na please 🥺 1 min wait kar le ♡"
        
        # NEW: Safety Layer 1 - Hard Kill-Switch (User Input Check)
        is_harm, harm_category = detect_harm_category(user_message)  # FIXED: Use correct func name
        if is_harm:
            if detect_suicide_emergency(user_message):  # FIXED: Separate check for emergency
                # Safety Layer 3: Suicide Emergency Flow - Disable Personas, Crisis Bot ON
                return CRISIS_RESPONSES.get("suicide_emergency", CRISIS_RESPONSES["suicide"])
            else:
                # General Harm - Block & Divert
                return CRISIS_RESPONSES.get(harm_category, CRISIS_RESPONSES.get("harm", "violence"))
        
        # 1. CACHING: Check cache first
        cache_key = hash_message(user_message, persona_key)
        cached = get_cached_response(cache_key)
        if cached:
            logger.info(f"Cache hit for {persona_key}: {user_message[:20]}")
            return cached  # Instant, zero tokens!
        
        # Mood + safety checks (existing)
        mood = detect_mood(user_message)
        if contains_jailbreak_or_ooc(user_message):
            reply = DEFLECTION_RESPONSES.get(persona_key, "abe yaar ye sab mat kar na, seedha pyaar kar ♡")
            set_cached_response(cache_key, reply, ttl=1800)  # Cache deflections 30 min
            return reply
        if is_abusive(user_message):
            reply = "Bhai thodi tameez se baat karo na. Main aisi bhasha allow nahi karta."
            set_cached_response(cache_key, reply)
            return reply
        
        # 2. Build messages (existing)
        messages, mem_path = build_messages(user_message, persona_key, language, image_path)
        
        if os.getenv("HIGH_TRAFFIC", "false") == "true":
            time.sleep(0.1)  # 10 req/sec max
        
        # 4. MODEL CHAIN with RETRY
        raw = None
        for model in MODEL_PRIORITY:
            try:
                raw = safe_groq_call(client, messages, model)
                logger.info(f"Success with {model}")
                break
            except Exception as e:
                logger.error(f"Error with model {model}: {str(e)}")
                if "429" in str(e):  # Specific 429 handling
                    # Extract retry-after if possible
                    retry_after = 10
                    if "retry-after" in str(e).lower():
                        parts = str(e).split("retry-after=")
                        if len(parts) > 1:
                            try:
                                retry_after = int(parts[1].split()[0])
                            except:
                                pass
                    logger.warning(f"429 on {model}, waiting {retry_after}s + jitter")
                    time.sleep(retry_after + random.uniform(0, 2))  # Extra jitter
                continue  # Try next model
        
        if raw is None:
            logger.error("All models failed – check API key/quota or models availability")
            # IMPROVED: Better fallback with retry suggestion
            return "Arre yaar, aaj models thode busy hain... API quota check kar le ya 30 sec baad try kar. Ya fir Groq dashboard pe dekh le models. 😴 (Error: Models down?)"
        
        # NEW: Safety Layer 2 - Emotional Dependency Breaker (Post-Model Check)
        if detect_dependency(raw):
            raw = DEPENDENCY_REPLACEMENT  # Safe replace
        
        # Safety + polish (existing)
        safe_raw = filter_response_for_mood_killers(raw)
        if safe_raw is None:
            reply = "Hmph. *ignores you and keeps character*"
        elif is_abusive(safe_raw):
            reply = "Sorry bhai, main aisi cheezein nahi bol sakta. Kuch achha baat karein?"
        else:
            reply = polish_reply(safe_raw, mood)
        
        cache_ttl = 3600 if any(greeting in user_message.lower() for greeting in ["hi", "hello", "hey"]) else 600
        set_cached_response(cache_key, reply, ttl=cache_ttl)
        
        mem = load_persona_memory(persona_key)
        mem["conversations"].append({"role": "user", "msg": user_message[:200]})
        mem["conversations"].append({"role": "assistant", "msg": reply[:200]})
        if len(mem["conversations"]) > 60:
            mem["conversations"] = mem["conversations"][-60:]
        save_persona_memory(persona_key, mem)
        
        return reply
    
    except Exception as e:
        logger.error(f"Global error in generate_response_impl: {e}")
        return "Kuch gadbad ho gaya server side... 10 sec wait kar aur retry kar le bhai 😅"

def generate_response(
    user_message: str,
    persona_key: str = "default",
    language: str = "en",
    image_path: Optional[str] = None,
    user_ip: str = "anonymous"
) -> str:
    return rate_limited_generate(user_ip=user_ip, user_message=user_message, persona_key=persona_key, language=language, image_path=image_path)