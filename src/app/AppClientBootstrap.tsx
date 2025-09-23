"use client";

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

// Global client bootstrap that ensures Authorization is attached to chat requests
export default function AppClientBootstrap() {
  useEffect(() => {
    try {
      const originalFetch = window.fetch.bind(window);
      const fallbackOrigin = 'https://studymill-api-production.merchantzains.workers.dev';
      let workerOrigin = fallbackOrigin;
      try {
        const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
        workerOrigin = envBase ? new URL(envBase).origin : fallbackOrigin;
      } catch {}
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          const urlStr = typeof input === 'string' ? input : (input as Request).url;
          const url = new URL(urlStr, window.location.origin);

          // Only target our API chat endpoints and other API calls (same-origin or Worker origin)
          const isApiPath = url.pathname.startsWith('/api/');
          const isSameOriginApi = url.origin === window.location.origin && isApiPath;
          const isWorkerApi = url.origin === workerOrigin && isApiPath;
          if (isSameOriginApi || isWorkerApi) {
            let targetUrl = url;
            let rewritten = false;
            if (isSameOriginApi && !isWorkerApi) {
              const workerUrl = new URL(workerOrigin);
              workerUrl.pathname = url.pathname;
              workerUrl.search = url.search;
              workerUrl.hash = url.hash;
              targetUrl = workerUrl;
              rewritten = true;
              input = targetUrl.toString();
            }
            const token = apiClient.getAccessToken();
            if (token) {
              const headers = new Headers(init?.headers || {});
              if (!headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${token}`);
              }
              init = { ...init, headers };
            }

            // Temporary client-side logging for chat endpoint errors
            if (url.pathname === '/api/v1/chat') {
              const method = (init?.method || (typeof input !== 'string' && (input as Request).method) || 'GET').toUpperCase();
              let bodyPreview: string | undefined;
              let parsedBody: any;
              try {
                if (init?.body && typeof init.body === 'string') {
                  bodyPreview = init.body;
                } else if (typeof input !== 'string' && (input as Request).bodyUsed === false) {
                  const clone = (input as Request).clone();
                  bodyPreview = await clone.text();
                } else if (init?.body instanceof URLSearchParams) {
                  bodyPreview = init.body.toString();
                }
                if (bodyPreview) {
                  parsedBody = JSON.parse(bodyPreview);
                }
              } catch (err) {
                console.warn('[client-chat] payload parse failed', err);
              }
              console.info('[client-chat] request', {
                method,
                url: targetUrl.toString(),
                hasAuth: !!token,
                targetOrigin: targetUrl.origin,
                rewritten,
                sessionId: parsedBody?.sessionId,
                client_request_id: parsedBody?.client_request_id,
                modelOverride: parsedBody?.modelOverride,
                providerOverride: parsedBody?.providerOverride,
                messagesCount: Array.isArray(parsedBody?.messages) ? parsedBody.messages.length : undefined,
              });
            }
          }
        } catch {}
        const res = await originalFetch(input as any, init);
        try {
          const urlStr = typeof input === 'string' ? input : (input as Request).url;
          const url = new URL(urlStr, window.location.origin);
          if (url.pathname === '/api/v1/chat' && res.status >= 400) {
            const copy = res.clone();
            const text = await copy.text().catch(() => '');
            console.error('[client-chat] error', {
              status: res.status,
              statusText: res.statusText,
              bodyPreview: text.slice(0, 1200),
              traceId: res.headers.get('x-request-id') || res.headers.get('cf-ray') || res.headers.get('x-proxy-trace-id'),
            });
          } else if (url.pathname === '/api/v1/chat') {
            console.info('[client-chat] response', {
              status: res.status,
              statusText: res.statusText,
              traceId: res.headers.get('x-request-id') || res.headers.get('cf-ray'),
              contentType: res.headers.get('content-type'),
            });
          }
        } catch {}
        return res;
      };
      // eslint-disable-next-line no-console
      console.info('[AppClientBootstrap] Global fetch interceptor installed');
      return () => {
        window.fetch = originalFetch;
      };
    } catch {}
  }, []);

  return null;
}
