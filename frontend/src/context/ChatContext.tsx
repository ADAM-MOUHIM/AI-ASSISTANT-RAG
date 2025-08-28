import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { chatApi } from '@/types/chat'; // keep your existing API client

// Treat VITE_API_BASE as the FULL API root (already includes /api/v1)

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isStreaming?: boolean;
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
  streamingMessageId: string | null;
}

type ChatAction =
  | { type: 'LOAD_SESSIONS'; payload: ChatSession[] }
  | { type: 'LOAD_SESSION_MESSAGES'; payload: { sessionId: string; messages: Message[] } }
  | { type: 'CREATE_CHAT'; payload: ChatSession }
  | { type: 'SELECT_CHAT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: Message } }
  | { type: 'UPDATE_STREAMING_MESSAGE'; payload: { sessionId: string; messageId: string; content: string } }
  | { type: 'FINALIZE_STREAMING_MESSAGE'; payload: { sessionId: string; messageId: string; finalContent: string; finalId?: string } }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'UPDATE_TITLE'; payload: { sessionId: string; title: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_STREAMING_MESSAGE'; payload: string | null };

interface ChatContextType {
  state: ChatState;
  createNewChat: () => Promise<string>;
  selectChat: (sessionId: string) => Promise<void>;
  sendMessage: (content: string, sessionId?: string, stream?: boolean) => Promise<void>;
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
  streamingMessageId: null,
};

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
    case 'UPDATE_STREAMING_MESSAGE': {
      const { sessionId, messageId, content } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === sessionId ? {
            ...s,
            messages: s.messages.map(m =>
              m.id === messageId ? { ...m, content, isStreaming: true } : m
            )
          } : s
        ),
      };
    }
    case 'FINALIZE_STREAMING_MESSAGE': {
      const { sessionId, messageId, finalContent, finalId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === sessionId ? {
            ...s,
            messages: s.messages.map(m =>
              m.id === messageId ? { ...m, id: finalId || m.id, content: finalContent, isStreaming: false } : m
            )
          } : s
        ),
        streamingMessageId: null,
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
    case 'SET_STREAMING_MESSAGE':
      return { ...state, streamingMessageId: action.payload };
    default:
      return state;
  }
}

const ChatContext = createContext<ChatContextType | null>(null);

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

  // ---- STREAMING (uses API_ROOT directly; no PREFIX concatenation) ----
  const handleStreamingMessage = useCallback(async (
  content: string,
  targetSessionId: string
): Promise<void> => {
  // 1) show the user's message right away
  dispatch({
    type: 'ADD_MESSAGE',
    payload: {
      sessionId: targetSessionId,
      message: { id: `u-${Date.now()}`, content, role: 'user', timestamp: new Date() },
    },
  });

  // 2) add a temporary assistant message (streaming)
  const streamingMessageId = `a-${Date.now()}`;
  dispatch({
    type: 'ADD_MESSAGE',
    payload: {
      sessionId: targetSessionId,
      message: {
        id: streamingMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      },
    },
  });
  dispatch({ type: 'SET_STREAMING_MESSAGE', payload: streamingMessageId });

  // headers
  const token =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('access_token') || sessionStorage.getItem('access_token'))) || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Treat VITE_API_BASE as the FULL API root (already includes /api/v1)
  const base = (import.meta as any)?.env?.VITE_API_BASE || 'http://localhost:8000/api/v1';
  const streamSegment = (import.meta as any)?.env?.VITE_STREAM_PATH || 'stream';
  const mode = ((import.meta as any)?.env?.VITE_STREAM_MODE || 'param').toLowerCase();

  // pick ONE route shape (default: param)
  let streamUrl = `${base}/chat/sessions/${targetSessionId}/messages?stream=true`;
  if (mode === 'segment') streamUrl = `${base}/chat/sessions/${targetSessionId}/messages/${streamSegment}`;
  else if (mode === 'session') streamUrl = `${base}/chat/sessions/${targetSessionId}/stream`;
  else if (mode === 'off') streamUrl = '';

  const finalize = (finalContent: string, finalId?: string) => {
    dispatch({
      type: 'FINALIZE_STREAMING_MESSAGE',
      payload: {
        sessionId: targetSessionId,
        messageId: streamingMessageId,
        finalContent,
        finalId,
      },
    });
  };

  try {
    // No streaming? do normal send
    if (!streamUrl) {
      const resp: any = await chatApi.sendMessage(content, parseInt(targetSessionId, 10));
      finalize(resp?.answer ?? resp?.content ?? '', String(resp?.id ?? streamingMessageId));
      return;
    }

    // IMPORTANT: include stream:true in BODY (your backend checks the BODY, not just the query)
    const res = await fetch(streamUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ content, stream: true }),
    });

    if (!res.ok) {
      // fallback to non-stream
      const resp: any = await chatApi.sendMessage(content, parseInt(targetSessionId, 10));
      finalize(resp?.answer ?? resp?.content ?? '', String(resp?.id ?? streamingMessageId));
      return;
    }

    const ctype = res.headers.get('content-type') || '';

    // If server returned JSON (non-stream), finalize right away so the UI doesn't hang
    if (!ctype.includes('text/event-stream') || !res.body) {
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
      finalize((data?.answer ?? data?.content ?? '').toString(), String(data?.id ?? streamingMessageId));
      return;
    }

    // Stream SSE
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        // accept 'data:' with or without a space
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const data = JSON.parse(payload);
          if (typeof data?.content === 'string') {
            accumulated += data.content;
            dispatch({
              type: 'UPDATE_STREAMING_MESSAGE',
              payload: { sessionId: targetSessionId, messageId: streamingMessageId, content: accumulated },
            });
          }
          if (data?.type === 'assistant_complete' || data?.done === true) {
            finalize(data.content ?? accumulated, String(data.id ?? streamingMessageId));
          }
        } catch {
          // ignore malformed lines
        }
      }
    }

    // safety finalize if server never sent 'assistant_complete'
    finalize(accumulated);
  } catch (err) {
    console.error('Streaming failed:', err);
    dispatch({ type: 'SET_ERROR', payload: 'Failed to stream message' });
    finalize('Error: Failed to get response');
  } finally {
    dispatch({ type: 'SET_STREAMING_MESSAGE', payload: null });
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}, [state.sessions]);


  const sendMessage = useCallback(async (
    content: string,
    sessionId?: string,
    stream: boolean = false
  ) => {
    const targetSessionId = sessionId || state.currentSessionId;
    if (!targetSessionId) {
      dispatch({ type: 'SET_ERROR', payload: 'No active session' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    if (stream) {
      await handleStreamingMessage(content, targetSessionId);
      return;
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId: targetSessionId, message: userMessage } });

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
  }, [state.currentSessionId, state.sessions, handleStreamingMessage]);

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

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
