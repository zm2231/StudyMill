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

export interface CurrentWeekResponse {
  assignments: Assignment[];
  week_start: string;
  week_end: string;
}

const API_BASE = 'https://studymill-api-production.merchantzains.workers.dev/api/v1';

/**
 * Get course weeks for a semester
 */
export async function getSemesterWeeks(semesterId: string): Promise<CourseWeek[]> {
  const response = await fetch(`${API_BASE}/planner/weeks/${semesterId}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch semester weeks: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Rebuild week buckets for a semester
 */
export async function rebuildSemesterWeeks(semesterId: string): Promise<{ message: string; weeks: number; data: CourseWeek[] }> {
  const response = await fetch(`${API_BASE}/planner/weeks/${semesterId}/rebuild`, {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to rebuild semester weeks: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get assignments grouped by week for a semester
 */
export async function getAssignmentsByWeek(semesterId: string): Promise<WeeklyAssignmentsResponse> {
  const response = await fetch(`${API_BASE}/planner/assignments/${semesterId}/by-week`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch assignments by week: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get assignments for the current week
 */
export async function getCurrentWeekAssignments(): Promise<CurrentWeekResponse> {
  const response = await fetch(`${API_BASE}/planner/assignments/current-week`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch current week assignments: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Auto-assign week numbers to assignments based on due dates
 */
export async function autoAssignWeekNumbers(courseId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/planner/courses/${courseId}/auto-assign-weeks`, {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to auto-assign week numbers: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get planner statistics for a semester
 */
export async function getPlannerStats(semesterId: string): Promise<PlannerStats> {
  const response = await fetch(`${API_BASE}/planner/stats/${semesterId}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch planner stats: ${response.statusText}`);
  }
  
  return response.json();
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
  const url = `${API_BASE}/assignments${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch assignments: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.assignments || data;
}

/**
 * Update assignment status
 */
export async function updateAssignmentStatus(
  assignmentId: string, 
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
): Promise<Assignment> {
  const response = await fetch(`${API_BASE}/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update assignment status: ${response.statusText}`);
  }
  
  return response.json();
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
  const response = await fetch(`${API_BASE}/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(assignment),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create assignment: ${response.statusText}`);
  }
  
  return response.json();
}