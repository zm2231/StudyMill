'use client';

import React from 'react';
import {
  Group,
  Avatar,
  Paper,
  Text
} from '@mantine/core';
import { IconRobot } from '@tabler/icons-react';

const TypingDot = ({ delay }: { delay: number }) => (
  <div
    style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: 'var(--forest-green-primary)',
      animation: `typing-bounce 1.4s infinite ease-in-out`,
      animationDelay: `${delay}ms`,
    }}
  />
);

export function TypingIndicator() {
  return (
    <Group align="flex-start" gap="sm">
      {/* AI Avatar */}
      <Avatar
        size="sm"
        style={{
          backgroundColor: 'var(--forest-green-primary)',
        }}
      >
        <IconRobot size={16} />
      </Avatar>

      {/* Typing Bubble */}
      <Paper
        p="sm"
        style={{
          backgroundColor: 'var(--sanctuary-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px 16px 16px 4px',
          minWidth: '60px',
        }}
      >
        <Group gap="xs" align="center">
          <Text 
            size="sm" 
            c="dimmed" 
            style={{ marginRight: '4px' }}
          >
            AI is typing
          </Text>
          <Group gap={2}>
            <TypingDot delay={0} />
            <TypingDot delay={200} />
            <TypingDot delay={400} />
          </Group>
        </Group>
      </Paper>
    </Group>
  );
}