'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { Card, Stack, Group, Text, Badge, TextInput, Button, Loader, ScrollArea, Modal } from '@mantine/core';
import { IconSearch, IconTrash, IconPencil } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export function CardList({
  courseId,
  deckId,
}: {
  courseId?: string | null;
  deckId?: string | null;
}) {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; card: any | null }>({ open: false, card: null });
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getFlashcards({ courseId: courseId || undefined, deckId: deckId || undefined, query: search || undefined, limit: 100 });
      if (res.success) setItems(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [courseId, deckId]);

  const handleEdit = (card: any) => {
    setEditFront(card.front);
    setEditBack(card.back);
    setEditModal({ open: true, card });
  };

  const handleSaveEdit = async () => {
    if (!editModal.card) return;
    try {
      await api.updateFlashcard(editModal.card.id, { front: editFront, back: editBack });
      notifications.show({ title: 'Success', message: 'Card updated', color: 'green' });
      setEditModal({ open: false, card: null });
      load();
    } catch (e) {
      notifications.show({ title: 'Error', message: 'Failed to update card', color: 'red' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this card?')) return;
    try {
      await api.deleteFlashcard(id);
      notifications.show({ title: 'Success', message: 'Card deleted', color: 'green' });
      load();
    } catch (e) {
      notifications.show({ title: 'Error', message: 'Failed to delete card', color: 'red' });
    }
  };

  return (
    <>
      <Stack gap="sm">
        <Group justify="space-between" align="end">
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={600}>Cards</Text>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Search cards"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            />
          </Stack>
          <Button variant="light" onClick={load}>Search</Button>
        </Group>

        <Card withBorder radius="md" p="sm">
          {loading ? (
            <Stack align="center" py="md"><Loader size="sm" /></Stack>
          ) : items.length === 0 ? (
            <Stack align="center" py="md"><Text size="sm" c="dimmed">No cards found.</Text></Stack>
          ) : (
            <ScrollArea h={320} offsetScrollbars>
              <Stack gap="xs">
                {items.map((c) => (
                  <Card key={c.id} withBorder p="sm" radius="md">
                    <Stack gap={6}>
                      <Group justify="space-between" align="start">
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Text size="sm" fw={600}>Q: {c.front}</Text>
                          <Text size="sm" c="dimmed">A: {c.back}</Text>
                        </Stack>
                        <Group gap="xs">
                          <Badge size="xs" variant="light" color="orange">Due {c.nextReview ? new Date(c.nextReview).toLocaleDateString() : 'now'}</Badge>
                        </Group>
                      </Group>
                      <Group gap="xs" justify="end">
                        <Button size="xs" variant="subtle" leftSection={<IconPencil size={14} />} onClick={() => handleEdit(c)}>Edit</Button>
                        <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDelete(c.id)}>Delete</Button>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Card>
      </Stack>

      <Modal opened={editModal.open} onClose={() => setEditModal({ open: false, card: null })} title="Edit Card">
        <Stack>
          <TextInput label="Front" value={editFront} onChange={(e) => setEditFront(e.currentTarget.value)} />
          <TextInput label="Back" value={editBack} onChange={(e) => setEditBack(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditModal({ open: false, card: null })}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

