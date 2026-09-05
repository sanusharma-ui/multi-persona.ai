export default function ChatHeader({ currentAvatar, currentPersonaName, setHistoryOpen, setIsGalleryOpen, clearChat, isDarkMode, setIsDarkMode }) {
  return (
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-avatar">{currentAvatar}</div>
            <div className="brand-wrap">
              <h1 className="header-title">Shifts</h1>
              <div className="current-persona-name">{currentPersonaName}</div>
            </div>
          </div>

          <div className="header-right">
            <button className="top-action" onClick={() => setHistoryOpen(true)} aria-haspopup="dialog">History</button>
            <button
              className="shift-trigger"
              onClick={() => setIsGalleryOpen(true)}
              aria-haspopup="dialog"
              aria-label="Choose a Shift"
            >
              <span>Choose Shift</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
            </button>

            <button
              className="top-action"
              onClick={clearChat}
              title="Clear chat"
              aria-label="Clear chat"
            >
              Clear
            </button>

            <button
              className="theme-toggle"
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Toggle theme"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>


  );
}
