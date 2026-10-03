import { Fragment, useEffect, useRef, useState } from "react";
import MarkdownMessage from "./MarkdownMessage";
import EmptyHeroState from "./EmptyHeroState";
import { PERSONA_BLURBS, personaAvatars, fallbackPersonaList } from "../../data/shifts";

// Helper for clean TTS speech without markdown artifacts
function speakText(text, onStart, onEnd) {
  if (!("speechSynthesis" in window)) return null;
  window.speechSynthesis.cancel();

  const clean = text
    .replace(/```[\s\S]*?```/g, "Code snippet omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#*_~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();

  if (!clean) return null;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  utterance.onstart = () => onStart();
  utterance.onend = () => onEnd();
  utterance.onerror = () => onEnd();

  window.speechSynthesis.speak(utterance);
  return utterance;
}

function UserMessageItem({ message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (message.content && navigator.clipboard) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article className="message-row user">
      <div className="bubble user">
        {message.image && (
          <img src={message.image} alt="Uploaded preview" className="uploaded-image" loading="lazy" />
        )}
        <div className="user-text">{message.content}</div>
        <div className="user-bubble-footer">
          <span className="message-time">{message.timestamp}</span>
          <button
            className={`user-copy-btn ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy prompt"}
            aria-label="Copy prompt"
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function AssistantMessageItem({ message, avatar, name, isAssistant, loading, retryMessage }) {
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reaction, setReaction] = useState(null);

  useEffect(() => {
    return () => {
      if (isPlaying && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying]);

  const handleCopy = () => {
    if (message.content && navigator.clipboard) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleListen = () => {
    if (!("speechSynthesis" in window)) return;
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      speakText(
        message.content,
        () => setIsPlaying(true),
        () => setIsPlaying(false)
      );
    }
  };

  const canShowActions = !message.pending && !message.isTyping && Boolean(message.content);

  return (
    <article className={`message-row assistant ${message.council ? "council-reply" : ""}`}>
      <div className="assistant-message-content">
        <div className="assistant-header">
          <div className="assistant-avatar" aria-hidden="true">{avatar}</div>
          <span className="assistant-name">{name}</span>
          <span className={`reply-kind ${message.council ? "council-badge" : ""}`}>
            {message.isTyping ? "Writing" : message.council ? "Council" : isAssistant ? "Assistant" : "Shift"}
          </span>
          {!message.pending && !message.isTyping && (
            <span className="message-time">{message.stopped ? "Stopped · " : ""}{message.timestamp}</span>
          )}
        </div>

        <div className="assistant-body">
          {message.image && (
            <img src={message.image} alt="Uploaded preview" className="uploaded-image" loading="lazy" />
          )}

          {message.pending ? (
            <div className="typing-dots" role="status" aria-label={`${name} is thinking`}>
              <span /><span /><span />
            </div>
          ) : message.isTyping ? (
            <div className="streaming-text" aria-label="Response is being written">
              {message.content}
              <span className="streaming-cursor" aria-hidden="true" />
            </div>
          ) : (
            <MarkdownMessage message={message.content} />
          )}

          {/* Interactive Message Actions Bar */}
          {canShowActions && (
            <div className="message-actions-bar" role="toolbar" aria-label="Response actions">
              {/* Copy */}
              <button
                className={`action-pill ${copied ? "active" : ""}`}
                onClick={handleCopy}
                title={copied ? "Copied to clipboard!" : "Copy response"}
                aria-label="Copy response"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copy</span>
                  </>
                )}
              </button>

              {/* Read Aloud TTS */}
              <button
                className={`action-pill ${isPlaying ? "playing" : ""}`}
                onClick={toggleListen}
                title={isPlaying ? "Stop audio playback" : "Listen to response"}
                aria-label={isPlaying ? "Stop reading" : "Read aloud"}
              >
                {isPlaying ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    <span>Listen</span>
                  </>
                )}
              </button>

              {/* Reaction */}
              <button
                className={`action-pill icon-only ${reaction === "like" ? "liked" : ""}`}
                onClick={() => setReaction((prev) => (prev === "like" ? null : "like"))}
                title={reaction === "like" ? "Liked" : "Helpful response"}
                aria-label="Like response"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={reaction === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
              </button>

              {/* Retry */}
              {message.request && (
                <button
                  className="action-pill icon-only"
                  disabled={loading}
                  onClick={() => retryMessage(message)}
                  title="Retry response"
                  aria-label="Retry response"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
              )}
            </div>
          )}

          {message.failed && message.request && (
            <button className="quick-btn retry-response" disabled={loading} onClick={() => retryMessage(message)}>
              Retry response
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ChatMessages({
  isAssistant,
  messages,
  conversationId,
  selectedPersona,
  currentAvatar,
  currentPersonaName,
  personaList,
  coldStart,
  loading,
  onExplore,
  chooseShift,
  sendMessage,
  retryMessage,
}) {
  const scrollRef = useRef(null);
  const followLatest = useRef(true);
  const previousConversation = useRef(conversationId);

  useEffect(() => {
    if (previousConversation.current !== conversationId) {
      followLatest.current = true;
      previousConversation.current = conversationId;
    }
    const viewport = scrollRef.current;
    if (viewport && followLatest.current) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, conversationId]);

  return (
    <main className="main">
      <section
        className="chat-messages"
        ref={scrollRef}
        aria-label="Conversation"
        onScroll={(event) => {
          const el = event.currentTarget;
          followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {Boolean(messages.length && PERSONA_BLURBS[selectedPersona]) && (
          <div className="persona-banner">
            <span className="banner-dot" />
            <span>{PERSONA_BLURBS[selectedPersona]}</span>
            <button onClick={onExplore}>Switch Shift</button>
          </div>
        )}

        {coldStart && (
          <div className="cold-start" role="status">
            <div className="spinner" />
            Getting your response ready. The first reply may take a little longer.
          </div>
        )}

        {!messages.length && (
          <EmptyHeroState
            isAssistant={isAssistant}
            selectedPersona={selectedPersona}
            currentAvatar={currentAvatar}
            currentPersonaName={currentPersonaName}
            personaList={personaList}
            onExplore={onExplore}
            chooseShift={chooseShift}
            sendMessage={sendMessage}
          />
        )}

        {messages.map((message, index) => {
          const avatar = personaAvatars[message.persona] || currentAvatar;
          const name = personaList[message.persona] || fallbackPersonaList[message.persona] || currentPersonaName;

          return (
            <Fragment key={message.id || `${message.role}-${index}`}>
              {/* Cosmic Council Divider */}
              {message.council && !messages[index - 1]?.council && (
                <div className="council-divider-wrap" role="separator" aria-label="Council of Perspectives">
                  <div className="council-divider-line" />
                  <div className="council-divider">
                    <span className="council-sparkle">✦</span>
                    <span className="council-title">The High Council</span>
                    <span className="council-badge">3 Perspectives</span>
                  </div>
                  <div className="council-divider-line" />
                </div>
              )}

              {message.role === "assistant" ? (
                <AssistantMessageItem
                  message={message}
                  avatar={avatar}
                  name={name}
                  isAssistant={isAssistant}
                  loading={loading}
                  retryMessage={retryMessage}
                />
              ) : (
                <UserMessageItem message={message} />
              )}
            </Fragment>
          );
        })}
      </section>
    </main>
  );
}
