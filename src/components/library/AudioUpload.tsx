'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Modal, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack,
  Box,
  Progress,
  Alert,
  Select,
  TextInput,
  ActionIcon,
  Center
} from '@mantine/core';
import { 
  IconMicrophone,
  IconUpload,
  IconMusic,
  IconCheck,
  IconAlertCircle,
  IconX,
  IconPlayerStop,
  IconPlayerRecord
} from '@tabler/icons-react';
// Using native HTML file input with drag-and-drop
import { useApi } from '@/lib/api';
import { useCoursesWithSWR } from '@/hooks/useCoursesWithSWR';

interface AudioUploadProps {
  opened: boolean;
  onClose: () => void;
  preselectedCourseId?: string;
}

interface UploadedAudio {
  name: string;
  size: number;
  type: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  duration?: number;
  transcription?: {
    topicCount: number;
    memoryCount: number;
  };
}

export function AudioUpload({ opened, onClose, preselectedCourseId }: AudioUploadProps) {
  const [files, setFiles] = useState<UploadedAudio[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(preselectedCourseId || null);
  const [customTags, setCustomTags] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const api = useApi();

  // Get courses from API - no more hardcoded options
  const { courses } = useCoursesWithSWR();
  
  // Transform courses to select options
  const courseOptions = courses.map(course => ({
    value: course.id,
    label: course.name
  }));

  // Update selected course when preselected course changes
  useEffect(() => {
    if (preselectedCourseId) {
      setSelectedCourse(preselectedCourseId);
    }
  }, [preselectedCourseId]);

  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles: UploadedAudio[] = Array.from(selectedFiles).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      progress: 0,
      status: 'uploading'
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Start upload process for each file
    newFiles.forEach(uploadAudioFile);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleFilesSelected(event.dataTransfer.files);
  };

  const uploadAudioFile = async (uploadedFile: UploadedAudio) => {
    try {
      // Update file status to uploading
      setFiles(prev => prev.map(f => 
        f.name === uploadedFile.name 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.name === uploadedFile.name && f.progress < 90) {
            return { ...f, progress: f.progress + 10 };
          }
          return f;
        }));
      }, 300);

      // Create form data for actual upload
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      if (selectedCourse) {
        formData.append('courseId', selectedCourse);
      }
      
      const options: any = {
        model: 'whisper-large-v3-turbo',
        language: 'en'
      };
      formData.append('options', JSON.stringify(options));

      // Call the actual audio upload API
      setTimeout(async () => {
        try {
          clearInterval(progressInterval);
          
          // Update to processing phase
          setFiles(prev => prev.map(f => 
            f.name === uploadedFile.name 
              ? { ...f, status: 'processing', progress: 100 }
              : f
          ));

          // Make the actual API call to /api/audio/upload
          const response = await api.uploadAudio(formData);
          
          if (response.success) {
            setFiles(prev => prev.map(f => 
              f.name === uploadedFile.name 
                ? { 
                    ...f, 
                    status: 'completed',
                    transcription: {
                      topicCount: response.transcription.topicCount,
                      memoryCount: response.memories.count
                    }
                  }
                : f
            ));
          } else {
            throw new Error('Upload failed');
          }

        } catch (error) {
          console.error('Audio upload error:', error);
          setFiles(prev => prev.map(f => 
            f.name === uploadedFile.name 
              ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Transcription failed' }
              : f
          ));
        }
      }, 500); // Reduced delay for better UX

    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.name === uploadedFile.name 
          ? { ...f, status: 'error', error: 'Upload failed' }
          : f
      ));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const fileName = `recording-${timestamp}.wav`;
        const file = new File([blob], fileName, { type: 'audio/wav' });
        
        // Add to files list and start upload
        const uploadedFile: UploadedAudio = {
          name: fileName,
          size: blob.size,
          type: 'audio/wav',
          file,
          progress: 0,
          status: 'uploading'
        };
        
        setFiles(prev => [...prev, uploadedFile]);
        uploadAudioFile(uploadedFile);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading': return 'blue';
      case 'processing': return 'yellow';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Transcribing audio...';
      case 'completed': return 'Transcription complete';
      case 'error': return 'Failed';
      default: return 'Unknown';
    }
  };

  const handleClose = () => {
    // Stop any ongoing recording
    if (isRecording) {
      stopRecording();
    }
    
    setFiles([]);
    setSelectedCourse(null);
    setCustomTags('');
    setRecordingTime(0);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Upload Audio"
      size="lg"
      radius="md"
      styles={{
        title: { fontSize: '1.25rem', fontWeight: 600 }
      }}
    >
      <Stack gap="lg">
        {/* Course and Tags Selection */}
        <Stack gap="md">
          <Select
            label="Course"
            placeholder="Select a course"
            data={courseOptions}
            value={selectedCourse}
            onChange={setSelectedCourse}
            searchable
            clearable
          />
          
          <TextInput
            label="Tags (Optional)"
            placeholder="lecture, discussion, lab-session"
            value={customTags}
            onChange={(e) => setCustomTags(e.target.value)}
            description="Add tags to organize your audio content"
          />
        </Stack>

        {/* Recording Section */}
        <Box>
          <Text fw={500} mb="md">Record Audio</Text>
          
          <Center>
            <Stack align="center" gap="md">
              <ActionIcon
                size={80}
                radius="xl"
                variant={isRecording ? "filled" : "outline"}
                color={isRecording ? "red" : "forestGreen"}
                onClick={isRecording ? stopRecording : startRecording}
                styles={{
                  root: {
                    border: isRecording ? undefined : '2px solid var(--mantine-color-forest-green-4)',
                    '&:hover': {
                      borderColor: isRecording ? undefined : 'var(--mantine-color-forest-green-5)',
                      backgroundColor: isRecording ? undefined : 'var(--mantine-color-forest-green-0)'
                    }
                  }
                }}
              >
                {isRecording ? (
                  <IconPlayerStop size={40} />
                ) : (
                  <IconPlayerRecord size={40} />
                )}
              </ActionIcon>
              
              <Text size="lg" fw={500}>
                {isRecording ? `Recording: ${formatTime(recordingTime)}` : 'Tap to start recording'}
              </Text>
              
              {isRecording && (
                <Text size="sm" c="dimmed">
                  Tap the button again to stop and upload
                </Text>
              )}
            </Stack>
          </Center>
        </Box>

        {/* File Upload Area */}
        <Box>
          <Text fw={500} mb="md">Or Upload Audio Files</Text>
          
          <Box
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('audio-file-input')?.click()}
            style={{
              border: '2px dashed var(--mantine-color-forest-green-4)',
              borderRadius: 8,
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: 'var(--mantine-color-forest-green-0)',
              transition: 'all 0.2s ease',
              minHeight: 120
            }}
            sx={{
              '&:hover': {
                borderColor: 'var(--mantine-color-forest-green-5)',
                backgroundColor: 'var(--mantine-color-forest-green-1)'
              }
            }}
          >
            <input
              id="audio-file-input"
              type="file"
              multiple
              accept=".mp3,.wav,.m4a,.flac,.ogg,.webm"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            
            <IconUpload size={48} style={{ color: 'var(--mantine-color-forest-green-6)', marginBottom: '1rem' }} />
            
            <Text size="lg" fw={500} mb="xs">
              Drop audio files here or click to browse
            </Text>
            
            <Text size="sm" c="dimmed">
              Supports MP3, WAV, M4A, FLAC, OGG, WebM files up to 100MB
            </Text>
          </Box>
        </Box>

        {/* File Queue */}
        {files.length > 0 && (
          <Box>
            <Text fw={500} mb="md">Upload Queue ({files.length} files)</Text>
            
            <Stack gap="sm">
              {files.map((file, index) => (
                <Box 
                  key={index}
                  p="md" 
                  withBorder
                  style={{ 
                    borderRadius: 8
                  }}
                >
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <Group gap="sm">
                      <IconMusic size={20} style={{ color: 'var(--mantine-color-gray-6)' }} />
                      <Box>
                        <Text size="sm" fw={500}>{file.name}</Text>
                        <Text size="xs" c="dimmed">
                          {formatFileSize(file.size)} • {getStatusText(file.status)}
                        </Text>
                      </Box>
                    </Group>
                    
                    {file.status !== 'uploading' && file.status !== 'processing' && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => removeFile(file.name)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                  
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <Progress 
                      value={file.progress} 
                      color="forest-green"
                      size="sm"
                      animated={file.status === 'processing'}
                    />
                  )}
                  
                  {file.status === 'completed' && file.transcription && (
                    <Alert icon={<IconCheck size={16} />} color="green" variant="light">
                      <Text size="sm">
                        Transcription complete! Created {file.transcription.memoryCount} memories 
                        across {file.transcription.topicCount} topics
                      </Text>
                    </Alert>
                  )}
                  
                  {file.status === 'error' && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                      {file.error || 'Upload failed'}
                    </Alert>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Actions */}
        <Group justify="space-between">
          <Group>
            {files.length > 0 && (
              <Button
                variant="light"
                onClick={() => setFiles([])}
                disabled={files.some(f => f.status === 'uploading' || f.status === 'processing') || isRecording}
              >
                Clear Queue
              </Button>
            )}
          </Group>

          <Group>
            <Button
              variant="light"
              onClick={handleClose}
            >
              {files.some(f => f.status === 'uploading' || f.status === 'processing') || isRecording ? 'Cancel' : 'Close'}
            </Button>
            
            {files.length > 0 && files.every(f => f.status === 'completed') && (
              <Button
                onClick={handleClose}
                color="forest-green"
              >
                Done
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}