'use client';

import { Group, Text, Progress, ActionIcon, ThemeIcon, rem } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconBrain, IconCoffee, IconMaximize } from '@tabler/icons-react';
import { useFocusTimerStore } from '@/store/useFocusTimerStore';

interface TimerMiniProps {
  onMaximize?: () => void;
}

export function TimerMini({ onMaximize }: TimerMiniProps) {
  const {
    timerState,
    startTimer,
    pauseTimer,
    resumeTimer,
    getFormattedTime,
    getProgress
  } = useFocusTimerStore();

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
      case 'focus': return <IconBrain size={14} />;
      case 'shortBreak':
      case 'longBreak': return <IconCoffee size={14} />;
      default: return <IconBrain size={14} />;
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

  if (!timerState.isRunning && !timerState.isPaused && timerState.status === 'idle') {
    return null;
  }

  return (
    <div style={{ 
      padding: rem(8), 
      borderTop: '1px solid var(--mantine-color-gray-3)',
      backgroundColor: 'var(--mantine-color-gray-0)'
    }}>
      <Group gap={rem(8)} wrap="nowrap">
        <ThemeIcon 
          size={20} 
          variant="light" 
          color={getModeColor(timerState.mode)}
        >
          {getModeIcon(timerState.mode)}
        </ThemeIcon>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={rem(4)} wrap="nowrap">
            <Text 
              size="xs" 
              fw={600} 
              style={{ 
                fontFamily: 'monospace',
                lineHeight: 1
              }}
            >
              {getFormattedTime()}
            </Text>
            {onMaximize && (
              <ActionIcon
                variant="subtle"
                size="xs"
                onClick={onMaximize}
                title="Expand timer"
              >
                <IconMaximize size={12} />
              </ActionIcon>
            )}
          </Group>
          
          <Progress
            value={getProgress()}
            color={getModeColor(timerState.mode)}
            size={3}
            radius="xl"
            style={{ marginTop: rem(2) }}
          />
        </div>
        
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={handleToggleTimer}
          color={timerState.isRunning ? 'orange' : 'blue'}
        >
          {timerState.isRunning ? 
            <IconPlayerPause size={12} /> : 
            <IconPlayerPlay size={12} />
          }
        </ActionIcon>
      </Group>
    </div>
  );
}