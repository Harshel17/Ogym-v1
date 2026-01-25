import { 
  classifyIntent, 
  isAdviceQuestion, 
  getRefusalMessage, 
  getUnknownIntentMessage,
  DikaIntent,
  UserRole 
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
  getMemberCurrentCycle,
  getMemberLastRestDay,
  getMemberSkippedThisWeek,
  getTrainerMemberWorkoutOnDate,
  getTrainerMembersSkippedThisWeek,
  getOwnerUnpaidThisMonth,
  getOwnerMemberPaymentStatus,
  getOwnerActiveMembersToday,
} from './queries';

export interface DikaRequest {
  message: string;
}

export interface DikaResponse {
  answer: string;
  intent?: DikaIntent;
  data?: object;
  confidence?: 'high' | 'low';
}

export async function handleDikaQuery(
  userId: number,
  role: UserRole,
  gymId: number | null,
  message: string
): Promise<DikaResponse> {
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
  
  if (intentResult.intent === 'unknown') {
    return {
      answer: getUnknownIntentMessage(),
      intent: 'unknown',
      confidence: 'low',
    };
  }
  
  const memberName = intentResult.extractedEntities.memberName || resolvedMemberName || context?.lastMemberName;
  const dateRef = intentResult.extractedEntities.date || resolvedDate || context?.lastDate || 'today';
  
  try {
    const answer = await executeIntent(
      intentResult.intent,
      userId,
      role,
      gymId,
      memberName,
      dateRef
    );
    
    updateContext(userId, {
      lastIntent: intentResult.intent,
      lastMemberName: memberName,
      lastDate: dateRef,
    });
    
    return {
      answer,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
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

async function executeIntent(
  intent: DikaIntent,
  userId: number,
  role: UserRole,
  gymId: number | null,
  memberName?: string,
  dateRef?: string
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
        return "This feature is only available in gym mode.";
      }
      return getOwnerActiveMembersToday(gymId);
      
    default:
      return getUnknownIntentMessage();
  }
}

export function getSuggestionChips(role: UserRole, gymId: number | null): string[] {
  if (!gymId) {
    return [
      "What did I train this week?",
      "What is my current workout cycle?",
      "How many days did I work out this month?",
    ];
  }
  
  switch (role) {
    case 'member':
      return [
        "What did I train this week?",
        "What is my current workout cycle?",
        "How many days did I work out this month?",
      ];
      
    case 'trainer':
      return [
        "What did I train this week?",
        "Who skipped workouts this week?",
        "What did John train yesterday?",
      ];
      
    case 'owner':
      return [
        "Who hasn't paid this month?",
        "How many active members today?",
        "Who skipped workouts this week?",
      ];
      
    default:
      return [];
  }
}
