import useChatController from "./hooks/useChatController";
import { personaAvatars } from "./data/shifts";
import AgreementPopup from "./components/onboarding/AgreementPopup";
import WelcomeOnboarding from "./components/onboarding/WelcomeOnboarding";
import ShiftGallery from "./components/shifts/ShiftGallery";
import ConversationHistory from "./components/history/ConversationHistory";
import ChatHeader from "./components/chat/ChatHeader";
import ChatMessages from "./components/chat/ChatMessages";
import ChatComposer from "./components/chat/ChatComposer";
import FeedbackLink from "./components/layout/FeedbackLink";

export default function App() {
  const chat = useChatController();
  if (!chat.hasAgreed) return <AgreementPopup onAgree={chat.handleAgree} />;
  if (chat.isOnboardingOpen) return (
    <WelcomeOnboarding shifts={chat.PERSONAS} avatars={personaAvatars}
      onChoose={chat.completeOnboarding} onExplore={() => chat.completeOnboarding()} />
  );

  return (
    <div className={`app ${chat.isDarkMode ? "dark" : ""} persona-${chat.selectedPersona}`}>
      <ChatHeader currentAvatar={chat.currentAvatar} currentPersonaName={chat.currentPersonaName}
        setHistoryOpen={chat.setHistoryOpen} setIsGalleryOpen={chat.setIsGalleryOpen}
        clearChat={chat.clearChat} isDarkMode={chat.isDarkMode} setIsDarkMode={chat.setIsDarkMode} />
      {chat.historyOpen && <ConversationHistory history={chat.history} onClose={chat.closeHistory} onAction={chat.changeConversation} />}
      {chat.isGalleryOpen && <ShiftGallery shifts={chat.PERSONAS} selectedShift={chat.selectedPersona}
        avatars={personaAvatars} onSelect={chat.chooseShift} onClose={() => chat.setIsGalleryOpen(false)} />}
      <ChatMessages messages={chat.messages} conversationId={chat.history.active.context}
        selectedPersona={chat.selectedPersona} currentAvatar={chat.currentAvatar}
        currentPersonaName={chat.currentPersonaName} personaList={chat.personaList}
        coldStart={chat.coldStart} loading={chat.loading} onExplore={() => chat.setIsGalleryOpen(true)}
        sendMessage={chat.sendMessage} retryMessage={chat.retryMessage} />
      <ChatComposer composerError={chat.composerError} storageError={chat.history.storageError}
        isCouncilMode={chat.isCouncilMode} setIsCouncilMode={chat.setIsCouncilMode}
        loading={chat.loading} isStreaming={chat.isStreaming} regenerateLast={chat.regenerateLast}
        canRegenerate={chat.messages.some((message) => message.request)} stopResponse={chat.stopResponse}
        imagePreview={chat.imagePreview} onRemoveImage={chat.onRemoveImage} handleImageUpload={chat.handleImageUpload}
        input={chat.input} setInput={chat.setInput} sendMessage={chat.sendMessage} currentPersonaName={chat.currentPersonaName} />
      <FeedbackLink />
    </div>
  );
}
