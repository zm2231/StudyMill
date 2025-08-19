'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Card, Stack, Button } from '@mantine/core';
import { IconBrain, IconCards } from '@tabler/icons-react';

export default function StudyPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Title order={1}>Study & Flashcards</Title>
            
            <Card p="xl" radius="md" withBorder>
              <Stack gap="md" align="center">
                <IconBrain size={48} color="var(--mantine-color-gray-5)" />
                <Title order={3} ta="center">FSRS Study System Coming Soon</Title>
                <Text ta="center" c="dimmed">
                  This feature is currently under development. The study system will include:
                </Text>
                <Text ta="center" size="sm" c="dimmed">
                  • FSRS spaced repetition algorithm<br />
                  • Intelligent flashcard scheduling<br />
                  • Progress tracking and analytics<br />
                  • Deck management and organization
                </Text>
                <Button leftSection={<IconCards size={16} />} variant="light">
                  Create Flashcards (WIP)
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}