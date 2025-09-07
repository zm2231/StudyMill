'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/lib/api';
import { Card, Stack, Group, Text, Button, Badge, Loader, Textarea, Select, NumberInput, Checkbox, Modal, TextInput } from '@mantine/core';
import { IconSparkles, IconCheck, IconX } from '@tabler/icons-react';

export function GenerateWizard({
  opened,
  onClose,
  defaultCourseId,
  onImportAll,
}: {
  opened: boolean;
  onClose: () => void;
  defaultCourseId?: string | null;
  onImportAll?: (payload: { courseId: string; deckName: string; cards: Array<{ front: string; back: string }> }) => Promise<void>;
}) {
  const api = useApi();
  const [courseId, setCourseId] = useState<string | null>(defaultCourseId || null);
  const [courses, setCourses] = useState<Array<{ value: string; label: string }>>([]);
  const [deckName, setDeckName] = useState('');
  const [highlightPrompt, setHighlightPrompt] = useState('');
  const [useSyllabusData, setUseSyllabusData] = useState(false);
  const [extraInfo, setExtraInfo] = useState('');
  const [count, setCount] = useState<number | ''>(20);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Array<{ id: string; front: string; back: string }>>([]);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res: any = await api.getCourses();
        const options = (res.courses || []).map((c: any) => ({ value: c.id, label: c.name }));
        setCourses(options);
      } catch (e) {
        // ignore
      }
    };
    loadCourses();
  }, [api]);

  useEffect(() => { setCourseId(defaultCourseId || null); }, [defaultCourseId]);

  const handlePreview = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      // Create a deck container (metadata only) and then call AI preview separately per doc is out of scope here.
      // For now, simulate preview by calling generateDeck (to store metadata) and then using /ai/flashcards on a placeholder is not ideal.
      // We'll show empty preview unless integrated with document selection in a later step.
      setPreview([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    if (!courseId || !deckName) return;
    setLoading(true);
    try {
      // If we had preview, import those. For now, create an empty deck to hold future imports.
      await onImportAll?.({ courseId, deckName, cards: preview.map(({ front, back }) => ({ front, back })) });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Generate Flashcards" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">Two-step flow: preview first, then approve-all to import into a deck.</Text>

        <Select
          label="Course"
          data={courses}
          value={courseId}
          onChange={setCourseId}
          placeholder="Select course"
          searchable
          required
        />

        <TextInput
          label="Deck name"
          placeholder="e.g., Week 3 — Kinematics"
          value={deckName}
          onChange={(e) => setDeckName(e.currentTarget.value)}
          required
        />

        <Textarea
          label="What should the flashcards focus on?"
          placeholder="Key equations, definitions, and edge cases..."
          value={highlightPrompt}
          onChange={(e) => setHighlightPrompt(e.currentTarget.value)}
        />

        <Group>
          <NumberInput 
            label="Count" 
            value={count} 
            onChange={(v) => setCount(typeof v === 'number' ? v : v === '' ? '' : Number(v))} 
            min={1} 
            max={100} 
            style={{ flex: 1 }} 
          />
          <Select
            label="Difficulty"
            data={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
            value={difficulty}
            onChange={(v) => setDifficulty((v as any) || 'medium')}
            style={{ flex: 1 }}
          />
        </Group>

        <Checkbox
          label="Use syllabus data about the test"
          checked={useSyllabusData}
          onChange={(e) => setUseSyllabusData(e.currentTarget.checked)}
        />
        <Textarea
          label="Additional info for generation"
          placeholder="Exam topics, instructions, anything to bias card generation..."
          value={extraInfo}
          onChange={(e) => setExtraInfo(e.currentTarget.value)}
        />

        <Group>
          <Button variant="light" leftSection={<IconSparkles size={16} />} loading={loading} onClick={handlePreview}>Preview</Button>
          <Button variant="light" color="green" leftSection={<IconCheck size={16} />} loading={loading} onClick={handleApproveAll} disabled={!deckName}>Approve All</Button>
          <Button variant="subtle" color="gray" leftSection={<IconX size={16} />} onClick={onClose}>Cancel</Button>
        </Group>

        <Card withBorder radius="md" p="sm">
          <Stack>
            <Text size="sm" fw={600}>Preview</Text>
            {loading ? (
              <Stack align="center" py="md"><Loader size="sm" /></Stack>
            ) : preview.length === 0 ? (
              <Stack align="center" py="md"><Text size="sm" c="dimmed">No preview yet.</Text></Stack>
            ) : (
              <Stack gap="xs">
                {preview.slice(0, 10).map((c) => (
                  <Card key={c.id} withBorder p="sm" radius="md">
                    <Stack gap={4}>
                      <Text size="sm" fw={600}>Q: {c.front}</Text>
                      <Text size="sm" c="dimmed">A: {c.back}</Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </Modal>
  );
}
