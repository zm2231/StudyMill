import { Hono } from 'hono';
import { resolveUserAIConfig, streamChat, toSSEStream } from '../services/ai/aiSDKService';
import type { ProviderName } from '../services/ai/providers';
import { getContextForDocuments } from '../services/contextSynthesis';

export function registerChatRoutes(app: Hono) {
// POST /chat — streams tokens via AI SDK (AI Gateway)
app.post('/chat', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  type ChatMessage = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string };
  type Body = {
    sessionId?: string;
    messages: ChatMessage[];
    attachments?: string[]; // document IDs
    modelOverride?: string;
    providerOverride?: ProviderName;
    resume?: boolean;
    client_request_id?: string;
  };

  // Accept both AI SDK payload shape and our canonical schema
  let body: Body;
  try {
    const raw: any = await c.req.json<any>();

    const extractText = (m: any): string => {
      if (typeof m?.content === 'string') return m.content;
      if (Array.isArray(m?.parts)) {
        try {
          return m.parts
            .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
            .map((p: any) => p.text)
            .join('');
        } catch {}
      }
      return '';
    };

    const rawMessages = Array.isArray(raw?.messages)
      ? raw.messages
      : (Array.isArray(raw?.body?.messages) ? raw.body.messages : []);

    const normalized: ChatMessage[] = rawMessages.map((m: any) => ({
      role: (m?.role as any) || 'user',
      content: extractText(m)
    }));

    body = {
      sessionId: raw?.sessionId || raw?.body?.sessionId,
      messages: normalized,
      attachments: raw?.attachments || raw?.body?.attachments || [],
      modelOverride: raw?.modelOverride || raw?.body?.modelOverride,
      providerOverride: raw?.providerOverride || raw?.body?.providerOverride,
      resume: raw?.resume || raw?.body?.resume,
      client_request_id: raw?.messageId || raw?.client_request_id || raw?.body?.client_request_id,
    };
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: 'messages array is required' }, 400);
  }

  // 1) Ensure session
  const now = new Date().toISOString();
  let sessionId = body.sessionId || '';
  if (sessionId) {
    const row = await db
      .prepare('SELECT id, user_id FROM chat_sessions WHERE id = ?')
      .bind(sessionId)
      .first();
    if (!row || (row as any).user_id !== userId) {
      return c.json({ error: 'Session not found' }, 404);
    }
  } else {
    sessionId = 'session_' + crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO chat_sessions (id, user_id, course_id, assignment_id, title, created_at, updated_at)
         VALUES (?, ?, NULL, NULL, ?, ?, ?)`
      )
      .bind(sessionId, userId, 'New Chat', now, now)
      .run();
  }

  // 2) Persist user message (with next msg_index)
  const idxRow = await db
    .prepare('SELECT COALESCE(MAX(msg_index), -1) + 1 AS next_idx FROM chat_messages WHERE session_id = ?')
    .bind(sessionId)
    .first();
  const nextIdx = (idxRow as any)?.next_idx ?? 0;

  // Optional idempotency: skip if a user message with the same client_request_id already exists
  let userMessageId = 'msg_' + crypto.randomUUID();
  const userMsg = body.messages[body.messages.length - 1];

  if (body.client_request_id) {
    const dup = await db
      .prepare(
        `SELECT id FROM chat_messages 
         WHERE session_id = ? AND role = 'user' 
           AND JSON_EXTRACT(COALESCE(document_references,'{}'), '$.client_request_id') = ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(sessionId, body.client_request_id)
      .first();
    if (dup && (dup as any).id) {
      userMessageId = (dup as any).id as string;
    } else {
      await db
        .prepare(
          `INSERT INTO chat_messages (id, session_id, role, content, document_references, token_count, created_at, generation_id, msg_index)
           VALUES (?, ?, 'user', ?, ?, ?, ?, NULL, ?)`
        )
        .bind(
          userMessageId,
          sessionId,
          userMsg.content,
          JSON.stringify({ attachments: body.attachments || [], client_request_id: body.client_request_id }),
          userMsg.content.length,
          now,
          nextIdx,
        )
        .run();
    }
  } else {
    await db
      .prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, document_references, token_count, created_at, generation_id, msg_index)
         VALUES (?, ?, 'user', ?, ?, ?, ?, NULL, ?)`
      )
      .bind(
        userMessageId,
        sessionId,
        userMsg.content,
        body.attachments ? JSON.stringify({ attachments: body.attachments }) : null,
        userMsg.content.length,
        now,
        nextIdx,
      )
      .run();
  }

  // 3) Context synthesis from attachments (cap to Phase-1 budget)
  let { contextStr, sources } = await getContextForDocuments({
    userId,
    attachments: body.attachments || [],
    db,
  });
  // Cap sources and context for Phase 1
  if (sources && sources.length > 5) sources = sources.slice(0, 5);
  const CONTEXT_CHAR_BUDGET = 6000;
  if (contextStr.length > CONTEXT_CHAR_BUDGET) contextStr = contextStr.slice(0, CONTEXT_CHAR_BUDGET);
  // Compute context_hash for observability and future cache keys
  async function sha256Hex(str: string) {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const context_hash = await sha256Hex(contextStr);

  const system = [
    'You are StudyMill AI, the academic assistant inside the StudyMill app.',
    'Use provided context when available. Cite document titles inline like [Document Title] when used.',
    'Be concise, helpful, and accurate. If context is missing, acknowledge it and provide general guidance.',
  ].join('\n');

  const coreMessages: ChatMessage[] = [];
  coreMessages.push({ role: 'system', content: `${system}\n\nContext:\n${contextStr}` });
  // include previous messages provided by client (optional)
  for (const m of body.messages) coreMessages.push(m);

  // 4) Resolve provider/model for metadata + start streaming
  const cfg = await resolveUserAIConfig(userId, db, c.env as any);
  const provider: ProviderName = body.providerOverride || cfg.provider;
  const model: string | undefined = body.modelOverride || (provider === 'openrouter' ? undefined : (cfg.models as any)[provider]);
  if (provider === 'openrouter' && !model) {
    return c.json({ error: 'provider=openrouter requires modelOverride', hint: 'Specify modelOverride with a valid OpenRouter model id' }, 400);
  }

  try {
    console.log(JSON.stringify({
      event: 'chat_stream_start',
      userId,
      sessionId,
      provider,
      model,
      route: (c.env as any).AI_GATEWAY_DYNAMIC_ROUTE,
      useDynamic: (c.env as any).AI_GATEWAY_DYNAMIC_ENABLE === '1'
    }));
  } catch {}

  const generationId = crypto.randomUUID();

  // Create assistant placeholder row to stream into
  const assistantMessageId = 'msg_' + crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, document_references, token_count, created_at, generation_id, msg_index)
       VALUES (?, ?, 'assistant', '', NULL, 0, ?, ?, ?)`
    )
    .bind(assistantMessageId, sessionId, now, generationId, nextIdx + 1)
    .run();

  // Update session with inflight generation
  await db
    .prepare(
      `UPDATE chat_sessions SET provider = ?, model_id = ?, generation_id = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    )
    .bind(provider, model || null, generationId, now, sessionId, userId)
    .run();

  // Kick off streaming
  const result = await streamChat(
    {
      userId,
      messages: coreMessages,
      modelOverride: model,
      providerOverride: provider,
      signal: (c.req as any).raw?.signal,
    },
    { env: c.env as any, db }
  );

  // Buffered persistence for token deltas to avoid D1 hot loop
  let buffer = '';
  let flushTimer: number | undefined;
  const FLUSH_INTERVAL_MS = 150;
  async function flush() {
    if (!buffer) return;
    const toWrite = buffer;
    buffer = '';
    try {
      await db
        .prepare(`UPDATE chat_messages SET content = COALESCE(content, '') || ?, token_count = COALESCE(token_count, 0) + LENGTH(?) WHERE id = ?`)
        .bind(toWrite, toWrite, assistantMessageId)
        .run();
    } catch (e) {
      console.warn('delta flush failed:', e);
    }
  }

  const startedAt = Date.now();

  // 5) Convert to SSE + persistence hooks
  const sse = await toSSEStream(result, {
    signal: (c.req as any).raw?.signal,
    onToken: async (t) => {
      buffer += t;
      if (!flushTimer) {
        flushTimer = setTimeout(async () => {
          flushTimer = undefined as unknown as number;
          await flush();
        }, FLUSH_INTERVAL_MS) as unknown as number;
      }
      // Backpressure: if buffer gets large, flush immediately
      if (buffer.length > 1024) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = undefined as unknown as number;
        }
        await flush();
      }
    },
    onFinal: async (full) => {
      try {
        // Final flush of any pending buffer
        await flush();
        const finalMeta = { sources: sources || [], context_hash };
        await db
          .prepare(`UPDATE chat_messages SET content = ?, document_references = ?, token_count = LENGTH(?), generation_id = NULL WHERE id = ?`)
          .bind(
            full,
            JSON.stringify(finalMeta),
            full,
            assistantMessageId
          )
          .run();
        await db
          .prepare(`UPDATE chat_sessions SET generation_id = NULL, updated_at = ? WHERE id = ? AND user_id = ?`)
          .bind(new Date().toISOString(), sessionId, userId)
          .run();
        // Structured completion log
        try {
          console.log(JSON.stringify({
            event: 'chat_turn_complete',
            userId,
            sessionId,
            provider,
            model,
            tokens_out: full.length,
            latency_ms: Date.now() - startedAt,
            context_hash,
            context_len: (contextStr || '').length,
            sources_count: (sources || []).length
          }));
        } catch {}
      } catch (e) {
        console.warn('onFinal persist failed:', e);
      }
    },
    onError: async (err) => {
      try {
        // Clear inflight marker and flush pending deltas best-effort
        if (flushTimer) clearTimeout(flushTimer);
        await flush();
        await db
          .prepare(`UPDATE chat_sessions SET generation_id = NULL, updated_at = ? WHERE id = ? AND user_id = ?`)
          .bind(new Date().toISOString(), sessionId, userId)
          .run();
      } catch {}
      try {
        console.error(JSON.stringify({
          event: 'chat_stream_error',
          requestId: c.get('requestId'),
          userId,
          sessionId,
          provider,
          model,
          error: (err && (err as any).message) || String(err)
        }));
      } catch {}
    },
  });

  // CORS headers for SSE (allow Pages origin, vary by Origin)
  try {
    const origin = c.req.header('Origin');
    const allowed = c.env.FRONTEND_URL || origin || '*';
    sse.headers.set('Access-Control-Allow-Origin', allowed);
    const existingVary = sse.headers.get('Vary');
    sse.headers.set('Vary', existingVary ? `${existingVary}, Origin` : 'Origin');
  } catch {}

  // Return SSE response
  return sse;
});
}

