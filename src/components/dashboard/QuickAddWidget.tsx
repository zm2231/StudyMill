'use client';

import { Card, Title, Stack, Button, Grid, Text } from '@mantine/core';
import { 
  IconPlus, 
  IconFileText, 
  IconMicrophone, 
  IconSchool, 
  IconCalendarEvent,
  IconBrain,
  IconNotes
} from '@tabler/icons-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  onClick: () => void;
}

interface QuickAddWidgetProps {
  onOpenDocumentUpload?: () => void;
  onOpenAudioUpload?: () => void;
  onOpenCourseCreation?: () => void;
  onOpenEventCreation?: () => void;
  onOpenNoteCreation?: () => void;
  onOpenFlashcardCreation?: () => void;
}

export function QuickAddWidget({
  onOpenDocumentUpload = () => console.log('Open document upload'),
  onOpenAudioUpload = () => console.log('Open audio upload'),
  onOpenCourseCreation = () => console.log('Open course creation'),
  onOpenEventCreation = () => console.log('Open event creation'),
  onOpenNoteCreation = () => console.log('Open note creation'),
  onOpenFlashcardCreation = () => console.log('Open flashcard creation')
}: QuickAddWidgetProps) {
  
  const quickActions: QuickAction[] = [
    {
      id: 'document',
      label: 'Upload Document',
      description: 'PDF, DOCX, slides',
      icon: IconFileText,
      color: 'blue',
      onClick: onOpenDocumentUpload
    },
    {
      id: 'audio',
      label: 'Record Audio',
      description: 'Voice notes, lectures',
      icon: IconMicrophone,
      color: 'orange',
      onClick: onOpenAudioUpload
    },
    {
      id: 'course',
      label: 'New Course',
      description: 'Organize materials',
      icon: IconSchool,
      color: 'green',
      onClick: onOpenCourseCreation
    },
    {
      id: 'event',
      label: 'Add Event',
      description: 'Schedule, deadlines',
      icon: IconCalendarEvent,
      color: 'purple',
      onClick: onOpenEventCreation
    },
    {
      id: 'note',
      label: 'Quick Note',
      description: 'Ideas, thoughts',
      icon: IconNotes,
      color: 'teal',
      onClick: onOpenNoteCreation
    },
    {
      id: 'flashcard',
      label: 'Flashcards',
      description: 'Study cards',
      icon: IconBrain,
      color: 'red',
      onClick: onOpenFlashcardCreation
    }
  ];

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Title order={4} size="h5">
          <IconPlus size={20} color="var(--forest-green-primary)" style={{ marginRight: '8px' }} />
          Quick Add
        </Title>

        <Grid gutter="xs">
          {quickActions.map((action) => {
            const Icon = action.icon;
            
            return (
              <Grid.Col key={action.id} span={6}>
                <Button
                  variant="light"
                  color={action.color}
                  fullWidth
                  h="auto"
                  p="sm"
                  style={{
                    flexDirection: 'column',
                    gap: '4px',
                    height: '70px'
                  }}
                  onClick={action.onClick}
                >
                  <Icon size={20} />
                  <Stack gap={1} align="center">
                    <Text size="xs" fw={500} ta="center">
                      {action.label}
                    </Text>
                    <Text size="xs" c="dimmed" ta="center" lineClamp={1}>
                      {action.description}
                    </Text>
                  </Stack>
                </Button>
              </Grid.Col>
            );
          })}
        </Grid>

        {/* Popular actions */}
        <Stack gap="xs">
          <Text size="xs" fw={500} c="dimmed">Popular today:</Text>
          <Grid gutter="xs">
            <Grid.Col span={6}>
              <Button 
                variant="outline" 
                size="xs" 
                fullWidth
                leftSection={<IconFileText size={14} />}
                onClick={onOpenDocumentUpload}
              >
                Upload PDF
              </Button>
            </Grid.Col>
            <Grid.Col span={6}>
              <Button 
                variant="outline" 
                size="xs" 
                fullWidth
                leftSection={<IconMicrophone size={14} />}
                onClick={onOpenAudioUpload}
              >
                Record
              </Button>
            </Grid.Col>
          </Grid>
        </Stack>
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Six main quick actions in 2x3 grid layout
// - Color-coded action buttons with icons and descriptions
// - Popular actions section for frequently used features
// - Compact design suitable for right rail widget
// - Callback props for integration with upload modals