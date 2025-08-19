'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Card, Stack, Button } from '@mantine/core';
import { IconSchool, IconPlus } from '@tabler/icons-react';

export default function CoursesPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Title order={1}>Courses</Title>
            
            <Card p="xl" radius="md" withBorder>
              <Stack gap="md" align="center">
                <IconSchool size={48} color="var(--mantine-color-gray-5)" />
                <Title order={3} ta="center">Course Management Coming Soon</Title>
                <Text ta="center" c="dimmed">
                  This feature is currently under development. For now, you can create courses 
                  from the Library section or Dashboard Quick Add widget.
                </Text>
                <Button leftSection={<IconPlus size={16} />} variant="light">
                  Create Course (WIP)
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}