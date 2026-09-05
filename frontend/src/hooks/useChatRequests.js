import { useEffect, useRef, useState } from "react";
import { newId } from "./useConversations";
import { revealResponse } from "../lib/revealResponse";

export default function useChatRequests({ history, backendUrl, userId, language }) {
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef(null);
  const stop = () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    history.setMessages((prev) => prev.map((m) => m.pending || m.isTyping
      ? { ...m, pending: false, isTyping: false, stopped: true, failed: true,
          content: m.isTyping && m.content ? m.content : "Response stopped. You can retry." } : m));
  };
  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  const send = async ({ text, preview = null, members, retryId = null }) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const context = history.active.context;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const council = members.length > 1 || history.messages.find((m) => m.id === retryId)?.council;
    const replies = members.map((persona) => ({
      id: retryId || newId(), role: "assistant", persona, council, pending: true,
      content: "Thinking…", timestamp, request: { text, preview, members: [persona] },
    }));
    history.setMessages((prev) => retryId
      ? prev.map((m) => m.id === retryId ? replies[0] : m)
      : [...prev, { id: newId(), role: "user", content: text || "Sent an image.", image: preview, timestamp }, ...replies]);
    setLoading(true);
    try {
      await Promise.allSettled(replies.map(async (reply) => {
        const memberController = new AbortController();
        const cancelMember = () => memberController.abort();
        controller.signal.addEventListener("abort", cancelMember, { once: true });
        if (controller.signal.aborted) cancelMember();
        const timer = setTimeout(cancelMember, 120000);
        try {
          const headers = { "x-user-id": userId, "x-conversation-id": context };
          let body;
          let path;
          if (preview) {
            const blob = await (await fetch(preview)).blob();
            body = new FormData();
            body.append("file", blob, "image");
            body.append("message", text);
            body.append("language", language);
            path = "/chat/image?mode=" + encodeURIComponent(reply.persona);
          } else {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify({ message: text, language });
            path = "/chat?mode=" + encodeURIComponent(reply.persona);
          }
          const response = await fetch(backendUrl + path, { method: "POST", headers, body, signal: memberController.signal });
          const data = await response.json().catch(() => ({}));
          clearTimeout(timer);
          if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed (" + response.status + "). Please retry.");
          if (!data.reply) throw new Error("No response received. Please retry.");
          if (activeRequest.current !== controller) return;
          await revealResponse(String(data.reply), memberController.signal, (content) => {
            if (activeRequest.current !== controller) return;
            history.setMessages((prev) => prev.map((m) => m.id === reply.id
              ? { ...m, pending: false, isTyping: true, failed: false, content } : m), { persist: false });
          });
          if (activeRequest.current !== controller) return;
          if (memberController.signal.aborted) throw new DOMException("Response timed out", "AbortError");
          history.setMessages((prev) => prev.map((m) => m.id === reply.id
            ? { ...m, pending: false, isTyping: false, failed: false, content: String(data.reply) } : m));
        } catch (error) {
          if (activeRequest.current !== controller) return;
          const content = error.name === "AbortError"
            ? "The response took too long. Please retry."
            : error.message === "Failed to fetch" ? "Connection failed. Check your connection and retry." : error.message;
          history.setMessages((prev) => prev.map((m) => m.id === reply.id
            ? { ...m, pending: false, isTyping: false, failed: true, content } : m));
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", cancelMember);
        }
      }));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };
  return { loading, send, stop };
}
