# General chatbot mode

Confirmation appears only when entering **Chatbot** from **Personas**, including
opening a saved chatbot conversation. Cancel preserves the chat, draft, attachment
and active request. Accepting stops an active response and discards the unsent
draft/attachment, as the confirmation explains.

Changing a Shift within Personas keeps the same conversation, context, draft and
attachment, without confirmation or a new history entry. Any active reply stops;
existing replies retain their original character labels. Returning from Chatbot to
Personas needs no confirmation. Mode changes resume the last opened conversation
in that mode, creating one only if none exists. Explicit **New conversation** still
starts a separate chat. Mode changes and saved-chat navigation clear the composer.
A storage failure or another-tab conflict blocks navigation. History labels
distinguish the modes; opening a different saved persona chat needs no confirmation.

## History and memory

- Existing account-scoped `shifts-conversations-v2:<user-id>` browser storage is
  preserved. Older entries without a mode are treated as persona conversations.
  Each conversation stores its mode, selected persona and independent context ID.
- The last opened chat per mode is persisted across reloads. Existing separate
  persona chats remain available in History; they are never automatically merged
  or deleted. Changing characters updates only the active persona conversation.
- The full visible transcript stays in browser history, subject to browser quota.
  This is **not cloud sync**. Another device/browser will not have these chats;
  clearing site data removes them. Storage failures are displayed, never silently
  presented as successful saves. Existing multi-tab conflict protection remains.
- Persona generation, canon, emotion, memory and default 3,500-token provider
  allowance are unchanged. Assistant requests use separate authenticated endpoints
  and never read/write persona memory or persona response caches.
- Assistant context comes from that conversation's recent complete visible turns:
  at most 40 pairs and 64,000 characters, keeping each pair intact. Older history
  stays visible but may be outside model context; there is no automatic summary or
  cross-conversation personal memory. Failed, pending and stopped turns are excluded.
- Because the assistant has no hidden server transcript, a stopped/late provider
  response cannot silently become future context. Regeneration excludes the answer
  being replaced. Retrying an older failed question after subsequent turns sends it
  as a new turn, preserving the later transcript. Clear creates a new context; deleting assistant history removes
  its only app-owned persistent transcript in this browser. Existing persona memory
  retention is unchanged; deleting a browser entry does not erase server persona data.
- Images are validated and processed in memory server-side. Their previews remain
  in browser history. Past image bytes are not replayed to the model; the context
  marks prior attachments so the assistant can ask for reattachment.

## Capabilities and boundaries

Chatbot supports general assistance, coding, Markdown, language-labelled copyable
code blocks, image questions, 20,000-character inputs and an 8,192-token output
allowance passed through both text/image fallback paths. It uses the existing
provider order. Actual answer length and quality depend on the provider/model.
It has no new browsing, code execution or file-system tools. Responses use the
existing JSON protocol, displayed as complete Markdown without a long word-reveal
animation; persona reveal behavior stays intact.

## Verification

From the repository root:

```powershell
.venv\Scripts\python.exe -m pytest tests -q
```

From `frontend`:

```powershell
node --test tests/assistantContext.test.mjs tests/revealResponse.test.mjs
npm.cmd run test:auth
npm.cmd run build
node node_modules/eslint/bin/eslint.js src/App.jsx src/hooks src/components/chat src/components/history src/lib/assistantContext.js
```

Backend and browser tests use mocked providers/authentication, not real API calls.
The browser suite covers confirmation/cancel on entering Chatbot, direct return
to Personas, shared persona history, per-mode resume across reloads, saved-chat resume,
reload, account isolation, code blocks, mobile overflow, in-flight cancellation and
storage-failure protection. Live provider responses require a separate smoke check.
Full-project lint currently reports a pre-existing unused `delta` in
`frontend/src/components/auth/AuthScene3D.jsx`; that file is outside this change.
