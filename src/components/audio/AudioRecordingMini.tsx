'use client';

import { Group, Text, ActionIcon, Badge, rem } from '@mantine/core';
import { IconMicrophone, IconMaximize } from '@tabler/icons-react';
import { useAudioRecordingStore } from '@/store/useAudioRecordingStore';

interface AudioRecordingMiniProps {
  onMaximize?: () => void;
}

export function AudioRecordingMini({ onMaximize }: AudioRecordingMiniProps) {
  const { status, duration, isMinimized } = useAudioRecordingStore();

  // Only show if recording and minimized
  if (status !== 'recording' && status !== 'paused' && status !== 'uploading') {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (status) {
      case 'recording': return 'red';
      case 'paused': return 'orange';
      case 'uploading': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div style={{ 
      padding: rem(8), 
      borderTop: '1px solid var(--mantine-color-gray-3)',
      backgroundColor: 'var(--mantine-color-gray-0)'
    }}>
      <Group gap={rem(8)} wrap="nowrap">
        <ActionIcon
          size={20}
          variant="light"
          color={getStatusColor()}
          style={{
            animation: status === 'recording' ? 'pulse 1.5s ease-in-out infinite' : undefined
          }}
        >
          <IconMicrophone size={14} />
        </ActionIcon>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={rem(4)} wrap="nowrap" justify="space-between">
            <div>
              <Text 
                size="xs" 
                fw={600} 
                style={{ 
                  fontFamily: 'monospace',
                  lineHeight: 1,
                  color: status === 'recording' ? 'var(--mantine-color-red-6)' : undefined
                }}
              >
                {formatDuration(duration)}
              </Text>
              <Badge size="xs" color={getStatusColor()} variant="light">
                {status}
              </Badge>
            </div>
            
            {onMaximize && (
              <ActionIcon
                variant="subtle"
                size="xs"
                onClick={onMaximize}
                title="Show recorder"
              >
                <IconMaximize size={10} />
              </ActionIcon>
            )}
          </Group>
        </div>
      </Group>
      
      {/* Pulse animation styles */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}