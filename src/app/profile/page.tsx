'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Stack } from '@mantine/core';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Title order={1}>Profile</Title>
            <Text c="dimmed">
              Profile page is coming soon. Manage your account settings and preferences here.
            </Text>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}