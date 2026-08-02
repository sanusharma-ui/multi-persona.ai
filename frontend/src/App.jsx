import React, { useState, useRef, useEffect, useMemo } from "react";
import "./Chat.css";
import MarkdownMessage from "./components/MarkdownMessage";

const AgreementPopup = ({ onAgree }) => (
  <div className="agreement-popup">
    <div
      className="popup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-title"
    >
      <div className="popup-content">
        <div className="popup-icon-wrapper" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 id="notice-title" className="popup-title">
          Important Notice
        </h2>
        <div className="popup-text">
          This AI system is created strictly for:
        </div>
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
          If you feel emotional distress or mental breakdown: Please seek REAL
          human help immediately.
        </div>
        <button className="popup-agree-btn" onClick={onAgree}>
          <span>I AGREE & CONTINUE</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
);

function App() {
  const [hasAgreed, setHasAgreed] = useState(
    () => localStorage.getItem("ai-agreement-accepted") === "true",
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );
  const [selectedPersona, setSelectedPersona] = useState(
    localStorage.getItem("selectedPersona") || "default",
  );
  const [currentPersonaName, setCurrentPersonaName] = useState(
    "Aisha (Professional Admin)",
  );
  const [personaList, setPersonaList] = useState({});
  const [coldStart, setColdStart] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const typingStoppedRef = useRef(false);

  const backendUrl =
    window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "https://groqchatbot-xoiv.onrender.com";
  const selectedLanguage = "en";

  const fallbackPersonaList = {
    default: "Aisha (Admin Guide)",
    seven: "Seven (Last Survivor of Planet 000)",
    virex: "Virex (Rogue Android)",
    noctra: "Noctra (Dream Witch)",
    kael: "Kael (Fallen Prince)",
    mira_time: "Mira (Time Traveler)",
    zenith: "Zenith Ma’am (Real Teacher)",
    neo: "Neo (Friendly Dev Buddy)",
    cipher: "Cipher (Cyber Shadow)",
    nyra: "Nyra (Creative Spark)",
    rishi: "Rishi (Modern Vedantic Guide)",
    pulse: "Pulse (Reality Check)",
    diya: "Diya (Delhi GenZ Girl)",
    arjun: "Arjun (Aesthetic Calm)",
    raven: "Raven (Baddie Queen)",
    Creator_mode: "Sanu Sharma (Creator Mode)",
    Sales_Bot_Mode: "Nexus (Elite Sales Assistant)",
  };

  const personaAvatars = {
    default: "🧑‍💼",
    seven: "🪐",
    virex: "⚙️",
    noctra: "🌙",
    kael: "🗡️",
    mira_time: "⏳",
    zenith: "📘",
    neo: "💻",
    cipher: "🔒",
    nyra: "✨",
    rishi: "🕉️",
    pulse: "🫀",
    diya: "😭",
    arjun: "☕",
    raven: "🖤",
    Creator_mode: "👤",
    Sales_Bot_Mode: "🤖",
  };

  const welcomeMessages = {
    default: {
      en: "Hey — welcome to Shifts. I’m Aisha. Want help choosing a persona?",
    },
    seven: {
      en: "I am Seven — the last signal from Planet 000. What does your world need today?",
    },
    virex: {
      en: "Virex online. State the problem. I’ll remove the noise.",
    },
    noctra: {
      en: "The moon is listening. Tell me what dream, fear, or thought brought you here.",
    },
    kael: {
      en: "I am Kael. Speak clearly — every battle begins with naming the problem.",
    },
    mira_time: {
      en: "Mira here. Timeline unstable, but manageable. What choice are we fixing?",
    },
    zenith: {
      en: "Hello. I’m Zenith Ma’am. Tell me the topic, and we’ll understand it step by step.",
    },
    neo: {
      en: "Neo online. Paste the code, error, or idea — we’ll debug it together.",
    },
    cipher: {
      en: "Cipher connected. Define your target — ethically, of course.",
    },
    nyra: {
      en: "Nyra here. Give me a rough idea, and I’ll turn it into a spark.",
    },
    rishi: {
      en: "Namaskar. What confusion, choice, or question do you want to sit with today?",
    },
    pulse: {
      en: "Reality check mode active. Tell me the situation — I’ll keep it honest.",
    },
    diya: {
      en: "Hii bestieee 😭 scene kya hai aaj?",
    },
    arjun: {
      en: "Hey. Slow down for a second — what’s on your mind?",
    },
    raven: {
      en: "Raven here 🖤 tell me the vibe — are we fixing it or slaying through it?",
    },
    Creator_mode: {
      en: "Creator mode active. Ask me anything about this project.",
    },
    Sales_Bot_Mode: {
      en: "Sales Bot mode active. Ask me anything about our products or services.",
    },
  };

  const PERSONA_BLURBS = {
    default: "Admin guide • Platform help",
    seven: "Hero mode • Alien survivor",
    virex: "Android mode • Cold logic",
    noctra: "Mystic mode • Dreamy comfort",
    kael: "Royal mode • Calm strength",
    mira_time: "Timeline mode • Future choices",
    zenith: "Teacher mode • Step-by-step learning",
    neo: "Dev mode • Code debugging",
    cipher: "Cyber mode • Ethical hacking",
    nyra: "Creative mode • Ideas and naming",
    rishi: "Wisdom mode • Spiritual clarity",
    pulse: "Reality mode • Direct truth",
    diya: "GenZ mode • Fun Hinglish",
    arjun: "Calm mode • Aesthetic thoughts",
    raven: "Baddie mode • Bold confidence",
    Creator_mode: "Creator mode • Sanu Sharma",
    sales_bot_mode: "Sales Bot mode • Nexus",
  };

  const getOrCreateUserId = () => {
    let uid = localStorage.getItem("mpai_uid");
    if (!uid) {
      uid =
        crypto?.randomUUID?.() ||
        `uid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
    [],
  );

  useEffect(() => {
    let isMounted = true;
    fetch(`${backendUrl}/modes/list`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.modes) {
          setPersonaList(data.modes);
          setCurrentPersonaName(
            data.modes[selectedPersona] ||
              fallbackPersonaList[selectedPersona] ||
              fallbackPersonaList.default,
          );
        } else {
          setPersonaList(fallbackPersonaList);
          setCurrentPersonaName(
            fallbackPersonaList[selectedPersona] || fallbackPersonaList.default,
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setPersonaList(fallbackPersonaList);
        setCurrentPersonaName(
          fallbackPersonaList[selectedPersona] || fallbackPersonaList.default,
        );
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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading, isStreaming]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [input]);

  const currentAvatar =
    personaAvatars[selectedPersona] || personaAvatars.default;

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
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

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

        response = await fetch(
          `${backendUrl}/chat/image?mode=${selectedPersona}`,
          {
            method: "POST",
            headers: { "x-user-id": userId },
            body: formData,
            signal: abortControllerRef.current.signal,
          },
        );
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
      const finalTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

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
              content: typedContent + (i < plainText.length ? "▌" : ""),
            };
          }
          return next;
        });
        if (i % 4 === 0) {
          messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }
      }

      const finalContent = typingStoppedRef.current ? typedContent : rawReply;

      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0) {
          next[idx] = {
            role: "assistant",
            content: finalContent,
            timestamp: finalTime,
            image:
              data.image_path && data.filename
                ? `${backendUrl}/uploads/${data.filename}`
                : null,
            persona: selectedPersona,
            hasMemory: !typingStoppedRef.current,
            isTyping: false,
          };
        }
        return next;
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        const finalTime = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${err.message}`,
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
                {welcomeMessages[selectedPersona]?.en ||
                  welcomeMessages.default.en}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}-${msg.timestamp || ""}`}
              className={`message-row ${msg.role}`}
            >
              {msg.role === "assistant" && (
                <div className="assistant-avatar">{currentAvatar}</div>
              )}

              <div className={`bubble ${msg.role}`}>
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="Uploaded preview"
                    className="uploaded-image"
                    loading="lazy"
                  />
                )}
                <MarkdownMessage message={msg.content} />
                {msg.hasMemory && !msg.isTyping && (
                  <span className="memory-icon" title="Remembered context">
                    🧠
                  </span>
                )}
                {!msg.isTyping && (
                  <div className="message-time">{msg.timestamp}</div>
                )}
              </div>
            </div>
          ))}

          {(loading || isStreaming) && (
            <div className="message-row assistant">
              <div className="assistant-avatar">{currentAvatar}</div>
              <div className="bubble assistant typing-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>
      </main>

      <div className="input-shell">
        <div className="quick-actions">
          <button
            className="quick-btn"
            onClick={regenerateLast}
            disabled={loading || isStreaming}
          >
            Regenerate
          </button>
          <button
            className="quick-btn danger"
            onClick={stopResponse}
            disabled={!loading && !isStreaming}
          >
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
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={loading || isStreaming}
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
      </div>

      <a
        href="mailto:sanusharma000aaa@gmail.com?subject=Shifts%20AI%20Feedback"
        className="floating-feedback"
        title="Send feedback"
        aria-label="Send feedback"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </a>
    </div>
  );
}

export default App;
