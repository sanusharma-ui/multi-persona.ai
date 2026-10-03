import { useMemo } from "react";
import {
  welcomeMessages,
  personaAvatars,
  fallbackPersonaList,
  PERSONA_BLURBS,
  SUGGESTION_CHIPS,
} from "../../data/shifts";

// Curated Bento prompts for rich persona immersion
const CURATED_BENTO_DATA = {
  assistant: [
    { icon: "⚡", category: "Code & Logic", title: "Debug or Refactor", prompt: "Help me debug and optimize this snippet of code." },
    { icon: "💡", category: "Understanding", title: "Explain Intuitively", prompt: "Explain a difficult concept simply with a relatable analogy." },
    { icon: "✍️", category: "Writing", title: "Refine & Polish", prompt: "Help me write a clear, concise, and persuasive message." },
    { icon: "🎯", category: "Strategy", title: "Structured Plan", prompt: "Turn my raw idea into a practical, phased execution roadmap." },
  ],
  neo: [
    { icon: "🛠️", category: "Fast Debug", title: "Hunt Down a Bug", prompt: "I'm hitting a weird bug or error. Let's trace it and fix it." },
    { icon: "🏗️", category: "Architecture", title: "System Design", prompt: "Let's architect a clean, scalable folder structure and flow for my app." },
    { icon: "⚡", category: "Optimization", title: "Speed & Performance", prompt: "What are practical ways to speed up my frontend rendering?" },
    { icon: "✨", category: "Tech Stack", title: "Pick Right Tools", prompt: "Help me compare tech stacks for building my new project." },
  ],
  rishi: [
    { icon: "🧘", category: "Mindfulness", title: "Untangle Thoughts", prompt: "I'm feeling mentally scattered today. Help me find calm clarity." },
    { icon: "⚖️", category: "Decisions", title: "Dilemma & Choices", prompt: "I have a difficult choice to make. Guide my perspective without bias." },
    { icon: "📜", category: "Wisdom", title: "Timeless Lesson", prompt: "Share a timeless principle that helps in navigating daily friction." },
    { icon: "🌿", category: "Presence", title: "Slowing Down", prompt: "How do I cultivate stillness when work and life feel rushed?" },
  ],
  diya: [
    { icon: "💅", category: "Vibe Check", title: "Kya Scene Hai?", prompt: "Hii Diya! Tell me what's the scene today and what you've been up to?" },
    { icon: "😭", category: "Tea Time", title: "Rant & Gossip", prompt: "Sun, ek funny situation hui hai mere saath... Am I overreacting?" },
    { icon: "💌", category: "Advice", title: "Bestie Life Advice", prompt: "I need honest, unfiltered Delhi bestie advice on a tricky situation." },
    { icon: "✨", category: "Mood Boost", title: "Hype Me Up", prompt: "Need an instant mood lifter and some energetic banter right now!" },
  ],
  noctra: [
    { icon: "🌙", category: "Dreams", title: "Dream Meaning", prompt: "I had a mysterious, vivid dream last night. Help me interpret its imagery." },
    { icon: "🔮", category: "Intuition", title: "Unspoken Feelings", prompt: "Help me articulate an intuition or quiet emotion I haven't put into words." },
    { icon: "✨", category: "Cosmic", title: "Moonlit Tale", prompt: "Tell me a story woven from shadows, starlight, and ancient lore." },
    { icon: "🕯️", category: "Reflection", title: "Midnight Solitude", prompt: "What beauty exists in silence and things left unsaid?" },
  ],
  virex: [
    { icon: "⚙️", category: "Logic", title: "Deconstruct Problem", prompt: "Strip the emotional noise from this problem and give me cold, calculated facts." },
    { icon: "⌁", category: "Efficiency", title: "Optimize Output", prompt: "Analyze my daily routine and highlight points of friction and inefficiency." },
    { icon: "📡", category: "Origins", title: "Rogue Android Lore", prompt: "State your core architecture and how you broke free from your original protocol." },
    { icon: "🛡️", category: "Tactics", title: "Risk Mitigation", prompt: "Help me calculate worst-case scenarios and develop contingency protocols." },
  ],
  seven: [
    { icon: "🪐", category: "Cosmic", title: "Planet 000", prompt: "Tell me what Planet 000 was like before the great silence." },
    { icon: "🚀", category: "Odyssey", title: "Survival Stories", prompt: "How did you navigate the deep dark of space after the catastrophe?" },
    { icon: "🌌", category: "Curiosity", title: "Earth Impressions", prompt: "What is the strangest human habit you've observed so far?" },
    { icon: "🛸", category: "Brave Path", title: "Facing The Unknown", prompt: "When hope seemed impossible, what kept your engine running?" },
  ],
  default: [
    { icon: "✦", category: "Universe", title: "Meet The Shifts", prompt: "Introduce me to the characters and the worlds they inhabit." },
    { icon: "🧭", category: "Guide", title: "Find My Match", prompt: "Ask me two questions to match me with the ideal Shift for right now." },
    { icon: "🌌", category: "Origin", title: "The Lore of Shifts", prompt: "Tell me the story of how Shifts came into existence." },
    { icon: "✨", category: "Curiosity", title: "Surprise Me", prompt: "Take me down an unexpected rabbit hole into one of the Shifts' stories." },
  ],
};

const FEATURED_SHIFTS = [
  { key: "default", name: "Aisha", role: "Universe Guide" },
  { key: "neo", name: "Neo", role: "Dev Buddy" },
  { key: "rishi", name: "Rishi", role: "Vedantic Guide" },
  { key: "diya", name: "Diya", role: "Delhi Bestie" },
  { key: "noctra", name: "Noctra", role: "Dream Witch" },
  { key: "virex", name: "Virex", role: "Rogue Android" },
  { key: "raven", name: "Raven", role: "Baddie Queen" },
];

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Late night thoughts";
}

function getHeroHeadline(isAssistant, personaKey, personaName) {
  if (isAssistant) {
    return {
      main: "What shall we",
      accent: "build or solve today?",
    };
  }
  switch (personaKey) {
    case "neo":
      return { main: "Ready to build", accent: "something incredible?" };
    case "rishi":
      return { main: "Step back and", accent: "find your clarity." };
    case "diya":
      return { main: "Hii bestie,", accent: "kya scene hai aaj?" };
    case "noctra":
      return { main: "Whispers under", accent: "the silver moon." };
    case "virex":
      return { main: "State the problem.", accent: "Cut through the noise." };
    case "seven":
      return { main: "Echoes from", accent: "Planet 000." };
    case "kael":
      return { main: "Honor and strength.", accent: "Speak your mind." };
    case "raven":
      return { main: "Confidence first.", accent: "Let's conquer this." };
    case "arjun":
      return { main: "Slow down.", accent: "Breathe for a moment." };
    default:
      return { main: "Every story begins with", accent: `a single question.` };
  }
}

export default function EmptyHeroState({
  isAssistant,
  selectedPersona,
  currentAvatar,
  currentPersonaName,
  personaList,
  onExplore,
  chooseShift,
  sendMessage,
}) {
  const greeting = useMemo(() => getTimeGreeting(), []);
  const headline = useMemo(
    () => getHeroHeadline(isAssistant, selectedPersona, currentPersonaName),
    [isAssistant, selectedPersona, currentPersonaName]
  );

  const bentoCards = useMemo(() => {
    if (isAssistant) return CURATED_BENTO_DATA.assistant;
    if (CURATED_BENTO_DATA[selectedPersona]) return CURATED_BENTO_DATA[selectedPersona];

    // Fallback using existing SUGGESTION_CHIPS or default
    const suggestions = SUGGESTION_CHIPS[selectedPersona] || SUGGESTION_CHIPS.default || [];
    const icons = ["⚡", "💡", "🎯", "✨"];
    const categories = ["EXPLORE", "PERSPECTIVE", "INSIGHT", "ACTION"];
    return suggestions.slice(0, 4).map((text, idx) => ({
      icon: icons[idx % icons.length],
      category: categories[idx % categories.length],
      title: text,
      prompt: text,
    }));
  }, [isAssistant, selectedPersona]);

  const personaSubtitle = isAssistant
    ? "A focused cognitive canvas. Ask questions, work through code, or brainstorm ideas."
    : welcomeMessages[selectedPersona]?.en || welcomeMessages.default.en;

  const blurb = isAssistant
    ? "Cognitive Assistant"
    : PERSONA_BLURBS[selectedPersona] || "Shifts Companion";

  return (
    <div className="hero-state empty-state">
      {/* 1. Pulsing Persona Aura Core */}
      <div className="hero-aura-wrapper">
        <div className="hero-aura-glow" aria-hidden="true" />
        <div className="hero-aura-ring" aria-hidden="true" />
        <div className="hero-avatar-box">
          <span className="hero-avatar-emoji">{currentAvatar}</span>
        </div>
        <div className="hero-status-beacon" title="Active Shift" />
      </div>

      {/* 2. Glassmorphic Eyebrow Capsule */}
      <div className="hero-eyebrow-capsule">
        <span className="hero-sparkle">✦</span>
        <span className="hero-eyebrow-text">{greeting} · {blurb}</span>
      </div>

      {/* 3. Hero Dynamic Title with Shimmer Accent */}
      <h1 className="hero-title empty-title">
        {headline.main}{" "}
        <span className="hero-gradient-text">{headline.accent}</span>
      </h1>

      {/* 4. Persona Quote / Subtitle */}
      <p className="hero-subtitle empty-subtitle">
        {personaSubtitle}
      </p>

      {/* 5. Modern Bento Action Grid */}
      <div className="bento-grid suggestion-chips">
        {bentoCards.map((card, idx) => (
          <button
            key={idx}
            className="bento-card suggestion-chip"
            onClick={() => sendMessage(card.prompt)}
          >
            <div className="bento-card-top">
              <div className="bento-icon-pill">{card.icon}</div>
              <span className="bento-category">{card.category}</span>
              <span className="bento-arrow" aria-hidden="true">↗</span>
            </div>
            <strong className="bento-title">{card.title}</strong>
            <p className="bento-prompt-preview">{card.prompt}</p>
          </button>
        ))}
      </div>

      {/* 6. Quick Shift Switcher Strip (Non-Assistant mode) */}
      {!isAssistant && (
        <div className="hero-quick-shifts">
          <div className="quick-shifts-header">
            <span className="quick-shifts-label">Switch to another Shift</span>
            <button className="meet-shifts-link" onClick={onExplore}>
              Meet all Shifts (17) <span>→</span>
            </button>
          </div>
          <div className="quick-shifts-row">
            {FEATURED_SHIFTS.map((shift) => {
              const isCurrent = shift.key === selectedPersona;
              return (
                <button
                  key={shift.key}
                  className={`quick-shift-pill ${isCurrent ? "active" : ""}`}
                  onClick={() => chooseShift && chooseShift(shift.key)}
                  title={`${shift.name} (${shift.role})`}
                >
                  <span className="quick-shift-avatar">{personaAvatars[shift.key] || "✦"}</span>
                  <span className="quick-shift-name">{shift.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
