'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Loader, Center, Text, Stack } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  fallback,
  redirectTo = '/auth/login' 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  // Show loading state
  if (isLoading) {
    return fallback || (
      <Container size="sm" py="xl">
        <Center style={{ minHeight: '60vh' }}>
          <Stack align="center" gap="md">
            <Loader 
              size="lg" 
              style={{ 
                '--loader-color': 'var(--forest-green-primary)' 
              }} 
            />
            <Text 
              size="lg" 
              c="dimmed"
              className="academic-content"
            >
              Loading your study sanctuary...
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}

interface GuestOnlyRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function GuestOnlyRoute({ 
  children, 
  fallback,
  redirectTo = '/dashboard' 
}: GuestOnlyRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  // Show loading state
  if (isLoading) {
    return fallback || (
      <Container size="sm" py="xl">
        <Center style={{ minHeight: '60vh' }}>
          <Stack align="center" gap="md">
            <Loader 
              size="lg" 
              style={{ 
                '--loader-color': 'var(--forest-green-primary)' 
              }} 
            />
            <Text 
              size="lg" 
              c="dimmed"
              className="academic-content"
            >
              Checking your session...
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // Show nothing while redirecting
  if (isAuthenticated) {
    return null;
  }

  // Render guest content
  return <>{children}</>;
}