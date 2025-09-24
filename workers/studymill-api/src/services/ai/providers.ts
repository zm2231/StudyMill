import OpenAI from 'openai';
import { makeGatewayFetch } from './gatewayFetch';

export type ProviderClientOpts = {
  userProviderKey?: string | null;
};

export function createOpenAICompatClient(env: Bindings, opts: ProviderClientOpts = {}) {
  const fetch = makeGatewayFetch(env);

  return new OpenAI({
    baseURL: env.AIG_BASE_URL,
    apiKey: opts.userProviderKey || undefined,
    fetch: fetch as any,
  });
}
