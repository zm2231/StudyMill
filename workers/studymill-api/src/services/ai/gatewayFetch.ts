import type { Bindings } from '../../types/bindings';

type GatewayFetchOptions = {
  stripAuthorizationHeader?: boolean;
};

export function makeGatewayFetch(env: Bindings, options: GatewayFetchOptions = {}) {
  const useBinding = (env.AIGATEWAY_USE_BINDING || 'false').toLowerCase() === 'true';

  return async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});

    if (!useBinding) {
      const token = env.AI_GATEWAY_TOKEN;
      if (token && !headers.has('cf-aig-authorization')) {
        headers.set('cf-aig-authorization', `Bearer ${token}`);
      }
    }

    if (options.stripAuthorizationHeader && headers.has('authorization')) {
      headers.delete('authorization');
    }

    if (init?.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      console.warn('[gatewayFetch] non-2xx', {
        status: res.status,
        statusText: res.statusText,
        url: typeof url === 'string' ? url : undefined,
        cfLogId: res.headers.get('cf-aig-log-id') || undefined,
      });
    }
    return res;
  };
}
