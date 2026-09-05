export const SHIFT_DETAILS = {
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

export const ONBOARDING_PATHS = [
  { id: "learn", icon: "✎", title: "Learn something", description: "Study, understand, or practise", shift: "zenith" },
  { id: "focus", icon: "⌘", title: "Get unstuck", description: "Solve a problem or build something", shift: "neo" },
  { id: "feel", icon: "◍", title: "Talk it out", description: "Get perspective on a thought or choice", shift: "rishi" },
  { id: "create", icon: "✧", title: "Make something", description: "Brainstorm, write, or find an idea", shift: "nyra" },
];

export const fallbackPersonaList = {
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

export const personaAvatars = {
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

export const welcomeMessages = {
  default: {
    en: "Hey — welcome to Shifts. I’m Aisha. Want help choosing a Shift?",
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

export const PERSONA_BLURBS = {
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

export const SUGGESTION_CHIPS = {
  default: ["What can you do?", "Help me pick a Shift", "Tell me about Shifts"],
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
