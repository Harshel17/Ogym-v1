import { storage } from "./storage";
import { dailyDisciplineScores, ogymScores, disciplineSettings } from "@shared/schema";
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

export async function calculateDailyScore(userId: number, date: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const gymId = user.gymId || null;
  const isToday = date === formatDate(new Date());
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

export async function calculateFitnessCredit(userId: number): Promise<any> {
  const today = formatDate(new Date());
  const windowStart = addDays(today, -29);

  const dailyScores = await db.select().from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, windowStart),
      lte(dailyDisciplineScores.date, today),
    ))
    .orderBy(desc(dailyDisciplineScores.date));

  const daysWithScores = dailyScores.length;
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

async function backfillMissingDailyScores(userId: number, days: number = 30) {
  const today = formatDate(new Date());
  const startDate = addDays(today, -days);

  const existing = await db.select({ date: dailyDisciplineScores.date })
    .from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, startDate),
      lte(dailyDisciplineScores.date, today),
    ));

  const existingDates = new Set(existing.map(e => e.date));

  const user = await storage.getUser(userId);
  if (!user) return;

  const userCreatedDate = user.createdAt ? formatDate(new Date(user.createdAt)) : startDate;
  const effectiveStart = userCreatedDate > startDate ? userCreatedDate : startDate;

  let filled = 0;
  for (let i = 0; i <= days; i++) {
    const dateStr = addDays(today, -i);
    if (dateStr < effectiveStart) break;
    if (dateStr === today) continue;
    if (existingDates.has(dateStr)) continue;

    try {
      await calculateDailyScore(userId, dateStr);
      filled++;
    } catch (e) {
      console.log(`[DisciplineScore] Could not backfill ${dateStr} for user ${userId}:`, e);
    }
  }

  if (filled > 0) {
    console.log(`[DisciplineScore] Backfilled ${filled} daily scores for user ${userId}`);
  }
}

const backfillCompleted = new Set<number>();

export async function getScoreToday(userId: number, forceRefresh: boolean = false) {
  const today = formatDate(new Date());

  if (!backfillCompleted.has(userId)) {
    try {
      await backfillMissingDailyScores(userId, 30);
      backfillCompleted.add(userId);
    } catch (e) {
      console.log(`[DisciplineScore] Backfill error for user ${userId}:`, e);
    }
  }

  const calculated = await calculateDailyScore(userId, today);
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
    fitnessCredit = await calculateFitnessCredit(userId);
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
        activity: { score: ds.activityScore || 0, weight: Math.round(pillarWeights.activity * 100), color: getScoreColor(ds.activityScore || 0), enabled: selectedPillars.includes("activity") },
        recovery: { score: ds.recoveryScore, weight: Math.round(pillarWeights.recovery * 100), color: getScoreColor(ds.recoveryScore), enabled: selectedPillars.includes("recovery") },
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

export async function getDailyScoreHistory(userId: number, days: number = 30) {
  const today = formatDate(new Date());
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
