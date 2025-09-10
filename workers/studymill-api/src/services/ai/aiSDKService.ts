import { streamText, streamObject as aiStreamObject } from 'ai';
import { z } from 'zod';
import { createProviderClient, defaultModelFor, ProviderName } from './providers';
import { deriveAesGcmKey, decryptString, parseEnvelopeV1 } from '../../utils/crypto';

function gatewayBaseURL(p: ProviderName, env: Bindings, useGateway: boolean) {
  if (!useGateway) return undefined;
  if (p === 'openai') return env.AI_GATEWAY_OPENAI_BASE_URL;
  if (p === 'google') return env.AI_GATEWAY_GOOGLE_BASE_URL;
  if (p === 'openrouter') return env.AI_GATEWAY_OPENROUTER_BASE_URL;
}

async function loadPrefs(userId: string, db: D1Database) {
  return await db.prepare(
    "SELECT default_provider, use_gateway, keys_json, salt_b64u, key_id, envelope_ver, kdf_alg, enc_alg, provider_models FROM user_ai_preferences WHERE user_id=?1"
  ).bind(userId).first();
}

async function decryptIfAny(envelope?: string, master_b64u?: string) {
  if (!envelope || !master_b64u) return undefined;
  const e = parseEnvelopeV1(envelope);
  const k = await deriveAesGcmKey(master_b64u, e.salt_b64u);
  return decryptString({ iv_b64u: e.iv_b64u, ct_b64u: e.ct_b64u }, k);
}

export async function resolveUserAIConfig(userId: string, db: D1Database, env: Bindings) {
  const row: any = await loadPrefs(userId, db);
  const cfg = {
    provider: 'google' as ProviderName,
    useGateway: true,
    apiKeys: {} as Record<string, string>,
    models: {} as Record<string, string | undefined>,
    baseURLs: {} as Record<string, string | undefined>,
    fallbackWorkersAIModel: '@cf/meta/llama-3.1-70b-instruct-fp8-fast'
  };

  cfg.models.google = defaultModelFor('google');
  cfg.models.openai = defaultModelFor('openai');
  cfg.models.openrouter = defaultModelFor('openrouter');

  // service-level fallbacks
  const googleKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (googleKey) cfg.apiKeys.google = googleKey;
  if (env.OPENAI_API_KEY) cfg.apiKeys.openai = env.OPENAI_API_KEY;
  if (env.OPENROUTER_API_KEY) cfg.apiKeys.openrouter = env.OPENROUTER_API_KEY;

  if (row) {
    cfg.provider = (row.default_provider || 'google') as ProviderName;
    cfg.useGateway = !!row.use_gateway;

    if (row.provider_models) {
      try {
        const pm = JSON.parse(row.provider_models);
        if (pm.google) cfg.models.google = pm.google;
        if (pm.openai) cfg.models.openai = pm.openai;
        if (pm.openrouter) cfg.models.openrouter = pm.openrouter;
      } catch {}
    }

    const master = env.AI_PREFS_MASTER_KEY;
    const map = row.keys_json ? (() => { try { return JSON.parse(row.keys_json); } catch { return {}; } })() : {};
    const g = await decryptIfAny(map.google, master);
    const o = await decryptIfAny(map.openai, master);
    const r = await decryptIfAny(map.openrouter, master);
    if (g) cfg.apiKeys.google = g;
    if (o) cfg.apiKeys.openai = o;
    if (r) cfg.apiKeys.openrouter = r;
  }

  cfg.baseURLs.openai = gatewayBaseURL('openai', env, cfg.useGateway);
  cfg.baseURLs.google = gatewayBaseURL('google', env, cfg.useGateway);
  cfg.baseURLs.openrouter = gatewayBaseURL('openrouter', env, cfg.useGateway);
  return cfg;
}

export async function streamChat(params: {
  userId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>,
  system?: string,
  modelOverride?: string,
  providerOverride?: ProviderName,
  signal?: AbortSignal
}, ctx: { env: Bindings, db: D1Database }) {
  const { userId, messages, system, modelOverride, providerOverride, signal } = params;
  const { env, db } = ctx;

  const cfg = await resolveUserAIConfig(userId, db, env);
  const provider = providerOverride || cfg.provider;

  const baseURL = provider === 'google' ? cfg.baseURLs.google : provider === 'openai' ? cfg.baseURLs.openai : cfg.baseURLs.openrouter;
  if (!baseURL) throw new Error('Missing Gateway baseURL for provider ' + provider);
  if (!env.AI_GATEWAY_TOKEN) throw new Error('Missing AI_GATEWAY_TOKEN for authenticated Gateway');
  const client = createProviderClient({ provider, baseURL, gatewayToken: env.AI_GATEWAY_TOKEN });

  const modelName = modelOverride || (provider === 'google' ? cfg.models.google : provider === 'openai' ? cfg.models.openai : cfg.models.openrouter);
  if (provider === 'openrouter' && !modelName) throw new Error('openrouter requires explicit model');

  const model = client.getModel(modelName as string);

  const core: any[] = [];
  if (system) core.push({ role: 'system', content: system });
  core.push(...(messages || []));

  const result = await streamText({ model, messages: core, signal });
  return { textStream: result.textStream, toReadableStream: result.toReadableStream };
}

export async function streamObject(params: {
  userId: string,
  system?: string,
  modelOverride?: string,
  providerOverride?: ProviderName,
  signal?: AbortSignal,
  prompt: string
}, schema: z.ZodTypeAny, ctx: { env: Bindings, db: D1Database }) {
  const { userId, system, modelOverride, providerOverride, signal, prompt } = params;
  const { env, db } = ctx;

  const cfg = await resolveUserAIConfig(userId, db, env);
  const provider = providerOverride || cfg.provider;

  const baseURL = provider === 'google' ? cfg.baseURLs.google : provider === 'openai' ? cfg.baseURLs.openai : cfg.baseURLs.openrouter;
  if (!baseURL) throw new Error('Missing Gateway baseURL for provider ' + provider);
  if (!env.AI_GATEWAY_TOKEN) throw new Error('Missing AI_GATEWAY_TOKEN for authenticated Gateway');
  const client = createProviderClient({ provider, baseURL, gatewayToken: env.AI_GATEWAY_TOKEN });

  const modelName = modelOverride || (provider === 'google' ? cfg.models.google : provider === 'openai' ? cfg.models.openai : cfg.models.openrouter);
  if (provider === 'openrouter' && !modelName) throw new Error('openrouter requires explicit model');

  const model = client.getModel(modelName as string);
  const result = await aiStreamObject({ model, schema, prompt: prompt || '', system, signal });
  return { objectStream: result.objectStream, toReadableStream: result.toReadableStream };
}

