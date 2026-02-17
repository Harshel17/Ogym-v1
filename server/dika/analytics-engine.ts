import { db } from "../db";
import {
  workoutCompletions,
  workoutItems,
  workoutCycles,
  workoutLogs,
  workoutLogExercises,
  workoutLogSets,
  foodLogs,
  waterLogs,
  calorieGoals,
  attendance,
  bodyMeasurements,
  healthData,
  matchLogs,
  memberSubscriptions,
  paymentTransactions,
  users,
  userProfiles,
  trainerMemberAssignments,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, inArray, count, not } from "drizzle-orm";

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function getWeekStart(weeksAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - weeksAgo * 7);
  return d.toISOString().split("T")[0];
}

function periodToDays(period: string): number {
  const match = period.match(/(\d+)[_\s-]?(day|week|month)s?/i);
  if (!match) return 28;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("day")) return num;
  if (unit.startsWith("week")) return num * 7;
  if (unit.startsWith("month")) return num * 30;
  return 28;
}

function periodToWeeks(period: string): number {
  return Math.max(1, Math.round(periodToDays(period) / 7));
}

function parseWeight(w: string | null | undefined): number | null {
  if (!w) return null;
  const num = parseFloat(w.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? null : num;
}

function computeTrend(values: number[]): "increasing" | "decreasing" | "flat" | "fluctuating" {
  if (values.length < 2) return "flat";
  let ups = 0, downs = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) ups++;
    else if (values[i] < values[i - 1]) downs++;
  }
  if (ups > downs * 2) return "increasing";
  if (downs > ups * 2) return "decreasing";
  if (ups > 0 && downs > 0) return "fluctuating";
  return "flat";
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export interface AnalyticsResult {
  type: string;
  data: any;
  summary: string;
}

// ============================================================
// 1. WORKOUT FREQUENCY TREND
// ============================================================
export async function workoutFrequencyTrend(userId: number, period: string = "8_weeks"): Promise<AnalyticsResult> {
  const weeks = periodToWeeks(period);
  const startDate = getDateNDaysAgo(weeks * 7);

  const completions = await db.select({
    date: workoutCompletions.completedDate,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, startDate)
  ));

  const weeklyMap: Record<string, Set<string>> = {};
  for (let i = 0; i < weeks; i++) {
    const wStart = getWeekStart(i);
    weeklyMap[wStart] = new Set();
  }

  for (const c of completions) {
    const d = new Date(c.date + "T00:00:00");
    const wStart = new Date(d);
    wStart.setDate(wStart.getDate() - wStart.getDay());
    const key = wStart.toISOString().split("T")[0];
    if (weeklyMap[key]) weeklyMap[key].add(c.date);
  }

  const weeklyData = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, dates]) => ({ week, count: dates.size }));

  const counts = weeklyData.map(w => w.count);
  const trend = computeTrend(counts);
  const avgPerWeek = counts.length > 0 ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0;
  const currentWeek = counts[counts.length - 1] || 0;
  const previousWeek = counts[counts.length - 2] || 0;
  const change = pctChange(currentWeek, previousWeek);

  return {
    type: "workout_frequency_trend",
    data: { weeklyData, trend, avgPerWeek, currentWeek, previousWeek, changePercent: change, totalWeeks: weeks },
    summary: `Workout frequency over ${weeks} weeks: avg ${avgPerWeek}/week, trend is ${trend}. This week: ${currentWeek}, last week: ${previousWeek} (${change > 0 ? "+" : ""}${change}%).`,
  };
}

// ============================================================
// 2. MUSCLE VOLUME ANALYSIS
// ============================================================
export async function muscleVolumeAnalysis(userId: number, period: string = "4_weeks", targetMuscle?: string): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);
  const weeks = Math.max(1, Math.round(days / 7));

  const completionsRaw = await db.select({
    date: workoutCompletions.completedDate,
    exerciseName: workoutCompletions.exerciseName,
    sets: workoutCompletions.actualSets,
    reps: workoutCompletions.actualReps,
    itemId: workoutCompletions.workoutItemId,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, startDate)
  ));

  const itemIds = Array.from(new Set(completionsRaw.filter(c => c.itemId).map(c => c.itemId!)));
  let muscleMap: Record<number, string> = {};
  if (itemIds.length > 0) {
    const items = await db.select({ id: workoutItems.id, muscleType: workoutItems.muscleType })
      .from(workoutItems)
      .where(inArray(workoutItems.id, itemIds));
    muscleMap = Object.fromEntries(items.map(i => [i.id, i.muscleType]));
  }

  const muscleVolumes: Record<string, { totalSets: number; totalReps: number; totalVolume: number; weeklyVolumes: Record<string, number> }> = {};

  for (const c of completionsRaw) {
    const muscle = (c.itemId && muscleMap[c.itemId]) || "Unknown";
    if (targetMuscle && muscle.toLowerCase() !== targetMuscle.toLowerCase()) continue;

    if (!muscleVolumes[muscle]) muscleVolumes[muscle] = { totalSets: 0, totalReps: 0, totalVolume: 0, weeklyVolumes: {} };

    const sets = c.sets || 1;
    const reps = c.reps || 1;
    const volume = sets * reps;
    muscleVolumes[muscle].totalSets += sets;
    muscleVolumes[muscle].totalReps += reps;
    muscleVolumes[muscle].totalVolume += volume;

    const d = new Date(c.date + "T00:00:00");
    const wStart = new Date(d);
    wStart.setDate(wStart.getDate() - wStart.getDay());
    const weekKey = wStart.toISOString().split("T")[0];
    muscleVolumes[muscle].weeklyVolumes[weekKey] = (muscleVolumes[muscle].weeklyVolumes[weekKey] || 0) + volume;
  }

  const muscles = Object.entries(muscleVolumes)
    .map(([muscle, data]) => {
      const weekVals = Object.entries(data.weeklyVolumes).sort(([a], [b]) => a.localeCompare(b));
      const volumes = weekVals.map(([, v]) => v);
      const trend = computeTrend(volumes);
      const firstHalf = volumes.slice(0, Math.ceil(volumes.length / 2));
      const secondHalf = volumes.slice(Math.ceil(volumes.length / 2));
      const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
      const changePct = pctChange(secondAvg, firstAvg);

      return {
        muscle,
        totalVolume: data.totalVolume,
        totalSets: data.totalSets,
        avgVolumePerWeek: Math.round(data.totalVolume / weeks),
        weeklyBreakdown: weekVals.map(([week, vol]) => ({ week, volume: vol })),
        trend,
        changePercent: changePct,
      };
    })
    .sort((a, b) => b.totalVolume - a.totalVolume);

  const mostTrained = muscles[0]?.muscle || "none";
  const leastTrained = muscles[muscles.length - 1]?.muscle || "none";
  const declining = muscles.filter(m => m.trend === "decreasing");

  return {
    type: "muscle_volume_analysis",
    data: { muscles, period: `${weeks} weeks`, totalMuscleGroups: muscles.length },
    summary: `Muscle volume over ${weeks} weeks: ${muscles.length} muscle groups trained. Most trained: ${mostTrained}. Least trained: ${leastTrained}. ${declining.length > 0 ? `Declining volume in: ${declining.map(d => `${d.muscle} (${d.changePercent}%)`).join(", ")}.` : "No declining muscle groups."}`,
  };
}

// ============================================================
// 3. STRENGTH PROGRESSION
// ============================================================
export async function strengthProgression(userId: number, exercise?: string, period: string = "3_months"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const query = db.select({
    date: workoutCompletions.completedDate,
    exerciseName: workoutCompletions.exerciseName,
    sets: workoutCompletions.actualSets,
    reps: workoutCompletions.actualReps,
    weight: workoutCompletions.actualWeight,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, startDate),
    sql`${workoutCompletions.exerciseType} = 'strength'`
  ))
  .orderBy(asc(workoutCompletions.completedDate));

  const completions = await query;

  const exerciseData: Record<string, Array<{ date: string; sets: number; reps: number; weight: number | null; volume: number }>> = {};

  for (const c of completions) {
    const name = c.exerciseName || "Unknown";
    if (exercise && !name.toLowerCase().includes(exercise.toLowerCase())) continue;

    if (!exerciseData[name]) exerciseData[name] = [];
    const w = parseWeight(c.weight);
    const sets = c.sets || 1;
    const reps = c.reps || 1;
    exerciseData[name].push({
      date: c.date,
      sets,
      reps,
      weight: w,
      volume: sets * reps * (w || 1),
    });
  }

  const progressions = Object.entries(exerciseData).map(([exName, entries]) => {
    const weightsOverTime = entries.filter(e => e.weight !== null).map(e => ({ date: e.date, weight: e.weight! }));
    const volumesOverTime = entries.map(e => ({ date: e.date, volume: e.volume }));
    const weights = weightsOverTime.map(w => w.weight);
    const volumes = volumesOverTime.map(v => v.volume);

    const firstWeight = weights[0] || 0;
    const lastWeight = weights[weights.length - 1] || 0;
    const weightChange = pctChange(lastWeight, firstWeight);

    const firstVolume = volumes[0] || 0;
    const lastVolume = volumes[volumes.length - 1] || 0;
    const volumeChange = pctChange(lastVolume, firstVolume);

    let personalBest: number | null = null;
    if (weights.length > 0) personalBest = Math.max(...weights);

    return {
      exercise: exName,
      sessions: entries.length,
      weightTrend: computeTrend(weights),
      volumeTrend: computeTrend(volumes),
      firstWeight,
      lastWeight,
      weightChangePercent: weightChange,
      volumeChangePercent: volumeChange,
      personalBest,
      history: entries.slice(-10),
    };
  }).sort((a, b) => b.sessions - a.sessions);

  const improving = progressions.filter(p => p.weightTrend === "increasing");
  const declining = progressions.filter(p => p.weightTrend === "decreasing");

  return {
    type: "strength_progression",
    data: { exercises: progressions.slice(0, 15), period: `${Math.round(days / 30)} months`, totalExercisesTracked: progressions.length },
    summary: `Strength data over ${Math.round(days / 30)} months across ${progressions.length} exercises. ${improving.length} exercises improving, ${declining.length} declining. ${progressions[0] ? `Top exercise: ${progressions[0].exercise} (${progressions[0].weightChangePercent > 0 ? "+" : ""}${progressions[0].weightChangePercent}% weight change).` : ""}`,
  };
}

// ============================================================
// 4. TRAINING LOAD TREND
// ============================================================
export async function trainingLoadTrend(userId: number, period: string = "8_weeks"): Promise<AnalyticsResult> {
  const weeks = periodToWeeks(period);
  const startDate = getDateNDaysAgo(weeks * 7);

  const completions = await db.select({
    date: workoutCompletions.completedDate,
    sets: workoutCompletions.actualSets,
    reps: workoutCompletions.actualReps,
    weight: workoutCompletions.actualWeight,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, startDate)
  ));

  const weeklyLoad: Record<string, number> = {};
  for (const c of completions) {
    const d = new Date(c.date + "T00:00:00");
    const wStart = new Date(d);
    wStart.setDate(wStart.getDate() - wStart.getDay());
    const key = wStart.toISOString().split("T")[0];

    const sets = c.sets || 1;
    const reps = c.reps || 1;
    const w = parseWeight(c.weight) || 1;
    weeklyLoad[key] = (weeklyLoad[key] || 0) + sets * reps * w;
  }

  const weeklyData = Object.entries(weeklyLoad).sort(([a], [b]) => a.localeCompare(b)).map(([week, load]) => ({ week, load: Math.round(load) }));
  const loads = weeklyData.map(w => w.load);
  const trend = computeTrend(loads);
  const avg = loads.length > 0 ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : 0;
  const peak = loads.length > 0 ? Math.max(...loads) : 0;
  const current = loads[loads.length - 1] || 0;

  return {
    type: "training_load_trend",
    data: { weeklyData, trend, avgLoad: avg, peakLoad: peak, currentLoad: current, weeks },
    summary: `Training load over ${weeks} weeks: trend is ${trend}. Current week load: ${current.toLocaleString()}, avg: ${avg.toLocaleString()}, peak: ${peak.toLocaleString()}.`,
  };
}

// ============================================================
// 5. WORKOUT CONSISTENCY / STREAK ANALYSIS
// ============================================================
export async function workoutConsistencyAnalysis(userId: number, period: string = "12_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const completions = await db.select({
    date: workoutCompletions.completedDate,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, startDate)
  ));

  const uniqueDates = Array.from(new Set(completions.map(c => c.date))).sort();
  const totalWorkoutDays = uniqueDates.length;
  const totalDays = days;
  const consistencyRate = Math.round((totalWorkoutDays / totalDays) * 100);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const today = new Date().toISOString().split("T")[0];

  for (let i = 0; i <= days; i++) {
    const checkDate = getDateNDaysAgo(i);
    if (uniqueDates.includes(checkDate)) {
      if (i === 0 || tempStreak > 0) tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      if (currentStreak === 0 && i <= 1) currentStreak = tempStreak;
    } else {
      if (currentStreak === 0 && tempStreak > 0) currentStreak = tempStreak;
      tempStreak = 0;
    }
  }

  const dayOfWeekCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of uniqueDates) {
    const day = new Date(d + "T00:00:00").getDay();
    dayOfWeekCounts[dayNames[day]]++;
  }

  const favoriteDays = Object.entries(dayOfWeekCounts).sort(([, a], [, b]) => b - a).filter(([, c]) => c > 0);
  const restDays = Object.entries(dayOfWeekCounts).filter(([, c]) => c === 0).map(([d]) => d);

  const weeks = Math.max(1, Math.round(days / 7));
  const avgPerWeek = Math.round((totalWorkoutDays / weeks) * 10) / 10;

  return {
    type: "workout_consistency",
    data: { totalWorkoutDays, totalDays, consistencyRate, currentStreak, longestStreak, avgPerWeek, dayOfWeekPattern: dayOfWeekCounts, favoriteDays: favoriteDays.slice(0, 3).map(([d]) => d), typicalRestDays: restDays, weeks },
    summary: `Consistency over ${weeks} weeks: ${totalWorkoutDays} workout days (${consistencyRate}% rate), avg ${avgPerWeek}/week. Current streak: ${currentStreak} days, longest: ${longestStreak} days. Favorite days: ${favoriteDays.slice(0, 2).map(([d]) => d).join(", ")}. ${restDays.length > 0 ? `Typical rest: ${restDays.join(", ")}.` : ""}`,
  };
}

// ============================================================
// 6. EXERCISE FREQUENCY RANKING
// ============================================================
export async function exerciseFrequencyRanking(userId: number, period: string = "3_months"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const completions = await db.select({
    exerciseName: workoutCompletions.exerciseName,
    date: workoutCompletions.completedDate,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, startDate)
  ));

  const freq: Record<string, Set<string>> = {};
  for (const c of completions) {
    const name = c.exerciseName || "Unknown";
    if (!freq[name]) freq[name] = new Set();
    freq[name].add(c.date);
  }

  const ranked = Object.entries(freq)
    .map(([exercise, dates]) => ({ exercise, sessionCount: dates.size }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  return {
    type: "exercise_frequency_ranking",
    data: { exercises: ranked.slice(0, 20), totalUniqueExercises: ranked.length, period: `${Math.round(days / 30)} months` },
    summary: `${ranked.length} unique exercises over ${Math.round(days / 30)} months. Most frequent: ${ranked.slice(0, 3).map(e => `${e.exercise} (${e.sessionCount}x)`).join(", ")}. Least done: ${ranked.slice(-3).map(e => `${e.exercise} (${e.sessionCount}x)`).join(", ")}.`,
  };
}

// ============================================================
// 7. REST DAY PATTERN ANALYSIS
// ============================================================
export async function restDayPatternAnalysis(userId: number, period: string = "8_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const completions = await db.select({ date: workoutCompletions.completedDate })
    .from(workoutCompletions)
    .where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, startDate)));

  const workoutDates = new Set(completions.map(c => c.date));
  let totalRestDays = 0;
  let consecutiveRestStreaks: number[] = [];
  let currentRestStreak = 0;
  let restAfterHeavy = 0;
  let totalHeavyDays = 0;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const restByDay: Record<string, number> = {};
  dayNames.forEach(d => restByDay[d] = 0);

  for (let i = 0; i < days; i++) {
    const checkDate = getDateNDaysAgo(i);
    const isRest = !workoutDates.has(checkDate);
    if (isRest) {
      totalRestDays++;
      currentRestStreak++;
      const dayName = dayNames[new Date(checkDate + "T00:00:00").getDay()];
      restByDay[dayName]++;
    } else {
      if (currentRestStreak > 0) consecutiveRestStreaks.push(currentRestStreak);
      currentRestStreak = 0;
    }
  }
  if (currentRestStreak > 0) consecutiveRestStreaks.push(currentRestStreak);

  const avgRestBetween = consecutiveRestStreaks.length > 0 ? Math.round((consecutiveRestStreaks.reduce((a, b) => a + b, 0) / consecutiveRestStreaks.length) * 10) / 10 : 0;
  const restRatio = Math.round((totalRestDays / days) * 100);

  return {
    type: "rest_day_pattern",
    data: { totalRestDays, totalDays: days, restRatio, avgConsecutiveRestDays: avgRestBetween, longestRestStreak: consecutiveRestStreaks.length > 0 ? Math.max(...consecutiveRestStreaks) : 0, restByDayOfWeek: restByDay },
    summary: `Rest patterns over ${Math.round(days / 7)} weeks: ${totalRestDays} rest days (${restRatio}% of days). Avg rest gap: ${avgRestBetween} consecutive days. ${restRatio < 25 ? "Potentially overtraining — not enough rest." : restRatio > 70 ? "More rest than training — consistency needs work." : "Good rest-to-training balance."}`,
  };
}

// ============================================================
// 8. WORKOUT COMPLETION RATE
// ============================================================
export async function workoutCompletionRate(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const cycles = await db.select()
    .from(workoutCycles)
    .where(and(eq(workoutCycles.memberId, userId), eq(workoutCycles.isActive, true)));

  if (cycles.length === 0) {
    return { type: "workout_completion_rate", data: { hasActiveCycle: false }, summary: "No active workout cycle found." };
  }

  const cycle = cycles[0];
  const cycleLength = cycle.cycleLength;
  const restDaysSet = new Set(cycle.restDays || []);
  const trainingDaysPerCycle = cycleLength - restDaysSet.size;

  const totalCompletions = await db.select({ date: workoutCompletions.completedDate })
    .from(workoutCompletions)
    .where(and(
      eq(workoutCompletions.memberId, userId),
      eq(workoutCompletions.cycleId, cycle.id),
      gte(workoutCompletions.completedDate, startDate)
    ));

  const uniqueCompletedDays = new Set(totalCompletions.map(c => c.date)).size;
  const weeksInPeriod = Math.max(1, Math.round(days / 7));
  const expectedWorkouts = Math.round(weeksInPeriod * (trainingDaysPerCycle / cycleLength) * 7);
  const completionRate = expectedWorkouts > 0 ? Math.round((uniqueCompletedDays / expectedWorkouts) * 100) : 0;

  return {
    type: "workout_completion_rate",
    data: { hasActiveCycle: true, cycleName: cycle.name, completedDays: uniqueCompletedDays, expectedDays: expectedWorkouts, completionRate, period: `${weeksInPeriod} weeks` },
    summary: `Workout completion for "${cycle.name}" over ${weeksInPeriod} weeks: ${uniqueCompletedDays}/${expectedWorkouts} expected sessions completed (${completionRate}%). ${completionRate >= 80 ? "Excellent adherence!" : completionRate >= 60 ? "Good — room for improvement." : "Needs more consistency."}`,
  };
}

// ============================================================
// 9. DAY-OF-WEEK TRAINING PATTERNS
// ============================================================
export async function dayOfWeekPatterns(userId: number, period: string = "12_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const completions = await db.select({ date: workoutCompletions.completedDate })
    .from(workoutCompletions)
    .where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, startDate)));

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCounts: Record<string, number> = {};
  dayNames.forEach(d => dayCounts[d] = 0);

  const uniqueDateArr = Array.from(new Set(completions.map(c => c.date)));
  for (const d of uniqueDateArr) {
    const dayIdx = new Date(d + "T00:00:00").getDay();
    dayCounts[dayNames[dayIdx]]++;
  }

  const sorted = Object.entries(dayCounts).sort(([, a], [, b]) => b - a);
  const mostActive = sorted.filter(([, c]) => c > 0).slice(0, 3).map(([d]) => d);
  const neverTrained = sorted.filter(([, c]) => c === 0).map(([d]) => d);

  return {
    type: "day_of_week_patterns",
    data: { dayCounts, mostActiveDays: mostActive, neverTrainedDays: neverTrained, totalWorkoutDays: uniqueDateArr.length, weeks: Math.round(days / 7) },
    summary: `Training pattern over ${Math.round(days / 7)} weeks: most active on ${mostActive.join(", ")}. ${neverTrained.length > 0 ? `Never trains on: ${neverTrained.join(", ")}.` : "Trains every day of the week."} Total: ${uniqueDateArr.length} workout days.`,
  };
}

// ============================================================
// 10. CALORIE TREND
// ============================================================
export async function calorieTrend(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const weeks = periodToWeeks(period);
  const startDate = getDateNDaysAgo(weeks * 7);

  const logs = await db.select({
    date: foodLogs.date,
    calories: foodLogs.calories,
  })
  .from(foodLogs)
  .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const dailyTotals: Record<string, number> = {};
  for (const l of logs) {
    dailyTotals[l.date] = (dailyTotals[l.date] || 0) + l.calories;
  }

  const weeklyAvgs: Array<{ week: string; avgCalories: number; daysLogged: number }> = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const wStart = getWeekStart(i);
    const wEnd = getWeekStart(i - 1);
    const daysInWeek = Object.entries(dailyTotals).filter(([d]) => d >= wStart && d < wEnd);
    const avg = daysInWeek.length > 0 ? Math.round(daysInWeek.reduce((s, [, c]) => s + c, 0) / daysInWeek.length) : 0;
    weeklyAvgs.push({ week: wStart, avgCalories: avg, daysLogged: daysInWeek.length });
  }

  const [goal] = await db.select({ target: calorieGoals.dailyCalorieTarget, goalType: calorieGoals.goalType })
    .from(calorieGoals)
    .where(and(eq(calorieGoals.userId, userId), eq(calorieGoals.isActive, true)))
    .limit(1);

  const allDailyValues = Object.values(dailyTotals);
  const overallAvg = allDailyValues.length > 0 ? Math.round(allDailyValues.reduce((a, b) => a + b, 0) / allDailyValues.length) : 0;
  const calorieVals = weeklyAvgs.map(w => w.avgCalories).filter(v => v > 0);
  const trend = computeTrend(calorieVals);

  let goalAdherence: number | null = null;
  if (goal?.target) {
    const withinRange = allDailyValues.filter(v => Math.abs(v - goal.target) <= goal.target * 0.15).length;
    goalAdherence = allDailyValues.length > 0 ? Math.round((withinRange / allDailyValues.length) * 100) : 0;
  }

  return {
    type: "calorie_trend",
    data: { weeklyAvgs, overallAvg, trend, daysTracked: allDailyValues.length, calorieGoal: goal?.target || null, goalType: goal?.goalType || null, goalAdherence },
    summary: `Calorie trend over ${weeks} weeks: avg ${overallAvg} cal/day, trend is ${trend}. ${allDailyValues.length} days tracked. ${goal?.target ? `Goal: ${goal.target} cal (${goal.goalType}). Adherence: ${goalAdherence}% of days within range.` : "No calorie goal set."}`,
  };
}

// ============================================================
// 11. PROTEIN ADHERENCE RATE
// ============================================================
export async function proteinAdherenceRate(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const logs = await db.select({ date: foodLogs.date, protein: foodLogs.protein })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const dailyProtein: Record<string, number> = {};
  for (const l of logs) {
    dailyProtein[l.date] = (dailyProtein[l.date] || 0) + (l.protein || 0);
  }

  const [goal] = await db.select({ target: calorieGoals.dailyProteinTarget })
    .from(calorieGoals)
    .where(and(eq(calorieGoals.userId, userId), eq(calorieGoals.isActive, true)))
    .limit(1);

  const proteinTarget = goal?.target || 0;
  const dailyValues = Object.entries(dailyProtein).sort(([a], [b]) => a.localeCompare(b));
  const avgProtein = dailyValues.length > 0 ? Math.round(dailyValues.reduce((s, [, p]) => s + p, 0) / dailyValues.length) : 0;
  const hitDays = proteinTarget > 0 ? dailyValues.filter(([, p]) => p >= proteinTarget).length : 0;
  const hitRate = dailyValues.length > 0 && proteinTarget > 0 ? Math.round((hitDays / dailyValues.length) * 100) : 0;
  const proteinValues = dailyValues.map(([, p]) => p);
  const trend = computeTrend(proteinValues);

  return {
    type: "protein_adherence",
    data: { avgDailyProtein: avgProtein, proteinTarget, daysTracked: dailyValues.length, daysHitTarget: hitDays, hitRate, trend, dailyHistory: dailyValues.slice(-14).map(([date, protein]) => ({ date, protein })) },
    summary: `Protein over ${Math.round(days / 7)} weeks: avg ${avgProtein}g/day. ${proteinTarget > 0 ? `Target: ${proteinTarget}g. Hit rate: ${hitRate}% (${hitDays}/${dailyValues.length} days). Trend: ${trend}.` : "No protein target set."}`,
  };
}

// ============================================================
// 12. MACRO BALANCE TREND
// ============================================================
export async function macroBalanceTrend(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const weeks = periodToWeeks(period);
  const startDate = getDateNDaysAgo(weeks * 7);

  const logs = await db.select({ date: foodLogs.date, calories: foodLogs.calories, protein: foodLogs.protein, carbs: foodLogs.carbs, fat: foodLogs.fat })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const daily: Record<string, { cal: number; p: number; c: number; f: number }> = {};
  for (const l of logs) {
    if (!daily[l.date]) daily[l.date] = { cal: 0, p: 0, c: 0, f: 0 };
    daily[l.date].cal += l.calories;
    daily[l.date].p += l.protein || 0;
    daily[l.date].c += l.carbs || 0;
    daily[l.date].f += l.fat || 0;
  }

  const dailyEntries = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b));
  const avgMacros = dailyEntries.length > 0 ? {
    protein: Math.round(dailyEntries.reduce((s, [, d]) => s + d.p, 0) / dailyEntries.length),
    carbs: Math.round(dailyEntries.reduce((s, [, d]) => s + d.c, 0) / dailyEntries.length),
    fat: Math.round(dailyEntries.reduce((s, [, d]) => s + d.f, 0) / dailyEntries.length),
    calories: Math.round(dailyEntries.reduce((s, [, d]) => s + d.cal, 0) / dailyEntries.length),
  } : { protein: 0, carbs: 0, fat: 0, calories: 0 };

  const totalCalFromMacros = (avgMacros.protein * 4) + (avgMacros.carbs * 4) + (avgMacros.fat * 9);
  const macroSplit = totalCalFromMacros > 0 ? {
    proteinPct: Math.round((avgMacros.protein * 4 / totalCalFromMacros) * 100),
    carbsPct: Math.round((avgMacros.carbs * 4 / totalCalFromMacros) * 100),
    fatPct: Math.round((avgMacros.fat * 9 / totalCalFromMacros) * 100),
  } : { proteinPct: 0, carbsPct: 0, fatPct: 0 };

  const firstHalf = dailyEntries.slice(0, Math.ceil(dailyEntries.length / 2));
  const secondHalf = dailyEntries.slice(Math.ceil(dailyEntries.length / 2));
  const firstSplit = firstHalf.length > 0 ? Math.round((firstHalf.reduce((s, [, d]) => s + d.p, 0) / firstHalf.length) * 4 / Math.max(1, firstHalf.reduce((s, [, d]) => s + d.cal, 0) / firstHalf.length) * 100) : 0;
  const secondSplit = secondHalf.length > 0 ? Math.round((secondHalf.reduce((s, [, d]) => s + d.p, 0) / secondHalf.length) * 4 / Math.max(1, secondHalf.reduce((s, [, d]) => s + d.cal, 0) / secondHalf.length) * 100) : 0;
  const proteinShift = secondSplit - firstSplit;

  return {
    type: "macro_balance_trend",
    data: { avgMacros, macroSplit, proteinShiftPct: proteinShift, daysTracked: dailyEntries.length, weeks },
    summary: `Macro balance over ${weeks} weeks: avg ${avgMacros.protein}g protein (${macroSplit.proteinPct}%), ${avgMacros.carbs}g carbs (${macroSplit.carbsPct}%), ${avgMacros.fat}g fat (${macroSplit.fatPct}%). Protein share ${proteinShift >= 0 ? "up" : "down"} ${Math.abs(proteinShift)}% over the period.`,
  };
}

// ============================================================
// 13. MEAL TIMING PATTERNS
// ============================================================
export async function mealTimingPatterns(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const logs = await db.select({ date: foodLogs.date, mealType: foodLogs.mealType, createdAt: foodLogs.createdAt })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const mealTypeCounts: Record<string, number> = {};
  const hourCounts: Record<number, number> = {};

  for (const l of logs) {
    mealTypeCounts[l.mealType] = (mealTypeCounts[l.mealType] || 0) + 1;
    if (l.createdAt) {
      const hour = new Date(l.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  }

  const dailyDates = Array.from(new Set(logs.map(l => l.date)));
  const daysWithBreakfast = new Set(logs.filter(l => l.mealType === "breakfast").map(l => l.date)).size;
  const breakfastRate = dailyDates.length > 0 ? Math.round((daysWithBreakfast / dailyDates.length) * 100) : 0;

  const peakHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];
  const avgMealsPerDay = dailyDates.length > 0 ? Math.round((logs.length / dailyDates.length) * 10) / 10 : 0;

  return {
    type: "meal_timing_patterns",
    data: { mealTypeCounts, hourDistribution: hourCounts, avgMealsPerDay, breakfastRate, daysTracked: dailyDates.length, peakEatingHour: peakHour ? parseInt(peakHour[0]) : null },
    summary: `Meal patterns over ${Math.round(days / 7)} weeks: avg ${avgMealsPerDay} meals/day. Breakfast logged ${breakfastRate}% of days. ${peakHour ? `Peak eating hour: ${parseInt(peakHour[0]) > 12 ? parseInt(peakHour[0]) - 12 + "pm" : parseInt(peakHour[0]) + "am"}.` : ""} Meal type distribution: ${Object.entries(mealTypeCounts).map(([t, c]) => `${t}: ${c}`).join(", ")}.`,
  };
}

// ============================================================
// 14. WATER INTAKE CONSISTENCY
// ============================================================
export async function waterIntakeConsistency(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const logs = await db.select({ date: waterLogs.date, amount: waterLogs.amountOz })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), gte(waterLogs.date, startDate)));

  const dailyWater: Record<string, number> = {};
  for (const l of logs) {
    dailyWater[l.date] = (dailyWater[l.date] || 0) + l.amount;
  }

  const dailyValues = Object.entries(dailyWater).sort(([a], [b]) => a.localeCompare(b));
  const avgDaily = dailyValues.length > 0 ? Math.round(dailyValues.reduce((s, [, v]) => s + v, 0) / dailyValues.length) : 0;
  const goalMet = dailyValues.filter(([, v]) => v >= 64).length;
  const goalRate = dailyValues.length > 0 ? Math.round((goalMet / dailyValues.length) * 100) : 0;
  const daysTracked = dailyValues.length;
  const daysNotLogged = days - daysTracked;
  const trend = computeTrend(dailyValues.map(([, v]) => v));

  return {
    type: "water_intake_consistency",
    data: { avgDailyOz: avgDaily, daysTracked, daysNotLogged, goalMetDays: goalMet, goalRate, trend, dailyHistory: dailyValues.slice(-14).map(([date, oz]) => ({ date, oz })) },
    summary: `Water intake over ${Math.round(days / 7)} weeks: avg ${avgDaily}oz/day. Goal (64oz) hit ${goalRate}% of tracked days (${goalMet}/${daysTracked}). ${daysNotLogged > 0 ? `${daysNotLogged} days not logged.` : ""} Trend: ${trend}.`,
  };
}

// ============================================================
// 15. CALORIE GOAL ADHERENCE
// ============================================================
export async function calorieGoalAdherence(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const [goal] = await db.select()
    .from(calorieGoals)
    .where(and(eq(calorieGoals.userId, userId), eq(calorieGoals.isActive, true)))
    .limit(1);

  if (!goal) {
    return { type: "calorie_goal_adherence", data: { hasGoal: false }, summary: "No active calorie goal set." };
  }

  const logs = await db.select({ date: foodLogs.date, calories: foodLogs.calories })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const dailyCals: Record<string, number> = {};
  for (const l of logs) dailyCals[l.date] = (dailyCals[l.date] || 0) + l.calories;

  const dailyEntries = Object.entries(dailyCals).sort(([a], [b]) => a.localeCompare(b));
  const target = goal.dailyCalorieTarget;
  const underDays = dailyEntries.filter(([, c]) => c < target * 0.85).length;
  const overDays = dailyEntries.filter(([, c]) => c > target * 1.15).length;
  const onTargetDays = dailyEntries.filter(([, c]) => c >= target * 0.85 && c <= target * 1.15).length;
  const avgSurplus = dailyEntries.length > 0 ? Math.round(dailyEntries.reduce((s, [, c]) => s + (c - target), 0) / dailyEntries.length) : 0;

  return {
    type: "calorie_goal_adherence",
    data: {
      hasGoal: true,
      goalType: goal.goalType,
      dailyTarget: target,
      daysTracked: dailyEntries.length,
      onTargetDays,
      underDays,
      overDays,
      avgDailySurplus: avgSurplus,
      adherenceRate: dailyEntries.length > 0 ? Math.round((onTargetDays / dailyEntries.length) * 100) : 0,
      dailyHistory: dailyEntries.slice(-14).map(([date, cal]) => ({ date, calories: cal, delta: cal - target })),
    },
    summary: `Calorie goal (${goal.goalType}, ${target} cal/day) over ${Math.round(days / 7)} weeks: on target ${onTargetDays}/${dailyEntries.length} days (${dailyEntries.length > 0 ? Math.round((onTargetDays / dailyEntries.length) * 100) : 0}%). Under: ${underDays} days, over: ${overDays} days. Avg daily ${avgSurplus >= 0 ? "surplus" : "deficit"}: ${Math.abs(avgSurplus)} cal.`,
  };
}

// ============================================================
// 16. BODY COMPOSITION TREND
// ============================================================
export async function bodyCompositionTrend(userId: number, period: string = "6_months"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const measurements = await db.select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.memberId, userId), gte(bodyMeasurements.recordedDate, startDate)))
    .orderBy(asc(bodyMeasurements.recordedDate));

  if (measurements.length === 0) {
    return { type: "body_composition_trend", data: { hasMeasurements: false }, summary: "No body measurements recorded in this period." };
  }

  const weights = measurements.filter(m => m.weight).map(m => ({ date: m.recordedDate, value: m.weight! }));
  const bodyFats = measurements.filter(m => m.bodyFat).map(m => ({ date: m.recordedDate, value: m.bodyFat! }));

  const weightTrend = computeTrend(weights.map(w => w.value));
  const firstWeight = weights[0]?.value;
  const lastWeight = weights[weights.length - 1]?.value;
  const weightChange = firstWeight && lastWeight ? lastWeight - firstWeight : null;
  const weightChangePct = firstWeight && lastWeight ? pctChange(lastWeight, firstWeight) : null;

  const ratePerWeek = weightChange !== null && weights.length >= 2
    ? Math.round((weightChange / (Math.max(1, (new Date(weights[weights.length - 1].date).getTime() - new Date(weights[0].date).getTime()) / (7 * 24 * 60 * 60 * 1000)))) * 10) / 10
    : null;

  return {
    type: "body_composition_trend",
    data: {
      hasMeasurements: true,
      weightHistory: weights,
      bodyFatHistory: bodyFats,
      weightTrend,
      firstWeight,
      lastWeight,
      weightChange,
      weightChangePct,
      ratePerWeek,
      measurementCount: measurements.length,
    },
    summary: `Body composition over ${Math.round(days / 30)} months (${measurements.length} measurements): ${weightChange !== null ? `Weight ${weightChange >= 0 ? "up" : "down"} ${Math.abs(weightChange)}kg (${weightChangePct}%), rate: ${ratePerWeek}kg/week.` : "No weight data."} ${bodyFats.length >= 2 ? `Body fat: ${bodyFats[0].value}% → ${bodyFats[bodyFats.length - 1].value}%.` : ""} Weight trend: ${weightTrend}.`,
  };
}

// ============================================================
// 17. HEALTH METRICS TREND
// ============================================================
export async function healthMetricsTrend(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const data = await db.select()
    .from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, startDate)))
    .orderBy(asc(healthData.date));

  if (data.length === 0) {
    return { type: "health_metrics_trend", data: { hasData: false }, summary: "No health/watch data available for this period." };
  }

  const weeklyAgg: Record<string, { steps: number[]; sleep: number[]; hr: number[]; calories: number[]; active: number[] }> = {};
  for (const d of data) {
    const wStart = new Date(d.date + "T00:00:00");
    wStart.setDate(wStart.getDate() - wStart.getDay());
    const key = wStart.toISOString().split("T")[0];
    if (!weeklyAgg[key]) weeklyAgg[key] = { steps: [], sleep: [], hr: [], calories: [], active: [] };
    if (d.steps) weeklyAgg[key].steps.push(d.steps);
    if (d.sleepMinutes) weeklyAgg[key].sleep.push(d.sleepMinutes);
    if (d.avgHeartRate) weeklyAgg[key].hr.push(d.avgHeartRate);
    if (d.caloriesBurned) weeklyAgg[key].calories.push(d.caloriesBurned);
    if (d.activeMinutes) weeklyAgg[key].active.push(d.activeMinutes);
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const weeklyMetrics = Object.entries(weeklyAgg).sort(([a], [b]) => a.localeCompare(b)).map(([week, d]) => ({
    week,
    avgSteps: avg(d.steps),
    avgSleep: avg(d.sleep),
    avgHR: avg(d.hr),
    avgCaloriesBurned: avg(d.calories),
    avgActiveMinutes: avg(d.active),
  }));

  const stepsTrend = computeTrend(weeklyMetrics.map(w => w.avgSteps));
  const sleepTrend = computeTrend(weeklyMetrics.map(w => w.avgSleep));
  const overallAvgSteps = avg(data.filter(d => d.steps).map(d => d.steps!));
  const overallAvgSleep = avg(data.filter(d => d.sleepMinutes).map(d => d.sleepMinutes!));

  return {
    type: "health_metrics_trend",
    data: { hasData: true, weeklyMetrics, stepsTrend, sleepTrend, overallAvgSteps, overallAvgSleepMinutes: overallAvgSleep, daysTracked: data.length },
    summary: `Health data over ${Math.round(days / 7)} weeks (${data.length} days tracked): avg ${overallAvgSteps.toLocaleString()} steps/day (trend: ${stepsTrend}), avg sleep ${Math.floor(overallAvgSleep / 60)}h ${overallAvgSleep % 60}m (trend: ${sleepTrend}).`,
  };
}

// ============================================================
// 18. RECOVERY SCORE HISTORY
// ============================================================
export async function recoveryScoreHistory(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const data = await db.select()
    .from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, startDate)))
    .orderBy(asc(healthData.date));

  if (data.length === 0) {
    return { type: "recovery_score_history", data: { hasData: false }, summary: "No health data available for recovery scoring." };
  }

  const scores = data.map(d => {
    const sleepScore = Math.min(100, ((d.sleepMinutes || 0) / 480) * 100);
    const hrScore = d.avgHeartRate && d.avgHeartRate > 0 ? Math.max(0, 100 - Math.abs(d.avgHeartRate - 65) * 2) : 50;
    const activityScore = Math.min(100, ((d.activeMinutes || 0) / 60) * 100);
    const stepsScore = Math.min(100, ((d.steps || 0) / 10000) * 100);
    const recovery = Math.round(sleepScore * 0.35 + hrScore * 0.25 + activityScore * 0.2 + stepsScore * 0.2);
    return { date: d.date, score: recovery, sleep: d.sleepMinutes || 0, hr: d.avgHeartRate || 0 };
  });

  const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);
  const lowDays = scores.filter(s => s.score < 40).length;
  const highDays = scores.filter(s => s.score >= 80).length;
  const trend = computeTrend(scores.map(s => s.score));

  return {
    type: "recovery_score_history",
    data: { hasData: true, scores: scores.slice(-30), avgScore, lowDays, highDays, trend, daysTracked: scores.length },
    summary: `Recovery over ${Math.round(days / 7)} weeks: avg score ${avgScore}/100 (trend: ${trend}). ${highDays} excellent days (80+), ${lowDays} low days (<40). ${lowDays > scores.length * 0.3 ? "Too many low recovery days — sleep and rest need attention." : "Recovery is generally good."}`,
  };
}

// ============================================================
// 19. ACTIVITY VS NUTRITION CORRELATION
// ============================================================
export async function activityNutritionCorrelation(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const [healthRows, foodRows] = await Promise.all([
    db.select({ date: healthData.date, caloriesBurned: healthData.caloriesBurned, steps: healthData.steps })
      .from(healthData)
      .where(and(eq(healthData.userId, userId), gte(healthData.date, startDate))),
    db.select({ date: foodLogs.date, calories: foodLogs.calories })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate))),
  ]);

  const burned: Record<string, number> = {};
  const stepsMap: Record<string, number> = {};
  for (const h of healthRows) {
    if (h.caloriesBurned) burned[h.date] = h.caloriesBurned;
    if (h.steps) stepsMap[h.date] = h.steps;
  }

  const eaten: Record<string, number> = {};
  for (const f of foodRows) eaten[f.date] = (eaten[f.date] || 0) + f.calories;

  const commonDates = Object.keys(burned).filter(d => eaten[d] !== undefined);

  if (commonDates.length === 0) {
    return { type: "activity_nutrition_correlation", data: { hasData: false }, summary: "Not enough overlapping nutrition and health data to analyze." };
  }

  const dailyBalance = commonDates.sort().map(date => ({
    date,
    eaten: eaten[date],
    burned: burned[date],
    netBalance: eaten[date] - burned[date],
    steps: stepsMap[date] || 0,
  }));

  const avgNet = Math.round(dailyBalance.reduce((s, d) => s + d.netBalance, 0) / dailyBalance.length);
  const surplusDays = dailyBalance.filter(d => d.netBalance > 0).length;
  const deficitDays = dailyBalance.filter(d => d.netBalance < 0).length;
  const highActivityLowFood = dailyBalance.filter(d => d.steps > 10000 && d.eaten < (d.burned * 0.7)).length;

  const [goal] = await db.select({ goalType: calorieGoals.goalType })
    .from(calorieGoals)
    .where(and(eq(calorieGoals.userId, userId), eq(calorieGoals.isActive, true)))
    .limit(1);

  let alignment = "neutral";
  if (goal?.goalType === "lose" && avgNet < 0) alignment = "aligned";
  else if (goal?.goalType === "lose" && avgNet > 0) alignment = "misaligned";
  else if (goal?.goalType === "gain" && avgNet > 0) alignment = "aligned";
  else if (goal?.goalType === "gain" && avgNet < 0) alignment = "misaligned";

  return {
    type: "activity_nutrition_correlation",
    data: { hasData: true, dailyBalance: dailyBalance.slice(-14), avgNetBalance: avgNet, surplusDays, deficitDays, highActivityLowFoodDays: highActivityLowFood, goalAlignment: alignment, daysAnalyzed: commonDates.length },
    summary: `Activity vs nutrition over ${commonDates.length} days: avg net balance ${avgNet >= 0 ? "+" : ""}${avgNet} cal/day. ${surplusDays} surplus days, ${deficitDays} deficit days. ${highActivityLowFood > 0 ? `${highActivityLowFood} days with high activity but low food intake.` : ""} ${goal?.goalType ? `Goal (${goal.goalType}): ${alignment}.` : ""}`,
  };
}

// ============================================================
// 20. MATCH FREQUENCY AND INTENSITY TRENDS
// ============================================================
export async function matchFrequencyTrend(userId: number, period: string = "8_weeks"): Promise<AnalyticsResult> {
  const weeks = periodToWeeks(period);
  const startDate = getDateNDaysAgo(weeks * 7);

  const matches = await db.select()
    .from(matchLogs)
    .where(and(eq(matchLogs.userId, userId), eq(matchLogs.cancelled, false), gte(matchLogs.matchDate, startDate)))
    .orderBy(asc(matchLogs.matchDate));

  if (matches.length === 0) {
    return { type: "match_frequency_trend", data: { hasMatches: false }, summary: "No matches logged in this period." };
  }

  const weeklyMap: Record<string, typeof matches> = {};
  for (const m of matches) {
    const d = new Date(m.matchDate + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().split("T")[0];
    if (!weeklyMap[key]) weeklyMap[key] = [];
    weeklyMap[key].push(m);
  }

  const weeklyData = Object.entries(weeklyMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, ms]) => ({
    week,
    count: ms.length,
    totalCalories: ms.reduce((s, m) => s + (m.caloriesBurned || 0), 0),
    avgDuration: ms.length > 0 ? Math.round(ms.reduce((s, m) => s + (m.duration || 0), 0) / ms.length) : 0,
    competitive: ms.filter(m => m.intensity === "competitive").length,
    casual: ms.filter(m => m.intensity === "casual").length,
  }));

  const totalMatches = matches.length;
  const totalCalories = matches.reduce((s, m) => s + (m.caloriesBurned || 0), 0);
  const sports = Array.from(new Set(matches.map(m => m.sport)));

  return {
    type: "match_frequency_trend",
    data: { hasMatches: true, weeklyData, totalMatches, totalCalories, sports, weeks },
    summary: `Match activity over ${weeks} weeks: ${totalMatches} matches across ${sports.join(", ")}. Total calories burned: ${totalCalories.toLocaleString()}. ${weeklyData.length > 1 ? `Trend: ${computeTrend(weeklyData.map(w => w.count))}.` : ""}`,
  };
}

// ============================================================
// 21. SPORT PERFORMANCE CORRELATION
// ============================================================
export async function sportPerformanceCorrelation(userId: number, period: string = "4_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const [matches, healthRows, workoutRows] = await Promise.all([
    db.select().from(matchLogs).where(and(eq(matchLogs.userId, userId), eq(matchLogs.cancelled, false), gte(matchLogs.matchDate, startDate))),
    db.select({ date: healthData.date, sleepMinutes: healthData.sleepMinutes, steps: healthData.steps, avgHeartRate: healthData.avgHeartRate }).from(healthData).where(and(eq(healthData.userId, userId), gte(healthData.date, startDate))),
    db.select({ date: workoutCompletions.completedDate }).from(workoutCompletions).where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, startDate))),
  ]);

  if (matches.length === 0) {
    return { type: "sport_performance_correlation", data: { hasData: false }, summary: "No match data to correlate." };
  }

  const healthMap: Record<string, any> = {};
  for (const h of healthRows) healthMap[h.date] = h;

  const workoutDates = new Set(workoutRows.map(w => w.date));

  const matchDayAnalysis = matches.map(m => {
    const dayBefore = getDateNDaysAgo(Math.round((Date.now() - new Date(m.matchDate + "T00:00:00").getTime()) / 86400000) + 1);
    const sleepBefore = healthMap[dayBefore]?.sleepMinutes;
    const trainedDayBefore = workoutDates.has(dayBefore);
    return {
      date: m.matchDate,
      sport: m.sport,
      intensity: m.intensity,
      duration: m.duration,
      caloriesBurned: m.caloriesBurned,
      sleepBeforeMatch: sleepBefore || null,
      trainedDayBefore,
    };
  });

  const avgSleepBeforeMatch = matchDayAnalysis.filter(m => m.sleepBeforeMatch).length > 0
    ? Math.round(matchDayAnalysis.filter(m => m.sleepBeforeMatch).reduce((s, m) => s + m.sleepBeforeMatch!, 0) / matchDayAnalysis.filter(m => m.sleepBeforeMatch).length)
    : null;
  const trainedBeforeMatchCount = matchDayAnalysis.filter(m => m.trainedDayBefore).length;
  const trainedBeforeMatchRate = matches.length > 0 ? Math.round((trainedBeforeMatchCount / matches.length) * 100) : 0;

  return {
    type: "sport_performance_correlation",
    data: { hasData: true, matchDayAnalysis, avgSleepBeforeMatch, trainedBeforeMatchRate, totalMatches: matches.length },
    summary: `Sport-recovery correlation over ${matches.length} matches: ${avgSleepBeforeMatch ? `avg sleep before match: ${Math.floor(avgSleepBeforeMatch / 60)}h ${avgSleepBeforeMatch % 60}m.` : ""} Trained day before match ${trainedBeforeMatchRate}% of the time (${trainedBeforeMatchCount}/${matches.length} — ${trainedBeforeMatchCount > matches.length * 0.5 ? "consider more rest before matches" : "good pre-match rest pattern"}).`,
  };
}

// ============================================================
// 22. MEMBER CHURN RISK SCORING (Owner)
// ============================================================
export async function memberChurnRiskScoring(gymId: number): Promise<AnalyticsResult> {
  const members = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, "member")));

  if (members.length === 0) {
    return { type: "churn_risk_scoring", data: { hasMembers: false }, summary: "No members in this gym." };
  }

  const memberIds = members.map(m => m.id);
  const thirtyDaysAgo = getDateNDaysAgo(30);
  const sixtyDaysAgo = getDateNDaysAgo(60);

  const [recentAttendance, olderAttendance, subscriptions, profiles] = await Promise.all([
    db.select({ memberId: attendance.memberId, cnt: count() }).from(attendance).where(and(eq(attendance.gymId, gymId), gte(attendance.date, thirtyDaysAgo), inArray(attendance.memberId, memberIds))).groupBy(attendance.memberId),
    db.select({ memberId: attendance.memberId, cnt: count() }).from(attendance).where(and(eq(attendance.gymId, gymId), gte(attendance.date, sixtyDaysAgo), lte(attendance.date, thirtyDaysAgo), inArray(attendance.memberId, memberIds))).groupBy(attendance.memberId),
    db.select().from(memberSubscriptions).where(and(eq(memberSubscriptions.gymId, gymId), inArray(memberSubscriptions.memberId, memberIds))).orderBy(desc(memberSubscriptions.createdAt)),
    db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName }).from(userProfiles).where(inArray(userProfiles.userId, memberIds)),
  ]);

  const recentMap = new Map(recentAttendance.map(r => [r.memberId, Number(r.cnt)]));
  const olderMap = new Map(olderAttendance.map(r => [r.memberId, Number(r.cnt)]));
  const profileMap = new Map(profiles.map(p => [p.userId, p.fullName]));

  const subMap = new Map<number, { status: string; endDate: string }>();
  for (const s of subscriptions) {
    if (!subMap.has(s.memberId)) subMap.set(s.memberId, { status: s.status, endDate: s.endDate });
  }

  const scored = members.map(m => {
    const recent = recentMap.get(m.id) || 0;
    const older = olderMap.get(m.id) || 0;
    const sub = subMap.get(m.id);

    let riskScore = 0;
    if (recent === 0) riskScore += 40;
    else if (recent <= 2) riskScore += 25;
    else if (recent <= 4) riskScore += 10;

    if (older > 0 && recent < older * 0.5) riskScore += 20;
    else if (older > 0 && recent < older) riskScore += 10;

    if (sub) {
      const daysToExpiry = Math.round((new Date(sub.endDate).getTime() - Date.now()) / 86400000);
      if (daysToExpiry < 0) riskScore += 25;
      else if (daysToExpiry < 7) riskScore += 15;
      else if (daysToExpiry < 14) riskScore += 5;
    } else {
      riskScore += 15;
    }

    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore >= 60 ? "high" : riskScore >= 35 ? "medium" : "low";

    return {
      memberId: m.id,
      name: profileMap.get(m.id) || m.username,
      attendanceLast30: recent,
      attendancePrev30: older,
      attendanceChange: older > 0 ? pctChange(recent, older) : null,
      subscriptionStatus: sub?.status || "none",
      daysToExpiry: sub ? Math.round((new Date(sub.endDate).getTime() - Date.now()) / 86400000) : null,
      riskScore,
      riskLevel,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const highRisk = scored.filter(s => s.riskLevel === "high");
  const medRisk = scored.filter(s => s.riskLevel === "medium");

  return {
    type: "churn_risk_scoring",
    data: { hasMembers: true, members: scored, highRiskCount: highRisk.length, mediumRiskCount: medRisk.length, totalMembers: members.length },
    summary: `Churn analysis for ${members.length} members: ${highRisk.length} high risk, ${medRisk.length} medium risk. ${highRisk.length > 0 ? `Top at-risk: ${highRisk.slice(0, 3).map(m => `${m.name} (score: ${m.riskScore}, ${m.attendanceLast30} visits last 30d)`).join("; ")}.` : "No high-risk members."}`,
  };
}

// ============================================================
// 23. ATTENDANCE TREND PER MEMBER (Owner)
// ============================================================
export async function attendanceTrendPerMember(gymId: number, memberId?: number): Promise<AnalyticsResult> {
  const weeks = 12;
  const startDate = getDateNDaysAgo(weeks * 7);

  const filter = memberId
    ? and(eq(attendance.gymId, gymId), eq(attendance.memberId, memberId), gte(attendance.date, startDate))
    : and(eq(attendance.gymId, gymId), gte(attendance.date, startDate));

  const rows = await db.select({ memberId: attendance.memberId, date: attendance.date })
    .from(attendance)
    .where(filter!);

  const memberWeekly: Record<number, Record<string, number>> = {};
  for (const r of rows) {
    if (!memberWeekly[r.memberId]) memberWeekly[r.memberId] = {};
    const d = new Date(r.date + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().split("T")[0];
    memberWeekly[r.memberId][key] = (memberWeekly[r.memberId][key] || 0) + 1;
  }

  const memberTrends = await Promise.all(Object.entries(memberWeekly).map(async ([mid, weekData]) => {
    const id = parseInt(mid);
    const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, id)).limit(1);
    const weeklyCounts = Object.entries(weekData).sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count }));
    const counts = weeklyCounts.map(w => w.count);
    const trend = computeTrend(counts);
    const totalVisits = counts.reduce((a, b) => a + b, 0);
    const avgPerWeek = Math.round((totalVisits / weeks) * 10) / 10;
    return { memberId: id, name: profile?.fullName || `Member #${id}`, weeklyCounts, trend, totalVisits, avgPerWeek };
  }));

  const declining = memberTrends.filter(m => m.trend === "decreasing");

  return {
    type: "attendance_trend_per_member",
    data: { memberTrends: memberTrends.sort((a, b) => a.avgPerWeek - b.avgPerWeek), decliningCount: declining.length, totalMembers: memberTrends.length, weeks },
    summary: `Attendance trends over ${weeks} weeks for ${memberTrends.length} members. ${declining.length} members showing declining attendance. ${declining.length > 0 ? `Declining: ${declining.slice(0, 3).map(m => `${m.name} (avg ${m.avgPerWeek}/week, ${m.trend})`).join("; ")}.` : ""}`,
  };
}

// ============================================================
// 24. REVENUE TREND (Owner)
// ============================================================
export async function revenueTrend(gymId: number, period: string = "6_months"): Promise<AnalyticsResult> {
  const months = Math.max(1, Math.round(periodToDays(period) / 30));
  const startDate = getDateNDaysAgo(months * 30);

  const transactions = await db.select({ paidOn: paymentTransactions.paidOn, amount: paymentTransactions.amountPaid })
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, startDate)));

  const monthlyRevenue: Record<string, number> = {};
  for (const t of transactions) {
    const monthKey = t.paidOn.substring(0, 7);
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + t.amount;
  }

  const monthlyData = Object.entries(monthlyRevenue).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount: Math.round(amount / 100) }));
  const amounts = monthlyData.map(m => m.amount);
  const trend = computeTrend(amounts);
  const totalRevenue = amounts.reduce((a, b) => a + b, 0);
  const avgMonthly = amounts.length > 0 ? Math.round(totalRevenue / amounts.length) : 0;

  return {
    type: "revenue_trend",
    data: { monthlyData, trend, totalRevenue, avgMonthly, monthsTracked: monthlyData.length },
    summary: `Revenue over ${monthlyData.length} months: total ${totalRevenue.toLocaleString()}, avg ${avgMonthly.toLocaleString()}/month. Trend: ${trend}. ${monthlyData.length >= 2 ? `Latest: ${monthlyData[monthlyData.length - 1].amount.toLocaleString()} vs previous: ${monthlyData[monthlyData.length - 2].amount.toLocaleString()} (${pctChange(monthlyData[monthlyData.length - 1].amount, monthlyData[monthlyData.length - 2].amount)}%).` : ""}`,
  };
}

// ============================================================
// 25. GYM UTILIZATION PATTERNS (Owner)
// ============================================================
export async function gymUtilizationPatterns(gymId: number, period: string = "8_weeks"): Promise<AnalyticsResult> {
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);

  const rows = await db.select({ date: attendance.date })
    .from(attendance)
    .where(and(eq(attendance.gymId, gymId), gte(attendance.date, startDate)));

  const dayOfWeekCounts: Record<string, number> = { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 };
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dailyCounts: Record<string, number> = {};

  for (const r of rows) {
    const dayIdx = new Date(r.date + "T00:00:00").getDay();
    dayOfWeekCounts[dayNames[dayIdx]]++;
    dailyCounts[r.date] = (dailyCounts[r.date] || 0) + 1;
  }

  const dailyValues = Object.values(dailyCounts);
  const avgDaily = dailyValues.length > 0 ? Math.round((dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length) * 10) / 10 : 0;
  const peakDay = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
  const busiestDays = Object.entries(dayOfWeekCounts).sort(([, a], [, b]) => b - a);
  const quietestDays = busiestDays.filter(([, c]) => c > 0).slice(-2);

  return {
    type: "gym_utilization_patterns",
    data: { dayOfWeekCounts, avgDailyAttendance: avgDaily, peakDayAttendance: peakDay, busiestDays: busiestDays.slice(0, 3).map(([d]) => d), quietestDays: quietestDays.map(([d]) => d), totalCheckIns: rows.length, weeks: Math.round(days / 7) },
    summary: `Gym utilization over ${Math.round(days / 7)} weeks: avg ${avgDaily} check-ins/day, peak: ${peakDay}. Busiest: ${busiestDays.slice(0, 2).map(([d, c]) => `${d} (${c})`).join(", ")}. Quietest: ${quietestDays.map(([d, c]) => `${d} (${c})`).join(", ")}.`,
  };
}

// ============================================================
// 26. NEW MEMBER RETENTION RATE (Owner)
// ============================================================
export async function newMemberRetentionRate(gymId: number): Promise<AnalyticsResult> {
  const ninetyDaysAgo = getDateNDaysAgo(90);
  const sixtyDaysAgo = getDateNDaysAgo(60);
  const thirtyDaysAgo = getDateNDaysAgo(30);

  const newMembers = await db.select({ id: users.id, username: users.username, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, "member")));

  const within30 = newMembers.filter(m => m.createdAt && new Date(m.createdAt) >= new Date(thirtyDaysAgo));
  const within60 = newMembers.filter(m => m.createdAt && new Date(m.createdAt) >= new Date(sixtyDaysAgo) && new Date(m.createdAt) < new Date(thirtyDaysAgo));
  const within90 = newMembers.filter(m => m.createdAt && new Date(m.createdAt) >= new Date(ninetyDaysAgo) && new Date(m.createdAt) < new Date(sixtyDaysAgo));

  async function getRetention(memberIds: number[], sinceDays: number): Promise<number> {
    if (memberIds.length === 0) return 0;
    const recent = getDateNDaysAgo(14);
    const active = await db.select({ memberId: attendance.memberId })
      .from(attendance)
      .where(and(eq(attendance.gymId, gymId), inArray(attendance.memberId, memberIds), gte(attendance.date, recent)));
    const activeSet = new Set(active.map(a => a.memberId));
    return Math.round((activeSet.size / memberIds.length) * 100);
  }

  const retention30 = await getRetention(within30.map(m => m.id), 30);
  const retention60 = await getRetention(within60.map(m => m.id), 60);
  const retention90 = await getRetention(within90.map(m => m.id), 90);

  return {
    type: "new_member_retention",
    data: { retention30day: { joined: within30.length, retentionRate: retention30 }, retention60day: { joined: within60.length, retentionRate: retention60 }, retention90day: { joined: within90.length, retentionRate: retention90 } },
    summary: `Member retention: 30-day cohort (${within30.length} joined): ${retention30}% still active. 60-day cohort (${within60.length} joined): ${retention60}% still active. 90-day cohort (${within90.length} joined): ${retention90}% still active.`,
  };
}

// ============================================================
// 27. TRAINER EFFECTIVENESS (Owner)
// ============================================================
export async function trainerEffectiveness(gymId: number): Promise<AnalyticsResult> {
  const trainers = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, "trainer")));

  if (trainers.length === 0) {
    return { type: "trainer_effectiveness", data: { hasTrainers: false }, summary: "No trainers in this gym." };
  }

  const thirtyDaysAgo = getDateNDaysAgo(30);

  const results = await Promise.all(trainers.map(async (trainer) => {
    const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, trainer.id)).limit(1);

    const assignments = await db.select({ memberId: trainerMemberAssignments.memberId })
      .from(trainerMemberAssignments)
      .where(and(eq(trainerMemberAssignments.trainerId, trainer.id), eq(trainerMemberAssignments.gymId, gymId)));

    const memberIds = assignments.map(a => a.memberId);
    if (memberIds.length === 0) return { trainerId: trainer.id, name: profile?.fullName || trainer.username, assignedMembers: 0, avgAttendance: 0, avgWorkouts: 0, score: 0 };

    const [attendanceResult] = await db.select({ cnt: count() })
      .from(attendance)
      .where(and(eq(attendance.gymId, gymId), inArray(attendance.memberId, memberIds), gte(attendance.date, thirtyDaysAgo)));

    const [workoutResult] = await db.select({ cnt: sql<number>`count(distinct ${workoutCompletions.memberId} || '-' || ${workoutCompletions.completedDate})` })
      .from(workoutCompletions)
      .where(and(inArray(workoutCompletions.memberId, memberIds), gte(workoutCompletions.completedDate, thirtyDaysAgo)));

    const avgAttendance = memberIds.length > 0 ? Math.round((Number(attendanceResult?.cnt) || 0) / memberIds.length) : 0;
    const avgWorkouts = memberIds.length > 0 ? Math.round((Number(workoutResult?.cnt) || 0) / memberIds.length) : 0;
    const score = Math.min(100, Math.round(avgAttendance * 2.5 + avgWorkouts * 3));

    return { trainerId: trainer.id, name: profile?.fullName || trainer.username, assignedMembers: memberIds.length, avgAttendance, avgWorkouts, score };
  }));

  const sorted = results.sort((a, b) => b.score - a.score);

  return {
    type: "trainer_effectiveness",
    data: { hasTrainers: true, trainers: sorted },
    summary: `Trainer effectiveness (last 30 days): ${sorted.map(t => `${t.name}: ${t.assignedMembers} members, avg ${t.avgAttendance} attendance, ${t.avgWorkouts} workouts, score ${t.score}/100`).join(". ")}.`,
  };
}

// ============================================================
// 28. PERIOD COMPARISON
// ============================================================
export async function periodComparison(userId: number, gymId: number | null, role: string, metric: string = "all"): Promise<AnalyticsResult> {
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const thisMonthStr = thisMonthStart.toISOString().split("T")[0];

  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthStr = lastMonthStart.toISOString().split("T")[0];

  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
  const lastMonthEndStr = lastMonthEnd.toISOString().split("T")[0];

  const today = new Date().toISOString().split("T")[0];

  if (role === "owner" && gymId) {
    const [thisAttendance] = await db.select({ cnt: count() }).from(attendance).where(and(eq(attendance.gymId, gymId), gte(attendance.date, thisMonthStr)));
    const [lastAttendance] = await db.select({ cnt: count() }).from(attendance).where(and(eq(attendance.gymId, gymId), gte(attendance.date, lastMonthStr), lte(attendance.date, lastMonthEndStr)));
    const [thisRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` }).from(paymentTransactions).where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, thisMonthStr)));
    const [lastRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` }).from(paymentTransactions).where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, lastMonthStr), lte(paymentTransactions.paidOn, lastMonthEndStr)));

    const comparison = {
      attendance: { thisMonth: Number(thisAttendance?.cnt) || 0, lastMonth: Number(lastAttendance?.cnt) || 0, change: pctChange(Number(thisAttendance?.cnt) || 0, Number(lastAttendance?.cnt) || 0) },
      revenue: { thisMonth: Math.round((Number(thisRevenue?.total) || 0) / 100), lastMonth: Math.round((Number(lastRevenue?.total) || 0) / 100), change: pctChange(Number(thisRevenue?.total) || 0, Number(lastRevenue?.total) || 0) },
    };

    return {
      type: "period_comparison",
      data: { role: "owner", comparison },
      summary: `Month comparison: Attendance ${comparison.attendance.change >= 0 ? "up" : "down"} ${Math.abs(comparison.attendance.change)}% (${comparison.attendance.lastMonth} → ${comparison.attendance.thisMonth}). Revenue ${comparison.revenue.change >= 0 ? "up" : "down"} ${Math.abs(comparison.revenue.change)}% (${comparison.revenue.lastMonth.toLocaleString()} → ${comparison.revenue.thisMonth.toLocaleString()}).`,
    };
  }

  const [thisWorkouts] = await db.select({ cnt: sql<number>`count(distinct ${workoutCompletions.completedDate})` }).from(workoutCompletions).where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, thisMonthStr)));
  const [lastWorkouts] = await db.select({ cnt: sql<number>`count(distinct ${workoutCompletions.completedDate})` }).from(workoutCompletions).where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, lastMonthStr), lte(workoutCompletions.completedDate, lastMonthEndStr)));

  const [thisCals] = await db.select({ total: sql<number>`COALESCE(SUM(${foodLogs.calories}), 0)`, days: sql<number>`count(distinct ${foodLogs.date})` }).from(foodLogs).where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, thisMonthStr)));
  const [lastCals] = await db.select({ total: sql<number>`COALESCE(SUM(${foodLogs.calories}), 0)`, days: sql<number>`count(distinct ${foodLogs.date})` }).from(foodLogs).where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, lastMonthStr), lte(foodLogs.date, lastMonthEndStr)));

  const thisAvgCal = Number(thisCals?.days) > 0 ? Math.round(Number(thisCals?.total) / Number(thisCals?.days)) : 0;
  const lastAvgCal = Number(lastCals?.days) > 0 ? Math.round(Number(lastCals?.total) / Number(lastCals?.days)) : 0;

  const comparison = {
    workouts: { thisMonth: Number(thisWorkouts?.cnt) || 0, lastMonth: Number(lastWorkouts?.cnt) || 0, change: pctChange(Number(thisWorkouts?.cnt) || 0, Number(lastWorkouts?.cnt) || 0) },
    avgDailyCalories: { thisMonth: thisAvgCal, lastMonth: lastAvgCal, change: pctChange(thisAvgCal, lastAvgCal) },
  };

  return {
    type: "period_comparison",
    data: { role: "member", comparison },
    summary: `Month comparison: Workouts ${comparison.workouts.change >= 0 ? "up" : "down"} ${Math.abs(comparison.workouts.change)}% (${comparison.workouts.lastMonth} → ${comparison.workouts.thisMonth}). Avg daily calories ${comparison.avgDailyCalories.change >= 0 ? "up" : "down"} ${Math.abs(comparison.avgDailyCalories.change)}% (${comparison.avgDailyCalories.lastMonth} → ${comparison.avgDailyCalories.thisMonth}).`,
  };
}

// ============================================================
// 29. FULL SYNTHESIS - Multi-metric combined overview
// ============================================================
async function fullSynthesis(userId: number, gymId: number | null, params: any = {}): Promise<AnalyticsResult> {
  const period = params.period || "8_weeks";
  const days = periodToDays(period);
  const startDate = getDateNDaysAgo(days);
  const today = new Date().toISOString().split("T")[0];

  const workoutRows = await db.select({
    date: workoutCompletions.completedDate,
  }).from(workoutCompletions)
    .where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, startDate)));
  const totalWorkouts = workoutRows.length;
  const workoutDays = new Set(workoutRows.map(r => r.date)).size;
  const consistencyPct = Math.round((workoutDays / days) * 100);

  const completionsRaw = await db.select({
    sets: workoutCompletions.actualSets,
    itemId: workoutCompletions.workoutItemId,
  }).from(workoutCompletions)
    .where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, startDate)));

  const itemIds = Array.from(new Set(completionsRaw.filter(c => c.itemId).map(c => c.itemId!)));
  let itemMuscleMap: Record<number, string> = {};
  if (itemIds.length > 0) {
    const items = await db.select({ id: workoutItems.id, muscleType: workoutItems.muscleType })
      .from(workoutItems).where(sql`${workoutItems.id} IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})`);
    for (const item of items) {
      itemMuscleMap[item.id] = item.muscleType || "unknown";
    }
  }

  const muscleMap: Record<string, number> = {};
  for (const r of completionsRaw) {
    const m = (r.itemId ? itemMuscleMap[r.itemId] || "unknown" : "unknown").toLowerCase();
    muscleMap[m] = (muscleMap[m] || 0) + (r.sets || 0);
  }
  const topMuscle = Object.entries(muscleMap).sort((a, b) => b[1] - a[1])[0];
  const bottomMuscle = Object.entries(muscleMap).sort((a, b) => a[1] - b[1])[0];

  const nutritionRows = await db.select({
    calories: foodLogs.calories,
    protein: foodLogs.protein,
    carbs: foodLogs.carbs,
    fat: foodLogs.fat,
    date: foodLogs.date,
  }).from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const nutritionDays = new Set(nutritionRows.map(r => r.date)).size;
  const totalCals = nutritionRows.reduce((s, r) => s + (Number(r.calories) || 0), 0);
  const totalProtein = nutritionRows.reduce((s, r) => s + (Number(r.protein) || 0), 0);
  const totalCarbs = nutritionRows.reduce((s, r) => s + (Number(r.carbs) || 0), 0);
  const totalFat = nutritionRows.reduce((s, r) => s + (Number(r.fat) || 0), 0);
  const avgDailyCals = nutritionDays > 0 ? Math.round(totalCals / nutritionDays) : 0;
  const avgDailyProtein = nutritionDays > 0 ? Math.round(totalProtein / nutritionDays) : 0;

  const bodyRows = await db.select({
    weight: bodyMeasurements.weight,
    bodyFat: bodyMeasurements.bodyFat,
    date: bodyMeasurements.recordedDate,
  }).from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.memberId, userId), gte(bodyMeasurements.recordedDate, startDate)))
    .orderBy(asc(bodyMeasurements.recordedDate));

  let weightChange: string | null = null;
  if (bodyRows.length >= 2) {
    const first = parseFloat(bodyRows[0].weight as any);
    const last = parseFloat(bodyRows[bodyRows.length - 1].weight as any);
    if (!isNaN(first) && !isNaN(last)) {
      const diff = last - first;
      weightChange = `${diff > 0 ? "+" : ""}${diff.toFixed(1)} (${first.toFixed(1)} → ${last.toFixed(1)})`;
    }
  }

  const healthRows = await db.select({
    steps: healthData.steps,
    sleepMinutes: healthData.sleepMinutes,
    heartRate: healthData.restingHeartRate,
  }).from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, startDate)));

  const avgSteps = healthRows.length > 0 ? Math.round(healthRows.reduce((s, r) => s + (Number(r.steps) || 0), 0) / healthRows.length) : null;
  const avgSleepMin = healthRows.length > 0 ? healthRows.reduce((s, r) => s + (Number(r.sleepMinutes) || 0), 0) / healthRows.length : 0;
  const avgSleep = healthRows.length > 0 ? (avgSleepMin / 60).toFixed(1) : null;

  const matchRows = await db.select({ id: matchLogs.id }).from(matchLogs)
    .where(and(eq(matchLogs.userId, userId), gte(matchLogs.matchDate, startDate)));
  const totalMatches = matchRows.length;

  const synthesis = {
    periodDays: days,
    periodLabel: period,
    training: {
      totalWorkouts,
      workoutDays,
      consistencyPct,
      topMuscle: topMuscle ? { name: topMuscle[0], sets: topMuscle[1] } : null,
      bottomMuscle: bottomMuscle ? { name: bottomMuscle[0], sets: bottomMuscle[1] } : null,
      muscleBreakdown: muscleMap,
    },
    nutrition: {
      daysLogged: nutritionDays,
      avgDailyCalories: avgDailyCals,
      avgDailyProtein: avgDailyProtein,
      totalCalories: totalCals,
      macroSplit: nutritionDays > 0 ? {
        proteinPct: Math.round((totalProtein * 4 / totalCals) * 100) || 0,
        carbsPct: Math.round((totalCarbs * 4 / totalCals) * 100) || 0,
        fatPct: Math.round((totalFat * 9 / totalCals) * 100) || 0,
      } : null,
    },
    body: {
      measurements: bodyRows.length,
      weightChange,
    },
    health: {
      daysTracked: healthRows.length,
      avgSteps,
      avgSleep,
    },
    sport: {
      totalMatches,
    },
  };

  const summaryParts: string[] = [];
  summaryParts.push(`${days}-day synthesis:`);
  summaryParts.push(`Training: ${totalWorkouts} workouts across ${workoutDays} days (${consistencyPct}% consistency).`);
  if (topMuscle) summaryParts.push(`Most trained: ${topMuscle[0]} (${topMuscle[1]} sets). Least: ${bottomMuscle?.[0]} (${bottomMuscle?.[1]} sets).`);
  summaryParts.push(`Nutrition: ${nutritionDays} days logged, avg ${avgDailyCals} cal/day, ${avgDailyProtein}g protein/day.`);
  if (weightChange) summaryParts.push(`Weight: ${weightChange}.`);
  if (avgSteps) summaryParts.push(`Health: avg ${avgSteps} steps/day, ${avgSleep}h sleep.`);
  if (totalMatches > 0) summaryParts.push(`Sport: ${totalMatches} matches played.`);

  return {
    type: "full_synthesis",
    data: synthesis,
    summary: summaryParts.join(" "),
  };
}

// ============================================================
// INTENT REGISTRY - Maps intents to functions
// ============================================================
export const ANALYTICS_INTENTS: Record<string, {
  fn: (userId: number, gymId: number | null, params: any) => Promise<AnalyticsResult>;
  ownerOnly?: boolean;
  memberOnly?: boolean;
}> = {
  workout_frequency_trend: { fn: (u, _, p) => workoutFrequencyTrend(u, p.period), memberOnly: true },
  muscle_volume_analysis: { fn: (u, _, p) => muscleVolumeAnalysis(u, p.period, p.muscle), memberOnly: true },
  strength_progression: { fn: (u, _, p) => strengthProgression(u, p.exercise, p.period), memberOnly: true },
  training_load_trend: { fn: (u, _, p) => trainingLoadTrend(u, p.period), memberOnly: true },
  workout_consistency: { fn: (u, _, p) => workoutConsistencyAnalysis(u, p.period), memberOnly: true },
  exercise_frequency_ranking: { fn: (u, _, p) => exerciseFrequencyRanking(u, p.period), memberOnly: true },
  rest_day_pattern: { fn: (u, _, p) => restDayPatternAnalysis(u, p.period), memberOnly: true },
  workout_completion_rate: { fn: (u, _, p) => workoutCompletionRate(u, p.period), memberOnly: true },
  day_of_week_patterns: { fn: (u, _, p) => dayOfWeekPatterns(u, p.period), memberOnly: true },
  calorie_trend: { fn: (u, _, p) => calorieTrend(u, p.period), memberOnly: true },
  protein_adherence: { fn: (u, _, p) => proteinAdherenceRate(u, p.period), memberOnly: true },
  macro_balance_trend: { fn: (u, _, p) => macroBalanceTrend(u, p.period), memberOnly: true },
  meal_timing_patterns: { fn: (u, _, p) => mealTimingPatterns(u, p.period), memberOnly: true },
  water_intake_consistency: { fn: (u, _, p) => waterIntakeConsistency(u, p.period), memberOnly: true },
  calorie_goal_adherence: { fn: (u, _, p) => calorieGoalAdherence(u, p.period), memberOnly: true },
  body_composition_trend: { fn: (u, _, p) => bodyCompositionTrend(u, p.period), memberOnly: true },
  health_metrics_trend: { fn: (u, _, p) => healthMetricsTrend(u, p.period), memberOnly: true },
  recovery_score_history: { fn: (u, _, p) => recoveryScoreHistory(u, p.period), memberOnly: true },
  activity_nutrition_correlation: { fn: (u, _, p) => activityNutritionCorrelation(u, p.period), memberOnly: true },
  match_frequency_trend: { fn: (u, _, p) => matchFrequencyTrend(u, p.period), memberOnly: true },
  sport_performance_correlation: { fn: (u, _, p) => sportPerformanceCorrelation(u, p.period), memberOnly: true },
  churn_risk_scoring: { fn: (_, g, __) => memberChurnRiskScoring(g!), ownerOnly: true },
  attendance_trend_per_member: { fn: (_, g, p) => attendanceTrendPerMember(g!, p.memberId), ownerOnly: true },
  revenue_trend: { fn: (_, g, p) => revenueTrend(g!, p.period), ownerOnly: true },
  gym_utilization_patterns: { fn: (_, g, p) => gymUtilizationPatterns(g!, p.period), ownerOnly: true },
  new_member_retention: { fn: (_, g, __) => newMemberRetentionRate(g!), ownerOnly: true },
  trainer_effectiveness: { fn: (_, g, __) => trainerEffectiveness(g!), ownerOnly: true },
  period_comparison: { fn: (u, g, p) => periodComparison(u, g, p.role || "member"), },
  full_synthesis: { fn: (u, g, p) => fullSynthesis(u, g, p), memberOnly: true },
};

export async function executeAnalytics(intent: string, userId: number, gymId: number | null, params: any = {}): Promise<AnalyticsResult | null> {
  const entry = ANALYTICS_INTENTS[intent];
  if (!entry) return null;
  try {
    return await entry.fn(userId, gymId, params);
  } catch (error) {
    console.error(`Analytics computation failed for ${intent}:`, error);
    return null;
  }
}
