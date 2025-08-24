'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message } from '@/types/chat';

interface WebSocketMessage {
  type: 'session_info' | 'message' | 'message_start' | 'message_chunk' | 'message_complete' | 'error' | 'user_typing' | 'user_stopped_typing';
  sessionId?: string;
  session?: {
    id: string;
    userId: string;
    courseId?: string;
    scope?: string;
    createdAt: string;
    lastActivity: string;
  };
  message?: Message;
  messageId?: string;
  chunk?: string;
  userId?: string;
  error?: string;
}

interface UseWebSocketChatOptions {
  sessionId?: string;
  courseId?: string;
  scope?: string;
  onMessage?: (message: Message) => void;
  onError?: (error: string) => void;
}

export function useWebSocketChat({
  sessionId,
  courseId,
  scope,
  onMessage,
  onError
}: UseWebSocketChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentSessionId = useRef<string>(sessionId || crypto.randomUUID());

  // Get API base URL
  const getApiBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Always use production API URL
    return `${protocol}//studymill-api-production.merchantzains.workers.dev`;
  };

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams({
      sessionId: currentSessionId.current
    });
    
    if (scope && scope !== 'all') {
      params.append('scope', scope);
    }
    
    const wsUrl = `${baseUrl}/api/v1/chat/ws?${params.toString()}`;
    
    try {
      // WebSocket doesn't support custom headers directly, so we'll pass auth via query params
      // TODO: In production, implement proper WebSocket auth via subprotocols or connection validation
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        onError?.('Connection error occurred');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
      onError?.('Failed to connect to chat service');
    }
  }, [onError]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case 'session_info':
        console.log('Session info received:', data.session);
        break;

      case 'message':
        if (data.message) {
          const message: Message = {
            id: data.message.id,
            content: data.message.content,
            role: data.message.role,
            timestamp: new Date(data.message.timestamp),
            status: 'delivered'
          };
          setMessages(prev => [...prev, message]);
          onMessage?.(message);
        }
        break;

      case 'message_start':
        if (data.messageId) {
          const newMessage: Message = {
            id: data.messageId,
            content: '',
            role: 'assistant',
            timestamp: new Date(),
            status: 'streaming'
          };
          setStreamingMessage(newMessage);
        }
        break;

      case 'message_chunk':
        if (data.messageId && data.chunk) {
          setStreamingMessage(prev => {
            if (prev && prev.id === data.messageId) {
              return {
                ...prev,
                content: prev.content + data.chunk
              };
            }
            return prev;
          });
        }
        break;

      case 'message_complete':
        if (data.message) {
          const completedMessage: Message = {
            id: data.message.id,
            content: data.message.content,
            role: data.message.role,
            timestamp: new Date(data.message.timestamp),
            status: 'delivered'
          };
          setMessages(prev => [...prev, completedMessage]);
          setStreamingMessage(null);
          onMessage?.(completedMessage);
        }
        break;

      case 'error':
        console.error('WebSocket error:', data.error);
        onError?.(data.error || 'An error occurred');
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  // Send a message
  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.('Not connected to chat service');
      return false;
    }

    const userMessage: Message = {
      id: 'msg_' + crypto.randomUUID(),
      content,
      role: 'user',
      timestamp: new Date(),
      status: 'sending'
    };

    // Add user message to local state immediately
    setMessages(prev => [...prev, userMessage]);

    // Send to WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      content,
      courseId
    }));

    // Update message status to sent
    setMessages(prev => 
      prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'sent' as const }
          : msg
      )
    );

    return true;
  }, [courseId, onError]);

  // Send typing indicators
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: isTyping ? 'typing_start' : 'typing_stop'
    }));
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingMessage(null);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect, scope]);

  return {
    isConnected,
    isConnecting,
    messages,
    streamingMessage,
    sendMessage,
    sendTyping,
    clearMessages,
    connect,
    disconnect,
    sessionId: currentSessionId.current
  };
}