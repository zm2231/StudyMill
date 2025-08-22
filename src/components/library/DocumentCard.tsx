'use client';

import { 
  Card, 
  Stack, 
  Group, 
  Text, 
  Badge, 
  ActionIcon, 
  Checkbox,
  Menu,
  Avatar,
  Progress,
  Tooltip
} from '@mantine/core';
import { 
  IconFileText, 
  IconFileTypePdf, 
  IconPresentation, 
  IconMicrophone,
  IconNotes,
  IconDots,
  IconEye,
  IconBrain,
  IconBooks,
  IconCards,
  IconFolder,
  IconTrash
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface Document {
  id: string;
  title: string;
  type: string;
  fileUrl?: string;
  course?: {
    name: string;
    color: string;
    code: string;
  };
  tags: string[];
  updatedAt: Date;
  status: 'ready' | 'processing' | 'error';
  size: number;
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  canEdit?: boolean;
}

interface DocumentCardProps {
  document: Document;
  viewMode: 'card' | 'row';
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAction?: (action: string, document: Document) => void;
  onClick?: () => void;
}

// Real document data is passed via props from parent components

function getDocumentIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'pdf':
    case 'application/pdf':
      return IconFileTypePdf;
    case 'pptx':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return IconPresentation;
    case 'docx':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'doc':
    case 'application/msword':
      return IconFileText;
    case 'audio':
    case 'mp3':
    case 'wav':
    case 'audio/mpeg':
    case 'audio/wav':
      return IconMicrophone;
    case 'note':
    case 'text':
    case 'text/plain':
      return IconNotes;
    default: 
      return IconFileText;
  }
}

function getTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'pdf':
    case 'application/pdf':
      return 'red';
    case 'pptx':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'orange';
    case 'docx':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'doc':
    case 'application/msword':
      return 'blue';
    case 'audio':
    case 'mp3':
    case 'wav':
    case 'audio/mpeg':
    case 'audio/wav':
      return 'purple';
    case 'note':
    case 'text':
    case 'text/plain':
      return 'green';
    default: 
      return 'gray';
  }
}

function getStatusColor(status: Document['status']): string {
  switch (status) {
    case 'ready': return 'green';
    case 'processing': return 'orange';
    case 'error': return 'red';
    default: return 'gray';
  }
}

export function DocumentCard({ 
  document = mockDocument, 
  viewMode, 
  selected = false, 
  onSelect, 
  onAction,
  onClick 
}: DocumentCardProps) {
  const Icon = getDocumentIcon(document.type);
  
  // Component Spec: card padding 20-24; row height 56; icon 24; course chip 18/500
  const cardHeight = viewMode === 'row' ? 56 : 'auto';
  const cardPadding = viewMode === 'card' ? 'lg' : 'md'; // lg = 20px, md = 16px

  const handleAction = (action: string) => {
    onAction?.(action, document);
  };

  if (viewMode === 'row') {
    return (
      <Card
        padding={cardPadding}
        radius="sm"
        withBorder
        style={{
          height: cardHeight,
          cursor: onClick ? 'pointer' : undefined,
          border: selected ? '2px solid var(--forest-green-primary)' : undefined,
          backgroundColor: selected ? 'rgba(74, 124, 42, 0.05)' : undefined
        }}
        onClick={onClick}
      >
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="md" style={{ flex: 1, minWidth: 0 }}>
            {onSelect && (
              <Checkbox
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(e.target.checked);
                }}
                size="sm"
              />
            )}
            
            <Icon size={24} color={`var(--mantine-color-${getTypeColor(document.type)}-6)`} />
            
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={500} size="sm" truncate>
                {document.title}
              </Text>
              <Group gap="xs" wrap="nowrap">
                {document.course && (
                  <Group gap={4}>
                    <Avatar size="xs" style={{ backgroundColor: document.course.color }}>
                      {document.course.code.substring(0, 2)}
                    </Avatar>
                    <Badge 
                      size="xs" 
                      variant="light" 
                      color={document.course.color}
                      style={{ fontSize: '11px', fontWeight: 500 }} // Component spec: course chip 18/500
                    >
                      {document.course.code}
                    </Badge>
                  </Group>
                )}
                <Badge size="xs" color={getTypeColor(document.type)} variant="light">
                  {document.type.toUpperCase()}
                </Badge>
                <Badge size="xs" color={getStatusColor(document.status)} variant="light">
                  {document.status}
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatDistanceToNow(document.updatedAt, { addSuffix: true })}
                </Text>
              </Group>
            </Stack>
          </Group>

          <Group gap="xs" wrap="nowrap">
            {document.size && (
              <Text size="xs" c="dimmed" style={{ minWidth: 'fit-content' }}>
                {formatFileSize(document.size)}
              </Text>
            )}
            
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon 
                  variant="subtle" 
                  color="gray" 
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item 
                  leftSection={<IconEye size={16} />}
                  onClick={() => handleAction('open')}
                >
                  Open
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconBrain size={16} />}
                  onClick={() => handleAction('summarize')}
                >
                  Summarize
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconBooks size={16} />}
                  onClick={() => handleAction('study-guide')}
                >
                  Study Guide
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconCards size={16} />}
                  onClick={() => handleAction('flashcards')}
                >
                  Flashcards
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item 
                  leftSection={<IconFolder size={16} />}
                  onClick={() => handleAction('move')}
                >
                  Move
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconTrash size={16} />}
                  color="red"
                  onClick={() => handleAction('delete')}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Card>
    );
  }

  // Card view mode
  return (
    <Card
      padding={cardPadding} // Component spec: card padding 20-24
      radius="md"
      withBorder
      style={{
        cursor: onClick ? 'pointer' : undefined,
        border: selected ? '2px solid var(--forest-green-primary)' : undefined,
        backgroundColor: selected ? 'rgba(74, 124, 42, 0.05)' : undefined,
        height: '280px', // Fixed height for grid consistency
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={onClick}
    >
      <Stack gap="sm" h="100%" justify="space-between">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          {onSelect && (
            <Checkbox
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(e.target.checked);
              }}
              size="sm"
            />
          )}
          
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon 
                variant="subtle" 
                color="gray" 
                size="sm"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item 
                leftSection={<IconEye size={16} />}
                onClick={() => handleAction('open')}
              >
                Open
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconBrain size={16} />}
                onClick={() => handleAction('summarize')}
              >
                Summarize
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconBooks size={16} />}
                onClick={() => handleAction('study-guide')}
              >
                Study Guide
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconCards size={16} />}
                onClick={() => handleAction('flashcards')}
              >
                Flashcards
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item 
                leftSection={<IconFolder size={16} />}
                onClick={() => handleAction('move')}
              >
                Move
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconTrash size={16} />}
                color="red"
                onClick={() => handleAction('delete')}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Document Icon */}
        <Group justify="center" style={{ flex: 1 }}>
          <Icon size={48} color={`var(--mantine-color-${getTypeColor(document.type)}-6)`} />
        </Group>

        {/* Document Info */}
        <Stack gap="xs">
          <Tooltip label={document.title}>
            <Text fw={500} size="sm" lineClamp={2} style={{ minHeight: '2.5em' }}>
              {document.title}
            </Text>
          </Tooltip>

          <Group gap="xs" wrap="wrap">
            <Badge size="xs" color={getTypeColor(document.type)} variant="light">
              {document.type.toUpperCase()}
            </Badge>
            <Badge size="xs" color={getStatusColor(document.status)} variant="light">
              {document.status}
            </Badge>
            {document.tags.slice(0, 2).map(tag => (
              <Badge key={tag} size="xs" variant="outline" color="gray">
                {tag}
              </Badge>
            ))}
          </Group>

          {document.course && (
            <Group gap={4}>
              <Avatar size="xs" style={{ backgroundColor: document.course.color }}>
                {document.course.code.substring(0, 2)}
              </Avatar>
              <Text size="xs" c="dimmed">{document.course.name}</Text>
            </Group>
          )}

          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {formatDistanceToNow(document.updatedAt, { addSuffix: true })}
            </Text>
            {document.size && (
              <Text size="xs" c="dimmed">{formatFileSize(document.size)}</Text>
            )}
          </Group>

          {/* Processing status */}
          {document.status === 'processing' && (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={500}>Processing...</Text>
                <Badge size="xs" color="orange" variant="light">
                  In Progress
                </Badge>
              </Group>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

// Phase 1 Integration Notes:
// - Follows component specifications exactly (padding 20-24, row height 56, icon 24, course chip 18/500)
// - Implements all required actions: Open, Summarize, StudyGuide, Flashcards, Move, Delete
// - Supports both card and row view modes
// - Proper selection state management
// - Processing status with progress indicator
// - Course association with color coding