import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { gatewayOpenAICompatFetch } from '../src/services/ai/providers';

function makeEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as any,
    AI_PREFS_MASTER_KEY: 'master-key',
    AIG_DEFAULT_MODEL: 'dynamic/google',
    AIG_FALLBACK_MODEL: 'workers-ai/@cf/meta/llama-3.2-11b-vision-instruct',
    AIGATEWAY_USE_BINDING: 'false',
    AIG_BASE_URL: 'https://example.com/compat',
    ...overrides,
  } as Bindings;
}

describe('gatewayOpenAICompatFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sets cf-aig-authorization header when token present and binding disabled', async () => {
    const env = makeEnv({ CF_AIG_TOKEN: 'test-token' });

    await gatewayOpenAICompatFetch(env, 'chat/completions', { message: 'ping' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.get('cf-aig-authorization')).toBe('Bearer test-token');
    expect(headers.has('authorization')).toBe(false);
  });

  it('omits cf-aig-authorization when binding is enabled', async () => {
    const env = makeEnv({ AIGATEWAY_USE_BINDING: 'true', CF_AIG_TOKEN: 'test-token' });

    await gatewayOpenAICompatFetch(env, 'chat/completions', { message: 'ping' });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.get('cf-aig-authorization')).toBeNull();
  });

  it('strips pre-existing Authorization headers before forwarding', async () => {
    const env = makeEnv({ CF_AIG_TOKEN: 'token' });

    await gatewayOpenAICompatFetch(
      env,
      'chat/completions',
      { message: 'ping' },
      { headers: { Authorization: 'Bearer should-not-pass' } }
    );

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('authorization')).toBe(false);
  });

  it('serializes the JSON body when init.body is not provided', async () => {
    const env = makeEnv({ CF_AIG_TOKEN: 'token' });

    await gatewayOpenAICompatFetch(env, 'chat/completions', { message: 'ping' });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.get('content-type')).toBe('application/json');
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'ping' });
  });
});
