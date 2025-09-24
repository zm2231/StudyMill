import OpenAI from 'openai';
import type { Bindings } from '../../types/bindings';
import { makeGatewayFetch } from './gatewayFetch';

export type ProviderClientOpts = {
  userProviderKey?: string | null;
};

function resolveGatewayBaseURL(env: Bindings): string {
  if (env.AIG_BASE_URL) return env.AIG_BASE_URL;
  if (env.AI_GATEWAY_ACCOUNT_ID && env.AI_GATEWAY_GATEWAY_ID) {
    return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_GATEWAY_ID}/openai`;
  }
  throw new Error('[createOpenAICompatClient] Missing Gateway base URL configuration');
}

export function createOpenAICompatClient(env: Bindings, opts: ProviderClientOpts = {}) {
  const apiKey = opts.userProviderKey || env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[createOpenAICompatClient] No API key available. Provide userProviderKey or configure OPENAI_API_KEY.');
  }

  const fetch = makeGatewayFetch(env);

  return new OpenAI({
    baseURL: resolveGatewayBaseURL(env),
    apiKey,
    fetch: fetch as any,
  });
}
