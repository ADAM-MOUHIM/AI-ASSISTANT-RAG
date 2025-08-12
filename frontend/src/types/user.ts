// services/api/user.ts - User-related API calls
import { BaseApiService } from './base';
import type { UserProfile, UserStats } from './type';




export interface User {
  id: number | string;
  email: string | null;
  // add these
  username?: string | null;
  name?: string | null;

  role?: 'admin' | 'user' | string;
  avatar_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

class UserApiService extends BaseApiService {
  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/profile');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getStats(): Promise<UserStats> {
    return this.request<UserStats>('/users/stats');
  }

  async deleteAccount(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/users/account', {
      method: 'DELETE',
    });
  }
}

export const userApi = new UserApiService();
