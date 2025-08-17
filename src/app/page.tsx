'use client';

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
  Loader
} from "@mantine/core";
import { 
  IconBook, 
  IconBrain, 
  IconUpload,
  IconBookmarks,
  IconClock,
  IconSchool
} from "@tabler/icons-react";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/auth/register');
    }
  };

  return (
    <Box className="sanctuary-texture" style={{ minHeight: '100vh' }}>
      <Container size="lg" py="xl">
        <Stack gap="xl">
          {/* Hero Section with Academic Sanctuary styling */}
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
              <ActionIcon size={60} variant="light" color="forestGreen" radius="md">
                <IconSchool size={32} />
              </ActionIcon>
            </Group>
            
            <Title 
              order={1} 
              size="3rem" 
              fw={700} 
              mb="md"
              style={{ 
                color: 'var(--sanctuary-text-primary)',
                letterSpacing: '-0.02em'
              }}
            >
              StudyMill
            </Title>
            
            <Text 
              size="xl" 
              mb="lg"
              style={{ 
                color: 'var(--sanctuary-text-secondary)',
                fontWeight: 500,
                letterSpacing: '0.01em'
              }}
            >
              Your Academic Sanctuary
            </Text>
            
            <Text 
              size="lg" 
              mb="xl" 
              className="reading-width academic-content" 
              style={{ 
                margin: '0 auto',
                color: 'var(--sanctuary-text-primary)',
                maxWidth: '32rem'
              }}
            >
              A sophisticated study platform that transforms your academic workflow with 
              intelligent document processing, AI-powered insights, and thoughtfully designed 
              study tools for serious students.
            </Text>
            
            <Group justify="center" gap="md">
              {isLoading ? (
                <Loader size="md" style={{ '--loader-color': 'var(--forest-green-primary)' }} />
              ) : (
                <>
                  <Button 
                    size="lg" 
                    leftSection={<IconUpload size={20} />}
                    radius="sm"
                    onClick={handleGetStarted}
                    style={{
                      background: 'var(--forest-green-primary)',
                      border: '1px solid var(--forest-green-primary)'
                    }}
                  >
                    {isAuthenticated ? 'Go to Dashboard' : 'Begin Your Study Journey'}
                  </Button>
                  {!isAuthenticated && (
                    <Button 
                      variant="outline" 
                      size="lg" 
                      leftSection={<IconBook size={20} />}
                      radius="sm"
                      component={Link}
                      href="/auth/login"
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
          </Paper>

          {/* Philosophy Section */}
          <Box ta="center" my="xl">
            <Text 
              size="lg" 
              style={{ 
                color: 'var(--sanctuary-text-secondary)',
                fontStyle: 'italic',
                maxWidth: '40rem',
                margin: '0 auto'
              }}
            >
&quot;Knowledge is not a commodity to be consumed, but a sanctuary to be cultivated.&quot;
            </Text>
          </Box>

          <Divider 
            style={{ 
              borderColor: 'var(--border-medium)',
              margin: '2rem 0'
            }} 
          />

          {/* Features Grid with Academic Sanctuary styling */}
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
              <Card 
                p="lg"
                style={{
                  background: 'var(--sanctuary-card)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Group mb="md" align="flex-start">
                  <ActionIcon 
                    size="lg" 
                    variant="light" 
                    color="forestGreen"
                    radius="sm"
                  >
                    <IconUpload size={22} />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Document Processing</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Foundation
                    </Text>
                  </Box>
                </Group>
                <Text 
                  className="academic-content"
                  style={{ 
                    color: 'var(--sanctuary-text-primary)',
                    fontSize: '0.95rem'
                  }}
                >
                  Intelligent OCR and AI-powered extraction transforms your PDFs, documents, 
                  and images into structured, searchable knowledge bases.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="forestGreen"
                  style={{ fontWeight: 500 }}
                >
                  Core Infrastructure
                </Badge>
              </Card>

              <Card 
                p="lg"
                style={{
                  background: 'var(--sanctuary-card)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Group mb="md" align="flex-start">
                  <ActionIcon 
                    size="lg" 
                    variant="light" 
                    color="warmAccents"
                    radius="sm"
                  >
                    <IconBrain size={22} />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">AI Study Companion</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Intelligence
                    </Text>
                  </Box>
                </Group>
                <Text 
                  className="academic-content"
                  style={{ 
                    color: 'var(--sanctuary-text-primary)',
                    fontSize: '0.95rem'
                  }}
                >
                  Course-aware conversational AI that provides contextual assistance, 
                  explanations, and guidance tailored to your specific materials.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="warmAccents"
                  style={{ fontWeight: 500 }}
                >
                  AI-Powered
                </Badge>
              </Card>

              <Card 
                p="lg"
                style={{
                  background: 'var(--sanctuary-card)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Group mb="md" align="flex-start">
                  <ActionIcon 
                    size="lg" 
                    variant="light" 
                    color="forestGreen"
                    radius="sm"
                  >
                    <IconBookmarks size={22} />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Study Materials</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Curation
                    </Text>
                  </Box>
                </Group>
                <Text 
                  className="academic-content"
                  style={{ 
                    color: 'var(--sanctuary-text-primary)',
                    fontSize: '0.95rem'
                  }}
                >
                  Automatically generated flashcards with spaced repetition, comprehensive 
                  study guides, and organized note-taking systems.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="forestGreen"
                  style={{ fontWeight: 500 }}
                >
                  Study Tools
                </Badge>
              </Card>

              <Card 
                p="lg"
                style={{
                  background: 'var(--sanctuary-card)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Group mb="md" align="flex-start">
                  <ActionIcon 
                    size="lg" 
                    variant="light" 
                    color="warmAccents"
                    radius="sm"
                  >
                    <IconClock size={22} />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Academic Calendar</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Organization
                    </Text>
                  </Box>
                </Group>
                <Text 
                  className="academic-content"
                  style={{ 
                    color: 'var(--sanctuary-text-primary)',
                    fontSize: '0.95rem'
                  }}
                >
                  Intelligent deadline tracking, assignment management, and study session 
                  scheduling that adapts to your academic calendar.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="warmAccents"
                  style={{ fontWeight: 500 }}
                >
                  Time Management
                </Badge>
              </Card>
            </div>
          </Box>

          {/* Development Status with Sanctuary styling */}
          <Paper 
            p="xl" 
            radius="lg"
            style={{
              background: 'var(--sanctuary-surface)',
              border: '1px solid var(--border-medium)',
              marginTop: '3rem'
            }}
          >
            <Group justify="space-between" align="center">
              <Box>
                <Title 
                  order={3} 
                  mb="xs"
                  style={{ color: 'var(--sanctuary-text-primary)' }}
                >
                  Crafting the Foundation
                </Title>
                <Text 
                  style={{ 
                    color: 'var(--sanctuary-text-secondary)',
                    maxWidth: '28rem'
                  }}
                >
                  Currently building with Next.js 14, Mantine UI, and Cloudflare Workers 
                  to create a fast, reliable, and sophisticated academic platform.
                </Text>
              </Box>
              <Badge 
                size="lg" 
                variant="light" 
                color="forestGreen"
                style={{ 
                  fontWeight: 500,
                  padding: '0.75rem 1.25rem'
                }}
              >
                In Development
              </Badge>
            </Group>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
