import React, { useState, useRef, useEffect, useMemo } from "react";
import "./Chat.css";

const AgreementPopup = ({ onAgree }) => (
  <div className="agreement-popup">
    <div className="popup-overlay" role="dialog" aria-modal="true" aria-labelledby="notice-title">
      <div className="popup-content">
        <div className="popup-icon-wrapper" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 id="notice-title" className="popup-title">Important Notice</h2>
        <div className="popup-text">This AI system is created strictly for:</div>
        <div className="popup-list">
          <ul>
            <li>Entertainment & Roleplay</li>
            <li>Educational experiments</li>
          </ul>
        </div>
        <div className="popup-text">This AI is NOT:</div>
        <div className="popup-list">
          <ul>
            <li>A medical professional or therapist</li>
            <li>A real human or legal advisor</li>
            <li>A guardian, partner, or emotional authority</li>
          </ul>
        </div>
        <div className="popup-text highlight-text">
          If you feel emotional distress or mental breakdown: Please seek REAL human help immediately.
        </div>
        <button className="popup-agree-btn" onClick={onAgree}>
          <span>I AGREE & CONTINUE</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  </div>
);

function App() {
  const [hasAgreed, setHasAgreed] = useState(
    () => localStorage.getItem("ai-agreement-accepted") === "true"
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );
  const [selectedPersona, setSelectedPersona] = useState(
    localStorage.getItem("selectedPersona") || "default"
  );
  const [currentPersonaName, setCurrentPersonaName] = useState("Aisha (Professional Admin)");
  const [personaList, setPersonaList] = useState({});
  const [coldStart, setColdStart] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const typingStoppedRef = useRef(false);

  const backendUrl = "https://groqchatbot-xoiv.onrender.com";
  // const backendUrl = "http://localhost:8000";
  const selectedLanguage = "en";

  const fallbackPersonaList = {
    default: "Aisha (Professional Admin)",
    luna: "Luna",
    ava: "Ava (Everyday Companion)",
    delhi_genz_girl: "Diya (Delhi GenZ Girl)",
    savage_bestie: "Savage Bestie",
    punjabi_bro: "Punjabi Bro",
    gojo: "Gojo Satoru",
    iron_man: "Tony Stark",
    levi: "Levi Ackerman",
    aesthetic_boy: "Arjun (Aesthetic Boy)",
    nyra: "Nyra (The Creative Spark)",
    neo: "Neo (Friendly Dev Buddy)",
    pulse: "Pulse (Reality Check Persona)",
    rishi: "Rishi (Modern Vedantic Guide)",
    baddie_girl: "Raven (Baddie Queen)",
    cipher: "Cipher",
    Creator_mode: "Sanu Sharma (Creator Mode)",
  };

  const personaAvatars = {
    default: "🧑‍💼",
    luna: "🧪",
    ava: "☕",
    delhi_genz_girl: "💬",
    savage_bestie: "😎",
    punjabi_bro: "💪",
    gojo: "👁️",
    iron_man: "🕶️",
    levi: "⚔️",
    aesthetic_boy: "🫧",
    nyra: "💡",
    neo: "💻",
    pulse: "🧭",
    rishi: "🕉️",
    baddie_girl: "🖤",
    cipher: "🔒",
    Creator_mode: "👤",
  };

  const welcomeMessages = {
    default: { en: "Hey — welcome to Shifts. I’m Aisha. How can I help today?" },
    luna: { en: "Hi! I’m Luna. Ready to explore ideas and experiments today?" },
    ava: { en: "Hey there — Ava here. What would you like to work on?" },
    delhi_genz_girl: { en: "Hii bestie! Kya plan hai aaj?" },
    savage_bestie: { en: "Alright, what’s the update? Let’s keep it real." },
    punjabi_bro: { en: "Oye! Kya scene hai today?" },
    gojo: { en: "Alright. What challenge are we solving?" },
    iron_man: { en: "Tony Stark mode on. What’s the problem statement?" },
    levi: { en: "Keep it sharp. What do you need?" },
    aesthetic_boy: { en: "Hey. Tell me what’s on your mind." },
    nyra: { en: "Nyra here. Let’s turn your idea into something solid." },
    neo: { en: "Neo online. Paste code or describe the bug." },
    pulse: { en: "Reality check mode active. What decision are you evaluating?" },
    rishi: { en: "Namaskar. What guidance are you seeking today?" },
    baddie_girl: { en: "Raven here. What’s the vibe and what are we fixing?" },
    cipher: { en: "Cipher connected. Define your target." },
    Creator_mode: { en: "Creator mode active. Ask me anything about this project." },
  };

  const PERSONA_BLURBS = {
    luna: "Scientist mode • Explain complex things clearly",
    savage_bestie: "Direct mode • Honest perspective",
    rishi: "Clarity mode • Thoughtful guidance",
    pulse: "Reality check • Practical reasoning",
    iron_man: "Strategic mode • Product and startup critique",
  };

  const getOrCreateUserId = () => {
    let uid = localStorage.getItem("mpai_uid");
    if (!uid) {
      uid = crypto?.randomUUID?.() || `uid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("mpai_uid", uid);
    }
    return uid;
  };
  const userId = useRef(getOrCreateUserId()).current;

  const PERSONAS = useMemo(
    () =>
      Object.keys(fallbackPersonaList).map((key) => ({
        key,
        label: fallbackPersonaList[key],
      })),
    []
  );

  useEffect(() => {
    let isMounted = true;
    fetch(`${backendUrl}/modes/list`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.modes) {
          setPersonaList(data.modes);
          setCurrentPersonaName(data.modes[selectedPersona] || fallbackPersonaList[selectedPersona] || fallbackPersonaList.default);
        } else {
          setPersonaList(fallbackPersonaList);
          setCurrentPersonaName(fallbackPersonaList[selectedPersona] || fallbackPersonaList.default);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setPersonaList(fallbackPersonaList);
        setCurrentPersonaName(fallbackPersonaList[selectedPersona] || fallbackPersonaList.default);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", String(isDarkMode));
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("selectedPersona", selectedPersona);
    const name =
      personaList[selectedPersona] ||
      fallbackPersonaList[selectedPersona] ||
      fallbackPersonaList.default;
    setCurrentPersonaName(name);
    setMessages([]);
  }, [selectedPersona, personaList]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, isStreaming]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [input]);

  const currentAvatar = personaAvatars[selectedPersona] || personaAvatars.default;

  const escapeHtml = (str = "") =>
    str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatMessage = (text = "") => escapeHtml(text).replace(/\n/g, "<br/>");

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const stopResponse = () => {
    typingStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setLoading(false);
  };

  const clearChat = () => {
    stopResponse();
    setMessages([]);
    setColdStart(false);
  };

  const sendMessage = async () => {
    if (loading || isStreaming) return;
    if (!input.trim() && !image) return;

    const text = input.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (messages.length === 0) setColdStart(true);
    setLoading(true);
    typingStoppedRef.current = false;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text || "Sent an image.",
        timestamp,
        image: imagePreview,
      },
    ]);

    setInput("");
    setImage(null);
    setImagePreview(null);

    abortControllerRef.current = new AbortController();

    try {
      let response;

      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        if (text) formData.append("message", text);
        formData.append("language", selectedLanguage);
        formData.append("mode", selectedPersona);

        response = await fetch(`${backendUrl}/chat/image?mode=${selectedPersona}`, {
          method: "POST",
          headers: { "x-user-id": userId },
          body: formData,
          signal: abortControllerRef.current.signal,
        });
      } else {
        response = await fetch(`${backendUrl}/chat?mode=${selectedPersona}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify({
            message: text,
            language: selectedLanguage,
            mode: selectedPersona,
          }),
          signal: abortControllerRef.current.signal,
        });
      }

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      const rawReply = data.reply || "No response received.";
      const plainText = String(rawReply).replace(/<[^>]*>/g, "");
      const finalTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          isTyping: true,
          timestamp: finalTime,
          persona: selectedPersona,
        },
      ]);

      setLoading(false);
      setIsStreaming(true);

      let typedContent = "";
      const stepDelay = 14;

      for (let i = 0; i <= plainText.length; i++) {
        if (typingStoppedRef.current) break;
        await new Promise((r) => setTimeout(r, stepDelay));

        typedContent = plainText.slice(0, i);
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (next[idx]?.isTyping) {
            next[idx] = {
              ...next[idx],
              content:
                escapeHtml(typedContent) + (i < plainText.length ? "<span class='typing-cursor'>|</span>" : ""),
            };
          }
          return next;
        });
      }

      const finalContent = typingStoppedRef.current ? typedContent : rawReply;

      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0) {
          next[idx] = {
            role: "assistant",
            content: formatMessage(finalContent),
            timestamp: finalTime,
            image: data.image_path && data.filename ? `${backendUrl}/uploads/${data.filename}` : null,
            persona: selectedPersona,
            hasMemory: !typingStoppedRef.current,
            isTyping: false,
          };
        }
        return next;
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        const finalTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: formatMessage(`Error: ${err.message}. Please try again.`),
            timestamp: finalTime,
            persona: selectedPersona,
          },
        ]);
      }
    } finally {
      setLoading(false);
      setIsStreaming(false);
      setColdStart(false);
      abortControllerRef.current = null;
      typingStoppedRef.current = false;
    }
  };

  const regenerateLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || loading || isStreaming) return;
    setInput(lastUser.content === "Sent an image." ? "" : lastUser.content);
    setTimeout(() => sendMessage(), 0);
  };

  const handleAgree = () => {
    localStorage.setItem("ai-agreement-accepted", "true");
    setHasAgreed(true);
  };

  if (!hasAgreed) return <AgreementPopup onAgree={handleAgree} />;

  return (
    <div className={`app ${isDarkMode ? "dark" : ""}`}>
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
            <select
              id="persona-select"
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="persona-select"
              aria-label="Select persona"
            >
              {PERSONAS.map((persona) => (
                <option key={persona.key} value={persona.key}>
                  {persona.label}
                </option>
              ))}
            </select>

            <button className="top-action" onClick={clearChat} title="Clear chat" aria-label="Clear chat">
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

      <main className="main">
        <section className="chat-messages">
          {PERSONA_BLURBS[selectedPersona] && (
            <div className="persona-banner">
              <span className="banner-dot" />
              <span>{PERSONA_BLURBS[selectedPersona]}</span>
            </div>
          )}

          {coldStart && (
            <div className="cold-start">
              <div className="spinner" />
              Waking up the server. First response can take a few seconds.
            </div>
          )}

          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-title">How can I help?</div>
              <div className="empty-subtitle">
                {welcomeMessages[selectedPersona]?.en || welcomeMessages.default.en}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={`${msg.role}-${i}-${msg.timestamp || ""}`} className={`message-row ${msg.role}`}>
              {msg.role === "assistant" && <div className="assistant-avatar">{currentAvatar}</div>}

              <div className={`bubble ${msg.role}`}>
                {msg.image && <img src={msg.image} alt="Uploaded preview" className="uploaded-image" loading="lazy" />}
                <p dangerouslySetInnerHTML={{ __html: msg.content || "" }} />
                {msg.hasMemory && !msg.isTyping && <span className="memory-icon" title="Remembered context">🧠</span>}
                {!msg.isTyping && <div className="message-time">{msg.timestamp}</div>}
              </div>
            </div>
          ))}

          {(loading || isStreaming) && (
            <div className="message-row assistant">
              <div className="assistant-avatar">{currentAvatar}</div>
              <div className="bubble assistant typing-bubble">
                <div className="typing-dots"><span></span><span></span><span></span></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>
      </main>

      <div className="input-shell">
        <div className="quick-actions">
          <button className="quick-btn" onClick={regenerateLast} disabled={loading || isStreaming}>
            Regenerate
          </button>
          <button className="quick-btn danger" onClick={stopResponse} disabled={!loading && !isStreaming}>
            Stop response
          </button>
        </div>

        <div className="composer">
          {imagePreview && (
            <div className="preview-container">
              <img src={imagePreview} alt="Preview" className="preview-image" />
              <button
                className="remove-preview"
                onClick={() => {
                  setImage(null);
                  setImagePreview(null);
                }}
                aria-label="Remove image preview"
              >
                ✕
              </button>
            </div>
          )}

          <div className="composer-row">
            <label className="icon-btn file-btn" title="Upload image">
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={loading || isStreaming} />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </label>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`Message ${currentPersonaName.split(" ")[0]}...`}
              disabled={loading || isStreaming}
              className="input-field"
              rows={1}
            />

            <button
              onClick={sendMessage}
              disabled={loading || isStreaming || (!input.trim() && !image)}
              className="send-btn"
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <a
        href="mailto:sanusharma000aaa@gmail.com?subject=Shifts%20AI%20Feedback"
        className="floating-feedback"
        title="Send feedback"
        aria-label="Send feedback"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </a>
    </div>
  );
}

export default App;