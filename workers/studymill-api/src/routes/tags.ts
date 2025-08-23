import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

interface Env {
  DB: D1Database;
}

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

const attachTagsSchema = z.object({
  tagIds: z.array(z.string())
});

export const tagsRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
tagsRouter.use('*', authMiddleware);

// GET /api/tags - Get all tags for user
tagsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const tags = await c.env.DB.prepare(`
      SELECT 
        t.id,
        t.name,
        t.color,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT dt.document_id) as document_count
      FROM tags t
      LEFT JOIN document_tags dt ON t.id = dt.tag_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.name ASC
    `).bind(userId).all();

    return c.json({ tags: tags.results });
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

// POST /api/tags - Create new tag
tagsRouter.post('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const body = await c.req.json();
    const validated = createTagSchema.parse(body);
    
    // Check if tag already exists
    const existing = await c.env.DB.prepare(`
      SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?)
    `).bind(userId, validated.name).first();
    
    if (existing) {
      return c.json({ error: 'Tag already exists' }, 409);
    }

    const id = uuidv4();
    const color = validated.color || '#4A7C2A';

    await c.env.DB.prepare(`
      INSERT INTO tags (id, user_id, name, color)
      VALUES (?, ?, ?, ?)
    `).bind(id, userId, validated.name, color).run();

    const tag = await c.env.DB.prepare(`
      SELECT * FROM tags WHERE id = ?
    `).bind(id).first();

    return c.json({ tag }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('Failed to create tag:', error);
    return c.json({ error: 'Failed to create tag' }, 500);
  }
});

// PATCH /api/tags/:id - Update tag
tagsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const tagId = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const validated = updateTagSchema.parse(body);
    
    // Check ownership
    const existing = await c.env.DB.prepare(`
      SELECT * FROM tags WHERE id = ? AND user_id = ?
    `).bind(tagId, userId).first();
    
    if (!existing) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    // Check for duplicate name if updating name
    if (validated.name && validated.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await c.env.DB.prepare(`
        SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id != ?
      `).bind(userId, validated.name, tagId).first();
      
      if (duplicate) {
        return c.json({ error: 'Tag with this name already exists' }, 409);
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    
    if (validated.name !== undefined) {
      updates.push('name = ?');
      values.push(validated.name);
    }
    if (validated.color !== undefined) {
      updates.push('color = ?');
      values.push(validated.color);
    }
    
    if (updates.length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(tagId);

    await c.env.DB.prepare(`
      UPDATE tags 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    const updated = await c.env.DB.prepare(`
      SELECT * FROM tags WHERE id = ?
    `).bind(tagId).first();

    return c.json({ tag: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('Failed to update tag:', error);
    return c.json({ error: 'Failed to update tag' }, 500);
  }
});

// DELETE /api/tags/:id - Delete tag
tagsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const tagId = c.req.param('id');
  
  try {
    // Check ownership
    const existing = await c.env.DB.prepare(`
      SELECT * FROM tags WHERE id = ? AND user_id = ?
    `).bind(tagId, userId).first();
    
    if (!existing) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    // Delete tag (document_tags will be cascade deleted)
    await c.env.DB.prepare(`
      DELETE FROM tags WHERE id = ?
    `).bind(tagId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete tag:', error);
    return c.json({ error: 'Failed to delete tag' }, 500);
  }
});

// POST /api/documents/:documentId/tags - Attach tags to document
tagsRouter.post('/documents/:documentId/tags', async (c) => {
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  
  try {
    const body = await c.req.json();
    const validated = attachTagsSchema.parse(body);
    
    // Verify document ownership
    const document = await c.env.DB.prepare(`
      SELECT id FROM documents WHERE id = ? AND user_id = ?
    `).bind(documentId, userId).first();
    
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Verify all tags exist and belong to user
    if (validated.tagIds.length > 0) {
      const placeholders = validated.tagIds.map(() => '?').join(',');
      const tags = await c.env.DB.prepare(`
        SELECT id FROM tags 
        WHERE user_id = ? AND id IN (${placeholders})
      `).bind(userId, ...validated.tagIds).all();
      
      if (tags.results.length !== validated.tagIds.length) {
        return c.json({ error: 'Some tags not found' }, 400);
      }
    }

    // Clear existing tags
    await c.env.DB.prepare(`
      DELETE FROM document_tags WHERE document_id = ?
    `).bind(documentId).run();

    // Attach new tags
    if (validated.tagIds.length > 0) {
      const values = validated.tagIds.map(tagId => `('${documentId}', '${tagId}')`).join(',');
      await c.env.DB.prepare(`
        INSERT INTO document_tags (document_id, tag_id) VALUES ${values}
      `).run();
    }

    // Return updated tag list
    const attachedTags = await c.env.DB.prepare(`
      SELECT t.* FROM tags t
      JOIN document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = ?
      ORDER BY t.name ASC
    `).bind(documentId).all();

    return c.json({ tags: attachedTags.results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('Failed to attach tags:', error);
    return c.json({ error: 'Failed to attach tags' }, 500);
  }
});

// GET /api/documents/:documentId/tags - Get tags for document
tagsRouter.get('/documents/:documentId/tags', async (c) => {
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  
  try {
    // Verify document ownership
    const document = await c.env.DB.prepare(`
      SELECT id FROM documents WHERE id = ? AND user_id = ?
    `).bind(documentId, userId).first();
    
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const tags = await c.env.DB.prepare(`
      SELECT t.* FROM tags t
      JOIN document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = ?
      ORDER BY t.name ASC
    `).bind(documentId).all();

    return c.json({ tags: tags.results });
  } catch (error) {
    console.error('Failed to fetch document tags:', error);
    return c.json({ error: 'Failed to fetch document tags' }, 500);
  }
});