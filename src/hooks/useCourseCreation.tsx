'use client';

import { useState, useCallback } from 'react';
import { CourseCreation } from '@/components/courses/CourseCreation';

interface UseCourseCreationOptions {
  onCourseCreated?: () => void;
}

export function useCourseCreation(options: UseCourseCreationOptions = {}) {
  const [opened, setOpened] = useState(false);

  const openCourseCreation = useCallback(() => {
    setOpened(true);
  }, []);

  const closeCourseCreation = useCallback(() => {
    setOpened(false);
  }, []);

  const CourseCreationModal = useCallback(() => (
    <CourseCreation
      opened={opened}
      onClose={() => {
        closeCourseCreation();
        options.onCourseCreated?.();
      }}
    />
  ), [opened, closeCourseCreation, options.onCourseCreated]);

  return {
    openCourseCreation,
    closeCourseCreation,
    CourseCreationModal
  };
}