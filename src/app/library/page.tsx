'use client';

import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LibraryView } from '@/components/library/LibraryView';

export default function LibraryPage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  const handleBulkAction = (action: string, documentIds: string[]) => {
    // TODO: Implement bulk actions
    console.log('Bulk action:', action, 'on documents:', documentIds);
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <LibraryView 
          onDocumentSelect={handleDocumentSelect}
          onBulkAction={handleBulkAction}
        />
      </AppShell>
    </ProtectedRoute>
  );
}