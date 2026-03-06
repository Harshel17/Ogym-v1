import { db } from '../db';
import { 
  workoutCompletions, workoutSessions, foodLogs, healthData, 
  userGoals, bodyMeasurements, dailyDisciplineScores, dikaInsights,
  workoutItems, workoutCycles
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface WorkoutPatterns {
  daysLast7: number;
  daysLast14: number;
  daysLast30: number;
  weeklyTarget: number | null;
  adherenceRate7d: number;
  adherenceRate14d: number;
  muscleGroupsHit: Record<string, number>;
  muscleGroupsMissed: string[];
  streak: number;
  avgExercisesPerSession: number;
  preferredDays: string[];
  missedDays: string[];
  trend: 'improving' | 'declining' | 'stable';
}

export interface NutritionTrends {
  avgCalories7d: number;
  avgProtein7d: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
  daysHittingCalories7d: number;
  daysHittingProtein7d: number;
  daysLogged7d: number;
  commonMealGaps: string[];
  trend: 'improving' | 'declining' | 'stable';
}

export interface ActivityTrends {
  avgSteps7d: number;
  avgSteps14d: number;
  stepGoal: number;
  daysHittingGoal7d: number;
  trend: 'improving' | 'declining' | 'stable';
  mostActiveDay: string | null;
  leastActiveDay: string | null;
}

export interface RecoveryTrends {
  avgSleepHours7d: number;
  avgRestingHR7d: number | null;
  avgHRV7d: number | null;
  sleepGoalMinutes: number;
  daysGoodSleep7d: number;
  sleepTrend: 'improving' | 'declining' | 'stable';
  hrTrend: 'improving' | 'declining' | 'stable';
  concerns: string[];
}

export interface GoalAlignment {
  primaryGoal: string | null;
  customGoalText: string | null;
  alignmentScore: number;
  alignmentLabel: 'on_track' | 'partially_aligned' | 'off_track' | 'no_goal';
  gaps: string[];
  strengths: string[];
}

export interface Correlation {
  pattern: string;
  confidence: 'high' | 'medium';
  suggestion: string;
}

export interface MemberContextProfile {
  userId: number;
  generatedAt: Date;
  workout: WorkoutPatterns;
  nutrition: NutritionTrends;
  activity: ActivityTrends;
  recovery: RecoveryTrends;
  goalAlignment: GoalAlignment;
  overallAssessment: 'consistent' | 'improving' | 'declining' | 'sporadic' | 'new_user';
  correlations: Correlation[];
  insights: Array<{ key: string; value: string }>;
  summaryText: string;
}

const profileCache = new Map<number, { profile: MemberContextProfile; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function getDayOfWeek(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function detectTrend(recent: number[], older: number[]): 'improving' | 'declining' | 'stable' {
  if (recent.length === 0 || older.length === 0) return 'stable';
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  const threshold = olderAvg * 0.1 || 1;
  if (diff > threshold) return 'improving';
  if (diff < -threshold) return 'declining';
  return 'stable';
}

async function buildWorkoutPatterns(userId: number): Promise<WorkoutPatterns> {
  const today = getDateStr(0);
  const date7 = getDateStr(7);
  const date14 = getDateStr(14);
  const date30 = getDateStr(30);

  const completions30 = await db.select({
    date: workoutCompletions.completedDate,
    exerciseName: workoutCompletions.exerciseName,
    exerciseType: workoutCompletions.exerciseType,
  })
    .from(workoutCompletions)
    .where(and(
      eq(workoutCompletions.memberId, userId),
      gte(workoutCompletions.completedDate, date30),
      lte(workoutCompletions.completedDate, today)
    ));

  const sessions30 = await db.select({
    date: workoutSessions.date,
    focusLabel: workoutSessions.focusLabel,
  })
    .from(workoutSessions)
    .where(and(
      eq(workoutSessions.memberId, userId),
      gte(workoutSessions.date, date30),
      lte(workoutSessions.date, today),
      eq(workoutSessions.isDeleted, false)
    ));

  const goals = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const weeklyTarget = goals[0]?.weeklyWorkoutDays || null;

  const uniqueDates30 = [...new Set(completions30.map(c => c.date))];
  const uniqueDates14 = uniqueDates30.filter(d => d >= date14);
  const uniqueDates7 = uniqueDates30.filter(d => d >= date7);

  const muscleGroupsHit: Record<string, number> = {};
  const sessionFocuses = sessions30.filter(s => s.focusLabel).map(s => s.focusLabel!.toLowerCase());
  for (const focus of sessionFocuses) {
    const parts = focus.split(/[+&,]/);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed) {
        muscleGroupsHit[trimmed] = (muscleGroupsHit[trimmed] || 0) + 1;
      }
    }
  }

  const allMuscleGroups = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'biceps', 'triceps'];
  const muscleGroupsMissed = allMuscleGroups.filter(mg => 
    !Object.keys(muscleGroupsHit).some(k => k.includes(mg))
  );

  const dayOfWeekCounts: Record<string, number> = {};
  const dayOfWeekMissed: Record<string, number> = {};
  for (const d of uniqueDates30) {
    const dow = getDayOfWeek(d);
    dayOfWeekCounts[dow] = (dayOfWeekCounts[dow] || 0) + 1;
  }
  const preferredDays = Object.entries(dayOfWeekCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);

  let streak = 0;
  for (let i = 0; i <= 30; i++) {
    const d = getDateStr(i);
    if (uniqueDates30.includes(d)) {
      streak++;
    } else {
      if (i === 0) continue;
      break;
    }
  }

  const exercisesPerDay: Record<string, number> = {};
  for (const c of completions30) {
    exercisesPerDay[c.date] = (exercisesPerDay[c.date] || 0) + 1;
  }
  const exerciseCounts = Object.values(exercisesPerDay);
  const avgExercisesPerSession = exerciseCounts.length > 0 
    ? Math.round(exerciseCounts.reduce((a, b) => a + b, 0) / exerciseCounts.length * 10) / 10 
    : 0;

  const adherence7 = weeklyTarget ? Math.round((uniqueDates7.length / weeklyTarget) * 100) : 0;
  const adherence14 = weeklyTarget ? Math.round((uniqueDates14.length / (weeklyTarget * 2)) * 100) : 0;

  const recentWeekDays = uniqueDates7.length;
  const olderWeekDays = uniqueDates30.filter(d => d >= date14 && d < date7).length;
  const trend = recentWeekDays > olderWeekDays ? 'improving' : recentWeekDays < olderWeekDays ? 'declining' : 'stable';

  return {
    daysLast7: uniqueDates7.length,
    daysLast14: uniqueDates14.length,
    daysLast30: uniqueDates30.length,
    weeklyTarget,
    adherenceRate7d: adherence7,
    adherenceRate14d: adherence14,
    muscleGroupsHit,
    muscleGroupsMissed,
    streak,
    avgExercisesPerSession,
    preferredDays,
    missedDays: [],
    trend,
  };
}

async function buildNutritionTrends(userId: number): Promise<NutritionTrends> {
  const today = getDateStr(0);
  const date7 = getDateStr(7);
  const date14 = getDateStr(14);

  const logs = await db.select({
    date: foodLogs.date,
    calories: foodLogs.calories,
    protein: foodLogs.protein,
    mealType: foodLogs.mealType,
  })
    .from(foodLogs)
    .where(and(
      eq(foodLogs.userId, userId),
      gte(foodLogs.date, date14),
      lte(foodLogs.date, today)
    ));

  const goals = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const calorieTarget = goals[0]?.dailyCalorieTarget || null;
  const proteinTarget = goals[0]?.dailyProteinTarget || null;

  const dailyTotals: Record<string, { calories: number; protein: number; meals: Set<string> }> = {};
  for (const log of logs) {
    if (!dailyTotals[log.date]) {
      dailyTotals[log.date] = { calories: 0, protein: 0, meals: new Set() };
    }
    dailyTotals[log.date].calories += log.calories || 0;
    dailyTotals[log.date].protein += log.protein || 0;
    dailyTotals[log.date].meals.add(log.mealType);
  }

  const last7Days = Object.entries(dailyTotals).filter(([d]) => d >= date7);
  const days8to14 = Object.entries(dailyTotals).filter(([d]) => d >= date14 && d < date7);

  const cal7 = last7Days.map(([, v]) => v.calories);
  const prot7 = last7Days.map(([, v]) => v.protein);
  const avgCalories7d = cal7.length > 0 ? Math.round(cal7.reduce((a, b) => a + b, 0) / cal7.length) : 0;
  const avgProtein7d = prot7.length > 0 ? Math.round(prot7.reduce((a, b) => a + b, 0) / prot7.length) : 0;

  const daysHittingCalories7d = calorieTarget 
    ? cal7.filter(c => c >= calorieTarget * 0.85 && c <= calorieTarget * 1.15).length 
    : 0;
  const daysHittingProtein7d = proteinTarget 
    ? prot7.filter(p => p >= proteinTarget * 0.85).length 
    : 0;

  const allMealTypes = ['breakfast', 'lunch', 'dinner'];
  const mealCoverage: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const [, v] of last7Days) {
    for (const mt of allMealTypes) {
      if (v.meals.has(mt)) mealCoverage[mt]++;
    }
  }
  const commonMealGaps = allMealTypes.filter(mt => 
    last7Days.length > 0 && mealCoverage[mt] < last7Days.length * 0.5
  );

  const recentCals = cal7;
  const olderCals = days8to14.map(([, v]) => v.calories);
  const trend = detectTrend(recentCals, olderCals);

  return {
    avgCalories7d,
    avgProtein7d,
    calorieTarget,
    proteinTarget,
    daysHittingCalories7d,
    daysHittingProtein7d,
    daysLogged7d: last7Days.length,
    commonMealGaps,
    trend,
  };
}

async function buildActivityTrends(userId: number): Promise<ActivityTrends> {
  const today = getDateStr(0);
  const date7 = getDateStr(7);
  const date14 = getDateStr(14);

  const health = await db.select({
    date: healthData.date,
    steps: healthData.steps,
  })
    .from(healthData)
    .where(and(
      eq(healthData.userId, userId),
      gte(healthData.date, date14),
      lte(healthData.date, today)
    ));

  const goals = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const stepGoal = goals[0]?.dailyStepGoal || 7000;

  const last7 = health.filter(h => h.date >= date7 && h.steps && h.steps > 0);
  const days8to14 = health.filter(h => h.date >= date14 && h.date < date7 && h.steps && h.steps > 0);

  const steps7 = last7.map(h => h.steps!);
  const steps14 = [...steps7, ...days8to14.map(h => h.steps!)];
  const avgSteps7d = steps7.length > 0 ? Math.round(steps7.reduce((a, b) => a + b, 0) / steps7.length) : 0;
  const avgSteps14d = steps14.length > 0 ? Math.round(steps14.reduce((a, b) => a + b, 0) / steps14.length) : 0;
  const daysHittingGoal7d = steps7.filter(s => s >= stepGoal).length;

  let mostActiveDay: string | null = null;
  let leastActiveDay: string | null = null;
  if (last7.length > 0) {
    const sorted = [...last7].sort((a, b) => (b.steps || 0) - (a.steps || 0));
    mostActiveDay = getDayOfWeek(sorted[0].date);
    leastActiveDay = getDayOfWeek(sorted[sorted.length - 1].date);
  }

  const trend = detectTrend(steps7, days8to14.map(h => h.steps!));

  return {
    avgSteps7d,
    avgSteps14d,
    stepGoal,
    daysHittingGoal7d,
    trend,
    mostActiveDay,
    leastActiveDay,
  };
}

async function buildRecoveryTrends(userId: number): Promise<RecoveryTrends> {
  const today = getDateStr(0);
  const date7 = getDateStr(7);
  const date14 = getDateStr(14);

  const health = await db.select({
    date: healthData.date,
    sleepMinutes: healthData.sleepMinutes,
    restingHeartRate: healthData.restingHeartRate,
    hrv: healthData.hrv,
  })
    .from(healthData)
    .where(and(
      eq(healthData.userId, userId),
      gte(healthData.date, date14),
      lte(healthData.date, today)
    ));

  const goals = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const sleepGoalMinutes = goals[0]?.dailySleepGoalMinutes || 480;

  const last7 = health.filter(h => h.date >= date7);
  const days8to14 = health.filter(h => h.date >= date14 && h.date < date7);

  const sleep7 = last7.filter(h => h.sleepMinutes && h.sleepMinutes > 0).map(h => h.sleepMinutes!);
  const avgSleepHours7d = sleep7.length > 0 
    ? Math.round(sleep7.reduce((a, b) => a + b, 0) / sleep7.length / 6) / 10 
    : 0;
  const daysGoodSleep7d = sleep7.filter(s => s >= sleepGoalMinutes * 0.85).length;

  const hr7 = last7.filter(h => h.restingHeartRate && h.restingHeartRate > 0).map(h => h.restingHeartRate!);
  const avgRestingHR7d = hr7.length > 0 ? Math.round(hr7.reduce((a, b) => a + b, 0) / hr7.length) : null;

  const hrv7 = last7.filter(h => h.hrv && h.hrv > 0).map(h => h.hrv!);
  const avgHRV7d = hrv7.length > 0 ? Math.round(hrv7.reduce((a, b) => a + b, 0) / hrv7.length) : null;

  const sleepOlder = days8to14.filter(h => h.sleepMinutes && h.sleepMinutes > 0).map(h => h.sleepMinutes!);
  const sleepTrend = detectTrend(sleep7, sleepOlder);

  const hrOlder = days8to14.filter(h => h.restingHeartRate && h.restingHeartRate > 0).map(h => h.restingHeartRate!);
  const hrTrend = detectTrend(
    hr7.map(v => -v),
    hrOlder.map(v => -v)
  );

  const concerns: string[] = [];
  if (avgSleepHours7d > 0 && avgSleepHours7d < 6) {
    concerns.push('Sleep consistently under 6 hours');
  }
  if (sleepTrend === 'declining') {
    concerns.push('Sleep quality declining over the past week');
  }
  if (avgRestingHR7d && avgRestingHR7d > 80) {
    concerns.push('Resting heart rate elevated above 80 bpm');
  }
  if (hrTrend === 'declining') {
    concerns.push('Resting heart rate trending higher');
  }
  if (daysGoodSleep7d <= 2 && sleep7.length >= 3) {
    concerns.push('Rarely meeting sleep target');
  }

  return {
    avgSleepHours7d,
    avgRestingHR7d,
    avgHRV7d,
    sleepGoalMinutes,
    daysGoodSleep7d,
    sleepTrend,
    hrTrend,
    concerns,
  };
}

function buildGoalAlignment(
  workout: WorkoutPatterns, 
  nutrition: NutritionTrends, 
  activity: ActivityTrends,
  recovery: RecoveryTrends,
  primaryGoal: string | null,
  customGoalText: string | null
): GoalAlignment {
  if (!primaryGoal) {
    return {
      primaryGoal: null,
      customGoalText,
      alignmentScore: 0,
      alignmentLabel: 'no_goal',
      gaps: ['No primary goal set'],
      strengths: [],
    };
  }

  const gaps: string[] = [];
  const strengths: string[] = [];
  let score = 50;

  if (workout.weeklyTarget) {
    if (workout.adherenceRate7d >= 85) {
      strengths.push('Hitting workout target');
      score += 15;
    } else if (workout.adherenceRate7d < 50) {
      gaps.push(`Only ${workout.daysLast7}/${workout.weeklyTarget} workouts this week`);
      score -= 15;
    }
  }

  if (primaryGoal === 'lose_fat' || primaryGoal === 'maintain') {
    if (nutrition.calorieTarget && nutrition.avgCalories7d > 0) {
      if (nutrition.avgCalories7d <= nutrition.calorieTarget * 1.1) {
        strengths.push('Calories within target');
        score += 10;
      } else {
        gaps.push('Calories exceeding target');
        score -= 10;
      }
    }
    if (activity.avgSteps7d >= activity.stepGoal) {
      strengths.push('Hitting step goal');
      score += 10;
    } else if (activity.avgSteps7d < activity.stepGoal * 0.5) {
      gaps.push('Steps well below target');
      score -= 10;
    }
  }

  if (primaryGoal === 'build_muscle') {
    if (nutrition.proteinTarget && nutrition.avgProtein7d >= nutrition.proteinTarget * 0.85) {
      strengths.push('Protein intake on target');
      score += 15;
    } else if (nutrition.proteinTarget && nutrition.avgProtein7d > 0) {
      gaps.push('Protein intake below target');
      score -= 10;
    }
    if (workout.daysLast7 >= 4) {
      strengths.push('Strong training frequency');
      score += 10;
    }
  }

  if (primaryGoal === 'improve_endurance') {
    if (activity.avgSteps7d >= activity.stepGoal) {
      strengths.push('Active lifestyle supports endurance');
      score += 10;
    }
  }

  if (recovery.concerns.length >= 2) {
    gaps.push('Recovery needs attention');
    score -= 10;
  } else if (recovery.avgSleepHours7d >= 7) {
    strengths.push('Good sleep supports recovery');
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));
  const alignmentLabel = score >= 70 ? 'on_track' : score >= 40 ? 'partially_aligned' : 'off_track';

  return { primaryGoal, customGoalText, alignmentScore: score, alignmentLabel, gaps, strengths };
}

export function detectCorrelations(
  workout: WorkoutPatterns,
  nutrition: NutritionTrends,
  activity: ActivityTrends,
  recovery: RecoveryTrends,
  dailyScores: Array<{ date: string; score: number; workoutScore: number; sleepMinutes?: number; steps?: number; protein?: number }>
): Correlation[] {
  const correlations: Correlation[] = [];

  if (recovery.avgSleepHours7d > 0 && recovery.avgSleepHours7d < 6 && workout.trend === 'declining') {
    correlations.push({
      pattern: 'Low sleep may be affecting workout performance',
      confidence: 'high',
      suggestion: 'Try to get at least 7 hours of sleep — your workout consistency tends to drop with less sleep',
    });
  }

  if (dailyScores.length >= 7) {
    const lowSleepDays = dailyScores.filter(d => d.sleepMinutes && d.sleepMinutes < 360);
    const goodSleepDays = dailyScores.filter(d => d.sleepMinutes && d.sleepMinutes >= 420);
    if (lowSleepDays.length >= 2 && goodSleepDays.length >= 2) {
      const avgScoreLowSleep = lowSleepDays.reduce((s, d) => s + d.workoutScore, 0) / lowSleepDays.length;
      const avgScoreGoodSleep = goodSleepDays.reduce((s, d) => s + d.workoutScore, 0) / goodSleepDays.length;
      if (avgScoreGoodSleep - avgScoreLowSleep > 15) {
        correlations.push({
          pattern: `Workout scores average ${Math.round(avgScoreGoodSleep)} with good sleep vs ${Math.round(avgScoreLowSleep)} with poor sleep`,
          confidence: 'high',
          suggestion: 'Your performance clearly benefits from quality sleep — prioritize rest on heavy training days',
        });
      }
    }
  }

  if (workout.daysLast7 >= 6) {
    correlations.push({
      pattern: `${workout.daysLast7} workouts in the last 7 days with limited rest`,
      confidence: workout.daysLast7 >= 7 ? 'high' : 'medium',
      suggestion: 'Your body needs rest days to recover and grow stronger. Consider taking 1-2 rest days per week',
    });
  }

  if (nutrition.proteinTarget && nutrition.avgProtein7d < nutrition.proteinTarget * 0.7 && nutrition.avgProtein7d > 0) {
    correlations.push({
      pattern: `Protein averaging ${nutrition.avgProtein7d}g vs ${nutrition.proteinTarget}g target (${Math.round(nutrition.avgProtein7d / nutrition.proteinTarget * 100)}%)`,
      confidence: 'high',
      suggestion: 'Consistently low protein can slow muscle recovery. Try adding a protein source to each meal',
    });
  }

  if (activity.trend === 'declining' && activity.avgSteps7d < activity.avgSteps14d * 0.7) {
    correlations.push({
      pattern: `Step count dropped from ${activity.avgSteps14d} avg to ${activity.avgSteps7d} avg over the past week`,
      confidence: 'medium',
      suggestion: 'Your daily activity has been declining. Even a short 15-minute walk can help maintain your baseline',
    });
  }

  if (workout.preferredDays.length > 0 && workout.daysLast30 >= 8) {
    const daysList = workout.preferredDays.slice(0, 2).join(' and ');
    correlations.push({
      pattern: `You tend to work out most on ${daysList}`,
      confidence: 'medium',
      suggestion: `Your strongest workout days are ${daysList} — try to build your schedule around these`,
    });
  }

  if (nutrition.commonMealGaps.length > 0) {
    const gapsList = nutrition.commonMealGaps.join(', ');
    correlations.push({
      pattern: `Often missing ${gapsList}`,
      confidence: 'medium',
      suggestion: `Tracking all meals helps maintain consistent energy. Try logging ${nutrition.commonMealGaps[0]} even if it's small`,
    });
  }

  if (recovery.concerns.length >= 2) {
    correlations.push({
      pattern: 'Multiple recovery concerns detected',
      confidence: 'high',
      suggestion: 'Both sleep and heart rate indicators suggest you may need more recovery. Consider a lighter training week',
    });
  }

  return correlations;
}

function generateSummaryText(profile: MemberContextProfile): string {
  const parts: string[] = [];

  const { workout, nutrition, activity, recovery, goalAlignment, overallAssessment } = profile;

  switch (overallAssessment) {
    case 'consistent':
      parts.push('Overall showing strong consistency across tracking.');
      break;
    case 'improving':
      parts.push('Trending upward — recent activity has been better than the previous week.');
      break;
    case 'declining':
      parts.push('Recent activity has been lower compared to the previous week.');
      break;
    case 'sporadic':
      parts.push('Activity patterns have been inconsistent — some strong days mixed with gaps.');
      break;
    case 'new_user':
      parts.push('Still building tracking history — keep going to unlock deeper insights.');
      break;
  }

  if (workout.weeklyTarget) {
    parts.push(`Workouts: ${workout.daysLast7}/${workout.weeklyTarget} this week (${workout.adherenceRate7d}% adherence).`);
  } else {
    parts.push(`Workouts: ${workout.daysLast7} sessions in the last 7 days.`);
  }
  if (workout.streak >= 3) {
    parts.push(`On a ${workout.streak}-day workout streak.`);
  }
  if (workout.muscleGroupsMissed.length > 0 && workout.daysLast14 >= 4) {
    parts.push(`Muscle groups not trained recently: ${workout.muscleGroupsMissed.slice(0, 3).join(', ')}.`);
  }

  if (nutrition.daysLogged7d > 0) {
    parts.push(`Nutrition: Logged ${nutrition.daysLogged7d}/7 days. Avg ${nutrition.avgCalories7d} cal, ${nutrition.avgProtein7d}g protein.`);
    if (nutrition.proteinTarget && nutrition.daysHittingProtein7d < 3 && nutrition.daysLogged7d >= 3) {
      parts.push(`Protein target hit only ${nutrition.daysHittingProtein7d} days this week.`);
    }
  } else {
    parts.push('No nutrition data logged in the past week.');
  }

  if (activity.avgSteps7d > 0) {
    parts.push(`Activity: Averaging ${activity.avgSteps7d} steps/day (goal: ${activity.stepGoal}). ${activity.daysHittingGoal7d}/7 days hitting target.`);
  }

  if (recovery.avgSleepHours7d > 0) {
    parts.push(`Recovery: Averaging ${recovery.avgSleepHours7d}h sleep.`);
    if (recovery.concerns.length > 0) {
      parts.push(`Concerns: ${recovery.concerns[0]}.`);
    }
  }

  if (goalAlignment.alignmentLabel !== 'no_goal') {
    if (goalAlignment.strengths.length > 0) {
      parts.push(`Strengths: ${goalAlignment.strengths.join(', ')}.`);
    }
    if (goalAlignment.gaps.length > 0) {
      parts.push(`Areas to improve: ${goalAlignment.gaps.join(', ')}.`);
    }
  }

  return parts.join(' ');
}

export async function buildMemberContextProfile(userId: number, forceRefresh = false): Promise<MemberContextProfile> {
  if (!forceRefresh) {
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.profile;
    }
  }

  const [workout, nutrition, activity, recovery] = await Promise.all([
    buildWorkoutPatterns(userId),
    buildNutritionTrends(userId),
    buildActivityTrends(userId),
    buildRecoveryTrends(userId),
  ]);

  const goals = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const primaryGoal = goals[0]?.primaryGoal || null;
  const customGoalText = goals[0]?.customGoalText || null;

  const goalAlignment = buildGoalAlignment(workout, nutrition, activity, recovery, primaryGoal, customGoalText);

  const date14 = getDateStr(14);
  const today = getDateStr(0);
  const scores = await db.select({
    date: dailyDisciplineScores.date,
    score: dailyDisciplineScores.score,
    workoutScore: dailyDisciplineScores.workoutScore,
  })
    .from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, date14),
      lte(dailyDisciplineScores.date, today)
    ))
    .orderBy(desc(dailyDisciplineScores.date));

  const healthLast14 = await db.select({
    date: healthData.date,
    sleepMinutes: healthData.sleepMinutes,
    steps: healthData.steps,
  })
    .from(healthData)
    .where(and(
      eq(healthData.userId, userId),
      gte(healthData.date, date14),
      lte(healthData.date, today)
    ));

  const nutritionLast14 = await db.select({
    date: foodLogs.date,
    protein: foodLogs.protein,
  })
    .from(foodLogs)
    .where(and(
      eq(foodLogs.userId, userId),
      gte(foodLogs.date, date14),
      lte(foodLogs.date, today)
    ));

  const proteinByDate: Record<string, number> = {};
  for (const n of nutritionLast14) {
    proteinByDate[n.date] = (proteinByDate[n.date] || 0) + (n.protein || 0);
  }

  const enrichedScores = scores.map(s => {
    const h = healthLast14.find(hd => hd.date === s.date);
    return {
      ...s,
      sleepMinutes: h?.sleepMinutes || undefined,
      steps: h?.steps || undefined,
      protein: proteinByDate[s.date] || undefined,
    };
  });

  const correlations = detectCorrelations(workout, nutrition, activity, recovery, enrichedScores);

  const savedInsights = await db.select({
    key: dikaInsights.insightKey,
    value: dikaInsights.insightValue,
  })
    .from(dikaInsights)
    .where(eq(dikaInsights.userId, userId));

  let overallAssessment: MemberContextProfile['overallAssessment'] = 'new_user';
  const totalDataPoints = workout.daysLast14 + nutrition.daysLogged7d + (activity.avgSteps7d > 0 ? 1 : 0);
  if (totalDataPoints < 3) {
    overallAssessment = 'new_user';
  } else {
    const trends = [workout.trend, nutrition.trend, activity.trend];
    const improvingCount = trends.filter(t => t === 'improving').length;
    const decliningCount = trends.filter(t => t === 'declining').length;

    if (improvingCount >= 2) overallAssessment = 'improving';
    else if (decliningCount >= 2) overallAssessment = 'declining';
    else if (workout.adherenceRate7d >= 70 && nutrition.daysLogged7d >= 5) overallAssessment = 'consistent';
    else overallAssessment = 'sporadic';
  }

  const profile: MemberContextProfile = {
    userId,
    generatedAt: new Date(),
    workout,
    nutrition,
    activity,
    recovery,
    goalAlignment,
    overallAssessment,
    correlations,
    insights: savedInsights,
    summaryText: '',
  };

  profile.summaryText = generateSummaryText(profile);

  profileCache.set(userId, { profile, cachedAt: Date.now() });
  return profile;
}

export function invalidateContextCache(userId: number): void {
  profileCache.delete(userId);
}
