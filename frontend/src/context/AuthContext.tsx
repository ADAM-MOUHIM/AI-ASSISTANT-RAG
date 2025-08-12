// src/context/AuthContext.tsx
import { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'admin' | 'user' | 'moderator';

export interface UserStats {
  total_conversations: number;
  total_messages: number;
  joined_date: string;
}

export interface NotificationResponse {
  id: number;
  message: string;
  read: boolean;
  created_at: string;
}

export interface User {
  id: string | number;
  email: string;
  role: UserRole;

  // new / optional
  username?: string | null;
  name?: string | null;
  avatar_url?: string | null;

  // prefer strings for easy serialization
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RolePermissions {
  canCreateUsers: boolean;
  canDeleteUsers: boolean;
  canUploadDocuments: boolean;
  canManageSystem: boolean;
  canAccessAdminPanel: boolean;
  canViewAllConversations: boolean;
  canModerateContent: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  moderator: 2,
  admin: 3,
};

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  user: {
    canCreateUsers: false,
    canDeleteUsers: false,
    canUploadDocuments: false,
    canManageSystem: false,
    canAccessAdminPanel: false,
    canViewAllConversations: false,
    canModerateContent: false,
  },
  moderator: {
    canCreateUsers: false,
    canDeleteUsers: false,
    canUploadDocuments: true,
    canManageSystem: false,
    canAccessAdminPanel: false,
    canViewAllConversations: true,
    canModerateContent: true,
  },
  admin: {
    canCreateUsers: true,
    canDeleteUsers: true,
    canUploadDocuments: true,
    canManageSystem: true,
    canAccessAdminPanel: true,
    canViewAllConversations: true,
    canModerateContent: true,
  },
};

export interface AuthState {
  user: User | null;
  stats: UserStats | null;
  notifications: NotificationResponse[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isInitialized: boolean;
  error: string | null;
  token: string | null | undefined; // undefined = not checked yet
}

const initialState: AuthState = {
  user: null,
  stats: null,
  notifications: [],
  isLoading: false,
  isAuthenticated: false,
  isAdmin: false,
  isInitialized: false,
  error: null,
  token: undefined,
};

type AuthAction =
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_STATS'; payload: UserStats }
  | { type: 'SET_NOTIFICATIONS'; payload: NotificationResponse[] }
  | { type: 'UPDATE_NOTIFICATION'; payload: { id: number; updates: Partial<NotificationResponse> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: { isAuthenticated: boolean; token?: string | null } }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'LOGOUT' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isAdmin: action.payload.role === 'admin',
        error: null,
      };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
        ),
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        token: action.payload.token !== undefined ? action.payload.token : state.token,
        isAdmin: action.payload.isAuthenticated ? state.user?.role === 'admin' : false,
        isInitialized: true,
      };
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'LOGOUT':
      return { ...initialState, token: null, isInitialized: true };
    default:
      return state;
  }
}

export interface AuthContextType {
  state: AuthState;
  user: User | null;
  token: string | null | undefined;
  login: (credentials: { username?: string; email?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  loadUserData: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: number) => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isInitialized: boolean;

  hasRole: (role: UserRole) => boolean;
  hasRoleLevel: (role: UserRole) => boolean;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  hasAllPermissions: (list: (keyof RolePermissions)[]) => boolean;
  hasAnyPermission: (list: (keyof RolePermissions)[]) => boolean;
  requireRole: (role: UserRole) => boolean;
  requireRoleLevel: (role: UserRole) => boolean;
  requirePermission: (permission: keyof RolePermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const safeFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    return res;
  }, []);

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuthenticated: false, token: null } });
      return;
    }
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const meRes = await safeFetch('/auth/me');
      if (!meRes.ok) {
        localStorage.removeItem('access_token');
        dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuthenticated: false, token: null } });
        return;
      }
      const me = await meRes.json();
      const mappedUser: User = {
          id: me.id,
          email: me.email ?? '',
          role: (me.role ?? 'user') as UserRole,
          username: me.username ?? null,
          name: me.name ?? me.username ?? (me.email ? me.email.split('@')[0] : null),
          avatar_url: me.avatar_url ?? null,
          createdAt: me.created_at ?? new Date().toISOString(),
          updatedAt: me.updated_at ?? new Date().toISOString(),
            };

      dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuthenticated: true, token } });
      dispatch({ type: 'SET_USER', payload: mappedUser });
    } catch {
      dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuthenticated: false, token: null } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [safeFetch]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Accepts either { username, password } OR { email, password } (we use username under the hood)
  const login = useCallback(async (input: { username?: string; email?: string; password: string }) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const username = input.username ?? input.email;
      if (!username || !input.password) throw new Error('Missing credentials');

      const body = new URLSearchParams();
      body.set('username', username);
      body.set('password', input.password);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed (${res.status})`);
      }
      const { access_token } = await res.json();
      if (!access_token) throw new Error('No access_token returned');

      localStorage.setItem('access_token', access_token);
      await checkAuthStatus(); // loads /auth/me and sets user
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err?.message || 'Login failed' });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [checkAuthStatus]);

  const logout = useCallback(async () => {
    localStorage.removeItem('access_token');
    dispatch({ type: 'LOGOUT' });
  }, []);

  const loadUserData = useCallback(async () => {
    // Optional: load additional stats from a real endpoint later
    const stats: UserStats = {
      total_conversations: 0,
      total_messages: 0,
      joined_date: new Date().toISOString(),
    };
    dispatch({ type: 'SET_STATS', payload: stats });
  }, []);

  const loadNotifications = useCallback(async () => {
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
  }, []);

  const markNotificationAsRead = useCallback(async (_id: number) => {
    // no-op placeholder (implement later)
  }, []);

  const updateProfile = useCallback(async (_data: Partial<User>) => {
    // no-op placeholder (implement later)
  }, []);

  // ---- Role & permissions
  const currentRole = state.user?.role || null;
  const permissions = useMemo<RolePermissions>(() => {
    if (!state.isAuthenticated || !currentRole) return ROLE_PERMISSIONS.user;
    return ROLE_PERMISSIONS[currentRole];
  }, [state.isAuthenticated, currentRole]);

  const hasRole = useCallback((role: UserRole): boolean => {
    if (!currentRole) return false;
    return currentRole === role;
  }, [currentRole]);

  const hasRoleLevel = useCallback((role: UserRole): boolean => {
    if (!currentRole) return false;
    return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[role];
  }, [currentRole]);

  const hasPermission = useCallback((perm: keyof RolePermissions) => permissions[perm], [permissions]);
  const hasAllPermissions = useCallback((list: (keyof RolePermissions)[]) => list.every((p) => permissions[p]), [permissions]);
  const hasAnyPermission = useCallback((list: (keyof RolePermissions)[]) => list.some((p) => permissions[p]), [permissions]);
  const requireRole = useCallback((role: UserRole): boolean => hasRole(role), [hasRole]);
  const requireRoleLevel = useCallback((role: UserRole): boolean => hasRoleLevel(role), [hasRoleLevel]);
  const requirePermission = useCallback((perm: keyof RolePermissions) => hasPermission(perm), [hasPermission]);

  const ctxValue: AuthContextType = {
    state,
    user: state.user,
    token: state.token,
    login,
    logout,
    updateProfile,
    loadUserData,
    loadNotifications,
    markNotificationAsRead,
    clearError,
    isAuthenticated: state.isAuthenticated,
    isAdmin: state.isAdmin,
    isInitialized: state.isInitialized,

    hasRole,
    hasRoleLevel,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    requireRole,
    requireRoleLevel,
    requirePermission,
  };

  return <AuthContext.Provider value={ctxValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
