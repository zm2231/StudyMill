/**
 * Grade calculation utilities for StudyMill
 * Handles weighted grade calculations, projections, and what-if scenarios
 */

export interface GradeWeight {
  name: string;
  weight_pct: number; // Decimal (0.20 = 20%)
}

export interface GradeEntry {
  category: string;
  points_earned: number;
  points_possible: number;
  date?: string;
}

export interface CategoryStats {
  category: string;
  weight: number;
  earnedPoints: number;
  possiblePoints: number;
  percentage: number;
  weightedScore: number;
  entriesCount: number;
}

export interface GradeCalculation {
  currentGrade: number;
  earnedWeightPercentage: number; // How much of total weight has been earned
  categoryStats: CategoryStats[];
  letterGrade: string;
}

/**
 * Calculate overall grade with weighted categories
 */
export function calculateWeightedGrade(
  entries: GradeEntry[],
  weights: GradeWeight[]
): GradeCalculation {
  const categoryStats: CategoryStats[] = [];
  let totalWeightedScore = 0;
  let totalWeightUsed = 0;

  // Calculate stats for each category
  weights.forEach(weight => {
    const categoryEntries = entries.filter(e => e.category === weight.name);
    
    const earnedPoints = categoryEntries.reduce((sum, e) => sum + e.points_earned, 0);
    const possiblePoints = categoryEntries.reduce((sum, e) => sum + e.points_possible, 0);
    
    let percentage = 0;
    let weightedScore = 0;
    
    if (possiblePoints > 0) {
      percentage = (earnedPoints / possiblePoints) * 100;
      weightedScore = percentage * weight.weight_pct;
      totalWeightedScore += weightedScore;
      totalWeightUsed += weight.weight_pct;
    }

    categoryStats.push({
      category: weight.name,
      weight: weight.weight_pct,
      earnedPoints,
      possiblePoints,
      percentage,
      weightedScore,
      entriesCount: categoryEntries.length
    });
  });

  // Calculate final grade (normalize if not all weight is used)
  const currentGrade = totalWeightUsed > 0 
    ? totalWeightedScore / totalWeightUsed 
    : 0;

  return {
    currentGrade,
    earnedWeightPercentage: totalWeightUsed,
    categoryStats,
    letterGrade: getLetterGrade(currentGrade)
  };
}

/**
 * Convert percentage to letter grade
 */
export function getLetterGrade(percentage: number): string {
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}

/**
 * Get color for grade display
 */
export function getGradeColor(percentage: number): string {
  if (percentage >= 90) return 'green';
  if (percentage >= 80) return 'blue';
  if (percentage >= 70) return 'yellow';
  if (percentage >= 60) return 'orange';
  return 'red';
}

/**
 * Calculate GPA from letter grade
 */
export function getGPA(letterGrade: string): number {
  const gpaMap: Record<string, number> = {
    'A': 4.0,
    'A-': 3.7,
    'B+': 3.3,
    'B': 3.0,
    'B-': 2.7,
    'C+': 2.3,
    'C': 2.0,
    'C-': 1.7,
    'D+': 1.3,
    'D': 1.0,
    'D-': 0.7,
    'F': 0.0
  };
  return gpaMap[letterGrade] || 0.0;
}

/**
 * Calculate what scores are needed in remaining categories to achieve target grade
 */
export interface TargetCalculation {
  category: string;
  currentScore: number;
  remainingWeight: number;
  neededScore: number;
  isPossible: boolean;
}

export function calculateTargetRequirements(
  entries: GradeEntry[],
  weights: GradeWeight[],
  targetGrade: number
): TargetCalculation[] {
  const results: TargetCalculation[] = [];
  const calculation = calculateWeightedGrade(entries, weights);
  
  weights.forEach(weight => {
    const categoryStats = calculation.categoryStats.find(s => s.category === weight.name);
    
    if (!categoryStats) return;
    
    // Calculate remaining weight in this category
    // Assume we still have assignments worth the full weight if no entries yet
    const remainingWeight = categoryStats.entriesCount === 0 
      ? weight.weight_pct 
      : 0; // Or calculate based on syllabus if available
    
    if (remainingWeight > 0) {
      // Calculate what score is needed on remaining work
      const currentContribution = categoryStats.weightedScore;
      const neededContribution = (targetGrade * calculation.earnedWeightPercentage) - 
                                  (calculation.currentGrade * calculation.earnedWeightPercentage) + 
                                  currentContribution;
      const neededScore = (neededContribution / remainingWeight) * 100;
      
      results.push({
        category: weight.name,
        currentScore: categoryStats.percentage,
        remainingWeight,
        neededScore: Math.max(0, Math.min(100, neededScore)),
        isPossible: neededScore <= 100
      });
    }
  });
  
  return results;
}

/**
 * Project final grade based on current performance
 * Assumes remaining work will match current performance
 */
export function projectFinalGrade(
  entries: GradeEntry[],
  weights: GradeWeight[]
): number {
  const calculation = calculateWeightedGrade(entries, weights);
  
  // If all weight is used, return current grade
  if (calculation.earnedWeightPercentage >= 0.99) {
    return calculation.currentGrade;
  }
  
  // Project based on current performance
  // Assume student will maintain same performance on remaining work
  const projectedScore = calculation.currentGrade;
  
  return projectedScore;
}

/**
 * What-if scenario calculator
 * Add hypothetical grades and see the impact
 */
export function calculateWhatIf(
  currentEntries: GradeEntry[],
  hypotheticalEntries: GradeEntry[],
  weights: GradeWeight[]
): {
  currentGrade: number;
  whatIfGrade: number;
  gradeChange: number;
  newLetterGrade: string;
} {
  const current = calculateWeightedGrade(currentEntries, weights);
  const combined = calculateWeightedGrade(
    [...currentEntries, ...hypotheticalEntries],
    weights
  );
  
  return {
    currentGrade: current.currentGrade,
    whatIfGrade: combined.currentGrade,
    gradeChange: combined.currentGrade - current.currentGrade,
    newLetterGrade: combined.letterGrade
  };
}

/**
 * Find the minimum score needed on a specific assignment to maintain/achieve a grade
 */
export function calculateMinimumScore(
  currentEntries: GradeEntry[],
  weights: GradeWeight[],
  assignmentCategory: string,
  assignmentPoints: number,
  targetGrade: number
): number {
  const currentCalc = calculateWeightedGrade(currentEntries, weights);
  const weight = weights.find(w => w.name === assignmentCategory);
  
  if (!weight) return 100; // Category not found
  
  // Binary search for minimum score needed
  let low = 0;
  let high = assignmentPoints;
  let minScore = assignmentPoints;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testEntry: GradeEntry = {
      category: assignmentCategory,
      points_earned: mid,
      points_possible: assignmentPoints
    };
    
    const testCalc = calculateWeightedGrade(
      [...currentEntries, testEntry],
      weights
    );
    
    if (testCalc.currentGrade >= targetGrade) {
      minScore = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  
  return (minScore / assignmentPoints) * 100; // Return as percentage
}

/**
 * Statistics for grade distribution in a category
 */
export interface CategoryDistribution {
  category: string;
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
}

export function getCategoryStatistics(
  entries: GradeEntry[],
  category: string
): CategoryDistribution | null {
  const categoryEntries = entries.filter(e => e.category === category);
  
  if (categoryEntries.length === 0) return null;
  
  const scores = categoryEntries.map(e => (e.points_earned / e.points_possible) * 100);
  scores.sort((a, b) => a - b);
  
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const median = scores.length % 2 === 0
    ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
    : scores[Math.floor(scores.length / 2)];
  
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    category,
    mean,
    median,
    min: scores[0],
    max: scores[scores.length - 1],
    standardDeviation
  };
}