import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/ai/providers', () => ({
  createOpenAICompatClient: vi.fn(),
}));

import { streamChat } from '../src/services/ai/aiSDKService';
import { createOpenAICompatClient } from '../src/services/ai/providers';

const mockCreateClient = createOpenAICompatClient as unknown as vi.Mock;

function makeEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    AIG_BASE_URL: 'https://example.com',
    AIG_DEFAULT_MODEL: 'dynamic/google',
    AIG_FALLBACK_MODEL: 'workers-ai/@cf/meta/llama-3.2-11b-vision-instruct',
    AIGATEWAY_USE_BINDING: 'false',
    AI_PREFS_MASTER_KEY: 'key',
    AI_GATEWAY_TOKEN: 'token',
    DB: {} as any,
    BUCKET: {} as any,
    KV: {} as any,
    VECTORIZE: {} as any,
    CHAT_DO: {} as any,
    JWT_SECRET: 'secret',
    ENVIRONMENT: 'test',
    API_VERSION: 'v0',
    FRONTEND_URL: 'http://localhost',
    GOOGLE_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
    OPENAI_API_KEY: undefined,
    OPENROUTER_API_KEY: undefined,
    DIAGNOSTICS_ENABLE: '0',
    DIAGNOSTICS_TOKEN: undefined,
    ...overrides,
  } as Bindings;
}

beforeEach(() => {
  mockCreateClient.mockReset();
});

describe('streamChat', () => {
  it('yields streamed tokens from primary model', async () => {
    const chunks = ['Hello', ' ', 'world'];
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        for (const text of chunks) {
          yield { choices: [{ delta: { content: text } }] };
        }
      },
      response: Promise.resolve({ choices: [{ message: { content: 'Hello world' } }] }),
      controller: { abort: vi.fn() },
    };

    mockCreateClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn(async () => stream),
        },
      },
    });

    const result = await streamChat(
      {
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Say hi' }],
      },
      { env: makeEnv(), db: {} as any }
    );

    const tokens: string[] = [];
    for await (const token of result.textStream) tokens.push(token);

    expect(tokens.join('')).toBe('Hello world');
    expect(result.getModel()).toBe('dynamic/google');
    expect(result.didFallback()).toBe(false);
  });

  it('falls back to secondary model on retriable error', async () => {
    const fallbackChunks = ['Hi', ' ', 'there'];
    const fallbackStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const text of fallbackChunks) {
          yield { choices: [{ delta: { content: text } }] };
        }
      },
      response: Promise.resolve({ choices: [{ message: { content: 'Hi there' } }] }),
      controller: { abort: vi.fn() },
    };

    const createFn = vi
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce(fallbackStream);

    mockCreateClient.mockReturnValue({
      chat: {
        completions: {
          create: createFn,
        },
      },
    });

    const env = makeEnv();
    const result = await streamChat(
      {
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Say hi' }],
      },
      { env, db: {} as any }
    );

    const tokens: string[] = [];
    for await (const token of result.textStream) tokens.push(token);

    expect(tokens.join('')).toBe('Hi there');
    expect(result.getModel()).toBe(env.AIG_FALLBACK_MODEL);
    expect(result.didFallback()).toBe(true);
    expect(createFn).toHaveBeenCalledTimes(2);
  });
});
