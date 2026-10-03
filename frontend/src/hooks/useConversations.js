import { useEffect, useRef, useState } from "react";
import { readPreference } from "../lib/preferences";

export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fresh = (mode = "personas", persona = readPreference("selectedPersona") || "default") => ({ id: newId(), context: newId(), mode, persona, title: "New conversation", messages: [], updated: Date.now() });

export default function useConversations(userId) {
  const storageKey = `shifts-conversations-v2:${userId}`;
  const [store, setStore] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved?.chats) && saved.chats.length && saved.chats.every((c) => c && typeof c.id === "string" && typeof c.context === "string" && typeof c.title === "string" && Array.isArray(c.messages) && c.messages.every((m) => m && typeof m.content === "string"))) {
        return { ...saved, active: saved.chats.some((c) => c.id === saved.active) ? saved.active : saved.chats[0].id,
          chats: saved.chats.map((c) => ({ ...c, mode: c.mode === "assistant" ? "assistant" : "personas",
            persona: c.persona || [...c.messages].reverse().find((m) => m.persona)?.persona || readPreference("selectedPersona") || "default",
            messages: c.messages.map((m) => m.pending || m.isTyping
            ? { ...m, pending: false, isTyping: false, failed: true, stopped: true,
                content: m.isTyping && m.content ? m.content : "Response interrupted. Retry when ready." } : m) })) };
      }
    } catch { /* Start fresh if storage is unavailable or invalid. */ }
    const chat = fresh();
    return { active: chat.id, chats: [chat] };
  });
  const [storageError, setStorageError] = useState("");
  const current = useRef(store);
  const conflict = useRef(false);
  const flush = () => {
    if (conflict.current) return false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(current.current));
      setStorageError("");
      return true;
    } catch {
      setStorageError("History could not be saved. Free browser storage or copy your chat before switching modes.");
      return false;
    }
  };
  const commit = (update, { persist = true } = {}) => {
    const next = update(current.current);
    current.current = next;
    setStore(next);
    if (conflict.current || !persist) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch { setStorageError("This conversation could not be saved. Browser storage may be full or unavailable; keep this tab open to retain it."); }
  };
  useEffect(() => {
    const saveOnExit = () => {
      if (conflict.current) return;
      try { localStorage.setItem(storageKey, JSON.stringify(current.current)); }
      catch { /* Normal commits already surface storage errors to the user. */ }
    };
    const sync = (event) => {
      if (event.key === storageKey || event.key === null) {
        conflict.current = true;
        setStorageError("Chat history changed in another tab. Saving is paused here to protect those changes. Copy any new messages before reloading this tab.");
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener("pagehide", saveOnExit);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("pagehide", saveOnExit);
    };
  }, [storageKey]);
  const active = store.chats.find((c) => c.id === store.active);
  const setMessages = (update, options) => commit((s) => ({ ...s, chats: s.chats.map((c) => {
    if (c.id !== s.active) return c;
    const messages = typeof update === "function" ? update(c.messages) : update;
    const first = messages.find((m) => m.role === "user");
    return { ...c, messages, updated: Date.now(), title: c.title === "New conversation" && first ? first.content.slice(0, 60) : c.title };
  }) }), options);
  const activate = (s, chat) => ({ ...s, active: chat.id,
    lastActive: { ...s.lastActive, [active.mode]: s.active, [chat.mode]: chat.id } });
  const create = (mode = active.mode, persona = active.persona) => commit((s) => {
    const chat = fresh(mode, persona);
    return { ...activate(s, chat), chats: [chat, ...s.chats] };
  });
  const resumeMode = (mode, persona) => commit((s) => {
    const candidates = s.chats.filter((c) => c.mode === mode);
    const chat = candidates.find((c) => c.id === s.lastActive?.[mode])
      || candidates.sort((a, b) => b.updated - a.updated)[0];
    if (chat) return activate(s, chat);
    const next = fresh(mode, persona);
    return { ...activate(s, next), chats: [next, ...s.chats] };
  });
  const setPersona = (persona) => commit((s) => ({ ...s, chats: s.chats.map((c) => c.id === s.active ? { ...c, persona } : c) }));
  const select = (id) => commit((s) => {
    const chat = s.chats.find((c) => c.id === id);
    return chat ? activate(s, chat) : s;
  });
  const rename = (id, title) => commit((s) => ({ ...s, chats: s.chats.map((c) => c.id === id ? { ...c, title: title.trim().slice(0, 100) || c.title } : c) }));
  const remove = (id) => commit((s) => {
    const chats = s.chats.filter((c) => c.id !== id);
    let next = chats.find((c) => c.mode === active.mode);
    if (!next) { next = fresh(active.mode, active.persona); chats.unshift(next); }
    const lastActive = { ...s.lastActive };
    for (const mode of Object.keys(lastActive)) {
      if (lastActive[mode] === id) delete lastActive[mode];
    }
    return { ...s, chats, lastActive, active: s.active === id ? next.id : s.active };
  });
  const clear = () => commit((s) => ({ ...s, chats: s.chats.map((c) => c.id === s.active ? { ...c, context: newId(), messages: [], title: "New conversation", updated: Date.now() } : c) }));
  return { chats: store.chats, active, messages: active.messages, setMessages, create, resumeMode, select, rename, remove, clear, setPersona, flush, storageError };
}
