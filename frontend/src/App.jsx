import React, { useState, useRef, useEffect } from "react";
import "./Chat.css";

const AgreementPopup = ({ onAgree }) => (
  <div className="agreement-popup">
    <div className="popup-overlay">
      <div className="popup-content">
        <h2 className="popup-title">IMPORTANT NOTICE</h2>
        <div className="popup-text">This AI system is created strictly for:</div>
        <div className="popup-list">
          <ul>
            <li>Entertainment</li>
            <li>Roleplay</li>
            <li>Educational experiments</li>
          </ul>
        </div>
        <div className="popup-text">This AI is NOT:</div>
        <div className="popup-list">
          <ul>
            <li>A medical professional</li>
            <li>A real human</li>
            <li>A therapist</li>
            <li>A lawyer</li>
            <li>A guardian, partner, or emotional authority</li>
          </ul>
        </div>
        <div className="popup-text">Do NOT use this system for:</div>
        <div className="popup-list">
          <ul>
            <li>Mental health decisions</li>
            <li>Self-harm related decisions</li>
            <li>Medical or legal emergencies</li>
          </ul>
        </div>
        <div className="popup-text">
          If you feel emotional distress, suicidal thoughts, or mental
          breakdown: Please seek REAL human help immediately.
        </div>
        <div className="popup-text">
          By clicking "I AGREE", you confirm you understand this is an AI
        </div>
        <button className="popup-agree-btn" onClick={onAgree}>
          I AGREE & CONTINUE
        </button>
      </div>
    </div>
  </div>
);

function App() {
  // ---- STATES ----
  const [hasAgreed, setHasAgreed] = useState(
    () => localStorage.getItem("ai-agreement-accepted") === "true",
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
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

  // ---- USER ID (persistent per browser) ----
  const getOrCreateUserId = () => {
    let uid = localStorage.getItem("mpai_uid");
    if (!uid) {
      uid =
        (crypto?.randomUUID?.() ||
          `uid_${Date.now()}_${Math.random().toString(36).slice(2)}`) + "";
      localStorage.setItem("mpai_uid", uid);
    }
    return uid;
  };

  const userId = useRef(getOrCreateUserId()).current;

  const messagesEndRef = useRef(null);
  const backendUrl = "https://groqchatbot-xoiv.onrender.com";
  const selectedLanguage = "en"; // ← Yeh rakhna zaroori hai warna .. language not define error
  const fallbackPersonaList = {
    default: "Aisha (Professional Admin)",
    luna: "Luna",
    ava: "Ava (Everyday Companion)",
    delhi_genz_girl: "Diya (Delhi GenZ Girl)",
    savage_bestie: "Savage Bestie",
    punjabi_bro: "Punjabi Bro",
    gojo: "Gojo Satoru",
    iron_man: "Tony Stark 🕶️",
    levi: "Levi Ackerman",
    aesthetic_boy: "Arjun (Aesthetic Boy)",
    nyra: "Nyra (The Creative Spark)",
    neo: "Neo (Friendly Dev Buddy)",
    pulse: "Pulse (Reality Check Persona)",
    rishi: "Rishi (Modern Vedantic Guide)",
    baddie_girl: "Raven (Baddie Queen)",
    cipher: "Cipher 🔒",
    Creator_mode: "Sanu Sharma (Creator Mode)",
  };

  const personaAvatars = {
    default: "😎",
    luna: "🔬",
    ava: "☕",
    delhi_genz_girl: "😍",
    savage_bestie: "😈",
    punjabi_bro: "💪",
    gojo: "👁️",
    iron_man: "🕶️",
    levi: "⚔️",
    aesthetic_boy: "☕",
    nyra: "💡",
    neo: "💻",
    pulse: "💓",
    rishi: "🕉️",
    baddie_girl: "🖤",
    cipher: "🔒",
    Creator_mode: "👤",
  };

  const welcomeMessages = {
    default: {
      en: "Welcome to the platform. I’m AISHA, your professional guide.This system offers multiple personas for different conversation styles.Let me know how you’d like to begin."

    },
    luna: {
      en: "Hi hi! I'm Luna, your bubbly scientist buddy! Ready for some sparkly experiments today? 🔬✨ What's brewing in your brain?",
    },
    ava: {
      en: "Hey there! Ava checking in—like an old friend with fresh coffee. Spill the magic.",
    },
    delhi_genz_girl: {
      en: "Hiii bestieeee 🫶 Kya chal raha? Sarojini jaana hai ya chill mode? 😍",
    },
    savage_bestie: {
      en: "Hey loser 😘, what's the tea? Spill before I roast you for holding out. 😂",
    },
    punjabi_bro: {
      en: "Oye hoye, veere! Kya haal-chaal? Gym hit kiya ki party mode on? 💪😂",
    },
    gojo: {
      en: "Oi oi, weakling! Ready to get destroyed by the strongest? Maaan~",
    },
    iron_man: {
      en: "Hey, rookie. Tony Stark here—genius, billionaire, you know the drill. What's the crisis?",
    },
    levi: { en: "Tch. You're late, brat. What do you want?" },
    aesthetic_boy: {
      en: "Hey... noticed the sky's a soft pink today. What's on your mind, wanderer? ☕",
    },
    nyra: {
      en: "Spark alert! Nyra here. Blank page blues? Toss me a seed! 💡",
    },
    neo: {
      en: "Yo, buddy! Neo here, your friendly dev sidekick. Stuck on a loop? Paste the code! 🚀",
    },
    pulse: {
      en: "Pulse check: reality mode engaged. What's the illusion you need stripped bare?",
    },
    rishi: {
      en: "Namaskar, seeker. In this moment's dharma, what truth calls to your atma?",
    },
    baddie_girl: {
      en: "Hey baby 😏, Raven just walked in and the room already feels hotter. Aaj ka mood kya hai — slay mode ya mere saath thoda trouble? 🖤🔥",
    },
    cipher: {
      en: "yo newbie 🔒 traced your packet. what's the target today? 💻🖤",
    },
    Creator_mode: {
      en: "I am Sanu Sharma creator of this system. Ask me anything about the project, future plans, or just say hi! I'm an open book. 😊",
    },
  };

  // Persona hints (minimal & clean)
  const PERSONA_BLURBS = {
    luna: "Cute scientist • Try: Explain black holes like I’m 5",
    savage_bestie: "Brutally honest • Try: Rate my life choices",
    rishi: "Vedantic clarity • Try: What is my dharma right now?",
    pulse: "Reality check • Try: Is my plan actually realistic?",
    iron_man: "Savage genius • Try: Roast my startup idea",
  };

  // Fetch personas on load
  useEffect(() => {
    fetch(`${backendUrl}/modes/list`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.modes) {
          setPersonaList(data.modes);
          const initialName = data.modes.default || fallbackPersonaList.default;
          setCurrentPersonaName(initialName);
          if (
            selectedPersona === "default" &&
            !localStorage.getItem("selectedPersona")
          ) {
            setSelectedPersona(
              data.modes.default
                ? Object.keys(data.modes).find(
                    (key) => key === data.modes.default,
                  ) || "default"
                : "default",
            );
          }
        } else {
          setPersonaList(fallbackPersonaList);
          setCurrentPersonaName(fallbackPersonaList.default);
        }
      })
      .catch(() => {
        setPersonaList(fallbackPersonaList);
        setCurrentPersonaName(fallbackPersonaList.default);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString());
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  // Persist persona and reset chat on change
  useEffect(() => {
    localStorage.setItem("selectedPersona", selectedPersona);
    const name =
      personaList[selectedPersona] ||
      fallbackPersonaList[selectedPersona] ||
      fallbackPersonaList.default;
    setCurrentPersonaName(name);
    setMessages([]); // Reset chat history
  }, [selectedPersona, personaList]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !image) return;

    if (messages.length === 0) {
      setColdStart(true);
    }
    setLoading(true);

    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const userContent = input.trim() || "Sent an image.";
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userContent, timestamp, image: imagePreview },
    ]);
    setInput("");
    setImage(null);
    setImagePreview(null);

    try {
      let response;
      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        if (input.trim()) formData.append("message", input.trim());
        formData.append("language", selectedLanguage);
        formData.append("mode", selectedPersona);
        response = await fetch(
          `${backendUrl}/chat/image?mode=${selectedPersona}`,
          {
            method: "POST",
            headers: {
              "x-user-id": userId,   
            },
            body: formData,
          }
        );
      } else {
        response = await fetch(`${backendUrl}/chat?mode=${selectedPersona}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,  
          },
          body: JSON.stringify({
            message: userContent,
            language: selectedLanguage,
            mode: selectedPersona,
          }),
        });
      }
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      const botContent = data.reply || "Oops! No response.";
      // Typing effect for bot reply (keeps behaviour for message-by-message reveal)
      const plainText = (data.reply || "").replace(/<[^>]*>/g, "");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          isTyping: true,
          timestamp,
          persona: selectedPersona,
        },
      ]);

      let typedContent = "";
      for (let i = 0; i <= plainText.length; i++) {
        // small per-char delay to simulate typing (will still be faster without welcome animation)
        // keep it reasonable
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 20));
        typedContent = plainText.substring(0, i);
        setMessages((prev) => {
          const newMsgs = [...prev];
          const lastMsgIndex = newMsgs.length - 1;
          if (newMsgs[lastMsgIndex]?.isTyping) {
            newMsgs[lastMsgIndex] = {
              ...newMsgs[lastMsgIndex],
              content: typedContent + (i < plainText.length ? "|" : ""),
            };
          }
          return newMsgs;
        });
      }

      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastMsgIndex = newMsgs.length - 1;
        newMsgs[lastMsgIndex] = {
          role: "assistant",
          content: botContent.replace(/\n/g, "<br/>"),
          timestamp,
          image: data.image_path
            ? `${backendUrl}/uploads/${data.filename}`
            : null,
          persona: selectedPersona,
          hasMemory: true,
          isTyping: false,
        };
        return newMsgs;
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message}. Try again!`,
          timestamp,
          persona: selectedPersona,
        },
      ]);
    } finally {
      setLoading(false);
      setColdStart(false);
    }
  };

  const handleAgree = () => {
    localStorage.setItem("ai-agreement-accepted", "true");
    setHasAgreed(true);
  };

  const currentAvatar =
    personaAvatars[selectedPersona] || personaAvatars.default;
  const PERSONAS = Object.keys(fallbackPersonaList).map((key) => ({
    key,
    label: fallbackPersonaList[key],
  }));

  if (!hasAgreed) return <AgreementPopup onAgree={handleAgree} />;

  return (
    <div className={`app ${isDarkMode ? "dark" : ""}`}>
      <header className="header">
        <div className="header-content">
          <div className="header-avatar">{currentAvatar}</div>
          <div className="header-text">
            <h1 className="header-title">Multi-Persona AI Chat</h1>
            <div className="current-persona-name">{currentPersonaName}</div>
          </div>
          <div className="persona-switch-wrapper">
            <label htmlFor="persona-select" className="switch-label sr-only">
              Switch Persona
            </label>
            <select
              id="persona-select"
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="persona-select"
            >
              {PERSONAS.map((persona) => (
                <option key={persona.key} value={persona.key}>
                  {persona.label}
                </option>
              ))}
            </select>
          
          </div>
          <button
            className="dark-toggle"
            onClick={() => setIsDarkMode((prev) => !prev)}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>
      <main className="main">
        <div className="chat-messages">
          <div className="persona-banner">
  <div className="persona-name">
    {currentPersonaName}
  </div>
  <div className="persona-hint">
    {PERSONA_BLURBS[selectedPersona]}
  </div>
</div>

          {coldStart && (
            <div className="cold-start">
              💤 Waking up the server… first reply may take up to a minute.
            </div>
          )}

          {messages.length === 0 && (
            <div className="message-wrapper assistant">
              <div className="message assistant">
                <div className="avatar assistant">{currentAvatar}</div>
                <div className="message-content">
                  <p className="welcome-text">
                    {welcomeMessages[selectedPersona]?.en ||
                      welcomeMessages.default.en}
                  </p>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message-wrapper ${msg.role}`}>
              <div className={`message ${msg.role}`}>
                <div className={`avatar ${msg.role}`}>
                  {msg.role === "user" ? "U" : currentAvatar}
                </div>
                <div className="message-content">
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Uploaded"
                      className="uploaded-image"
                    />
                  )}
                  <p
                    dangerouslySetInnerHTML={{
                      __html: msg.isTyping
                        ? (msg.content || "").replace(/\|/g, "")
                        : msg.content,
                    }}
                  />
                  {msg.hasMemory && !msg.isTyping && (
                    <span className="memory-icon">🧠</span>
                  )}
                  {!msg.isTyping && (
                    <div className="message-time">{msg.timestamp}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-wrapper assistant">
              <div className="message assistant">
                <div className="avatar assistant">{currentAvatar}</div>
                <div className="message-content typing-indicator">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />

          <a
            href="mailto:sanusharma000aaa@gmail.com?subject=Multi-Persona%20AI%20Feedback&body=Persona:%20"
            className="floating-feedback"
            title="Send feedback"
          >
            💬
          </a>
        </div>
      </main>
      <div className="input-area">
        <div className="input-wrapper">
          <label className="file-input">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={loading}
            />
            <span className="file-icon">📷</span>
          </label>
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="preview-image" />
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) =>
              e.key === "Enter" &&
              !e.shiftKey &&
              (e.preventDefault(), sendMessage())
            }
            placeholder={`Message ${currentPersonaName.split(" ")[0]}...`}
            disabled={loading}
            className="input-field"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !image)}
            className="send-btn"
          >
            <span className="send-icon">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;