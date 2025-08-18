'use client';

import { useState, useEffect } from 'react';
import { ProcessingPreferences, CostSummary } from '@/components/settings/ProcessingPreferences';

const DEFAULT_PREFERENCES: ProcessingPreferences = {
  defaultMode: 'auto',
  autoUpgradeEnabled: true,
  costLimit: 10,
  notificationEnabled: true
};

export function useProcessingPreferences() {
  const [preferences, setPreferences] = useState<ProcessingPreferences>(DEFAULT_PREFERENCES);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from localStorage and API
  useEffect(() => {
    loadPreferences();
    loadCostSummary();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      
      // Try to load from localStorage first
      const stored = localStorage.getItem('processingPreferences');
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      }

      // Try to load from API
      try {
        const response = await fetch('/api/user/processing-preferences', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.preferences) {
            setPreferences(data.preferences);
            // Sync with localStorage
            localStorage.setItem('processingPreferences', JSON.stringify(data.preferences));
          }
        }
      } catch (apiError) {
        console.warn('Preferences API not available yet, using localStorage');
      }
    } catch (err) {
      setError('Failed to load preferences');
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCostSummary = async () => {
    try {
      // Try to get real cost data from API
      try {
        const response = await fetch('/api/user/processing-cost-summary', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.costSummary) {
            setCostSummary(data.costSummary);
            return;
          }
        }
      } catch (apiError) {
        console.warn('Cost summary API not available yet, using defaults');
      }
      
      // Fallback: Set cost summary to zero for new users (no mock data)
      setCostSummary({
        totalCost: 0,
        basicProcessingCount: 0,
        premiumProcessingCount: 0,
        averageCostPerDocument: 0,
        costByMode: {
          basic: { count: 0, totalCost: 0 },
          premium: { count: 0, totalCost: 0 }
        }
      });
    } catch (err) {
      console.error('Error loading cost summary:', err);
    }
  };

  const savePreferences = async (newPreferences: ProcessingPreferences) => {
    try {
      setLoading(true);
      
      // Save to localStorage for immediate UI update
      localStorage.setItem('processingPreferences', JSON.stringify(newPreferences));
      
      // Try to save to API
      try {
        const response = await fetch('/api/user/processing-preferences', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(newPreferences)
        });
        
        if (!response.ok && response.status !== 404) {
          console.warn('Failed to save preferences to server, using localStorage only');
        }
      } catch (apiError) {
        console.warn('Preferences API not available yet, using localStorage only');
      }

      setPreferences(newPreferences);
      setError(null);
    } catch (err) {
      setError('Failed to save preferences');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getProcessingModeForDocument = (
    fileName: string,
    fileType: string,
    fileSize: number
  ): 'basic' | 'premium' | 'auto' => {
    if (preferences.defaultMode !== 'auto') {
      return preferences.defaultMode;
    }

    // Auto-detection logic (should match backend logic)
    const complexKeywords = [
      'financial', 'report', 'statement', 'contract', 'legal',
      'spreadsheet', 'data', 'analysis', 'chart', 'graph', 'table'
    ];
    
    const hasComplexKeyword = complexKeywords.some(keyword => 
      fileName.toLowerCase().includes(keyword)
    );

    const premiumBenefitTypes = [
      'image/', // OCR needed
      'vnd.ms-excel', // Complex tables
      'vnd.ms-powerpoint' // Charts and diagrams
    ];

    const benefitsFromPremium = premiumBenefitTypes.some(type => 
      fileType.includes(type)
    );

    const isLargeFile = fileSize > 20 * 1024 * 1024; // 20MB

    return (hasComplexKeyword || benefitsFromPremium || isLargeFile) ? 'premium' : 'basic';
  };

  const shouldAutoUpgrade = (costEstimate: number): boolean => {
    if (!preferences.autoUpgradeEnabled) {
      return false;
    }

    const currentMonthCost = costSummary?.totalCost || 0;
    return (currentMonthCost + costEstimate) <= preferences.costLimit;
  };

  return {
    preferences,
    costSummary,
    loading,
    error,
    savePreferences,
    loadCostSummary,
    getProcessingModeForDocument,
    shouldAutoUpgrade
  };
}