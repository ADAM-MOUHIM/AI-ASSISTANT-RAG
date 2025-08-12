// services/api.ts - Updated for Vite
// Vite uses VITE_ prefix instead of NEXT_PUBLIC_
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

console.log('API_BASE_URL:', API_BASE_URL); // Debug log

// ===== Types (align with your FastAPI models) =====
export interface QueryRequest {
  question: string;
  conversation_id?: number;
}

export interface QueryResponse {
  answer: string;
  conversation_id: number;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export type Role = 'user' | 'assistant';

export interface Message {
  id: number;
  role: Role;
  content: string;
  created_at: string;
}

export interface CreateMessagePayload {
  content: string;
  role?: Role; // backend defaults to "user" if omitted
  attachments?: unknown[];
  metadata?: Record<string, unknown>;
}

// ===== API Service =====
class ApiService {
  private baseUrl = API_BASE_URL;

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Merge headers safely (FIX: spread instead of ".options")
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    // Add JSON Content-Type by default if body is plain (not FormData)
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    // Attach token from storage if present
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
      (typeof window !== 'undefined' && sessionStorage.getItem('access_token'));
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,            // <-- FIX: was ".options"
      headers,               // <-- merged headers
      // credentials: 'include', // enable if you switch to auth cookies
    };

    const response = await fetch(url, config);

    // No Content
    if (response.status === 204) return undefined as unknown as T;

    // Error surface
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    // Parse JSON if present
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await response.text();
      return text as unknown as T;
    }
    return (await response.json()) as T;
  }

  // ===== General endpoints =====

  // Example Q&A endpoint (keep if you have /query)
  async ask(data: QueryRequest) {
    return this.request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== Chat: Sessions =====

  // Create a new conversation (FIX: backend route must exist)
  async createNewConversation(title?: string) {
    const body = title ? { title } : {};
    return this.request<Conversation>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // List user conversations
  async getConversations() {
    return this.request<Conversation[]>('/chat/sessions');
  }

  // Rename a conversation
  async updateConversationTitle(conversationId: number, title: string) {
    return this.request<Conversation>(`/chat/sessions/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  // Delete a conversation
  async deleteConversation(conversationId: number) {
    return this.request<void>(`/chat/sessions/${conversationId}`, {
      method: 'DELETE',
    });
  }

  // ===== Chat: Messages =====

  // Get all messages for a session
  async getConversationMessages(conversationId: number) {
  const arr = await this.request<Message[]>(`/chat/sessions/${conversationId}/messages`);
  return { messages: arr }; 
}

  // Send a message in a session
  async sendMessage(conversationId: number, payload: CreateMessagePayload) {
    if (!payload?.content || !payload.content.trim()) {
      throw new Error('Message content is required.');
    }
    return this.request<Message>(`/chat/sessions/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ===== Users / Misc (adjust if you have them) =====

  async getUserStats() {
    return this.request('/users/stats');
  }

  async getNotifications() {
    return this.request('/notifications/');
  }
}

export const apiService = new ApiService();
