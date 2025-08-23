'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Group,
  Text,
  ActionIcon,
  Button,
  Progress,
  Badge,
  Stack,
  Select,
  TextInput,
  Modal,
  Tooltip,
  rem
} from '@mantine/core';
import {
  IconMicrophone,
  IconPlayerStop,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
  IconMaximize,
  IconMinus,
  IconUpload,
  IconCheck,
  IconAlertTriangle
} from '@tabler/icons-react';
import { useAudioRecordingStore } from '@/store/useAudioRecordingStore';
import { useCoursesWithSWR } from '@/hooks/useCoursesWithSWR';
import { notifications } from '@mantine/notifications';

interface PersistentAudioRecorderProps {
  onClose?: () => void;
}

export function PersistentAudioRecorder({ onClose }: PersistentAudioRecorderProps) {
  const {
    status,
    duration,
    fileName,
    courseId,
    courseName,
    error,
    uploadProgress,
    isMinimized,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    minimize,
    maximize,
    reset
  } = useAudioRecordingStore();

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [recordingTitle, setRecordingTitle] = useState('');
  
  const { data: courses = [] } = useCoursesWithSWR();

  // Auto-show setup modal when first opening
  useEffect(() => {
    if (status === 'idle' && !showSetupModal) {
      setShowSetupModal(true);
    }
  }, [status, showSetupModal]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    const courseData = courses.find(c => c.id === selectedCourseId);
    await startRecording(selectedCourseId, courseData?.name);
    setShowSetupModal(false);
    
    notifications.show({
      title: 'Recording Started',
      message: 'Audio recording in progress. It will continue across page navigation.',
      color: 'green',
      autoClose: 3000
    });
  };

  const handleStopRecording = async () => {
    await stopRecording();
    
    notifications.show({
      title: 'Recording Stopped',
      message: 'Processing and uploading your recording...',
      color: 'blue',
      autoClose: 2000
    });
  };

  const getStatusColor = () => {
    switch (status) {
      case 'recording': return 'red';
      case 'paused': return 'orange';
      case 'uploading': return 'blue';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'recording': return 'Recording';
      case 'paused': return 'Paused';
      case 'stopping': return 'Stopping';
      case 'uploading': return 'Uploading';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return 'Ready';
    }
  };

  // Don't render if idle and no setup needed
  if (status === 'idle' && !showSetupModal) {
    return null;
  }

  // Minimized view
  if (isMinimized && status !== 'idle') {
    return (
      <Paper
        withBorder
        p="sm"
        style={{
          position: 'fixed',
          bottom: rem(20),
          right: rem(20),
          zIndex: 1000,
          minWidth: rem(200),
          backgroundColor: 'var(--mantine-color-body)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <ActionIcon
              color={getStatusColor()}
              variant="light"
              size="sm"
            >
              <IconMicrophone size={14} />
            </ActionIcon>
            <div>
              <Text size="xs" fw={500}>{formatDuration(duration)}</Text>
              <Text size="xs" c="dimmed">{getStatusText()}</Text>
            </div>
          </Group>
          
          <Group gap={4}>
            {status === 'recording' && (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={pauseRecording}
                title="Pause"
              >
                <IconPlayerPause size={12} />
              </ActionIcon>
            )}
            
            {status === 'paused' && (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={resumeRecording}
                title="Resume"
              >
                <IconPlayerPlay size={12} />
              </ActionIcon>
            )}
            
            {(status === 'recording' || status === 'paused') && (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleStopRecording}
                title="Stop"
              >
                <IconPlayerStop size={12} />
              </ActionIcon>
            )}
            
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={maximize}
              title="Expand"
            >
              <IconMaximize size={12} />
            </ActionIcon>
          </Group>
        </Group>
        
        {status === 'uploading' && (
          <Progress
            value={uploadProgress}
            size="xs"
            mt="xs"
            color="blue"
          />
        )}
      </Paper>
    );
  }

  // Full view when active
  if (status !== 'idle') {
    return (
      <Paper
        withBorder
        p="lg"
        style={{
          position: 'fixed',
          bottom: rem(20),
          right: rem(20),
          zIndex: 1000,
          minWidth: rem(350),
          backgroundColor: 'var(--mantine-color-body)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
      >
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="xs">
              <ActionIcon
                color={getStatusColor()}
                variant="light"
                size="lg"
                style={{
                  animation: status === 'recording' ? 'pulse 1.5s ease-in-out infinite' : undefined
                }}
              >
                <IconMicrophone size={20} />
              </ActionIcon>
              <div>
                <Text fw={500}>Audio Recording</Text>
                <Text size="sm" c="dimmed">
                  {courseName || 'No course selected'}
                </Text>
              </div>
            </Group>
            
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                onClick={minimize}
                title="Minimize"
              >
                <IconMinus size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  cancelRecording();
                  onClose?.();
                }}
                title="Close"
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {/* Status and Duration */}
          <div>
            <Group justify="space-between" mb="xs">
              <Badge color={getStatusColor()} variant="light">
                {getStatusText()}
              </Badge>
              <Text 
                size="xl" 
                fw={700} 
                style={{ 
                  fontFamily: 'monospace',
                  color: status === 'recording' ? 'var(--mantine-color-red-6)' : undefined
                }}
              >
                {formatDuration(duration)}
              </Text>
            </Group>

            {error && (
              <Group gap="xs" mb="xs">
                <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                <Text size="sm" c="red">
                  {error}
                </Text>
              </Group>
            )}
            
            {status === 'uploading' && (
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Uploading...</Text>
                  <Text size="sm" c="dimmed">{uploadProgress}%</Text>
                </Group>
                <Progress value={uploadProgress} color="blue" size="sm" />
              </div>
            )}
            
            {status === 'completed' && (
              <Group gap="xs">
                <IconCheck size={16} color="var(--mantine-color-green-6)" />
                <Text size="sm" c="green">
                  Recording uploaded successfully!
                </Text>
              </Group>
            )}
          </div>

          {/* Controls */}
          <Group justify="center" gap="md">
            {status === 'recording' && (
              <>
                <Button
                  variant="light"
                  color="orange"
                  leftSection={<IconPlayerPause size={16} />}
                  onClick={pauseRecording}
                >
                  Pause
                </Button>
                <Button
                  color="red"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={handleStopRecording}
                >
                  Stop & Upload
                </Button>
              </>
            )}
            
            {status === 'paused' && (
              <>
                <Button
                  color="green"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={resumeRecording}
                >
                  Resume
                </Button>
                <Button
                  color="red"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={handleStopRecording}
                >
                  Stop & Upload
                </Button>
              </>
            )}
            
            {(status === 'error' || status === 'completed') && (
              <Button
                variant="light"
                onClick={() => {
                  reset();
                  onClose?.();
                }}
              >
                Close
              </Button>
            )}
          </Group>
        </Stack>
        
        {/* Pulse animation for recording state */}
        <style jsx>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>
      </Paper>
    );
  }

  // Setup modal
  return (
    <Modal
      opened={showSetupModal}
      onClose={() => {
        setShowSetupModal(false);
        onClose?.();
      }}
      title="Start Audio Recording"
      centered
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Configure your recording settings. The recording will persist across page navigation.
        </Text>
        
        <Select
          label="Course (Optional)"
          placeholder="Select a course"
          data={courses.map(course => ({
            value: course.id,
            label: course.name
          }))}
          value={selectedCourseId}
          onChange={setSelectedCourseId}
          clearable
        />
        
        <TextInput
          label="Recording Title (Optional)"
          placeholder="e.g., Lecture 5 - Machine Learning"
          value={recordingTitle}
          onChange={(e) => setRecordingTitle(e.target.value)}
        />
        
        <Group justify="flex-end" mt="md">
          <Button
            variant="light"
            onClick={() => {
              setShowSetupModal(false);
              onClose?.();
            }}
          >
            Cancel
          </Button>
          <Button
            color="red"
            leftSection={<IconMicrophone size={16} />}
            onClick={handleStartRecording}
          >
            Start Recording
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}