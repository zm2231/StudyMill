import { Hono } from 'hono';

export function registerBranchRoutes(app: Hono) {
// POST /chat/branch — create a new session branched from an existing one up to a message index
app.post('/chat/branch', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  type Body = { sessionId: string; branch_from_msg_index: number };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.sessionId || typeof body.branch_from_msg_index !== 'number') {
    return c.json({ error: 'sessionId and branch_from_msg_index are required' }, 400);
  }

  // Verify ownership of source session
  const src = await db
    .prepare('SELECT id, user_id FROM chat_sessions WHERE id = ?')
    .bind(body.sessionId)
    .first();
  if (!src || (src as any).user_id !== userId) {
    return c.json({ error: 'Source session not found' }, 404);
  }

  const now = new Date().toISOString();
  const newSessionId = 'session_' + crypto.randomUUID();

  // Create new session row with parent link
  await db
    .prepare(
      `INSERT INTO chat_sessions (id, user_id, course_id, assignment_id, title, created_at, updated_at, parent_session_id, branch_from_msg_index)
       SELECT ?, user_id, course_id, assignment_id, title || ' (branch)', ?, ?, ?, ?
       FROM chat_sessions WHERE id = ?`
    )
    .bind(
      newSessionId,
      now,
      now,
      body.sessionId,
      body.branch_from_msg_index,
      body.sessionId
    )
    .run();

  // Copy messages up to msg_index (inclusive)
  const rows = await db
    .prepare(
      `SELECT id, role, content, document_references, token_count, created_at, generation_id, msg_index
       FROM chat_messages
       WHERE session_id = ? AND (msg_index IS NULL OR msg_index <= ?)
       ORDER BY created_at ASC`
    )
    .bind(body.sessionId, body.branch_from_msg_index)
    .all();

  const msgs = (rows.results as any[]) || [];
  for (const m of msgs) {
    const newMsgId = 'msg_' + crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, document_references, token_count, created_at, generation_id, msg_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
      )
      .bind(
        newMsgId,
        newSessionId,
        m.role,
        m.content,
        m.document_references || null,
        m.token_count || (m.content ? String(m.content).length : 0),
        m.created_at,
        m.msg_index ?? null
      )
      .run();
  }

  return c.json({ success: true, sessionId: newSessionId });
});
}

