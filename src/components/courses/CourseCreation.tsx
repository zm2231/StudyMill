'use client';

import { useState } from 'react';
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
import { CourseScheduleTime, CourseSemester } from '@/types/course';

interface CourseCreationProps {
  opened: boolean;
  onClose: () => void;
  editingCourse?: any; // For future edit functionality
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
  'Spring 2025',
  'Summer 2025', 
  'Fall 2025',
  'Winter 2025',
  'Spring 2026'
];

export function CourseCreation({ opened, onClose, editingCourse }: CourseCreationProps) {
  const { createCourse, updateCourse, loading } = useCourses();
  
  // Form state
  const [formData, setFormData] = useState<CreateCourseData>({
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
      name: 'Spring 2025'
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

    if (formData.schedule.length === 0) {
      setError('At least one class schedule is required');
      return;
    }

    if (!formData.semester.startDate || !formData.semester.endDate) {
      setError('Semester start and end dates are required');
      return;
    }

    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, formData);
      } else {
        await createCourse(formData);
      }
      
      setSuccess(true);
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
        name: 'Spring 2025'
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
      title={editingCourse ? "Edit Course" : "Create New Course"}
      size="lg"
      centered
    >
      <Stack gap="lg">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {success && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            Course {editingCourse ? 'updated' : 'created'} successfully!
          </Alert>
        )}

        {/* Basic Information */}
        <Card p="md" withBorder>
          <Title order={4} mb="md" size="h5">
            <Group gap="xs">
              <IconSchool size={18} />
              Course Information
            </Group>
          </Title>

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

          <Grid mt="sm">
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
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Description"
            placeholder="Brief description of the course..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            mt="sm"
            rows={2}
          />
        </Card>

        {/* Semester Information */}
        <Card p="md" withBorder>
          <Title order={4} mb="md" size="h5">
            <Group gap="xs">
              <IconCalendar size={18} />
              Semester Details
            </Group>
          </Title>

          <Grid>
            <Grid.Col span={4}>
              <Select
                label="Semester"
                data={COMMON_SEMESTERS}
                value={formData.semester.name}
                onChange={(value) => setFormData(prev => ({
                  ...prev,
                  semester: { ...prev.semester, name: value || 'Spring 2025' }
                }))}
                searchable
                clearable={false}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="Start Date"
                placeholder="Select start date"
                value={formData.semester.startDate ? new Date(`${formData.semester.startDate}T00:00:00`) : null}
                onChange={(date) => setFormData(prev => ({
                  ...prev,
                  semester: { 
                    ...prev.semester, 
                    startDate: (date instanceof Date && !isNaN(date.getTime())) ? date.toISOString().split('T')[0] : ''
                  }
                }))}
                required
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="End Date"
                placeholder="Select end date"
                value={formData.semester.endDate ? new Date(`${formData.semester.endDate}T00:00:00`) : null}
                onChange={(date) => setFormData(prev => ({
                  ...prev,
                  semester: { 
                    ...prev.semester, 
                    endDate: (date instanceof Date && !isNaN(date.getTime())) ? date.toISOString().split('T')[0] : ''
                  }
                }))}
                required
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Schedule Setup */}
        <Card p="md" withBorder>
          <Title order={4} mb="md" size="h5">
            <Group gap="xs">
              <IconClock size={18} />
              Class Schedule
            </Group>
          </Title>

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
                mt="auto"
                onClick={handleAddScheduleSlot}
                variant="light"
                size="sm"
              >
                <IconPlus size={16} />
              </Button>
            </Grid.Col>
          </Grid>

          {/* Current Schedule List */}
          {formData.schedule.length > 0 && (
            <>
              <Divider my="md" />
              <Text size="sm" fw={500} mb="xs">Current Schedule:</Text>
              <Stack gap="xs">
                {formData.schedule.map((slot, index) => (
                  <Group key={index} justify="space-between" p="xs" style={{ 
                    backgroundColor: formData.color + '10', 
                    borderRadius: 6,
                    border: `1px solid ${formData.color}30`
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
            </>
          )}
        </Card>

        {/* Actions */}
        <Group justify="flex-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            loading={loading}
            disabled={success}
          >
            {editingCourse ? 'Update Course' : 'Create Course'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}