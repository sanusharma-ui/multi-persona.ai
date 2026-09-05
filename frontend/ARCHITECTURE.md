# Frontend structure

`src/App.jsx` composes the screens. It does not contain Shift definitions, request logic, or individual screen markup.

```text
src/
  components/
    chat/          Header, transcript, composer and Markdown rendering
    history/       Saved conversation drawer
    layout/        Feedback link
    onboarding/    Agreement and first-run experience
    shifts/        Shift gallery
  data/            Static Shift definitions, avatars and suggestions
  hooks/           Chat controls, request lifecycle and conversation persistence
  lib/             Preferences, API URL and response reveal helper
  styles/          Base, layout and feature styles; index.css loads them in order
  App.jsx
  main.jsx
```

The existing API and `shifts-conversations-v1` storage format are retained. `VITE_API_URL` optionally overrides the default backend URL. No extra runtime packages are required.

## Response animation

The backend still returns a complete JSON reply. `revealResponse` restores the earlier word-by-word presentation (20 ms per word, 5 ms per whitespace token). This is a display animation, not network token streaming. Markdown is rendered when the reveal finishes. Reduced-motion preferences skip the animation.

Each Council member reveals its own reply independently. Stop aborts requests and reveal timers, keeps visible partial text and enables Retry. Request identity checks prevent stale updates after switching or clearing conversations. Animation frames update React state without writing localStorage per word; completion, Stop and page exit persist the transcript.

## Manual verification

Run from `frontend` with the existing dependencies:

```powershell
npm.cmd run lint
npm.cmd run build
node --test tests/revealResponse.test.mjs
```

These commands were not run by the implementation agent.

In the browser, check light/dark themes at desktop and 360px widths; History/Clear should remain accessible. Send a long reply, stop halfway, retry, and switch chats during the reveal. Check Council partial failures, code-block formatting after completion, restored history after refresh, and reduced-motion behavior. Scroll up during a response: new words should not pull you away from older messages. A tall composer or image preview should not cover the last message.
