/**
 * API utilities for planner and week tracking functionality
 */

export interface WeekBucket {
  week_number: number;
  start_date: string;
  end_date: string;
  is_current_week: boolean;
  assignments: Assignment[];
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  due_date: string | null;
  week_no: number | null;
  course_id: string;
  course_name?: string;
  course_color?: string;
  assignment_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CourseWeek {
  id: string;
  semester_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  semester_name?: string;
}

export interface PlannerStats {
  total_assignments: number;
  completed_assignments: number;
  overdue_assignments: number;
  due_today: number;
  due_this_week: number;
}

export interface WeeklyAssignmentsResponse {
  weeks: WeekBucket[];
  current_week: CourseWeek | null;
  total_assignments: number;
}

export interface AcademicDate {
  date: string; // YYYY-MM-DD
  name: string;
  category: 'holiday' | 'break' | 'deadline' | 'event' | null;
  campus: string | null;
  notes: string | null;
  week_number: number | null;
}

export interface CurrentWeekResponse {
  assignments: Assignment[];
  week_start: string;
  week_end: string;
}

import { apiClient } from '@/lib/api';

const API_BASE = '/api/v1';

/**
 * Get course weeks for a semester
 */
export async function getSemesterWeeks(semesterId: string): Promise<CourseWeek[]> {
  const data = await apiClient.request<{ weeks: CourseWeek[] }>(`/api/v1/planner/weeks/${semesterId}`);
  // Support both wrapped and raw responses
  return (data as any).weeks ?? (data as any);
}

/**
 * Rebuild week buckets for a semester
 */
export async function rebuildSemesterWeeks(semesterId: string): Promise<{ message: string; weeks: number; data: CourseWeek[] }> {
  return apiClient.request(`/api/v1/planner/weeks/${semesterId}/rebuild`, {
    method: 'POST'
  });
}

/**
 * Get assignments grouped by week for a semester
 */
export async function getAssignmentsByWeek(semesterId: string): Promise<WeeklyAssignmentsResponse> {
  return apiClient.request(`/api/v1/planner/assignments/${semesterId}/by-week`);
}

/**
 * Get assignments for the current week
 */
export async function getCurrentWeekAssignments(): Promise<CurrentWeekResponse> {
  return apiClient.request('/api/v1/planner/assignments/current-week');
}

/**
 * Auto-assign week numbers to assignments based on due dates
 */
export async function autoAssignWeekNumbers(courseId: string): Promise<{ message: string }> {
  return apiClient.request(`/api/v1/planner/courses/${courseId}/auto-assign-weeks`, {
    method: 'POST'
  });
}

/**
 * Get planner statistics for a semester
 */
export async function getPlannerStats(semesterId: string): Promise<PlannerStats> {
  return apiClient.request(`/api/v1/planner/stats/${semesterId}`);
}

/**
 * Get academic calendar dates within the semester range
 */
export async function getAcademicDates(semesterId: string): Promise<AcademicDate[]> {
  const data = await apiClient.request<{ dates: AcademicDate[] }>(`/api/v1/planner/academic-dates/${semesterId}`);
  return data.dates;
}

/**
 * Get assignments with various filtering options
 */
export async function getAssignments(options: {
  courseId?: string;
  status?: string;
  dueDate?: string;
  weekNumber?: number;
} = {}): Promise<Assignment[]> {
  const params = new URLSearchParams();
  
  if (options.courseId) params.append('course_id', options.courseId);
  if (options.status) params.append('status', options.status);
  if (options.dueDate) params.append('due_date', options.dueDate);
  if (options.weekNumber) params.append('week_no', options.weekNumber.toString());
  
  const queryString = params.toString();
  const url = `/api/v1/assignments${queryString ? `?${queryString}` : ''}`;
  
  const data = await apiClient.request(url);
  return (data as any).assignments || data;
}

/**
 * Update assignment status
 */
export async function updateAssignmentStatus(
  assignmentId: string, 
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
): Promise<Assignment> {
  return apiClient.request(`/api/v1/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}

/**
 * Create a new assignment
 */
export async function createAssignment(assignment: {
  course_id: string;
  title: string;
  description?: string;
  due_date?: string;
  assignment_type?: string;
  week_no?: number;
}): Promise<Assignment> {
  return apiClient.request(`/api/v1/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignment)
  });
}
