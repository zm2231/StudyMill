'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Paper,
  Stack,
  TextInput,
  ActionIcon,
  ScrollArea,
  Text,
  Group,
  Avatar,
  Loader,
  Badge,
  Button,
  Divider,
  Select
} from '@mantine/core';
import {
  IconSend,
  IconUser,
  IconRobot,
  IconClearAll,
  IconMessageCircle,
  IconFilter
} from '@tabler/icons-react';
import { Message } from '@/types/chat';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketChat } from '@/hooks/useWebSocketChat';
import { apiClient } from '@/lib/api';
import { notifications } from '@mantine/notifications';

interface ChatInterfaceProps {
  sessionId?: string;
  courseContext?: string;
  assignmentContext?: string;
  courseId?: string;
}

interface ChatScope {
  value: string;
  label: string;
  type: 'all' | 'course' | 'assignment';
  id?: string;
}

export function ChatInterface({
  sessionId,
  courseContext,
  assignmentContext,
  courseId
}: ChatInterfaceProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [availableScopes, setAvailableScopes] = useState<ChatScope[]>([
    { value: 'all', label: 'All Documents', type: 'all' }
  ]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    isConnected,
    isConnecting,
    messages,
    streamingMessage,
    sendMessage,
    sendTyping,
    clearMessages
  } = useWebSocketChat({
    sessionId,
    courseId,
    scope: selectedScope,
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  const isLoading = isConnecting || !isConnected;
  const isTyping = !!streamingMessage;

  // Load available courses and assignments for scope selector
  useEffect(() => {
    const loadScopes = async () => {
      try {
        const scopes: ChatScope[] = [
          { value: 'all', label: 'All Documents', type: 'all' }
        ];

        // Load courses
        const coursesResponse = await apiClient.getCourses();
        if (coursesResponse.success && coursesResponse.courses) {
          coursesResponse.courses.forEach(course => {
            scopes.push({
              value: `course-${course.id}`,
              label: `📚 ${course.name} (${course.code})`,
              type: 'course',
              id: course.id
            });
          });
        }

        // TODO: Load assignments when assignments API is available
        // const assignmentsResponse = await apiClient.getAssignments();

        setAvailableScopes(scopes);
      } catch (error) {
        console.error('Failed to load scopes:', error);
      }
    };

    loadScopes();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const content = inputValue.trim();
    setInputValue('');

    // Send message via WebSocket
    const success = sendMessage(content);
    
    if (!success) {
      console.error('Failed to send message - not connected');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    clearMessages();
  };

  // Message action handlers
  const handleCreateFlashcard = async (content: string) => {
    try {
      // TODO: Implement flashcard creation when flashcards API is available
      notifications.show({
        title: 'Flashcard Created',
        message: 'This feature will be available soon!',
        color: 'blue'
      });
      console.log('Create flashcard:', content);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create flashcard',
        color: 'red'
      });
    }
  };

  const handlePinToGuide = async (content: string) => {
    try {
      // TODO: Implement study guide pinning when study guides API is available
      notifications.show({
        title: 'Pinned to Study Guide',
        message: 'This feature will be available soon!',
        color: 'green'
      });
      console.log('Pin to guide:', content);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to pin to study guide',
        color: 'red'
      });
    }
  };

  const handleSaveAsNote = async (content: string) => {
    try {
      // Extract title from content (first line or first 50 chars)
      const title = content.split('\n')[0].substring(0, 50) + (content.length > 50 ? '...' : '');
      
      const response = await apiClient.createNote({
        title: `Chat Note: ${title}`,
        content: content,
        // If we have a course scope selected, use it for the note
        courseId: selectedScope.startsWith('course-') 
          ? selectedScope.replace('course-', '') 
          : undefined
      });

      if (response.success) {
        notifications.show({
          title: 'Note Saved',
          message: 'Chat message saved as a note successfully',
          color: 'green'
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save note',
        color: 'red'
      });
    }
  };

  const hasContext = courseContext || assignmentContext;

  return (
    <Container size="lg" py="md">
      <Stack gap="md" h="calc(100vh - 120px)">
        {/* Header */}
        <Paper
          p="md"
          style={{
            background: 'var(--sanctuary-card)',
            border: '1px solid var(--border-light)',
          }}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <IconMessageCircle 
                size={24}
                style={{ color: 'var(--forest-green-primary)' }}
              />
              <Text 
                fw={600}
                style={{ color: 'var(--sanctuary-text-primary)' }}
              >
                AI Study Assistant
              </Text>
              {hasContext && (
                <Badge
                  variant="light"
                  style={{
                    backgroundColor: 'var(--forest-green-light)',
                    color: 'var(--forest-green-primary)',
                  }}
                >
                  Context Active
                </Badge>
              )}
              <Badge
                variant="light"
                style={{
                  backgroundColor: isConnected ? 'var(--forest-green-light)' : 'var(--warm-brown-light)',
                  color: isConnected ? 'var(--forest-green-primary)' : 'var(--warm-brown)',
                }}
              >
                {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </Group>
            
            {/* Scope Selector and Actions */}
            <Group gap="sm">
              <Select
                value={selectedScope}
                onChange={(value) => setSelectedScope(value || 'all')}
                data={availableScopes.map(scope => ({ value: scope.value, label: scope.label }))}
                leftSection={<IconFilter size={16} />}
                placeholder="Select scope"
                w={220}
                size="sm"
                styles={{
                  input: {
                    backgroundColor: 'var(--sanctuary-surface)',
                    borderColor: 'var(--border-light)',
                  }
                }}
              />
              
              <Button
                leftSection={<IconClearAll size={16} />}
                variant="outline"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0}
                style={{
                  borderColor: 'var(--warm-brown)',
                  color: 'var(--warm-brown)',
                }}
              >
                Clear Chat
              </Button>
            </Group>
          </Group>

          {hasContext && (
            <>
              <Divider my="sm" />
              <Group gap="md">
                {courseContext && (
                  <Text size="sm" c="dimmed">
                    <strong>Course:</strong> {courseContext}
                  </Text>
                )}
                {assignmentContext && (
                  <Text size="sm" c="dimmed">
                    <strong>Assignment:</strong> {assignmentContext}
                  </Text>
                )}
              </Group>
            </>
          )}
        </Paper>

        {/* Chat Messages */}
        <Paper
          style={{
            background: 'var(--sanctuary-surface)',
            border: '1px solid var(--border-light)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ScrollArea
            style={{ flex: 1 }}
            viewportRef={scrollAreaRef}
            p="md"
          >
            <Stack gap="md">
              {messages.length === 0 ? (
                <Stack gap="lg" align="center" justify="center" h="200px">
                  <IconRobot 
                    size={48}
                    style={{ color: 'var(--forest-green-primary)' }}
                  />
                  <Stack gap="xs" align="center">
                    <Text 
                      fw={500}
                      style={{ color: 'var(--sanctuary-text-primary)' }}
                    >
                      Welcome to your AI Study Assistant!
                    </Text>
                    <Text size="sm" c="dimmed" ta="center">
                      Ask me anything about your coursework, assignments, or study materials.
                      I&apos;m here to help with explanations, questions, and study guidance.
                    </Text>
                  </Stack>
                </Stack>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessage 
                      key={message.id} 
                      message={message}
                      onCreateFlashcard={handleCreateFlashcard}
                      onPinToGuide={handlePinToGuide}
                      onSaveAsNote={handleSaveAsNote}
                    />
                  ))}
                  {streamingMessage && (
                    <ChatMessage 
                      key={streamingMessage.id} 
                      message={streamingMessage}
                      onCreateFlashcard={handleCreateFlashcard}
                      onPinToGuide={handlePinToGuide}
                      onSaveAsNote={handleSaveAsNote}
                    />
                  )}
                </>
              )}
              
              {isTyping && !streamingMessage && <TypingIndicator />}
            </Stack>
          </ScrollArea>
        </Paper>

        {/* Input Area */}
        <Paper
          p="md"
          style={{
            background: 'var(--sanctuary-card)',
            border: '1px solid var(--border-light)',
          }}
        >
          <Group gap="sm" align="flex-end">
            <TextInput
              ref={inputRef}
              flex={1}
              placeholder="Ask a question about your studies..."
              value={inputValue}
              onChange={(event) => setInputValue(event.currentTarget.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              rightSection={
                isLoading ? (
                  <Loader size={20} />
                ) : (
                  <ActionIcon
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    variant="filled"
                    style={{
                      backgroundColor: inputValue.trim() 
                        ? 'var(--forest-green-primary)' 
                        : 'var(--border-light)',
                    }}
                  >
                    <IconSend size={16} />
                  </ActionIcon>
                )
              }
              style={{
                '& .mantine-TextInput-input': {
                  backgroundColor: 'var(--sanctuary-surface)',
                  borderColor: 'var(--border-light)',
                }
              }}
            />
          </Group>
          
          <Text size="xs" c="dimmed" mt="xs">
            Press Enter to send, Shift+Enter for new line
          </Text>
        </Paper>
      </Stack>
    </Container>
  );
}