import { useEffect, useState } from "react";
import { authCallbackError, authError, supabase } from "../lib/auth";

const recoveryKey = "shifts-password-recovery";
const initialUrl = new URL(window.location.href);
const initialHash = new URLSearchParams(initialUrl.hash.slice(1));
const callbackError = authCallbackError(initialUrl);
const callbackFailed = Boolean(callbackError);
const callbackRecovery = initialUrl.searchParams.get("auth") === "reset" || initialHash.get("type") === "recovery";

function rememberRecovery(value) {
  try {
    if (value) sessionStorage.setItem(recoveryKey, "true");
    else sessionStorage.removeItem(recoveryKey);
  } catch { /* Recovery still works when session storage is unavailable. */ }
}

export default function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(callbackError);
  const [recovery, setRecovery] = useState(() => {
    try { return callbackRecovery || sessionStorage.getItem(recoveryKey) === "true"; }
    catch { return callbackRecovery; }
  });

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      eventReceived = true;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        rememberRecovery(true);
        setRecovery(true);
      }
    });
    // Initialization errors must not let a bad recovery link reuse an older session.
    const restore = async () => {
      const { error: initializationError } = await supabase.auth.initialize();
      const result = await supabase.auth.getSession();
      return { ...result, error: initializationError || result.error };
    };
    restore().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (!eventReceived) setSession(data.session);
      if (sessionError && !callbackFailed) setError(authError(sessionError));
      setLoading(false);
      if (callbackRecovery) rememberRecovery(true);
      if (callbackFailed) window.history.replaceState({}, "", initialUrl.pathname + (callbackRecovery ? "?auth=reset" : ""));
    }).catch(() => {
      if (active) { setError("Couldn't restore your session. Please sign in again."); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const finishRecovery = () => {
    rememberRecovery(false);
    setRecovery(false);
    setError("");
    window.history.replaceState({}, "", initialUrl.pathname);
  };

  return { session, loading, error, recovery, finishRecovery, clearError: () => setError("") };
}
