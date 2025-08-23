'use client';

import { useState, useEffect } from 'react';
import {
  MultiSelect,
  Badge,
  Group,
  ActionIcon,
  Modal,
  TextInput,
  ColorInput,
  Button,
  Stack,
  Text
} from '@mantine/core';
import { IconPlus, IconTag, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Tag {
  id: string;
  name: string;
  color: string;
  document_count?: number;
}

interface TagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

const PRESET_TAG_COLORS = [
  '#4A7C2A', // Forest green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6b7280', // Gray
];

export function TagSelector({
  value,
  onChange,
  placeholder = 'Select tags',
  label = 'Tags',
  required = false,
  disabled = false,
  error
}: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { api } = await import('../../lib/api');
      const data = await api.request<{ tags: Tag[] }>('/api/v1/tags');
      setTags(data.tags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load tags',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Tag name is required',
        color: 'red'
      });
      return;
    }

    // Check if tag already exists
    if (tags.some(tag => tag.name.toLowerCase() === newTagName.toLowerCase())) {
      notifications.show({
        title: 'Error',
        message: 'Tag already exists',
        color: 'orange'
      });
      return;
    }

    setCreating(true);
    try {
      const { api } = await import('../../lib/api');
      const data = await api.request<{ tag: Tag }>('/api/v1/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor
        })
      });

      setTags([...tags, data.tag]);
      onChange([...value, data.tag.id]);
      setShowCreateModal(false);
      setNewTagName('');
      setNewTagColor(PRESET_TAG_COLORS[0]);
      
      notifications.show({
        title: 'Success',
        message: 'Tag created successfully',
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create tag',
        color: 'red'
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all documents.')) {
      return;
    }

    try {
      const { api } = await import('@/lib/api');
      await api.request(`/api/v1/tags/${tagId}`, {
        method: 'DELETE'
      });
      
      setTags(tags.filter(t => t.id !== tagId));
      onChange(value.filter(id => id !== tagId));
        
        notifications.show({
          title: 'Success',
          message: 'Tag deleted successfully',
          color: 'green'
        });
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to delete tag',
          color: 'red'
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete tag',
        color: 'red'
      });
    }
  };

  // Transform tags for MultiSelect
  const selectData = tags.map(tag => ({
    value: tag.id,
    label: tag.name,
    group: tag.document_count && tag.document_count > 0 ? 'Used Tags' : 'Available Tags'
  }));

  // Custom item component to show tag color
  const renderSelectOption = ({ option }: any) => {
    const tag = tags.find(t => t.id === option.value);
    if (!tag) return option.label;

    return (
      <Group gap="xs">
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: tag.color,
            flexShrink: 0
          }}
        />
        <Text size="sm">{tag.name}</Text>
        {tag.document_count ? (
          <Text size="xs" c="dimmed">({tag.document_count})</Text>
        ) : null}
      </Group>
    );
  };

  // Custom value component to show colored badges
  const renderValue = (item: any) => {
    const tag = tags.find(t => t.id === item.value);
    if (!tag) return null;

    return (
      <Badge
        size="sm"
        variant="light"
        style={{
          backgroundColor: tag.color + '20',
          color: tag.color
        }}
        rightSection={
          <ActionIcon
            size="xs"
            variant="transparent"
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter(v => v !== tag.id));
            }}
          >
            <IconX size={12} />
          </ActionIcon>
        }
      >
        {tag.name}
      </Badge>
    );
  };

  return (
    <>
      <Group gap="xs" grow>
        <MultiSelect
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          data={selectData}
          searchable
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          disabled={disabled || loading}
          error={error}
          required={required}
          leftSection={<IconTag size={16} />}
          nothingFoundMessage={
            searchValue ? (
              <Group gap="xs">
                <Text size="sm" c="dimmed">No tags found.</Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => {
                    setNewTagName(searchValue);
                    setShowCreateModal(true);
                  }}
                >
                  Create "{searchValue}"
                </Button>
              </Group>
            ) : 'No tags available'
          }
          renderOption={renderSelectOption}
          valueComponent={renderValue}
          clearable
          maxDropdownHeight={300}
        />
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowCreateModal(true)}
          style={{ alignSelf: 'flex-end', width: 'auto' }}
          disabled={disabled}
        >
          New Tag
        </Button>
      </Group>

      {/* Create Tag Modal */}
      <Modal
        opened={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewTagName('');
          setNewTagColor(PRESET_TAG_COLORS[0]);
        }}
        title="Create New Tag"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Tag Name"
            placeholder="e.g., Important, To Review, Chapter 1"
            value={newTagName}
            onChange={(e) => setNewTagName(e.currentTarget.value)}
            required
            maxLength={50}
          />
          
          <ColorInput
            label="Tag Color"
            value={newTagColor}
            onChange={setNewTagColor}
            swatches={PRESET_TAG_COLORS}
            format="hex"
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                setShowCreateModal(false);
                setNewTagName('');
                setNewTagColor(PRESET_TAG_COLORS[0]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTag}
              loading={creating}
              disabled={!newTagName.trim()}
            >
              Create Tag
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}