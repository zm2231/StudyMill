import { streamText, streamObject as aiStreamObject } from 'ai';
import { z } from 'zod';
import { createProviderClient, defaultModelFor, ProviderName } from './providers';

function compatBaseURL(env: Bindings, useGateway: boolean) {
  if (!useGateway) return undefined;
  let base = (env as any).AI_GATEWAY_COMPAT_BASE_URL as string | undefined;
  if (!base) return undefined;
  // Ensure baseURL ends with /v1 for OpenAI-compat endpoints
  base = base.replace(/\/$/, '');
  if (!base.endsWith('/v1')) base = `${base}/v1`;
  return base;
}

async function loadPrefs(userId: string, db: D1Database) {
  return await db
    .prepare(
      "SELECT default_provider, use_gateway, provider_models FROM user_ai_preferences WHERE user_id=?1"
    )
    .bind(userId)
    .first();
}

export async function resolveUserAIConfig(userId: string, db: D1Database, env: Bindings) {
  const row: any = await loadPrefs(userId, db);
  const cfg = {
    provider: 'google' as ProviderName,
    useGateway: true,
    useDynamic: (env.AI_GATEWAY_DYNAMIC_ENABLE === '1'),
    dynamicRoute: env.AI_GATEWAY_DYNAMIC_ROUTE || 'gemini',
    models: {} as Record<string, string | undefined>,
    baseURLs: {} as Record<string, string | undefined>,
    fallbackWorkersAIModel: '@cf/meta/llama-3.1-70b-instruct-fp8-fast'
  } as any;

  cfg.models.google = defaultModelFor('google');
  cfg.models.openai = defaultModelFor('openai');
  cfg.models.openrouter = defaultModelFor('openrouter');

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
  }

  // Using compat for chat: single base URL
  cfg.baseURLs.openai = compatBaseURL(env, cfg.useGateway);
  cfg.baseURLs.google = compatBaseURL(env, cfg.useGateway);
  cfg.baseURLs.openrouter = compatBaseURL(env, cfg.useGateway);
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

  const core: any[] = [];
  if (system) core.push({ role: 'system', content: system });
  core.push(...(messages || []));

  // Prefer Gateway when configured; otherwise gracefully fall back to Workers AI
  try {
    const baseURL = cfg.baseURLs.openai; // compat base for all
    if (!baseURL) throw new Error('Missing Gateway compat baseURL');
    if (!env.AI_GATEWAY_TOKEN) throw new Error('Missing AI_GATEWAY_TOKEN for authenticated Gateway');

    const client = createProviderClient({ provider, baseURL, gatewayToken: env.AI_GATEWAY_TOKEN });

    const modelParam = (() => {
      if ((cfg as any).useDynamic) {
        const route = modelOverride || `dynamic/${(cfg as any).dynamicRoute}`;
        return route as string;
      }
      const bare = modelOverride || (provider === 'google' ? cfg.models.google : provider === 'openai' ? cfg.models.openai : cfg.models.openrouter);
      if (provider === 'openrouter' && !bare) throw new Error('openrouter requires explicit model');
      const providerSegment = provider === 'google' ? 'google-vertex-ai' : provider === 'openai' ? 'openai' : 'openrouter';
      return `${providerSegment}/${bare as string}`;
    })();

    const model = client.getModel(modelParam);
    const result = await streamText({ model, messages: core, signal, maxTries: 1 });
    return result as any;
  } catch (err: any) {
    try {
      console.error(JSON.stringify({
        event: 'gateway_request_failed',
        provider,
        modelParam,
        message: err?.message || String(err),
        stack: err?.stack || null,
      }));
    } catch {}
    throw err;
  }
}

export async function toSSEStream(
  result: any,
  hooks?: { onToken?: (t: string) => void | Promise<void>; onFinal?: (fullText: string) => void | Promise<void>; onError?: (err: any) => void | Promise<void>; signal?: AbortSignal }
): Promise<Response> {
  // Fire-and-forget token tap for persistence hooks while returning the AI SDK data stream
  (async () => {
    let full = '';
    try {
      if (result?.textStream) {
        for await (const t of result.textStream as AsyncIterable<string>) {
          if (hooks?.signal?.aborted) throw new Error('aborted');
          full += t;
          try { await hooks?.onToken?.(t); } catch {}
        }
      }
      try { await hooks?.onFinal?.(full); } catch {}
    } catch (err) {
      try { await hooks?.onError?.(err); } catch {}
    }
  })();

  // Prefer UI Message Stream response for AI SDK v5 UI hooks
  if (typeof (result as any)?.toUIMessageStreamResponse === 'function') {
    return (result as any).toUIMessageStreamResponse();
  }
  // Fallback to data stream or manual SSE if needed
  if (typeof (result as any)?.toDataStreamResponse === 'function') {
    return (result as any).toDataStreamResponse();
  }

  // Manual SSE passthrough with heartbeats
  const encoder = new TextEncoder();
  const source: ReadableStream = typeof (result as any)?.toReadableStream === 'function' ? (result as any).toReadableStream() : new ReadableStream();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = (source as ReadableStream<Uint8Array>).getReader();
      let heartbeat: number | undefined;
      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (heartbeat) clearInterval(heartbeat);
            controller.close();
            return;
          }
          if (!heartbeat) {
            heartbeat = setInterval(() => {
              try { controller.enqueue(encoder.encode(':\n\n')); } catch {}
            }, 15000) as unknown as number;
          }
          if (value) controller.enqueue(value);
          if (hooks?.signal?.aborted) {
            try { reader.cancel(); } catch {}
            if (heartbeat) clearInterval(heartbeat);
            try { hooks?.onError?.(new Error('aborted')); } catch {}
            controller.close();
            return;
          }
          pump();
        }).catch((err) => {
          if (heartbeat) clearInterval(heartbeat);
          try { hooks?.onError?.(err); } catch {}
          try { controller.error(err); } catch {}
        });
      };
      if (hooks?.signal) {
        hooks.signal.addEventListener('abort', () => {
          try { reader.cancel(); } catch {}
          if (heartbeat) clearInterval(heartbeat);
          try { hooks?.onError?.(new Error('aborted')); } catch {}
          try { controller.close(); } catch {}
        });
      }
      pump();
    }
  });
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
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

  const baseURL = cfg.baseURLs.openai; // compat base for all
  if (!baseURL) throw new Error('Missing Gateway compat baseURL');
  if (!env.AI_GATEWAY_TOKEN) throw new Error('Missing AI_GATEWAY_TOKEN for authenticated Gateway');
  const client = createProviderClient({ provider, baseURL, gatewayToken: env.AI_GATEWAY_TOKEN });

  const modelParam = (() => {
    if ((cfg as any).useDynamic) {
      const route = modelOverride || `dynamic/${(cfg as any).dynamicRoute}`;
      return route as string;
    }
    const bare = modelOverride || (provider === 'google' ? cfg.models.google : provider === 'openai' ? cfg.models.openai : cfg.models.openrouter);
    if (provider === 'openrouter' && !bare) throw new Error('openrouter requires explicit model');
    const providerSegment = provider === 'google' ? 'google-vertex-ai' : provider === 'openai' ? 'openai' : 'openrouter';
    return `${providerSegment}/${bare as string}`;
  })();

  const model = client.getModel(modelParam);
  const result = await aiStreamObject({ model, schema, prompt: prompt || '', system, signal });
  return result as any;
}
