import { apiClient } from '@/lib/api';

// Types for grade data
export interface GradeWeight {
  id: string;
  name: string;
  weight_pct: number;
  drop_lowest?: number;
  is_extra_credit?: boolean;
}

export interface GradeAssignment {
  id: string;
  title: string;
  type?: string;
  due_date?: string;
  week_no?: number;
  points?: number;
  weight_category?: string;
  status: string;
  points_earned?: number;
  points_possible?: number;
  graded_at?: string;
  comments?: string;
  isGraded?: boolean;
  isPastDue?: boolean;
  percentScore?: number | null;
}

export interface GradeSummary {
  currentGrade: number;
  letterGrade: string;
  earnedWeightPercentage: number;
  totalAssignments: number;
  gradedAssignments: number;
}

export interface CourseGradeData {
  course: {
    id: string;
    name: string;
    code?: string;
    instructor?: string;
  };
  gradeWeights: GradeWeight[];
  assignments: GradeAssignment[];
  summary: GradeSummary;
}

export interface AssignmentStats {
  total: number;
  graded: number;
  pending: number;
  upcoming: number;
  overdue: number;
}

// Fetch all grade data for a course
export async function fetchCourseGrades(courseId: string): Promise<CourseGradeData> {
  const response = await apiClient.request<{
    success: boolean;
    course: CourseGradeData['course'];
    gradeWeights: GradeWeight[];
    assignments: GradeAssignment[];
    summary: GradeSummary;
  }>(`/api/v1/grades/${courseId}`);
  
  return {
    course: response.course,
    gradeWeights: response.gradeWeights,
    assignments: response.assignments,
    summary: response.summary
  };
}

// Fetch just grade weights for a course
export async function fetchGradeWeights(courseId: string): Promise<{
  weights: GradeWeight[];
  totalWeight: number;
  isValid: boolean;
}> {
  const response = await apiClient.request<{
    success: boolean;
    weights: GradeWeight[];
    totalWeight: number;
    isValid: boolean;
  }>(`/api/v1/grades/${courseId}/weights`);
  
  return {
    weights: response.weights,
    totalWeight: response.totalWeight,
    isValid: response.isValid
  };
}

// Fetch assignments with grades for a course
export async function fetchGradeAssignments(courseId: string): Promise<{
  assignments: GradeAssignment[];
  stats: AssignmentStats;
}> {
  const response = await apiClient.request<{
    success: boolean;
    assignments: GradeAssignment[];
    stats: AssignmentStats;
  }>(`/api/v1/grades/${courseId}/assignments`);
  
  return {
    assignments: response.assignments,
    stats: response.stats
  };
}

// Refresh grades from syllabus
export async function refreshGradesFromSyllabus(courseId: string): Promise<{
  success: boolean;
  message?: string;
  requiresUpload?: boolean;
  syllabusDocumentId?: string;
}> {
  const response = await apiClient.request<{
    success: boolean;
    message?: string;
    error?: string;
    requiresUpload?: boolean;
    syllabusDocumentId?: string;
  }>(`/api/v1/grades/${courseId}/refresh`, {
    method: 'POST'
  });
  
  return response;
}

// Helper to format percentage for display
export function formatPercentage(decimal: number): string {
  return `${Math.round(decimal * 100)}%`;
}

// Helper to format date for display
export function formatDueDate(dateString?: string | null): string {
  if (!dateString) return 'No due date';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Due yesterday';
  if (diffDays > 0 && diffDays <= 7) return `Due in ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// Group assignments by category
export function groupAssignmentsByCategory(
  assignments: GradeAssignment[]
): Map<string, GradeAssignment[]> {
  const grouped = new Map<string, GradeAssignment[]>();
  
  assignments.forEach(assignment => {
    const category = assignment.weight_category || 'Uncategorized';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(assignment);
  });
  
  // Sort assignments within each category by due date
  grouped.forEach(categoryAssignments => {
    categoryAssignments.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  });
  
  return grouped;
}

// Calculate category statistics
export interface CategoryStats {
  category: string;
  weight: number;
  earnedPoints: number;
  possiblePoints: number;
  percentage: number;
  weightedScore: number;
  assignmentCount: number;
  gradedCount: number;
}

export function calculateCategoryStats(
  assignments: GradeAssignment[],
  weights: GradeWeight[]
): CategoryStats[] {
  const stats: CategoryStats[] = [];
  const weightMap = new Map(weights.map(w => [w.name, w.weight_pct]));
  
  // Group assignments by category
  const grouped = groupAssignmentsByCategory(assignments);
  
  // Calculate stats for each category
  weights.forEach(weight => {
    const categoryAssignments = grouped.get(weight.name) || [];
    const gradedAssignments = categoryAssignments.filter(a => 
      a.points_earned !== null && 
      a.points_earned !== undefined && 
      a.points_possible !== null && 
      a.points_possible !== undefined &&
      a.points_possible > 0
    );
    
    const earnedPoints = gradedAssignments.reduce(
      (sum, a) => sum + (a.points_earned || 0), 
      0
    );
    const possiblePoints = gradedAssignments.reduce(
      (sum, a) => sum + (a.points_possible || 0), 
      0
    );
    
    const percentage = possiblePoints > 0 
      ? (earnedPoints / possiblePoints) * 100 
      : 0;
    
    const weightedScore = percentage * weight.weight_pct;
    
    stats.push({
      category: weight.name,
      weight: weight.weight_pct,
      earnedPoints,
      possiblePoints,
      percentage,
      weightedScore,
      assignmentCount: categoryAssignments.length,
      gradedCount: gradedAssignments.length
    });
  });
  
  // Add uncategorized assignments if any
  const uncategorized = grouped.get('Uncategorized');
  if (uncategorized && uncategorized.length > 0) {
    const gradedUncategorized = uncategorized.filter(a => 
      a.points_earned !== null && 
      a.points_earned !== undefined && 
      a.points_possible !== null && 
      a.points_possible !== undefined &&
      a.points_possible > 0
    );
    
    const earnedPoints = gradedUncategorized.reduce(
      (sum, a) => sum + (a.points_earned || 0), 
      0
    );
    const possiblePoints = gradedUncategorized.reduce(
      (sum, a) => sum + (a.points_possible || 0), 
      0
    );
    
    const percentage = possiblePoints > 0 
      ? (earnedPoints / possiblePoints) * 100 
      : 0;
    
    stats.push({
      category: 'Uncategorized',
      weight: 0,
      earnedPoints,
      possiblePoints,
      percentage,
      weightedScore: 0,
      assignmentCount: uncategorized.length,
      gradedCount: gradedUncategorized.length
    });
  }
  
  return stats;
}
