// contexts/AuthContext.tsx (renamed from UserContext)
import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { notificationsApi, userApi } from '@/types/';
import type { UserProfile, UserStats, NotificationResponse } from '@/types/type';

// Frontend user types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user'; // Made more specific for useRole compatibility
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  stats: UserStats | null;
  notifications: NotificationResponse[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean; // Added for useRole compatibility
  error: string | null;
}

export interface AuthContextType {
  state: AuthState;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  loadUserData: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: number) => Promise<void>;
  clearError: () => void;
  // Additional properties for useRole compatibility
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// Initial state
const initialState: AuthState = {
  user: null,
  stats: null,
  notifications: [],
  isLoading: false,
  isAuthenticated: false,
  isAdmin: false,
  error: null,
};

// Action types
type AuthAction =
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_STATS'; payload: UserStats }
  | { type: 'SET_NOTIFICATIONS'; payload: NotificationResponse[] }
  | { type: 'UPDATE_NOTIFICATION'; payload: { id: number; updates: Partial<NotificationResponse> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'LOGOUT' };

// Helper function to convert API user to frontend format
function convertApiUserToFrontend(apiUser: UserProfile): User {
  return {
    id: apiUser.id.toString(),
    name: apiUser.name,
    email: apiUser.email,
    role: (apiUser.id || 'user') as 'admin' | 'user', // Ensure proper typing
    createdAt: new Date(apiUser.created_at),
    updatedAt: new Date(apiUser.updated_at),
  };
}

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isAdmin: action.payload.role === 'admin', // Calculate isAdmin
        error: null,
      };

    case 'SET_STATS':
      return {
        ...state,
        stats: action.payload,
        error: null,
      };

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        error: null,
      };

    case 'UPDATE_NOTIFICATION': {
      const { id, updates } = action.payload;
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === id
            ? { ...notification, ...updates }
            : notification
        ),
      };
    }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: action.payload,
        isAdmin: action.payload ? state.user?.role === 'admin' : false,
      };

    case 'LOGOUT':
      return {
        ...initialState,
        isAuthenticated: false,
        isAdmin: false,
      };

    default:
      return state;
  }
}

// Context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      // Check if user has valid session/token
      const hasValidSession = localStorage.getItem('isLoggedIn') === 'true';
      
      if (hasValidSession) {
        await loadUserData();
      } else {
        dispatch({ type: 'SET_AUTHENTICATED', payload: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // For now, simulate login - replace with actual auth API call
      if (credentials.email && credentials.password) {
        // Store auth state (in real app, you'd store tokens)
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', credentials.email);
        
        await loadUserData();
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error('Login failed:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Login failed' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Clear auth state
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userEmail');
      
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout failed:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Logout failed' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Load user profile
      const apiUser = await userApi.getProfile();
      const user = convertApiUserToFrontend(apiUser);
      dispatch({ type: 'SET_USER', payload: user });

      // Load user stats
      const stats = await userApi.getStats();
      dispatch({ type: 'SET_STATS', payload: stats });

      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    } catch (error) {
      console.error('Failed to load user data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load user data' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const updatedUser = await userApi.updateProfile({
        name: data.name,
        email: data.email,
      });
      
      const user = convertApiUserToFrontend(updatedUser);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      console.error('Failed to update profile:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update profile' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const notifications = await notificationsApi.getNotifications();
      dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load notifications' });
    }
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: number) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      dispatch({ 
        type: 'UPDATE_NOTIFICATION', 
        payload: { 
          id: notificationId, 
          updates: { read: true } 
        } 
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update notification' });
    }
  }, []);

  const contextValue: AuthContextType = {
    state,
    login,
    logout,
    updateProfile,
    loadUserData,
    loadNotifications,
    markNotificationAsRead,
    clearError,
    // Additional properties for useRole compatibility
    isAuthenticated: state.isAuthenticated,
    isAdmin: state.isAdmin,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Backward compatibility - export useUser as alias
export const useUser = useAuth;