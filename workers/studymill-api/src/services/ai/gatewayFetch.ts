export function makeGatewayFetch(gatewayToken: string) {
  return async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    // Ensure authenticated gateway header is present (Cloudflare requirement
    // when the Gateway is configured with auth tokens).
    if (!headers.has('cf-aig-authorization')) {
      headers.set('cf-aig-authorization', `Bearer ${gatewayToken}`);
    }
    // Do not modify Authorization here; createOpenAI sets
    // Authorization: Bearer <AI_GATEWAY_TOKEN> already.
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      try {
        const copy = res.clone();
        const text = await copy.text();
        console.error(JSON.stringify({
          event: 'gateway_error',
          status: res.status,
          statusText: res.statusText,
          url,
          bodyPreview: (text || '').slice(0, 1200)
        }));
      } catch {}
    }
    return res;
  };
}
