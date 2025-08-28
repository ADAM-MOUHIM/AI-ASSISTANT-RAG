// ChatPage.tsx  (full component shown for easy paste)
import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatInput } from '@/components/chat/ChatInput';
import { useChat } from '@/context/ChatContext';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { state, selectChat, sendMessage, getCurrentSession } = useChat();

  useEffect(() => {
    if (!chatId) return;
    const session = state.sessions.find((s) => s.id === chatId);
    if (session) {
      selectChat(chatId);
    } else {
      if (state.sessions.length > 0) {
        navigate(`/chats/${state.sessions[0].id}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [chatId, state.sessions, selectChat, navigate]);

  const currentSession = getCurrentSession();

  // Keep input disabled while loading/streaming...
  const isBusy = useMemo(
    () => state.isLoading || Boolean(state.streamingMessageId),
    [state.isLoading, state.streamingMessageId]
  );

  // ...but DO NOT show the "AI is thinking..." bubble during streaming
  const showThinkingInList = useMemo(
    () => state.isLoading && !state.streamingMessageId,
    [state.isLoading, state.streamingMessageId]
  );

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-xl font-semibold text-muted-foreground">No chat selected</div>
          <div className="text-sm text-muted-foreground">Select a chat from the sidebar or create a new one</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ChatContainer
        messages={currentSession.messages}
        isLoading={showThinkingInList} // ✅ hides the "AI is thinking..." bubble while streaming
      />

      {/* Input */}
      <ChatInput
        onSendMessage={(content) => sendMessage(content, currentSession.id, true)}
        disabled={isBusy}
        placeholder={isBusy ? 'Assistant is responding…' : 'Ask me anything...'}
      />
    </div>
  );
}
