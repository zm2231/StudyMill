import { Hono } from 'hono';

export const notesRoutes = new Hono();

notesRoutes.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const { title, content, courseId, documentId, tags } = await c.req.json();

    if (!title || !content) {
      return c.json({
        code: 'VALIDATION_ERROR',
        message: 'Title and content are required',
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }, 400);
    }

    const noteId = crypto.randomUUID();
    const contentPreview = content.replace(/<[^>]*>/g, '').substring(0, 200);
    const tagsJson = tags ? JSON.stringify(tags) : null;

    const result = await c.env.DB.prepare(`
      INSERT INTO notes (id, user_id, course_id, document_id, title, content, content_preview, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(noteId, userId, courseId || null, documentId || null, title, content, contentPreview, tagsJson).run();

    if (!result.success) {
      throw new Error('Failed to create note');
    }

    const note = await c.env.DB.prepare(`
      SELECT * FROM notes WHERE id = ?
    `).bind(noteId).first();

    return c.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Note creation error:', error);
    return c.json({
      code: 'NOTE_CREATION_ERROR',
      message: 'Failed to create note',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

notesRoutes.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const courseId = c.req.query('courseId');
    const documentId = c.req.query('documentId');
    const search = c.req.query('search');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = `
      SELECT n.*, c.name as course_name, c.code as course_code, d.title as document_title
      FROM notes n
      LEFT JOIN courses c ON n.course_id = c.id
      LEFT JOIN documents d ON n.document_id = d.id
      WHERE n.user_id = ?
    `;
    const params = [userId];

    if (courseId) {
      query += ' AND n.course_id = ?';
      params.push(courseId);
    }

    if (documentId) {
      query += ' AND n.document_id = ?';
      params.push(documentId);
    }

    if (search) {
      query += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.content_preview LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY n.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const notes = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({
      success: true,
      data: notes.results || []
    });
  } catch (error) {
    console.error('Notes fetch error:', error);
    return c.json({
      code: 'NOTES_FETCH_ERROR',
      message: 'Failed to fetch notes',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

notesRoutes.get('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const noteId = c.req.param('id');

    const note = await c.env.DB.prepare(`
      SELECT n.*, c.name as course_name, c.code as course_code, d.title as document_title
      FROM notes n
      LEFT JOIN courses c ON n.course_id = c.id
      LEFT JOIN documents d ON n.document_id = d.id
      WHERE n.id = ? AND n.user_id = ?
    `).bind(noteId, userId).first();

    if (!note) {
      return c.json({
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found',
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }, 404);
    }

    return c.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Note fetch error:', error);
    return c.json({
      code: 'NOTE_FETCH_ERROR',
      message: 'Failed to fetch note',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

notesRoutes.put('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const noteId = c.req.param('id');
    const { title, content, courseId, documentId, tags } = await c.req.json();

    // Verify note exists and belongs to user
    const existingNote = await c.env.DB.prepare(`
      SELECT id FROM notes WHERE id = ? AND user_id = ?
    `).bind(noteId, userId).first();

    if (!existingNote) {
      return c.json({
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found',
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }, 404);
    }

    const contentPreview = content ? content.replace(/<[^>]*>/g, '').substring(0, 200) : undefined;
    const tagsJson = tags ? JSON.stringify(tags) : null;

    const updateFields = [];
    const params = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updateFields.push('content = ?');
      params.push(content);
    }
    if (contentPreview !== undefined) {
      updateFields.push('content_preview = ?');
      params.push(contentPreview);
    }
    if (courseId !== undefined) {
      updateFields.push('course_id = ?');
      params.push(courseId);
    }
    if (documentId !== undefined) {
      updateFields.push('document_id = ?');
      params.push(documentId);
    }
    if (tags !== undefined) {
      updateFields.push('tags = ?');
      params.push(tagsJson);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(noteId, userId);

    const result = await c.env.DB.prepare(`
      UPDATE notes SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new Error('Failed to update note');
    }

    const updatedNote = await c.env.DB.prepare(`
      SELECT n.*, c.name as course_name, c.code as course_code, d.title as document_title
      FROM notes n
      LEFT JOIN courses c ON n.course_id = c.id
      LEFT JOIN documents d ON n.document_id = d.id
      WHERE n.id = ? AND n.user_id = ?
    `).bind(noteId, userId).first();

    return c.json({
      success: true,
      data: updatedNote
    });
  } catch (error) {
    console.error('Note update error:', error);
    return c.json({
      code: 'NOTE_UPDATE_ERROR',
      message: 'Failed to update note',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

notesRoutes.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const noteId = c.req.param('id');

    // Verify note exists and belongs to user
    const existingNote = await c.env.DB.prepare(`
      SELECT id FROM notes WHERE id = ? AND user_id = ?
    `).bind(noteId, userId).first();

    if (!existingNote) {
      return c.json({
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found',
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }, 404);
    }

    const result = await c.env.DB.prepare(`
      DELETE FROM notes WHERE id = ? AND user_id = ?
    `).bind(noteId, userId).run();

    if (!result.success) {
      throw new Error('Failed to delete note');
    }

    return c.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Note deletion error:', error);
    return c.json({
      code: 'NOTE_DELETION_ERROR',
      message: 'Failed to delete note',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    }, 500);
  }
});