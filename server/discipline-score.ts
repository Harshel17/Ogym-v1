import { storage } from "./storage";
import { dailyDisciplineScores, ogymScores, disciplineSettings } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte } from "drizzle-orm";

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
  return Math.round((db2.getTime() - da.getTime()) / (86400000));
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

function getDailyLabel(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Building";
  if (score >= 25) return "Needs Work";
  return "Off Track";
}

export async function calculateDailyScore(userId: number, date: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const gymId = user.gymId || null;

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

  // === WORKOUT PILLAR (35%) ===
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
      reasons.push({ pillar: "workout", delta: "+12", text: `Completed ${dayLabel || "workout"}` });
    } else {
      workoutScore = 0;
      reasons.push({ pillar: "workout", delta: "-15", text: `Missed scheduled ${dayLabel || "workout"}` });
      tips.push("Even a 20-minute session keeps your score climbing");
    }
  } else {
    if (completions.length > 0) {
      workoutScore = 70;
      reasons.push({ pillar: "workout", delta: "+5", text: "Logged a workout (no active cycle)" });
    } else {
      workoutScore = 50;
    }
  }

  // === NUTRITION PILLAR (25%) ===
  let nutritionScore = 0;
  const hasFood = summary.calories > 0;

  if (!hasFood) {
    nutritionScore = 0;
    reasons.push({ pillar: "nutrition", delta: "-10", text: "No meals logged today" });
    tips.push("Log at least one meal to build your score");
  } else if (calorieGoal) {
    const target = calorieGoal.dailyCalorieTarget || 2000;
    const proteinTarget = calorieGoal.dailyProteinTarget || 120;

    const calorieAccuracy = Math.max(0, 100 - Math.abs(summary.calories - target) / target * 100);
    const proteinHit = proteinTarget > 0 ? Math.min(100, (summary.protein / proteinTarget) * 100) : 50;

    nutritionScore = clamp(calorieAccuracy * 0.6 + proteinHit * 0.4, 0, 100);

    if (nutritionScore >= 80) {
      reasons.push({ pillar: "nutrition", delta: "+8", text: "Nailed your calorie and protein targets" });
    } else if (summary.protein < proteinTarget) {
      const gap = proteinTarget - summary.protein;
      reasons.push({ pillar: "nutrition", delta: "-8", text: `Missed protein target by ${Math.round(gap)}g` });
      tips.push("Add a protein shake post-workout to close the gap");
    } else {
      reasons.push({ pillar: "nutrition", delta: "-5", text: "Calorie target was off" });
    }
  } else {
    nutritionScore = 60;
    reasons.push({ pillar: "nutrition", delta: "+3", text: "Food logged (no calorie goal set)" });
    tips.push("Set a calorie goal for more accurate scoring");
  }

  // === CONSISTENCY PILLAR (25%) ===
  let consistencyScore = 0;
  const streak = stats.streak;
  const streakScore = Math.min(streak / 7, 1.0) * 60;
  const weeklyAdherence = stats.last7Days > 0 ? Math.min(stats.last7Days / 5, 1.0) * 40 : 0;
  consistencyScore = clamp(streakScore + weeklyAdherence, 0, 100);

  if (streak >= 7) {
    reasons.push({ pillar: "consistency", delta: "+10", text: `${streak}-day streak! On fire` });
  } else if (streak >= 3) {
    reasons.push({ pillar: "consistency", delta: "+5", text: `${streak}-day streak and counting` });
  } else if (streak === 0) {
    reasons.push({ pillar: "consistency", delta: "-10", text: "Streak broken — time to restart" });
  } else {
    reasons.push({ pillar: "consistency", delta: "+2", text: `${streak}-day streak building` });
  }

  // === RECOVERY PILLAR (15%) ===
  let recoveryScore = 50;
  if (healthRecord) {
    let rScore = 0;
    let factors = 0;

    if (healthRecord.sleepMinutes) {
      const sleepHours = healthRecord.sleepMinutes / 60;
      const sleepScore = sleepHours >= 7 ? 100 : sleepHours >= 6 ? 75 : sleepHours >= 5 ? 50 : 25;
      rScore += sleepScore * 0.4;
      factors++;
    }

    if (healthRecord.restingHeartRate) {
      const hr = healthRecord.restingHeartRate;
      const hrScore = hr <= 55 ? 100 : hr <= 65 ? 80 : hr <= 75 ? 60 : 40;
      rScore += hrScore * 0.3;
      factors++;
    }

    if (healthRecord.hrv) {
      const hrvVal = healthRecord.hrv;
      const hrvScore = hrvVal >= 60 ? 100 : hrvVal >= 40 ? 75 : hrvVal >= 20 ? 50 : 25;
      rScore += hrvScore * 0.3;
      factors++;
    }

    if (factors > 0) {
      recoveryScore = clamp(rScore / (factors > 0 ? (factors === 1 ? 0.4 : factors === 2 ? 0.7 : 1.0) : 1), 0, 100);
    }

    reasons.push({ pillar: "recovery", delta: recoveryScore >= 70 ? "+5" : "-3", text: recoveryScore >= 70 ? "Good recovery signals" : "Recovery could be better — prioritize sleep" });
  } else {
    const isRestDay = cycle && cycle.restDays?.includes(cycle.currentDayIndex || 0);
    recoveryScore = isRestDay ? 80 : 50;
    reasons.push({ pillar: "recovery", delta: "0", text: "No health data — connect a device for better scoring" });
  }

  const totalScore = clamp(
    workoutScore * 0.35 + nutritionScore * 0.25 + consistencyScore * 0.25 + recoveryScore * 0.15,
    0, 100
  );

  const breakdown = {
    reasons,
    tips,
    pillarDetails: {
      workout: { score: workoutScore, hasCycle: !!cycle, completedCount: completions.length },
      nutrition: {
        score: nutritionScore,
        calorieTarget: calorieGoal?.dailyCalorieTarget || null,
        calorieActual: summary.calories,
        proteinTarget: calorieGoal?.dailyProteinTarget || null,
        proteinActual: summary.protein,
        logged: hasFood,
      },
      consistency: { score: consistencyScore, currentStreak: streak, weeklyWorkouts: stats.last7Days },
      recovery: {
        score: recoveryScore,
        source: healthRecord ? "healthkit" : "fallback",
        sleepHours: healthRecord?.sleepMinutes ? Math.round(healthRecord.sleepMinutes / 60 * 10) / 10 : null,
        restingHR: healthRecord?.restingHeartRate || null,
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
        consistencyScore: clamp(consistencyScore, 0, 100),
        recoveryScore: clamp(recoveryScore, 0, 100),
        breakdown,
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
    consistencyScore: clamp(consistencyScore, 0, 100),
    recoveryScore: clamp(recoveryScore, 0, 100),
    breakdown,
  }).returning();

  return inserted;
}

export async function calculateOGymScore(userId: number, weekEndDate: string) {
  const windowEnd = weekEndDate;
  const windowStart = addDays(weekEndDate, -29);

  const dailyScores = await db.select().from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, windowStart),
      lte(dailyDisciplineScores.date, windowEnd),
    ))
    .orderBy(dailyDisciplineScores.date);

  const totalDaysInWindow = daysBetween(windowStart, windowEnd) + 1;
  const daysWithScores = dailyScores.length;

  if (daysWithScores < 14) {
    return {
      building: true,
      daysCompleted: daysWithScores,
      daysRequired: 14,
      progress: Math.round((daysWithScores / 14) * 100),
    };
  }

  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const gymId = user.gymId || null;

  const [calorieGoal, stats] = await Promise.all([
    storage.getCalorieGoal(userId),
    storage.getMemberStats(userId, gymId),
  ]);

  const foodLogDays = new Set<string>();
  const proteinHitDays = new Set<string>();
  const workoutDays = new Set<string>();
  const proteinTarget = calorieGoal?.dailyProteinTarget || 120;

  for (const ds of dailyScores) {
    const bd = ds.breakdown as any;
    if (bd?.pillarDetails?.nutrition?.logged) {
      foodLogDays.add(ds.date);
    }
    if (bd?.pillarDetails?.nutrition?.proteinActual >= proteinTarget) {
      proteinHitDays.add(ds.date);
    }
    if (bd?.pillarDetails?.workout?.completedCount > 0 || ds.workoutScore >= 80) {
      workoutDays.add(ds.date);
    }
  }

  // === FACTOR 1: Workout Adherence (25%) ===
  const scheduledWorkoutDays = dailyScores.filter(ds => {
    const bd = ds.breakdown as any;
    return bd?.pillarDetails?.workout?.hasCycle && ds.workoutScore !== undefined;
  });

  const completedWorkoutDays = scheduledWorkoutDays.filter(ds => ds.workoutScore >= 80);
  const workoutAdherence = scheduledWorkoutDays.length > 0
    ? clamp((completedWorkoutDays.length / scheduledWorkoutDays.length) * 100, 0, 100)
    : clamp((workoutDays.size / Math.max(totalDaysInWindow * 0.5, 1)) * 100, 0, 100);

  // === FACTOR 2: Nutrition Discipline (20%) ===
  let nutritionDiscipline = 0;
  if (foodLogDays.size < 15) {
    nutritionDiscipline = 0;
  } else {
    const nutritionScores = dailyScores
      .filter(ds => foodLogDays.has(ds.date))
      .map(ds => ds.nutritionScore);
    nutritionDiscipline = nutritionScores.length > 0
      ? clamp(nutritionScores.reduce((a, b) => a + b, 0) / nutritionScores.length, 0, 100)
      : 0;
  }

  // === FACTOR 3: Consistency (20%) ===
  const streak = stats.streak;
  const activeDaysRatio = daysWithScores / totalDaysInWindow;
  const streakComponent = Math.min(streak / 14, 1.0) * 50;
  const activeDaysComponent = activeDaysRatio * 50;
  const consistencyFactor = clamp(streakComponent + activeDaysComponent, 0, 100);

  // === FACTOR 4: Protein Compliance (10%) ===
  const proteinDaysWithFood = foodLogDays.size;
  const proteinCompliance = proteinDaysWithFood > 0
    ? clamp((proteinHitDays.size / proteinDaysWithFood) * 100, 0, 100)
    : 0;

  // === FACTOR 5: Recovery Respect (10%) ===
  const recoveryScores = dailyScores.map(ds => ds.recoveryScore);
  const recoveryRespect = recoveryScores.length > 0
    ? clamp(recoveryScores.reduce((a, b) => a + b, 0) / recoveryScores.length, 0, 100)
    : 50;

  // === FACTOR 6: Engagement (15%) ===
  const loggedDaysRatio = daysWithScores / totalDaysInWindow;
  const foodLogRatio = foodLogDays.size / totalDaysInWindow;
  const engagementBase = (loggedDaysRatio * 0.5 + foodLogRatio * 0.5) * 100;
  const engagement = clamp(engagementBase, 0, 100);

  // === WEIGHTED RAW SCORE ===
  let rawScore =
    workoutAdherence * 0.25 +
    nutritionDiscipline * 0.20 +
    consistencyFactor * 0.20 +
    proteinCompliance * 0.10 +
    recoveryRespect * 0.10 +
    engagement * 0.15;

  // === GATES ===
  const gatesApplied: string[] = [];
  const gateReasons: { text: string; impact: string; direction: string }[] = [];

  if (workoutAdherence < 60 && rawScore > 50) {
    rawScore = Math.min(rawScore, 50);
    gatesApplied.push("low_workout_adherence");
    gateReasons.push({ text: "Workout adherence below 60% caps your score", impact: "high", direction: "down" });
  }

  if (foodLogDays.size < 15) {
    gatesApplied.push("logging_penalty");
    gateReasons.push({ text: `Only ${foodLogDays.size}/30 days with food logs — need 15+`, impact: "medium", direction: "down" });
  }

  let maxConsecutiveGap = 0;
  const scoreDates = dailyScores.map(ds => ds.date).sort();
  for (let i = 1; i < scoreDates.length; i++) {
    const gap = daysBetween(scoreDates[i - 1], scoreDates[i]) - 1;
    maxConsecutiveGap = Math.max(maxConsecutiveGap, gap);
  }
  if (scoreDates.length > 0) {
    const firstGap = daysBetween(windowStart, scoreDates[0]);
    const lastGap = daysBetween(scoreDates[scoreDates.length - 1], windowEnd);
    maxConsecutiveGap = Math.max(maxConsecutiveGap, firstGap, lastGap);
  }

  if (maxConsecutiveGap > 3 && rawScore > 63.6) {
    rawScore = Math.min(rawScore, 63.6);
    gatesApplied.push("consistency_gap");
    gateReasons.push({ text: `${maxConsecutiveGap}-day gap breaks consistency — max score 650`, impact: "high", direction: "down" });
  }

  if (maxConsecutiveGap > 2 && rawScore > 81.8) {
    rawScore = Math.min(rawScore, 81.8);
    gatesApplied.push("consistency_cap_elite");
    gateReasons.push({ text: "2+ day gap prevents Elite tier", impact: "medium", direction: "down" });
  }

  const factors = [workoutAdherence, nutritionDiscipline, consistencyFactor, proteinCompliance, recoveryRespect, engagement];
  const minFactor = Math.min(...factors);
  if (minFactor < 30 && rawScore > 72.7) {
    rawScore = Math.min(rawScore, 72.7);
    gatesApplied.push("balance_requirement");
    gateReasons.push({ text: "A pillar below 30 prevents Strong+ score", impact: "medium", direction: "down" });
  }

  if (workoutDays.size < 10 && rawScore > 40) {
    rawScore = Math.min(rawScore, 40);
    gatesApplied.push("min_workout_data");
    gateReasons.push({ text: "Less than 10 workout days caps your score", impact: "high", direction: "down" });
  }

  const ogymScore = clamp(300 + Math.round(rawScore * 5.5), 300, 850);
  const tier = getTier(ogymScore);

  const reasons: { text: string; impact: string; direction: string }[] = [...gateReasons];

  if (workoutAdherence >= 80) {
    reasons.push({ text: "Strong workout adherence", impact: "positive", direction: "up" });
  } else if (workoutAdherence < 50) {
    reasons.push({ text: "Missed too many scheduled workouts", impact: "negative", direction: "down" });
  }

  if (consistencyFactor >= 70) {
    reasons.push({ text: `${streak}-day streak boosting your score`, impact: "positive", direction: "up" });
  }

  if (nutritionDiscipline >= 70) {
    reasons.push({ text: "Consistent nutrition tracking", impact: "positive", direction: "up" });
  }

  const [prevScore] = await db.select().from(ogymScores)
    .where(eq(ogymScores.userId, userId))
    .orderBy(desc(ogymScores.weekEndDate))
    .limit(1);

  const previousScore = prevScore?.score || null;
  const delta = previousScore ? ogymScore - previousScore : null;

  if (delta !== null) {
    if (delta > 20) reasons.push({ text: `Up ${delta} points from last week — great progress!`, impact: "positive", direction: "up" });
    else if (delta < -20) reasons.push({ text: `Down ${Math.abs(delta)} points — time to get back on track`, impact: "negative", direction: "down" });
  }

  const existing = await db.select().from(ogymScores)
    .where(and(eq(ogymScores.userId, userId), eq(ogymScores.weekEndDate, weekEndDate)))
    .limit(1);

  const scoreData = {
    userId,
    weekEndDate,
    score: ogymScore,
    previousScore,
    delta,
    workoutAdherence: clamp(workoutAdherence, 0, 100),
    nutritionDiscipline: clamp(nutritionDiscipline, 0, 100),
    consistency: clamp(consistencyFactor, 0, 100),
    proteinCompliance: clamp(proteinCompliance, 0, 100),
    recoveryRespect: clamp(recoveryRespect, 0, 100),
    engagement: clamp(engagement, 0, 100),
    gatesApplied,
    reasons,
    tier,
    windowStart,
    windowEnd,
  };

  if (existing.length > 0) {
    const [updated] = await db.update(ogymScores)
      .set(scoreData)
      .where(eq(ogymScores.id, existing[0].id))
      .returning();
    return { ...updated, building: false };
  }

  const [inserted] = await db.insert(ogymScores).values(scoreData).returning();
  return { ...inserted, building: false };
}

export async function getScoreToday(userId: number, forceRefresh: boolean = false) {
  const today = formatDate(new Date());

  let dailyScore = await db.select().from(dailyDisciplineScores)
    .where(and(eq(dailyDisciplineScores.userId, userId), eq(dailyDisciplineScores.date, today)))
    .limit(1);

  if (dailyScore.length === 0 || forceRefresh) {
    const calculated = await calculateDailyScore(userId, today);
    dailyScore = [calculated];
  }

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

  const [latestOgym] = await db.select().from(ogymScores)
    .where(eq(ogymScores.userId, userId))
    .orderBy(desc(ogymScores.weekEndDate))
    .limit(1);

  let ogymData: any = null;
  if (latestOgym) {
    ogymData = {
      ...latestOgym,
      building: false,
      tierLabel: getTierLabel(latestOgym.tier),
      tierColor: getTierColor(latestOgym.tier),
    };
  } else {
    const last30Start = addDays(today, -29);
    const recentScores = await db.select().from(dailyDisciplineScores)
      .where(and(
        eq(dailyDisciplineScores.userId, userId),
        gte(dailyDisciplineScores.date, last30Start),
        lte(dailyDisciplineScores.date, today),
      ));

    if (recentScores.length >= 14) {
      try {
        const d = new Date(today + "T00:00:00");
        const dayOfWeek = d.getDay();
        const sundayOffset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const nextSunday = new Date(d);
        nextSunday.setDate(nextSunday.getDate() + sundayOffset);
        const weekEndDate = formatDate(nextSunday);
        const ogymResult = await calculateOGymScore(userId, weekEndDate);
        if (!ogymResult.building) {
          ogymData = {
            ...ogymResult,
            tierLabel: getTierLabel(ogymResult.tier),
            tierColor: getTierColor(ogymResult.tier),
          };
        } else {
          ogymData = ogymResult;
        }
      } catch {
        ogymData = {
          building: true,
          daysCompleted: recentScores.length,
          daysRequired: 14,
          progress: Math.round((Math.min(recentScores.length, 14) / 14) * 100),
        };
      }
    } else {
      ogymData = {
        building: true,
        daysCompleted: recentScores.length,
        daysRequired: 14,
        progress: Math.round((Math.min(recentScores.length, 14) / 14) * 100),
      };
    }
  }

  const ds = dailyScore[0];
  const bd = ds.breakdown as any;

  return {
    daily: {
      date: ds.date,
      score: ds.score,
      avg7Day,
      trend: dailyTrend,
      label: getDailyLabel(ds.score),
      pillars: {
        workout: { score: ds.workoutScore, weight: 35 },
        nutrition: { score: ds.nutritionScore, weight: 25 },
        consistency: { score: ds.consistencyScore, weight: 25 },
        recovery: { score: ds.recoveryScore, weight: 15 },
      },
      reasons: bd?.reasons || [],
      tips: bd?.tips || [],
    },
    ogym: ogymData,
  };
}

export async function getDailyScoreHistory(userId: number, days: number = 30) {
  const today = formatDate(new Date());
  const startDate = addDays(today, -(days - 1));

  return await db.select().from(dailyDisciplineScores)
    .where(and(
      eq(dailyDisciplineScores.userId, userId),
      gte(dailyDisciplineScores.date, startDate),
      lte(dailyDisciplineScores.date, today),
    ))
    .orderBy(dailyDisciplineScores.date);
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
  return settings || { userId, visibility: "coach" };
}

export async function updateSettings(userId: number, visibility: string) {
  const existing = await db.select().from(disciplineSettings)
    .where(eq(disciplineSettings.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(disciplineSettings)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(disciplineSettings.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(disciplineSettings).values({ userId, visibility }).returning();
  return inserted;
}

export async function getTrainerMemberScores(trainerId: number) {
  const members = await storage.getTrainerMembers(trainerId);

  const results = [];
  for (const member of members) {
    const [latestOgym] = await db.select().from(ogymScores)
      .where(eq(ogymScores.userId, member.id))
      .orderBy(desc(ogymScores.weekEndDate))
      .limit(1);

    const today = formatDate(new Date());
    const [latestDaily] = await db.select().from(dailyDisciplineScores)
      .where(and(eq(dailyDisciplineScores.userId, member.id), eq(dailyDisciplineScores.date, today)))
      .limit(1);

    const settings = await getSettings(member.id);
    if (settings.visibility === "private") continue;

    results.push({
      memberId: member.id,
      name: member.fullName || member.username,
      ogymScore: latestOgym?.score || null,
      ogymTier: latestOgym ? getTier(latestOgym.score) : null,
      ogymTierLabel: latestOgym ? getTierLabel(getTier(latestOgym.score)) : null,
      ogymTierColor: latestOgym ? getTierColor(getTier(latestOgym.score)) : null,
      ogymDelta: latestOgym?.delta || null,
      dailyScore: latestDaily?.score || null,
      building: !latestOgym,
    });
  }

  return results.sort((a, b) => (a.ogymScore || 0) - (b.ogymScore || 0));
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
