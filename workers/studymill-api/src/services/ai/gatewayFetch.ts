export function makeGatewayFetch(env: Bindings) {
  return async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});

    if (env.AIGATEWAY_USE_BINDING !== 'true') {
      const token = env.AI_GATEWAY_TOKEN;
      if (token && !headers.has('cf-aig-authorization')) {
        headers.set('cf-aig-authorization', `Bearer ${token}`);
      }
    }

    // Never set Authorization here; BYOK provider keys are handled by the OpenAI client
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      try {
        const copy = res.clone();
        const text = await copy.text();
        console.warn('[gatewayFetch] non-2xx', {
          status: res.status,
          statusText: res.statusText,
          url: typeof url === 'string' ? url : '',
          bodyPreview: (text || '').slice(0, 512)
        });
      } catch {}
    }
    return res;
  };
}
