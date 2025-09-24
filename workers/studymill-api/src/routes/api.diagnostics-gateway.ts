import { Hono } from 'hono'
import { gatewayOpenAICompatFetch } from '../services/ai/providers'

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
    const t0 = Date.now()
    const response = await gatewayOpenAICompatFetch(env, 'chat/completions', {
      model: env.AIG_DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    })
    const latency = Date.now() - t0
    const ok = response.ok
    let logId: string | undefined

    if (ok) {
      const data = await response.json<{
        choices?: Array<{ message?: { content?: string } }>
      }>()
      const content = data?.choices?.[0]?.message?.content
      logId = response.headers.get('cf-aig-log-id') || undefined
      return c.json({
        ok: !!content,
        model: env.AIG_DEFAULT_MODEL,
        latency_ms: latency,
        logId
      }, 200)
    }

    const text = await response.text().catch(() => '')

    return c.json({
      ok: false,
      model: env.AIG_DEFAULT_MODEL,
      latency_ms: latency,
      logId: response.headers.get('cf-aig-log-id') || undefined,
      error: text.slice(0, 200)
    }, 502)
  } catch (error: any) {
    console.error('Gateway diagnostics error:', error)
    return c.json({
      ok: false,
      error: error?.message || 'Gateway probe failed'
    }, 500)
  }
})
