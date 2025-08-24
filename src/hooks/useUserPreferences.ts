'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_UNIVERSITY_ID } from '@/types/university';

interface UserPreferences {
  universityId: string;
}

const PREFERENCES_KEY = 'studySync_userPreferences';

const defaultPreferences: UserPreferences = {
  universityId: DEFAULT_UNIVERSITY_ID
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  };

  const setUniversity = (universityId: string) => {
    updatePreferences({ universityId });
  };

  return {
    preferences,
    loading,
    updatePreferences,
    setUniversity
  };
}
