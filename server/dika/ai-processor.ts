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
  memberSubscriptions
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray, isNull, or } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
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
    subscriptionExpiryDate
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
  
  let unpaidCount = 0;
  if (memberIdList.length > 0) {
    const paidMembers = await db.select({ memberId: payments.memberId })
      .from(payments)
      .where(and(
        inArray(payments.memberId, memberIdList),
        eq(payments.gymId, gymId),
        eq(payments.month, dates.currentMonth),
        eq(payments.status, 'paid')
      ));
    unpaidCount = memberIdList.length - paidMembers.length;
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
    }
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
5. Never provide medical or health advice - suggest consulting professionals for that.
6. Be encouraging and supportive, but honest about the data.

USER CONTEXT:
- Name: ${userContext.userName}
- Role: ${userContext.role}
${userContext.gymName ? `- Gym: ${userContext.gymName}` : '- Mode: Personal (no gym)'}
${userContext.gymCurrency ? `- Currency: ${userContext.gymCurrency === 'USD' ? '$' : '₹'}` : ''}

TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
`;

  if (userContext.role === 'member') {
    const ctx = dataContext as MemberContext;
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

You can help this member with:
- Workout progress and consistency analysis
- Attendance patterns
- Body measurement trends and progress
- Subscription status
- Motivation and encouragement based on their data`;
  }
  
  if (userContext.role === 'owner') {
    const ctx = dataContext as OwnerContext;
    const currency = userContext.gymCurrency === 'USD' ? '$' : '₹';
    return basePrompt + `
GYM OVERVIEW:
- Total members: ${ctx.totalMembers}
- Active subscriptions: ${ctx.activeMembers}
- Checked in today: ${ctx.checkedInToday} (${ctx.attendanceRate}% of total)
- Unpaid this month: ${ctx.unpaidThisMonth}
- Expiring within 30 days: ${ctx.expiringThisMonth}
- Revenue this month: ${currency}${ctx.revenueThisMonth.toLocaleString()}
- New members this month: ${ctx.recentTrends.newMembersThisMonth}

You can help this owner with:
- Business performance analysis
- Member retention insights
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
  message: string
): Promise<{ answer: string; followUpChips: string[] }> {
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
      return ['Who checked in today?', 'Member retention'];
    }
    if (lowerMessage.includes('attendance') || lowerMessage.includes('check')) {
      return ['Revenue this month', 'Expiring memberships'];
    }
    if (lowerMessage.includes('member') || lowerMessage.includes('growth')) {
      return ['How can we improve?', 'Payment status'];
    }
    return ['Gym overview', 'How can we grow?'];
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
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
