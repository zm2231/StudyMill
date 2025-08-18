'use client';

import { useState, useEffect } from 'react';
import { 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack,
  Box,
  Card,
  SimpleGrid,
  Badge,
  ActionIcon,
  Loader,
  Alert
} from '@mantine/core';
import { 
  IconFileText,
  IconBrain,
  IconClock,
  IconAlertCircle,
  IconPlus
} from '@tabler/icons-react';
import { useMemories, type Memory } from '@/hooks/useMemories';

interface Course {
  id: string;
  name: string;
  count: number;
  color: string;
}

interface LibraryContentProps {
  selectedCourse: string | null;
  courses: Course[];
}

export function LibraryContent({ selectedCourse, courses }: LibraryContentProps) {
  const { memories, loading, error, fetchMemories, getMemoriesByTag } = useMemories();
  
  const selectedCourseData = courses.find(c => c.id === selectedCourse);
  
  // Fetch memories on component mount
  useEffect(() => {
    fetchMemories();
  }, []);
  
  // Get memories for selected course
  const getFilteredMemories = () => {
    if (!selectedCourse || selectedCourse === 'overview') {
      return memories;
    }
    return getMemoriesByTag(selectedCourse);
  };
  
  const filteredMemories = getFilteredMemories();
  
  // Helper to format memory for display
  const formatMemoryAsDocument = (memory: Memory) => ({
    id: memory.id,
    title: memory.content.slice(0, 50) + (memory.content.length > 50 ? '...' : ''),
    timeAgo: new Date(memory.createdAt).toLocaleDateString(),
    description: memory.content.slice(0, 120) + (memory.content.length > 120 ? '...' : ''),
    sourceType: memory.sourceType,
    tags: memory.containerTags
  });
  
  const documentItems = filteredMemories.map(formatMemoryAsDocument);

  if (selectedCourse === 'overview' || !selectedCourse) {
    return (
      <Box>
        <Title order={1} size="h2" mb="md" style={{ color: '#1e293b' }}>
          StudyMill Library
        </Title>
        
        <Text size="lg" c="dimmed" mb="xl" style={{ maxWidth: 600 }}>
          Your personal academic knowledge base. Upload documents, create memories, 
          and organize your learning materials with AI-powered insights.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {courses.map((course) => (
            <Card 
              key={course.id}
              p="lg" 
              radius="md"
              style={{ 
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                '&:hover': {
                  borderColor: course.color,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
              }}
            >
              <Group justify="space-between" align="flex-start" mb="md">
                <Box 
                  w={40} 
                  h={40} 
                  style={{ 
                    backgroundColor: course.color + '20', 
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box 
                    w={16} 
                    h={16} 
                    style={{ 
                      backgroundColor: course.color, 
                      borderRadius: '50%' 
                    }} 
                  />
                </Box>
                <Badge size="sm" variant="light">{course.count} memories</Badge>
              </Group>
              
              <Title order={3} size="h4" mb="xs" style={{ color: '#1e293b' }}>
                {course.name}
              </Title>
              
              <Text size="sm" c="dimmed" mb="md">
                {course.count} memories and documents
              </Text>
              
              <Button 
                variant="light" 
                size="sm" 
                fullWidth
                style={{ backgroundColor: course.color + '10', color: course.color }}
              >
                View Memories
              </Button>
            </Card>
          ))}
        </SimpleGrid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Course Header */}
      <Group justify="space-between" align="flex-start" mb="xl">
        <Box>
          <Group mb="sm">
            <Title order={1} size="2.5rem" style={{ color: '#1e293b' }}>
              {selectedCourseData?.name || 'Course'}
            </Title>
          </Group>
          
          <Text size="md" c="dimmed" style={{ maxWidth: 600, lineHeight: 1.6 }}>
            Memories and documents for {selectedCourseData?.name?.toLowerCase()}. 
            Upload documents to automatically extract key concepts and create searchable memories.
          </Text>
        </Box>
        
        <Button leftSection={<IconPlus size={16} />} variant="light">
          Add Memory
        </Button>
      </Group>

      {/* Content */}
      <Box>
        <Group justify="space-between" align="center" mb="lg">
          <Title order={3} size="h4" style={{ color: '#1e293b' }}>
            Memories ({documentItems.length})
          </Title>
        </Group>

        {loading && (
          <Box ta="center" py="xl">
            <Loader size="md" />
            <Text size="sm" c="dimmed" mt="md">
              Loading your memories...
            </Text>
          </Box>
        )}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="lg">
            {error}
          </Alert>
        )}

        {!loading && !error && documentItems.length === 0 && (
          <Box ta="center" py="xl">
            <Text size="lg" c="dimmed" mb="md">
              No memories yet
            </Text>
            <Text size="sm" c="dimmed" mb="xl">
              Upload documents or create memories to start building your knowledge library
            </Text>
            <Button leftSection={<IconFileText size={16} />} variant="light">
              Upload Document
            </Button>
          </Box>
        )}

        {!loading && !error && documentItems.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {documentItems.map((doc) => (
              <Card 
                key={doc.id}
                p="lg" 
                radius="md"
                style={{ 
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  minHeight: 200,
                  '&:hover': {
                    borderColor: selectedCourseData?.color || '#3b82f6',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }
                }}
              >
                <Stack justify="space-between" h="100%">
                  <Box>
                    <Title order={4} size="h5" mb="sm" style={{ color: '#1e293b', lineHeight: 1.3 }}>
                      {doc.title}
                    </Title>
                    
                    <Text size="sm" c="dimmed" mb="md" style={{ lineHeight: 1.5 }}>
                      {doc.description}
                    </Text>
                  </Box>
                  
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <IconClock size={14} color="#64748b" />
                      <Text size="xs" c="dimmed">
                        {doc.sourceType} • {doc.timeAgo}
                      </Text>
                    </Group>
                    {doc.tags.length > 0 && (
                      <Badge size="xs" variant="light">
                        {doc.tags[0]}
                      </Badge>
                    )}
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
}