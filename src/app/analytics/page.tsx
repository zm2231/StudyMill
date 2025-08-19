'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Card, Stack, Button } from '@mantine/core';
import { IconChartBar, IconTrendingUp } from '@tabler/icons-react';

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Title order={1}>Analytics & Progress</Title>
            
            <Card p="xl" radius="md" withBorder>
              <Stack gap="md" align="center">
                <IconChartBar size={48} color="var(--mantine-color-gray-5)" />
                <Title order={3} ta="center">Analytics Dashboard Coming Soon</Title>
                <Text ta="center" c="dimmed">
                  This feature is currently under development. Analytics will include:
                </Text>
                <Text ta="center" size="sm" c="dimmed">
                  • Study time tracking and trends<br />
                  • Flashcard performance metrics<br />
                  • Course progress visualization<br />
                  • Learning streak tracking
                </Text>
                <Button leftSection={<IconTrendingUp size={16} />} variant="light">
                  View Reports (WIP)
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}