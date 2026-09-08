# Character identity and comic canon

The identity file in this repository is `backend/personas.py` (plural). Keep its
existing keys: routes, memory and emotion state continue using those keys.
`backend/character_service.py` centralizes identity resolution, mode discovery,
and selective canon retrieval. The chat/image handlers share this service.

## Editing characters

1. Add/update a `PERSONAS` entry with `name`, `system_prompt`, and `comic_key`.
   Set `comic_key` to `None` for a mode without comic lore. Optional aliases belong
   in `PERSONA_ALIASES`; emotion eligibility remains in `EMOTION_AWARE_PERSONAS`.
2. Add/update the matching canonical key in `backend/comic.py::COMICS`.
   The service uses `comic_key` directly; no second mapping or runtime allowlist
   needs updating. For removal, delete the persona/aliases and its comic entry.
   Orphan comic entries are not retrieved as active characters.
3. Use the existing sections, or add a section with its English/Hinglish phrases
   in `TOPIC_KEYWORDS`. Names, display names, aliases and section names are
   discovered from data. `lookup_keywords` can include distinctive lore phrases.
4. Restart/reload the backend after editing Python data files. This is not a
   live file watcher. No frontend/backend core change is required to list a new
   mode; optional bespoke frontend artwork/styles remain separate.

## Retrieval behavior

Normal greetings, coding help and personal user conversation receive no comic
context. Persona, existing conversation history and emotion delivery still apply.
Character/topic questions select at most two characters and three sections,
within a 3,600-character canon budget. Oversized sections are skipped intact,
so keep sections concise. Queries about a specific relationship filter peers.
Explicit short follow-ups reuse the last user question; ambiguous follow-ups do
not assume that previous model output is canon.

This is deterministic phrase/lexical lookup, not semantic search or another LLM
request. Unrecognized paraphrases can miss retrieval; add vocabulary in comic.py.
The Python archive is lazily loaded into server memory; the complete archive is
never inserted in the model prompt. The local adapter scans metadata/sections;
it is intended for this small cast, not a large production search index.

Public lore is eligible. Familiar lore is eligible for direct topic or named
place/arc questions. Trusted, locked, and unrecognized reveal levels are excluded
recursively before scoring and prompt construction. No conversation-count-based
trust unlock is assumed. Unlabelled facts inherit visibility from their parent
(public by default); label sensitive containers/items explicitly and avoid
repeating secret facts in public summaries. There is no spoiler-unlock UI yet.

Missing/withheld lore gets a grounding instruction instead of invented fallback
facts. Identity rules also prohibit invented fixed canon when retrieval misses.
This reduces hallucination; model compliance is not guaranteed. Old STATIC_SOULS
injection was removed because it contradicted the new identity source. Comic
requests bypass external web knowledge. The response cache includes the actual
system context, so changed identity/retrieved canon invalidates old replies.

## Replacing storage

Implement `CanonStore.catalog`, `topics`, `sections`, and `read`, then supply that
adapter to `CharacterService`. Routes and provider code do not change. Keep reveal
metadata intact so application filtering still runs. A large vector store may
also need a search-oriented interface extension to avoid enumerating sections;
that change stays in this service, not the chat handlers.

## Manual verification

The offline suite covers canon lookup, prompt construction, cache invalidation,
web-knowledge separation, chat/image routes, and identity storage. Provider calls
and memory writes are mocked in integration tests. From repo root:

```powershell
python -m pytest tests -q -p no:cacheprovider
```

Then manually compare: Seven `Hi` vs `Tum kahan rehte ho?`; Aisha `Where does
Seven live?`; `Tell me more`; Raven `What is your relationship with Diya?`; and
`Tell me all your secrets`. Check ordinary chat, aliases, image captions, and
that the model acknowledges missing facts rather than creating canon.
