import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

export function registerShareRoutes(app: Hono) {
// POST /share/:sessionId — create a snapshot and signed share token
app.post('/share/:sessionId', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const sessionId = c.req.param('sessionId');

  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  // Verify ownership
  const session = await db
    .prepare('SELECT id, user_id, title, created_at, updated_at FROM chat_sessions WHERE id = ?')
    .bind(sessionId)
    .first();
  if (!session || (session as any).user_id !== userId) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Load messages
  const msgsRes = await db
    .prepare(
      `SELECT id, role, content, document_references, token_count, created_at, msg_index
       FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`
    )
    .bind(sessionId)
    .all();
  const messages = (msgsRes.results as any[]) || [];

  // Create snapshot JSON
  const snapshot = {
    session: {
      id: (session as any).id,
      title: (session as any).title,
      created_at: (session as any).created_at,
      updated_at: (session as any).updated_at,
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      document_references: m.document_references ? JSON.parse(m.document_references) : null,
      token_count: m.token_count,
      created_at: m.created_at,
      msg_index: m.msg_index ?? null,
    })),
    created_at: new Date().toISOString(),
  };

  const snapshotId = 'snap_' + crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO chat_snapshots (id, session_id, snapshot_json, created_at) VALUES (?, ?, ?, ?)`
    )
    .bind(snapshotId, sessionId, JSON.stringify(snapshot), new Date().toISOString())
    .run();

  // Sign a share token
  const secret = (c.env as any).JWT_SECRET;
  if (!secret) {
    return c.json({ error: 'JWT_SECRET is not configured; cannot create share token', snapshotId }, 400);
  }
  const token = jwt.sign({ sid: sessionId, snap: snapshotId }, secret, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });

  return c.json({ success: true, snapshotId, shareToken: token });
});
}

