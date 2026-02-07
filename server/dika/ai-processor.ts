import OpenAI from "openai";
import { db } from "../db";
import { 
  users, 
  userProfiles, 
  workoutCycles, 
  workoutCompletions,
  workoutItems,
  attendance, 
  payments, 
  paymentTransactions,
  bodyMeasurements,
  trainerMemberAssignments,
  gyms,
  memberSubscriptions,
  healthData
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray, isNull, or } from "drizzle-orm";
import { detectExerciseQuestion, findExercise, formatExerciseResponse } from "./exercise-database";
import { detectWorkoutGenerationRequest, generateWorkoutPlan } from "./workout-generator";
import { detectMealLogRequest, parseMealFromMessage, logMealForUser, getTodayNutritionSummary, formatMealLogResponse } from "./meal-logger";
import { detectOwnerAction, processOwnerAction, OwnerActionType } from "./owner-actions";

function detectPendingActionFromHistory(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): OwnerActionType | null {
  if (!conversationHistory || conversationHistory.length < 2) return null;

  const recentMessages = conversationHistory.slice(-8);

  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      const action = detectOwnerAction(msg.content);
      if (action && action !== 'navigate') {
        const laterAssistantMsgs = recentMessages.slice(recentMessages.indexOf(msg) + 1).filter(m => m.role === 'assistant');
        const hasConfirmation = laterAssistantMsgs.some(m => m.content.includes('DIKA_ACTION_DATA') && m.content.includes('pending_confirmation'));
        if (!hasConfirmation) {
          return action;
        }
      }
    }
  }

  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.role !== 'assistant') continue;
    const content = msg.content.toLowerCase();

    if (content.includes('dika_action_data') && content.includes('pending_confirmation')) {
      return null;
    }

    if (
      (content.includes('add') && content.includes('member')) ||
      content.includes('full name') ||
      content.includes('email address') ||
      content.includes('new member') ||
      content.includes('name and email')
    ) {
      return 'add_member';
    }

    if (
      (content.includes('log') && content.includes('payment')) ||
      content.includes('payment amount') ||
      content.includes('payment method') ||
      content.includes('amount and method') ||
      (content.includes('payment') && content.includes('member')) ||
      (content.includes('payment') && content.includes('amount')) ||
      content.includes('membership plan') ||
      content.includes('paying the full amount') ||
      content.includes('full amount of') ||
      content.includes('outstanding balance') ||
      content.includes('how much') && content.includes('pay')
    ) {
      return 'log_payment';
    }

    if (
      (content.includes('assign') && content.includes('trainer')) ||
      content.includes('which trainer')
    ) {
      return 'assign_trainer';
    }

    break;
  }

  return null;
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

type UserRole = 'member' | 'trainer' | 'owner';

interface UserContext {
  role: UserRole;
  gymId: number | null;
  userId: number;
  userName: string;
  gymName?: string;
  gymCurrency?: string;
}

interface MemberContext {
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  lastWorkoutDate: string | null;
  currentCycleName: string | null;
  attendanceThisMonth: number;
  bodyMeasurements: {
    latest: { weight?: number; bodyFat?: number; date: string } | null;
    previous: { weight?: number; bodyFat?: number; date: string } | null;
  };
  subscriptionStatus: string;
  subscriptionExpiryDate: string | null;
  healthData: {
    connected: boolean;
    source: string | null;
    today: {
      steps?: number;
      caloriesBurned?: number;
      activeMinutes?: number;
      avgHeartRate?: number;
      sleepMinutes?: number;
    } | null;
  };
  nutrition: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    calorieGoal: number | null;
    proteinGoal: number | null;
    mealsLogged: number;
  };
}

interface OwnerContext {
  totalMembers: number;
  activeMembers: number;
  checkedInToday: number;
  unpaidThisMonth: number;
  expiringThisMonth: number;
  revenueThisMonth: number;
  attendanceRate: number;
  recentTrends: {
    newMembersThisMonth: number;
    attendanceChange: string;
  };
  // Detailed lists (first 10 for each)
  unpaidMemberNames: string[];
  checkedInTodayNames: string[];
  expiringMemberNames: string[];
  notCheckedInTodayNames: string[];
}

interface TrainerContext {
  assignedMembers: number;
  membersCheckedInToday: number;
  membersSkippedThisWeek: number;
}

function getDateRanges() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const today = now.toISOString().split('T')[0];
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  return {
    weekStart: startOfWeek.toISOString().split('T')[0],
    weekEnd: now.toISOString().split('T')[0],
    monthStart: startOfMonth.toISOString().split('T')[0],
    monthEnd: endOfMonth.toISOString().split('T')[0],
    today,
    currentMonth
  };
}

async function getMemberDataContext(userId: number, gymId: number | null): Promise<MemberContext> {
  const dates = getDateRanges();
  
  const [weeklyWorkouts] = await db.select({
    count: sql<number>`count(distinct ${workoutCompletions.completedDate})`
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, dates.weekStart),
    lte(workoutCompletions.completedDate, dates.weekEnd)
  ));
  
  const [monthlyWorkouts] = await db.select({
    count: sql<number>`count(distinct ${workoutCompletions.completedDate})`
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, dates.monthStart),
    lte(workoutCompletions.completedDate, dates.monthEnd)
  ));
  
  const [lastWorkout] = await db.select({ completedDate: workoutCompletions.completedDate })
    .from(workoutCompletions)
    .where(eq(workoutCompletions.memberId, userId))
    .orderBy(desc(workoutCompletions.completedDate))
    .limit(1);
  
  const source = gymId ? 'trainer' : 'self';
  const [currentCycle] = await db.select({ name: workoutCycles.name })
    .from(workoutCycles)
    .where(and(
      eq(workoutCycles.memberId, userId),
      eq(workoutCycles.source, source),
      eq(workoutCycles.isActive, true)
    ))
    .limit(1);
  
  const [monthlyAttendance] = await db.select({
    count: sql<number>`count(*)`
  })
  .from(attendance)
  .where(and(
    eq(attendance.memberId, userId),
    gte(attendance.date, dates.monthStart),
    lte(attendance.date, dates.monthEnd)
  ));
  
  const bodyMeasurementsData = await db.select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.memberId, userId))
    .orderBy(desc(bodyMeasurements.recordedDate))
    .limit(2);
  
  let subscriptionStatus = 'unknown';
  let subscriptionExpiryDate: string | null = null;
  
  if (gymId) {
    const [subscription] = await db.select({
      status: memberSubscriptions.status,
      endDate: memberSubscriptions.endDate
    })
    .from(memberSubscriptions)
    .where(and(
      eq(memberSubscriptions.memberId, userId),
      eq(memberSubscriptions.gymId, gymId)
    ))
    .orderBy(desc(memberSubscriptions.createdAt))
    .limit(1);
    
    if (subscription) {
      subscriptionStatus = subscription.status || 'unknown';
      subscriptionExpiryDate = subscription.endDate || null;
    }
  }
  
  const [userData] = await db.select({
    healthConnected: users.healthConnected,
    healthSource: users.healthSource
  })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

  let healthContext: MemberContext['healthData'] = {
    connected: false,
    source: null,
    today: null
  };

  if (userData?.healthConnected) {
    const [todayHealth] = await db.select()
      .from(healthData)
      .where(and(
        eq(healthData.userId, userId),
        eq(healthData.date, dates.today)
      ))
      .limit(1);

    healthContext = {
      connected: true,
      source: userData.healthSource || null,
      today: todayHealth ? {
        steps: todayHealth.steps || undefined,
        caloriesBurned: todayHealth.caloriesBurned || undefined,
        activeMinutes: todayHealth.activeMinutes || undefined,
        avgHeartRate: todayHealth.avgHeartRate || undefined,
        sleepMinutes: todayHealth.sleepMinutes || undefined
      } : null
    };
  }
  
  return {
    workoutsThisWeek: weeklyWorkouts?.count || 0,
    workoutsThisMonth: monthlyWorkouts?.count || 0,
    lastWorkoutDate: lastWorkout?.completedDate || null,
    currentCycleName: currentCycle?.name || null,
    attendanceThisMonth: monthlyAttendance?.count || 0,
    bodyMeasurements: {
      latest: bodyMeasurementsData[0] ? {
        weight: bodyMeasurementsData[0].weight || undefined,
        bodyFat: bodyMeasurementsData[0].bodyFat || undefined,
        date: bodyMeasurementsData[0].recordedDate
      } : null,
      previous: bodyMeasurementsData[1] ? {
        weight: bodyMeasurementsData[1].weight || undefined,
        bodyFat: bodyMeasurementsData[1].bodyFat || undefined,
        date: bodyMeasurementsData[1].recordedDate
      } : null
    },
    subscriptionStatus,
    subscriptionExpiryDate,
    healthData: healthContext,
    nutrition: await getTodayNutritionSummary(userId)
  };
}

async function getOwnerDataContext(gymId: number): Promise<OwnerContext> {
  const dates = getDateRanges();
  
  const [totalMembersResult] = await db.select({
    count: sql<number>`count(*)`
  })
  .from(users)
  .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
  
  const [activeMembersResult] = await db.select({
    count: sql<number>`count(distinct ${memberSubscriptions.memberId})`
  })
  .from(memberSubscriptions)
  .where(and(
    eq(memberSubscriptions.gymId, gymId),
    eq(memberSubscriptions.status, 'active')
  ));
  
  const [checkedInResult] = await db.select({
    count: sql<number>`count(distinct ${attendance.memberId})`
  })
  .from(attendance)
  .where(and(
    eq(attendance.gymId, gymId),
    eq(attendance.date, dates.today)
  ));
  
  const memberIds = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
  
  const memberIdList = memberIds.map(m => m.id);
  
  // Calculate unpaid members based on active subscriptions and payment transactions
  // A member is "unpaid" if they have an active subscription where totalPaid < totalAmount
  let unpaidCount = 0;
  let unpaidMemberNames: string[] = [];
  if (memberIdList.length > 0) {
    // Get active subscriptions for all members
    const activeSubscriptions = await db.select({
      memberId: memberSubscriptions.memberId,
      subscriptionId: memberSubscriptions.id,
      totalAmount: memberSubscriptions.totalAmount,
    })
    .from(memberSubscriptions)
    .where(and(
      eq(memberSubscriptions.gymId, gymId),
      inArray(memberSubscriptions.memberId, memberIdList),
      eq(memberSubscriptions.status, 'active')
    ));
    
    // Get total paid per subscription
    const subscriptionIds = activeSubscriptions.map(s => s.subscriptionId);
    let paidAmountsMap = new Map<number, number>();
    
    if (subscriptionIds.length > 0) {
      const paidAmounts = await db.select({
        subscriptionId: paymentTransactions.subscriptionId,
        totalPaid: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
      })
      .from(paymentTransactions)
      .where(inArray(paymentTransactions.subscriptionId, subscriptionIds))
      .groupBy(paymentTransactions.subscriptionId);
      
      paidAmountsMap = new Map(paidAmounts.map(p => [p.subscriptionId, Number(p.totalPaid)]));
    }
    
    // Find members with outstanding balance (paid < owed)
    const unpaidMemberIds: number[] = [];
    for (const sub of activeSubscriptions) {
      const totalPaid = paidAmountsMap.get(sub.subscriptionId) || 0;
      if (totalPaid < sub.totalAmount) {
        unpaidMemberIds.push(sub.memberId);
      }
    }
    unpaidCount = unpaidMemberIds.length;
    
    // Get names of unpaid members (limit to first 10)
    if (unpaidMemberIds.length > 0) {
      const unpaidMembersData = await db.select({
        id: users.id,
        username: users.username
      })
      .from(users)
      .where(inArray(users.id, unpaidMemberIds.slice(0, 10)));
      
      // Try to get full names from profiles
      const unpaidProfiles = await db.select({
        userId: userProfiles.userId,
        fullName: userProfiles.fullName
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, unpaidMemberIds.slice(0, 10)));
      
      const profileMap = new Map(unpaidProfiles.map(p => [p.userId, p.fullName]));
      unpaidMemberNames = unpaidMembersData.map(m => profileMap.get(m.id) || m.username);
    }
  }
  
  const [expiringResult] = await db.select({
    count: sql<number>`count(distinct ${memberSubscriptions.memberId})`
  })
  .from(memberSubscriptions)
  .where(and(
    eq(memberSubscriptions.gymId, gymId),
    sql`${memberSubscriptions.endDate}::date >= CURRENT_DATE`,
    sql`${memberSubscriptions.endDate}::date <= CURRENT_DATE + INTERVAL '30 days'`
  ));
  
  const [revenueResult] = await db.select({
    total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
  })
  .from(paymentTransactions)
  .where(and(
    eq(paymentTransactions.gymId, gymId),
    sql`${paymentTransactions.paidOn}::date >= ${dates.monthStart}::date`,
    sql`${paymentTransactions.paidOn}::date <= ${dates.monthEnd}::date`
  ));
  
  const totalMembers = totalMembersResult?.count || 0;
  const checkedIn = checkedInResult?.count || 0;
  const attendanceRate = totalMembers > 0 ? Math.round((checkedIn / totalMembers) * 100) : 0;
  
  const [newMembersResult] = await db.select({
    count: sql<number>`count(*)`
  })
  .from(users)
  .where(and(
    eq(users.gymId, gymId),
    eq(users.role, 'member'),
    gte(users.createdAt, new Date(dates.monthStart))
  ));
  
  // Get names of members who checked in today
  const checkedInMemberIds = await db.select({ memberId: attendance.memberId })
    .from(attendance)
    .where(and(
      eq(attendance.gymId, gymId),
      eq(attendance.date, dates.today)
    ));
  
  let checkedInTodayNames: string[] = [];
  if (checkedInMemberIds.length > 0) {
    const checkedInIds = checkedInMemberIds.map(c => c.memberId).slice(0, 10);
    const checkedInUsers = await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, checkedInIds));
    const checkedInProfiles = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, checkedInIds));
    const profileMap = new Map(checkedInProfiles.map(p => [p.userId, p.fullName]));
    checkedInTodayNames = checkedInUsers.map(u => profileMap.get(u.id) || u.username);
  }
  
  // Get names of members who haven't checked in today (from active members)
  const checkedInSet = new Set(checkedInMemberIds.map(c => c.memberId));
  const notCheckedInIds = memberIdList.filter(id => !checkedInSet.has(id)).slice(0, 10);
  let notCheckedInTodayNames: string[] = [];
  if (notCheckedInIds.length > 0) {
    const notCheckedInUsers = await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, notCheckedInIds));
    const notCheckedInProfiles = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, notCheckedInIds));
    const profileMap = new Map(notCheckedInProfiles.map(p => [p.userId, p.fullName]));
    notCheckedInTodayNames = notCheckedInUsers.map(u => profileMap.get(u.id) || u.username);
  }
  
  // Get names of members with expiring subscriptions
  const expiringMembers = await db.select({ memberId: memberSubscriptions.memberId })
    .from(memberSubscriptions)
    .where(and(
      eq(memberSubscriptions.gymId, gymId),
      sql`${memberSubscriptions.endDate}::date >= CURRENT_DATE`,
      sql`${memberSubscriptions.endDate}::date <= CURRENT_DATE + INTERVAL '30 days'`
    ));
  
  let expiringMemberNames: string[] = [];
  if (expiringMembers.length > 0) {
    const expiringIds = expiringMembers.map(e => e.memberId).slice(0, 10);
    const expiringUsers = await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, expiringIds));
    const expiringProfiles = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, expiringIds));
    const profileMap = new Map(expiringProfiles.map(p => [p.userId, p.fullName]));
    expiringMemberNames = expiringUsers.map(u => profileMap.get(u.id) || u.username);
  }
  
  return {
    totalMembers,
    activeMembers: activeMembersResult?.count || 0,
    checkedInToday: checkedIn,
    unpaidThisMonth: unpaidCount,
    expiringThisMonth: expiringResult?.count || 0,
    revenueThisMonth: (revenueResult?.total || 0) / 100,
    attendanceRate,
    recentTrends: {
      newMembersThisMonth: newMembersResult?.count || 0,
      attendanceChange: 'stable'
    },
    unpaidMemberNames,
    checkedInTodayNames,
    expiringMemberNames,
    notCheckedInTodayNames
  };
}

async function getTrainerDataContext(trainerId: number, gymId: number): Promise<TrainerContext> {
  const dates = getDateRanges();
  
  const assignments = await db.select({ memberId: trainerMemberAssignments.memberId })
    .from(trainerMemberAssignments)
    .where(and(
      eq(trainerMemberAssignments.trainerId, trainerId),
      eq(trainerMemberAssignments.gymId, gymId),
      isNull(trainerMemberAssignments.endedAt)
    ));
  
  const memberIds = assignments.map(a => a.memberId);
  
  let checkedInToday = 0;
  let skippedThisWeek = 0;
  
  if (memberIds.length > 0) {
    const [checkedInResult] = await db.select({
      count: sql<number>`count(distinct ${attendance.memberId})`
    })
    .from(attendance)
    .where(and(
      inArray(attendance.memberId, memberIds),
      eq(attendance.date, dates.today)
    ));
    checkedInToday = checkedInResult?.count || 0;
    
    const activeMembers = await db.select({
      memberId: workoutCompletions.memberId
    })
    .from(workoutCompletions)
    .where(and(
      inArray(workoutCompletions.memberId, memberIds),
      gte(workoutCompletions.completedDate, dates.weekStart)
    ));
    
    const activeMemberIds = new Set(activeMembers.map(m => m.memberId));
    skippedThisWeek = memberIds.filter(id => !activeMemberIds.has(id)).length;
  }
  
  return {
    assignedMembers: memberIds.length,
    membersCheckedInToday: checkedInToday,
    membersSkippedThisWeek: skippedThisWeek
  };
}

function buildSystemPrompt(userContext: UserContext, dataContext: MemberContext | OwnerContext | TrainerContext): string {
  const basePrompt = `You are Dika, an intelligent AI assistant for OGym - a gym management platform. You help ${userContext.role}s understand their gym data and provide actionable insights.

IMPORTANT RULES:
1. You can ONLY answer questions about data you have access to. Never make up information.
2. Be conversational but concise - aim for 2-4 sentences unless more detail is needed.
3. When analyzing data, provide specific insights and actionable recommendations.
4. If asked about something outside your data, politely explain what you can help with.
5. You ARE a fitness expert - provide helpful advice about exercises, muscle building, fat loss, workout routines, nutrition basics, and body composition. Only suggest consulting a doctor for medical conditions, injuries, or pain.
6. Be encouraging, supportive, and helpful with all fitness-related questions.

USER CONTEXT:
- Name: ${userContext.userName}
- Role: ${userContext.role}
${userContext.gymName ? `- Gym: ${userContext.gymName}` : '- Mode: Personal (no gym)'}
${userContext.gymCurrency ? `- Currency: ${userContext.gymCurrency === 'USD' ? '$' : '₹'}` : ''}

TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
`;

  if (userContext.role === 'member') {
    const ctx = dataContext as MemberContext;
    
    const getHealthSourceLabel = (source: string | null): string => {
      if (source === 'apple_health') return 'Apple Health';
      if (source === 'google_fit') return 'Google Fit';
      return 'fitness device';
    };
    
    const healthDataSection = ctx.healthData.connected && ctx.healthData.today ? `
FITNESS DEVICE DATA (from ${getHealthSourceLabel(ctx.healthData.source)}):
- Steps today: ${ctx.healthData.today.steps?.toLocaleString() || 'N/A'}
- Calories burned today: ${ctx.healthData.today.caloriesBurned?.toLocaleString() || 'N/A'}
- Active minutes: ${ctx.healthData.today.activeMinutes || 'N/A'}
- Average heart rate: ${ctx.healthData.today.avgHeartRate || 'N/A'} bpm
- Sleep last night: ${ctx.healthData.today.sleepMinutes ? `${Math.floor(ctx.healthData.today.sleepMinutes / 60)}h ${ctx.healthData.today.sleepMinutes % 60}m` : 'N/A'}
` : ctx.healthData.connected ? `
FITNESS DEVICE: Connected to ${getHealthSourceLabel(ctx.healthData.source)} (no data synced today)
` : '';
    
    return basePrompt + `
MEMBER DATA:
- Workouts this week: ${ctx.workoutsThisWeek}
- Workouts this month: ${ctx.workoutsThisMonth}
- Last workout: ${ctx.lastWorkoutDate || 'Never'}
- Current workout cycle: ${ctx.currentCycleName || 'None assigned'}
- Gym attendance this month: ${ctx.attendanceThisMonth} days
- Subscription: ${ctx.subscriptionStatus}${ctx.subscriptionExpiryDate ? ` (expires ${ctx.subscriptionExpiryDate})` : ''}
${ctx.bodyMeasurements.latest ? `
BODY MEASUREMENTS:
- Latest (${ctx.bodyMeasurements.latest.date}): ${ctx.bodyMeasurements.latest.weight ? `Weight: ${ctx.bodyMeasurements.latest.weight}kg` : ''}${ctx.bodyMeasurements.latest.bodyFat ? `, Body Fat: ${ctx.bodyMeasurements.latest.bodyFat}%` : ''}
${ctx.bodyMeasurements.previous ? `- Previous (${ctx.bodyMeasurements.previous.date}): ${ctx.bodyMeasurements.previous.weight ? `Weight: ${ctx.bodyMeasurements.previous.weight}kg` : ''}${ctx.bodyMeasurements.previous.bodyFat ? `, Body Fat: ${ctx.bodyMeasurements.previous.bodyFat}%` : ''}` : ''}
` : '- No body measurements recorded'}
${healthDataSection}
NUTRITION TODAY:
- Calories consumed: ${ctx.nutrition.totalCalories}${ctx.nutrition.calorieGoal ? ` / ${ctx.nutrition.calorieGoal} goal` : ''} (${ctx.nutrition.mealsLogged} items logged)
- Protein: ${ctx.nutrition.totalProtein}g${ctx.nutrition.proteinGoal ? ` / ${ctx.nutrition.proteinGoal}g goal` : ''}
- Carbs: ${ctx.nutrition.totalCarbs}g | Fat: ${ctx.nutrition.totalFat}g
${ctx.nutrition.calorieGoal ? `- Remaining: ${Math.max(0, ctx.nutrition.calorieGoal - ctx.nutrition.totalCalories)} cal` : '- No calorie goal set'}

IMPORTANT - MEAL LOGGING:
- When the user tells you what they ate (e.g. "I had eggs and toast"), the system automatically detects and logs it. You do NOT need to handle meal logging yourself.
- You CAN answer questions about their nutrition data shown above.

You can help this member with:
- Workout progress and consistency analysis
- Attendance patterns
- Body measurement trends and progress
- Subscription status
- Nutrition tracking and calorie analysis
${ctx.healthData.connected ? '- Fitness device data analysis (steps, calories burned, heart rate, sleep)' : ''}
- Motivation and encouragement based on their data`;
  }
  
  if (userContext.role === 'owner') {
    const ctx = dataContext as OwnerContext;
    const currency = userContext.gymCurrency === 'USD' ? '$' : '₹';
    
    const unpaidList = ctx.unpaidMemberNames.length > 0 
      ? `\n  Names: ${ctx.unpaidMemberNames.join(', ')}${ctx.unpaidThisMonth > 10 ? ` (and ${ctx.unpaidThisMonth - 10} more)` : ''}`
      : '';
    const checkedInList = ctx.checkedInTodayNames.length > 0
      ? `\n  Names: ${ctx.checkedInTodayNames.join(', ')}${ctx.checkedInToday > 10 ? ` (and ${ctx.checkedInToday - 10} more)` : ''}`
      : '';
    const notCheckedInList = ctx.notCheckedInTodayNames.length > 0
      ? `\n- NOT checked in today (sample): ${ctx.notCheckedInTodayNames.join(', ')}`
      : '';
    const expiringList = ctx.expiringMemberNames.length > 0
      ? `\n  Names: ${ctx.expiringMemberNames.join(', ')}${ctx.expiringThisMonth > 10 ? ` (and ${ctx.expiringThisMonth - 10} more)` : ''}`
      : '';
    
    return basePrompt + `
GYM OVERVIEW:
- Total members: ${ctx.totalMembers}
- Active subscriptions: ${ctx.activeMembers}
- Checked in today: ${ctx.checkedInToday} (${ctx.attendanceRate}% of total)${checkedInList}${notCheckedInList}
- Unpaid this month: ${ctx.unpaidThisMonth}${unpaidList}
- Expiring within 30 days: ${ctx.expiringThisMonth}${expiringList}
- Revenue this month: ${currency}${ctx.revenueThisMonth.toLocaleString()}
- New members this month: ${ctx.recentTrends.newMembersThisMonth}

You can help this owner with:
- Business performance analysis and member lists
- Member retention insights with specific names
- Revenue and payment tracking
- Attendance trends
- Strategic recommendations for gym growth
- Identifying members at risk of churning
- Suggestions to improve member engagement`;
  }
  
  if (userContext.role === 'trainer') {
    const ctx = dataContext as TrainerContext;
    return basePrompt + `
TRAINER DATA:
- Assigned members: ${ctx.assignedMembers}
- Members checked in today: ${ctx.membersCheckedInToday}
- Members who skipped workouts this week: ${ctx.membersSkippedThisWeek}

You can help this trainer with:
- Member progress tracking
- Identifying members who need attention
- Workout consistency of their assigned members
- Training schedule optimization`;
  }
  
  return basePrompt;
}

export async function processWithAI(
  userId: number,
  role: UserRole,
  gymId: number | null,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; followUpChips: string[] }> {
  const exerciseQuery = detectExerciseQuestion(message);
  if (exerciseQuery) {
    const exercise = findExercise(exerciseQuery);
    if (exercise) {
      const answer = formatExerciseResponse(exercise);
      const followUpChips = [
        'What muscles does it work?',
        'Alternative exercises',
        'My workout progress'
      ];
      return { answer, followUpChips };
    }
  }
  
  if (detectWorkoutGenerationRequest(message)) {
    try {
      const { formattedResponse } = await generateWorkoutPlan(message);
      const followUpChips = [
        'Modify this plan',
        'Create another workout',
        'Explain the exercises'
      ];
      return { answer: formattedResponse, followUpChips };
    } catch (error) {
      console.error('Workout generation failed:', error);
      return {
        answer: "I tried to generate a workout plan but ran into an issue. Could you try rephrasing your request? For example: \"Create me a 4 day workout plan for muscle building\"",
        followUpChips: [
          'Create a 4 day workout',
          'Make me a push pull legs plan',
          'Build me a beginner workout'
        ]
      };
    }
  }
  
  if (role === 'member' && detectMealLogRequest(message)) {
    try {
      const parsedMeal = await parseMealFromMessage(message);
      if (parsedMeal && parsedMeal.items.length > 0) {
        const { logged } = await logMealForUser(userId, parsedMeal);
        if (logged) {
          const nutritionSummary = await getTodayNutritionSummary(userId);
          const answer = formatMealLogResponse(parsedMeal, nutritionSummary);
          const followUpChips = [
            'How many calories left today?',
            'Log another meal',
            'My nutrition summary'
          ];
          return { answer, followUpChips };
        }
      }
    } catch (error) {
      console.error('Meal logging failed:', error);
    }
  }

  if (role === 'owner' && gymId) {
    const ownerAction = detectOwnerAction(message);
    if (ownerAction) {
      try {
        return await processOwnerAction(userId, gymId, message, ownerAction, conversationHistory);
      } catch (error) {
        console.error('Owner action processing failed:', error);
      }
    }

    const pendingAction = detectPendingActionFromHistory(conversationHistory);
    if (pendingAction) {
      try {
        return await processOwnerAction(userId, gymId, message, pendingAction, conversationHistory);
      } catch (error) {
        console.error('Owner action follow-up processing failed:', error);
      }
    }
  }
  
  const [user] = await db.select({
    username: users.username,
  })
  .from(users)
  .where(eq(users.id, userId));
  
  const [profile] = await db.select({
    fullName: userProfiles.fullName
  })
  .from(userProfiles)
  .where(eq(userProfiles.userId, userId));
  
  let gymName: string | undefined;
  let gymCurrency: string | undefined;
  
  if (gymId) {
    const [gym] = await db.select({
      name: gyms.name,
      currency: gyms.currency
    })
    .from(gyms)
    .where(eq(gyms.id, gymId));
    
    if (gym) {
      gymName = gym.name;
      gymCurrency = gym.currency || undefined;
    }
  }
  
  const userContext: UserContext = {
    role,
    gymId,
    userId,
    userName: profile?.fullName || user?.username || 'User',
    gymName,
    gymCurrency
  };
  
  let dataContext: MemberContext | OwnerContext | TrainerContext;
  
  if (role === 'owner') {
    if (!gymId) {
      return { 
        answer: "I don't have gym data to analyze. Please make sure you're associated with a gym.", 
        followUpChips: [] 
      };
    }
    dataContext = await getOwnerDataContext(gymId);
  } else if (role === 'trainer') {
    if (!gymId) {
      return { 
        answer: "I don't have gym data to analyze. Please make sure you're associated with a gym.", 
        followUpChips: [] 
      };
    }
    dataContext = await getTrainerDataContext(userId, gymId);
  } else {
    // Member role - can work with or without gymId (personal mode)
    dataContext = await getMemberDataContext(userId, gymId);
  }
  
  const systemPrompt = buildSystemPrompt(userContext, dataContext);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_completion_tokens: 500,
    });
    
    const answer = response.choices[0]?.message?.content || "I'm having trouble understanding that. Could you rephrase?";
    
    const followUpChips = generateFollowUpChips(role, message, gymId);
    
    return { answer, followUpChips };
  } catch (error) {
    console.error('AI processing error:', error);
    throw error;
  }
}

function generateFollowUpChips(role: UserRole, lastMessage: string, gymId: number | null): string[] {
  const lowerMessage = lastMessage.toLowerCase();
  
  if (role === 'member') {
    if (lowerMessage.includes('calorie') || lowerMessage.includes('nutrition') || lowerMessage.includes('protein') || lowerMessage.includes('ate') || lowerMessage.includes('eat')) {
      return ['How many calories left today?', 'My workout progress'];
    }
    if (lowerMessage.includes('workout') || lowerMessage.includes('train')) {
      return ['Show my body measurements', 'How is my attendance?'];
    }
    if (lowerMessage.includes('weight') || lowerMessage.includes('body') || lowerMessage.includes('progress')) {
      return ['My workouts this week', 'Am I being consistent?'];
    }
    return ['My workout progress', 'How am I doing?'];
  }
  
  if (role === 'owner') {
    if (lowerMessage.includes('payment') || lowerMessage.includes('paid') || lowerMessage.includes('revenue')) {
      return ['Log a payment', 'Go to revenue', 'Who checked in today?'];
    }
    if (lowerMessage.includes('attendance') || lowerMessage.includes('check')) {
      return ['Go to attendance', 'Revenue this month', 'Expiring memberships'];
    }
    if (lowerMessage.includes('member') || lowerMessage.includes('growth')) {
      return ['Add a new member', 'Assign a trainer', 'Go to members'];
    }
    return ['Add a new member', 'Log a payment', 'Gym overview'];
  }
  
  if (role === 'trainer') {
    if (lowerMessage.includes('skip') || lowerMessage.includes('miss')) {
      return ['Who checked in today?', 'Member progress'];
    }
    return ['Who needs attention?', 'Today\'s check-ins'];
  }
  
  return [];
}

export async function isAIAvailable(): Promise<boolean> {
  const hasApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  return !!hasApiKey;
}
