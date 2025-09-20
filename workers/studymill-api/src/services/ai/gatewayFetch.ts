export function makeGatewayFetch(aigToken: string) {
  return async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    // Authenticated Gateway token must be in cf-aig-authorization per Cloudflare docs
    headers.set('cf-aig-authorization', `Bearer ${aigToken}`);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...init, headers });
  };
}

