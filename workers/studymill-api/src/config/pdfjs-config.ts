/**
 * PDF.js Configuration for Cloudflare Workers
 * 
 * PDF.js needs special configuration to work in the Workers environment
 * since it doesn't have access to Node.js filesystem APIs.
 */

// Note: pdfjs-dist will be imported dynamically in the actual implementation
// to avoid Workers runtime issues during testing

// Configure PDF.js for Workers environment
export async function configurePdfJs() {
  try {
    // Dynamic import to avoid runtime issues in tests
    const pdfjs = await import('pdfjs-dist');
    
    // Disable worker threads in Workers runtime
    pdfjs.GlobalWorkerOptions.workerSrc = '';
    
    // Set up canvas factory for text extraction
    // Workers don't support Canvas, but we only need text extraction
    pdfjs.GlobalWorkerOptions.workerPort = null;
    
    return pdfjs;
  } catch (error) {
    throw new PdfError(
      PdfProcessingError.MEMORY_LIMIT,
      `Failed to initialize PDF.js: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// PDF processing options optimized for memory usage
export const PDF_CONFIG = {
  // Maximum file size for PDF processing (50MB)
  maxFileSize: 50 * 1024 * 1024,
  
  // Maximum pages to process (prevent memory issues)
  maxPages: 500,
  
  // Text extraction options
  textOptions: {
    normalizeWhitespace: true,
    disableCombineTextItems: false
  },
  
  // Document loading options
  loadOptions: {
    useSystemFonts: false,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableAutoFetch: true,
    disableStream: true
  }
};

// Error types specific to PDF processing
export enum PdfProcessingError {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_PDF = 'INVALID_PDF',
  PASSWORD_PROTECTED = 'PASSWORD_PROTECTED',
  CORRUPTED_PDF = 'CORRUPTED_PDF',
  TOO_MANY_PAGES = 'TOO_MANY_PAGES',
  MEMORY_LIMIT = 'MEMORY_LIMIT'
}

export class PdfError extends Error {
  constructor(
    public type: PdfProcessingError,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PdfError';
  }
}