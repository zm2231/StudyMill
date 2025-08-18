import { ParseExtractService, DocumentChunk } from './parseExtract';
import { UnifiedDocumentProcessor, UnifiedProcessingResult } from './unifiedDocumentProcessor';
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
  processingMode?: 'basic' | 'premium' | 'auto';
  costEstimate?: number;
  actualCost?: number;
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
  private unifiedProcessor: UnifiedDocumentProcessor;
  private vectorService: VectorService;
  private embeddingIndexerService: EmbeddingIndexerService;
  private useHybridProcessing: boolean;

  constructor(
    private dbService: DatabaseService,
    private documentService: DocumentService,
    private r2Bucket: R2Bucket,
    private vectorizeIndex: VectorizeIndex,
    parseExtractApiKey: string,
    aiBinding: any
  ) {
    this.parseExtractService = new ParseExtractService(parseExtractApiKey);
    this.unifiedProcessor = new UnifiedDocumentProcessor(parseExtractApiKey, r2Bucket, dbService);
    this.vectorService = new VectorService(aiBinding, vectorizeIndex, dbService);
    this.embeddingIndexerService = new EmbeddingIndexerService(this.vectorService, dbService);
    
    // Feature flag: Use hybrid processing by default
    this.useHybridProcessing = process.env.USE_HYBRID_PROCESSING !== 'false';
  }

  /**
   * Queue a document for processing with user-selected mode
   */
  async queueDocumentProcessing(
    documentId: string, 
    userId: string, 
    processingMode: 'basic' | 'premium' | 'auto' = 'auto'
  ): Promise<ProcessingJob> {
    // Verify document exists and belongs to user
    const document = await this.documentService.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    // Check if document type is processable
    const isProcessable = this.useHybridProcessing 
      ? this.isProcessableFileType(document.file_type)
      : ParseExtractService.isProcessableFileType(document.file_type);
      
    if (!isProcessable) {
      createError('Document type not supported for processing', 400, {
        supportedTypes: this.useHybridProcessing 
          ? ['PDF', 'DOCX', 'Images'] 
          : ['PDF', 'DOCX', 'Images']
      });
    }

    // Determine actual processing mode and cost estimate
    const { actualMode, costEstimate, reasoning } = await this.determineProcessingMode(
      document, 
      processingMode
    );

    // Create processing job
    const jobId = 'job_' + crypto.randomUUID();
    const job: ProcessingJob = {
      id: jobId,
      documentId,
      status: 'pending',
      progress: 0,
      startedAt: new Date().toISOString(),
      processingMode: actualMode,
      costEstimate
    };

    // Update document status to processing
    await this.documentService.updateProcessingStatus(documentId, 'processing');

    // Start processing (in a real implementation, this would be queued)
    this.processDocumentAsync(job, document.r2_key, document.file_type, document.filename, userId);

    return job;
  }

  /**
   * Process a document asynchronously
   */
  private async processDocumentAsync(
    job: ProcessingJob, 
    r2Key: string, 
    fileType: string, 
    fileName: string,
    userId?: string
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

      // Process with unified processor (hybrid strategy)
      let processingResult: UnifiedProcessingResult;
      
      if (this.useHybridProcessing) {
        // Determine processing options based on mode
        const processingOptions = {
          userId: userId || job.documentId, // Use provided userId or fallback to documentId
          preserveFormatting: true,
          extractMetadata: true,
          // Force processing method based on user choice
          ...(job.processingMode === 'basic' && { preferSelfHosted: true }),
          ...(job.processingMode === 'premium' && { requireAdvancedFeatures: true })
        };

        processingResult = await this.unifiedProcessor.processDocument(
          fileBuffer,
          fileType,
          fileName,
          processingOptions
        );
      } else {
        // Fallback to ParseExtract
        const parseResult = await this.parseExtractService.processDocument(
          fileBuffer, 
          fileType, 
          fileName
        );
        
        if (!parseResult.success) {
          throw new Error(parseResult.error || 'Processing failed');
        }
        
        // Convert ParseExtract result to unified format
        processingResult = {
          success: parseResult.success,
          isAsync: !!parseResult.jobId && !parseResult.data,
          data: parseResult.data ? {
            text: parseResult.data.text,
            pages: parseResult.data.pages,
            tables: parseResult.data.tables,
            images: parseResult.data.images,
            metadata: parseResult.data.metadata || {},
            processingTime: 0
          } : undefined,
          error: parseResult.error
        };
      }

      if (!processingResult.success) {
        throw new Error(processingResult.error || 'Processing failed');
      }

      job.progress = 40;

      // Handle async processing if needed
      let finalResult = processingResult;
      if (processingResult.isAsync && processingResult.data?.jobId && !finalResult.data?.text) {
        console.log(`Waiting for async processing job: ${processingResult.data.jobId}`);
        
        // Poll for completion (in production, this would be handled by a queue)
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max wait time
        
        while (attempts < maxAttempts) {
          await this.delay(10000); // Wait 10 seconds between checks
          
          // Check status using unified processor
          const statusResult = await this.unifiedProcessor.asyncProcessor.checkJobStatus(
            processingResult.data.jobId, 
            userId || job.documentId // Use provided userId or fallback to documentId
          );
          
          if (statusResult.success && statusResult.data?.status === 'completed') {
            finalResult = {
              success: true,
              isAsync: false,
              data: statusResult.data.result ? JSON.parse(statusResult.data.result) : undefined
            };
            break;
          } else if (statusResult.data?.status === 'failed') {
            throw new Error(statusResult.error || 'Async processing failed');
          }
          
          attempts++;
          job.progress = 40 + (attempts * 20 / maxAttempts); // Progress from 40% to 60%
        }
        
        if (!finalResult.data?.text) {
          throw new Error('Processing timeout - job did not complete in time');
        }
      }

      if (!finalResult.data) {
        throw new Error('No processed data received');
      }

      job.progress = 60;

      // Create content chunks using unified processor chunks or fallback
      let chunks: DocumentChunk[];
      if (finalResult.chunks && finalResult.chunks.length > 0) {
        chunks = finalResult.chunks;
      } else {
        // Fallback: create chunks from the processed text
        chunks = this.createDocumentChunks(
          job.documentId,
          finalResult.data,
          1000 // Max chunk size
        );
      }

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

      // Calculate actual cost based on processing method used
      const actualCost = this.calculateActualCost(finalResult, job.processingMode, job.costEstimate);
      
      // Complete the job
      const processingTime = Date.now() - startTime;
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.chunkCount = chunks.length;
      job.extractedText = finalResult.data.text?.substring(0, 500); // Preview
      job.actualCost = actualCost;

      // Log cost and processing analytics
      await this.logProcessingAnalytics(job, finalResult, processingTime);

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
   * Determine the actual processing mode based on user choice and file characteristics
   */
  private async determineProcessingMode(
    document: any, 
    userMode: 'basic' | 'premium' | 'auto'
  ): Promise<{
    actualMode: 'basic' | 'premium';
    costEstimate: number;
    reasoning: string;
  }> {
    const fileSize = document.file_size || 0;
    const fileName = document.filename || '';
    const fileType = document.file_type || '';

    // User explicitly chose a mode
    if (userMode === 'basic') {
      return {
        actualMode: 'basic',
        costEstimate: 0,
        reasoning: 'User selected basic processing (free)'
      };
    }

    if (userMode === 'premium') {
      const cost = this.calculatePremiumCost(fileSize, fileType);
      return {
        actualMode: 'premium',
        costEstimate: cost,
        reasoning: 'User selected premium processing for advanced features'
      };
    }

    // Auto mode: intelligent decision
    const needsPremium = this.shouldUsePremiumProcessing(fileName, fileType, fileSize);
    
    if (needsPremium) {
      const cost = this.calculatePremiumCost(fileSize, fileType);
      return {
        actualMode: 'premium',
        costEstimate: cost,
        reasoning: 'Auto-selected premium for complex document requiring tables/OCR'
      };
    }

    return {
      actualMode: 'basic',
      costEstimate: 0,
      reasoning: 'Auto-selected basic processing (suitable for text extraction)'
    };
  }

  /**
   * Calculate cost for premium processing
   */
  private calculatePremiumCost(fileSize: number, fileType: string): number {
    // Base cost per document
    let cost = 0.01; // $0.01 base

    // Size-based pricing
    const sizeInMB = fileSize / (1024 * 1024);
    if (sizeInMB > 10) {
      cost += (sizeInMB - 10) * 0.001; // $0.001 per MB over 10MB
    }

    // File type multipliers
    if (fileType.includes('image')) {
      cost *= 2; // OCR is more expensive
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Determine if document should use premium processing in auto mode
   */
  private shouldUsePremiumProcessing(fileName: string, fileType: string, fileSize: number): boolean {
    // File name patterns that suggest complex content
    const complexKeywords = [
      'financial', 'report', 'statement', 'contract', 'legal',
      'spreadsheet', 'data', 'analysis', 'chart', 'graph', 'table'
    ];
    
    const hasComplexKeyword = complexKeywords.some(keyword => 
      fileName.toLowerCase().includes(keyword)
    );

    // File types that benefit from premium processing
    const premiumBenefitTypes = [
      'image/', // OCR needed
      'vnd.ms-excel', // Complex tables
      'vnd.ms-powerpoint' // Charts and diagrams
    ];

    const benefitsFromPremium = premiumBenefitTypes.some(type => 
      fileType.includes(type)
    );

    // Large files often have complex layouts
    const isLargeFile = fileSize > 20 * 1024 * 1024; // 20MB

    return hasComplexKeyword || benefitsFromPremium || isLargeFile;
  }

  /**
   * Check if file type is processable by unified processor
   */
  private isProcessableFileType(fileType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];
    return supportedTypes.includes(fileType);
  }

  /**
   * Create document chunks from processed data
   */
  private createDocumentChunks(
    documentId: string, 
    extractedData: any, 
    maxChunkSize: number = 1000
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const text = extractedData.text || '';
    
    if (!text) {
      return chunks;
    }

    // Split text into chunks
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
        // Create chunk from current text
        chunks.push({
          id: `chunk_${documentId}_${chunkIndex}`,
          documentId,
          chunkIndex,
          content: currentChunk.trim(),
          contentType: 'text',
          characterCount: currentChunk.length,
          metadata: {
            source: 'unified-processor',
            chunkMethod: 'sentence-based'
          }
        });

        chunkIndex++;
        currentChunk = trimmedSentence + '.';
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence + '.';
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${documentId}_${chunkIndex}`,
        documentId,
        chunkIndex,
        content: currentChunk.trim(),
        contentType: 'text',
        characterCount: currentChunk.length,
        metadata: {
          source: 'unified-processor',
          chunkMethod: 'sentence-based'
        }
      });
    }

    return chunks;
  }

  /**
   * Calculate actual cost after processing
   */
  private calculateActualCost(
    result: UnifiedProcessingResult, 
    mode?: 'basic' | 'premium' | 'auto',
    estimatedCost?: number
  ): number {
    // Basic processing is always free
    if (mode === 'basic' || (!result.data?.costEstimate && !estimatedCost)) {
      return 0;
    }

    // Use actual cost from processor if available
    if (result.data?.costEstimate) {
      return result.data.costEstimate;
    }

    // Fallback to estimated cost
    return estimatedCost || 0;
  }

  /**
   * Log processing analytics for cost tracking and optimization
   */
  private async logProcessingAnalytics(
    job: ProcessingJob,
    result: UnifiedProcessingResult,
    processingTime: number
  ): Promise<void> {
    try {
      const analytics = {
        job_id: job.id,
        document_id: job.documentId,
        processing_mode: job.processingMode || 'unknown',
        estimated_cost: job.costEstimate || 0,
        actual_cost: job.actualCost || 0,
        processing_time_ms: processingTime,
        success: result.success,
        is_async: result.isAsync,
        chunk_count: job.chunkCount || 0,
        processing_method: result.data?.metadata?.processingMethod || 'unknown',
        timestamp: new Date().toISOString()
      };

      // Store analytics in database (create table if needed)
      await this.dbService.db.prepare(`
        INSERT OR IGNORE INTO processing_analytics (
          job_id, document_id, processing_mode, estimated_cost, actual_cost,
          processing_time_ms, success, is_async, chunk_count, processing_method, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        analytics.job_id,
        analytics.document_id,
        analytics.processing_mode,
        analytics.estimated_cost,
        analytics.actual_cost,
        analytics.processing_time_ms,
        analytics.success ? 1 : 0,
        analytics.is_async ? 1 : 0,
        analytics.chunk_count,
        analytics.processing_method,
        analytics.timestamp
      ).run();

      console.log('Processing analytics logged:', {
        mode: analytics.processing_mode,
        cost: `$${analytics.actual_cost}`,
        time: `${analytics.processing_time_ms}ms`,
        method: analytics.processing_method
      });

    } catch (error) {
      console.warn('Failed to log processing analytics:', error);
      // Don't fail the job if analytics logging fails
    }
  }

  /**
   * Get processing cost summary for a user
   */
  async getUserCostSummary(userId: string, days: number = 30): Promise<{
    totalCost: number;
    basicProcessingCount: number;
    premiumProcessingCount: number;
    averageCostPerDocument: number;
    costByMode: Record<string, { count: number; totalCost: number }>;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const results = await this.dbService.db.prepare(`
      SELECT 
        pa.processing_mode,
        COUNT(*) as count,
        SUM(pa.actual_cost) as total_cost,
        AVG(pa.actual_cost) as avg_cost
      FROM processing_analytics pa
      JOIN documents d ON pa.document_id = d.id
      JOIN courses c ON d.course_id = c.id
      WHERE c.user_id = ? AND pa.timestamp >= ?
      GROUP BY pa.processing_mode
    `).bind(userId, startDate).all();

    const summary = {
      totalCost: 0,
      basicProcessingCount: 0,
      premiumProcessingCount: 0,
      averageCostPerDocument: 0,
      costByMode: {} as Record<string, { count: number; totalCost: number }>
    };

    if (results.results) {
      for (const row of results.results as any[]) {
        const mode = row.processing_mode;
        const count = row.count;
        const totalCost = row.total_cost;

        summary.costByMode[mode] = { count, totalCost };
        summary.totalCost += totalCost;

        if (mode === 'basic') {
          summary.basicProcessingCount = count;
        } else if (mode === 'premium') {
          summary.premiumProcessingCount = count;
        }
      }

      const totalDocuments = summary.basicProcessingCount + summary.premiumProcessingCount;
      summary.averageCostPerDocument = totalDocuments > 0 ? summary.totalCost / totalDocuments : 0;
    }

    return summary;
  }

  /**
   * Private helper methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}