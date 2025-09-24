import OpenAI from 'openai';
import type { Bindings } from '../../types/bindings';
import { makeGatewayFetch } from './gatewayFetch';

export type ProviderClientOpts = {
  userProviderKey?: string | null;
};

export function createOpenAICompatClient(env: Bindings, opts: ProviderClientOpts = {}) {
  if (!env.AIG_BASE_URL) {
    throw new Error('[createOpenAICompatClient] Missing AIG_BASE_URL binding for Gateway');
  }

  const apiKey = opts.userProviderKey || env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[createOpenAICompatClient] No API key available. Supply userProviderKey or configure OPENAI_API_KEY secret.');
  }

  const fetch = makeGatewayFetch(env);

  return new OpenAI({
    baseURL: env.AIG_BASE_URL,
    apiKey,
    fetch: fetch as any,
  });
}
