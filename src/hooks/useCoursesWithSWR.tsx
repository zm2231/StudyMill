'use client';

import useSWR, { mutate } from 'swr';
import { useApi } from '@/lib/api';
import { LibraryCourse, CourseListResponse, CourseNavItem } from '@/types/library';
import { CreateCourseData } from './useCourses';
import { Course } from '@/types/course';

interface ApiInstance {
  getCourses: () => Promise<CourseListResponse>;
  createCourse: (data: CreateCourseData) => Promise<{ success: boolean; course: Course }>;
  updateCourse: (id: string, data: Partial<CreateCourseData>) => Promise<{ success: boolean; course: Course }>;
  deleteCourse: (id: string) => Promise<{ success: boolean }>;
}

// SWR fetcher function
const fetcher = async (api: ApiInstance): Promise<LibraryCourse[]> => {
  const response = await api.getCourses();
  if (response.success && response.courses) {
    return response.courses;
  }
  return [];
};

/**
 * Enhanced courses hook using SWR for caching and background updates
 * Provides automatic revalidation, error retry, and optimized performance
 */
export function useCoursesWithSWR() {
  const api = useApi();
  
  // SWR hook with configuration
  const {
    data: courses = [],
    error,
    isLoading,
    isValidating,
    mutate: revalidate
  } = useSWR(
    ['courses', api], // Key includes API instance for user-specific caching
    () => fetcher(api as ApiInstance),
    {
      // Revalidate on window focus for fresh data
      revalidateOnFocus: true,
      // Revalidate on reconnect after network issues
      revalidateOnReconnect: true,
      // Revalidate in background every 5 minutes
      refreshInterval: 5 * 60 * 1000,
      // Retry failed requests up to 3 times
      errorRetryCount: 3,
      // Exponential backoff for retries
      errorRetryInterval: 1000,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Dedupe requests within 2 seconds
      dedupingInterval: 2000,
    }
  );

  // Transform courses to CourseNavItem format for sidebar
  const navItems: CourseNavItem[] = courses.map(course => ({
    id: course.id,
    name: course.name,
    count: course.memoryCount || 0,
    color: course.color || '#3b82f6'
  }));

  // Create course with optimistic update
  const createCourse = async (data: CreateCourseData): Promise<Course> => {
    try {
      // Optimistic update - add new course immediately
      const tempId = 'temp_' + Date.now();
      const optimisticCourse: LibraryCourse = {
        id: tempId,
        name: data.name,
        code: data.code,
        color: data.color || '#3b82f6',
        description: data.description,
        instructor: data.instructor,
        credits: data.credits,
        schedule: data.schedule || [],
        semester: data.semester,
        memoryCount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: '' // Will be set by backend
      };

      // Update cache optimistically
      await mutate(
        ['courses', api],
        [optimisticCourse, ...courses],
        false // Don't revalidate immediately
      );

      // Make actual API call
      const response = await (api as ApiInstance).createCourse(data);
      
      if (response.success) {
        // Revalidate to get real data from server
        await revalidate();
        return response.course;
      }
      
      throw new Error('Failed to create course');
    } catch (error) {
      // Revert optimistic update on error
      await revalidate();
      throw error;
    }
  };

  // Update course with optimistic update
  const updateCourse = async (id: string, data: Partial<CreateCourseData>): Promise<Course> => {
    try {
      // Optimistic update
      const updatedCourses = courses.map(course =>
        course.id === id ? { ...course, ...data, updated_at: new Date().toISOString() } : course
      );

      await mutate(
        ['courses', api],
        updatedCourses,
        false
      );

      // Make actual API call
      const response = await (api as ApiInstance).updateCourse(id, data);
      
      if (response.success) {
        await revalidate();
        return response.course;
      }
      
      throw new Error('Failed to update course');
    } catch (error) {
      // Revert optimistic update on error
      await revalidate();
      throw error;
    }
  };

  // Delete course with optimistic update
  const deleteCourse = async (id: string): Promise<void> => {
    try {
      // Optimistic update
      const filteredCourses = courses.filter(course => course.id !== id);

      await mutate(
        ['courses', api],
        filteredCourses,
        false
      );

      // Make actual API call
      const response = await (api as ApiInstance).deleteCourse(id);
      
      if (response.success) {
        await revalidate();
      } else {
        throw new Error('Failed to delete course');
      }
    } catch (error) {
      // Revert optimistic update on error
      await revalidate();
      throw error;
    }
  };

  // Utility functions
  const getCourseById = (id: string): LibraryCourse | undefined => {
    return courses.find(course => course.id === id);
  };

  const refreshCourses = () => {
    return revalidate();
  };

  // Manual cache invalidation (useful after external changes)
  const invalidateCache = () => {
    return mutate(['courses', api], undefined, { revalidate: true });
  };

  return {
    // Data
    courses,
    navItems,
    
    // State
    isLoading,
    isValidating,
    error: error?.message || null,
    
    // Actions
    createCourse,
    updateCourse,
    deleteCourse,
    
    // Utilities
    getCourseById,
    refreshCourses,
    invalidateCache,
    revalidate,
  };
}

export default useCoursesWithSWR;