import { chatApi } from './chat';
import { notificationsApi } from './notification';
import { userApi } from './user';

export * from './type';
export { chatApi } from './chat';
export { userApi } from './user';
export { notificationsApi } from './notification';

export const apiService = {
  // Chat methods
  sendMessage: chatApi.sendMessage.bind(chatApi),
  getConversations: chatApi.getConversations.bind(chatApi),
  getConversation: chatApi.getConversation.bind(chatApi),
  createNewConversation: chatApi.createNewConversation.bind(chatApi),
  deleteConversation: chatApi.deleteConversation.bind(chatApi),
  // User methods
  getUserProfile: userApi.getProfile.bind(userApi),
  updateUserProfile: userApi.updateProfile.bind(userApi),
  getUserStats: userApi.getStats.bind(userApi),

  // Notification methods
  getNotifications: notificationsApi.getNotifications.bind(notificationsApi),
};
