'use client';

import { useState, useEffect } from 'react';
import { Select, Button, Group, Modal, TextInput, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconCalendar } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface SemesterPickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export function SemesterPicker({
  value,
  onChange,
  label = 'Semester',
  placeholder = 'Select semester',
  required = false,
  error
}: SemesterPickerProps) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterDates, setNewSemesterDates] = useState<[Date | null, Date | null]>([null, null]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    try {
      // Import API client dynamically to avoid SSR issues
      const { api } = await import('../../lib/api');
      const data = await api.request<{ semesters: Semester[] }>('/api/v1/semesters');
      setSemesters(data.semesters);
      
      // Auto-select current semester if no value is set
      if (!value && data.semesters.length > 0) {
        const current = data.semesters.find((s: Semester) => s.is_current);
        if (current) {
          onChange(current.id);
        }
      }
    } catch (error) {
      console.error('Failed to load semesters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSemester = async () => {
    if (!newSemesterName || !newSemesterDates[0] || !newSemesterDates[1]) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all fields',
        color: 'red'
      });
      return;
    }

    setCreating(true);
    try {
      const { api } = await import('../../lib/api');
      const data = await api.request<{ semester: Semester }>('/api/v1/semesters', {
        method: 'POST',
        body: JSON.stringify({
          name: newSemesterName,
          start_date: newSemesterDates[0].toISOString().split('T')[0],
          end_date: newSemesterDates[1].toISOString().split('T')[0],
          is_current: false
        })
      });
      
      setSemesters([...semesters, data.semester]);
      onChange(data.semester.id);
      setShowCreateModal(false);
      setNewSemesterName('');
      setNewSemesterDates([null, null]);
      
      notifications.show({
        title: 'Success',
        message: 'Semester created successfully',
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create semester',
        color: 'red'
      });
    } finally {
      setCreating(false);
    }
  };

  // Generate suggested semester names based on dates
  const generateSemesterName = (startDate: Date) => {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    
    if (month >= 0 && month <= 4) {
      return `Spring ${year}`;
    } else if (month >= 5 && month <= 7) {
      return `Summer ${year}`;
    } else {
      return `Fall ${year}`;
    }
  };

  return (
    <>
      <Group gap="xs" grow>
        <Select
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={(val) => val && onChange(val)}
          data={[
            ...semesters.map(s => ({
              value: s.id,
              label: `${s.name}${s.is_current ? ' (Current)' : ''}`
            }))
          ]}
          required={required}
          error={error}
          leftSection={<IconCalendar size={16} />}
          disabled={loading}
          searchable
        />
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowCreateModal(true)}
          style={{ alignSelf: 'flex-end' }}
        >
          New
        </Button>
      </Group>

      <Modal
        opened={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Semester"
      >
        <Stack gap="md">
          <TextInput
            label="Semester Name"
            placeholder="e.g., Spring 2025"
            value={newSemesterName}
            onChange={(e) => setNewSemesterName(e.currentTarget.value)}
            required
          />
          
          <DatePickerInput
            type="range"
            label="Semester Dates"
            placeholder="Select start and end dates"
            value={newSemesterDates}
            onChange={(dates) => {
              setNewSemesterDates(dates);
              // Auto-generate name if empty
              if (dates[0] && !newSemesterName) {
                setNewSemesterName(generateSemesterName(dates[0]));
              }
            }}
            required
          />

          {newSemesterDates[0] && newSemesterDates[1] && (
            <Text size="sm" c="dimmed">
              Duration: {Math.round((newSemesterDates[1].getTime() - newSemesterDates[0].getTime()) / (1000 * 60 * 60 * 24))} days
            </Text>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSemester}
              loading={creating}
            >
              Create Semester
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}