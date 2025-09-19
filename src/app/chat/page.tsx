'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ChatInterfaceHTTP } from '@/components/chat/ChatInterfaceHTTP';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';

// WS component is loaded client-side only
const LegacyChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface').then(m => m.ChatInterface),
  { ssr: false }
);

export default function ChatPage() {
  // Transport selection (SSE default; WS only behind flag and google provider)
  const provider = 'google' as const; // default provider per server config
  const enableRealtime = process.env.NEXT_PUBLIC_CHAT_WS === '1';
  const initialTransport: 'sse' | 'ws' = (provider === 'google' && enableRealtime) ? 'ws' : 'sse';
  const [transport, setTransport] = useState<'sse' | 'ws'>(initialTransport);

  useEffect(() => {
    try {
      console.info('[ChatPage] transport:', transport, {
        NEXT_PUBLIC_CHAT_WS: process.env.NEXT_PUBLIC_CHAT_WS,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      });
    } catch {}
  }, [transport]);

  return (
    <ProtectedRoute>
      <AppShell>
        {transport === 'ws' ? (
          <LegacyChatInterface onFallback={() => setTransport('sse')} />
        ) : (
          <ChatInterfaceHTTP />
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
