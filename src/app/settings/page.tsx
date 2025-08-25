'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Container, Title, Text, Stack, Card, Divider, Group } from '@mantine/core';
import { UniversitySelect } from '@/components/settings/UniversitySelect';
import { TimezoneSelect } from '@/components/settings/TimezoneSelect';
import { IconSchool, IconSettings, IconUser } from '@tabler/icons-react';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <div>
              <Title order={1}>Settings</Title>
              <Text c="dimmed" mt="xs">
                Configure your preferences and application settings.
              </Text>
            </div>

            {/* University Preferences */}
            <Card withBorder padding="lg">
              <Group gap="xs" mb="md">
                <IconSchool size={20} />
                <Title order={3}>University Preferences</Title>
              </Group>
              
              <Text size="sm" c="dimmed" mb="md">
                Select your university to enable institution-specific features like semester calendars and course imports.
              </Text>
              
              <UniversitySelect 
                description="This will enable hardcoded semester options for your institution and prepare for future course import features."
              />
            </Card>

            {/* Time & Locale */}
            <Card withBorder padding="lg">
              <Group gap="xs" mb="md">
                <IconSettings size={20} />
                <Title order={3}>Time & Locale</Title>
              </Group>

              <Text size="sm" c="dimmed" mb="md">
                Set your preferred timezone to ensure week calculations and dates are accurate.
              </Text>

              <TimezoneSelect />
            </Card>

            {/* Account Settings */}
            <Card withBorder padding="lg">
              <Group gap="xs" mb="md">
                <IconUser size={20} />
                <Title order={3}>Account Settings</Title>
              </Group>
              
              <Text size="sm" c="dimmed">
                Account management features are coming soon. You'll be able to manage your profile, change passwords, and configure privacy settings here.
              </Text>
            </Card>

            {/* General Settings */}
            <Card withBorder padding="lg">
              <Group gap="xs" mb="md">
                <IconSettings size={20} />
                <Title order={3}>General Settings</Title>
              </Group>
              
              <Text size="sm" c="dimmed">
                Theme selection, notification preferences, and data export options will be available soon.
              </Text>
            </Card>
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}
