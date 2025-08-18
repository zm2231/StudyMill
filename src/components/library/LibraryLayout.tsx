'use client';

import { useState, useEffect } from 'react';
import { 
  AppShell, 
  NavLink, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack,
  Box,
  Badge,
  Breadcrumbs,
  Anchor,
  Menu,
  Skeleton,
  Alert
} from '@mantine/core';
import { 
  IconLogout, 
  IconPlus, 
  IconBook, 
  IconBrain,
  IconChartBar,
  IconSettings,
  IconUpload,
  IconMicrophone,
  IconFileText,
  IconSchool,
  IconCalendarTime,
  IconAlertCircle
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { LibraryContent } from './LibraryContent';
import { DocumentUpload } from './DocumentUpload';
import { AudioUpload } from './AudioUpload';
import { TodaysClasses } from '../dashboard/TodaysClasses';
import { CourseCreation } from '../courses/CourseCreation';
import { CourseNavItem, CourseSelection } from '@/types/library';
import { useCoursesWithSWR } from '@/hooks/useCoursesWithSWR';
import { CourseListSkeleton } from './CourseListSkeleton';
import { LibraryErrorBoundary, ApiErrorAlert } from './LibraryErrorBoundary';
import { EmptyState } from './EmptyState';

export function LibraryLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<CourseSelection>('overview');
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showAudioUpload, setShowAudioUpload] = useState(false);
  const [showCourseCreation, setShowCourseCreation] = useState(false);
  const [preselectedCourseId, setPreselectedCourseId] = useState<string | undefined>();
  
  // Use SWR hook for course data with caching and background updates
  const { 
    navItems: courses, 
    isLoading, 
    isValidating,
    error, 
    refreshCourses,
    revalidate 
  } = useCoursesWithSWR();

  // Refresh courses when course creation modal is closed successfully
  const handleCourseCreationClose = () => {
    setShowCourseCreation(false);
    // Trigger revalidation to ensure fresh data
    revalidate();
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleStartChat = () => {
    router.push('/chat');
  };

  const handleOpenAudioUpload = (courseId?: string) => {
    setPreselectedCourseId(courseId);
    setShowAudioUpload(true);
  };

  const handleOpenDocumentUpload = (courseId?: string) => {
    setPreselectedCourseId(courseId);
    setShowDocumentUpload(true);
  };

  const breadcrumbItems = [
    { title: 'My Library', href: '/dashboard' },
    selectedCourse !== 'overview' && selectedCourse 
      ? { title: courses.find(c => c.id === selectedCourse)?.name || 'Course', href: '#' }
      : null
  ].filter(Boolean);

  return (
    <LibraryErrorBoundary>
      <AppShell 
      navbar={{ width: 280, breakpoint: 'sm' }}
      padding="md"
      style={{ 
        '--app-shell-bg': '#f8fafc',
        '--app-shell-navbar-bg': '#ffffff',
      }}
    >
      <AppShell.Navbar p="md" style={{ border: 'none', boxShadow: '1px 0 3px rgba(0,0,0,0.1)' }}>
        <Stack gap="lg" h="100%">
          {/* Header */}
          <Box>
            <Group justify="space-between" mb="md">
              <Title order={2} size="h3" style={{ color: '#1e293b' }}>
                My Library
              </Title>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button 
                    size="xs" 
                    variant="light" 
                    leftSection={<IconPlus size={14} />}
                  >
                    Add
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Item 
                    leftSection={<IconFileText size={16} />}
                    onClick={() => handleOpenDocumentUpload()}
                  >
                    Upload Documents
                  </Menu.Item>
                  <Menu.Item 
                    leftSection={<IconMicrophone size={16} />}
                    onClick={() => handleOpenAudioUpload()}
                  >
                    Upload Audio
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item 
                    leftSection={<IconSchool size={16} />}
                    onClick={() => setShowCourseCreation(true)}
                  >
                    Create Course
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
            
            <Text size="sm" c="dimmed" mb="md">
              Welcome back, {user?.name?.split(' ')[0]}!
            </Text>
          </Box>

          {/* Quick Links */}
          <Box>
            <NavLink
              label="Recent"
              leftSection={<IconBook size={16} />}
              active={selectedCourse === 'recent'}
              onClick={() => setSelectedCourse('recent')}
              styles={{
                root: { borderRadius: 6, marginBottom: 4 },
                label: { fontSize: 14 }
              }}
            />
            <NavLink
              label="Reading list"
              leftSection={<IconBrain size={16} />}
              rightSection={<Badge size="xs" variant="light">23</Badge>}
              active={selectedCourse === 'reading-list'}
              onClick={() => setSelectedCourse('reading-list')}
              styles={{
                root: { borderRadius: 6, marginBottom: 4 },
                label: { fontSize: 14 }
              }}
            />
            <NavLink
              label="Discover"
              leftSection={<IconChartBar size={16} />}
              active={selectedCourse === 'discover'}
              onClick={() => setSelectedCourse('discover')}
              styles={{
                root: { borderRadius: 6, marginBottom: 4 },
                label: { fontSize: 14 }
              }}
            />
          </Box>

          {/* My Library Section */}
          <Box style={{ flex: 1 }}>
            <Group justify="space-between" align="center" mb="sm">
              <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>
                My Library
              </Text>
              {/* Background revalidation indicator */}
              {isValidating && !isLoading && (
                <Box
                  w={8}
                  h={8}
                  style={{
                    backgroundColor: '#3b82f6',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite',
                  }}
                />
              )}
            </Group>
            
            {/* Error State */}
            {error && (
              <ApiErrorAlert
                error={error}
                onRetry={refreshCourses}
                retryCount={0}
                maxRetries={3}
              />
            )}
            
            {/* Loading State */}
            {isLoading && !courses.length && (
              <CourseListSkeleton count={5} />
            )}
            
            {/* Empty State */}
            {!isLoading && !error && courses.length === 0 && (
              <EmptyState
                type="courses"
                onCreateCourse={() => setShowCourseCreation(true)}
              />
            )}
            
            <Stack gap={2}>
              {courses.map((course) => (
                <NavLink
                  key={course.id}
                  label={course.name}
                  leftSection={
                    <Box 
                      w={12} 
                      h={12} 
                      style={{ 
                        backgroundColor: course.color, 
                        borderRadius: '50%' 
                      }} 
                    />
                  }
                  rightSection={
                    <Text size="xs" c="dimmed">{course.count}</Text>
                  }
                  active={selectedCourse === course.id}
                  onClick={() => setSelectedCourse(course.id)}
                  styles={{
                    root: { 
                      borderRadius: 6, 
                      marginBottom: 2,
                      backgroundColor: selectedCourse === course.id ? '#f1f5f9' : 'transparent'
                    },
                    label: { fontSize: 14, fontWeight: 500 }
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Bottom Actions */}
          <Stack gap="xs">
            <Button 
              variant="light" 
              leftSection={<IconBrain size={16} />}
              onClick={handleStartChat}
              fullWidth
              style={{ justifyContent: 'flex-start' }}
            >
              AI Chat
            </Button>
            <Button 
              variant="subtle" 
              leftSection={<IconSettings size={16} />}
              onClick={() => router.push('/settings')}
              fullWidth
              style={{ justifyContent: 'flex-start' }}
            >
              Settings
            </Button>
            <Button 
              variant="subtle" 
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
              fullWidth
              style={{ justifyContent: 'flex-start' }}
              c="red"
            >
              Sign Out
            </Button>
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main style={{ backgroundColor: '#f8fafc' }}>
        {/* Breadcrumbs */}
        <Breadcrumbs mb="lg">
          {breadcrumbItems.map((item, index) => (
            <Anchor 
              key={index} 
              href={item?.href} 
              size="sm" 
              c="dimmed"
              style={{ textDecoration: 'none' }}
            >
              {item?.title}
            </Anchor>
          ))}
        </Breadcrumbs>

        {/* Main Content */}
        {selectedCourse === 'overview' ? (
          <Stack gap="lg">
            <TodaysClasses 
              onOpenAudioUpload={handleOpenAudioUpload}
              onOpenDocumentUpload={handleOpenDocumentUpload}
            />
            <LibraryContent 
              selectedCourse={selectedCourse} 
              courses={courses}
              isLoading={isLoading}
              error={error}
            />
          </Stack>
        ) : (
          <LibraryContent 
            selectedCourse={selectedCourse} 
            courses={courses}
            isLoading={isLoading}
            error={error}
          />
        )}
      </AppShell.Main>

      {/* Upload Modals */}
      <DocumentUpload 
        opened={showDocumentUpload}
        onClose={() => {
          setShowDocumentUpload(false);
          setPreselectedCourseId(undefined);
        }}
        preselectedCourseId={preselectedCourseId}
      />
      
      <AudioUpload 
        opened={showAudioUpload}
        onClose={() => {
          setShowAudioUpload(false);
          setPreselectedCourseId(undefined);
        }}
        preselectedCourseId={preselectedCourseId}
      />

      {/* Course Creation Modal */}
      <CourseCreation
        opened={showCourseCreation}
        onClose={handleCourseCreationClose}
      />
    </AppShell>
    </LibraryErrorBoundary>
  );
}