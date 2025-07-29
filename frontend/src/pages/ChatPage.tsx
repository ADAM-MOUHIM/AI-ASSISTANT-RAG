import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatInput } from '@/components/chat/ChatInput';
import { useChat } from '@/context/ChatContext';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { state, selectChat, sendMessage, getCurrentSession } = useChat();

  // Select the chat when the route changes
  useEffect(() => {
    if (chatId) {
      const session = state.sessions.find(s => s.id === chatId);
      if (session) {
        selectChat(chatId);
      } else {
        // Chat doesn't exist, redirect to first available chat or home
        if (state.sessions.length > 0) {
          navigate(`/chats/${state.sessions[0].id}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    }
  }, [chatId, state.sessions, selectChat, navigate]);

  const currentSession = getCurrentSession();
  
  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-xl font-semibold text-muted-foreground">
            No chat selected
          </div>
          <div className="text-sm text-muted-foreground">
            Select a chat from the sidebar or create a new one
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ChatContainer 
        messages={currentSession.messages} 
        isLoading={state.isLoading} 
      />
      
      {/* Input Area */}
      <ChatInput 
        onSendMessage={(content) => sendMessage(content, currentSession.id)}
        disabled={state.isLoading}
        placeholder="Ask me anything..."
      />
    </div>
  );
} 