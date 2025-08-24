'use client';

import { 
  Box, 
  Text, 
  Button, 
  Stack, 
  Group,
  Card,
  Badge,
  Title,
  ThemeIcon
} from '@mantine/core';
import { 
  IconSchool, 
  IconPlus, 
  IconFileText,
  IconMicrophone,
  IconBook,
  IconArrowRight,
  IconSparkles
} from '@tabler/icons-react';

interface EmptyStateProps {
  type: 'courses' | 'memories' | 'search-results';
  onCreateCourse?: () => void;
  onUploadDocument?: () => void;
  onUploadAudio?: () => void;
  searchTerm?: string;
}

/**
 * Comprehensive empty state component for different library scenarios
 */
export function EmptyState({ 
  type, 
  onCreateCourse, 
  onUploadDocument, 
  onUploadAudio,
  searchTerm 
}: EmptyStateProps) {
  if (type === 'courses') {
    return <EmptyCoursesState onCreateCourse={onCreateCourse} />;
  }

  if (type === 'memories') {
    return (
      <EmptyMemoriesState 
        onUploadDocument={onUploadDocument}
        onUploadAudio={onUploadAudio}
      />
    );
  }

  if (type === 'search-results') {
    return <EmptySearchState searchTerm={searchTerm} />;
  }

  return null;
}

/**
 * Empty state when user has no courses
 */
function EmptyCoursesState({ onCreateCourse }: { onCreateCourse?: () => void }) {
  return (
    <Box ta="center" py="xl">
      <Stack gap="lg" align="center" maw={400} mx="auto">
        <ThemeIcon size={80} radius="xl" variant="light" color="blue">
          <IconSchool size={40} />
        </ThemeIcon>
        
        <Stack gap="sm" align="center">
          <Title order={3} c="dimmed">
            Welcome to StudyMill!
          </Title>
          <Text size="md" c="dimmed" ta="center">
            Create your first course to start organizing your academic materials and building your knowledge library.
          </Text>
        </Stack>

        <Card p="lg" radius="md" withBorder w="100%" style={{ border: '2px dashed #e9ecef' }}>
          <Stack gap="md" align="center">
            <IconSparkles size={32} color="#3b82f6" />
            <Text size="sm" fw={500} ta="center">
              Get started in 3 easy steps
            </Text>
            <Stack gap="xs" w="100%">
              <Group gap="sm">
                <Badge size="sm" variant="filled" color="blue">1</Badge>
                <Text size="sm">Create a course for your class</Text>
              </Group>
              <Group gap="sm">
                <Badge size="sm" variant="filled" color="blue">2</Badge>
                <Text size="sm">Upload lecture notes or audio recordings</Text>
              </Group>
              <Group gap="sm">
                <Badge size="sm" variant="filled" color="blue">3</Badge>
                <Text size="sm">Chat with AI about your materials</Text>
              </Group>
            </Stack>
          </Stack>
        </Card>

        <Button 
          size="lg"
          leftSection={<IconPlus size={20} />}
          onClick={onCreateCourse}
          style={{ minWidth: 200 }}
        >
          Create Your First Course
        </Button>

        <Text size="xs" c="dimmed">
          You can always add more courses later
        </Text>
      </Stack>
    </Box>
  );
}

/**
 * Empty state when a course has no memories/documents
 */
function EmptyMemoriesState({ 
  onUploadDocument, 
  onUploadAudio 
}: { 
  onUploadDocument?: () => void;
  onUploadAudio?: () => void;
}) {
  return (
    <Box ta="center" py="xl">
      <Stack gap="lg" align="center" maw={500} mx="auto">
        <ThemeIcon size={80} radius="xl" variant="light" color="green">
          <IconBook size={40} />
        </ThemeIcon>
        
        <Stack gap="sm" align="center">
          <Title order={3} c="dimmed">
            No memories yet
          </Title>
          <Text size="md" c="dimmed" ta="center">
            Upload documents or audio recordings to start building your knowledge library for this course.
          </Text>
        </Stack>

        <Group gap="md" justify="center">
          <Card p="md" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={onUploadDocument}>
            <Stack gap="xs" align="center" maw={150}>
              <ThemeIcon variant="light" color="blue" size="lg">
                <IconFileText size={24} />
              </ThemeIcon>
              <Text size="sm" fw={500}>Upload Documents</Text>
              <Text size="xs" c="dimmed" ta="center">
                PDFs, slides, notes
              </Text>
              <Group gap="xs">
                <Text size="xs" c="blue">Get started</Text>
                <IconArrowRight size={12} color="#3b82f6" />
              </Group>
            </Stack>
          </Card>

          <Card p="md" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={onUploadAudio}>
            <Stack gap="xs" align="center" maw={150}>
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconMicrophone size={24} />
              </ThemeIcon>
              <Text size="sm" fw={500}>Upload Audio</Text>
              <Text size="xs" c="dimmed" ta="center">
                Lectures, discussions
              </Text>
              <Group gap="xs">
                <Text size="xs" c="orange">Get started</Text>
                <IconArrowRight size={12} color="#f97316" />
              </Group>
            </Stack>
          </Card>
        </Group>

        <Text size="xs" c="dimmed" ta="center" maw={300}>
          Once uploaded, StudyMill will automatically extract key concepts and create searchable memories
        </Text>
      </Stack>
    </Box>
  );
}

/**
 * Empty state for search results
 */
function EmptySearchState({ searchTerm }: { searchTerm?: string }) {
  return (
    <Box ta="center" py="xl">
      <Stack gap="lg" align="center" maw={400} mx="auto">
        <ThemeIcon size={80} radius="xl" variant="light" color="gray">
          <IconBook size={40} />
        </ThemeIcon>
        
        <Stack gap="sm" align="center">
          <Title order={3} c="dimmed">
            No results found
          </Title>
          {searchTerm ? (
            <Text size="md" c="dimmed" ta="center">
              We couldn&apos;t find any memories matching &quot;{searchTerm}&quot;. Try different keywords or upload more content.
            </Text>
          ) : (
            <Text size="md" c="dimmed" ta="center">
              No memories found for this filter. Try adjusting your search criteria.
            </Text>
          )}
        </Stack>

        <Stack gap="xs" align="center">
          <Text size="sm" fw={500} c="dimmed">
            Search tips:
          </Text>
          <Stack gap="xs" align="start">
            <Text size="xs" c="dimmed">• Try broader or different keywords</Text>
            <Text size="xs" c="dimmed">• Check your spelling</Text>
            <Text size="xs" c="dimmed">• Use synonyms or related terms</Text>
            <Text size="xs" c="dimmed">• Upload more content to expand your library</Text>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

export default EmptyState;