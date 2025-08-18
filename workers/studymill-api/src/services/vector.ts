import { createError } from '../middleware/error';
import { DatabaseService } from './database';

export interface EmbeddingRequest {
  texts: string[];
  batchId?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  tokenCount: number;
  cost?: number;
}

export interface VectorDocument {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

export class VectorService {
  private static readonly MAX_BATCH_SIZE = 100;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 2000;
  private static readonly EMBEDDING_DIMENSIONS = 768; // Cloudflare text embeddings
  
  // Cost estimation: Cloudflare Workers AI embeddings (included in plan)
  private static readonly COST_PER_1K_TOKENS = 0.0; // Free with Workers AI

  constructor(
    private aiBinding: any, // Cloudflare Workers AI binding
    private vectorizeIndex: VectorizeIndex,
    private dbService: DatabaseService
  ) {
    if (!aiBinding) {
      throw new Error('Cloudflare AI binding is required');
    }
  }

  /**
   * Generate embeddings for text chunks using Cloudflare Workers AI
   */
  async generateEmbeddings(texts: string[], batchId?: string): Promise<EmbeddingResponse> {
    if (texts.length === 0) {
      throw new Error('No texts provided for embedding generation');
    }

    if (texts.length > VectorService.MAX_BATCH_SIZE) {
      throw new Error(`Batch size exceeds maximum of ${VectorService.MAX_BATCH_SIZE}`);
    }

    try {
      const embeddings = await this.callCloudflareEmbeddingAPI(texts);
      const tokenCount = this.estimateTokenCount(texts);
      const cost = this.calculateCost(tokenCount);

      // Log usage for cost tracking
      await this.logEmbeddingUsage('batch_generation', tokenCount, cost, batchId);

      return {
        embeddings,
        tokenCount,
        cost
      };

    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Generate embedding for a single query with caching
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const queryHash = await this.generateHash(normalizedQuery);

    // Check cache first
    const cached = await this.getCachedQueryEmbedding(queryHash);
    if (cached) {
      await this.updateCacheAccess(queryHash);
      return cached;
    }

    // Generate new embedding
    const response = await this.generateEmbeddings([query]);
    const embedding = response.embeddings[0];

    // Cache the result
    await this.cacheQueryEmbedding(queryHash, query, embedding);

    return embedding;
  }

  /**
   * Insert vectors into Vectorize index with metadata
   */
  async insertVectors(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    try {
      // Validate vector dimensions
      for (const doc of documents) {
        if (doc.values.length !== VectorService.EMBEDDING_DIMENSIONS) {
          throw new Error(`Invalid vector dimension: expected ${VectorService.EMBEDDING_DIMENSIONS}, got ${doc.values.length}`);
        }
      }

      // Insert into Vectorize
      await this.vectorizeIndex.insert(documents);

      console.log(`Successfully inserted ${documents.length} vectors into index`);

    } catch (error) {
      console.error('Vector insertion failed:', error);
      throw this.handleVectorizeError(error);
    }
  }

  /**
   * Search vectors in Vectorize index
   */
  async searchVectors(
    queryVector: number[], 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      topK = 10,
      filter,
      includeMetadata = true
    } = options;

    try {
      if (queryVector.length !== VectorService.EMBEDDING_DIMENSIONS) {
        throw new Error(`Invalid query vector dimension: expected ${VectorService.EMBEDDING_DIMENSIONS}, got ${queryVector.length}`);
      }

      const results = await this.vectorizeIndex.query(queryVector, {
        topK,
        filter,
        returnMetadata: includeMetadata ? "all" : "none",
        returnValues: false // Don't return vector values for performance
      });

      return results.matches.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata
      }));

    } catch (error) {
      console.error('Vector search failed:', error);
      throw this.handleVectorizeError(error);
    }
  }

  /**
   * Delete vectors from index
   */
  async deleteVectors(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await this.vectorizeIndex.deleteByIds(ids);
      console.log(`Successfully deleted ${ids.length} vectors from index`);

    } catch (error) {
      console.error('Vector deletion failed:', error);
      throw this.handleVectorizeError(error);
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    vectorCount: number;
    dimensions: number;
    metric: string;
  }> {
    try {
      const stats = await this.vectorizeIndex.describe();
      return {
        vectorCount: stats.vectorsCount || 0,
        dimensions: stats.dimensions || VectorService.EMBEDDING_DIMENSIONS,
        metric: stats.metric || 'cosine'
      };

    } catch (error) {
      console.error('Failed to get index stats:', error);
      throw this.handleVectorizeError(error);
    }
  }

  /**
   * Private helper methods
   */
  private async callCloudflareEmbeddingAPI(texts: string[], retryCount = 0): Promise<number[][]> {
    try {
      // Process texts in batches for Cloudflare Workers AI
      const embeddings: number[][] = [];

      for (const text of texts) {
        const result = await this.aiBinding.run('@cf/baai/bge-base-en-v1.5', {
          text: [text]
        });

        if (!result || !result.data || !Array.isArray(result.data) || !result.data[0]) {
          throw new Error('Invalid response format from Cloudflare Workers AI');
        }

        embeddings.push(result.data[0]);
      }

      return embeddings;

    } catch (error) {
      if (retryCount < VectorService.MAX_RETRIES) {
        console.warn(`Cloudflare AI call failed, retrying (${retryCount + 1}/${VectorService.MAX_RETRIES}):`, error);
        await this.delay(VectorService.RETRY_DELAY * (retryCount + 1));
        return this.callCloudflareEmbeddingAPI(texts, retryCount + 1);
      }
      throw error;
    }
  }

  private async getCachedQueryEmbedding(queryHash: string): Promise<number[] | null> {
    try {
      const result = await this.dbService.db.prepare(`
        SELECT embedding_vector FROM query_embeddings_cache 
        WHERE query_hash = ?
      `).bind(queryHash).first();

      if (result) {
        return JSON.parse((result as any).embedding_vector);
      }
      return null;

    } catch (error) {
      console.warn('Failed to get cached embedding:', error);
      return null;
    }
  }

  private async cacheQueryEmbedding(queryHash: string, queryText: string, embedding: number[]): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.dbService.db.prepare(`
        INSERT OR REPLACE INTO query_embeddings_cache 
        (query_hash, query_text, embedding_vector, created_at, last_accessed)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        queryHash,
        queryText,
        JSON.stringify(embedding),
        now,
        now
      ).run();

    } catch (error) {
      console.warn('Failed to cache query embedding:', error);
      // Don't throw - caching is optional
    }
  }

  private async updateCacheAccess(queryHash: string): Promise<void> {
    try {
      await this.dbService.db.prepare(`
        UPDATE query_embeddings_cache 
        SET access_count = access_count + 1, last_accessed = ?
        WHERE query_hash = ?
      `).bind(new Date().toISOString(), queryHash).run();

    } catch (error) {
      console.warn('Failed to update cache access:', error);
      // Don't throw - tracking is optional
    }
  }

  private async logEmbeddingUsage(
    operationType: string, 
    tokenCount: number, 
    cost: number, 
    referenceId?: string
  ): Promise<void> {
    try {
      await this.dbService.db.prepare(`
        INSERT INTO embedding_usage 
        (id, operation_type, token_count, api_cost_usd, document_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        operationType,
        tokenCount,
        cost,
        referenceId || null,
        new Date().toISOString()
      ).run();

    } catch (error) {
      console.warn('Failed to log embedding usage:', error);
      // Don't throw - logging is optional
    }
  }

  private estimateTokenCount(texts: string[]): number {
    // Rough estimation: ~4 characters per token for English text
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private calculateCost(tokenCount: number): number {
    return (tokenCount / 1000) * VectorService.COST_PER_1K_TOKENS;
  }

  private async generateHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleApiError(error: any): Error {
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return createError('Embedding service rate limit exceeded', 429);
    }
    
    if (error.message?.includes('quota') || error.message?.includes('402')) {
      return createError('Embedding service quota exceeded', 402);
    }
    
    if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
      return createError('Embedding service authentication failed', 503);
    }
    
    return createError('Embedding generation failed', 500, { originalError: error.message });
  }

  private handleVectorizeError(error: any): Error {
    if (error.message?.includes('index not found')) {
      return createError('Vector index not found', 503);
    }
    
    if (error.message?.includes('dimension mismatch')) {
      return createError('Vector dimension mismatch', 400);
    }
    
    return createError('Vector operation failed', 500, { originalError: error.message });
  }

  /**
   * Static utility methods
   */
  static validateEmbeddingDimensions(vectors: number[][]): boolean {
    return vectors.every(vector => vector.length === VectorService.EMBEDDING_DIMENSIONS);
  }

  static normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? vector : vector.map(val => val / magnitude);
  }

  static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }
}