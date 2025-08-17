import { Container, Center, Stack } from '@mantine/core';
import { LoginForm } from '@/components/auth/LoginForm';
import { GuestOnlyRoute } from '@/components/ProtectedRoute';

export default function LoginPage() {
  return (
    <GuestOnlyRoute>
      <Container size="sm" py="xl">
        <Center style={{ minHeight: '80vh' }}>
          <Stack align="center" gap="xl" w="100%">
            <LoginForm />
          </Stack>
        </Center>
      </Container>
    </GuestOnlyRoute>
  );
}