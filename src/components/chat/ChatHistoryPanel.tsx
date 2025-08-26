'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box,
  Stack,
  Group,
  Text,
  ScrollArea,
  TextInput,
  Button,
  Loader,
  Badge
} from '@mantine/core';
import { IconClock, IconHistory, IconPlus, IconSearch } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';

interface SessionListItem {
  id: string;
  title: string;
  courseId?: string;
  assignmentId?: string;
  messageCount: number;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
}

export function ChatHistoryPanel({
  onSelectSession,
  onCreateNew,
  activeSessionId,
}: {
  onSelectSession: (sessionId: string) => void;
  onCreateNew: () => void;
  activeSessionId?: string;
}) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getChatSessions();
      if (res.success) {
        setSessions(res.sessions);
      } else {
        setError('Failed to load chat sessions');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load chat sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      s.title.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          <IconHistory size={18} style={{ color: 'var(--forest-green-primary)' }} />
          <Text fw={600}>Chat history</Text>
          <Badge variant="light" color="gray">{sessions.length}</Badge>
        </Group>
        <Group gap="xs">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={onCreateNew}>
            New chat
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Search chats..."
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        styles={{
          input: {
            backgroundColor: 'var(--sanctuary-surface)',
            borderColor: 'var(--border-light)'
          }
        }}
      />

      <Box style={{ borderTop: '1px solid var(--border-light)' }} />

      <ScrollArea style={{ flex: 1 }}>
        <Stack gap="xs" p="xs">
          {loading ? (
            <Group justify="center" p="md">
              <Loader size="sm" />
            </Group>
          ) : error ? (
            <Text c="red">{error}</Text>
          ) : filtered.length === 0 ? (
            <Text c="dimmed" ta="center" py="sm">No chats yet</Text>
          ) : (
            filtered.map((s) => {
              const last = s.lastActivity || s.updatedAt || s.createdAt;
              return (
                <Group
                  key={s.id}
                  justify="space-between"
                  p="sm"
                  style={{
                    border: '1px solid var(--border-light)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: s.id === activeSessionId ? 'var(--forest-green-light)' : 'var(--sanctuary-card)'
                  }}
                  onClick={() => onSelectSession(s.id)}
                >
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.title || 'Untitled chat'}
                    </Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">{s.messageCount} messages</Text>
                      <Text size="xs" c="dimmed">•</Text>
                      <Group gap={4}>
                        <IconClock size={12} />
                        <Text size="xs" c="dimmed">{new Date(last).toLocaleString()}</Text>
                      </Group>
                    </Group>
                  </Stack>
                </Group>
              );
            })
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

