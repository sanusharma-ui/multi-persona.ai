import { useEffect, useRef, useState, useCallback } from "react";

export default function ChatComposer({
  isAssistant,
  composerError,
  storageError,
  isCouncilMode,
  setIsCouncilMode,
  loading,
  isStreaming,
  regenerateLast,
  canRegenerate,
  stopResponse,
  imagePreview,
  onRemoveImage,
  handleImageUpload,
  input,
  setInput,
  sendMessage,
  currentPersonaName,
}) {
  const textareaRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const shortName = currentPersonaName ? currentPersonaName.split(" ")[0] : "Shift";

  // Check speech recognition support safely
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  // Toggle voice input via native Web Speech API (zero backend dependencies)
  const toggleListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [isListening, setInput]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "0px";
    field.style.height = Math.min(field.scrollHeight, 140) + "px";
  }, [input]);

  const canSend = !loading && !isStreaming && (input.trim().length > 0 || Boolean(imagePreview));

  return (
    <div className="input-shell">
      {(composerError || storageError) && (
        <p className="chat-notice" role="alert">
          {composerError || storageError}
        </p>
      )}

      {isAssistant && (
        <p className="assistant-context-note">
          Memory stays in this conversation. Recent complete turns are used as context.
        </p>
      )}

      {/* Quick Actions Bar */}
      <div className="quick-actions">
        {!isAssistant && (
          <button
            className={`quick-btn council-toggle ${isCouncilMode ? "active" : ""}`}
            onClick={() => setIsCouncilMode((value) => !value)}
            disabled={loading || isStreaming}
            title="Ask Neo, Rishi, and Nyra for three distinct perspectives"
          >
            <span className="council-spark">✦</span>
            <span>Council {isCouncilMode ? "Active" : "Off"}</span>
          </button>
        )}

        <button
          className="quick-btn"
          onClick={regenerateLast}
          disabled={loading || !canRegenerate}
          title="Regenerate last response"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Regenerate</span>
        </button>

        {(loading || isStreaming) && (
          <button
            className="quick-btn danger stop-btn"
            onClick={stopResponse}
            title="Stop generating"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
            <span>Stop</span>
          </button>
        )}

        <div className="composer-persona-pill" title={`Direct conversation with ${currentPersonaName}`}>
          <span className="persona-pill-dot" />
          <span>@{shortName}</span>
        </div>
      </div>

      {/* Floating Island Composer */}
      <div className={`composer ${isListening ? "listening-active" : ""}`}>
        {imagePreview && (
          <div className="preview-container">
            <img src={imagePreview} alt="Preview" className="preview-image" />
            <button
              className="remove-preview"
              onClick={onRemoveImage}
              aria-label="Remove image preview"
              title="Remove image"
            >
              ✕
            </button>
          </div>
        )}

        <div className="composer-row">
          {/* Image Upload Button */}
          <label
            className={`icon-btn file-btn ${isCouncilMode ? "disabled" : ""}`}
            title={isCouncilMode ? "Turn off Council to attach an image" : "Attach image"}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageUpload}
              disabled={loading || isStreaming || isCouncilMode}
              aria-label="Attach image"
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </label>

          {/* Voice Input (Speech-to-Text) Button */}
          {speechSupported && (
            <button
              type="button"
              className={`icon-btn mic-btn ${isListening ? "active-listening" : ""}`}
              onClick={toggleListening}
              disabled={loading || isStreaming}
              title={isListening ? "Listening... Click to stop" : "Voice dictation"}
              aria-label="Voice input"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          )}

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            aria-label={isAssistant ? "Message Assistant" : `Message ${currentPersonaName}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) sendMessage();
              }
            }}
            placeholder={
              isListening
                ? "Listening... speak now"
                : isCouncilMode
                ? "Ask the Council (Neo, Rishi & Nyra)..."
                : `Message ${shortName}...`
            }
            disabled={loading || isStreaming}
            className="input-field"
            rows={1}
          />

          {/* Clear input text button */}
          {input.length > 0 && !loading && !isStreaming && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={() => setInput("")}
              aria-label="Clear input text"
              title="Clear input"
            >
              ✕
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={() => sendMessage()}
            disabled={!canSend}
            className={`send-btn ${canSend ? "ready" : ""}`}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Composer Hint Footer */}
      <div className="composer-hint">
        <span className="hint-keys">
          <kbd className="kbd-badge">Enter</kbd> to send · <kbd className="kbd-badge">Shift + Enter</kbd> for new line
        </span>
        <span className="hint-feedback">
          Shifts AI · <a href="mailto:sanusharma000aaa@gmail.com?subject=Shifts%20AI%20Feedback">Feedback</a>
        </span>
      </div>
    </div>
  );
}
