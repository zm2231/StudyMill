'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Container, Title, Text, Paper, Stack, Group, Select, TextInput, Button, Alert, Card, Divider } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { SyllabusIngestSummary } from '@/components/courses/SyllabusIngestSummary';

const TERM_OPTIONS = [
  { value: '202508', label: 'Fall 2025 (202508)' },
  { value: '202601', label: 'Spring 2026 (202601)' }
];

export default function CreateCourseByCRNPage() {
  const [termCode, setTermCode] = useState<string>('202508');
  const [crn, setCrn] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syllabusModal, setSyllabusModal] = useState<{ open: boolean; courseId?: string; courseName?: string }>({ open: false });
  const [semesters, setSemesters] = useState<Array<{ id: string; name: string }>>([]);
  const [semesterId, setSemesterId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { apiClient } = await import('@/lib/api');
        const res = await apiClient.request<{ semesters: Array<{ id: string; name: string }> }>(`/api/v1/semesters`);
        setSemesters(res.semesters || []);
      } catch {}
    })();
  }, []);

  const lookup = async () => {
    setError(null);
    setPreview(null);
    try {
      const { apiClient } = await import('@/lib/api');
      const res = await apiClient.request(`/api/v1/crn/lookup?term_code=${termCode}&crn=${encodeURIComponent(crn)}`);
      setPreview(res.course_preview);
    } catch (e: any) {
      setError(e?.message || 'Lookup failed');
    }
  };

  const createCourse = async () => {
    setCreating(true);
    setError(null);
    try {
      const { apiClient } = await import('@/lib/api');
      const res = await apiClient.request(`/api/v1/crn/create-course`, {
        method: 'POST',
        body: { term_code: termCode, crn, semester_id: semesterId || undefined }
      });
      const course = res.course;
      setSyllabusModal({ open: true, courseId: course.id, courseName: `${course.code} - ${course.name}` });
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <Container size="md" py="xl">
          <Stack gap="lg">
            <Title order={2}>Add Course by CRN (UGA)</Title>
            <Text c="dimmed">Enter the term and CRN to auto-fill course details, then upload your syllabus/schedule.</Text>

            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Group grow>
                  <Select label="Term" data={TERM_OPTIONS} value={termCode} onChange={(v) => setTermCode(v || '')} />
                  <TextInput label="CRN" placeholder="5-digit CRN" value={crn} onChange={(e) => setCrn(e.currentTarget.value)} />
                </Group>
                <Group grow>
                  <Select
                    label="Assign to Semester (optional)"
                    placeholder="Select a semester"
                    data={semesters.map(s => ({ value: s.id, label: s.name }))}
                    value={semesterId}
                    onChange={(v) => setSemesterId(v)}
                    clearable
                  />
                </Group>
                <Group>
                  <Button onClick={lookup} disabled={!crn || crn.length !== 5}>Preview</Button>
                  <Button onClick={createCourse} disabled={!crn || crn.length !== 5 || !termCode} loading={creating} color="green">Create and Upload Syllabus</Button>
                </Group>
                {error && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>
                )}
              </Stack>
            </Paper>

            {preview && (
              <Card withBorder>
                <Title order={4}>Preview</Title>
                <Divider my="sm" />
                <Stack gap={4}>
                  <Text><b>Title:</b> {preview.title}</Text>
                  <Text><b>Code:</b> {preview.code}</Text>
                  <Text><b>Instructor:</b> {preview.instructor}</Text>
                  <Text><b>Days:</b> {preview.days}</Text>
                  <Text><b>Time:</b> {preview.start_time || '-'} - {preview.end_time || '-'}</Text>
                  <Text><b>Location:</b> {preview.location || '-'}</Text>
                </Stack>
              </Card>
            )}
          </Stack>
        </Container>

        {syllabusModal.open && (
          <SyllabusIngestSummary
            opened={syllabusModal.open}
            onClose={() => setSyllabusModal({ open: false })}
            courseId={syllabusModal.courseId!}
            courseName={syllabusModal.courseName || 'Course'}
            onSuccess={() => setSyllabusModal({ open: false })}
          />
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
