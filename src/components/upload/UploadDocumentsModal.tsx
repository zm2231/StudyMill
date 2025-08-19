'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Select,
  MultiSelect,
  Switch,
  Paper,
  Progress,
  Alert,
  ActionIcon,
  List,
  Badge,
  Divider,
  Box
} from '@mantine/core';
import {
  Dropzone,
  DropzoneProps,
  FileWithPath,
  MIME_TYPES
} from '@mantine/dropzone';
import {
  IconUpload,
  IconFile,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconFileTypePdf,
  IconPresentation,
  IconFileText,
  IconMicrophone,
  IconNotes,
  IconLoader
} from '@tabler/icons-react';
import { useApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { notifications } from '@mantine/notifications';

interface UploadFile {
  id: string;
  file: FileWithPath;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

interface UploadDocumentsModalProps {
  opened: boolean;
  onClose: () => void;
  courseId?: string;
  onUploadComplete?: (documentIds: string[]) => void;
}

const supportedTypes = [
  MIME_TYPES.pdf,
  MIME_TYPES.docx,
  MIME_TYPES.pptx,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'text/plain'
];

const tagOptions = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'homework', label: 'Homework' },
  { value: 'exam', label: 'Exam' },
  { value: 'lab', label: 'Lab' },
  { value: 'project', label: 'Project' },
  { value: 'notes', label: 'Notes' },
  { value: 'reference', label: 'Reference' }
];

function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf': return IconFileTypePdf;
    case 'pptx': return IconPresentation;
    case 'docx': 
    case 'doc': return IconFileText;
    case 'mp3':
    case 'wav':
    case 'm4a': return IconMicrophone;
    case 'txt':
    case 'md': return IconNotes;
    default: return IconFile;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function UploadDocumentsModal({
  opened,
  onClose,
  courseId: defaultCourseId,
  onUploadComplete
}: UploadDocumentsModalProps) {
  const api = useApi();
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [courseId, setCourseId] = useState<string>(defaultCourseId || '');
  const [tags, setTags] = useState<string[]>([]);
  const [advancedProcessing, setAdvancedProcessing] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const abortControllerRef = useRef<AbortController>();

  // Load courses on mount
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const response = await api.getCourses();
        if (response.success) {
          setCourses(response.courses);
          if (!courseId && response.courses.length > 0) {
            setCourseId(response.courses[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load courses:', error);
      }
    };
    if (opened) {
      loadCourses();
    }
  }, [opened, api, courseId]);

  const handleDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      progress: 0
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const startUpload = async () => {
    if (!courseId) {
      notifications.show({
        title: 'Course Required',
        message: 'Please select a course for your documents',
        color: 'red'
      });
      return;
    }

    if (files.length === 0) {
      notifications.show({
        title: 'No Files',
        message: 'Please add some files to upload',
        color: 'red'
      });
      return;
    }

    setUploading(true);
    abortControllerRef.current = new AbortController();
    const completedDocumentIds: string[] = [];

    try {
      // Upload files sequentially to avoid overwhelming the server
      for (const uploadFile of files) {
        if (uploadFile.status !== 'queued') continue;

        // Update file status to uploading
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'uploading' as const, progress: 0 }
            : f
        ));

        try {
          const formData = new FormData();
          formData.append('file', uploadFile.file);
          formData.append('courseId', courseId);
          if (tags.length > 0) {
            formData.append('tags', JSON.stringify(tags));
          }
          if (advancedProcessing) {
            formData.append('processingMode', 'premium');
          }

          // Start upload with progress tracking
          const response = await api.uploadDocument(formData);

          if (response.success) {
            // Mark as completed
            setFiles(prev => prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, status: 'completed' as const, progress: 100, documentId: response.documentId }
                : f
            ));

            if (response.documentId) {
              completedDocumentIds.push(response.documentId);
            }
          } else {
            throw new Error(response.error || 'Upload failed');
          }
        } catch (error: any) {
          console.error('Upload failed for file:', uploadFile.file.name, error);
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'error' as const, error: error.message }
              : f
          ));
        }
      }

      // Show success notification
      notifications.show({
        title: 'Upload Complete',
        message: `Successfully uploaded ${completedDocumentIds.length} documents`,
        color: 'green'
      });

      // Call completion callback
      if (completedDocumentIds.length > 0 && onUploadComplete) {
        onUploadComplete(completedDocumentIds);
      }

    } catch (error: any) {
      console.error('Upload process failed:', error);
      notifications.show({
        title: 'Upload Failed',
        message: error.message || 'Failed to upload documents',
        color: 'red'
      });
    } finally {
      setUploading(false);
      abortControllerRef.current = undefined;
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setFiles([]);
  };

  const closeModal = () => {
    if (uploading) {
      cancelUpload();
    }
    setFiles([]);
    setTags([]);
    onClose();
  };

  const allCompleted = files.length > 0 && files.every(f => f.status === 'completed');
  const hasErrors = files.some(f => f.status === 'error');

  return (
    <Modal
      opened={opened}
      onClose={closeModal}
      title="Upload Documents"
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
            data={courses.map(course => ({
              value: course.id,
              label: course.name
            }))}
            value={courseId}
            onChange={(value) => setCourseId(value || '')}
            required
            disabled={uploading}
          />

          <MultiSelect
            label="Tags (Optional)"
            placeholder="Add tags to organize your documents"
            data={tagOptions}
            value={tags}
            onChange={setTags}
            disabled={uploading}
            clearable
            searchable
          />

          <Switch
            label="Advanced Processing"
            description="Use premium AI processing for better results (may incur additional costs)"
            checked={advancedProcessing}
            onChange={(event) => setAdvancedProcessing(event.currentTarget.checked)}
            disabled={uploading}
          />
        </Stack>

        <Divider />

        {/* Dropzone */}
        {files.length === 0 && !uploading && (
          <Dropzone
            onDrop={handleDrop}
            accept={supportedTypes}
            multiple
            disabled={uploading}
            styles={{
              root: { 
                minHeight: 160,
                borderColor: 'var(--mantine-color-forest-green-4)',
                '&:hover': {
                  borderColor: 'var(--mantine-color-forest-green-5)',
                  backgroundColor: 'var(--mantine-color-forest-green-0)'
                }
              }
            }}
          >
            <Stack align="center" gap="sm" py="xl">
              <IconUpload size={48} style={{ color: 'var(--mantine-color-forest-green-6)' }} />
              <Text size="lg" fw={500}>
                Drop documents here or click to browse
              </Text>
              <Text size="sm" c="dimmed">
                Supports PDF, DOCX, PPTX, audio files, and text files
              </Text>
            </Stack>
          </Dropzone>
        )}

        {/* File Queue */}
        {files.length > 0 && (
          <Paper p="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={500}>Upload Queue ({files.length} files)</Text>
                {!uploading && (
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={() => setFiles([])}
                  >
                    Clear All
                  </Button>
                )}
              </Group>

              <List spacing={0}>
                {files.map((uploadFile) => {
                  const FileIcon = getFileIcon(uploadFile.file.name);
                  return (
                    <List.Item key={uploadFile.id} p={0}>
                      <Paper p="sm" style={{ height: 40 }}>
                        <Group justify="space-between" align="center" h="100%">
                          <Group gap="sm" style={{ flex: 1 }}>
                            <FileIcon size={20} style={{ color: 'var(--mantine-color-gray-6)' }} />
                            <Box style={{ flex: 1 }}>
                              <Group gap="xs" align="center">
                                <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                                  {uploadFile.file.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {formatFileSize(uploadFile.file.size)}
                                </Text>
                              </Group>
                              {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                                <Progress value={uploadFile.progress} size="xs" mt={4} color="forest-green" />
                              )}
                              {uploadFile.error && (
                                <Text size="xs" c="red" mt={2}>
                                  {uploadFile.error}
                                </Text>
                              )}
                            </Box>
                          </Group>

                          <Group gap="xs">
                            {uploadFile.status === 'completed' && (
                              <Badge color="green" variant="light" size="sm">
                                <IconCheck size={12} />
                              </Badge>
                            )}
                            {uploadFile.status === 'error' && (
                              <Badge color="red" variant="light" size="sm">
                                <IconAlertTriangle size={12} />
                              </Badge>
                            )}
                            {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                              <Badge color="blue" variant="light" size="sm">
                                <IconLoader size={12} />
                              </Badge>
                            )}
                            {uploadFile.status === 'queued' && !uploading && (
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => removeFile(uploadFile.id)}
                              >
                                <IconX size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    </List.Item>
                  );
                })}
              </List>
            </Stack>
          </Paper>
        )}

        {/* Success Summary */}
        {allCompleted && (
          <Alert
            icon={<IconCheck size={16} />}
            title="Upload Successful!"
            color="green"
            variant="light"
          >
            All documents have been uploaded successfully. They will be processed and available in your library shortly.
          </Alert>
        )}

        {/* Error Summary */}
        {hasErrors && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Some uploads failed"
            color="red"
            variant="light"
          >
            Some files couldn't be uploaded. Please check the errors above and try again.
          </Alert>
        )}

        {/* Actions */}
        <Group justify="space-between">
          <Group>
            {!uploading && files.length > 0 && (
              <Button
                variant="light"
                onClick={() => setFiles([])}
                disabled={uploading}
              >
                Clear Queue
              </Button>
            )}
          </Group>

          <Group>
            <Button
              variant="light"
              onClick={closeModal}
              disabled={uploading}
            >
              {allCompleted ? 'Done' : 'Cancel'}
            </Button>
            
            {!allCompleted && (
              <Button
                onClick={uploading ? cancelUpload : startUpload}
                disabled={files.length === 0 || !courseId}
                color={uploading ? 'red' : 'forest-green'}
                loading={uploading}
              >
                {uploading ? 'Cancel Upload' : `Upload ${files.length} Files`}
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}