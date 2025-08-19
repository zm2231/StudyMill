'use client';

import { Card, Title, Stack, Group, Text, Button, Badge, Avatar, Progress } from '@mantine/core';
import { IconClock, IconAlertTriangle, IconChevronRight, IconCalendarDue } from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday, isTomorrow, addDays } from 'date-fns';

interface DueItem {
  id: string;
  title: string;
  type: 'assignment' | 'exam' | 'quiz' | 'project' | 'reading';
  course: {
    name: string;
    color: string;
    code: string;
  };
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  completed?: boolean;
  progress?: number;
}

// Mock data - will be replaced with real API data
const mockDueItems: DueItem[] = [
  {
    id: '1',
    title: 'Physics Problem Set 4',
    type: 'assignment',
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    priority: 'high',
    progress: 60
  },
  {
    id: '2',
    title: 'Calculus Midterm Exam',
    type: 'exam',
    course: { name: 'Calculus II', color: '#D9B68D', code: 'MATH 152' },
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    priority: 'high',
    progress: 30
  },
  {
    id: '3',
    title: 'Chemistry Lab Report',
    type: 'assignment',
    course: { name: 'Chemistry 101', color: '#C2856B', code: 'CHEM 101' },
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    priority: 'medium',
    progress: 80
  },
  {
    id: '4',
    title: 'Chapter 5-6 Reading',
    type: 'reading',
    course: { name: 'Biology 101', color: '#A3C6A0', code: 'BIOL 101' },
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    priority: 'low',
    progress: 25
  }
];

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
    case 'exam': return '📝';
    case 'quiz': return '❓';
    case 'assignment': return '📋';
    case 'project': return '🎯';
    case 'reading': return '📖';
    default: return '📄';
  }
}

function getDueDateText(dueDate: Date): { text: string; urgent: boolean } {
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
  const sortedItems = mockDueItems
    .filter(item => !item.completed)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 4); // Show max 4 items

  const urgentCount = sortedItems.filter(item => 
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

        {sortedItems.length === 0 ? (
          <Stack align="center" py="md">
            <Text size="sm" c="dimmed">Nothing due soon</Text>
            <Text size="xs" c="dimmed">You're all caught up!</Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {sortedItems.map((item) => {
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