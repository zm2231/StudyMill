import { createOpenAI } from '@ai-sdk/openai';
import * as GoogleMod from '@ai-sdk/google';
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

function makeGoogleFactory(opts: any) {
  const anyMod = GoogleMod as any;
  const ctor = anyMod.createGoogle || anyMod.google || anyMod.createGoogleGenerativeAI;
  if (!ctor) throw new Error('Unsupported @ai-sdk/google version: no compatible factory export');
  return ctor(opts);
}

export function createProviderClient(opts: { provider: ProviderName; baseURL: string; gatewayToken: string }) {
  const { provider, baseURL, gatewayToken } = opts;
  const fetch = makeGatewayFetch(gatewayToken);

  if (provider === 'openai') {
    const client = createOpenAI({ baseURL, fetch });
    return { provider, getModel: (modelName?: string) => client(modelName || defaultModelFor('openai')!) };
  }
  if (provider === 'google') {
    const client = makeGoogleFactory({ baseURL, fetch });
    return { provider, getModel: (modelName?: string) => client(modelName || defaultModelFor('google')!) };
  }
  if (provider === 'openrouter') {
    // OpenRouter is OpenAI-compatible; use OpenAI client with OpenRouter baseURL
    const client = createOpenAI({ baseURL, fetch });
    return {
      provider,
      getModel: (modelName?: string) => {
        if (!modelName) throw new Error('openrouter requires an explicit model');
        return client(modelName);
      }
    };
  }
  throw new Error('Unsupported provider: ' + provider);
}

