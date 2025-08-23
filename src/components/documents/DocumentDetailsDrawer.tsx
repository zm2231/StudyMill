'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Button,
  Divider,
  TextInput,
  Textarea,
  ActionIcon,
  Box
} from '@mantine/core';
import {
  IconFile,
  IconCalendar,
  IconDatabase,
  IconEdit,
  IconCheck,
  IconX,
  IconDownload,
  IconTrash,
  IconEye
} from '@tabler/icons-react';
import { TagSelector } from '../tags/TagSelector';
import { notifications } from '@mantine/notifications';

interface DocumentDetails {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  course_id: string;
  course_name?: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
  description?: string;
  tags?: string[];
}

interface DocumentDetailsDrawerProps {
  opened: boolean;
  onClose: () => void;
  document: DocumentDetails | null;
  onUpdate?: () => void;
  onDelete?: () => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function DocumentDetailsDrawer({
  opened,
  onClose,
  document,
  onUpdate,
  onDelete
}: DocumentDetailsDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (document) {
      setEditedName(document.filename);
      setEditedDescription(document.description || '');
      setSelectedTags(document.tags || []);
      fetchDocumentTags();
    }
  }, [document]);

  const fetchDocumentTags = async () => {
    if (!document) return;

    try {
      const { api } = await import('@/lib/api');
      const data = await api.request<{ tags: any[] }>(`/api/v1/documents/${document.id}/tags`);
      setSelectedTags(data.tags.map((t: any) => t.id));
    } catch (error) {
      console.error('Failed to fetch document tags:', error);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      // Update document details
      const { api } = await import('@/lib/api');
      await api.request(`/api/v1/documents/${document.id}`, {
        method: 'PATCH',
        body: {
          filename: editedName,
          description: editedDescription
        }
      });

      // Update tags
      await api.request(`/api/v1/documents/${document.id}/tags`, {
        method: 'POST',
        body: {
          tagIds: selectedTags
        }
      });

      notifications.show({
        title: 'Success',
        message: 'Document updated successfully',
        color: 'green'
      });

      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update document',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!document) return;

    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const { api } = await import('@/lib/api');
      await api.request(`/api/v1/documents/${document.id}`, {
        method: 'DELETE'
      });

      notifications.show({
        title: 'Success',
        message: 'Document deleted successfully',
        color: 'green'
      });
      onDelete?.();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete document',
        color: 'red'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!document) return;
    // TODO: Implement download functionality
    window.open(`/api/documents/${document.id}/download`, '_blank');
  };

  const handleView = () => {
    if (!document) return;
    window.open(`/documents/${document.id}`, '_blank');
  };

  if (!document) return null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Document Details"
      position="right"
      size="md"
      padding="lg"
    >
      <Stack gap="md">
        {/* Document Name */}
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">Name</Text>
            {!isEditing && (
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => setIsEditing(true)}
              >
                <IconEdit size={16} />
              </ActionIcon>
            )}
          </Group>
          {isEditing ? (
            <TextInput
              value={editedName}
              onChange={(e) => setEditedName(e.currentTarget.value)}
              placeholder="Document name"
            />
          ) : (
            <Text fw={500}>{document.filename}</Text>
          )}
        </div>

        {/* Description */}
        <div>
          <Text size="sm" fw={500} c="dimmed" mb="xs">Description</Text>
          {isEditing ? (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.currentTarget.value)}
              placeholder="Add a description..."
              rows={3}
            />
          ) : (
            <Text size="sm" c={editedDescription ? undefined : 'dimmed'}>
              {editedDescription || 'No description'}
            </Text>
          )}
        </div>

        {/* Tags */}
        <div>
          <Text size="sm" fw={500} c="dimmed" mb="xs">Tags</Text>
          {isEditing ? (
            <TagSelector
              value={selectedTags}
              onChange={setSelectedTags}
              placeholder="Add tags..."
            />
          ) : (
            <Group gap="xs">
              {selectedTags.length > 0 ? (
                selectedTags.map(tagId => (
                  <Badge key={tagId} size="sm" variant="light">
                    {tagId}
                  </Badge>
                ))
              ) : (
                <Text size="sm" c="dimmed">No tags</Text>
              )}
            </Group>
          )}
        </div>

        {/* Edit Actions */}
        {isEditing && (
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                setIsEditing(false);
                setEditedName(document.filename);
                setEditedDescription(document.description || '');
                setSelectedTags(document.tags || []);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              leftSection={<IconCheck size={16} />}
            >
              Save Changes
            </Button>
          </Group>
        )}

        <Divider />

        {/* File Information */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Type</Text>
            <Badge variant="light">{document.file_type}</Badge>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Size</Text>
            <Text size="sm">{formatFileSize(document.file_size)}</Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Course</Text>
            <Text size="sm">{document.course_name || 'Unknown'}</Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Status</Text>
            <Badge
              variant="light"
              color={
                document.processing_status === 'completed' ? 'green' :
                document.processing_status === 'processing' ? 'blue' :
                document.processing_status === 'error' ? 'red' : 'gray'
              }
            >
              {document.processing_status}
            </Badge>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Created</Text>
            <Text size="sm">{formatDate(document.created_at)}</Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Modified</Text>
            <Text size="sm">{formatDate(document.updated_at)}</Text>
          </Group>
        </Stack>

        <Divider />

        {/* Actions */}
        <Stack gap="sm">
          <Button
            variant="light"
            leftSection={<IconEye size={16} />}
            onClick={handleView}
            fullWidth
          >
            View Document
          </Button>
          
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={handleDownload}
            fullWidth
          >
            Download
          </Button>

          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleDelete}
            loading={deleting}
            fullWidth
          >
            Delete Document
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}