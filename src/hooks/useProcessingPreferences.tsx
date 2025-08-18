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

      // TODO: Load from API when backend preferences endpoint is available
      // const response = await fetch('/api/user/processing-preferences');
      // if (response.ok) {
      //   const data = await response.json();
      //   setPreferences(data.preferences);
      // }
    } catch (err) {
      setError('Failed to load preferences');
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCostSummary = async () => {
    try {
      // TODO: Implement API call when cost analytics endpoint is available
      // const response = await fetch('/api/documents/analytics/costs');
      // if (response.ok) {
      //   const data = await response.json();
      //   setCostSummary(data.costSummary);
      // }
      
      // Mock data for now
      setCostSummary({
        totalCost: 2.45,
        basicProcessingCount: 23,
        premiumProcessingCount: 4,
        averageCostPerDocument: 0.091,
        costByMode: {
          basic: { count: 23, totalCost: 0 },
          premium: { count: 4, totalCost: 2.45 }
        }
      });
    } catch (err) {
      console.error('Error loading cost summary:', err);
    }
  };

  const savePreferences = async (newPreferences: ProcessingPreferences) => {
    try {
      setLoading(true);
      
      // Save to localStorage
      localStorage.setItem('processingPreferences', JSON.stringify(newPreferences));
      
      // TODO: Save to API when backend endpoint is available
      // const response = await fetch('/api/user/processing-preferences', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(newPreferences)
      // });
      // 
      // if (!response.ok) {
      //   throw new Error('Failed to save preferences');
      // }

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