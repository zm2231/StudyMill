'use client';

import { useState } from 'react';
import {
  Card,
  TextInput,
  Button,
  Stack,
  Title,
  Text,
  Alert,
  Group,
  Modal,
  Divider,
  Badge,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconMail,
  IconEdit,
  IconTrash,
  IconLogout,
  IconDots,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';

interface ProfileFormData {
  name: string;
  email: string;
}

export function UserProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const { user, updateProfile, deleteAccount, logout, logoutAll, error, clearError } = useAuth();

  const form = useForm<ProfileFormData>({
    initialValues: {
      name: user?.name || '',
      email: user?.email || '',
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
    },
  });

  // Reset form when user changes or editing is cancelled
  const resetForm = () => {
    form.setValues({
      name: user?.name || '',
      email: user?.email || '',
    });
    form.clearErrors();
    clearError();
  };

  const handleEdit = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
  };

  const handleSubmit = async (values: ProfileFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      const success = await updateProfile({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
      });

      if (success) {
        setIsEditing(false);
        notifications.show({
          title: 'Profile Updated',
          message: 'Your profile has been successfully updated.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = () => {
    modals.openConfirmModal({
      title: 'Delete Account',
      children: (
        <Text size="sm">
          Are you sure you want to delete your account? This action cannot be undone.
          All your data will be permanently removed.
        </Text>
      ),
      labels: { confirm: 'Delete Account', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteAccount();
          notifications.show({
            title: 'Account Deleted',
            message: 'Your account has been successfully deleted.',
            color: 'green',
          });
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete account. Please try again.',
            color: 'red',
          });
        }
      },
    });
  };

  const handleLogoutAll = () => {
    modals.openConfirmModal({
      title: 'Logout All Sessions',
      children: (
        <Text size="sm">
          This will log you out from all devices and sessions. You will need to log in again.
        </Text>
      ),
      labels: { confirm: 'Logout All', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: async () => {
        await logoutAll();
        notifications.show({
          title: 'Logged Out',
          message: 'You have been logged out from all sessions.',
          color: 'blue',
        });
      },
    });
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Card
        p="xl"
        style={{
          background: 'var(--sanctuary-card)',
          border: '1px solid var(--border-light)',
        }}
      >
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title
                order={3}
                style={{ color: 'var(--sanctuary-text-primary)' }}
              >
                Profile Information
              </Title>
              <Text size="sm" c="dimmed">
                Manage your account details and preferences
              </Text>
            </Stack>

            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  style={{ color: 'var(--sanctuary-text-secondary)' }}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={handleEdit}
                  disabled={isEditing}
                >
                  Edit Profile
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  onClick={handleLogoutAll}
                >
                  Logout All Sessions
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={handleDeleteAccount}
                >
                  Delete Account
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {/* Error Alert */}
          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              variant="light"
              onClose={clearError}
              withCloseButton
            >
              {error}
            </Alert>
          )}

          {/* Profile Form */}
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Full Name"
                leftSection={<IconUser size={16} />}
                readOnly={!isEditing}
                required
                {...form.getInputProps('name')}
                style={{
                  input: {
                    backgroundColor: isEditing ? 'var(--sanctuary-background)' : 'var(--sanctuary-surface)',
                    borderColor: 'var(--border-light)',
                    cursor: isEditing ? 'text' : 'default',
                  }
                }}
              />

              <TextInput
                label="Email"
                leftSection={<IconMail size={16} />}
                readOnly={!isEditing}
                required
                {...form.getInputProps('email')}
                style={{
                  input: {
                    backgroundColor: isEditing ? 'var(--sanctuary-background)' : 'var(--sanctuary-surface)',
                    borderColor: 'var(--border-light)',
                    cursor: isEditing ? 'text' : 'default',
                  }
                }}
              />

              {/* Action Buttons */}
              {isEditing ? (
                <Group gap="sm">
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    style={{
                      backgroundColor: 'var(--forest-green-primary)',
                      border: '1px solid var(--forest-green-primary)',
                    }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    style={{
                      borderColor: 'var(--border-medium)',
                      color: 'var(--sanctuary-text-secondary)',
                    }}
                  >
                    Cancel
                  </Button>
                </Group>
              ) : (
                <Button
                  leftSection={<IconEdit size={16} />}
                  variant="outline"
                  onClick={handleEdit}
                  style={{
                    borderColor: 'var(--forest-green-primary)',
                    color: 'var(--forest-green-primary)',
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </Stack>
          </form>

          <Divider style={{ '--divider-color': 'var(--border-light)' }} />

          {/* Account Information */}
          <Stack gap="sm">
            <Text
              size="sm"
              fw={500}
              style={{ color: 'var(--sanctuary-text-primary)' }}
            >
              Account Information
            </Text>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Member since:
              </Text>
              <Badge
                variant="light"
                style={{
                  backgroundColor: 'var(--forest-green-light)',
                  color: 'var(--forest-green-primary)',
                }}
              >
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Badge>
            </Group>
            {user.updated_at && user.updated_at !== user.created_at && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Last updated:
                </Text>
                <Text size="sm">
                  {new Date(user.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </Group>
            )}
          </Stack>
        </Stack>
      </Card>
    </>
  );
}