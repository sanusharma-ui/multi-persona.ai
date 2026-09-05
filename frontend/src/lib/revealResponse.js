// Restore the original word-by-word reveal without changing the backend protocol.
function pause(milliseconds, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function revealResponse(text, signal, onProgress) {
  if (signal.aborted) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    onProgress(text);
    return;
  }
  const words = text.split(/(\s+)/);
  let visible = "";
  for (const word of words) {
    if (signal.aborted) return;
    visible += word;
    onProgress(visible);
    await pause(word.trim() ? 20 : 5, signal);
  }
}
