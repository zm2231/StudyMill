/**
 * Type definitions for document processing libraries and interfaces
 */

// Common interfaces for all document processors
export interface DocumentProcessor {
  processDocument(buffer: ArrayBuffer, fileName: string): Promise<ProcessedDocument>;
  getSupportedMimeTypes(): string[];
  getMaxFileSize(): number;
}

export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
  processingStats: ProcessingStats;
  format: 'html' | 'markdown' | 'text';
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  keywords?: string[];
  language?: string;
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  [key: string]: any;
}

export interface DocumentChunk {
  id: string;
  content: string;
  chunkIndex: number;
  startPosition?: number;
  endPosition?: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  pageNumber?: number;
  sectionTitle?: string;
  contentType: 'paragraph' | 'heading' | 'list' | 'table' | 'code' | 'quote';
  characterCount: number;
  wordCount: number;
  [key: string]: any;
}

export interface ProcessingStats {
  processingTime: number; // milliseconds
  memoryUsage?: number; // bytes
  pagesProcessed?: number;
  chunksCreated: number;
  errorsEncountered: number;
  warningsCount: number;
}

// PDF-specific types
export interface PdfDocument {
  numPages: number;
  fingerprint: string;
  metadata?: any;
}

export interface PdfPageContent {
  pageNumber: number;
  textContent: string;
  textItems: PdfTextItem[];
  metadata?: any;
}

export interface PdfTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

export interface PdfProcessingOptions {
  maxPages?: number;
  extractImages?: boolean;
  preserveFormatting?: boolean;
  includeMetadata?: boolean;
}

// DOCX-specific types
export interface DocxProcessingOptions {
  styleMapping?: string[];
  includeImages?: boolean;
  outputFormat: 'html' | 'markdown';
  preserveStructure?: boolean;
}

export interface DocxProcessingResult {
  value: string; // HTML or markdown content
  messages: DocxMessage[];
  metadata: DocxMetadata;
}

export interface DocxMessage {
  type: 'warning' | 'error' | 'info';
  message: string;
  location?: string;
}

export interface DocxMetadata {
  wordCount: number;
  paragraphCount: number;
  headingCount: number;
  tableCount?: number;
  imageCount?: number;
  conversionMessages: DocxMessage[];
}

// HTML-specific types
export interface HtmlProcessingOptions {
  extractMainContent?: boolean;
  preserveStructure?: boolean;
  removeNavigation?: boolean;
  convertToMarkdown?: boolean;
  includeImages?: boolean;
}

export interface HtmlProcessingResult {
  cleanedHtml: string;
  markdown?: string;
  mainContent: string;
  metadata: HtmlMetadata;
  extractedText: string;
}

export interface HtmlMetadata {
  title: string;
  description: string;
  author?: string;
  publishDate?: string;
  keywords: string[];
  url?: string;
  wordCount: number;
  readingTime: number; // minutes
  headings: HtmlHeading[];
}

export interface HtmlHeading {
  level: number;
  text: string;
  id?: string;
}

// Web content types (for future web import feature)
export interface WebPageContent {
  url: string;
  title: string;
  content: string;
  markdown: string;
  metadata: WebPageMetadata;
  extractedAt: string;
}

export interface WebPageMetadata extends HtmlMetadata {
  siteName?: string;
  domain: string;
  canonical?: string;
  ogImage?: string;
  twitterCard?: string;
}

// Audio processing types (for future audio transcription)
export interface AudioProcessingOptions {
  language?: string;
  timestamps?: boolean;
  speakerLabels?: boolean;
  segmentation?: boolean;
}

export interface AudioTranscript {
  text: string;
  segments: AudioSegment[];
  metadata: AudioMetadata;
}

export interface AudioSegment {
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  confidence: number;
}

export interface AudioMetadata {
  duration: number; // seconds
  language: string;
  format: string;
  sampleRate: number;
  channels: number;
  wordCount: number;
}

// Processing error types
export interface ProcessingError {
  type: string;
  message: string;
  fileName?: string;
  stage: 'validation' | 'parsing' | 'extraction' | 'chunking' | 'finalization';
  originalError?: Error;
  recoverable: boolean;
}

// Chunking configuration
export interface ChunkingConfig {
  maxChunkSize: number; // characters
  overlapSize: number; // characters
  chunkBoundary: 'sentence' | 'paragraph' | 'section';
  preserveStructure: boolean;
  minChunkSize: number; // characters
}

// Default chunking configuration for different content types
export const DEFAULT_CHUNKING_CONFIG: Record<string, ChunkingConfig> = {
  academic: {
    maxChunkSize: 1000,
    overlapSize: 100,
    chunkBoundary: 'sentence',
    preserveStructure: true,
    minChunkSize: 200
  },
  general: {
    maxChunkSize: 800,
    overlapSize: 80,
    chunkBoundary: 'sentence',
    preserveStructure: false,
    minChunkSize: 150
  },
  technical: {
    maxChunkSize: 1200,
    overlapSize: 120,
    chunkBoundary: 'paragraph',
    preserveStructure: true,
    minChunkSize: 250
  }
};

// File type detection
export interface FileTypeInfo {
  mimeType: string;
  extension: string;
  processor: 'pdf' | 'docx' | 'html' | 'text';
  maxSize: number;
  supported: boolean;
}

export const SUPPORTED_FILE_TYPES: Record<string, FileTypeInfo> = {
  'application/pdf': {
    mimeType: 'application/pdf',
    extension: '.pdf',
    processor: 'pdf',
    maxSize: 50 * 1024 * 1024, // 50MB
    supported: true
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
    processor: 'docx',
    maxSize: 100 * 1024 * 1024, // 100MB
    supported: true
  },
  'text/html': {
    mimeType: 'text/html',
    extension: '.html',
    processor: 'html',
    maxSize: 10 * 1024 * 1024, // 10MB
    supported: true
  },
  'text/plain': {
    mimeType: 'text/plain',
    extension: '.txt',
    processor: 'text',
    maxSize: 10 * 1024 * 1024, // 10MB
    supported: true
  }
};

// Processing queue types
export interface ProcessingJob {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  userId: string;
  documentId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt?: string;
  completedAt?: string;
  error?: ProcessingError;
  result?: ProcessedDocument;
}

// Memory integration types (for converting processed content to memories)
export interface MemoryCreationOptions {
  userId: string;
  sourceType: 'document' | 'web' | 'audio' | 'manual';
  sourceId: string;
  containerTags: string[];
  preserveStructure: boolean;
  chunkingStrategy: 'paragraph' | 'semantic' | 'fixed-size';
}

export interface ProcessorRegistry {
  [mimeType: string]: DocumentProcessor;
}

// Export all error types for convenience
export { PdfError, PdfProcessingError } from '../config/pdfjs-config';
export { DocxError, DocxProcessingError } from '../config/mammoth-config';
export { HtmlError, HtmlProcessingError } from '../config/html-config';