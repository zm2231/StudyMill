'use client';

import { useState, useEffect, useRef } from 'react';
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
  Paper,
  rem,
  Center,
  Badge,
  ActionIcon,
  List,
  ThemeIcon
} from '@mantine/core';
import { 
  IconUpload,
  IconFile,
  IconCheck,
  IconAlertCircle,
  IconX,
  IconCloudUpload,
  IconFileText,
  IconTableOptions,
  IconPhoto,
  IconPdf
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useApi } from '@/lib/api';
import { useCoursesWithSWR } from '@/hooks/useCoursesWithSWR';

interface DocumentUploaderProps {
  opened: boolean;
  onClose: () => void;
  preselectedCourseId?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  allowMultiple?: boolean;
  maxFileSize?: number; // in MB
  acceptedFormats?: string[];
  hideCourseSelect?: boolean;
  documentType?: 'syllabus' | 'schedule' | 'unknown';
  onUploaded?: (documentIds: string[]) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  serverId?: string;
}

const DEFAULT_ACCEPTED_FORMATS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.pptx',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg'
];

const getFileIcon = (type: string) => {
  if (type.includes('pdf')) return <IconPdf size={20} />;
  if (type.includes('image')) return <IconPhoto size={20} />;
  if (type.includes('sheet') || type.includes('excel')) return <IconTableOptions size={20} />;
  if (type.includes('text') || type.includes('document')) return <IconFileText size={20} />;
  return <IconFile size={20} />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export function DocumentUploader({ 
  opened, 
  onClose, 
  preselectedCourseId,
  onSuccess,
  onError,
  allowMultiple = true,
  maxFileSize = 50, // 50MB default
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  hideCourseSelect = false,
  documentType = 'unknown',
  onUploaded
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(preselectedCourseId || null);
  const [processingMode, setProcessingMode] = useState<string>('hybrid');
  const [customTags, setCustomTags] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const api = useApi();

  // Get courses from API
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

  const processingOptions = [
    { value: 'hybrid', label: 'Hybrid Processing (Recommended)' },
    { value: 'self-hosted', label: 'Self-hosted Processing' },
    { value: 'api', label: 'API Processing (Premium)' },
  ];

  const validateFile = (file: File): string | null => {
    // Check file size
    const maxSizeInBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }

    // Check file format
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.some(format => fileExtension === format.toLowerCase())) {
      return `File format not supported. Accepted formats: ${acceptedFormats.join(', ')}`;
    }

    return null;
  };

  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    Array.from(selectedFiles).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        newFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          file,
          progress: 0,
          status: 'pending'
        });
      }
    });

    if (errors.length > 0) {
      errors.forEach(error => {
        notifications.show({
          title: 'File validation failed',
          message: error,
          color: 'red'
        });
      });
    }

    if (newFiles.length > 0) {
      setFiles(prev => allowMultiple ? [...prev, ...newFiles] : newFiles);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFilesSelected(event.dataTransfer.files);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFile = async (uploadFile: UploadedFile): Promise<string | null> => {
    // Update file status to uploading
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
    ));

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('courseId', selectedCourse || '');
      if (documentType) formData.append('documentType', documentType);
      if (customTags) {
        formData.append('tags', customTags);
      }

      // Simulate progress (replace with actual progress tracking)
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === uploadFile.id && f.progress < 90) {
            return { ...f, progress: f.progress + 10 };
          }
          return f;
        }));
      }, 200);

      // Upload file with idempotency key
      const { apiClient } = await import('@/lib/api');
      const idempotencyKey = `du_${uploadFile.id}`;
      const response = await apiClient.uploadFile('/api/v1/documents/upload', formData, {
        'Idempotency-Key': idempotencyKey
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const json = await response.json().catch(() => ({} as any));
        const serverId = json?.documentId || json?.document?.id || null;
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'completed', progress: 100, serverId } 
            : f
        ));
        return serverId;
      } else {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Upload failed');
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } 
          : f
      ));
      return null;
    }
  };

  const handleUpload = async () => {
    if (!selectedCourse) {
      notifications.show({
        title: 'Course required',
        message: 'Please select a course before uploading',
        color: 'orange'
      });
      return;
    }

    if (files.length === 0) {
      notifications.show({
        title: 'No files selected',
        message: 'Please select files to upload',
        color: 'orange'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload all pending files
      const pendingFiles = files.filter(f => f.status === 'pending');
      const ids = await Promise.all(pendingFiles.map(uploadFile));
      const uploadedIds = ids.filter((id): id is string => Boolean(id));

      // Determine current files state success
      const allSuccess = uploadedIds.length === pendingFiles.length;
      
      if (uploadedIds.length > 0) {
        onUploaded?.(uploadedIds);
      }
      
      if (allSuccess) {
        onSuccess?.();
        handleClose();
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Upload failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setSelectedCourse(preselectedCourseId || null);
    setProcessingMode('hybrid');
    setCustomTags('');
    onClose();
  };

  const hasErrors = files.some(f => f.status === 'error');
  const allCompleted = files.length > 0 && files.every(f => f.status === 'completed');

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Upload Documents"
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Course Selection */}
        {hideCourseSelect ? null : (
          <Select
            label="Select Course"
            placeholder="Choose a course"
            value={selectedCourse}
            onChange={setSelectedCourse}
            data={courseOptions}
            required
            searchable
          />
        )}

        {/* File Drop Zone */}
        <Paper
          p="xl"
          radius="md"
          withBorder
          style={{
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: isDragging ? 'var(--forest-green-primary)' : undefined,
            backgroundColor: isDragging ? 'var(--sanctuary-surface)' : undefined,
            cursor: 'pointer'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Center>
            <Stack align="center" gap="sm">
              <IconCloudUpload size={48} color="var(--forest-green-primary)" />
              <Text size="lg" fw={500}>
                Drop files here or click to browse
              </Text>
              <Text size="sm" c="dimmed">
                Supports: {acceptedFormats.join(', ')} (Max {maxFileSize}MB)
              </Text>
            </Stack>
          </Center>
        </Paper>

        <input
          ref={fileInputRef}
          type="file"
          multiple={allowMultiple}
          accept={acceptedFormats.join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* File List */}
        {files.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Selected Files ({files.length})</Text>
            {files.map(file => (
              <Paper key={file.id} p="sm" withBorder radius="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    {getFileIcon(file.type)}
                    <div>
                      <Text size="sm" fw={500}>{file.name}</Text>
                      <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
                    </div>
                  </Group>
                  
                  <Group gap="xs">
                    {file.status === 'pending' && (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => removeFile(file.id)}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    )}
                    {file.status === 'uploading' && (
                      <Badge size="sm" color="blue">Uploading...</Badge>
                    )}
                    {file.status === 'processing' && (
                      <Badge size="sm" color="orange">Processing...</Badge>
                    )}
                    {file.status === 'completed' && (
                      <ThemeIcon size="sm" color="green" variant="light">
                        <IconCheck size={14} />
                      </ThemeIcon>
                    )}
                    {file.status === 'error' && (
                      <Badge size="sm" color="red">{file.error}</Badge>
                    )}
                  </Group>
                </Group>
                
                {file.status === 'uploading' && (
                  <Progress
                    value={file.progress}
                    size="xs"
                    mt="xs"
                    color="var(--forest-green-primary)"
                  />
                )}
              </Paper>
            ))}
          </Stack>
        )}

        {/* Processing Options */}
        <Select
          label="Processing Mode"
          value={processingMode}
          onChange={(value) => setProcessingMode(value || 'hybrid')}
          data={processingOptions}
        />

        {/* Custom Tags */}
        <TextInput
          label="Tags (optional)"
          placeholder="Enter tags separated by commas"
          value={customTags}
          onChange={(e) => setCustomTags(e.currentTarget.value)}
        />

        {/* Error Alert */}
        {hasErrors && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            Some files failed to upload. Please try again.
          </Alert>
        )}

        {/* Success Alert */}
        {allCompleted && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            All files uploaded successfully!
          </Alert>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            loading={isUploading}
            disabled={files.length === 0 || !selectedCourse}
            leftSection={<IconUpload size={16} />}
          >
            Upload {files.length > 0 && `(${files.length})`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}