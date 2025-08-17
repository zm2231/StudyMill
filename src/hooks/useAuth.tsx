'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiClient, User, RegisterData, LoginData, UpdateProfileData, ApiError } from '@/lib/api';

// Auth state interface
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// Auth actions
type AuthAction =
  | { type: 'LOADING' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: User };

// Auth context interface
interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<boolean>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      };
    case 'ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
        error: null,
      };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (apiClient.isAuthenticated()) {
        try {
          const user = await apiClient.getCurrentUser();
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } catch (error) {
          // Token might be invalid, clear it
          apiClient.clearTokens();
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (data: LoginData): Promise<boolean> => {
    try {
      dispatch({ type: 'LOADING' });
      const response = await apiClient.login(data);
      
      // Store tokens
      apiClient.setTokens(response.tokens);
      
      // Update auth state
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.user });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Login failed. Please try again.';
      dispatch({ type: 'ERROR', payload: errorMessage });
      return false;
    }
  };

  // Register function
  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      dispatch({ type: 'LOADING' });
      const response = await apiClient.register(data);
      
      // Store tokens
      apiClient.setTokens(response.tokens);
      
      // Update auth state
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.user });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Registration failed. Please try again.';
      dispatch({ type: 'ERROR', payload: errorMessage });
      return false;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout();
    } catch (error) {
      // Even if logout fails on server, clear local state
      console.warn('Logout request failed:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Logout all sessions function
  const logoutAll = async (): Promise<void> => {
    try {
      await apiClient.logoutAll();
    } catch (error) {
      // Even if logout fails on server, clear local state
      console.warn('Logout all request failed:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Update profile function
  const updateProfile = async (data: UpdateProfileData): Promise<boolean> => {
    try {
      dispatch({ type: 'LOADING' });
      const updatedUser = await apiClient.updateProfile(data);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
      return true;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Profile update failed. Please try again.';
      dispatch({ type: 'ERROR', payload: errorMessage });
      return false;
    }
  };

  // Delete account function
  const deleteAccount = async (): Promise<void> => {
    try {
      await apiClient.deleteAccount();
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Account deletion failed. Please try again.';
      dispatch({ type: 'ERROR', payload: errorMessage });
      throw error;
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    if (!apiClient.isAuthenticated()) return;
    
    try {
      const user = await apiClient.getCurrentUser();
      dispatch({ type: 'UPDATE_USER', payload: user });
    } catch (error) {
      console.warn('Failed to refresh user data:', error);
      // Don't dispatch error for background refresh
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    logoutAll,
    updateProfile,
    deleteAccount,
    clearError,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook for protected routes
export function useRequireAuth(): AuthContextType {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login page
      window.location.href = '/auth/login';
    }
  }, [auth.isAuthenticated, auth.isLoading]);

  return auth;
}

// Helper hook for guest-only routes (login, register)
export function useGuestOnly(): AuthContextType {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      // Redirect to dashboard
      window.location.href = '/dashboard';
    }
  }, [auth.isAuthenticated, auth.isLoading]);

  return auth;
}