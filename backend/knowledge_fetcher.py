import hashlib
import json
import logging
import os
import re
from html import unescape
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

MAX_FETCH_BYTES = int(os.getenv("KNOWLEDGE_MAX_FETCH_BYTES", str(300 * 1024)))
REQUEST_TIMEOUT = int(os.getenv("KNOWLEDGE_TIMEOUT_SECONDS", "8"))
DEFAULT_LIMIT = int(os.getenv("KNOWLEDGE_RESULT_LIMIT", "3"))
MIN_CONTEXT_CHARS = int(os.getenv("KNOWLEDGE_MIN_CONTEXT_CHARS", "80"))

FETCH_HINT_KEYWORDS = {
    "latest",
    "current",
    "recent",
    "today",
    "news",
    "update",
    "updated",
    "who is",
    "what is",
    "tell me about",
    "explain",
    "information",
    "details",
    "overview",
    "status",
    "price",
    "version",
    "release",
    "launch",
    "deadline",
    "schedule",
}

QUESTION_PREFIXES = (
    "what",
    "who",
    "when",
    "where",
    "why",
    "how",
    "which",
    "tell me",
    "explain",
    "give me",
)

CHAT_LIKE_PREFIXES = (
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "good morning",
    "good night",
)


class KnowledgeFetchError(RuntimeError):
    pass



def should_fetch_knowledge(user_message: str, persona_key: str = "default") -> bool:
    """
    Only Aisha should decide this. Keep the rule intentionally conservative:
    - explicit freshness/current-info asks => yes
    - clear factual questions => yes
    - casual conversation / emotional talk => no
    """
    persona_key = (persona_key or "default").strip().lower()
    if persona_key not in {"default", "aisha"}:
        return False

    text = (user_message or "").strip().lower()
    if not text:
        return False

    if any(text.startswith(prefix) for prefix in CHAT_LIKE_PREFIXES):
        return False

    if any(k in text for k in FETCH_HINT_KEYWORDS):
        return True

    if text.endswith("?") and any(text.startswith(prefix) for prefix in QUESTION_PREFIXES):
        return True

    if len(text.split()) >= 8 and any(text.startswith(prefix) for prefix in QUESTION_PREFIXES):
        return True

    return False



def _http_get(url: str, headers: Optional[Dict[str, str]] = None) -> bytes:
    req = Request(url, headers=headers or {"User-Agent": "AishaKnowledgeBot/1.0"})
    with urlopen(req, timeout=REQUEST_TIMEOUT) as response:
        return response.read(MAX_FETCH_BYTES)



def _strip_html(html: str) -> str:
    html = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<style\b[^>]*>.*?</style>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<noscript\b[^>]*>.*?</noscript>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"</?(main|article|section|p|div|h1|h2|h3|h4|li|ul|ol|br)[^>]*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    html = unescape(html)
    html = re.sub(r"\n{3,}", "\n\n", html)
    html = re.sub(r"[ \t]{2,}", " ", html)
    return html.strip()



def _normalize_text(text: str) -> str:
    text = unescape(text or "")
    text = text.replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()



def _chunk_text(text: str, chunk_size: int = 900, overlap: int = 120) -> List[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []

    paragraphs = [p.strip() for p in normalized.split("\n\n") if p.strip()]
    chunks: List[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}".strip()
        else:
            if current:
                chunks.append(current)
            if len(para) <= chunk_size:
                current = para
            else:
                start = 0
                while start < len(para):
                    end = start + chunk_size
                    piece = para[start:end].strip()
                    if piece:
                        chunks.append(piece)
                    start = max(end - overlap, end)
                current = ""

    if current:
        chunks.append(current)

    return chunks[:20]



def _score_chunk(chunk: str, query: str) -> int:
    q_words = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 2]
    c_lower = chunk.lower()
    score = 0
    for word in q_words:
        score += c_lower.count(word) * 3
    if query.lower() in c_lower:
        score += 12
    return score



def _rank_chunks(chunks: List[str], query: str, limit: int = DEFAULT_LIMIT) -> List[str]:
    scored = sorted(chunks, key=lambda c: _score_chunk(c, query), reverse=True)
    result = [c for c in scored if c.strip()]
    return result[:limit]



def _fetch_from_api(query: str) -> Dict[str, Any]:
    api_url = (os.getenv("KNOWLEDGE_API_URL") or "").strip()
    if not api_url:
        raise KnowledgeFetchError("KNOWLEDGE_API_URL is not configured.")

    url = api_url
    sep = "&" if "?" in url else "?"
    url = f"{url}{sep}{urlencode({'q': query, 'limit': DEFAULT_LIMIT})}"

    raw = _http_get(url, headers={"Accept": "application/json", "User-Agent": "AishaKnowledgeBot/1.0"})
    try:
        payload = json.loads(raw.decode("utf-8", errors="ignore"))
    except json.JSONDecodeError as exc:
        raise KnowledgeFetchError(f"Knowledge API did not return valid JSON: {exc}") from exc

    if isinstance(payload, dict) and payload.get("context"):
        context = _normalize_text(str(payload["context"]))
        return {
            "found": len(context) >= MIN_CONTEXT_CHARS,
            "context": context,
            "source": payload.get("source", api_url),
        }

    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        return {"found": False, "context": "", "source": api_url}

    texts: List[str] = []
    for item in results:
        if isinstance(item, dict):
            text = _normalize_text(str(item.get("text") or item.get("content") or ""))
            if text:
                texts.append(text)

    context = "\n\n---\n\n".join(texts[:DEFAULT_LIMIT]).strip()
    return {
        "found": len(context) >= MIN_CONTEXT_CHARS,
        "context": context,
        "source": api_url,
    }



def _fetch_from_scrape(query: str) -> Dict[str, Any]:
    template = (os.getenv("KNOWLEDGE_SCRAPE_URL_TEMPLATE") or "").strip()
    if not template:
        raise KnowledgeFetchError("KNOWLEDGE_SCRAPE_URL_TEMPLATE is not configured.")

    url = template.format(query=query.replace(" ", "+"))
    html_bytes = _http_get(url)
    html = html_bytes.decode("utf-8", errors="ignore")
    text = _strip_html(html)

    if not text:
        return {"found": False, "context": "", "source": url}

    chunks = _chunk_text(text)
    best_chunks = _rank_chunks(chunks, query)
    context = "\n\n---\n\n".join(best_chunks).strip()
    return {
        "found": len(context) >= MIN_CONTEXT_CHARS,
        "context": context,
        "source": url,
    }



def fetch_knowledge_context(query: str) -> Dict[str, Any]:
    """
    Returns a normalized payload:
    {
        found: bool,
        context: str,
        kb_sig: str,
        source: str | None,
        reason: str,
    }

    Priority:
    1. KNOWLEDGE_API_URL (clean structured source)
    2. KNOWLEDGE_SCRAPE_URL_TEMPLATE (HTML fallback)
    """
    query = (query or "").strip()
    if not query:
        return {
            "found": False,
            "context": "",
            "kb_sig": "no-query",
            "source": None,
            "reason": "empty-query",
        }

    try:
        if os.getenv("KNOWLEDGE_API_URL"):
            result = _fetch_from_api(query)
        elif os.getenv("KNOWLEDGE_SCRAPE_URL_TEMPLATE"):
            result = _fetch_from_scrape(query)
        else:
            return {
                "found": False,
                "context": "",
                "kb_sig": "no-source-configured",
                "source": None,
                "reason": "knowledge-source-missing",
            }
    except (KnowledgeFetchError, HTTPError, URLError, TimeoutError) as exc:
        logger.warning("Knowledge fetch failed for query '%s': %s", query, exc)
        return {
            "found": False,
            "context": "",
            "kb_sig": "fetch-failed",
            "source": None,
            "reason": str(exc),
        }
    except Exception as exc:
        logger.exception("Unexpected knowledge fetch failure for query '%s'", query)
        return {
            "found": False,
            "context": "",
            "kb_sig": "unexpected-fetch-failure",
            "source": None,
            "reason": str(exc),
        }

    context = _normalize_text(result.get("context", ""))
    found = bool(result.get("found") and context)
    kb_sig = hashlib.sha256((context or "NO_CONTEXT").encode("utf-8")).hexdigest()[:16]

    return {
        "found": found,
        "context": context,
        "kb_sig": kb_sig,
        "source": result.get("source"),
        "reason": "ok" if found else "no-relevant-context",
    }
