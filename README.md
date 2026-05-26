# Shifts — Multi-Persona AI Platform

A personality-driven AI chat platform built with **React (Vite)** and **FastAPI**, powered by **Groq** for low-latency inference.

Shifts is not a utility chatbot. It's a creative experiment in character-driven AI — each persona has its own identity, tone, worldview, and rules. The goal was to explore what AI feels like when it has a personality, not just a function.

---

## Personas

Each character is original — designed from scratch, not copied from existing archetypes.

| Key | Name | Identity |
|-----|------|----------|
| `seven` | Seven | Last Survivor of Planet 000 |
| `neo` | Neo | Friendly Dev Buddy |
| `cipher` | Cipher | Cyber Shadow |
| `noctra` | Noctra | Dream Witch |
| `virex` | Virex | Rogue Android |
| `aisha` | Aisha | Admin Guide |
| ...and more | | 14 personas total |

Every persona is isolated by prompt rules — they don't leak or imitate each other.

---

## Architecture

```
Browser (React)
  └── FastAPI (/chat, /chat/image)
        ├── Safety Engine   — pre-checks + deflections
        ├── Persona Engine  — system prompt per persona
        ├── Groq LLM        — text + optional vision
        └── Response polish + memory persistence
```

Key design ideas:

- **Persona = config** — name + system prompt + behavioral rules
- **Memory = per-user, per-persona state** — conversation history + metadata
- **Safety = fast checks first** — keyword prefilter → regex patterns → category-specific deflections

---

## Backend (FastAPI)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Readiness check + available personas |
| `GET` | `/health` | Health check |
| `GET` | `/modes/list` | Persona keys → display names |
| `POST` | `/chat` | Text chat (`?mode=<persona>&reset=<bool>`) |
| `POST` | `/chat/image` | Image + optional text |
| `GET` | `/memory` | Stored memory for current user |
| `POST` | `/memory/update` | Update user metadata (name, interests, notes) |

### Request Flow

1. Frontend sends `x-user-id` header (persisted in localStorage)
2. Backend validates message length (`MAX_CHARS = 2000`) and persona key
3. If `reset=true`, memory is replaced with a clean structure
4. LLM handler receives: `persona_key`, `user_id`, `user_ip`, optional `image_path`

See: `backend/main.py`, `backend/personas.py`

---

## Safety Engine

The safety layer protects against misuse across multiple threat categories:

- Jailbreak / out-of-character attempts
- Abusive language
- Self-harm and suicide intent
- Violence intent
- Sexual crime intent
- Terror / extremist planning
- Malware / hacking tool requests
- Emotional dependency and isolation language

Implementation:

- Fast keyword prefilter for high-confidence phrases
- Compiled regex patterns per category
- Defensive allowlist for legitimate questions (e.g. "how to detect malware")
- Pre-written crisis/deflection responses per category

See: `backend/safety_engine.py`

---

## Frontend (React + Vite)

- Persona selector (populated from backend)
- Dark mode (persisted in localStorage)
- "Important Notice" agreement gate (persisted in localStorage)
- Typing simulation with stop/regenerate controls
- Image upload preview + multipart submit

Primary files: `frontend/src/App.jsx`, `frontend/src/Chat.css`

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GROQ_API_KEY=your_key_here

# Optional
REDIS_URL=redis://localhost:6379/0
```

Run:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> **Note:** For local development, update the backend URL in `frontend/src/App.jsx` to `http://localhost:8000`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key for LLM inference |
| `REDIS_URL` | Optional | Redis for persistent memory |
| `KNOWLEDGE_API_URL` | Optional | External knowledge fetcher |
| `KNOWLEDGE_SCRAPE_URL_TEMPLATE` | Optional | URL template for scraping |
| `KNOWLEDGE_TIMEOUT_SECONDS` | Optional | Fetch timeout |
| `KNOWLEDGE_MAX_FETCH_BYTES` | Optional | Max bytes per fetch |
| `KNOWLEDGE_RESULT_LIMIT` | Optional | Max results returned |
| `KNOWLEDGE_MIN_CONTEXT_CHARS` | Optional | Minimum context threshold |

---

## Tech Stack

- **Frontend:** React, Vite
- **Backend:** FastAPI, Python
- **LLM Provider:** Groq
- **Memory:** In-memory (Redis optional)
- **Deployment:** Any platform supporting Python + Node

---

## Disclaimer

Shifts is built for **entertainment and educational experimentation**.
It is not a substitute for professional medical, legal, or psychological advice.
The safety layer is designed to handle misuse, but no system is perfect — use responsibly.

---

## License

Apache License 2.0

---

## Author

**Sanu Sharma**
[sanusharma.dev](https://sanusharma.dev) · [LinkedIn](https://linkedin.com/in/sanu-sharma-256818341) · [DEV.to](https://dev.to/sanu_sharma00)
