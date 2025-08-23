'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUpload } from '@/hooks/useUpload';
import { useCourseCreation } from '@/hooks/useCourseCreation';
import { 
  Stack, 
  Group, 
  Text, 
  Button, 
  ActionIcon,
  Tooltip,
  Badge,
  Modal,
  Card,
  Divider
} from '@mantine/core';
import { 
  IconHome,
  IconBooks, 
  IconSchool, 
  IconBrain, 
  IconCalendar, 
  IconChartBar,
  IconPlus,
  IconSettings,
  IconUser,
  IconLogout,
  IconMicrophone,
  IconClock
} from '@tabler/icons-react';
import { TimerMini } from '@/components/timer/TimerMini';
import { useTimerContext } from '@/contexts/TimerContext';
import { usePersistentAudio } from '@/contexts/PersistentAudioContext';
import { AudioRecordingMini } from '@/components/audio/AudioRecordingMini';

interface SidebarNavigationProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

interface NavigationHub {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  href: string;
  description: string;
  badge?: string | number;
}

// Phase 1 Navigation Hubs as specified in design spec
const navigationHubs: NavigationHub[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: IconHome,
    href: '/dashboard',
    description: 'Today\'s overview'
  },
  {
    id: 'library',
    label: 'Library',
    icon: IconBooks,
    href: '/library',
    description: 'All Documents'
  },
  {
    id: 'courses',
    label: 'Courses',
    icon: IconSchool,
    href: '/courses',
    description: 'Course management'
  },
  {
    id: 'study',
    label: 'Study',
    icon: IconBrain,
    href: '/study',
    description: 'Flashcards & review'
  },
  {
    id: 'planner',
    label: 'Planner',
    icon: IconCalendar,
    href: '/planner',
    description: 'Schedule & deadlines'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: IconChartBar,
    href: '/analytics',
    description: 'Progress tracking'
  }
];

// Phase 1 Quick Add Actions
const quickAddActions = [
  { 
    id: 'upload-document', 
    label: 'Upload Document', 
    description: 'PDF, DOCX, or text files',
    icon: IconBooks 
  },
  { 
    id: 'upload-audio', 
    label: 'Record Audio', 
    description: 'Persistent recording across pages',
    icon: IconMicrophone 
  },
  { 
    id: 'create-course', 
    label: 'Create Course', 
    description: 'Organize your materials',
    icon: IconSchool 
  },
  { 
    id: 'schedule-event', 
    label: 'Add Event', 
    description: 'Study time or deadlines',
    icon: IconCalendar 
  },
  { 
    id: 'focus-timer', 
    label: 'Focus Timer', 
    description: 'Start a Pomodoro session',
    icon: IconClock 
  }
];

export function SidebarNavigation({ collapsed, onCollapse }: SidebarNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { openFullTimer } = useTimerContext();
  const { openRecorder } = usePersistentAudio();
  const { openUpload, UploadModal } = useUpload({
    onUploadComplete: (documentIds) => {
      // Navigate to library to show uploaded documents
      router.push('/library');
    }
  });


  const { openCourseCreation, CourseCreationModal } = useCourseCreation({
    onCourseCreated: () => {
      // Navigate to courses page to show new course
      router.push('/courses');
    }
  });

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'upload-document':
        openUpload();
        break;
      case 'upload-audio':
        openRecorder();
        setQuickAddOpen(false);
        break;
      case 'create-course':
        openCourseCreation();
        break;
      case 'schedule-event':
        router.push('/planner');
        break;
      case 'focus-timer':
        openFullTimer();
        break;
      default:
        console.log(`Unknown action: ${actionId}`);
    }
  };

  return (
    <>
      <Stack h="100%" gap="md" className="sidebar-nav" data-collapsed={collapsed}>
        {/* Sidebar Header */}
        <Group>
          {!collapsed && (
            <Text size="lg" fw={600} c="var(--sanctuary-text-primary)">
              StudyMill
            </Text>
          )}
        </Group>

        {/* Quick Add Button */}
        <Button
          onClick={() => setQuickAddOpen(true)}
          fullWidth={!collapsed}
          leftSection={collapsed ? undefined : <IconPlus size={20} />}
          variant="filled"
          color="forestGreen"
          size="md"
          justify={collapsed ? 'center' : 'start'}
          px={collapsed ? 'sm' : 'md'}
        >
          {collapsed ? <IconPlus size={22} color="#FFFFFF" /> : 'Quick Add'}
        </Button>

        <Divider />

        {/* Navigation Hubs */}
        <Stack gap="xs" flex={1}>
          {navigationHubs.map((hub) => {
            const Icon = hub.icon;
            const isActive = pathname === hub.href || pathname.startsWith(hub.href + '/');
            
            const navItem = (
              <Button
                component={Link}
                href={hub.href}
                key={hub.id}
                variant={isActive ? 'light' : 'subtle'}
                color={isActive ? 'forestGreen' : 'gray'}
                fullWidth={!collapsed}
                leftSection={collapsed ? undefined : <Icon size={20} />}
                rightSection={!collapsed && hub.badge ? (
                  <Badge size="xs" variant="light">
                    {hub.badge}
                  </Badge>
                ) : undefined}
                justify={collapsed ? 'center' : 'start'}
                size="md"
                px={collapsed ? 'sm' : 'md'}
                styles={{
                  root: {
                    border: isActive ? '1px solid var(--forest-green-light)' : 'none',
                    backgroundColor: isActive 
                      ? 'rgba(74, 124, 42, 0.1)' 
                      : undefined,
                    '&:hover': {
                      backgroundColor: isActive 
                        ? 'rgba(74, 124, 42, 0.15)' 
                        : undefined
                    }
                  },
                  label: {
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500
                  }
                }}
              >
                {collapsed ? (
                  <Icon 
                    size={22} 
                    color={isActive ? 'var(--forest-green-primary)' : 'var(--sanctuary-text-secondary)'} 
                  />
                ) : (
                  <Stack gap={2} align="flex-start">
                    <Text size="sm" fw={isActive ? 600 : 500}>
                      {hub.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {hub.description}
                    </Text>
                  </Stack>
                )}
              </Button>
            );

            return collapsed ? (
              <Tooltip key={hub.id} label={hub.label} position="right">
                {navItem}
              </Tooltip>
            ) : navItem;
          })}
        </Stack>

        <Divider />

        {/* Timer Mini (when active) */}
        <TimerMini onMaximize={openFullTimer} />

        {/* Audio Recording Mini (when active) */}
        <AudioRecordingMini onMaximize={openRecorder} />

        {/* User Section */}
        <Stack gap="xs">
          {/* Profile */}
          <Tooltip label={collapsed ? 'Profile' : undefined} position="right">
            <Button
              component={Link}
              href="/profile"
              variant="subtle"
              color="gray"
              fullWidth={!collapsed}
              leftSection={collapsed ? undefined : <IconUser size={20} />}
              justify={collapsed ? 'center' : 'start'}
              size="sm"
              px={collapsed ? 'xs' : 'md'}
            >
              {collapsed ? <IconUser size={22} color={'var(--sanctuary-text-secondary)'} /> : 'Profile'}
            </Button>
          </Tooltip>

          {/* Settings */}
          <Tooltip label={collapsed ? 'Settings' : undefined} position="right">
            <Button
              component={Link}
              href="/settings"
              variant="subtle"
              color="gray"
              fullWidth={!collapsed}
              leftSection={collapsed ? undefined : <IconSettings size={20} />}
              justify={collapsed ? 'center' : 'start'}
              size="sm"
              px={collapsed ? 'xs' : 'md'}
            >
              {collapsed ? <IconSettings size={22} color={'var(--sanctuary-text-secondary)'} /> : 'Settings'}
            </Button>
          </Tooltip>

          {/* Sign Out */}
          <Tooltip label={collapsed ? 'Sign out' : undefined} position="right">
            <Button
              variant="subtle"
              color="red"
              fullWidth={!collapsed}
              leftSection={collapsed ? undefined : <IconLogout size={20} />}
              justify={collapsed ? 'center' : 'start'}
              size="sm"
              px={collapsed ? 'xs' : 'md'}
              onClick={() => {
                // TODO: Implement sign out
                console.log('Sign out clicked');
              }}
            >
              {collapsed ? <IconLogout size={22} color={'var(--muted-terracotta)'} /> : 'Sign Out'}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Quick Add Modal */}
      <Modal
        opened={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Quick Add"
        centered
        size="md"
      >
        <Stack gap="md">
          {quickAddActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.id}
                p="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setQuickAddOpen(false);
                  handleQuickAction(action.id);
                }}
              >
                <Group gap="md">
                  <Icon size={24} color="var(--forest-green-primary)" />
                  <Stack gap={2}>
                    <Text fw={500}>{action.label}</Text>
                    <Text size="sm" c="dimmed">{action.description}</Text>
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </Stack>
      </Modal>

      {/* Upload Modals */}
      <UploadModal />
      <CourseCreationModal />
    </>
  );
}

// Phase 1 Integration Notes:
// - Uses Mantine Button components for consistent styling
// - Implements Phase 1 navigation hub structure
// - Follows Phase 1 quick add action specifications  
// - Proper tooltip handling for collapsed state
// - Academic color scheme integration
// - Keyboard accessibility built-in with Mantine
