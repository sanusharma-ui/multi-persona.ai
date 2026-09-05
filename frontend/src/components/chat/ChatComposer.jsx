import { useEffect, useRef } from "react";

export default function ChatComposer({ composerError, storageError, isCouncilMode, setIsCouncilMode, loading, isStreaming, regenerateLast, canRegenerate, stopResponse, imagePreview, onRemoveImage, handleImageUpload, input, setInput, sendMessage, currentPersonaName }) {
  const textareaRef = useRef(null);
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "0px";
    field.style.height = Math.min(field.scrollHeight, 150) + "px";
  }, [input]);
  return (
      <div className="input-shell">
        {(composerError || storageError) && <p className="chat-notice" role="alert">{composerError || storageError}</p>}
        <div className="quick-actions">
          <button
            className={`quick-btn council-toggle ${isCouncilMode ? "active" : ""}`}
            onClick={() => setIsCouncilMode((value) => !value)}
            disabled={loading || isStreaming}
            title="Ask Neo, Rishi, and Nyra for three perspectives"
          >
            <span className="council-spark">✦</span>
            Council {isCouncilMode ? "on" : "off"}
          </button>
          <button
            className="quick-btn"
            onClick={regenerateLast}
            disabled={loading || !canRegenerate}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Regenerate
          </button>
          <button
            className="quick-btn danger"
            onClick={stopResponse}
            disabled={!loading && !isStreaming}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
            Stop
          </button>
        </div>

        <div className="composer">
          {imagePreview && (
            <div className="preview-container">
               <img src={imagePreview} alt="Preview" className="preview-image" />
              <button
                className="remove-preview"
                onClick={() => {
                  onRemoveImage();
                }}
                aria-label="Remove image preview"
              >
                ✕
              </button>
            </div>
          )}

          <div className="composer-row">
            <label className={`icon-btn file-btn ${isCouncilMode ? "disabled" : ""}`} title={isCouncilMode ? "Turn off Council to add an image" : "Upload image"}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                disabled={loading || isStreaming || isCouncilMode}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </label>

            <textarea
              ref={textareaRef}
              aria-label="Message your Shift"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={isCouncilMode ? "Ask the Council anything..." : `Message ${currentPersonaName.split(" ")[0]}...`}
              disabled={loading || isStreaming}
              className="input-field"
              rows={1}
            />

            <button
              onClick={sendMessage}
              disabled={loading || isStreaming || (!input.trim() && !imagePreview)}
              className="send-btn"
              aria-label="Send message"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
        <div className="composer-hint"><span>Enter to send · Shift + Enter for a new line</span><span>Shifts can make mistakes. <a href="mailto:sanusharma000aaa@gmail.com?subject=Shifts%20AI%20Feedback">Feedback</a></span></div>
      </div>


  );
}
