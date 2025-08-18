'use client';

import { useState, useCallback } from 'react';
import { useApi } from '@/lib/api';
import { Course, CourseScheduleTime, CourseSemester, LectureSession, TodaysClasses } from '@/types/course';

export interface CreateCourseData {
  name: string;
  code?: string;
  color: string;
  description?: string;
  instructor?: string;
  credits?: number;
  schedule: CourseScheduleTime[];
  semester: CourseSemester;
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  // Fetch all user's courses
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getCourses();
      if (response.success) {
        setCourses(response.courses as Course[]);
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch courses';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Create a new course
  const createCourse = useCallback(async (data: CreateCourseData): Promise<Course> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.createCourse(data);
      if (response.success) {
        const newCourse = response.course as Course;
        setCourses(prev => [newCourse, ...prev]);
        return newCourse;
      }
      throw new Error('Failed to create course');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Update an existing course
  const updateCourse = useCallback(async (id: string, data: Partial<CreateCourseData>): Promise<Course> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.updateCourse(id, data);
      if (response.success) {
        const updatedCourse = response.course as Course;
        setCourses(prev => prev.map(course => course.id === id ? updatedCourse : course));
        return updatedCourse;
      }
      throw new Error('Failed to update course');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Delete a course
  const deleteCourse = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.deleteCourse(id);
      if (response.success) {
        setCourses(prev => prev.filter(course => course.id !== id));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Get a specific course
  const getCourse = useCallback(async (id: string): Promise<Course> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getCourse(id);
      if (response.success) {
        return response.course as Course;
      }
      throw new Error('Course not found');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Get today's classes
  const getTodaysClasses = useCallback(async (): Promise<TodaysClasses[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getTodaysClasses();
      if (response.success) {
        return response.classes as TodaysClasses[];
      }
      return [];
    } catch (err) {
      // Handle 404 gracefully - the courses/today endpoint doesn't exist yet
      if (err instanceof Error && err.message.includes('404')) {
        console.warn('Today\'s classes API not implemented yet, returning empty array');
        return [];
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch today\'s classes';
      setError(errorMessage);
      // Don't throw the error - return empty array to prevent crashes
      return [];
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Utility functions
  const getCourseById = useCallback((id: string): Course | undefined => {
    return courses.find(course => course.id === id);
  }, [courses]);

  const getCoursesByDay = useCallback((dayOfWeek: number): Course[] => {
    return courses.filter(course => 
      course.schedule && Array.isArray(course.schedule) && 
      course.schedule.some(slot => slot.dayOfWeek === dayOfWeek)
    );
  }, [courses]);

  const getCurrentCourse = useCallback((): Course | null => {
    // Return null if no courses loaded
    if (!courses || courses.length === 0) {
      return null;
    }

    // Return null if courses don't have schedule data yet (backend doesn't implement scheduling)
    const hasScheduleData = courses.some(course => course.schedule && Array.isArray(course.schedule) && course.schedule.length > 0);
    if (!hasScheduleData) {
      return null;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    for (const course of courses) {
      // Ensure course has schedule property
      if (!course.schedule || !Array.isArray(course.schedule) || course.schedule.length === 0) {
        continue;
      }
      
      for (const slot of course.schedule) {
        if (slot.dayOfWeek === currentDay && 
            currentTime >= slot.startTime && 
            currentTime <= slot.endTime) {
          return course;
        }
      }
    }
    return null;
  }, [courses]);

  const getUpcomingCourse = useCallback((): { course: Course; timeSlot: CourseScheduleTime } | null => {
    // Return null if no courses loaded
    if (!courses || courses.length === 0) {
      return null;
    }

    // Return null if courses don't have schedule data yet (backend doesn't implement scheduling)
    const hasScheduleData = courses.some(course => course.schedule && Array.isArray(course.schedule) && course.schedule.length > 0);
    if (!hasScheduleData) {
      return null;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    // Find next class today
    for (const course of courses) {
      // Ensure course has schedule property
      if (!course.schedule || !Array.isArray(course.schedule) || course.schedule.length === 0) {
        continue;
      }
      
      for (const slot of course.schedule) {
        if (slot.dayOfWeek === currentDay && currentTime < slot.startTime) {
          return { course, timeSlot: slot };
        }
      }
    }

    // Find next class in upcoming days
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const targetDay = (currentDay + dayOffset) % 7;
      const coursesForDay = getCoursesByDay(targetDay);
      if (coursesForDay.length > 0) {
        // Return the earliest class of that day
        const earliestCourse = coursesForDay.reduce((earliest, course) => {
          const earliestSlot = course.schedule
            .filter(slot => slot.dayOfWeek === targetDay)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
          
          const currentEarliestSlot = earliest.schedule
            .filter(slot => slot.dayOfWeek === targetDay)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

          return earliestSlot.startTime < currentEarliestSlot.startTime ? course : earliest;
        });

        const timeSlot = earliestCourse.schedule
          .filter(slot => slot.dayOfWeek === targetDay)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

        return { course: earliestCourse, timeSlot };
      }
    }

    return null;
  }, [courses, getCoursesByDay]);

  // Course statistics
  const getCourseStats = useCallback(() => {
    const totalCourses = courses.length;
    const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);
    const totalMemories = courses.reduce((sum, course) => sum + (course.memoryCount || 0), 0);
    
    const scheduleStats = courses.reduce((stats, course) => {
      if (course.schedule && Array.isArray(course.schedule)) {
        course.schedule.forEach(slot => {
          stats.totalHours += getHoursDuration(slot.startTime, slot.endTime);
          stats.daysUsed.add(slot.dayOfWeek);
        });
      }
      return stats;
    }, { totalHours: 0, daysUsed: new Set<number>() });

    return {
      totalCourses,
      totalCredits,
      totalMemories,
      totalWeeklyHours: scheduleStats.totalHours,
      activeDays: scheduleStats.daysUsed.size,
    };
  }, [courses]);

  return {
    courses,
    loading,
    error,
    fetchCourses,
    createCourse,
    updateCourse,
    deleteCourse,
    getCourse,
    getTodaysClasses,
    getCourseById,
    getCoursesByDay,
    getCurrentCourse,
    getUpcomingCourse,
    getCourseStats,
  };
}

// Helper function to calculate duration between two time strings
function getHoursDuration(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return (end - start) / 60; // Convert minutes to hours
}

function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Hook for managing lecture sessions
export function useLectureSessions(courseId: string) {
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const fetchSessions = useCallback(async (options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getLectureSessions(courseId, options);
      if (response.success) {
        setSessions(response.sessions as LectureSession[]);
        return response;
      }
      throw new Error('Failed to fetch sessions');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch lecture sessions';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, courseId]);

  const createSession = useCallback(async (data: { date: string; title?: string }): Promise<LectureSession> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.createLectureSession(courseId, data);
      if (response.success) {
        const newSession = response.session as LectureSession;
        setSessions(prev => [newSession, ...prev.filter(s => s.date !== newSession.date)]);
        return newSession;
      }
      throw new Error('Failed to create session');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create lecture session';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, courseId]);

  const updateSession = useCallback(async (sessionId: string, data: {
    title?: string;
    audioFileId?: string;
    documentIds?: string[];
  }): Promise<LectureSession> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.updateLectureSession(courseId, sessionId, data);
      if (response.success) {
        const updatedSession = response.session as LectureSession;
        setSessions(prev => prev.map(session => 
          session.id === sessionId ? updatedSession : session
        ));
        return updatedSession;
      }
      throw new Error('Failed to update session');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update lecture session';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, courseId]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
  };
}