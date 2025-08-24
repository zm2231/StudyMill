'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';
import { 
  Stack, 
  Group, 
  TextInput, 
  Button, 
  ActionIcon, 
  SegmentedControl,
  MultiSelect,
  Chip,
  Title,
  Text,
  Box
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { 
  IconSearch, 
  IconLayoutGrid, 
  IconList, 
  IconFilter, 
  IconSortDescending,
  IconX
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { DocumentGrid } from './DocumentGrid';
import { DocumentList } from './DocumentList';
import { BulkActionsBar } from './BulkActionsBar';
import { Course } from '@/types/course';

// Document interface for type safety
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

interface LibraryViewProps {
  onDocumentSelect?: (documentId: string) => void;
  onBulkAction?: (action: string, documentIds: string[]) => void;
}

interface DocumentFilters {
  search: string;
  courses: string[];
  types: string[];
  tags: string[];
  dateRange: [Date | null, Date | null];
}

// Document type options
const documentTypeOptions = [
  { value: 'pdf', label: 'PDF' },
  { value: 'pptx', label: 'Presentation' },
  { value: 'docx', label: 'Document' },
  { value: 'audio', label: 'Audio' },
  { value: 'note', label: 'Note' }
];

const tagOptions = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'homework', label: 'Homework' },
  { value: 'exam', label: 'Exam' },
  { value: 'lab', label: 'Lab' },
  { value: 'project', label: 'Project' }
];

export function LibraryView({ onDocumentSelect, onBulkAction }: LibraryViewProps) {
  const api = useApi();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DocumentFilters>({
    search: '',
    courses: [],
    types: [],
    tags: [],
    dateRange: [null, null]
  });

  // Phase 1 Critical Breakpoint: 1200px
  const isWideScreen = useMediaQuery('(min-width: 75em)'); // 1200px
  const isMobile = useMediaQuery('(max-width: 48em)'); // 768px

  // Load documents and courses
  useEffect(() => {
    loadDocuments();
    loadCourses();
  }, [filters]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getDocuments({
        courseId: filters.courses.length > 0 ? filters.courses[0] : undefined,
        types: filters.types.length > 0 ? filters.types : undefined,
        query: filters.search || undefined,
        limit: 50,
        offset: 0
      });

      if (response.success) {
        // Transform API data to ensure proper Date objects
        const transformedDocuments = response.documents.map(doc => ({
          ...doc,
          updatedAt: new Date(doc.updatedAt),
          createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined
        }));
        setDocuments(transformedDocuments);
      } else {
        setError('Failed to load documents');
      }
    } catch (error: unknown) {
      console.error('Error loading documents:', error);
      setError((error as Error).message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await api.getCourses();
      if (response.success) {
        setCourses(response.courses);
      }
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  };

  const updateFilter = <K extends keyof DocumentFilters>(
    key: K, 
    value: DocumentFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      courses: [],
      types: [],
      tags: [],
      dateRange: [null, null]
    });
  };

  const hasActiveFilters = 
    filters.courses.length > 0 || 
    filters.types.length > 0 || 
    filters.tags.length > 0 || 
    filters.dateRange.some(date => date !== null);

  const activeFilterCount = 
    filters.courses.length + 
    filters.types.length + 
    filters.tags.length + 
    (filters.dateRange.some(date => date !== null) ? 1 : 0);

  return (
    <Stack gap="md">
      {/* Library Header */}
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>All Documents</Title>
        
        <Group gap="sm" wrap="nowrap">
          {/* Search Input - Component Spec: md 40px; prefix icon 20px */}
          <TextInput
            placeholder="Search documents..."
            leftSection={<IconSearch size={20} />}
            rightSection={
              filters.search ? (
                <ActionIcon 
                  variant="subtle" 
                  size="sm"
                  onClick={() => updateFilter('search', '')}
                >
                  <IconX size={16} />
                </ActionIcon>
              ) : undefined
            }
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            size="md"
            w={isMobile ? 200 : 320}
            styles={{
              input: { height: '40px' }
            }}
          />

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? 'filled' : 'light'}
            color="forestGreen"
            leftSection={<IconFilter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
            rightSection={
              activeFilterCount > 0 ? (
                <Chip checked size="xs" color="forestGreen">
                  {activeFilterCount}
                </Chip>
              ) : undefined
            }
          >
            Filters
          </Button>

          {/* View Mode Toggle */}
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as 'grid' | 'list')}
            data={[
              { 
                value: 'grid', 
                label: <IconLayoutGrid size={16} /> 
              },
              { 
                value: 'list', 
                label: <IconList size={16} /> 
              }
            ]}
            size="md"
          />

          {/* Sort */}
          <ActionIcon variant="light" color="gray" size="lg">
            <IconSortDescending size={20} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Filter Bar - Component Spec: Chips 28-32px height */}
      {showFilters && (
        <Box p="md" style={{ backgroundColor: 'var(--sanctuary-surface)', borderRadius: '8px' }}>
          <Stack gap="md">
            <Group gap="md" wrap="wrap">
              <MultiSelect
                label="Courses"
                placeholder="Select courses"
                data={courses.map(course => ({
                  value: course.id,
                  label: course.name
                }))}
                value={filters.courses}
                onChange={(value) => updateFilter('courses', value)}
                clearable
                searchable
                size="sm"
                w={200}
              />

              <MultiSelect
                label="Types"
                placeholder="Select types"
                data={documentTypeOptions}
                value={filters.types}
                onChange={(value) => updateFilter('types', value)}
                clearable
                size="sm"
                w={200}
              />

              <MultiSelect
                label="Tags"
                placeholder="Select tags"
                data={tagOptions}
                value={filters.tags}
                onChange={(value) => updateFilter('tags', value)}
                clearable
                searchable
                size="sm"
                w={200}
              />

              <DatePickerInput
                type="range"
                label="Date Range"
                placeholder="Pick date range"
                value={filters.dateRange}
                onChange={(value) => updateFilter('dateRange', value)}
                clearable
                size="sm"
                w={200}
              />
            </Group>

            {hasActiveFilters && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">Active filters:</Text>
                {filters.courses.map(course => (
                  <Chip 
                    key={course} 
                    checked 
                    size="sm"
                    style={{ height: '28px' }}
                    onRemove={() => updateFilter('courses', filters.courses.filter(c => c !== course))}
                  >
                    {courses.find(c => c.id === course)?.name}
                  </Chip>
                ))}
                {filters.types.map(type => (
                  <Chip 
                    key={type} 
                    checked 
                    size="sm"
                    style={{ height: '28px' }}
                    onRemove={() => updateFilter('types', filters.types.filter(t => t !== type))}
                  >
                    {documentTypeOptions.find(t => t.value === type)?.label}
                  </Chip>
                ))}
                {filters.tags.map(tag => (
                  <Chip 
                    key={tag} 
                    checked 
                    size="sm"
                    style={{ height: '28px' }}
                    onRemove={() => updateFilter('tags', filters.tags.filter(t => t !== tag))}
                  >
                    {tagOptions.find(t => t.value === tag)?.label}
                  </Chip>
                ))}
                <Button variant="subtle" size="xs" onClick={clearFilters}>
                  Clear all
                </Button>
              </Group>
            )}
          </Stack>
        </Box>
      )}

      {/* Document Grid/List */}
      {viewMode === 'grid' ? (
        <DocumentGrid 
          documents={documents}
          filters={filters}
          selectedDocuments={selectedDocuments}
          onSelectionChange={setSelectedDocuments}
          onDocumentSelect={onDocumentSelect}
          loading={loading}
        />
      ) : (
        <DocumentList 
          documents={documents}
          filters={filters}
          selectedDocuments={selectedDocuments}
          onSelectionChange={setSelectedDocuments}
          onDocumentSelect={onDocumentSelect}
          loading={loading}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedDocuments.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedDocuments.length}
          onAction={(action) => {
            onBulkAction?.(action, selectedDocuments);
            setSelectedDocuments([]);
          }}
          onClear={() => setSelectedDocuments([])}
        />
      )}
    </Stack>
  );
}

// Phase 1 Integration Notes:
// - Follows component specifications exactly (search input 40px height, filter chips 28-32px)
// - Implements list/grid toggle as required
// - MultiSelect filters for Course, Type, Tags, Date as specified
// - Bulk actions support with selection management
// - Responsive design with mobile considerations
// - Proper integration points for DocumentGrid/DocumentList components