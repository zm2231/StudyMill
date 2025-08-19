'use client';

import { Card, Title, Stack, Group, Text, Button, Avatar, Badge } from '@mantine/core';
import { IconHistory, IconChevronRight, IconFileText, IconMicrophone, IconBrain } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivity {
  id: string;
  title: string;
  action: string;
  type: 'document' | 'audio' | 'note' | 'flashcard' | 'study-guide';
  course?: {
    name: string;
    color: string;
    code: string;
  };
  timestamp: Date;
  icon: React.ComponentType<any>;
}

// Mock data - will be replaced with real API data
const mockRecentActivity: RecentActivity[] = [
  {
    id: '1',
    title: 'Chapter 4 Lecture Slides',
    action: 'uploaded',
    type: 'document',
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    icon: IconFileText
  },
  {
    id: '2',
    title: 'Lecture Recording - Newton\'s Laws',
    action: 'processed',
    type: 'audio',
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    icon: IconMicrophone
  },
  {
    id: '3',
    title: 'Integration Techniques Flashcards',
    action: 'created',
    type: 'flashcard',
    course: { name: 'Calculus II', color: '#D9B68D', code: 'MATH 152' },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    icon: IconBrain
  },
  {
    id: '4',
    title: 'Chemistry Lab Report',
    action: 'uploaded',
    type: 'document',
    course: { name: 'Chemistry 101', color: '#C2856B', code: 'CHEM 101' },
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    icon: IconFileText
  },
  {
    id: '5',
    title: 'Thermodynamics Study Guide',
    action: 'generated',
    type: 'study-guide',
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    icon: IconBrain
  }
];

function getActionColor(action: string): string {
  switch (action) {
    case 'uploaded': return 'blue';
    case 'created': return 'green';
    case 'generated': return 'purple';
    case 'processed': return 'orange';
    case 'completed': return 'teal';
    default: return 'gray';
  }
}

function getTypeColor(type: RecentActivity['type']): string {
  switch (type) {
    case 'document': return 'blue';
    case 'audio': return 'orange';
    case 'note': return 'green';
    case 'study-guide': return 'purple';
    case 'flashcard': return 'red';
    default: return 'gray';
  }
}

export function RecentSection() {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconHistory size={24} color="var(--forest-green-primary)" />
            <Title order={3}>Recent Activity</Title>
          </Group>
          <Button variant="subtle" size="sm" rightSection={<IconChevronRight size={14} />}>
            View All
          </Button>
        </Group>

        {mockRecentActivity.length === 0 ? (
          <Stack align="center" py="xl">
            <Text size="lg" c="dimmed">No recent activity</Text>
            <Text size="sm" c="dimmed">Your recent uploads and creations will appear here</Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {mockRecentActivity.slice(0, 5).map((activity) => {
              const Icon = activity.icon;
              
              return (
                <Group 
                  key={activity.id} 
                  p="sm" 
                  style={{ 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 120ms ease'
                  }}
                  justify="space-between"
                >
                  <Group gap="sm">
                    <Avatar size="sm" color={getTypeColor(activity.type)} variant="light">
                      <Icon size={16} />
                    </Avatar>
                    
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Text fw={500} size="sm">{activity.title}</Text>
                        <Badge 
                          size="xs" 
                          color={getActionColor(activity.action)} 
                          variant="light"
                        >
                          {activity.action}
                        </Badge>
                      </Group>
                      
                      <Group gap="xs">
                        {activity.course && (
                          <Text size="xs" c="dimmed">
                            {activity.course.name}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                        </Text>
                      </Group>
                    </Stack>
                  </Group>

                  {activity.course && (
                    <Avatar 
                      size="xs" 
                      style={{ backgroundColor: activity.course.color }}
                    >
                      {activity.course.code.substring(0, 2)}
                    </Avatar>
                  )}
                </Group>
              );
            })}
          </Stack>
        )}

        {/* Quick Stats */}
        <Group justify="space-between" p="sm" style={{ backgroundColor: 'var(--sanctuary-surface)', borderRadius: '6px' }}>
          <Stack gap={2} align="center">
            <Text size="lg" fw={600} c="var(--forest-green-primary)">
              {mockRecentActivity.filter(a => a.action === 'uploaded').length}
            </Text>
            <Text size="xs" c="dimmed">Uploaded Today</Text>
          </Stack>
          
          <Stack gap={2} align="center">
            <Text size="lg" fw={600} c="var(--forest-green-primary)">
              {mockRecentActivity.filter(a => a.action === 'created' || a.action === 'generated').length}
            </Text>
            <Text size="xs" c="dimmed">AI Generated</Text>
          </Stack>
          
          <Stack gap={2} align="center">
            <Text size="lg" fw={600} c="var(--forest-green-primary)">
              {mockRecentActivity.filter(a => a.type === 'audio').length}
            </Text>
            <Text size="xs" c="dimmed">Audio Processed</Text>
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Shows chronological feed of recent user activity
// - Action badges with color coding (uploaded, created, processed, etc.)
// - Course association and type indicators  
// - Quick stats summary at bottom
// - Hover states and interactive elements