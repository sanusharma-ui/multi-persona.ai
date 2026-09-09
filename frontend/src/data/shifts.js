export const SHIFT_DETAILS = {
  default: { category: "Start here", vibe: "Keeper of Shifts, your guide to the universe", prompt: "Introduce me to the Shifts universe", icon: "✦" },
  seven: { category: "Stories", vibe: "Cosmic stories and brave choices", prompt: "Tell me about Planet 000", icon: "◌" },
  virex: { category: "Focus", vibe: "A rogue android with cold logic and dry humor", prompt: "Tell me about your current life", icon: "⌁" },
  noctra: { category: "Feel", vibe: "Dreams, reflection, and a little magic", prompt: "I had a strange dream", icon: "☾" },
  kael: { category: "Feel", vibe: "A fallen prince finding his way forward", prompt: "Tell me about your story", icon: "⚔" },
  mira_time: { category: "Feel", vibe: "A time traveler with a chaotic sense of humor", prompt: "Tell me about your current life", icon: "↻" },
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
  { id: "learn", icon: "✎", title: "Meet a teacher", description: "Discover Zenith and her world of learning", shift: "zenith" },
  { id: "focus", icon: "⌘", title: "Meet a builder", description: "Get to know Neo, one idea at a time", shift: "neo" },
  { id: "feel", icon: "◍", title: "Meet a thinker", description: "Explore life and perspective with Rishi", shift: "rishi" },
  { id: "create", icon: "✧", title: "Meet a creative", description: "Follow a spark into Nyra’s world", shift: "nyra" },
];

export const fallbackPersonaList = {
  default: "Aisha (Keeper of Shifts)",
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
    en: "Welcome to Shifts. I’m Aisha, the Keeper. Meet the characters, ask about their lives, and find a story to step into.",
  },
  seven: {
    en: "I'm Seven. I lost my home, Planet 000. I'm still getting used to life here, but I'd like to get to know you.",
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
  default: "Keeper of Shifts • Your universe guide",
  seven: "Last survivor • Cosmic mystery",
  virex: "Rogue android • Cold logic",
  noctra: "Dream witch • A touch of magic",
  kael: "Fallen prince • Quiet strength",
  mira_time: "Time traveler • Tangled timelines",
  zenith: "Teacher • A curious mind",
  neo: "Builder • Code and curiosity",
  cipher: "Cyber shadow • Secrets and security",
  nyra: "Creative spark • A world of ideas",
  rishi: "Thoughtful guide • Grounded wisdom",
  pulse: "Straight talk • A different perspective",
  diya: "Delhi energy • Friendship and drama",
  arjun: "Quiet observer • Reflective moments",
  raven: "Bold spirit • Style and confidence",
  Creator_mode: "Creator mode • Sanu Sharma",
};

export const SUGGESTION_CHIPS = {
  default: ["Introduce me to the characters", "Help me pick a Shift", "Tell me about Shifts"],
  seven: ["What happened to Planet 000?", "Tell me about your mission", "How did you survive?"],
  virex: ["Tell me about your current life", "Where do you live?", "Analyze this problem"],
  noctra: ["Where do you live?", "I had a strange dream", "What is your story?"],
  kael: ["Tell me of your kingdom", "I need courage", "What honor demands"],
  mira_time: ["Tell me about your story", "Help me choose wisely", "Where do you live?"],
  zenith: ["Tell me about your daily life", "Teach me something new", "Quiz me on a topic"],
  neo: ["Tell me about your current life", "Debug this code", "Explain this algorithm"],
  cipher: ["What is your story?", "Teach me about security", "Explain encryption"],
  nyra: ["Tell me about your daily life", "Help brainstorm ideas", "Write something poetic"],
  rishi: ["Tell me about your daily life", "Help me find clarity", "A lesson for today"],
  pulse: ["Tell me about your story", "Give me a reality check", "Am I overthinking this?"],
  diya: ["Tumhari life mein kya chal raha hai?", "Tell me about your friends", "Bestie advice chahiye"],
  arjun: ["Tell me about your daily life", "Where do you live?", "Help me slow down"],
  raven: ["Tell me about your story", "Who are your friends?", "Hype me up"],
  Creator_mode: ["How was Shifts built?", "What's the tech stack?", "Tell me about the creator"],

};
