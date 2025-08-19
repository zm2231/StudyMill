'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { LoadingOverlay, Stack, Text, Button } from '@mantine/core';

interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'pptx' | 'docx' | 'note';
  fileUrl?: string;
  content?: string;
  course?: {
    name: string;
    color: string;
    code: string;
  };
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  canEdit?: boolean;
}

// Mock document data - will be replaced with API calls
const mockDocuments: Document[] = [
  {
    id: '1',
    title: 'Physics 101 - Chapter 4 Lecture Slides',
    type: 'pdf',
    fileUrl: '/sample.pdf', // This would be a real URL in production
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    syncStatus: 'synced',
    canEdit: false
  },
  {
    id: '2',
    title: 'Calculus II - Integration Techniques',
    type: 'pptx',
    fileUrl: '/sample.pptx', // This would be a real URL in production
    course: { name: 'Calculus II', color: '#D9B68D', code: 'MATH 152' },
    syncStatus: 'synced',
    canEdit: false
  },
  {
    id: '3',
    title: 'My Study Notes - Thermodynamics',
    type: 'note',
    content: '<h1>Thermodynamics Notes</h1><p>The laws of thermodynamics are fundamental principles that govern energy transfer and transformation.</p><h2>First Law</h2><p>Energy cannot be created or destroyed, only transformed from one form to another.</p>',
    course: { name: 'Physics 101', color: '#4A7C2A', code: 'PHYS 101' },
    syncStatus: 'synced',
    canEdit: true
  }
];

export default function DocumentPageClient() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call to fetch document
    const fetchDocument = async () => {
      try {
        setLoading(true);
        
        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const foundDocument = mockDocuments.find(doc => doc.id === documentId);
        
        if (!foundDocument) {
          setError('Document not found');
          return;
        }
        
        setDocument(foundDocument);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const handleDocumentUpdate = async (updates: Partial<Document>) => {
    if (!document) return;

    try {
      // Update local state immediately for optimistic UI
      setDocument(prev => prev ? { ...prev, ...updates } : null);
      
      // TODO: Make API call to save changes
      console.log('Saving document updates:', updates);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error('Error updating document:', err);
      // Revert changes on error
      // In a real app, you'd fetch the document again or keep a backup
    }
  };

  const handleClose = () => {
    router.push('/library');
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ position: 'relative', height: '100vh' }}>
          <LoadingOverlay visible={true} />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !document) {
    return (
      <ProtectedRoute>
        <Stack 
          align="center" 
          justify="center" 
          style={{ height: '100vh' }}
          gap="md"
        >
          <Text size="xl" c="red">
            {error || 'Document not found'}
          </Text>
          <Button 
            variant="outline" 
            onClick={() => router.push('/library')}
          >
            Back to Library
          </Button>
        </Stack>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DocumentViewer
        document={document}
        onDocumentUpdate={handleDocumentUpdate}
        onClose={handleClose}
      />
    </ProtectedRoute>
  );
}

// Phase 1 Integration Notes:
// - Client component for document page with state management
// - Integration with DocumentViewer component
// - Mock data implementation (ready for API integration)
// - Optimistic UI updates for document changes
// - Error handling and loading states
// - Navigation back to library on close
// - Protected route to ensure authentication
// - Proper TypeScript interfaces for type safety