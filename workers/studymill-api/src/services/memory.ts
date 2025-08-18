import { DatabaseService } from './database';
import { VectorService } from './vector';
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
  createdAt: string;
}

export interface CreateMemoryData {
  content: string;
  sourceType: Memory['sourceType'];
  sourceId?: string;
  containerTags?: string[];
  metadata?: Record<string, any>;
}

export interface MemoryFilters {
  sourceType?: string;
  containerTags?: string[];
  limit?: number;
  offset?: number;
}

export interface MemorySearchFilters {
  sourceType?: string;
  containerTags?: string[];
  limit?: number;
}

export class MemoryService {
  private vectorService: VectorService;

  constructor(
    private dbService: DatabaseService,
    private vectorizeIndex: VectorizeIndex,
    geminiApiKey: string
  ) {
    this.vectorService = new VectorService(geminiApiKey, vectorizeIndex, dbService);
  }

  /**
   * Generate a unique ID for memories
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new memory
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

    return memory;
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId: string, userId: string): Promise<Memory | null> {
    const result = await this.dbService.queryFirst(
      `SELECT * FROM memories WHERE id = ? AND user_id = ?`,
      [memoryId, userId]
    );

    if (!result) return null;

    return this.mapDbRowToMemory(result);
  }

  /**
   * Get memories for a user with optional filtering
   */
  async getMemories(userId: string, filters: MemoryFilters = {}): Promise<Memory[]> {
    let query = `SELECT * FROM memories WHERE user_id = ?`;
    const params: any[] = [userId];

    if (filters.sourceType) {
      query += ` AND source_type = ?`;
      params.push(filters.sourceType);
    }

    if (filters.containerTags && filters.containerTags.length > 0) {
      // Use JSON_EXTRACT for SQLite to check if any tag matches
      const tagConditions = filters.containerTags.map(() => 
        `JSON_EXTRACT(container_tags, '$') LIKE ?`
      ).join(' OR ');
      query += ` AND (${tagConditions})`;
      filters.containerTags.forEach(tag => {
        params.push(`%"${tag}"%`);
      });
    }

    query += ` ORDER BY created_at DESC`;

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
   * Update a memory
   */
  async updateMemory(memoryId: string, userId: string, updates: Partial<CreateMemoryData>): Promise<Memory | null> {
    // First check if memory exists and belongs to user
    const existing = await this.getMemory(memoryId, userId);
    if (!existing) {
      return null;
    }

    const updateFields = [];
    const params = [];

    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      params.push(updates.content);
    }

    if (updates.containerTags !== undefined) {
      updateFields.push('container_tags = ?');
      params.push(JSON.stringify(updates.containerTags));
    }

    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    if (updateFields.length === 0) {
      return existing; // No updates needed
    }

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(memoryId, userId);

    const result = await this.dbService.execute(
      `UPDATE memories SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    if (!result.success) {
      throw createError(500, 'Failed to update memory');
    }

    // If content was updated, recreate chunks and embeddings
    if (updates.content !== undefined) {
      await this.recreateMemoryChunks(memoryId, updates.content);
    }

    return this.getMemory(memoryId, userId);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
    // First check if memory exists and belongs to user
    const existing = await this.getMemory(memoryId, userId);
    if (!existing) {
      return false;
    }

    // Delete memory chunks first (cascades to embeddings)
    await this.deleteMemoryChunks(memoryId);

    // Delete the memory
    const result = await this.dbService.execute(
      `DELETE FROM memories WHERE id = ? AND user_id = ?`,
      [memoryId, userId]
    );

    return result.success;
  }

  /**
   * Search memories using vector similarity and keyword search
   */
  async searchMemories(userId: string, query: string, filters: MemorySearchFilters = {}): Promise<any[]> {
    // This is a simplified implementation - in a real scenario, you'd use
    // the SemanticSearchService to search memory chunks with user partitioning
    const memories = await this.getMemories(userId, {
      sourceType: filters.sourceType,
      containerTags: filters.containerTags,
      limit: filters.limit || 10
    });

    // Simple text search for now - should be replaced with vector search
    const searchResults = memories.filter(memory => 
      memory.content.toLowerCase().includes(query.toLowerCase())
    );

    return searchResults.map(memory => ({
      id: memory.id,
      score: 0.8, // Placeholder score
      content: memory.content,
      sourceType: memory.sourceType,
      containerTags: memory.containerTags,
      metadata: memory.metadata
    }));
  }

  /**
   * Import memories from audio transcription with timestamp alignment
   */
  async importFromAudioTranscription(
    transcription: any, // TranscriptionResult from audioProcessor
    topicSegments: any[], // TopicSegment[] from audioProcessor
    audioFileId: string,
    userId: string,
    containerTags: string[] = []
  ): Promise<Memory[]> {
    const memories: Memory[] = [];

    // Create memories for each topic segment with timestamp alignment
    for (const topicSegment of topicSegments) {
      // Find transcript segments that fall within this topic's time range
      const relevantSegments = transcription.segments.filter((seg: any) =>
        seg.start >= topicSegment.startTime && seg.end <= topicSegment.endTime
      );

      // Combine text from relevant segments
      const segmentText = relevantSegments.map((seg: any) => seg.text).join(' ');
      
      // Create memory for this topic segment
      const memory = await this.createMemory(userId, {
        content: segmentText || topicSegment.summary,
        sourceType: 'audio',
        sourceId: audioFileId,
        containerTags: [...containerTags, topicSegment.topic],
        metadata: {
          // Audio-specific metadata
          startTime: topicSegment.startTime,
          endTime: topicSegment.endTime,
          duration: topicSegment.endTime - topicSegment.startTime,
          topic: topicSegment.topic,
          summary: topicSegment.summary,
          keyPoints: topicSegment.keyPoints,
          confidence: topicSegment.confidence,
          
          // Transcript segment details
          segmentCount: relevantSegments.length,
          segmentDetails: relevantSegments.map((seg: any) => ({
            id: seg.id,
            start: seg.start,
            end: seg.end,
            text: seg.text,
            words: seg.words || []
          })),
          
          // Original transcription metadata
          transcriptionLanguage: transcription.language,
          transcriptionBackend: transcription.backend,
          processingTime: transcription.processingTime,
          
          // Memory type indicator
          memoryType: 'audio_topic_segment'
        }
      });

      memories.push(memory);
    }

    // Also create a full transcription memory for complete context
    const fullTranscriptionMemory = await this.createMemory(userId, {
      content: transcription.text,
      sourceType: 'audio',
      sourceId: audioFileId,
      containerTags: [...containerTags, 'full_transcription'],
      metadata: {
        // Full transcription metadata
        duration: transcription.duration,
        language: transcription.language,
        backend: transcription.backend,
        processingTime: transcription.processingTime,
        
        // Segment overview
        totalSegments: transcription.segments.length,
        topicCount: topicSegments.length,
        
        // Word-level timestamps if available
        wordTimestamps: transcription.words || [],
        
        // Segment-level timestamps
        segmentTimestamps: transcription.segments.map((seg: any) => ({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          text: seg.text
        })),
        
        // Topics overview
        topics: topicSegments.map(topic => ({
          topic: topic.topic,
          startTime: topic.startTime,
          endTime: topic.endTime,
          confidence: topic.confidence
        })),
        
        // Memory type indicator
        memoryType: 'audio_full_transcription'
      }
    });

    memories.push(fullTranscriptionMemory);

    return memories;
  }

  /**
   * Import memories from a document
   */
  async importFromDocument(documentId: string, userId: string, containerTags: string[] = []): Promise<Memory[]> {
    // Get document chunks that belong to this user and document
    const chunks = await this.dbService.query(
      `SELECT * FROM document_chunks WHERE document_id = ? AND user_id = ? ORDER BY chunk_index`,
      [documentId, userId]
    );

    const memories: Memory[] = [];

    for (const chunk of chunks) {
      const memory = await this.createMemory(userId, {
        content: chunk.content_text,
        sourceType: 'document',
        sourceId: documentId,
        containerTags,
        metadata: {
          pageNumber: chunk.page_number,
          chunkIndex: chunk.chunk_index,
          contentType: chunk.content_type
        }
      });
      memories.push(memory);
    }

    return memories;
  }

  /**
   * Search audio memories by timestamp range
   */
  async searchAudioMemoriesByTimestamp(
    userId: string,
    audioFileId: string,
    startTime: number,
    endTime: number
  ): Promise<Memory[]> {
    const memories = await this.getMemories(userId, {
      sourceType: 'audio'
    });

    // Filter memories that overlap with the requested time range
    return memories.filter(memory => {
      if (memory.sourceId !== audioFileId) return false;
      
      const memoryStartTime = memory.metadata.startTime;
      const memoryEndTime = memory.metadata.endTime;
      
      // Check if memory time range overlaps with requested range
      return memoryStartTime !== undefined && memoryEndTime !== undefined &&
             memoryStartTime < endTime && memoryEndTime > startTime;
    });
  }

  /**
   * Get audio memories for a specific topic
   */
  async getAudioMemoriesByTopic(
    userId: string,
    audioFileId: string,
    topic: string
  ): Promise<Memory[]> {
    const memories = await this.getMemories(userId, {
      sourceType: 'audio',
      containerTags: [topic]
    });

    return memories.filter(memory => memory.sourceId === audioFileId);
  }

  /**
   * Get full audio transcription with all segments
   */
  async getFullAudioTranscription(
    userId: string,
    audioFileId: string
  ): Promise<Memory | null> {
    const memories = await this.getMemories(userId, {
      sourceType: 'audio',
      containerTags: ['full_transcription']
    });

    return memories.find(memory => 
      memory.sourceId === audioFileId && 
      memory.metadata.memoryType === 'audio_full_transcription'
    ) || null;
  }

  /**
   * Get memory relationships
   */
  async getMemoryRelations(memoryId: string, userId: string, limit: number = 10): Promise<MemoryRelation[]> {
    // First verify the memory belongs to the user
    const memory = await this.getMemory(memoryId, userId);
    if (!memory) {
      throw createError(404, 'Memory not found');
    }

    const results = await this.dbService.query(
      `SELECT mr.* FROM memory_relations mr
       JOIN memories ma ON mr.memory_a_id = ma.id
       JOIN memories mb ON mr.memory_b_id = mb.id
       WHERE (mr.memory_a_id = ? OR mr.memory_b_id = ?)
       AND ma.user_id = ? AND mb.user_id = ?
       ORDER BY mr.strength DESC
       LIMIT ?`,
      [memoryId, memoryId, userId, userId, limit]
    );

    return results.map(row => ({
      id: row.id,
      memoryAId: row.memory_a_id,
      memoryBId: row.memory_b_id,
      relationType: row.relation_type,
      strength: row.strength,
      createdAt: row.created_at
    }));
  }

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
   * Recreate memory chunks after content update
   */
  private async recreateMemoryChunks(memoryId: string, newContent: string): Promise<void> {
    // Delete existing chunks
    await this.deleteMemoryChunks(memoryId);

    // Create new chunks
    const memory = await this.dbService.queryFirst(
      `SELECT * FROM memories WHERE id = ?`,
      [memoryId]
    );

    if (memory) {
      const memoryObj = this.mapDbRowToMemory(memory);
      memoryObj.content = newContent;
      await this.createMemoryChunks(memoryObj);
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
      containerTags: row.container_tags ? JSON.parse(row.container_tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}