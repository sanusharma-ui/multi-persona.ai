import { useEffect, useRef, useState } from "react";
import { authError, supabase } from "../../lib/auth";

export default function AccountMenu({ user, onBeforeSignOut }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef(null);
  const trigger = useRef(null);
  const label = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "Your account";
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  const logout = async () => {
    setBusy(true); setError(""); onBeforeSignOut();
    try {
      const { error: failure } = await supabase.auth.signOut({ scope: "local" });
      if (failure) setError(authError(failure));
    } catch (caught) { setError(authError(caught)); }
    finally { setBusy(false); }
  };
  return <div className="account-menu" ref={root}>
    <button className="account-trigger" ref={trigger} aria-label="Your account" aria-expanded={open} aria-controls="account-panel" onClick={() => setOpen(!open)}>{String(label).slice(0, 1).toUpperCase()}</button>
    {open && <div className="account-panel" id="account-panel">
      <strong>{label}</strong><span>{user.email}</span>
      <p>Chat history is saved in this browser for your account.</p>
      {error && <p role="alert">{error}</p>}
      <button className="top-action" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Sign out"}</button>
    </div>}
  </div>;
}
