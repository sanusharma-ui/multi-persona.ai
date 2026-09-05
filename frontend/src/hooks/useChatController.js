import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import useConversations from "./useConversations";
import useChatRequests from "./useChatRequests";
import { readPreference, writePreference } from "../lib/preferences";
import { fallbackPersonaList, personaAvatars } from "../data/shifts";
import { backendUrl } from "../lib/config";

export default function useChatController() {
  const [hasAgreed, setHasAgreed] = useState(
    () => readPreference("ai-agreement-accepted") === "true",
  );
  const history = useConversations();
  const { messages } = history;
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const [composerError, setComposerError] = useState("");
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(
    () => readPreference("darkMode") === "true",
  );
  const [selectedPersona, setSelectedPersona] = useState(
    readPreference("selectedPersona") || "default",
  );
  const [personaList, setPersonaList] = useState({});

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCouncilMode, setIsCouncilMode] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    () => readPreference("shifts-onboarding-complete") !== "true",
  );

  const uploadVersion = useRef(0);

  const selectedLanguage = "en";

  const getOrCreateUserId = () => {
    let uid = readPreference("mpai_uid");
    if (!uid) {
      uid =
        globalThis.crypto?.randomUUID?.() ||
        `uid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      writePreference("mpai_uid", uid);
    }
    return uid;
  };
  const [userId] = useState(getOrCreateUserId);
  const requests = useChatRequests({ history, backendUrl, userId, language: selectedLanguage });
  const { loading } = requests;
  const isStreaming = messages.some((message) => message.isTyping);
  const currentPersonaName = personaList[selectedPersona] || fallbackPersonaList[selectedPersona] || fallbackPersonaList.default;
  const coldStart = loading && !isStreaming && messages.some((m) => m.pending) && messages.filter((m) => m.role === "user").length === 1;

  const PERSONAS = useMemo(() => {
    const source = Object.keys(personaList).length ? personaList : fallbackPersonaList;
    return Object.keys(source).map((key) => ({ key, label: source[key] }));
  }, [personaList]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(backendUrl + "/modes/list", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load Shifts");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setPersonaList(data?.modes || fallbackPersonaList);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPersonaList(fallbackPersonaList);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    writePreference("darkMode", String(isDarkMode));
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    writePreference("selectedPersona", selectedPersona);
  }, [selectedPersona]);

  const currentAvatar =
    personaAvatars[selectedPersona] || personaAvatars.default;

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++uploadVersion.current;

    setImagePreview(null);
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setComposerError("Choose a JPEG, PNG, GIF or WebP image up to 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (uploadVersion.current !== version) return;

      setImagePreview(reader.result);
      setComposerError("");
    };
    reader.onerror = () => setComposerError("Could not read this image. Please choose it again.");
    reader.readAsDataURL(file);
  };

  const stopResponse = requests.stop;

  const changeConversation = (action) => {
    stopResponse();
    uploadVersion.current += 1;

    setImagePreview(null);
    setInput("");
    setComposerError("");
    action();
    setHistoryOpen(false);
  };

  const clearChat = () => {
    if (window.confirm("Clear this conversation and start with fresh AI context? This cannot be undone.")) {
      changeConversation(history.clear);
    }
  };

  const chooseShift = (key) => {
    stopResponse();
    setSelectedPersona(key);
  };

  const completeOnboarding = (shiftKey) => {
    if (shiftKey) setSelectedPersona(shiftKey);
    writePreference("shifts-onboarding-complete", "true");
    setIsOnboardingOpen(false);
  };

  const sendMessage = (override) => {
    const text = typeof override === "string" ? override.trim() : input.trim();
    if ((!text && !imagePreview) || loading) return;
    if (text.length > 2000) {
      setComposerError("Keep your message within 2,000 characters.");
      return;
    }
    const preferred = ["neo", "rishi", "nyra"].filter((key) => PERSONAS.some((p) => p.key === key));
    const members = isCouncilMode && !imagePreview
      ? (preferred.length === 3 ? preferred : PERSONAS.slice(0, 3).map((p) => p.key))
      : [selectedPersona];
    requests.send({ text, preview: imagePreview, members });
    uploadVersion.current += 1;
    setInput("");

    setImagePreview(null);
    setComposerError("");
  };

  const regenerateLast = () => {
    const lastReply = [...messages].reverse().find((m) => m.role === "assistant" && m.request);
    if (lastReply) requests.send({ ...lastReply.request, retryId: lastReply.id });
  };

  const handleAgree = () => {
    writePreference("ai-agreement-accepted", "true");
    setHasAgreed(true);
  };

  const onRemoveImage = () => {
    uploadVersion.current += 1;
    setImagePreview(null);
  };

  return {
    hasAgreed, handleAgree, isOnboardingOpen, completeOnboarding,
    history, messages, historyOpen, setHistoryOpen, closeHistory,
    composerError, input, setInput, imagePreview, onRemoveImage,
    isDarkMode, setIsDarkMode, selectedPersona, currentPersonaName, currentAvatar,
    personaList, PERSONAS, isGalleryOpen, setIsGalleryOpen, isCouncilMode, setIsCouncilMode,
    loading, isStreaming, coldStart, handleImageUpload, stopResponse,
    changeConversation, clearChat, chooseShift, sendMessage, regenerateLast,
    retryMessage: (message) => requests.send({ ...message.request, retryId: message.id }),
  };

}
