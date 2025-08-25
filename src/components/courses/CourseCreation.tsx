'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Title,
  Text,
  Button,
  Group,
  Stack,
  TextInput,
  NumberInput,
  Textarea,
  ColorInput,
  Select,
  Checkbox,
  Grid,
  Card,
  Badge,
  ActionIcon,
  Divider,
  Alert
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconSchool
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { useCourses, CreateCourseData } from '@/hooks/useCourses';
import { Course, CourseScheduleTime, CourseSemester } from '@/types/course';
import { SemesterPicker } from './SemesterPicker';
import Link from 'next/link';

interface CourseFormData {
  name: string;
  code: string;
  color: string;
  description: string;
  instructor: string;
  credits: number;
  schedule: CourseScheduleTime[];
  semester_id: string;
  semester: CourseSemester;
}

interface CourseCreationProps {
  opened: boolean;
  onClose: () => void;
  editMode?: boolean;
  initialData?: Course; // For edit functionality
  onSuccess?: () => void; // Called after successful course creation
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#84cc16', '#eab308', 
  '#10b981', '#f97316', '#ef4444', '#06b6d4',
  '#8b5cf6', '#f59e0b', '#14b8a6', '#f43f5e'
];

const COMMON_SEMESTERS = [
  'Fall 2025',
  'Spring 2026',
  'Summer 2026', 
  'Fall 2026',
  'Spring 2027',
  'Summer 2027',
  'Fall 2027'
];

export function CourseCreation({ opened, onClose, editMode, initialData, onSuccess }: CourseCreationProps) {
  const { createCourse, updateCourse, loading } = useCourses();
  
  // Form state - extended to include semester_id
  const [formData, setFormData] = useState<CourseFormData>({
    name: initialData?.name || '',
    code: initialData?.code || '',
    color: initialData?.color || PRESET_COLORS[0],
    description: initialData?.description || '',
    instructor: initialData?.instructor || '',
    credits: initialData?.credits || 3,
    schedule: (initialData as any)?.schedule || [],
    semester_id: (initialData as any)?.semester_id || '',
    semester: (initialData as any)?.semester || {
      startDate: '',
      endDate: '',
      name: 'Fall 2025'
    }
  });

  const [scheduleForm, setScheduleForm] = useState<CourseScheduleTime>({
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '10:30',
    location: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If edit data changes while modal is mounted, sync it into the form
  useEffect(() => {
    if (editMode && initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name ?? prev.name,
        code: initialData.code ?? prev.code,
        color: initialData.color ?? prev.color,
        description: initialData.description ?? prev.description,
        instructor: initialData.instructor ?? prev.instructor,
        credits: (initialData as any).credits ?? prev.credits,
        schedule: (initialData as any).schedule ?? prev.schedule,
        semester_id: (initialData as any).semester_id ?? prev.semester_id,
        semester: (initialData as any).semester ?? prev.semester,
      }));
    }
  }, [editMode, initialData]);

  const handleAddScheduleSlot = () => {
    // Validate schedule slot
    if (scheduleForm.startTime >= scheduleForm.endTime) {
      setError('End time must be after start time');
      return;
    }

    // Check for conflicts
    const conflict = formData.schedule.find(slot => 
      slot.dayOfWeek === scheduleForm.dayOfWeek &&
      ((scheduleForm.startTime >= slot.startTime && scheduleForm.startTime < slot.endTime) ||
       (scheduleForm.endTime > slot.startTime && scheduleForm.endTime <= slot.endTime) ||
       (scheduleForm.startTime <= slot.startTime && scheduleForm.endTime >= slot.endTime))
    );

    if (conflict) {
      setError('Schedule conflict detected for this day');
      return;
    }

    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { ...scheduleForm }]
    }));

    // Reset form
    setScheduleForm(prev => ({
      ...prev,
      startTime: '09:00',
      endTime: '10:30',
      location: ''
    }));
    setError(null);
  };

  const removeScheduleSlot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    
    // Validation
    if (!formData.name.trim()) {
      setError('Course name is required');
      return;
    }

    // Note: Schedule is optional during course creation - can be added later

    if (!formData.semester_id) {
      setError('Please select a semester');
      return;
    }

    try {
      if (editMode && initialData) {
        await updateCourse(initialData.id, formData);
      } else {
        await createCourse(formData);
      }
      
      setSuccess(true);
      onSuccess?.(); // Notify parent of successful creation
      setTimeout(() => {
        setSuccess(false);
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course');
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      name: '',
      code: '',
      color: PRESET_COLORS[0],
      description: '',
      instructor: '',
      credits: 3,
      schedule: [],
      semester: {
        startDate: '',
        endDate: '',
        name: 'Fall 2025'
      }
    });
    setScheduleForm({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      location: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    setError(null);
    setSuccess(false);
    onClose();
  };

  const formatScheduleDisplay = (slot: CourseScheduleTime) => {
    const dayName = DAYS_OF_WEEK.find(d => d.value === slot.dayOfWeek)?.label;
    return `${dayName} ${slot.startTime}-${slot.endTime}${slot.location ? ` at ${slot.location}` : ''}`;
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={editMode ? "Edit Course" : "Create Course (Manual)"}
      size="lg"
      radius="md"
      centered
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3
      }}
      styles={{
        title: { fontSize: '1.25rem', fontWeight: 600 },
        content: {
          maxHeight: '90vh',
          overflow: 'hidden'
        },
        body: {
          maxHeight: 'calc(90vh - 60px)',
          overflow: 'auto',
          paddingRight: '6px',
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f3f4',
            borderRadius: '3px'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c8cd',
            borderRadius: '3px',
            '&:hover': {
              background: '#a8b3ba'
            }
          }
        }
      }}
      trapFocus={false}
      closeOnEscape
      withCloseButton
      zIndex={1000}
    >
      <Stack gap="lg">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {success && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            Course {editMode ? 'updated' : 'created'} successfully!
          </Alert>
        )}

        {/* Quick path: Create via CRN for UGA */}
        <Alert variant="light">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={600}>Add by CRN (UGA)</Text>
              <Text size="sm" c="dimmed">Quickly create a course by entering a term and CRN, then upload your syllabus.</Text>
            </div>
            <Button component={Link} href="/courses/new/crn" variant="light" color="red">
              Use CRN Onboarding
            </Button>
          </Group>
        </Alert>

        {/* Basic Information */}
        <Stack gap="md">
          <Text fw={500}>Manual Course Information</Text>
          
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Course Name"
                placeholder="Introduction to Computer Science"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Course Code"
                placeholder="CS 101"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Instructor"
                placeholder="Dr. Smith"
                value={formData.instructor}
                onChange={(e) => setFormData(prev => ({ ...prev, instructor: e.target.value }))}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label="Credits"
                min={1}
                max={6}
                value={formData.credits}
                onChange={(value) => setFormData(prev => ({ ...prev, credits: typeof value === 'number' && value > 0 ? value : 3 }))}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <ColorInput
                label="Course Color"
                value={formData.color}
                onChange={(color) => setFormData(prev => ({ ...prev, color }))}
                swatches={PRESET_COLORS}
                popoverProps={{
                  withinPortal: true,
                  zIndex: 9999
                }}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Description"
            placeholder="Brief description of the course..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
          />
        </Stack>

        <Divider />

        {/* Semester Information */}
        <Stack gap="md">
          <Text fw={500}>Semester Details</Text>
          
          <SemesterPicker
            value={formData.semester_id}
            onChange={(value) => setFormData(prev => ({ ...prev, semester_id: value }))}
            required
          />
        </Stack>

        <Divider />

        {/* Schedule Setup */}
        <Stack gap="md">
          <Text fw={500}>Class Schedule</Text>

          {/* Add Schedule Form */}
          <Grid>
            <Grid.Col span={3}>
              <Select
                label="Day"
                data={DAYS_OF_WEEK.map(d => ({ value: d.value.toString(), label: d.label }))}
                value={scheduleForm.dayOfWeek.toString()}
                onChange={(value) => setScheduleForm(prev => ({ 
                  ...prev, 
                  dayOfWeek: parseInt(value || '1')
                }))}
                comboboxProps={{
                  withinPortal: true,
                  zIndex: 9999
                }}
              />
            </Grid.Col>
            <Grid.Col span={2.5}>
              <TextInput
                label="Start Time"
                type="time"
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm(prev => ({ 
                  ...prev, 
                  startTime: e.target.value 
                }))}
              />
            </Grid.Col>
            <Grid.Col span={2.5}>
              <TextInput
                label="End Time"
                type="time"
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm(prev => ({ 
                  ...prev, 
                  endTime: e.target.value 
                }))}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Location"
                placeholder="Room 101"
                value={scheduleForm.location}
                onChange={(e) => setScheduleForm(prev => ({ 
                  ...prev, 
                  location: e.target.value 
                }))}
                leftSection={<IconMapPin size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={1}>
              <Button
                onClick={handleAddScheduleSlot}
                variant="light"
                color="forestGreen"
                size="sm"
                styles={{
                  root: { marginTop: 'auto' }
                }}
              >
                <IconPlus size={16} />
              </Button>
            </Grid.Col>
          </Grid>

          {/* Current Schedule List */}
          {formData.schedule.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>Current Schedule:</Text>
              {formData.schedule.map((slot, index) => (
                <Group key={index} justify="space-between" p="sm" withBorder style={{ 
                  backgroundColor: 'var(--mantine-color-gray-0)',
                  borderRadius: 6
                }}>
                  <Text size="sm">{formatScheduleDisplay(slot)}</Text>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => removeScheduleSlot(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>

        {/* Actions */}
        <Group justify="space-between">
          <Group></Group>
          <Group>
            <Button variant="light" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              variant="filled"
              onClick={handleSubmit}
              loading={loading}
              disabled={success}
              color="forestGreen"
            >
              {editMode ? 'Update Course' : 'Create Course'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}