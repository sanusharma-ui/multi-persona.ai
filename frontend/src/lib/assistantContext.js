export const ASSISTANT_INPUT_LIMIT = 20000;
export const ASSISTANT_CONTEXT_LIMIT = 64000;

// Only complete visible pairs belong in context. Retry replaces a turn, so exclude
// that turn and everything after it. Never mix persona messages into this payload.
export function assistantContext(messages, retryId = null) {
  const end = retryId ? messages.findIndex((message) => message.id === retryId) : messages.length;
  const pairs = [];
  let user = null;
  for (const message of messages.slice(0, Math.max(0, end))) {
    if (message.role === "user") user = message;
    else if (user && message.role === "assistant") {
      if (message.persona === "assistant" && !message.failed && !message.stopped && !message.pending && !message.isTyping) {
        pairs.push([
          { role: "user", content: user.content + (user.image ? "\n[Image attached in this turn; not retained in context.]" : "") },
          { role: "assistant", content: message.content },
        ]);
      }
      user = null;
    }
  }
  let size = 0;
  const recent = [];
  for (const pair of pairs.reverse()) {
    const length = pair.reduce((sum, turn) => sum + turn.content.length, 0);
    if (size + length > ASSISTANT_CONTEXT_LIMIT || recent.length >= 40) break;
    recent.unshift(pair);
    size += length;
  }
  return recent.flat();
}
