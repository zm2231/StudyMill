export function makeGatewayFetch() {
  return async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    // Do not modify Authorization here; createOpenAI will set
    // Authorization: Bearer <AI_GATEWAY_TOKEN> which Gateway expects.
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

