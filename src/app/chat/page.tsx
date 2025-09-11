'use client';

import dynamic from 'next/dynamic';
import { ChatInterfaceHTTP } from '@/components/chat/ChatInterfaceHTTP';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { useEffect } from 'react';

const USE_HTTP = process.env.NEXT_PUBLIC_CHAT_HTTP === '1';
const LegacyChatInterface = !USE_HTTP
  ? dynamic(() => import('@/components/chat/ChatInterface').then(m => m.ChatInterface), { ssr: false })
  : null;

export default function ChatPage() {
  useEffect(() => {
    try {
      console.info('[ChatPage] mode:', USE_HTTP ? 'HTTP' : 'WebSocket', {
        NEXT_PUBLIC_CHAT_HTTP: process.env.NEXT_PUBLIC_CHAT_HTTP,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      });
    } catch {}
  }, []);

  return (
    <ProtectedRoute>
      <AppShell>
        {USE_HTTP ? <ChatInterfaceHTTP /> : LegacyChatInterface ? <LegacyChatInterface /> : null}
      </AppShell>
    </ProtectedRoute>
  );
}
