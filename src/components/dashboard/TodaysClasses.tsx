'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Loader,
  Alert,
  Progress,
  Box,
  Menu,
  Tooltip
} from '@mantine/core';
import {
  IconClock,
  IconMapPin,
  IconMicrophone,
  IconFileText,
  IconPlus,
  IconCheck,
  IconAlertCircle,
  IconChevronDown,
  IconCalendarTime,
  IconSchool
} from '@tabler/icons-react';
import { useCourses } from '@/hooks/useCourses';
import { TodaysClasses as TodaysClassesType } from '@/types/course';

interface TodaysClassesProps {
  onOpenAudioUpload: (courseId?: string) => void;
  onOpenDocumentUpload: (courseId?: string) => void;
  refreshKey?: number; // Trigger refresh when this changes
}

export function TodaysClasses({ onOpenAudioUpload, onOpenDocumentUpload, refreshKey }: TodaysClassesProps) {
  const { getTodaysClasses, getCurrentCourse, getUpcomingCourse, fetchCourses, loading } = useCourses();
  const [todaysClasses, setTodaysClasses] = useState<TodaysClassesType[]>([]);
  const [currentCourse, setCurrentCourse] = useState<TodaysClassesType | null>(null);
  const [upcomingCourse, setUpcomingCourse] = useState<TodaysClassesType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Refresh every minute to update current/upcoming status
    const interval = setInterval(() => {
      loadCurrentAndUpcoming();
    }, 60000);

    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const loadData = async () => {
    try {
      // First fetch courses to populate the course data
      await fetchCourses();
      // Then load today's specific classes and current/upcoming
      await loadTodaysClasses();
      loadCurrentAndUpcoming();
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  const loadTodaysClasses = async () => {
    try {
      const classes = await getTodaysClasses();
      setTodaysClasses(classes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today\'s classes');
      setTodaysClasses([]); // Ensure empty array on error
    }
  };

  const loadCurrentAndUpcoming = () => {
    try {
      const current = getCurrentCourse();
      const upcoming = getUpcomingCourse();
      
      setCurrentCourse(current);
      setUpcomingCourse(upcoming);
    } catch (err) {
      console.error('Error loading current/upcoming courses:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'green';
      case 'upcoming': return 'blue';
      case 'completed': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'current': return 'In Progress';
      case 'upcoming': return 'Upcoming';
      case 'completed': return 'Completed';
      default: return 'Scheduled';
    }
  };

  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${period}`;
    } catch {
      return time;
    }
  };

  const getTimeUntilClass = (startTime: string) => {
    const now = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);
    const classTime = new Date();
    classTime.setHours(hours, minutes, 0, 0);
    
    const diff = classTime.getTime() - now.getTime();
    if (diff <= 0) return null;
    
    const totalMinutes = Math.floor(diff / (1000 * 60));
    if (totalMinutes < 60) {
      return `in ${totalMinutes} minutes`;
    }
    
    const hoursUntil = Math.floor(totalMinutes / 60);
    const minutesRemainder = totalMinutes % 60;
    return `in ${hoursUntil}h ${minutesRemainder}m`;
  };

  if (loading) {
    return (
      <Card p="lg" withBorder>
        <Group justify="center" py="xl">
          <Loader size="md" />
          <Text size="sm" c="dimmed">Loading today&rsquo;s classes...</Text>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {/* Current Class Alert */}
      {currentCourse && (
        <Alert color="green" variant="light" icon={<IconCalendarTime size={16} />}>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={500}>
                Currently in class: {currentCourse.name}
              </Text>
              <Text size="xs" c="dimmed">
                Perfect time to upload today&apos;s lecture materials!
              </Text>
            </Box>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconMicrophone size={14} />}
                onClick={() => onOpenAudioUpload(currentCourse.id)}
              >
                Record Audio
              </Button>
              <Button
                size="xs"
                variant="outline"
                leftSection={<IconFileText size={14} />}
                onClick={() => onOpenDocumentUpload(currentCourse.id)}
              >
                Upload Notes
              </Button>
            </Group>
          </Group>
        </Alert>
      )}

      {/* Upcoming Class Alert */}
      {upcomingCourse && !currentCourse && (
        <Alert color="blue" variant="light" icon={<IconClock size={16} />}>
          <Text size="sm">
            <strong>{upcomingCourse.course.name}</strong> starts {getTimeUntilClass(upcomingCourse.timeSlot.startTime)}
            {upcomingCourse.timeSlot.location && ` at ${upcomingCourse.timeSlot.location}`}
          </Text>
        </Alert>
      )}

      {/* Main Classes Card */}
      <Card p="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3} size="h4">
            <Group gap="xs">
              <IconSchool size={20} />
              Today&apos;s Classes
            </Group>
          </Title>
          <Badge variant="light" size="sm">
            {todaysClasses.length} {todaysClasses.length === 1 ? 'class' : 'classes'}
          </Badge>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
            {error}
          </Alert>
        )}

        {todaysClasses.length === 0 ? (
          <Box ta="center" py="xl">
            <Text size="lg" c="dimmed" mb="md">
              No classes scheduled for today
            </Text>
            <Text size="sm" c="dimmed">
              Enjoy your free day or use this time to review your materials!
            </Text>
          </Box>
        ) : (
          <Stack gap="md">
            {todaysClasses.map((classItem, index) => (
              <Card
                key={index}
                p="md"
                withBorder
                style={{
                  borderLeft: `4px solid ${classItem.course.color}`,
                  backgroundColor: classItem.status === 'current' ? 
                    `${classItem.course.color}08` : 'transparent'
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <Box style={{ flex: 1 }}>
                    <Group gap="sm" mb="xs">
                      <Title order={4} size="h5" style={{ color: classItem.course.color }}>
                        {classItem.course.name}
                      </Title>
                      {classItem.course.code && (
                        <Badge variant="outline" size="sm" color={classItem.course.color}>
                          {classItem.course.code}
                        </Badge>
                      )}
                      <Badge 
                        variant="light" 
                        size="sm" 
                        color={getStatusColor(classItem.status)}
                      >
                        {getStatusText(classItem.status)}
                      </Badge>
                    </Group>

                    <Group gap="lg" mb="sm">
                      <Group gap="xs">
                        <IconClock size={14} color="#64748b" />
                        <Text size="sm" c="dimmed">
                          {formatTime(classItem.timeSlot.startTime)} - {formatTime(classItem.timeSlot.endTime)}
                        </Text>
                      </Group>

                      {classItem.timeSlot.location && (
                        <Group gap="xs">
                          <IconMapPin size={14} color="#64748b" />
                          <Text size="sm" c="dimmed">
                            {classItem.timeSlot.location}
                          </Text>
                        </Group>
                      )}

                      {classItem.course.instructor && (
                        <Text size="sm" c="dimmed">
                          with {classItem.course.instructor}
                        </Text>
                      )}
                    </Group>

                    {/* Session Materials Status */}
                    <Group gap="sm">
                      <Group gap="xs">
                        <IconMicrophone 
                          size={14} 
                          color={classItem.session.hasAudio ? '#10b981' : '#64748b'} 
                        />
                        <Text 
                          size="xs" 
                          c={classItem.session.hasAudio ? 'green' : 'dimmed'}
                        >
                          {classItem.session.hasAudio ? 'Audio uploaded' : 'No audio'}
                        </Text>
                      </Group>

                      <Group gap="xs">
                        <IconFileText 
                          size={14} 
                          color={classItem.session.hasNotes ? '#10b981' : '#64748b'} 
                        />
                        <Text 
                          size="xs" 
                          c={classItem.session.hasNotes ? 'green' : 'dimmed'}
                        >
                          {classItem.session.hasNotes ? 'Notes uploaded' : 'No notes'}
                        </Text>
                      </Group>
                    </Group>
                  </Box>

                  {/* Upload Actions */}
                  {classItem.canUpload && (
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <Button
                          size="sm"
                          variant="light"
                          rightSection={<IconChevronDown size={14} />}
                          color={classItem.course.color}
                        >
                          Upload
                        </Button>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconMicrophone size={16} />}
                          onClick={() => onOpenAudioUpload(classItem.course.id)}
                        >
                          Record/Upload Audio
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconFileText size={16} />}
                          onClick={() => onOpenDocumentUpload(classItem.course.id)}
                        >
                          Upload Documents
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {/* Quick Actions */}
        {todaysClasses.length > 0 && (
          <>
            <Box mt="lg" p="sm" style={{ backgroundColor: '#f8fafc', borderRadius: 6 }}>
              <Text size="xs" c="dimmed" mb="xs" fw={500}>
                Quick Actions:
              </Text>
              <Group gap="sm">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconMicrophone size={14} />}
                  onClick={() => onOpenAudioUpload()}
                >
                  Record Audio
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  leftSection={<IconFileText size={14} />}
                  onClick={() => onOpenDocumentUpload()}
                >
                  Upload Documents
                </Button>
              </Group>
            </Box>
          </>
        )}
      </Card>
    </Stack>
  );
}