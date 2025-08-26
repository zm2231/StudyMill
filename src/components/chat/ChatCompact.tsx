'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Stack, Paper, ScrollArea, TextInput, ActionIcon, Loader, Group, Text, Badge, Box, Center } from '@mantine/core';
import { IconSend, IconRobot } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketChat } from '@/hooks/useWebSocketChat';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { notifications } from '@mantine/notifications';

export function ChatCompact() {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const {
    isConnected,
    isConnecting,
    messages,
    streamingMessage,
    sendMessage,
  } = useWebSocketChat({
    scope: 'all',
    userId: user?.id,
    onError: (err) => console.warn('[ChatCompact] error', err)
  });

  const isLoading = isConnecting || !isConnected;
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      requestAnimationFrame(() => {
        const el = scrollAreaRef.current!;
        el.scrollTop = el.scrollHeight + 1000;
      });
    }
  }, [messages, streamingMessage]);

  // Temporary toast for model info
  useEffect(() => {
    const handler = (e: any) => {
      const { model, reason } = e.detail || {};
      notifications.show({ title: 'StudyMill AI Model', message: reason ? `${model} (${reason})` : String(model || 'unknown'), color: 'green', autoClose: 2000 });
    };
    if (typeof window !== 'undefined') window.addEventListener('studymill-ai-info', handler);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('studymill-ai-info', handler); };
  }, []);

  const handleSendMessage = () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;
    setInputValue('');
    sendMessage(content);
  };

  return (
    <Stack gap="sm" h="100%">
      {/* Minimal header */}
      <Group justify="space-between">
        <Group gap={6}>
          <IconRobot size={14} style={{ color: 'var(--forest-green-primary)' }} />
          <Text size="sm" fw={600} style={{ color: 'var(--sanctuary-text-primary)' }}>AI Chat</Text>
        </Group>
        <Group gap={6}>
          <Box style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? 'var(--forest-green-primary)' : 'var(--warm-brown)' }} />
          <Text size="xs" c="dimmed">{isConnecting ? 'Connecting' : isConnected ? 'Online' : 'Offline'}</Text>
        </Group>
      </Group>

      {/* Messages area */}
      <Paper
        radius="md"
        style={{
          flex: 1,
          background: 'var(--sanctuary-surface)',
          border: '1px solid var(--border-light)',
          overflow: 'hidden'
        }}
      >
        <ScrollArea viewportRef={scrollAreaRef} style={{ height: '100%', maxHeight: 360 }} p="md">
          <Stack gap="sm">
            {messages.length === 0 && !streamingMessage ? (
              <Center h={220}>
                <Box p="md" style={{ border: '1px dashed var(--border-light)', background: 'var(--sanctuary-card)', borderRadius: 8, width: '100%' }}>
                  <Text size="sm" c="dimmed" ta="center">No messages yet — ask a question to get started.</Text>
                </Box>
              </Center>
            ) : (
              <>
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
                {streamingMessage && <ChatMessage key={streamingMessage.id} message={streamingMessage} />}
              </>
            )}
            {streamingMessage && <TypingIndicator />}
          </Stack>
        </ScrollArea>
      </Paper>

      {/* Input area */}
      <Box>
        <TextInput
          size="sm"
          radius="sm"
          placeholder="Ask anything about your studies..."
          value={inputValue}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          rightSection={
            isLoading ? (
              <Loader size={14} />
            ) : (
              <ActionIcon
                size="sm"
                radius="xl"
                variant="subtle"
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                style={{ backgroundColor: inputValue.trim() ? 'var(--forest-green-primary)' : 'transparent', color: inputValue.trim() ? 'white' : 'var(--sanctuary-text-secondary)' }}
              >
                <IconSend size={12} />
              </ActionIcon>
            )
          }
          styles={{
            input: {
              backgroundColor: 'var(--sanctuary-surface)',
              border: '1px solid var(--border-light)',
              '&:focus': {
                borderColor: 'var(--forest-green-primary)'
              }
            }
          }}
        />
        <Text size="xs" c="dimmed" mt={4} ta="center">Press Enter to send</Text>
      </Box>
    </Stack>
  );
}

