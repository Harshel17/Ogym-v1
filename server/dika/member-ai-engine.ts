import OpenAI from "openai";
import { db } from "../db";
import {
  users,
  userProfiles,
  workoutCycles,
  workoutCompletions,
  workoutItems,
  foodLogs,
  calorieGoals,
  waterLogs,
  bodyMeasurements,
  userGoals,
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function callGPT(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  });
  return response.choices[0]?.message?.content || "";
}

function getDateStr(daysAgo: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function getMemberWorkoutData(userId: number, days: number = 30) {
  const startDate = getDateStr(days);
  const today = getDateStr();

  const completions = await db.select({
    completedDate: workoutCompletions.completedDate,
    exerciseName: workoutCompletions.exerciseName,
    exerciseType: workoutCompletions.exerciseType,
    actualSets: workoutCompletions.actualSets,
    actualReps: workoutCompletions.actualReps,
    actualWeight: workoutCompletions.actualWeight,
    notes: workoutCompletions.notes,
  })
    .from(workoutCompletions)
    .where(and(
      eq(workoutCompletions.memberId, userId),
      gte(workoutCompletions.completedDate, startDate),
      lte(workoutCompletions.completedDate, today)
    ))
    .orderBy(desc(workoutCompletions.completedDate));

  const items = await db.select({
    exerciseName: workoutItems.exerciseName,
    muscleType: workoutItems.muscleType,
    bodyPart: workoutItems.bodyPart,
    sets: workoutItems.sets,
    reps: workoutItems.reps,
    weight: workoutItems.weight,
    cycleId: workoutItems.cycleId,
  })
    .from(workoutItems)
    .innerJoin(workoutCycles, eq(workoutItems.cycleId, workoutCycles.id))
    .where(and(
      eq(workoutCycles.memberId, userId),
      eq(workoutCycles.isActive, true),
      eq(workoutItems.isDeleted, false)
    ));

  const [activeCycle] = await db.select({
    name: workoutCycles.name,
    cycleLength: workoutCycles.cycleLength,
    dayLabels: workoutCycles.dayLabels,
    startDate: workoutCycles.startDate,
    currentDayIndex: workoutCycles.currentDayIndex,
    source: workoutCycles.source,
  })
    .from(workoutCycles)
    .where(and(
      eq(workoutCycles.memberId, userId),
      eq(workoutCycles.isActive, true)
    ))
    .limit(1);

  const uniqueDays = new Set(completions.map(c => c.completedDate));
  const muscleGroups: Record<string, number> = {};
  for (const item of items) {
    muscleGroups[item.muscleType] = (muscleGroups[item.muscleType] || 0) + 1;
  }

  return {
    completions,
    items,
    activeCycle,
    workoutDaysCount: uniqueDays.size,
    muscleGroups,
    totalExercisesCompleted: completions.length,
  };
}

async function getMemberNutritionData(userId: number, days: number = 7) {
  const startDate = getDateStr(days);
  const today = getDateStr();

  const logs = await db.select()
    .from(foodLogs)
    .where(and(
      eq(foodLogs.userId, userId),
      gte(foodLogs.date, startDate),
      lte(foodLogs.date, today)
    ))
    .orderBy(desc(foodLogs.date));

  const [goal] = await db.select()
    .from(calorieGoals)
    .where(and(eq(calorieGoals.userId, userId), eq(calorieGoals.isActive, true)))
    .limit(1);

  const [userGoalsData] = await db.select()
    .from(userGoals)
    .where(eq(userGoals.userId, userId))
    .limit(1);

  const dailyTotals: Record<string, { calories: number; protein: number; carbs: number; fat: number; meals: number }> = {};
  for (const log of logs) {
    if (!dailyTotals[log.date]) {
      dailyTotals[log.date] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
    }
    dailyTotals[log.date].calories += log.calories;
    dailyTotals[log.date].protein += log.protein || 0;
    dailyTotals[log.date].carbs += log.carbs || 0;
    dailyTotals[log.date].fat += log.fat || 0;
    dailyTotals[log.date].meals += 1;
  }

  const daysLogged = Object.keys(dailyTotals).length;
  const avgCalories = daysLogged > 0
    ? Math.round(Object.values(dailyTotals).reduce((s, d) => s + d.calories, 0) / daysLogged)
    : 0;
  const avgProtein = daysLogged > 0
    ? Math.round(Object.values(dailyTotals).reduce((s, d) => s + d.protein, 0) / daysLogged)
    : 0;

  const todayFoods = logs.filter(l => l.date === today).map(l => ({
    name: l.foodName,
    mealType: l.mealType,
    calories: l.calories,
    protein: l.protein || 0,
  }));

  return {
    logs,
    goal,
    userGoals: userGoalsData,
    dailyTotals,
    daysLogged,
    avgCalories,
    avgProtein,
    todayFoods,
    calorieTarget: goal?.dailyCalorieTarget || userGoalsData?.dailyCalorieTarget || null,
    proteinTarget: goal?.dailyProteinTarget || userGoalsData?.dailyProteinTarget || null,
  };
}

async function getMemberProfile(userId: number) {
  const [user] = await db.select({
    username: users.username,
    role: users.role,
    gymId: users.gymId,
    healthConnected: users.healthConnected,
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [profile] = await db.select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const latestMeasurements = await db.select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.memberId, userId))
    .orderBy(desc(bodyMeasurements.recordedDate))
    .limit(2);

  return { user, profile, latestMeasurements };
}

export async function generateWorkoutInsights(userId: number): Promise<{
  coachNote: string;
  stats: { workoutDays: number; totalExercises: number; topMuscle: string; consistency: string };
  generatedAt: string;
}> {
  const workoutData = await getMemberWorkoutData(userId, 30);
  const { user } = await getMemberProfile(userId);

  const topMuscle = Object.entries(workoutData.muscleGroups)
    .sort((a, b) => b[1] - a[1])[0];
  const leastMuscle = Object.entries(workoutData.muscleGroups)
    .sort((a, b) => a[1] - b[1])[0];

  const consistency = workoutData.workoutDaysCount >= 16 ? "Excellent" :
    workoutData.workoutDaysCount >= 12 ? "Good" :
      workoutData.workoutDaysCount >= 8 ? "Fair" : "Needs improvement";

  const recentExercises = workoutData.completions.slice(0, 20)
    .map(c => `${c.exerciseName}: ${c.actualSets}x${c.actualReps} @ ${c.actualWeight || 'bodyweight'}`)
    .join(", ");

  const prompt = `Analyze this gym member's 30-day workout data and write a coach's note (3-4 sentences max).

Member: ${user?.username || 'Member'}
Workout days in last 30 days: ${workoutData.workoutDaysCount}
Total exercises completed: ${workoutData.totalExercisesCompleted}
Active cycle: ${workoutData.activeCycle?.name || 'None'}
Cycle length: ${workoutData.activeCycle?.cycleLength || 'N/A'} days
Day labels: ${workoutData.activeCycle?.dayLabels ? JSON.stringify(workoutData.activeCycle.dayLabels) : 'N/A'}
Muscle group distribution: ${Object.entries(workoutData.muscleGroups).map(([k, v]) => `${k}: ${v} exercises`).join(', ') || 'No data'}
Most trained: ${topMuscle?.[0] || 'N/A'} (${topMuscle?.[1] || 0} exercises)
Least trained: ${leastMuscle?.[0] || 'N/A'} (${leastMuscle?.[1] || 0} exercises)
Recent exercises: ${recentExercises || 'No recent data'}
Consistency rating: ${consistency}

CRITICAL RULES:
- Use their ACTUAL exercise names and muscle groups from the data above. Name specific exercises they did.
- Reference REAL numbers (days worked out, exercises completed, specific muscles).
- If they have muscle imbalances, say exactly which muscle is overtrained vs undertrained.
- Give ONE specific exercise recommendation by name (e.g. "try adding Romanian deadlifts" not "add more leg work").
- If data is minimal, be honest: "I only see X workouts, so let's build more data."
- No generic advice. Everything must reference THEIR data.
- No bullet points, no headers. Natural paragraph like a coach texting them.`;

  const coachNote = await callGPT(
    "You are a knowledgeable fitness coach writing brief progress notes for gym members. Be specific, data-driven, casual, and encouraging. Never use emojis.",
    prompt
  );

  return {
    coachNote,
    stats: {
      workoutDays: workoutData.workoutDaysCount,
      totalExercises: workoutData.totalExercisesCompleted,
      topMuscle: topMuscle?.[0] || "N/A",
      consistency,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function generateProgressSummary(userId: number): Promise<{
  summary: string;
  highlights: { label: string; value: string; trend: "up" | "down" | "stable" }[];
  streaks: { currentStreak: number; longestStreak: number };
  generatedAt: string;
}> {
  const workoutData = await getMemberWorkoutData(userId, 30);
  const nutritionData = await getMemberNutritionData(userId, 30);
  const { user, latestMeasurements } = await getMemberProfile(userId);

  const prev30Data = await getMemberWorkoutData(userId, 60);
  const prevWorkoutDays = prev30Data.workoutDaysCount - workoutData.workoutDaysCount;

  const workoutDates = Array.from(
    new Set(workoutData.completions.map(c => c.completedDate))
  ).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const today = getDateStr();

  for (let i = 0; i < 30; i++) {
    const d = getDateStr(i);
    if (workoutDates.includes(d)) {
      tempStreak++;
      if (i === 0 || (i > 0 && workoutDates.includes(getDateStr(i - 1)))) {
        currentStreak = Math.max(currentStreak, tempStreak);
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i === 0) currentStreak = 0;
      tempStreak = 0;
    }
  }

  const highlights: { label: string; value: string; trend: "up" | "down" | "stable" }[] = [
    {
      label: "Workout Days",
      value: `${workoutData.workoutDaysCount}`,
      trend: workoutData.workoutDaysCount > prevWorkoutDays ? "up" : workoutData.workoutDaysCount < prevWorkoutDays ? "down" : "stable",
    },
    {
      label: "Exercises Done",
      value: `${workoutData.totalExercisesCompleted}`,
      trend: "stable",
    },
    {
      label: "Avg Calories",
      value: nutritionData.avgCalories > 0 ? `${nutritionData.avgCalories}` : "No data",
      trend: "stable",
    },
    {
      label: "Days Logged Food",
      value: `${nutritionData.daysLogged}`,
      trend: nutritionData.daysLogged >= 20 ? "up" : nutritionData.daysLogged >= 10 ? "stable" : "down",
    },
  ];

  const weightChange = latestMeasurements.length >= 2
    ? `Weight: ${latestMeasurements[0].weight}kg (was ${latestMeasurements[1].weight}kg)`
    : latestMeasurements.length === 1 ? `Weight: ${latestMeasurements[0].weight}kg` : "No weight data";

  const prompt = `Write a monthly fitness progress summary for this member (3-5 sentences).

Member: ${user?.username || 'Member'}
Last 30 days:
- Workout days: ${workoutData.workoutDaysCount} (previous 30 days: ${prevWorkoutDays})
- Total exercises completed: ${workoutData.totalExercisesCompleted}
- Muscle focus: ${Object.entries(workoutData.muscleGroups).map(([k, v]) => `${k}(${v})`).join(', ') || 'No data'}
- Active cycle: ${workoutData.activeCycle?.name || 'None'}
- Nutrition: avg ${nutritionData.avgCalories} cal/day, avg ${nutritionData.avgProtein}g protein/day, logged ${nutritionData.daysLogged} days
- Calorie target: ${nutritionData.calorieTarget || 'not set'}
- Protein target: ${nutritionData.proteinTarget || 'not set'}g
- ${weightChange}
- Current workout streak: ${currentStreak} days
- Goals: ${nutritionData.userGoals?.primaryGoal?.replace('_', ' ') || 'Not set'}

CRITICAL RULES:
- Compare this month vs last month with REAL numbers ("You worked out ${workoutData.workoutDaysCount} days, up/down from ${prevWorkoutDays}").
- Mention their ACTUAL calorie and protein averages vs their targets.
- If weight changed, mention the direction and amount.
- If they have a goal set, evaluate progress toward it specifically.
- If nutrition logging is sparse, call it out with the exact number.
- End with ONE clear next-step that references their data.
- No generic "keep it up" filler. Every sentence must contain a number or specific fact from their data.`;

  const summary = await callGPT(
    "You are a fitness coach writing a friendly monthly progress summary. Be specific and data-driven. Never use emojis. Keep it concise.",
    prompt
  );

  return {
    summary,
    highlights,
    streaks: { currentStreak, longestStreak },
    generatedAt: new Date().toISOString(),
  };
}

export async function generateWorkoutSuggestions(userId: number): Promise<{
  suggestions: { title: string; reason: string; priority: "high" | "medium" | "low" }[];
  generatedAt: string;
}> {
  const workoutData = await getMemberWorkoutData(userId, 30);
  const { user, latestMeasurements } = await getMemberProfile(userId);

  const topMuscle = Object.entries(workoutData.muscleGroups)
    .sort((a, b) => b[1] - a[1])[0];
  const leastMuscle = Object.entries(workoutData.muscleGroups)
    .sort((a, b) => a[1] - b[1])[0];

  const [goalsData] = await db.select()
    .from(userGoals)
    .where(eq(userGoals.userId, userId))
    .limit(1);

  const prompt = `Based on this member's workout data, suggest 3 specific things to focus on next. Return as JSON array.

Member: ${user?.username || 'Member'}
Active cycle: ${workoutData.activeCycle?.name || 'None'}
Cycle day labels: ${workoutData.activeCycle?.dayLabels ? JSON.stringify(workoutData.activeCycle.dayLabels) : 'N/A'}
Workout days (30d): ${workoutData.workoutDaysCount}
Muscle distribution: ${Object.entries(workoutData.muscleGroups).map(([k, v]) => `${k}: ${v}`).join(', ') || 'No exercises'}
Primary goal: ${goalsData?.primaryGoal?.replace('_', ' ') || 'Not set'}
Target weight: ${goalsData?.targetWeight || 'Not set'}
Weekly workout target: ${goalsData?.weeklyWorkoutDays || 'Not set'} days
Weight: ${latestMeasurements[0]?.weight ? `${latestMeasurements[0].weight}kg` : 'Unknown'}
Recent exercises with weights (last 10): ${workoutData.completions.slice(0, 10).map(c => `${c.exerciseName} ${c.actualSets}x${c.actualReps} @ ${c.actualWeight || 'bw'}`).join(', ') || 'None'}

Return ONLY a JSON array of exactly 3 objects with these fields:
- title: short action title (5-8 words) - must name a SPECIFIC exercise or muscle
- reason: 1-2 sentence explanation referencing THEIR actual data (name their exercises, rep counts, muscle gaps)
- priority: "high", "medium", or "low"

CRITICAL: Each suggestion MUST reference specific exercises or muscles from their data. Do NOT give generic advice like "increase consistency" or "try new exercises". Instead say things like "Add face pulls for rear delts" with a reason like "Your ${topMuscle?.[0] || 'chest'} has ${topMuscle?.[1] || 0} exercises but ${leastMuscle?.[0] || 'back'} only has ${leastMuscle?.[1] || 0}".`;

  const raw = await callGPT(
    "You are a fitness expert. Return ONLY valid JSON array. No markdown, no explanation.",
    prompt
  );

  let suggestions: { title: string; reason: string; priority: "high" | "medium" | "low" }[] = [];
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) suggestions = [];
  } catch {
    suggestions = [
      { title: "Keep up your current routine", reason: "Your data shows steady progress. Stay consistent with your current plan.", priority: "medium" },
    ];
  }

  return {
    suggestions: suggestions.slice(0, 3),
    generatedAt: new Date().toISOString(),
  };
}

export async function generateNutritionCoaching(userId: number): Promise<{
  advice: string;
  quickTips: string[];
  macroAnalysis: { avgCalories: number; avgProtein: number; daysLogged: number; calorieTarget: number | null; proteinTarget: number | null };
  generatedAt: string;
}> {
  const nutritionData = await getMemberNutritionData(userId, 7);
  const { user } = await getMemberProfile(userId);

  const recentFoods = nutritionData.logs.slice(0, 30)
    .map(l => `${l.foodName} (${l.calories}cal, ${l.protein || 0}g P)`)
    .join(", ");

  const dailyBreakdown = Object.entries(nutritionData.dailyTotals)
    .slice(0, 5)
    .map(([date, d]) => `${date}: ${d.calories}cal, ${d.protein}g P, ${d.carbs}g C, ${d.fat}g F (${d.meals} items)`)
    .join('\n');

  const prompt = `Analyze this member's recent nutrition and give coaching. Return JSON.

Member: ${user?.username || 'Member'}
Last 7 days nutrition:
${dailyBreakdown || 'No food logged recently'}

Calorie target: ${nutritionData.calorieTarget || 'Not set'}
Protein target: ${nutritionData.proteinTarget || 'Not set'}g
Goal: ${nutritionData.userGoals?.primaryGoal?.replace('_', ' ') || 'Not set'}
Avg calories/day: ${nutritionData.avgCalories}
Avg protein/day: ${nutritionData.avgProtein}g
Days logged: ${nutritionData.daysLogged}/7
Recent foods: ${recentFoods || 'None'}

Return JSON with:
- advice: 3-4 sentence coaching paragraph
- quickTips: array of 3 short actionable tips (each 5-10 words)

CRITICAL RULES:
- Name SPECIFIC foods they ate (e.g., "your chicken breast meals are solid for protein").
- Reference their EXACT numbers: "${nutritionData.avgCalories} cal avg" vs "${nutritionData.calorieTarget || 'no'} target".
- If protein is low, suggest specific high-protein foods (not just "eat more protein").
- Each quick tip must be actionable with a specific food or amount (e.g., "Add Greek yogurt for 15g extra protein" not "Eat more protein").
- If barely logging, be direct: "You only logged ${nutritionData.daysLogged} of 7 days."
- No generic wellness advice. Every point must connect to their data.`;

  const raw = await callGPT(
    "You are a nutrition coach. Return ONLY valid JSON with 'advice' (string) and 'quickTips' (string array). No markdown.",
    prompt
  );

  let advice = "Start logging your meals to get personalized nutrition insights. Even tracking a few days gives us useful patterns to work with.";
  let quickTips = ["Log meals consistently", "Aim for protein at every meal", "Stay hydrated throughout the day"];

  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.advice) advice = parsed.advice;
    if (Array.isArray(parsed.quickTips)) quickTips = parsed.quickTips.slice(0, 3);
  } catch {
  }

  return {
    advice,
    quickTips,
    macroAnalysis: {
      avgCalories: nutritionData.avgCalories,
      avgProtein: nutritionData.avgProtein,
      daysLogged: nutritionData.daysLogged,
      calorieTarget: nutritionData.calorieTarget,
      proteinTarget: nutritionData.proteinTarget,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function generateProactiveNudges(userId: number, localDate?: string): Promise<{
  nudges: { id: string; message: string; type: "workout" | "nutrition" | "streak" | "goal" | "health"; action?: string; link?: string }[];
  generatedAt: string;
}> {
  const today = localDate || getDateStr();
  const nudges: { id: string; message: string; type: "workout" | "nutrition" | "streak" | "goal" | "health"; action?: string; link?: string }[] = [];

  const todayFoodCount = await db.select({ count: sql<number>`count(*)` })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, today)));

  if ((todayFoodCount[0]?.count || 0) === 0) {
    const hour = new Date().getHours();
    if (hour >= 10) {
      nudges.push({
        id: "no_food_today",
        message: "You haven't logged any meals today. Tracking helps you stay on target!",
        type: "nutrition",
        action: "Log a meal",
        link: "/nutrition",
      });
    }
  }

  const todayWater = await db.select({ total: sql<number>`COALESCE(SUM(${waterLogs.amountOz}), 0)` })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, today)));

  if ((todayWater[0]?.total || 0) < 16) {
    nudges.push({
      id: "low_water",
      message: `Only ${todayWater[0]?.total || 0}oz water today. Your body needs hydration to perform!`,
      type: "health",
      action: "Log water",
      link: "/nutrition",
    });
  }

  const weekStart = getDateStr(7);
  const weekWorkouts = await db.select({ count: sql<number>`count(distinct ${workoutCompletions.completedDate})` })
    .from(workoutCompletions)
    .where(and(
      eq(workoutCompletions.memberId, userId),
      gte(workoutCompletions.completedDate, weekStart),
      lte(workoutCompletions.completedDate, today)
    ));

  const workoutsThisWeek = weekWorkouts[0]?.count || 0;

  const [goalsData] = await db.select()
    .from(userGoals)
    .where(eq(userGoals.userId, userId))
    .limit(1);

  if (goalsData?.weeklyWorkoutDays && workoutsThisWeek < goalsData.weeklyWorkoutDays) {
    const dayOfWeek = new Date().getDay();
    const daysLeft = 7 - dayOfWeek;
    const needed = goalsData.weeklyWorkoutDays - workoutsThisWeek;
    if (needed <= daysLeft) {
      nudges.push({
        id: "workout_goal_gap",
        message: `${workoutsThisWeek}/${goalsData.weeklyWorkoutDays} workouts this week. ${needed} more to hit your goal — you've got ${daysLeft} days left!`,
        type: "workout",
        link: "/workouts",
      });
    }
  }

  let consecutiveDays = 0;
  for (let i = 1; i <= 30; i++) {
    const d = getDateStr(i);
    const [check] = await db.select({ count: sql<number>`count(*)` })
      .from(workoutCompletions)
      .where(and(
        eq(workoutCompletions.memberId, userId),
        eq(workoutCompletions.completedDate, d)
      ));
    if ((check?.count || 0) > 0) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  const [todayCheck] = await db.select({ count: sql<number>`count(*)` })
    .from(workoutCompletions)
    .where(and(
      eq(workoutCompletions.memberId, userId),
      eq(workoutCompletions.completedDate, today)
    ));

  if ((todayCheck?.count || 0) > 0) {
    consecutiveDays++;
  }

  if (consecutiveDays >= 3) {
    nudges.push({
      id: "workout_streak",
      message: `${consecutiveDays}-day workout streak! Keep the momentum going!`,
      type: "streak",
      link: "/workouts",
    });
  }

  if (!goalsData) {
    nudges.push({
      id: "set_goals",
      message: "Set your fitness goals to get personalized insights and track your progress.",
      type: "goal",
      action: "Set goals",
      link: "/goals",
    });
  }

  const nutritionData = await getMemberNutritionData(userId, 1);
  if (nutritionData.todayFoods.length > 0 && nutritionData.proteinTarget) {
    const todayProtein = nutritionData.todayFoods.reduce((s, f) => s + f.protein, 0);
    if (todayProtein < nutritionData.proteinTarget * 0.5) {
      nudges.push({
        id: "low_protein",
        message: `Only ${todayProtein}g protein so far today (target: ${nutritionData.proteinTarget}g). Add a protein-rich meal!`,
        type: "nutrition",
        link: "/nutrition",
      });
    }
  }

  return {
    nudges: nudges.slice(0, 4),
    generatedAt: new Date().toISOString(),
  };
}

export async function generateStatsInterpretation(userId: number): Promise<{
  interpretation: string;
  keyFindings: { label: string; insight: string; type: "positive" | "warning" | "neutral" }[];
  generatedAt: string;
}> {
  const workoutData = await getMemberWorkoutData(userId, 30);
  const nutritionData = await getMemberNutritionData(userId, 7);
  const { user, profile, latestMeasurements } = await getMemberProfile(userId);

  const [goalsData] = await db.select()
    .from(userGoals)
    .where(eq(userGoals.userId, userId))
    .limit(1);

  const muscleBreakdown = Object.entries(workoutData.muscleGroups)
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, count]) => {
      const total = Object.values(workoutData.muscleGroups).reduce((s, v) => s + v, 0);
      return `${muscle}: ${count} exercises (${Math.round(count / total * 100)}%)`;
    }).join(", ");

  const totalSets = workoutData.completions.reduce((s, c) => s + (c.actualSets || 0), 0);
  const totalReps = workoutData.completions.reduce((s, c) => s + (c.actualReps || 0), 0);
  const totalVolume = workoutData.completions.reduce((s, c) => {
    const w = parseFloat(c.actualWeight || "0");
    return s + (w * (c.actualSets || 0) * (c.actualReps || 0));
  }, 0);

  const uniqueDates = new Set(workoutData.completions.map(c => c.completedDate));
  const daysArr = Array.from(uniqueDates).sort();
  const last7 = daysArr.filter(d => d >= getDateStr(7)).length;
  const thisMonth = daysArr.length;

  let currentStreak = 0;
  const today = getDateStr();
  let checkDate = today;
  while (uniqueDates.has(checkDate)) {
    currentStreak++;
    const d = new Date(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = d.toISOString().split("T")[0];
  }

  const prev30Data = await getMemberWorkoutData(userId, 60);
  const prevMonthDays = prev30Data.workoutDaysCount - workoutData.workoutDaysCount;

  const recentExercises = workoutData.completions.slice(0, 15)
    .map(c => `${c.exerciseName}: ${c.actualSets}x${c.actualReps} @ ${c.actualWeight || 'bodyweight'}`)
    .join(", ");

  const prompt = `You are looking at a gym member's stats page and interpreting ALL the data for them. Write a comprehensive but concise interpretation (4-6 sentences).

Member: ${user?.username || 'Member'}
Current streak: ${currentStreak} days
Total workouts this month: ${thisMonth}
Workouts in last 7 days: ${last7}
Previous month workouts: ${prevMonthDays}
Total sets: ${totalSets} | Total reps: ${totalReps} | Total volume: ${Math.round(totalVolume)}kg
Muscle group breakdown: ${muscleBreakdown || 'No data'}
Active cycle: ${workoutData.activeCycle?.name || 'None'} (${workoutData.activeCycle?.cycleLength || 0}-day cycle)
Day labels: ${workoutData.activeCycle?.dayLabels ? JSON.stringify(workoutData.activeCycle.dayLabels) : 'N/A'}
Recent exercises: ${recentExercises || 'No recent data'}
Goals: ${goalsData ? `Target: ${goalsData.primaryGoal || 'not set'}, Weekly workouts: ${goalsData.weeklyWorkoutDays || 'not set'}, Target weight: ${goalsData.targetWeight || 'not set'}` : 'No goals set'}
Body measurements: ${latestMeasurements.length > 0 ? `Weight: ${latestMeasurements[0]?.weight || 'N/A'}kg` : 'No measurements'}
Nutrition (7d avg): ${nutritionData.daysLogged > 0 ? `${nutritionData.avgCalories} cal/day, ${nutritionData.avgProtein}g protein/day (${nutritionData.daysLogged} days logged)` : 'No nutrition data'}
Calorie target: ${nutritionData.calorieTarget || 'Not set'} | Protein target: ${nutritionData.proteinTarget || 'Not set'}

CRITICAL RULES:
- Interpret EVERY metric above that has data. Don't skip any section.
- Reference EXACT numbers from the data (e.g. "your 18 sets across 154 reps" not "your recent sets").
- If muscle groups are imbalanced, name the specific muscles and percentages.
- Compare this month vs last month with actual numbers.
- If they have goals, tell them exactly how they're tracking against each goal.
- If volume is 0 despite having workouts, note they're doing bodyweight work.
- If streak is 0, don't pretend they have one.
- Be honest and direct. If stats are weak, say so with encouragement.
- No bullet points, no headers. Natural flowing paragraph.

Also return exactly 3-4 key findings as JSON. Each finding has: label (short 2-3 word title), insight (1 sentence), type ("positive" if good, "warning" if needs attention, "neutral" if informational).
Return the findings as a JSON array on the LAST line of your response, preceded by "FINDINGS:" on its own line. The interpretation paragraph(s) should come first.`;

  const rawResponse = await callGPT(
    "You are an expert fitness data analyst interpreting a member's workout statistics page. Be specific, honest, data-driven. Never use emojis. Always reference actual numbers from their data.",
    prompt
  );

  let interpretation = rawResponse;
  let keyFindings: { label: string; insight: string; type: "positive" | "warning" | "neutral" }[] = [];

  const findingsIdx = rawResponse.indexOf("FINDINGS:");
  if (findingsIdx !== -1) {
    interpretation = rawResponse.substring(0, findingsIdx).trim();
    const findingsJson = rawResponse.substring(findingsIdx + 9).trim();
    try {
      keyFindings = JSON.parse(findingsJson);
    } catch {
      keyFindings = [
        { label: "Stats Review", insight: "Your stats have been analyzed - see the interpretation above.", type: "neutral" },
      ];
    }
  }

  if (keyFindings.length === 0) {
    keyFindings = [
      { label: "Analysis Complete", insight: "Your stats overview has been interpreted.", type: "neutral" },
    ];
  }

  return {
    interpretation,
    keyFindings: keyFindings.slice(0, 4),
    generatedAt: new Date().toISOString(),
  };
}
