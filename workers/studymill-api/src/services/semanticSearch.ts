import { VectorService, VectorSearchResult } from './vector';
import { DatabaseService } from './database';
import { createError } from '../middleware/error';

export interface SearchFilters {
  courseId?: string;
  documentType?: string;
  documentId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SearchOptions {
  topK?: number;
  searchType?: 'semantic' | 'keyword' | 'hybrid';
  filters?: SearchFilters;
  includeMetadata?: boolean;
  userId?: string; // Required for user-based filtering
}

export interface SearchResult {
  id: string;
  score: number;
  text: string;
  documentId: string;
  courseId: string;
  documentType?: string;
  pageNumber?: number;
  chunkIndex: number;
  metadata?: Record<string, any>;
  searchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  searchType: string;
  query: string;
  filters?: SearchFilters;
}

export interface KeywordSearchResult {
  id: string;
  rank: number;
  text: string;
  documentId: string;
  courseId: string;
  documentType?: string;
  pageNumber?: number;
  chunkIndex: number;
}

export class SemanticSearchService {
  private static readonly DEFAULT_TOP_K = 10;
  private static readonly RRF_CONSTANT = 60; // Standard RRF k value
  private static readonly MAX_SEARCH_TIME_MS = 10000; // 10 second timeout

  constructor(
    private vectorService: VectorService,
    private dbService: DatabaseService
  ) {}

  /**
   * Main search interface - performs semantic, keyword, or hybrid search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();
    const {
      topK = SemanticSearchService.DEFAULT_TOP_K,
      searchType = 'hybrid',
      filters = {},
      includeMetadata = true,
      userId
    } = options;

    if (!userId) {
      throw createError('User ID is required for search operations', 401);
    }

    if (!query || query.trim().length === 0) {
      throw createError('Search query is required', 400);
    }

    try {
      let results: SearchResult[] = [];

      switch (searchType) {
        case 'semantic':
          results = await this.performSemanticSearch(query, topK, filters, includeMetadata, userId);
          break;
        case 'keyword':
          results = await this.performKeywordSearch(query, topK, filters, userId);
          break;
        case 'hybrid':
          results = await this.performHybridSearch(query, topK, filters, includeMetadata, userId);
          break;
        default:
          throw createError(`Invalid search type: ${searchType}`, 400);
      }

      const searchTime = Date.now() - startTime;

      // Log search analytics
      await this.logSearchAnalytics(query, searchType, filters, results.length, searchTime);

      return {
        results,
        totalResults: results.length,
        searchTime,
        searchType,
        query,
        filters
      };

    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search using vector similarity
   */
  private async performSemanticSearch(
    query: string,
    topK: number,
    filters: SearchFilters,
    includeMetadata: boolean,
    userId: string
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const queryVector = await this.vectorService.generateQueryEmbedding(query);

    // Build filter conditions for Vectorize
    const vectorFilter = this.buildVectorFilter(filters);

    // Search vectors
    const vectorResults = await this.vectorService.searchVectors(queryVector, {
      topK,
      filter: vectorFilter,
      includeMetadata
    });

    if (vectorResults.length === 0) {
      return [];
    }

    // Get chunk metadata from database (filtered by user)
    const chunkIds = vectorResults.map(r => r.id);
    const chunks = await this.getChunksByIds(chunkIds, userId);

    // Combine vector results with chunk data
    return vectorResults.map(vectorResult => {
      const chunk = chunks.find(c => c.id === vectorResult.id);
      if (!chunk) {
        console.warn(`Chunk not found in database: ${vectorResult.id}`);
        return null;
      }

      return {
        id: vectorResult.id,
        score: vectorResult.score,
        text: chunk.chunk_text,
        documentId: chunk.document_id,
        courseId: chunk.course_id,
        documentType: chunk.document_type,
        pageNumber: chunk.page_number,
        chunkIndex: chunk.chunk_index,
        metadata: vectorResult.metadata,
        searchType: 'semantic' as const
      };
    }).filter(Boolean) as SearchResult[];
  }

  /**
   * Perform keyword search using FTS
   */
  private async performKeywordSearch(
    query: string,
    topK: number,
    filters: SearchFilters,
    userId: string
  ): Promise<SearchResult[]> {
    // Build FTS query
    const ftsQuery = this.buildFTSQuery(query);
    
    // Build filter conditions (include user filtering)
    const { whereClause, params } = this.buildFilterClause(filters, userId, 1);

    const sql = `
      SELECT 
        e.id,
        e.chunk_text,
        e.document_id,
        e.course_id,
        e.document_type,
        e.page_number,
        e.chunk_index,
        fts.rank
      FROM embeddings_fts fts
      JOIN document_embeddings e ON e.id = fts.id
      ${whereClause}
      AND fts.chunk_text MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `;

    const result = await this.dbService.db.prepare(sql)
      .bind(...params, ftsQuery, topK)
      .all();

    return (result.results as any[]).map((row, index) => ({
      id: row.id,
      score: 1.0 / (index + 1), // Simple ranking score
      text: row.chunk_text,
      documentId: row.document_id,
      courseId: row.course_id,
      documentType: row.document_type,
      pageNumber: row.page_number,
      chunkIndex: row.chunk_index,
      searchType: 'keyword' as const
    }));
  }

  /**
   * Perform hybrid search combining semantic and keyword search with RRF
   */
  private async performHybridSearch(
    query: string,
    topK: number,
    filters: SearchFilters,
    includeMetadata: boolean,
    userId: string
  ): Promise<SearchResult[]> {
    // Perform both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.performSemanticSearch(query, topK * 2, filters, includeMetadata, userId), // Get more results for better fusion
      this.performKeywordSearch(query, topK * 2, filters, userId)
    ]);

    // Apply Reciprocal Rank Fusion (RRF)
    const fusedResults = this.applyRRF(semanticResults, keywordResults);

    // Return top K results
    return fusedResults.slice(0, topK);
  }

  /**
   * Apply Reciprocal Rank Fusion algorithm to combine search results
   */
  private applyRRF(semanticResults: SearchResult[], keywordResults: SearchResult[]): SearchResult[] {
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    // Process semantic results
    semanticResults.forEach((result, index) => {
      const rrfScore = 1.0 / (SemanticSearchService.RRF_CONSTANT + index + 1);
      scoreMap.set(result.id, {
        result: { ...result, searchType: 'hybrid' as const },
        score: rrfScore
      });
    });

    // Process keyword results and combine scores
    keywordResults.forEach((result, index) => {
      const rrfScore = 1.0 / (SemanticSearchService.RRF_CONSTANT + index + 1);
      const existing = scoreMap.get(result.id);
      
      if (existing) {
        // Combine scores for documents that appear in both result sets
        existing.score += rrfScore;
      } else {
        // Add keyword-only results
        scoreMap.set(result.id, {
          result: { ...result, searchType: 'hybrid' as const },
          score: rrfScore
        });
      }
    });

    // Sort by combined RRF score and return results
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.result,
        score: item.score
      }));
  }

  /**
   * Build vector filter for Vectorize queries
   */
  private buildVectorFilter(filters: SearchFilters): Record<string, any> | undefined {
    const filter: Record<string, any> = {};

    if (filters.courseId) {
      filter.course_id = { "$eq": filters.courseId };
    }

    if (filters.documentType) {
      filter.document_type = { "$eq": filters.documentType };
    }

    if (filters.documentId) {
      filter.document_id = { "$eq": filters.documentId };
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  /**
   * Build SQL filter clause for database queries
   */
  private buildFilterClause(filters: SearchFilters, userId: string, paramOffset: number = 0): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = paramOffset;

    // CRITICAL: Always filter by user to ensure data isolation
    conditions.push(`EXISTS (
      SELECT 1 FROM documents d 
      JOIN courses c ON d.course_id = c.id 
      WHERE d.id = e.document_id AND c.user_id = ?${paramIndex++}
    )`);
    params.push(userId);

    if (filters.courseId) {
      conditions.push(`e.course_id = ?${paramIndex++}`);
      params.push(filters.courseId);
    }

    if (filters.documentType) {
      conditions.push(`e.document_type = ?${paramIndex++}`);
      params.push(filters.documentType);
    }

    if (filters.documentId) {
      conditions.push(`e.document_id = ?${paramIndex++}`);
      params.push(filters.documentId);
    }

    if (filters.dateRange) {
      conditions.push(`e.created_at >= ?${paramIndex++}`);
      params.push(filters.dateRange.start);
      conditions.push(`e.created_at <= ?${paramIndex++}`);
      params.push(filters.dateRange.end);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return { whereClause, params };
  }

  /**
   * Build FTS query string
   */
  private buildFTSQuery(query: string): string {
    // Escape special FTS characters and build phrase query
    const sanitized = query
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 0)
      .join(' ');

    return `"${sanitized}"`;
  }

  /**
   * Get chunk data by IDs with user-based filtering
   */
  private async getChunksByIds(ids: string[], userId: string): Promise<any[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      SELECT 
        e.id,
        e.chunk_text,
        e.document_id,
        e.course_id,
        e.document_type,
        e.page_number,
        e.chunk_index
      FROM document_embeddings e
      WHERE e.id IN (${placeholders})
        AND EXISTS (
          SELECT 1 FROM documents d 
          JOIN courses c ON d.course_id = c.id 
          WHERE d.id = e.document_id AND c.user_id = ?
        )
    `;

    const result = await this.dbService.db.prepare(sql).bind(...ids, userId).all();
    return result.results as any[];
  }

  /**
   * Log search analytics for monitoring and optimization
   */
  private async logSearchAnalytics(
    query: string,
    searchType: string,
    filters: SearchFilters,
    resultCount: number,
    executionTime: number,
    userId?: string
  ): Promise<void> {
    try {
      await this.dbService.db.prepare(`
        INSERT INTO search_analytics 
        (id, user_id, query_text, query_type, course_id, document_type, results_count, execution_time_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        userId || null,
        query,
        searchType,
        filters.courseId || null,
        filters.documentType || null,
        resultCount,
        executionTime,
        new Date().toISOString()
      ).run();

    } catch (error) {
      console.warn('Failed to log search analytics:', error);
      // Don't throw - analytics are optional
    }
  }

  /**
   * Get search suggestions based on query history and content
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Get popular queries that start with the input
      const result = await this.dbService.db.prepare(`
        SELECT query_text, COUNT(*) as frequency
        FROM search_analytics
        WHERE query_text LIKE ? 
        AND query_text != ?
        GROUP BY query_text
        ORDER BY frequency DESC, query_text
        LIMIT ?
      `).bind(`${query}%`, query, limit).all();

      return (result.results as any[]).map(row => row.query_text);

    } catch (error) {
      console.warn('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Get search analytics for a user or course
   */
  async getSearchAnalytics(options: {
    userId?: string;
    courseId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<{
    totalSearches: number;
    averageResults: number;
    averageExecutionTime: number;
    popularQueries: Array<{ query: string; count: number }>;
    searchTypeDistribution: Record<string, number>;
  }> {
    const { userId, courseId, startDate, endDate, limit = 10 } = options;

    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }

      if (courseId) {
        conditions.push('course_id = ?');
        params.push(courseId);
      }

      if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('created_at <= ?');
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get overall statistics
      const statsResult = await this.dbService.db.prepare(`
        SELECT 
          COUNT(*) as total_searches,
          AVG(results_count) as avg_results,
          AVG(execution_time_ms) as avg_execution_time
        FROM search_analytics
        ${whereClause}
      `).bind(...params).first();

      // Get popular queries
      const queriesResult = await this.dbService.db.prepare(`
        SELECT query_text, COUNT(*) as count
        FROM search_analytics
        ${whereClause}
        GROUP BY query_text
        ORDER BY count DESC
        LIMIT ?
      `).bind(...params, limit).all();

      // Get search type distribution
      const typesResult = await this.dbService.db.prepare(`
        SELECT query_type, COUNT(*) as count
        FROM search_analytics
        ${whereClause}
        GROUP BY query_type
      `).bind(...params).all();

      const stats = statsResult as any;
      const searchTypeDistribution: Record<string, number> = {};
      (typesResult.results as any[]).forEach(row => {
        searchTypeDistribution[row.query_type] = row.count;
      });

      return {
        totalSearches: stats?.total_searches || 0,
        averageResults: stats?.avg_results || 0,
        averageExecutionTime: stats?.avg_execution_time || 0,
        popularQueries: (queriesResult.results as any[]).map(row => ({
          query: row.query_text,
          count: row.count
        })),
        searchTypeDistribution
      };

    } catch (error) {
      console.warn('Failed to get search analytics:', error);
      return {
        totalSearches: 0,
        averageResults: 0,
        averageExecutionTime: 0,
        popularQueries: [],
        searchTypeDistribution: {}
      };
    }
  }

  /**
   * Clean up old cached queries and analytics (for maintenance)
   */
  async cleanupOldData(olderThanDays: number = 30): Promise<{
    deletedCacheEntries: number;
    deletedAnalytics: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    try {
      // Clean up old cache entries
      const cacheResult = await this.dbService.db.prepare(`
        DELETE FROM query_embeddings_cache 
        WHERE last_accessed < ?
      `).bind(cutoffISO).run();

      // Clean up old analytics (keep longer for analysis)
      const analyticsResult = await this.dbService.db.prepare(`
        DELETE FROM search_analytics 
        WHERE created_at < ?
      `).bind(cutoffISO).run();

      return {
        deletedCacheEntries: cacheResult.changes || 0,
        deletedAnalytics: analyticsResult.changes || 0
      };

    } catch (error) {
      console.error('Failed to cleanup old data:', error);
      throw createError('Cleanup operation failed', 500);
    }
  }
}