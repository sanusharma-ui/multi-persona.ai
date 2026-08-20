# Shifts

Shifts is a multi-persona AI chat application built with React, FastAPI, and Groq. Each persona has a distinct voice, behavior, and purpose, so the same conversation can feel practical, creative, technical, calm, or completely fictional.

The project is designed as both a usable chat experience and a developer-friendly foundation for experimenting with persona systems, memory, safety controls, image input, and emotion-aware responses.

## What It Includes

- 17 switchable personas, including a developer buddy, teacher, creative assistant, guide, and fictional characters
- Groq-powered text generation
- Optional image chat through the vision-capable model configured in the backend
- Per-user, per-persona conversation memory
- Optional Redis-backed memory support
- Safety checks for harmful, abusive, exploitative, and dependency-related requests
- Emotion-aware state for selected personas
- Optional knowledge retrieval for the Aisha persona
- Markdown rendering, syntax highlighting, copy actions, typing simulation, and message regeneration
- Light and dark frontend modes with browser persistence

## Personas

Personas are defined in `backend/personas.py`. The frontend displays the names returned by `GET /modes/list` and has a local fallback list for startup or backend outages.

| Key | Persona | Focus |
| --- | --- | --- |
| `default` | Aisha | Platform guide and admin assistant |
| `seven` | Seven | Cosmic, emotional storytelling |
| `virex` | Virex | Direct, analytical advice |
| `noctra` | Noctra | Dreamy creative support |
| `kael` | Kael | Calm strength and perspective |
| `mira_time` | Mira | Choices, timelines, and reflection |
| `zenith` | Zenith | Step-by-step learning |
| `neo` | Neo | Friendly development help |
| `cipher` | Cipher | Ethical cybersecurity conversations |
| `nyra` | Nyra | Ideas, naming, and creative work |
| `rishi` | Rishi | Modern Vedantic guidance |
| `pulse` | Pulse | Clear and direct reality checks |
| `diya` | Diya | Casual Gen Z and Hinglish conversation |
| `arjun` | Arjun | Calm, aesthetic conversation |
| `raven` | Raven | Bold confidence and attitude |
| `Creator_mode` | Creator Mode | Project and creator-focused questions |
| `Sales_Bot_Mode` | Nexus | Product and sales conversations |

To add or change a persona, update `PERSONAS` in `backend/personas.py`. If the persona should use the emotion engine, also add its key to `EMOTION_AWARE_PERSONAS`.

## Architecture

```text
React + Vite frontend
        |
        | HTTP / multipart requests
        v
FastAPI backend
  |-- persona prompts and routing
  |-- safety engine
  |-- memory and emotion state
  |-- optional knowledge retrieval
  '-- Groq model requests
```

The main request path is:

1. The frontend sends a message with a persona key and `x-user-id` header.
2. FastAPI validates the persona and message length.
3. The safety engine checks the request before generation.
4. The backend loads the relevant persona memory and builds the prompt.
5. Groq generates the response.
6. The response and updated state are returned to the frontend.

## Backend API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Readiness response and available persona keys |
| `GET` | `/health` | Basic health check |
| `GET` | `/modes/list` | Persona keys and display names |
| `POST` | `/chat?mode=<key>&reset=<bool>` | Send a text message |
| `POST` | `/chat/image?mode=<key>` | Send an image with optional text |
| `GET` | `/memory` | Read default-persona memory for the current user |
| `POST` | `/memory/update` | Update default-persona user metadata |

### Text chat example

```bash
curl -X POST "http://localhost:8000/chat?mode=neo" \
  -H "Content-Type: application/json" \
  -H "x-user-id: local-dev-user" \
  -d '{"message":"Help me debug this Python function.","language":"en"}'
```

### Image chat example

```bash
curl -X POST "http://localhost:8000/chat/image?mode=default" \
  -H "x-user-id: local-dev-user" \
  -F "file=@./example.png" \
  -F "message=What do you see in this image?" \
  -F "language=en"
```

Important request limits:

- Text and image-chat messages are limited to 2,000 characters.
- Uploaded images must be JPEG, PNG, GIF, or WebP.
- Uploaded images are limited to 5 MB and are removed after processing.
- Unknown persona keys fall back to `default` for text chat.

## Local Setup

### Requirements

- Python 3.10 or newer
- Node.js 18 or newer and npm
- A Groq API key
- Redis only if you want Redis-backed memory

### 1. Configure the backend

From the repository root:

```bash
python -m venv .venv
```

Activate the environment on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
```

### 2. Start the API

Run this command from the repository root so the `backend` package imports resolve correctly:

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, normally `http://localhost:5173`.

The current frontend selects `http://localhost:8000` on localhost. On a non-localhost deployment it uses the production backend URL defined in `frontend/src/App.jsx`; update that value when deploying your own backend.

## Environment Variables

### Required

| Variable | Description |
| --- | --- |
| `GROQ_API_KEY` | API key used for Groq model requests |

### Optional

| Variable | Description |
| --- | --- |
| `REDIS_URL` | Redis connection URL for Redis-backed memory |
| `KNOWLEDGE_API_URL` | Structured knowledge endpoint used by Aisha |
| `KNOWLEDGE_SCRAPE_URL_TEMPLATE` | Fallback URL template for knowledge retrieval |
| `KNOWLEDGE_TIMEOUT_SECONDS` | Knowledge request timeout; defaults to `8` |
| `KNOWLEDGE_MAX_FETCH_BYTES` | Maximum fetched response size |
| `KNOWLEDGE_RESULT_LIMIT` | Maximum number of knowledge results |
| `KNOWLEDGE_MIN_CONTEXT_CHARS` | Minimum context size accepted by the fetcher |
| `MAX_KNOWLEDGE_CHARS` | Maximum knowledge context in a prompt; defaults to `2600` |

Keep `.env` files and API keys out of source control. The backend loads environment variables through `python-dotenv`.

## Frontend

The frontend is a Vite application with React. It includes:

- Persona selection populated from the backend
- Local fallback persona data when the API is unavailable
- Light and dark modes persisted in localStorage
- Important-notice agreement gate
- Typing simulation with stop and regenerate controls
- Image upload preview and multipart submission
- Markdown and code rendering

Primary files are `frontend/src/App.jsx`, `frontend/src/Chat.css`, and `frontend/src/components/MarkdownMessage.jsx`.

## Safety Engine

The safety layer checks categories such as jailbreak attempts, self-harm, violence, sexual exploitation, terrorism, malware requests, abusive language, and unhealthy emotional dependency. It combines fast keyword checks, regular-expression patterns, allowlists, and category-specific responses.

Safety filtering reduces risk but cannot guarantee perfect results. Shifts is intended for entertainment, education, and experimentation. It is not a replacement for medical, legal, mental-health, or emergency services.

See `backend/safety_engine.py` for the implementation.

## Developer Workflow

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

Run the emotion smoke test from the repository root after configuring `GROQ_API_KEY`:

```bash
python test_raven_emotion.py
```

When changing API behavior, update both the route in `backend/main.py` and its caller in `frontend/src/App.jsx`. When changing persona behavior, keep the persona key stable unless the frontend fallback list and stored user selections are updated too.

## Project Layout

```text
backend/
  main.py                 FastAPI application and HTTP routes
  groq_handler.py         Model calls, prompt assembly, and memory integration
  personas.py             Persona definitions and behavior rules
  safety_engine.py        Request safety checks and responses
  knowledge_fetcher.py    Optional external knowledge retrieval
  emotion/                Emotion state, rules, prompts, and persistence
  requirements.txt        Python dependencies

frontend/
  src/App.jsx             Main chat UI and API integration
  src/Chat.css            Chat and persona styling
  src/components/         Reusable frontend components
  package.json            npm scripts and dependencies

test_raven_emotion.py     Local smoke test for Raven emotion state
```

## Deployment Notes

The backend can run on any Python host that supports FastAPI and Uvicorn or Gunicorn. Build the frontend as a static Vite application:

```bash
cd frontend
npm run build
```

Before deploying, review the CORS origins in `backend/main.py`, configure `GROQ_API_KEY` in the hosting provider, and update the frontend production backend URL in `frontend/src/App.jsx`.

## Tech Stack

- **Frontend:** React 19, Vite, React Markdown, Remark GFM
- **Backend:** Python, FastAPI, Uvicorn
- **LLM provider:** Groq
- **Memory:** Local file-based storage with optional Redis support
- **Image handling:** Pillow, python-multipart

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for the full text.

## Author

**Sanu Sharma**  
[Website](https://sanusharma.dev) · [LinkedIn](https://linkedin.com/in/sanu-sharma-256818341) · [DEV.to](https://dev.to/sanu_sharma00)
