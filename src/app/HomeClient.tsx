"use client";

import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Group,
  Badge,
  ActionIcon,
  Stack,
  Box,
  Paper,
  Divider,
  Loader,
  SimpleGrid
} from "@mantine/core";
import {
  IconBook,
  IconBrain,
  IconUpload,
  IconBookmarks,
  IconSearch,
  IconSchool,
  IconArrowRight,
  IconCheck,
  IconCalendarTime
} from "@tabler/icons-react";
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function HomeClient() {
  const { isAuthenticated, isLoading } = useAuth();

  const getStartedHref = isAuthenticated ? '/dashboard' : '/auth/register';
  const crnHref = isAuthenticated ? '/courses/new/crn' : '/auth/register?next=/courses/new/crn';

  const benefits = [
    'Import UGA courses by CRN in seconds',
    'Auto-build semester weeks from the UGA academic calendar',
    'Upload PDFs and DOCX, then search and cite answers instantly',
    'Chat with your documents to get clear explanations',
    'Organize everything by Courses and your Library',
    'Plan assignments with a week-by-week view',
  ];

  return (
    <Box className="sanctuary-texture" style={{ minHeight: '100vh' }}>
      <Container size="lg" py="xl">
        <Stack gap="xl">
          {/* Hero Section */}
          <Paper
            p="xl"
            radius="lg"
            style={{
              textAlign: 'center',
              background: 'var(--sanctuary-card)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 8px 24px rgba(44, 42, 41, 0.08)'
            }}
          >
            <Group justify="center" mb="lg">
              <ActionIcon size={60} variant="light" color="forestGreen" radius="md" aria-label="Academic tools">
                <IconSchool size={32} aria-hidden />
              </ActionIcon>
            </Group>

            <Title
              order={1}
              size="3rem"
              fw={800}
              mb="md"
              style={{
                color: 'var(--sanctuary-text-primary)',
                letterSpacing: '-0.02em'
              }}
            >
              Study smarter at UGA in minutes
            </Title>

            <Text
              size="lg"
              mb="md"
              className="reading-width academic-content"
              style={{
                margin: '0 auto',
                color: 'var(--sanctuary-text-primary)',
                maxWidth: '40rem'
              }}
            >
              Import UGA courses by CRN, auto-apply academic dates, and turn PDFs into searchable notes with AI.
            </Text>

            <Group justify="center" gap="md">
              {isLoading ? (
                <Loader size="md" style={{ '--loader-color': 'var(--forest-green-primary)' } as any} />
              ) : (
                <>
                  <Button
                    size="lg"
                    rightSection={<IconArrowRight size={20} aria-hidden />}
                    radius="sm"
                    component={Link}
                    href={getStartedHref}
                    aria-label={isAuthenticated ? 'Go to Dashboard' : 'Create your free account'}
                    data-analytics-id="hero-cta-primary"
                    style={{
                      background: 'var(--forest-green-primary)',
                      border: '1px solid var(--forest-green-primary)'
                    }}
                  >
                    {isAuthenticated ? 'Go to Dashboard' : 'Create your free account'}
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    leftSection={<IconBookmarks size={20} aria-hidden />}
                    radius="sm"
                    component={Link}
                    href={crnHref}
                    aria-label={isAuthenticated ? 'Add a Course by CRN' : 'Import by CRN after signup'}
                    data-analytics-id="hero-cta-crn"
                  >
                    {isAuthenticated ? 'Add by CRN' : 'Import by CRN'}
                  </Button>

                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      size="lg"
                      leftSection={<IconBook size={20} aria-hidden />}
                      radius="sm"
                      component={Link}
                      href="/auth/login"
                      aria-label="Sign in"
                      style={{
                        borderColor: 'var(--warm-brown)',
                        color: 'var(--warm-brown)'
                      }}
                    >
                      Sign In
                    </Button>
                  )}
                </>
              )}
            </Group>

            <Text size="sm" mt="md" style={{ color: 'var(--sanctuary-text-secondary)' }}>
              Free to start • No credit card required • Built for students • Works with any university
            </Text>

            {/* UGA callout */}
            <Paper
              role="region"
              aria-label="UGA-focused callout"
              withBorder
              p="sm"
              mt="md"
              radius="md"
              style={{ background: 'var(--sanctuary-surface)' }}
            >
              <Group justify="center" gap="xs" wrap="wrap">
                <Badge variant="light" color="red">UGA Optimized</Badge>
                <Text size="sm" c="dimmed">Import by CRN • Academic dates integrated</Text>
                <Button
                  component={Link}
                  href={crnHref}
                  size="xs"
                  variant="light"
                  color="red"
                >
                  {isAuthenticated ? 'Add by CRN' : 'Import by CRN'}
                </Button>
              </Group>
            </Paper>
          </Paper>

          {/* Benefits */}
          <Paper
            p="xl"
            radius="lg"
            style={{
              background: 'var(--sanctuary-surface)',
              border: '1px solid var(--border-light)',
            }}
          >
            <Title order={2} ta="center" mb="xl" style={{ color: 'var(--sanctuary-text-primary)' }}>
              Why Students Choose StudyMill
            </Title>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              {benefits.map((benefit, index) => (
                <Group key={index} align="flex-start">
                  <ActionIcon
                    size="sm"
                    variant="light"
                    color="forestGreen"
                    radius="xl"
                    style={{ marginTop: 2 }}
                    aria-label="benefit"
                  >
                    <IconCheck size={14} aria-hidden />
                  </ActionIcon>
                  <Text
                    size="md"
                    className="academic-content"
                    style={{ color: 'var(--sanctuary-text-primary)', flex: 1 }}
                  >
                    {benefit}
                  </Text>
                </Group>
              ))}
            </SimpleGrid>
          </Paper>

          <Divider
            style={{
              borderColor: 'var(--border-medium)',
              margin: '2rem 0'
            }}
          />

          {/* Features Grid */}
          <Box>
            <Title
              order={2}
              ta="center"
              mb="xl"
              style={{
                color: 'var(--sanctuary-text-primary)',
                fontWeight: 600
              }}
            >
              Thoughtfully Designed Study Tools
            </Title>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem'
            }}>
              {/* Document Processing */}
              <Card p="lg" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
                <Group mb="md" align="flex-start">
                  <ActionIcon size="lg" variant="light" color="forestGreen" radius="sm">
                    <IconUpload size={22} aria-hidden />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Document Processing</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Foundation
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Upload PDFs and DOCX files to extract key ideas and create searchable memories.
                </Text>
                <Badge mt="md" variant="light" color="forestGreen" style={{ fontWeight: 500 }}>
                  Smart Processing
                </Badge>
              </Card>

              {/* AI Study Companion */}
              <Card p="lg" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
                <Group mb="md" align="flex-start">
                  <ActionIcon size="lg" variant="light" color="warmAccents" radius="sm">
                    <IconBrain size={22} aria-hidden />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">AI Study Companion</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Intelligence
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Chat with your materials and get personalized guidance.
                </Text>
                <Badge mt="md" variant="light" color="warmAccents" style={{ fontWeight: 500 }}>
                  AI-Powered
                </Badge>
              </Card>

              {/* Semantic Search */}
              <Card p="lg" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
                <Group mb="md" align="flex-start">
                  <ActionIcon size="lg" variant="light" color="forestGreen" radius="sm">
                    <IconSearch size={22} aria-hidden />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Semantic Search</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Discovery
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Find information across all your materials with hybrid search that understands context.
                </Text>
                <Badge mt="md" variant="light" color="forestGreen" style={{ fontWeight: 500 }}>
                  Smart Search
                </Badge>
              </Card>

              {/* Memory Organization */}
              <Card p="lg" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
                <Group mb="md" align="flex-start">
                  <ActionIcon size="lg" variant="light" color="warmAccents" radius="sm">
                    <IconBookmarks size={22} aria-hidden />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Memory Organization</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Curation
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Tag, curate, and connect knowledge by topic and course.
                </Text>
                <Badge mt="md" variant="light" color="warmAccents" style={{ fontWeight: 500 }}>
                  Organization
                </Badge>
              </Card>

              {/* Courses and Library */}
              <Card p="lg" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
                <Group mb="md" align="flex-start">
                  <ActionIcon size="lg" variant="light" color="forestGreen" radius="sm">
                    <IconBookmarks size={22} aria-hidden />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Courses and Library</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Course Tools
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Manage your courses, syllabi, and files in one place.
                </Text>
                <Badge mt="md" variant="light" color="forestGreen" style={{ fontWeight: 500 }}>
                  Course Tools
                </Badge>
              </Card>

              {/* Planner and Calendar */}
              <Card p="lg" style={{ background: 'var(--sanctuary-card)', border: '1px solid var(--border-light)' }}>
                <Group mb="md" align="flex-start">
                  <ActionIcon size="lg" variant="light" color="forestGreen" radius="sm">
                    <IconCalendarTime size={22} aria-hidden />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Planner and Calendar</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      UGA Ready
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Track assignments and deadlines with UGA academic dates.
                </Text>
                <Badge mt="md" variant="light" color="forestGreen" style={{ fontWeight: 500 }}>
                  UGA Ready
                </Badge>
              </Card>
            </div>
          </Box>

          {/* How It Works */}
          <Paper
            p="xl"
            radius="lg"
            style={{
              background: 'var(--forest-green-light)',
              border: '1px solid var(--forest-green-primary)',
            }}
          >
            <Title order={2} ta="center" mb="xl" style={{ color: 'var(--forest-green-primary)' }}>
              How It Works
            </Title>

            <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xl">
              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconSchool size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  1. Choose UGA
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Select University of Georgia during sign-up (you can change this anytime).
                </Text>
              </Box>

              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconBookmarks size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  2. Import by CRN
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Enter term and CRN to add your course automatically.
                </Text>
              </Box>

              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconUpload size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  3. Upload your syllabus
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  We extract key dates and assignments to build your plan.
                </Text>
              </Box>

              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconCalendarTime size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  4. Study and plan
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Chat with your documents, search across courses, and stay on track with the planner.
                </Text>
              </Box>
            </SimpleGrid>
          </Paper>

          {/* Final CTA */}
          <Paper
            p="xl"
            radius="lg"
            style={{
              background: 'var(--sanctuary-surface)',
              border: '1px solid var(--border-medium)',
              textAlign: 'center'
            }}
          >
            <Stack gap="lg" align="center">
              <Title order={2} style={{ color: 'var(--sanctuary-text-primary)', maxWidth: 560 }}>
                Ready to set up your semester?
              </Title>

              <Text
                size="lg"
                className="academic-content"
                style={{
                  color: 'var(--sanctuary-text-secondary)',
                  maxWidth: 480
                }}
              >
                Start free, import UGA courses by CRN, and turn your materials into answers.
              </Text>

              <Group gap="sm" justify="center">
                <Button
                  size="md"
                  rightSection={<IconArrowRight size={20} aria-hidden />}
                  component={Link}
                  href={getStartedHref}
                  data-analytics-id="final-cta-primary"
                  style={{
                    background: 'var(--forest-green-primary)',
                    border: 'none',
                    height: 48,
                    paddingLeft: 28,
                    paddingRight: 28,
                    fontWeight: 600,
                    marginTop: 8
                  }}
                >
                  {isAuthenticated ? 'Enter Dashboard' : 'Create your free account'}
                </Button>

                <Button
                  variant="subtle"
                  size="md"
                  component={Link}
                  href={crnHref}
                  data-analytics-id="final-cta-crn"
                >
                  {isAuthenticated ? 'Add by CRN' : 'Import by CRN after signup'}
                </Button>
              </Group>

              <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                Free forever • No credit card required • Built for students
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

