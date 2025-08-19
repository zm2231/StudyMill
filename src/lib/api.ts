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
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://studymill-api-production.merchantzains.workers.dev';
    
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
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Don't set Content-Type for FormData - let browser set it
    const defaultHeaders: Record<string, string> = {
      ...this.getAuthHeader(),
    };
    
    // Only add Content-Type if it's not FormData
    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

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

  // Course management endpoints
  async getCourses(): Promise<{
    success: boolean;
    courses: Array<{
      id: string;
      name: string;
      code?: string;
      color: string;
      description?: string;
      instructor?: string;
      credits?: number;
      schedule: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        location?: string;
        timezone: string;
      }>;
      semester: {
        startDate: string;
        endDate: string;
        name: string;
      };
      memoryCount: number;
      created_at: string;
      updated_at: string;
    }>;
  }> {
    return this.request('/api/v1/courses');
  }

  async createCourse(data: {
    name: string;
    code?: string;
    color: string;
    description?: string;
    instructor?: string;
    credits?: number;
    schedule: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      location?: string;
      timezone: string;
    }>;
    semester: {
      startDate: string;
      endDate: string;
      name: string;
    };
  }): Promise<{
    success: boolean;
    course: {
      id: string;
      name: string;
      code?: string;
      color: string;
      description?: string;
      instructor?: string;
      credits?: number;
      schedule: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        location?: string;
        timezone: string;
      }>;
      semester: {
        startDate: string;
        endDate: string;
        name: string;
      };
      memoryCount: number;
      created_at: string;
      updated_at: string;
    };
  }> {
    return this.request('/api/v1/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCourse(id: string, data: Partial<{
    name: string;
    code?: string;
    color: string;
    description?: string;
    instructor?: string;
    credits?: number;
    schedule: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      location?: string;
      timezone: string;
    }>;
    semester: {
      startDate: string;
      endDate: string;
      name: string;
    };
  }>): Promise<{
    success: boolean;
    course: any; // Same structure as createCourse response
  }> {
    return this.request(`/api/v1/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCourse(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/v1/courses/${id}`, {
      method: 'DELETE',
    });
  }

  async getCourse(id: string): Promise<{
    success: boolean;
    course: any; // Same structure as createCourse response
  }> {
    return this.request(`/api/v1/courses/${id}`);
  }

  // Today's classes and schedule utilities
  async getTodaysClasses(): Promise<{
    success: boolean;
    classes: Array<{
      course: any; // Course object
      session: {
        id: string;
        courseId: string;
        date: string;
        title?: string;
        week: number;
        hasAudio: boolean;
        hasNotes: boolean;
        materials: {
          audioFileId?: string;
          documentIds: string[];
          memoryIds: string[];
        };
        created_at: string;
        updated_at: string;
      };
      timeSlot: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        location?: string;
        timezone: string;
      };
      status: 'upcoming' | 'current' | 'completed';
      canUpload: boolean;
    }>;
  }> {
    return this.request('/api/v1/courses/today');
  }

  // Lecture session management
  async getLectureSessions(courseId: string, options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    sessions: Array<{
      id: string;
      courseId: string;
      date: string;
      title?: string;
      week: number;
      hasAudio: boolean;
      hasNotes: boolean;
      materials: {
        audioFileId?: string;
        documentIds: string[];
        memoryIds: string[];
      };
      created_at: string;
      updated_at: string;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    if (options?.offset) searchParams.set('offset', options.offset.toString());
    if (options?.startDate) searchParams.set('startDate', options.startDate);
    if (options?.endDate) searchParams.set('endDate', options.endDate);
    
    const query = searchParams.toString();
    return this.request(`/api/v1/courses/${courseId}/sessions${query ? `?${query}` : ''}`);
  }

  async createLectureSession(courseId: string, data: {
    date: string;
    title?: string;
  }): Promise<{
    success: boolean;
    session: any; // LectureSession object
  }> {
    return this.request(`/api/v1/courses/${courseId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLectureSession(courseId: string, sessionId: string, data: {
    title?: string;
    audioFileId?: string;
    documentIds?: string[];
  }): Promise<{
    success: boolean;
    session: any; // LectureSession object
  }> {
    return this.request(`/api/v1/courses/${courseId}/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Audio upload endpoints
  async uploadAudio(formData: FormData): Promise<{
    success: boolean;
    audioFileId: string;
    transcription: {
      id: string;
      text: string;
      language: string;
      duration: number;
      processingTime: number;
      backend: string;
      segmentCount: number;
      topicCount: number;
    };
    memories: {
      count: number;
      topics: Array<{
        id: string;
        topic: string;
        startTime: number;
        endTime: number;
        summary: string;
        keyPoints: string[];
      }>;
      fullTranscription: string;
    };
  }> {
    return this.request('/api/audio/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getSupportedAudioFormats(): Promise<{
    success: boolean;
    supportedFormats: Array<{
      extension: string;
      mimeType: string;
      description: string;
    }>;
    maxFileSize: number;
    maxFileSizeMB: number;
    recommendedFormats: string[];
    backends: Array<{
      name: string;
      description: string;
      models: string[];
      speedFactor: string;
      cost: string;
    }>;
  }> {
    return this.request('/api/audio/supported-formats');
  }

  // Memory management endpoints
  async getMemories(options?: {
    limit?: number;
    offset?: number;
    source_type?: string;
    container_tags?: string[];
  }): Promise<{
    success: boolean;
    memories: Array<{
      id: string;
      content: string;
      source_type: string;
      source_id: string;
      container_tags: string[];
      metadata: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    if (options?.offset) searchParams.set('offset', options.offset.toString());
    if (options?.source_type) searchParams.set('source_type', options.source_type);
    if (options?.container_tags) {
      options.container_tags.forEach(tag => searchParams.append('container_tags', tag));
    }
    
    const query = searchParams.toString();
    return this.request(`/api/v1/memories${query ? `?${query}` : ''}`);
  }

  async searchMemories(query: string, options?: {
    limit?: number;
    hybrid_weight?: number;
    container_tags?: string[];
    source_types?: string[];
  }): Promise<{
    success: boolean;
    results: Array<{
      memory: {
        id: string;
        content: string;
        source_type: string;
        metadata: Record<string, unknown>;
        container_tags: string[];
        created_at: string;
      };
      score: number;
      similarity: number;
      keyword_score?: number;
    }>;
    query_info: {
      original_query: string;
      processed_query: string;
      search_type: string;
      total_results: number;
    };
  }> {
    return this.request('/api/v1/memories/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        ...options,
      }),
    });
  }

  // Document management endpoints
  async getDocuments(options?: {
    courseId?: string;
    types?: string[];
    tags?: string[];
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    documents: Array<{
      id: string;
      title: string;
      type: string;
      fileUrl?: string;
      course?: {
        name: string;
        color: string;
        code: string;
      };
      tags: string[];
      updatedAt: Date;
      status: 'ready' | 'processing' | 'error';
      size: number;
      syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
      canEdit?: boolean;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (options?.courseId) searchParams.set('courseId', options.courseId);
    if (options?.types) searchParams.set('types', options.types.join(','));
    if (options?.tags) searchParams.set('tags', options.tags.join(','));
    if (options?.query) searchParams.set('query', options.query);
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    if (options?.offset) searchParams.set('offset', options.offset.toString());
    
    const query = searchParams.toString();
    return this.request(`/api/v1/documents${query ? `?${query}` : ''}`);
  }

  async getDocument(id: string): Promise<{
    success: boolean;
    document: {
      id: string;
      title: string;
      type: string;
      fileUrl?: string;
      content?: string;
      course?: {
        name: string;
        color: string;
        code: string;
      };
      tags: string[];
      updatedAt: Date;
      status: 'ready' | 'processing' | 'error';
      size: number;
      syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
      canEdit?: boolean;
    };
  }> {
    return this.request(`/api/v1/documents/${id}`);
  }

  async uploadDocument(formData: FormData): Promise<{
    success: boolean;
    documentId?: string;
    jobId?: string;
    processingType: 'direct' | 'async';
    estimatedTime?: number;
    error?: string;
  }> {
    return this.request('/api/v1/documents/process', {
      method: 'POST',
      body: formData,
    });
  }

  async getProcessingStatus(jobId: string): Promise<{
    success: boolean;
    job?: {
      id: string;
      status: string;
      progress: number;
      result?: any;
      error?: string;
    };
    error?: string;
  }> {
    return this.request(`/api/v1/documents/jobs/${jobId}/status`);
  }

  // Assignment management endpoints
  async getAssignments(options?: {
    courseId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    assignments: Array<{
      id: string;
      title: string;
      description?: string;
      type: 'homework' | 'test' | 'project' | 'quiz';
      course: {
        id: string;
        name: string;
        color: string;
        code: string;
      };
      dueDate: Date | null;
      status: 'pending' | 'in_progress' | 'completed' | 'overdue';
      priority: 'high' | 'medium' | 'low';
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (options?.courseId) searchParams.set('courseId', options.courseId);
    if (options?.status) searchParams.set('status', options.status);
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    if (options?.offset) searchParams.set('offset', options.offset.toString());
    
    const query = searchParams.toString();
    return this.request(`/api/v1/assignments${query ? `?${query}` : ''}`);
  }

  async getDueAssignments(options?: {
    days?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    assignments: Array<{
      id: string;
      title: string;
      type: 'homework' | 'test' | 'project' | 'quiz';
      course: {
        name: string;
        color: string;
        code: string;
      };
      dueDate: Date | null;
      priority: 'high' | 'medium' | 'low';
      completed: boolean;
      progress: number;
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (options?.days) searchParams.set('days', options.days.toString());
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    
    const query = searchParams.toString();
    return this.request(`/api/v1/assignments/due${query ? `?${query}` : ''}`);
  }

  async getAssignmentStats(): Promise<{
    success: boolean;
    stats: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      overdue: number;
      dueToday: number;
      dueTomorrow: number;
      dueThisWeek: number;
    };
  }> {
    return this.request('/api/v1/assignments/stats');
  }

  async createAssignment(data: {
    courseId: string;
    title: string;
    description?: string;
    dueDate?: string;
    assignmentType?: 'homework' | 'test' | 'project' | 'quiz';
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  }): Promise<{
    success: boolean;
    assignment: any;
  }> {
    return this.request('/api/v1/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAssignment(id: string): Promise<{
    success: boolean;
    assignment: any;
  }> {
    return this.request(`/api/v1/assignments/${id}`);
  }

  async updateAssignment(id: string, data: {
    title?: string;
    description?: string;
    dueDate?: string;
    assignmentType?: 'homework' | 'test' | 'project' | 'quiz';
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  }): Promise<{
    success: boolean;
    assignment: any;
  }> {
    return this.request(`/api/v1/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAssignment(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/v1/assignments/${id}`, {
      method: 'DELETE',
    });
  }

  async getCourseAssignments(courseId: string): Promise<{
    success: boolean;
    assignments: any[];
  }> {
    return this.request(`/api/v1/assignments/course/${courseId}`);
  }

  // Activity tracking endpoints
  async getRecentActivities(options?: {
    limit?: number;
    actions?: string[];
  }): Promise<{
    success: boolean;
    activities: Array<{
      id: string;
      title: string;
      action: 'uploaded' | 'created' | 'processed' | 'viewed' | 'completed' | 'updated' | 'deleted';
      type: 'document' | 'audio' | 'note' | 'flashcard' | 'study-guide' | 'assignment' | 'course';
      course?: {
        id: string;
        name: string;
        color: string;
        code: string;
      };
      timestamp: Date;
      metadata: Record<string, any>;
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    if (options?.actions) searchParams.set('actions', options.actions.join(','));
    
    const query = searchParams.toString();
    return this.request(`/api/v1/activity/recent${query ? `?${query}` : ''}`);
  }

  async getRecentItems(options?: {
    limit?: number;
  }): Promise<{
    success: boolean;
    recentItems: Array<{
      id: string;
      title: string;
      type: 'document' | 'note' | 'study-guide' | 'flashcard' | 'assignment';
      course?: {
        id: string;
        name: string;
        color: string;
        code: string;
      };
      lastAccessed: Date;
      progress?: number;
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    
    const query = searchParams.toString();
    return this.request(`/api/v1/activity/recent-items${query ? `?${query}` : ''}`);
  }

  async getActivityStats(days?: number): Promise<{
    success: boolean;
    stats: {
      totalActivities: number;
      documentsUploaded: number;
      itemsCreated: number;
      audioProcessed: number;
      documentsViewed: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (days) searchParams.set('days', days.toString());
    
    const query = searchParams.toString();
    return this.request(`/api/v1/activity/stats${query ? `?${query}` : ''}`);
  }

  async logActivity(data: {
    action: 'uploaded' | 'created' | 'processed' | 'viewed' | 'completed' | 'updated' | 'deleted';
    resourceType: 'document' | 'audio' | 'note' | 'flashcard' | 'study-guide' | 'assignment' | 'course';
    resourceId: string;
    resourceTitle: string;
    courseId?: string;
    courseName?: string;
    courseColor?: string;
    courseCode?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/api/v1/activity/log', {
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

// Hook for using the API client in React components
export function useApi() {
  return apiClient;
}