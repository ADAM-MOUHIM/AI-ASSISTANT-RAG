// src/context/ChatContext.tsx
import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { chatApi } from '@/types/chat';

// ===== Frontend types =====
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

type ChatAction =
  | { type: 'LOAD_SESSIONS'; payload: ChatSession[] }
  | { type: 'LOAD_SESSION_MESSAGES'; payload: { sessionId: string; messages: Message[] } }
  | { type: 'CREATE_CHAT'; payload: ChatSession }
  | { type: 'SELECT_CHAT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: Message } }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'UPDATE_TITLE'; payload: { sessionId: string; title: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

interface ChatContextType {
  state: ChatState;
  createNewChat: () => Promise<string>;
  selectChat: (sessionId: string) => Promise<void>;
  sendMessage: (content: string, sessionId?: string) => Promise<void>;
  deleteChat: (sessionId: string) => Promise<void>;
  updateChatTitle: (sessionId: string, title: string) => void;
  getCurrentSession: () => ChatSession | null;
  clearError: () => void;
}

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,
};

// ===== Mappers (assume snake_case from backend) =====
function convertApiSessionToFrontend(api: any): ChatSession {
  return {
    id: String(api.id),
    title: api.title || 'New Chat',
    messages: [],
    createdAt: new Date(api.created_at),
    updatedAt: new Date(api.updated_at),
  };
}

function convertApiMessageToFrontend(api: any): Message {
  return {
    id: String(api.id),
    content: api.content ?? api.text ?? '',
    role: api.role,
    timestamp: new Date(api.created_at ?? api.createdAt ?? Date.now()),
  };
}

// ===== Reducer =====
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'LOAD_SESSIONS':
      return {
        ...state,
        sessions: action.payload,
        currentSessionId: state.currentSessionId || action.payload[0]?.id || null,
        error: null,
      };

    case 'LOAD_SESSION_MESSAGES': {
      const { sessionId, messages } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, messages: [...messages] } : s
        ),
      };
    }

    case 'CREATE_CHAT':
      return {
        ...state,
        sessions: [action.payload, ...state.sessions],
        currentSessionId: action.payload.id,
        error: null,
      };

    case 'SELECT_CHAT':
      return { ...state, currentSessionId: action.payload, error: null };

    case 'ADD_MESSAGE': {
      const { sessionId, message } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, messages: [...s.messages, message], updatedAt: new Date() } : s
        ),
      };
    }

    case 'DELETE_CHAT':
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.payload),
        currentSessionId:
          state.currentSessionId === action.payload ? null : state.currentSessionId,
      };

    case 'UPDATE_TITLE':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId ? { ...s, title: action.payload.title } : s
        ),
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    default:
      return state;
  }
}

// ===== Context =====
const ChatContext = createContext<ChatContextType | null>(null);

// ===== Provider =====
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const apiSessions = await chatApi.getConversations();
      const arr = Array.isArray(apiSessions) ? apiSessions : [];
      const sessions = arr.map(convertApiSessionToFrontend);
      dispatch({ type: 'LOAD_SESSIONS', payload: sessions });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load conversations' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Only load after auth token exists
  useEffect(() => {
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
      (typeof window !== 'undefined' && sessionStorage.getItem('access_token'));
    if (!token) return;
    loadConversations();
  }, [loadConversations]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const apiResult = await chatApi.getConversation(parseInt(sessionId, 10));
      const raw = Array.isArray(apiResult) ? apiResult : (apiResult as any)?.messages ?? [];
      const messages = raw.map(convertApiMessageToFrontend);
      dispatch({ type: 'LOAD_SESSION_MESSAGES', payload: { sessionId, messages } });
    } catch (error) {
      console.error('Failed to load session messages:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load messages' });
      dispatch({ type: 'LOAD_SESSION_MESSAGES', payload: { sessionId, messages: [] } });
    }
  }, []);

  const createNewChat = useCallback(async (): Promise<string> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const apiSession = await chatApi.createNewConversation();
      const newSession = convertApiSessionToFrontend(apiSession);
      dispatch({ type: 'CREATE_CHAT', payload: newSession });
      return newSession.id;
    } catch (error) {
      console.error('Failed to create new chat:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create new chat' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const selectChat = useCallback(async (sessionId: string) => {
    dispatch({ type: 'SELECT_CHAT', payload: sessionId });
    const session = state.sessions.find(s => s.id === sessionId);
    if (session && session.messages.length === 0) {
      await loadSessionMessages(sessionId);
    }
  }, [state.sessions, loadSessionMessages]);

  const sendMessage = useCallback(async (content: string, sessionId?: string) => {
    const targetSessionId = sessionId || state.currentSessionId;
    if (!targetSessionId) {
      dispatch({ type: 'SET_ERROR', payload: 'No active session' });
      return;
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId: targetSessionId, message: userMessage } });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: any = await chatApi.sendMessage(content, parseInt(targetSessionId, 10));
      const aiContent = response?.answer ?? response?.content ?? '';
      const aiTs = response?.timestamp ?? response?.created_at ?? new Date().toISOString();

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: aiContent,
        role: 'assistant',
        timestamp: new Date(aiTs),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: { sessionId: targetSessionId, message: aiMessage } });

      const session = state.sessions.find(s => s.id === targetSessionId);
      if (session && session.messages.length <= 2) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        dispatch({ type: 'UPDATE_TITLE', payload: { sessionId: targetSessionId, title } });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send message' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentSessionId, state.sessions]);

  const deleteChat = useCallback(async (sessionId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await chatApi.deleteConversation(parseInt(sessionId, 10));
      dispatch({ type: 'DELETE_CHAT', payload: sessionId });
    } catch (error) {
      console.error('Failed to delete chat:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete chat' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
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
    clearError,
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
}

// ===== Hook =====
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
