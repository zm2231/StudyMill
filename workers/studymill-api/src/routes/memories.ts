import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createError } from '../middleware/error';
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
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

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
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

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
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

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
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

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
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

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

// Search memories
memoryRoutes.post('/search', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    
    const { query, filters = {}, limit = 10 } = body;

    if (!query) {
      throw createError(400, 'Search query is required');
    }

    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

    const results = await memoryService.searchMemories(userId, query, {
      ...filters,
      limit
    });

    return c.json({ results, query, filters });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to search memories', error.message);
  }
});

// Import from document
memoryRoutes.post('/import/document', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    
    const { document_id, container_tags = [] } = body;

    if (!document_id) {
      throw createError(400, 'Document ID is required');
    }

    const dbService = new DatabaseService(c.env.DB);
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

    const memories = await memoryService.importFromDocument(document_id, userId, container_tags);

    return c.json({ memories, imported: memories.length });
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
    const memoryService = new MemoryService(dbService, c.env.VECTORIZE, c.env.GEMINI_API_KEY);

    const relations = await memoryService.getMemoryRelations(memoryId, userId, limit);

    return c.json({ relations });
  } catch (error: any) {
    if (error.status) throw error;
    throw createError(500, 'Failed to fetch memory relations', error.message);
  }
});

export { memoryRoutes };