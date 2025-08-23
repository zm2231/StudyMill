import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';

interface UseDocumentUploadOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useDocumentUpload(options?: UseDocumentUploadOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [preselectedCourseId, setPreselectedCourseId] = useState<string | undefined>();

  const open = useCallback((courseId?: string) => {
    setPreselectedCourseId(courseId);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPreselectedCourseId(undefined);
  }, []);

  const handleSuccess = useCallback(() => {
    notifications.show({
      title: 'Upload Complete',
      message: 'Your documents have been uploaded successfully',
      color: 'green'
    });
    options?.onSuccess?.();
    close();
  }, [options, close]);

  const handleError = useCallback((error: Error) => {
    notifications.show({
      title: 'Upload Failed',
      message: error.message || 'Failed to upload documents',
      color: 'red'
    });
    options?.onError?.(error);
  }, [options]);

  return {
    isOpen,
    open,
    close,
    preselectedCourseId,
    handleSuccess,
    handleError
  };
}