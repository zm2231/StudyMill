#!/usr/bin/env node

// Simple test script for FSRS scheduling logic
import { updateFsrsState } from './fsrs.ts';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testNewCards() {
  console.log('\n🧪 Testing new cards...');
  
  // Test rating=1 (Again)
  const againResult = updateFsrsState({
    state: { stability: 0, difficulty: 5, reps: 0 },
    rating: 1,
    now: new Date('2024-01-01T12:00:00Z')
  });
  
  const againNext = new Date(againResult.nextReview);
  const againDiffMinutes = (againNext.getTime() - new Date('2024-01-01T12:00:00Z').getTime()) / (1000 * 60);
  assert(againDiffMinutes >= 4 && againDiffMinutes <= 6, `Again should schedule ~5 minutes later, got ${againDiffMinutes}`);
  assert(againResult.state.difficulty > 5, 'Difficulty should increase for Again');
  console.log('✅ Rating 1 (Again) works correctly');
  
  // Test rating=3 (Good)
  const goodResult = updateFsrsState({
    state: { stability: 0, difficulty: 5, reps: 0 },
    rating: 3,
    now: new Date('2024-01-01T12:00:00Z')
  });
  
  const goodNext = new Date(goodResult.nextReview);
  const goodDiffDays = (goodNext.getTime() - new Date('2024-01-01T12:00:00Z').getTime()) / (1000 * 60 * 60 * 24);
  assert(goodDiffDays >= 0.8 && goodDiffDays <= 1.2, `Good should schedule ~1 day later, got ${goodDiffDays}`);
  assert(goodResult.state.difficulty < 5, 'Difficulty should decrease for Good');
  console.log('✅ Rating 3 (Good) works correctly');
}

function testReviewCards() {
  console.log('\n🧪 Testing review cards...');
  
  // Test stability growth
  const growthResult = updateFsrsState({
    state: { 
      stability: 2, 
      difficulty: 5, 
      reps: 3,
      lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
    },
    rating: 3,
    now: new Date('2024-01-03T12:00:00Z') // 2 days later
  });
  
  assert(growthResult.state.stability > 2, `Stability should grow from 2, got ${growthResult.state.stability}`);
  assert(growthResult.state.reps === 4, 'Reps should increment');
  console.log('✅ Stability growth works correctly');
  
  // Test lapse
  const lapseResult = updateFsrsState({
    state: { 
      stability: 10, 
      difficulty: 5, 
      reps: 5,
      lastReviewedAt: new Date('2024-01-01T12:00:00Z').toISOString()
    },
    rating: 1,
    now: new Date('2024-01-11T12:00:00Z')
  });
  
  assert(lapseResult.state.stability < 10, `Stability should reduce from 10, got ${lapseResult.state.stability}`);
  assert(lapseResult.state.difficulty > 5, 'Difficulty should increase on lapse');
  console.log('✅ Lapse handling works correctly');
}

function testDifficultyBounds() {
  console.log('\n🧪 Testing difficulty bounds...');
  
  // Test max bound
  const maxResult = updateFsrsState({
    state: { stability: 1, difficulty: 9.8, reps: 10 },
    rating: 1,
    now: new Date('2024-01-01T12:00:00Z')
  });
  assert(maxResult.state.difficulty <= 10, `Difficulty should not exceed 10, got ${maxResult.state.difficulty}`);
  console.log('✅ Maximum difficulty bound works');
  
  // Test min bound
  const minResult = updateFsrsState({
    state: { stability: 100, difficulty: 1.2, reps: 10 },
    rating: 4,
    now: new Date('2024-01-01T12:00:00Z')
  });
  assert(minResult.state.difficulty >= 1, `Difficulty should not go below 1, got ${minResult.state.difficulty}`);
  console.log('✅ Minimum difficulty bound works');
}

function runTests() {
  console.log('🚀 Running FSRS v4 tests...');
  
  try {
    testNewCards();
    testReviewCards();
    testDifficultyBounds();
    
    console.log('\n✨ All tests passed! FSRS v4 scheduling is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
