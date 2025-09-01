import { DurableObject } from 'cloudflare:workers';
import { DatabaseService } from '../services/database';
import { VectorService } from '../services/vector';
import { HybridSearchService, type RetrievalMode } from '../services/hybridSearch';
import { createError } from '../middleware/error';
import { GenAIService, type ChatHistoryMessage } from '../services/genaiClient';

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
private searchService: HybridSearchService | null = null;

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

    // Align sessionId with client-provided value (for DB consistency)
    const url = new URL(request.url);
    const incomingSessionId = url.searchParams.get('sessionId');
    if (incomingSessionId) {
      this.sessionId = incomingSessionId;
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

    // Structured server log for connection
    try {
      const ts = new Date().toISOString();
      console.log(
        JSON.stringify({
          event: 'chat_ws_connected',
          ts,
          sessionId: this.sessionId,
          userId
        })
      );
    } catch {}

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
          await this.handleChatMessage(client, data.content, data.courseId, (data.retrievalMode as RetrievalMode) || 'advanced');
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
    } catch (error: any) {
      console.error('Error handling WebSocket message:', error);
      client.websocket.send(JSON.stringify({
        type: 'error',
        code: 'MESSAGE_HANDLER_ERROR',
        message: error?.message || 'Failed to process message'
      }));
    }
  }

  /**
   * Handle chat messages and generate AI responses
   */
private async handleChatMessage(client: WebSocketClient, content: string, courseId?: string, retrievalMode: RetrievalMode = 'advanced') {
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

    // Send acknowledgment to sender with the stored message (confirming it was saved)
    client.websocket.send(JSON.stringify({
      type: 'message_ack',
      message: userMessage
    }));

    // Broadcast user message to OTHER clients only
    this.broadcastToOthers(client, {
      type: 'message',
      message: userMessage
    });

// Retrieve context using vector search
    const context = await this.retrieveContext(content, client.userId, courseId, retrievalMode);

    // Generate AI response
    await this.generateAIResponse(content, context, client.userId, courseId);
  }

  /**
   * Retrieve relevant context using vector search
   */
private async retrieveContext(query: string, userId: string, courseId?: string, retrievalMode: RetrievalMode = 'advanced'): Promise<string> {
    if (!this.searchService) {
      return '';
    }

    try {
const searchResults = await this.searchService.hybridSearch({
        query,
        userId,
        courseId,
        limit: 5,
        mode: retrievalMode,
        threshold: 0.0
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
   * Generate AI response using Gemini 2.5 (SDK) and stream back to clients
   */
  private async generateAIResponse(query: string, context: string, userId: string, courseId?: string) {
    // Prepare variables outside try so we can handle partials on error
    let assistantMessage: ChatMessage = {
      id: 'msg_' + crypto.randomUUID(),
      sessionId: this.sessionId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    let fullContent = '';

    try {
      // Broadcast model info (will be updated if fallback occurs)
      if (!this.env.GEMINI_API_KEY) {
        this.broadcastToAll({ type: 'ai_info', model: '@cf/meta/llama-3.1-8b-instruct', reason: 'no_gemini_key' });
      } else {
        this.broadcastToAll({ type: 'ai_info', model: 'gemini-2.5-flash' });
      }

      // Broadcast message start
      this.broadcastToAll({
        type: 'message_start',
        messageId: assistantMessage.id
      });

      // Prepare prompt with context
      const prompt = this.buildPrompt(query, context);

      // If no Gemini key is configured, fallback to Cloudflare Workers AI
      if (!this.env.GEMINI_API_KEY) {
        try {
          const result = await (this.env as any).AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt, max_tokens: 1024, temperature: 0.7 });
          const text = (result && (result.response || result.text || result.output)) ? (result.response || result.text || result.output) : String(result ?? '');
          assistantMessage.content = text;
          // Stream as a single chunk for now
          this.broadcastToAll({ type: 'message_chunk', messageId: assistantMessage.id, chunk: text });
          await this.storeMessage(assistantMessage);
          this.broadcastToAll({ type: 'message_complete', messageId: assistantMessage.id, message: assistantMessage });
          return;
        } catch (fallbackErr) {
          console.error('Workers AI fallback failed:', fallbackErr);
          throw fallbackErr;
        }
      }

      // Use Gemini 2.5 via SDK for response generation with streaming
      const systemPrompt = [
        'You are StudyMill AI, the academic assistant inside the StudyMill app.',
        'Capabilities:',
        '- Retrieve context via StudyMill\'s hybrid search (documents, memories, audio summaries).',
        '- Cite sources when drawing from provided context. Prefer clear inline citations like [Document Title] or [Memory].',
        '- Ask clarifying questions when the query is underspecified.',
        '- Provide helpful, educational, and stepwise explanations (focus on learning outcomes).',
        '- Never invent references or page numbers; only cite what is present in context.',
        '- If context is missing, say so briefly and answer with general guidance.',
        'Style:',
        '- Be concise but thorough, structured with short paragraphs and lists when appropriate.',
        '- Use neutral, supportive tone. Avoid speculation.',
        'Safety:',
        '- Decline requests that are unsafe, disallowed by policy, or would produce harmful outcomes.',
      ].join('\n');

      // Assemble recent conversation history (last 20 messages)
      const history = await this.loadRecentHistory(20);

      // Log the attempt to use Gemini SDK
      console.log(JSON.stringify({
        event: 'gemini_sdk_request_start',
        ts: new Date().toISOString(),
        sessionId: this.sessionId,
        hasApiKey: !!this.env.GEMINI_API_KEY,
        apiKeyLength: this.env.GEMINI_API_KEY?.length || 0
      }));

      // Stream using SDK
      const genAI = new GenAIService(this.env.GEMINI_API_KEY, 'gemini-2.5-flash');
      fullContent = await genAI.streamChat(
        {
          systemPrompt,
          history,
          userText: prompt,
          generationConfig: { temperature: 0.7, topP: 0.8, topK: 40, maxOutputTokens: 8192 }
        },
        (chunk) => {
          this.broadcastToAll({
            type: 'message_chunk',
            messageId: assistantMessage.id,
            chunk
          });
        }
      );

      // Update message with full content
      assistantMessage.content = fullContent;

      // Store complete message
      await this.storeMessage(assistantMessage);

      // Structured server log for completion
      try {
        const ts = new Date().toISOString();
        console.log(
          JSON.stringify({
            event: 'ai_message_complete',
            ts,
            sessionId: this.sessionId,
            messageId: assistantMessage.id,
            length: assistantMessage.content.length
          })
        );
      } catch {}

      // Broadcast message completion
      this.broadcastToAll({
        type: 'message_complete',
        messageId: assistantMessage.id,
        message: assistantMessage
      });

    } catch (error) {
      console.error('Error generating AI response (Gemini SDK path):', error);

      // If we already streamed some content, finalize this message with the partial content
      if (fullContent && fullContent.trim().length > 0) {
        try {
          assistantMessage.content = fullContent;
          await this.storeMessage(assistantMessage);
          this.broadcastToAll({ type: 'message_complete', messageId: assistantMessage.id, message: assistantMessage });
          return;
        } catch (e) {
          console.error('Failed to store partial content after Gemini error:', e);
        }
      }

      // Otherwise, attempt Workers AI fallback using the SAME message ID so the UI doesn't get confused
      try {
        this.broadcastToAll({ type: 'ai_info', model: '@cf/meta/llama-3.1-8b-instruct', reason: 'gemini_error' });
        const fallbackResult = await (this.env as any).AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt: this.buildPrompt(query, context), max_tokens: 1024, temperature: 0.7 });
        const fallbackText = (fallbackResult && (fallbackResult.response || fallbackResult.text || fallbackResult.output)) ? (fallbackResult.response || fallbackResult.text || fallbackResult.output) : 'I encountered an error, but here is a basic response.';

        // Stream as single chunk and complete with the same messageId
        this.broadcastToAll({ type: 'message_chunk', messageId: assistantMessage.id, chunk: fallbackText });
        assistantMessage.content = fallbackText;
        await this.storeMessage(assistantMessage);
        this.broadcastToAll({ type: 'message_complete', messageId: assistantMessage.id, message: assistantMessage });
        return;
      } catch (fallbackError) {
        console.error('Workers AI fallback also failed:', fallbackError);
      }

      // Fallback apology if all else fails
      assistantMessage.content = 'I apologize, but I encountered an error while processing your request. Please try again.';
      try {
        await this.storeMessage(assistantMessage);
      } catch (e) {
        console.error('Failed to store error message:', e);
      }
      this.broadcastToAll({ type: 'message', message: assistantMessage });
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

    try {
      await this.dbService.execute(
        `INSERT INTO chat_messages (id, session_id, role, content, document_references, token_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.sessionId,
          message.role,
          message.content,
          message.documentReferences ? JSON.stringify(message.documentReferences) : null,
          message.content.length,
          message.timestamp,
          message.timestamp
        ]
      );
    } catch (e) {
      console.error('[ChatDO] storeMessage failed:', e);
      throw e;
    }
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

      await this.dbService.execute(
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
   * Load recent chat history for the session (user + assistant)
   */
  private async loadRecentHistory(limit = 20): Promise<ChatHistoryMessage[]> {
    if (!this.dbService) return [];
    try {
      const rows = await this.dbService.query(
        `SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
        [this.sessionId, limit]
      );
      // Return in chronological order
      const chronological = rows.reverse();
      return chronological.map((r: any) => ({
        role: (r.role === 'assistant' ? 'assistant' : 'user') as ChatHistoryMessage['role'],
        content: r.content as string
      }));
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      return [];
    }
  }

  /**
   * Initialize database and search services
   */
  private async initializeServices() {
    if (!this.dbService) {
      this.dbService = new DatabaseService(this.env.DB);
      // Lazily ensure required tables exist (defensive)
      await this.dbService.execute(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          course_id TEXT,
          assignment_id TEXT,
          title TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      await this.dbService.execute(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user','assistant')),
          content TEXT NOT NULL,
          document_references TEXT,
          token_count INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        );
      `);
    }
    if (!this.searchService) {
      // Create VectorService with Cloudflare AI binding
      const vectorService = new VectorService(this.env.AI, this.env.VECTORIZE, this.dbService);
this.searchService = new HybridSearchService(vectorService, this.dbService);
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