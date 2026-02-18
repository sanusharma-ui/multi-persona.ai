import sys
import os
import traceback
from fastapi import FastAPI, HTTPException, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict
from pathlib import Path
import uuid
import mimetypes
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.groq_handler import (
    generate_response,
    PERSONAS,
    ensure_persona_memory,
    load_persona_memory,
    save_persona_memory
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Aisha — Friendly AI",
    description="Aisha: multi-persona AI system. Uses Groq under the hood.",
    version="2.2"
)

# CORS CONFIG
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://localhost:8000",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "https://multi-persona-ai.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/tmp/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_CHARS = 2000  # general chat ke liye best

# -------------------------
# Helpers (user_id + IP)
# -------------------------
def get_user_id(req: Request) -> str:
    if not req:
        return "anonymous"
    uid = req.headers.get("x-user-id")
    if uid and uid.strip():
        return uid.strip()[:80]
    return "anonymous"

def get_user_ip(req: Request) -> str:
    if not req:
        return "anonymous"
    xff = req.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if req.client:
        return req.client.host
    return "anonymous"

# -------------------------
# Models
# -------------------------
class ChatRequest(BaseModel):
    message: str
    language: str = "en"

class UpdateUserMeta(BaseModel):
    name: Optional[str] = None
    interests: Optional[List[str]] = None
    notes: Optional[Dict[str, str]] = None

# -------------------------
# Routes
# -------------------------
@app.get("/")
def home(req: Request):
    user_id = get_user_id(req)
    ensure_persona_memory("default", user_id=user_id)
    return {
        "status": "Aisha is ready!",
        "hint": "POST /chat or /chat/image",
        "available_modes": list(PERSONAS.keys()),
        "user_id": user_id
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/modes/list")
def list_modes():
    return {"modes": {k: v["name"] for k, v in PERSONAS.items()}}

# Per-user memory view (default persona)
@app.get("/memory")
def memory(req: Request):
    user_id = get_user_id(req)
    return {"memory": load_persona_memory("default", user_id=user_id), "user_id": user_id}

# Per-user memory update (default persona)
@app.post("/memory/update")
def memory_update(payload: UpdateUserMeta, req: Request):
    user_id = get_user_id(req)
    mem = load_persona_memory("default", user_id=user_id)

    if payload.name:
        mem["user"]["name"] = payload.name
    if payload.interests:
        mem["user"]["interests"] = payload.interests
    if payload.notes:
        mem["user"]["notes"].update(payload.notes)

    save_persona_memory("default", mem, user_id=user_id)
    return {"status": "ok", "user_id": user_id}

# CHAT ROUTE (supports mode and reset)
@app.post("/chat")
def chat(payload: ChatRequest, mode: str = "default", reset: bool = False, req: Request = None):
    if mode not in PERSONAS:
        mode = "default"
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Empty message!")

    if len(payload.message) > MAX_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long! Max {MAX_CHARS} characters allowed."
        )

    try:
        user_ip = get_user_ip(req)
        user_id = get_user_id(req)

        if reset:
            logger.info(f"Resetting memory for persona={mode}, user_id={user_id}")
            mem = {"user": {"name": None, "interests": [], "notes": {}}, "conversations": []}
            save_persona_memory(mode, mem, user_id=user_id)

        reply = generate_response(
            user_message=payload.message,
            persona_key=mode,
            language=payload.language,
            user_ip=user_ip,
            user_id=user_id,
        )

        return {
            "reply": reply,
            "mode": mode,
            "display_name": PERSONAS[mode]["name"],
            "user_id": user_id
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# IMAGE CHAT ROUTE (supports mode)
@app.post("/chat/image")
async def chat_image(
    file: UploadFile = File(...),
    message: Optional[str] = None,
    language: str = "en",
    mode: str = "default",
    req: Request = None
):
    allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, WebP allowed!")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too big! Max 5MB.")

    ext = mimetypes.guess_extension(file.content_type) or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        f.write(content)

    user_text = message.strip() if message and message.strip() else "Describe this image."

    if len(user_text) > MAX_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long! Max {MAX_CHARS} characters allowed."
        )

    try:
        user_ip = get_user_ip(req)
        user_id = get_user_id(req)

        reply = generate_response(
            user_message=user_text,
            persona_key=mode if mode in PERSONAS else "default",
            language=language,
            image_path=str(file_path),
            user_ip=user_ip,
            user_id=user_id,
        )

        return {
            "reply": reply,
            "image_path": f"uploads/{filename}",
            "filename": filename,
            "mode": mode,
            "display_name": PERSONAS.get(mode, PERSONAS["default"])["name"],
            "user_id": user_id
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vision error: {str(e)}")

    finally:
        if file_path.exists():
            file_path.unlink()

# Serve images
app.mount("/uploads", StaticFiles(directory="/tmp/uploads"), name="uploads")