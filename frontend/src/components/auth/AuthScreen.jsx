import { useState } from "react";
import { authError, authRedirect, supabase } from "../../lib/auth";

function GoogleIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59A5.99 5.99 0 0 1 12 5.95Z" /></svg>;
}

const copy = {
  login: ["Welcome back.", "Your next conversation starts here.", "Sign in"],
  signup: ["Find your people.\nMeet your Shifts.", "Create an account and make yourself at home.", "Create account"],
  forgot: ["A fresh start.", "Enter your email and we'll send you a link to reset your password.", "Send reset link"],
  reset: ["Make it yours again.", "Choose a new password for your Shifts account.", "Save new password"],
};

export default function AuthScreen({ auth }) {
  const [view, setView] = useState(auth.recovery ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const screen = auth.recovery && view !== "forgot" ? "reset" : view;
  const [title, description, submitLabel] = copy[screen];
  const newPassword = screen === "signup" || screen === "reset";
  const unavailable = !supabase;
  const invalidReset = screen === "reset" && (!auth.session || Boolean(auth.error));

  function navigate(next) {
    setView(next); setError(""); setNotice(""); setPassword(""); setConfirm("");
    setVisible(false); setConfirmation(false); auth.clearError();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || unavailable) return;
    setError(""); setNotice(""); auth.clearError();
    if (newPassword && password.length < 8) { setError("Use at least 8 characters for your password."); return; }
    if (newPassword && password !== confirm) { setError("The passwords don't match yet."); return; }
    setBusy("email");
    try {
      let result;
      if (screen === "login") {
        result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error?.code === "email_not_confirmed") setConfirmation(true);
      } else if (screen === "signup") {
        result = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: authRedirect() } });
        if (!result.error && !result.data.session) {
          setConfirmation(true);
          setNotice("Check your inbox for a confirmation link. If you already have an account, sign in or reset your password.");
          setPassword(""); setConfirm("");
        }
      } else if (screen === "forgot") {
        result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true) });
        if (!result.error) setNotice("If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.");
      } else {
        if (!auth.session) throw new Error("Missing recovery session");
        result = await supabase.auth.updateUser({ password });
        if (!result.error) { setResetDone(true); setPassword(""); setConfirm(""); }
      }
      if (result.error) setError(authError(result.error));
    } catch (caught) { setError(authError(caught)); }
    finally { setBusy(""); }
  }

  async function google() {
    if (busy || unavailable) return;
    setBusy("google"); setError(""); auth.clearError();
    try {
      const { error: failure } = await supabase.auth.signInWithOAuth({ provider: "google",
        options: { redirectTo: authRedirect(), queryParams: { prompt: "select_account" } } });
      if (failure) setError(authError(failure));
    } catch (caught) { setError(authError(caught)); }
    finally { setBusy(""); }
  }

  async function resend() {
    if (busy || !email.trim()) return;
    setBusy("resend"); setError(""); setNotice("");
    try {
      const { error: failure } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: authRedirect() } });
      if (failure) setError(authError(failure));
      else setNotice("If confirmation is pending, a new link is on its way. Check your inbox and spam folder.");
    } catch (caught) { setError(authError(caught)); }
    finally { setBusy(""); }
  }

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-glow-orb auth-glow-1" />
        <div className="auth-glow-orb auth-glow-2" />
        <div className="auth-glow-orb auth-glow-3" />
        <div className="auth-glow-orb auth-glow-4" />
        <div className="auth-grid-pattern" />
      </div>
      <div className="auth-shell">
        <aside className="auth-story" aria-label="Welcome to Shifts">
          <div className="auth-story-glow" aria-hidden="true" />
          <a className="auth-brand" href={import.meta.env.BASE_URL}><img src="/shifts.png" alt="" /><span>Shifts<span className="auth-brand-dot">.</span></span><span className="auth-brand-pill">AI MULTIVERSE</span></a>
          <div className="auth-story-body">
            <span className="auth-eyebrow"><span /> A UNIVERSE OF CONVERSATIONS</span>
            <h1>Different minds. <br />One place to <br /><em>be yourself.</em></h1>
            <p>A little curiosity. A different perspective. <br />A conversation that feels like you.</p>
            <div className="auth-cast" aria-hidden="true">
              <div className="auth-character character-seven"><span>✦</span><strong>Seven</strong><small>A little cosmic wonder.</small></div>
              <div className="auth-character character-neo"><span>&lt;/&gt;</span><strong>Neo</strong><small>Build something together.</small></div>
              <div className="auth-character character-nyra"><span>✳</span><strong>Nyra</strong><small>Follow that wild idea.</small></div>
            </div>
          </div>
          <p className="auth-story-foot">Your mood. Your story. Your Shift.</p>
        </aside>
        <section className="auth-panel" aria-label="Your account">
          <div className="auth-form-wrap">
            <span className="auth-kicker"><span className="auth-kicker-dot" />{screen === "forgot" || screen === "reset" ? "ACCOUNT RECOVERY" : "YOUR SPACE IN SHIFTS"}</span>
            <h2>{resetDone ? "You're all set." : title}</h2>
            <p className="auth-description">{resetDone ? "Your password has been updated. You're ready for your next conversation." : description}{screen === "reset" && auth.session && !resetDone && <span className="auth-recovery-email">{auth.session.user.email}</span>}</p>
            {unavailable && <p className="auth-alert" role="alert">Sign-in is temporarily unavailable. Please try again later.</p>}
            {(error || auth.error) && <p className="auth-alert" role="alert">{error || auth.error}</p>}
            {notice && <div className="auth-notice" role="status"><strong>Check your email</strong><p>{notice}</p></div>}
            {resetDone ? <button className="auth-primary" onClick={auth.finishRecovery}>Continue to Shifts <span aria-hidden="true">→</span></button>
              : invalidReset ? <div className="auth-expired"><p>This reset link is missing, expired, or already used. Request a new link to get back in.</p><button className="auth-primary" onClick={() => navigate("forgot")}>Request a new reset link</button></div>
              : <>
                {(screen === "login" || screen === "signup") && <>
                  <button className="auth-google" onClick={google} disabled={Boolean(busy) || unavailable}><GoogleIcon />{busy === "google" ? "Connecting to Google…" : "Continue with Google"}</button>
                  <div className="auth-divider"><span>or continue with email</span></div>
                </>}
                <form onSubmit={submit} className="auth-form" aria-busy={Boolean(busy)}>
                  <fieldset disabled={Boolean(busy) || unavailable}>
                    {screen === "signup" && <label htmlFor="auth-name">Your name<input id="auth-name" name="name" autoComplete="nickname" placeholder="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>}
                    {screen !== "reset" && <label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></label>}
                    {screen !== "forgot" && <>
                      <div className="auth-password-field">
                        <div className="auth-label-row"><label htmlFor="auth-password">{newPassword ? "New password" : "Password"}</label>{screen === "login" && <button type="button" className="auth-link" onClick={() => navigate("forgot")}>Forgot password?</button>}</div>
                        <div className="auth-password"><input id="auth-password" name="password" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} placeholder={newPassword ? "At least 8 characters" : "Enter your password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={newPassword ? 8 : undefined} maxLength={128} aria-describedby={newPassword ? "password-hint" : undefined} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button></div>
                      </div>
                      {newPassword && <><p className="auth-hint" id="password-hint">Use 8+ characters. A mix of letters, numbers and symbols is best.</p><label htmlFor="auth-confirm">Confirm password<input id="auth-confirm" name="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Enter it one more time" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={128} /></label></>}
                    </>}
                    <button className="auth-primary" type="submit">{busy === "email" ? "Just a moment…" : submitLabel}<span aria-hidden="true">→</span></button>
                  </fieldset>
                </form>
                {confirmation && <button className="auth-link auth-resend" disabled={Boolean(busy) || unavailable} onClick={resend}>{busy === "resend" ? "Sending…" : "Resend confirmation email"}</button>}
                <p className="auth-switch">{screen === "login" ? <>New around here? <button className="auth-link" disabled={Boolean(busy)} onClick={() => navigate("signup")}>Create an account</button></> : screen === "signup" ? <>Already have an account? <button className="auth-link" disabled={Boolean(busy)} onClick={() => navigate("login")}>Sign in</button></> : screen === "forgot" ? <button className="auth-link" disabled={Boolean(busy)} onClick={() => { auth.finishRecovery(); navigate("login"); }}>{auth.session ? "← Back to Shifts" : "← Back to sign in"}</button> : null}</p>
              </>}
            <p className="auth-footer">An interactive comic universe, powered by AI.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
