'use client';

import { useState, useCallback } from 'react';
import { AudioUpload } from '@/components/library/AudioUpload';

interface UseAudioUploadOptions {
  preselectedCourseId?: string;
  onUploadComplete?: () => void;
}

export function useAudioUpload(options: UseAudioUploadOptions = {}) {
  const [opened, setOpened] = useState(false);

  const openAudioUpload = useCallback(() => {
    setOpened(true);
  }, []);

  const closeAudioUpload = useCallback(() => {
    setOpened(false);
  }, []);

  const AudioUploadModal = useCallback(() => (
    <AudioUpload
      opened={opened}
      onClose={() => {
        closeAudioUpload();
        options.onUploadComplete?.();
      }}
      preselectedCourseId={options.preselectedCourseId}
    />
  ), [opened, closeAudioUpload, options.preselectedCourseId, options.onUploadComplete]);

  return {
    openAudioUpload,
    closeAudioUpload,
    AudioUploadModal
  };
}