import { describe, it, expect } from 'vitest';
import { updateFsrsState, type FSRSUpdateInput } from './fsrs';

describe('FSRS v4 Scheduling', () => {
  describe('New Cards', () => {
    it('should handle first review with rating=1 (Again)', () => {
      const input: FSRSUpdateInput = {
        state: { stability: 0, difficulty: 5, reps: 0 },
        rating: 1,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const result = updateFsrsState(input);
      
      expect(result.state.reps).toBe(1);
      expect(result.state.difficulty).toBeGreaterThan(5); // Difficulty increases
      
      // Should schedule for ~5 minutes later
      const nextDate = new Date(result.nextReview);
      const diffMinutes = (nextDate.getTime() - input.now!.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeCloseTo(5, 0);
    });

    it('should handle first review with rating=3 (Good)', () => {
      const input: FSRSUpdateInput = {
        state: { stability: 0, difficulty: 5, reps: 0 },
        rating: 3,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const result = updateFsrsState(input);
      
      expect(result.state.reps).toBe(1);
      expect(result.state.difficulty).toBeLessThan(5); // Difficulty decreases slightly
      
      // Should schedule for ~1 day later
      const nextDate = new Date(result.nextReview);
      const diffDays = (nextDate.getTime() - input.now!.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(1, 0);
    });

    it('should handle first review with rating=4 (Easy)', () => {
      const input: FSRSUpdateInput = {
        state: { stability: 0, difficulty: 5, reps: 0 },
        rating: 4,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const result = updateFsrsState(input);
      
      expect(result.state.reps).toBe(1);
      expect(result.state.difficulty).toBeLessThan(5); // Difficulty decreases more
      
      // Should schedule for ~3 days later
      const nextDate = new Date(result.nextReview);
      const diffDays = (nextDate.getTime() - input.now!.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(3, 0);
    });
  });

  describe('Review Cards', () => {
    it('should grow stability on successful recall', () => {
      const input: FSRSUpdateInput = {
        state: { 
          stability: 2, 
          difficulty: 5, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 3,
        now: new Date('2024-01-03T12:00:00Z') // 2 days later, at stability
      };
      const result = updateFsrsState(input);
      
      expect(result.state.stability).toBeGreaterThan(2); // Stability should grow
      expect(result.state.reps).toBe(4);
    });

    it('should reduce stability on lapse (rating=1)', () => {
      const input: FSRSUpdateInput = {
        state: { 
          stability: 10, 
          difficulty: 5, 
          reps: 5,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 1,
        now: new Date('2024-01-11T12:00:00Z') // 10 days later
      };
      const result = updateFsrsState(input);
      
      expect(result.state.stability).toBeLessThan(10); // Stability should reduce significantly
      expect(result.state.difficulty).toBeGreaterThan(5); // Difficulty increases
      
      // Should schedule soon (minutes)
      const nextDate = new Date(result.nextReview);
      const diffMinutes = (nextDate.getTime() - input.now!.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThan(10);
    });

    it('should handle overdue cards appropriately', () => {
      const input: FSRSUpdateInput = {
        state: { 
          stability: 5, 
          difficulty: 5, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 3,
        now: new Date('2024-01-20T12:00:00Z') // 19 days later, way overdue
      };
      const result = updateFsrsState(input);
      
      // Stability should grow more because it was harder (lower retention)
      expect(result.state.stability).toBeGreaterThan(5);
    });

    it('should handle early reviews appropriately', () => {
      const input: FSRSUpdateInput = {
        state: { 
          stability: 10, 
          difficulty: 5, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 3,
        now: new Date('2024-01-02T12:00:00Z') // 1 day later, very early
      };
      const result = updateFsrsState(input);
      
      // Stability should grow less because it was easier (high retention)
      expect(result.state.stability).toBeGreaterThan(10);
      expect(result.state.stability).toBeLessThan(25); // But not too much
    });
  });

  describe('Difficulty Adjustments', () => {
    it('should increase difficulty more for cards that are hard to recall', () => {
      const input: FSRSUpdateInput = {
        state: { 
          stability: 5, 
          difficulty: 5, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 2, // Hard
        now: new Date('2024-01-10T12:00:00Z') // Overdue
      };
      const result = updateFsrsState(input);
      
      expect(result.state.difficulty).toBeGreaterThan(5);
    });

    it('should decrease difficulty for easy cards', () => {
      const input: FSRSUpdateInput = {
        state: { 
          stability: 5, 
          difficulty: 7, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 4, // Easy
        now: new Date('2024-01-03T12:00:00Z') // Early
      };
      const result = updateFsrsState(input);
      
      expect(result.state.difficulty).toBeLessThan(7);
    });

    it('should bound difficulty within min/max range', () => {
      // Test max bound
      const hardInput: FSRSUpdateInput = {
        state: { stability: 1, difficulty: 9.5, reps: 10 },
        rating: 1,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const hardResult = updateFsrsState(hardInput);
      expect(hardResult.state.difficulty).toBeLessThanOrEqual(10);
      
      // Test min bound
      const easyInput: FSRSUpdateInput = {
        state: { stability: 100, difficulty: 1.5, reps: 10 },
        rating: 4,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const easyResult = updateFsrsState(easyInput);
      expect(easyResult.state.difficulty).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing lastReviewedAt', () => {
      const input: FSRSUpdateInput = {
        state: { stability: 5, difficulty: 5, reps: 3 },
        rating: 3,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const result = updateFsrsState(input);
      
      expect(result.state.lastReviewedAt).toBeDefined();
      expect(result.nextReview).toBeDefined();
    });

    it('should handle null state', () => {
      const input: FSRSUpdateInput = {
        state: null,
        rating: 3,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const result = updateFsrsState(input);
      
      expect(result.state.reps).toBe(1);
      expect(result.state.stability).toBeGreaterThan(0);
      expect(result.nextReview).toBeDefined();
    });

    it('should handle partial state', () => {
      const input: FSRSUpdateInput = {
        state: { reps: 2 }, // Missing stability and difficulty
        rating: 3,
        now: new Date('2024-01-01T12:00:00Z')
      };
      const result = updateFsrsState(input);
      
      expect(result.state.stability).toBeGreaterThan(0);
      expect(result.state.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.state.difficulty).toBeLessThanOrEqual(10);
    });
  });

  describe('Retention-based Calculations', () => {
    it('should calculate appropriate intervals based on target retention', () => {
      // Card reviewed at optimal time should have moderate growth
      const optimalInput: FSRSUpdateInput = {
        state: { 
          stability: 7, 
          difficulty: 5, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 3,
        now: new Date('2024-01-08T12:00:00Z') // ~7 days, close to stability
      };
      const optimalResult = updateFsrsState(optimalInput);
      
      // Card reviewed very late should have larger growth
      const lateInput: FSRSUpdateInput = {
        state: { 
          stability: 7, 
          difficulty: 5, 
          reps: 3,
          lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        },
        rating: 3,
        now: new Date('2024-01-21T12:00:00Z') // 20 days, very late
      };
      const lateResult = updateFsrsState(lateInput);
      
      // Late review should result in larger stability increase
      expect(lateResult.state.stability).toBeGreaterThan(optimalResult.state.stability);
    });
  });
});
