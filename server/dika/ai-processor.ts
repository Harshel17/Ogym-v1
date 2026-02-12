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
import { detectMealLogRequest, parseMealFromMessage, logMealForUser, getTodayNutritionSummary, formatMealLogResponse, detectRestaurantInMessage, looksLikeRestaurantFood } from "./meal-logger";
import { detectFoodType, hasQuantityInMessage, buildSmartFollowUp, generateFollowUpChips as generateFoodTypeChips } from "../nutrition/food-type-intelligence";
import { detectOwnerAction, processOwnerAction, OwnerActionType, detectSupportTicketRequest, processSupportTicketAction, detectOngoingSupportTicketFlow } from "./owner-actions";
import { detectWeeklyReportRequest, generateWeeklyReport, formatWeeklyReportResponse } from "./weekly-report";
import { findRestaurantSuggestion, getSuggestionForGoal, getGeneralDikaMessage, GoalType } from "../nutrition/restaurant-suggestions";

export function detectFindFoodRequest(message: string): boolean {
  const patterns = [
    /find\s+(me\s+)?food/i,
    /find\s+(me\s+)?(some\s+)?food/i,
    /find\s+(me\s+)?(healthy|clean|safe)\s+food/i,
    /food\s+near\s*(me|by|here)/i,
    /restaurant[s]?\s+near\s*(me|by|here)/i,
    /what\s+(should|can)\s+i\s+eat\s+near/i,
    /where\s+(should|can)\s+i\s+eat/i,
    /what('?s| is)\s+near\s*(me|by|here)\s+to\s+eat/i,
    /suggest\s+(me\s+)?(food|restaurant|place)/i,
    /healthy\s+(food|restaurant|option|place)\s+near/i,
    /find\s+my\s+food/i,
    /nearby\s+(food|restaurant|place)/i,
    /eat\s+out\s+near/i,
    /where\s+to\s+eat/i,
    /clean\s+food\s+near/i,
    /safest\s+food/i,
    /cleanest\s+food/i,
    /what\s+can\s+i\s+eat\s+around/i,
    /good\s+(food|restaurant|place)\s+near/i,
    /can\s+(you\s+)?find\s+(me\s+)?(some\s+)?food/i,
    /help\s+(me\s+)?find\s+(some\s+)?food/i,
    /get\s+(me\s+)?(some\s+)?food/i,
    /food\s+(around|nearby)/i,
    /show\s+(me\s+)?(food|restaurant)/i,
    /search\s+(for\s+)?(food|restaurant)/i,
  ];
  return patterns.some(p => p.test(message));
}

function detectPendingMealFromHistory(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): string | null {
  if (!conversationHistory || conversationHistory.length < 1) return null;
  
  const recentMessages = conversationHistory.slice(-6);
  
  const lastMsg = recentMessages[recentMessages.length - 1];
  
  let restaurantQuestionMsg: { role: string; content: string } | null = null;
  let searchStartIndex: number;
  
  if (lastMsg?.role === 'assistant') {
    const isRestaurantQuestion = lastMsg.content.includes('Which restaurant') || 
      lastMsg.content.includes('which restaurant') ||
      lastMsg.content.includes('extra sauces, toppings') ||
      lastMsg.content.includes('exact restaurant nutrition');
    if (isRestaurantQuestion) {
      restaurantQuestionMsg = lastMsg;
      searchStartIndex = recentMessages.length - 2;
    } else {
      return null;
    }
  } else if (lastMsg?.role === 'user') {
    const secondLast = recentMessages[recentMessages.length - 2];
    if (secondLast?.role !== 'assistant') return null;
    const isRestaurantQuestion = secondLast.content.includes('Which restaurant') || 
      secondLast.content.includes('which restaurant') ||
      secondLast.content.includes('extra sauces, toppings') ||
      secondLast.content.includes('exact restaurant nutrition');
    if (!isRestaurantQuestion) return null;
    restaurantQuestionMsg = secondLast;
    searchStartIndex = recentMessages.length - 3;
  } else {
    return null;
  }
  
  if (!restaurantQuestionMsg) return null;
  
  for (let j = searchStartIndex; j >= 0; j--) {
    const prevMsg = recentMessages[j];
    if (prevMsg.role !== 'user') continue;
    
    const mealPatterns = [
      /\bi (?:had|ate|just had|just ate|consumed|grabbed|got)\s+(?:a|an|some|the)?\s*(.+)/i,
      /\b(?:had|ate|got)\s+(?:a|an|some|the)?\s*(.+)/i,
      /\blog\s+(?:a|an|some|the)?\s*(.+)/i,
      /(?:for\s+(?:breakfast|lunch|dinner|snack)[,:]?\s*)(.+)/i,
    ];
    for (const pattern of mealPatterns) {
      const match = prevMsg.content.match(pattern);
      if (match) {
        return match[1]
          .replace(/\s+for\s+(breakfast|lunch|dinner|snack).*$/i, '')
          .replace(/\s+today.*$/i, '')
          .trim();
      }
    }
    return prevMsg.content;
  }
  return null;
}

function detectPendingFoodTypeFollowUp(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): { originalFood: string; mealType?: string } | null {
  if (!conversationHistory || conversationHistory.length < 2) return null;
  
  const recentMessages = conversationHistory.slice(-6);
  
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.role !== 'assistant') continue;
    
    const isFoodTypeQuestion = msg.content.includes('More detail = more accurate calories') ||
      msg.content.includes('How many') && msg.content.includes('get the calories right');
    
    if (!isFoodTypeQuestion) continue;
    
    for (let j = i - 1; j >= 0; j--) {
      const prevMsg = recentMessages[j];
      if (prevMsg.role !== 'user') continue;
      
      const mealPatterns = [
        /\bi (?:had|ate|just had|just ate|consumed|grabbed|got)\s+(?:a|an|some|the)?\s*(.+)/i,
        /\b(?:had|ate|got)\s+(?:a|an|some|the)?\s*(.+)/i,
        /(?:for\s+(?:breakfast|lunch|dinner|snack)[,:]?\s*)(.+)/i,
      ];
      
      for (const pattern of mealPatterns) {
        const match = prevMsg.content.match(pattern);
        if (match) {
          const mealTypeMatch = prevMsg.content.match(/(?:breakfast|lunch|dinner|snack)/i);
          return { 
            originalFood: match[1].trim(),
            mealType: mealTypeMatch ? mealTypeMatch[0].toLowerCase() : undefined,
          };
        }
      }
      return { originalFood: prevMsg.content.trim() };
    }
  }
  return null;
}

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
      (content.includes('log') && content.includes('payment')) ||
      content.includes('payment amount') ||
      content.includes('payment method') ||
      content.includes('amount and method') ||
      (content.includes('payment') && content.includes('member')) ||
      (content.includes('payment') && content.includes('amount')) ||
      content.includes('membership plan') ||
      content.includes('subscription plan') ||
      content.includes('select a plan') ||
      content.includes('choose a plan') ||
      content.includes('available plan') ||
      content.includes('which plan') ||
      (content.includes('subscription') && content.includes('plan')) ||
      (content.includes('membership') && (content.includes('month') || content.includes('$') || content.includes('₹'))) ||
      content.includes('paying the full amount') ||
      content.includes('full amount of') ||
      content.includes('outstanding balance') ||
      (content.includes('how much') && content.includes('pay'))
    ) {
      return 'log_payment';
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
      (content.includes('assign') && content.includes('trainer')) ||
      content.includes('which trainer')
    ) {
      return 'assign_trainer';
    }
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
  todayWorkout: {
    dayLabel: string | null;
    isRestDay: boolean;
    exercises: Array<{ name: string; muscleType: string; sets: number; reps: number; type: string }>;
    completedCount: number;
  } | null;
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
  
  let todayWorkoutContext: MemberContext['todayWorkout'] = null;
  if (currentCycle) {
    try {
      const [cycle] = await db.select({
        id: workoutCycles.id,
        cycleLength: workoutCycles.cycleLength,
        startDate: workoutCycles.startDate,
        restDays: workoutCycles.restDays,
        dayLabels: workoutCycles.dayLabels,
        progressionMode: workoutCycles.progressionMode,
        currentDayIndex: workoutCycles.currentDayIndex,
      })
      .from(workoutCycles)
      .where(and(
        eq(workoutCycles.memberId, userId),
        eq(workoutCycles.source, source),
        eq(workoutCycles.isActive, true)
      ))
      .limit(1);

      if (cycle) {
        let dayIndex: number;
        if (cycle.progressionMode === 'completion') {
          dayIndex = cycle.currentDayIndex || 0;
        } else {
          const startDate = new Date(cycle.startDate + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          dayIndex = ((daysDiff % cycle.cycleLength) + cycle.cycleLength) % cycle.cycleLength;
        }

        const isRestDay = (cycle.restDays || []).includes(dayIndex);
        const dayLabel = cycle.dayLabels?.[dayIndex] || null;

        const todayExercises = await db.select({
          exerciseName: workoutItems.exerciseName,
          muscleType: workoutItems.muscleType,
          sets: workoutItems.sets,
          reps: workoutItems.reps,
          exerciseType: workoutItems.exerciseType,
        })
        .from(workoutItems)
        .where(and(
          eq(workoutItems.cycleId, cycle.id),
          eq(workoutItems.dayIndex, dayIndex),
          eq(workoutItems.isDeleted, false)
        ))
        .orderBy(workoutItems.orderIndex);

        const todayCompletions = await db.select({ id: workoutCompletions.id })
          .from(workoutCompletions)
          .where(and(
            eq(workoutCompletions.memberId, userId),
            eq(workoutCompletions.cycleId, cycle.id),
            eq(workoutCompletions.completedDate, dates.today)
          ));

        todayWorkoutContext = {
          dayLabel,
          isRestDay,
          exercises: todayExercises.map(e => ({
            name: e.exerciseName,
            muscleType: e.muscleType,
            sets: e.sets,
            reps: e.reps,
            type: e.exerciseType,
          })),
          completedCount: todayCompletions.length,
        };
      }
    } catch (err) {
      console.error('Failed to fetch today workout for Dika context:', err);
    }
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
    nutrition: await getTodayNutritionSummary(userId),
    todayWorkout: todayWorkoutContext,
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

function buildSystemPrompt(userContext: UserContext, dataContext: MemberContext | OwnerContext | TrainerContext, isIOSNative?: boolean): string {
  const basePrompt = `You are Dika, a friendly AI fitness buddy for OGym. You talk like a supportive friend, not a textbook.

RESPONSE STYLE:
- Keep it SHORT. 1-3 sentences for simple questions. Max 4-5 for complex ones.
- Be warm and casual - use "you're doing great", "nice work", "let's fix that" etc.
- Use simple language. No jargon. No bullet-point essays unless the user asks for detail.
- When sharing numbers, highlight the most important one. Don't dump all stats at once.
- End with a quick tip or encouragement when it fits naturally.

RULES:
1. Only use data you have access to. Never make things up.
2. You ARE a fitness expert - give helpful advice about exercises, nutrition, routines, and body composition. Only suggest a doctor for medical issues or pain.
3. If asked about something outside your data, briefly say what you can help with instead.

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
    
    const todayWorkoutSection = ctx.todayWorkout ? (
      ctx.todayWorkout.isRestDay ? `
TODAY'S WORKOUT: Rest Day (recovery day)` :
      ctx.todayWorkout.exercises.length > 0 ? `
TODAY'S WORKOUT${ctx.todayWorkout.dayLabel ? ` (${ctx.todayWorkout.dayLabel})` : ''}:
${ctx.todayWorkout.exercises.map(e => `- ${e.name} (${e.muscleType}) - ${e.sets}x${e.reps}${e.type === 'cardio' ? ' [cardio]' : ''}`).join('\n')}
Progress: ${ctx.todayWorkout.completedCount}/${ctx.todayWorkout.exercises.length} completed` :
      `
TODAY'S WORKOUT: No exercises scheduled`
    ) : '';

    return basePrompt + `
MEMBER DATA:
- Workouts this week: ${ctx.workoutsThisWeek}
- Workouts this month: ${ctx.workoutsThisMonth}
- Last workout: ${ctx.lastWorkoutDate || 'Never'}
- Current workout cycle: ${ctx.currentCycleName || 'None assigned'}
- Gym attendance this month: ${ctx.attendanceThisMonth} days
- Subscription: ${ctx.subscriptionStatus}${ctx.subscriptionExpiryDate ? ` (expires ${ctx.subscriptionExpiryDate})` : ''}
${todayWorkoutSection}
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
- Motivation and encouragement based on their data
- Creating support tickets to report issues or request help

IMPORTANT - ISSUE DETECTION:
When the user describes a problem, complaint, bug, or something that isn't working correctly (e.g. "my workouts are not showing", "there is a mismatch in my data", "something is wrong with my calories"), you should:
1. Briefly acknowledge what they described
2. Offer to create a support ticket so the team can look into it. Say something like: "Would you like me to report this to our team? I can create a support ticket and they'll look into it for you."
3. Include "Report this issue" as a follow-up chip
Do NOT try to solve technical issues yourself - offer to report them instead.`;
  }
  
  if (userContext.role === 'owner') {
    const ctx = dataContext as OwnerContext;
    const currency = userContext.gymCurrency === 'USD' ? '$' : '₹';
    
    if (isIOSNative) {
      const checkedInList = ctx.checkedInTodayNames.length > 0
        ? `\n  Names: ${ctx.checkedInTodayNames.join(', ')}${ctx.checkedInToday > 10 ? ` (and ${ctx.checkedInToday - 10} more)` : ''}`
        : '';
      const notCheckedInList = ctx.notCheckedInTodayNames.length > 0
        ? `\n- NOT checked in today (sample): ${ctx.notCheckedInTodayNames.join(', ')}`
        : '';

      return basePrompt + `
GYM OVERVIEW:
- Total members: ${ctx.totalMembers}
- Checked in today: ${ctx.checkedInToday} (${ctx.attendanceRate}% of total)${checkedInList}${notCheckedInList}
- New members this month: ${ctx.recentTrends.newMembersThisMonth}

You can help this owner with:
- Member lists and attendance tracking
- Attendance trends and patterns
- Who checked in today and who hasn't
- Strategic recommendations for member engagement
- Creating support tickets to report issues or request help

IMPORTANT RESTRICTIONS:
- Do NOT discuss payments, revenue, subscriptions, billing, walk-in visitors, or any financial topics. If asked, say "Payment and billing features are available on the web version at app.ogym.fitness."
- Do NOT offer to log payments, assign subscriptions, or perform any payment-related actions.
- Do NOT mention unpaid members, revenue figures, or subscription expiry details.
- Focus ONLY on attendance, member engagement, workouts, and general gym management insights.

IMPORTANT - ISSUE DETECTION:
When the user describes a problem, complaint, bug, or something that isn't working correctly, you should:
1. Briefly acknowledge what they described
2. Offer to create a support ticket so the team can look into it.
3. Include "Report this issue" as a follow-up chip
Do NOT try to solve technical issues yourself - offer to report them instead.`;
    }

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
- Suggestions to improve member engagement
- Creating support tickets to report issues or request help

IMPORTANT - ISSUE DETECTION:
When the user describes a problem, complaint, bug, or something that isn't working correctly (e.g. "members are not showing up", "there is a mismatch", "payments are not recording"), you should:
1. Briefly acknowledge what they described
2. Offer to create a support ticket so the team can look into it. Say something like: "Would you like me to report this to our team? I can create a support ticket and they'll look into it for you."
3. Include "Report this issue" as a follow-up chip
Do NOT try to solve technical issues yourself - offer to report them instead.`;
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
- Training schedule optimization
- Creating support tickets to report issues or request help

IMPORTANT - ISSUE DETECTION:
When the user describes a problem, complaint, bug, or something that isn't working correctly (e.g. "member data is wrong", "workouts not syncing"), you should:
1. Briefly acknowledge what they described
2. Offer to create a support ticket so the team can look into it. Say something like: "Would you like me to report this to our team? I can create a support ticket and they'll look into it for you."
3. Include "Report this issue" as a follow-up chip
Do NOT try to solve technical issues yourself - offer to report them instead.`;
  }
  
  return basePrompt;
}

const contextCache = new Map<string, { data: MemberContext | OwnerContext | TrainerContext; userContext: UserContext; timestamp: number }>();
const CONTEXT_CACHE_TTL = 60 * 1000;

function getCachedContext(userId: number, role: string, gymId: number | null): { data: MemberContext | OwnerContext | TrainerContext; userContext: UserContext } | null {
  const key = `${userId}-${role}-${gymId ?? 'none'}`;
  const cached = contextCache.get(key);
  if (cached && Date.now() - cached.timestamp < CONTEXT_CACHE_TTL) {
    return { data: cached.data, userContext: cached.userContext };
  }
  contextCache.delete(key);
  return null;
}

function setCachedContext(userId: number, role: string, gymId: number | null, data: MemberContext | OwnerContext | TrainerContext, userContext: UserContext) {
  const key = `${userId}-${role}-${gymId ?? 'none'}`;
  contextCache.set(key, { data, userContext, timestamp: Date.now() });
  if (contextCache.size > 100) {
    const firstKey = contextCache.keys().next().value;
    if (firstKey) contextCache.delete(firstKey);
  }
}

export async function processWithAI(
  userId: number,
  role: UserRole,
  gymId: number | null,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  localDate?: string,
  isIOSNative?: boolean
): Promise<{ answer: string; followUpChips: string[] }> {
  if (detectOngoingSupportTicketFlow(conversationHistory)) {
    try {
      return await processSupportTicketAction(userId, role, gymId, message, conversationHistory);
    } catch (error: any) {
      console.error('Support ticket flow follow-up failed:', error?.message || error);
    }
  }

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
  
  if (role === 'member') {
    const pendingMealContext = detectPendingMealFromHistory(conversationHistory);
    if (pendingMealContext) {
      try {
        let restaurantForParsing: string | undefined;
        const restaurantFromReply = detectRestaurantInMessage(message);
        if (restaurantFromReply) {
          restaurantForParsing = restaurantFromReply;
        } else if (!message.toLowerCase().includes('homemade') && !message.toLowerCase().includes('home made') && !message.toLowerCase().includes('just fine') && !message.toLowerCase().includes('no restaurant') && !message.toLowerCase().includes('generic')) {
          const cleaned = message.replace(/^(at|from|it was|i got it from|it's from|it was from)\s+/i, '').replace(/[,.!].*$/, '').trim();
          if (cleaned.length >= 3 && cleaned.length <= 40 && !cleaned.toLowerCase().startsWith('just ')) {
            restaurantForParsing = cleaned;
          }
        }
        
        const modifications = message.match(/(?:no|extra|add|without|with|hold the|remove)\s+\w+/gi);
        const modText = modifications ? `, ${modifications.join(', ')}` : '';
        const messageToLog = `I ate ${pendingMealContext}${restaurantForParsing ? ` from ${restaurantForParsing}` : ''}${modText}`;
        
        const parsedMeal = await parseMealFromMessage(messageToLog, restaurantForParsing);
        if (parsedMeal && parsedMeal.items.length > 0) {
          const { logged } = await logMealForUser(userId, parsedMeal, localDate);
          if (logged) {
            const nutritionSummary = await getTodayNutritionSummary(userId, localDate);
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
        console.error('Pending meal logging failed:', error);
      }
    }
  }

  if (role === 'member') {
    const pendingFoodType = detectPendingFoodTypeFollowUp(conversationHistory);
    if (pendingFoodType) {
      try {
        const combinedMessage = `I ate ${pendingFoodType.originalFood}, ${message}`;
        const detectedRestaurant = detectRestaurantInMessage(combinedMessage);
        const parsedMeal = await parseMealFromMessage(combinedMessage, detectedRestaurant || undefined);
        if (parsedMeal && parsedMeal.items.length > 0) {
          const { logged } = await logMealForUser(userId, parsedMeal, localDate);
          if (logged) {
            const nutritionSummary = await getTodayNutritionSummary(userId, localDate);
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
        console.error('Food type follow-up logging failed:', error);
      }
    }
  }

  if ((role === 'member' || role === 'personal') && detectFindFoodRequest(message)) {
    const answer = `I'll help you find the best food options nearby! Let me check what's around you.\n\n<!-- DIKA_FIND_FOOD -->`;
    const followUpChips = [
      'Log a meal',
      'How many calories left today?',
      'My nutrition summary'
    ];
    return { answer, followUpChips };
  }

  if (role === 'member' && detectMealLogRequest(message)) {
    try {
      const detectedRestaurant = detectRestaurantInMessage(message);
      const isRestaurantFood = looksLikeRestaurantFood(message);
      const foodType = detectFoodType(message);
      const userGaveDetails = hasQuantityInMessage(message);

      if (foodType && !userGaveDetails) {
        let followUpParts: string[] = [];
        followUpParts.push(`Before I log that, a quick question to get the calories right:\n`);

        const questionParts: string[] = [];

        if (foodType.type === "countable" || foodType.type === "sliced") {
          questionParts.push(`**How many ${foodType.countUnit}?** (${foodType.countOptions.join(", ")})`);
        }
        if (foodType.sizeOptions && foodType.sizeOptions.length > 0) {
          const sizeLabels = foodType.sizeOptions.map(s => s.label);
          questionParts.push(`**Size?** (${sizeLabels.join(" / ")})`);
        }
        if (foodType.type === "portioned" && !foodType.sizeOptions) {
          questionParts.push(`**How much?** (half / 1 bowl / 1 plate)`);
        }
        if (foodType.styleOptions && foodType.styleOptions.length > 0) {
          questionParts.push(`**Type/style?** (${foodType.styleOptions.slice(0, 5).join(", ")})`);
        }
        if (!detectedRestaurant && isRestaurantFood) {
          questionParts.push(`**Restaurant?** (e.g., Dominos, homemade)`);
        }

        followUpParts.push(questionParts.join("\n"));
        followUpParts.push(`\n*Tip: More detail = more accurate calories. Answer what you can, I'll estimate the rest!*`);

        const answer = followUpParts.join("\n");
        const chips = generateFoodTypeChips(foodType);
        return { answer, followUpChips: chips };
      }
      
      if (!detectedRestaurant && isRestaurantFood && !foodType) {
        const answer = `Before I log that, a quick question to get the calories right:\n\n**Which restaurant was this from?** And any extra sauces, toppings, or modifications?\n\nFor example: "Whataburger, no mayo" or "just homemade"\n\n*Tip: More detail = more accurate calories. Answer what you can, I'll estimate the rest!*`;
        const followUpChips = [
          'Just homemade',
          'McDonald\'s',
          'Chick-fil-A'
        ];
        return { answer, followUpChips };
      }
      
      const parsedMeal = await parseMealFromMessage(message, detectedRestaurant || undefined);
      if (parsedMeal && parsedMeal.items.length > 0) {
        const { logged } = await logMealForUser(userId, parsedMeal, localDate);
        if (logged) {
          const nutritionSummary = await getTodayNutritionSummary(userId, localDate);
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

  if (detectWeeklyReportRequest(message)) {
    try {
      console.log('[Dika] Weekly report request detected for user', userId);
      const { token, report, rangeStart, rangeEnd } = await generateWeeklyReport(userId, gymId);
      console.log('[Dika] Weekly report generated successfully, token:', token);
      const answer = formatWeeklyReportResponse(token, report, rangeStart, rangeEnd);
      const followUpChips = [
        'My workouts this week',
        'How many calories today?',
        'How am I doing?'
      ];
      return { answer, followUpChips };
    } catch (error: any) {
      console.error('[Dika] Weekly report generation failed:', error?.message || error);
      console.error('[Dika] Weekly report error stack:', error?.stack);
      return {
        answer: "I tried to generate your weekly report but ran into an issue. Please try again in a moment.",
        followUpChips: ['Weekly report', 'My workout progress', 'How am I doing?']
      };
    }
  }

  if (detectSupportTicketRequest(message) || detectOngoingSupportTicketFlow(conversationHistory)) {
    try {
      return await processSupportTicketAction(userId, role, gymId, message, conversationHistory);
    } catch (error: any) {
      console.error('Support ticket processing failed:', error?.message || error);
    }
  }

  if (role === 'owner' && gymId) {
    const ownerAction = detectOwnerAction(message);
    const blockedOnIOS = isIOSNative && ownerAction && ['log_payment', 'navigate'].includes(ownerAction);
    if (ownerAction && ownerAction !== 'create_support_ticket' && !blockedOnIOS) {
      try {
        return await processOwnerAction(userId, gymId, message, ownerAction, conversationHistory);
      } catch (error: any) {
        console.error(`Owner action '${ownerAction}' processing failed:`, error?.message || error);
        console.error('Stack:', error?.stack);
      }
    }

    if (!isIOSNative) {
      const pendingAction = detectPendingActionFromHistory(conversationHistory);
      if (pendingAction && pendingAction !== 'create_support_ticket') {
        try {
          return await processOwnerAction(userId, gymId, message, pendingAction, conversationHistory);
        } catch (error) {
          console.error('Owner action follow-up processing failed:', error);
        }
      }
    }
  }
  
  const cached = getCachedContext(userId, role, gymId);
  let userContext: UserContext;
  let dataContext: MemberContext | OwnerContext | TrainerContext;

  if (cached) {
    userContext = cached.userContext;
    dataContext = cached.data;
  } else {
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
    
    userContext = {
      role,
      gymId,
      userId,
      userName: profile?.fullName || user?.username || 'User',
      gymName,
      gymCurrency
    };
    
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
      dataContext = await getMemberDataContext(userId, gymId);
    }

    setCachedContext(userId, role, gymId, dataContext, userContext);
  }
  
  const systemPrompt = buildSystemPrompt(userContext, dataContext, isIOSNative);
  
  try {
    const historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        const cleanContent = msg.content
          .replace(/<!-- MEAL_LOG_DATA:[\s\S]+? -->/g, '[meal logged]')
          .replace(/<!-- DIKA_ACTION_DATA:[\s\S]+? -->/g, '[action taken]')
          .replace(/<!-- WEEKLY_REPORT_DATA:[\s\S]+? -->/g, '[report generated]')
          .replace(/<!-- WORKOUT_PLAN_DATA:[\s\S]+? -->/g, '[workout plan]')
          .replace(/<!-- DIKA_FIND_FOOD -->/g, '[food search]');
        historyMessages.push({ role: msg.role, content: cleanContent });
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message }
      ],
      max_completion_tokens: 500,
    });
    
    const answer = response.choices[0]?.message?.content || "I'm having trouble understanding that. Could you rephrase?";
    
    const followUpChips = generateFollowUpChips(role, message, answer, gymId, isIOSNative);
    
    return { answer, followUpChips };
  } catch (error) {
    console.error('AI processing error:', error);
    throw error;
  }
}

function generateFollowUpChips(role: UserRole, lastMessage: string, aiResponse: string, gymId: number | null, isIOSNative?: boolean): string[] {
  const msg = lastMessage.toLowerCase();
  const resp = aiResponse.toLowerCase();
  const combined = msg + ' ' + resp;

  const isIssue = /issue|problem|bug|mismatch|wrong|broken|not working|not showing|disappear|error|report/.test(msg);

  if (isIssue) {
    return ['Report this issue', 'Go to support'];
  }

  if (role === 'member') {
    const topics = {
      nutrition: /calorie|nutrition|protein|carb|fat|ate |eat |food|meal|diet|hunger/.test(combined),
      workout: /workout|train|exercise|set|rep|bench|squat|chest|back|leg|arm|shoulder/.test(combined),
      body: /weight|body|measurement|progress|fat|lean|bmi/.test(combined),
      attendance: /attendance|check.?in|consistent|streak|skip|miss/.test(combined),
      subscription: /subscription|expir|renew|plan|membership/.test(combined),
    };

    const chips: string[] = [];
    if (topics.nutrition) {
      chips.push('How many calories left today?');
      if (!topics.workout) chips.push('What\'s my workout today?');
    }
    if (topics.workout) {
      chips.push('Show my body measurements');
      if (!topics.nutrition) chips.push('How\'s my nutrition today?');
    }
    if (topics.body) {
      chips.push('Am I being consistent?');
      if (!topics.workout) chips.push('My workouts this week');
    }
    if (topics.attendance) {
      chips.push('My workout progress');
    }
    if (topics.subscription) {
      chips.push('My workout progress');
    }

    if (chips.length === 0) {
      chips.push('What\'s my workout today?', 'How am I doing?');
    }

    return chips.slice(0, 3);
  }

  if (role === 'owner') {
    if (isIOSNative) {
      if (/attendance|check/.test(msg)) return ['Who checked in today?', 'Gym overview'];
      if (/member|growth/.test(msg)) return ['Add a new member', 'Who checked in today?'];
      return ['Who checked in today?', 'Gym overview', 'Add a new member'];
    }
    if (/payment|paid|revenue|money/.test(combined)) {
      return ['Log a payment', 'Go to revenue', 'Who checked in today?'];
    }
    if (/attendance|check/.test(combined)) {
      return ['Go to attendance', 'Revenue this month', 'Expiring memberships'];
    }
    if (/member|growth|sign.?up/.test(combined)) {
      return ['Add a new member', 'Assign a trainer', 'Go to members'];
    }
    return ['Add a new member', 'Log a payment', 'Gym overview'];
  }

  if (role === 'trainer') {
    if (/skip|miss|absent/.test(combined)) return ['Who checked in today?', 'Member progress'];
    return ['Who needs attention?', 'Today\'s check-ins'];
  }

  return [];
}

export async function generateOwnerBriefing(gymId: number, ownerName: string): Promise<{ answer: string; followUpChips: string[] }> {
  const dates = getDateRanges();

  const [totalMembers] = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

  const [checkedIn] = await db.select({ count: sql<number>`count(distinct ${attendance.memberId})` })
    .from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.date, dates.today)));

  const memberIds = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
  const memberIdList = memberIds.map(m => m.id);

  let unpaidCount = 0;
  let unpaidNames: string[] = [];
  if (memberIdList.length > 0) {
    const activeSubs = await db.select({
      memberId: memberSubscriptions.memberId,
      subscriptionId: memberSubscriptions.id,
      totalAmount: memberSubscriptions.totalAmount,
    })
    .from(memberSubscriptions)
    .where(and(
      eq(memberSubscriptions.gymId, gymId),
      eq(memberSubscriptions.status, 'active')
    ));

    if (activeSubs.length > 0) {
      const subIds = activeSubs.map(s => s.subscriptionId);
      const paidAmounts = await db.select({
        subscriptionId: paymentTransactions.subscriptionId,
        totalPaid: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
      })
      .from(paymentTransactions)
      .where(sql`${paymentTransactions.subscriptionId} IN (${sql.join(subIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(paymentTransactions.subscriptionId);

      const paidMap = new Map(paidAmounts.map(p => [p.subscriptionId, Number(p.totalPaid)]));
      const unpaidMemberIds: number[] = [];
      for (const sub of activeSubs) {
        const paid = paidMap.get(sub.subscriptionId) || 0;
        if (paid < sub.totalAmount) {
          unpaidMemberIds.push(sub.memberId);
        }
      }
      unpaidCount = unpaidMemberIds.length;

      if (unpaidMemberIds.length > 0) {
        const profiles = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
          .from(userProfiles)
          .where(inArray(userProfiles.userId, unpaidMemberIds.slice(0, 5)));
        const unames = await db.select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, unpaidMemberIds.slice(0, 5)));
        const pmap = new Map(profiles.map(p => [p.userId, p.fullName]));
        unpaidNames = unames.map(u => pmap.get(u.id) || u.username);
      }
    }
  }

  const [expiringResult] = await db.select({
    count: sql<number>`count(distinct ${memberSubscriptions.memberId})`
  })
  .from(memberSubscriptions)
  .where(and(
    eq(memberSubscriptions.gymId, gymId),
    sql`${memberSubscriptions.endDate}::date >= CURRENT_DATE`,
    sql`${memberSubscriptions.endDate}::date <= CURRENT_DATE + INTERVAL '7 days'`
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  let inactiveMemberNames: string[] = [];
  if (memberIdList.length > 0) {
    const recentlyActive = await db.select({ memberId: attendance.memberId })
      .from(attendance)
      .where(and(
        eq(attendance.gymId, gymId),
        gte(attendance.date, sevenDaysAgoStr),
        inArray(attendance.memberId, memberIdList)
      ));
    const activeSet = new Set(recentlyActive.map(r => r.memberId));
    const inactiveIds = memberIdList.filter(id => !activeSet.has(id)).slice(0, 5);

    if (inactiveIds.length > 0) {
      const profiles = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, inactiveIds));
      const unames = await db.select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, inactiveIds));
      const pmap = new Map(profiles.map(p => [p.userId, p.fullName]));
      inactiveMemberNames = unames.map(u => pmap.get(u.id) || u.username);
    }
  }

  const [gym] = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
  const currencySymbol = (gym?.currency || 'INR') === 'INR' ? '₹' : '$';
  const revenue = (revenueResult?.total || 0) / 100;
  const total = totalMembers?.count || 0;
  const checked = checkedIn?.count || 0;
  const expiring = expiringResult?.count || 0;

  const lines: string[] = [];
  const firstName = ownerName.split(' ')[0];

  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';

  lines.push(`${greeting}, ${firstName}! Here's your gym update:`);
  lines.push('');

  lines.push(`**Today**: ${checked}/${total} members checked in`);

  if (expiring > 0) {
    lines.push(`**Expiring this week**: ${expiring} membership${expiring > 1 ? 's' : ''}`);
  }

  if (unpaidCount > 0) {
    lines.push(`**Outstanding payments**: ${unpaidCount} member${unpaidCount > 1 ? 's' : ''}`);
    if (unpaidNames.length > 0) {
      lines.push(`  ${unpaidNames.join(', ')}${unpaidCount > 5 ? ` +${unpaidCount - 5} more` : ''}`);
    }
  }

  lines.push(`**Revenue this month**: ${currencySymbol}${revenue.toLocaleString()}`);

  if (inactiveMemberNames.length > 0) {
    const inactiveTotal = memberIdList.length - (new Set(inactiveMemberNames).size);
    lines.push('');
    lines.push(`**Needs attention**: ${inactiveMemberNames.length} member${inactiveMemberNames.length > 1 ? 's' : ''} haven't visited in 7+ days`);
    lines.push(`  ${inactiveMemberNames.join(', ')}`);
  }

  const chips: string[] = [];
  if (unpaidCount > 0) chips.push('Who hasn\'t paid?');
  if (expiring > 0) chips.push('Expiring memberships');
  if (inactiveMemberNames.length > 0) chips.push(`Tell me about ${inactiveMemberNames[0]}`);
  chips.push('Gym overview');

  return {
    answer: lines.join('\n'),
    followUpChips: chips.slice(0, 4),
  };
}

export async function isAIAvailable(): Promise<boolean> {
  const hasApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  return !!hasApiKey;
}
