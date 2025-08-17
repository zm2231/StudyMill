'use client';

import { ChatInterface } from '@/components/chat/ChatInterface';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatInterface />
    </ProtectedRoute>
  );
}