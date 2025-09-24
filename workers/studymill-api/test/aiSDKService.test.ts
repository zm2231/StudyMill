import { ReadableStream } from 'node:stream/web';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/ai/providers', () => ({
  gatewayOpenAICompatFetch: vi.fn(),
}));

import { streamChat } from '../src/services/ai/aiSDKService';
import { gatewayOpenAICompatFetch } from '../src/services/ai/providers';

const mockGatewayFetch = gatewayOpenAICompatFetch as unknown as vi.Mock;

const encoder = new TextEncoder();

function makeEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as any,
    AI_PREFS_MASTER_KEY: 'key',
    AIG_DEFAULT_MODEL: 'dynamic/google',
    AIG_FALLBACK_MODEL: 'workers-ai/@cf/meta/llama-3.2-11b-vision-instruct',
    AIGATEWAY_USE_BINDING: 'false',
    ENVIRONMENT: 'test',
    ...overrides,
  } as Bindings;
}

function makeSSE(chunks: string[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      }
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

beforeEach(() => {
  mockGatewayFetch.mockReset();
});

describe('streamChat (managed gateway)', () => {
  it('yields streamed tokens from primary model', async () => {
    const chunkPayloads = ['{"choices":[{"delta":{"content":"Hello"}}]}', '{"choices":[{"delta":{"content":" "}}]}', '{"choices":[{"delta":{"content":"world"}}]}'];

    mockGatewayFetch.mockResolvedValueOnce(makeSSE(chunkPayloads));

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
    const fallbackChunks = ['{"choices":[{"delta":{"content":"Hi"}}]}', '{"choices":[{"delta":{"content":" "}}]}', '{"choices":[{"delta":{"content":"there"}}]}'];

    mockGatewayFetch
      .mockRejectedValueOnce(new Error('upstream error'))
      .mockResolvedValueOnce(makeSSE(fallbackChunks));

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
    expect(mockGatewayFetch).toHaveBeenCalledTimes(2);
  });
});
