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

// All providers are accessed via Cloudflare AI Gateway's OpenAI-compatible endpoint (compat)
export function createProviderClient(opts: { provider: ProviderName; baseURL: string; gatewayToken: string }) {
  const { provider, baseURL, gatewayToken } = opts;
  const fetch = makeGatewayFetch(gatewayToken);
  // Provide the Gateway token as the OpenAI apiKey so the SDK sends
  // Authorization: Bearer <AI_GATEWAY_TOKEN>, per Cloudflare docs.
  const client = createOpenAI({ baseURL, apiKey: gatewayToken, fetch });
  return {
    provider,
    getModel: (modelName?: string) => {
      if (!modelName) throw new Error('Model name is required for compat endpoint');
      if (!client?.chat?.completions || typeof client.chat.completions !== 'function') {
        throw new Error('OpenAI client does not expose chat.completions');
      }
      return client.chat.completions(modelName);
    }
  };
}
