export const backendUrl = import.meta.env.VITE_API_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:8000"
    : "https://groqchatbot-xoiv.onrender.com");
