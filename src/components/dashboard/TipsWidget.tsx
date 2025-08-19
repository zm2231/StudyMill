'use client';

import { useState } from 'react';
import { Card, Title, Stack, Group, Text, Button, ActionIcon } from '@mantine/core';
import { IconBulb, IconChevronRight, IconChevronLeft, IconX } from '@tabler/icons-react';

interface StudyTip {
  id: string;
  title: string;
  content: string;
  category: 'productivity' | 'memory' | 'organization' | 'wellbeing' | 'study-techniques';
  icon: string;
}

// Study tips database - could be dynamic/personalized
const STUDY_TIPS: StudyTip[] = [
  {
    id: '1',
    title: 'The 2-Minute Rule',
    content: 'If a study task takes less than 2 minutes, do it immediately instead of adding it to your to-do list.',
    category: 'productivity',
    icon: '⚡'
  },
  {
    id: '2',
    title: 'Active Recall',
    content: 'Test yourself regularly instead of just re-reading notes. Quiz yourself to strengthen memory pathways.',
    category: 'memory',
    icon: '🧠'
  },
  {
    id: '3',
    title: 'Study Environment',
    content: 'Create a dedicated study space that signals to your brain it\'s time to focus. Consistency matters.',
    category: 'organization',
    icon: '🏠'
  },
  {
    id: '4',
    title: 'Pomodoro Technique',
    content: 'Work for 25 minutes, then take a 5-minute break. This helps maintain focus and prevents burnout.',
    category: 'productivity',
    icon: '🍅'
  },
  {
    id: '5',
    title: 'Spaced Repetition',
    content: 'Review material at increasing intervals (1 day, 3 days, 1 week, 2 weeks) for long-term retention.',
    category: 'memory',
    icon: '📅'
  },
  {
    id: '6',
    title: 'Hydration Matters',
    content: 'Stay hydrated while studying. Even mild dehydration can impair cognitive function and concentration.',
    category: 'wellbeing',
    icon: '💧'
  },
  {
    id: '7',
    title: 'Feynman Technique',
    content: 'Explain concepts in simple terms as if teaching someone else. This reveals gaps in understanding.',
    category: 'study-techniques',
    icon: '👨‍🏫'
  },
  {
    id: '8',
    title: 'Color Coding',
    content: 'Use consistent colors for different subjects or types of information to improve visual organization.',
    category: 'organization',
    icon: '🎨'
  }
];

function getCategoryColor(category: StudyTip['category']): string {
  switch (category) {
    case 'productivity': return 'green';
    case 'memory': return 'blue';
    case 'organization': return 'purple';
    case 'wellbeing': return 'orange';
    case 'study-techniques': return 'teal';
    default: return 'gray';
  }
}

export function TipsWidget() {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);
  
  const availableTips = STUDY_TIPS.filter(tip => !dismissedTips.includes(tip.id));
  const currentTip = availableTips[currentTipIndex];

  const nextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % availableTips.length);
  };

  const prevTip = () => {
    setCurrentTipIndex((prev) => (prev - 1 + availableTips.length) % availableTips.length);
  };

  const dismissTip = () => {
    if (currentTip) {
      setDismissedTips(prev => [...prev, currentTip.id]);
      // Move to next tip if current one is dismissed
      if (availableTips.length > 1) {
        setCurrentTipIndex(prev => prev % (availableTips.length - 1));
      }
    }
  };

  if (!currentTip || availableTips.length === 0) {
    return (
      <Card withBorder p="lg" radius="md">
        <Stack align="center" py="md">
          <Text size="sm" c="dimmed">All tips viewed!</Text>
          <Button 
            size="xs" 
            variant="light" 
            onClick={() => setDismissedTips([])}
          >
            Reset Tips
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4} size="h5">
            <IconBulb size={20} color="var(--warm-sand)" style={{ marginRight: '8px' }} />
            Study Tips
          </Title>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={dismissTip}
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>

        <Stack gap="sm">
          <Group gap="sm" align="flex-start">
            <Text size="xl">{currentTip.icon}</Text>
            <Stack gap="xs" style={{ flex: 1 }}>
              <Text fw={600} size="sm">
                {currentTip.title}
              </Text>
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.5 }}>
                {currentTip.content}
              </Text>
            </Stack>
          </Group>

          {/* Category badge */}
          <Group justify="space-between" align="center">
            <Text 
              size="xs" 
              fw={500} 
              c={getCategoryColor(currentTip.category)}
              tt="uppercase"
              style={{ letterSpacing: '0.5px' }}
            >
              {currentTip.category.replace('-', ' ')}
            </Text>
            
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {currentTipIndex + 1} of {availableTips.length}
              </Text>
            </Group>
          </Group>
        </Stack>

        {/* Navigation */}
        {availableTips.length > 1 && (
          <Group justify="space-between">
            <ActionIcon
              variant="light"
              color="gray"
              size="sm"
              onClick={prevTip}
            >
              <IconChevronLeft size={14} />
            </ActionIcon>

            <Button 
              variant="light" 
              size="xs"
              rightSection={<IconChevronRight size={12} />}
              onClick={nextTip}
            >
              Next Tip
            </Button>
          </Group>
        )}

        {/* Quick stats */}
        <Group justify="center" p="sm" style={{ backgroundColor: 'var(--sanctuary-surface)', borderRadius: '6px' }}>
          <Stack gap={1} align="center">
            <Text size="sm" fw={600} c="var(--warm-brown)">
              {STUDY_TIPS.length - dismissedTips.length}
            </Text>
            <Text size="xs" c="dimmed">Tips Left</Text>
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Rotating study tips with navigation controls
// - Category-based color coding and organization
// - Dismissible tips with progress tracking
// - Emoji icons for visual appeal
// - Reset functionality for revisiting tips
// - Compact design suitable for dashboard widget