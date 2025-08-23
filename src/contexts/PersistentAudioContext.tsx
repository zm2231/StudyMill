'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAudioRecordingStore } from '@/store/useAudioRecordingStore';

interface PersistentAudioContextValue {
  isRecorderOpen: boolean;
  openRecorder: () => void;
  closeRecorder: () => void;
  isRecording: boolean;
}

const PersistentAudioContext = createContext<PersistentAudioContextValue | undefined>(undefined);

export function PersistentAudioProvider({ children }: { children: ReactNode }) {
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const { status } = useAudioRecordingStore();

  // Auto-open recorder if there's an active recording session
  useEffect(() => {
    if (status === 'recording' || status === 'paused' || status === 'uploading') {
      setIsRecorderOpen(true);
    }
  }, [status]);

  const value: PersistentAudioContextValue = {
    isRecorderOpen,
    openRecorder: () => setIsRecorderOpen(true),
    closeRecorder: () => setIsRecorderOpen(false),
    isRecording: status === 'recording' || status === 'paused',
  };

  return (
    <PersistentAudioContext.Provider value={value}>
      {children}
    </PersistentAudioContext.Provider>
  );
}

export function usePersistentAudio() {
  const context = useContext(PersistentAudioContext);
  if (context === undefined) {
    throw new Error('usePersistentAudio must be used within a PersistentAudioProvider');
  }
  return context;
}