export interface Env {
  WORKER_API_BASE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);

    // Only handle /api/*
    if (!incomingUrl.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    const upstreamBase = env.WORKER_API_BASE || 'https://studymill-api-production.merchantzains.workers.dev';
    const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, upstreamBase);

    // Safety: avoid proxy loop
    if (upstreamUrl.host === incomingUrl.host) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Misconfiguration: WORKER_API_BASE must be different from current host',
          detail: { upstreamBase, host: incomingUrl.host }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Clone original request to preserve method, headers, body (supports SSE/ws upgrades too)
    const proxiedRequest = new Request(upstreamUrl.toString(), request);

    // Perform the upstream fetch and return the response directly
    return fetch(proxiedRequest);
  }
} satisfies ExportedHandler<Env>;
