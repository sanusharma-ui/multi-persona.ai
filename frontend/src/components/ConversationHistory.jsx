import { useEffect, useRef, useState } from "react";

export default function ConversationHistory({ history, onClose, onAction }) {
  const [search, setSearch] = useState("");
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector("button")?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll("button, input");
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  const query = search.trim().toLowerCase();
  const chats = [...history.chats].sort((a, b) => b.updated - a.updated).filter((c) =>
    c.title.toLowerCase().includes(query) || c.messages.some((m) => String(m.content).toLowerCase().includes(query)));
  return (
    <div className="history-backdrop" onMouseDown={onClose}>
      <aside ref={panel} className="history-panel" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="history-heading"><h2 id="history-title">Your conversations</h2><button onClick={onClose} aria-label="Close history">×</button></div>
        <p>Saved in this browser. Each conversation has its own AI context.</p>
        <button className="history-new" onClick={() => onAction(history.create)}>+ New conversation</button>
        <input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="history-list">
          {!chats.length && <p>No matching conversations.</p>}
          {chats.map((chat) => (
            <div key={chat.id} className={`history-item ${chat.id === history.active.id ? "active" : ""}`}>
              <button className="history-select" aria-current={chat.id === history.active.id ? "true" : undefined} onClick={() => onAction(() => history.select(chat.id))}>
                <strong>{chat.title}</strong><small>{chat.messages.filter((m) => m.role === "user").length} messages · {new Date(chat.updated).toLocaleDateString()}</small>
              </button>
              <div className="history-item-actions">
                <button onClick={() => { const title = window.prompt("Conversation name", chat.title); if (title?.trim()) history.rename(chat.id, title); }}>Rename</button>
                <button onClick={() => { if (window.confirm("Delete this saved conversation from this browser? This cannot be undone.")) onAction(() => history.remove(chat.id)); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
