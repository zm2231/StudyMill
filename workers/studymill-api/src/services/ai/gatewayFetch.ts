import type { Bindings } from '../../types/bindings';

export function makeGatewayFetch(env: Bindings) {
  const useBinding = (env.AIGATEWAY_USE_BINDING || 'false').toLowerCase() === 'true';

  return async (input: RequestInfo, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});

    if (!useBinding) {
      const gatewayToken = env.CF_AIG_TOKEN || env.AI_GATEWAY_TOKEN;
      if (gatewayToken && !headers.has('cf-aig-authorization')) {
        headers.set('cf-aig-authorization', `Bearer ${gatewayToken}`);
      }
    }

    const res = await fetch(input, { ...init, headers });
    if (!res.ok) {
      console.warn('[gatewayFetch] non-2xx', {
        status: res.status,
        statusText: res.statusText,
        url: typeof input === 'string' ? input : undefined,
        cfLogId: res.headers.get('cf-aig-log-id') || undefined,
      });
    }
    return res;
  };
}
