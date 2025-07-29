import type { User } from '@/types/user';

export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  joinedAt: new Date(Date.now() - 86400000 * 30),
}; 