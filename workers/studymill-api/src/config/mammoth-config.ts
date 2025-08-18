/**
 * Mammoth Configuration for DOCX Processing in Cloudflare Workers
 * 
 * Mammoth is used to extract text and convert DOCX files to HTML/markdown
 */

// Note: mammoth will be imported dynamically in the actual implementation

// Mammoth configuration optimized for academic documents
export const MAMMOTH_CONFIG = {
  // Maximum file size for DOCX processing (100MB)
  maxFileSize: 100 * 1024 * 1024,
  
  // Style mapping for better academic document conversion
  styleMap: [
    // Headings
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh", 
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    
    // Common academic styles
    "p[style-name='Title'] => h1.title:fresh",
    "p[style-name='Abstract'] => p.abstract",
    "p[style-name='Quote'] => blockquote:fresh",
    "p[style-name='Caption'] => p.caption",
    "p[style-name='Bibliography'] => p.bibliography",
    
    // Code and technical content
    "p[style-name='Code'] => pre:fresh",
    "r[style-name='Code Char'] => code",
    
    // Lists
    "p[style-name='List Paragraph'] => li:fresh",
    "p[style-name='Bullet'] => li:fresh"
  ],
  
  // Conversion options
  convertOptions: {
    // Include document metadata
    includeDefaultStyleMap: true,
    includeEmbeddedStyleMap: true,
    
    // Image handling configuration (will be set when mammoth is imported)
    imageHandling: 'placeholder',
    
    // Document transformation settings
    transformDocument: true
  },
  
  // Text extraction options (when we only need plain text)
  textOptions: {
    includeDefaultStyleMap: false,
    includeEmbeddedStyleMap: false
  }
};

// Error types specific to DOCX processing
export enum DocxProcessingError {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_DOCX = 'INVALID_DOCX',
  CORRUPTED_DOCX = 'CORRUPTED_DOCX',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED'
}

export class DocxError extends Error {
  constructor(
    public type: DocxProcessingError,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DocxError';
  }
}

// Utility function to clean up mammoth HTML output
export function cleanMammothHtml(html: string): string {
  return html
    // Remove empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Clean up excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove mammoth-specific attributes
    .replace(/\s*data-mammoth-[^=]*="[^"]*"/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

// Extract document metadata from mammoth result
export function extractDocxMetadata(result: any): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  if (result.messages) {
    metadata.conversionMessages = result.messages.map((msg: any) => ({
      type: msg.type,
      message: msg.message
    }));
  }
  
  // Extract document statistics
  const html = result.value || '';
  metadata.wordCount = html.replace(/<[^>]*>/g, '').split(/\s+/).length;
  metadata.paragraphCount = (html.match(/<p>/g) || []).length;
  metadata.headingCount = (html.match(/<h[1-6]>/g) || []).length;
  
  return metadata;
}