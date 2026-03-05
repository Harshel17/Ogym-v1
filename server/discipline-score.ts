import { storage } from "./storage";
import { dailyDisciplineScores, ogymScores, disciplineSettings, scoreLeagues, healthData } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte } from "drizzle-orm";

type Pillar = "workout" | "nutrition" | "activity" | "recovery";

const PILLAR_BASE_WEIGHTS: Record<Pillar, number> = {
  workout: 40,
  nutrition: 30,
  activity: 20,
  recovery: 10,
};

const ALL_PILLARS: Pillar[] = ["workout", "nutrition", "activity", "recovery"];
const DEFAULT_PILLARS: Pillar[] = ["workout", "activity"];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db2 = new Date(b + "T00:00:00");
  return Math.round((db2.getTime() - da.getTime()) / 86400000);
}

function getScoreColor(score: number): string {
  if (score >= 90) return "green";
  if (score >= 70) return "blue";
  if (score >= 50) return "yellow";
  if (score >= 30) return "orange";
  return "red";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Low";
  return "Needs Attention";
}

function getTier(score: number): string {
  if (score >= 750) return "elite";
  if (score >= 650) return "strong";
  if (score >= 500) return "building";
  if (score >= 400) return "inconsistent";
  return "at_risk";
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    elite: "Elite",
    strong: "Strong",
    building: "Building",
    inconsistent: "Inconsistent",
    at_risk: "At Risk",
  };
  return labels[tier] || "Building";
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    elite: "gold",
    strong: "green",
    building: "blue",
    inconsistent: "orange",
    at_risk: "red",
  };
  return colors[tier] || "blue";
}

function redistributeWeights(selectedPillars: Pillar[]): Record<Pillar, number> {
  const totalWeight = selectedPillars.reduce((sum, p) => sum + PILLAR_BASE_WEIGHTS[p], 0);
  const weights: Record<string, number> = {};
  for (const p of ALL_PILLARS) {
    weights[p] = selectedPillars.includes(p) ? PILLAR_BASE_WEIGHTS[p] / totalWeight : 0;
  }
  return weights as Record<Pillar, number>;
}

async function getUserPillars(userId: number): Promise<Pillar[]> {
  const [settings] = await db.select().from(disciplineSettings)
    .where(eq(disciplineSettings.userId, userId))
    .limit(1);
  if (settings?.selectedPillars && Array.isArray(settings.selectedPillars)) {
    return (settings.selectedPillars as string[]).filter(p => ALL_PILLARS.includes(p as Pillar)) as Pillar[];
  }
  return DEFAULT_PILLARS;
}

export async function calculateDailyScore(userId: number, date: string, referenceToday?: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const gymId = user.gymId || null;
  const todayRef = referenceToday || formatDate(new Date());
  const isToday = date === todayRef;
  const selectedPillars = await getUserPillars(userId);
  const weights = redistributeWeights(selectedPillars);

  const [completions, summary, calorieGoal, healthRecord, stats, cycle] = await Promise.all([
    storage.getCompletions(userId, date),
    storage.getDailySummary(userId, date),
    storage.getCalorieGoal(userId),
    storage.getHealthData(userId, date),
    storage.getMemberStats(userId, gymId),
    storage.getMemberCycle(userId),
  ]);

  const reasons: { pillar: string; delta: string; text: string }[] = [];
  const tips: string[] = [];

  // === WORKOUT PILLAR (0-100) ===
  let workoutScore = 0;
  if (cycle) {
    const dayLabels = cycle.dayLabels || [];
    const restDays = cycle.restDays || [];
    const cycleLen = cycle.cycleLength || dayLabels.length || 1;

    let dayIndex: number;
    if (cycle.progressionMode === "completion") {
      dayIndex = cycle.currentDayIndex || 0;
    } else {
      const start = new Date(cycle.startDate + "T00:00:00");
      const current = new Date(date + "T00:00:00");
      const diff = Math.round((current.getTime() - start.getTime()) / 86400000);
      dayIndex = ((diff % cycleLen) + cycleLen) % cycleLen;
    }

    const isRestDay = restDays.includes(dayIndex);
    const dayLabel = dayLabels[dayIndex] || "";
    const isRestLabel = dayLabel.toLowerCase().includes("rest");

    if (isRestDay || isRestLabel) {
      workoutScore = completions.length === 0 ? 100 : 90;
      reasons.push({ pillar: "workout", delta: "+0", text: "Rest day — recovery counts" });
    } else if (completions.length > 0) {
      workoutScore = 100;
      reasons.push({ pillar: "workout", delta: "+full", text: `Completed ${dayLabel || "workout"}` });
    } else if (isToday) {
      workoutScore = 30;
      reasons.push({ pillar: "workout", delta: "~", text: `${dayLabel || "Workout"} scheduled — pending` });
      tips.push("Complete your workout to max out this pillar");
    } else {
      workoutScore = 0;
      reasons.push({ pillar: "workout", delta: "-", text: `Missed scheduled ${dayLabel || "workout"}` });
    }
  } else {
    if (completions.length > 0) {
      workoutScore = 80;
      reasons.push({ pillar: "workout", delta: "+", text: "Logged a workout (no active cycle)" });
    } else if (isToday) {
      workoutScore = 30;
      reasons.push({ pillar: "workout", delta: "~", text: "No workout yet — day in progress" });
    } else {
      workoutScore = 0;
      reasons.push({ pillar: "workout", delta: "-", text: "No workout logged" });
    }
  }

  // === NUTRITION PILLAR (0-100) ===
  let nutritionScore = 0;
  const hasFood = summary.calories > 0;

  if (!hasFood && isToday) {
    nutritionScore = 15;
    reasons.push({ pillar: "nutrition", delta: "~", text: "No meals logged yet — pending" });
    tips.push("Log a meal to boost your nutrition score");
  } else if (!hasFood) {
    nutritionScore = selectedPillars.includes("nutrition") ? 10 : 0;
    reasons.push({ pillar: "nutrition", delta: "-", text: "No meals logged" });
  } else if (calorieGoal) {
    const target = calorieGoal.dailyCalorieTarget || 2000;
    const proteinTarget = calorieGoal.dailyProteinTarget || 120;
    const calorieAccuracy = Math.max(0, 100 - Math.abs(summary.calories - target) / target * 100);
    const proteinHit = proteinTarget > 0 ? Math.min(100, (summary.protein / proteinTarget) * 100) : 50;
    nutritionScore = clamp(calorieAccuracy * 0.6 + proteinHit * 0.4, 0, 100);

    if (nutritionScore >= 80) {
      reasons.push({ pillar: "nutrition", delta: "+", text: "Nailed your calorie and protein targets" });
    } else if (summary.protein < proteinTarget) {
      reasons.push({ pillar: "nutrition", delta: "-", text: `Missed protein target by ${Math.round(proteinTarget - summary.protein)}g` });
    } else {
      reasons.push({ pillar: "nutrition", delta: "-", text: "Calorie target was off" });
    }
  } else {
    nutritionScore = 80;
    reasons.push({ pillar: "nutrition", delta: "+", text: "Food logged (no calorie goal set)" });
    tips.push("Set a calorie goal for more accurate scoring");
  }

  // === ACTIVITY PILLAR (0-100) ===
  let activityScore = 0;
  const steps = healthRecord?.steps || 0;
  const TARGET_STEPS = 7000;

  if (steps > 0) {
    activityScore = clamp(Math.round((steps / TARGET_STEPS) * 100), 0, 100);
    if (activityScore >= 80) {
      reasons.push({ pillar: "activity", delta: "+", text: `${steps.toLocaleString()} steps — great movement` });
    } else {
      reasons.push({ pillar: "activity", delta: "~", text: `${steps.toLocaleString()} steps (target: ${TARGET_STEPS.toLocaleString()})` });
    }
  } else if (isToday) {
    activityScore = 10;
    reasons.push({ pillar: "activity", delta: "~", text: "Activity tracking in progress" });
  } else {
    activityScore = selectedPillars.includes("activity") ? 10 : 0;
    reasons.push({ pillar: "activity", delta: "-", text: "No activity data recorded" });
  }

  // === RECOVERY PILLAR (0-100) ===
  let recoveryScore = 0;

  if (healthRecord) {
    let rScore = 0;
    let totalWeight = 0;

    if (healthRecord.sleepMinutes) {
      const sleepHours = healthRecord.sleepMinutes / 60;
      const sleepScore = sleepHours >= 7 ? 100 : sleepHours >= 6 ? 75 : sleepHours >= 5 ? 50 : 25;
      rScore += sleepScore * 0.5;
      totalWeight += 0.5;
    }

    if (healthRecord.restingHeartRate) {
      const hr = healthRecord.restingHeartRate;
      const hrScore = hr <= 55 ? 100 : hr <= 65 ? 80 : hr <= 75 ? 60 : 40;
      rScore += hrScore * 0.3;
      totalWeight += 0.3;
    }

    if (healthRecord.hrv) {
      const hrvScore = healthRecord.hrv >= 60 ? 100 : healthRecord.hrv >= 40 ? 75 : healthRecord.hrv >= 20 ? 50 : 25;
      rScore += hrvScore * 0.2;
      totalWeight += 0.2;
    }

    if (totalWeight > 0) {
      recoveryScore = clamp(rScore / totalWeight, 0, 100);
    } else {
      recoveryScore = isToday ? 50 : (selectedPillars.includes("recovery") ? 15 : 50);
    }

    reasons.push({ pillar: "recovery", delta: recoveryScore >= 70 ? "+" : "-", text: recoveryScore >= 70 ? "Good recovery signals" : "Recovery could be better — prioritize sleep" });
  } else if (isToday) {
    recoveryScore = 50;
    reasons.push({ pillar: "recovery", delta: "~", text: "No health data yet — connect a device" });
  } else {
    recoveryScore = selectedPillars.includes("recovery") ? 15 : 50;
    reasons.push({ pillar: "recovery", delta: "-", text: "No recovery data" });
  }

  // === FINAL DAILY SCORE ===
  const rawScore =
    workoutScore * weights.workout +
    nutritionScore * weights.nutrition +
    activityScore * weights.activity +
    recoveryScore * weights.recovery;

  const totalScore = clamp(Math.max(rawScore, 10), 10, 100);

  // === STREAK CHECK ===
  const streak = stats.streak;
  if (streak >= 7) {
    reasons.push({ pillar: "streak", delta: "+", text: `${streak}-day streak! On fire` });
  } else if (streak >= 3) {
    reasons.push({ pillar: "streak", delta: "+", text: `${streak}-day streak and counting` });
  } else if (streak === 0) {
    reasons.push({ pillar: "streak", delta: "-", text: "Streak broken — time to restart" });
  }

  const breakdown = {
    reasons,
    tips,
    selectedPillars,
    weights,
    pillarDetails: {
      workout: { score: workoutScore, hasCycle: !!cycle, completedCount: completions.length, color: getScoreColor(workoutScore) },
      nutrition: {
        score: nutritionScore,
        calorieTarget: calorieGoal?.dailyCalorieTarget || null,
        calorieActual: summary.calories,
        proteinTarget: calorieGoal?.dailyProteinTarget || null,
        proteinActual: summary.protein,
        logged: hasFood,
        color: getScoreColor(nutritionScore),
      },
      activity: { score: activityScore, steps, targetSteps: TARGET_STEPS, color: getScoreColor(activityScore) },
      recovery: {
        score: recoveryScore,
        source: healthRecord ? "healthkit" : "fallback",
        sleepHours: healthRecord?.sleepMinutes ? Math.round(healthRecord.sleepMinutes / 60 * 10) / 10 : null,
        restingHR: healthRecord?.restingHeartRate || null,
        color: getScoreColor(recoveryScore),
      },
    },
  };

  const existing = await db.select().from(dailyDisciplineScores)
    .where(and(eq(dailyDisciplineScores.userId, userId), eq(dailyDisciplineScores.date, date)))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].finalized && !isToday) {
      return existing[0];
    }
    const [updated] = await db.update(dailyDisciplineScores)
      .set({
        score: totalScore,
        workoutScore: clamp(workoutScore, 0, 100),
        nutritionScore: clamp(nutritionScore, 0, 100),
        consistencyScore: 0,
        recoveryScore: clamp(recoveryScore, 0, 100),
        activityScore: clamp(activityScore, 0, 100),
        breakdown,
        finalized: !isToday,
      })
      .where(eq(dailyDisciplineScores.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(dailyDisciplineScores).values({
    userId,
    date,
    score: totalScore,
    workoutScore: clamp(workoutScore, 0, 100),
    nutritionScore: clamp(nutritionScore, 0, 100),
    consistencyScore: 0,
    recoveryScore: clamp(recoveryScore, 0, 100),
    activityScore: clamp(activityScore, 0, 100),
    breakdown,
    finalized: !isToday,
  }).returning();

  return inserted;
}

export async function calculateFitnessCredit(userId: number, localDate?: string): Promise<any> {
  const today = localDate || formatDate(new Date());
  const windowStart = addDays(today, -29);

  const dailyScores = await db.select().from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, windowStart),
      lte(dailyDisciplineScores.date, today),
    ))
    .orderBy(desc(dailyDisciplineScores.date));

  const ACTIVE_THRESHOLD = 25;
  const activeDays = dailyScores.filter(s => s.score > ACTIVE_THRESHOLD);
  const daysWithScores = activeDays.length;
  const REQUIRED_DAYS = 21;
  const MIN_ACTIVE_DAYS = 18;

  if (daysWithScores < MIN_ACTIVE_DAYS) {
    return {
      building: true,
      daysCompleted: daysWithScores,
      daysRequired: REQUIRED_DAYS,
      progress: Math.round((daysWithScores / REQUIRED_DAYS) * 100),
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ds of dailyScores) {
    const daysAgo = daysBetween(ds.date, today);
    let weight: number;
    if (daysAgo <= 7) weight = 1.0;
    else if (daysAgo <= 14) weight = 0.8;
    else if (daysAgo <= 21) weight = 0.6;
    else weight = 0.4;

    weightedSum += ds.score * weight;
    totalWeight += weight;
  }

  const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const creditScore = clamp(Math.round(weightedAvg * 10), 0, 1000);

  const tier = getTier(creditScore);

  const [prevOgym] = await db.select().from(ogymScores)
    .where(eq(ogymScores.userId, userId))
    .orderBy(desc(ogymScores.weekEndDate))
    .limit(1);

  const delta = prevOgym ? creditScore - prevOgym.score : 0;

  const scoreData = {
    userId,
    weekEndDate: today,
    score: creditScore,
    previousScore: prevOgym?.score || null,
    delta,
    workoutAdherence: 0,
    nutritionDiscipline: 0,
    consistency: 0,
    proteinCompliance: 0,
    recoveryRespect: 0,
    engagement: 0,
    gatesApplied: null,
    reasons: null,
    tier,
    windowStart,
    windowEnd: today,
  };

  const existing = await db.select().from(ogymScores)
    .where(and(eq(ogymScores.userId, userId), eq(ogymScores.weekEndDate, today)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(ogymScores)
      .set(scoreData)
      .where(eq(ogymScores.id, existing[0].id))
      .returning();
    return { ...updated, building: false, tierLabel: getTierLabel(tier), tierColor: getTierColor(tier) };
  }

  const [inserted] = await db.insert(ogymScores).values(scoreData).returning();
  return { ...inserted, building: false, tierLabel: getTierLabel(tier), tierColor: getTierColor(tier) };
}

async function backfillMissingDailyScores(userId: number, days: number = 30, localDate?: string) {
  const today = localDate || formatDate(new Date());
  const startDate = addDays(today, -days);

  const existing = await db.select({
    date: dailyDisciplineScores.date,
    finalized: dailyDisciplineScores.finalized,
    activityScore: dailyDisciplineScores.activityScore,
  })
    .from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, startDate),
      lte(dailyDisciplineScores.date, today),
    ));

  const existingMap = new Map(existing.map(e => [e.date, e]));

  const healthRecords = await db.select({
    date: healthData.date,
    steps: healthData.steps,
    lastSyncedAt: healthData.lastSyncedAt,
  })
    .from(healthData)
    .where(and(
      eq(healthData.userId, userId),
      gte(healthData.date, startDate),
      lte(healthData.date, today),
    ));

  const healthByDate = new Map(healthRecords.map(h => [h.date, h]));

  const user = await storage.getUser(userId);
  if (!user) return;

  const userCreatedDate = user.createdAt ? formatDate(new Date(user.createdAt)) : startDate;
  const effectiveStart = userCreatedDate > startDate ? userCreatedDate : startDate;

  let filled = 0;
  for (let i = 0; i <= days; i++) {
    const dateStr = addDays(today, -i);
    if (dateStr < effectiveStart) break;
    if (dateStr === today) continue;

    const existingScore = existingMap.get(dateStr);
    const healthRecord = healthByDate.get(dateStr);

    if (existingScore) {
      if (existingScore.finalized) continue;
      const hasNewHealth = healthRecord && healthRecord.steps && healthRecord.steps > 0 && (existingScore.activityScore === 0 || existingScore.activityScore === 10);
      if (!hasNewHealth) {
        await db.update(dailyDisciplineScores)
          .set({ finalized: true })
          .where(and(eq(dailyDisciplineScores.userId, userId), eq(dailyDisciplineScores.date, dateStr)));
        continue;
      }
    }

    try {
      await calculateDailyScore(userId, dateStr);
      filled++;
    } catch (e) {
      console.log(`[DisciplineScore] Could not backfill ${dateStr} for user ${userId}:`, e);
    }
  }

  if (filled > 0) {
    console.log(`[DisciplineScore] Backfilled/refreshed ${filled} daily scores for user ${userId}`);
  }
}

const backfillCompleted = new Set<number>();

export async function getScoreToday(userId: number, forceRefresh: boolean = false, localDate?: string) {
  const today = localDate || formatDate(new Date());

  if (!backfillCompleted.has(userId)) {
    try {
      await backfillMissingDailyScores(userId, 30, today);
      backfillCompleted.add(userId);
    } catch (e) {
      console.log(`[DisciplineScore] Backfill error for user ${userId}:`, e);
    }
  }

  const calculated = await calculateDailyScore(userId, today, today);
  const dailyScore = [calculated];

  const yesterday = addDays(today, -1);
  const [yesterdayScore] = await db.select().from(dailyDisciplineScores)
    .where(and(eq(dailyDisciplineScores.userId, userId), eq(dailyDisciplineScores.date, yesterday)))
    .limit(1);

  const last7 = await db.select().from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, addDays(today, -6)),
      lte(dailyDisciplineScores.date, today),
    ))
    .orderBy(desc(dailyDisciplineScores.date));

  const avg7Day = last7.length > 0
    ? Math.round(last7.reduce((sum, s) => sum + s.score, 0) / last7.length)
    : dailyScore[0].score;

  const dailyTrend = yesterdayScore
    ? dailyScore[0].score > yesterdayScore.score ? "up" : dailyScore[0].score < yesterdayScore.score ? "down" : "stable"
    : "stable";

  let fitnessCredit: any = null;
  try {
    fitnessCredit = await calculateFitnessCredit(userId, today);
  } catch (e) {
    const last30Start = addDays(today, -29);
    const recentScores = await db.select().from(dailyDisciplineScores)
      .where(and(
        eq(dailyDisciplineScores.userId, userId),
        gte(dailyDisciplineScores.date, last30Start),
        lte(dailyDisciplineScores.date, today),
      ));

    fitnessCredit = {
      building: true,
      daysCompleted: recentScores.length,
      daysRequired: 21,
      progress: Math.round((Math.min(recentScores.length, 21) / 21) * 100),
    };
  }

  const ds = dailyScore[0];
  const bd = ds.breakdown as any;
  const selectedPillars = bd?.selectedPillars || DEFAULT_PILLARS;
  const pillarWeights = bd?.weights || redistributeWeights(selectedPillars);

  const settings = await getSettings(userId);

  return {
    daily: {
      date: ds.date,
      score: ds.score,
      color: getScoreColor(ds.score),
      label: getScoreLabel(ds.score),
      avg7Day,
      trend: dailyTrend,
      isLive: true,
      pillars: {
        workout: { score: ds.workoutScore, weight: Math.round(pillarWeights.workout * 100), color: getScoreColor(ds.workoutScore), enabled: selectedPillars.includes("workout") },
        nutrition: { score: ds.nutritionScore, weight: Math.round(pillarWeights.nutrition * 100), color: getScoreColor(ds.nutritionScore), enabled: selectedPillars.includes("nutrition") },
        activity: { score: ds.activityScore || 0, weight: Math.round(pillarWeights.activity * 100), color: getScoreColor(ds.activityScore || 0), enabled: selectedPillars.includes("activity"), steps: bd?.pillarDetails?.activity?.steps ?? 0, targetSteps: bd?.pillarDetails?.activity?.targetSteps ?? 7000 },
        recovery: { score: ds.recoveryScore, weight: Math.round(pillarWeights.recovery * 100), color: getScoreColor(ds.recoveryScore), enabled: selectedPillars.includes("recovery"), sleepHours: bd?.pillarDetails?.recovery?.sleepHours ?? null, restingHR: bd?.pillarDetails?.recovery?.restingHR ?? null },
      },
      reasons: bd?.reasons || [],
      tips: bd?.tips || [],
      pillarDetails: bd?.pillarDetails || {},
    },
    yesterday: yesterdayScore ? {
      date: yesterdayScore.date,
      score: yesterdayScore.score,
      color: getScoreColor(yesterdayScore.score),
      label: getScoreLabel(yesterdayScore.score),
    } : null,
    fitnessCredit: fitnessCredit,
    settings: {
      selectedPillars: (settings.selectedPillars as string[]) || DEFAULT_PILLARS,
      setupCompleted: settings.setupCompleted || false,
      visibility: settings.visibility || "coach",
    },
  };
}

export async function getDailyScoreHistory(userId: number, days: number = 30, localDate?: string) {
  const today = localDate || formatDate(new Date());
  const startDate = addDays(today, -(days - 1));

  const scores = await db.select().from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, startDate),
      lte(dailyDisciplineScores.date, today),
    ))
    .orderBy(dailyDisciplineScores.date);

  return scores.map(s => ({
    ...s,
    color: getScoreColor(s.score),
    label: getScoreLabel(s.score),
  }));
}

export async function getOGymScoreHistory(userId: number, weeks: number = 12) {
  return await db.select().from(ogymScores)
    .where(eq(ogymScores.userId, userId))
    .orderBy(desc(ogymScores.weekEndDate))
    .limit(weeks);
}

export async function getSettings(userId: number) {
  const [settings] = await db.select().from(disciplineSettings)
    .where(eq(disciplineSettings.userId, userId))
    .limit(1);
  return settings || {
    userId,
    visibility: "coach",
    selectedPillars: DEFAULT_PILLARS,
    setupCompleted: false,
  };
}

export async function updateSettings(userId: number, data: {
  visibility?: string;
  selectedPillars?: string[];
  setupCompleted?: boolean;
}) {
  const existing = await db.select().from(disciplineSettings)
    .where(eq(disciplineSettings.userId, userId))
    .limit(1);

  const updateData: any = { updatedAt: new Date() };
  if (data.visibility !== undefined) updateData.visibility = data.visibility;
  if (data.selectedPillars !== undefined) updateData.selectedPillars = data.selectedPillars;
  if (data.setupCompleted !== undefined) updateData.setupCompleted = data.setupCompleted;

  if (existing.length > 0) {
    const [updated] = await db.update(disciplineSettings)
      .set(updateData)
      .where(eq(disciplineSettings.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(disciplineSettings).values({
    userId,
    visibility: data.visibility || "coach",
    selectedPillars: data.selectedPillars || DEFAULT_PILLARS,
    setupCompleted: data.setupCompleted || false,
  }).returning();
  return inserted;
}

export async function getTrainerMemberScores(trainerId: number) {
  const members = await storage.getTrainerMembers(trainerId);
  const today = formatDate(new Date());
  const results = [];

  for (const member of members) {
    const settings = await getSettings(member.id);
    if (settings.visibility === "private") continue;

    const [latestDaily] = await db.select().from(dailyDisciplineScores)
      .where(and(eq(dailyDisciplineScores.userId, member.id), eq(dailyDisciplineScores.date, today)))
      .limit(1);

    const [latestOgym] = await db.select().from(ogymScores)
      .where(eq(ogymScores.userId, member.id))
      .orderBy(desc(ogymScores.weekEndDate))
      .limit(1);

    results.push({
      memberId: member.id,
      name: member.fullName || member.username,
      dailyScore: latestDaily?.score || null,
      dailyColor: latestDaily ? getScoreColor(latestDaily.score) : null,
      fitnessCredit: latestOgym?.score || null,
      fitnessTier: latestOgym ? getTier(latestOgym.score) : null,
      fitnessTierLabel: latestOgym ? getTierLabel(getTier(latestOgym.score)) : null,
      building: !latestOgym,
    });
  }

  return results.sort((a, b) => (b.dailyScore || 0) - (a.dailyScore || 0));
}

export async function getOwnerDisciplineOverview(gymId: number) {
  const members = await storage.getGymMembers(gymId);
  const distribution = { elite: 0, strong: 0, building: 0, inconsistent: 0, at_risk: 0, no_score: 0 };
  let totalScore = 0;
  let scoredCount = 0;

  for (const member of members) {
    const settings = await getSettings(member.id);
    if (settings.visibility === "private") {
      distribution.no_score++;
      continue;
    }

    const [latestOgym] = await db.select().from(ogymScores)
      .where(eq(ogymScores.userId, member.id))
      .orderBy(desc(ogymScores.weekEndDate))
      .limit(1);

    if (latestOgym) {
      const tier = getTier(latestOgym.score);
      distribution[tier as keyof typeof distribution]++;
      totalScore += latestOgym.score;
      scoredCount++;
    } else {
      distribution.no_score++;
    }
  }

  return {
    totalMembers: members.length,
    scoredMembers: scoredCount,
    averageScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : null,
    averageTier: scoredCount > 0 ? getTier(Math.round(totalScore / scoredCount)) : null,
    distribution,
  };
}

export const calculateOGymScore = calculateFitnessCredit;

// === LEAGUES ===

const LEAGUE_CONFIG: Record<string, { label: string; pillars: string[] }> = {
  casual: { label: "Casual", pillars: ["workout"] },
  balanced: { label: "Balanced", pillars: ["workout", "nutrition", "activity"] },
  full_tracker: { label: "Full Tracker", pillars: ["workout", "nutrition", "activity", "recovery"] },
};

export async function joinLeague(userId: number, league: string) {
  if (!LEAGUE_CONFIG[league]) throw new Error("Invalid league");

  const existing = await db.select().from(scoreLeagues)
    .where(and(eq(scoreLeagues.userId, userId), eq(scoreLeagues.league, league)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [inserted] = await db.insert(scoreLeagues).values({ userId, league }).returning();
  return inserted;
}

export async function leaveLeague(userId: number, league: string) {
  await db.delete(scoreLeagues)
    .where(and(eq(scoreLeagues.userId, userId), eq(scoreLeagues.league, league)));
  return { success: true };
}

export async function getUserLeagues(userId: number) {
  return await db.select().from(scoreLeagues)
    .where(eq(scoreLeagues.userId, userId));
}

export async function getLeagueLeaderboard(gymId: number, league: string) {
  if (!LEAGUE_CONFIG[league]) throw new Error("Invalid league");

  const config = LEAGUE_CONFIG[league];
  const members = await storage.getGymMembers(gymId);
  const today = formatDate(new Date());

  const leagueMembers = await db.select().from(scoreLeagues)
    .where(eq(scoreLeagues.league, league));
  const leagueMemberIds = new Set(leagueMembers.map(m => m.userId));

  const gymLeagueMembers = members.filter(m => leagueMemberIds.has(m.id));

  const results: { userId: number; name: string; score: number; streak: number; color: string }[] = [];

  for (const member of gymLeagueMembers) {
    const settings = await getSettings(member.id);
    if (settings.visibility === "private") continue;

    const [latestDaily] = await db.select().from(dailyDisciplineScores)
      .where(and(eq(dailyDisciplineScores.userId, member.id), eq(dailyDisciplineScores.date, today)))
      .limit(1);

    if (!latestDaily) continue;

    const bd = latestDaily.breakdown as any;
    const pillarScores: Record<string, number> = {
      workout: latestDaily.workoutScore,
      nutrition: latestDaily.nutritionScore,
      activity: latestDaily.activityScore || 0,
      recovery: latestDaily.recoveryScore,
    };

    let leagueScore = 0;
    for (const p of config.pillars) {
      leagueScore += pillarScores[p] || 0;
    }
    leagueScore = Math.round(leagueScore / config.pillars.length);

    const stats = await storage.getMemberStats(member.id, gymId);

    results.push({
      userId: member.id,
      name: member.fullName || member.username,
      score: leagueScore,
      streak: stats.streak,
      color: getScoreColor(leagueScore),
    });
  }

  results.sort((a, b) => b.score - a.score);

  return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

// === SHARE CARD SVG ===

export async function generateShareCard(userId: number): Promise<string> {
  const today = formatDate(new Date());
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const [ds] = await db.select().from(dailyDisciplineScores)
    .where(and(eq(dailyDisciplineScores.userId, userId), eq(dailyDisciplineScores.date, today)))
    .limit(1);

  if (!ds) throw new Error("No score for today");

  const bd = ds.breakdown as any;
  const selectedPillars: string[] = bd?.selectedPillars || ["workout", "activity"];
  const stats = await storage.getMemberStats(userId, user.gymId);
  const streak = stats.streak;

  const scoreColor = {
    green: "#22c55e", blue: "#3b82f6", yellow: "#eab308", orange: "#f97316", red: "#ef4444"
  }[getScoreColor(ds.score)] || "#3b82f6";

  const pillarIcons: Record<string, string> = {
    workout: "M",
    nutrition: "N",
    activity: "A",
    recovery: "R",
  };

  const pillarScores: Record<string, number> = {
    workout: ds.workoutScore,
    nutrition: ds.nutritionScore,
    activity: ds.activityScore || 0,
    recovery: ds.recoveryScore,
  };

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (ds.score / 100) * circumference;
  const name = user.fullName || user.username;

  const pillarChecks = selectedPillars.map((p, i) => {
    const s = pillarScores[p] || 0;
    const c = s >= 70 ? "#22c55e" : s >= 50 ? "#eab308" : "#ef4444";
    const x = 60 + i * 90;
    return `
      <g transform="translate(${x}, 300)">
        <rect x="0" y="0" width="70" height="34" rx="8" fill="${c}22" stroke="${c}" stroke-width="1" />
        <text x="35" y="15" text-anchor="middle" fill="${c}" font-size="10" font-weight="700" font-family="system-ui">${pillarIcons[p]}</text>
        <text x="35" y="28" text-anchor="middle" fill="white" font-size="11" font-weight="800" font-family="system-ui">${s}</text>
      </g>`;
  }).join("");

  const streakBadge = streak >= 3 ? `
    <g transform="translate(170, 210)">
      <rect x="0" y="0" width="60" height="24" rx="12" fill="#f97316" fill-opacity="0.2" stroke="#f97316" stroke-width="1" />
      <path d="M16 6c0 0 -2 4 0 7c1 1.5 0 3 -1 3.5c2 -0.5 3.5 -2.5 2.5 -5c3 2 2 6 0 8c4 -2 5 -7 2 -10c0.5 1 0.5 2.5 0 4c-0.5 -2 -2 -4 -3.5 -7.5z" fill="#fb923c" transform="translate(6, 3) scale(0.7)" />
      <text x="35" y="16" fill="#fb923c" font-size="11" font-weight="700" font-family="system-ui">${streak}</text>
    </g>` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="420" viewBox="0 0 400 420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a14" />
      <stop offset="100%" stop-color="#1a1a2e" />
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${scoreColor}" />
      <stop offset="100%" stop-color="${scoreColor}cc" />
    </linearGradient>
  </defs>
  <rect width="400" height="420" rx="24" fill="url(#bg)" />
  <rect width="400" height="420" rx="24" fill="none" stroke="white" stroke-opacity="0.06" stroke-width="1" />

  <!-- Name -->
  <text x="200" y="45" text-anchor="middle" fill="white" font-size="16" font-weight="700" font-family="system-ui" opacity="0.9">${name}</text>
  <text x="200" y="65" text-anchor="middle" fill="white" font-size="11" font-weight="400" font-family="system-ui" opacity="0.4">${today}</text>

  <!-- Score Ring -->
  <g transform="translate(200, 150)">
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="white" stroke-opacity="0.06" stroke-width="8" />
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="url(#ring)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${progress} ${circumference}" transform="rotate(-90)" />
    <text x="0" y="8" text-anchor="middle" fill="white" font-size="42" font-weight="900" font-family="system-ui">${ds.score}</text>
    <text x="0" y="28" text-anchor="middle" fill="${scoreColor}" font-size="12" font-weight="600" font-family="system-ui">${getScoreLabel(ds.score)}</text>
  </g>

  ${streakBadge}

  <!-- Pillar Checks -->
  ${pillarChecks}

  <!-- Footer -->
  <text x="200" y="370" text-anchor="middle" fill="white" font-size="10" font-weight="500" font-family="system-ui" opacity="0.25">Powered by OGym</text>
  <rect x="60" y="385" width="280" height="1" fill="white" fill-opacity="0.06" rx="1" />
  <text x="200" y="405" text-anchor="middle" fill="white" font-size="9" font-weight="400" font-family="system-ui" opacity="0.15">ogym.app</text>
</svg>`;

  return svg;
}
