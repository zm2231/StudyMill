import { createOpenAI } from '@ai-sdk/openai';
import { makeGatewayFetch } from './gatewayFetch';

export const PROVIDERS = ['google', 'openai', 'openrouter'] as const;
export type ProviderName = typeof PROVIDERS[number];

export function defaultModelFor(provider: ProviderName): string | undefined {
  switch (provider) {
    case 'google': return 'gemini-2.5-flash';
    case 'openai': return 'gpt-4o-mini';
    case 'openrouter': return undefined; // explicit model required
  }
}

function asModelFactory(client: any) {
  if (typeof client === 'function') return client;
  if (client && typeof client === 'object') {
    if (typeof client.model === 'function') return client.model.bind(client);
    if (typeof client.languageModel === 'function') return client.languageModel.bind(client);
  }
  throw new Error('Provider client is not a function');
}

// All providers are accessed via Cloudflare AI Gateway's OpenAI-compatible endpoint (compat)
export function createProviderClient(opts: { provider: ProviderName; baseURL: string; gatewayToken: string }) {
  const { provider, baseURL, gatewayToken } = opts;
  const fetch = makeGatewayFetch(gatewayToken);
  const client = createOpenAI({ baseURL, fetch });
  const factory = asModelFactory(client);
  return {
    provider,
    getModel: (modelName?: string) => {
      if (!modelName) throw new Error('Model name is required for compat endpoint');
      return factory(modelName);
    }
  };
}

