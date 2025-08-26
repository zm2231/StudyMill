'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/api';
import { Modal, Stack, Textarea, Group, Button, TextInput, Text, Card, ScrollArea, Badge, SegmentedControl } from '@mantine/core';
import { IconUpload, IconEye } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export function ImportModal({
  opened,
  onClose,
  courseId,
  onImported,
}: {
  opened: boolean;
  onClose: () => void;
  courseId?: string | null;
  onImported?: (result: { deckId?: string; createdCount: number }) => void;
}) {
  const api = useApi();
  const [deckName, setDeckName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'auto' | 'json' | 'csv' | 'tsv' | 'lines'>('auto');

  // Parse preview
  const preview = useMemo(() => {
    if (!text.trim()) return [];
    const cards: Array<{ front: string; back: string }> = [];
    
    try {
      // Try JSON first
      if (format === 'auto' || format === 'json') {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (Array.isArray(item) && item.length >= 2) {
                cards.push({ front: String(item[0]), back: String(item[1]) });
              } else if (item && typeof item === 'object' && 'front' in item && 'back' in item) {
                cards.push({ front: String(item.front), back: String(item.back) });
              }
            }
            if (cards.length > 0) return cards;
          }
        } catch {}
      }

      // Parse as delimited text
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      
      if (format === 'tsv' || (format === 'auto' && lines[0]?.includes('\t'))) {
        // TSV format
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            cards.push({ front: parts[0].trim(), back: parts.slice(1).join('\t').trim() });
          }
        }
      } else if (format === 'csv' || (format === 'auto' && lines[0]?.includes(','))) {
        // CSV format
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 2) {
            cards.push({ front: parts[0].trim(), back: parts.slice(1).join(',').trim() });
          }
        }
      } else {
        // Line format with various separators
        for (const line of lines) {
          // Try common separators: —, -, :, |
          const match = line.match(/^(.+?)\s*[—\-:|]\s*(.+)$/);
          if (match) {
            cards.push({ front: match[1].trim(), back: match[2].trim() });
          }
        }
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
    
    return cards;
  }, [text, format]);

  const handleImport = async () => {
    if (!courseId || preview.length === 0) return;
    setLoading(true);
    try {
      const res = await api.importFlashcards({ 
        courseId, 
        deck: { name: deckName || 'Imported Deck' }, 
        cards: preview 
      });
      if (res.success) {
        notifications.show({ 
          title: 'Success', 
          message: `Imported ${res.createdCount} cards`, 
          color: 'green' 
        });
        onImported?.({ deckId: res.deckId, createdCount: res.createdCount });
        onClose();
        // Reset form
        setText('');
        setDeckName('');
      }
    } catch (e) {
      notifications.show({ 
        title: 'Error', 
        message: 'Failed to import cards', 
        color: 'red' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Bulk Import Cards" size="xl">
      <Stack>
        <TextInput 
          label="Deck name" 
          placeholder="My Study Deck" 
          value={deckName} 
          onChange={(e) => setDeckName(e.currentTarget.value)} 
          required
        />
        
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>Format</Text>
            <SegmentedControl
              size="xs"
              value={format}
              onChange={(v) => setFormat(v as any)}
              data={[
                { label: 'Auto', value: 'auto' },
                { label: 'JSON', value: 'json' },
                { label: 'CSV', value: 'csv' },
                { label: 'TSV', value: 'tsv' },
                { label: 'Lines', value: 'lines' },
              ]}
            />
          </Group>
          
          <Textarea
            label="Paste cards"
            placeholder={
              format === 'json' ? '[{"front": "Question", "back": "Answer"}, ...]' :
              format === 'csv' ? 'Question, Answer\nAnother question, Another answer' :
              format === 'tsv' ? 'Question\tAnswer\nAnother question\tAnother answer' :
              format === 'lines' ? 'Question — Answer\nQuestion: Answer\nQuestion - Answer' :
              'Paste in any format (JSON, CSV, TSV, or lines with separators)'
            }
            minRows={8}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            styles={{ input: { fontFamily: 'monospace' } }}
          />
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>Preview</Text>
            <Badge variant="light">{preview.length} cards</Badge>
          </Group>
          
          <Card withBorder p="sm">
            {preview.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">No cards to preview</Text>
            ) : (
              <ScrollArea h={200} offsetScrollbars>
                <Stack gap="xs">
                  {preview.slice(0, 50).map((card, i) => (
                    <Card key={i} withBorder p="xs">
                      <Stack gap={4}>
                        <Text size="xs" fw={600}>Q: {card.front}</Text>
                        <Text size="xs" c="dimmed">A: {card.back}</Text>
                      </Stack>
                    </Card>
                  ))}
                  {preview.length > 50 && (
                    <Text size="xs" c="dimmed" ta="center">...and {preview.length - 50} more</Text>
                  )}
                </Stack>
              </ScrollArea>
            )}
          </Card>
        </Stack>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button 
            variant="light" 
            leftSection={<IconUpload size={16} />} 
            loading={loading} 
            onClick={handleImport} 
            disabled={!text.trim() || preview.length === 0}
          >
            Import {preview.length} Cards
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

