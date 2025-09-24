import { Hono } from 'hono'
import { createOpenAICompatClient } from '../services/ai/providers'

export const diagnosticsGatewayRoutes = new Hono<{ Bindings: Bindings }>()

function assertDiagAuth(c: any) {
  const enabled = c.env.DIAGNOSTICS_ENABLE === '1' || c.env.ENVIRONMENT !== 'production'
  if (!enabled) return c.json({ error: 'disabled' }, 404)
  const tok = c.req.header('X-Diagnostics-Token') || ''
  if (!tok || tok !== (c.env.DIAGNOSTICS_TOKEN || '')) return c.json({ error: 'unauthorized' }, 401)
  return null
}

diagnosticsGatewayRoutes.get('/gateway', async (c) => {
  const unauth = assertDiagAuth(c); if (unauth) return unauth

  try {
    const env = c.env
    const client = createOpenAICompatClient(env)
    const t0 = Date.now()
    const response = await client.chat.completions.create({
      model: env.AIG_DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    })
    const latency = Date.now() - t0
    const ok = !!response?.choices?.[0]?.message?.content
    const logId = (response as any)?.headers?.get?.('cf-aig-log-id') || undefined

    return c.json({
      ok,
      model: env.AIG_DEFAULT_MODEL,
      latency_ms: latency,
      logId
    }, ok ? 200 : 502)
  } catch (error: any) {
    console.error('Gateway diagnostics error:', error)
    return c.json({
      ok: false,
      error: error?.message || 'Gateway probe failed'
    }, 500)
  }
})
