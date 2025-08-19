'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { HybridDashboard } from '@/components/dashboard/HybridDashboard';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <HybridDashboard />
      </AppShell>
    </ProtectedRoute>
  );
}