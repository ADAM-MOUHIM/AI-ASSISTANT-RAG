// src/services/api/chat.ts
import { BaseApiService } from './base';

export interface ConversationResponse {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}
export interface MessageResponse {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

class ChatApiService extends BaseApiService {
  // Sessions
  async getConversations(): Promise<ConversationResponse[]> {
    return this.request('/chat/sessions');
  }

  async createNewConversation(title?: string): Promise<ConversationResponse> {
    return this.request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    });
  }

  async deleteConversation(conversationId: number) {
    return this.request(`/chat/sessions/${conversationId}`, { method: 'DELETE' });
  }

  async updateConversationTitle(conversationId: number, title: string): Promise<ConversationResponse> {
    return this.request(`/chat/sessions/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  // Messages
  async getConversation(conversationId: number): Promise<MessageResponse[]> {
    // Backend returns an ARRAY of messages
    return this.request(`/chat/sessions/${conversationId}/messages`);
  }

  async sendMessage(question: string, conversationId: number) {
    // Backend expects { content }
    return this.request(`/chat/sessions/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: question }),
    });
  }
}

export const chatApi = new ChatApiService();
