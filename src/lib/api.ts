// API Client for StudyMill Backend Communication
// Handles authentication, requests, and error handling

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
}

interface ApiErrorData {
  error: string;
  message: string;
  details?: unknown;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Use environment variable for API URL, fallback to localhost for development
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    
    // Load tokens from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('studymill_access_token');
      this.refreshToken = localStorage.getItem('studymill_refresh_token');
    }
  }

  /**
   * Set authentication tokens
   */
  setTokens(tokens: AuthTokens) {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('studymill_access_token', tokens.access_token);
      localStorage.setItem('studymill_refresh_token', tokens.refresh_token);
      localStorage.setItem('studymill_token_expires_at', tokens.expires_at.toString());
    }
  }

  /**
   * Clear authentication tokens
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('studymill_access_token');
      localStorage.removeItem('studymill_refresh_token');
      localStorage.removeItem('studymill_token_expires_at');
    }
  }

  /**
   * Check if tokens are expired
   */
  isTokenExpired(): boolean {
    if (typeof window === 'undefined') return true;
    
    const expiresAt = localStorage.getItem('studymill_token_expires_at');
    if (!expiresAt) return true;
    
    return Date.now() >= parseInt(expiresAt);
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): Record<string, string> {
    if (!this.accessToken) return {};
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  /**
   * Make API request with automatic token refresh
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      let response = await fetch(url, config);

      // If unauthorized and we have a refresh token, try to refresh
      if (response.status === 401 && this.refreshToken && endpoint !== '/auth/refresh') {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          // Retry the original request with new token
          config.headers = {
            ...defaultHeaders,
            ...this.getAuthHeader(),
            ...options.headers,
          };
          response = await fetch(url, config);
        }
      }

      const data = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        throw new ApiErrorClass(
          (data.error as string) || 'API_ERROR', 
          (data.message as string) || 'An error occurred', 
          data.details as string
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'ApiError') {
        throw error;
      }
      
      // Network or other errors
      throw new ApiErrorClass('NETWORK_ERROR', 'Unable to connect to the server');
    }
  }

  /**
   * Refresh access token
   */
  private async refreshTokens(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json() as { tokens: AuthTokens };
      this.setTokens(data.tokens);
      return true;
    } catch (error) {
      this.clearTokens();
      return false;
    }
  }

  // Authentication endpoints
  async register(data: RegisterData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.clearTokens();
    }
  }

  async logoutAll(): Promise<void> {
    try {
      await this.request('/auth/logout-all', {
        method: 'POST',
      });
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ user: User }>('/auth/me');
    return response.user;
  }

  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await this.request<{ user: User; message: string }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.user;
  }

  async deleteAccount(): Promise<void> {
    await this.request('/auth/account', {
      method: 'DELETE',
    });
    this.clearTokens();
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!(this.accessToken && !this.isTokenExpired());
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Course endpoints (placeholder for future implementation)
  async getCourses(): Promise<unknown[]> {
    const response = await this.request<{ courses: unknown[] }>('/api/v1/courses');
    return response.courses;
  }

  async createCourse(data: { name: string; description?: string }): Promise<unknown> {
    return this.request('/api/v1/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Health check
  async healthCheck(): Promise<{ message: string; status: string; timestamp: string }> {
    return this.request('/');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Custom error class for API errors
class ApiErrorClass extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export { ApiErrorClass as ApiError };