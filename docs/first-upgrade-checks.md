# First upgrade: manual verification

These checks have not been run by the implementation agent. No dependency installs or provider calls were made.

## Commands

From the repository root, using your existing Python environment:

```powershell
python -m pytest tests/test_identity_storage.py tests/test_chat_routes.py -q
```

The new route tests stub the AI providers and memory; they do not require API keys or Redis. They require the existing backend dependencies and pytest.

From `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
```

## Browser checks

1. Send a suggestion chip with an empty composer. Its exact text should be submitted once.
2. Send an image with a specific question. Confirm the answer uses the question. The user preview should remain, with no broken assistant image. Try invalid formats and an image over 5 MB.
3. Open History, create two chats, rename them, and search their titles and message text. Reload and reopen both. Their transcripts should remain separate. Ask a follow-up in each using the same Shift.
4. Switch Shifts during a response. The stopped reply should offer Retry; a late response must not append or overwrite a message. Existing messages should remain visible and assistant names should identify their Shift.
5. Enable Council. Delay one request and fail another using browser request interception. The successful reply should display while the others are pending. Only the failed member should retry, without duplicating the user message.
6. Stop a pending response, then send again immediately. Old request completion must not clear the new loading state or replace its reply. Repeat while opening a different conversation and while clearing the chat.
7. Regenerate the latest response with unrelated text in the composer. It should resend the original request and replace that response. Repeat for an image response.
8. Clear a chat. Its next request should carry a different `x-conversation-id`; old context must not be used. Cancel the confirmation and verify the chat remains intact.
9. Delete the active conversation, including the last remaining conversation. The app should select another chat or create an empty one.
10. Reload during a pending reply. The saved reply should become interrupted with Retry available.
11. Check at 360px width and in both themes. History should scroll, close with Escape, keep keyboard focus inside, and return focus to its trigger.
12. Fill or disable browser storage. Saving failures should be visible. With two tabs, a history update in one should pause saving in the other instead of overwriting it.

## Behavior and limits

- History is browser-local, not account sync. Browser storage limits apply, especially to image previews; a visible warning reports save failures. Keep the tab open if a save fails.
- Each conversation and Shift has separate backend context. Switching Shifts retains the visible transcript; a Shift recalls its own turns in that conversation.
- Clear starts a fresh context. Clear/delete do not erase historical server memory files or Redis entries; server retention and account-level deletion are outside this upgrade.
- Stop cancels browser requests and rejects late UI updates. It cannot guarantee cancellation of already-running provider generation or its server memory write. Retry can issue another provider request.
- The subsequent UI update restores the original word-by-word reply animation. See `frontend/ARCHITECTURE.md` for the updated structure and checks. This is not network token streaming.
- Regenerate replaces the displayed reply and resends its original input. The existing backend still appends the new turn to its memory; conversation branching is not introduced here.
- Deploy the backend changes together with the frontend: older backends ignore the conversation header and lack the multipart prompt fix.
