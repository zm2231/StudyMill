'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  sourceType: 'manual' | 'document' | 'web' | 'conversation' | 'audio';
  sourceId?: string;
  containerTags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  id: string;
  score: number;
  content: string;
  sourceType: string;
  containerTags: string[];
  metadata: Record<string, any>;
}

export interface MemorySearchFilters {
  source_type?: string;
  container_tags?: string[];
}

export interface CreateMemoryData {
  content: string;
  source_type: 'manual' | 'document' | 'web' | 'conversation' | 'audio';
  source_id?: string;
  container_tags?: string[];
  metadata?: Record<string, any>;
}

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  // Fetch all memories
  const fetchMemories = async (filters?: {
    source_type?: string;
    container_tags?: string;
    limit?: number;
    offset?: number;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters?.source_type) params.append('source_type', filters.source_type);
      if (filters?.container_tags) params.append('container_tags', filters.container_tags);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());
      
      const queryString = params.toString();
      const url = `/api/v1/memories${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.request<{ memories: Memory[]; total: number }>(url);
      setMemories(response.memories || []);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch memories';
      setError(errorMessage);
      // Don't throw error - set empty array to prevent crashes
      setMemories([]);
      return { memories: [], total: 0 };
    } finally {
      setLoading(false);
    }
  };

  // Get a specific memory
  const getMemory = async (id: string): Promise<Memory> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request<{ memory: Memory }>(`/api/v1/memories/${id}`);
      return response.memory;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch memory';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Create a new memory
  const createMemory = async (data: CreateMemoryData): Promise<Memory> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request<{ memory: Memory }>('/api/v1/memories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      // Add the new memory to the local state
      setMemories(prev => [response.memory, ...prev]);
      
      return response.memory;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create memory';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update a memory
  const updateMemory = async (id: string, data: Partial<CreateMemoryData>): Promise<Memory> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request<{ memory: Memory }>(`/api/v1/memories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      
      // Update the memory in local state
      setMemories(prev => prev.map(m => m.id === id ? response.memory : m));
      
      return response.memory;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update memory';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete a memory
  const deleteMemory = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await api.request<{ success: boolean }>(`/api/v1/memories/${id}`, {
        method: 'DELETE',
      });
      
      // Remove the memory from local state
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete memory';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Search memories
  const searchMemories = async (
    query: string,
    filters?: MemorySearchFilters,
    limit?: number
  ): Promise<MemorySearchResult[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request<{ results: MemorySearchResult[] }>('/api/v1/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          filters: filters || {},
          limit: limit || 10,
        }),
      });
      
      return response.results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search memories';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Import memories from a document
  const importFromDocument = async (
    documentId: string,
    containerTags?: string[]
  ): Promise<Memory[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request<{ memories: Memory[]; imported: number }>('/api/v1/memories/import/document', {
        method: 'POST',
        body: JSON.stringify({
          document_id: documentId,
          container_tags: containerTags || [],
        }),
      });
      
      // Add imported memories to local state
      setMemories(prev => [...response.memories, ...prev]);
      
      return response.memories;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import memories';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get memory relations
  const getMemoryRelations = async (id: string, limit?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = limit ? `?limit=${limit}` : '';
      const response = await api.request<{ relations: any[] }>(`/api/v1/memories/${id}/relations${params}`);
      return response.relations;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch memory relations';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get unique container tags (courses)
  const getContainerTags = (): string[] => {
    const allTags = memories.flatMap(memory => memory.containerTags);
    return Array.from(new Set(allTags)).sort();
  };

  // Get memories by container tag (course)
  const getMemoriesByTag = (tag: string): Memory[] => {
    return memories.filter(memory => memory.containerTags.includes(tag));
  };

  // Get memory statistics
  const getStats = () => {
    const totalMemories = memories.length;
    const bySourceType = memories.reduce((acc, memory) => {
      acc[memory.sourceType] = (acc[memory.sourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byContainerTag = memories.reduce((acc, memory) => {
      memory.containerTags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: totalMemories,
      bySourceType,
      byContainerTag,
    };
  };

  return {
    memories,
    loading,
    error,
    fetchMemories,
    getMemory,
    createMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
    importFromDocument,
    getMemoryRelations,
    getContainerTags,
    getMemoriesByTag,
    getStats,
  };
}

// Hook for managing a single memory
export function useMemory(id?: string) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  useEffect(() => {
    if (id) {
      fetchMemory(id);
    }
  }, [id]);

  const fetchMemory = async (memoryId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request<{ memory: Memory }>(`/api/v1/memories/${memoryId}`);
      setMemory(response.memory);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch memory';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    memory,
    loading,
    error,
    refetch: () => id && fetchMemory(id),
  };
}