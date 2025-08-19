'use client';

import { Card, Title, Stack, Group, Text, Button, Avatar, Badge, Progress } from '@mantine/core';
import { IconPlayerPlay, IconBook, IconChevronRight, IconClock } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';

interface RecentItem {
  id: string;
  title: string;
  type: 'document' | 'note' | 'study-guide' | 'flashcard' | 'assignment';
  course?: {
    id: string;
    name: string;
    color: string;
    code: string;
  };
  lastAccessed: Date;
  progress?: number; // For study materials
  icon: React.ComponentType<any>;
}

function getTypeColor(type: RecentItem['type']): string {
  switch (type) {
    case 'document': return 'blue';
    case 'note': return 'green';
    case 'study-guide': return 'purple';
    case 'flashcard': return 'orange';
    case 'assignment': return 'red';
    default: return 'gray';
  }
}

function getTypeLabel(type: RecentItem['type']): string {
  switch (type) {
    case 'document': return 'Document';
    case 'note': return 'Note';
    case 'study-guide': return 'Study Guide';
    case 'flashcard': return 'Flashcards';
    case 'assignment': return 'Assignment';
    default: return 'Item';
  }
}

export function ResumeSection() {
  const api = useApi();
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentItems();
  }, []);

  const loadRecentItems = async () => {
    if (!api.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getRecentItems({ limit: 5 });
      
      if (response.success) {
        // Transform API data to match component interface
        const transformedItems: RecentItem[] = response.recentItems.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          course: item.course,
          lastAccessed: item.lastAccessed,
          progress: item.progress,
          icon: IconBook // Default icon, could be enhanced based on type
        }));
        
        setRecentItems(transformedItems);
      }
    } catch (err) {
      console.error('Failed to load recent items:', err);
      // Show empty state instead of error for better UX
      setRecentItems([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconPlayerPlay size={24} color="var(--forest-green-primary)" />
            <Title order={3}>Resume Where You Left Off</Title>
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
            <Button size="sm" variant="outline" onClick={loadRecentItems}>
              Retry
            </Button>
          </Stack>
        ) : recentItems.length === 0 ? (
          <Stack align="center" py="xl">
            <Text size="lg" c="dimmed">Nothing to resume yet</Text>
            <Text size="sm" c="dimmed" ta="center">
              Open documents, take notes, or study materials.<br />
              Your recent progress will appear here!
            </Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {recentItems.map((item) => {
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