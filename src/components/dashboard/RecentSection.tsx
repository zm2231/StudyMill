'use client';

import { Card, Title, Stack, Group, Text, Button, Avatar, Badge } from '@mantine/core';
import { IconHistory, IconChevronRight, IconFileText, IconMicrophone, IconBrain } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';

interface RecentActivity {
  id: string;
  title: string;
  action: 'uploaded' | 'created' | 'processed' | 'viewed' | 'completed' | 'updated' | 'deleted';
  type: 'document' | 'audio' | 'note' | 'flashcard' | 'study-guide' | 'assignment' | 'course';
  course?: {
    id: string;
    name: string;
    color: string;
    code: string;
  };
  timestamp: Date;
  metadata: Record<string, any>;
  icon: React.ComponentType<any>;
}

function getActionColor(action: string): string {
  switch (action) {
    case 'uploaded': return 'blue';
    case 'created': return 'green';
    case 'processed': return 'orange';
    case 'viewed': return 'cyan';
    case 'completed': return 'teal';
    case 'updated': return 'yellow';
    case 'deleted': return 'red';
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
    case 'assignment': return 'pink';
    case 'course': return 'indigo';
    default: return 'gray';
  }
}

function getTypeIcon(type: RecentActivity['type']): React.ComponentType<any> {
  switch (type) {
    case 'document': return IconFileText;
    case 'audio': return IconMicrophone;
    case 'note': 
    case 'study-guide': 
    case 'flashcard': 
    case 'assignment': 
    case 'course': 
    default: return IconBrain;
  }
}

export function RecentSection() {
  const api = useApi();
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentActivities();
  }, []);

  const loadRecentActivities = async () => {
    if (!api.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getRecentActivities({ limit: 10 });
      
      if (response.success) {
        // Transform API data to match component interface
        const transformedActivities: RecentActivity[] = response.activities.map(activity => ({
          id: activity.id,
          title: activity.title,
          action: activity.action,
          type: activity.type,
          course: activity.course,
          timestamp: activity.timestamp,
          metadata: activity.metadata,
          icon: getTypeIcon(activity.type)
        }));
        
        setRecentActivities(transformedActivities);
      }
    } catch (err) {
      console.error('Failed to load recent activities:', err);
      // Show empty state instead of error for better UX
      setRecentActivities([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate quick stats from real data
  const uploadedTodayCount = recentActivities.filter(a => 
    a.action === 'uploaded' && 
    new Date(a.timestamp).toDateString() === new Date().toDateString()
  ).length;

  const aiGeneratedCount = recentActivities.filter(a => 
    a.action === 'created' || a.action === 'processed'
  ).length;

  const audioProcessedCount = recentActivities.filter(a => 
    a.type === 'audio' && a.action === 'processed'
  ).length;

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

        {loading ? (
          <Stack align="center" py="xl">
            <Text size="lg" c="dimmed">Loading recent activity...</Text>
          </Stack>
        ) : error ? (
          <Stack align="center" py="xl">
            <Text size="lg" c="red">{error}</Text>
            <Button size="sm" variant="outline" onClick={loadRecentActivities}>
              Retry
            </Button>
          </Stack>
        ) : recentActivities.length === 0 ? (
          <Stack align="center" py="xl">
            <Text size="lg" c="dimmed">Ready to start studying?</Text>
            <Text size="sm" c="dimmed" ta="center">
              Upload documents, record lectures, or create notes to get started.<br />
              Your activity will appear here as you use StudyMill!
            </Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {recentActivities.slice(0, 5).map((activity) => {
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
              {uploadedTodayCount}
            </Text>
            <Text size="xs" c="dimmed">Uploaded Today</Text>
          </Stack>
          
          <Stack gap={2} align="center">
            <Text size="lg" fw={600} c="var(--forest-green-primary)">
              {aiGeneratedCount}
            </Text>
            <Text size="xs" c="dimmed">AI Generated</Text>
          </Stack>
          
          <Stack gap={2} align="center">
            <Text size="lg" fw={600} c="var(--forest-green-primary)">
              {audioProcessedCount}
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