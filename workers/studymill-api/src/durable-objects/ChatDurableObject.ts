import { DurableObject } from 'cloudflare:workers';
import { DatabaseService } from '../services/database';
import { VectorService } from '../services/vector';
import { SemanticSearchService } from '../services/semanticSearch';
import { createError } from '../middleware/error';

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  documentReferences?: string[];
  timestamp: string;
}

interface ChatSession {
  id: string;
  userId: string;
  courseId?: string;
  assignmentId?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebSocketClient {
  websocket: WebSocket;
  userId: string;
  sessionId: string;
}

export interface ChatDurableObjectEnv {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: any; // Cloudflare Workers AI binding (keeping for potential fallback)
  GEMINI_API_KEY: string; // Required for Gemini Flash chat responses
}

/**
 * ChatDurableObject manages real-time chat sessions using WebSockets
 * Each instance handles a single chat session with multiple potential WebSocket connections
 */
export class ChatDurableObject extends DurableObject {
  private clients: Set<WebSocketClient> = new Set();
  private sessionId: string;
  private session: ChatSession | null = null;
  private dbService: DatabaseService | null = null;
  private searchService: SemanticSearchService | null = null;

  constructor(ctx: DurableObjectState, env: ChatDurableObjectEnv) {
    super(ctx, env);
    // Extract session ID from the Durable Object ID
    this.sessionId = ctx.id.toString();
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    return this.webSocketUpgrade(request);
  }

  /**
   * Handle WebSocket upgrade requests
   */
  async webSocketUpgrade(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Extract user authentication from request
    const userId = this.extractUserId(request);
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Initialize services
    await this.initializeServices();

    // Accept the WebSocket connection
    server.accept();

    // Create client object
    const clientData: WebSocketClient = {
      websocket: server,
      userId,
      sessionId: this.sessionId
    };

    // Add to clients set
    this.clients.add(clientData);

    // Set up event handlers
    server.addEventListener('message', async (event) => {
      await this.handleWebSocketMessage(clientData, event);
    });

    server.addEventListener('close', () => {
      this.clients.delete(clientData);
    });

    server.addEventListener('error', () => {
      this.clients.delete(clientData);
    });

    // Load or create chat session
    await this.ensureChatSession(userId);

    // Send session info to client
    server.send(JSON.stringify({
      type: 'session_info',
      sessionId: this.sessionId,
      session: this.session
    }));

    // Return WebSocket response
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleWebSocketMessage(client: WebSocketClient, event: MessageEvent) {
    try {
      const data = JSON.parse(event.data as string);
      
      switch (data.type) {
        case 'chat_message':
          await this.handleChatMessage(client, data.content, data.courseId);
          break;
        case 'typing_start':
          this.broadcastToOthers(client, { type: 'user_typing', userId: client.userId });
          break;
        case 'typing_stop':
          this.broadcastToOthers(client, { type: 'user_stopped_typing', userId: client.userId });
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      client.websocket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  }

  /**
   * Handle chat messages and generate AI responses
   */
  private async handleChatMessage(client: WebSocketClient, content: string, courseId?: string) {
    if (!this.dbService || !this.searchService) {
      throw new Error('Services not initialized');
    }

    // Store user message
    const userMessage: ChatMessage = {
      id: 'msg_' + crypto.randomUUID(),
      sessionId: this.sessionId,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    await this.storeMessage(userMessage);

    // Broadcast user message to all clients
    this.broadcastToAll({
      type: 'message',
      message: userMessage
    });

    // Retrieve context using vector search
    const context = await this.retrieveContext(content, client.userId, courseId);

    // Generate AI response
    await this.generateAIResponse(content, context, client.userId, courseId);
  }

  /**
   * Retrieve relevant context using vector search
   */
  private async retrieveContext(query: string, userId: string, courseId?: string): Promise<string> {
    if (!this.searchService) {
      return '';
    }

    try {
      const searchResults = await this.searchService.hybridSearch({
        query,
        userId,
        containerTags: courseId ? [courseId] : undefined,
        limit: 5,
        threshold: 0.7
      });

      // Format context from search results
      const contextParts = searchResults.map(result => 
        `[${result.metadata?.source || 'Document'}] ${result.content}`
      );

      return contextParts.join('\n\n');
    } catch (error) {
      console.error('Error retrieving context:', error);
      return '';
    }
  }

  /**
   * Generate AI response using Gemini Flash and stream back to clients
   */
  private async generateAIResponse(query: string, context: string, userId: string, courseId?: string) {
    try {
      // Create assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: 'msg_' + crypto.randomUUID(),
        sessionId: this.sessionId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      };

      // Broadcast message start
      this.broadcastToAll({
        type: 'message_start',
        messageId: assistantMessage.id
      });

      // Prepare prompt with context
      const prompt = this.buildPrompt(query, context);

      // Use Gemini 2.5 Flash for response generation with streaming
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${this.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          systemInstruction: {
            parts: [{ text: 'You are StudyMill AI, a helpful academic assistant. Use the provided context to answer questions accurately and cite sources when relevant. Provide clear, educational responses that help students learn.' }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40
          }
        })
      });

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
      }

      let fullContent = '';
      const reader = geminiResponse.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue;
              
              // Gemini streams JSON objects, sometimes with data: prefix
              const cleanLine = line.replace(/^data: /, '').trim();
              
              try {
                const parsed = JSON.parse(cleanLine);
                
                // Extract text from Gemini response structure
                if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
                  const parts = parsed.candidates[0].content.parts;
                  if (parts && parts[0] && parts[0].text) {
                    const textChunk = parts[0].text;
                    fullContent += textChunk;
                    
                    // Broadcast chunk to all clients
                    this.broadcastToAll({
                      type: 'message_chunk',
                      messageId: assistantMessage.id,
                      chunk: textChunk
                    });
                  }
                }
              } catch (e) {
                // Skip malformed JSON chunks
                console.warn('Failed to parse streaming chunk:', cleanLine);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      // Update message with full content
      assistantMessage.content = fullContent;

      // Store complete message
      await this.storeMessage(assistantMessage);

      // Broadcast message completion
      this.broadcastToAll({
        type: 'message_complete',
        messageId: assistantMessage.id,
        message: assistantMessage
      });

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Send error message
      const errorMessage: ChatMessage = {
        id: 'msg_' + crypto.randomUUID(),
        sessionId: this.sessionId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };

      await this.storeMessage(errorMessage);
      
      this.broadcastToAll({
        type: 'message',
        message: errorMessage
      });
    }
  }

  /**
   * Build prompt with context for Gemini Flash
   */
  private buildPrompt(query: string, context: string): string {
    if (!context) {
      return `Student Question: ${query}

Please provide a helpful, educational response that assists with learning.`;
    }

    return `You are an expert academic assistant helping a student with their coursework. Use the context from their study materials to provide accurate, helpful responses.

=== CONTEXT FROM STUDENT'S DOCUMENTS ===
${context}

=== STUDENT'S QUESTION ===
${query}

=== INSTRUCTIONS ===
1. Answer the question using the provided context when relevant
2. If the context doesn't contain enough information, acknowledge this and provide general educational guidance
3. Cite specific information from the context when you use it
4. Provide clear explanations that help the student understand the concepts
5. Ask follow-up questions to deepen understanding when appropriate
6. Keep responses focused and academically rigorous

Please provide your response:`;
  }

  /**
   * Store message in database
   */
  private async storeMessage(message: ChatMessage) {
    if (!this.dbService) {
      throw new Error('Database service not initialized');
    }

    await this.dbService.query(
      `INSERT INTO chat_messages (id, session_id, role, content, document_references, token_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.documentReferences ? JSON.stringify(message.documentReferences) : null,
        message.content.length, // Simple token approximation
        message.timestamp,
        message.timestamp
      ]
    );
  }

  /**
   * Ensure chat session exists
   */
  private async ensureChatSession(userId: string) {
    if (!this.dbService) {
      throw new Error('Database service not initialized');
    }

    // Try to load existing session
    const existingSession = await this.dbService.query(
      'SELECT * FROM chat_sessions WHERE id = ?',
      [this.sessionId]
    );

    if (existingSession.length > 0) {
      this.session = existingSession[0] as ChatSession;
    } else {
      // Create new session
      const now = new Date().toISOString();
      this.session = {
        id: this.sessionId,
        userId,
        title: 'New Chat',
        createdAt: now,
        updatedAt: now
      };

      await this.dbService.query(
        `INSERT INTO chat_sessions (id, user_id, course_id, assignment_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          this.session.id,
          this.session.userId,
          this.session.courseId || null,
          this.session.assignmentId || null,
          this.session.title,
          this.session.createdAt,
          this.session.updatedAt
        ]
      );
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastToAll(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      try {
        client.websocket.send(message);
      } catch (error) {
        console.error('Error sending message to client:', error);
        this.clients.delete(client);
      }
    });
  }

  /**
   * Broadcast message to all clients except sender
   */
  private broadcastToOthers(sender: WebSocketClient, data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client !== sender) {
        try {
          client.websocket.send(message);
        } catch (error) {
          console.error('Error sending message to client:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  /**
   * Initialize database and search services
   */
  private async initializeServices() {
    if (!this.dbService) {
      this.dbService = new DatabaseService(this.env.DB);
    }
    if (!this.searchService) {
      // Create VectorService with Cloudflare AI binding
      const vectorService = new VectorService(this.env.AI, this.env.VECTORIZE, this.dbService);
      this.searchService = new SemanticSearchService(vectorService, this.dbService);
    }
  }

  /**
   * Extract user ID from request (authentication)
   */
  private extractUserId(request: Request): string | null {
    // Extract from Authorization header or query params
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // TODO: Implement proper JWT token verification
        // For now, extract userId from token payload (development mode)
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
      } catch (error) {
        console.error('Error parsing token:', error);
        // Fallback for development
        return 'dev_user_' + Math.random().toString(36).substr(2, 9);
      }
    }

    const url = new URL(request.url);
    return url.searchParams.get('userId') || 'anonymous_' + Math.random().toString(36).substr(2, 9);
  }
}

export default ChatDurableObject;