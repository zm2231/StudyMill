'use client';

import { useState } from 'react';
import { 
  Group, 
  Text, 
  TextInput,
  Badge,
  Button,
  ActionIcon,
  Menu,
  Box
} from '@mantine/core';
import { 
  IconEdit,
  IconExternalLink,
  IconDots,
  IconDownload,
  IconShare,
  IconTrash,
  IconTag,
  IconClock,
  IconCheck,
  IconX,
  IconAlertCircle
} from '@tabler/icons-react';

interface DocumentHeaderProps {
  title: string;
  course?: {
    name: string;
    color: string;
    code: string;
  };
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  canEdit?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onEditHere?: () => void;
  onOpenExternally?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onAddTags?: () => void;
}

export function DocumentHeader({
  title,
  course,
  syncStatus,
  canEdit = false,
  onTitleChange,
  onEditHere,
  onOpenExternally,
  onDownload,
  onShare,
  onDelete,
  onAddTags
}: DocumentHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);

  const handleTitleEdit = () => {
    if (canEdit) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (titleValue !== title) {
      onTitleChange?.(titleValue);
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setTitleValue(title);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleTitleSave();
    } else if (event.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <IconCheck size={16} color="var(--mantine-color-green-6)" />;
      case 'syncing':
        return <IconClock size={16} color="var(--mantine-color-blue-6)" />;
      case 'error':
        return <IconAlertCircle size={16} color="var(--mantine-color-red-6)" />;
      case 'offline':
        return <IconX size={16} color="var(--mantine-color-gray-6)" />;
    }
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync error';
      case 'offline':
        return 'Offline';
    }
  };

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'synced':
        return 'green';
      case 'syncing':
        return 'blue';
      case 'error':
        return 'red';
      case 'offline':
        return 'gray';
    }
  };

  return (
    <Box
      p="md"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        backgroundColor: 'var(--sanctuary-card)'
      }}
    >
      <Group justify="space-between" align="center">
        {/* Left Section: Title and Course */}
        <Group gap="md" style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            {isEditingTitle ? (
              <Group gap="xs">
                <TextInput
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleKeyDown}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <ActionIcon
                  variant="outline"
                  color="green"
                  size="sm"
                  onClick={handleTitleSave}
                >
                  <IconCheck size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="outline"
                  color="gray"
                  size="sm"
                  onClick={handleTitleCancel}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <Group gap="xs" onClick={handleTitleEdit} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                <Text 
                  size="lg" 
                  fw={600}
                  style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {title}
                </Text>
                {canEdit && (
                  <ActionIcon variant="subtle" size="sm">
                    <IconEdit size={14} />
                  </ActionIcon>
                )}
              </Group>
            )}
          </Box>

          {/* Course Chip */}
          {course && (
            <Badge
              color={course.color}
              variant="light"
              size="lg"
              style={{ textTransform: 'none' }}
            >
              {course.code}
            </Badge>
          )}

          {/* Sync Status */}
          <Badge
            leftSection={getSyncStatusIcon()}
            color={getSyncStatusColor()}
            variant="light"
            size="sm"
          >
            {getSyncStatusText()}
          </Badge>
        </Group>

        {/* Right Section: Actions */}
        <Group gap="xs">
          {/* Edit Here Button */}
          {canEdit && onEditHere && (
            <Button
              variant="outline"
              size="sm"
              leftSection={<IconEdit size={16} />}
              onClick={onEditHere}
            >
              Edit Here
            </Button>
          )}

          {/* Open Externally Button */}
          {onOpenExternally && (
            <Button
              variant="outline"
              size="sm"
              leftSection={<IconExternalLink size={16} />}
              onClick={onOpenExternally}
            >
              Open Externally
            </Button>
          )}

          {/* More Actions Menu */}
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="outline">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Actions</Menu.Label>
              
              {onDownload && (
                <Menu.Item
                  leftSection={<IconDownload size={16} />}
                  onClick={onDownload}
                >
                  Download
                </Menu.Item>
              )}
              
              {onShare && (
                <Menu.Item
                  leftSection={<IconShare size={16} />}
                  onClick={onShare}
                >
                  Share
                </Menu.Item>
              )}
              
              {onAddTags && (
                <Menu.Item
                  leftSection={<IconTag size={16} />}
                  onClick={onAddTags}
                >
                  Add Tags
                </Menu.Item>
              )}

              {onDelete && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTrash size={16} />}
                    color="red"
                    onClick={onDelete}
                  >
                    Delete
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Box>
  );
}

// Phase 1 Integration Notes:
// - Document header with title (editable when TipTap), course chip, SyncStatus
// - [Edit Here] and [Open Externally] action buttons as specified
// - Kebab menu with additional actions (Download, Share, Add Tags, Delete)
// - Sync status indicator with proper icons and colors
// - Editable title functionality with save/cancel actions
// - Component spec compliance: proper spacing and interactive elements
// - Responsive layout that accommodates long titles and multiple elements
// - Visual feedback for hover states and edit mode