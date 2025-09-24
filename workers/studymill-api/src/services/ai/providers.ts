import OpenAI from 'openai';
import type { Bindings } from '../../types/bindings';
import { makeGatewayFetch } from './gatewayFetch';

export const MANAGED_KEY_PLACEHOLDER = 'cf-managed-placeholder';

export type ProviderClientOpts = {
  userProviderKey?: string | null;
};

export function createOpenAICompatClient(env: Bindings, opts: ProviderClientOpts = {}) {
  if (!env.AIG_BASE_URL) {
    throw new Error('[createOpenAICompatClient] Missing AIG_BASE_URL binding for Gateway');
  }

  const isManaged = !opts.userProviderKey;
  const fetch = makeGatewayFetch(env, { stripAuthorizationHeader: isManaged });

  return new OpenAI({
    baseURL: env.AIG_BASE_URL,
    apiKey: opts.userProviderKey || MANAGED_KEY_PLACEHOLDER,
    fetch: fetch as any,
  });
}
