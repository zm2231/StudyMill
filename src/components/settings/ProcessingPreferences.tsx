'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Group,
  Radio,
  Switch,
  Button,
  Stack,
  Alert,
  Badge,
  NumberInput,
  Divider,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconInfoCircle, 
  IconCurrency, 
  IconSparkles, 
  IconBolt, 
  IconSettings,
  IconChartBar
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export interface ProcessingPreferences {
  defaultMode: 'basic' | 'premium' | 'auto';
  autoUpgradeEnabled: boolean;
  costLimit: number;
  notificationEnabled: boolean;
}

export interface CostSummary {
  totalCost: number;
  basicProcessingCount: number;
  premiumProcessingCount: number;
  averageCostPerDocument: number;
  costByMode: Record<string, { count: number; totalCost: number }>;
}

interface ProcessingPreferencesProps {
  preferences: ProcessingPreferences;
  costSummary?: CostSummary;
  onSave: (preferences: ProcessingPreferences) => Promise<void>;
  loading?: boolean;
}

export default function ProcessingPreferences({ 
  preferences, 
  costSummary, 
  onSave, 
  loading = false 
}: ProcessingPreferencesProps) {
  const [localPrefs, setLocalPrefs] = useState<ProcessingPreferences>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localPrefs);
      notifications.show({
        title: 'Preferences Saved',
        message: 'Your document processing preferences have been updated.',
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save preferences. Please try again.',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(localPrefs) !== JSON.stringify(preferences);

  return (
    <Stack gap="md">
      {/* Processing Mode Selection */}
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>
              <Group gap="xs">
                <IconSettings size={20} />
                Document Processing Mode
              </Group>
            </Title>
          </Group>

          <Text size="sm" c="dimmed">
            Choose how your documents are processed by default. You can always override this for individual documents.
          </Text>

          <Radio.Group
            value={localPrefs.defaultMode}
            onChange={(value) => setLocalPrefs(prev => ({ 
              ...prev, 
              defaultMode: value as 'basic' | 'premium' | 'auto' 
            }))}
          >
            <Stack gap="md" mt="md">
              <Radio
                value="basic"
                label={
                  <Group gap="xs">
                    <IconBolt size={16} color="green" />
                    <Text fw={500}>Basic Processing (Free)</Text>
                    <Badge size="xs" color="green">FREE</Badge>
                  </Group>
                }
                description="Fast text extraction for PDFs and DOCX files. Perfect for reading, notes, and simple documents."
              />
              
              <Radio
                value="premium"
                label={
                  <Group gap="xs">
                    <IconSparkles size={16} color="blue" />
                    <Text fw={500}>Premium Processing</Text>
                    <Badge size="xs" color="blue">$0.01-0.05/doc</Badge>
                  </Group>
                }
                description="Advanced extraction with tables, OCR, image analysis, and complex layouts. Best for reports, forms, and data-heavy documents."
              />
              
              <Radio
                value="auto"
                label={
                  <Group gap="xs">
                    <IconSettings size={16} color="purple" />
                    <Text fw={500}>Smart Auto-Select</Text>
                    <Badge size="xs" color="purple">RECOMMENDED</Badge>
                  </Group>
                }
                description="Automatically chooses the best method based on document complexity. Uses basic for simple documents, premium for complex ones."
              />
            </Stack>
          </Radio.Group>
        </Stack>
      </Card>

      {/* Auto-Upgrade Settings */}
      <Card withBorder>
        <Stack gap="md">
          <Title order={4}>Auto-Upgrade Settings</Title>
          
          <Switch
            checked={localPrefs.autoUpgradeEnabled}
            onChange={(event) => setLocalPrefs(prev => ({
              ...prev,
              autoUpgradeEnabled: event.currentTarget.checked
            }))}
            label="Allow automatic upgrade to premium processing"
            description="When basic processing can't extract sufficient data, automatically upgrade to premium (with cost notification)"
          />

          {localPrefs.autoUpgradeEnabled && (
            <>
              <Divider />
              <Group>
                <NumberInput
                  label="Monthly cost limit"
                  description="Maximum you're willing to spend on premium processing per month"
                  value={localPrefs.costLimit}
                  onChange={(value) => setLocalPrefs(prev => ({
                    ...prev,
                    costLimit: typeof value === 'number' ? value : 0
                  }))}
                  min={0}
                  max={100}
                  step={1}
                  prefix="$"
                  style={{ flex: 1 }}
                />
              </Group>
            </>
          )}
        </Stack>
      </Card>

      {/* Cost Summary */}
      {costSummary && (
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>
                <Group gap="xs">
                  <IconChartBar size={18} />
                  Usage & Costs (Last 30 Days)
                </Group>
              </Title>
              <Tooltip label="Click to view detailed analytics">
                <ActionIcon variant="subtle">
                  <IconInfoCircle size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Group grow>
              <Card withBorder radius="md" p="md">
                <Text ta="center" size="xl" fw={700} c="green">
                  {costSummary.basicProcessingCount}
                </Text>
                <Text ta="center" size="sm" c="dimmed">
                  Basic (Free)
                </Text>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text ta="center" size="xl" fw={700} c="blue">
                  {costSummary.premiumProcessingCount}
                </Text>
                <Text ta="center" size="sm" c="dimmed">
                  Premium
                </Text>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text ta="center" size="xl" fw={700} c="orange">
                  ${costSummary.totalCost.toFixed(2)}
                </Text>
                <Text ta="center" size="sm" c="dimmed">
                  Total Cost
                </Text>
              </Card>
            </Group>

            {costSummary.totalCost > 0 && (
              <Alert icon={<IconCurrency size={16} />} color="blue" variant="light">
                <Text size="sm">
                  Average cost per document: <Text span fw={600}>${costSummary.averageCostPerDocument.toFixed(3)}</Text>
                  {costSummary.basicProcessingCount > 0 && (
                    <Text span c="dimmed">
                      {' '}({Math.round((costSummary.basicProcessingCount / (costSummary.basicProcessingCount + costSummary.premiumProcessingCount)) * 100)}% processed for free)
                    </Text>
                  )}
                </Text>
              </Alert>
            )}
          </Stack>
        </Card>
      )}

      {/* Notifications */}
      <Card withBorder>
        <Stack gap="md">
          <Title order={4}>Notifications</Title>
          
          <Switch
            checked={localPrefs.notificationEnabled}
            onChange={(event) => setLocalPrefs(prev => ({
              ...prev,
              notificationEnabled: event.currentTarget.checked
            }))}
            label="Processing notifications"
            description="Get notified when documents finish processing and about cost estimates"
          />
        </Stack>
      </Card>

      {/* Info Alert */}
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Processing Comparison
          </Text>
          <Text size="sm">
            <Text span fw={600}>Basic:</Text> Text extraction, basic formatting, fast processing
          </Text>
          <Text size="sm">
            <Text span fw={600}>Premium:</Text> Tables, OCR, images, complex layouts, charts, forms
          </Text>
        </Stack>
      </Alert>

      {/* Save Button */}
      <Group justify="flex-end">
        <Button
          onClick={handleSave}
          loading={saving || loading}
          disabled={!hasChanges}
          leftSection={<IconSettings size={16} />}
        >
          Save Preferences
        </Button>
      </Group>
    </Stack>
  );
}