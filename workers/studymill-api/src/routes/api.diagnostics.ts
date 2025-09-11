import { Hono } from 'hono'

export const diagnosticsRoutes = new Hono<{ Bindings: Bindings }>()

function assertAdmin(c: any) {
  const enabled = c.env.DIAGNOSTICS_ENABLE === '1' || c.env.ENVIRONMENT !== 'production'
  if (!enabled) return c.json({ error: 'disabled' }, 404)
  // Option A: use your existing auth to check admin
  // Option B: simple shared token
  const tok = c.req.header('X-Diagnostics-Token') || ''
  if (!tok || tok !== (c.env.DIAGNOSTICS_TOKEN || '')) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  return null
}

async function tableInfo(db: D1Database, name: string) {
  const cols = await db.prepare(`PRAGMA table_info(${name})`).all()
  const idxs = await db.prepare(`PRAGMA index_list(${name})`).all()
  return { columns: cols.results || [], indexes: idxs.results || [] }
}

diagnosticsRoutes.get('/db', async (c) => {
  const unauth = assertAdmin(c)
  if (unauth) return unauth

  const db = c.env.DB
  const tablesWanted = [
    'user_ai_preferences',
    'chat_sessions',
    'chat_messages',
    'chat_snapshots'
  ]

  // Check tables exist
  const rows = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table'`
  ).all()
  const existing = new Set((rows.results || []).map((r: any) => r.name as string))

  const report: any = {
    ok: true,
    env: c.env.ENVIRONMENT || 'unknown',
    tables: {},
    missingTables: [] as string[]
  }

  for (const t of tablesWanted) {
    if (!existing.has(t)) {
      report.ok = false
      report.missingTables.push(t)
      continue
    }
    const info = await tableInfo(db, t)
    report.tables[t] = {
      columns: info.columns.map((c: any) => c.name),
      indexes: info.indexes.map((i: any) => i.name)
    }
  }

  // Column/index expectations (Phase 1)
  function expect(table: string, col: string) {
    const cols = report.tables[table]?.columns || []
    const present = cols.includes(col)
    if (!present) {
      report.ok = false
      report.tables[table] = report.tables[table] || {}
      report.tables[table].missingColumns = (report.tables[table].missingColumns || []).concat(col)
    }
  }
  function expectIdx(table: string, idx: string) {
    const idxs = report.tables[table]?.indexes || []
    const present = idxs.includes(idx)
    if (!present) {
      report.ok = false
      report.tables[table] = report.tables[table] || {}
      report.tables[table].missingIndexes = (report.tables[table].missingIndexes || []).concat(idx)
    }
  }

  // Expectations from Phase 1 migration
  expect('chat_sessions', 'provider')
  expect('chat_sessions', 'model_id')
  expect('chat_sessions', 'generation_id')
  expect('chat_sessions', 'parent_session_id')
  expect('chat_sessions', 'branch_from_msg_index')
  expectIdx('chat_sessions', 'ix_sessions_user_created')

  expect('chat_messages', 'generation_id')
  expect('chat_messages', 'msg_index')
  expectIdx('chat_messages', 'ix_msgs_index')
  expectIdx('chat_messages', 'ix_msgs_created')

  // user_ai_preferences minimal check
  expect('user_ai_preferences', 'default_provider')
  expect('user_ai_preferences', 'salt_b64')
  expect('user_ai_preferences', 'provider_models')

  // snapshots
  expect('chat_snapshots', 'snapshot_json')
  expectIdx('chat_snapshots', 'ix_snapshots_session')

  return new Response(JSON.stringify(report), {
    status: report.ok ? 200 : 500,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
})

