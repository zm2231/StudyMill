'use client';

import { ReactNode, useState, useEffect } from 'react';
import { 
  AppShell as MantineAppShell, 
  Group, 
  Text, 
  Button,
  useMantineColorScheme,
  useComputedColorScheme
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { SidebarNavigation } from './SidebarNavigation';
import { TopBarComponent } from './TopBarComponent';
import { ContextPanel } from './ContextPanel';

interface AppShellProps {
  children: ReactNode;
  contextPanel?: ReactNode;
  showContextPanel?: boolean;
}

export function AppShell({ 
  children, 
  contextPanel,
  showContextPanel = false 
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(showContextPanel);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  
  // Phase 1 Critical Breakpoint: 1200px for hybrid dashboard
  const isWideScreen = useMediaQuery('(min-width: 75em)'); // 1200px
  const isMobile = useMediaQuery('(max-width: 48em)'); // 768px

  // Global keyboard shortcuts as per Phase 1 spec
  useHotkeys('cmd+\\,ctrl+\\', () => setSidebarCollapsed(!sidebarCollapsed));
  useHotkeys('cmd+.,ctrl+.', () => setContextPanelOpen(!contextPanelOpen));
  useHotkeys('cmd+k,ctrl+k', (e) => {
    e.preventDefault();
    // TODO: Open command palette (cmdk)
  });
  useHotkeys('cmd+shift+l,ctrl+shift+l', () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  });

  // Auto-collapse sidebar on mobile for better UX
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  // Calculate sidebar width based on Phase 1 spec
  const sidebarWidth = sidebarCollapsed ? 64 : 280; // Phase 1 layout variables
  const contextPanelWidth = 384; // Phase 1 context panel width

  return (
    <MantineAppShell
      layout="alt"
      header={{ height: 64 }} // Phase 1 header height
      navbar={{
        width: sidebarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: sidebarCollapsed && isMobile }
      }}
      aside={contextPanelOpen ? {
        width: contextPanelWidth,
        breakpoint: 'md',
        collapsed: { mobile: true } // Context panel becomes bottom sheet on mobile
      } : undefined}
      padding="md"
    >
      {/* Top Bar */}
      <MantineAppShell.Header>
        <TopBarComponent 
          onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          onContextPanelToggle={() => setContextPanelOpen(!contextPanelOpen)}
          sidebarCollapsed={sidebarCollapsed}
          contextPanelOpen={contextPanelOpen}
        />
      </MantineAppShell.Header>

      {/* Sidebar Navigation */}
      <MantineAppShell.Navbar p="md">
        <SidebarNavigation 
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
        />
      </MantineAppShell.Navbar>

      {/* Context Panel */}
      {contextPanelOpen && (
        <MantineAppShell.Aside p="md">
          <ContextPanel 
            onClose={() => setContextPanelOpen(false)}
            content={contextPanel}
          />
        </MantineAppShell.Aside>
      )}

      {/* Main Content Area */}
      <MantineAppShell.Main>
        {children}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

// Phase 1 Component Integration Notes:
// - Uses Mantine AppShell as specified in Phase 1 design spec
// - Implements 1200px breakpoint for hybrid dashboard layout
// - Follows Phase 1 sidebar width specifications (280px expanded, 64px collapsed)
// - Context panel width follows Phase 1 spec (384px)
// - Keyboard shortcuts align with Phase 1 hotkey system
// - Dark mode toggle integrated with Mantine color scheme