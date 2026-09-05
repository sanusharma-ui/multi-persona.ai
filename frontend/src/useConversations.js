import { useEffect, useRef, useState } from "react";

export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fresh = () => ({ id: newId(), context: newId(), title: "New conversation", messages: [], updated: Date.now() });

export default function useConversations() {
  const [store, setStore] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("shifts-conversations-v1"));
      if (Array.isArray(saved?.chats) && saved.chats.length && saved.chats.every((c) => c && typeof c.id === "string" && typeof c.context === "string" && typeof c.title === "string" && Array.isArray(c.messages) && c.messages.every((m) => m && typeof m.content === "string"))) {
        return { ...saved, active: saved.chats.some((c) => c.id === saved.active) ? saved.active : saved.chats[0].id,
          chats: saved.chats.map((c) => ({ ...c, messages: c.messages.map((m) => m.pending ? { ...m, pending: false, failed: true, content: "Response interrupted. Retry when ready." } : m) })) };
      }
    } catch { /* Start fresh if storage is unavailable or invalid. */ }
    const chat = fresh();
    return { active: chat.id, chats: [chat] };
  });
  const [storageError, setStorageError] = useState("");
  const current = useRef(store);
  const conflict = useRef(false);
  const commit = (update) => {
    const next = update(current.current);
    current.current = next;
    setStore(next);
    if (conflict.current) return;
    try {
      localStorage.setItem("shifts-conversations-v1", JSON.stringify(next));
      setStorageError("");
    } catch { setStorageError("This conversation could not be saved. Browser storage may be full or unavailable; keep this tab open to retain it."); }
  };
  useEffect(() => {
    const sync = (event) => {
      if (event.key === "shifts-conversations-v1" || event.key === null) {
        conflict.current = true;
        setStorageError("Chat history changed in another tab. Saving is paused here to protect those changes. Copy any new messages before reloading this tab.");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const active = store.chats.find((c) => c.id === store.active);
  const setMessages = (update) => commit((s) => ({ ...s, chats: s.chats.map((c) => {
    if (c.id !== s.active) return c;
    const messages = typeof update === "function" ? update(c.messages) : update;
    const first = messages.find((m) => m.role === "user");
    return { ...c, messages, updated: Date.now(), title: c.title === "New conversation" && first ? first.content.slice(0, 60) : c.title };
  }) }));
  const create = () => commit((s) => { const chat = fresh(); return { active: chat.id, chats: [chat, ...s.chats] }; });
  const select = (id) => commit((s) => ({ ...s, active: id }));
  const rename = (id, title) => commit((s) => ({ ...s, chats: s.chats.map((c) => c.id === id ? { ...c, title: title.trim().slice(0, 100) || c.title } : c) }));
  const remove = (id) => commit((s) => {
    const chats = s.chats.filter((c) => c.id !== id);
    if (!chats.length) chats.push(fresh());
    return { chats, active: s.active === id ? chats[0].id : s.active };
  });
  const clear = () => commit((s) => ({ ...s, chats: s.chats.map((c) => c.id === s.active ? { ...c, context: newId(), messages: [], title: "New conversation", updated: Date.now() } : c) }));
  return { chats: store.chats, active, messages: active.messages, setMessages, create, select, rename, remove, clear, storageError };
}
