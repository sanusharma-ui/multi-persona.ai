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

const SHIFT_DETAILS = {
  default: { category: "Start here", vibe: "Helpful, clear, and practical", prompt: "Help me get started", icon: "✦" },
  seven: { category: "Stories", vibe: "Cosmic stories and brave choices", prompt: "Tell me about Planet 000", icon: "◌" },
  virex: { category: "Focus", vibe: "Sharp thinking without the noise", prompt: "Help me think through this", icon: "⌁" },
  noctra: { category: "Feel", vibe: "Dreams, reflection, and a little magic", prompt: "I had a strange dream", icon: "☾" },
  kael: { category: "Feel", vibe: "Calm strength for hard moments", prompt: "I need some courage", icon: "⚔" },
  mira_time: { category: "Feel", vibe: "Choices, timelines, and perspective", prompt: "Help me decide", icon: "↻" },
  zenith: { category: "Learn", vibe: "Patient lessons, step by step", prompt: "Teach me something", icon: "✎" },
  neo: { category: "Focus", vibe: "Friendly help for code and tech", prompt: "Help me debug this", icon: "⌘" },
  cipher: { category: "Learn", vibe: "Cybersecurity, safely explained", prompt: "Explain encryption", icon: "⌁" },
  nyra: { category: "Create", vibe: "Ideas, names, and creative sparks", prompt: "Help me brainstorm", icon: "✧" },
  rishi: { category: "Feel", vibe: "Grounded perspective and clarity", prompt: "Help me find clarity", icon: "◍" },
  pulse: { category: "Focus", vibe: "A kind but direct reality check", prompt: "Give me a reality check", icon: "!" },
  diya: { category: "Play", vibe: "Fun Hinglish, gossip, and bestie energy", prompt: "Kya scene hai?", icon: "♡" },
  arjun: { category: "Feel", vibe: "Slow, calming thoughts and reflection", prompt: "Help me slow down", icon: "~" },
  raven: { category: "Play", vibe: "Bold confidence and hype", prompt: "Hype me up", icon: "♛" },
  Creator_mode: { category: "Start here", vibe: "Behind the scenes of Shifts", prompt: "How was Shifts built?", icon: "◈" },
  Sales_Bot_Mode: { category: "Focus", vibe: "Product and sales conversations", prompt: "Help me pitch this", icon: "↗" },
};

const ONBOARDING_PATHS = [
  { id: "learn", icon: "✎", title: "Learn something", description: "Study, understand, or practise", shift: "zenith" },
  { id: "focus", icon: "⌘", title: "Get unstuck", description: "Solve a problem or build something", shift: "neo" },
  { id: "feel", icon: "◍", title: "Talk it out", description: "Get perspective on a thought or choice", shift: "rishi" },
  { id: "create", icon: "✧", title: "Make something", description: "Brainstorm, write, or find an idea", shift: "nyra" },
];

function ShiftGallery({ shifts, selectedShift, avatars, onSelect, onClose }) {
  const [filter, setFilter] = useState("All");
  const categories = ["All", ...new Set(shifts.map((shift) => SHIFT_DETAILS[shift.key]?.category || "More"))];
  const visibleShifts = filter === "All"
    ? shifts
    : shifts.filter((shift) => (SHIFT_DETAILS[shift.key]?.category || "More") === filter);

  return (
    <div className="shift-gallery-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="shift-gallery" role="dialog" aria-modal="true" aria-labelledby="gallery-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="gallery-heading">
          <div>
            <span className="eyebrow">FIND YOUR FIT</span>
            <h2 id="gallery-title">Meet the Shifts</h2>
            <p>Different ways to think, create, learn, and talk.</p>
          </div>
          <button className="gallery-close" onClick={onClose} aria-label="Close Shift gallery">×</button>
        </div>
        <div className="gallery-filters" aria-label="Filter Shifts">
          {categories.map((category) => (
            <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="shift-grid">
          {visibleShifts.map((shift) => {
            const details = SHIFT_DETAILS[shift.key] || { category: "More", vibe: "A different point of view", icon: "✦" };
            const isSelected = shift.key === selectedShift;
            return (
              <button
                key={shift.key}
                className={`shift-card persona-${shift.key} ${isSelected ? "selected" : ""}`}
                onClick={() => { onSelect(shift.key); onClose(); }}
              >
                <span className="shift-card-icon">{avatars[shift.key] || details.icon}</span>
                <span className="shift-card-copy">
                  <strong>{shift.label}</strong>
                  <small>{details.vibe}</small>
                </span>
                {isSelected && <span className="selected-mark">✓</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WelcomeOnboarding({ shifts, avatars, onChoose, onExplore }) {
  const [choice, setChoice] = useState(null);
  const recommended = ONBOARDING_PATHS.find((path) => path.id === choice);
  const shift = shifts.find((item) => item.key === recommended?.shift);

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-orb orb-one" /><div className="onboarding-orb orb-two" />
      <div className="onboarding-card">
        {!recommended ? (
          <>
            <span className="eyebrow">WELCOME TO SHIFTS</span>
            <h2 id="onboarding-title">One question.<br /><em>Many ways in.</em></h2>
            <p className="onboarding-intro">What would make this conversation useful right now?</p>
            <div className="onboarding-options">
              {ONBOARDING_PATHS.map((path) => (
                <button key={path.id} onClick={() => setChoice(path.id)}>
                  <span>{path.icon}</span><strong>{path.title}</strong><small>{path.description}</small>
                </button>
              ))}
            </div>
            <button className="text-action" onClick={onExplore}>I’ll explore on my own →</button>
          </>
        ) : (
          <div className={`recommendation persona-${recommended.shift}`}>
            <span className="eyebrow">A GREAT FIRST SHIFT</span>
            <div className="recommendation-avatar">{avatars[recommended.shift] || SHIFT_DETAILS[recommended.shift]?.icon}</div>
            <h2>{shift?.label || "Your guide"}</h2>
            <p>{SHIFT_DETAILS[recommended.shift]?.vibe}. You can change Shifts anytime.</p>
            <button className="primary-action" onClick={() => onChoose(recommended.shift)}>
              Start talking <span>→</span>
            </button>
            <button className="text-action" onClick={() => setChoice(null)}>Choose something else</button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCouncilMode, setIsCouncilMode] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    () => localStorage.getItem("shifts-onboarding-complete") !== "true",
  );

  const chatMessagesRef = useRef(null);
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

  };

  const personaAvatars = {
    default: "👩‍💻",
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
  };

  const SUGGESTION_CHIPS = {
    default: ["What can you do?", "Help me pick a persona", "Tell me about Shifts"],
    seven: ["What happened to Planet 000?", "Tell me about your mission", "How did you survive?"],
    virex: ["Run a system diagnostic", "Analyze this problem", "Optimize my approach"],
    noctra: ["Tell me about tonight's moon", "I had a strange dream", "Read my energy"],
    kael: ["Tell me of your kingdom", "I need courage", "What honor demands"],
    mira_time: ["What does the timeline say?", "Help me choose wisely", "Show me the future"],
    zenith: ["Teach me something new", "Explain this concept", "Quiz me on a topic"],
    neo: ["Debug this code", "Best practices for React", "Explain this algorithm"],
    cipher: ["Teach me about security", "How would you breach this?", "Explain encryption"],
    nyra: ["I need a creative name", "Help brainstorm ideas", "Write something poetic"],
    rishi: ["What does the Gita say?", "Help me find clarity", "A lesson for today"],
    pulse: ["Give me a reality check", "Am I overthinking this?", "Be brutally honest"],
    diya: ["Kya scene hai aaj?", "Tell me some gossip", "Bestie advice chahiye"],
    arjun: ["Help me slow down", "Share a calming thought", "What should I reflect on?"],
    raven: ["Hype me up", "Rate my vibe", "Give me a pep talk"],
    Creator_mode: ["How was Shifts built?", "What's the tech stack?", "Tell me about the creator"],

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

  const PERSONAS = useMemo(() => {
    const source = Object.keys(personaList).length ? personaList : fallbackPersonaList;
    return Object.keys(source).map((key) => ({ key, label: source[key] }));
  }, [personaList]);

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
    const chatMessages = chatMessagesRef.current;
    if (!chatMessages) return;

    const scrollToLatestMessage = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    scrollToLatestMessage();
    const frameId = requestAnimationFrame(scrollToLatestMessage);

    return () => cancelAnimationFrame(frameId);
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

  const completeOnboarding = (shiftKey) => {
    if (shiftKey) setSelectedPersona(shiftKey);
    localStorage.setItem("shifts-onboarding-complete", "true");
    setIsOnboardingOpen(false);
  };

  const sendCouncilMessage = async (text) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const preferredMembers = ["neo", "rishi", "nyra"];
    const memberKeys = preferredMembers.filter((key) =>
      PERSONAS.some((shift) => shift.key === key),
    );
    const councilMembers = memberKeys.length >= 3
      ? memberKeys
      : PERSONAS.slice(0, 3).map((shift) => shift.key);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp },
    ]);
    setInput("");
    setLoading(true);
    setColdStart(messages.length === 0);

    try {
      const responses = await Promise.all(
        councilMembers.map(async (shiftKey) => {
          const response = await fetch(`${backendUrl}/chat?mode=${shiftKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body: JSON.stringify({ message: text, language: selectedLanguage }),
          });
          if (!response.ok) throw new Error(`${shiftKey} could not respond`);
          const data = await response.json();
          return { shiftKey, content: data.reply || "No response received." };
        }),
      );
      const replyTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setMessages((prev) => [
        ...prev,
        ...responses.map((reply) => ({
          role: "assistant",
          content: reply.content,
          timestamp: replyTime,
          persona: reply.shiftKey,
          council: true,
        })),
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "The Council hit a connection issue. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          persona: "default",
          council: true,
        },
      ]);
    } finally {
      setLoading(false);
      setColdStart(false);
    }
  };

  const sendMessage = async () => {
    if (loading || isStreaming) return;
    if (!input.trim() && !image) return;

    const text = input.trim();
    if (isCouncilMode && !image) {
      await sendCouncilMessage(text);
      return;
    }
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

      const words = plainText.split(/(\s+)/);
      let typedContent = "";
      const baseDelay = 20;

      for (let i = 0; i < words.length; i++) {
        if (typingStoppedRef.current) break;
        
        typedContent += words[i];
        const isLast = i === words.length - 1;
        
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (next[idx]?.isTyping) {
            next[idx] = {
              ...next[idx],
              content: typedContent,
              showCursor: !isLast,
            };
          }
          return next;
        });
        
        // Variable delay — faster for whitespace, slower for words
        const delay = words[i].trim() ? baseDelay : 5;
        await new Promise((r) => setTimeout(r, delay));
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
  if (isOnboardingOpen) {
    return (
      <WelcomeOnboarding
        shifts={PERSONAS}
        avatars={personaAvatars}
        onChoose={completeOnboarding}
        onExplore={() => completeOnboarding()}
      />
    );
  }

  return (
    <div className={`app ${isDarkMode ? "dark" : ""} persona-${selectedPersona}`}>
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

      {isGalleryOpen && (
        <ShiftGallery
          shifts={PERSONAS}
          selectedShift={selectedPersona}
          avatars={personaAvatars}
          onSelect={setSelectedPersona}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}

      <main className="main">
        <section className="chat-messages" ref={chatMessagesRef}>
          {PERSONA_BLURBS[selectedPersona] && (
            <div className="persona-banner">
              <span className="banner-dot" />
              <span>{PERSONA_BLURBS[selectedPersona]}</span>
              <button onClick={() => setIsGalleryOpen(true)}>Switch Shift</button>
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
              <div className="empty-avatar">{currentAvatar}</div>
              <div className="empty-title">How can I help?</div>
              <div className="empty-subtitle">
                {welcomeMessages[selectedPersona]?.en ||
                  welcomeMessages.default.en}
              </div>
              <div className="suggestion-chips">
                {(SUGGESTION_CHIPS[selectedPersona] || SUGGESTION_CHIPS.default).map(
                  (chip) => (
                    <button
                      key={chip}
                      className="suggestion-chip"
                      onClick={() => {
                        setInput(chip);
                        setTimeout(() => sendMessage(), 0);
                      }}
                    >
                      {chip}
                    </button>
                  ),
                )}
              </div>
              <button className="meet-shifts-link" onClick={() => setIsGalleryOpen(true)}>
                Meet all Shifts <span>→</span>
              </button>
            </div>
          )}

          {messages.map((msg, i) => {
            const messageAvatar = personaAvatars[msg.persona] || currentAvatar;
            const messageName = personaList[msg.persona] || fallbackPersonaList[msg.persona] || currentPersonaName;
            return (
              <React.Fragment key={`${msg.role}-${i}-${msg.timestamp || ""}`}>
                {msg.council && !messages[i - 1]?.council && (
                  <div className="council-divider"><span>✦</span> Three perspectives from the Council</div>
                )}
                <div className={`message-row ${msg.role} ${msg.council ? "council-reply" : ""}`}>
                  {msg.role === "assistant" && <div className="assistant-avatar">{messageAvatar}</div>}
                  <div className={`bubble ${msg.role}`}>
                    {msg.council && <div className="council-reply-label"><span>{messageAvatar}</span>{messageName}</div>}
                    {msg.image && <img src={msg.image} alt="Uploaded preview" className="uploaded-image" loading="lazy" />}
                    <MarkdownMessage message={msg.content} />
                    {msg.showCursor && <span className="streaming-cursor" />}
                    {msg.hasMemory && !msg.isTyping && <span className="memory-icon" title="Remembered context">🧠</span>}
                    {!msg.isTyping && <div className="message-time">{msg.timestamp}</div>}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {loading && !isStreaming && (
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

        </section>
      </main>

      <div className="input-shell">
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
            disabled={loading || isStreaming}
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
            <label className={`icon-btn file-btn ${isCouncilMode ? "disabled" : ""}`} title={isCouncilMode ? "Turn off Council to add an image" : "Upload image"}>
              <input
                type="file"
                accept="image/*"
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
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
