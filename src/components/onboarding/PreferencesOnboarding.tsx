'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, Stack, Text, Button, Group, Divider } from '@mantine/core';
import { UniversitySelect } from '@/components/settings/UniversitySelect';
import { TimezoneSelect } from '@/components/settings/TimezoneSelect';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface PreferencesOnboardingProps {
  opened: boolean;
  onClose: () => void;
}

export function PreferencesOnboarding({ opened, onClose }: PreferencesOnboardingProps) {
  const { preferences, setUniversity, setTimeZone } = useUserPreferences();
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (opened) setTouched(false);
  }, [opened]);

  const canSave = useMemo(() => {
    return Boolean(preferences.universityId && preferences.timeZone);
  }, [preferences.universityId, preferences.timeZone]);

  return (
    <Modal opened={opened} onClose={onClose} title="Set your preferences" centered size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Help us personalize your experience. You can change these later in Settings.
        </Text>
        <Divider />
        <UniversitySelect required />
        <TimezoneSelect />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Skip for now</Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              setTouched(true);
              if (canSave) {
                onClose();
              }
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

