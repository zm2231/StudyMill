"use client";

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

// Global client bootstrap that ensures Authorization is attached to chat requests
export default function AppClientBootstrap() {
  useEffect(() => {
    try {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          const urlStr = typeof input === 'string' ? input : (input as Request).url;
          const url = new URL(urlStr, window.location.origin);

          // Only target our API chat endpoints and other API calls
          const isApiPath = url.pathname.startsWith('/api/');
          if (isApiPath) {
            const token = apiClient.getAccessToken();
            if (token) {
              const headers = new Headers(init?.headers || {});
              if (!headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${token}`);
              }
              init = { ...init, headers };
            }
          }
        } catch {}
        return originalFetch(input as any, init);
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
