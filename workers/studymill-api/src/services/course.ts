import { DatabaseService, Course, CreateCourseData, UpdateCourseData } from './database';
import { createError } from '../middleware/error';

export class CourseService {
  constructor(private dbService: DatabaseService) {}

  async createCourse(userId: string, data: CreateCourseData): Promise<Course> {
    // Validation
    if (!data.name || data.name.trim().length === 0) {
      createError('Course name is required', 400, { field: 'name' });
    }

    if (data.name.length > 255) {
      createError('Course name cannot exceed 255 characters', 400, { field: 'name' });
    }

    if (data.description && data.description.length > 1000) {
      createError('Course description cannot exceed 1000 characters', 400, { field: 'description' });
    }

    // Check if user has reached course limit (optional business rule)
    const courseCount = await this.dbService.getCourseCount(userId);
    const MAX_COURSES_PER_USER = 50; // Adjust as needed
    
    if (courseCount >= MAX_COURSES_PER_USER) {
      createError(`Maximum of ${MAX_COURSES_PER_USER} courses allowed per user`, 400);
    }

    // Create the course
    const course = await this.dbService.createCourse(userId, {
      name: data.name.trim(),
      description: data.description?.trim()
    });

    return course;
  }

  async getUserCourses(userId: string): Promise<Course[]> {
    return await this.dbService.getCoursesByUserId(userId);
  }

  async getCourse(courseId: string, userId: string): Promise<Course> {
    const course = await this.dbService.getCourseById(courseId, userId);
    
    if (!course) {
      createError('Course not found', 404, { courseId });
    }

    return course;
  }

  async updateCourse(courseId: string, userId: string, data: UpdateCourseData): Promise<Course> {
    // Validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        createError('Course name cannot be empty', 400, { field: 'name' });
      }

      if (data.name.length > 255) {
        createError('Course name cannot exceed 255 characters', 400, { field: 'name' });
      }
    }

    if (data.description !== undefined && data.description && data.description.length > 1000) {
      createError('Course description cannot exceed 1000 characters', 400, { field: 'description' });
    }

    // Prepare update data
    const updateData: UpdateCourseData = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim();
    }

    const course = await this.dbService.updateCourse(courseId, userId, updateData);
    
    if (!course) {
      createError('Course not found', 404, { courseId });
    }

    return course;
  }

  async deleteCourse(courseId: string, userId: string): Promise<void> {
    const deleted = await this.dbService.deleteCourse(courseId, userId);
    
    if (!deleted) {
      createError('Course not found', 404, { courseId });
    }
  }

  async getCourseStats(userId: string) {
    const courses = await this.dbService.getCoursesByUserId(userId);
    
    return {
      totalCourses: courses.length,
      recentCourses: courses.slice(0, 5).map(course => ({
        id: course.id,
        name: course.name,
        created_at: course.created_at
      }))
    };
  }
}