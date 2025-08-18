'use client';

import React from 'react';
import { 
  Alert, 
  Button, 
  Stack, 
  Text, 
  Box,
  Group,
  Title
} from '@mantine/core';
import { 
  IconAlertCircle, 
  IconRefresh, 
  IconHome,
  IconBug
} from '@tabler/icons-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface LibraryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

/**
 * Error boundary specifically for the Library components
 * Provides graceful error handling and recovery options
 */
export class LibraryErrorBoundary extends React.Component<
  LibraryErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: LibraryErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Library Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      return <DefaultErrorFallback error={this.state.error!} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  const isNetworkError = error.message.includes('fetch') || error.message.includes('network');
  const isAuthError = error.message.includes('auth') || error.message.includes('401');

  return (
    <Box p="xl" ta="center">
      <Stack gap="lg" align="center" maw={500} mx="auto">
        <IconAlertCircle size={64} color="red" />
        
        <Title order={2} c="red">
          Something went wrong
        </Title>
        
        <Text size="lg" c="dimmed" ta="center">
          {isNetworkError && "We're having trouble connecting to our servers."}
          {isAuthError && "Your session has expired. Please sign in again."}
          {!isNetworkError && !isAuthError && "An unexpected error occurred while loading your library."}
        </Text>
        
        <Text size="sm" c="dimmed" ta="center" style={{ fontFamily: 'monospace' }}>
          Error: {error.message}
        </Text>
        
        <Group>
          <Button 
            leftSection={<IconRefresh size={16} />}
            onClick={retry}
            variant="filled"
          >
            Try Again
          </Button>
          
          <Button 
            leftSection={<IconHome size={16} />}
            onClick={() => window.location.href = '/dashboard'}
            variant="light"
          >
            Go to Dashboard
          </Button>
        </Group>
        
        <Text size="xs" c="dimmed">
          If this problem persists, please contact support
        </Text>
      </Stack>
    </Box>
  );
}

/**
 * API Error component for handling specific API failures
 */
export function ApiErrorAlert({ 
  error, 
  onRetry, 
  retryCount = 0,
  maxRetries = 3 
}: { 
  error: string; 
  onRetry: () => void;
  retryCount?: number;
  maxRetries?: number;
}) {
  const canRetry = retryCount < maxRetries;
  
  return (
    <Alert 
      icon={<IconAlertCircle size={16} />} 
      color="red" 
      variant="light"
    >
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Failed to load data
        </Text>
        <Text size="xs" c="dimmed">
          {error}
        </Text>
        {canRetry && (
          <Group gap="xs" mt="xs">
            <Button 
              size="xs" 
              variant="light" 
              leftSection={<IconRefresh size={12} />}
              onClick={onRetry}
            >
              Retry ({maxRetries - retryCount} attempts left)
            </Button>
          </Group>
        )}
        {!canRetry && (
          <Text size="xs" c="dimmed">
            Max retry attempts reached. Please refresh the page or contact support.
          </Text>
        )}
      </Stack>
    </Alert>
  );
}

export default LibraryErrorBoundary;