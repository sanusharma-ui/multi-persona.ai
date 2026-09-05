import { Fragment, useEffect, useRef } from "react";
import MarkdownMessage from "./MarkdownMessage";
import { PERSONA_BLURBS, SUGGESTION_CHIPS, welcomeMessages, personaAvatars, fallbackPersonaList } from "../../data/shifts";

export default function ChatMessages({ messages, conversationId, selectedPersona, currentAvatar, currentPersonaName, personaList, coldStart, loading, onExplore, sendMessage, retryMessage }) {
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
      <section className="chat-messages" ref={scrollRef} aria-label="Conversation"
        onScroll={(event) => {
          const el = event.currentTarget;
          followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}>
        {PERSONA_BLURBS[selectedPersona] && <div className="persona-banner">
          <span className="banner-dot" /><span>{PERSONA_BLURBS[selectedPersona]}</span>
          <button onClick={onExplore}>Switch Shift</button>
        </div>}
        {coldStart && <div className="cold-start" role="status"><div className="spinner" />Getting your response ready. The first reply may take a little longer.</div>}
        {!messages.length && <div className="empty-state">
          <div className="empty-avatar">{currentAvatar}</div>
          <span className="empty-eyebrow">A LITTLE SPACE TO THINK</span>
          <h2 className="empty-title">Where shall we begin?</h2>
          <p className="empty-subtitle">{welcomeMessages[selectedPersona]?.en || welcomeMessages.default.en}</p>
          <div className="suggestion-chips">
            {(SUGGESTION_CHIPS[selectedPersona] || SUGGESTION_CHIPS.default).map((chip) =>
              <button key={chip} className="suggestion-chip" onClick={() => sendMessage(chip)}>{chip}<span aria-hidden="true">↗</span></button>)}
          </div>
          <button className="meet-shifts-link" onClick={onExplore}>Meet all Shifts <span>→</span></button>
        </div>}
        {messages.map((message, index) => {
          const avatar = personaAvatars[message.persona] || currentAvatar;
          const name = personaList[message.persona] || fallbackPersonaList[message.persona] || currentPersonaName;
          return <Fragment key={message.id || `${message.role}-${index}`}>
            {message.council && !messages[index - 1]?.council && <div className="council-divider"><span>✦</span> Three perspectives from the Council</div>}
            <article className={`message-row ${message.role} ${message.council ? "council-reply" : ""}`}>
              {message.role === "assistant" ? (
                <div className="assistant-message-content">
                  <div className="assistant-header">
                    <div className="assistant-avatar" aria-hidden="true">{avatar}</div>
                    <span className="assistant-name">{name}</span>
                    <span className="reply-kind">{message.isTyping ? "Writing" : message.council ? "Council" : "Shift"}</span>
                    {!message.pending && !message.isTyping && (
                      <span className="message-time">{message.stopped ? "Stopped · " : ""}{message.timestamp}</span>
                    )}
                  </div>
                  <div className="assistant-body">
                    {message.image && <img src={message.image} alt="Uploaded preview" className="uploaded-image" loading="lazy" />}
                    {message.pending ? (
                      <div className="typing-dots" role="status" aria-label={`${name} is thinking`}><span /><span /><span /></div>
                    ) : message.isTyping ? (
                      <div className="streaming-text" aria-label="Response is being written">
                        {message.content}
                        <span className="streaming-cursor" aria-hidden="true" />
                      </div>
                    ) : (
                      <MarkdownMessage message={message.content} />
                    )}
                    {message.failed && message.request && (
                      <button className="quick-btn retry-response" disabled={loading} onClick={() => retryMessage(message)}>Retry response</button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bubble user">
                  {message.image && <img src={message.image} alt="Uploaded preview" className="uploaded-image" loading="lazy" />}
                  <div className="user-text">{message.content}</div>
                  <div className="message-time">{message.timestamp}</div>
                </div>
              )}
            </article>
          </Fragment>;
        })}
      </section>
    </main>
  );
}
