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
  body: unknown,
  init: RequestInit = {}
) {
  const url = `${resolveGatewayBaseURL(env)}/${endpoint}`;
  const headers = new Headers(init.headers || {});

  // Ensure JSON bodies default to application/json; callers can override explicitly.
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  // BYOK requirement: never forward provider Authorization headers to the Gateway.
  if (headers.has('Authorization')) headers.delete('Authorization');
  if (headers.has('authorization')) headers.delete('authorization');

  const gatewayBindingEnabled = (env.AIGATEWAY_USE_BINDING ?? '').toLowerCase() === 'true';
  const gatewayToken = env.CF_AIG_TOKEN ?? env.AI_GATEWAY_TOKEN;

  if (!gatewayBindingEnabled && gatewayToken) {
    // Authenticated Gateway expects the token in cf-aig-authorization when no binding is configured.
    headers.set('cf-aig-authorization', `Bearer ${gatewayToken}`);
  }

  const responseBody = init.body ?? (body === undefined ? undefined : JSON.stringify(body));

  const response = await fetch(url, {
    ...init,
    method: 'POST',
    headers,
    body: responseBody,
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
