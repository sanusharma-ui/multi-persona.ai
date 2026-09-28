import { useEffect, useRef, useState } from "react";
import { authError, authRedirect, supabase } from "../../lib/auth";
import AuthScene3D from "./AuthScene3D";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59A5.99 5.99 0 0 1 12 5.95Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const copy = {
  login: ["Welcome back.", "Your next conversation starts here.", "Sign in"],
  signup: ["Find your people.\nMeet your Shifts.", "Create an account and make yourself at home.", "Create account"],
  forgot: ["A fresh start.", "Enter your email and we'll send you a link to reset your password.", "Send reset link"],
  reset: ["Make it yours again.", "Choose a new password for your Shifts account.", "Save new password"],
};

export default function AuthScreen({ auth }) {
  const pageRef = useRef(null);
  const panelRef = useRef(null);
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

  useEffect(() => {
    const page = pageRef.current;
    const panel = panelRef.current;
    if (!page || !panel) return;
    const top = screen === "signup"
      ? page.scrollTop + panel.getBoundingClientRect().top - page.getBoundingClientRect().top - 24
      : 0;
    page.scrollTo({
      top: Math.max(0, top),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [screen]);

  useEffect(() => {
    const page = pageRef.current;
    const panel = panelRef.current;
    if (!page || !panel) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    let frame = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let targetBgX = 0;
    let targetBgY = 0;
    let currentBgX = 0;
    let currentBgY = 0;

    const allowed = () => !motion.matches && pointer.matches && !document.hidden;

    const paint = () => {
      // Background parallax offset
      page.style.setProperty("--bg-parallax-x", `${currentBgX * 10}px`);
      page.style.setProperty("--bg-parallax-y", `${currentBgY * 7}px`);

      // 3D card tilt
      panel.style.setProperty("--card-x", `${currentTiltX * -6.5}deg`);
      panel.style.setProperty("--card-y", `${currentTiltY * 7.5}deg`);
    };

    const tick = () => {
      frame = 0;
      if (!allowed()) return;

      const ease = 0.08;
      currentTiltX += (targetTiltX - currentTiltX) * ease;
      currentTiltY += (targetTiltY - currentTiltY) * ease;
      currentBgX += (targetBgX - currentBgX) * ease;
      currentBgY += (targetBgY - currentBgY) * ease;

      paint();

      const diff =
        Math.abs(targetTiltX - currentTiltX) +
        Math.abs(targetTiltY - currentTiltY) +
        Math.abs(targetBgX - currentBgX) +
        Math.abs(targetBgY - currentBgY);

      if (diff > 0.001) {
        frame = requestAnimationFrame(tick);
      }
    };

    const start = () => {
      if (!frame && allowed()) frame = requestAnimationFrame(tick);
    };

    const handlePointerMove = (event) => {
      if (!allowed()) return;
      const pageRect = page.getBoundingClientRect();
      const normX = ((event.clientX - pageRect.left) / pageRect.width) * 2 - 1;
      const normY = ((event.clientY - pageRect.top) / pageRect.height) * 2 - 1;

      targetBgX = -normX;
      targetBgY = -normY;

      // Card glare coordinates relative to card
      const panelRect = panel.getBoundingClientRect();
      const glareX = ((event.clientX - panelRect.left) / panelRect.width) * 100;
      const glareY = ((event.clientY - panelRect.top) / panelRect.height) * 100;
      panel.style.setProperty("--glare-x", `${glareX}%`);
      panel.style.setProperty("--glare-y", `${glareY}%`);

      // Tilt is based on cursor position relative to card center
      const cardCenterX = panelRect.left + panelRect.width / 2;
      const cardCenterY = panelRect.top + panelRect.height / 2;
      const cardNormX = Math.max(-1, Math.min(1, (event.clientX - cardCenterX) / 360));
      const cardNormY = Math.max(-1, Math.min(1, (event.clientY - cardCenterY) / 360));

      const isInputFocused =
        panel.contains(document.activeElement) && document.activeElement.tagName === "INPUT";
      targetTiltX = isInputFocused ? 0 : cardNormY;
      targetTiltY = isInputFocused ? 0 : cardNormX;

      start();
    };

    const handlePointerLeave = () => {
      targetTiltX = 0;
      targetTiltY = 0;
      targetBgX = 0;
      targetBgY = 0;
      start();
    };

    page.addEventListener("pointermove", handlePointerMove, { passive: true });
    page.addEventListener("pointerleave", handlePointerLeave);
    panel.addEventListener("focusin", () => {
      targetTiltX = 0;
      targetTiltY = 0;
      start();
    });

    return () => {
      cancelAnimationFrame(frame);
      page.removeEventListener("pointermove", handlePointerMove);
      page.removeEventListener("pointerleave", handlePointerLeave);
      panel.style.removeProperty("--card-x");
      panel.style.removeProperty("--card-y");
      panel.style.removeProperty("--glare-x");
      panel.style.removeProperty("--glare-y");
      page.style.removeProperty("--bg-parallax-x");
      page.style.removeProperty("--bg-parallax-y");
    };
  }, []);

  function navigate(next) {
    setView(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirm("");
    setVisible(false);
    setConfirmation(false);
    auth.clearError();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || unavailable) return;
    setError("");
    setNotice("");
    auth.clearError();
    if (newPassword && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (newPassword && password !== confirm) {
      setError("The passwords don't match yet.");
      return;
    }
    setBusy("email");
    try {
      let result;
      if (screen === "login") {
        result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error?.code === "email_not_confirmed") setConfirmation(true);
      } else if (screen === "signup") {
        result = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: authRedirect() },
        });
        if (!result.error && !result.data.session) {
          setConfirmation(true);
          setNotice("Check your inbox for a confirmation link. If you already have an account, sign in or reset your password.");
          setPassword("");
          setConfirm("");
        }
      } else if (screen === "forgot") {
        result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true) });
        if (!result.error) setNotice("If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.");
      } else {
        if (!auth.session) throw new Error("Missing recovery session");
        result = await supabase.auth.updateUser({ password });
        if (!result.error) {
          setResetDone(true);
          setPassword("");
          setConfirm("");
        }
      }
      if (result.error) setError(authError(result.error));
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy("");
    }
  }

  async function google() {
    if (busy || unavailable) return;
    setBusy("google");
    setError("");
    auth.clearError();
    try {
      const { error: failure } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirect(), queryParams: { prompt: "select_account" } },
      });
      if (failure) setError(authError(failure));
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy("");
    }
  }

  async function resend() {
    if (busy || !email.trim()) return;
    setBusy("resend");
    setError("");
    setNotice("");
    try {
      const { error: failure } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: authRedirect() },
      });
      if (failure) setError(authError(failure));
      else setNotice("If confirmation is pending, a new link is on its way. Check your inbox and spam folder.");
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="auth-page auth-login-motion" ref={pageRef}>
      {/* Dynamic Background Artwork with Smooth Parallax */}
      <div className="auth-bg-layer" aria-hidden="true" />
      <div className="auth-vignette-overlay" aria-hidden="true" />

      {/* 3D Three.js Ambient Multiverse (Crystals, Particles, Orbit Rings) */}
      <AuthScene3D />

      {/* Subtle Ambient Cosmic Motes */}
      <div className="auth-atmosphere" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
      </div>

      <div className="auth-shell">
        <aside className="auth-story" aria-label="Welcome to Shifts">
          <div className="auth-brand-block">
            <a className="auth-brand" href={import.meta.env.BASE_URL}>
              <img src="/shifts.png" alt="" />
              <span>Shifts<span className="auth-brand-dot">.</span></span>
            </a>
            <span className="auth-brand-subtitle">AI MULTIVERSE</span>
          </div>

          <div className="auth-story-body">
            <div className="auth-eyebrow">
              <span className="auth-eyebrow-line" />
              <span>A UNIVERSE OF CONVERSATIONS</span>
            </div>
            <h1>
              Different minds. <br />
              One place to <br />
              <em>be yourself.</em>
            </h1>
            <p className="auth-tagline">Connect with personas crafted for every dimension of thought.</p>

            {/* Aesthetic Persona Showcase Chips */}
            <div className="auth-persona-chips" aria-label="Featured AI Personas">
              <div className="auth-persona-chip persona-chip-seven" title="Seven: Celestial Wonder & Empathy">
                <span className="chip-orb">✦</span>
                <div className="chip-info">
                  <strong>Seven</strong>
                  <span>Cosmic Wonder</span>
                </div>
              </div>
              <div className="auth-persona-chip persona-chip-neo" title="Neo: Code Architect & Creator">
                <span className="chip-orb">&lt;/&gt;</span>
                <div className="chip-info">
                  <strong>Neo</strong>
                  <span>Architect</span>
                </div>
              </div>
              <div className="auth-persona-chip persona-chip-nyra" title="Nyra: Unfiltered Ideas & Depths">
                <span className="chip-orb">✳</span>
                <div className="chip-info">
                  <strong>Nyra</strong>
                  <span>Wildcard</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="auth-panel" aria-label="Your account" ref={panelRef}>
          <div className="auth-panel-sheen" aria-hidden="true" />
          <div className="auth-panel-intro" aria-hidden="true">
            <span className="auth-orbit"><span /></span>
            <span>YOUR WORLD AWAITS</span>
            <span className="auth-intro-line" />
          </div>
          <div className="auth-form-wrap" key={screen}>
            {(screen === "forgot" || screen === "reset") && (
              <span className="auth-kicker">
                <span className="auth-kicker-dot" />
                ACCOUNT RECOVERY
              </span>
            )}
            <h2>{resetDone ? "You're all set." : title}</h2>
            <p className="auth-description">
              {resetDone ? "Your password has been updated. You're ready for your next conversation." : description}
              {screen === "reset" && auth.session && !resetDone && <span className="auth-recovery-email">{auth.session.user.email}</span>}
            </p>

            {unavailable && <p className="auth-alert" role="alert">Sign-in is temporarily unavailable. Please try again later.</p>}
            {(error || auth.error) && <p className="auth-alert" role="alert">{error || auth.error}</p>}
            {notice && <div className="auth-notice" role="status"><strong>Check your email</strong><p>{notice}</p></div>}

            {resetDone ? (
              <button className="auth-primary" onClick={auth.finishRecovery}>
                Continue to Shifts <span aria-hidden="true">→</span>
              </button>
            ) : invalidReset ? (
              <div className="auth-expired">
                <p>This reset link is missing, expired, or already used. Request a new link to get back in.</p>
                <button className="auth-primary" onClick={() => navigate("forgot")}>
                  Request a new reset link
                </button>
              </div>
            ) : (
              <>
                {(screen === "login" || screen === "signup") && (
                  <>
                    <button className="auth-google" onClick={google} disabled={Boolean(busy) || unavailable}>
                      <GoogleIcon />
                      <span>{busy === "google" ? "Connecting to Google…" : "Continue with Google"}</span>
                    </button>
                    <div className="auth-divider">
                      <span>or continue with email</span>
                    </div>
                  </>
                )}

                <form onSubmit={submit} className="auth-form" aria-busy={Boolean(busy)}>
                  <fieldset disabled={Boolean(busy) || unavailable}>
                    {screen === "signup" && (
                      <div className="auth-field">
                        <label htmlFor="auth-name">Your name</label>
                        <div className="auth-input-wrapper">
                          <span className="auth-input-icon"><UserIcon /></span>
                          <input
                            id="auth-name"
                            name="name"
                            autoComplete="nickname"
                            placeholder="What should we call you?"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            maxLength={80}
                          />
                        </div>
                      </div>
                    )}

                    {screen !== "reset" && (
                      <div className="auth-field">
                        <label htmlFor="auth-email">Email address</label>
                        <div className="auth-input-wrapper">
                          <span className="auth-input-icon"><MailIcon /></span>
                          <input
                            id="auth-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            maxLength={254}
                          />
                        </div>
                      </div>
                    )}

                    {screen !== "forgot" && (
                      <>
                        <div className="auth-password-field auth-field">
                          <div className="auth-label-row">
                            <label htmlFor="auth-password">{newPassword ? "New password" : "Password"}</label>
                            {screen === "login" && (
                              <button type="button" className="auth-link auth-forgot-link" onClick={() => navigate("forgot")}>
                                Forgot password?
                              </button>
                            )}
                          </div>
                          <div className="auth-password auth-input-wrapper">
                            <span className="auth-input-icon"><LockIcon /></span>
                            <input
                              id="auth-password"
                              name="password"
                              type={visible ? "text" : "password"}
                              autoComplete={newPassword ? "new-password" : "current-password"}
                              placeholder={newPassword ? "At least 8 characters" : "Enter your password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              minLength={newPassword ? 8 : undefined}
                              maxLength={128}
                              aria-describedby={newPassword ? "password-hint" : undefined}
                            />
                            <button
                              type="button"
                              className="auth-eye-btn"
                              onClick={() => setVisible(!visible)}
                              aria-label={visible ? "Hide password" : "Show password"}
                              aria-pressed={visible}
                            >
                              {visible ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                          </div>
                        </div>

                        {newPassword && (
                          <>
                            <p className="auth-hint" id="password-hint">
                              Use 8+ characters. A mix of letters, numbers and symbols is best.
                            </p>
                            <div className="auth-field">
                              <label htmlFor="auth-confirm">Confirm password</label>
                              <div className="auth-input-wrapper">
                                <span className="auth-input-icon"><LockIcon /></span>
                                <input
                                  id="auth-confirm"
                                  name="confirm-password"
                                  type={visible ? "text" : "password"}
                                  autoComplete="new-password"
                                  placeholder="Enter it one more time"
                                  value={confirm}
                                  onChange={(e) => setConfirm(e.target.value)}
                                  required
                                  maxLength={128}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <button className="auth-primary" type="submit">
                      <span>{busy === "email" ? "Just a moment…" : submitLabel}</span>
                      <span className="auth-btn-arrow" aria-hidden="true">→</span>
                    </button>
                  </fieldset>
                </form>

                {confirmation && (
                  <button className="auth-link auth-resend" disabled={Boolean(busy) || unavailable} onClick={resend}>
                    {busy === "resend" ? "Sending…" : "Resend confirmation email"}
                  </button>
                )}

                <p className="auth-switch">
                  {screen === "login" ? (
                    <>
                      New around here?{" "}
                      <button className="auth-link" disabled={Boolean(busy)} onClick={() => navigate("signup")}>
                        Create an account
                      </button>
                    </>
                  ) : screen === "signup" ? (
                    <>
                      Already have an account?{" "}
                      <button className="auth-link" disabled={Boolean(busy)} onClick={() => navigate("login")}>
                        Sign in
                      </button>
                    </>
                  ) : screen === "forgot" ? (
                    <button className="auth-link" disabled={Boolean(busy)} onClick={() => { auth.finishRecovery(); navigate("login"); }}>
                      {auth.session ? "← Back to Shifts" : "← Back to sign in"}
                    </button>
                  ) : null}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
