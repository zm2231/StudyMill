'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { 
  Container, 
  Title, 
  Text, 
  Card, 
  Stack, 
  Button, 
  Group,
  Select,
  Tabs,
  Alert,
  Loader,
  rem,
  Badge
} from '@mantine/core';
import { 
  IconCalendarTime, 
  IconSettings, 
  IconCalendarWeek,
  IconCalendar,
  IconChartBar,
  IconAlertCircle
} from '@tabler/icons-react';
import { WeekView } from '@/components/planner/WeekView';
import { CalendarView } from '@/components/planner/CalendarView';
import { getCurrentWeekAssignments } from '@/lib/api/planner';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { UNIVERSITIES } from '@/types/university';

interface Semester {
  id: string;
  name: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
}

export default function PlannerPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { preferences } = useUserPreferences();
  const isUGA = preferences.universityId === 'uga';

  // Load semesters on mount
  useEffect(() => {
    loadSemesters();
  }, []);

  const loadSemesters = async () => {
    try {
      setLoading(true);
      const { apiClient } = await import('@/lib/api');
      const data = await apiClient.request<{ semesters: Semester[] }>('/api/v1/semesters');
      const semestersData = data.semesters;
      
      setSemesters(semestersData);
      
      // Auto-select current semester
      const currentSemester = semestersData.find((s: Semester) => s.is_current);
      if (currentSemester) {
        setSelectedSemester(currentSemester.id);
      } else if (semestersData.length > 0) {
        setSelectedSemester(semestersData[0].id);
      }
    } catch (err) {
      console.error('Failed to load semesters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load semesters');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AppShell>
          <Container size="xl" py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Loading planner...</Text>
            </Stack>
          </Container>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <AppShell>
          <Container size="xl" py="xl">
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
              <Button
                variant="light"
                size="sm"
                mt="md"
                onClick={loadSemesters}
              >
                Retry
              </Button>
            </Alert>
          </Container>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (semesters.length === 0) {
    return (
      <ProtectedRoute>
        <AppShell>
          <Container size="xl" py="xl">
            <Stack gap="lg">
              <Title order={1}>Planner & Calendar</Title>
              
              <Card p="xl" radius="md" withBorder>
                <Stack gap="md" align="center">
                  <IconCalendarTime size={48} color="var(--mantine-color-gray-5)" />
                  <Title order={3} ta="center">No Semesters Found</Title>
                  <Text ta="center" c="dimmed">
                    Create a semester first to start planning your assignments and schedule.
                  </Text>
                  <Button 
                    leftSection={<IconSettings size={16} />} 
                    variant="light"
                    onClick={async () => {
                      try {
                        const { apiClient } = await import('@/lib/api');
                        // Hardcoded academic terms and date windows (Fall 2025 / Spring 2026 / Summer 2026)
                        const terms = [
                          { name: 'Fall 2025',   start_date: '2025-08-15', end_date: '2025-12-15' },
                          { name: 'Spring 2026', start_date: '2026-01-15', end_date: '2026-05-15' },
                          { name: 'Summer 2026', start_date: '2026-05-16', end_date: '2026-08-15' },
                        ];
                        
                        const today = new Date();
                        const pick = ((): { name: string; start_date: string; end_date: string } => {
                          for (const t of terms) {
                            const s = new Date(t.start_date + 'T00:00:00Z');
                            const e = new Date(t.end_date + 'T23:59:59Z');
                            if (today >= s && today <= e) return t;
                          }
                          // Default to first term (Fall 2025) if no match
                          return terms[0];
                        })();
                        
                        const payload = {
                          name: pick.name,
                          start_date: pick.start_date,
                          end_date: pick.end_date,
                          is_current: true
                        };
                        
                        const created = await apiClient.request<{ semester: { id: string } }>(
                          '/api/v1/semesters',
                          { method: 'POST', body: JSON.stringify(payload) }
                        );
                        const newId = (created as any).semester?.id;

                        // Optional: trigger week buckets build for this semester
                        if (newId) {
                          try {
                            await apiClient.request(`/api/v1/planner/weeks/${newId}/rebuild`, { method: 'POST' });
                          } catch (e) {
                            console.warn('Week rebuild failed (will continue):', e);
                          }
                        }
                        
                        // Reload semesters and select the new one
                        await loadSemesters();
                        if (newId) setSelectedSemester(newId);
                      } catch (err) {
                        console.error('Failed to create semester:', err);
                        setError(err instanceof Error ? err.message : 'Failed to create semester');
                      }
                    }}
                  >
                    Create Semester
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Container>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between">
              <div>
                <Title order={1}>Planner & Calendar</Title>
                <Text c="dimmed" mt="xs">
                  Track assignments, deadlines, and progress across semester weeks
                </Text>
              </div>
              
              <Group gap="md">
                {isUGA && (
                  <Badge color="red" variant="light">UGA Academic Dates Active</Badge>
                )}
                <Select
                  placeholder="Select semester"
                  value={selectedSemester}
                  onChange={(value) => setSelectedSemester(value || '')}
                  data={semesters.map(s => ({
                    value: s.id,
                    label: `${s.name}${s.is_current ? ' (Current)' : ''}`
                  }))}
                  style={{ minWidth: 200 }}
                />
              </Group>
            </Group>

            {/* Main Content */}
            {selectedSemester ? (
              <Tabs defaultValue="week-view">
                <Tabs.List>
                  <Tabs.Tab
                    value="week-view"
                    leftSection={<IconCalendarWeek style={{ width: rem(16), height: rem(16) }} />}
                  >
                    Week View
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="calendar"
                    leftSection={<IconCalendar style={{ width: rem(16), height: rem(16) }} />}
                  >
                    Calendar
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="analytics"
                    leftSection={<IconChartBar style={{ width: rem(16), height: rem(16) }} />}
                  >
                    Analytics
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="week-view" pt="md">
                  <WeekView 
                    semesterId={selectedSemester}
                    onAssignmentClick={(assignment) => {
                      // TODO: Open assignment details
                      console.log('Assignment clicked:', assignment);
                    }}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="calendar" pt="md">
                  <CalendarView semesterId={selectedSemester} />
                </Tabs.Panel>

                <Tabs.Panel value="analytics" pt="md">
                  <Card p="xl" radius="md" withBorder>
                    <Stack gap="md" align="center">
                      <IconChartBar size={48} color="var(--mantine-color-gray-5)" />
                      <Title order={3} ta="center">Analytics Coming Soon</Title>
                      <Text ta="center" c="dimmed">
                        Detailed analytics and progress tracking will be available soon.
                      </Text>
                    </Stack>
                  </Card>
                </Tabs.Panel>
              </Tabs>
            ) : (
              <Alert>Please select a semester to view planner data.</Alert>
            )}
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}