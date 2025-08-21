'use client';

import { useState, useEffect } from 'react';
import { 
  Stack, 
  Group, 
  Button, 
  TextInput, 
  Select, 
  Card, 
  Text, 
  Badge, 
  ActionIcon,
  Modal,
  Grid,
  Pagination,
  Box
} from '@mantine/core';
import { 
  IconPlus, 
  IconSearch, 
  IconEdit, 
  IconTrash,
  IconFileText,
  IconCalendar
} from '@tabler/icons-react';
import { apiClient, Note } from '@/lib/api';
import { NotesEditor } from './NotesEditor';
import { notifications } from '@mantine/notifications';

interface NotesManagerProps {
  courseId?: string;
  documentId?: string;
}

export function NotesManager({ courseId, documentId }: NotesManagerProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    loadNotes();
  }, [courseId, documentId, searchQuery, selectedCourseFilter, currentPage]);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getNotes({
        courseId: selectedCourseFilter || courseId,
        documentId,
        search: searchQuery || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      });

      if (response.success) {
        setNotes(response.data);
        // Calculate total pages (this would ideally come from the API)
        setTotalPages(Math.ceil(response.data.length / pageSize));
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load notes',
        color: 'red'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openNewNote = () => {
    setSelectedNoteId(null);
    setIsEditorOpen(true);
  };

  const openEditNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setIsEditorOpen(true);
  };

  const handleNoteCreated = (note: Note) => {
    setNotes(prev => [note, ...prev]);
    setIsEditorOpen(false);
  };

  const handleNoteUpdated = (updatedNote: Note) => {
    setNotes(prev => prev.map(note => 
      note.id === updatedNote.id ? updatedNote : note
    ));
    setIsEditorOpen(false);
  };

  const handleNoteDeleted = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setIsEditorOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Text size="xl" fw={600}>
          My Notes
        </Text>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={openNewNote}
        >
          New Note
        </Button>
      </Group>

      {/* Filters */}
      <Group gap="md">
        <TextInput
          placeholder="Search notes..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        {!courseId && (
          <Select
            placeholder="Filter by course"
            value={selectedCourseFilter}
            onChange={setSelectedCourseFilter}
            data={[
              { value: '', label: 'All courses' },
              // TODO: Load actual courses from API
            ]}
            clearable
          />
        )}
      </Group>

      {/* Notes List */}
      {isLoading ? (
        <Text>Loading notes...</Text>
      ) : notes.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconFileText size={48} style={{ opacity: 0.5 }} />
            <Text size="lg" c="dimmed">
              {searchQuery || selectedCourseFilter 
                ? 'No notes found matching your criteria'
                : 'No notes yet'
              }
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {searchQuery || selectedCourseFilter
                ? 'Try adjusting your search or filter settings'
                : 'Create your first note to get started'
              }
            </Text>
            {!searchQuery && !selectedCourseFilter && (
              <Button onClick={openNewNote}>
                Create First Note
              </Button>
            )}
          </Stack>
        </Card>
      ) : (
        <Grid>
          {notes.map((note) => (
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} key={note.id}>
              <Card withBorder padding="md" style={{ height: '200px', display: 'flex', flexDirection: 'column' }}>
                {/* Note Header */}
                <Group justify="space-between" mb="xs">
                  <Text fw={600} lineClamp={1}>
                    {note.title}
                  </Text>
                  <Group gap={4}>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => openEditNote(note.id)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Note Content Preview */}
                <Text size="sm" c="dimmed" style={{ flex: 1 }} lineClamp={3}>
                  {note.content_preview}
                </Text>

                {/* Note Metadata */}
                <Stack gap="xs" mt="md">
                  <Group gap="xs">
                    {note.course_name && (
                      <Badge size="xs" variant="light" color="blue">
                        {note.course_code || note.course_name}
                      </Badge>
                    )}
                    {note.document_title && (
                      <Badge size="xs" variant="light" color="green">
                        Doc
                      </Badge>
                    )}
                  </Group>
                  
                  <Group gap={4}>
                    <IconCalendar size={12} />
                    <Text size="xs" c="dimmed">
                      {formatDate(note.updated_at)}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            value={currentPage}
            onChange={setCurrentPage}
            total={totalPages}
          />
        </Group>
      )}

      {/* Note Editor Modal */}
      <Modal
        opened={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        size="xl"
        title={selectedNoteId ? 'Edit Note' : 'New Note'}
        style={{ height: '80vh' }}
      >
        <Box style={{ height: 'calc(80vh - 120px)' }}>
          <NotesEditor
            noteId={selectedNoteId || undefined}
            courseId={courseId}
            documentId={documentId}
            onNoteCreated={handleNoteCreated}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
          />
        </Box>
      </Modal>
    </Stack>
  );
}