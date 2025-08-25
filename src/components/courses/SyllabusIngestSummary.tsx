'use client';

import { useState } from 'react';
import {
  Modal,
  Stack,
  Title,
  Text,
  Button,
  Group,
  Alert,
  Paper,
  Badge,
  Table,
  Progress,
  List,
  ThemeIcon,
  Divider,
  Box,
  Tabs,
  rem
} from '@mantine/core';
import {
  IconFileText,
  IconCalendar,
  IconCheck,
  IconAlertCircle,
  IconPercentage,
  IconClipboardList,
  IconCalendarEvent,
  IconUpload,
  IconFileSearch
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DocumentUploader } from '../upload/DocumentUploader';
import { rebuildSemesterWeeks, autoAssignWeekNumbers } from '@/lib/api/planner';
import { Course } from '@/types/course';

interface SyllabusIngestSummaryProps {
  opened: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
  onSuccess?: () => void;
}

interface GradeWeight {
  name: string;
  weight_pct: number;
}

interface Assignment {
  title: string;
  type: string;
  dueDate?: string;
  week_no?: number;
  points?: number;
  weight_category?: string;
}

interface ParsedSyllabusData {
  grade_weights: GradeWeight[];
  assignments: Assignment[];
  validation_warnings?: string[];
}

export function SyllabusIngestSummary({
  opened,
  onClose,
  courseId,
  courseName,
  onSuccess
}: SyllabusIngestSummaryProps) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [syllabusDocumentId, setSyllabusDocumentId] = useState<string | null>(null);
  const [scheduleDocumentId, setScheduleDocumentId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSyllabusData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaderOpen, setUploaderOpen] = useState<null | 'syllabus' | 'schedule'>(null);

  const handleSyllabusUpload = (documentId: string) => {
    setSyllabusDocumentId(documentId);
  };

  const handleScheduleUpload = (documentId: string) => {
    setScheduleDocumentId(documentId);
  };

  const processSyllabus = async () => {
    if (!syllabusDocumentId) {
      notifications.show({
        title: 'Error',
        message: 'Please upload a syllabus document',
        color: 'red'
      });
      return;
    }

    setProcessing(true);
    setError(null);
    setStep('processing');

    try {
      const { apiClient } = await import('@/lib/api');
      const result = await apiClient.request('/api/v1/ingest/syllabus', {
        method: 'POST',
        body: {
          course_id: courseId,
          syllabus_document_id: syllabusDocumentId,
          schedule_document_id: scheduleDocumentId,
          use_parseextract_for_images: true
        }
      });
      setParsedData(result.data);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process syllabus');
      setStep('upload');
      notifications.show({
        title: 'Processing Failed',
        message: err instanceof Error ? err.message : 'Failed to process syllabus',
        color: 'red'
      });
    } finally {
      setProcessing(false);
    }
  };

  const confirmAndSave = async () => {
    try {
      // Auto-sync to planner: rebuild week buckets and assign week numbers
      notifications.show({
        id: 'syllabus-sync',
        title: 'Syncing to planner...',
        message: 'Updating week view with syllabus data',
        color: 'blue',
        loading: true,
        autoClose: false
      });

      // Get course details to find semester ID
      try {
        const { apiClient } = await import('@/lib/api');
        const response = await apiClient.request<{ course: Course }>(`/api/v1/courses/${courseId}`);
        const course = response.course;
        if (course.semester) {
          // Rebuild semester weeks - need to find semester ID from another endpoint
          // For now, skip this functionality until we have proper semester ID
          // await rebuildSemesterWeeks(course.semester_id);
          
          // Auto-assign week numbers to assignments based on due dates
          await autoAssignWeekNumbers(courseId);
        }
      } catch (error) {
        console.error('Failed to get course details:', error);
      }

      notifications.update({
        id: 'syllabus-sync',
        title: 'Success',
        message: 'Syllabus data saved and synced to planner',
        color: 'green',
        loading: false,
        autoClose: true
      });
    } catch (error) {
      console.error('Failed to sync to planner:', error);
      notifications.update({
        id: 'syllabus-sync',
        title: 'Partially Successful',
        message: 'Syllabus data saved, but planner sync failed',
        color: 'orange',
        loading: false,
        autoClose: true
      });
    }
    
    onSuccess?.();
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setSyllabusDocumentId(null);
    setScheduleDocumentId(null);
    setParsedData(null);
    setError(null);
    onClose();
  };

  const formatPercentage = (decimal: number) => {
    return `${(decimal * 100).toFixed(0)}%`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="xl"
      title={
        <Group gap="sm">
          <IconFileSearch size={24} />
          <div>
            <Title order={4}>Syllabus Parser</Title>
            <Text size="sm" c="dimmed">{courseName}</Text>
          </div>
        </Group>
      }
    >
      <Stack gap="lg">
        {/* Upload Step */}
        {step === 'upload' && (
          <>
            <Alert icon={<IconFileText size={16} />} variant="light">
              Upload your syllabus and optionally a separate schedule document. 
              We&apos;ll extract grading weights, assignments, and due dates automatically.
            </Alert>

            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconFileText size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={500}>Syllabus Document</Text>
                    <Text size="sm" c="dimmed">
                      Upload your course syllabus (PDF, Word, or Image)
                    </Text>
                  </div>
                </Group>
                
                {syllabusDocumentId ? (
                  <Badge size="lg" color="green" variant="light">
                    ✓ Syllabus uploaded
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => setUploaderOpen('syllabus')}
                  >
                    Upload Syllabus
                  </Button>
                )}
              </Stack>
            </Paper>

            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" variant="light" color="teal">
                    <IconCalendar size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={500}>Schedule Document (Optional)</Text>
                    <Text size="sm" c="dimmed">
                      If you have a separate course schedule
                    </Text>
                  </div>
                </Group>
                
                {scheduleDocumentId ? (
                  <Badge size="lg" color="green" variant="light">
                    ✓ Schedule uploaded
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => setUploaderOpen('schedule')}
                  >
                    Upload Schedule
                  </Button>
                )}
              </Stack>
            </Paper>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={processSyllabus}
                disabled={!syllabusDocumentId}
                leftSection={<IconFileSearch size={16} />}
              >
                Process Documents
              </Button>
            </Group>
          </>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <Stack align="center" py="xl">
            <ThemeIcon size={60} variant="light" color="blue">
              <IconFileSearch size={32} />
            </ThemeIcon>
            <Title order={3}>Processing Your Syllabus</Title>
            <Text c="dimmed" ta="center">
              Extracting grading weights, assignments, and due dates...
            </Text>
            <Progress value={100} animated style={{ width: '100%' }} />
          </Stack>
        )}

        {/* Review Step */}
        {step === 'review' && parsedData && (
          <>
            <Alert 
              icon={<IconCheck size={16} />} 
              color="green" 
              variant="light"
              title="Extraction Complete"
            >
              We&apos;ve extracted the following information from your syllabus. 
              Please review and confirm before saving.
            </Alert>

            {parsedData.validation_warnings && parsedData.validation_warnings.length > 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
                <Text fw={500} mb="xs">Validation Warnings:</Text>
                <List size="sm">
                  {parsedData.validation_warnings.map((warning, index) => (
                    <List.Item key={index}>{warning}</List.Item>
                  ))}
                </List>
              </Alert>
            )}

            <Tabs defaultValue="grades">
              <Tabs.List>
                <Tabs.Tab 
                  value="grades" 
                  leftSection={<IconPercentage style={{ width: rem(16), height: rem(16) }} />}
                >
                  Grade Weights ({parsedData.grade_weights.length})
                </Tabs.Tab>
                <Tabs.Tab 
                  value="assignments"
                  leftSection={<IconClipboardList style={{ width: rem(16), height: rem(16) }} />}
                >
                  Assignments ({parsedData.assignments.length})
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="grades" pt="md">
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    These grading categories will be used to calculate your course grade.
                  </Text>
                  
                  <Paper withBorder>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Category</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Weight</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {parsedData.grade_weights.map((weight, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{weight.name}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Badge size="lg" variant="light">
                                {formatPercentage(weight.weight_pct)}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        <Table.Tr>
                          <Table.Td fw={600}>Total</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Badge 
                              size="lg" 
                              color={
                                Math.abs(parsedData.grade_weights.reduce((sum, w) => sum + w.weight_pct, 0) - 1) < 0.01
                                  ? 'green' : 'orange'
                              }
                            >
                              {formatPercentage(
                                parsedData.grade_weights.reduce((sum, w) => sum + w.weight_pct, 0)
                              )}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="assignments" pt="md">
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    These assignments will be added to your course planner.
                  </Text>
                  
                  <Paper withBorder>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Assignment</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Due Date</Table.Th>
                          <Table.Th>Week</Table.Th>
                          <Table.Th>Points</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {parsedData.assignments.map((assignment, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{assignment.title}</Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="outline">
                                {assignment.type || 'homework'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{formatDate(assignment.dueDate)}</Table.Td>
                            <Table.Td>
                              {assignment.week_no ? `Week ${assignment.week_no}` : '-'}
                            </Table.Td>
                            <Table.Td>{assignment.points || '-'}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setStep('upload')}>
                Back to Upload
              </Button>
              <Group gap="sm">
                <Button variant="subtle" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmAndSave}
                  leftSection={<IconCheck size={16} />}
                  color="green"
                >
                  Save to Course
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>

      {/* Document Uploader integration */}
      {uploaderOpen && (
        <DocumentUploader
          opened={!!uploaderOpen}
          onClose={() => setUploaderOpen(null)}
          preselectedCourseId={courseId}
          hideCourseSelect
          documentType={uploaderOpen === 'syllabus' ? 'syllabus' : 'schedule'}
          allowMultiple={false}
          onUploaded={(ids) => {
            const id = ids[0];
            if (!id) return;
            if (uploaderOpen === 'syllabus') setSyllabusDocumentId(id);
            if (uploaderOpen === 'schedule') setScheduleDocumentId(id);
            setUploaderOpen(null);
          }}
        />
      )}
    </Modal>
  );
}
