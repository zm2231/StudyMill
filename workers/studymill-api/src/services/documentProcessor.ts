import { ParseExtractService, DocumentChunk } from './parseExtract';
import { DocumentService } from './document';
import { DatabaseService } from './database';
import { VectorService } from './vector';
import { EmbeddingIndexerService } from './embeddingIndexer';
import { createError } from '../middleware/error';

export interface ProcessingJob {
  id: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
  chunkCount?: number;
  extractedText?: string;
}

export interface ProcessedDocument {
  documentId: string;
  extractedText: string;
  chunks: DocumentChunk[];
  tableCount: number;
  imageCount: number;
  pageCount?: number;
  processingTime: number;
}

export class DocumentProcessorService {
  private parseExtractService: ParseExtractService;
  private vectorService: VectorService;
  private embeddingIndexerService: EmbeddingIndexerService;

  constructor(
    private dbService: DatabaseService,
    private documentService: DocumentService,
    private r2Bucket: R2Bucket,
    private vectorizeIndex: VectorizeIndex,
    parseExtractApiKey: string,
    geminiApiKey: string
  ) {
    this.parseExtractService = new ParseExtractService(parseExtractApiKey);
    this.vectorService = new VectorService(geminiApiKey, vectorizeIndex, dbService);
    this.embeddingIndexerService = new EmbeddingIndexerService(this.vectorService, dbService);
  }

  /**
   * Queue a document for processing
   */
  async queueDocumentProcessing(documentId: string, userId: string): Promise<ProcessingJob> {
    // Verify document exists and belongs to user
    const document = await this.documentService.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    // Check if document type is processable
    if (!ParseExtractService.isProcessableFileType(document.file_type)) {
      createError('Document type not supported for processing', 400, {
        supportedTypes: ['PDF', 'DOCX', 'Images']
      });
    }

    // Create processing job
    const jobId = 'job_' + crypto.randomUUID();
    const job: ProcessingJob = {
      id: jobId,
      documentId,
      status: 'pending',
      progress: 0,
      startedAt: new Date().toISOString()
    };

    // Update document status to processing
    await this.documentService.updateProcessingStatus(documentId, 'processing');

    // Start processing (in a real implementation, this would be queued)
    this.processDocumentAsync(job, document.r2_key, document.file_type, document.filename);

    return job;
  }

  /**
   * Process a document asynchronously
   */
  private async processDocumentAsync(
    job: ProcessingJob, 
    r2Key: string, 
    fileType: string, 
    fileName: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Update job status
      job.status = 'processing';
      job.progress = 10;

      // Get file from R2
      const r2Object = await this.r2Bucket.get(r2Key);
      if (!r2Object) {
        throw new Error('Document file not found in storage');
      }

      const fileBuffer = await r2Object.arrayBuffer();
      job.progress = 20;

      // Process with ParseExtract
      const parseResult = await this.parseExtractService.processDocument(
        fileBuffer, 
        fileType, 
        fileName
      );

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Processing failed');
      }

      job.progress = 40;

      // If async processing, wait for completion
      let finalResult = parseResult;
      if (parseResult.jobId && !parseResult.data) {
        console.log(`Waiting for async processing job: ${parseResult.jobId}`);
        
        // Poll for completion (in production, this would be handled by a queue)
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max wait time
        
        while (attempts < maxAttempts) {
          await this.delay(10000); // Wait 10 seconds between checks
          
          const statusResult = await this.parseExtractService.checkJobStatus(parseResult.jobId);
          
          if (statusResult.success && statusResult.data) {
            finalResult = statusResult;
            break;
          } else if (statusResult.error && statusResult.error !== 'Still processing') {
            throw new Error(statusResult.error);
          }
          
          attempts++;
          job.progress = 40 + (attempts * 20 / maxAttempts); // Progress from 40% to 60%
        }
        
        if (!finalResult.data) {
          throw new Error('Processing timeout - job did not complete in time');
        }
      }

      if (!finalResult.data) {
        throw new Error('No processed data received');
      }

      job.progress = 60;

      // Create content chunks
      const chunks = this.parseExtractService.chunkContent(
        job.documentId,
        parseResult.data,
        1000 // Max chunk size
      );

      job.progress = 80;

      // Store processed content in database
      await this.storeProcessedContent(job.documentId, finalResult.data, chunks);

      job.progress = 90;

      // Generate vector embeddings for search
      try {
        console.log(`Starting vector indexing for document ${job.documentId}`);
        const indexingStats = await this.embeddingIndexerService.indexDocumentChunks(
          job.documentId,
          chunks,
          {
            skipExisting: true,
            batchSize: 25, // Smaller batches for better reliability
            costLimit: 5.0 // $5 limit per document
          }
        );

        console.log(`Vector indexing completed:`, indexingStats);
        
        // Update document with indexing info
        await this.updateDocumentIndexingStatus(job.documentId, true, indexingStats);

      } catch (indexingError) {
        console.error('Vector indexing failed:', indexingError);
        // Don't fail the entire job if indexing fails
        await this.updateDocumentIndexingStatus(job.documentId, false, null, 
          indexingError instanceof Error ? indexingError.message : 'Unknown indexing error'
        );
      }

      // Complete the job
      const processingTime = Date.now() - startTime;
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.chunkCount = chunks.length;
      job.extractedText = finalResult.data.text?.substring(0, 500); // Preview

      // Update document status
      await this.documentService.updateProcessingStatus(job.documentId, 'completed');

      console.log(`Document ${job.documentId} processed successfully in ${processingTime}ms`);

    } catch (error) {
      console.error('Document processing failed:', error);
      
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date().toISOString();

      // Update document status
      await this.documentService.updateProcessingStatus(
        job.documentId, 
        'failed', 
        job.error
      );
    }
  }

  /**
   * Store processed content in database
   */
  private async storeProcessedContent(
    documentId: string, 
    extractedData: any, 
    chunks: DocumentChunk[]
  ): Promise<void> {
    try {
      // Store main extracted content
      const contentData = {
        text: extractedData.text,
        tableCount: extractedData.tables?.length || 0,
        imageCount: extractedData.images?.length || 0,
        pageCount: extractedData.pages,
        tables: extractedData.tables,
        images: extractedData.images?.map((img: any) => ({
          page: img.page,
          description: img.description,
          hasBase64: !!img.base64
        }))
      };

      // Store in document_content table (we'll need to create this)
      await this.dbService.db.prepare(`
        INSERT OR REPLACE INTO document_content (
          document_id, extracted_text, content_data, processed_at
        ) VALUES (?, ?, ?, ?)
      `).bind(
        documentId,
        extractedData.text || '',
        JSON.stringify(contentData),
        new Date().toISOString()
      ).run();

      // Store document chunks for vector search
      for (const chunk of chunks) {
        await this.dbService.db.prepare(`
          INSERT INTO document_chunks (
            id, document_id, chunk_index, content_text, content_type,
            page_number, character_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          chunk.id,
          chunk.documentId,
          chunk.chunkIndex,
          chunk.content,
          chunk.contentType,
          chunk.pageNumber || null,
          chunk.characterCount,
          new Date().toISOString()
        ).run();
      }

    } catch (error) {
      console.error('Failed to store processed content:', error);
      throw error;
    }
  }

  /**
   * Get processing status for a document
   */
  async getProcessingStatus(documentId: string, userId: string): Promise<{
    status: string;
    progress?: number;
    error?: string;
    chunkCount?: number;
  }> {
    // Verify document belongs to user
    const document = await this.documentService.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    // Get chunk count if completed
    let chunkCount: number | undefined;
    if (document.processing_status === 'completed') {
      const result = await this.dbService.db.prepare(`
        SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?
      `).bind(documentId).first();
      chunkCount = (result as any)?.count || 0;
    }

    return {
      status: document.processing_status,
      error: document.processing_error || undefined,
      chunkCount
    };
  }

  /**
   * Get processed content for a document
   */
  async getProcessedContent(documentId: string, userId: string): Promise<{
    extractedText: string;
    tableCount: number;
    imageCount: number;
    pageCount?: number;
    chunks: DocumentChunk[];
  }> {
    // Verify document belongs to user
    const document = await this.documentService.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    if (document.processing_status !== 'completed') {
      createError('Document processing not completed', 400, {
        currentStatus: document.processing_status
      });
    }

    // Get processed content
    const contentResult = await this.dbService.db.prepare(`
      SELECT * FROM document_content WHERE document_id = ?
    `).bind(documentId).first();

    const chunksResult = await this.dbService.db.prepare(`
      SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index
    `).bind(documentId).all();

    if (!contentResult) {
      createError('Processed content not found', 404);
    }

    const contentData = JSON.parse((contentResult as any).content_data || '{}');
    
    return {
      extractedText: (contentResult as any).extracted_text || '',
      tableCount: contentData.tableCount || 0,
      imageCount: contentData.imageCount || 0,
      pageCount: contentData.pageCount,
      chunks: chunksResult.results as DocumentChunk[]
    };
  }

  /**
   * Search within processed documents
   */
  async searchDocuments(
    userId: string, 
    query: string, 
    courseId?: string,
    limit: number = 10
  ): Promise<Array<{
    documentId: string;
    fileName: string;
    chunkContent: string;
    chunkType: string;
    pageNumber?: number;
    relevanceScore: number;
  }>> {
    // Simple text search implementation
    // In production, this would use vector similarity search
    
    let sql = `
      SELECT 
        dc.document_id,
        d.filename,
        dc.content_text,
        dc.content_type,
        dc.page_number,
        (LENGTH(dc.content_text) - LENGTH(REPLACE(LOWER(dc.content_text), LOWER(?), ''))) / LENGTH(?) as relevance_score
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN courses c ON d.course_id = c.id
      WHERE c.user_id = ? 
        AND LOWER(dc.content_text) LIKE LOWER(?)
    `;
    
    const params = [query, query, userId, `%${query}%`];
    
    if (courseId) {
      sql += ' AND d.course_id = ?';
      params.push(courseId);
    }
    
    sql += ' ORDER BY relevance_score DESC LIMIT ?';
    params.push(limit.toString());

    const results = await this.dbService.db.prepare(sql).bind(...params).all();

    return (results.results as any[]).map(row => ({
      documentId: row.document_id,
      fileName: row.filename,
      chunkContent: row.content_text,
      chunkType: row.content_type,
      pageNumber: row.page_number,
      relevanceScore: row.relevance_score
    }));
  }

  /**
   * Get processing statistics for a user
   */
  async getUserProcessingStats(userId: string): Promise<{
    totalDocuments: number;
    processedDocuments: number;
    pendingDocuments: number;
    failedDocuments: number;
    totalChunks: number;
  }> {
    const stats = await this.dbService.db.prepare(`
      SELECT 
        COUNT(*) as total_documents,
        SUM(CASE WHEN d.processing_status = 'completed' THEN 1 ELSE 0 END) as processed_documents,
        SUM(CASE WHEN d.processing_status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending_documents,
        SUM(CASE WHEN d.processing_status = 'failed' THEN 1 ELSE 0 END) as failed_documents
      FROM documents d
      JOIN courses c ON d.course_id = c.id
      WHERE c.user_id = ?
    `).bind(userId).first();

    const chunkStats = await this.dbService.db.prepare(`
      SELECT COUNT(*) as total_chunks
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN courses c ON d.course_id = c.id
      WHERE c.user_id = ?
    `).bind(userId).first();

    return {
      totalDocuments: (stats as any)?.total_documents || 0,
      processedDocuments: (stats as any)?.processed_documents || 0,
      pendingDocuments: (stats as any)?.pending_documents || 0,
      failedDocuments: (stats as any)?.failed_documents || 0,
      totalChunks: (chunkStats as any)?.total_chunks || 0
    };
  }

  /**
   * Update document indexing status
   */
  private async updateDocumentIndexingStatus(
    documentId: string, 
    success: boolean, 
    stats: any,
    error?: string
  ): Promise<void> {
    try {
      // This could be added to the documents table if needed
      // For now, we'll just log the status
      console.log(`Document ${documentId} indexing ${success ? 'succeeded' : 'failed'}`, {
        stats,
        error
      });
    } catch (err) {
      console.warn('Failed to update indexing status:', err);
    }
  }

  /**
   * Get vector search status for a document
   */
  async getVectorSearchStatus(documentId: string, userId: string): Promise<{
    isIndexed: boolean;
    chunkCount: number;
    embeddingCount: number;
    indexedAt?: string;
  }> {
    // Verify document belongs to user
    const document = await this.documentService.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    return await this.embeddingIndexerService.getIndexingStatus(documentId);
  }

  /**
   * Reindex document for vector search
   */
  async reindexDocument(documentId: string, userId: string): Promise<any> {
    // Verify document belongs to user
    const document = await this.documentService.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    if (document.processing_status !== 'completed') {
      createError('Document must be processed before indexing', 400);
    }

    // Get existing chunks
    const chunksResult = await this.dbService.db.prepare(`
      SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index
    `).bind(documentId).all();

    if (!chunksResult.results || chunksResult.results.length === 0) {
      createError('No processed chunks found for document', 404);
    }

    // Convert to DocumentChunk format
    const chunks: DocumentChunk[] = (chunksResult.results as any[]).map(row => ({
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      content: row.content_text,
      contentType: row.content_type,
      pageNumber: row.page_number,
      characterCount: row.character_count,
      metadata: {}
    }));

    // Reindex
    const results = await this.embeddingIndexerService.reindexDocuments([documentId], {
      skipExisting: false, // Force reindexing
      batchSize: 25,
      costLimit: 5.0
    });

    return results[documentId];
  }

  /**
   * Private helper methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}