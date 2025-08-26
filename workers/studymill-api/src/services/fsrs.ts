// FSRS v4-style scheduler (retention- and difficulty-aware)
// Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy (Anki scale)
// State fields: stability (days), difficulty (1..10), reps (count), lastReviewedAt

export type FSRSState = {
  stability: number; // days (S)
  difficulty: number; // 1 (easy) .. 10 (hard)
  reps: number;       // number of reviews
  lastReviewedAt?: string; // ISO
};

export type FSRSUpdateInput = {
  state?: Partial<FSRSState> | null;
  rating: 1 | 2 | 3 | 4;
  now?: Date;
};

export type FSRSUpdateOutput = {
  nextReview: string; // ISO timestamp
  state: FSRSState;
};

// Parameters for the scheduler. These are reasonable defaults
// chosen to mimic FSRS v4 dynamics without model fitting.
const PARAMS = {
  targetRetention: 0.9, // desired recall probability at review time
  minStabilityDays: 0.25, // ~6 hours
  // Growth amplitudes per rating (how fast stability grows when recalled)
  growthA: { 2: 0.55, 3: 1.1, 4: 1.35 } as Record<2|3|4, number>,
  // Curvature for retention effect
  growthB: { 2: 0.9, 3: 1.05, 4: 1.1 } as Record<2|3|4, number>,
  // Difficulty adjustments (lower difficulty => slightly faster growth)
  difficultyGrowthSlope: 0.06,
  // Difficulty deltas
  diffBase: { 1: +0.50, 2: +0.15, 3: -0.05, 4: -0.25 } as Record<1|2|3|4, number>,
  diffRetentionSlope: { 1: +0.50, 2: +0.20, 3: -0.10, 4: -0.20 } as Record<1|2|3|4, number>,
  // Relapse multiplier for rating=1 (Again)
  lapseMultiplier: 0.2,
  // New card seeding (first successful recall)
  initialStability: { 1: 0.25, 2: 0.5, 3: 1.5, 4: 3.5 } as Record<1|2|3|4, number>,
  // Learning step next-intervals for brand-new cards
  newIntervals: {
    1: { minutes: 5 },
    2: { hours: 8 },
    3: { days: 1 },
    4: { days: 3 },
  } as const,
};

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;

export function updateFsrsState(input: FSRSUpdateInput): FSRSUpdateOutput {
  const now = input.now || new Date();

  const prev: FSRSState = {
    stability: Math.max(PARAMS.minStabilityDays, input.state?.stability ?? 0),
    difficulty: clamp(input.state?.difficulty ?? 5, MIN_DIFFICULTY, MAX_DIFFICULTY),
    reps: Math.max(0, input.state?.reps ?? 0),
    lastReviewedAt: input.state?.lastReviewedAt,
  };

  const rating = input.rating;
  const isNew = prev.reps === 0 || !prev.lastReviewedAt || prev.stability <= PARAMS.minStabilityDays + 1e-6;

  // Compute retrievability based on elapsed time and stability
  const elapsedDays = prev.lastReviewedAt ? daysBetween(new Date(prev.lastReviewedAt), now) : 0;
  const R = retrievability(elapsedDays, prev.stability, PARAMS.targetRetention);

  // Update difficulty (bounded)
  const diffDelta = PARAMS.diffBase[rating] + PARAMS.diffRetentionSlope[rating] * (1 - R);
  let nextDifficulty = clamp(prev.difficulty + diffDelta, MIN_DIFFICULTY, MAX_DIFFICULTY);

  // Update stability
  let nextStability: number;
  if (rating === 1) {
    // Lapse: reduce stability sharply; schedule a quick retry
    nextStability = Math.max(PARAMS.minStabilityDays, prev.stability * (PARAMS.lapseMultiplier * (0.5 + 0.5 * R)));

    const next = addInterval(now, PARAMS.newIntervals[1]);
    return {
      nextReview: next.toISOString(),
      state: { stability: nextStability, difficulty: nextDifficulty, reps: prev.reps + 1, lastReviewedAt: now.toISOString() }
    };
  }

  if (isNew) {
    // Seed new card
    nextStability = PARAMS.initialStability[rating];
  } else {
    // Recall: grow stability as a function of retention and difficulty
    const A = PARAMS.growthA[rating as 2|3|4];
    const B = PARAMS.growthB[rating as 2|3|4];
    const diffAdj = 1 + (4 - nextDifficulty) * PARAMS.difficultyGrowthSlope; // easier => >1
    // Increase factor rises as R goes down (i.e., it was harder/longer)
    const increase = 1 + A * Math.pow(1 - R, B);
    nextStability = Math.max(PARAMS.minStabilityDays, prev.stability * increase * diffAdj);
  }

  // Next review time uses stability (days) for recalled cards; for brand-new we use seeding
  const nextDate = isNew && rating !== 1 ? addInterval(now, PARAMS.newIntervals[rating]) : addDays(now, nextStability);

  return {
    nextReview: nextDate.toISOString(),
    state: {
      stability: nextStability,
      difficulty: nextDifficulty,
      reps: prev.reps + 1,
      lastReviewedAt: now.toISOString()
    }
  };
}

function retrievability(elapsedDays: number, stability: number, targetRetention: number) {
  if (stability <= 0) return 1; // treat as fresh
  // Exponential decay to targetRetention at t=stability
  // R(t) = targetRetention^(t / stability)
  const base = Math.max(1e-6, targetRetention);
  return Math.pow(base, elapsedDays / stability);
}

function daysBetween(a: Date, b: Date) { return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)); }
function clamp(x: number, min: number, max: number) { return Math.max(min, Math.min(max, x)); }
function addInterval(d: Date, ivl: { minutes?: number; hours?: number; days?: number }) {
  const x = new Date(d);
  if (ivl.minutes) x.setMinutes(x.getMinutes() + ivl.minutes);
  if (ivl.hours) x.setHours(x.getHours() + ivl.hours);
  if (ivl.days) x.setDate(x.getDate() + ivl.days);
  return x;
}
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + Math.max(0, Math.floor(days))); return x; }

