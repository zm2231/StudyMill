// Course and scheduling types for StudyMill

export interface CourseScheduleTime {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  startTime: string; // "09:00"
  endTime: string;   // "10:30"
  location?: string;
  timezone: string;
}

export interface CourseSemester {
  startDate: string; // "2025-01-15"
  endDate: string;   // "2025-05-15"
  name: string;      // "Spring 2025"
}

export interface Course {
  id: string;
  name: string;
  code?: string;     // "CS 101"
  color: string;
  description?: string;
  instructor?: string;
  credits?: number;
  schedule: CourseScheduleTime[];
  semester: CourseSemester;
  memoryCount: number;
  created_at: string;
  updated_at: string;
}

export interface LectureSession {
  id: string;
  courseId: string;
  date: string;      // "2025-01-15"
  title?: string;    // "Lecture 1: Introduction to Machine Learning"
  week: number;      // Week number in semester
  hasAudio: boolean;
  hasNotes: boolean;
  materials: {
    audioFileId?: string;
    documentIds: string[];
    memoryIds: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface TodaysClasses {
  course: Course;
  session: LectureSession;
  timeSlot: CourseScheduleTime;
  status: 'upcoming' | 'current' | 'completed';
  canUpload: boolean; // true if within 24 hours of class time
}