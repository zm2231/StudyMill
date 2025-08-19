'use client';

import { Card, Title, Stack, Group, Text, Button, Avatar, Badge, Progress } from '@mantine/core';
import { IconPlay, IconBook, IconChevronRight, IconClock } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentItem {
  id: string;
  title: string;
  type: 'document' | 'note' | 'study-guide' | 'flashcard';
  course?: {
    name: string;
    color: string;
    code: string;
  };
  lastAccessed: Date;
  progress?: number; // For study materials
  icon: React.ComponentType<any>;
}

// Mock data - will be replaced with real API data
const mockRecentItems: RecentItem[] = [
  {
    id: '1',
    title: 'Physics 101 - Chapter 3 Notes',
    type: 'document',
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    lastAccessed: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    progress: 65,
    icon: IconBook
  },
  {
    id: '2', 
    title: 'Calculus Study Guide',
    type: 'study-guide',
    course: { name: 'Calculus II', color: '#D9B68D', code: 'MATH 152' },
    lastAccessed: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    progress: 80,
    icon: IconBook
  },
  {
    id: '3',
    title: 'Chemistry Formulas',
    type: 'flashcard',
    course: { name: 'Chemistry 101', color: '#C2856B', code: 'CHEM 101' },
    lastAccessed: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    progress: 45,
    icon: IconBook
  }
];

function getTypeColor(type: RecentItem['type']): string {
  switch (type) {
    case 'document': return 'blue';
    case 'note': return 'green';
    case 'study-guide': return 'purple';
    case 'flashcard': return 'orange';
    default: return 'gray';
  }
}

function getTypeLabel(type: RecentItem['type']): string {
  switch (type) {
    case 'document': return 'Document';
    case 'note': return 'Note';
    case 'study-guide': return 'Study Guide';
    case 'flashcard': return 'Flashcards';
    default: return 'Item';
  }
}

export function ResumeSection() {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconPlay size={24} color="var(--forest-green-primary)" />
            <Title order={3}>Resume Where You Left Off</Title>
          </Group>
          <Button variant="subtle" size="sm" rightSection={<IconChevronRight size={14} />}>
            View All
          </Button>
        </Group>

        {mockRecentItems.length === 0 ? (
          <Stack align="center" py="xl">
            <Text size="lg" c="dimmed">No recent activity</Text>
            <Text size="sm" c="dimmed">Start studying to see your recent materials here</Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {mockRecentItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <Card 
                  key={item.id} 
                  p="md" 
                  withBorder 
                  radius="sm"
                  style={{ cursor: 'pointer' }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Group gap="sm">
                        {item.course && (
                          <Avatar 
                            size="sm" 
                            style={{ backgroundColor: item.course.color }}
                          >
                            {item.course.code.substring(0, 2)}
                          </Avatar>
                        )}
                        <Stack gap={2}>
                          <Text fw={500} size="sm">{item.title}</Text>
                          <Group gap="xs">
                            {item.course && (
                              <Text size="xs" c="dimmed">{item.course.name}</Text>
                            )}
                            <Badge 
                              size="xs" 
                              color={getTypeColor(item.type)} 
                              variant="light"
                            >
                              {getTypeLabel(item.type)}
                            </Badge>
                          </Group>
                        </Stack>
                      </Group>
                      
                      <Group gap="xs">
                        <IconClock size={14} color="var(--sanctuary-text-secondary)" />
                        <Text size="xs" c="dimmed">
                          {formatDistanceToNow(item.lastAccessed, { addSuffix: true })}
                        </Text>
                      </Group>
                    </Group>

                    {/* Progress indicator for study materials */}
                    {item.progress !== undefined && (
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="xs" fw={500}>Progress</Text>
                          <Text size="xs" c="dimmed">{item.progress}% complete</Text>
                        </Group>
                        <Progress 
                          value={item.progress} 
                          size="sm" 
                          color={item.course?.color || 'blue'} 
                        />
                      </Stack>
                    )}

                    <Button 
                      variant="light" 
                      color="forestGreen" 
                      size="xs" 
                      rightSection={<IconChevronRight size={14} />}
                      fullWidth
                    >
                      Continue {getTypeLabel(item.type)}
                    </Button>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Shows recently accessed materials with progress tracking
// - Course association with color coding
// - Type badges for different content types
// - Continue action buttons for resuming work
// - Time-based sorting (most recent first)