// Cloudflare Pages Function: reverse-proxy for all /api/* requests
// This lets the frontend safely call same-origin paths like /api/chat,
// while the function forwards to your Worker API domain.
//
// Configure WORKER_API_BASE in your Cloudflare Pages project settings to
// something like: https://studymill-api-production.merchantzains.workers.dev
// Never set WORKER_API_BASE to studymill.ai (would loop).

export interface Env {
  WORKER_API_BASE?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const upstreamBase = env.WORKER_API_BASE || 'https://studymill-api-production.merchantzains.workers.dev';

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, upstreamBase);

  // Safety: avoid accidental infinite loop if misconfigured to own host
  if (upstreamUrl.host === incomingUrl.host) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Misconfiguration: WORKER_API_BASE must point to a different host than the current domain.',
        detail: { upstreamBase, host: incomingUrl.host }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Clone the request with the new target URL
  const proxiedRequest = new Request(upstreamUrl.toString(), request);

  // Perform the upstream fetch. For WebSocket upgrades, Workers will handle the 101 automatically
  // as long as we forward the original headers/body correctly.
  const upstreamResponse = await fetch(proxiedRequest);

  // IMPORTANT: Return the upstream Response object directly to preserve
  // WebSocket upgrades and all headers/statuses.
  return upstreamResponse;
};
