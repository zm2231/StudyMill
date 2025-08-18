import { DatabaseService } from './database';
import { VectorService } from './vector';
import { TagService } from './tag';
import { createError } from '../middleware/error';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  sourceType: 'document' | 'web' | 'conversation' | 'manual' | 'audio';
  sourceId?: string;
  containerTags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Soft delete support
}

export interface MemoryChunk {
  id: string;
  memoryId: string;
  chunkIndex: number;
  content: string;
  embeddingId?: string;
  tokenCount: number;
  createdAt: string;
}

export interface MemoryRelation {
  id: string;
  memoryAId: string;
  memoryBId: string;
  relationType: 'similar' | 'contradicts' | 'builds_on' | 'references';
  strength: number;
  confidenceScore: number;
  createdBy: 'user' | 'system' | 'llm';
  metadata: Record<string, any>;
  createdAt: string;
}

export interface CreateMemoryData {
  content: string;
  sourceType: Memory['sourceType'];
  sourceId?: string;
  containerTags?: string[];
  metadata?: Record<string, any>;
  tagIds?: string[]; // New hierarchical tag support
}

export interface MemoryFilters {
  sourceType?: string;
  containerTags?: string[];
  tagIds?: string[];
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface MemorySearchFilters extends MemoryFilters {
  similarity?: number; // Minimum similarity threshold
}

export interface MemorySynthesisOptions {
  memoryIds: string[];
  synthesisType: 'summary' | 'comparison' | 'integration';
  includeRelated?: boolean;
  maxRelatedDepth?: number;
}

export class EnhancedMemoryService {
  private vectorService: VectorService;
  private tagService: TagService;

  constructor(
    private dbService: DatabaseService,
    private vectorizeIndex: VectorizeIndex,
    private aiBinding: any
  ) {
    this.vectorService = new VectorService(aiBinding, vectorizeIndex, dbService);
    this.tagService = new TagService(dbService);
  }

  /**
   * Generate a unique ID for memories
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new memory with enhanced features
   */
  async createMemory(userId: string, data: CreateMemoryData): Promise<Memory> {
    const memoryId = this.generateId();
    const now = new Date().toISOString();

    const memory: Memory = {
      id: memoryId,
      userId,
      content: data.content,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      containerTags: data.containerTags || [],
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now
    };

    // Insert memory into database
    const result = await this.dbService.execute(
      `INSERT INTO memories (id, user_id, content, source_type, source_id, container_tags, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.userId,
        memory.content,
        memory.sourceType,
        memory.sourceId,
        JSON.stringify(memory.containerTags),
        JSON.stringify(memory.metadata),
        memory.createdAt,
        memory.updatedAt
      ]
    );

    if (!result.success) {
      throw createError(500, 'Failed to create memory');
    }

    // Create memory chunks and embeddings
    await this.createMemoryChunks(memory);

    // Add hierarchical tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await this.addTagsToMemory(memoryId, data.tagIds, userId);
    }

    // Background task: Find and create relationships with similar memories
    // Skip in test environment to avoid interference
    if (process.env.NODE_ENV !== 'test') {
      this.createAutomaticRelationships(memory).catch(error => {
        console.error('Failed to create automatic relationships:', error);
      });
    }

    return memory;
  }

  /**
   * Get a specific memory by ID with soft delete support
   */
  async getMemory(memoryId: string, userId: string, includeDeleted = false): Promise<Memory | null> {
    const query = includeDeleted 
      ? `SELECT * FROM memories WHERE id = ? AND user_id = ?`
      : `SELECT * FROM memories WHERE id = ? AND user_id = ? AND deleted_at IS NULL`;
    
    const result = await this.dbService.queryFirst(query, [memoryId, userId]);

    if (!result) return null;

    return this.mapDbRowToMemory(result);
  }

  /**
   * Get memories for a user with enhanced filtering
   */
  async getMemories(userId: string, filters: MemoryFilters = {}): Promise<Memory[]> {
    let query = `SELECT DISTINCT m.* FROM memories m`;
    const params: any[] = [userId];
    const conditions = ['m.user_id = ?'];

    // Join with tags if filtering by tag IDs
    if (filters.tagIds && filters.tagIds.length > 0) {
      query += ` JOIN memory_tags mt ON m.id = mt.memory_id`;
      conditions.push(`mt.tag_id IN (${filters.tagIds.map(() => '?').join(', ')})`);
      params.push(...filters.tagIds);
    }

    // Soft delete filter
    if (!filters.includeDeleted) {
      conditions.push('m.deleted_at IS NULL');
    }

    if (filters.sourceType) {
      conditions.push('m.source_type = ?');
      params.push(filters.sourceType);
    }

    if (filters.containerTags && filters.containerTags.length > 0) {
      const tagConditions = filters.containerTags.map(() => 
        `JSON_EXTRACT(m.container_tags, '$') LIKE ?`
      ).join(' OR ');
      conditions.push(`(${tagConditions})`);
      filters.containerTags.forEach(tag => {
        params.push(`%"${tag}"%`);
      });
    }

    query += ` WHERE ${conditions.join(' AND ')} ORDER BY m.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }

    const results = await this.dbService.query(query, params);
    return results.map(row => this.mapDbRowToMemory(row));
  }

  /**
   * Soft delete a memory
   */
  async deleteMemory(memoryId: string, userId: string, permanent = false): Promise<boolean> {
    const existing = await this.getMemory(memoryId, userId, true);
    if (!existing) {
      return false;
    }

    if (permanent) {
      // Permanent delete - remove chunks and embeddings first
      await this.deleteMemoryChunks(memoryId);
      
      // Remove tag associations
      await this.dbService.execute(
        `DELETE FROM memory_tags WHERE memory_id = ?`,
        [memoryId]
      );

      // Remove relationships
      await this.dbService.execute(
        `DELETE FROM memory_relations WHERE memory_a_id = ? OR memory_b_id = ?`,
        [memoryId, memoryId]
      );

      // Delete the memory
      const result = await this.dbService.execute(
        `DELETE FROM memories WHERE id = ? AND user_id = ?`,
        [memoryId, userId]
      );

      return result.success;
    } else {
      // Soft delete
      const result = await this.dbService.execute(
        `UPDATE memories SET deleted_at = ? WHERE id = ? AND user_id = ?`,
        [new Date().toISOString(), memoryId, userId]
      );

      return result.success;
    }
  }

  /**
   * Restore a soft-deleted memory
   */
  async restoreMemory(memoryId: string, userId: string): Promise<boolean> {
    const result = await this.dbService.execute(
      `UPDATE memories SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [memoryId, userId]
    );

    return result.success && result.meta.changes > 0;
  }

  /**
   * Enhanced search with vector similarity and relationship traversal
   */
  async searchMemories(userId: string, query: string, filters: MemorySearchFilters = {}): Promise<any[]> {
    // Generate embedding for search query
    const queryEmbedding = await this.vectorService.generateEmbedding(query);

    // Search vector index with user partitioning
    const vectorResults = await this.vectorizeIndex.query(queryEmbedding, {
      topK: filters.limit || 20,
      filter: {
        user_id: userId,
        ...(filters.sourceType && { source_type: filters.sourceType })
      }
    });

    // Filter by similarity threshold
    const similarityThreshold = filters.similarity || 0.7;
    const filteredResults = vectorResults.matches.filter(match => 
      match.score >= similarityThreshold
    );

    // Get memory details
    const memoryIds = filteredResults.map(match => match.metadata.memory_id);
    if (memoryIds.length === 0) return [];

    const memories = await this.dbService.query(
      `SELECT m.*, 
        GROUP_CONCAT(t.name) as tag_names
       FROM memories m
       LEFT JOIN memory_tags mt ON m.id = mt.memory_id  
       LEFT JOIN tags t ON mt.tag_id = t.id
       WHERE m.id IN (${memoryIds.map(() => '?').join(', ')}) 
         AND m.user_id = ? 
         AND m.deleted_at IS NULL
       GROUP BY m.id`,
      [...memoryIds, userId]
    );

    // Combine with similarity scores
    return memories.map(memory => {
      const match = filteredResults.find(m => m.metadata.memory_id === memory.id);
      return {
        ...this.mapDbRowToMemory(memory),
        score: match?.score || 0,
        tags: memory.tag_names ? memory.tag_names.split(',') : []
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Create automatic relationships between memories using vector similarity
   */
  private async createAutomaticRelationships(memory: Memory): Promise<void> {
    try {
      // Find similar memories using vector search
      const similarMemories = await this.searchMemories(
        memory.userId, 
        memory.content, 
        { 
          similarity: 0.8, // High similarity threshold for automatic relationships
          limit: 5 
        }
      );

      for (const similarMemory of similarMemories) {
        if (similarMemory.id === memory.id) continue;

        // Check if relationship already exists
        const existingRelation = await this.dbService.queryFirst(
          `SELECT 1 FROM memory_relations 
           WHERE (memory_a_id = ? AND memory_b_id = ?) 
              OR (memory_a_id = ? AND memory_b_id = ?)`,
          [memory.id, similarMemory.id, similarMemory.id, memory.id]
        );

        if (!existingRelation) {
          // Determine relationship type using LLM
          const relationType = await this.determineRelationshipType(memory, similarMemory);
          
          await this.createMemoryRelation({
            memoryAId: memory.id,
            memoryBId: similarMemory.id,
            relationType,
            strength: similarMemory.score,
            confidenceScore: similarMemory.score,
            createdBy: 'system',
            metadata: {
              automaticCreation: true,
              vectorSimilarity: similarMemory.score
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to create automatic relationships:', error);
    }
  }

  /**
   * Use LLM to determine relationship type between memories
   */
  private async determineRelationshipType(memoryA: Memory, memoryB: Memory): Promise<MemoryRelation['relationType']> {
    try {
      // Validate memory objects
      if (!memoryA || !memoryB || !memoryA.content || !memoryB.content) {
        return 'similar';
      }

      // Simple heuristic for now - can be enhanced with actual LLM call
      const contentA = memoryA.content.toLowerCase();
      const contentB = memoryB.content.toLowerCase();

      // Check for contradictory language
      if ((contentA.includes('not') || contentA.includes('however') || contentA.includes('but')) &&
          (contentB.includes('not') || contentB.includes('however') || contentB.includes('but'))) {
        return 'contradicts';
      }

      // Check for building/expanding language
      if (contentA.includes('furthermore') || contentA.includes('additionally') || 
          contentB.includes('furthermore') || contentB.includes('additionally')) {
        return 'builds_on';
      }

      // Check for reference language
      if (contentA.includes('see') || contentA.includes('refer') || 
          contentB.includes('see') || contentB.includes('refer')) {
        return 'references';
      }

      // Default to similar
      return 'similar';
    } catch (error) {
      console.error('Failed to determine relationship type:', error);
      return 'similar';
    }
  }

  /**
   * Create a memory relation
   */
  async createMemoryRelation(data: {
    memoryAId: string;
    memoryBId: string;
    relationType: MemoryRelation['relationType'];
    strength: number;
    confidenceScore?: number;
    createdBy?: MemoryRelation['createdBy'];
    metadata?: Record<string, any>;
  }): Promise<MemoryRelation> {
    const relationId = this.generateId();
    const now = new Date().toISOString();

    const relation: MemoryRelation = {
      id: relationId,
      memoryAId: data.memoryAId,
      memoryBId: data.memoryBId,
      relationType: data.relationType,
      strength: data.strength,
      confidenceScore: data.confidenceScore || data.strength,
      createdBy: data.createdBy || 'user',
      metadata: data.metadata || {},
      createdAt: now
    };

    const result = await this.dbService.execute(
      `INSERT INTO memory_relations 
       (id, memory_a_id, memory_b_id, relation_type, strength, confidence_score, created_by, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relation.id,
        relation.memoryAId,
        relation.memoryBId,
        relation.relationType,
        relation.strength,
        relation.confidenceScore,
        relation.createdBy,
        JSON.stringify(relation.metadata),
        relation.createdAt
      ]
    );

    if (!result.success) {
      throw createError(500, 'Failed to create memory relation');
    }

    return relation;
  }

  /**
   * Synthesize memories using LLM
   */
  async synthesizeMemories(userId: string, options: MemorySynthesisOptions): Promise<{
    synthesis: string;
    sourceMemories: Memory[];
    relatedMemories?: Memory[];
  }> {
    // Get source memories
    const sourceMemories = await Promise.all(
      options.memoryIds.map(id => this.getMemory(id, userId))
    );

    const validMemories = sourceMemories.filter(m => m !== null) as Memory[];
    
    if (validMemories.length === 0) {
      throw createError(400, 'No valid memories found');
    }

    // Get related memories if requested
    let relatedMemories: Memory[] = [];
    if (options.includeRelated) {
      relatedMemories = await this.getRelatedMemories(
        userId, 
        options.memoryIds, 
        options.maxRelatedDepth || 1
      );
    }

    // Combine content for synthesis
    const combinedContent = validMemories.map(m => m.content).join('\n\n');
    const relatedContent = relatedMemories.map(m => m.content).join('\n\n');

    // Create synthesis prompt based on type
    let prompt = '';
    switch (options.synthesisType) {
      case 'summary':
        prompt = `Please create a comprehensive summary of the following memories:\n\n${combinedContent}`;
        break;
      case 'comparison':
        prompt = `Please compare and contrast the following memories, highlighting similarities and differences:\n\n${combinedContent}`;
        break;
      case 'integration':
        prompt = `Please integrate the following memories into a coherent narrative or explanation:\n\n${combinedContent}`;
        break;
    }

    if (relatedContent) {
      prompt += `\n\nAdditional related context:\n${relatedContent}`;
    }

    // Use Gemini to generate synthesis (simplified - would need actual API call)
    const synthesis = await this.generateSynthesis(prompt);

    return {
      synthesis,
      sourceMemories: validMemories,
      relatedMemories: options.includeRelated ? relatedMemories : undefined
    };
  }

  /**
   * Get related memories through relationship traversal
   */
  private async getRelatedMemories(userId: string, memoryIds: string[], maxDepth: number): Promise<Memory[]> {
    const visited = new Set<string>(memoryIds);
    const relatedIds = new Set<string>();
    let currentDepth = 0;

    while (currentDepth < maxDepth) {
      const currentIds = currentDepth === 0 ? memoryIds : Array.from(relatedIds);
      if (currentIds.length === 0) break;

      const relations = await this.dbService.query(
        `SELECT memory_a_id, memory_b_id FROM memory_relations 
         WHERE memory_a_id IN (${currentIds.map(() => '?').join(', ')}) 
            OR memory_b_id IN (${currentIds.map(() => '?').join(', ')})`,
        [...currentIds, ...currentIds]
      );

      let foundNew = false;
      for (const relation of relations) {
        const otherMemoryId = currentIds.includes(relation.memory_a_id) 
          ? relation.memory_b_id 
          : relation.memory_a_id;

        if (!visited.has(otherMemoryId)) {
          relatedIds.add(otherMemoryId);
          visited.add(otherMemoryId);
          foundNew = true;
        }
      }

      if (!foundNew) break;
      currentDepth++;
    }

    // Get memory details
    if (relatedIds.size === 0) return [];

    const relatedMemories = await Promise.all(
      Array.from(relatedIds).map(id => this.getMemory(id, userId))
    );

    return relatedMemories.filter(m => m !== null) as Memory[];
  }

  /**
   * Add hierarchical tags to memory
   */
  async addTagsToMemory(memoryId: string, tagIds: string[], userId: string): Promise<void> {
    for (const tagId of tagIds) {
      await this.tagService.addTagToMemory(memoryId, tagId, userId);
    }
  }

  /**
   * Generate synthesis using LLM (placeholder - needs actual implementation)
   */
  private async generateSynthesis(prompt: string): Promise<string> {
    // This would call Gemini API for actual synthesis
    // For now, return a placeholder
    return `[Synthesis would be generated here using: ${prompt.substring(0, 100)}...]`;
  }

  // ... (include all the existing methods from the original MemoryService)
  // createMemoryChunks, deleteMemoryChunks, mapDbRowToMemory, etc.

  /**
   * Create memory chunks and embeddings
   */
  private async createMemoryChunks(memory: Memory): Promise<void> {
    // Simple chunking - split by sentences and limit to ~500 chars
    const sentences = memory.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > 500 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence.trim();
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Create database entries and embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = this.generateId();
      const chunk = chunks[i];

      // Insert chunk into database
      await this.dbService.execute(
        `INSERT INTO memory_chunks (id, memory_id, chunk_index, content, token_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          chunkId,
          memory.id,
          i,
          chunk,
          Math.ceil(chunk.length / 4), // Rough token estimate
          new Date().toISOString()
        ]
      );

      // Create embedding for the chunk
      try {
        const embedding = await this.vectorService.generateEmbedding(chunk);
        
        // Store in Vectorize with user partitioning metadata
        await this.vectorizeIndex.upsert([{
          id: chunkId,
          vector: embedding,
          metadata: {
            user_id: memory.userId,
            memory_id: memory.id,
            source_type: memory.sourceType,
            container_tags: memory.containerTags,
            chunk_index: i,
            created_at: memory.createdAt
          }
        }]);

        // Update chunk with embedding ID
        await this.dbService.execute(
          `UPDATE memory_chunks SET embedding_id = ? WHERE id = ?`,
          [chunkId, chunkId]
        );
      } catch (error) {
        console.error(`Failed to create embedding for chunk ${chunkId}:`, error);
        // Continue with other chunks even if one fails
      }
    }
  }

  /**
   * Delete memory chunks and their embeddings
   */
  private async deleteMemoryChunks(memoryId: string): Promise<void> {
    // Get chunk IDs for embedding deletion
    const chunks = await this.dbService.query(
      `SELECT id FROM memory_chunks WHERE memory_id = ?`,
      [memoryId]
    );

    // Delete embeddings from Vectorize
    const chunkIds = chunks.map(chunk => chunk.id);
    if (chunkIds.length > 0) {
      try {
        await this.vectorizeIndex.deleteByIds(chunkIds);
      } catch (error) {
        console.error('Failed to delete embeddings:', error);
      }
    }

    // Delete chunks from database
    await this.dbService.execute(
      `DELETE FROM memory_chunks WHERE memory_id = ?`,
      [memoryId]
    );
  }

  /**
   * Map database row to Memory object
   */
  private mapDbRowToMemory(row: any): Memory {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      sourceType: row.source_type,
      sourceId: row.source_id,
      containerTags: row.container_tags ? 
        (typeof row.container_tags === 'string' ? JSON.parse(row.container_tags) : row.container_tags) : [],
      metadata: row.metadata ? 
        (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }
}