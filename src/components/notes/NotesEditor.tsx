'use client';

import { useState, useEffect, useCallback } from 'react';
import { TipTapEditor } from '@/components/documents/TipTapEditor';
import { apiClient, Note } from '@/lib/api';
import { notifications } from '@mantine/notifications';
import { 
  Group, 
  TextInput, 
  Button, 
  ActionIcon, 
  Select,
  Badge,
  Stack,
  Text
} from '@mantine/core';
import { IconSave, IconTrash, IconEdit } from '@tabler/icons-react';

interface NotesEditorProps {
  noteId?: string;
  courseId?: string;
  documentId?: string;
  onNoteCreated?: (note: Note) => void;
  onNoteUpdated?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => void;
}

export function NotesEditor({
  noteId,
  courseId,
  documentId,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted
}: NotesEditorProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(!noteId); // New notes start in edit mode
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing note if noteId is provided
  useEffect(() => {
    if (noteId) {
      loadNote(noteId);
    }
  }, [noteId]);

  const loadNote = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiClient.getNote(id);
      if (response.success) {
        const noteData = response.data;
        setNote(noteData);
        setTitle(noteData.title);
        setContent(noteData.content);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to load note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load note',
        color: 'red'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = useCallback(async () => {
    if (!title.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note title is required',
        color: 'orange'
      });
      return;
    }

    try {
      setIsSaving(true);

      if (note?.id) {
        // Update existing note
        const response = await apiClient.updateNote(note.id, {
          title,
          content,
          courseId,
          documentId
        });
        
        if (response.success) {
          setNote(response.data);
          onNoteUpdated?.(response.data);
          notifications.show({
            title: 'Success',
            message: 'Note updated successfully',
            color: 'green'
          });
        }
      } else {
        // Create new note
        const response = await apiClient.createNote({
          title,
          content,
          courseId,
          documentId
        });
        
        if (response.success) {
          setNote(response.data);
          onNoteCreated?.(response.data);
          setIsEditing(false);
          notifications.show({
            title: 'Success',
            message: 'Note created successfully',
            color: 'green'
          });
        }
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save note',
        color: 'red'
      });
    } finally {
      setIsSaving(false);
    }
  }, [note, title, content, courseId, documentId, onNoteCreated, onNoteUpdated]);

  const deleteNote = async () => {
    if (!note?.id) return;

    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.deleteNote(note.id);
      
      if (response.success) {
        onNoteDeleted?.(note.id);
        notifications.show({
          title: 'Success',
          message: 'Note deleted successfully',
          color: 'green'
        });
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete note',
        color: 'red'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save debounced content changes
  const handleContentUpdate = useCallback(async (newContent: string) => {
    setContent(newContent);
    
    // Only auto-save for existing notes when not actively editing title
    if (note?.id && !isEditing && title.trim()) {
      try {
        await apiClient.updateNote(note.id, {
          content: newContent
        });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  }, [note, isEditing, title]);

  if (isLoading) {
    return (
      <Stack align="center" justify="center" style={{ height: '200px' }}>
        <Text>Loading note...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md" style={{ height: '100%' }}>
      {/* Note Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" style={{ flex: 1 }}>
          {isEditing ? (
            <TextInput
              placeholder="Enter note title..."
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              style={{ flex: 1 }}
              size="lg"
              autoFocus={!noteId} // Focus on new notes
            />
          ) : (
            <Text size="lg" fw={600} style={{ flex: 1 }}>
              {title || 'Untitled Note'}
            </Text>
          )}
        </Group>

        <Group gap="xs">
          {note && (
            <>
              {note.course_name && (
                <Badge variant="light" color="blue">
                  {note.course_code || note.course_name}
                </Badge>
              )}
              {note.document_title && (
                <Badge variant="light" color="green">
                  {note.document_title}
                </Badge>
              )}
            </>
          )}

          {isEditing ? (
            <Button
              size="sm"
              leftSection={<IconSave size={16} />}
              onClick={saveNote}
              loading={isSaving}
              disabled={!title.trim()}
            >
              Save
            </Button>
          ) : (
            <ActionIcon
              variant="light"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              <IconEdit size={16} />
            </ActionIcon>
          )}

          {note?.id && (
            <ActionIcon
              variant="light"
              color="red"
              onClick={deleteNote}
              disabled={isLoading}
            >
              <IconTrash size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* TipTap Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TipTapEditor
          content={content}
          onUpdate={handleContentUpdate}
          placeholder="Start writing your notes..."
          editable={true}
        />
      </div>

      {/* Save reminder for unsaved changes */}
      {isEditing && title.trim() && (
        <Group justify="center">
          <Text size="sm" c="dimmed">
            Remember to save your changes
          </Text>
        </Group>
      )}
    </Stack>
  );
}