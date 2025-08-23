'use client';

import { useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Progress,
  Badge,
  ActionIcon,
  Tabs,
  NumberInput,
  Switch,
  Divider,
  Alert,
  ThemeIcon,
  rem
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconRefresh,
  IconSettings,
  IconBrain,
  IconCoffee,
  IconMinus,
  IconX,
  IconMaximize,
  IconBell,
  IconVolume
} from '@tabler/icons-react';
import { useFocusTimerStore, requestNotificationPermission } from '@/store/useFocusTimerStore';

interface FocusTimerProps {
  variant?: 'full' | 'mini';
  onMinimize?: () => void;
  onClose?: () => void;
}

export function FocusTimer({ variant = 'full', onMinimize, onClose }: FocusTimerProps) {
  const {
    timerState,
    settings,
    initializeWorker,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    changeMode,
    updateSettings,
    getFormattedTime,
    getProgress,
    getStatusText
  } = useFocusTimerStore();

  // Initialize worker on mount
  useEffect(() => {
    initializeWorker();
    
    // Request notification permission
    if (settings.notifications) {
      requestNotificationPermission();
    }
  }, []);

  const handleToggleTimer = () => {
    if (timerState.isRunning) {
      pauseTimer();
    } else if (timerState.isPaused) {
      resumeTimer();
    } else {
      startTimer();
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'focus': return <IconBrain size={20} />;
      case 'shortBreak':
      case 'longBreak': return <IconCoffee size={20} />;
      default: return <IconBrain size={20} />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'focus': return 'blue';
      case 'shortBreak': return 'green';
      case 'longBreak': return 'orange';
      default: return 'gray';
    }
  };

  if (variant === 'mini') {
    return (
      <Card withBorder p="sm" radius="md" style={{ minWidth: 200 }}>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs">
              <ThemeIcon 
                size="sm" 
                variant="light" 
                color={getModeColor(timerState.mode)}
              >
                {getModeIcon(timerState.mode)}
              </ThemeIcon>
              <Text size="sm" fw={500}>
                {getFormattedTime()}
              </Text>
            </Group>
            
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleToggleTimer}
                color={timerState.isRunning ? 'orange' : 'blue'}
              >
                {timerState.isRunning ? 
                  <IconPlayerPause size={14} /> : 
                  <IconPlayerPlay size={14} />
                }
              </ActionIcon>
              
              {onClose && (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={onClose}
                >
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>
          </Group>
          
          <Progress
            value={getProgress()}
            color={getModeColor(timerState.mode)}
            size="xs"
            radius="xl"
          />
          
          <Text size="xs" c="dimmed" style={{ textAlign: 'center' }}>
            {timerState.mode === 'focus' ? 'Focus' : 'Break'} • 
            {timerState.pomodoroCount} completed
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon 
              size="lg" 
              variant="light" 
              color={getModeColor(timerState.mode)}
            >
              {getModeIcon(timerState.mode)}
            </ThemeIcon>
            <div>
              <Text fw={500}>Focus Timer</Text>
              <Text size="sm" c="dimmed">
                {getStatusText()}
              </Text>
            </div>
          </Group>
          
          <Group gap="xs">
            {onMinimize && (
              <ActionIcon
                variant="subtle"
                onClick={onMinimize}
                title="Minimize timer"
              >
                <IconMinus size={16} />
              </ActionIcon>
            )}
            {onClose && (
              <ActionIcon
                variant="subtle"
                onClick={onClose}
                title="Close timer"
              >
                <IconX size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>

        {/* Timer Display */}
        <Stack align="center" gap="md">
          <Text 
            size="4rem" 
            fw={700} 
            style={{ 
              fontFamily: 'monospace',
              letterSpacing: '0.1em'
            }}
            c={timerState.status === 'completed' ? getModeColor(timerState.mode) : undefined}
          >
            {getFormattedTime()}
          </Text>
          
          <Progress
            value={getProgress()}
            color={getModeColor(timerState.mode)}
            size="lg"
            radius="xl"
            style={{ width: '100%' }}
            striped
            animate={timerState.isRunning}
          />
        </Stack>

        {/* Mode Selection */}
        <Group justify="center" gap="xs">
          <Button
            variant={timerState.mode === 'focus' ? 'filled' : 'light'}
            color="blue"
            size="sm"
            leftSection={<IconBrain size={16} />}
            onClick={() => changeMode('focus')}
            disabled={timerState.isRunning}
          >
            Focus ({settings.focus}m)
          </Button>
          <Button
            variant={timerState.mode === 'shortBreak' ? 'filled' : 'light'}
            color="green"
            size="sm"
            leftSection={<IconCoffee size={16} />}
            onClick={() => changeMode('shortBreak')}
            disabled={timerState.isRunning}
          >
            Short ({settings.shortBreak}m)
          </Button>
          <Button
            variant={timerState.mode === 'longBreak' ? 'filled' : 'light'}
            color="orange"
            size="sm"
            leftSection={<IconCoffee size={16} />}
            onClick={() => changeMode('longBreak')}
            disabled={timerState.isRunning}
          >
            Long ({settings.longBreak}m)
          </Button>
        </Group>

        {/* Controls */}
        <Group justify="center" gap="md">
          <Button
            onClick={handleToggleTimer}
            color={timerState.isRunning ? 'orange' : 'blue'}
            size="lg"
            leftSection={
              timerState.isRunning ? 
                <IconPlayerPause size={20} /> : 
                <IconPlayerPlay size={20} />
            }
          >
            {timerState.isRunning ? 'Pause' : 
             timerState.isPaused ? 'Resume' : 'Start'}
          </Button>
          
          <ActionIcon
            variant="light"
            size="lg"
            onClick={resetTimer}
            title="Reset timer"
          >
            <IconRefresh size={20} />
          </ActionIcon>
        </Group>

        {/* Stats */}
        <Card withBorder p="sm" bg="var(--sanctuary-surface)">
          <Group justify="space-around" align="center">
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="blue">
                {timerState.pomodoroCount}
              </Text>
              <Text size="sm" c="dimmed">
                Completed
              </Text>
            </div>
            
            <Divider orientation="vertical" />
            
            <div style={{ textAlign: 'center' }}>
              <Badge
                size="lg"
                color={getModeColor(timerState.mode)}
                variant="light"
              >
                {timerState.mode === 'focus' ? 'Focus Session' :
                 timerState.mode === 'shortBreak' ? 'Short Break' :
                 'Long Break'}
              </Badge>
            </div>
          </Group>
        </Card>

        {/* Settings */}
        <Tabs defaultValue="durations">
          <Tabs.List grow>
            <Tabs.Tab 
              value="durations"
              leftSection={<IconSettings style={{ width: rem(16), height: rem(16) }} />}
            >
              Durations
            </Tabs.Tab>
            <Tabs.Tab 
              value="preferences"
              leftSection={<IconBell style={{ width: rem(16), height: rem(16) }} />}
            >
              Preferences
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="durations" pt="md">
            <Stack gap="sm">
              <NumberInput
                label="Focus Duration (minutes)"
                value={settings.focus}
                onChange={(value) => updateSettings({ focus: Number(value) || 25 })}
                min={1}
                max={60}
                disabled={timerState.isRunning}
              />
              <NumberInput
                label="Short Break (minutes)"
                value={settings.shortBreak}
                onChange={(value) => updateSettings({ shortBreak: Number(value) || 5 })}
                min={1}
                max={30}
                disabled={timerState.isRunning}
              />
              <NumberInput
                label="Long Break (minutes)"
                value={settings.longBreak}
                onChange={(value) => updateSettings({ longBreak: Number(value) || 15 })}
                min={1}
                max={60}
                disabled={timerState.isRunning}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="preferences" pt="md">
            <Stack gap="md">
              <Switch
                label="Auto-start breaks"
                description="Automatically start break timers when focus sessions complete"
                checked={settings.autoStartBreaks}
                onChange={(e) => updateSettings({ autoStartBreaks: e.currentTarget.checked })}
              />
              <Switch
                label="Auto-start focus sessions"
                description="Automatically start focus sessions when breaks complete"
                checked={settings.autoStartPomodoros}
                onChange={(e) => updateSettings({ autoStartPomodoros: e.currentTarget.checked })}
              />
              <Switch
                label="Notifications"
                description="Show browser notifications when timers complete"
                checked={settings.notifications}
                onChange={async (e) => {
                  const enabled = e.currentTarget.checked;
                  if (enabled) {
                    const granted = await requestNotificationPermission();
                    if (granted) {
                      updateSettings({ notifications: true });
                    }
                  } else {
                    updateSettings({ notifications: false });
                  }
                }}
              />
              <Switch
                label="Sound alerts"
                description="Play sound when timers complete"
                checked={settings.soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.currentTarget.checked })}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Tips */}
        <Alert variant="light" icon={<IconBrain size={16} />}>
          <Text size="sm">
            <strong>Pro tip:</strong> The timer runs in the background and will continue 
            even if you navigate to other pages or minimize your browser.
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}