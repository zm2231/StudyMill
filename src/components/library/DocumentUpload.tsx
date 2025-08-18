'use client';

import { useState } from 'react';
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
  TextInput
} from '@mantine/core';
import { 
  IconUpload,
  IconFile,
  IconCheck,
  IconAlertCircle,
  IconX
} from '@tabler/icons-react';
import { BetterUpload } from 'better-upload/react';
import { useApi } from '@/lib/api';

interface DocumentUploadProps {
  opened: boolean;
  onClose: () => void;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export function DocumentUpload({ opened, onClose }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [processingMode, setProcessingMode] = useState<string>('hybrid');
  const [customTags, setCustomTags] = useState('');
  const api = useApi();

  // Course options based on StudyMill's capabilities
  const courseOptions = [
    { value: 'computer-science', label: 'Computer Science' },
    { value: 'mathematics', label: 'Mathematics' },
    { value: 'biology', label: 'Biology' },
    { value: 'psychology', label: 'Psychology' },
    { value: 'economics', label: 'Economics' },
  ];

  const processingOptions = [
    { value: 'hybrid', label: 'Hybrid Processing (Recommended)' },
    { value: 'self-hosted', label: 'Self-hosted Processing' },
    { value: 'api', label: 'API Processing' },
  ];

  const handleFilesSelected = (selectedFiles: FileList) => {
    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      progress: 0,
      status: 'uploading'
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Start upload process for each file
    newFiles.forEach(uploadFile);
  };

  const uploadFile = async (uploadedFile: UploadedFile) => {
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
      }, 200);

      // Create form data for actual upload
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('processingMode', processingMode);
      if (selectedCourse) {
        formData.append('course', selectedCourse);
      }
      if (customTags) {
        formData.append('tags', customTags);
      }

      // For now, simulate upload (replace with actual API call when backend supports file upload)
      setTimeout(() => {
        clearInterval(progressInterval);
        
        // Simulate processing phase
        setFiles(prev => prev.map(f => 
          f.name === uploadedFile.name 
            ? { ...f, status: 'processing', progress: 100 }
            : f
        ));

        // Simulate completion
        setTimeout(() => {
          setFiles(prev => prev.map(f => 
            f.name === uploadedFile.name 
              ? { ...f, status: 'completed' }
              : f
          ));
        }, 2000);
      }, 2000);

    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.name === uploadedFile.name 
          ? { ...f, status: 'error', error: 'Upload failed' }
          : f
      ));
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
      case 'processing': return 'Processing document...';
      case 'completed': return 'Ready';
      case 'error': return 'Failed';
      default: return 'Unknown';
    }
  };

  const handleClose = () => {
    setFiles([]);
    setSelectedCourse(null);
    setCustomTags('');
    onClose();
  };

  return (
    <Modal 
      opened={opened} 
      onClose={handleClose}
      title="Upload Documents"
      size="lg"
      centered
    >
      <Stack gap="lg">
        {/* Upload Configuration */}
        <Box>
          <Title order={4} mb="sm">Upload Settings</Title>
          
          <Stack gap="md">
            <Select
              label="Course"
              placeholder="Select a course (optional)"
              data={courseOptions}
              value={selectedCourse}
              onChange={setSelectedCourse}
              searchable
              clearable
            />
            
            <Select
              label="Processing Mode"
              data={processingOptions}
              value={processingMode}
              onChange={(value) => setProcessingMode(value || 'hybrid')}
              description="Choose how documents should be processed"
            />
            
            <TextInput
              label="Additional Tags"
              placeholder="lecture, notes, chapter-1 (comma separated)"
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              description="Add custom tags to help organize your documents"
            />
          </Stack>
        </Box>

        {/* File Upload Area */}
        <Box>
          <Title order={4} mb="sm">Select Files</Title>
          
          <BetterUpload
            multiple
            accept=".pdf,.doc,.docx,.txt,.md"
            onFilesSelected={handleFilesSelected}
            maxFileSize={10 * 1024 * 1024} // 10MB
          >
            {({ getRootProps, getInputProps, isDragActive }) => (
              <Box
                {...getRootProps()}
                style={{
                  border: '2px dashed #e2e8f0',
                  borderRadius: 8,
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: isDragActive ? '#f8fafc' : '#ffffff',
                  borderColor: isDragActive ? '#3b82f6' : '#e2e8f0',
                  transition: 'all 0.2s ease'
                }}
              >
                <input {...getInputProps()} />
                
                <IconUpload size={48} color="#64748b" style={{ marginBottom: '1rem' }} />
                
                <Text size="lg" mb="xs" style={{ color: '#1e293b' }}>
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </Text>
                
                <Text size="sm" c="dimmed" mb="md">
                  or click to browse files
                </Text>
                
                <Text size="xs" c="dimmed">
                  Supports PDF, DOC, DOCX, TXT, MD files up to 10MB
                </Text>
              </Box>
            )}
          </BetterUpload>
        </Box>

        {/* File List */}
        {files.length > 0 && (
          <Box>
            <Title order={4} mb="sm">Uploading Files</Title>
            
            <Stack gap="sm">
              {files.map((file, index) => (
                <Box 
                  key={index}
                  p="md" 
                  style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  }}
                >
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <Group gap="sm">
                      <IconFile size={20} color="#64748b" />
                      <Box>
                        <Text size="sm" fw={500}>{file.name}</Text>
                        <Text size="xs" c="dimmed">
                          {formatFileSize(file.size)} • {getStatusText(file.status)}
                        </Text>
                      </Box>
                    </Group>
                    
                    {file.status !== 'uploading' && file.status !== 'processing' && (
                      <Button 
                        size="xs" 
                        variant="subtle" 
                        c="red" 
                        onClick={() => removeFile(file.name)}
                      >
                        <IconX size={14} />
                      </Button>
                    )}
                  </Group>
                  
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <Progress 
                      value={file.progress} 
                      color={getStatusColor(file.status)}
                      size="sm"
                      animated={file.status === 'processing'}
                    />
                  )}
                  
                  {file.status === 'completed' && (
                    <Alert icon={<IconCheck size={16} />} color="green" variant="light">
                      Document processed successfully and added to your library
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
        <Group justify="flex-end">
          <Button variant="outline" onClick={handleClose}>
            {files.some(f => f.status === 'uploading' || f.status === 'processing') ? 'Cancel' : 'Close'}
          </Button>
          
          {files.length > 0 && files.every(f => f.status === 'completed') && (
            <Button onClick={handleClose}>
              View Library
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}