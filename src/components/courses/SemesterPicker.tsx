'use client';

import { useState, useEffect } from 'react';
import { Select, Button, Group, Modal, TextInput, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconCalendar } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  source?: 'db' | 'hardcoded';
}

// UGA Academic Calendar - Hardcoded semester options
const UGA_SEMESTERS: Semester[] = [
  {
    id: 'uga-spring-2024',
    name: 'Spring 2024',
    start_date: '2024-01-08',
    end_date: '2024-04-26',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-summer-2024',
    name: 'Summer 2024',
    start_date: '2024-05-13',
    end_date: '2024-08-02',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-fall-2024',
    name: 'Fall 2024',
    start_date: '2024-08-12',
    end_date: '2024-12-06',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-spring-2025',
    name: 'Spring 2025',
    start_date: '2025-01-13',
    end_date: '2025-05-02',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-summer-2025',
    name: 'Summer 2025',
    start_date: '2025-05-12',
    end_date: '2025-08-01',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-fall-2025',
    name: 'Fall 2025',
    start_date: '2025-08-18',
    end_date: '2025-12-12',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-spring-2026',
    name: 'Spring 2026',
    start_date: '2026-01-12',
    end_date: '2026-05-01',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-summer-2026',
    name: 'Summer 2026',
    start_date: '2026-05-11',
    end_date: '2026-07-31',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-fall-2026',
    name: 'Fall 2026',
    start_date: '2026-08-17',
    end_date: '2026-12-11',
    is_current: false,
    source: 'hardcoded'
  },
  {
    id: 'uga-spring-2027',
    name: 'Spring 2027',
    start_date: '2027-01-11',
    end_date: '2027-04-30',
    is_current: false,
    source: 'hardcoded'
  }
];

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
  const { preferences } = useUserPreferences();

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // Import API client dynamically to avoid SSR issues
        const { apiClient } = await import('../../lib/api');
        const data = await apiClient.request<{ semesters: Semester[] }>('/api/v1/semesters');
        
        // Get hardcoded semesters based on university preference
        const getHardcodedSemesters = () => {
          switch (preferences.universityId) {
            case 'uga':
              return UGA_SEMESTERS;
            default:
              return [];
          }
        };
        
        // Merge university-specific hardcoded semesters with database semesters
        const dbSemesters = data.semesters.map(s => ({ ...s, source: 'db' as const }));
        const hardcodedSemesters = getHardcodedSemesters();
        const allSemesters = [...hardcodedSemesters, ...dbSemesters];
        
        // Remove duplicates by id, giving priority to database semesters
        const uniqueSemesters = allSemesters.filter((semester, index, array) => {
          const firstOccurrence = array.findIndex(s => s.id === semester.id);
          return firstOccurrence === index;
        });
        
        // Sort by start date (newest first)
        const sortedSemesters = uniqueSemesters.sort((a, b) => {
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        });
        
        // Auto-determine current semester if none is marked current
        const currentDate = new Date();
        const hasCurrentSemester = sortedSemesters.some(s => s.is_current);
        
        if (!hasCurrentSemester) {
          const activeSemester = sortedSemesters.find(s => {
            const start = new Date(s.start_date);
            const end = new Date(s.end_date);
            return currentDate >= start && currentDate <= end;
          });
          
          if (activeSemester) {
            activeSemester.is_current = true;
          }
        }
        
        if (!active) return;
        setSemesters(sortedSemesters);
        
        // Auto-select current semester if no value is set
        if (!value && sortedSemesters.length > 0) {
          const current = sortedSemesters.find((s: Semester) => s.is_current);
          if (current) {
            onChange(current.id);
          }
        }
      } catch (error) {
        console.error('Failed to load semesters:', error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [value, onChange, preferences.universityId]);

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
      const { apiClient } = await import('../../lib/api');
      const data = await apiClient.request<{ semester: Semester }>('/api/v1/semesters', {
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
        zIndex={1100}
        centered
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