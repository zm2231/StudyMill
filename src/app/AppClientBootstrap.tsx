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
              console.info('[client-chat] request', {
                method,
                url: url.toString(),
                hasAuth: !!token,
                targetOrigin: url.origin,
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
            console.error('[client-chat] error', { status: res.status, statusText: res.statusText, bodyPreview: text.slice(0, 1200), traceId: res.headers.get('x-proxy-trace-id') });
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
