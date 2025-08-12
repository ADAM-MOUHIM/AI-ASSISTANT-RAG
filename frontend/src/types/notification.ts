// services/api/notifications.ts - Notifications API
import { BaseApiService } from './base';
import type { NotificationResponse } from './type';

class NotificationsApiService extends BaseApiService {
  async getNotifications(): Promise<NotificationResponse[]> {
    return this.request<NotificationResponse[]>('/notifications/');
  }

  async markAsRead(notificationId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async markAllAsRead(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/notifications/read-all', {
      method: 'POST',
    });
  }

  async deleteNotification(notificationId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }
}

export const notificationsApi = new NotificationsApiService();