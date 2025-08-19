'use client';

import { Grid, Container, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TodaysClasses } from './TodaysClasses';
import { ResumeSection } from './ResumeSection';
import { RecentSection } from './RecentSection';
import { DueSoonWidget } from './DueSoonWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { FocusTimerWidget } from './FocusTimerWidget';
import { TipsWidget } from './TipsWidget';
import { DocumentUpload } from '../library/DocumentUpload';
import { AudioUpload } from '../library/AudioUpload';
import { CourseCreation } from '../courses/CourseCreation';

interface HybridDashboardProps {
  className?: string;
}

// Phase 1 Hybrid Dashboard: 2-col >1200px; 1-col ≤1200px
export function HybridDashboard({ className }: HybridDashboardProps) {
  // Critical 1200px breakpoint for hybrid layout
  const isWideScreen = useMediaQuery('(min-width: 75em)'); // 1200px
  const router = useRouter();

  // Modal states
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showAudioUpload, setShowAudioUpload] = useState(false);
  const [showCourseCreation, setShowCourseCreation] = useState(false);
  const [preselectedCourseId, setPreselectedCourseId] = useState<string | undefined>();

  // Handle upload actions - properly integrated with upload modals
  const handleAudioUpload = useCallback((courseId?: string) => {
    setPreselectedCourseId(courseId);
    setShowAudioUpload(true);
  }, []);

  const handleDocumentUpload = useCallback((courseId?: string) => {
    setPreselectedCourseId(courseId);
    setShowDocumentUpload(true);
  }, []);

  const handleCourseCreation = useCallback(() => {
    setShowCourseCreation(true);
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
                />
                <ResumeSection />
                <RecentSection />
              </Stack>
            </Grid.Col>
            
            {/* Right Column: Widgets */}
            <Grid.Col span={4}>
              <Stack gap="lg">
                <DueSoonWidget />
                <QuickAddWidget 
                  onOpenDocumentUpload={handleDocumentUpload}
                  onOpenAudioUpload={handleAudioUpload}
                  onOpenCourseCreation={handleCourseCreation}
                  onOpenEventCreation={handleEventCreation}
                  onOpenNoteCreation={handleNoteCreation}
                  onOpenFlashcardCreation={handleFlashcardCreation}
                />
                <FocusTimerWidget />
                <TipsWidget />
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
              />
              
              {/* Widget Row - Split layout */}
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <DueSoonWidget />
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
              
              {/* Bottom Widget Row */}
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <FocusTimerWidget />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TipsWidget />
                </Grid.Col>
              </Grid>
            </Stack>
          </Grid.Col>
        )}
      </Grid>
      
      {/* Upload Modals */}
      <DocumentUpload 
        opened={showDocumentUpload} 
        onClose={() => setShowDocumentUpload(false)}
        preselectedCourseId={preselectedCourseId}
      />
      
      <AudioUpload 
        opened={showAudioUpload} 
        onClose={() => setShowAudioUpload(false)}
        preselectedCourseId={preselectedCourseId}
      />
      
      <CourseCreation 
        opened={showCourseCreation} 
        onClose={() => setShowCourseCreation(false)}
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