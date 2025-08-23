'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface TimerContextValue {
  showFullTimer: boolean;
  openFullTimer: () => void;
  closeFullTimer: () => void;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [showFullTimer, setShowFullTimer] = useState(false);

  const value: TimerContextValue = {
    showFullTimer,
    openFullTimer: () => setShowFullTimer(true),
    closeFullTimer: () => setShowFullTimer(false)
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimerContext must be used within a TimerProvider');
  }
  return context;
}