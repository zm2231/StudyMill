import { describe, it, expect, vi } from 'vitest';
import nodeCrypto from 'node:crypto';

// Polyfills for Node/vitest environment
if (!(globalThis as any).crypto) (globalThis as any).crypto = nodeCrypto.webcrypto as any;
if (!(globalThis as any).btoa) (globalThis as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
if (!(globalThis as any).atob) (globalThis as any).atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');

// Mock ai streaming (no network)
vi.mock('ai', () => ({
  streamText: vi.fn(async () => {
    async function* gen(){ yield 'Hello'; yield ' '; yield 'world'; }
    return { textStream: gen(), toReadableStream: () => new (globalThis as any).ReadableStream?.() };
  }),
  streamObject: vi.fn(async () => {
    async function* gen(){ yield { type: 'delta', value: { ok: true } }; }
    return { objectStream: gen(), toReadableStream: () => new (globalThis as any).ReadableStream?.() };
  })
}));

// Mock providers to avoid export-shape issues
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (opts: any) => (modelName: string) => ({ id: modelName, __opts: opts })
}));
vi.mock('@ai-sdk/google', () => ({
  createGoogle: (opts: any) => (modelName: string) => ({ id: modelName, __opts: opts }),
  google: (opts: any) => (modelName: string) => ({ id: modelName, __opts: opts }),
  createGoogleGenerativeAI: (opts: any) => (modelName: string) => ({ id: modelName, __opts: opts }),
}));

import { resolveUserAIConfig, streamChat } from '../src/services/ai/aiSDKService';

function makeMockDB(){
  return { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as any;
}

const env = {
  AI_PREFS_MASTER_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AI_GATEWAY_TOKEN: 'GW_TOKEN',
  AI_GATEWAY_OPENAI_BASE_URL: 'https://gateway.example/openai',
  AI_GATEWAY_GOOGLE_BASE_URL: 'https://gateway.example/google',
  AI_GATEWAY_OPENROUTER_BASE_URL: 'https://gateway.example/openrouter'
} as any;

describe('aiSDKService (Phase 0)', () => {
  it('resolves defaults with gateway baseURLs', async () => {
    const cfg = await resolveUserAIConfig('user-1', makeMockDB(), env);
    expect(cfg.baseURLs.google).toContain('gateway.example');
    expect(cfg.provider).toBe('google');
  });

  it('streams chat tokens (mock)', async () => {
    const res = await streamChat({ userId:'user-1', messages:[{ role:'user', content:'say hi'}] }, { env, db: makeMockDB() });
    const chunks: string[] = [];
    for await (const t of res.textStream) chunks.push(t as any);
    expect(chunks.join('')).toBe('Hello world');
  });
});

