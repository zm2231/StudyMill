'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Card, Stack, Button, Group, SegmentedControl, Badge } from '@mantine/core';
import { IconBrain, IconCards } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/lib/api';
import { DeckList } from '@/components/flashcards/DeckList';
import { CardList } from '@/components/flashcards/CardList';
import { ReviewPane } from '@/components/flashcards/ReviewPane';
import { GenerateWizard } from '@/components/flashcards/GenerateWizard';
import { ImportModal } from '@/components/flashcards/ImportModal';

export default function StudyPage() {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<'browse' | 'review' | 'new'>('browse');
  const [stats, setStats] = useState<{ total: number; dueNow: number; newToday: number; reviewedToday: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingStats(true);
        const res = await api.getFlashcardStats();
        if (mounted && res.success) setStats(res.stats);
      } catch (e) {
        // silent
      } finally {
        if (mounted) setLoadingStats(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [api]);

  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Title order={1}>Flashcards</Title>
              <SegmentedControl
                value={activeTab}
                onChange={(v) => setActiveTab(v as any)}
                data={[
                  { label: 'Browse', value: 'browse' },
                  { label: 'Review', value: 'review' },
                  { label: 'New', value: 'new' },
                ]}
              />
            </Group>

            <Group gap="sm">
              <Badge variant="light">Total {loadingStats ? '…' : stats?.total ?? 0}</Badge>
              <Badge color="orange" variant="light">Due {loadingStats ? '…' : stats?.dueNow ?? 0}</Badge>
              <Badge color="green" variant="light">Reviewed Today {loadingStats ? '…' : stats?.reviewedToday ?? 0}</Badge>
              <Badge color="blue" variant="light">New Today {loadingStats ? '…' : stats?.newToday ?? 0}</Badge>
            </Group>

            {activeTab === 'browse' && (
              <Group align="start" grow>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <DeckList
                    selectedCourseId={selectedCourseId}
                    onCourseChange={setSelectedCourseId}
                    selectedDeckId={selectedDeckId}
                    onDeckSelect={setSelectedDeckId}
                    onCreateDeck={() => setImportOpen(true)}
                  />
                </div>
                <div style={{ flex: 2, minWidth: 400 }}>
                  <CardList courseId={selectedCourseId} deckId={selectedDeckId} />
                </div>
              </Group>
            )}

            {activeTab === 'review' && (
              <ReviewPane courseId={selectedCourseId} deckId={selectedDeckId} />
            )}

            {activeTab === 'new' && (
              <Card withBorder p="md" radius="md">
                <Stack>
                  <Group>
                    <Button size="sm" variant="light" onClick={() => setGenerateOpen(true)}>Generate from Docs</Button>
                    <Button size="sm" variant="light" onClick={() => setImportOpen(true)}>Bulk Import</Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
          <GenerateWizard
            opened={generateOpen}
            onClose={() => setGenerateOpen(false)}
            defaultCourseId={selectedCourseId}
            onImportAll={async ({ courseId, deckName, cards }) => {
              await api.importFlashcards({ courseId, deck: { name: deckName }, cards });
            }}
          />
          <ImportModal
            opened={importOpen}
            onClose={() => setImportOpen(false)}
            courseId={selectedCourseId}
            onImported={() => {}}
          />
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}
