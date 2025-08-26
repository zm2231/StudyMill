'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApi } from '@/lib/api';
import { Stack, Group, Button, Card, Text, Loader, Badge } from '@mantine/core';
import { IconPlayerPlay, IconRotate2, IconSquare } from '@tabler/icons-react';

export function ReviewPane({ courseId, deckId }: { courseId?: string | null; deckId?: string | null }) {
  const api = useApi();
  const [queue, setQueue] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getDueFlashcards({ courseId: courseId || undefined, deckId: deckId || undefined, limit: 20 });
      if (res.success) {
        setQueue(res.items);
        setIndex(0);
        setShowBack(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [courseId, deckId]);

  const current = queue[index];

  const rate = useCallback(async (r: 1 | 2 | 3 | 4) => {
    if (!current || loading) return;
    setLoading(true);
    try {
      await api.reviewFlashcard(current.id, r);
      const nextIndex = index + 1;
      if (nextIndex >= queue.length) {
        await load();
      } else {
        setIndex(nextIndex);
        setShowBack(false);
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  }, [current, index, queue.length]);

  const flip = useCallback(() => {
    if (current) setShowBack((s) => !s);
  }, [current]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!current || loading) return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          flip();
          break;
        case '1':
          if (showBack) rate(1);
          break;
        case '2':
          if (showBack) rate(2);
          break;
        case '3':
          if (showBack) rate(3);
          break;
        case '4':
          if (showBack) rate(4);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [current, showBack, loading, flip, rate]);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button size="sm" variant="light" leftSection={<IconPlayerPlay size={16} />} onClick={load}>Start / Refresh</Button>
          <Button size="sm" variant="light" leftSection={<IconRotate2 size={16} />} onClick={flip} disabled={!current}>Flip (Space)</Button>
          <Button size="sm" variant="light" color="red" leftSection={<IconSquare size={16} />} onClick={() => { setQueue([]); setIndex(0); }}>End</Button>
        </Group>
        <Group>
          <Badge variant="light">{index + 1} / {queue.length || 0}</Badge>
          <Badge variant="light" color="orange">{queue.length - index - 1} remaining</Badge>
        </Group>
      </Group>

      {loading ? (
        <Stack align="center" py="lg"><Loader size="sm" /></Stack>
      ) : !current ? (
        <Stack align="center" py="lg">
          <Text size="sm" c="dimmed">No due cards.</Text>
          <Text size="xs" c="dimmed">Cards will appear here when they're ready for review.</Text>
        </Stack>
      ) : (
        <Card withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Text fw={600} size="lg">Q: {current.front}</Text>
            {showBack ? (
              <>
                <Text c="dimmed" size="md">A: {current.back}</Text>
                <Group mt="md">
                  <Button size="sm" variant="light" color="red" onClick={() => rate(1)}>1 Again</Button>
                  <Button size="sm" variant="light" color="orange" onClick={() => rate(2)}>2 Hard</Button>
                  <Button size="sm" variant="light" color="blue" onClick={() => rate(3)}>3 Good</Button>
                  <Button size="sm" variant="light" color="green" onClick={() => rate(4)}>4 Easy</Button>
                </Group>
                <Text size="xs" c="dimmed" ta="center">Press 1-4 to rate</Text>
              </>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="lg">Press Space to reveal answer</Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

