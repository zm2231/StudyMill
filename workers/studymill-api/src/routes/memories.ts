import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createError } from '../middleware/error';
import { EnhancedMemoryService } from '../services/enhancedMemory';
import { MemoryService } from '../services/memory';
import { DatabaseService } from '../services/database';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
  GEMINI_API_KEY: string;
};

const memoryRoutes = new Hono<{ Bindings: Bindings }>();

// Apply authentication to all memory routes
memoryRoutes.use('*', authMiddleware);

// Get all memories for user
memoryRoutes.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    // Get query parameters for filtering
    const sourceType = c.req.query('source_type');
    const containerTags = c.req.query('container_tags');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const filters = {
      sourceType,
      containerTags: containerTags ? containerTags.split(',') : undefined,
      limit,
      offset
    };

    const memories = await memoryService.getMemories(userId, filters);
    
    return c.json({
      memories,
      total: memories.length,
      limit,
      offset
    });
  } catch (error: any) {
    throw createError(500, 'Failed to fetch memories', error.message);
  }
});

// Get specific memory
memoryRoutes.get('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const memoryId = c.req.param('id');
    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    const memory = await memoryService.getMemory(memoryId, userId);
    
    if (!memory) {
      throw createError(404, 'Memory not found');
    }

    return c.json({ memory });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to fetch memory', error.message);
  }
});

// Create new memory
memoryRoutes.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    
    const { content, source_type, source_id, container_tags, metadata } = body;

    if (!content || !source_type) {
      throw createError(400, 'Content and source_type are required');
    }

    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    const memory = await memoryService.createMemory(userId, {
      content,
      sourceType: source_type,
      sourceId: source_id,
      containerTags: container_tags || [],
      metadata: metadata || {}
    });

    return c.json({ memory }, 201);
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to create memory', error.message);
  }
});

// Update memory
memoryRoutes.put('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const memoryId = c.req.param('id');
    const body = await c.req.json();
    
    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    const memory = await memoryService.updateMemory(memoryId, userId, body);
    
    if (!memory) {
      throw createError(404, 'Memory not found');
    }

    return c.json({ memory });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to update memory', error.message);
  }
});

// Delete memory
memoryRoutes.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const memoryId = c.req.param('id');
    
    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    const deleted = await memoryService.deleteMemory(memoryId, userId);
    
    if (!deleted) {
      throw createError(404, 'Memory not found');
    }

    return c.json({ success: true });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to delete memory', error.message);
  }
});

// ENHANCED: Search memories with academic workflow optimization
memoryRoutes.post('/search', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    
    const { query, filters = {}, limit = 10, workflow = 'studying' } = body;

    if (!query) {
      throw createError(400, 'Search query is required');
    }

    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    // Use the enhanced memory search for context-optimized results
    const results = await memoryService.searchMemories(userId, query, {
      ...filters,
      limit
    });

    // Add workflow-specific enhancements
    const enhancedResults = results.map(result => ({
      ...result,
      workflowOptimized: workflow === 'studying',
      relationshipData: result.metadata?.relationships || [],
      crossCourseConnections: result.containerTags?.length > 1
    }));

    return c.json({ 
      results: enhancedResults, 
      query, 
      filters,
      workflow,
      searchType: 'memory_context_optimized'
    });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to search memories', error.message);
  }
});

// ENHANCED: Import from document using hybrid approach
memoryRoutes.post('/import/document', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    
    const { document_id, container_tags = [], processing_level = 'basic' } = body;

    if (!document_id) {
      throw createError(400, 'Document ID is required');
    }

    const dbService = new DatabaseService(c.env.DB);
    
    // HYBRID APPROACH: Use basic MemoryService for bulk document imports (efficiency)
    // This creates document-optimized vectors for structure preservation
    const basicMemoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.AI);
    const documentMemories = await basicMemoryService.importFromDocument(document_id, userId, container_tags);

    // If premium processing or user annotations, also create enhanced memory vectors
    let enhancedMemories = [];
    if (processing_level === 'premium' || container_tags.length > 1) {
      const enhancedMemoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);
      
      // Create selective enhanced memories for key content
      for (const memory of documentMemories.slice(0, 3)) { // Limit to first 3 for cost efficiency
        const enhancedMemory = await enhancedMemoryService.createMemory(userId, {
          content: memory.content,
          sourceType: 'document',
          sourceId: document_id,
          containerTags: [...container_tags, 'enhanced_processing'],
          metadata: {
            originalMemoryId: memory.id,
            processingLevel: 'premium',
            userAnnotated: true
          }
        });
        enhancedMemories.push(enhancedMemory);
      }
    }

    return c.json({ 
      documentMemories,
      enhancedMemories,
      imported: documentMemories.length,
      enhanced: enhancedMemories.length,
      processingLevel: processing_level,
      hybridApproach: true
    });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to import from document', error.message);
  }
});

// Get memory relationships
memoryRoutes.get('/:id/relations', async (c) => {
  try {
    const userId = c.get('userId');
    const memoryId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '10');
    
    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    const relations = await memoryService.getMemoryRelations(memoryId, userId, limit);

    return c.json({ relations });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to fetch memory relations', error.message);
  }
});

// Synthesize memories using AI
memoryRoutes.post('/synthesize', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      memoryIds, 
      focus,
      maxResults = 5
    } = await c.req.json();
    
    if (!memoryIds || !Array.isArray(memoryIds) || memoryIds.length === 0) {
      return c.json({
        success: false,
        error: 'Memory IDs array is required'
      }, 400);
    }

    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);

    // Use the AI synthesis functionality
    const result = await memoryService.synthesizeMemories(userId, {
      memoryIds,
      focus: focus || 'comprehensive',
      maxResults,
      includeRelated: true,
      minSimilarity: 0.7
    });

    return c.json({
      success: true,
      synthesis: result
    });

  } catch (error) {
    console.error('Memory synthesis failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Memory synthesis failed'
    }, 500);
  }
});

export { memoryRoutes };