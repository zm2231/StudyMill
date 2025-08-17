import { DatabaseService } from './database';
import { createError } from '../middleware/error';

export interface Document {
  id: string;
  course_id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  r2_key: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadDocumentData {
  courseId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  documentType?: 'syllabus' | 'lecture' | 'assignment' | 'reading' | 'other';
}

export class DocumentService {
  private static readonly ALLOWED_FILE_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'text/plain', // .txt
    'text/markdown', // .md
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp'
  ]);

  private static readonly ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.docx', '.pptx', '.txt', '.md', '.jpg', '.jpeg', '.png', '.gif', '.webp'
  ]);

  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  constructor(
    private dbService: DatabaseService,
    private r2Bucket: R2Bucket
  ) {}

  get db() {
    return this.dbService.db;
  }

  /**
   * Validate file upload requirements
   */
  validateFile(filename: string, fileType: string, fileSize: number): void {
    // Check file size
    if (fileSize > DocumentService.MAX_FILE_SIZE) {
      createError('File size exceeds 50MB limit', 400, { 
        field: 'file',
        maxSize: '50MB',
        actualSize: `${Math.round(fileSize / 1024 / 1024)}MB`
      });
    }

    // Check file type
    if (!DocumentService.ALLOWED_FILE_TYPES.has(fileType)) {
      createError('File type not supported', 400, { 
        field: 'file',
        allowedTypes: Array.from(DocumentService.ALLOWED_FILE_TYPES),
        receivedType: fileType
      });
    }

    // Check file extension
    const extension = this.getFileExtension(filename);
    if (!DocumentService.ALLOWED_EXTENSIONS.has(extension.toLowerCase())) {
      createError('File extension not supported', 400, { 
        field: 'filename',
        allowedExtensions: Array.from(DocumentService.ALLOWED_EXTENSIONS),
        receivedExtension: extension
      });
    }

    // Additional validation for specific file types
    if (fileType === 'text/markdown' && !extension.toLowerCase().includes('.md')) {
      createError('Markdown files must have .md extension', 400);
    }
  }

  /**
   * Upload document to R2 and store metadata
   */
  async uploadDocument(
    userId: string, 
    data: UploadDocumentData, 
    fileBuffer: ArrayBuffer
  ): Promise<Document> {
    // Validate input
    this.validateFile(data.filename, data.fileType, data.fileSize);

    // Verify course belongs to user
    const course = await this.dbService.getCourseById(data.courseId, userId);
    if (!course) {
      createError('Course not found', 404);
    }

    // Generate document ID and R2 key
    const documentId = 'doc_' + crypto.randomUUID();
    const r2Key = this.generateR2Key(userId, data.courseId, documentId, data.filename);

    try {
      // Upload to R2
      await this.r2Bucket.put(r2Key, fileBuffer, {
        httpMetadata: {
          contentType: data.fileType,
          contentDisposition: `attachment; filename="${data.filename}"`
        },
        customMetadata: {
          userId,
          courseId: data.courseId,
          documentId,
          uploadedAt: new Date().toISOString()
        }
      });

      // Store metadata in database
      const now = new Date().toISOString();
      const result = await this.db.prepare(`
        INSERT INTO documents (
          id, course_id, user_id, filename, file_type, file_size, 
          r2_key, processing_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        documentId, data.courseId, userId, data.filename, data.fileType,
        data.fileSize, r2Key, 'pending', now, now
      ).run();

      if (!result.success) {
        // Cleanup R2 if database insert failed
        await this.r2Bucket.delete(r2Key);
        throw new Error('Failed to store document metadata');
      }

      return {
        id: documentId,
        course_id: data.courseId,
        user_id: userId,
        filename: data.filename,
        file_type: data.fileType,
        file_size: data.fileSize,
        r2_key: r2Key,
        processing_status: 'pending',
        created_at: now,
        updated_at: now
      };

    } catch (error) {
      // Cleanup on any error
      try {
        await this.r2Bucket.delete(r2Key);
      } catch (cleanupError) {
        console.error('Failed to cleanup R2 object after error:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Get document metadata by ID
   */
  async getDocument(documentId: string, userId: string): Promise<Document | null> {
    const result = await this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN courses c ON d.course_id = c.id
      WHERE d.id = ? AND c.user_id = ?
    `).bind(documentId, userId).first();

    return result as Document | null;
  }

  /**
   * Get documents for a course
   */
  async getCourseDocuments(courseId: string, userId: string): Promise<Document[]> {
    // Verify course belongs to user
    const course = await this.dbService.getCourseById(courseId, userId);
    if (!course) {
      createError('Course not found', 404);
    }

    const result = await this.db.prepare(`
      SELECT * FROM documents 
      WHERE course_id = ? 
      ORDER BY created_at DESC
    `).bind(courseId).all();

    return result.results as Document[];
  }

  /**
   * Generate signed URL for document access
   */
  async generateSignedUrl(
    documentId: string, 
    userId: string, 
    expiresIn: number = 3600 // 1 hour default
  ): Promise<string> {
    const document = await this.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    // Generate signed URL for R2 object
    const signedUrl = await this.r2Bucket.get(document.r2_key, {
      onlyIf: {
        // Add conditional check to ensure object exists
      }
    });

    if (!signedUrl) {
      createError('Document file not found in storage', 404);
    }

    // For now, return a placeholder URL structure
    // In production, you'd implement proper signed URL generation
    return `/api/v1/documents/${documentId}/download`;
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.getDocument(documentId, userId);
    if (!document) {
      createError('Document not found', 404);
    }

    try {
      // Delete from R2
      await this.r2Bucket.delete(document.r2_key);

      // Delete from database
      const result = await this.db.prepare(`
        DELETE FROM documents WHERE id = ?
      `).bind(documentId).run();

      if (!result.success) {
        throw new Error('Failed to delete document metadata');
      }

    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Update document processing status
   */
  async updateProcessingStatus(
    documentId: string, 
    status: Document['processing_status'],
    error?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      UPDATE documents 
      SET processing_status = ?, processing_error = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, error || null, now, documentId).run();
  }

  /**
   * Get user's total storage usage
   */
  async getUserStorageUsage(userId: string): Promise<number> {
    const result = await this.db.prepare(`
      SELECT SUM(file_size) as total_size
      FROM documents d
      JOIN courses c ON d.course_id = c.id
      WHERE c.user_id = ?
    `).bind(userId).first();

    return (result as any)?.total_size || 0;
  }

  /**
   * Private helper methods
   */
  private generateR2Key(userId: string, courseId: string, documentId: string, filename: string): string {
    const extension = this.getFileExtension(filename);
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `documents/${userId}/${courseId}/${documentId}/${sanitizedFilename}`;
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  /**
   * Get supported file types for client validation
   */
  static getSupportedFileTypes(): string[] {
    return Array.from(DocumentService.ALLOWED_FILE_TYPES);
  }

  static getSupportedExtensions(): string[] {
    return Array.from(DocumentService.ALLOWED_EXTENSIONS);
  }

  static getMaxFileSize(): number {
    return DocumentService.MAX_FILE_SIZE;
  }
}