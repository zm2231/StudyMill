/**
 * HTML Processing Configuration for Web Content and Document Conversion
 * 
 * Uses Cheerio for HTML parsing and Turndown for HTML-to-Markdown conversion
 */

// Note: cheerio and turndown will be imported dynamically in the actual implementation
// This avoids Workers runtime issues during testing

// Cheerio configuration for HTML parsing and cleaning
export const CHEERIO_CONFIG = {
  // Parser options
  parseOptions: {
    xmlMode: false,
    decodeEntities: true,
    lowerCaseAttributeNames: false
  },
  
  // Content extraction selectors
  contentSelectors: {
    // Main content areas (prioritized)
    main: ['main', 'article', '.content', '.post', '.entry', '#content'],
    
    // Remove these elements entirely
    remove: [
      'script', 'style', 'nav', 'header', 'footer', 'aside',
      '.sidebar', '.navigation', '.menu', '.ads', '.advertisement',
      '.social', '.share', '.comments', '.related', '.popup',
      '.modal', '.cookie', '.banner', '[role="banner"]',
      '[role="navigation"]', '[role="complementary"]'
    ],
    
    // Academic content markers
    academic: [
      '.abstract', '.summary', '.conclusion', '.bibliography',
      '.references', '.citation', '.figure', '.table'
    ]
  },
  
  // Text cleaning options
  cleaningOptions: {
    // Remove empty elements
    removeEmpty: true,
    // Normalize whitespace
    normalizeWhitespace: true,
    // Remove comments
    removeComments: true,
    // Preserve academic structure
    preserveStructure: true
  }
};

// Turndown configuration for HTML to Markdown conversion
export const TURNDOWN_CONFIG = {
  // Core options
  headingStyle: 'atx' as const,
  hr: '---',
  bulletListMarker: '-' as const,
  codeBlockStyle: 'fenced' as const,
  fence: '```' as const,
  emDelimiter: '*' as const,
  strongDelimiter: '**' as const,
  linkStyle: 'inlined' as const,
  linkReferenceStyle: 'full' as const,
  
  // Preserve certain HTML elements
  keepReplacement: (content: string, node: any) => {
    // Keep these as HTML for better structure
    const keepAsHtml = ['table', 'figure', 'figcaption', 'details', 'summary'];
    if (keepAsHtml.includes(node.nodeName.toLowerCase())) {
      return node.outerHTML;
    }
    return content;
  },
  
  // Remove unwanted elements
  removeElements: [
    'script', 'style', 'meta', 'link', 'title'
  ]
};

// Initialize Turndown service with custom rules
export async function createTurndownService() {
  const TurndownService = (await import('turndown')).default;
  const turndown = new TurndownService(TURNDOWN_CONFIG);
  
  // Add custom rules for academic content
  turndown.addRule('academic-citations', {
    filter: 'cite',
    replacement: (content: string) => `*${content}*`
  });
  
  turndown.addRule('academic-footnotes', {
    filter: 'sup',
    replacement: (content: string) => `^${content}`
  });
  
  turndown.addRule('academic-quotes', {
    filter: 'blockquote',
    replacement: (content: string) => `\n> ${content.trim()}\n`
  });
  
  // Preserve mathematical content
  turndown.addRule('math-content', {
    filter: (node: any) => node.classList && (node.classList.contains('math') || node.classList.contains('equation')) || node.dataset.math,
    replacement: (content: string, node: any) => {
      return `$$${content}$$`;
    }
  });
  
  // Handle code blocks
  turndown.addRule('code-blocks', {
    filter: 'pre',
    replacement: (content: string, node: any) => {
      const language = node.getAttribute('data-language') || 
                     node.className.match(/language-(\w+)/)?.[1] || '';
      return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
    }
  });
  
  return turndown;
}

// HTML cleaning utilities
export class HtmlCleaner {
  private html: string;
  
  constructor(html: string) {
    this.html = html;
  }

  // Dynamic cheerio import for actual processing
  private async getCheerio() {
    const cheerio = await import('cheerio');
    return cheerio.load(this.html, CHEERIO_CONFIG.parseOptions);
  }
  
  // Extract main content from HTML
  async extractMainContent(): Promise<string> {
    const $ = await this.getCheerio();
    
    // Try to find main content area
    let mainContent = $('main').first();
    if (mainContent.length === 0) {
      mainContent = $('article').first();
    }
    if (mainContent.length === 0) {
      // Look for common content classes
      for (const selector of CHEERIO_CONFIG.contentSelectors.main) {
        mainContent = $(selector).first() as any;
        if (mainContent.length > 0) break;
      }
    }
    
    // If no main content found, use body but clean it heavily
    if (mainContent.length === 0) {
      mainContent = $('body');
      this.removeNoise(mainContent, $);
    }
    
    return this.cleanContent(mainContent, $);
  }
  
  // Remove noise elements
  private removeNoise(element: any, $: any): void {
    
    CHEERIO_CONFIG.contentSelectors.remove.forEach(selector => {
      element.find(selector).remove();
    });
  }
  
  // Clean and normalize content
  private cleanContent(element: any, $: any): string {
    
    // Remove empty elements
    element.find('*').each((_: number, el: any) => {
      const $el = $(el);
      if ($el.text().trim() === '' && $el.children().length === 0) {
        $el.remove();
      }
    });
    
    // Normalize whitespace
    element.find('*').each((_: number, el: any) => {
      const $el = $(el);
      const text = $el.text();
      if (text !== text.replace(/\s+/g, ' ').trim()) {
        $el.text(text.replace(/\s+/g, ' ').trim());
      }
    });
    
    return element.html() || '';
  }
  
  // Extract metadata from HTML
  async extractMetadata(): Promise<Record<string, any>> {
    const $ = await this.getCheerio();
    const metadata: Record<string, any> = {};
    
    // Basic metadata
    metadata.title = $('title').text() || $('h1').first().text() || '';
    metadata.description = $('meta[name="description"]').attr('content') || '';
    metadata.keywords = $('meta[name="keywords"]').attr('content') || '';
    metadata.author = $('meta[name="author"]').attr('content') || '';
    metadata.publishDate = $('meta[name="date"]').attr('content') || 
                          $('meta[property="article:published_time"]').attr('content') || '';
    
    // Academic metadata
    metadata.abstract = $('.abstract').text().trim() || '';
    metadata.doi = $('meta[name="citation_doi"]').attr('content') || '';
    metadata.journal = $('meta[name="citation_journal_title"]').attr('content') || '';
    
    // Content statistics
    const bodyText = $('body').text();
    metadata.wordCount = bodyText.split(/\s+/).length;
    metadata.readingTime = Math.ceil(metadata.wordCount / 250); // Average reading speed
    
    return metadata;
  }
}

// Error types for HTML processing
export enum HtmlProcessingError {
  INVALID_HTML = 'INVALID_HTML',
  PARSING_FAILED = 'PARSING_FAILED',
  NO_CONTENT = 'NO_CONTENT',
  CONVERSION_FAILED = 'CONVERSION_FAILED'
}

export class HtmlError extends Error {
  constructor(
    public type: HtmlProcessingError,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'HtmlError';
  }
}