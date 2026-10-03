import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import useConversations from "./useConversations";
import useChatRequests from "./useChatRequests";
import { readPreference, writePreference } from "../lib/preferences";
import { fallbackPersonaList, personaAvatars } from "../data/shifts";
import { backendUrl } from "../lib/config";
import { ASSISTANT_INPUT_LIMIT } from "../lib/assistantContext";

export default function useChatController(userId) {
  const [hasAgreed, setHasAgreed] = useState(
    () => readPreference("ai-agreement-accepted") === "true",
  );
  const history = useConversations(userId);
  const { messages } = history;
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const [composerError, setComposerError] = useState("");
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(
    () => readPreference("darkMode") === "true",
  );
  const isAssistant = history.active.mode === "assistant";
  const selectedPersona = isAssistant ? "assistant" : history.active.persona;
  const setSelectedPersona = history.setPersona;
  const [personaList, setPersonaList] = useState({});

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [councilEnabled, setIsCouncilMode] = useState(false);
  const isCouncilMode = !isAssistant && councilEnabled;
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    () => readPreference("shifts-onboarding-complete") !== "true",
  );

  const uploadVersion = useRef(0);

  const selectedLanguage = "en";

  const requests = useChatRequests({ history, backendUrl, userId, language: selectedLanguage });
  const { loading } = requests;
  const isStreaming = messages.some((message) => message.isTyping);
  const currentPersonaName = isAssistant ? "Assistant" : personaList[selectedPersona] || fallbackPersonaList[selectedPersona] || fallbackPersonaList.default;
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
    if (selectedPersona !== "assistant") writePreference("selectedPersona", selectedPersona);
  }, [selectedPersona]);

  const currentAvatar =
    isAssistant ? "✦" : personaAvatars[selectedPersona] || personaAvatars.default;

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
    if (!history.flush()) return false;
    uploadVersion.current += 1;

    setImagePreview(null);
    setInput("");
    setComposerError("");
    action();
    setHistoryOpen(false);
    return true;
  };

  const clearChat = () => {
    if (window.confirm("Clear this conversation and start with fresh AI context? This cannot be undone.")) {
      changeConversation(history.clear);
    }
  };

  const switchMode = () => {
    if (isAssistant) {
      changeConversation(() => history.resumeMode("personas", readPreference("selectedPersona") || "default"));
      return;
    }
    setPendingSwitch({ mode: "assistant", title: "Switch to Chatbot?" });
  };
  const selectConversation = (id) => {
    const target = history.chats.find((conversation) => conversation.id === id);
    if (!target || id === history.active.id) return;
    if (!isAssistant && target.mode === "assistant") {
      setPendingSwitch({ id, title: "Open this saved chat?" });
      return;
    }
    changeConversation(() => history.select(id));
  };

  const chooseShift = (key) => {
    if (!isAssistant && key === selectedPersona) return;
    if (isAssistant) {
      if (!changeConversation(() => history.resumeMode("personas", key))) return;
    } else {
      stopResponse();
      if (!history.flush()) return;
    }
    history.setPersona(key);
    setIsGalleryOpen(false);
  };

  const cancelSwitch = () => setPendingSwitch(null);
  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    changeConversation(() => pendingSwitch.id
      ? history.select(pendingSwitch.id)
      : history.resumeMode(pendingSwitch.mode));
    setPendingSwitch(null);
    setIsGalleryOpen(false);
  };

  const completeOnboarding = (shiftKey) => {
    if (shiftKey) setSelectedPersona(shiftKey);
    writePreference("shifts-onboarding-complete", "true");
    setIsOnboardingOpen(false);
  };

  const sendMessage = (override) => {
    const text = typeof override === "string" ? override.trim() : input.trim();
    if ((!text && !imagePreview) || loading) return;
    const limit = isAssistant ? ASSISTANT_INPUT_LIMIT : 2000;
    if (text.length > limit) {
      setComposerError(`Keep your message within ${limit.toLocaleString("en-US")} characters.`);
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

  const retryMessage = (message) => {
    // Preserve later conversation turns when retrying an older failed question.
    const index = messages.findIndex((entry) => entry.id === message.id);
    const hasLaterQuestion = messages.slice(index + 1).some((entry) => entry.role === "user");
    requests.send({ ...message.request, retryId: isAssistant && hasLaterQuestion ? null : message.id });
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
    isAssistant, switchMode, selectConversation,
    pendingSwitch, cancelSwitch, confirmSwitch,
    retryMessage,
  };

}
