'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/lib/api';
import { 
  Card, Stack, Group, Text, Button, Badge, Select, ScrollArea, TextInput, Loader
} from '@mantine/core';
import { IconPlus, IconRefresh } from '@tabler/icons-react';

export type DeckSummary = {
  id: string;
  name: string;
  description?: string | null;
  courseId: string;
  assignmentId?: string | null;
  weekId?: string | null;
  sourceType: string;
  totalCards: number;
  dueNow: number;
  createdAt: string;
  updatedAt: string;
};

export function DeckList({
  selectedCourseId,
  onCourseChange,
  selectedDeckId,
  onDeckSelect,
  onCreateDeck,
}: {
  selectedCourseId?: string | null;
  onCourseChange?: (id: string | null) => void;
  selectedDeckId?: string | null;
  onDeckSelect?: (id: string) => void;
  onCreateDeck?: () => void;
}) {
  const api = useApi();
  const [courses, setCourses] = useState<Array<{ value: string; label: string }>>([]);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredDecks = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? decks.filter(d => d.name.toLowerCase().includes(f)) : decks;
  }, [decks, filter]);

  const loadCourses = async () => {
    try {
      const res: any = await api.getCourses();
      const options = (res.courses || []).map((c: any) => ({ value: c.id, label: c.name }));
      setCourses(options);
    } catch (e) {
      // ignore
    }
  };

  const loadDecks = async (courseId?: string | null) => {
    try {
      setLoading(true);
      const res = await api.getDecks(courseId ? { courseId } : undefined);
      if (res.success) setDecks(res.decks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    loadDecks(selectedCourseId || null);
  }, [selectedCourseId]);

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="end">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600}>Decks</Text>
          <Group gap="xs">
            <Select
              data={courses}
              value={selectedCourseId || null}
              onChange={(v) => onCourseChange?.(v || null)}
              placeholder="Filter by course"
              clearable
              searchable
              style={{ flex: 1, minWidth: 180 }}
            />
            <TextInput
              placeholder="Search decks"
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
          </Group>
        </Stack>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => loadDecks(selectedCourseId || null)}>
            Refresh
          </Button>
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={onCreateDeck}>
            Create Deck
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" p="sm">
        {loading ? (
          <Stack align="center" py="md"><Loader size="sm" /></Stack>
        ) : (
          <ScrollArea h={320} offsetScrollbars>
            <Stack gap="xs">
              {filteredDecks.map((d) => (
                <Group key={d.id} p="sm" style={{ borderRadius: 8, cursor: 'pointer' }}
                  onClick={() => onDeckSelect?.(d.id)}
                  bg={selectedDeckId === d.id ? 'var(--mantine-color-gray-1)' : undefined}
                >
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Group gap={6}>
                      <Text fw={600} size="sm">{d.name}</Text>
                      <Badge size="xs" variant="light">{d.sourceType}</Badge>
                    </Group>
                    {d.description && (
                      <Text size="xs" c="dimmed">{d.description}</Text>
                    )}
                  </Stack>
                  <Group gap={6}>
                    <Badge size="sm" variant="light">{d.totalCards} cards</Badge>
                    <Badge size="sm" color="orange" variant="light">{d.dueNow} due</Badge>
                  </Group>
                </Group>
              ))}
              {filteredDecks.length === 0 && (
                <Stack align="center" py="md">
                  <Text size="sm" c="dimmed">No decks yet. Create one to get started.</Text>
                </Stack>
              )}
            </Stack>
          </ScrollArea>
        )}
      </Card>
    </Stack>
  );
}

