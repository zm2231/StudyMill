'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Card,
  Table,
  ActionIcon,
  Group,
  Badge,
  Button,
  TextInput,
  Select,
  Switch,
  Stack,
  Text,
  Menu,
  Checkbox,
  Breadcrumbs,
  Alert
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconArchive,
  IconEye,
  IconPlus,
  IconDots,
  IconRestore,
  IconCalendar,
  IconSearch
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { CourseCreation } from '@/components/courses/CourseCreation';
import { notifications } from '@mantine/notifications';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  course_count?: number;
}

interface CourseWithDetails {
  id: string;
  name: string;
  code?: string;
  color: string;
  instructor?: string;
  credits?: number;
  semester_id?: string;
  archived?: boolean;
  memoryCount: number;
  created_at: string;
  updated_at: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<CourseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { preferences } = useUserPreferences();

  useEffect(() => {
    fetchSemesters();
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [selectedSemester, showArchived]);

  const fetchSemesters = async () => {
    try {
      const { apiClient } = await import('@/lib/api');
      const data = await apiClient.request<{ semesters: Semester[] }>('/api/v1/semesters');
      setSemesters(data.semesters);
    } catch (error) {
      console.error('Failed to fetch semesters:', error);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('@/lib/api');
      let url = '/api/v1/courses?';
      if (selectedSemester !== 'all') {
        url += `semester_id=${selectedSemester}&`;
      }
      if (showArchived) {
        url += 'include_archived=true';
      }

      const data = await apiClient.request<{ courses: CourseWithDetails[] }>(url);
      setCourses(data.courses);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveCourse = async (courseId: string) => {
    try {
      const { apiClient } = await import('@/lib/api');
      await apiClient.request(`/api/v1/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
        headers: { 'Content-Type': 'application/json' }
      });

      notifications.show({
        title: 'Course archived',
        message: 'The course has been archived successfully',
        color: 'green'
      });
      fetchCourses();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to archive course',
        color: 'red'
      });
    }
  };

  const handleRestoreCourse = async (courseId: string) => {
    try {
      const { apiClient } = await import('@/lib/api');
      await apiClient.request(`/api/v1/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: false }),
        headers: { 'Content-Type': 'application/json' }
      });

      notifications.show({
        title: 'Course restored',
        message: 'The course has been restored successfully',
        color: 'green'
      });
      fetchCourses();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to restore course',
        color: 'red'
      });
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to permanently delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      const { apiClient } = await import('@/lib/api');
      await apiClient.request(`/api/v1/courses/${courseId}`, {
        method: 'DELETE'
      });

      notifications.show({
        title: 'Course deleted',
        message: 'The course has been permanently deleted',
        color: 'green'
      });
      fetchCourses();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete course',
        color: 'red'
      });
    }
  };

  const handleBulkArchive = async () => {
    if (selectedCourses.length === 0) return;

    try {
      const { apiClient } = await import('@/lib/api');
      await Promise.all(
        selectedCourses.map(courseId =>
          apiClient.request(`/api/v1/courses/${courseId}`, {
            method: 'PATCH',
            body: JSON.stringify({ archived: true }),
            headers: { 'Content-Type': 'application/json' }
          })
        )
      );

      notifications.show({
        title: 'Courses archived',
        message: `${selectedCourses.length} courses have been archived`,
        color: 'green'
      });

      setSelectedCourses([]);
      fetchCourses();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to archive selected courses',
        color: 'red'
      });
    }
  };

  const filteredCourses = courses.filter(course => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        course.name.toLowerCase().includes(query) ||
        course.code?.toLowerCase().includes(query) ||
        course.instructor?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const currentSemester = semesters.find(s => s.is_current);

  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="xl" py="md">
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Breadcrumbs>
                <Link href="/dashboard">Dashboard</Link>
                <Text>Courses</Text>
              </Breadcrumbs>
              <Group gap="xs">
                <Button variant="subtle" onClick={() => router.back()}>Back</Button>
                <Button component={Link} href="/dashboard" variant="light">Home</Button>
              </Group>
            </Group>

            <Group justify="space-between">
              <Title order={2}>Course Management</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  if (preferences.universityId === 'uga') {
                    router.push('/courses/new/crn');
                  } else {
                    setShowCreateModal(true);
                  }
                }}
              >
                New Course
              </Button>
            </Group>

            {preferences.universityId === 'uga' && (
              <Alert variant="light" color="red">
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Text fw={600}>UGA detected</Text>
                    <Text size="sm" c="dimmed">Add courses faster via CRN using the official UGA catalog.</Text>
                  </div>
                  <Button size="xs" variant="light" color="red" onClick={() => router.push('/courses/new/crn')}>
                    Add by CRN
                  </Button>
                </Group>
              </Alert>
            )}

            <Card withBorder p="md">
              <Group gap="md">
                <TextInput
                  placeholder="Search courses..."
                  leftSection={<IconSearch size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  style={{ flex: 1, maxWidth: 300 }}
                />

                <Select
                  placeholder="Filter by semester"
                  value={selectedSemester}
                  onChange={(value) => setSelectedSemester(value || 'all')}
                  data={[
                    { value: 'all', label: 'All Semesters' },
                    ...semesters.map(s => ({
                      value: s.id,
                      label: `${s.name}${s.is_current ? ' (Current)' : ''}`
                    }))
                  ]}
                  style={{ width: 200 }}
                />

                <Switch
                  label="Show archived"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.currentTarget.checked)}
                />

                {selectedCourses.length > 0 && (
                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<IconArchive size={16} />}
                    onClick={handleBulkArchive}
                  >
                    Archive Selected ({selectedCourses.length})
                  </Button>
                )}
              </Group>
            </Card>

            {currentSemester && (
              <Card withBorder p="sm" bg="var(--sanctuary-surface)">
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm">
                    Current Semester: <strong>{currentSemester.name}</strong>
                  </Text>
                  <Text size="sm" c="dimmed">
                    ({new Date(currentSemester.start_date).toLocaleDateString()} - {new Date(currentSemester.end_date).toLocaleDateString()})
                  </Text>
                </Group>
              </Card>
            )}

            <Card withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>
                      <Checkbox
                        checked={selectedCourses.length === filteredCourses.length && filteredCourses.length > 0}
                        indeterminate={selectedCourses.length > 0 && selectedCourses.length < filteredCourses.length}
                        onChange={(e) => {
                          if (e.currentTarget.checked) {
                            setSelectedCourses(filteredCourses.map(c => c.id));
                          } else {
                            setSelectedCourses([]);
                          }
                        }}
                      />
                    </Table.Th>
                    <Table.Th>Course</Table.Th>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Instructor</Table.Th>
                    <Table.Th>Credits</Table.Th>
                    <Table.Th>Semester</Table.Th>
                    <Table.Th>Materials</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loading ? (
                    <Table.Tr>
                      <Table.Td colSpan={9} style={{ textAlign: 'center' }}>
                        Loading courses...
                      </Table.Td>
                    </Table.Tr>
                  ) : filteredCourses.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={9} style={{ textAlign: 'center' }}>
                        No courses found
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredCourses.map((course) => {
                      const semester = semesters.find(s => s.id === course.semester_id);
                      return (
                        <Table.Tr key={course.id}>
                          <Table.Td>
                            <Checkbox
                              checked={selectedCourses.includes(course.id)}
                              onChange={(e) => {
                                if (e.currentTarget.checked) {
                                  setSelectedCourses([...selectedCourses, course.id]);
                                } else {
                                  setSelectedCourses(selectedCourses.filter(id => id !== course.id));
                                }
                              }}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <div
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: course.color,
                                  flexShrink: 0
                                }}
                              />
                              <Text fw={500}>{course.name}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>{course.code || '-'}</Table.Td>
                          <Table.Td>{course.instructor || '-'}</Table.Td>
                          <Table.Td>{course.credits || '-'}</Table.Td>
                          <Table.Td>
                            {semester ? (
                              <Badge variant="light" size="sm">
                                {semester.name}
                              </Badge>
                            ) : '-'}
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="outline" size="sm">
                              {course.memoryCount} items
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {course.archived ? (
                              <Badge color="gray" size="sm">Archived</Badge>
                            ) : (
                              <Badge color="green" size="sm">Active</Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Menu shadow="md" width={200}>
                              <Menu.Target>
                                <ActionIcon variant="subtle">
                                  <IconDots size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<IconEye size={14} />}
                                  onClick={() => window.location.href = `/courses/${course.id}`}
                                >
                                  View
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconEdit size={14} />}
                                  onClick={() => {
                                    setEditingCourse(course);
                                    setShowEditModal(true);
                                  }}
                                >
                                  Edit
                                </Menu.Item>
                                <Menu.Divider />
                                {course.archived ? (
                                  <Menu.Item
                                    leftSection={<IconRestore size={14} />}
                                    onClick={() => handleRestoreCourse(course.id)}
                                  >
                                    Restore
                                  </Menu.Item>
                                ) : (
                                  <Menu.Item
                                    leftSection={<IconArchive size={14} />}
                                    onClick={() => handleArchiveCourse(course.id)}
                                  >
                                    Archive
                                  </Menu.Item>
                                )}
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => handleDeleteCourse(course.id)}
                                >
                                  Delete
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Card>

            <CourseCreation
              opened={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => {
                setShowCreateModal(false);
                fetchCourses();
              }}
            />

            <CourseCreation
              opened={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setEditingCourse(null);
              }}
              onSuccess={() => {
                setShowEditModal(false);
                setEditingCourse(null);
                fetchCourses();
              }}
              editMode={!!editingCourse}
              initialData={editingCourse || undefined}
            />
          </Stack>
        </Container>
      </AppShell>
    </ProtectedRoute>
  );
}
