/**
 * Centralized error handling for document processing libraries
 * 
 * Provides consistent error handling across PDF, DOCX, and HTML processing
 */

import { PdfError, PdfProcessingError } from '../config/pdfjs-config';
import { DocxError, DocxProcessingError } from '../config/mammoth-config';
import { HtmlError, HtmlProcessingError } from '../config/html-config';
import { ProcessingError } from '../types/document-processing';

// Unified processing error types
export enum UnifiedProcessingError {
  // File validation errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // Processing errors
  PARSING_FAILED = 'PARSING_FAILED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  CHUNKING_FAILED = 'CHUNKING_FAILED',
  
  // Resource errors
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  WORKER_OVERLOADED = 'WORKER_OVERLOADED',
  
  // Content errors
  NO_CONTENT_EXTRACTED = 'NO_CONTENT_EXTRACTED',
  INSUFFICIENT_CONTENT = 'INSUFFICIENT_CONTENT',
  PASSWORD_PROTECTED = 'PASSWORD_PROTECTED',
  
  // Network/External errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR'
}

// Main processing error class
export class DocumentProcessingError extends Error {
  public readonly type: UnifiedProcessingError;
  public readonly fileName?: string;
  public readonly fileType?: string;
  public readonly stage: ProcessingError['stage'];
  public readonly originalError?: Error;
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public readonly timestamp: string;

  constructor(
    type: UnifiedProcessingError,
    message: string,
    options: {
      fileName?: string;
      fileType?: string;
      stage?: ProcessingError['stage'];
      originalError?: Error;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.type = type;
    this.fileName = options.fileName;
    this.fileType = options.fileType;
    this.stage = options.stage || 'parsing';
    this.originalError = options.originalError;
    this.recoverable = options.recoverable ?? false;
    this.userMessage = options.userMessage || this.getDefaultUserMessage(type);
    this.timestamp = new Date().toISOString();
  }

  private getDefaultUserMessage(type: UnifiedProcessingError): string {
    const messages: Record<UnifiedProcessingError, string> = {
      [UnifiedProcessingError.FILE_TOO_LARGE]: 'The file is too large to process. Please try a smaller file.',
      [UnifiedProcessingError.INVALID_FILE_FORMAT]: 'The file format is not supported or invalid.',
      [UnifiedProcessingError.CORRUPTED_FILE]: 'The file appears to be corrupted and cannot be processed.',
      [UnifiedProcessingError.UNSUPPORTED_FORMAT]: 'This file format is not currently supported.',
      [UnifiedProcessingError.PARSING_FAILED]: 'Failed to parse the document. Please check the file format.',
      [UnifiedProcessingError.EXTRACTION_FAILED]: 'Failed to extract content from the document.',
      [UnifiedProcessingError.CONVERSION_FAILED]: 'Failed to convert the document to the required format.',
      [UnifiedProcessingError.CHUNKING_FAILED]: 'Failed to process the document content.',
      [UnifiedProcessingError.MEMORY_LIMIT_EXCEEDED]: 'The document is too complex to process with available resources.',
      [UnifiedProcessingError.PROCESSING_TIMEOUT]: 'Processing took too long and was cancelled.',
      [UnifiedProcessingError.WORKER_OVERLOADED]: 'The system is currently busy. Please try again later.',
      [UnifiedProcessingError.NO_CONTENT_EXTRACTED]: 'No readable content could be extracted from the document.',
      [UnifiedProcessingError.INSUFFICIENT_CONTENT]: 'The document does not contain enough readable content.',
      [UnifiedProcessingError.PASSWORD_PROTECTED]: 'This document is password protected and cannot be processed.',
      [UnifiedProcessingError.EXTERNAL_SERVICE_ERROR]: 'An external service required for processing is unavailable.',
      [UnifiedProcessingError.DEPENDENCY_ERROR]: 'A required component for processing is not available.'
    };

    return messages[type] || 'An unexpected error occurred while processing the document.';
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      fileName: this.fileName,
      fileType: this.fileType,
      stage: this.stage,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message
      } : undefined
    };
  }
}

// Error mapping functions to convert library-specific errors
export class ProcessingErrorMapper {
  static mapPdfError(error: unknown, fileName?: string): DocumentProcessingError {
    if (error instanceof PdfError) {
      const typeMapping: Record<PdfProcessingError, UnifiedProcessingError> = {
        [PdfProcessingError.FILE_TOO_LARGE]: UnifiedProcessingError.FILE_TOO_LARGE,
        [PdfProcessingError.INVALID_PDF]: UnifiedProcessingError.INVALID_FILE_FORMAT,
        [PdfProcessingError.PASSWORD_PROTECTED]: UnifiedProcessingError.PASSWORD_PROTECTED,
        [PdfProcessingError.CORRUPTED_PDF]: UnifiedProcessingError.CORRUPTED_FILE,
        [PdfProcessingError.TOO_MANY_PAGES]: UnifiedProcessingError.MEMORY_LIMIT_EXCEEDED,
        [PdfProcessingError.MEMORY_LIMIT]: UnifiedProcessingError.MEMORY_LIMIT_EXCEEDED
      };

      return new DocumentProcessingError(
        typeMapping[error.type] || UnifiedProcessingError.PARSING_FAILED,
        error.message,
        {
          fileName,
          fileType: 'application/pdf',
          stage: 'parsing',
          originalError: error,
          recoverable: error.type === PdfProcessingError.FILE_TOO_LARGE
        }
      );
    }

    return new DocumentProcessingError(
      UnifiedProcessingError.PARSING_FAILED,
      'PDF processing failed',
      {
        fileName,
        fileType: 'application/pdf',
        stage: 'parsing',
        originalError: error instanceof Error ? error : new Error(String(error))
      }
    );
  }

  static mapDocxError(error: unknown, fileName?: string): DocumentProcessingError {
    if (error instanceof DocxError) {
      const typeMapping: Record<DocxProcessingError, UnifiedProcessingError> = {
        [DocxProcessingError.FILE_TOO_LARGE]: UnifiedProcessingError.FILE_TOO_LARGE,
        [DocxProcessingError.INVALID_DOCX]: UnifiedProcessingError.INVALID_FILE_FORMAT,
        [DocxProcessingError.CORRUPTED_DOCX]: UnifiedProcessingError.CORRUPTED_FILE,
        [DocxProcessingError.UNSUPPORTED_FORMAT]: UnifiedProcessingError.UNSUPPORTED_FORMAT,
        [DocxProcessingError.EXTRACTION_FAILED]: UnifiedProcessingError.EXTRACTION_FAILED
      };

      return new DocumentProcessingError(
        typeMapping[error.type] || UnifiedProcessingError.PARSING_FAILED,
        error.message,
        {
          fileName,
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          stage: 'parsing',
          originalError: error,
          recoverable: error.type === DocxProcessingError.FILE_TOO_LARGE
        }
      );
    }

    return new DocumentProcessingError(
      UnifiedProcessingError.PARSING_FAILED,
      'DOCX processing failed',
      {
        fileName,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        stage: 'parsing',
        originalError: error instanceof Error ? error : new Error(String(error))
      }
    );
  }

  static mapHtmlError(error: unknown, fileName?: string): DocumentProcessingError {
    if (error instanceof HtmlError) {
      const typeMapping: Record<HtmlProcessingError, UnifiedProcessingError> = {
        [HtmlProcessingError.INVALID_HTML]: UnifiedProcessingError.INVALID_FILE_FORMAT,
        [HtmlProcessingError.PARSING_FAILED]: UnifiedProcessingError.PARSING_FAILED,
        [HtmlProcessingError.NO_CONTENT]: UnifiedProcessingError.NO_CONTENT_EXTRACTED,
        [HtmlProcessingError.CONVERSION_FAILED]: UnifiedProcessingError.CONVERSION_FAILED
      };

      return new DocumentProcessingError(
        typeMapping[error.type] || UnifiedProcessingError.PARSING_FAILED,
        error.message,
        {
          fileName,
          fileType: 'text/html',
          stage: 'parsing',
          originalError: error,
          recoverable: error.type === HtmlProcessingError.NO_CONTENT
        }
      );
    }

    return new DocumentProcessingError(
      UnifiedProcessingError.PARSING_FAILED,
      'HTML processing failed',
      {
        fileName,
        fileType: 'text/html',
        stage: 'parsing',
        originalError: error instanceof Error ? error : new Error(String(error))
      }
    );
  }

  static mapGenericError(error: unknown, fileName?: string, fileType?: string): DocumentProcessingError {
    if (error instanceof DocumentProcessingError) {
      return error;
    }

    // Handle common Node.js/JavaScript errors
    if (error instanceof Error) {
      if (error.message.includes('out of memory') || error.message.includes('heap')) {
        return new DocumentProcessingError(
          UnifiedProcessingError.MEMORY_LIMIT_EXCEEDED,
          'Processing exceeded memory limits',
          { fileName, fileType, originalError: error, stage: 'parsing' }
        );
      }

      if (error.message.includes('timeout') || error.message.includes('time out') || error.message.includes('timed out')) {
        return new DocumentProcessingError(
          UnifiedProcessingError.PROCESSING_TIMEOUT,
          'Processing timed out',
          { fileName, fileType, originalError: error, stage: 'parsing' }
        );
      }

      if (error.message.includes('permission') || error.message.includes('access denied')) {
        return new DocumentProcessingError(
          UnifiedProcessingError.PASSWORD_PROTECTED,
          'File access denied or password protected',
          { fileName, fileType, originalError: error, stage: 'validation' }
        );
      }
    }

    return new DocumentProcessingError(
      UnifiedProcessingError.PARSING_FAILED,
      'Unknown processing error',
      {
        fileName,
        fileType,
        originalError: error instanceof Error ? error : new Error(String(error)),
        stage: 'parsing'
      }
    );
  }
}

// Error handling utilities
export class ErrorHandler {
  static shouldRetry(error: DocumentProcessingError): boolean {
    const retryableErrors = [
      UnifiedProcessingError.PROCESSING_TIMEOUT,
      UnifiedProcessingError.WORKER_OVERLOADED,
      UnifiedProcessingError.EXTERNAL_SERVICE_ERROR
    ];

    return retryableErrors.includes(error.type);
  }

  static getRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 16000);
  }

  static shouldLogError(error: DocumentProcessingError): boolean {
    // Don't log user-facing errors that are expected
    const userErrors = [
      UnifiedProcessingError.FILE_TOO_LARGE,
      UnifiedProcessingError.INVALID_FILE_FORMAT,
      UnifiedProcessingError.PASSWORD_PROTECTED,
      UnifiedProcessingError.UNSUPPORTED_FORMAT
    ];

    return !userErrors.includes(error.type);
  }

  static createErrorResponse(error: DocumentProcessingError) {
    return {
      success: false,
      error: {
        type: error.type,
        message: error.userMessage,
        details: error.message,
        recoverable: error.recoverable,
        fileName: error.fileName,
        stage: error.stage,
        timestamp: error.timestamp
      }
    };
  }
}

// Validation utilities
export class FileValidator {
  static validateFileSize(fileSize: number, maxSize: number): void {
    if (fileSize > maxSize) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.FILE_TOO_LARGE,
        `File size ${fileSize} exceeds maximum allowed size ${maxSize}`,
        {
          stage: 'validation',
          recoverable: true,
          userMessage: `File is too large. Maximum size allowed is ${Math.round(maxSize / 1024 / 1024)}MB.`
        }
      );
    }
  }

  static validateFileType(mimeType: string, supportedTypes: string[]): void {
    if (!supportedTypes.includes(mimeType)) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.UNSUPPORTED_FORMAT,
        `File type ${mimeType} is not supported`,
        {
          stage: 'validation',
          userMessage: `File type not supported. Supported formats: ${supportedTypes.join(', ')}`
        }
      );
    }
  }

  static validateFileName(fileName: string): void {
    if (!fileName || fileName.trim().length === 0) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.INVALID_FILE_FORMAT,
        'Invalid or missing file name',
        {
          stage: 'validation',
          userMessage: 'Please provide a valid file name.'
        }
      );
    }

    // Check for potentially dangerous file names
    const dangerousPatterns = [/\.\./g, /[<>:"|?*]/g];
    if (dangerousPatterns.some(pattern => pattern.test(fileName))) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.INVALID_FILE_FORMAT,
        'File name contains invalid characters',
        {
          stage: 'validation',
          userMessage: 'File name contains invalid characters.'
        }
      );
    }
  }
}