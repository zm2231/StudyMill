'use client';

import { 
  Paper, 
  Group, 
  Text, 
  Button, 
  ActionIcon,
  Menu,
  Divider
} from '@mantine/core';
import { 
  IconX, 
  IconBrain, 
  IconBooks, 
  IconCards, 
  IconFolder, 
  IconTrash,
  IconDownload,
  IconShare,
  IconTag,
  IconChevronDown
} from '@tabler/icons-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onAction: (action: string) => void;
  onClear: () => void;
}

export function BulkActionsBar({ selectedCount, onAction, onClear }: BulkActionsBarProps) {
  const bulkActions = [
    { 
      id: 'summarize', 
      label: 'Summarize All', 
      icon: IconBrain, 
      color: 'blue',
      description: 'Generate summaries for selected documents'
    },
    { 
      id: 'study-guide', 
      label: 'Study Guide', 
      icon: IconBooks, 
      color: 'purple',
      description: 'Create study guide from selected materials'
    },
    { 
      id: 'flashcards', 
      label: 'Flashcards', 
      icon: IconCards, 
      color: 'orange',
      description: 'Generate flashcards from selected content'
    }
  ];

  const organizationActions = [
    { id: 'move', label: 'Move to Course', icon: IconFolder },
    { id: 'tag', label: 'Add Tags', icon: IconTag },
    { id: 'download', label: 'Download', icon: IconDownload },
    { id: 'share', label: 'Share', icon: IconShare }
  ];

  return (
    <Paper
      p="md"
      withBorder
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        backgroundColor: 'var(--sanctuary-card)',
        border: '2px solid var(--forest-green-primary)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '600px'
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md">
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {selectedCount} document{selectedCount !== 1 ? 's' : ''} selected
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onClear}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>

          <Divider orientation="vertical" />

          {/* AI Actions */}
          <Group gap="xs">
            {bulkActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="light"
                  color={action.color}
                  size="sm"
                  leftSection={<Icon size={16} />}
                  onClick={() => onAction(action.id)}
                >
                  {action.label}
                </Button>
              );
            })}
          </Group>

          <Divider orientation="vertical" />

          {/* Organization Actions */}
          <Menu shadow="md" width={200} position="top">
            <Menu.Target>
              <Button
                variant="outline"
                color="gray"
                size="sm"
                rightSection={<IconChevronDown size={16} />}
              >
                More Actions
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Organization</Menu.Label>
              {organizationActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Menu.Item
                    key={action.id}
                    leftSection={<Icon size={16} />}
                    onClick={() => onAction(action.id)}
                  >
                    {action.label}
                  </Menu.Item>
                );
              })}
              
              <Menu.Divider />
              
              <Menu.Item
                leftSection={<IconTrash size={16} />}
                color="red"
                onClick={() => onAction('delete')}
              >
                Delete Selected
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Quick Stats */}
        <Group gap="sm">
          <Text size="xs" c="dimmed">
            Ready for AI processing
          </Text>
        </Group>
      </Group>
    </Paper>
  );
}

// Phase 1 Integration Notes:
// - Fixed position bulk actions bar that appears when documents are selected
// - AI-powered actions (Summarize, Study Guide, Flashcards) prominently displayed
// - Organization actions in dropdown menu
// - Delete action clearly separated and marked as destructive
// - Visual feedback with forest green border and shadow
// - Responsive design with clear visual hierarchy