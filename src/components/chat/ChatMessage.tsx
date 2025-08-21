'use client';

import React from 'react';
import {
  Group,
  Avatar,
  Text,
  Stack,
  Paper,
  ActionIcon,
  CopyButton,
  Tooltip,
  Badge
} from '@mantine/core';
import {
  IconUser,
  IconRobot,
  IconCopy,
  IconCheck,
  IconExclamationCircle,
  IconCards,
  IconBookmark,
  IconFileText
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types/chat';

interface ChatMessageProps {
  message: Message;
  onCreateFlashcard?: (content: string) => void;
  onPinToGuide?: (content: string) => void;
  onSaveAsNote?: (content: string) => void;
}

export function ChatMessage({ 
  message, 
  onCreateFlashcard,
  onPinToGuide,
  onSaveAsNote 
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = () => {
    switch (message.status) {
      case 'sending':
        return 'var(--warm-brown)';
      case 'sent':
      case 'delivered':
        return 'var(--forest-green-primary)';
      case 'error':
        return 'var(--mantine-color-red-6)';
      default:
        return 'var(--border-light)';
    }
  };

  const getStatusIcon = () => {
    if (message.status === 'error') {
      return <IconExclamationCircle size={12} />;
    }
    return null;
  };

  return (
    <Group 
      align="flex-start" 
      gap="sm"
      style={{
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar */}
      <Avatar
        size="sm"
        style={{
          backgroundColor: isUser 
            ? 'var(--warm-brown)' 
            : 'var(--forest-green-primary)',
        }}
      >
        {isUser ? <IconUser size={16} /> : <IconRobot size={16} />}
      </Avatar>

      {/* Message Content */}
      <Stack gap="xs" style={{ maxWidth: '70%', minWidth: '200px' }}>
        {/* Message Bubble */}
        <Paper
          p="sm"
          style={{
            backgroundColor: isUser 
              ? 'var(--warm-sand)' 
              : isError 
                ? 'var(--mantine-color-red-1)'
                : 'var(--sanctuary-card)',
            border: `1px solid ${isError 
              ? 'var(--mantine-color-red-3)' 
              : 'var(--border-light)'}`,
            borderRadius: isUser 
              ? '16px 16px 4px 16px' 
              : '16px 16px 16px 4px',
          }}
        >
          <Group gap="xs" justify="space-between" align="flex-start">
            <div style={{ flex: 1 }}>
              {isUser ? (
                <Text 
                  size="sm"
                  style={{ 
                    color: 'var(--sanctuary-text-primary)',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {message.content}
                </Text>
              ) : (
                <div
                  style={{
                    color: 'var(--sanctuary-text-primary)',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <Text size="sm" mb="xs" style={{ color: 'inherit' }}>
                          {children}
                        </Text>
                      ),
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <Text
                            component="code"
                            size="sm"
                            style={{
                              backgroundColor: 'var(--sanctuary-surface)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-geist-mono)',
                              border: '1px solid var(--border-light)',
                            }}
                          >
                            {children}
                          </Text>
                        ) : (
                          <Paper
                            p="sm"
                            style={{
                              backgroundColor: 'var(--sanctuary-surface)',
                              border: '1px solid var(--border-light)',
                              marginTop: '8px',
                              marginBottom: '8px',
                            }}
                          >
                            <Text
                              component="pre"
                              size="sm"
                              style={{
                                fontFamily: 'var(--font-geist-mono)',
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {children}
                            </Text>
                          </Paper>
                        );
                      },
                      ul: ({ children }) => (
                        <Text component="ul" size="sm" pl="md" mb="xs">
                          {children}
                        </Text>
                      ),
                      ol: ({ children }) => (
                        <Text component="ol" size="sm" pl="md" mb="xs">
                          {children}
                        </Text>
                      ),
                      li: ({ children }) => (
                        <Text component="li" size="sm" mb="xs">
                          {children}
                        </Text>
                      ),
                      strong: ({ children }) => (
                        <Text component="strong" fw={600}>
                          {children}
                        </Text>
                      ),
                      em: ({ children }) => (
                        <Text component="em" fs="italic">
                          {children}
                        </Text>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Action Buttons for AI messages */}
            {!isUser && (
              <Group gap={2}>
                <CopyButton value={message.content}>
                  {({ copied, copy }) => (
                    <Tooltip 
                      label={copied ? 'Copied!' : 'Copy message'}
                      position="top"
                    >
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={copy}
                        style={{
                          color: copied 
                            ? 'var(--forest-green-primary)' 
                            : 'var(--sanctuary-text-secondary)',
                        }}
                      >
                        {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>

                {onCreateFlashcard && (
                  <Tooltip label="Create flashcard" position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => onCreateFlashcard(message.content)}
                      style={{
                        color: 'var(--sanctuary-text-secondary)',
                      }}
                    >
                      <IconCards size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}

                {onPinToGuide && (
                  <Tooltip label="Pin to study guide" position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => onPinToGuide(message.content)}
                      style={{
                        color: 'var(--sanctuary-text-secondary)',
                      }}
                    >
                      <IconBookmark size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}

                {onSaveAsNote && (
                  <Tooltip label="Save as note" position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => onSaveAsNote(message.content)}
                      style={{
                        color: 'var(--sanctuary-text-secondary)',
                      }}
                    >
                      <IconFileText size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            )}
          </Group>
        </Paper>

        {/* Message Metadata */}
        <Group 
          gap="xs" 
          justify={isUser ? "flex-end" : "flex-start"}
        >
          <Text 
            size="xs" 
            c="dimmed"
          >
            {formatTime(message.timestamp)}
          </Text>
          
          {/* Status Indicator */}
          <Group gap={2}>
            {getStatusIcon()}
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(),
              }}
            />
          </Group>

          {/* Message Type Badge */}
          {message.messageType && (
            <Badge 
              size="xs" 
              variant="dot"
              style={{
                backgroundColor: 'var(--forest-green-light)',
                color: 'var(--forest-green-primary)',
              }}
            >
              {message.messageType}
            </Badge>
          )}
        </Group>
      </Stack>
    </Group>
  );
}