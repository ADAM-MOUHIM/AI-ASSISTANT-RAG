import { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ChatState, ChatSession, Message, ChatContextType } from '@/types/chat';
import { sampleChatSessions } from '@/data/sampleChats';

// Initial state with sample chat sessions
const initialState: ChatState = {
  sessions: sampleChatSessions,
  currentSessionId: 'default',
  isLoading: false,
};

// Action types
type ChatAction =
  | { type: 'CREATE_CHAT'; payload: ChatSession }
  | { type: 'SELECT_CHAT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: Message } }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'UPDATE_TITLE'; payload: { sessionId: string; title: string } }
  | { type: 'SET_LOADING'; payload: boolean };

// Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'CREATE_CHAT':
      return {
        ...state,
        sessions: [action.payload, ...state.sessions],
        currentSessionId: action.payload.id,
      };

    case 'SELECT_CHAT':
      return {
        ...state,
        currentSessionId: action.payload,
      };

    case 'ADD_MESSAGE': {
      const { sessionId, message } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                messages: [...session.messages, message],
                updatedAt: new Date(),
              }
            : session
        ),
      };
    }

    case 'DELETE_CHAT': {
      const newSessions = state.sessions.filter(s => s.id !== action.payload);
      const newCurrentId = state.currentSessionId === action.payload
        ? newSessions[0]?.id || null
        : state.currentSessionId;
      
      return {
        ...state,
        sessions: newSessions,
        currentSessionId: newCurrentId,
      };
    }

    case 'UPDATE_TITLE':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.sessionId
            ? { ...session, title: action.payload.title }
            : session
        ),
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}

// Context
const ChatContext = createContext<ChatContextType | null>(null);

// Provider component
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const createNewChat = useCallback((): string => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    dispatch({ type: 'CREATE_CHAT', payload: newSession });
    return newSession.id;
  }, []);

  const selectChat = useCallback((sessionId: string) => {
    dispatch({ type: 'SELECT_CHAT', payload: sessionId });
  }, []);

  const sendMessage = useCallback(async (content: string, sessionId?: string) => {
    const targetSessionId = sessionId || state.currentSessionId;
    if (!targetSessionId) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId: targetSessionId, message: userMessage } });
    dispatch({ type: 'SET_LOADING', payload: true });

    // Update chat title if it's the first message
    const session = state.sessions.find(s => s.id === targetSessionId);
    if (session && session.messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      dispatch({ type: 'UPDATE_TITLE', payload: { sessionId: targetSessionId, title } });
    }

    // Simulate AI response
    try {
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: generateMockResponse(content),
        role: 'assistant',
        timestamp: new Date(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: { sessionId: targetSessionId, message: aiResponse } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentSessionId, state.sessions]);

  const deleteChat = useCallback((sessionId: string) => {
    dispatch({ type: 'DELETE_CHAT', payload: sessionId });
  }, []);

  const updateChatTitle = useCallback((sessionId: string, title: string) => {
    dispatch({ type: 'UPDATE_TITLE', payload: { sessionId, title } });
  }, []);

  const getCurrentSession = useCallback((): ChatSession | null => {
    return state.sessions.find(s => s.id === state.currentSessionId) || null;
  }, [state.sessions, state.currentSessionId]);

  const contextValue: ChatContextType = {
    state,
    createNewChat,
    selectChat,
    sendMessage,
    deleteChat,
    updateChatTitle,
    getCurrentSession,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// Hook
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Mock response generator
function generateMockResponse(userInput: string): string {
  const responses = [
    "That's a great question! Let me help you with that. " + 
    "Based on what you've asked, I'd recommend considering a few different approaches...",
    
    "I understand what you're looking for. Here's my take on this:\n\n" +
    "The key thing to remember is that every situation is unique, and the best solution " +
    "often depends on your specific requirements and constraints.",
    
    "Interesting perspective! I think there are several ways to approach this:\n\n" +
    "1. **First approach**: This would work well if you need something quick and simple\n" +
    "2. **Alternative approach**: This might be better for more complex scenarios\n" +
    "3. **Long-term solution**: Consider this if you're planning for scalability\n\n" +
    "Which of these resonates most with your current needs?",
    
    "Thanks for sharing that with me. I can definitely help you work through this. " +
    "Let me break this down into manageable steps that should make everything clearer.",
    
    "That's a really thoughtful question. In my experience, the best approach here would be to " +
    "start with the fundamentals and then build up from there. What specific aspect would you " +
    "like to dive deeper into?"
  ];

  return responses[Math.floor(Math.random() * responses.length)];
} 