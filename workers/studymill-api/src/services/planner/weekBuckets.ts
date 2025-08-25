/**
 * Week bucket management for planner organization
 * Handles semester week generation and assignment organization
 */

interface Semester {
  id: string;
  start_date: string;
  end_date: string;
}

interface CourseWeek {
  id: string;
  semester_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string | null;
  week_no: number | null;
  course_id: string;
  assignment_type: string;
  status: string;
}

interface WeekBucket {
  week_number: number;
  start_date: string;
  end_date: string;
  is_current_week: boolean;
  assignments: Assignment[];
}

/**
 * Generate week buckets from semester dates
 */
export function generateWeekBuckets(semester: Semester): Omit<CourseWeek, 'id'>[] {
  const startDate = new Date(semester.start_date);
  const endDate = new Date(semester.end_date);
  const weeks: Omit<CourseWeek, 'id'>[] = [];
  
  // Start from Monday of the week containing start_date
  const current = new Date(startDate);
  const dayOfWeek = current.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + mondayOffset);
  
  let weekNumber = 1;
  
  while (current <= endDate) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
    
    // Don't go past semester end
    if (weekEnd > endDate) {
      weekEnd.setTime(endDate.getTime());
    }
    
    weeks.push({
      semester_id: semester.id,
      week_number: weekNumber,
      start_date: weekStart.toISOString().split('T')[0],
      end_date: weekEnd.toISOString().split('T')[0]
    });
    
    // Move to next week
    current.setDate(current.getDate() + 7);
    weekNumber++;
    
    // Safety check to prevent infinite loops
    if (weekNumber > 52) {
      break;
    }
  }
  
  return weeks;
}

/**
 * Build/rebuild course weeks for a semester
 */
export async function rebuildSemesterWeeks(env: any, semesterId: string): Promise<CourseWeek[]> {
  // Get semester details
  const semester = await env.DB.prepare(
    'SELECT * FROM semesters WHERE id = ?'
  ).bind(semesterId).first<Semester>();
  
  if (!semester) {
    throw new Error('Semester not found');
  }
  
  // Delete existing weeks for this semester
  await env.DB.prepare(
    'DELETE FROM course_weeks WHERE semester_id = ?'
  ).bind(semesterId).run();
  
  // Generate new week buckets
  const weekBuckets = generateWeekBuckets(semester);
  const courseWeeks: CourseWeek[] = [];
  
  // Insert new weeks
  for (const week of weekBuckets) {
    const id = crypto.randomUUID();
    const courseWeek: CourseWeek = { id, ...week };
    
    await env.DB.prepare(`
      INSERT INTO course_weeks (id, semester_id, week_number, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      courseWeek.id,
      courseWeek.semester_id,
      courseWeek.week_number,
      courseWeek.start_date,
      courseWeek.end_date
    ).run();
    
    courseWeeks.push(courseWeek);
  }
  
  return courseWeeks;
}

/**
 * Get current week bucket for a semester
 */
export function getCurrentWeek(weeks: CourseWeek[]): CourseWeek | null {
  const today = new Date().toISOString().split('T')[0];
  
  return weeks.find(week => 
    week.start_date <= today && week.end_date >= today
  ) || null;
}

/**
 * Group assignments by week
 */
export function groupAssignmentsByWeek(
  assignments: Assignment[],
  weeks: CourseWeek[]
): WeekBucket[] {
  const today = new Date().toISOString().split('T')[0];
  
  const weekBuckets: WeekBucket[] = weeks.map(week => ({
    week_number: week.week_number,
    start_date: week.start_date,
    end_date: week.end_date,
    is_current_week: week.start_date <= today && week.end_date >= today,
    assignments: []
  }));
  
  // Group assignments into weeks
  for (const assignment of assignments) {
    let targetWeek: WeekBucket | null = null;
    
    // First try to match by week_no from syllabus
    if (assignment.week_no) {
      targetWeek = weekBuckets.find(w => w.week_number === assignment.week_no) || null;
    }
    
    // If no week_no match and has due_date, match by date range
    if (!targetWeek && assignment.due_date) {
      const dueDate = assignment.due_date.split('T')[0]; // Get date part only
      targetWeek = weekBuckets.find(w => 
        w.start_date <= dueDate && w.end_date >= dueDate
      ) || null;
    }
    
    // Add to appropriate week or create an "Unscheduled" bucket
    if (targetWeek) {
      targetWeek.assignments.push(assignment);
    } else {
      // Find or create "Unscheduled" bucket (week 0)
      let unscheduledBucket = weekBuckets.find(w => w.week_number === 0);
      if (!unscheduledBucket) {
        unscheduledBucket = {
          week_number: 0,
          start_date: '',
          end_date: '',
          is_current_week: false,
          assignments: []
        };
        weekBuckets.unshift(unscheduledBucket);
      }
      unscheduledBucket.assignments.push(assignment);
    }
  }
  
  // Return all week buckets so UI can navigate across the whole semester
  return weekBuckets;
}

/**
 * Calculate week number from date within a semester
 */
export function getWeekNumberForDate(date: string, semesterStart: string): number {
  const targetDate = new Date(date);
  const startDate = new Date(semesterStart);
  
  // Calculate difference in days
  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Convert to week number (1-indexed)
  return Math.max(1, Math.ceil(diffDays / 7));
}

/**
 * Auto-assign week numbers to assignments based on due dates
 */
export async function autoAssignWeekNumbers(
  env: any, 
  courseId: string, 
  semesterId: string
): Promise<void> {
  // Get semester info
  const semester = await env.DB.prepare(
    'SELECT start_date FROM semesters WHERE id = ?'
  ).bind(semesterId).first<{ start_date: string }>();
  
  if (!semester) return;
  
  // Get assignments without week numbers but with due dates
  const assignments = await env.DB.prepare(`
    SELECT id, due_date FROM assignments 
    WHERE course_id = ? AND week_no IS NULL AND due_date IS NOT NULL
  `).bind(courseId).all<{ id: string; due_date: string }>();
  
  // Update each assignment with calculated week number
  for (const assignment of assignments.results) {
    const weekNumber = getWeekNumberForDate(assignment.due_date, semester.start_date);
    
    await env.DB.prepare(
      'UPDATE assignments SET week_no = ? WHERE id = ?'
    ).bind(weekNumber, assignment.id).run();
  }
}