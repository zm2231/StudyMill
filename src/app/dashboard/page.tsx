'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LibraryLayout } from '@/components/library/LibraryLayout';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <LibraryLayout />
    </ProtectedRoute>
  );
}