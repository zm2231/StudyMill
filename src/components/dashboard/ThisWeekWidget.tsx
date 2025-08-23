'use client';

import { 
  Card, 
  Title, 
  Stack, 
  Group, 
  Text, 
  Button, 
  Badge, 
  Progress, 
  ActionIcon,
  ScrollArea,
  ThemeIcon,
  Loader,
  Alert
} from '@mantine/core';
import { 
  IconCalendarWeek, 
  IconChevronRight, 
  IconCheck,
  IconClock,
  IconSchool,
  IconRefresh,
  IconAlertTriangle
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { format, isToday, isTomorrow } from 'date-fns';
import { useEffect, useState } from 'react';
import { getCurrentWeekAssignments, updateAssignmentStatus, type Assignment } from '@/lib/api/planner';
import { notifications } from '@mantine/notifications';

export function ThisWeekWidget() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weekDates, setWeekDates] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentWeekData();
  }, []);

  const loadCurrentWeekData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentWeekAssignments();
      setAssignments(data.assignments);
      setWeekDates({ start: data.week_start, end: data.week_end });
    } catch (err) {
      console.error('Failed to load current week assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (assignment: Assignment, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newStatus = assignment.status === 'completed' ? 'pending' : 'completed';
      await updateAssignmentStatus(assignment.id, newStatus);
      
      setAssignments(prev => 
        prev.map(a => 
          a.id === assignment.id ? { ...a, status: newStatus } : a
        )
      );
      
      notifications.show({
        title: 'Success',
        message: `Assignment ${newStatus === 'completed' ? 'completed' : 'marked as pending'}`,
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update assignment status',
        color: 'red'
      });
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

  const formatDueDate = (dueDateString: string | null) => {
    if (!dueDateString) return 'No due date';
    
    const dueDate = new Date(dueDateString);
    if (isToday(dueDate)) return 'Due today';
    if (isTomorrow(dueDate)) return 'Due tomorrow';
    return `Due ${format(dueDate, 'MMM d')}`;
  };

  const getDueDateUrgency = (dueDateString: string | null) => {
    if (!dueDateString) return 'gray';
    const dueDate = new Date(dueDateString);
    if (isToday(dueDate)) return 'red';
    if (isTomorrow(dueDate)) return 'orange';
    return 'blue';
  };

  const completedCount = assignments.filter(a => a.status === 'completed').length;
  const totalCount = assignments.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" h={300}>
        <Stack align="center" justify="center" h="100%">
          <Loader size="md" />
          <Text size="sm" c="dimmed">Loading this week...</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg" h={300}>
        <Alert color="red" icon={<IconAlertTriangle size={16} />}>
          <Text size="sm">{error}</Text>
          <Button
            variant="light"
            size="xs"
            mt="sm"
            leftSection={<IconRefresh size={14} />}
            onClick={loadCurrentWeekData}
          >
            Retry
          </Button>
        </Alert>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="lg" h={300}>
      <Stack h="100%" gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue">
              <IconCalendarWeek size={16} />
            </ThemeIcon>
            <div>
              <Title order={4}>This Week</Title>
              <Text size="xs" c="dimmed">
                {weekDates.start && weekDates.end && 
                  `${format(new Date(weekDates.start), 'MMM d')} - ${format(new Date(weekDates.end), 'MMM d')}`
                }
              </Text>
            </div>
          </Group>
          
          <ActionIcon variant="subtle" onClick={loadCurrentWeekData}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>

        {/* Progress */}
        {totalCount > 0 && (
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Progress</Text>
              <Text size="sm" c="dimmed">{completedCount}/{totalCount}</Text>
            </Group>
            <Progress value={progressPercentage} color="green" size="sm" radius="xl" />
          </div>
        )}

        {/* Assignments List */}
        <ScrollArea flex={1} scrollbarSize={4}>
          {assignments.length > 0 ? (
            <Stack gap="xs">
              {assignments.slice(0, 4).map((assignment) => (
                <Group
                  key={assignment.id}
                  justify="space-between"
                  wrap="nowrap"
                  p="xs"
                  style={{
                    borderRadius: '6px',
                    transition: 'background-color 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => router.push('/planner')}
                >
                  <Group gap="xs" style={{ minWidth: 0, flex: 1 }}>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color={assignment.status === 'completed' ? 'green' : 'gray'}
                      onClick={(e) => handleToggleComplete(assignment, e)}
                    >
                      <IconCheck size={14} />
                    </ActionIcon>
                    
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text 
                        size="sm" 
                        fw={500} 
                        truncate
                        style={{ 
                          textDecoration: assignment.status === 'completed' ? 'line-through' : 'none',
                          opacity: assignment.status === 'completed' ? 0.6 : 1
                        }}
                      >
                        {assignment.title}
                      </Text>
                      
                      <Group gap="xs" mt={2}>
                        {assignment.course_name && (
                          <Group gap={2}>
                            <IconSchool size={12} />
                            <Text size="xs" c="dimmed" truncate>
                              {assignment.course_name}
                            </Text>
                          </Group>
                        )}
                        
                        <Badge
                          size="xs"
                          variant="light"
                          color={getAssignmentTypeColor(assignment.assignment_type)}
                        >
                          {assignment.assignment_type}
                        </Badge>
                      </Group>
                    </div>
                  </Group>
                  
                  <div style={{ textAlign: 'right' }}>
                    <Text 
                      size="xs" 
                      c={getDueDateUrgency(assignment.due_date)}
                      fw={500}
                    >
                      {formatDueDate(assignment.due_date)}
                    </Text>
                  </div>
                </Group>
              ))}
              
              {assignments.length > 4 && (
                <Text size="xs" c="dimmed" ta="center" mt="xs">
                  +{assignments.length - 4} more assignments
                </Text>
              )}
            </Stack>
          ) : (
            <Stack align="center" justify="center" flex={1}>
              <ThemeIcon size="xl" variant="light" color="gray">
                <IconCalendarWeek size={24} />
              </ThemeIcon>
              <Text size="sm" c="dimmed" ta="center">
                No assignments this week
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Great job staying caught up!
              </Text>
            </Stack>
          )}
        </ScrollArea>

        {/* Footer */}
        <Group justify="space-between" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconChevronRight size={14} />}
            onClick={() => router.push('/planner')}
          >
            View full planner
          </Button>
          
          {totalCount > 0 && (
            <Text size="xs" c="dimmed">
              {Math.round(progressPercentage)}% complete
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  );
}