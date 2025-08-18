'use client';

import React, { useState } from 'react';
import {
  Card,
  Group,
  Text,
  Radio,
  Badge,
  Alert,
  Button,
  Stack,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import {
  IconInfoCircle,
  IconBolt,
  IconSparkles,
  IconSettings,
  IconCurrency
} from '@tabler/icons-react';

export interface ProcessingModeSelection {
  mode: 'basic' | 'premium' | 'auto';
  costEstimate: number;
  reasoning: string;
}

interface ProcessingModeSelectorProps {
  fileName: string;
  fileType: string;
  fileSize: number;
  defaultMode?: 'basic' | 'premium' | 'auto';
  onModeChange: (selection: ProcessingModeSelection) => void;
  disabled?: boolean;
}

export default function ProcessingModeSelector({
  fileName,
  fileType,
  fileSize,
  defaultMode = 'auto',
  onModeChange,
  disabled = false
}: ProcessingModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<'basic' | 'premium' | 'auto'>(defaultMode);

  const calculateCostEstimate = (mode: 'basic' | 'premium' | 'auto'): number => {
    if (mode === 'basic') return 0;
    if (mode === 'premium') {
      // Base cost calculation (should match backend logic)
      let cost = 0.01; // $0.01 base
      const sizeInMB = fileSize / (1024 * 1024);
      if (sizeInMB > 10) {
        cost += (sizeInMB - 10) * 0.001; // $0.001 per MB over 10MB
      }
      if (fileType.includes('image')) {
        cost *= 2; // OCR is more expensive
      }
      return Math.round(cost * 100) / 100;
    }
    
    // Auto mode: estimate based on smart selection
    return shouldUsePremium() ? calculateCostEstimate('premium') : 0;
  };

  const shouldUsePremium = (): boolean => {
    const complexKeywords = [
      'financial', 'report', 'statement', 'contract', 'legal',
      'spreadsheet', 'data', 'analysis', 'chart', 'graph', 'table'
    ];
    
    const hasComplexKeyword = complexKeywords.some(keyword => 
      fileName.toLowerCase().includes(keyword)
    );

    const premiumBenefitTypes = [
      'image/', // OCR needed
      'vnd.ms-excel', // Complex tables
      'vnd.ms-powerpoint' // Charts and diagrams
    ];

    const benefitsFromPremium = premiumBenefitTypes.some(type => 
      fileType.includes(type)
    );

    const isLargeFile = fileSize > 20 * 1024 * 1024; // 20MB

    return hasComplexKeyword || benefitsFromPremium || isLargeFile;
  };

  const getReasoning = (mode: 'basic' | 'premium' | 'auto'): string => {
    if (mode === 'basic') {
      return 'Fast, free text extraction. Perfect for reading and simple documents.';
    }
    if (mode === 'premium') {
      return 'Advanced processing with tables, OCR, and complex layout analysis.';
    }
    
    // Auto mode reasoning
    if (shouldUsePremium()) {
      const reasons = [];
      if (fileName.toLowerCase().includes('financial') || fileName.toLowerCase().includes('report')) {
        reasons.push('financial/report keywords detected');
      }
      if (fileType.includes('image')) {
        reasons.push('image file requiring OCR');
      }
      if (fileSize > 20 * 1024 * 1024) {
        reasons.push('large file size');
      }
      return `Recommended premium processing: ${reasons.join(', ')}`;
    }
    
    return 'Recommended basic processing: suitable for text extraction';
  };

  const handleModeChange = (value: string) => {
    const mode = value as 'basic' | 'premium' | 'auto';
    setSelectedMode(mode);
    const costEstimate = calculateCostEstimate(mode);
    const reasoning = getReasoning(mode);
    
    onModeChange({
      mode,
      costEstimate,
      reasoning
    });
  };

  const costEstimate = calculateCostEstimate(selectedMode);
  const reasoning = getReasoning(selectedMode);

  return (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500} size="sm">Processing Mode</Text>
          <Tooltip label="Learn more about processing modes">
            <ActionIcon variant="subtle" size="sm">
              <IconInfoCircle size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Radio.Group
          value={selectedMode}
          onChange={handleModeChange}
        >
          <Stack gap="sm">
            <Radio
              value="basic"
              disabled={disabled}
              label={
                <Group gap="xs">
                  <IconBolt size={14} color="green" />
                  <Text size="sm" fw={500}>Basic (Free)</Text>
                  <Badge size="xs" color="green">FREE</Badge>
                </Group>
              }
              description="Text extraction and basic formatting"
            />
            
            <Radio
              value="premium"
              disabled={disabled}
              label={
                <Group gap="xs">
                  <IconSparkles size={14} color="blue" />
                  <Text size="sm" fw={500}>Premium</Text>
                  <Badge size="xs" color="blue">${calculateCostEstimate('premium')}</Badge>
                </Group>
              }
              description="Tables, OCR, images, and complex layouts"
            />
            
            <Radio
              value="auto"
              disabled={disabled}
              label={
                <Group gap="xs">
                  <IconSettings size={14} color="purple" />
                  <Text size="sm" fw={500}>Smart Auto-Select</Text>
                  <Badge size="xs" color="purple">
                    {shouldUsePremium() ? `~$${calculateCostEstimate('premium')}` : 'FREE'}
                  </Badge>
                </Group>
              }
              description="Automatically choose the best method"
            />
          </Stack>
        </Radio.Group>

        {/* Cost and reasoning display */}
        <Alert 
          icon={costEstimate > 0 ? <IconCurrency size={16} /> : <IconBolt size={16} />} 
          color={costEstimate > 0 ? 'blue' : 'green'}
          variant="light"
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {selectedMode === 'auto' ? 'Recommended' : 'Selected'}: {' '}
                {selectedMode === 'auto' 
                  ? (shouldUsePremium() ? 'Premium' : 'Basic')
                  : selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)
                }
              </Text>
              <Text size="sm" fw={600}>
                {costEstimate > 0 ? `$${costEstimate}` : 'FREE'}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {reasoning}
            </Text>
          </Stack>
        </Alert>

        {/* File info */}
        <Text size="xs" c="dimmed">
          {fileName} • {(fileSize / 1024 / 1024).toFixed(1)}MB • {fileType}
        </Text>
      </Stack>
    </Card>
  );
}