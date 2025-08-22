'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Stack } from '@mantine/core';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Title order={1}>Settings</Title>
            <Text c="dimmed">
              Settings page is coming soon. Configure your preferences and application settings here.
            </Text>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}