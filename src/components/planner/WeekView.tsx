'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Progress,
  Button,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Container,
  Title,
  Alert,
  Loader,
  ThemeIcon,
  Paper,
  Grid,
  rem
} from '@mantine/core';
import {
  IconCalendarWeek,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconRefresh,
  IconSchool,
  IconTarget,
  IconTrendingUp
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getAssignmentsByWeek,
  getCurrentWeekAssignments,
  updateAssignmentStatus,
  getPlannerStats,
  type WeekBucket,
  type Assignment,
  type PlannerStats
} from '@/lib/api/planner';

interface WeekViewProps {
  semesterId: string;
  onAssignmentClick?: (assignment: Assignment) => void;
}

export function WeekView({ semesterId, onAssignmentClick }: WeekViewProps) {
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekBucket | null>(null);
  const [stats, setStats] = useState<PlannerStats | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (semesterId) {
      loadWeekData();
    }
  }, [semesterId]);

  const loadWeekData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [weeklyData, statsData] = await Promise.all([
        getAssignmentsByWeek(semesterId),
        getPlannerStats(semesterId)
      ]);

      setWeeks(weeklyData.weeks);
      setStats(statsData);

      // Find current week and set as selected
      const currentWeekIndex = weeklyData.weeks.findIndex(w => w.is_current_week);
      if (currentWeekIndex >= 0) {
        setSelectedWeekIndex(currentWeekIndex);
        setCurrentWeek(weeklyData.weeks[currentWeekIndex]);
      }
    } catch (err) {
      console.error('Failed to load week data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load week data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentStatusToggle = async (assignment: Assignment) => {
    try {
      const newStatus = assignment.status === 'completed' ? 'pending' : 'completed';
      await updateAssignmentStatus(assignment.id, newStatus);
      
      // Update local state
      setWeeks(prevWeeks => 
        prevWeeks.map(week => ({
          ...week,
          assignments: week.assignments.map(a => 
            a.id === assignment.id ? { ...a, status: newStatus } : a
          )
        }))
      );

      notifications.show({
        title: 'Success',
        message: `Assignment ${newStatus === 'completed' ? 'completed' : 'marked as pending'}`,
        color: 'green'
      });

      // Refresh stats
      const newStats = await getPlannerStats(semesterId);
      setStats(newStats);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update assignment status',
        color: 'red'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'overdue': return 'red';
      case 'in_progress': return 'blue';
      default: return 'gray';
    }
  };

  const getAssignmentTypeColor = (type: string) => {
    switch (type) {
      case 'test': return 'red';
      case 'project': return 'purple';
      case 'quiz': return 'orange';
      case 'homework': return 'blue';
      default: return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const selectedWeek = weeks[selectedWeekIndex];

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading week view...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert color="red" icon={<IconAlertTriangle size={16} />}>
          {error}
          <Button
            variant="light"
            size="sm"
            mt="md"
            leftSection={<IconRefresh size={16} />}
            onClick={loadWeekData}
          >
            Retry
          </Button>
        </Alert>
      </Container>
    );
  }

  if (weeks.length === 0) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconCalendarWeek size={16} />}>
          No weeks found for this semester. Check your semester dates and try rebuilding the week structure.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header with stats */}
        <Group justify="space-between">
          <div>
            <Title order={2}>Week View</Title>
            <Text c="dimmed" mt="xs">Track assignments across semester weeks</Text>
          </div>
          
          {stats && (
            <Grid>
              <Grid.Col span="auto">
                <Paper withBorder p="sm" style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={700} c="green">
                    {stats.completed_assignments}
                  </Text>
                  <Text size="xs" c="dimmed">Completed</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span="auto">
                <Paper withBorder p="sm" style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={700} c="orange">
                    {stats.due_this_week}
                  </Text>
                  <Text size="xs" c="dimmed">Due This Week</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span="auto">
                <Paper withBorder p="sm" style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={700} c="red">
                    {stats.overdue_assignments}
                  </Text>
                  <Text size="xs" c="dimmed">Overdue</Text>
                </Paper>
              </Grid.Col>
            </Grid>
          )}
        </Group>

        {/* Week Navigation */}
        <Card withBorder p="lg">
          <Group justify="space-between" mb="md">
            <ActionIcon
              variant="subtle"
              onClick={() => setSelectedWeekIndex(Math.max(0, selectedWeekIndex - 1))}
              disabled={selectedWeekIndex === 0}
            >
              <IconChevronLeft size={20} />
            </ActionIcon>

            <div style={{ textAlign: 'center' }}>
              <Group gap="xs" justify="center">
                <ThemeIcon 
                  variant="light" 
                  color={selectedWeek?.is_current_week ? 'blue' : 'gray'}
                  size="lg"
                >
                  <IconCalendarWeek size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="lg">
                    Week {selectedWeek?.week_number}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {selectedWeek && `${formatDate(selectedWeek.start_date)} - ${formatDate(selectedWeek.end_date)}`}
                  </Text>
                </div>
              </Group>
              {selectedWeek?.is_current_week && (
                <Badge variant="light" color="blue" size="sm" mt="xs">
                  Current Week
                </Badge>
              )}
            </div>

            <ActionIcon
              variant="subtle"
              onClick={() => setSelectedWeekIndex(Math.min(weeks.length - 1, selectedWeekIndex + 1))}
              disabled={selectedWeekIndex === weeks.length - 1}
            >
              <IconChevronRight size={20} />
            </ActionIcon>
          </Group>

          {/* Week Progress */}
          <div style={{ width: '100%', padding: '0 2rem' }}>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Week Progress</Text>
              <Text size="sm" c="dimmed">
                {selectedWeek?.assignments.filter(a => a.status === 'completed').length || 0} / {selectedWeek?.assignments.length || 0} completed
              </Text>
            </Group>
            <Progress
              value={selectedWeek?.assignments.length ? 
                (selectedWeek.assignments.filter(a => a.status === 'completed').length / selectedWeek.assignments.length) * 100 : 0
              }
              color="green"
              size="lg"
              radius="xl"
            />
          </div>
        </Card>

        {/* Assignments for Selected Week */}
        {selectedWeek ? (
          <Card withBorder>
            <Card.Section p="lg" bg="var(--mantine-color-gray-0)">
              <Group justify="space-between">
                <Group>
                  <IconTarget size={20} />
                  <Text fw={600}>
                    Week {selectedWeek.week_number} Assignments
                  </Text>
                </Group>
                <Badge variant="light">
                  {selectedWeek.assignments.length} assignments
                </Badge>
              </Group>
            </Card.Section>

            <Card.Section>
              <ScrollArea.Autosize mah={400}>
                {selectedWeek.assignments.length > 0 ? (
                  <Stack gap="xs" p="lg">
                    {selectedWeek.assignments.map((assignment) => (
                      <Paper
                        key={assignment.id}
                        withBorder
                        p="md"
                        style={{
                          cursor: onAssignmentClick ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => onAssignmentClick?.(assignment)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group>
                            <ActionIcon
                              variant="subtle"
                              color={assignment.status === 'completed' ? 'green' : 'gray'}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssignmentStatusToggle(assignment);
                              }}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                            
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Group gap="xs">
                                <Text fw={500} style={{ textDecoration: assignment.status === 'completed' ? 'line-through' : 'none' }}>
                                  {assignment.title}
                                </Text>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={getAssignmentTypeColor(assignment.assignment_type)}
                                >
                                  {assignment.assignment_type}
                                </Badge>
                              </Group>
                              
                              {assignment.course_name && (
                                <Group gap="xs" mt="xs">
                                  <IconSchool size={14} />
                                  <Text size="sm" c="dimmed">
                                    {assignment.course_name}
                                  </Text>
                                </Group>
                              )}
                              
                              {assignment.due_date && (
                                <Group gap="xs" mt="xs">
                                  <IconClock size={14} />
                                  <Text size="sm" c="dimmed">
                                    Due {formatDate(assignment.due_date)}
                                  </Text>
                                </Group>
                              )}
                            </div>
                          </Group>
                          
                          <Badge
                            variant="light"
                            color={getStatusColor(assignment.status)}
                            size="sm"
                          >
                            {assignment.status}
                          </Badge>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Stack align="center" py="xl">
                    <ThemeIcon size="xl" variant="light" color="gray">
                      <IconCalendarWeek size={28} />
                    </ThemeIcon>
                    <Text c="dimmed" ta="center">
                      No assignments scheduled for this week
                    </Text>
                  </Stack>
                )}
              </ScrollArea.Autosize>
            </Card.Section>
          </Card>
        ) : (
          <Alert>No week selected</Alert>
        )}

        {/* Quick Actions */}
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={loadWeekData}
          >
            Refresh Data
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}