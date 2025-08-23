'use client';

import { PersistentAudioRecorder } from './PersistentAudioRecorder';
import { usePersistentAudio } from '@/contexts/PersistentAudioContext';

export function GlobalAudioRecorderOverlay() {
  const { isRecorderOpen, closeRecorder } = usePersistentAudio();

  if (!isRecorderOpen) {
    return null;
  }

  return (
    <PersistentAudioRecorder onClose={closeRecorder} />
  );
}