import { DatabaseService } from './database';
import { EnhancedMemoryService } from './enhancedMemory';
import { SemanticSearchService } from './semanticSearch';
import { QueryProcessorService } from './queryProcessor';
import { createError } from '../middleware/error';

export interface SynthesisResult {
  synthesizedContent: string;
  sourceAttribution: SourceAttribution[];
  confidence: number;
  synthesisType: SynthesisType;
  processingTime: number;
  metadata: Record<string, any>;
}

export interface SourceAttribution {
  sourceId: string;
  sourceType: 'document' | 'web' | 'conversation' | 'audio' | 'memory';
  relevanceScore: number;
  excerpt: string;
  pageNumber?: number;
  timestamp?: number;
  url?: string;
}

export interface SynthesisOptions {
  synthesisType: SynthesisType;
  maxSources: number;
  includeAttribution: boolean;
  contextWindow: number;
  prioritizeRecent: boolean;
  minConfidence: number;
  responseStyle: 'academic' | 'conversational' | 'concise' | 'detailed';
}

export type SynthesisType = 'answer' | 'summary' | 'comparison' | 'explanation' | 'analysis';

export class ContextSynthesisService {
  private static readonly DEFAULT_CONTEXT_WINDOW = 4000;
  private static readonly MAX_SYNTHESIS_TIME_MS = 30000; // 30 seconds

  constructor(
    private dbService: DatabaseService,
    private memoryService: EnhancedMemoryService,
    private searchService: SemanticSearchService,
    private queryProcessor: QueryProcessorService,
    private geminiApiKey: string
  ) {}

  /**
   * Main synthesis method - creates coherent context from multiple sources
   */
  async synthesizeContext(
    query: string,
    userId: string,
    options: Partial<SynthesisOptions> = {}
  ): Promise<SynthesisResult> {
    const startTime = Date.now();

    const config: SynthesisOptions = {
      synthesisType: options.synthesisType || 'answer',
      maxSources: options.maxSources || 10,
      includeAttribution: options.includeAttribution ?? true,
      contextWindow: options.contextWindow || ContextSynthesisService.DEFAULT_CONTEXT_WINDOW,
      prioritizeRecent: options.prioritizeRecent ?? true,
      minConfidence: options.minConfidence || 0.6,
      responseStyle: options.responseStyle || 'conversational'
    };

    try {
      // Step 1: Process and expand query
      const processedQuery = await this.queryProcessor.processQuery(query, userId);

      // Step 2: Retrieve relevant content from all sources
      const retrievedContent = await this.retrieveRelevantContent(
        processedQuery, 
        userId, 
        config
      );

      // Step 3: Filter and rank content
      const rankedContent = this.rankAndFilterContent(retrievedContent, config);

      // Step 4: Build context within token limits
      const contextData = this.buildOptimalContext(rankedContent, config);

      // Step 5: Generate synthesis using LLM
      const synthesizedContent = await this.generateSynthesis(
        query,
        contextData.context,
        config
      );

      // Step 6: Create source attribution
      const sourceAttribution = config.includeAttribution 
        ? this.createSourceAttribution(contextData.sources)
        : [];

      const result: SynthesisResult = {
        synthesizedContent,
        sourceAttribution,
        confidence: this.calculateConfidence(contextData, synthesizedContent),
        synthesisType: config.synthesisType,
        processingTime: Date.now() - startTime,
        metadata: {
          sourcesUsed: contextData.sources.length,
          contextTokens: contextData.tokenCount,
          queryProcessingTime: processedQuery.metadata.processingTime,
          memoryTypes: [...new Set(contextData.sources.map(s => s.sourceType))]
        }
      };

      // Log synthesis analytics
      await this.logSynthesisAnalytics(query, result, userId);

      return result;

    } catch (error) {
      console.error('Context synthesis failed:', error);
      throw createError('Failed to synthesize context', 500);
    }
  }

  /**
   * Retrieve relevant content from all available sources
   */
  private async retrieveRelevantContent(
    processedQuery: any,
    userId: string,
    config: SynthesisOptions
  ): Promise<RetrievedContent[]> {
    const content: RetrievedContent[] = [];

    // Search across all sources in parallel
    const [searchResults, memoryResults, conversationResults] = await Promise.all([
      // Search documents, web content, audio transcripts
      this.searchService.search(processedQuery.primary, {
        userId,
        topK: config.maxSources,
        searchType: 'hybrid',
        includeMetadata: true
      }),
      
      // Search memories
      this.memoryService.searchMemories(userId, processedQuery.primary, {
        limit: config.maxSources,
        similarity: config.minConfidence
      }),

      // Search recent conversations
      this.searchConversations(processedQuery.primary, userId, config.maxSources)
    ]);

    // Convert search results to unified format
    content.push(...searchResults.results.map(result => ({
      id: result.id,
      content: result.text,
      sourceType: 'document' as const,
      sourceId: result.documentId,
      relevanceScore: result.score,
      metadata: {
        pageNumber: result.pageNumber,
        documentType: result.documentType,
        courseId: result.courseId
      }
    })));

    // Convert memory results
    content.push(...memoryResults.map(memory => ({
      id: memory.id,
      content: memory.content,
      sourceType: memory.sourceType as any,
      sourceId: memory.sourceId || memory.id,
      relevanceScore: memory.score || 0.8,
      metadata: memory.metadata
    })));

    // Convert conversation results
    content.push(...conversationResults);

    return content;
  }

  /**
   * Search recent conversations for relevant content
   */
  private async searchConversations(
    query: string,
    userId: string,
    limit: number
  ): Promise<RetrievedContent[]> {
    try {
      const conversations = await this.dbService.query(
        `SELECT cm.id, cm.content, cm.role, cm.created_at, cs.id as session_id, cs.title
         FROM chat_messages cm
         JOIN chat_sessions cs ON cm.session_id = cs.id
         WHERE cs.user_id = ? 
           AND cm.content LIKE ? 
           AND cm.created_at > datetime('now', '-30 days')
         ORDER BY cm.created_at DESC
         LIMIT ?`,
        [userId, `%${query}%`, limit]
      );

      return conversations.map(conv => ({
        id: conv.id,
        content: conv.content,
        sourceType: 'conversation' as const,
        sourceId: conv.session_id,
        relevanceScore: 0.7, // Basic text matching score
        metadata: {
          role: conv.role,
          sessionTitle: conv.title,
          timestamp: conv.created_at
        }
      }));
    } catch (error) {
      console.warn('Failed to search conversations:', error);
      return [];
    }
  }

  /**
   * Rank and filter content based on relevance and recency
   */
  private rankAndFilterContent(
    content: RetrievedContent[],
    config: SynthesisOptions
  ): RetrievedContent[] {
    // Apply confidence threshold
    const filtered = content.filter(item => item.relevanceScore >= config.minConfidence);

    // Sort by relevance and recency
    const sorted = filtered.sort((a, b) => {
      let scoreA = a.relevanceScore;
      let scoreB = b.relevanceScore;

      // Boost recent content if prioritizeRecent is enabled
      if (config.prioritizeRecent) {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        if (a.metadata.timestamp) {
          const ageA = (now - new Date(a.metadata.timestamp).getTime()) / dayMs;
          scoreA *= Math.max(0.5, 1 - (ageA / 30)); // Decay over 30 days
        }

        if (b.metadata.timestamp) {
          const ageB = (now - new Date(b.metadata.timestamp).getTime()) / dayMs;
          scoreB *= Math.max(0.5, 1 - (ageB / 30));
        }
      }

      return scoreB - scoreA;
    });

    // Remove duplicates and take top sources
    const unique = this.removeDuplicateContent(sorted);
    return unique.slice(0, config.maxSources);
  }

  /**
   * Remove duplicate or highly similar content
   */
  private removeDuplicateContent(content: RetrievedContent[]): RetrievedContent[] {
    const unique: RetrievedContent[] = [];
    
    for (const item of content) {
      const isDuplicate = unique.some(existing => {
        // Simple similarity check based on content overlap
        const overlap = this.calculateTextOverlap(item.content, existing.content);
        return overlap > 0.8; // 80% similarity threshold
      });

      if (!isDuplicate) {
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * Calculate text overlap between two strings
   */
  private calculateTextOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Build optimal context within token limits
   */
  private buildOptimalContext(
    content: RetrievedContent[],
    config: SynthesisOptions
  ): { context: string; sources: RetrievedContent[]; tokenCount: number } {
    const sources: RetrievedContent[] = [];
    const contextParts: string[] = [];
    let tokenCount = 0;

    for (const item of content) {
      const itemTokens = this.estimateTokens(item.content);
      
      if (tokenCount + itemTokens <= config.contextWindow) {
        sources.push(item);
        contextParts.push(`[Source: ${item.sourceType}] ${item.content}`);
        tokenCount += itemTokens;
      } else {
        // Try to include partial content if there's remaining space
        const remainingTokens = config.contextWindow - tokenCount;
        if (remainingTokens > 100) { // Minimum useful content
          const truncated = this.truncateToTokens(item.content, remainingTokens);
          sources.push({ ...item, content: truncated });
          contextParts.push(`[Source: ${item.sourceType}] ${truncated}...`);
          tokenCount += remainingTokens;
        }
        break;
      }
    }

    return {
      context: contextParts.join('\n\n'),
      sources,
      tokenCount
    };
  }

  /**
   * Generate synthesis using Gemini
   */
  private async generateSynthesis(
    query: string,
    context: string,
    config: SynthesisOptions
  ): Promise<string> {
    const styleInstructions = {
      academic: 'in a formal, academic tone with proper citations',
      conversational: 'in a friendly, conversational tone',
      concise: 'concisely and to the point',
      detailed: 'with comprehensive detail and examples'
    };

    const typeInstructions = {
      answer: 'Answer the following question',
      summary: 'Provide a comprehensive summary of',
      comparison: 'Compare and contrast the information about',
      explanation: 'Explain in detail',
      analysis: 'Analyze and provide insights about'
    };

    const prompt = `${typeInstructions[config.synthesisType]} ${styleInstructions[config.responseStyle]}.

Question/Topic: ${query}

Available Context:
${context}

Please provide a response that:
1. Directly addresses the question or topic
2. Synthesizes information from multiple sources when relevant
3. Maintains accuracy and avoids speculation beyond the provided context
4. Uses ${config.responseStyle} language appropriate for a student
5. Acknowledges when information is incomplete or uncertain

Response:`;

    try {
      // Use Gemini API to generate synthesis
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3, // Lower temperature for more factual responses
            maxOutputTokens: 1000,
            topP: 0.9
          }
        })
      });

      const data = await response.json();
      
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error('Synthesis generation failed:', error);
      // Fallback to simple context concatenation
      return `Based on the available information:\n\n${context.substring(0, 800)}...`;
    }
  }

  /**
   * Create source attribution information
   */
  private createSourceAttribution(sources: RetrievedContent[]): SourceAttribution[] {
    return sources.map(source => ({
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      relevanceScore: source.relevanceScore,
      excerpt: source.content.substring(0, 200) + (source.content.length > 200 ? '...' : ''),
      ...(source.metadata.pageNumber && { pageNumber: source.metadata.pageNumber }),
      ...(source.metadata.timestamp && { timestamp: new Date(source.metadata.timestamp).getTime() }),
      ...(source.metadata.url && { url: source.metadata.url })
    }));
  }

  /**
   * Calculate confidence score for the synthesis
   */
  private calculateConfidence(contextData: any, synthesizedContent: string): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on number of sources
    confidence += Math.min(0.3, contextData.sources.length * 0.05);

    // Boost confidence based on source relevance
    const avgRelevance = contextData.sources.reduce((sum: number, s: any) => sum + s.relevanceScore, 0) / contextData.sources.length;
    confidence += avgRelevance * 0.3;

    // Penalize if synthesis is very short (might indicate lack of information)
    if (synthesizedContent.length < 100) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough approximation: 1 token ≈ 4 characters
  }

  /**
   * Truncate text to approximate token count
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    
    // Try to cut at sentence boundary
    const truncated = text.substring(0, maxChars);
    const lastSentence = truncated.lastIndexOf('.');
    
    return lastSentence > maxChars * 0.8 
      ? truncated.substring(0, lastSentence + 1)
      : truncated;
  }

  /**
   * Log synthesis analytics
   */
  private async logSynthesisAnalytics(
    query: string,
    result: SynthesisResult,
    userId: string
  ): Promise<void> {
    try {
      await this.dbService.execute(
        `INSERT INTO synthesis_analytics 
         (id, user_id, query_text, synthesis_type, sources_used, confidence_score, 
          processing_time_ms, response_style, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          userId,
          query,
          result.synthesisType,
          result.metadata.sourcesUsed,
          result.confidence,
          result.processingTime,
          'conversational', // Default for now
          new Date().toISOString()
        ]
      );
    } catch (error) {
      console.warn('Failed to log synthesis analytics:', error);
    }
  }

  /**
   * Create memory from conversation thread
   */
  async createMemoryFromConversation(
    sessionId: string,
    userId: string,
    options: {
      includeSystemMessages?: boolean;
      summarizeIfLong?: boolean;
      tags?: string[];
    } = {}
  ): Promise<string> {
    try {
      // Get conversation messages
      const messages = await this.dbService.query(
        `SELECT cm.*, cs.title, cs.course_id 
         FROM chat_messages cm
         JOIN chat_sessions cs ON cm.session_id = cs.id
         WHERE cs.id = ? AND cs.user_id = ?
         ORDER BY cm.created_at ASC`,
        [sessionId, userId]
      );

      if (messages.length === 0) {
        throw createError('No messages found in conversation', 404);
      }

      // Filter messages if needed
      const filteredMessages = options.includeSystemMessages 
        ? messages 
        : messages.filter((m: any) => m.role !== 'system');

      // Build conversation content
      const conversationText = filteredMessages
        .map((m: any) => `[${m.role}]: ${m.content}`)
        .join('\n\n');

      // Summarize if conversation is very long
      let finalContent = conversationText;
      if (options.summarizeIfLong && conversationText.length > 3000) {
        finalContent = await this.summarizeConversation(conversationText);
      }

      // Create memory
      const session = messages[0];
      const memoryId = await this.memoryService.createMemory(userId, {
        content: finalContent,
        sourceType: 'conversation',
        sourceId: sessionId,
        containerTags: options.tags || [],
        metadata: {
          sessionTitle: session.title,
          courseId: session.course_id,
          messageCount: filteredMessages.length,
          conversationDate: messages[0].created_at,
          participants: [...new Set(messages.map((m: any) => m.role))],
          originalLength: conversationText.length,
          wasSummarized: finalContent !== conversationText
        }
      });

      return memoryId.id;
    } catch (error) {
      console.error('Failed to create memory from conversation:', error);
      throw error;
    }
  }

  /**
   * Summarize a long conversation using AI
   */
  private async summarizeConversation(conversationText: string): Promise<string> {
    const prompt = `Please summarize this conversation, preserving key information, questions asked, and important insights:

${conversationText}

Summary:`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      });

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || conversationText;
    } catch (error) {
      console.warn('Conversation summarization failed:', error);
      return conversationText; // Return original if summarization fails
    }
  }
}

// Supporting interfaces
interface RetrievedContent {
  id: string;
  content: string;
  sourceType: 'document' | 'web' | 'conversation' | 'audio' | 'memory';
  sourceId: string;
  relevanceScore: number;
  metadata: Record<string, any>;
}