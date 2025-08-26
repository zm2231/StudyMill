"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Container, Title, Text, Stack, Group, Select, Badge, Paper, Button, Alert, Skeleton, Divider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCoursesWithSWR } from "@/hooks/useCoursesWithSWR";
import { fetchCourseGrades, calculateCategoryStats } from "@/lib/api/grades";
import { GradeWeightsTable, AssignmentsTable } from "@/components/grades";
import { getLetterGrade, getGradeColor } from "@/lib/grades/calc";
import { IconRefresh, IconPercentage, IconClipboardList } from "@tabler/icons-react";

export function GradesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdFromUrl = searchParams.get('courseId');
  
  const { courses, isLoading: loadingCourses, error: coursesError } = useCoursesWithSWR();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState<Awaited<ReturnType<typeof fetchCourseGrades>> | null>(null);

  // Initialize selected course from URL or default to first course
  useEffect(() => {
    if (!loadingCourses && courses && courses.length > 0) {
      if (courseIdFromUrl) {
        // Check if the course ID from URL exists in user's courses
        const courseExists = courses.some(c => c.id === courseIdFromUrl);
        if (courseExists) {
          setSelectedCourseId(courseIdFromUrl);
        } else {
          // Course doesn't exist or user doesn't have access
          setError('Course not found or you don\'t have access to it');
          setSelectedCourseId(courses[0].id);
        }
      } else if (!selectedCourseId) {
        // No course in URL and no course selected, default to first
        setSelectedCourseId(courses[0].id);
      }
    }
  }, [loadingCourses, courses, courseIdFromUrl, selectedCourseId]);

  // Fetch grade data when course changes
  useEffect(() => {
    const load = async () => {
      if (!selectedCourseId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCourseGrades(selectedCourseId);
        setGradeData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load grades';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCourseId]);

  const categoryStats = useMemo(() => {
    if (!gradeData) return [];
    return calculateCategoryStats(gradeData.assignments, gradeData.gradeWeights);
  }, [gradeData]);

  const currentLetter = useMemo(() => {
    if (!gradeData) return '—';
    return getLetterGrade(gradeData.summary.currentGrade);
  }, [gradeData]);

  const currentColor = useMemo(() => {
    if (!gradeData) return 'gray';
    return getGradeColor(gradeData.summary.currentGrade);
  }, [gradeData]);

  // Update URL when course changes
  const handleCourseChange = (courseId: string | null) => {
    setSelectedCourseId(courseId);
    if (courseId) {
      // Update URL without navigation
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('courseId', courseId);
      router.replace(newUrl.pathname + newUrl.search);
    }
  };

  const handleRefresh = async () => {
    if (!selectedCourseId) return;

    notifications.show({
      id: 'grades-refresh',
      title: 'Refreshing grades...',
      message: 'Re-parsing your syllabus to update grade weights and assignments',
      color: 'blue',
      loading: true,
      autoClose: false
    });

    try {
      const { refreshGradesFromSyllabus } = await import('@/lib/api/grades');
      const result = await refreshGradesFromSyllabus(selectedCourseId);

      if (result.success) {
        notifications.update({
          id: 'grades-refresh',
          title: 'Refresh started',
          message: 'We\'ll update your grades once parsing completes.',
          color: 'green',
          loading: false,
          autoClose: true
        });
      } else if (result.requiresUpload) {
        notifications.update({
          id: 'grades-refresh',
          title: 'Upload needed',
          message: 'Please upload a syllabus for this course first.',
          color: 'orange',
          loading: false,
          autoClose: true
        });
      } else {
        notifications.update({
          id: 'grades-refresh',
          title: 'Unable to refresh',
          message: 'Please try again later.',
          color: 'red',
          loading: false,
          autoClose: true
        });
      }

      // Refetch current data regardless
      setLoading(true);
      try {
        const data = await fetchCourseGrades(selectedCourseId);
        setGradeData(data);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      notifications.update({
        id: 'grades-refresh',
        title: 'Failed to refresh',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
        loading: false,
        autoClose: true
      });
    }
  };

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Grades</Title>
          <Group gap="sm">
            {loadingCourses ? (
              <Skeleton height={32} width={240} />
            ) : (
              <Select
                data={(courses || []).map(c => ({ value: c.id, label: c.name }))}
                value={selectedCourseId}
                onChange={handleCourseChange}
                placeholder="Select a course"
                w={260}
              />
            )}
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={handleRefresh}
              disabled={!selectedCourseId}
            >
              Refresh from syllabus
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            <Group justify="space-between" align="center">
              <Text>{error}</Text>
              <Button size="xs" variant="light" onClick={() => selectedCourseId && setSelectedCourseId(selectedCourseId)}>
                Retry
              </Button>
            </Group>
          </Alert>
        )}

        {/* Summary header */}
        <Paper withBorder p="md" radius="md">
          {loading || !gradeData ? (
            <Group gap="lg">
              <Skeleton height={36} width={120} />
              <Skeleton height={18} width={220} />
            </Group>
          ) : (
            <Group gap="lg" align="center">
              <Badge size="xl" color={currentColor} variant="filled">
                {gradeData.summary.currentGrade.toFixed(1)}% ({currentLetter})
              </Badge>
              <Text c="dimmed">
                {gradeData.summary.gradedAssignments}/{gradeData.summary.totalAssignments} assignments graded
              </Text>
              <Text c="dimmed">
                {Math.round(gradeData.summary.earnedWeightPercentage)}% of grade earned
              </Text>
            </Group>
          )}
        </Paper>

        <Group align="start" grow>
          <Paper withBorder p="md" radius="md">
            <Group gap="xs" mb="sm">
              <IconPercentage size={16} />
              <Text fw={600}>Grade Weights</Text>
            </Group>
            {loading || !gradeData ? (
              <Stack>
                <Skeleton height={24} />
                <Skeleton height={24} />
                <Skeleton height={24} />
              </Stack>
            ) : (
              <GradeWeightsTable 
                weights={gradeData.gradeWeights} 
                categoryStats={categoryStats}
              />
            )}
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group gap="xs" mb="sm">
              <IconClipboardList size={16} />
              <Text fw={600}>Assignments</Text>
            </Group>
            {loading || !gradeData ? (
              <Stack>
                <Skeleton height={24} />
                <Skeleton height={24} />
                <Skeleton height={24} />
              </Stack>
            ) : (
              <AssignmentsTable assignments={gradeData.assignments} />
            )}
          </Paper>
        </Group>

        <Divider />
        <Alert variant="light" color="gray">
          <Text size="sm">
            Tip: Add scores to your assignments to see your current and projected grades update instantly.
          </Text>
        </Alert>
      </Stack>
    </Container>
  );
}
