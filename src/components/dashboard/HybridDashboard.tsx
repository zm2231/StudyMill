'use client';

import { Grid, Container, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { TodaysClasses } from './TodaysClasses';
import { ResumeSection } from './ResumeSection';
import { RecentSection } from './RecentSection';
import { DueSoonWidget } from './DueSoonWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { FocusTimerWidget } from './FocusTimerWidget';
import { TipsWidget } from './TipsWidget';

interface HybridDashboardProps {
  className?: string;
}

// Phase 1 Hybrid Dashboard: 2-col >1200px; 1-col ≤1200px
export function HybridDashboard({ className }: HybridDashboardProps) {
  // Critical 1200px breakpoint for hybrid layout
  const isWideScreen = useMediaQuery('(min-width: 75em)'); // 1200px

  return (
    <Container size="xl" className={className} py="md">
      <Grid gutter="lg">
        {isWideScreen ? (
          // Two-column layout for wide screens (>1200px)
          <>
            {/* Left Column: Main content */}
            <Grid.Col span={8}>
              <Stack gap="lg">
                <TodaysClasses />
                <ResumeSection />
                <RecentSection />
              </Stack>
            </Grid.Col>
            
            {/* Right Column: Widgets */}
            <Grid.Col span={4}>
              <Stack gap="lg">
                <DueSoonWidget />
                <QuickAddWidget />
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
              <TodaysClasses />
              
              {/* Widget Row - Split layout */}
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <DueSoonWidget />
                </Grid.Col>
                <Grid.Col span={6}>
                  <QuickAddWidget />
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