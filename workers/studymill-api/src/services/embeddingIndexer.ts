import { VectorService, VectorDocument } from './vector';
import { DatabaseService } from './database';
import { DocumentChunk } from './parseExtract';
import { createError } from '../middleware/error';

export interface IndexingJob {
  id: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  chunksTotal: number;
  chunksProcessed: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface IndexingOptions {
  skipExisting?: boolean;
  batchSize?: number;
  costLimit?: number; // Maximum cost in USD
}

export interface IndexingStats {
  totalChunks: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  duplicatesSkipped: number;
  totalCost: number;
  processingTime: number;
}

export class EmbeddingIndexerService {
  private static readonly DEFAULT_BATCH_SIZE = 50;
  private static readonly MAX_BATCH_SIZE = 100;
  private static readonly DEDUPLICATION_ENABLED = true;

  constructor(
    private vectorService: VectorService,
    private dbService: DatabaseService
  ) {}

  /**
   * Index document chunks for vector search
   */
  async indexDocumentChunks(
    documentId: string,
    chunks: DocumentChunk[],
    options: IndexingOptions = {}
  ): Promise<IndexingStats> {
    const {
      skipExisting = true,
      batchSize = EmbeddingIndexerService.DEFAULT_BATCH_SIZE,
      costLimit = 10.0 // $10 default limit
    } = options;

    if (chunks.length === 0) {
      throw createError('No chunks provided for indexing', 400);
    }

    const startTime = Date.now();
    let totalCost = 0;
    let successfulEmbeddings = 0;
    let failedEmbeddings = 0;
    let duplicatesSkipped = 0;

    try {
      // Create indexing job record
      const jobId = crypto.randomUUID();
      const job: IndexingJob = {
        id: jobId,
        documentId,
        status: 'processing',
        progress: 0,
        chunksTotal: chunks.length,
        chunksProcessed: 0,
        startedAt: new Date().toISOString()
      };

      console.log(`Starting indexing job ${jobId} for document ${documentId} with ${chunks.length} chunks`);

      // Prepare chunks for embedding
      const chunksToProcess = await this.prepareChunksForEmbedding(chunks, skipExisting);
      duplicatesSkipped = chunks.length - chunksToProcess.length;

      if (chunksToProcess.length === 0) {
        console.log('All chunks already indexed, skipping');
        return {
          totalChunks: chunks.length,
          successfulEmbeddings: 0,
          failedEmbeddings: 0,
          duplicatesSkipped,
          totalCost: 0,
          processingTime: Date.now() - startTime
        };
      }

      // Process chunks in batches
      const validatedBatchSize = Math.min(batchSize, EmbeddingIndexerService.MAX_BATCH_SIZE);
      const batches = this.createBatches(chunksToProcess, validatedBatchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          // Check cost limit
          if (totalCost >= costLimit) {
            console.warn(`Cost limit reached: $${totalCost.toFixed(4)} >= $${costLimit}`);
            break;
          }

          // Generate embeddings for batch
          const texts = batch.map(chunk => chunk.content);
          const embeddingResponse = await this.vectorService.generateEmbeddings(texts, jobId);
          
          totalCost += embeddingResponse.cost || 0;

          // Prepare vector documents
          const vectorDocuments: VectorDocument[] = batch.map((chunk, index) => ({
            id: chunk.id,
            values: embeddingResponse.embeddings[index],
            metadata: {
              document_id: chunk.documentId,
              content_type: chunk.contentType,
              page_number: chunk.pageNumber,
              chunk_index: chunk.chunkIndex,
              character_count: chunk.characterCount
            }
          }));

          // Insert into vector index and database
          await this.insertEmbeddings(batch, vectorDocuments);

          successfulEmbeddings += batch.length;
          job.chunksProcessed += batch.length;
          job.progress = Math.round((job.chunksProcessed / job.chunksTotal) * 100);

          console.log(`Processed batch ${i + 1}/${batches.length}: ${batch.length} chunks, cost: $${embeddingResponse.cost?.toFixed(4) || 0}`);

        } catch (error) {
          console.error(`Batch ${i + 1} failed:`, error);
          failedEmbeddings += batch.length;
          
          // Continue with next batch instead of failing completely
          continue;
        }
      }

      // Complete the job
      job.status = failedEmbeddings === 0 ? 'completed' : 'failed';
      job.completedAt = new Date().toISOString();
      job.error = failedEmbeddings > 0 ? `${failedEmbeddings} chunks failed to process` : undefined;

      const processingTime = Date.now() - startTime;
      
      console.log(`Indexing job ${jobId} completed: ${successfulEmbeddings} successful, ${failedEmbeddings} failed, cost: $${totalCost.toFixed(4)}, time: ${processingTime}ms`);

      return {
        totalChunks: chunks.length,
        successfulEmbeddings,
        failedEmbeddings,
        duplicatesSkipped,
        totalCost,
        processingTime
      };

    } catch (error) {
      console.error('Indexing failed:', error);
      throw createError('Document indexing failed', 500, { originalError: error.message });
    }
  }

  /**
   * Remove document from vector index
   */
  async removeDocumentFromIndex(documentId: string): Promise<void> {
    try {
      // Get all chunk IDs for the document
      const result = await this.dbService.db.prepare(`
        SELECT id FROM document_embeddings WHERE document_id = ?
      `).bind(documentId).all();

      const chunkIds = (result.results as any[]).map(row => row.id);

      if (chunkIds.length === 0) {
        console.log(`No embeddings found for document ${documentId}`);
        return;
      }

      // Remove from vector index
      await this.vectorService.deleteVectors(chunkIds);

      // Remove from database
      await this.dbService.db.prepare(`
        DELETE FROM document_embeddings WHERE document_id = ?
      `).bind(documentId).run();

      console.log(`Removed ${chunkIds.length} embeddings for document ${documentId}`);

    } catch (error) {
      console.error('Failed to remove document from index:', error);
      throw createError('Failed to remove document from search index', 500);
    }
  }

  /**
   * Get indexing status for a document
   */
  async getIndexingStatus(documentId: string): Promise<{
    isIndexed: boolean;
    chunkCount: number;
    indexedAt?: string;
    embeddingCount: number;
  }> {
    try {
      const result = await this.dbService.db.prepare(`
        SELECT 
          COUNT(*) as chunk_count,
          MAX(indexed_at) as last_indexed
        FROM document_embeddings 
        WHERE document_id = ?
      `).bind(documentId).first();

      const data = result as any;
      const chunkCount = data?.chunk_count || 0;

      return {
        isIndexed: chunkCount > 0,
        chunkCount,
        indexedAt: data?.last_indexed || undefined,
        embeddingCount: chunkCount
      };

    } catch (error) {
      console.error('Failed to get indexing status:', error);
      return {
        isIndexed: false,
        chunkCount: 0,
        embeddingCount: 0
      };
    }
  }

  /**
   * Bulk reindex documents (for maintenance)
   */
  async reindexDocuments(
    documentIds: string[],
    options: IndexingOptions = {}
  ): Promise<Record<string, IndexingStats>> {
    const results: Record<string, IndexingStats> = {};

    for (const documentId of documentIds) {
      try {
        // Get document chunks from the document processing system
        const chunks = await this.getDocumentChunks(documentId);
        
        if (chunks.length === 0) {
          console.warn(`No chunks found for document ${documentId}`);
          continue;
        }

        // Remove existing embeddings
        await this.removeDocumentFromIndex(documentId);

        // Reindex
        const stats = await this.indexDocumentChunks(documentId, chunks, options);
        results[documentId] = stats;

      } catch (error) {
        console.error(`Failed to reindex document ${documentId}:`, error);
        results[documentId] = {
          totalChunks: 0,
          successfulEmbeddings: 0,
          failedEmbeddings: 1,
          duplicatesSkipped: 0,
          totalCost: 0,
          processingTime: 0
        };
      }
    }

    return results;
  }

  /**
   * Get embedding usage statistics
   */
  async getEmbeddingUsageStats(options: {
    startDate?: string;
    endDate?: string;
    documentId?: string;
  } = {}): Promise<{
    totalEmbeddings: number;
    totalCost: number;
    averageCostPerEmbedding: number;
    embeddingsByType: Record<string, number>;
    costByDay: Array<{ date: string; cost: number; count: number }>;
  }> {
    try {
      const { startDate, endDate, documentId } = options;
      
      const conditions: string[] = [];
      const params: any[] = [];

      if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('created_at <= ?');
        params.push(endDate);
      }

      if (documentId) {
        conditions.push('document_id = ?');
        params.push(documentId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get overall stats
      const overallResult = await this.dbService.db.prepare(`
        SELECT 
          COUNT(*) as total_embeddings,
          SUM(api_cost_usd) as total_cost,
          AVG(api_cost_usd) as avg_cost
        FROM embedding_usage
        ${whereClause}
      `).bind(...params).first();

      // Get stats by operation type
      const typeResult = await this.dbService.db.prepare(`
        SELECT 
          operation_type,
          COUNT(*) as count
        FROM embedding_usage
        ${whereClause}
        GROUP BY operation_type
      `).bind(...params).all();

      // Get daily cost breakdown
      const dailyResult = await this.dbService.db.prepare(`
        SELECT 
          DATE(created_at) as date,
          SUM(api_cost_usd) as cost,
          COUNT(*) as count
        FROM embedding_usage
        ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).bind(...params).all();

      const overall = overallResult as any;
      const embeddingsByType: Record<string, number> = {};
      (typeResult.results as any[]).forEach(row => {
        embeddingsByType[row.operation_type] = row.count;
      });

      return {
        totalEmbeddings: overall?.total_embeddings || 0,
        totalCost: overall?.total_cost || 0,
        averageCostPerEmbedding: overall?.avg_cost || 0,
        embeddingsByType,
        costByDay: (dailyResult.results as any[]).map(row => ({
          date: row.date,
          cost: row.cost,
          count: row.count
        }))
      };

    } catch (error) {
      console.error('Failed to get embedding usage stats:', error);
      throw createError('Failed to get embedding statistics', 500);
    }
  }

  /**
   * Private helper methods
   */
  private async prepareChunksForEmbedding(
    chunks: DocumentChunk[],
    skipExisting: boolean
  ): Promise<DocumentChunk[]> {
    if (!skipExisting || !EmbeddingIndexerService.DEDUPLICATION_ENABLED) {
      return chunks;
    }

    // Get content hashes for deduplication
    const chunksWithHashes = await Promise.all(
      chunks.map(async chunk => ({
        ...chunk,
        contentHash: await this.generateContentHash(chunk.content)
      }))
    );

    // Check which chunks already exist
    const existingHashes = await this.getExistingContentHashes(
      chunksWithHashes.map(c => c.contentHash)
    );

    // Filter out duplicates
    return chunksWithHashes.filter(chunk => !existingHashes.has(chunk.contentHash));
  }

  private async insertEmbeddings(
    chunks: DocumentChunk[],
    vectorDocuments: VectorDocument[]
  ): Promise<void> {
    try {
      // Insert vectors into Vectorize
      await this.vectorService.insertVectors(vectorDocuments);

      // Insert metadata into database
      const now = new Date().toISOString();
      const batch = chunks.map((chunk, index) => {
        const contentHash = this.generateContentHashSync(chunk.content);
        
        return this.dbService.db.prepare(`
          INSERT INTO document_embeddings (
            id, document_id, course_id, document_type, chunk_text, 
            chunk_index, page_number, content_hash, token_count, 
            created_at, indexed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          chunk.id,
          chunk.documentId,
          chunk.metadata?.courseId || '',
          chunk.contentType,
          chunk.content,
          chunk.chunkIndex,
          chunk.pageNumber || null,
          contentHash,
          Math.ceil(chunk.content.length / 4), // Rough token estimate
          now,
          now
        );
      });

      await this.dbService.db.batch(batch);

    } catch (error) {
      console.error('Failed to insert embeddings:', error);
      throw error;
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateContentHashSync(content: string): string {
    // Simple hash for synchronous use (less secure but faster)
    let hash = 0;
    const str = content.trim().toLowerCase();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private async getExistingContentHashes(hashes: string[]): Promise<Set<string>> {
    if (hashes.length === 0) {
      return new Set();
    }

    try {
      const placeholders = hashes.map(() => '?').join(',');
      const result = await this.dbService.db.prepare(`
        SELECT DISTINCT content_hash FROM document_embeddings 
        WHERE content_hash IN (${placeholders})
      `).bind(...hashes).all();

      return new Set((result.results as any[]).map(row => row.content_hash));

    } catch (error) {
      console.warn('Failed to check existing hashes:', error);
      return new Set(); // Return empty set to continue processing
    }
  }

  private async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    try {
      // This should integrate with your existing document processing system
      // For now, we'll get chunks from the document_chunks table
      const result = await this.dbService.db.prepare(`
        SELECT 
          id,
          document_id,
          chunk_index,
          content_text as content,
          content_type,
          page_number,
          character_count
        FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_index
      `).bind(documentId).all();

      return (result.results as any[]).map(row => ({
        id: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        contentType: row.content_type,
        pageNumber: row.page_number,
        characterCount: row.character_count,
        metadata: {}
      }));

    } catch (error) {
      console.error('Failed to get document chunks:', error);
      throw createError('Failed to retrieve document chunks', 500);
    }
  }
}