'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message } from '@/types/chat';

interface WebSocketMessage {
  type: 'session_info' | 'message' | 'message_ack' | 'message_start' | 'message_chunk' | 'message_complete' | 'error' | 'user_typing' | 'user_stopped_typing';
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
  userId?: string;
  retrievalMode?: 'basic' | 'advanced';
  onMessage?: (message: Message) => void;
  onError?: (error: string) => void;
}

export function useWebSocketChat({
  sessionId,
  courseId,
  scope,
  onMessage,
  onError,
  userId,
  retrievalMode = 'advanced'
}: UseWebSocketChatOptions) {
  // If HTTP chat is enabled, disable WebSocket path (no-op) to avoid legacy DO logs and connections
  if (process.env.NEXT_PUBLIC_CHAT_HTTP === '1') {
    try {
      console.info('[useWebSocketChat] disabled by NEXT_PUBLIC_CHAT_HTTP=1');
    } catch {}
    return {
      isConnected: false,
      isConnecting: false,
      messages: [] as Message[],
      streamingMessage: null as Message | null,
      sendMessage: (_content: string) => false,
      sendTyping: (_isTyping: boolean) => {},
      clearMessages: () => {},
      connect: () => {},
      disconnect: () => {},
      replaceMessages: (_msgs: Message[]) => {},
      sessionId: sessionId || 'ws_disabled',
      lastError: null as string | null,
      connectionAttempts: 0,
      readyState: 3 // CLOSED
    };
  }

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const streamingRef = useRef<Message | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const currentSessionId = useRef<string>(sessionId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `session_${Math.random().toString(36).slice(2)}`));
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Get API base URL
  const getApiBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      const envUrl = process.env.NEXT_PUBLIC_API_URL;
      if (envUrl) {
        const host = new URL(envUrl).host;
        return `${protocol}//${host}`;
      }
    } catch {}
    // Fallback to production API host
    return `${protocol}//studymill-api-production.merchantzains.workers.dev`;
  };

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setLastError(null);
    setConnectionAttempts((n) => n + 1);
    
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams({
      sessionId: currentSessionId.current
    });
    
    if (scope && scope !== 'all') {
      params.append('scope', scope);
    }
    if (userId) {
      params.append('userId', userId);
    }
    
    const wsUrl = `${baseUrl}/api/v1/chat/ws?${params.toString()}`;
    
    try {
      // WebSocket doesn't support custom headers directly, so we'll pass auth via query params
      // TODO: In production, implement proper WebSocket auth via subprotocols or connection validation
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Safety timeout: if not open within 8s, flag error
      const timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          setIsConnecting(false);
          setLastError('Timeout opening WebSocket');
          onErrorRef.current?.('Timeout opening WebSocket');
          try { ws.close(); } catch {}
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        setIsConnected(true);
        setIsConnecting(false);
        try {
          const ts = new Date().toISOString();
          console.log(`[Chat] WebSocket connected`, { ts, sessionId: currentSessionId.current });
          if (typeof window !== 'undefined') {
            (window as any).StudyMillChat = {
              ...(window as any).StudyMillChat,
              sessionId: currentSessionId.current,
              connectedAt: ts,
            };
          }
        } catch {}
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage | any = JSON.parse(event.data);
          // Lightweight console log of model info for visibility
          if (data?.type === 'ai_info' && data?.model) {
            console.log(`[StudyMill AI] Using model: ${data.model}` + (data.reason ? ` (reason: ${data.reason})` : ''));
            try {
              window.dispatchEvent(new CustomEvent('studymill-ai-info', { detail: { model: data.model, reason: data.reason } }));
            } catch {}
          }
          handleWebSocketMessage(data as WebSocketMessage);
        } catch (error) {
          console.error('[WebSocketChat] parse error:', error);
        }
      };

      ws.onclose = (ev) => {
        clearTimeout(timeoutId);
        setIsConnected(false);
        setIsConnecting(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('[WebSocketChat] error:', error);
        setIsConnecting(false);
        setLastError('WebSocket error');
        onErrorRef.current?.('Connection error occurred');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
      onErrorRef.current?.('Failed to connect to chat service');
    }
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case 'session_info':
        try {
          const ts = new Date().toISOString();
          console.log(`[Chat] session_info`, { ts, sessionId: data.sessionId, session: data.session });
          if (typeof window !== 'undefined') {
            (window as any).StudyMillChat = {
              ...(window as any).StudyMillChat,
              sessionId: data.sessionId || currentSessionId.current,
              session: data.session,
              lastSessionInfoAt: ts,
            };
            window.dispatchEvent(new CustomEvent('studymill-session-info', { detail: { ts, sessionId: data.sessionId, session: data.session } }));
          }
        } catch {}
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
          // Only add if it's from another user (not our own message)
          setMessages(prev => {
            const exists = prev.some(m => m.id === message.id);
            if (!exists) {
              return [...prev, message];
            }
            return prev;
          });
          onMessageRef.current?.(message);
        }
        break;

      case 'message_ack':
        // Acknowledgment of our sent message - update status only
        if (data.message) {
          setMessages(prev => 
            prev.map(m => 
              m.id === data.message!.id 
                ? { ...m, status: 'delivered' }
                : m
            )
          );
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
          streamingRef.current = newMessage;
          setStreamingMessage(newMessage);
        }
        break;

      case 'message_chunk':
        if (data.messageId && data.chunk) {
          setStreamingMessage(prev => {
            if (prev && prev.id === data.messageId) {
              const updated = { ...prev, content: prev.content + data.chunk };
              streamingRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        break;

      case 'message_complete':
        if (data.message) {
          try {
            const ts = new Date().toISOString();
            console.log(`[Chat] message_complete`, { ts, messageId: data.message.id, length: (data.message.content || '').length });
          } catch {}
          const preferredContent = (() => {
            const fromServer = data.message.content || '';
            const fromStream = streamingRef.current && streamingRef.current.id === data.message.id ? (streamingRef.current.content || '') : '';
            return fromServer.length >= fromStream.length ? fromServer : fromStream;
          })();
          const completedMessage: Message = {
            id: data.message.id,
            content: preferredContent,
            role: data.message.role,
            timestamp: new Date(data.message.timestamp),
            status: 'delivered'
          };
          setMessages(prev => [...prev, completedMessage]);
          streamingRef.current = null;
          setStreamingMessage(null);
          onMessageRef.current?.(completedMessage);
        }
        break;

      case 'error':
        onError?.(data.error || (data as any).message || 'An error occurred');
        break;

      default:
        // ignore unknown types silently
        break;
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
      courseId,
      retrievalMode
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
  }, [courseId, onError, retrievalMode]);

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

  const replaceMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
    setStreamingMessage(null);
  }, []);

  // Allow external sessionId switch
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId.current) {
      currentSessionId.current = sessionId;
      // Reconnect to new session
      disconnect();
      setTimeout(() => connect(), 10);
    }
  }, [sessionId, connect, disconnect]);

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
    replaceMessages,
    sessionId: currentSessionId.current,
    lastError,
    connectionAttempts,
    readyState: wsRef.current?.readyState
  };
}
