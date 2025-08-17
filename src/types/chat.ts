export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'error';
  messageType?: 'question' | 'explanation' | 'summary' | 'code' | 'general';
  contextUsed?: {
    courseId?: string;
    courseName?: string;
    assignmentId?: string;
    assignmentName?: string;
    documentIds?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  context?: {
    courseId?: string;
    assignmentId?: string;
    documentIds?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface StreamingResponse {
  content: string;
  isComplete: boolean;
  error?: string;
}

export interface ContextRetrieval {
  query: string;
  courseId?: string;
  assignmentId?: string;
  maxResults?: number;
  threshold?: number;
}

export interface RetrievedContext {
  documentId: string;
  documentTitle: string;
  content: string;
  relevanceScore: number;
  chunkIndex: number;
}

export interface ChatConfig {
  maxTokens: number;
  temperature: number;
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  systemPrompt: string;
  contextWindow: number;
}