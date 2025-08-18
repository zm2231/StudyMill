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
  Divider
} from '@mantine/core';
import {
  IconSend,
  IconUser,
  IconRobot,
  IconClearAll,
  IconMessageCircle
} from '@tabler/icons-react';
import { Message } from '@/types/chat';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { useAuth } from '@/hooks/useAuth';

interface ChatInterfaceProps {
  sessionId?: string;
  courseContext?: string;
  assignmentContext?: string;
}

export function ChatInterface({
  sessionId,
  courseContext,
  assignmentContext
}: ChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      // TODO: Replace with actual API call to Gemini
      // This is a placeholder for the AI response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I understand you asked: "${userMessage.content}"\n\nThis is a placeholder response. The Gemini 2.5 Flash integration will be implemented in the next subtask.`,
        role: 'assistant',
        timestamp: new Date(),
        status: 'delivered'
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        status: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
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
            </Group>
            
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
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}
              
              {isTyping && <TypingIndicator />}
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