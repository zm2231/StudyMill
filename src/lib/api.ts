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

// Standardized error schema (P1-009 compliance)
interface ApiErrorData {
  code: string;           // "VALIDATION_ERROR", "UNAUTHORIZED", etc.
  message: string;        // Human-readable description
  details?: unknown;      // Additional context
  requestId: string;      // Correlation ID for debugging
  timestamp: string;      // ISO timestamp
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

export interface Note {
  id: string;
  user_id: string;
  course_id?: string;
  document_id?: string;
  title: string;
  content: string;
  content_preview: string;
  tags?: string; // JSON string of array
  created_at: string;
  updated_at: string;
  // Joined fields from related tables
  course_name?: string;
  course_code?: string;
  document_title?: string;
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
      // Try new format first, then fall back to old format for backward compatibility
      this.accessToken = localStorage.getItem('studymill_access_token') || localStorage.getItem('token');
      this.refreshToken = localStorage.getItem('studymill_refresh_token') || localStorage.getItem('refresh_token');
      
      // If we found tokens in old format, migrate them to new format
      if (!localStorage.getItem('studymill_access_token') && localStorage.getItem('token')) {
        const oldToken = localStorage.getItem('token');
        const oldRefreshToken = localStorage.getItem('refresh_token');
        const oldExpiresAt = localStorage.getItem('token_expires_at');
        
        if (oldToken) {
          localStorage.setItem('studymill_access_token', oldToken);
          localStorage.removeItem('token');
        }
        if (oldRefreshToken) {
          localStorage.setItem('studymill_refresh_token', oldRefreshToken);
          localStorage.removeItem('refresh_token');
        }
        if (oldExpiresAt) {
          localStorage.setItem('studymill_token_expires_at', oldExpiresAt);
          localStorage.removeItem('token_expires_at');
        }
      }
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
      // Remove new format tokens
      localStorage.removeItem('studymill_access_token');
      localStorage.removeItem('studymill_refresh_token');
      localStorage.removeItem('studymill_token_expires_at');
      
      // Remove old format tokens for backward compatibility
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
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
    if (!this.accessToken) {
      console.warn('API Client: No access token available for authentication');
      return {};
    }
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
        const errorData = data as ApiErrorData;
        throw new ApiErrorClass(
          errorData.code || 'API_ERROR',
          errorData.message || 'An error occurred',
          {
            ...errorData.details,
            requestId: errorData.requestId,
            timestamp: errorData.timestamp
          }
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

  // AI synthesis methods
  async summarizeDocument(documentId: string, options: { style?: 'conversational' | 'academic' | 'concise' | 'detailed' } = {}) {
    const response = await this.request<{
      success: boolean;
      summary: string;
      keyPoints: string[];
      wordCount: number;
      confidence: number;
      processingTime: number;
      sources: Array<{
        sourceId: string;
        sourceType: string;
        relevanceScore: number;
        excerpt: string;
      }>;
    }>('/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ documentId, options })
    });
    return response;
  }

  async createStudyGuide(params: { documentIds?: string[]; courseId?: string; options?: Record<string, unknown> }) {
    const response = await this.request<{
      success: boolean;
      title: string;
      sections: Array<{
        id: string;
        title: string;
        content: string;
      }>;
      createdAt: string;
      confidence: number;
      processingTime: number;
      sources: Array<{
        sourceId: string;
        sourceType: string;
        relevanceScore: number;
        excerpt: string;
      }>;
    }>('/ai/study-guide', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return response;
  }

  async generateFlashcards(documentId: string, options: { count?: number; difficulty?: 'easy' | 'medium' | 'hard' } = {}) {
    const response = await this.request<{
      success: boolean;
      cards: Array<{
        id: string;
        front: string;
        back: string;
        difficulty: string;
        confidence: number;
        sourceDocument: string;
      }>;
      metadata: {
        documentTitle: string;
        difficulty: string;
        generated: number;
        requested: number;
        confidence: number;
        processingTime: number;
      };
      sources: Array<{
        sourceId: string;
        sourceType: string;
        relevanceScore: number;
        excerpt: string;
      }>;
    }>('/ai/flashcards', {
      method: 'POST',
      body: JSON.stringify({ documentId, ...options })
    });
    return response;
  }

  // CANONICAL UPLOAD API - Standardized document upload with SSE progress
  async uploadDocument(formData: FormData, options: { 
    strategy?: 'multipart' | 'presigned';
    onProgress?: (progress: { stage: string; percent: number; message?: string }) => void;
  } = {}) {
    // Add strategy to form data if specified
    if (options.strategy) {
      formData.set('strategy', options.strategy);
    }

    const response = await this.request<{
      success: boolean;
      documentId: string;
      streamUrl: string;
      statusUrl: string;
      uploadUrl?: string; // For presigned uploads
      presigned?: boolean;
      duplicate?: boolean;
    }>('/documents/upload', {
      method: 'POST',
      body: formData
    });

    // Start SSE progress monitoring if onProgress callback provided
    if (options.onProgress && !response.duplicate) {
      this.monitorUploadProgress(response.documentId, options.onProgress);
    }

    return response;
  }

  // Monitor upload progress via SSE
  private monitorUploadProgress(documentId: string, onProgress: (progress: any) => void) {
    if (typeof EventSource === 'undefined') {
      // Fallback to polling for environments without EventSource
      this.pollUploadProgress(documentId, onProgress);
      return;
    }

    const eventSource = new EventSource(`${this.baseUrl}/documents/${documentId}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch (error) {
        console.warn('Failed to parse SSE progress data:', error);
      }
    };

    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch (error) {
        console.warn('Failed to parse SSE progress data:', error);
      }
    });

    eventSource.addEventListener('done', (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress({ stage: 'done', percent: 100, ...data });
        eventSource.close();
      } catch (error) {
        console.warn('Failed to parse SSE done data:', error);
      }
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress({ stage: 'error', percent: 0, error: data });
        eventSource.close();
      } catch (error) {
        console.warn('SSE error:', error);
        eventSource.close();
        // Fallback to polling
        this.pollUploadProgress(documentId, onProgress);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      // Fallback to polling
      this.pollUploadProgress(documentId, onProgress);
    };
  }

  // Polling fallback for progress monitoring
  private async pollUploadProgress(documentId: string, onProgress: (progress: any) => void) {
    const maxAttempts = 30; // 1 minute max polling
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        const status = await this.getDocumentStatus(documentId);
        onProgress(status);

        if (status.status === 'complete' || status.status === 'failed' || attempts >= maxAttempts) {
          return;
        }

        setTimeout(poll, 2000); // Poll every 2 seconds
      } catch (error) {
        console.warn('Polling failed:', error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        }
      }
    };

    poll();
  }

  // Get document processing status (canonical API)
  async getDocumentStatus(documentId: string) {
    return this.request<{
      documentId: string;
      status: 'pending' | 'processing' | 'complete' | 'failed';
      stage: 'extract' | 'analyze' | 'memories' | 'none';
      percent: number;
      error: string | null;
    }>(`/documents/${documentId}/status`);
  }

  // Today's classes methods
  async getTodaysClasses() {
    return this.request<{
      success: boolean;
      classes: Array<{
        id: string;
        courseId: string;
        courseName: string;
        courseCode: string;
        startTime: string;
        endTime: string;
        location: string;
        color: string;
        type: string;
      }>;
      today?: {
        date: string;
        dayOfWeek: number;
        dayName: string;
      };
      message?: string;
      error?: string;
    }>('/api/v1/courses/today');
  }

  // Course schedule management
  async updateCourseSchedule(courseId: string, schedules: Array<{
    dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
    startTime: string; // "HH:MM" format
    endTime: string;   // "HH:MM" format  
    location?: string;
  }>) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/courses/${courseId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ schedules })
    });
  }

  async getCourseSchedule(courseId: string) {
    return this.request<{
      success: boolean;
      schedules: Array<{
        day_of_week: number;
        start_time: string;
        end_time: string;
        location: string;
      }>;
    }>(`/courses/${courseId}/schedule`);
  }

  // === NOTES API ===

  async createNote(data: {
    title: string;
    content: string;
    courseId?: string;
    documentId?: string;
    tags?: string[];
  }) {
    return this.request<{
      success: boolean;
      data: Note;
    }>('/notes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getNotes(options: {
    courseId?: string;
    documentId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    
    if (options.courseId) params.append('courseId', options.courseId);
    if (options.documentId) params.append('documentId', options.documentId);
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const queryString = params.toString();
    const url = queryString ? `/notes?${queryString}` : '/notes';

    return this.request<{
      success: boolean;
      data: Note[];
    }>(url);
  }

  async getNote(id: string) {
    return this.request<{
      success: boolean;
      data: Note;
    }>(`/notes/${id}`);
  }

  async updateNote(id: string, data: {
    title?: string;
    content?: string;
    courseId?: string;
    documentId?: string;
    tags?: string[];
  }) {
    return this.request<{
      success: boolean;
      data: Note;
    }>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteNote(id: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/notes/${id}`, {
      method: 'DELETE'
    });
  }

  // === DOCUMENT HEALTH & INSTRUMENTATION (P1-011) ===

  async processDocumentWithInstrumentation(
    documentId: string, 
    processingMode: 'basic' | 'premium' | 'auto' = 'auto'
  ) {
    return this.request<{
      success: boolean;
      processingResult: {
        documentId: string;
        totalChunks: number;
        memoriesCreated: number;
        vectorsIndexed: number;
        coursesLinked: number;
        warnings: string[];
        processingTime: number;
        success: boolean;
        error?: string;
      };
    }>(`/documents/${documentId}/process-instrumented`, {
      method: 'POST',
      body: JSON.stringify({ processingMode })
    });
  }

  async getDocumentHealthReport(documentId: string) {
    return this.request<{
      success: boolean;
      healthReport: {
        documentId: string;
        overallHealth: 'healthy' | 'warning' | 'critical';
        healthScore: number; // 0-100
        checks: Array<{
          name: string;
          status: 'pass' | 'warning' | 'fail';
          message: string;
          timestamp: string;
        }>;
        recommendations: string[];
      };
    }>(`/documents/${documentId}/health-report`);
  }

  // === CHAT API (P1-012) ===

  async getChatSessions() {
    return this.request<{
      success: boolean;
      sessions: Array<{
        id: string;
        courseId?: string;
        assignmentId?: string;
        title: string;
        messageCount: number;
        lastActivity?: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/chat/sessions');
  }

  async createChatSession(data: {
    courseId?: string;
    assignmentId?: string;
    title?: string;
  }) {
    return this.request<{
      success: boolean;
      session: {
        id: string;
        courseId?: string;
        assignmentId?: string;
        title: string;
        messageCount: number;
        createdAt: string;
        updatedAt: string;
      };
    }>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getChatMessages(sessionId: string, options: {
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString();
    const url = queryString ? `/chat/sessions/${sessionId}/messages?${queryString}` : `/chat/sessions/${sessionId}/messages`;
    
    return this.request<{
      success: boolean;
      sessionId: string;
      messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        documentReferences: string[];
        timestamp: string;
      }>;
      pagination: {
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(url);
  }

  async sendChatMessage(sessionId: string, content: string, courseId?: string) {
    return this.request<{
      success: boolean;
      userMessage: {
        id: string;
        role: 'user';
        content: string;
        timestamp: string;
      };
      assistantMessage: {
        id: string;
        role: 'assistant';
        content: string;
        timestamp: string;
      };
    }>(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, courseId })
    });
  }

  // WebSocket connection for real-time chat
  connectToChat(sessionId: string, onMessage: (data: any) => void, onError?: (error: Event) => void): WebSocket | null {
    if (typeof window === 'undefined') {
      console.warn('WebSocket only available in browser environment');
      return null;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('No access token available for WebSocket connection');
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${this.baseURL.replace(/^https?:\/\//, '')}/chat/ws?sessionId=${sessionId}`;
    
    try {
      const ws = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } as any);

      ws.onopen = () => {
        console.log('Chat WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Chat WebSocket error:', error);
        if (onError) onError(error);
      };

      ws.onclose = () => {
        console.log('Chat WebSocket disconnected');
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      if (onError) onError(error as Event);
      return null;
    }
  }

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate server-side session
      await this.request('/api/v1/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      // Even if server logout fails, we should clear local tokens
      console.warn('Server logout failed:', error);
    } finally {
      // Always clear local tokens
      this.clearTokens();
    }
  }

  /**
   * Logout all sessions for this user
   */
  async logoutAll(): Promise<void> {
    try {
      // Call logout all endpoint to invalidate all server-side sessions
      await this.request('/api/v1/auth/logout-all', {
        method: 'POST'
      });
    } catch (error) {
      // Even if server logout fails, we should clear local tokens
      console.warn('Server logout all failed:', error);
    } finally {
      // Always clear local tokens
      this.clearTokens();
    }
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