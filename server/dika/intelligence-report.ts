import { db } from "../db";
import { eq, and, gte, desc, sql, asc, count } from "drizzle-orm";
import { users, userProfiles, workoutCompletions, workoutItems, foodLogs, bodyMeasurements, healthData, matchLogs, attendance, memberSubscriptions, payments, gyms, trainerMembers } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const reportCache = new Map<string, { data: IntelligenceReport; expiresAt: number }>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function getCachedReport(key: string): IntelligenceReport | null {
  const entry = reportCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) reportCache.delete(key);
  return null;
}

function setCachedReport(key: string, data: IntelligenceReport) {
  reportCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export interface ReportSection {
  title: string;
  icon: string;
  value: string;
  detail?: string;
}

export interface IntelligenceReport {
  role: "member" | "owner" | "trainer";
  period: string;
  generatedAt: string;
  sections: ReportSection[];
  patterns: string[];
  projection: string;
  adjustment: string;
  narrative: string;
}

async function gatherMemberData(userId: number, days: number = 28) {
  const startDate = getDateNDaysAgo(days);
  const prevStartDate = getDateNDaysAgo(days * 2);

  const [currentWorkouts, prevWorkouts] = await Promise.all([
    db.select({ date: workoutCompletions.completedDate })
      .from(workoutCompletions)
      .where(and(eq(workoutCompletions.memberId, userId), gte(workoutCompletions.completedDate, startDate))),
    db.select({ date: workoutCompletions.completedDate })
      .from(workoutCompletions)
      .where(and(
        eq(workoutCompletions.memberId, userId),
        gte(workoutCompletions.completedDate, prevStartDate),
        sql`${workoutCompletions.completedDate} < ${startDate}`
      )),
  ]);

  const totalWorkouts = currentWorkouts.length;
  const prevTotalWorkouts = prevWorkouts.length;
  const workoutDays = new Set(currentWorkouts.map(r => r.date)).size;
  const consistencyPct = Math.round((workoutDays / days) * 100);
  const volumeChange = prevTotalWorkouts > 0 ? Math.round(((totalWorkouts - prevTotalWorkouts) / prevTotalWorkouts) * 100) : null;

  const strengthRows = await db.select({
    exerciseName: workoutCompletions.exerciseName,
    weight: workoutCompletions.actualWeight,
    date: workoutCompletions.completedDate,
  }).from(workoutCompletions)
    .where(and(
      eq(workoutCompletions.memberId, userId),
      gte(workoutCompletions.completedDate, startDate),
      sql`${workoutCompletions.exerciseType} = 'strength'`,
      sql`${workoutCompletions.actualWeight} IS NOT NULL`
    ))
    .orderBy(asc(workoutCompletions.completedDate));

  const exerciseProgress: Record<string, { first: number; last: number; name: string }> = {};
  for (const r of strengthRows) {
    const w = parseFloat(r.weight as any);
    if (isNaN(w) || w <= 0) continue;
    const name = r.exerciseName || "Unknown";
    if (!exerciseProgress[name]) exerciseProgress[name] = { first: w, last: w, name };
    exerciseProgress[name].last = w;
  }

  const topProgressions = Object.values(exerciseProgress)
    .map(e => ({ ...e, change: e.first > 0 ? Math.round(((e.last - e.first) / e.first) * 100) : 0 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3);

  const nutritionRows = await db.select({
    calories: foodLogs.calories,
    protein: foodLogs.protein,
    date: foodLogs.date,
  }).from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.date, startDate)));

  const nutritionDays = new Set(nutritionRows.map(r => r.date)).size;
  const totalCals = nutritionRows.reduce((s, r) => s + (Number(r.calories) || 0), 0);
  const totalProtein = nutritionRows.reduce((s, r) => s + (Number(r.protein) || 0), 0);
  const avgDailyCals = nutritionDays > 0 ? Math.round(totalCals / nutritionDays) : 0;
  const avgDailyProtein = nutritionDays > 0 ? Math.round(totalProtein / nutritionDays) : 0;
  const nutritionAdherencePct = Math.round((nutritionDays / days) * 100);

  const healthRows = await db.select({
    steps: healthData.steps,
    sleepMinutes: healthData.sleepMinutes,
    restingHeartRate: healthData.restingHeartRate,
  }).from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, startDate)));

  const avgSteps = healthRows.length > 0 ? Math.round(healthRows.reduce((s, r) => s + (Number(r.steps) || 0), 0) / healthRows.length) : null;
  const avgSleepHrs = healthRows.length > 0 ? +(healthRows.reduce((s, r) => s + (Number(r.sleepMinutes) || 0), 0) / healthRows.length / 60).toFixed(1) : null;

  const bodyRows = await db.select({
    weight: bodyMeasurements.weight,
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
      weightChange = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}kg`;
    }
  }

  const matchRows = await db.select({ id: matchLogs.id }).from(matchLogs)
    .where(and(eq(matchLogs.userId, userId), gte(matchLogs.matchDate, startDate)));

  return {
    totalWorkouts, prevTotalWorkouts, workoutDays, consistencyPct, volumeChange,
    topProgressions, nutritionDays, avgDailyCals, avgDailyProtein, nutritionAdherencePct,
    avgSteps, avgSleepHrs, weightChange, totalMatches: matchRows.length,
    healthDaysTracked: healthRows.length, days,
  };
}

async function gatherOwnerData(gymId: number, days: number = 28) {
  const startDate = getDateNDaysAgo(days);
  const prevStartDate = getDateNDaysAgo(days * 2);

  const membersRaw = await db.select({
    id: users.id,
    role: users.role,
    gymId: users.gymId,
  }).from(users).where(and(eq(users.gymId, gymId), eq(users.role, "member")));

  const totalMembers = membersRaw.length;
  const activeMembers = totalMembers;

  const [currentAttendance, prevAttendance] = await Promise.all([
    db.select({ cnt: count() }).from(attendance)
      .where(and(eq(attendance.gymId, gymId), gte(attendance.date, startDate))),
    db.select({ cnt: count() }).from(attendance)
      .where(and(
        eq(attendance.gymId, gymId),
        gte(attendance.date, prevStartDate),
        sql`${attendance.date} < ${startDate}`
      )),
  ]);

  const currentAttCount = Number(currentAttendance[0]?.cnt) || 0;
  const prevAttCount = Number(prevAttendance[0]?.cnt) || 0;
  const attendanceChange = prevAttCount > 0 ? Math.round(((currentAttCount - prevAttCount) / prevAttCount) * 100) : null;

  const revenueRows = await db.select({
    amount: payments.amountPaid,
  }).from(payments)
    .where(and(eq(payments.gymId, gymId), gte(payments.updatedAt, new Date(startDate))));
  const totalRevenue = revenueRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const expiringSubs = await db.select({ cnt: count() }).from(memberSubscriptions)
    .where(and(
      eq(memberSubscriptions.gymId, gymId),
      sql`${memberSubscriptions.endDate} BETWEEN ${startDate} AND ${getDateNDaysAgo(-7)}`
    ));

  const inactiveMembers = await db.select({
    userId: users.id,
  }).from(users)
    .leftJoin(attendance, and(
      eq(attendance.memberId, users.id),
      eq(attendance.gymId, gymId),
      gte(attendance.date, getDateNDaysAgo(14))
    ))
    .where(and(eq(users.gymId, gymId), eq(users.role, "member")))
    .groupBy(users.id)
    .having(sql`count(${attendance.id}) = 0`);

  const [gym] = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));

  return {
    totalMembers, activeMembers,
    currentAttCount, prevAttCount, attendanceChange,
    totalRevenue, currency: gym?.currency || "USD",
    expiringSubsCount: Number(expiringSubs[0]?.cnt) || 0,
    inactiveMemberCount: inactiveMembers.length,
    days,
  };
}

async function gatherTrainerData(userId: number, gymId: number, days: number = 28) {
  const startDate = getDateNDaysAgo(days);

  const assignments = await db.select({
    memberId: trainerMembers.memberId,
  }).from(trainerMembers)
    .where(and(eq(trainerMembers.trainerId, userId), eq(trainerMembers.gymId, gymId)));

  const memberIds = assignments.map(a => a.memberId);
  if (memberIds.length === 0) {
    return { memberIds: [], rosterSize: 0, days, memberStats: [] };
  }

  const memberStats = await Promise.all(memberIds.map(async (memberId) => {
    const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, memberId));
    const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, memberId));
    const name = profile?.fullName || user?.username || `Member #${memberId}`;

    const workouts = await db.select({ date: workoutCompletions.completedDate })
      .from(workoutCompletions)
      .where(and(eq(workoutCompletions.memberId, memberId), gte(workoutCompletions.completedDate, startDate)));

    const nutrition = await db.select({ date: foodLogs.date })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, memberId), gte(foodLogs.date, startDate)));

    const workoutDays = new Set(workouts.map(r => r.date)).size;
    const nutritionDays = new Set(nutrition.map(r => r.date)).size;

    return {
      memberId, name,
      totalWorkouts: workouts.length,
      workoutDays,
      consistencyPct: Math.round((workoutDays / days) * 100),
      nutritionDays,
      nutritionAdherencePct: Math.round((nutritionDays / days) * 100),
    };
  }));

  const avgCompletion = memberStats.length > 0
    ? Math.round(memberStats.reduce((s, m) => s + m.consistencyPct, 0) / memberStats.length) : 0;

  const improved = memberStats.filter(m => m.consistencyPct >= 60).sort((a, b) => b.consistencyPct - a.consistencyPct).slice(0, 3);
  const needsAttention = memberStats.filter(m => m.consistencyPct < 30).sort((a, b) => a.consistencyPct - b.consistencyPct).slice(0, 3);
  const avgNutrition = memberStats.length > 0
    ? Math.round(memberStats.reduce((s, m) => s + m.nutritionAdherencePct, 0) / memberStats.length) : 0;

  return {
    memberIds, rosterSize: memberIds.length, days,
    memberStats, avgCompletion, improved, needsAttention, avgNutrition,
  };
}

async function generateNarrativeWithGPT(role: string, rawData: any): Promise<{ patterns: string[]; projection: string; adjustment: string; narrative: string }> {
  const dataStr = JSON.stringify(rawData, null, 0).slice(0, 3000);

  const prompt = role === "member"
    ? `You are a fitness coach AI analyzing a member's last ${rawData.days} days of data. Based on this data, provide:
1. Exactly 2 pattern observations (things you notice in the data - correlations, habits, trends)
2. Exactly 1 forward projection (where things are heading if current patterns continue)
3. Exactly 1 actionable adjustment (specific thing to change this week)
4. A brief narrative summary (2-3 sentences, conversational coaching tone: "Here's what happened. Here's why. Here's what to do next.")

Data: ${dataStr}

Respond in JSON: {"patterns":["...","..."],"projection":"...","adjustment":"...","narrative":"..."}`
    : role === "owner"
    ? `You are a gym business AI advisor analyzing a gym's last ${rawData.days} days. Based on this data, provide:
1. Exactly 2 pattern observations (attendance patterns, revenue signals, member behavior)
2. Exactly 1 forward projection (what to expect if trends continue)
3. Exactly 1 actionable adjustment (specific business action to take this week)
4. A brief narrative summary (2-3 sentences, professional advisory tone: "Here's what happened. Here's why. Here's what to do next.")

Data: ${dataStr}

Respond in JSON: {"patterns":["...","..."],"projection":"...","adjustment":"...","narrative":"..."}`
    : `You are a trainer AI assistant analyzing a trainer's roster of ${rawData.rosterSize} members over ${rawData.days} days. Based on this data, provide:
1. Exactly 2 pattern observations (member engagement patterns, training compliance)
2. Exactly 1 forward projection (which members are at risk or improving)
3. Exactly 1 actionable adjustment (specific coaching action to take this week)
4. A brief narrative summary (2-3 sentences, supportive coaching tone: "Here's what happened. Here's why. Here's what to do next.")

Data: ${dataStr}

Respond in JSON: {"patterns":["...","..."],"projection":"...","adjustment":"...","narrative":"..."}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 2) : ["No patterns detected", "Insufficient data"],
        projection: parsed.projection || "Continue current patterns to see trends emerge.",
        adjustment: parsed.adjustment || "Stay consistent with your current routine.",
        narrative: parsed.narrative || "Keep going — more data will reveal clearer insights.",
      };
    }
  } catch (e) {
    console.error("[Intelligence Report] GPT error:", e);
  }

  return {
    patterns: ["Not enough data for pattern analysis", "Log more activity for better insights"],
    projection: "Continue building consistency to unlock projections.",
    adjustment: "Focus on logging your workouts and meals consistently.",
    narrative: "We need more data to give you meaningful insights. Keep logging!",
  };
}

export async function generateMemberReport(userId: number, days: number = 28): Promise<IntelligenceReport> {
  const cacheKey = `member_${userId}_${days}`;
  const cached = getCachedReport(cacheKey);
  if (cached) return cached;

  const data = await gatherMemberData(userId, days);
  const gpt = await generateNarrativeWithGPT("member", data);

  const sections: ReportSection[] = [
    {
      title: "Volume Trend",
      icon: "trending-up",
      value: data.volumeChange !== null ? `${data.volumeChange > 0 ? "+" : ""}${data.volumeChange}%` : `${data.totalWorkouts} workouts`,
      detail: `${data.totalWorkouts} workouts across ${data.workoutDays} days (${data.consistencyPct}% consistency)`,
    },
    {
      title: "Strength Change",
      icon: "dumbbell",
      value: data.topProgressions.length > 0 ? data.topProgressions.map(p => `${p.name}: ${p.change > 0 ? "+" : ""}${p.change}%`).join(", ") : "No strength data",
      detail: data.topProgressions.length > 0 ? `Top ${data.topProgressions.length} exercises tracked` : "Log weighted exercises to track strength",
    },
    {
      title: "Recovery Trend",
      icon: "heart",
      value: data.avgSleepHrs !== null ? `${data.avgSleepHrs}h avg sleep` : "No health data",
      detail: data.avgSteps !== null ? `${data.avgSteps.toLocaleString()} avg steps/day` : "Connect health device for recovery tracking",
    },
    {
      title: "Nutrition Adherence",
      icon: "utensils",
      value: `${data.nutritionAdherencePct}% days logged`,
      detail: data.nutritionDays > 0 ? `Avg ${data.avgDailyCals} cal, ${data.avgDailyProtein}g protein/day` : "Start logging meals for nutrition insights",
    },
  ];

  if (data.weightChange) {
    sections.push({
      title: "Body Weight",
      icon: "scale",
      value: data.weightChange,
      detail: "Weight change over the period",
    });
  }

  const report: IntelligenceReport = {
    role: "member",
    period: `${days} days`,
    generatedAt: new Date().toISOString(),
    sections,
    patterns: gpt.patterns,
    projection: gpt.projection,
    adjustment: gpt.adjustment,
    narrative: gpt.narrative,
  };
  setCachedReport(cacheKey, report);
  return report;
}

export async function generateOwnerReport(gymId: number, days: number = 28): Promise<IntelligenceReport> {
  const cacheKey = `owner_${gymId}_${days}`;
  const cached = getCachedReport(cacheKey);
  if (cached) return cached;

  const data = await gatherOwnerData(gymId, days);
  const gpt = await generateNarrativeWithGPT("owner", data);

  const sections: ReportSection[] = [
    {
      title: "Attendance Trend",
      icon: "calendar-check",
      value: data.attendanceChange !== null ? `${data.attendanceChange > 0 ? "+" : ""}${data.attendanceChange}%` : `${data.currentAttCount} check-ins`,
      detail: `${data.currentAttCount} check-ins this period vs ${data.prevAttCount} last period`,
    },
    {
      title: "Revenue Snapshot",
      icon: "credit-card",
      value: `${data.currency} ${data.totalRevenue.toLocaleString()}`,
      detail: `${data.expiringSubsCount} subscriptions expiring soon`,
    },
    {
      title: "Member Health",
      icon: "users",
      value: `${data.activeMembers} active / ${data.totalMembers} total`,
      detail: `${data.inactiveMemberCount} members inactive (14+ days no attendance)`,
    },
  ];

  const report: IntelligenceReport = {
    role: "owner",
    period: `${days} days`,
    generatedAt: new Date().toISOString(),
    sections,
    patterns: gpt.patterns,
    projection: gpt.projection,
    adjustment: gpt.adjustment,
    narrative: gpt.narrative,
  };
  setCachedReport(cacheKey, report);
  return report;
}

export async function generateTrainerReport(userId: number, gymId: number, days: number = 28): Promise<IntelligenceReport> {
  const cacheKey = `trainer_${userId}_${gymId}_${days}`;
  const cached = getCachedReport(cacheKey);
  if (cached) return cached;

  const data = await gatherTrainerData(userId, gymId, days);

  if (data.rosterSize === 0) {
    return {
      role: "trainer",
      period: `${days} days`,
      generatedAt: new Date().toISOString(),
      sections: [{ title: "No Assigned Members", icon: "users", value: "0 members", detail: "You don't have any assigned members yet" }],
      patterns: ["No roster data available"],
      projection: "Assign members to start seeing training insights.",
      adjustment: "Ask the gym owner to assign members to you.",
      narrative: "Once you have members assigned, this report will show their training patterns and progress.",
    };
  }

  const gpt = await generateNarrativeWithGPT("trainer", data);

  const sections: ReportSection[] = [
    {
      title: "Roster Completion Rate",
      icon: "check-circle",
      value: `${data.avgCompletion}% avg`,
      detail: `${data.rosterSize} members tracked`,
    },
    {
      title: "Nutrition Adherence",
      icon: "utensils",
      value: `${data.avgNutrition}% avg logging`,
      detail: `${data.memberStats.filter(m => m.nutritionAdherencePct > 50).length}/${data.rosterSize} members logging consistently`,
    },
    {
      title: "Who's Improving",
      icon: "trending-up",
      value: data.improved && data.improved.length > 0 ? data.improved.map(m => m.name.split(" ")[0]).join(", ") : "No standouts yet",
      detail: data.improved && data.improved.length > 0 ? data.improved.map(m => `${m.name.split(" ")[0]}: ${m.consistencyPct}%`).join(", ") : "Need more data",
    },
    {
      title: "Needs Attention",
      icon: "alert-triangle",
      value: data.needsAttention && data.needsAttention.length > 0 ? `${data.needsAttention.length} members` : "All on track",
      detail: data.needsAttention && data.needsAttention.length > 0 ? data.needsAttention.map(m => `${m.name.split(" ")[0]}: ${m.consistencyPct}%`).join(", ") : "Great — everyone is staying active",
    },
  ];

  const report: IntelligenceReport = {
    role: "trainer",
    period: `${days} days`,
    generatedAt: new Date().toISOString(),
    sections,
    patterns: gpt.patterns,
    projection: gpt.projection,
    adjustment: gpt.adjustment,
    narrative: gpt.narrative,
  };
  setCachedReport(cacheKey, report);
  return report;
}
