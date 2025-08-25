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
    'Upload PDFs, search instantly',
    'Chat with your documents to get clear explanations',
    'Organize everything by Courses and your Library',
    'Plan assignments with a week-by-week view',
    'Find what you need with hybrid semantic search',
    'Keep deadlines and materials in one place',
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
              Study smarter with AI
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
              Turn your PDFs and documents into searchable notes, chat with your materials, and plan your semester, at any university.
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

          {/* UGA Support Section (third section) */}
          <Paper
            id="uga-support"
            p="xl"
            radius="lg"
            style={{
              background: 'var(--sanctuary-surface)',
              border: '1px solid var(--border-light)'
            }}
          >
            <Stack gap="md">
              <Group gap="xs">
                <Badge variant="light" color="forestGreen">University-specific support</Badge>
              </Group>
              <Title order={3} style={{ color: 'var(--sanctuary-text-primary)' }}>
                UGA support
              </Title>
              <Text size="md" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                If you study at the University of Georgia, you can:
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Group align="flex-start">
                  <ActionIcon size="sm" variant="light" color="forestGreen" radius="xl" aria-label="benefit">
                    <IconCheck size={14} aria-hidden />
                  </ActionIcon>
                  <Text size="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                    Import courses by CRN
                  </Text>
                </Group>
                <Group align="flex-start">
                  <ActionIcon size="sm" variant="light" color="forestGreen" radius="xl" aria-label="benefit">
                    <IconCheck size={14} aria-hidden />
                  </ActionIcon>
                  <Text size="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                    Auto-apply academic dates in the planner
                  </Text>
                </Group>
              </SimpleGrid>
              <Group>
                <Button
                  component={Link}
                  href={crnHref}
                  variant="light"
                  color="forestGreen"
                  data-analytics-id="uga-cta-crn"
                >
                  {isAuthenticated ? 'Add by CRN' : 'Import by CRN'}
                </Button>
                <Text size="sm" c="dimmed">More universities coming soon.</Text>
              </Group>
            </Stack>
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
              mb="xs"
              style={{
                color: 'var(--sanctuary-text-primary)',
                fontWeight: 600
              }}
            >
              Thoughtfully Designed Study Tools
            </Title>
            <Text ta="center" size="sm" style={{ color: 'var(--sanctuary-text-secondary)', marginBottom: '1rem' }}>
              Have UGA-specific needs? <a href="#uga-support" style={{ color: 'var(--forest-green-primary)', textDecoration: 'none' }}>See our UGA support</a>.
            </Text>

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
                      Planner
                    </Text>
                  </Box>
                </Group>
                <Text className="academic-content" style={{ color: 'var(--sanctuary-text-primary)', fontSize: '0.95rem' }}>
                  Track assignments and deadlines with your academic calendar.
                </Text>
                <Badge mt="md" variant="light" color="forestGreen" style={{ fontWeight: 500 }}>
                  Planner
                </Badge>
              </Card>
            </div>
          </Box>

          {/* How It Works (General) */}
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
                  <IconBookmarks size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  1. Add your courses
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Create or import courses to keep materials organized.
                </Text>
              </Box>

              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconUpload size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  2. Upload documents
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  PDFs and DOCX become searchable, organized notes.
                </Text>
              </Box>

              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconBrain size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  3. AI processing
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Extract key ideas and create memories automatically.
                </Text>
              </Box>

              <Box ta="center">
                <ActionIcon size={60} variant="light" color="forestGreen" radius="md" mb="md" mx="auto">
                  <IconSearch size={28} aria-hidden />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  4. Search & study
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Find answers instantly and stay on track with the planner.
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
                Start free and turn your materials into answers with AI-powered search and study tools.
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

