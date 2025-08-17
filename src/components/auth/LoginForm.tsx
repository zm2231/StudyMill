'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Title,
  Text,
  Alert,
  Anchor,
  Group,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMail, IconLock, IconAlertCircle, IconSchool } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error, clearError } = useAuth();
  const router = useRouter();

  const form = useForm<LoginFormData>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email is required';
        if (!/^\S+@\S+\.\S+$/.test(value)) return 'Invalid email format';
        return null;
      },
      password: (value) => {
        if (!value) return 'Password is required';
        return null;
      },
    },
  });

  const handleSubmit = async (values: LoginFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      const success = await login(values);
      if (success) {
        router.push('/dashboard');
      }
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      p="xl"
      style={{
        background: 'var(--sanctuary-card)',
        border: '1px solid var(--border-light)',
        maxWidth: '400px',
        width: '100%',
      }}
    >
      <Stack gap="lg">
        {/* Header */}
        <Stack gap="xs" align="center">
          <IconSchool
            size={48}
            style={{ color: 'var(--forest-green-primary)' }}
          />
          <Title
            order={2}
            ta="center"
            style={{ color: 'var(--sanctuary-text-primary)' }}
          >
            Welcome Back
          </Title>
          <Text
            size="sm"
            c="dimmed"
            ta="center"
            className="academic-content"
          >
            Sign in to your Academic Sanctuary
          </Text>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            style={{
              backgroundColor: 'var(--muted-terracotta)',
              borderColor: 'var(--warm-brown)',
            }}
          >
            {error}
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="Enter your email"
              leftSection={<IconMail size={16} />}
              required
              {...form.getInputProps('email')}
              style={{
                input: {
                  backgroundColor: 'var(--sanctuary-background)',
                  borderColor: 'var(--border-light)',
                }
              }}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              leftSection={<IconLock size={16} />}
              required
              {...form.getInputProps('password')}
              style={{
                input: {
                  backgroundColor: 'var(--sanctuary-background)',
                  borderColor: 'var(--border-light)',
                }
              }}
            />

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={isSubmitting}
              style={{
                backgroundColor: 'var(--forest-green-primary)',
                border: '1px solid var(--forest-green-primary)',
                '&:hover': {
                  backgroundColor: '#3D6622',
                  transform: 'translateY(-1px)',
                }
              }}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </Button>
          </Stack>
        </form>

        <Divider 
          label="New to StudyMill?" 
          labelPosition="center"
          style={{
            '--divider-color': 'var(--border-medium)',
          }}
        />

        {/* Register Link */}
        <Group justify="center">
          <Text size="sm" c="dimmed">
            Don&apos;t have an account?{' '}
            <Anchor
              component={Link}
              href="/auth/register"
              style={{
                color: 'var(--forest-green-primary)',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                }
              }}
            >
              Create one here
            </Anchor>
          </Text>
        </Group>

        {/* Forgot Password Link */}
        <Group justify="center">
          <Anchor
            size="sm"
            style={{
              color: 'var(--warm-brown)',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              }
            }}
          >
            Forgot your password?
          </Anchor>
        </Group>
      </Stack>
    </Card>
  );
}