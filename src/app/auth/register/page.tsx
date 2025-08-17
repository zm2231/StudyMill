import { Container, Center, Stack } from '@mantine/core';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { GuestOnlyRoute } from '@/components/ProtectedRoute';

export default function RegisterPage() {
  return (
    <GuestOnlyRoute>
      <Container size="sm" py="xl">
        <Center style={{ minHeight: '80vh' }}>
          <Stack align="center" gap="xl" w="100%">
            <RegisterForm />
          </Stack>
        </Center>
      </Container>
    </GuestOnlyRoute>
  );
}