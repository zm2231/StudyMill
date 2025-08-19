'use client';

import { Grid, Stack, Text, Center, Loader } from '@mantine/core';
import { DocumentCard } from './DocumentCard';

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

interface DocumentFilters {
  search: string;
  courses: string[];
  types: string[];
  tags: string[];
  dateRange: [Date | null, Date | null];
}

interface DocumentGridProps {
  documents: Document[];
  filters: DocumentFilters;
  selectedDocuments: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onDocumentSelect?: (documentId: string) => void;
  loading?: boolean;
}

// Real documents data is now passed via props from LibraryView

function filterDocuments(documents: Document[], filters: DocumentFilters): Document[] {
  return documents.filter(doc => {
    // Search filter
    if (filters.search && !doc.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }

    // Course filter - match by course ID or name
    if (filters.courses.length > 0 && (!doc.course || !filters.courses.some(courseId => 
      courseId === doc.course?.name || courseId === doc.course?.code
    ))) {
      return false;
    }

    // Type filter
    if (filters.types.length > 0 && !filters.types.includes(doc.type)) {
      return false;
    }

    // Tags filter
    if (filters.tags.length > 0 && !filters.tags.some(tag => doc.tags.includes(tag))) {
      return false;
    }

    // Date range filter
    const [startDate, endDate] = filters.dateRange;
    if (startDate && doc.updatedAt < startDate) {
      return false;
    }
    if (endDate && doc.updatedAt > endDate) {
      return false;
    }

    return true;
  });
}

export function DocumentGrid({ 
  documents,
  filters, 
  selectedDocuments, 
  onSelectionChange, 
  onDocumentSelect,
  loading = false 
}: DocumentGridProps) {
  const filteredDocuments = filterDocuments(documents, filters);

  const handleDocumentSelect = (documentId: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedDocuments, documentId]);
    } else {
      onSelectionChange(selectedDocuments.filter(id => id !== documentId));
    }
  };

  const handleDocumentAction = (action: string, document: Document) => {
    console.log(`Action: ${action} on document:`, document.id);
    // TODO: Implement action handlers
  };

  const handleDocumentClick = (documentId: string) => {
    onDocumentSelect?.(documentId);
  };

  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="md" color="forestGreen" />
          <Text size="sm" c="dimmed">Loading documents...</Text>
        </Stack>
      </Center>
    );
  }

  if (filteredDocuments.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Text size="lg" c="dimmed">No documents found</Text>
          <Text size="sm" c="dimmed" ta="center">
            {filters.search || filters.courses.length > 0 || filters.types.length > 0 || filters.tags.length > 0
              ? 'Try adjusting your filters or search term'
              : 'Upload your first document to get started'
            }
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Grid gutter="md">
      {filteredDocuments.map((document) => (
        <Grid.Col key={document.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
          <DocumentCard
            document={document}
            viewMode="card"
            selected={selectedDocuments.includes(document.id)}
            onSelect={(selected) => handleDocumentSelect(document.id, selected)}
            onAction={handleDocumentAction}
            onClick={() => handleDocumentClick(document.id)}
          />
        </Grid.Col>
      ))}
    </Grid>
  );
}

// Phase 1 Integration Notes:
// - Responsive grid layout (4 columns on large screens, adjusts for smaller screens)
// - Integrates with DocumentCard component in card view mode
// - Implements filtering logic for all filter types
// - Selection management with bulk actions support
// - Loading and empty states
// - Document click handling for navigation
// - Uses real documents data passed from LibraryView via API integration