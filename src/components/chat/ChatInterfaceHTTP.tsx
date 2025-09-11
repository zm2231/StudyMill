"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Container, Paper, Stack, Group, Text, TextInput, ActionIcon, Loader, Badge, ScrollArea, Box } from '@mantine/core';
import { IconMessageCircle, IconSend } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ChatMessage } from './ChatMessage';
import type { Message as UIMessage } from '@/types/chat';

function SourcesList({ sources }: { sources: Array<{ id: string; title: string; snippet: string }>} ) {
  if (!sources || sources.length === 0) return null;
  return (
    <Box mt="xs" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: 8 }}>
      <Text size="xs" c="dimmed" mb={4}>Sources</Text>
      <Stack gap={6}>
        {sources.map((s, i) => (
          <Box key={`${s.id}-${i}`} style={{ background: 'var(--sanctuary-surface)', border: '1px solid var(--border-light)', borderRadius: 6, padding: 8 }}>
            <Text size="sm" fw={600}>{s.title || s.id}</Text>
            <Text size="xs" c="dimmed">{s.snippet}</Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function contentFromChatMessage(m: any): string {
  if (typeof m?.content === 'string' && m.content) return m.content;
  if (Array.isArray(m?.parts)) {
    try {
      return m.parts
        .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('');
    } catch {}
  }
  return '';
}

export function ChatInterfaceHTTP() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams?.get('s') || undefined;
  const [sessionId, setSessionId] = useState<string | undefined>(urlSessionId);
  const [lastSources, setLastSources] = useState<Array<{ id: string; title: string; snippet: string }>>([]);
  const [contextHash, setContextHash] = useState<string | undefined>(undefined);
  const [text, setText] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Ensure a session exists before first send
  useEffect(() => {
    (async () => {
      if (!sessionId) {
        try {
          const res = await apiClient.createChatSession({ title: 'New chat' });
          if (res.success) {
            setSessionId(res.session.id);
          }
        } catch (e) {
          console.error('Failed to create chat session', e);
        }
      }
    })();
  }, [sessionId]);

  const token = useMemo(() => (typeof window !== 'undefined' ? apiClient.getAccessToken() : null), []);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://studymill-api-production.merchantzains.workers.dev';

  useEffect(() => {
    try {
      console.info('[ChatInterfaceHTTP] mounted', {
        apiBase,
        NEXT_PUBLIC_CHAT_HTTP: process.env.NEXT_PUBLIC_CHAT_HTTP,
      });
    } catch {}
  }, [apiBase]);

  const {
    messages: chatMessages,
    sendMessage,
    status,
    error
  } = useChat({
    api: '/api/chat',
    headers: () => {
      const tkn = typeof window !== 'undefined' ? apiClient.getAccessToken() : null;
      return tkn ? { Authorization: `Bearer ${tkn}` } : {};
    },
    fetch: async (path, init) => {
      const target = `${apiBase}${path}`;
      try { console.info('[ChatInterfaceHTTP] proxy fetch', { target }); } catch {}
      const headers = new Headers(init?.headers || {});
      const tkn = typeof window !== 'undefined' ? apiClient.getAccessToken() : null;
      if (tkn && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${tkn}`);
      return fetch(target, { ...init, headers });
    },
    body: () => (sessionId ? { sessionId } : undefined),
    onFinish: async () => {
      try {
        if (!sessionId) return;
        const res = await apiClient.getChatMessages(sessionId, { limit: 200 });
        if (res.success && res.messages.length > 0) {
          const last = res.messages[res.messages.length - 1];
          let meta: any | undefined;
          if (last.role === 'assistant' && (last as any).documentReferences) {
            try {
              meta = typeof (last as any).documentReferences === 'string'
                ? JSON.parse((last as any).documentReferences as any)
                : ((last as any).documentReferences as any);
              if (meta?.sources) setLastSources(meta.sources);
              if (meta?.context_hash) setContextHash(meta.context_hash);
            } catch {}
          }
          try {
            console.info('[ChatInterfaceHTTP] onFinish', {
              sessionId,
              sourcesCount: meta?.sources?.length || 0,
              hasContextHash: !!meta?.context_hash,
            });
          } catch {}
        }
      } catch (e) {
        console.warn('Unable to fetch sources after finish', e);
      }
    }
  });

  const isStreaming = status === 'streaming';

  // Auto-scroll on new tokens
  useEffect(() => {
    if (scrollAreaRef.current) {
      requestAnimationFrame(() => {
        const el = scrollAreaRef.current!;
        el.scrollTop = el.scrollHeight + 1000;
      });
    }
  }, [chatMessages, isStreaming]);

  const uiMessages: UIMessage[] = chatMessages.map((m: any) => ({
    id: m.id,
    role: (m.role as any) || 'assistant',
    content: contentFromChatMessage(m),
    timestamp: new Date(),
    status: 'delivered'
  }));

  return (
    <Container size="lg" py="md">
      <Stack gap="md" h="calc(100vh - 120px)">
        {/* Header */}
        <Paper p="md" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
          <Group justify="space-between">
            <Group gap="sm">
              <IconMessageCircle size={24} style={{ color: 'var(--forest-green-primary)' }} />
              <Text fw={600} style={{ color: 'var(--sanctuary-text-primary)' }}>AI Study Assistant</Text>
              <Badge variant="light" style={{ backgroundColor: 'var(--forest-green-light)', color: 'var(--forest-green-primary)' }}>
                HTTP
              </Badge>
              {sessionId && <Text size="xs" c="dimmed">Session: {sessionId.slice(0, 18)}</Text>}
              {contextHash && (
                <Badge variant="light" color="gray">ctx {contextHash.slice(0, 8)}</Badge>
              )}
            </Group>
          </Group>
        </Paper>

        {/* Messages */}
        <Paper p="sm" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)', flex: 1, minHeight: 300 }}>
          <ScrollArea.Autosize mah="100%" ref={scrollAreaRef as any}>
            <Stack gap="sm">
              {uiMessages.map((m, idx) => (
                <div key={m.id}>
                  <ChatMessage message={m} />
                  {idx === uiMessages.length - 1 && m.role === 'assistant' && lastSources && lastSources.length > 0 && (
                    <SourcesList sources={lastSources} />
                  )}
                </div>
              ))}
              {isStreaming && (
                <Group gap="xs">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Streaming…</Text>
                </Group>
              )}
              {error && <Text c="red">{String(error)}</Text>}
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        {/* Input */}
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!sessionId) return;
          const t = text.trim();
          if (!t) return;
          setText('');
          await sendMessage({ text: t });
        }}>
          <Group>
            <TextInput
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              placeholder="Type your question…"
              style={{ flex: 1 }}
            />
            <ActionIcon type="submit" variant="filled" color="green" disabled={isStreaming || !text.trim()}>
              <IconSend size={18} />
            </ActionIcon>
          </Group>
        </form>
      </Stack>
    </Container>
  );
}
