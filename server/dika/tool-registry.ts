import { executeAnalytics, type AnalyticsResult } from "./analytics-engine";

export type ToolName =
  | 'getNutritionSummary'
  | 'getWorkoutProgress'
  | 'getTodayWorkout'
  | 'getHealthSummary'
  | 'getBodyMeasurements'
  | 'runAnalytics'
  | 'getOwnerOverview'
  | 'getSportsData'
  | 'getGoals';

export type UserRole = 'member' | 'trainer' | 'owner';

export interface ToolArgs {
  userId: number;
  gymId: number | null;
  message?: string;
  analyticsIntent?: string;
  period?: string;
  localDate?: string;
  _memberContext?: any;
  _ownerContext?: any;
}

export interface ToolResult {
  success: boolean;
  toolName: ToolName;
  data: any;
  summary: string;
  error?: string;
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  allowedRoles: UserRole[];
  type: 'read' | 'write';
  execute: (args: ToolArgs) => Promise<ToolResult>;
}

function executeGetNutritionSummary(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx || !ctx.nutrition) {
    return Promise.resolve({ success: false, toolName: 'getNutritionSummary', data: null, summary: '', error: 'No member context available' });
  }
  const n = ctx.nutrition;
  const parts: string[] = [
    `Calories: ${n.totalCalories}${n.calorieGoal ? ` / ${n.calorieGoal} goal` : ''}`,
    `Protein: ${n.totalProtein}g${n.proteinGoal ? ` / ${n.proteinGoal}g goal` : ''}`,
    `Carbs: ${n.totalCarbs}g | Fat: ${n.totalFat}g`,
    `Meals logged: ${n.mealsLogged}`,
    `Water: ${n.waterOz}oz / 64oz`,
  ];
  if (n.calorieGoal) {
    parts.push(`Remaining: ${Math.max(0, n.calorieGoal - n.totalCalories)} cal`);
  }
  if (n.mealBreakdown && n.mealBreakdown.length > 0) {
    parts.push(`Meals: ${n.mealBreakdown.map((m: any) => `${m.mealType}: ${m.foods.join(', ')} (${m.calories} cal)`).join(' | ')}`);
  }
  if (n.weeklyAvg) {
    parts.push(`Weekly avg: ${n.weeklyAvg.avgCalories} cal/day, ${n.weeklyAvg.avgProtein}g protein/day over ${n.weeklyAvg.daysLogged} days`);
  }
  return Promise.resolve({
    success: true,
    toolName: 'getNutritionSummary',
    data: { nutrition: n },
    summary: parts.join('. '),
  });
}

function executeGetWorkoutProgress(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getWorkoutProgress', data: null, summary: '', error: 'No member context available' });
  }
  const parts: string[] = [
    `Workouts this week: ${ctx.workoutsThisWeek}`,
    `Workouts this month: ${ctx.workoutsThisMonth}`,
    `Last workout: ${ctx.lastWorkoutDate || 'Never'}`,
    `Current cycle: ${ctx.currentCycleName || 'None assigned'}`,
    `Gym attendance this month: ${ctx.attendanceThisMonth} days`,
    `Subscription: ${ctx.subscriptionStatus}${ctx.subscriptionExpiryDate ? ` (expires ${ctx.subscriptionExpiryDate})` : ''}`,
  ];
  return Promise.resolve({
    success: true,
    toolName: 'getWorkoutProgress',
    data: {
      workoutsThisWeek: ctx.workoutsThisWeek,
      workoutsThisMonth: ctx.workoutsThisMonth,
      lastWorkoutDate: ctx.lastWorkoutDate,
      currentCycleName: ctx.currentCycleName,
      attendanceThisMonth: ctx.attendanceThisMonth,
      subscriptionStatus: ctx.subscriptionStatus,
    },
    summary: parts.join('. '),
  });
}

function executeGetTodayWorkout(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getTodayWorkout', data: null, summary: '', error: 'No member context available' });
  }
  if (!ctx.todayWorkout) {
    return Promise.resolve({
      success: true,
      toolName: 'getTodayWorkout',
      data: { todayWorkout: null },
      summary: 'No workout cycle active — no exercises scheduled today.',
    });
  }
  const tw = ctx.todayWorkout;
  if (tw.isRestDay) {
    return Promise.resolve({
      success: true,
      toolName: 'getTodayWorkout',
      data: { todayWorkout: tw },
      summary: `Today is a Rest Day${tw.dayLabel ? ` (${tw.dayLabel})` : ''}.`,
    });
  }
  const exerciseList = tw.exercises.map((e: any) => `${e.name} (${e.muscleType}) ${e.sets}x${e.reps}${e.isSportExercise ? ' [Sport]' : ''}`).join(', ');
  return Promise.resolve({
    success: true,
    toolName: 'getTodayWorkout',
    data: { todayWorkout: tw },
    summary: `Today${tw.dayLabel ? ` — ${tw.dayLabel}` : ''}: ${tw.exercises.length} exercises. ${exerciseList}. Progress: ${tw.completedCount}/${tw.exercises.length} completed.`,
  });
}

function executeGetHealthSummary(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getHealthSummary', data: null, summary: '', error: 'No member context available' });
  }
  const h = ctx.healthData;
  if (!h.connected) {
    return Promise.resolve({
      success: true,
      toolName: 'getHealthSummary',
      data: { healthData: h },
      summary: 'No fitness device connected.',
    });
  }
  const parts: string[] = [];
  if (h.today) {
    if (h.today.steps !== undefined) parts.push(`Steps today: ${h.today.steps.toLocaleString()}`);
    if (h.today.caloriesBurned !== undefined) parts.push(`Calories burned: ${h.today.caloriesBurned.toLocaleString()}`);
    if (h.today.activeMinutes !== undefined) parts.push(`Active minutes: ${h.today.activeMinutes}`);
    if (h.today.avgHeartRate !== undefined) parts.push(`Heart rate: ${h.today.avgHeartRate} bpm`);
    if (h.today.sleepMinutes !== undefined) parts.push(`Sleep: ${Math.floor(h.today.sleepMinutes / 60)}h ${h.today.sleepMinutes % 60}m`);
  }
  if (h.recoveryScore !== null) {
    const level = h.recoveryScore >= 80 ? 'Excellent' : h.recoveryScore >= 60 ? 'Good' : h.recoveryScore >= 40 ? 'Fair' : 'Low';
    parts.push(`Recovery score: ${h.recoveryScore}/100 (${level})`);
  }
  if (h.weeklyAvg) {
    parts.push(`Weekly avg — Steps: ${h.weeklyAvg.steps.toLocaleString()}, Burned: ${h.weeklyAvg.caloriesBurned.toLocaleString()} cal, Sleep: ${Math.floor(h.weeklyAvg.sleepMinutes / 60)}h ${h.weeklyAvg.sleepMinutes % 60}m (${h.weeklyAvg.daysTracked} days tracked)`);
  }
  return Promise.resolve({
    success: true,
    toolName: 'getHealthSummary',
    data: { healthData: h },
    summary: parts.length > 0 ? parts.join('. ') : 'Fitness device connected but no data synced today.',
  });
}

function executeGetBodyMeasurements(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getBodyMeasurements', data: null, summary: '', error: 'No member context available' });
  }
  const bm = ctx.bodyMeasurements;
  if (!bm.latest) {
    return Promise.resolve({
      success: true,
      toolName: 'getBodyMeasurements',
      data: { bodyMeasurements: bm },
      summary: 'No body measurements recorded yet.',
    });
  }
  const parts: string[] = [];
  const l = bm.latest;
  parts.push(`Latest (${l.date}): ${l.weight ? `Weight: ${l.weight}kg` : ''}${l.bodyFat ? `, Body Fat: ${l.bodyFat}%` : ''}`);
  if (bm.previous) {
    const p = bm.previous;
    parts.push(`Previous (${p.date}): ${p.weight ? `Weight: ${p.weight}kg` : ''}${p.bodyFat ? `, Body Fat: ${p.bodyFat}%` : ''}`);
    if (l.weight && p.weight) {
      const diff = l.weight - p.weight;
      parts.push(`Weight change: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg`);
    }
  }
  return Promise.resolve({
    success: true,
    toolName: 'getBodyMeasurements',
    data: { bodyMeasurements: bm },
    summary: parts.join('. '),
  });
}

async function executeRunAnalytics(args: ToolArgs): Promise<ToolResult> {
  if (!args.analyticsIntent) {
    return { success: false, toolName: 'runAnalytics', data: null, summary: '', error: 'No analytics intent provided' };
  }
  try {
    const result = await executeAnalytics(args.analyticsIntent, args.userId, args.gymId, {
      period: args.period || '4_weeks',
      role: 'member',
    });
    if (!result) {
      return { success: false, toolName: 'runAnalytics', data: null, summary: '', error: 'No analytics data returned' };
    }
    return {
      success: true,
      toolName: 'runAnalytics',
      data: result.data,
      summary: result.summary,
    };
  } catch (error) {
    return { success: false, toolName: 'runAnalytics', data: null, summary: '', error: String(error) };
  }
}

function executeGetOwnerOverview(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._ownerContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getOwnerOverview', data: null, summary: '', error: 'No owner context available' });
  }
  const parts: string[] = [
    `Total members: ${ctx.totalMembers}`,
    `Active members: ${ctx.activeMembers}`,
    `Checked in today: ${ctx.checkedInToday}`,
    `Attendance rate: ${ctx.attendanceRate}%`,
    `Revenue this month: ${ctx.revenueThisMonth}`,
    `Unpaid this month: ${ctx.unpaidThisMonth}`,
    `Expiring this month: ${ctx.expiringThisMonth}`,
    `New members this month: ${ctx.recentTrends?.newMembersThisMonth || 0}`,
  ];
  if (ctx.unpaidMemberNames && ctx.unpaidMemberNames.length > 0) {
    parts.push(`Unpaid members: ${ctx.unpaidMemberNames.join(', ')}`);
  }
  return Promise.resolve({
    success: true,
    toolName: 'getOwnerOverview',
    data: ctx,
    summary: parts.join('. '),
  });
}

function executeGetSportsData(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getSportsData', data: null, summary: '', error: 'No member context available' });
  }
  const sm = ctx.sportsMode;
  if (!sm.profile) {
    return Promise.resolve({
      success: true,
      toolName: 'getSportsData',
      data: { sportsMode: sm },
      summary: 'No sport profile set up.',
    });
  }
  const parts: string[] = [
    `Sport: ${sm.profile.sport} (${sm.profile.role})`,
    sm.profile.fitnessScore !== null ? `Fitness score: ${sm.profile.fitnessScore}/100` : '',
    `Active skill programs: ${sm.activeModifications.length}`,
  ];
  if (sm.activeModifications.length > 0) {
    parts.push(`Skills: ${sm.activeModifications.map((m: any) => m.skillName).join(', ')}`);
    parts.push(`Sport exercises in cycle: ${sm.totalSportExercises}/${sm.totalCycleExercises} (${sm.impactScore}% impact)`);
  }
  const mh = sm.matchHistory;
  parts.push(`Matches this week: ${mh.thisWeekCount}, this month: ${mh.thisMonthCount}`);
  if (mh.avgDuration > 0) parts.push(`Avg match duration: ${mh.avgDuration}min`);
  if (mh.totalCaloriesBurned > 0) parts.push(`Total match calories: ${mh.totalCaloriesBurned}`);
  return Promise.resolve({
    success: true,
    toolName: 'getSportsData',
    data: { sportsMode: sm },
    summary: parts.filter(Boolean).join('. '),
  });
}

function executeGetGoals(args: ToolArgs): Promise<ToolResult> {
  const ctx = args._memberContext;
  if (!ctx) {
    return Promise.resolve({ success: false, toolName: 'getGoals', data: null, summary: '', error: 'No member context available' });
  }
  const parts: string[] = [];
  if (ctx.fitnessGoals?.hasGoals) {
    const fg = ctx.fitnessGoals;
    if (fg.primaryGoal) parts.push(`Primary goal: ${fg.primaryGoal.replace('_', ' ')}`);
    if (fg.targetWeight) parts.push(`Target weight: ${fg.targetWeight} ${fg.targetWeightUnit || 'kg'}`);
    if (fg.dailyCalorieTarget) parts.push(`Daily calorie target: ${fg.dailyCalorieTarget}`);
    if (fg.dailyProteinTarget) parts.push(`Daily protein target: ${fg.dailyProteinTarget}g`);
    if (fg.weeklyWorkoutDays) parts.push(`Workout frequency goal: ${fg.weeklyWorkoutDays} days/week`);
    if (fg.customGoalText) parts.push(`Custom goal: ${fg.customGoalText}`);
  }
  if (ctx.activeGoals && ctx.activeGoals.length > 0) {
    for (const g of ctx.activeGoals) {
      parts.push(`Goal: ${g.title}${g.targetValue ? ` (target: ${g.targetValue}${g.targetUnit || ''})` : ''}${g.currentValue ? ` — at ${g.currentValue}${g.targetUnit || ''}` : ''}`);
    }
  }
  if (parts.length === 0) {
    return Promise.resolve({
      success: true,
      toolName: 'getGoals',
      data: { fitnessGoals: ctx.fitnessGoals, activeGoals: ctx.activeGoals },
      summary: 'No fitness goals set yet.',
    });
  }
  return Promise.resolve({
    success: true,
    toolName: 'getGoals',
    data: { fitnessGoals: ctx.fitnessGoals, activeGoals: ctx.activeGoals },
    summary: parts.join('. '),
  });
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'getNutritionSummary',
    description: "Get today's calorie/protein/carbs/fat intake, meals logged, water, weekly nutrition averages",
    allowedRoles: ['member', 'trainer'],
    type: 'read',
    execute: executeGetNutritionSummary,
  },
  {
    name: 'getWorkoutProgress',
    description: 'Get workout count this week/month, last workout date, current cycle name, attendance',
    allowedRoles: ['member', 'trainer'],
    type: 'read',
    execute: executeGetWorkoutProgress,
  },
  {
    name: 'getTodayWorkout',
    description: "Get today's scheduled exercises with sets/reps, rest day status, and completion progress",
    allowedRoles: ['member', 'trainer'],
    type: 'read',
    execute: executeGetTodayWorkout,
  },
  {
    name: 'getHealthSummary',
    description: 'Get steps, calories burned, sleep, heart rate, recovery score from fitness device',
    allowedRoles: ['member'],
    type: 'read',
    execute: executeGetHealthSummary,
  },
  {
    name: 'getBodyMeasurements',
    description: 'Get weight, body fat percentage, latest and previous measurements with trends',
    allowedRoles: ['member'],
    type: 'read',
    execute: executeGetBodyMeasurements,
  },
  {
    name: 'runAnalytics',
    description: 'Run deep analytics: workout trends, nutrition patterns, strength progression, calorie analysis over time',
    allowedRoles: ['member', 'owner'],
    type: 'read',
    execute: executeRunAnalytics,
  },
  {
    name: 'getOwnerOverview',
    description: 'Get gym business data: member counts, revenue, attendance rate, unpaid members, churn risk',
    allowedRoles: ['owner'],
    type: 'read',
    execute: executeGetOwnerOverview,
  },
  {
    name: 'getSportsData',
    description: 'Get sport profile, active training programs, match history and stats',
    allowedRoles: ['member'],
    type: 'read',
    execute: executeGetSportsData,
  },
  {
    name: 'getGoals',
    description: "Get user's fitness goals, targets, and progress toward them",
    allowedRoles: ['member'],
    type: 'read',
    execute: executeGetGoals,
  },
];

export function getToolsForRole(role: UserRole): Map<ToolName, ToolDefinition> {
  const map = new Map<ToolName, ToolDefinition>();
  for (const tool of TOOL_DEFINITIONS) {
    if (tool.allowedRoles.includes(role)) {
      map.set(tool.name, tool);
    }
  }
  return map;
}

export function getToolDescriptionsForRole(role: UserRole): string {
  return TOOL_DEFINITIONS
    .filter(t => t.allowedRoles.includes(role))
    .map(t => `${t.name}: ${t.description}`)
    .join('\n');
}

export function isValidTool(name: string, role: UserRole): boolean {
  const tools = getToolsForRole(role);
  return tools.has(name as ToolName);
}
