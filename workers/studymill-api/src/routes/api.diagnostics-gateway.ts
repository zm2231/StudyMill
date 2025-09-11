import { Hono } from 'hono'
import { streamText } from 'ai'
import { createProviderClient } from '../services/ai/providers'
import { resolveUserAIConfig } from '../services/ai/aiSDKService'

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
    // Use a synthetic userId to exercise "managed defaults"
    const userId = 'diagnostics'
    const db = c.env.DB
    const env = c.env
    const cfg = await resolveUserAIConfig(userId, db, env)

    const provider = cfg.provider || 'google'
    const modelName =
      provider === 'google' ? cfg.models.google :
      provider === 'openai' ? cfg.models.openai :
      cfg.models.openrouter

    const baseURL = 
      provider === 'google' ? cfg.baseURLs.google :
      provider === 'openai' ? cfg.baseURLs.openai :
      cfg.baseURLs.openrouter

    if (!baseURL) {
      return c.json({ error: `Missing Gateway baseURL for provider ${provider}` }, 500)
    }

    if (!env.AI_GATEWAY_TOKEN) {
      return c.json({ error: 'Missing AI_GATEWAY_TOKEN' }, 500)
    }

    let resolvedProvider = provider
    let resolvedModel = modelName as string | undefined
    let resolvedBaseURL = baseURL

    let client: any
    try {
      client = createProviderClient({ provider: resolvedProvider as any, baseURL: resolvedBaseURL as string, gatewayToken: env.AI_GATEWAY_TOKEN })
    } catch (e) {
      // Fallback to openai-compatible route for probe purposes
      resolvedProvider = 'openai'
      resolvedModel = cfg.models.openai as string
      resolvedBaseURL = cfg.baseURLs.openai as string
      client = createProviderClient({ provider: 'openai', baseURL: resolvedBaseURL, gatewayToken: env.AI_GATEWAY_TOKEN })
    }

    const model = client.getModel(resolvedModel as string)

    const t0 = Date.now()
    const result = await streamText({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 1
    })

    // Try to drain a single token using textStream (AI SDK v5 compatible)
    try {
      const anyRes: any = result as any
      if (anyRes?.textStream && typeof anyRes.textStream[Symbol.asyncIterator] === 'function') {
        const it = anyRes.textStream[Symbol.asyncIterator]()
        await it.next().catch(() => {})
      }
    } catch {}

    const latency = Date.now() - t0

    return c.json({ 
      ok: true, 
      provider, 
      model: modelName, 
      latency_ms: latency,
      gateway_url: baseURL
    }, 200)
  } catch (error: any) {
    console.error('Gateway diagnostics error:', error)
    return c.json({ 
      ok: false, 
      error: error.message || 'Gateway probe failed'
    }, 500)
  }
})
