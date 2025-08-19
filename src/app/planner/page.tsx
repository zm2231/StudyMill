'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Card, Stack, Button } from '@mantine/core';
import { IconCalendarTime, IconSettings } from '@tabler/icons-react';

export default function PlannerPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Title order={1}>Planner & Calendar</Title>
            
            <Card p="xl" radius="md" withBorder>
              <Stack gap="md" align="center">
                <IconCalendarTime size={48} color="var(--mantine-color-gray-5)" />
                <Title order={3} ta="center">Calendar & Scheduling Coming Soon</Title>
                <Text ta="center" c="dimmed">
                  This feature is currently under development. The planner will include:
                </Text>
                <Text ta="center" size="sm" c="dimmed">
                  • Class scheduling and management<br />
                  • Assignment due date tracking<br />
                  • Study session planning<br />
                  • React Big Calendar integration
                </Text>
                <Button leftSection={<IconSettings size={16} />} variant="light">
                  Configure Calendar (WIP)
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}