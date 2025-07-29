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

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
}

export interface ChatContextType {
  state: ChatState;
  createNewChat: () => string;
  selectChat: (sessionId: string) => void;
  sendMessage: (content: string, sessionId?: string) => Promise<void>;
  deleteChat: (sessionId: string) => void;
  updateChatTitle: (sessionId: string, title: string) => void;
  getCurrentSession: () => ChatSession | null;
} 