import { DatabaseService } from './database';
import { VectorService } from './vector';
import { createError } from '../middleware/error';

export interface QueryAnalysis {
  originalQuery: string;
  intent: QueryIntent;
  entities: ExtractedEntity[];
  rewrittenQueries: string[];
  expandedTerms: string[];
  confidence: number;
  processingTime: number;
}

export interface QueryIntent {
  type: 'factual' | 'conceptual' | 'procedural' | 'analytical' | 'comparative' | 'exploratory';
  confidence: number;
  domain?: string;
  specificity: 'broad' | 'specific' | 'highly_specific';
}

export interface ExtractedEntity {
  text: string;
  type: 'person' | 'place' | 'concept' | 'date' | 'number' | 'topic' | 'subject';
  confidence: number;
  synonyms?: string[];
}

export interface QueryRewriteRule {
  id: string;
  pattern: string;
  replacement: string;
  condition?: string;
  priority: number;
  isActive: boolean;
  domain?: string;
}

export interface QueryExpansionOptions {
  includeSynonyms: boolean;
  includeRelatedTerms: boolean;
  includeDomainTerms: boolean;
  maxExpansions: number;
  confidenceThreshold: number;
}

export interface ProcessedQuery {
  original: string;
  primary: string;
  alternatives: string[];
  entities: ExtractedEntity[];
  intent: QueryIntent;
  expansions: string[];
  metadata: Record<string, any>;
  cacheKey?: string;
}

export class QueryProcessorService {
  private static readonly CACHE_TTL_MS = 3600000; // 1 hour
  private static readonly MAX_QUERY_LENGTH = 1000;
  private static readonly MIN_QUERY_LENGTH = 2;

  constructor(
    private dbService: DatabaseService,
    private vectorService: VectorService,
    private geminiApiKey: string
  ) {}

  /**
   * Main query processing pipeline
   */
  async processQuery(
    query: string, 
    userId: string,
    options: Partial<QueryExpansionOptions> = {}
  ): Promise<ProcessedQuery> {
    const startTime = Date.now();

    // Validate query
    this.validateQuery(query);

    // Check cache first
    const cacheKey = this.generateCacheKey(query, options);
    const cached = await this.getCachedQuery(cacheKey, userId);
    if (cached) {
      return cached;
    }

    try {
      // Step 1: Analyze query intent and extract entities
      const analysis = await this.analyzeQuery(query);

      // Step 2: Apply rewriting rules
      const rewrittenQuery = await this.applyRewriteRules(query, analysis.intent);

      // Step 3: Generate alternative phrasings
      const alternatives = await this.generateAlternatives(rewrittenQuery, analysis);

      // Step 4: Expand with synonyms and related terms
      const expansions = await this.expandQuery(rewrittenQuery, analysis.entities, {
        includeSynonyms: options.includeSynonyms ?? true,
        includeRelatedTerms: options.includeRelatedTerms ?? true,
        includeDomainTerms: options.includeDomainTerms ?? true,
        maxExpansions: options.maxExpansions ?? 10,
        confidenceThreshold: options.confidenceThreshold ?? 0.6
      });

      const processedQuery: ProcessedQuery = {
        original: query,
        primary: rewrittenQuery,
        alternatives,
        entities: analysis.entities,
        intent: analysis.intent,
        expansions,
        metadata: {
          processingTime: Date.now() - startTime,
          analysisConfidence: analysis.confidence,
          rulesApplied: true,
          expansionCount: expansions.length
        },
        cacheKey
      };

      // Cache the result
      await this.cacheQuery(cacheKey, processedQuery, userId);

      // Log analytics
      await this.logQueryProcessing(query, processedQuery, userId);

      return processedQuery;

    } catch (error) {
      console.error('Query processing failed:', error);
      
      // Return minimal processed query on failure
      return {
        original: query,
        primary: query,
        alternatives: [],
        entities: [],
        intent: { type: 'exploratory', confidence: 0.5, specificity: 'broad' },
        expansions: [],
        metadata: {
          processingTime: Date.now() - startTime,
          error: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Analyze query to determine intent and extract entities
   */
  private async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const startTime = Date.now();
    
    // Simple rule-based intent detection (could be enhanced with ML)
    const intent = this.detectIntent(query);
    
    // Extract entities using pattern matching and common academic terms
    const entities = this.extractEntities(query);
    
    // Generate basic rewritten queries
    const rewrittenQueries = this.generateBasicRewrites(query);
    
    // Extract expansion terms
    const expandedTerms = this.extractExpandableTerms(query);

    return {
      originalQuery: query,
      intent,
      entities,
      rewrittenQueries,
      expandedTerms,
      confidence: intent.confidence,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Detect query intent using linguistic patterns
   */
  private detectIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    
    // Question words and patterns
    const factualPatterns = ['what is', 'who is', 'where is', 'when did', 'define', 'definition of'];
    const proceduralPatterns = ['how to', 'steps to', 'process of', 'method for', 'procedure'];
    const comparativePatterns = ['compare', 'difference between', 'vs', 'versus', 'contrast'];
    const analyticalPatterns = ['analyze', 'examine', 'evaluate', 'assess', 'why', 'because'];
    const conceptualPatterns = ['concept of', 'theory of', 'principle of', 'idea behind'];

    let type: QueryIntent['type'] = 'exploratory';
    let confidence = 0.5;

    if (factualPatterns.some(pattern => lowerQuery.includes(pattern))) {
      type = 'factual';
      confidence = 0.8;
    } else if (proceduralPatterns.some(pattern => lowerQuery.includes(pattern))) {
      type = 'procedural';
      confidence = 0.8;
    } else if (comparativePatterns.some(pattern => lowerQuery.includes(pattern))) {
      type = 'comparative';
      confidence = 0.8;
    } else if (analyticalPatterns.some(pattern => lowerQuery.includes(pattern))) {
      type = 'analytical';
      confidence = 0.7;
    } else if (conceptualPatterns.some(pattern => lowerQuery.includes(pattern))) {
      type = 'conceptual';
      confidence = 0.7;
    }

    // Determine specificity based on query length and entity density
    const words = query.split(/\s+/).filter(w => w.length > 2);
    const specificity = words.length < 3 ? 'broad' : 
                      words.length < 7 ? 'specific' : 'highly_specific';

    return { type, confidence, specificity };
  }

  /**
   * Extract entities using pattern matching
   */
  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Academic subject patterns
    const subjects = ['mathematics', 'physics', 'chemistry', 'biology', 'history', 'literature', 
                     'computer science', 'psychology', 'philosophy', 'economics', 'sociology'];
    
    // Date patterns
    const datePattern = /\b(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
    
    // Number patterns
    const numberPattern = /\b\d+(\.\d+)?\b/g;
    
    // Proper noun patterns (capitalized words)
    const properNounPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;

    // Extract dates
    const dates = query.match(datePattern);
    if (dates) {
      dates.forEach(date => {
        entities.push({
          text: date,
          type: 'date',
          confidence: 0.9
        });
      });
    }

    // Extract numbers
    const numbers = query.match(numberPattern);
    if (numbers) {
      numbers.forEach(number => {
        entities.push({
          text: number,
          type: 'number',
          confidence: 0.8
        });
      });
    }

    // Extract subjects
    subjects.forEach(subject => {
      if (query.toLowerCase().includes(subject)) {
        entities.push({
          text: subject,
          type: 'subject',
          confidence: 0.9
        });
      }
    });

    // Extract proper nouns (potential people/places)
    const properNouns = query.match(properNounPattern);
    if (properNouns) {
      properNouns.forEach(noun => {
        // Skip common words that might be capitalized
        if (!['The', 'A', 'An', 'This', 'That'].includes(noun)) {
          entities.push({
            text: noun,
            type: 'person', // Could be enhanced to distinguish person vs place
            confidence: 0.6
          });
        }
      });
    }

    return entities;
  }

  /**
   * Apply rewriting rules to improve query
   */
  private async applyRewriteRules(query: string, intent: QueryIntent): Promise<string> {
    // Get active rewrite rules from database
    const rules = await this.getRewriteRules(intent.type);
    
    let rewritten = query;
    
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        if (regex.test(rewritten)) {
          rewritten = rewritten.replace(regex, rule.replacement);
        }
      } catch (error) {
        console.warn(`Invalid regex pattern in rule ${rule.id}:`, error);
      }
    }

    return rewritten;
  }

  /**
   * Generate alternative phrasings of the query
   */
  private async generateAlternatives(query: string, analysis: QueryAnalysis): Promise<string[]> {
    const alternatives: string[] = [];
    
    // Question to statement conversion
    if (query.toLowerCase().startsWith('what is')) {
      const concept = query.substring(7).trim();
      alternatives.push(concept);
      alternatives.push(`${concept} definition`);
      alternatives.push(`${concept} meaning`);
    }
    
    if (query.toLowerCase().startsWith('how to')) {
      const task = query.substring(6).trim();
      alternatives.push(`${task} process`);
      alternatives.push(`${task} method`);
      alternatives.push(`${task} steps`);
    }

    // Entity-based alternatives
    for (const entity of analysis.entities) {
      if (entity.synonyms) {
        for (const synonym of entity.synonyms) {
          alternatives.push(query.replace(entity.text, synonym));
        }
      }
    }

    // Remove duplicates and original query
    return [...new Set(alternatives)].filter(alt => alt !== query && alt.length > 0);
  }

  /**
   * Expand query with synonyms and related terms
   */
  private async expandQuery(
    query: string, 
    entities: ExtractedEntity[],
    options: QueryExpansionOptions
  ): Promise<string[]> {
    const expansions: string[] = [];
    
    if (options.includeSynonyms) {
      // Add synonym-based expansions
      const synonymExpansions = await this.getSynonymExpansions(query, entities);
      expansions.push(...synonymExpansions);
    }

    if (options.includeRelatedTerms) {
      // Add related term expansions from user's memory
      const relatedExpansions = await this.getRelatedTermExpansions(query, entities);
      expansions.push(...relatedExpansions);
    }

    if (options.includeDomainTerms) {
      // Add domain-specific expansions
      const domainExpansions = await this.getDomainExpansions(query, entities);
      expansions.push(...domainExpansions);
    }

    // Filter by confidence and limit
    return expansions
      .filter((exp, index, arr) => arr.indexOf(exp) === index) // Remove duplicates
      .slice(0, options.maxExpansions);
  }

  /**
   * Get rewrite rules from database
   */
  private async getRewriteRules(intentType?: string): Promise<QueryRewriteRule[]> {
    try {
      let query = `SELECT * FROM query_rewrite_rules WHERE is_active = 1`;
      const params: any[] = [];

      if (intentType) {
        query += ` AND (domain IS NULL OR domain = ?)`;
        params.push(intentType);
      }

      query += ` ORDER BY priority DESC`;

      const result = await this.dbService.query(query, params);
      return result.map(row => ({
        id: row.id,
        pattern: row.pattern,
        replacement: row.replacement,
        condition: row.condition,
        priority: row.priority,
        isActive: row.is_active === 1,
        domain: row.domain
      }));
    } catch (error) {
      console.warn('Failed to load rewrite rules:', error);
      return [];
    }
  }

  /**
   * Generate synonym-based expansions
   */
  private async getSynonymExpansions(query: string, entities: ExtractedEntity[]): Promise<string[]> {
    const expansions: string[] = [];
    
    // Simple synonym mapping (could be enhanced with external APIs)
    const synonymMap: Record<string, string[]> = {
      'learn': ['study', 'understand', 'master', 'grasp'],
      'explain': ['describe', 'clarify', 'illustrate', 'demonstrate'],
      'compare': ['contrast', 'analyze', 'evaluate', 'examine'],
      'solve': ['resolve', 'fix', 'calculate', 'determine'],
      'create': ['build', 'make', 'generate', 'construct'],
      'understand': ['comprehend', 'grasp', 'learn', 'know']
    };

    const words = query.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (synonymMap[word]) {
        for (const synonym of synonymMap[word]) {
          const expanded = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
          if (expanded !== query) {
            expansions.push(expanded);
          }
        }
      }
    }

    return expansions;
  }

  /**
   * Get related term expansions from user's memory
   */
  private async getRelatedTermExpansions(query: string, entities: ExtractedEntity[]): Promise<string[]> {
    // This would use vector similarity to find related terms in user's memories
    // Simplified for now
    return [];
  }

  /**
   * Get domain-specific expansions
   */
  private async getDomainExpansions(query: string, entities: ExtractedEntity[]): Promise<string[]> {
    const expansions: string[] = [];
    
    // Academic domain expansions
    const domainTerms: Record<string, string[]> = {
      'mathematics': ['equation', 'formula', 'theorem', 'proof', 'calculation'],
      'physics': ['force', 'energy', 'motion', 'law', 'principle'],
      'chemistry': ['reaction', 'element', 'compound', 'molecular', 'atomic'],
      'biology': ['cell', 'organism', 'DNA', 'evolution', 'ecosystem'],
      'history': ['event', 'period', 'cause', 'effect', 'timeline'],
      'literature': ['author', 'theme', 'character', 'plot', 'analysis']
    };

    for (const entity of entities) {
      if (entity.type === 'subject' && domainTerms[entity.text]) {
        for (const term of domainTerms[entity.text]) {
          expansions.push(`${query} ${term}`);
        }
      }
    }

    return expansions;
  }

  /**
   * Helper methods for basic rewrites and term extraction
   */
  private generateBasicRewrites(query: string): string[] {
    const rewrites: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Convert questions to statements
    if (lowerQuery.startsWith('what is')) {
      rewrites.push(query.substring(7).trim());
    }
    
    if (lowerQuery.startsWith('how does')) {
      rewrites.push(query.substring(8).trim().replace(' work', ' mechanism'));
    }

    return rewrites;
  }

  private extractExpandableTerms(query: string): string[] {
    // Extract nouns and technical terms that could be expanded
    const words = query.split(/\s+/).filter(word => 
      word.length > 3 && 
      !/^(the|and|or|but|with|for|to|in|on|at|by)$/i.test(word)
    );
    
    return words;
  }

  /**
   * Validation and utility methods
   */
  private validateQuery(query: string): void {
    if (!query || typeof query !== 'string') {
      throw createError('Query must be a non-empty string', 400);
    }

    if (query.length < QueryProcessorService.MIN_QUERY_LENGTH) {
      throw createError(`Query must be at least ${QueryProcessorService.MIN_QUERY_LENGTH} characters`, 400);
    }

    if (query.length > QueryProcessorService.MAX_QUERY_LENGTH) {
      throw createError(`Query must not exceed ${QueryProcessorService.MAX_QUERY_LENGTH} characters`, 400);
    }
  }

  private generateCacheKey(query: string, options: Partial<QueryExpansionOptions>): string {
    const optionsStr = JSON.stringify(options);
    return `query:${Buffer.from(query + optionsStr).toString('base64')}`;
  }

  /**
   * Cache management
   */
  private async getCachedQuery(cacheKey: string, userId: string): Promise<ProcessedQuery | null> {
    try {
      const result = await this.dbService.queryFirst(
        `SELECT query_data, created_at FROM query_processing_cache 
         WHERE cache_key = ? AND user_id = ? AND created_at > ?`,
        [cacheKey, userId, new Date(Date.now() - QueryProcessorService.CACHE_TTL_MS).toISOString()]
      );

      if (result) {
        return JSON.parse(result.query_data);
      }
    } catch (error) {
      console.warn('Failed to get cached query:', error);
    }
    
    return null;
  }

  private async cacheQuery(cacheKey: string, processedQuery: ProcessedQuery, userId: string): Promise<void> {
    try {
      await this.dbService.execute(
        `INSERT OR REPLACE INTO query_processing_cache 
         (cache_key, user_id, query_data, created_at) VALUES (?, ?, ?, ?)`,
        [cacheKey, userId, JSON.stringify(processedQuery), new Date().toISOString()]
      );
    } catch (error) {
      console.warn('Failed to cache query:', error);
    }
  }

  /**
   * Analytics and logging
   */
  private async logQueryProcessing(
    originalQuery: string, 
    processedQuery: ProcessedQuery, 
    userId: string
  ): Promise<void> {
    try {
      await this.dbService.execute(
        `INSERT INTO query_processing_analytics 
         (id, user_id, original_query, intent_type, entity_count, alternative_count, 
          expansion_count, processing_time_ms, confidence_score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          userId,
          originalQuery,
          processedQuery.intent.type,
          processedQuery.entities.length,
          processedQuery.alternatives.length,
          processedQuery.expansions.length,
          processedQuery.metadata.processingTime,
          processedQuery.intent.confidence,
          new Date().toISOString()
        ]
      );
    } catch (error) {
      console.warn('Failed to log query processing analytics:', error);
    }
  }

  /**
   * Management methods
   */
  async addRewriteRule(rule: Omit<QueryRewriteRule, 'id'>): Promise<string> {
    const ruleId = crypto.randomUUID();
    
    await this.dbService.execute(
      `INSERT INTO query_rewrite_rules 
       (id, pattern, replacement, condition, priority, is_active, domain)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ruleId, rule.pattern, rule.replacement, rule.condition, 
       rule.priority, rule.isActive ? 1 : 0, rule.domain]
    );

    return ruleId;
  }

  async updateRewriteRule(ruleId: string, updates: Partial<QueryRewriteRule>): Promise<boolean> {
    const fields = [];
    const params = [];

    if (updates.pattern !== undefined) {
      fields.push('pattern = ?');
      params.push(updates.pattern);
    }
    if (updates.replacement !== undefined) {
      fields.push('replacement = ?');
      params.push(updates.replacement);
    }
    if (updates.condition !== undefined) {
      fields.push('condition = ?');
      params.push(updates.condition);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }
    if (updates.domain !== undefined) {
      fields.push('domain = ?');
      params.push(updates.domain);
    }

    if (fields.length === 0) return false;

    params.push(ruleId);

    const result = await this.dbService.execute(
      `UPDATE query_rewrite_rules SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    return result.success && result.meta.changes > 0;
  }

  async deleteRewriteRule(ruleId: string): Promise<boolean> {
    const result = await this.dbService.execute(
      `DELETE FROM query_rewrite_rules WHERE id = ?`,
      [ruleId]
    );

    return result.success && result.meta.changes > 0;
  }

  /**
   * Cleanup old cache entries
   */
  async cleanupCache(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 3600000)).toISOString();
    
    const result = await this.dbService.execute(
      `DELETE FROM query_processing_cache WHERE created_at < ?`,
      [cutoffTime]
    );

    return result.meta?.changes || 0;
  }
}