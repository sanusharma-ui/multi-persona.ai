export function readPreference(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

export function writePreference(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* Preferences remain available in React state for this visit. */ }
}
