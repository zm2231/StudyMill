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

    // Generate a trace id for correlating logs
    const traceId = crypto.randomUUID();

    // Clone original request to preserve method, headers, body (supports SSE/ws upgrades too)
    const proxiedRequest = new Request(upstreamUrl.toString(), request);

    // Minimal request debug (do not log secrets)
    const reqHasAuth = proxiedRequest.headers.has('Authorization');
    const reqContentType = proxiedRequest.headers.get('Content-Type') || undefined;
    const reqMethod = proxiedRequest.method;

    try {
      const upstreamResponse = await fetch(proxiedRequest);

      // For non-OK, attempt to log response body (avoid consuming SSE)
      if (!upstreamResponse.ok) {
        let bodyPreview: string | undefined = undefined;
        try {
          // Clone to avoid consuming the original stream
          const copy = upstreamResponse.clone();
          const text = await copy.text();
          bodyPreview = text.slice(0, 2000); // cap preview
        } catch (e) {
          bodyPreview = '[unavailable]';
        }

        console.error('[api-proxy:error]', JSON.stringify({
          traceId,
          method: reqMethod,
          pathname: incomingUrl.pathname,
          search: incomingUrl.search,
          upstream: upstreamUrl.toString(),
          hasAuth: reqHasAuth,
          contentType: reqContentType,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          bodyPreview
        }));

        // Also surface the trace id to the client for support
        const headers = new Headers(upstreamResponse.headers);
        headers.set('x-proxy-trace-id', traceId);
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers
        });
      }

      // For OK responses, pass-through untouched
      return upstreamResponse;
    } catch (err: any) {
      console.error('[api-proxy:exception]', JSON.stringify({
        traceId,
        method: reqMethod,
        pathname: incomingUrl.pathname,
        search: incomingUrl.search,
        upstream: upstreamUrl.toString(),
        hasAuth: reqHasAuth,
        contentType: reqContentType,
        error: String(err && err.message || err)
      }));
      return new Response(JSON.stringify({
        code: 'PROXY_ERROR',
        message: 'Proxy exception',
        traceId
      }), { status: 502, headers: { 'Content-Type': 'application/json', 'x-proxy-trace-id': traceId } });
    }
  }
} satisfies ExportedHandler<Env>;
