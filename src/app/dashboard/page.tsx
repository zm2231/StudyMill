'use client';

import { Container, Title, Text, Grid, Card, Stack, Group, Button, Badge } from '@mantine/core';
import { IconUser, IconLogout, IconSettings } from '@tabler/icons-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserProfile } from '@/components/auth/UserProfile';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ProtectedRoute>
      <Container size="lg" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title
                order={1}
                style={{ color: 'var(--sanctuary-text-primary)' }}
              >
                Welcome back, {user?.name?.split(' ')[0]}!
              </Title>
              <Text
                size="lg"
                c="dimmed"
                className="academic-content"
              >
                Your Academic Sanctuary awaits
              </Text>
            </Stack>

            <Button
              leftSection={<IconLogout size={16} />}
              variant="outline"
              onClick={handleLogout}
              style={{
                borderColor: 'var(--warm-brown)',
                color: 'var(--warm-brown)',
              }}
            >
              Sign Out
            </Button>
          </Group>

          {/* Dashboard Content */}
          <Grid>
            {/* Profile Section */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <UserProfile />
            </Grid.Col>

            {/* Quick Actions */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card
                p="xl"
                style={{
                  background: 'var(--sanctuary-card)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <Stack gap="lg">
                  <Stack gap="xs">
                    <Title
                      order={3}
                      style={{ color: 'var(--sanctuary-text-primary)' }}
                    >
                      Quick Actions
                    </Title>
                    <Text size="sm" c="dimmed">
                      Get started with your studies
                    </Text>
                  </Stack>

                  <Stack gap="md">
                    <Card
                      p="md"
                      style={{
                        background: 'var(--sanctuary-surface)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                      }}
                    >
                      <Group justify="space-between">
                        <Stack gap={4}>
                          <Text fw={500}>Create First Course</Text>
                          <Text size="sm" c="dimmed">
                            Start organizing your study materials
                          </Text>
                        </Stack>
                        <Badge
                          variant="light"
                          style={{
                            backgroundColor: 'var(--forest-green-light)',
                            color: 'var(--forest-green-primary)',
                          }}
                        >
                          Coming Soon
                        </Badge>
                      </Group>
                    </Card>

                    <Card
                      p="md"
                      style={{
                        background: 'var(--sanctuary-surface)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                      }}
                    >
                      <Group justify="space-between">
                        <Stack gap={4}>
                          <Text fw={500}>Upload Documents</Text>
                          <Text size="sm" c="dimmed">
                            Add your study materials and notes
                          </Text>
                        </Stack>
                        <Badge
                          variant="light"
                          style={{
                            backgroundColor: 'var(--warm-sand)',
                            color: 'var(--warm-brown)',
                          }}
                        >
                          Coming Soon
                        </Badge>
                      </Group>
                    </Card>

                    <Card
                      p="md"
                      style={{
                        background: 'var(--sanctuary-surface)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                      }}
                    >
                      <Group justify="space-between">
                        <Stack gap={4}>
                          <Text fw={500}>Start AI Chat</Text>
                          <Text size="sm" c="dimmed">
                            Get help with your coursework
                          </Text>
                        </Stack>
                        <Badge
                          variant="light"
                          style={{
                            backgroundColor: 'var(--warm-sand)',
                            color: 'var(--warm-brown)',
                          }}
                        >
                          Coming Soon
                        </Badge>
                      </Group>
                    </Card>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Status Card */}
          <Card
            p="lg"
            style={{
              background: 'var(--forest-green-light)',
              border: '1px solid var(--forest-green-primary)',
            }}
          >
            <Group justify="space-between" align="center">
              <Stack gap="xs">
                <Text
                  fw={600}
                  style={{ color: 'var(--forest-green-primary)' }}
                >
                  🎉 Authentication System Complete!
                </Text>
                <Text
                  size="sm"
                  style={{ color: 'var(--sanctuary-text-primary)' }}
                >
                  Your account is set up and ready. The full StudyMill platform is currently under development.
                </Text>
              </Stack>
              <IconSettings
                size={32}
                style={{ color: 'var(--forest-green-primary)' }}
              />
            </Group>
          </Card>
        </Stack>
      </Container>
    </ProtectedRoute>
  );
}