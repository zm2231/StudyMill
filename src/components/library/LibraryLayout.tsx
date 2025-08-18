'use client';

import { useState } from 'react';
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
  Anchor
} from '@mantine/core';
import { 
  IconLogout, 
  IconPlus, 
  IconBook, 
  IconBrain,
  IconChartBar,
  IconSettings,
  IconUpload
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { LibraryContent } from './LibraryContent';
import { DocumentUpload } from './DocumentUpload';

interface Course {
  id: string;
  name: string;
  count: number;
  color: string;
}

export function LibraryLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<string | null>('overview');
  const [showUpload, setShowUpload] = useState(false);

  // Mock courses data - will be replaced with real data
  const courses: Course[] = [
    { id: 'computer-science', name: 'Computer science', count: 50, color: '#3b82f6' },
    { id: 'economics', name: 'Economics', count: 17, color: '#8b5cf6' },
    { id: 'machine-learning', name: 'Machine learning', count: 37, color: '#84cc16' },
    { id: 'psychology', name: 'Psychology', count: 22, color: '#eab308' },
    { id: 'biology', name: 'Biology', count: 14, color: '#10b981' },
    { id: 'mathematics', name: 'Mathematics', count: 28, color: '#f97316' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const handleStartChat = () => {
    router.push('/chat');
  };

  const breadcrumbItems = [
    { title: 'My Library', href: '/dashboard' },
    selectedCourse !== 'overview' && selectedCourse 
      ? { title: courses.find(c => c.id === selectedCourse)?.name || 'Course', href: '#' }
      : null
  ].filter(Boolean);

  return (
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
              <Button 
                size="xs" 
                variant="light" 
                leftSection={<IconPlus size={14} />}
                onClick={() => setShowUpload(true)}
              >
                Add
              </Button>
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
            <Text size="sm" fw={600} c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: 0.5 }}>
              My Library
            </Text>
            
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
        <LibraryContent 
          selectedCourse={selectedCourse} 
          courses={courses}
        />
      </AppShell.Main>

      {/* Upload Modal */}
      <DocumentUpload 
        opened={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </AppShell>
  );
}