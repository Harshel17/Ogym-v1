import { 
  classifyIntent, 
  isAdviceQuestion, 
  getRefusalMessage, 
  getUnknownIntentMessage,
  DikaIntent,
  UserRole,
  ResponseMode
} from './intents';
import { 
  getContext, 
  initContext, 
  updateContext, 
  resolveContextualReference,
  DikaContext 
} from './context';
import {
  getMemberWeeklyWorkouts,
  getMemberMonthlyWorkoutCount,
  getMemberWorkoutLogsDetailed,
  getMemberUpcomingWorkout,
  getMemberCurrentCycle,
  getMemberLastRestDay,
  getMemberSkippedThisWeek,
  getTrainerMemberWorkoutOnDate,
  getTrainerMembersSkippedThisWeek,
  getOwnerUnpaidThisMonth,
  getOwnerMemberPaymentStatus,
  getOwnerActiveMembersToday,
  getOwnerCheckedInToday,
  getOwnerNotCheckedInToday,
  getOwnerActiveMemberships,
  getOwnerExpiringMemberships,
} from './queries';
import { processWithAI, isAIAvailable, generateOwnerBriefing } from './ai-processor';

export { generateOwnerBriefing };

export interface DikaRequest {
  message: string;
}

export interface DikaResponse {
  answer: string;
  intent?: DikaIntent;
  data?: object;
  confidence?: 'high' | 'low';
  followUpChips?: string[];
}

export async function handleDikaQuery(
  userId: number,
  role: UserRole,
  gymId: number | null,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  localDate?: string
): Promise<DikaResponse> {
  // Try AI-powered response first
  if (await isAIAvailable()) {
    try {
      const { answer, followUpChips } = await processWithAI(userId, role, gymId, message, conversationHistory, localDate);
      return {
        answer,
        confidence: 'high',
        followUpChips,
      };
    } catch (error) {
      console.error('AI processing failed, falling back to pattern matching:', error);
    }
  }
  
  // Fallback to pattern-matching system
  if (isAdviceQuestion(message)) {
    return {
      answer: getRefusalMessage(),
      confidence: 'high',
    };
  }
  
  let context = getContext(userId);
  if (!context) {
    context = initContext(userId, role, gymId);
  }
  
  const { resolvedMemberName, resolvedDate } = resolveContextualReference(message, context);
  
  const intentResult = classifyIntent(message, role);
  
  if (intentResult.intent === 'ambiguous') {
    return {
      answer: intentResult.clarificationQuestion || "Could you clarify what you mean?",
      intent: 'ambiguous',
      confidence: 'low',
    };
  }
  
  if (intentResult.intent === 'unknown') {
    return {
      answer: getUnknownIntentMessage(),
      intent: 'unknown',
      confidence: 'low',
    };
  }
  
  const memberName = intentResult.extractedEntities.memberName || resolvedMemberName || context?.lastMemberName;
  const dateRef = intentResult.extractedEntities.date || resolvedDate || context?.lastDate || 'today';
  const monthRef = intentResult.extractedEntities.month;
  const responseMode = intentResult.responseMode || 'count';
  
  try {
    const answer = await executeIntent(
      intentResult.intent,
      userId,
      role,
      gymId,
      memberName,
      dateRef,
      monthRef,
      responseMode
    );
    
    updateContext(userId, {
      lastIntent: intentResult.intent,
      lastMemberName: memberName,
      lastDate: dateRef,
    });
    
    const followUpChips = getFollowUpChips(intentResult.intent, role);
    
    return {
      answer,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      followUpChips,
    };
  } catch (error) {
    console.error('Dika query error:', error);
    return {
      answer: "I encountered an error while looking that up. Please try again.",
      intent: intentResult.intent,
      confidence: 'low',
    };
  }
}

function getFollowUpChips(intent: DikaIntent, role: UserRole): string[] {
  const chipsByIntent: Record<string, string[]> = {
    'owner_unpaid_this_month': ['Who checked in today?', 'Total active members'],
    'owner_checked_in_today': ['Who did not check in?', 'How many active members?'],
    'owner_not_checked_in_today': ['Who checked in today?', 'Total members'],
    'owner_active_memberships': ['Who checked in today?', 'Who has not paid?'],
    'owner_active_members_today': ['Show names', 'Who did not check in?'],
    'member_weekly_workouts': ['My workout count this month', 'Show my workout logs'],
    'member_monthly_workout_count': ['My workouts this week', 'Show my workout logs'],
    'member_current_cycle': ['My workouts this week', 'My workout count'],
    'member_workout_logs_detailed': ['Tomorrow\'s workout', 'My workout count this month'],
    'member_upcoming_workout': ['Show my workout logs', 'What is my cycle?'],
    'trainer_members_skipped_this_week': ['Who checked in today?', 'My workouts'],
  };
  
  return chipsByIntent[intent] || [];
}

async function executeIntent(
  intent: DikaIntent,
  userId: number,
  role: UserRole,
  gymId: number | null,
  memberName?: string,
  dateRef?: string,
  monthRef?: string,
  responseMode: ResponseMode = 'count'
): Promise<string> {
  switch (intent) {
    case 'member_weekly_workouts':
      return getMemberWeeklyWorkouts(userId, gymId);
      
    case 'member_monthly_workout_count':
      return getMemberMonthlyWorkoutCount(userId, gymId);
      
    case 'member_current_cycle':
      return getMemberCurrentCycle(userId, gymId);
      
    case 'member_last_rest_day':
      return getMemberLastRestDay(userId, gymId);
      
    case 'member_skipped_this_week':
      return getMemberSkippedThisWeek(userId, gymId);
      
    case 'member_workout_logs_detailed':
      return getMemberWorkoutLogsDetailed(userId, gymId, dateRef);
      
    case 'member_upcoming_workout':
      return getMemberUpcomingWorkout(userId, gymId);
      
    case 'trainer_member_workout_on_date':
      if (!gymId) {
        return "This feature is only available in gym mode.";
      }
      if (!memberName) {
        return "Which member are you asking about?";
      }
      return getTrainerMemberWorkoutOnDate(userId, gymId, memberName, dateRef || 'today');
      
    case 'trainer_members_skipped_this_week':
      if (!gymId) {
        return "This feature is only available in gym mode.";
      }
      return getTrainerMembersSkippedThisWeek(userId, gymId);
      
    case 'owner_unpaid_this_month':
      if (!gymId) {
        return "This feature is only available in gym mode.";
      }
      return getOwnerUnpaidThisMonth(gymId);
      
    case 'owner_member_payment_status':
      if (!gymId) {
        return "This feature is only available in gym mode.";
      }
      if (!memberName) {
        return "Which member are you asking about?";
      }
      return getOwnerMemberPaymentStatus(gymId, memberName);
      
    case 'owner_active_members_today':
      if (!gymId) {
        return "Dika can only access data within your role.";
      }
      if (responseMode === 'list') {
        return getOwnerCheckedInToday(gymId);
      }
      return getOwnerActiveMembersToday(gymId);
      
    case 'owner_checked_in_today':
      if (!gymId) {
        return "Dika can only access data within your role.";
      }
      if (responseMode === 'count') {
        return getOwnerActiveMembersToday(gymId);
      }
      return getOwnerCheckedInToday(gymId);
      
    case 'owner_not_checked_in_today':
      if (!gymId) {
        return "Dika can only access data within your role.";
      }
      return getOwnerNotCheckedInToday(gymId);
      
    case 'owner_active_memberships':
      if (!gymId) {
        return "Dika can only access data within your role.";
      }
      return getOwnerActiveMemberships(gymId);
      
    case 'owner_expiring_memberships':
      if (!gymId) {
        return "Dika can only access data within your role.";
      }
      return getOwnerExpiringMemberships(gymId, monthRef === 'next');
      
    default:
      return getUnknownIntentMessage();
  }
}

export function getSuggestionChips(role: UserRole, gymId: number | null): string[] {
  if (!gymId) {
    return [
      "What did I train this week?",
      "How many calories today?",
      "Weekly report",
    ];
  }
  
  switch (role) {
    case 'member':
      return [
        "My workouts this week",
        "How many calories today?",
        "Weekly report",
      ];
      
    case 'trainer':
      return [
        "My workouts this week",
        "Who skipped workouts this week?",
        "Who hasn't checked in today?",
      ];
      
    case 'owner':
      return [
        "Who checked in today?",
        "Add a new member",
        "Log a payment",
        "Go to payments",
      ];
      
    default:
      return [];
  }
}
