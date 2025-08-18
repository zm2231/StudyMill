// TypeScript interfaces for Library component and course data structures

import { Course } from './course';

/**
 * Extended course interface specifically for library display
 * Includes count of memories/documents associated with the course
 */
export interface LibraryCourse extends Course {
  memoryCount: number;
}

/**
 * API response structure for course listing
 */
export interface CourseListResponse {
  success: boolean;
  courses: LibraryCourse[];
}

/**
 * Course data structure optimized for sidebar navigation
 * Minimal data needed for the library sidebar display
 */
export interface CourseNavItem {
  id: string;
  name: string;
  count: number;
  color: string;
}

/**
 * Loading states for course data fetching
 */
export interface CourseLoadingState {
  isLoading: boolean;
  error: string | null;
  data: LibraryCourse[] | null;
}

/**
 * Course selection state for the library interface
 */
export type CourseSelection = string | 'overview' | 'recent' | 'reading-list' | 'discover' | null;

/**
 * Props interface for library-related components
 */
export interface LibraryLayoutProps {
  initialCourseId?: string;
}

export interface LibraryContentProps {
  selectedCourse: CourseSelection;
  courses: CourseNavItem[];
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Course memory count calculation response
 */
export interface CourseMemoryCount {
  courseId: string;
  memoryCount: number;
  documentCount: number;
  lastUpdated: string;
}