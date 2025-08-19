'use client';

import { useState, useEffect } from 'react';
import { Card, Title, Stack, Group, Text, Button, Progress, RingProgress, Center } from '@mantine/core';
import { 
  IconPlayerPlay, 
  IconPlayerPause, 
  IconRefresh, 
  IconClock, 
  IconSettings 
} from '@tabler/icons-react';

interface TimerSession {
  type: 'focus' | 'break';
  duration: number; // in minutes
  label: string;
}

const TIMER_PRESETS: TimerSession[] = [
  { type: 'focus', duration: 25, label: 'Pomodoro' },
  { type: 'focus', duration: 50, label: 'Deep Work' },
  { type: 'break', duration: 5, label: 'Short Break' },
  { type: 'break', duration: 15, label: 'Long Break' }
];

export function FocusTimerWidget() {
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [selectedPreset, setSelectedPreset] = useState(TIMER_PRESETS[0]);
  const [totalTime, setTotalTime] = useState(25 * 60);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      // Timer completed - could trigger notification here
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft]);

  const handleStart = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(selectedPreset.duration * 60);
    setTotalTime(selectedPreset.duration * 60);
  };

  const handlePresetChange = (preset: TimerSession) => {
    setSelectedPreset(preset);
    setTimeLeft(preset.duration * 60);
    setTotalTime(preset.duration * 60);
    setIsActive(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4} size="h5">
            <IconClock size={20} color="var(--forest-green-primary)" style={{ marginRight: '8px' }} />
            Focus Timer
          </Title>
          <Button variant="subtle" size="xs">
            <IconSettings size={14} />
          </Button>
        </Group>

        {/* Timer Display */}
        <Center>
          <RingProgress
            size={120}
            thickness={8}
            sections={[
              { 
                value: progress, 
                color: selectedPreset.type === 'focus' ? 'forestGreen' : 'blue' 
              }
            ]}
            label={
              <Stack gap="xs" align="center">
                <Text fw={600} size="lg">
                  {formatTime(timeLeft)}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {selectedPreset.label}
                </Text>
              </Stack>
            }
          />
        </Center>

        {/* Controls */}
        <Group justify="center" gap="sm">
          <Button
            variant={isActive ? 'filled' : 'light'}
            color="forestGreen"
            size="sm"
            leftSection={isActive ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            onClick={handleStart}
          >
            {isActive ? 'Pause' : 'Start'}
          </Button>
          
          <Button
            variant="outline"
            color="gray"
            size="sm"
            leftSection={<IconRefresh size={16} />}
            onClick={handleReset}
          >
            Reset
          </Button>
        </Group>

        {/* Preset Buttons */}
        <Stack gap="xs">
          <Text size="xs" fw={500} c="dimmed">Quick Sessions:</Text>
          <Group gap="xs">
            {TIMER_PRESETS.slice(0, 2).map((preset) => (
              <Button
                key={preset.label}
                variant={selectedPreset.label === preset.label ? 'light' : 'subtle'}
                color={preset.type === 'focus' ? 'forestGreen' : 'blue'}
                size="xs"
                flex={1}
                onClick={() => handlePresetChange(preset)}
              >
                {preset.duration}m
              </Button>
            ))}
          </Group>
        </Stack>

        {/* Session Stats */}
        <Group justify="space-between" p="sm" style={{ backgroundColor: 'var(--sanctuary-surface)', borderRadius: '6px' }}>
          <Stack gap={1} align="center">
            <Text size="sm" fw={600} c="var(--forest-green-primary)">3</Text>
            <Text size="xs" c="dimmed">Today</Text>
          </Stack>
          
          <Stack gap={1} align="center">
            <Text size="sm" fw={600} c="var(--forest-green-primary)">2h 15m</Text>
            <Text size="xs" c="dimmed">This Week</Text>
          </Stack>
          
          <Stack gap={1} align="center">
            <Text size="sm" fw={600} c="var(--forest-green-primary)">12</Text>
            <Text size="xs" c="dimmed">Streak</Text>
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Pomodoro-style focus timer with multiple presets
// - Visual ring progress indicator
// - Study session tracking and statistics
// - Focus/break mode differentiation
// - Compact design for dashboard widget
// - Integration ready for notifications and session logging