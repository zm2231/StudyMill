'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Box,
  Menu,
  Tooltip,
  Divider
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
import { TodaysClasses as TodaysClassesType, Course } from '@/types/course';
import { format } from 'date-fns';

interface WeeklyScheduleProps {
  onOpenAudioUpload: (courseId?: string) => void;
  onOpenDocumentUpload: (courseId?: string) => void;
  refreshKey?: number; // Trigger refresh when this changes
}

export function WeeklySchedule({ onOpenAudioUpload, onOpenDocumentUpload, refreshKey }: WeeklyScheduleProps) {
  const { courses, fetchCourses, getCurrentCourse, getUpcomingCourse, loading } = useCourses();
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = prev week, +1 = next week

  // Compute week start (Monday) based on offset
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const mondayDiff = day === 0 ? -6 : 1 - day; // days to Monday of this week
    const baseMonday = new Date(now);
    baseMonday.setDate(now.getDate() + mondayDiff);
    // Apply offset in weeks
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const currentCourse = useMemo(() => getCurrentCourse(), [getCurrentCourse, courses]);
  const upcomingCourse = useMemo(() => getUpcomingCourse(), [getUpcomingCourse, courses]);

  useEffect(() => {
    // Load courses initially or when refresh key changes
    fetchCourses().catch(err => {
      console.error('Error loading courses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    });

    // Periodic refresh for current/upcoming status
    const interval = setInterval(() => {
      // No-op: current/upcoming recomputed from state; could refetch if needed
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchCourses, refreshKey]);

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

  // Build weekly classes from repeating course schedules filtered by semester date window
  const weeklyClasses = useMemo(() => {
    if (!courses || courses.length === 0) return weekDays.map(d => ({ date: d, classes: [] as TodaysClassesType[] }));

    const result = weekDays.map(d => ({ date: d, classes: [] as TodaysClassesType[] }));

    for (const course of courses as Course[]) {
      if (!course.schedule || !Array.isArray(course.schedule)) continue;

      for (const dayIndex in result) {
        const idx = Number(dayIndex);
        const dayDate = result[idx].date;
        // Check within semester
        const withinSemester = (() => {
          try {
            const sd = new Date(course.semester.startDate);
            const ed = new Date(course.semester.endDate);
            sd.setHours(0, 0, 0, 0);
            ed.setHours(23, 59, 59, 999);
            return dayDate >= sd && dayDate <= ed;
          } catch {
            return true;
          }
        })();
        if (!withinSemester) continue;

        const dow = dayDate.getDay(); // 0..6
        const slots = course.schedule.filter(s => s.dayOfWeek === dow);
        for (const slot of slots) {
          const now = new Date();
          const todayDow = now.getDay();
          const currentTime = now.toTimeString().slice(0, 5);
          let status: 'upcoming' | 'current' | 'completed' = 'scheduled' as any;
          if (dow === todayDow) {
            if (currentTime < slot.startTime) status = 'upcoming';
            else if (currentTime > slot.endTime) status = 'completed';
            else status = 'current';
          } else {
            status = dayDate < new Date(now.toDateString()) ? 'completed' : 'upcoming';
          }

          const item: TodaysClassesType = {
            course,
            session: {
              id: `${course.id}_${format(dayDate, 'yyyyMMdd')}`,
              courseId: course.id,
              date: format(dayDate, 'yyyy-MM-dd'),
              week: 0,
              hasAudio: false,
              hasNotes: false,
              materials: { documentIds: [], memoryIds: [] },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            timeSlot: slot,
            status,
            canUpload: true
          };
          result[idx].classes.push(item);
        }
      }
    }

    // Sort classes within each day by start time
    result.forEach(day => {
      day.classes.sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime));
    });

    return result;
  }, [courses, weekDays]);

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
          <Text size="sm" c="dimmed">Loading weekly schedule...</Text>
        </Group>
      </Card>
    );
  }

  const weekLabel = `${format(weekDays[0], 'MMM d')} — ${format(weekDays[6], 'MMM d')}`;

  return (
    <Stack gap="md">
      {/* Header with week navigation */}
      <Group justify="space-between">
        <Title order={3} size="h4">
          <Group gap="xs">
            <IconSchool size={20} />
            Weekly Schedule
          </Group>
        </Title>
        <Group gap="sm">
          <Button variant="light" size="xs" onClick={() => setWeekOffset(o => o - 1)}>
            Previous
          </Button>
          <Badge variant="light" size="sm">{weekLabel}</Badge>
          <Button variant="light" size="xs" onClick={() => setWeekOffset(o => o + 1)}>
            Next
          </Button>
        </Group>
      </Group>

      {/* Current Class Alert */}
      {currentCourse && (
        <Alert color="green" variant="light" icon={<IconCalendarTime size={16} />}>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={500}>
                Currently in class: {currentCourse.name}
              </Text>
              <Text size="xs" c="dimmed">
                Perfect time to upload this week&apos;s lecture materials!
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

      {/* Weekly day-by-day classes */}
      <Card p="lg" withBorder>
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
            {error}
          </Alert>
        )}

        <Stack gap="lg">
          {weeklyClasses.every(d => d.classes.length === 0) ? (
            <Box ta="center" py="xl">
              <Text size="lg" c="dimmed" mb="md">
                No classes scheduled this week
              </Text>
              <Text size="sm" c="dimmed">
                Use this time to review your materials or plan ahead!
              </Text>
            </Box>
          ) : (
            weeklyClasses.map((day, idx) => (
              <Box key={idx}>
                <Group justify="space-between" mb="xs">
                  <Group gap="sm">
                    <Badge variant="light" color="gray">
                      {format(day.date, 'EEE, MMM d')}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {day.classes.length} {day.classes.length === 1 ? 'class' : 'classes'}
                    </Text>
                  </Group>
                </Group>
                {day.classes.length === 0 ? (
                  <Text size="sm" c="dimmed">No classes</Text>
                ) : (
                  <Stack gap="sm">
                    {day.classes.map((classItem, index) => (
                      <Card
                        key={index}
                        p="md"
                        withBorder
                        style={{
                          borderLeft: `4px solid ${classItem.course.color}`,
                          backgroundColor: classItem.status === 'current' ? `${classItem.course.color}08` : 'transparent'
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
                                  <Text size="sm" c="dimmed">{classItem.timeSlot.location}</Text>
                                </Group>
                              )}
                              {classItem.course.instructor && (
                                <Text size="sm" c="dimmed">with {classItem.course.instructor}</Text>
                              )}
                            </Group>
                          </Box>

                          {/* Upload actions */}
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
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
                {idx < weeklyClasses.length - 1 && <Divider my="md" />}
              </Box>
            ))
          )}
        </Stack>
      </Card>
    </Stack>
  );
}