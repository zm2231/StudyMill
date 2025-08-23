'use client';

import { Grid, Container, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TodaysClasses } from './TodaysClasses';
import { ResumeSection } from './ResumeSection';
import { RecentSection } from './RecentSection';
import { ThisWeekWidget } from './ThisWeekWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { FocusTimerWidget } from './FocusTimerWidget';
import { DocumentUploader } from '../upload/DocumentUploader';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { CourseCreation } from '../courses/CourseCreation';
import { usePersistentAudio } from '@/contexts/PersistentAudioContext';

interface HybridDashboardProps {
  className?: string;
}

// Phase 1 Hybrid Dashboard: 2-col >1200px; 1-col ≤1200px
export function HybridDashboard({ className }: HybridDashboardProps) {
  // Critical 1200px breakpoint for hybrid layout
  const isWideScreen = useMediaQuery('(min-width: 75em)'); // 1200px
  const router = useRouter();
  
  // Use unified document upload hook
  const documentUpload = useDocumentUpload({
    onSuccess: () => {
      setRefreshKey(prev => prev + 1);
    }
  });

  // Modal states
  const [showCourseCreation, setShowCourseCreation] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // For triggering component refreshes
  const { openRecorder } = usePersistentAudio();

  // Handle upload actions - properly integrated with upload modals
  const handleAudioUpload = useCallback(() => {
    openRecorder();
  }, [openRecorder]);

  const handleDocumentUpload = useCallback((courseId?: string) => {
    documentUpload.open(courseId);
  }, [documentUpload]);

  const handleCourseCreation = useCallback(() => {
    setShowCourseCreation(true);
  }, []);

  const handleCourseCreated = useCallback(() => {
    // Refresh all dashboard components that depend on course data
    setRefreshKey(prev => prev + 1);
  }, []);

  // Placeholder handlers for features not yet implemented
  const handleEventCreation = useCallback(() => {
    // TODO: Implement event creation - route to planner
    router.push('/planner');
  }, [router]);

  const handleNoteCreation = useCallback(() => {
    // TODO: Implement quick note creation
    console.log('Quick note creation - WIP');
  }, []);

  const handleFlashcardCreation = useCallback(() => {
    // TODO: Implement flashcard creation - route to study
    router.push('/study');  
  }, [router]);

  return (
    <Container size="xl" className={className} py="md">
      <Grid gutter="lg">
        {isWideScreen ? (
          // Two-column layout for wide screens (>1200px)
          <>
            {/* Left Column: Main content */}
            <Grid.Col span={8}>
              <Stack gap="lg">
                <TodaysClasses 
                  onOpenAudioUpload={handleAudioUpload}
                  onOpenDocumentUpload={handleDocumentUpload}
                  refreshKey={refreshKey}
                />
                <ResumeSection />
                <RecentSection />
              </Stack>
            </Grid.Col>
            
            {/* Right Column: Widgets */}
            <Grid.Col span={4}>
              <Stack gap="lg">
                <ThisWeekWidget />
                <QuickAddWidget 
                  onOpenDocumentUpload={handleDocumentUpload}
                  onOpenAudioUpload={handleAudioUpload}
                  onOpenCourseCreation={handleCourseCreation}
                  onOpenEventCreation={handleEventCreation}
                  onOpenNoteCreation={handleNoteCreation}
                  onOpenFlashcardCreation={handleFlashcardCreation}
                />
                <FocusTimerWidget />
              </Stack>
            </Grid.Col>
          </>
        ) : (
          // Single-column layout for narrow screens (≤1200px)
          <Grid.Col span={12}>
            <Stack gap="lg">
              {/* Today's Classes - Full width */}
              <TodaysClasses 
                onOpenAudioUpload={handleAudioUpload}
                onOpenDocumentUpload={handleDocumentUpload}
                refreshKey={refreshKey}
              />
              
              {/* Widget Row - Split layout */}
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <ThisWeekWidget />
                </Grid.Col>
                <Grid.Col span={6}>
                  <QuickAddWidget 
                    onOpenDocumentUpload={handleDocumentUpload}
                    onOpenAudioUpload={handleAudioUpload}
                    onOpenCourseCreation={handleCourseCreation}
                    onOpenEventCreation={handleEventCreation}
                    onOpenNoteCreation={handleNoteCreation}
                    onOpenFlashcardCreation={handleFlashcardCreation}
                  />
                </Grid.Col>
              </Grid>
              
              {/* Main Content Sections */}
              <ResumeSection />
              <RecentSection />
              
              {/* Bottom Widget */}
              <FocusTimerWidget />
            </Stack>
          </Grid.Col>
        )}
      </Grid>
      
      {/* Upload Modals */}
      <DocumentUploader 
        opened={documentUpload.isOpen} 
        onClose={documentUpload.close}
        preselectedCourseId={documentUpload.preselectedCourseId}
        onSuccess={documentUpload.handleSuccess}
        onError={documentUpload.handleError}
      />
      
      
      <CourseCreation 
        opened={showCourseCreation} 
        onClose={() => setShowCourseCreation(false)}
        onSuccess={handleCourseCreated}
      />
    </Container>
  );
}

// Phase 1 Integration Notes:
// - Implements critical 1200px breakpoint for hybrid layout switch
// - Two-column layout (8/4 split) for wide screens
// - Single-column responsive layout for narrow screens  
// - Follows Phase 1 component order: Today's Classes → Resume → Recent
// - Right rail widgets: Due Soon → Quick Add → Focus Timer → Tips
// - Uses Mantine Grid system for consistent spacing