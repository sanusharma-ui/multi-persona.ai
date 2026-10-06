import { useEffect, useRef, useState } from "react";
import AccountMenu from "../auth/AccountMenu";

export default function ChatHeader({
  isAssistant,
  switchMode,
  currentAvatar,
  currentPersonaName,
  setHistoryOpen,
  setIsGalleryOpen,
  clearChat,
  isDarkMode,
  setIsDarkMode,
  user,
  onBeforeSignOut,
}) {
  const shortPersonaName = currentPersonaName ? currentPersonaName.split(" ")[0] : "Shift";
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef(null);
  const optionsTrigger = useRef(null);

  useEffect(() => {
    if (!optionsOpen) return;
    const closeOutside = (event) => {
      if (!optionsRef.current?.contains(event.target)) setOptionsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOptionsOpen(false);
        optionsTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [optionsOpen]);

  const runOption = (action) => {
    setOptionsOpen(false);
    if (optionsOpen) optionsTrigger.current?.focus();
    action();
  };

  return (
    <header className="header">
      <div className="header-content">
        {/* Left: Brand + Active Persona HUD Switcher */}
        <div className="header-left">
          <div className="brand-wrap">
            <span className="brand-dot" aria-hidden="true" />
            <h1 className="header-title">Shifts</h1>
          </div>

          <div className="header-divider" aria-hidden="true" />

          {!isAssistant ? (
            <button
              className="shift-trigger persona-hud-trigger"
              onClick={() => setIsGalleryOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Current Shift: ${currentPersonaName}. Click to choose a different Shift.`}
              title="Change Shift"
            >
              <span className="hud-avatar" aria-hidden="true">{currentAvatar}</span>
              <span className="hud-name">{shortPersonaName}</span>
              <span className="hud-status-dot" title="Active" />
              <svg className="hud-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          ) : (
            <div className="persona-hud-static" title="Assistant Mode">
              <span className="hud-avatar" aria-hidden="true">🤖</span>
              <span className="hud-name">Assistant</span>
              <span className="hud-status-dot" title="Active" />
            </div>
          )}
        </div>

        {/* Right: Mode Switch + History + Clear + Theme + Account */}
        <div className="header-right">
          {/* Mode Switcher Pill */}
          <button
            className="top-action mode-switch header-mode-btn"
            onClick={switchMode}
            aria-label={isAssistant ? "Switch to Personas mode" : "Switch to Chatbot mode"}
            title={isAssistant ? "Switch to Personas mode" : "Switch to Chatbot mode"}
          >
            <span className="mode-btn-icon">{isAssistant ? "✦" : "🤖"}</span>
            <span className="mode-btn-label">{isAssistant ? "Personas" : "Chatbot"}</span>
          </button>

          {/* History Button */}
          <div className="header-options" ref={optionsRef}>
            <button
              ref={optionsTrigger}
              className="header-icon-btn header-options-trigger"
              aria-label="Chat options"
              aria-expanded={optionsOpen}
              aria-controls="chat-options"
              onClick={() => setOptionsOpen((value) => !value)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            <div id="chat-options" className={`header-tools ${optionsOpen ? "is-open" : ""}`}>
              <button
                className="top-action header-icon-btn history-trigger"
                onClick={() => runOption(() => setHistoryOpen(true))}
                aria-haspopup="dialog"
                title="Conversation History"
                aria-label="Conversation History"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="header-btn-text">History</span>
              </button>

              {/* Clear Chat Button */}
              <button
                className="top-action header-icon-btn clear-trigger"
                onClick={() => runOption(clearChat)}
                title="Clear current chat"
                aria-label="Clear chat"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                <span className="header-option-label">Clear chat</span>
              </button>

              {/* Dark / Light Mode Toggle */}
              <button
                className="theme-toggle header-icon-btn"
                onClick={() => runOption(() => setIsDarkMode((prev) => !prev))}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                <span className="header-option-label">{isDarkMode ? "Light mode" : "Dark mode"}</span>
              </button>
            </div>
          </div>

          {/* Account Menu */}
          <AccountMenu user={user} onBeforeSignOut={onBeforeSignOut} />
        </div>
      </div>
    </header>
  );
}
