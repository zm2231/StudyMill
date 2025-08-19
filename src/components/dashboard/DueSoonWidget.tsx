'use client';

import { Card, Title, Stack, Group, Text, Button, Badge, Avatar, Progress } from '@mantine/core';
import { IconClock, IconAlertTriangle, IconChevronRight, IconCalendarDue } from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday, isTomorrow, addDays } from 'date-fns';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';

interface DueItem {
  id: string;
  title: string;
  type: 'homework' | 'test' | 'project' | 'quiz';
  course: {
    name: string;
    color: string;
    code: string;
  };
  dueDate: Date | null;
  priority: 'high' | 'medium' | 'low';
  completed?: boolean;
  progress?: number;
}

function getPriorityColor(priority: DueItem['priority']): string {
  switch (priority) {
    case 'high': return 'red';
    case 'medium': return 'orange';
    case 'low': return 'blue';
    default: return 'gray';
  }
}

function getTypeIcon(type: DueItem['type']): string {
  switch (type) {
    case 'test': return '📝';
    case 'quiz': return '❓';
    case 'homework': return '📋';
    case 'project': return '🎯';
    default: return '📄';
  }
}

function getDueDateText(dueDate: Date | null): { text: string; urgent: boolean } {
  if (!dueDate) {
    return { text: 'No due date', urgent: false };
  }
  
  if (isToday(dueDate)) {
    return { text: 'Due today', urgent: true };
  } else if (isTomorrow(dueDate)) {
    return { text: 'Due tomorrow', urgent: true };
  } else {
    const distance = formatDistanceToNow(dueDate, { addSuffix: true });
    const urgent = dueDate.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000; // Less than 3 days
    return { text: `Due ${distance}`, urgent };
  }
}

export function DueSoonWidget() {
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  useEffect(() => {
    const fetchDueAssignments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.getDueAssignments({ days: 7, limit: 4 });
        setDueItems(response.assignments);
      } catch (err: any) {
        console.error('Failed to fetch due assignments:', err);
        setError('Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };

    fetchDueAssignments();
  }, [api]);

  const urgentCount = dueItems.filter(item => 
    getDueDateText(item.dueDate).urgent
  ).length;

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconCalendarDue size={20} color="var(--warm-sand)" />
            <Title order={4}>Due Soon</Title>
            {urgentCount > 0 && (
              <Badge size="sm" color="red" variant="filled">
                {urgentCount} urgent
              </Badge>
            )}
          </Group>
          <Button variant="subtle" size="xs" rightSection={<IconChevronRight size={12} />}>
            View All
          </Button>
        </Group>

        {loading ? (
          <Stack align="center" py="md">
            <Text size="sm" c="dimmed">Loading assignments...</Text>
          </Stack>
        ) : error ? (
          <Stack align="center" py="md">
            <Text size="sm" c="red">{error}</Text>
          </Stack>
        ) : dueItems.length === 0 ? (
          <Stack align="center" py="md">
            <Text size="sm" c="dimmed">Nothing due soon</Text>
            <Text size="xs" c="dimmed">You're all caught up!</Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {dueItems.map((item) => {
              const { text: dueDateText, urgent } = getDueDateText(item.dueDate);
              
              return (
                <Card 
                  key={item.id} 
                  p="sm" 
                  radius="sm"
                  style={{ 
                    border: `1px solid ${urgent ? 'var(--muted-terracotta)' : 'var(--border-light)'}`,
                    backgroundColor: urgent ? 'rgba(194, 133, 107, 0.05)' : 'transparent'
                  }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="xs">
                        <Text size="lg">{getTypeIcon(item.type)}</Text>
                        <Stack gap={1}>
                          <Text fw={500} size="sm" lineClamp={2}>
                            {item.title}
                          </Text>
                          <Group gap="xs">
                            <Avatar 
                              size="xs" 
                              style={{ backgroundColor: item.course.color }}
                            >
                              {item.course.code.substring(0, 2)}
                            </Avatar>
                            <Text size="xs" c="dimmed">
                              {item.course.code}
                            </Text>
                          </Group>
                        </Stack>
                      </Group>
                      
                      <Badge 
                        size="xs" 
                        color={getPriorityColor(item.priority)} 
                        variant="light"
                      >
                        {item.priority}
                      </Badge>
                    </Group>

                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        {urgent && <IconAlertTriangle size={12} color="var(--muted-terracotta)" />}
                        <Text 
                          size="xs" 
                          c={urgent ? 'var(--muted-terracotta)' : 'dimmed'}
                          fw={urgent ? 500 : 400}
                        >
                          {dueDateText}
                        </Text>
                      </Group>
                      
                      {item.progress !== undefined && (
                        <Text size="xs" c="dimmed">
                          {item.progress}%
                        </Text>
                      )}
                    </Group>

                    {item.progress !== undefined && (
                      <Progress 
                        value={item.progress} 
                        size="xs" 
                        color={item.course.color}
                      />
                    )}
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}

        {/* Quick action */}
        <Button 
          variant="light" 
          color="forestGreen" 
          size="sm" 
          fullWidth
        >
          View Calendar
        </Button>
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Shows upcoming assignments, exams, and deadlines
// - Priority-based color coding and urgency indicators
// - Progress tracking for ongoing assignments
// - Course association with color-coded avatars
// - Urgent items highlighted with special styling