import type { Bindings } from '../../types/bindings';

function resolveGatewayBaseURL(env: Bindings): string {
  if (env.AIG_BASE_URL) return env.AIG_BASE_URL;
  if (env.AI_GATEWAY_ACCOUNT_ID && env.AI_GATEWAY_GATEWAY_ID) {
    return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_GATEWAY_ID}/compat`;
  }
  throw new Error('Missing Gateway base URL configuration');
}

export async function gatewayOpenAICompatFetch(
  env: Bindings,
  endpoint: 'chat/completions' | 'responses',
  body: unknown
) {
  const url = `${resolveGatewayBaseURL(env)}/${endpoint}`;
  const headers = new Headers({ 'content-type': 'application/json' });

  const gatewayToken = env.CF_AIG_TOKEN ?? env.AI_GATEWAY_TOKEN;
  if (gatewayToken) {
    headers.set('Authorization', `Bearer ${gatewayToken}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.warn('[gateway] non-2xx', {
      status: response.status,
      statusText: response.statusText,
      url,
      text: text.slice(0, 400),
    });
  }

  return response;
}
