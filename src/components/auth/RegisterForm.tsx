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
  Progress,
  List,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMail, IconLock, IconUser, IconAlertCircle, IconSchool, IconCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface PasswordRequirement {
  meets: boolean;
  label: string;
}

function PasswordRequirements({ value }: { value: string }) {
  const requirements = [
    { re: /.{6,}/, label: 'At least 6 characters' },
    { re: /[a-zA-Z]/, label: 'Includes letter' },
  ];

  const strength = requirements.filter((requirement) => requirement.re.test(value)).length;

  const items = requirements.map((requirement, index) => (
    <List.Item
      key={index}
      icon={
        <ThemeIcon
          color={requirement.re.test(value) ? 'green' : 'red'}
          variant="light"
          size={16}
        >
          {requirement.re.test(value) ? <IconCheck size={12} /> : <IconX size={12} />}
        </ThemeIcon>
      }
    >
      <Text size="sm">{requirement.label}</Text>
    </List.Item>
  ));

  return (
    <div>
      <Progress 
        value={(strength / requirements.length) * 100} 
        size={5} 
        mb={5}
        style={{
          '--progress-bg': 'var(--border-light)',
          '--progress-color': strength === requirements.length ? 'var(--forest-green-primary)' : 'var(--warm-brown)',
        }}
      />
      <List spacing={0} size="sm">
        {items}
      </List>
    </div>
  );
}

export function RegisterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordReqs, setShowPasswordReqs] = useState(false);
  const { register, error, clearError } = useAuth();
  const router = useRouter();

  const form = useForm<RegisterFormData>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      name: (value) => {
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return null;
      },
      email: (value) => {
        if (!value) return 'Email is required';
        if (!/^\S+@\S+\.\S+$/.test(value)) return 'Invalid email format';
        return null;
      },
      password: (value) => {
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        if (!/[a-zA-Z]/.test(value)) return 'Password must contain at least one letter';
        return null;
      },
      confirmPassword: (value, values) => {
        if (!value) return 'Please confirm your password';
        if (value !== values.password) return 'Passwords do not match';
        return null;
      },
    },
  });

  const handleSubmit = async (values: RegisterFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      const success = await register({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      
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
        maxWidth: '450px',
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
            Join StudyMill
          </Title>
          <Text
            size="sm"
            c="dimmed"
            ta="center"
            className="academic-content"
          >
            Create your Academic Sanctuary account
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
              label="Full Name"
              placeholder="Enter your full name"
              leftSection={<IconUser size={16} />}
              required
              {...form.getInputProps('name')}
              style={{
                input: {
                  backgroundColor: 'var(--sanctuary-background)',
                  borderColor: 'var(--border-light)',
                }
              }}
            />

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
              placeholder="Create a password"
              leftSection={<IconLock size={16} />}
              required
              {...form.getInputProps('password')}
              onFocus={() => setShowPasswordReqs(true)}
              onBlur={() => setShowPasswordReqs(false)}
              style={{
                input: {
                  backgroundColor: 'var(--sanctuary-background)',
                  borderColor: 'var(--border-light)',
                }
              }}
            />

            {showPasswordReqs && form.values.password && (
              <PasswordRequirements value={form.values.password} />
            )}

            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm your password"
              leftSection={<IconLock size={16} />}
              required
              {...form.getInputProps('confirmPassword')}
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
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Stack>
        </form>

        <Divider 
          label="Already have an account?" 
          labelPosition="center"
          style={{
            '--divider-color': 'var(--border-medium)',
          }}
        />

        {/* Login Link */}
        <Group justify="center">
          <Text size="sm" c="dimmed">
            <Anchor
              component={Link}
              href="/auth/login"
              style={{
                color: 'var(--forest-green-primary)',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                }
              }}
            >
              Sign in here
            </Anchor>
          </Text>
        </Group>

        {/* Terms Notice */}
        <Text
          size="xs"
          c="dimmed"
          ta="center"
          style={{ lineHeight: 1.5 }}
        >
          By creating an account, you agree to our{' '}
          <Anchor
            size="xs"
            style={{ color: 'var(--warm-brown)' }}
          >
            Terms of Service
          </Anchor>
          {' '}and{' '}
          <Anchor
            size="xs"
            style={{ color: 'var(--warm-brown)' }}
          >
            Privacy Policy
          </Anchor>
        </Text>
      </Stack>
    </Card>
  );
}