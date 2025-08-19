'use client';

import { ChatInterface } from '@/components/chat/ChatInterface';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <ChatInterface />
      </AppShell>
    </ProtectedRoute>
  );
}