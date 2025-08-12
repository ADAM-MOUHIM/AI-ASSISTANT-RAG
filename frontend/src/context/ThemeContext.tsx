import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

// Types
export type Theme = 'light' | 'dark';

export interface ThemeState {
  theme: Theme;
  isLoading: boolean;
}

export interface ThemeContextType {
  state: ThemeState;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Initial state
const initialState: ThemeState = {
  theme: 'light',
  isLoading: true,
};

// Action types
type ThemeAction =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_LOADING'; payload: boolean };

// Reducer
function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload,
        isLoading: false,
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    default:
      return state;
  }
}

// Context
const ThemeContext = createContext<ThemeContextType | null>(null);

// Provider component
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!state.isLoading) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(state.theme);
      localStorage.setItem('theme', state.theme);
    }
  }, [state.theme, state.isLoading]);

  const initializeTheme = useCallback(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      dispatch({ type: 'SET_THEME', payload: savedTheme });
      return;
    }

    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    dispatch({ type: 'SET_THEME', payload: prefersDark ? 'dark' : 'light' });
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    dispatch({ type: 'SET_THEME', payload: newTheme });
  }, [state.theme]);

  const contextValue: ThemeContextType = {
    state,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}