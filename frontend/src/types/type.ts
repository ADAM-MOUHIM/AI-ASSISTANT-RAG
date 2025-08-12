// services/api/types.ts - All API types
export interface QueryRequest {
  question: string;
  conversation_id?: number;
}

export interface QueryResponse {
  answer: string;
  conversation_id: number;
  timestamp: string;
}

export interface ConversationResponse {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface MessageResponse {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
}

export interface ConversationDetail {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: MessageResponse[];
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  total_conversations: number;
  total_messages: number;
  joined_date: string;
}

export interface NotificationResponse {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  created_at: string;
}