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
  IconCheck
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

  const benefits = [
    "Transform PDFs into searchable knowledge",
    "Get instant answers from your documents", 
    "Organize materials across multiple courses",
    "Study more efficiently with AI assistance"
  ];

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
              Transform Documents Into Searchable Knowledge
            </Text>
            
            <Text 
              size="lg" 
              mb="xl" 
              className="reading-width academic-content" 
              style={{ 
                margin: '0 auto',
                color: 'var(--sanctuary-text-primary)',
                maxWidth: '36rem'
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
                    rightSection={<IconArrowRight size={20} />}
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
            
            <Text size="sm" mt="md" style={{ color: 'var(--sanctuary-text-secondary)' }}>
              Free to start • No credit card required • Built for students
            </Text>
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
              "Knowledge is not a commodity to be consumed, but a sanctuary to be cultivated."
            </Text>
          </Box>

          {/* Benefits Section */}
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
                  >
                    <IconCheck size={14} />
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
                  Upload PDFs and DOCX files to automatically extract key insights with 
                  AI-powered processing and transform them into searchable memories.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="forestGreen"
                  style={{ fontWeight: 500 }}
                >
                  Smart Processing
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
                  Chat with your documents, get explanations, and receive personalized 
                  study guidance tailored to your specific materials and courses.
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
                    <IconSearch size={22} />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Semantic Search</Title>
                    <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                      Discovery
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
                  Find information across all your materials with intelligent search that 
                  understands context, not just keywords.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="forestGreen"
                  style={{ fontWeight: 500 }}
                >
                  Smart Search
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
                    <IconBookmarks size={22} />
                  </ActionIcon>
                  <Box style={{ flex: 1 }}>
                    <Title order={3} mb="xs">Memory Organization</Title>
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
                  Organize knowledge into searchable memories, connected by topics and 
                  courses, with intelligent tagging and categorization.
                </Text>
                <Badge 
                  mt="md" 
                  variant="light" 
                  color="warmAccents"
                  style={{ fontWeight: 500 }}
                >
                  Organization
                </Badge>
              </Card>
            </div>
          </Box>

          {/* How It Works Section */}
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
            
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
              <Box ta="center">
                <ActionIcon 
                  size={60} 
                  variant="light" 
                  color="forestGreen"
                  radius="md" 
                  mb="md"
                  mx="auto"
                >
                  <IconUpload size={28} />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  1. Upload Documents
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Drag and drop your PDFs, DOCX files, or notes into StudyMill
                </Text>
              </Box>
              
              <Box ta="center">
                <ActionIcon 
                  size={60} 
                  variant="light" 
                  color="forestGreen"
                  radius="md" 
                  mb="md"
                  mx="auto"
                >
                  <IconBrain size={28} />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  2. AI Processing
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Our AI extracts key concepts and creates searchable memories
                </Text>
              </Box>
              
              <Box ta="center">
                <ActionIcon 
                  size={60} 
                  variant="light" 
                  color="forestGreen"
                  radius="md" 
                  mb="md"
                  mx="auto"
                >
                  <IconSearch size={28} />
                </ActionIcon>
                <Title order={4} mb="sm" style={{ color: 'var(--sanctuary-text-primary)' }}>
                  3. Search & Study
                </Title>
                <Text size="sm" style={{ color: 'var(--sanctuary-text-secondary)' }}>
                  Find answers instantly and chat with your knowledge base
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
              <Title order={2} style={{ color: 'var(--sanctuary-text-primary)', maxWidth: 500 }}>
                Ready to Transform Your Study Workflow?
              </Title>
              
              <Text 
                size="lg" 
                className="academic-content"
                style={{ 
                  color: 'var(--sanctuary-text-secondary)',
                  maxWidth: 400 
                }}
              >
                Join students who are already studying smarter with AI-powered document processing.
              </Text>
              
              <Button 
                size="xl"
                rightSection={<IconArrowRight size={20} />}
                onClick={handleGetStarted}
                style={{
                  background: 'var(--forest-green-primary)',
                  border: 'none',
                  height: 56,
                  paddingLeft: 40,
                  paddingRight: 40,
                  fontSize: 18,
                  fontWeight: 600,
                  marginTop: 16
                }}
              >
                {isAuthenticated ? 'Enter Your Sanctuary' : 'Begin Your Journey'}
              </Button>
              
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
