'use client';

import { useState, useCallback } from 'react';
import { UploadDocumentsModal } from '@/components/upload/UploadDocumentsModal';

interface UseUploadOptions {
  courseId?: string;
  onUploadComplete?: (documentIds: string[]) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [opened, setOpened] = useState(false);

  const openUpload = useCallback(() => {
    setOpened(true);
  }, []);

  const closeUpload = useCallback(() => {
    setOpened(false);
  }, []);

  const UploadModal = useCallback(() => (
    <UploadDocumentsModal
      opened={opened}
      onClose={closeUpload}
      courseId={options.courseId}
      onUploadComplete={(documentIds) => {
        options.onUploadComplete?.(documentIds);
        closeUpload();
      }}
    />
  ), [opened, closeUpload, options.courseId, options.onUploadComplete]);

  return {
    openUpload,
    closeUpload,
    UploadModal
  };
}