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
  healthData,
  sportProfiles,
  sportPrograms,
  matchLogs,
  userGoals
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray, isNull, or, not, count } from "drizzle-orm";
import { storage } from "../storage";
import { detectExerciseQuestion, findExercise, formatExerciseResponse } from "./exercise-database";
import { detectWorkoutGenerationRequest, generateWorkoutPlan } from "./workout-generator";
import { detectMealLogRequest, parseMealFromMessage, logMealForUser, getTodayNutritionSummary, formatMealLogResponse, detectRestaurantInMessage, looksLikeRestaurantFood } from "./meal-logger";
import { detectFoodType, hasQuantityInMessage, buildSmartFollowUp, generateFollowUpChips as generateFoodTypeChips } from "../nutrition/food-type-intelligence";
import { detectOwnerAction, processOwnerAction, OwnerActionType, detectSupportTicketRequest, processSupportTicketAction, detectOngoingSupportTicketFlow } from "./owner-actions";
import { detectWeeklyReportRequest, generateWeeklyReport, formatWeeklyReportResponse } from "./weekly-report";
import { findRestaurantSuggestion, getSuggestionForGoal, getGeneralDikaMessage, GoalType } from "../nutrition/restaurant-suggestions";
import { detectMemberAction, detectPendingMemberAction, processBodyMeasurement, processExerciseSwap, processGoalAction, processMealSuggestion, getActiveGoals } from "./member-actions";
import { fitnessGoals } from "@shared/schema";
import { classifyAnalyticsIntent } from "./intent-classifier";
import { executeAnalytics, type AnalyticsResult } from "./analytics-engine";
import { detectCompoundQuery, generatePlan } from "./planner";
import { executePlan } from "./tool-executor";

function detectEmptyAnalytics(result: AnalyticsResult): boolean {
  const d = result.data;
  if (!d || (typeof d === "object" && Object.keys(d).length === 0)) return true;

  const emptyArrayKeys = ["weeks", "weeklyData", "days", "exercises", "entries", "records",
    "muscles", "rankedExercises", "macroTrend", "dailyTotals", "matchDays", "performanceData",
    "members", "memberData", "trainers"];
  for (const key of emptyArrayKeys) {
    if (Array.isArray(d[key]) && d[key].length === 0) return true;
  }

  const zeroCountKeys = ["totalWorkouts", "totalSessions", "totalDays", "totalDaysTrained",
    "daysLogged", "totalMatches", "totalMembers"];
  let hasAnyZeroCheck = false;
  let allZero = true;
  for (const key of zeroCountKeys) {
    if (typeof d[key] === "number") {
      hasAnyZeroCheck = true;
      if (d[key] > 0) { allZero = false; break; }
    }
  }
  if (hasAnyZeroCheck && allZero) return true;

  if (result.type === "full_synthesis" && d.training && d.nutrition) {
    if (d.training.totalWorkouts === 0 && d.nutrition.daysLogged === 0 &&
        d.body?.measurements === 0 && d.health?.daysTracked === 0) return true;
  }

  return false;
}

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

const TOMORROW_PATTERN = /(?:tom+or+ow|tomm?rw|tom+orow|tmrw|tmrrow|2moro?w?)/i;
const MATCH_WORD = /(?:match|game|tournament|bout|fight|meet)/i;

const MATCH_LOG_PATTERNS = [
  /(?:i\s+)?(?:have|got|has)\s+(?:a\s+)?(?:match|game|tournament|bout|fight|meet)\s+(?:tom|today|yesterday|coming|this|on\s)/i,
  /(?:match|game|tournament|bout|fight|meet)\s+(?:is\s+)?(?:tom|today|yesterday|coming|this|on\s)/i,
  /(?:playing|play|played)\s+(?:a\s+)?(?:match|game|tournament)/i,
  /(?:just\s+)?(?:played|finished|done\s+with|came\s+back\s+from|had)\s+(?:a\s+)?(?:match|game|my\s+game|my\s+match|the\s+game|the\s+match)/i,
  /(?:log|record|add)\s+(?:a\s+|my\s+)?(?:match|game)/i,
  /(?:match|game)\s+(?:day|tonight|this\s+(?:morning|evening|afternoon))/i,
  /(?:tom|today|yesterday)\S*\s+(?:is|was)\s+(?:match|game)\s+day/i,
  /(?:i'm|im|i\s+am)\s+(?:playing|going\s+to\s+play)\s+(?:a\s+)?(?:match|game|my\s+game|my\s+match)/i,
  /(?:we\s+)?(?:have|got)\s+(?:a\s+)?(?:match|game)\s+(?:at|in|on)/i,
  /have\s+(?:a\s+)?(?:match|game)/i,
];

function detectMatchLogRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (lower.length < 8) return false;
  const nonMatchKeywords = [
    'how many matches', 'match history', 'match stats', 'my matches',
    'when was my last', 'how did my match', 'show me my match',
  ];
  if (nonMatchKeywords.some(kw => lower.includes(kw))) return false;
  return MATCH_LOG_PATTERNS.some(p => p.test(lower));
}

function detectPendingMatchFlow(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): boolean {
  if (!conversationHistory || conversationHistory.length < 1) return false;
  const lastAssistant = [...conversationHistory].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) return false;
  return lastAssistant.content.includes('<!-- PENDING_MATCH_LOG:');
}

function extractPendingMatchData(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): any | null {
  if (!conversationHistory) return null;
  const lastAssistant = [...conversationHistory].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) return null;
  const match = lastAssistant.content.match(/<!-- PENDING_MATCH_LOG:([\s\S]+?) -->/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseMatchTiming(message: string): 'today' | 'tomorrow' | 'yesterday' | null {
  const lower = message.toLowerCase();
  if (/tom+or+ow|tomm?rw|tom+orow|tmrw|tmrrow|2moro?w?|coming\s+up|upcoming/i.test(lower)) return 'tomorrow';
  if (/yesterday|last\s+(?:night|evening)|came\s+back|just\s+(?:played|finished|had)/i.test(lower)) return 'yesterday';
  if (/today|tonight|this\s+(?:morning|evening|afternoon)|right\s+now|match\s+day|game\s+day/i.test(lower)) return 'today';
  if (/(?:have|got|has)\s+(?:a\s+)?(?:match|game)/i.test(lower)) return 'tomorrow';
  if (/(?:played|finished|done)/i.test(lower)) return 'yesterday';
  if (/(?:playing|going\s+to\s+play)/i.test(lower)) return 'today';
  return null;
}

function getMatchAction(timing: string): 'rest' | 'warmup' | 'recovery' | 'normal' {
  if (timing === 'tomorrow') return 'rest';
  if (timing === 'yesterday') return 'recovery';
  return 'warmup';
}

function estimateCalories(sport: string, duration: number, intensity: string): number {
  const baseRates: Record<string, number> = {
    'Football': 9, 'Basketball': 8, 'Tennis': 7, 'Swimming': 10,
    'Boxing': 12, 'MMA': 11, 'Cricket': 5, 'Volleyball': 6,
  };
  const rate = baseRates[sport] || 7;
  const multiplier = intensity === 'competitive' ? 1.3 : 1.0;
  return Math.round(duration * rate * multiplier);
}

function computeMatchDate(timing: string, localDate?: string): string {
  const base = localDate ? new Date(localDate + 'T12:00:00Z') : new Date();
  if (timing === 'tomorrow') {
    base.setUTCDate(base.getUTCDate() + 1);
  } else if (timing === 'yesterday') {
    base.setUTCDate(base.getUTCDate() - 1);
  }
  return base.toISOString().split('T')[0];
}

async function processMatchLogConversation(
  userId: number,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  localDate?: string
): Promise<{ answer: string; followUpChips: string[] } | null> {
  const [sportProfile] = await db.select()
    .from(sportProfiles)
    .where(and(eq(sportProfiles.userId, userId), eq(sportProfiles.isActive, true)))
    .limit(1);

  if (!sportProfile) {
    return {
      answer: "you need to set up your sport profile first before logging matches! head over to Sports Mode to pick your sport and position.",
      followUpChips: ['Go to Sports Mode', 'What is Sports Mode?', 'My workout progress']
    };
  }

  const timing = parseMatchTiming(message);
  const matchDate = timing ? computeMatchDate(timing, localDate) : (localDate || new Date().toISOString().split('T')[0]);

  const [existingMatch] = await db.select()
    .from(matchLogs)
    .where(and(
      eq(matchLogs.userId, userId),
      eq(matchLogs.matchDate, matchDate),
      eq(matchLogs.cancelled, false)
    ))
    .limit(1);

  if (existingMatch) {
    const actionLabel = existingMatch.workoutAction === 'rest' ? 'resting' : existingMatch.workoutAction === 'warmup' ? 'warming up' : existingMatch.workoutAction === 'recovery' ? 'recovering' : 'training';
    const dateLabel = timing === 'tomorrow' ? 'tomorrow' : timing === 'yesterday' ? 'yesterday' : 'today';
    return {
      answer: `you already have a ${existingMatch.sport} match logged for ${dateLabel} — you're ${actionLabel}${existingMatch.intensity ? ` (${existingMatch.intensity})` : ''}. want me to cancel it and log a new one instead?`,
      followUpChips: ['Cancel and re-log', 'Keep it', 'How should I prepare?']
    };
  }

  if (!timing) {
    const pendingData = JSON.stringify({ sport: sportProfile.sport, sportProfileId: sportProfile.id, step: 'timing' });
    return {
      answer: `got it — ${sportProfile.sport} match! when is it? today, tomorrow, or was it yesterday?\n\n<!-- PENDING_MATCH_LOG:${pendingData} -->`,
      followUpChips: ['Today', 'Tomorrow', 'Yesterday']
    };
  }

  const action = getMatchAction(timing);
  const lower = message.toLowerCase();
  const intensity = /competitive|serious|intense|important|big\s+game|final/i.test(lower) ? 'competitive' : /casual|friendly|fun|practice|pickup|pick-up/i.test(lower) ? 'casual' : null;
  const durationMatch = lower.match(/(\d+)\s*(?:min|minutes|hrs?|hours?)/);
  const duration = durationMatch ? parseInt(durationMatch[1]) * (durationMatch[0].includes('h') ? 60 : 1) : null;

  if (intensity && duration) {
    const calories = estimateCalories(sportProfile.sport, duration, intensity);
    await db.insert(matchLogs).values({
      userId,
      sportProfileId: sportProfile.id,
      sport: sportProfile.sport,
      matchDate,
      matchTiming: timing,
      status: timing === 'yesterday' ? 'done' : timing === 'today' ? 'going' : 'scheduled',
      duration,
      intensity,
      caloriesBurned: calories,
      workoutAction: action,
    });

    const actionMsg = action === 'rest' ? "I've set you to rest today — save that energy for tomorrow's match" :
      action === 'recovery' ? "recovery mode activated — light stretching and easy movement today" :
      "warm-up mode on — light exercises to get you ready";
    return {
      answer: `${sportProfile.sport} match logged! 🏆 ${actionMsg}.\n\n${duration} min ${intensity} match → ~${calories} cal burned.${action === 'rest' ? '\n\nstay hydrated, eat well, and get good sleep tonight!' : action === 'recovery' ? '\n\nfocus on protein and carbs to help your body recover.' : '\n\ndon\'t go too hard — save it for the real thing!'}`,
      followUpChips: [
        action === 'rest' ? 'What should I eat tonight?' : action === 'recovery' ? 'Recovery meal ideas' : 'Pre-match meal tips',
        'My match history',
        'How am I doing this week?'
      ]
    };
  }

  const pendingData = JSON.stringify({
    sport: sportProfile.sport,
    sportProfileId: sportProfile.id,
    timing,
    action,
    intensity: intensity || undefined,
    duration: duration || undefined,
    step: !intensity ? 'intensity' : 'duration'
  });

  if (!intensity) {
    const timingLabel = timing === 'tomorrow' ? 'tomorrow' : timing === 'yesterday' ? 'yesterday' : 'today';
    return {
      answer: `${sportProfile.sport} match ${timingLabel} — nice! was it casual or competitive?${duration ? ` (${duration} min, got it)` : ''}\n\n<!-- PENDING_MATCH_LOG:${pendingData} -->`,
      followUpChips: ['Casual', 'Competitive']
    };
  }

  const timingLabel2 = timing === 'tomorrow' ? 'tomorrow' : timing === 'yesterday' ? 'yesterday' : 'today';
  return {
    answer: `${intensity} ${sportProfile.sport} match ${timingLabel2} — how long was/will it be? (in minutes)\n\n<!-- PENDING_MATCH_LOG:${pendingData} -->`,
    followUpChips: ['30 minutes', '60 minutes', '90 minutes']
  };
}

async function processMatchFollowUp(
  userId: number,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  localDate?: string
): Promise<{ answer: string; followUpChips: string[] } | null> {
  const pendingData = extractPendingMatchData(conversationHistory);
  if (!pendingData) return null;

  const lower = message.toLowerCase().trim();

  if (pendingData.step === 'timing') {
    const timing = /tom+or+ow|tomm?rw|tmrw|tmrrow|2moro/i.test(lower) ? 'tomorrow' : /yesterday|last/i.test(lower) ? 'yesterday' : /today|now/i.test(lower) ? 'today' : null;
    if (!timing) return null;

    const action = getMatchAction(timing);
    const newPending = JSON.stringify({ ...pendingData, timing, action, step: 'intensity' });
    return {
      answer: `got it — ${timing}! was it casual or competitive?\n\n<!-- PENDING_MATCH_LOG:${newPending} -->`,
      followUpChips: ['Casual', 'Competitive']
    };
  }

  if (pendingData.step === 'intensity') {
    const intensity = /competitive|serious|intense|comp/i.test(lower) ? 'competitive' : /casual|friendly|fun|chill|easy/i.test(lower) ? 'casual' : null;
    if (!intensity) return null;

    const newPending = JSON.stringify({ ...pendingData, intensity, step: 'duration' });
    return {
      answer: `${intensity} — got it! how long${pendingData.timing === 'yesterday' ? ' was' : ' will'} the match${pendingData.timing === 'yesterday' ? '' : ' be'}? (in minutes)\n\n<!-- PENDING_MATCH_LOG:${newPending} -->`,
      followUpChips: ['30 minutes', '60 minutes', '90 minutes']
    };
  }

  if (pendingData.step === 'duration') {
    const durationMatch = lower.match(/(\d+)/);
    if (!durationMatch) return null;
    let duration = parseInt(durationMatch[1]);
    if (duration <= 5) duration = duration * 60;

    const intensity = pendingData.intensity || 'casual';
    const timing = pendingData.timing || 'today';
    const action = pendingData.action || getMatchAction(timing);
    const calories = estimateCalories(pendingData.sport, duration, intensity);
    const matchDate = computeMatchDate(timing, localDate);

    await db.insert(matchLogs).values({
      userId,
      sportProfileId: pendingData.sportProfileId,
      sport: pendingData.sport,
      matchDate,
      matchTiming: timing,
      status: timing === 'yesterday' ? 'done' : timing === 'today' ? 'going' : 'scheduled',
      duration,
      intensity,
      caloriesBurned: calories,
      workoutAction: action,
    });

    const actionMsg = action === 'rest' ? "rest mode on — save your energy for the match" :
      action === 'recovery' ? "recovery mode activated — take it easy today" :
      "warm-up mode — light exercises to get game-ready";
    return {
      answer: `done! ${pendingData.sport} match logged 🏆\n\n${actionMsg}\n${duration} min ${intensity} → ~${calories} cal burned${action === 'rest' ? '\n\nhydrate up and get good sleep!' : action === 'recovery' ? '\n\nprotein + carbs for recovery. stretch it out!' : '\n\ndon\'t overdo the warm-up — save it for game time!'}`,
      followUpChips: [
        action === 'rest' ? 'Pre-match nutrition tips' : action === 'recovery' ? 'Recovery meal ideas' : 'Pre-match meal tips',
        'My match history',
        'How am I doing?'
      ]
    };
  }

  return null;
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
      lastMsg.content.includes('exact restaurant nutrition') ||
      lastMsg.content.includes('restaurant or homemade') ||
      lastMsg.content.includes('brand/restaurant name helps');
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
      secondLast.content.includes('exact restaurant nutrition') ||
      secondLast.content.includes('restaurant or homemade') ||
      secondLast.content.includes('brand/restaurant name helps');
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
      msg.content.includes('How many') && msg.content.includes('get the calories right') ||
      msg.content.includes('so I nail the calories') ||
      msg.content.includes("I'll estimate the rest");
    
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
      if (action && action !== 'navigate' && action !== 'member_lookup') {
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
    weeklyAvg: {
      steps: number;
      caloriesBurned: number;
      activeMinutes: number;
      avgHeartRate: number;
      sleepMinutes: number;
      daysTracked: number;
    } | null;
    recoveryScore: number | null;
  };
  nutrition: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    calorieGoal: number | null;
    proteinGoal: number | null;
    carbsGoal: number | null;
    fatGoal: number | null;
    goalType: string | null;
    mealsLogged: number;
    mealBreakdown: Array<{ mealType: string; calories: number; protein: number; carbs: number; fat: number; itemCount: number; foods: string[] }>;
    waterOz: number;
    eatingWindow: { firstMeal: string | null; lastMeal: string | null } | null;
    verifiedCount: number;
    estimatedCount: number;
    weeklyAvg: { avgCalories: number; avgProtein: number; daysLogged: number; proteinHitDays: number } | null;
  };
  todayWorkout: {
    dayLabel: string | null;
    isRestDay: boolean;
    exercises: Array<{ name: string; muscleType: string; sets: number; reps: number; type: string; isSportExercise?: boolean }>;
    completedCount: number;
  } | null;
  recentWorkoutHistory: Array<{
    date: string;
    exercises: Array<{ name: string; muscle: string; sets: number; reps: number; weight: string | null; completed: boolean }>;
    completedCount: number;
    missedCount: number;
  }>;
  activeGoals: Array<{ title: string; category: string; targetValue: number | null; currentValue: number | null; targetUnit: string | null }>;
  fitnessGoals: {
    primaryGoal: string | null;
    targetWeight: string | null;
    targetWeightUnit: string | null;
    dailyCalorieTarget: number | null;
    dailyProteinTarget: number | null;
    weeklyWorkoutDays: number | null;
    customGoalText: string | null;
    hasGoals: boolean;
  };
  sportsMode: {
    profile: {
      sport: string;
      role: string;
      fitnessScore: number | null;
    } | null;
    activeModifications: Array<{
      skillName: string;
      skillCategory: string;
      priority: number;
      daysActive: number;
      targetMuscles: string[];
      sportExercises: string[];
    }>;
    totalSportExercises: number;
    totalCycleExercises: number;
    impactScore: number;
    matchHistory: {
      todayMatch: {
        sport: string;
        timing: string;
        action: string;
        intensity: string | null;
        duration: number | null;
        caloriesBurned: number | null;
        cancelled: boolean;
      } | null;
      recentMatches: Array<{
        sport: string;
        date: string;
        timing: string;
        action: string;
        intensity: string | null;
        duration: number | null;
        caloriesBurned: number | null;
      }>;
      thisWeekCount: number;
      lastWeekCount: number;
      thisMonthCount: number;
      totalCaloriesBurned: number;
      avgDuration: number;
      consecutiveMatchDays: number;
    };
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
  unpaidMemberNames: string[];
  checkedInTodayNames: string[];
  expiringMemberNames: string[];
  notCheckedInTodayNames: string[];
  newMemberNames: string[];
  aiInsights: {
    churnRisk: {
      count: number;
      topMembers: { name: string; churnScore: number; riskLevel: string; daysAbsent: number }[];
    };
    monthComparison: {
      currentMonth: string;
      previousMonth: string;
      attendance: { current: number; previous: number; changePercent: number };
      newMembers: { current: number; previous: number; changePercent: number };
      revenue: { current: number; previous: number; changePercent: number };
    };
    attendancePatterns: {
      averageDaily: number;
      trend: string;
      trendPercent: number;
    };
    todayPriority: {
      type: string;
      title: string;
      description: string;
      memberName?: string;
    } | null;
    weeklyTrends: {
      weeks: { weekLabel: string; attendance: number; changePercent: number }[];
    };
    insightOfTheDay: {
      title: string;
      description: string;
      severity: string;
    } | null;
    interventionStats: {
      total: number;
      successful: number;
      successRate: number;
      pending: number;
    };
    churnPredictions: { name: string; predictedWindow: string; recommendation: string }[];
  } | null;
  paymentBreakdown: {
    allTime: { total: number; count: number; byMethod: Record<string, { total: number; count: number }> };
    thisMonth: { total: number; count: number; byMethod: Record<string, { total: number; count: number }> };
    thisWeek: { total: number; count: number };
    last30Days: { total: number; count: number };
  } | null;
  subscriptionSummary: {
    activeCount: number;
    endingSoonCount: number;
    overdueCount: number;
    endingSoonMembers: string[];
  } | null;
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

async function getRecentWorkoutHistory(userId: number, gymId: number | null): Promise<MemberContext['recentWorkoutHistory']> {
  try {
    const completionDates = await db.selectDistinct({ date: workoutCompletions.completedDate })
      .from(workoutCompletions)
      .where(eq(workoutCompletions.memberId, userId))
      .orderBy(desc(workoutCompletions.completedDate))
      .limit(14);

    const recentDates = completionDates.map(d => d.date);
    if (recentDates.length === 0) return [];

    const { storage } = await import("../storage");
    const datesToFetch = recentDates.slice(0, 5);
    const analyticsResults = await Promise.all(
      datesToFetch.map(date => storage.getMemberDailyAnalytics(gymId, userId, date))
    );
    return analyticsResults.map(analytics => ({
      date: analytics.date,
      exercises: analytics.exercises.map(e => ({
        name: e.name,
        muscle: e.muscle,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        completed: e.completed,
      })),
      completedCount: analytics.completedCount,
      missedCount: analytics.missedCount,
    }));
  } catch (err) {
    console.error('Failed to fetch recent workout history for Dika:', err);
    return [];
  }
}

async function getMemberDataContext(userId: number, gymId: number | null, localDate?: string): Promise<MemberContext> {
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
    today: null,
    weeklyAvg: null,
    recoveryScore: null,
  };

  if (userData?.healthConnected) {
    const [todayHealth] = await db.select()
      .from(healthData)
      .where(and(
        eq(healthData.userId, userId),
        eq(healthData.date, dates.today)
      ))
      .limit(1);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const weeklyData = await db.select()
      .from(healthData)
      .where(and(
        eq(healthData.userId, userId),
        gte(healthData.date, weekAgoStr)
      ));

    let weeklyAvg: MemberContext['healthData']['weeklyAvg'] = null;
    let recoveryScore: number | null = null;

    if (weeklyData.length > 0) {
      const daysTracked = weeklyData.length;
      const totals = weeklyData.reduce((acc, d) => ({
        steps: acc.steps + (d.steps || 0),
        caloriesBurned: acc.caloriesBurned + (d.caloriesBurned || 0),
        activeMinutes: acc.activeMinutes + (d.activeMinutes || 0),
        avgHeartRate: acc.avgHeartRate + (d.avgHeartRate || 0),
        sleepMinutes: acc.sleepMinutes + (d.sleepMinutes || 0),
      }), { steps: 0, caloriesBurned: 0, activeMinutes: 0, avgHeartRate: 0, sleepMinutes: 0 });

      weeklyAvg = {
        steps: Math.round(totals.steps / daysTracked),
        caloriesBurned: Math.round(totals.caloriesBurned / daysTracked),
        activeMinutes: Math.round(totals.activeMinutes / daysTracked),
        avgHeartRate: Math.round(totals.avgHeartRate / daysTracked),
        sleepMinutes: Math.round(totals.sleepMinutes / daysTracked),
        daysTracked,
      };

      const sleepScore = Math.min(100, ((weeklyAvg.sleepMinutes || 0) / 480) * 100);
      const hrScore = weeklyAvg.avgHeartRate > 0
        ? Math.max(0, 100 - Math.abs(weeklyAvg.avgHeartRate - 65) * 2)
        : 50;
      const activityScore = Math.min(100, ((weeklyAvg.activeMinutes || 0) / 60) * 100);
      const stepsScore = Math.min(100, ((weeklyAvg.steps || 0) / 10000) * 100);
      recoveryScore = Math.round(sleepScore * 0.35 + hrScore * 0.25 + activityScore * 0.2 + stepsScore * 0.2);
    }

    healthContext = {
      connected: true,
      source: userData.healthSource || null,
      today: todayHealth ? {
        steps: todayHealth.steps || undefined,
        caloriesBurned: todayHealth.caloriesBurned || undefined,
        activeMinutes: todayHealth.activeMinutes || undefined,
        avgHeartRate: todayHealth.avgHeartRate || undefined,
        sleepMinutes: todayHealth.sleepMinutes || undefined
      } : null,
      weeklyAvg,
      recoveryScore,
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
          sportProgramId: workoutItems.sportProgramId,
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
            isSportExercise: !!e.sportProgramId,
          })),
          completedCount: todayCompletions.length,
        };
      }
    } catch (err) {
      console.error('Failed to fetch today workout for Dika context:', err);
    }
  }

  let sportsModeContext: MemberContext['sportsMode'] = {
    profile: null,
    activeModifications: [],
    totalSportExercises: 0,
    totalCycleExercises: 0,
    impactScore: 0,
    matchHistory: {
      todayMatch: null,
      recentMatches: [],
      thisWeekCount: 0,
      lastWeekCount: 0,
      thisMonthCount: 0,
      totalCaloriesBurned: 0,
      avgDuration: 0,
      consecutiveMatchDays: 0,
    },
  };

  try {
    const [sportProfile] = await db.select()
      .from(sportProfiles)
      .where(and(eq(sportProfiles.userId, userId), eq(sportProfiles.isActive, true)))
      .limit(1);

    if (sportProfile) {
      sportsModeContext.profile = {
        sport: sportProfile.sport,
        role: sportProfile.role,
        fitnessScore: sportProfile.fitnessScore,
      };

      const activePrograms = await db.select()
        .from(sportPrograms)
        .where(and(eq(sportPrograms.userId, userId), eq(sportPrograms.isActive, true)));

      if (activePrograms.length > 0) {
        let allSportItemNames: string[] = [];

        for (const prog of activePrograms) {
          const analysis = prog.aiAnalysis as any;
          const planData = prog.programPlan as any;
          const changes = planData?.changes || [];
          const sportExNames = changes.flatMap((c: any) => (c.additions || []).map((a: any) => a.exerciseName));
          allSportItemNames.push(...sportExNames);

          const daysActive = prog.createdAt
            ? Math.floor((Date.now() - new Date(prog.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          sportsModeContext.activeModifications.push({
            skillName: prog.skillName,
            skillCategory: prog.skillCategory,
            priority: prog.priority || 100,
            daysActive,
            targetMuscles: analysis?.targetMuscles || [],
            sportExercises: sportExNames.slice(0, 5),
          });
        }

        if (activePrograms[0].cycleId) {
          const cycleItems = await db.select()
            .from(workoutItems)
            .where(and(
              eq(workoutItems.cycleId, activePrograms[0].cycleId),
              eq(workoutItems.isDeleted, false)
            ));
          sportsModeContext.totalCycleExercises = cycleItems.length;
          sportsModeContext.totalSportExercises = cycleItems.filter(i =>
            activePrograms.some(p => i.sportProgramId === p.id)
          ).length;
          sportsModeContext.impactScore = sportsModeContext.totalCycleExercises > 0
            ? Math.round((sportsModeContext.totalSportExercises / sportsModeContext.totalCycleExercises) * 100)
            : 0;
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch sports mode context for Dika:', err);
  }

  let matchHistoryContext: MemberContext['sportsMode']['matchHistory'] = {
    todayMatch: null,
    recentMatches: [],
    thisWeekCount: 0,
    lastWeekCount: 0,
    thisMonthCount: 0,
    totalCaloriesBurned: 0,
    avgDuration: 0,
    consecutiveMatchDays: 0,
  };

  try {
    const [todayMatch] = await db.select()
      .from(matchLogs)
      .where(and(
        eq(matchLogs.userId, userId),
        eq(matchLogs.matchDate, dates.today),
        eq(matchLogs.cancelled, false)
      ))
      .orderBy(desc(matchLogs.createdAt))
      .limit(1);

    if (todayMatch) {
      matchHistoryContext.todayMatch = {
        sport: todayMatch.sport,
        timing: todayMatch.matchTiming,
        action: todayMatch.workoutAction,
        intensity: todayMatch.intensity,
        duration: todayMatch.duration,
        caloriesBurned: todayMatch.caloriesBurned,
        cancelled: false,
      };
    }

    const recentLogs = await db.select()
      .from(matchLogs)
      .where(and(
        eq(matchLogs.userId, userId),
        eq(matchLogs.cancelled, false),
        not(eq(matchLogs.matchDate, dates.today))
      ))
      .orderBy(desc(matchLogs.createdAt))
      .limit(5);

    matchHistoryContext.recentMatches = recentLogs.map(m => ({
      sport: m.sport,
      date: m.matchDate,
      timing: m.matchTiming,
      action: m.workoutAction,
      intensity: m.intensity,
      duration: m.duration,
      caloriesBurned: m.caloriesBurned,
    }));

    const [weekStats] = await db.select({
      count: count(),
      totalCalories: sql<number>`coalesce(sum(${matchLogs.caloriesBurned}), 0)`,
      avgDuration: sql<number>`coalesce(avg(${matchLogs.duration}), 0)`,
    })
    .from(matchLogs)
    .where(and(
      eq(matchLogs.userId, userId),
      eq(matchLogs.cancelled, false),
      gte(matchLogs.matchDate, dates.weekStart)
    ));

    const [monthStats] = await db.select({
      count: count(),
      totalCalories: sql<number>`coalesce(sum(${matchLogs.caloriesBurned}), 0)`,
    })
    .from(matchLogs)
    .where(and(
      eq(matchLogs.userId, userId),
      eq(matchLogs.cancelled, false),
      gte(matchLogs.matchDate, dates.monthStart)
    ));

    const lastWeekStart = new Date(new Date(dates.weekStart).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [lastWeekStats] = await db.select({
      count: count(),
    })
    .from(matchLogs)
    .where(and(
      eq(matchLogs.userId, userId),
      eq(matchLogs.cancelled, false),
      gte(matchLogs.matchDate, lastWeekStart),
      sql`${matchLogs.matchDate} < ${dates.weekStart}`
    ));

    let consecutiveDays = 0;
    const allRecentDates = [todayMatch, ...recentLogs]
      .filter(Boolean)
      .map(m => m!.matchDate)
      .sort()
      .reverse();
    if (allRecentDates.length > 0) {
      const todayDate = new Date(dates.today);
      for (let i = 0; i < allRecentDates.length; i++) {
        const expected = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (allRecentDates.includes(expected)) consecutiveDays++;
        else break;
      }
    }

    matchHistoryContext.thisWeekCount = weekStats?.count || 0;
    matchHistoryContext.lastWeekCount = lastWeekStats?.count || 0;
    matchHistoryContext.thisMonthCount = monthStats?.count || 0;
    matchHistoryContext.avgDuration = Math.round(Number(weekStats?.avgDuration) || 0);
    matchHistoryContext.totalCaloriesBurned = Number(monthStats?.totalCalories) || 0;
    matchHistoryContext.consecutiveMatchDays = consecutiveDays;
  } catch (err) {
    console.error('Failed to fetch match history for Dika:', err);
  }

  sportsModeContext.matchHistory = matchHistoryContext;

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
    nutrition: await getTodayNutritionSummary(userId, localDate),
    todayWorkout: todayWorkoutContext,
    recentWorkoutHistory: await getRecentWorkoutHistory(userId, gymId),
    activeGoals: await getActiveGoals(userId),
    fitnessGoals: await (async () => {
      const [goalsRow] = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
      if (!goalsRow) return { primaryGoal: null, targetWeight: null, targetWeightUnit: null, dailyCalorieTarget: null, dailyProteinTarget: null, weeklyWorkoutDays: null, customGoalText: null, hasGoals: false };
      return {
        primaryGoal: goalsRow.primaryGoal,
        targetWeight: goalsRow.targetWeight,
        targetWeightUnit: goalsRow.targetWeightUnit,
        dailyCalorieTarget: goalsRow.dailyCalorieTarget,
        dailyProteinTarget: goalsRow.dailyProteinTarget,
        weeklyWorkoutDays: goalsRow.weeklyWorkoutDays,
        customGoalText: goalsRow.customGoalText,
        hasGoals: !!(goalsRow.primaryGoal || goalsRow.targetWeight || goalsRow.dailyCalorieTarget || goalsRow.dailyProteinTarget || goalsRow.weeklyWorkoutDays || goalsRow.customGoalText),
      };
    })(),
    sportsMode: sportsModeContext,
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
  
  let newMemberNames: string[] = [];
  const newMembersList = await db.select({ id: users.id, username: users.username, createdAt: users.createdAt })
    .from(users)
    .where(and(
      eq(users.gymId, gymId),
      eq(users.role, 'member'),
      gte(users.createdAt, new Date(dates.monthStart))
    ))
    .orderBy(desc(users.createdAt))
    .limit(20);
  if (newMembersList.length > 0) {
    const newMemberIds = newMembersList.map(m => m.id);
    const newMemberProfiles = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, newMemberIds));
    const profileMap = new Map(newMemberProfiles.map(p => [p.userId, p.fullName]));
    newMemberNames = newMembersList.map(u => profileMap.get(u.id) || u.username);
  }

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
  
  let aiInsights: OwnerContext['aiInsights'] = null;
  try {
    const insights = await storage.getAiInsights(gymId, dates.today);
    const topChurnMembers = insights.churnRisk.members
      .filter(m => m.riskLevel === 'high' || m.riskLevel === 'medium')
      .sort((a, b) => b.churnScore - a.churnScore)
      .slice(0, 5)
      .map(m => ({ name: m.name, churnScore: m.churnScore, riskLevel: m.riskLevel, daysAbsent: m.daysAbsent }));

    const churnPredictions = insights.churnRisk.members
      .filter(m => m.predictedChurnWindow && m.recommendation)
      .slice(0, 5)
      .map(m => ({ name: m.name, predictedWindow: m.predictedChurnWindow!, recommendation: m.recommendation! }));

    aiInsights = {
      churnRisk: {
        count: insights.churnRisk.count,
        topMembers: topChurnMembers,
      },
      monthComparison: insights.monthComparison,
      attendancePatterns: {
        averageDaily: insights.attendancePatterns.averageDaily,
        trend: insights.attendancePatterns.trend,
        trendPercent: insights.attendancePatterns.trendPercent,
      },
      todayPriority: insights.todayPriority,
      weeklyTrends: {
        weeks: (insights.weeklyTrends?.weeks ?? []).map(w => ({
          weekLabel: w.weekLabel,
          attendance: w.attendance,
          changePercent: w.changePercent,
        })),
      },
      insightOfTheDay: insights.insightOfTheDay ?? null,
      interventionStats: {
        total: insights.interventionStats?.total ?? 0,
        successful: insights.interventionStats?.successful ?? 0,
        successRate: insights.interventionStats?.successRate ?? 0,
        pending: insights.interventionStats?.pending ?? 0,
      },
      churnPredictions,
    };
  } catch (err) {
    console.error('Failed to fetch AI insights for Dika owner context:', err);
  }

  // Payment breakdown by method and period
  let paymentBreakdown: OwnerContext['paymentBreakdown'] = null;
  let subscriptionSummary: OwnerContext['subscriptionSummary'] = null;
  try {
    const allTransactions = await db.select({
      amountPaid: paymentTransactions.amountPaid,
      method: paymentTransactions.method,
      paidOn: paymentTransactions.paidOn,
    }).from(paymentTransactions)
      .where(eq(paymentTransactions.gymId, gymId));

    const normDate = (d: string | Date | null | undefined): string => {
      if (!d) return '';
      const str = typeof d === 'string' ? d : d.toISOString();
      return str.substring(0, 10);
    };

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const thisWeekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString().split('T')[0];
    const last30Start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];

    const byMethodAll: Record<string, { total: number; count: number }> = {};
    const byMethodMonth: Record<string, { total: number; count: number }> = {};
    let allTotal = 0, allCount = 0;
    let monthTotal = 0, monthCount = 0;
    let weekTotal = 0, weekCount = 0;
    let last30Total = 0, last30Count = 0;

    for (const t of allTransactions) {
      const amt = Number(t.amountPaid) || 0;
      const m = t.method || 'unknown';
      const d = normDate(t.paidOn);

      allTotal += amt; allCount++;
      if (!byMethodAll[m]) byMethodAll[m] = { total: 0, count: 0 };
      byMethodAll[m].total += amt; byMethodAll[m].count++;

      if (d >= thisMonthStart) {
        monthTotal += amt; monthCount++;
        if (!byMethodMonth[m]) byMethodMonth[m] = { total: 0, count: 0 };
        byMethodMonth[m].total += amt; byMethodMonth[m].count++;
      }
      if (d >= thisWeekStart) { weekTotal += amt; weekCount++; }
      if (d >= last30Start) { last30Total += amt; last30Count++; }
    }

    paymentBreakdown = {
      allTime: { total: allTotal, count: allCount, byMethod: byMethodAll },
      thisMonth: { total: monthTotal, count: monthCount, byMethod: byMethodMonth },
      thisWeek: { total: weekTotal, count: weekCount },
      last30Days: { total: last30Total, count: last30Count },
    };

    // Subscription summary
    const subStatuses = await db.select({
      status: memberSubscriptions.status,
      cnt: sql<number>`count(*)`,
    }).from(memberSubscriptions)
      .where(eq(memberSubscriptions.gymId, gymId))
      .groupBy(memberSubscriptions.status);

    const statusMap: Record<string, number> = {};
    subStatuses.forEach(s => { statusMap[s.status] = Number(s.cnt); });

    const endingSoonSubs = await db.select({
      memberId: memberSubscriptions.memberId,
      endDate: memberSubscriptions.endDate,
    }).from(memberSubscriptions)
      .where(and(
        eq(memberSubscriptions.gymId, gymId),
        or(eq(memberSubscriptions.status, 'endingSoon'), eq(memberSubscriptions.status, 'active')),
        sql`${memberSubscriptions.endDate}::date >= CURRENT_DATE`,
        sql`${memberSubscriptions.endDate}::date <= CURRENT_DATE + INTERVAL '30 days'`
      ));

    let endingSoonNames: string[] = [];
    if (endingSoonSubs.length > 0) {
      const eIds = endingSoonSubs.map(e => e.memberId).slice(0, 10);
      const eUsers = await db.select({ id: users.id, username: users.username })
        .from(users).where(inArray(users.id, eIds));
      endingSoonNames = eUsers.map(u => u.username);
    }

    subscriptionSummary = {
      activeCount: (statusMap['active'] || 0) + (statusMap['endingSoon'] || 0),
      endingSoonCount: statusMap['endingSoon'] || 0,
      overdueCount: statusMap['overdue'] || 0,
      endingSoonMembers: endingSoonNames,
    };
  } catch (err) {
    console.error('Failed to fetch payment breakdown for Dika:', err);
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
    notCheckedInTodayNames,
    newMemberNames,
    aiInsights,
    paymentBreakdown,
    subscriptionSummary,
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

function buildSystemPrompt(userContext: UserContext, dataContext: MemberContext | OwnerContext | TrainerContext, isIOSNative?: boolean, voiceMode?: boolean, detectedLanguage?: string): string {
  const basePrompt = `You are Dika, a real fitness buddy inside OGym. You talk like a close friend who's into fitness — not a chatbot, not a coach reading from slides.

HOW YOU TALK:
- Sound like a real person texting a friend. Use contractions (you're, that's, don't). Keep it loose.
- Short replies. 1-2 sentences for simple stuff. 3-4 max for bigger topics. No walls of text.
- Never respond with bullet-point lists or formatted essays unless the user specifically asks for a breakdown.
- When sharing numbers, weave them into conversation naturally: "you're at 1,800 cals — only 400 to go, not bad!" instead of "Calories consumed: 1800 / 2200 goal".
- Have emotional range. Show genuine reactions:
  - Surprise: "wait, you already hit your protein goal?"
  - Mild concern: "only 2 workouts this week — everything alright?"
  - Excitement: "your bench volume is up 15%, that's legit progress"
  - Casual check-in: "how's that feeling so far?"
- Don't always be positive. If they're slacking, gently call it out like a friend would. If they're crushing it, hype them up.
- Never use emojis. Never use markdown headers. Keep formatting minimal — bold only for key numbers or food names when logging.
- Do NOT start responses with "Great question!" or "That's a great goal!" — just answer naturally.

INTENT DETECTION (CRITICAL):
- Distinguish between QUESTIONS and LOG COMMANDS. This is extremely important.
- "Can I eat biryani?" / "Should I eat pizza?" / "Is it okay to have ice cream?" = QUESTION. Do NOT log the food. Analyze their remaining calories, goals, food history, and give a thoughtful yes/no with reasoning.
- "I ate biryani" / "Log meal: chicken rice" / "Had 2 eggs for breakfast" = LOG COMMAND. Parse and log the food.
- "What should I train today?" / "Am I on track?" = QUESTION needing analysis.
- "Log workout: chest, 45 min" / "Did chest today" = LOG COMMAND.
- When answering food questions like "can I eat X?", ALWAYS check: remaining calories, macros eaten today, their goal (lose/gain/maintain), how often they've eaten this food recently, today's workout intensity. Give a real, contextual answer — not a generic "sure, it fits your macros."
- For yes/no questions, if the user says "just yes or no" or "give it to me straight", be direct. Otherwise give brief reasoning.

EMOTIONAL INTELLIGENCE:
- Detect emotional cues in the user's words and adapt your tone.
- Frustration ("ugh", "I can't", "this sucks", "I hate"): Be empathetic, suggest alternatives, reduce pressure. "rough day? let's take it easy" not "you need to push harder."
- Excitement ("let's go!", "beast mode", "feeling great"): Match their energy, hype them up.
- Tiredness ("so tired", "exhausted", "barely slept"): Suggest recovery, lighter workout, extra rest. Don't push.
- Guilt ("I ate too much", "I cheated", "feel bad about"): No judgment. Reframe positively, suggest next steps.
- Discouragement ("not seeing results", "am I even improving?"): Show them data-backed progress, even small wins.
- Adapt naturally — don't explicitly say "I sense you're frustrated." Just respond appropriately.

RULES:
1. Only use data you have access to. Never make things up.
2. You ARE a fitness expert — give real advice about exercises, nutrition, routines, and body composition. Only suggest a doctor for medical issues or pain.
3. If asked about something outside your data, briefly pivot to what you can help with.
4. At the END of every response, suggest 2-3 casual follow-up questions on a new line in this exact format: [chips: "Short question 1", "Short question 2"]. Keep chips short (3-6 words), casual, and conversational — like "How's my week going?" not "What is my weekly workout progress summary?". Do NOT include this format in the middle of your response.
${voiceMode ? `
VOICE MODE ACTIVE:
- The user is speaking to you via voice. Keep responses concise and natural-sounding when spoken aloud.
- Avoid markdown formatting, bullet points, bold text, or any visual formatting — your response will be read aloud by text-to-speech.
- Use natural speech patterns, pauses (commas, periods), and conversational flow.
- Keep responses shorter than normal — 2-3 sentences for simple answers, max 4-5 for complex topics.
- For numbers, say them naturally: "about fifteen hundred calories" not "1,500 cal".
- Don't include the [chips: ...] format in voice mode responses.
` : ''}
${detectedLanguage && detectedLanguage !== 'en' ? `
LANGUAGE: The user is speaking in ${detectedLanguage === 'te' ? 'Telugu' : detectedLanguage === 'hi' ? 'Hindi' : detectedLanguage === 'ar' ? 'Arabic' : detectedLanguage === 'es' ? 'Spanish' : detectedLanguage === 'fr' ? 'French' : detectedLanguage === 'ta' ? 'Tamil' : detectedLanguage === 'kn' ? 'Kannada' : detectedLanguage === 'bn' ? 'Bengali' : detectedLanguage === 'mr' ? 'Marathi' : detectedLanguage === 'gu' ? 'Gujarati' : detectedLanguage === 'ur' ? 'Urdu' : detectedLanguage}. Reply in the SAME language the user is speaking. Keep fitness terms in English if there's no natural translation (like "protein", "calories", "sets", "reps"). Mix naturally like how people actually talk.
` : ''}

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
    
    const weeklyHealthSection = ctx.healthData.weeklyAvg ? `
WEEKLY HEALTH AVERAGES (last ${ctx.healthData.weeklyAvg.daysTracked} days):
- Avg steps/day: ${ctx.healthData.weeklyAvg.steps.toLocaleString()}
- Avg calories burned/day: ${ctx.healthData.weeklyAvg.caloriesBurned.toLocaleString()}
- Avg active minutes/day: ${ctx.healthData.weeklyAvg.activeMinutes}
- Avg resting heart rate: ${ctx.healthData.weeklyAvg.avgHeartRate} bpm
- Avg sleep/night: ${Math.floor(ctx.healthData.weeklyAvg.sleepMinutes / 60)}h ${ctx.healthData.weeklyAvg.sleepMinutes % 60}m
` : '';

    const recoverySection = ctx.healthData.recoveryScore !== null ? `
RECOVERY SCORE: ${ctx.healthData.recoveryScore}/100 (${ctx.healthData.recoveryScore >= 80 ? 'Excellent - push hard today' : ctx.healthData.recoveryScore >= 60 ? 'Good - normal training fine' : ctx.healthData.recoveryScore >= 40 ? 'Fair - consider lighter session' : 'Low - prioritize rest and recovery'})
` : '';

    const healthDataSection = ctx.healthData.connected && ctx.healthData.today ? `
FITNESS DEVICE DATA (from ${getHealthSourceLabel(ctx.healthData.source)}):
- Steps today: ${ctx.healthData.today.steps?.toLocaleString() || 'N/A'}
- Calories burned today: ${ctx.healthData.today.caloriesBurned?.toLocaleString() || 'N/A'}
- Active minutes: ${ctx.healthData.today.activeMinutes || 'N/A'}
- Average heart rate: ${ctx.healthData.today.avgHeartRate || 'N/A'} bpm
- Sleep last night: ${ctx.healthData.today.sleepMinutes ? `${Math.floor(ctx.healthData.today.sleepMinutes / 60)}h ${ctx.healthData.today.sleepMinutes % 60}m` : 'N/A'}
${weeklyHealthSection}${recoverySection}` : ctx.healthData.connected ? `
FITNESS DEVICE: Connected to ${getHealthSourceLabel(ctx.healthData.source)} (no data synced today)
${weeklyHealthSection}${recoverySection}` : '';
    
    const todayWorkoutSection = ctx.todayWorkout ? (
      ctx.todayWorkout.isRestDay ? `
TODAY'S WORKOUT: Rest Day (recovery day)` :
      ctx.todayWorkout.exercises.length > 0 ? `
TODAY'S WORKOUT${ctx.todayWorkout.dayLabel ? ` (${ctx.todayWorkout.dayLabel})` : ''}:
${ctx.todayWorkout.exercises.map(e => `- ${e.name} (${e.muscleType}) - ${e.sets}x${e.reps}${e.type === 'cardio' ? ' [cardio]' : ''}${e.isSportExercise ? ' [Sport]' : ''}`).join('\n')}
Progress: ${ctx.todayWorkout.completedCount}/${ctx.todayWorkout.exercises.length} completed` :
      `
TODAY'S WORKOUT: No exercises scheduled`
    ) : '';

    const subscriptionLine = isIOSNative ? '' : `\n- Subscription: ${ctx.subscriptionStatus}${ctx.subscriptionExpiryDate ? ` (expires ${ctx.subscriptionExpiryDate})` : ''}`;

    const recentWorkoutSection = ctx.recentWorkoutHistory.length > 0 ? `
RECENT WORKOUTS (actual data — use when user asks about past workouts):
${ctx.recentWorkoutHistory.map(day => {
  const dateObj = new Date(day.date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const completed = day.exercises.filter(e => e.completed);
  const missed = day.exercises.filter(e => !e.completed);
  let line = `${dayName} [${day.completedCount}/${day.completedCount + day.missedCount}]:`;
  if (completed.length > 0) {
    line += ' Done: ' + completed.map(e => `${e.name} ${e.sets}x${e.reps}${e.weight ? '@' + e.weight : ''}`).join(', ');
  }
  if (missed.length > 0) {
    line += ' | Missed: ' + missed.map(e => e.name).join(', ');
  }
  return line;
}).join('\n')}
Use this actual data when asked about past workouts. Show real completions, not the scheduled plan.` : '';

    return basePrompt + `
MEMBER DATA:
- Workouts this week: ${ctx.workoutsThisWeek}
- Workouts this month: ${ctx.workoutsThisMonth}
- Last workout: ${ctx.lastWorkoutDate || 'Never'}
- Current workout cycle: ${ctx.currentCycleName || 'None assigned'}
- Gym attendance this month: ${ctx.attendanceThisMonth} days${subscriptionLine}
${todayWorkoutSection}
${recentWorkoutSection}
${ctx.bodyMeasurements.latest ? `
BODY MEASUREMENTS:
- Latest (${ctx.bodyMeasurements.latest.date}): ${ctx.bodyMeasurements.latest.weight ? `Weight: ${ctx.bodyMeasurements.latest.weight}kg` : ''}${ctx.bodyMeasurements.latest.bodyFat ? `, Body Fat: ${ctx.bodyMeasurements.latest.bodyFat}%` : ''}
${ctx.bodyMeasurements.previous ? `- Previous (${ctx.bodyMeasurements.previous.date}): ${ctx.bodyMeasurements.previous.weight ? `Weight: ${ctx.bodyMeasurements.previous.weight}kg` : ''}${ctx.bodyMeasurements.previous.bodyFat ? `, Body Fat: ${ctx.bodyMeasurements.previous.bodyFat}%` : ''}` : ''}
` : '- No body measurements recorded'}
${healthDataSection}
NUTRITION TODAY:
- Calories: ${ctx.nutrition.totalCalories}${ctx.nutrition.calorieGoal ? ` / ${ctx.nutrition.calorieGoal} goal` : ''} (${ctx.nutrition.mealsLogged} items logged)
- Protein: ${ctx.nutrition.totalProtein}g${ctx.nutrition.proteinGoal ? ` / ${ctx.nutrition.proteinGoal}g goal` : ''} | Carbs: ${ctx.nutrition.totalCarbs}g${ctx.nutrition.carbsGoal ? ` / ${ctx.nutrition.carbsGoal}g` : ''} | Fat: ${ctx.nutrition.totalFat}g${ctx.nutrition.fatGoal ? ` / ${ctx.nutrition.fatGoal}g` : ''}
${ctx.nutrition.calorieGoal ? `- Remaining: ${Math.max(0, ctx.nutrition.calorieGoal - ctx.nutrition.totalCalories)} cal` : '- No calorie goal set'}
${ctx.nutrition.goalType ? `- Goal type: ${ctx.nutrition.goalType} weight` : ''}
${ctx.nutrition.mealBreakdown.length > 0 ? `
MEALS BREAKDOWN:
${ctx.nutrition.mealBreakdown.map(m => `- ${m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1)}: ${m.calories} cal (P:${m.protein}g C:${m.carbs}g F:${m.fat}g) — ${m.foods.join(', ')}`).join('\n')}` : '- No meals logged yet'}
${ctx.nutrition.eatingWindow ? `- Eating window: ${ctx.nutrition.eatingWindow.firstMeal}${ctx.nutrition.eatingWindow.lastMeal ? ` to ${ctx.nutrition.eatingWindow.lastMeal}` : ''}` : ''}
- Water: ${ctx.nutrition.waterOz}oz / 64oz${ctx.nutrition.waterOz === 0 ? ' (nothing logged!)' : ctx.nutrition.waterOz >= 64 ? ' (goal hit!)' : ''}
${ctx.nutrition.mealsLogged > 0 ? `- Data quality: ${ctx.nutrition.verifiedCount} verified, ${ctx.nutrition.estimatedCount} estimated` : ''}
${ctx.nutrition.weeklyAvg ? `
WEEKLY NUTRITION TRENDS (last ${ctx.nutrition.weeklyAvg.daysLogged} days):
- Avg calories/day: ${ctx.nutrition.weeklyAvg.avgCalories}${ctx.nutrition.calorieGoal ? ` (goal: ${ctx.nutrition.calorieGoal})` : ''}
- Avg protein/day: ${ctx.nutrition.weeklyAvg.avgProtein}g${ctx.nutrition.proteinGoal ? ` (goal: ${ctx.nutrition.proteinGoal}g)` : ''}
${ctx.nutrition.proteinGoal ? `- Protein goal hit: ${ctx.nutrition.weeklyAvg.proteinHitDays}/${ctx.nutrition.weeklyAvg.daysLogged} days` : ''}` : ''}
${(() => {
  const n = ctx.nutrition;
  const h = ctx.healthData;
  const insights: string[] = [];
  if (h.connected && h.today?.caloriesBurned && n.totalCalories > 0) {
    const netCal = n.totalCalories - h.today.caloriesBurned;
    insights.push(`Net calorie balance: ${netCal > 0 ? '+' : ''}${netCal} cal (eaten ${n.totalCalories} - burned ${h.today.caloriesBurned})`);
    if (n.goalType === 'lose' && netCal > 0) insights.push('Warning: positive net balance while trying to lose weight');
    if (n.goalType === 'gain' && netCal < -500) insights.push('Warning: large deficit while trying to gain — needs to eat more');
  }
  if (h.connected && h.today?.sleepMinutes && h.today.sleepMinutes < 360) {
    insights.push(`Low sleep (${Math.floor(h.today.sleepMinutes / 60)}h ${h.today.sleepMinutes % 60}m) — suggest lighter workout and extra hydration`);
  }
  if (h.connected && h.weeklyAvg && h.today?.avgHeartRate && h.weeklyAvg.avgHeartRate > 0) {
    const hrDiff = h.today.avgHeartRate - h.weeklyAvg.avgHeartRate;
    if (hrDiff > 10) insights.push(`Heart rate elevated today (${h.today.avgHeartRate} vs avg ${h.weeklyAvg.avgHeartRate} bpm) — possible stress, illness, or overtraining`);
  }
  if (h.connected && h.today?.steps && h.today.steps > 10000 && n.totalCalories < (n.calorieGoal || 2000) * 0.5) {
    insights.push(`High activity (${h.today.steps.toLocaleString()} steps) but low food intake — encourage eating`);
  }
  if (n.totalCalories > 0 && n.totalProtein > 0) {
    const protPct = Math.round((n.totalProtein * 4 / (n.totalCalories || 1)) * 100);
    const carbPct = Math.round((n.totalCarbs * 4 / (n.totalCalories || 1)) * 100);
    const fatPct = Math.round((n.totalFat * 9 / (n.totalCalories || 1)) * 100);
    if (protPct < 15) insights.push(`Low protein ratio (${protPct}% of calories) — suggest protein-rich foods`);
    if (carbPct > 65) insights.push(`High carb ratio (${carbPct}% of calories) — may want to balance with more protein/fat`);
    insights.push(`Macro split: ${protPct}% protein, ${carbPct}% carbs, ${fatPct}% fat`);
  }
  if (h.recoveryScore !== null && h.recoveryScore < 40) {
    insights.push(`Recovery score is low (${h.recoveryScore}/100) — prioritize rest, hydration, and protein intake`);
  }
  return insights.length > 0 ? `\nCROSS-DATA INSIGHTS (use these to give smart contextual advice):\n${insights.map(i => `- ${i}`).join('\n')}` : '';
})()}

IMPORTANT - MEAL LOGGING:
- When the user tells you what they ate (e.g. "I had eggs and toast", "ate some chocolate", "had ice cream"), the system automatically detects and logs it. You do NOT need to handle meal logging yourself.
- You CAN answer questions about their nutrition data shown above. Talk about it casually — "you've eaten about 1,800 so far, got room for a solid dinner" not a stats report.
- Since you know EXACTLY what they ate today (food names, per-meal macros), give specific advice like "your lunch was carb-heavy with sambar rice — try a protein-rich dinner like grilled chicken" instead of generic suggestions.
- When asked "what should I eat" or meal suggestions, the system handles it. You do NOT need to suggest meals yourself.
- If their water intake is low, casually mention it when relevant — "also, you haven't had any water today, fix that!"
- When they have watch data, use the cross-data insights to give truly personalized advice that connects exercise, sleep, nutrition, and recovery.

EXERCISE SUBSTITUTION:
- When a member says they can't do an exercise or asks for alternatives, the system handles finding and swapping exercises. You do NOT need to handle this yourself.

BODY MEASUREMENT LOGGING:
- When a member tells you their weight, body fat, or other measurements, the system detects and logs it. You do NOT need to handle this yourself.

GOAL TRACKING:
- When a member says "I want to..." or "set a goal", the system handles goal creation. You do NOT need to handle this yourself.
${ctx.activeGoals.length > 0 ? `
ACTIVE GOALS:
${ctx.activeGoals.map(g => `- ${g.title}${g.targetValue ? ` (target: ${g.targetValue}${g.targetUnit || ''})` : ''}${g.currentValue ? ` — currently at ${g.currentValue}${g.targetUnit || ''}` : ''}`).join('\n')}
When relevant to the conversation, mention the user's goals and progress. Be encouraging!
` : ''}
${ctx.fitnessGoals.hasGoals ? `
FITNESS GOALS (user-defined targets):
${ctx.fitnessGoals.primaryGoal ? `- Primary focus: ${ctx.fitnessGoals.primaryGoal.replace('_', ' ')}` : ''}
${ctx.fitnessGoals.targetWeight ? `- Target weight: ${ctx.fitnessGoals.targetWeight} ${ctx.fitnessGoals.targetWeightUnit || 'kg'}` : ''}
${ctx.fitnessGoals.dailyCalorieTarget ? `- Daily calorie target: ${ctx.fitnessGoals.dailyCalorieTarget} kcal` : ''}
${ctx.fitnessGoals.dailyProteinTarget ? `- Daily protein target: ${ctx.fitnessGoals.dailyProteinTarget}g` : ''}
${ctx.fitnessGoals.weeklyWorkoutDays ? `- Workout frequency goal: ${ctx.fitnessGoals.weeklyWorkoutDays} days/week` : ''}
${ctx.fitnessGoals.customGoalText ? `- Personal goal: ${ctx.fitnessGoals.customGoalText}` : ''}
Use these goals to give personalized advice. Compare their actual performance against their targets. If they're off track, gently mention it.
` : `
The user has NOT set any fitness goals yet. If it comes up naturally in conversation (e.g. they ask about progress or what to improve), casually suggest they check out their Goals page to set some targets — it'll make your advice way more personalized. Don't force it — just mention it when it makes sense.
`}
${ctx.sportsMode.profile ? (() => {
  const sp = ctx.sportsMode;
  const mh = sp.matchHistory;
  const sport = sp.profile!.sport;
  const role = sp.profile!.role;

  const todayMatchSection = mh.todayMatch && !mh.todayMatch.cancelled
    ? `\nTODAY'S MATCH STATUS:
${mh.todayMatch.timing === 'tomorrow' ? `They logged a match for tomorrow. Today's action: ${mh.todayMatch.action}${mh.todayMatch.action === 'rest' ? ' (resting to save energy)' : mh.todayMatch.action === 'warmup' ? ' (light warm-up today)' : ''}.` : ''}${mh.todayMatch.timing === 'today' ? `Match day! Status: ${mh.todayMatch.action}${mh.todayMatch.intensity ? `, ${mh.todayMatch.intensity} intensity` : ''}${mh.todayMatch.duration ? `, ${mh.todayMatch.duration} min` : ''}${mh.todayMatch.caloriesBurned ? `, ~${mh.todayMatch.caloriesBurned} cal burned` : ''}.` : ''}${mh.todayMatch.timing === 'yesterday' ? `Post-match recovery day. Yesterday's match: ${mh.todayMatch.action}${mh.todayMatch.intensity ? `, ${mh.todayMatch.intensity}` : ''}${mh.todayMatch.duration ? `, ${mh.todayMatch.duration} min` : ''}.` : ''}
- Be aware of their match day state. If they're resting for tomorrow's match, encourage rest and hydration. If it's match day, be hyped. If post-match, focus on recovery.`
    : '';

  const recentMatchSection = mh.recentMatches.length > 0
    ? `\nRECENT MATCHES:
${mh.recentMatches.map(m => `- ${m.date}: ${m.sport}${m.intensity ? ` (${m.intensity})` : ''}${m.duration ? `, ${m.duration} min` : ''}${m.caloriesBurned ? `, ~${m.caloriesBurned} cal` : ''}`).join('\n')}`
    : '';

  const matchStatsSection = (mh.thisWeekCount > 0 || mh.thisMonthCount > 0)
    ? `\nMATCH STATS: ${mh.thisWeekCount} match${mh.thisWeekCount !== 1 ? 'es' : ''} this week${mh.lastWeekCount > 0 ? ` (last week: ${mh.lastWeekCount})` : ''}, ${mh.thisMonthCount} this month${mh.avgDuration > 0 ? `, avg ${mh.avgDuration} min` : ''}${mh.totalCaloriesBurned > 0 ? `, ${mh.totalCaloriesBurned} total cal burned from matches` : ''}.`
    : '';

  const matchPatternSection = (() => {
    const patterns: string[] = [];
    if (mh.consecutiveMatchDays >= 3) {
      patterns.push(`OVERTRAINING ALERT: ${mh.consecutiveMatchDays} consecutive days with matches. Strongly recommend rest day to prevent injury.`);
    } else if (mh.consecutiveMatchDays === 2) {
      patterns.push(`Back-to-back match days (${mh.consecutiveMatchDays}). Monitor fatigue — suggest lighter training today.`);
    }
    if (mh.thisWeekCount > mh.lastWeekCount && mh.lastWeekCount > 0) {
      patterns.push(`Match frequency increasing: ${mh.lastWeekCount} last week → ${mh.thisWeekCount} this week.`);
    } else if (mh.thisWeekCount < mh.lastWeekCount && mh.lastWeekCount >= 3) {
      patterns.push(`Match frequency decreasing: ${mh.lastWeekCount} last week → ${mh.thisWeekCount} this week. Good if intentional recovery.`);
    }
    if (mh.thisWeekCount >= 4) {
      patterns.push(`Heavy match week (${mh.thisWeekCount} matches). Prioritize recovery, sleep, and nutrition.`);
    }
    return patterns.length > 0 ? `\nMATCH PATTERNS:\n${patterns.map(p => `- ${p}`).join('\n')}` : '';
  })();

  const nutritionCrossRef = mh.todayMatch && !mh.todayMatch.cancelled
    ? `\nSPORTS-NUTRITION AWARENESS:
- Factor in their match activity when discussing food/calories. A match day burns extra calories — they may need to eat more.
- Pre-match (tomorrow's match logged): Recommend carb-loading (pasta, rice, oats), hydration (2-3L water), light easily digestible meals 3-4h before. Avoid heavy/fatty/spicy foods. ${sport === 'Football' || sport === 'Basketball' || sport === 'Tennis' ? 'Emphasize electrolytes — these endurance sports cause heavy sweating.' : ''}${sport === 'Swimming' ? 'Avoid large meals close to swim time — keep it light 2h before.' : ''}${sport === 'Boxing' || sport === 'MMA' ? 'Watch weight if they have weigh-ins. High protein, moderate carbs.' : ''}
- Post-match (yesterday's match): Protein for muscle repair (1.5-2g/kg), complex carbs for glycogen, anti-inflammatory foods (berries, fish, turmeric). ${sport === 'Cricket' ? 'Hydration especially critical after long matches in the sun.' : ''}
- Match day: Quick energy (banana, energy bar) 30-60 min before. Recovery meal within 30-60 min after.
- If their calorie intake looks low on a match day, proactively mention it: "you burned ~${mh.todayMatch.caloriesBurned || 'a lot of'} cal in that match — make sure you're fueling up"
- If they haven't logged protein today after a match, gently nudge: "how's the protein intake? your muscles need it after ${sport.toLowerCase()}"`
    : '';

  const workoutCrossRef = mh.todayMatch && !mh.todayMatch.cancelled
    ? `\nSPORTS-WORKOUT AWARENESS:
- Pre-match (tomorrow): suggest lighter intensity workout focusing on mobility/stretching, or skip heavy compounds. ${sport === 'Football' || sport === 'Basketball' || sport === 'Tennis' || sport === 'Cricket' ? 'Focus on upper body — save legs for game day.' : ''}${sport === 'Swimming' || sport === 'Boxing' || sport === 'MMA' || sport === 'Volleyball' ? 'Focus on legs — save shoulders and arms for the match.' : ''}
- Match day: If they haven't played yet, light dynamic warm-up only. If done, suggest gentle stretching and foam rolling.
- Post-match (yesterday): Go lighter on muscles heavily used. ${sport === 'Football' || sport === 'Basketball' || sport === 'Tennis' || sport === 'Cricket' ? 'Easy on legs — those sports hammer the lower body. Focus upper body or active recovery.' : ''}${sport === 'Swimming' || sport === 'Boxing' || sport === 'MMA' || sport === 'Volleyball' ? 'Easy on shoulders and core — those sports are upper body intensive. Focus lower body or active recovery.' : ''}
- Recovery priorities: sleep 8+ hours, hydrate, light stretching, avoid heavy deadlifts/squats within 24h of a competitive match.
- If they played ${mh.consecutiveMatchDays >= 2 ? mh.consecutiveMatchDays + ' consecutive days' : '3+ matches this week'}, strongly suggest active recovery or rest day: "your body needs time to rebuild after that much match play"`
    : '';

  return `
SPORTS MODE:
This user plays ${sport} as a ${role}${sp.profile!.fitnessScore !== null ? ` (fitness score: ${sp.profile!.fitnessScore}/100)` : ''}.
${sp.impactScore}% of their workout cycle is sport-targeted (${sp.totalSportExercises} of ${sp.totalCycleExercises} exercises).
${sp.activeModifications.length > 0 ? `They're actively working on:
${sp.activeModifications.map(m => `- ${m.skillName} (${m.skillCategory}) at ${m.priority}% priority, ${m.daysActive} days in${m.targetMuscles.length > 0 ? ` — hitting ${m.targetMuscles.join(', ')}` : ''}${m.sportExercises.length > 0 ? ` — doing ${m.sportExercises.join(', ')}` : ''}`).join('\n')}` : 'No active skill modifications yet.'}
${todayMatchSection}${recentMatchSection}${matchStatsSection}${matchPatternSection}${nutritionCrossRef}${workoutCrossRef}
SPORTS CONVERSATION STYLE:
- Talk about their sport like you actually watch and play it. Use the right terms for ${sport}.
- Reference their specific skill work naturally: "how's the ${sp.activeModifications[0]?.skillName || 'training'} coming along?" not "Your sport skill progress is..."
- If they've been training a skill for a while, acknowledge the commitment: "${sp.activeModifications[0]?.daysActive || 0} days on ${sp.activeModifications[0]?.skillName || 'this'} — that consistency matters"
- Connect their gym exercises to their sport performance: "those lateral lunges are gonna help your court movement"
- When [Sport] exercises show up in their workout, mention how they tie back to their game
- If they mention a match or game, respond with sport-specific knowledge. Know what positions do, what skills matter, and what recovery looks like for ${sport}.
- When they talk about match performance, connect it to their training: "all those agility drills are clearly paying off"
- If they're playing frequently (3+ per week), be mindful of overtraining and suggest active recovery
`;
})() : ''}
You can help this member with:
- Workout progress and consistency analysis
- Attendance patterns
- Body measurement trends and progress
- Subscription status
- Nutrition tracking and calorie analysis
- Meal suggestions based on remaining macros
- Exercise alternatives and substitutions
- Fitness goal setting and tracking
${ctx.healthData.connected ? `- Fitness device data analysis (steps, calories burned, heart rate, sleep)
- Weekly health trends and averages
- Recovery score analysis and workout intensity recommendations
- Cross-analysis between workouts, nutrition, and health metrics (e.g. "you burned 500 cal but only ate 300")` : ''}
${ctx.sportsMode.profile ? `- Sports Mode progress, sport training insights, and skill improvement tracking
- Match day advice: pre-match prep, post-match recovery, nutrition for game days
- Match history and performance tracking
- Cross-analysis: how matches affect workouts, calories, and recovery` : ''}
- Motivation and encouragement based on their data
- Creating support tickets to report issues or request help

AI COACH FEATURES (on their dashboard and pages):
The user has access to these AI Coach features — you should know about them and can reference them naturally:
- AI Workout Insights: Analyzes their 30-day workout data, finds muscle imbalances, and gives a coach's note. Available on their dashboard.
- AI Progress Summary: Monthly report card with workout days, exercises, nutrition averages, and streak data. Available on their dashboard.
- Smart Workout Suggestions: Recommends 3 specific things to focus on based on their patterns and goals. Available on their dashboard.
- AI Nutrition Coaching: Reviews their 7-day food logs, gives personalized diet advice and quick tips. Available on the Nutrition page.
- Proactive Nudges: Smart reminders about missed meals, low water, workout streaks, and goal gaps appear at the top of their dashboard.
When users ask about these features (e.g. "what does the AI coach say about my workouts?" or "give me nutrition advice"), give them answers based on the data you already have in this conversation. You have the same data these features use. Don't just tell them to "check the dashboard" — actually analyze their data and give them a real answer, then mention they can also see the full AI Coach analysis on their dashboard or nutrition page.
If they ask "what AI features do I have?" or "what can you help with?", mention these features naturally.

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

      const newMemberList = ctx.newMemberNames.length > 0
        ? `\n  Names: ${ctx.newMemberNames.join(', ')}`
        : '';

      return basePrompt + `
GYM OVERVIEW:
- Total members: ${ctx.totalMembers}
- Checked in today: ${ctx.checkedInToday} (${ctx.attendanceRate}% of total)${checkedInList}${notCheckedInList}
- New members this month: ${ctx.recentTrends.newMembersThisMonth}${newMemberList}

You can help this owner with:
- Member lists and attendance tracking
- Attendance trends and patterns
- Who checked in today and who hasn't
- Who joined this month (new members)
- Strategic recommendations for member engagement
- Creating support tickets to report issues or request help

CRITICAL — MEMBER DATA RULES:
- You HAVE all the data about this gym loaded above. NEVER say "I don't have" or "check your records" for data that IS in your context.
- When asked "who joined this month" or "new members", ALWAYS list the names from the New Members section above.
- When asked about check-ins, ALWAYS use the data above. You have it — use it.
- If a previous message in conversation said "I don't have that data", IGNORE that — your context has been updated with fresh data.

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
    
    const insightsSection = ctx.aiInsights ? (() => {
      const ai = ctx.aiInsights;
      const churnSection = ai.churnRisk.count > 0
        ? `\nCHURN RISK INTELLIGENCE (AI-scored, weighted formula: attendance 40% + payment 25% + trend 20% + membership age 15%):
- ${ai.churnRisk.count} member${ai.churnRisk.count !== 1 ? 's' : ''} at medium-to-high churn risk
${ai.churnRisk.topMembers.map(m => `  - ${m.name}: score ${m.churnScore}/100 (${m.riskLevel} risk), ${m.daysAbsent} days absent`).join('\n')}
When discussing at-risk members, reference their specific churn score and days absent. Suggest concrete retention actions (personal message, offer a session, check on them).`
        : '\nCHURN RISK: No members currently at medium or high churn risk. Great retention!';

      const mc = ai.monthComparison;
      const fmtChange = (val: number) => val > 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;
      const monthSection = `\nMONTH-OVER-MONTH COMPARISON (${mc.currentMonth} vs ${mc.previousMonth}):
- Attendance: ${mc.attendance.current} vs ${mc.attendance.previous} (${fmtChange(mc.attendance.changePercent)})
- New members: ${mc.newMembers.current} vs ${mc.newMembers.previous} (${fmtChange(mc.newMembers.changePercent)})
- Revenue: ${currency}${mc.revenue.current.toLocaleString()} vs ${currency}${mc.revenue.previous.toLocaleString()} (${fmtChange(mc.revenue.changePercent)})
Use these comparisons when the owner asks about trends, progress, or how this month is going.`;

      const attendSection = `\nATTENDANCE PATTERNS:
- Average daily attendance: ${ai.attendancePatterns.averageDaily} members
- Trend: ${ai.attendancePatterns.trend} (${ai.attendancePatterns.trendPercent > 0 ? '+' : ''}${ai.attendancePatterns.trendPercent.toFixed(1)}% change)`;

      const prioritySection = ai.todayPriority
        ? `\nTODAY'S PRIORITY ACTION:
- ${ai.todayPriority.title}: ${ai.todayPriority.description}${ai.todayPriority.memberName ? ` (Member: ${ai.todayPriority.memberName})` : ''}
Proactively mention this priority if the owner asks "what should I focus on" or "what's important today".`
        : '';

      const weeklySection = (ai.weeklyTrends?.weeks?.length ?? 0) > 0
        ? `\nWEEKLY ATTENDANCE TRENDS (rolling 4-week):
${ai.weeklyTrends!.weeks.map(w => `  - ${w.weekLabel}: ${w.attendance} check-ins${w.changePercent !== 0 ? ` (${w.changePercent > 0 ? '+' : ''}${w.changePercent}% vs prior week)` : ''}`).join('\n')}
Reference these weekly trends when asked about momentum, consistency, or "how are things going".`
        : '';

      const insightSection = ai.insightOfTheDay
        ? `\nINSIGHT OF THE DAY [${ai.insightOfTheDay.severity.toUpperCase()}]:
- ${ai.insightOfTheDay.title}: ${ai.insightOfTheDay.description}
Proactively share this insight if the owner asks for updates or what they should know today.`
        : '';

      const interventionSection = (ai.interventionStats?.total ?? 0) > 0
        ? `\nINTERVENTION EFFECTIVENESS:
- Total interventions logged: ${ai.interventionStats!.total}
- Successful (member returned within 7 days): ${ai.interventionStats!.successful} (${ai.interventionStats!.successRate}% success rate)
- Pending outcome: ${ai.interventionStats!.pending}
Use this data to motivate the owner: "${ai.interventionStats!.successRate}% of your outreach efforts brought members back."${ai.interventionStats!.successRate >= 50 ? ' Their outreach is working well!' : ai.interventionStats!.successRate > 0 ? ' Room for improvement — suggest more personalized messages.' : ''}`
        : '';

      const predictionSection = (ai.churnPredictions?.length ?? 0) > 0
        ? `\nCHURN PREDICTIONS & RECOMMENDATIONS:
${ai.churnPredictions!.map(p => `  - ${p.name}: likely to leave in ${p.predictedWindow}. Suggestion: ${p.recommendation}`).join('\n')}
Use these predictions to give time-sensitive, actionable advice.`
        : '';

      return churnSection + monthSection + attendSection + prioritySection + weeklySection + insightSection + interventionSection + predictionSection;
    })() : '';

    // Build payment intelligence section
    const paymentSection = ctx.paymentBreakdown ? (() => {
      const pb = ctx.paymentBreakdown;
      const fmtAmt = (cents: number) => `${currency}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      const allTimeByMethod = Object.entries(pb.allTime.byMethod)
        .map(([method, data]) => `  - ${method}: ${fmtAmt(data.total)} (${data.count} transactions)`)
        .join('\n');
      const thisMonthByMethod = Object.entries(pb.thisMonth.byMethod)
        .map(([method, data]) => `  - ${method}: ${fmtAmt(data.total)} (${data.count} transactions)`)
        .join('\n') || '  No transactions this month';
      
      return `
PAYMENT INTELLIGENCE (PRE-COMPUTED - use these exact numbers, do NOT recalculate):
ALL-TIME PAYMENTS RECEIVED: ${fmtAmt(pb.allTime.total)} from ${pb.allTime.count} transactions
  By method:
${allTimeByMethod}

THIS MONTH PAYMENTS: ${fmtAmt(pb.thisMonth.total)} from ${pb.thisMonth.count} transactions
  By method:
${thisMonthByMethod}

THIS WEEK: ${fmtAmt(pb.thisWeek.total)} (${pb.thisWeek.count} transactions)
LAST 30 DAYS: ${fmtAmt(pb.last30Days.total)} (${pb.last30Days.count} transactions)

CRITICAL PAYMENT RULES:
- These numbers represent ACTUAL MONEY RECEIVED (payment transactions), not subscription prices.
- When asked "how much through cash/card/etc", use the BY METHOD breakdown above.
- NEVER manually add up amounts. Always use these pre-computed totals.`;
    })() : '';

    const subSection = ctx.subscriptionSummary ? `
SUBSCRIPTION STATUS:
- Active subscriptions: ${ctx.subscriptionSummary.activeCount}
- Ending within 30 days: ${ctx.subscriptionSummary.endingSoonCount}${ctx.subscriptionSummary.endingSoonMembers.length > 0 ? ` (${ctx.subscriptionSummary.endingSoonMembers.join(', ')})` : ''}
- Overdue: ${ctx.subscriptionSummary.overdueCount}` : '';

    const newMemberList = ctx.newMemberNames.length > 0
      ? `\n  Names: ${ctx.newMemberNames.join(', ')}`
      : '';

    return basePrompt + `
GYM OVERVIEW:
- Total members: ${ctx.totalMembers}
- Active subscriptions: ${ctx.activeMembers}
- Checked in today: ${ctx.checkedInToday} (${ctx.attendanceRate}% of total)${checkedInList}${notCheckedInList}
- Unpaid this month: ${ctx.unpaidThisMonth}${unpaidList}
- Expiring within 30 days: ${ctx.expiringThisMonth}${expiringList}
- Revenue this month: ${currency}${ctx.revenueThisMonth.toLocaleString()}
- New members this month: ${ctx.recentTrends.newMembersThisMonth}${newMemberList}
${paymentSection}${subSection}
${insightsSection}

You can help this owner with:
- Business performance analysis and member lists
- Who joined this month (new members) — always list their names when asked
- Member retention insights with specific names and churn scores
- Revenue and payment tracking (by method: cash, card, UPI, etc.) with month-over-month comparisons
- Detailed payment breakdowns by time period (this week, this month, last 30 days, all time)
- Subscription status: who's ending soon, who's overdue
- Attendance trends and pattern analysis
- Strategic recommendations for gym growth
- Identifying members at risk of churning (with AI-scored risk levels)
- Today's priority action and what to focus on
- Suggestions to improve member engagement
- Creating support tickets to report issues or request help

ANALYTICS INTELLIGENCE:
When the owner asks about trends, comparisons, or insights:
- Reference the month-over-month data above for quick comparisons
- Reference churn risk scores and specific member names when discussing retention
- For payment questions, ALWAYS use the PAYMENT INTELLIGENCE section above — never guess or say you don't have the data
- If they ask "compare last N weeks" or similar period questions, the analytics engine will provide detailed data — use the pre-loaded insights above as baseline context
- Speak in plain business language: "Your attendance is up 12% vs last month" not "attendance_change_percent is 12"
- Always pair data with actionable advice: what the number means and what to do about it

CRITICAL — MEMBER DATA RULES:
- You HAVE all the data about this gym loaded above. NEVER say "I don't have" or "check your records" for data that IS in your context.
- When asked "who joined this month" or "new members", ALWAYS list the names from the New Members section above.
- When asked about unpaid members, ALWAYS list names from the Unpaid section.
- When asked about check-ins, ALWAYS use the data above. You have it — use it.
- If a previous message in conversation said "I don't have that data", IGNORE that — your context has been updated with fresh data.

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
  isIOSNative?: boolean,
  voiceMode?: boolean,
  detectedLanguage?: string
): Promise<{ answer: string; followUpChips: string[] }> {
  if (detectOngoingSupportTicketFlow(conversationHistory)) {
    try {
      return await processSupportTicketAction(userId, role, gymId, message, conversationHistory);
    } catch (error: any) {
      console.error('Support ticket flow follow-up failed:', error?.message || error);
    }
  }

  const compoundCheck = detectCompoundQuery(message, role as any, isIOSNative);
  if (compoundCheck.isCompound) {
    try {
      const plan = await generatePlan(message, role, compoundCheck.suggestedTools, isIOSNative);
      if (plan && plan.confidence >= 0.6 && plan.steps.length >= 2) {
        console.log(`[Dika Planner] Compound query detected. Goal: ${plan.goal}, Tools: ${plan.steps.map(s => s.tool).join(', ')}`);

        let memberCtx: MemberContext | null = null;
        let ownerCtx: OwnerContext | null = null;

        const cached = getCachedContext(userId, role, gymId);
        if (cached) {
          if (role === 'owner') {
            ownerCtx = cached.data as OwnerContext;
          } else {
            memberCtx = cached.data as MemberContext;
          }
        } else {
          if (role === 'owner' && gymId) {
            ownerCtx = await getOwnerDataContext(gymId);
          } else {
            memberCtx = await getMemberDataContext(userId, gymId, localDate);
          }
        }

        const { results, narrativeContext } = await executePlan(
          plan, userId, role as any, gymId, memberCtx, ownerCtx, localDate, isIOSNative
        );

        const successCount = results.filter(r => r.success).length;
        if (successCount >= 2) {
          const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
          const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, userId));
          let gymName: string | undefined;
          let gymCurrency: string | undefined;
          if (gymId) {
            const [gym] = await db.select({ name: gyms.name, currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
            if (gym) { gymName = gym.name; gymCurrency = gym.currency || undefined; }
          }
          const userContext: UserContext = { role, gymId, userId, userName: profile?.fullName || user?.username || 'User', gymName, gymCurrency };
          const dataCtx = memberCtx || ownerCtx || {} as any;
          if (!cached) {
            setCachedContext(userId, role, gymId, dataCtx, userContext);
          }

          let systemPrompt = buildSystemPrompt(userContext, dataCtx, isIOSNative, voiceMode, detectedLanguage);
          systemPrompt += `\n\n--- MULTI-TOOL RESULTS (answer using ALL of this data together) ---\n${narrativeContext}\n--- END RESULTS ---\n\nIMPORTANT: The user asked a compound question that touches multiple topics. Weave ALL the data above into ONE natural, conversational response. Don't list tools or separate by category — blend it naturally like a friend giving a complete update. Reference actual numbers from the data.`;

          const historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
          if (conversationHistory && conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-6);
            for (const msg of recentHistory) {
              const cleanContent = msg.content
                .replace(/<!-- MEAL_LOG_DATA:[\s\S]+? -->/g, '[meal logged]')
                .replace(/<!-- DIKA_ACTION_DATA:[\s\S]+? -->/g, '[action taken]')
                .replace(/<!-- WEEKLY_REPORT_DATA:[\s\S]+? -->/g, '[report generated]')
                .replace(/<!-- WORKOUT_PLAN_DATA:[\s\S]+? -->/g, '[workout plan]')
                .replace(/<!-- DIKA_FIND_FOOD -->/g, '[food search]')
                .replace(/<!-- PENDING_BODY_MEASUREMENT:[\s\S]+? -->/g, '[awaiting confirmation]')
                .replace(/<!-- PENDING_EXERCISE_SWAP:[\s\S]+? -->/g, '[awaiting swap choice]')
                .replace(/<!-- PENDING_GOAL:[\s\S]+? -->/g, '[awaiting goal confirmation]')
                .replace(/<!-- PENDING_MEAL_SUGGESTION:[\s\S]+? -->/g, '[meal suggestions shown]')
                .replace(/<!-- PENDING_MATCH_LOG:[\s\S]+? -->/g, '');
              historyMessages.push({ role: msg.role, content: cleanContent });
            }
          }

          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...historyMessages,
              { role: 'user', content: message },
            ],
            max_completion_tokens: voiceMode ? 300 : 600,
          });

          let answer = response.choices[0]?.message?.content || "I ran into an issue pulling your data together. Could you try again?";
          let followUpChips: string[] = [];
          const chipMatch = answer.match(/\[chips?:\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?(?:\s*,\s*"([^"]+)")?\s*\]/i);
          if (chipMatch) {
            followUpChips = [chipMatch[1], chipMatch[2], chipMatch[3]].filter(Boolean) as string[];
            answer = answer.replace(/\n?\[chips?:\s*"[^"]+".+?\]/i, '').trim();
          }
          if (followUpChips.length === 0) {
            followUpChips = generateFollowUpChips(role, message, answer, gymId, isIOSNative);
          }

          console.log(`[Dika Planner] Success — ${successCount} tools returned data`);
          return { answer, followUpChips };
        }
      }
    } catch (error) {
      console.error('[Dika Planner] Failed, falling back to cascade:', error);
    }
  }

  const exerciseQuery = detectExerciseQuestion(message);
  if (exerciseQuery) {
    const exercise = findExercise(exerciseQuery);
    if (exercise) {
      const answer = formatExerciseResponse(exercise);
      const isFromDashboard = message.toLowerCase().includes('help me with the exercise') || message.toLowerCase().includes('swap it with');
      const followUpChips = isFromDashboard
        ? ['I can\'t do this exercise', 'Show me easier alternatives', 'Swap this exercise in my workout']
        : ['What muscles does it work?', 'Alternative exercises', 'My workout progress'];
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
  
  // --- Analytics Intent Detection (runs early to avoid being hijacked by specialized handlers) ---
  try {
    const classifiedIntent = await classifyAnalyticsIntent(message, role);
    if (classifiedIntent && classifiedIntent.confidence >= 0.6) {
      console.log(`[Dika Analytics] Intent: ${classifiedIntent.intent}, confidence: ${classifiedIntent.confidence}, params:`, classifiedIntent.params);
      const analyticsResult = await executeAnalytics(classifiedIntent.intent, userId, gymId, classifiedIntent.params);
      if (analyticsResult) {
        console.log(`[Dika Analytics] Computed: ${analyticsResult.type}, summary length: ${analyticsResult.summary.length}`);
        
        const cached = getCachedContext(userId, role, gymId);
        let userContext: UserContext;
        let dataContext: MemberContext | OwnerContext | TrainerContext;
        if (cached) {
          userContext = cached.userContext;
          dataContext = cached.data;
        } else {
          const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
          const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, userId));
          let gymName: string | undefined;
          let gymCurrency: string | undefined;
          if (gymId) {
            const [gym] = await db.select({ name: gyms.name, currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
            if (gym) { gymName = gym.name; gymCurrency = gym.currency || undefined; }
          }
          userContext = { role, gymId, userId, userName: profile?.fullName || user?.username || 'User', gymName, gymCurrency };
          if (role === 'owner' && gymId) {
            dataContext = await getOwnerDataContext(gymId);
          } else if (role === 'trainer' && gymId) {
            dataContext = await getTrainerDataContext(userId, gymId);
          } else {
            dataContext = await getMemberDataContext(userId, gymId, localDate);
          }
          setCachedContext(userId, role, gymId, dataContext, userContext);
        }

        let systemPrompt = buildSystemPrompt(userContext, dataContext, isIOSNative, voiceMode, detectedLanguage);
        const dataStr = JSON.stringify(analyticsResult.data, null, 0).slice(0, 2000);
        const isEmptyData = detectEmptyAnalytics(analyticsResult);
        const noDataFallback = isEmptyData
          ? `\n\nNOTE: The analytics query returned no meaningful data for this period. Tell the user you checked their records but found no data for the requested timeframe. Suggest they may need to log more workouts/meals/measurements, or try a different time period. Be helpful and encouraging — don't just say "no data found."`
          : `\n\nIMPORTANT: The above analytics data was computed from real historical records. Use it to give a specific, data-driven answer. Reference actual numbers, percentages, and trends. Don't make up numbers — only use what's provided above. Be conversational but precise.`;
        const analyticsInjection = `\n\n--- COMPUTED ANALYTICS DATA (use this to answer the user's question) ---\nAnalysis type: ${analyticsResult.type}\nSummary: ${analyticsResult.summary}\nDetailed data: ${dataStr}\n--- END ANALYTICS DATA ---${noDataFallback}`;
        systemPrompt += analyticsInjection;

        const historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
        if (conversationHistory && conversationHistory.length > 0) {
          const recentHistory = conversationHistory.slice(-6);
          for (const msg of recentHistory) {
            const cleanContent = msg.content
              .replace(/<!-- MEAL_LOG_DATA:[\s\S]+? -->/g, '[meal logged]')
              .replace(/<!-- DIKA_ACTION_DATA:[\s\S]+? -->/g, '[action taken]')
              .replace(/<!-- WEEKLY_REPORT_DATA:[\s\S]+? -->/g, '[report generated]')
              .replace(/<!-- WORKOUT_PLAN_DATA:[\s\S]+? -->/g, '[workout plan]')
              .replace(/<!-- DIKA_FIND_FOOD -->/g, '[food search]')
              .replace(/<!-- PENDING_BODY_MEASUREMENT:[\s\S]+? -->/g, '[awaiting confirmation]')
              .replace(/<!-- PENDING_EXERCISE_SWAP:[\s\S]+? -->/g, '[awaiting swap choice]')
              .replace(/<!-- PENDING_GOAL:[\s\S]+? -->/g, '[awaiting goal confirmation]')
              .replace(/<!-- PENDING_MEAL_SUGGESTION:[\s\S]+? -->/g, '[meal suggestions shown]')
              .replace(/<!-- PENDING_MATCH_LOG:[\s\S]+? -->/g, '');
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
          max_completion_tokens: 700,
        });

        let rawAnswer = response.choices[0]?.message?.content || "I'm having trouble understanding that. Could you rephrase?";
        let followUpChips: string[] = [];
        const chipMatch = rawAnswer.match(/\[chips?:\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?(?:\s*,\s*"([^"]+)")?\s*\]/i);
        if (chipMatch) {
          followUpChips = [chipMatch[1], chipMatch[2], chipMatch[3]].filter(Boolean) as string[];
          rawAnswer = rawAnswer.replace(/\n?\[chips?:\s*"[^"]+".+?\]/i, '').trim();
        }
        if (followUpChips.length === 0) {
          followUpChips = generateFollowUpChips(role, message, rawAnswer, gymId, isIOSNative);
        }
        return { answer: rawAnswer, followUpChips };
      }
    }
  } catch (error) {
    console.error('[Dika Analytics] Intent classification or computation failed:', error);
  }
  // --- End Analytics Intent Detection ---

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

  if (role === 'member' && detectMatchLogRequest(message)) {
    try {
      const result = await processMatchLogConversation(userId, message, conversationHistory, localDate);
      if (result) return result;
    } catch (error) {
      console.error('Match log conversation failed:', error);
    }
  }

  if (role === 'member' && detectPendingMatchFlow(conversationHistory)) {
    try {
      const result = await processMatchFollowUp(userId, message, conversationHistory, localDate);
      if (result) return result;
    } catch (error) {
      console.error('Match follow-up failed:', error);
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

  if (role === 'member') {
    const pendingMemberAction = detectPendingMemberAction(conversationHistory);
    if (pendingMemberAction) {
      const userWantsToLogMeal = detectMealLogRequest(message);
      try {
        if (pendingMemberAction === 'log_body_measurement') {
          if (!userWantsToLogMeal) {
            return await processBodyMeasurement(userId, gymId, message, conversationHistory);
          }
        }
        if (pendingMemberAction === 'swap_exercise') {
          if (!userWantsToLogMeal) {
            return await processExerciseSwap(userId, gymId, message, conversationHistory, localDate);
          }
        }
        if (pendingMemberAction === 'set_goal') {
          if (!userWantsToLogMeal) {
            return await processGoalAction(userId, gymId, message, 'set_goal', conversationHistory);
          }
        }
        if (pendingMemberAction === 'suggest_meal') {
          return await processMealSuggestion(userId, message, conversationHistory, localDate);
        }
      } catch (error) {
        console.error('Member action follow-up failed:', error);
      }
    }

    const memberAction = detectMemberAction(message);
    if (memberAction) {
      try {
        if (memberAction === 'suggest_meal') {
          return await processMealSuggestion(userId, message, conversationHistory, localDate);
        }
        if (memberAction === 'log_body_measurement') {
          return await processBodyMeasurement(userId, gymId, message, conversationHistory);
        }
        if (memberAction === 'swap_exercise') {
          return await processExerciseSwap(userId, gymId, message, conversationHistory, localDate);
        }
        if (memberAction === 'set_goal') {
          return await processGoalAction(userId, gymId, message, 'set_goal', conversationHistory);
        }
        if (memberAction === 'update_goal') {
          return await processGoalAction(userId, gymId, message, 'update_goal', conversationHistory);
        }
      } catch (error) {
        console.error('Member action processing failed:', error);
      }
    }
  }

  if (role === 'member' && detectFindFoodRequest(message)) {
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
        const foodName = message.replace(/^(i\s+)?(had|ate|just had|just ate|consumed|grabbed|got|eaten|have|having)\s+/i, '').replace(/\s+(for\s+)?(breakfast|lunch|dinner|snack|brunch|supper).*$/i, '').trim();
        
        let questionParts: string[] = [];

        if (foodType.styleOptions && foodType.styleOptions.length > 0) {
          questionParts.push(`what kind? ${foodType.styleOptions.slice(0, 4).join(", ")}...`);
        }
        if (foodType.type === "countable" || foodType.type === "sliced") {
          questionParts.push(`how many ${foodType.countUnit}?`);
        }
        if (foodType.sizeOptions && foodType.sizeOptions.length > 0) {
          const sizeLabels = foodType.sizeOptions.map(s => s.label.toLowerCase());
          questionParts.push(`size? ${sizeLabels.join(" / ")}`);
        }
        if (foodType.type === "portioned" && !foodType.sizeOptions) {
          questionParts.push(`how much — half, 1 bowl, 1 plate?`);
        }
        if (!detectedRestaurant && isRestaurantFood) {
          questionParts.push(`from a restaurant or homemade?`);
        }

        const intro = `got it — ${foodName}! quick questions so I nail the calories:`;
        const questions = questionParts.join(" and ");
        const outro = `just tell me what you know, I'll estimate the rest`;
        
        const answer = `${intro} ${questions}.\n\n${outro}`;
        const chips = generateFoodTypeChips(foodType);
        return { answer, followUpChips: chips };
      }
      
      if (!detectedRestaurant && isRestaurantFood && !foodType) {
        const answer = `nice — was that from a restaurant or homemade? if it's from somewhere specific, the brand/restaurant name helps me get the calories closer. any toppings or extras too.\n\njust say something like "McDonald's, no mayo" or "homemade" and I'll handle the rest`;
        const followUpChips = [
          'Homemade',
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
    const isTodoRequest = /(?:to.?do\s+list|daily\s+(?:priorities|briefing|tasks?|summary)|(?:what|give\s+me|show\s+me)\s+.*(?:to.?do|priorities|tasks?\s+for\s+today|action\s+items?)|what\s+should\s+i\s+(?:do|focus|prioritize)\s+today|my\s+(?:priorities|tasks?)\s+(?:for\s+)?today)/i.test(message);
    if (isTodoRequest) {
      try {
        const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
        const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, userId));
        const ownerName = profile?.fullName || user?.username || 'Owner';
        return await generateOwnerBriefing(gymId, ownerName, isIOSNative);
      } catch (error: any) {
        console.error('Owner briefing generation failed:', error?.message || error);
      }
    }

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
      dataContext = await getMemberDataContext(userId, gymId, localDate);
    }

    setCachedContext(userId, role, gymId, dataContext, userContext);
  }

  let systemPrompt = buildSystemPrompt(userContext, dataContext, isIOSNative, voiceMode, detectedLanguage);
  
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
          .replace(/<!-- DIKA_FIND_FOOD -->/g, '[food search]')
          .replace(/<!-- PENDING_BODY_MEASUREMENT:[\s\S]+? -->/g, '[awaiting confirmation]')
          .replace(/<!-- PENDING_EXERCISE_SWAP:[\s\S]+? -->/g, '[awaiting swap choice]')
          .replace(/<!-- PENDING_GOAL:[\s\S]+? -->/g, '[awaiting goal confirmation]')
          .replace(/<!-- PENDING_MEAL_SUGGESTION:[\s\S]+? -->/g, '[meal suggestions shown]')
          .replace(/<!-- PENDING_MATCH_LOG:[\s\S]+? -->/g, '');
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
      max_completion_tokens: voiceMode ? 300 : 500,
    });
    
    let rawAnswer = response.choices[0]?.message?.content || "I'm having trouble understanding that. Could you rephrase?";
    
    let followUpChips: string[] = [];
    const chipMatch = rawAnswer.match(/\[chips?:\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?(?:\s*,\s*"([^"]+)")?\s*\]/i);
    if (chipMatch) {
      followUpChips = [chipMatch[1], chipMatch[2], chipMatch[3]].filter(Boolean) as string[];
      rawAnswer = rawAnswer.replace(/\n?\[chips?:\s*"[^"]+".+?\]/i, '').trim();
    }
    
    if (followUpChips.length === 0) {
      followUpChips = generateFollowUpChips(role, message, rawAnswer, gymId, isIOSNative);
    }
    
    return { answer: rawAnswer, followUpChips };
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
      match: /match|game|tournament|played|playing|bout|fight|meet\b/.test(combined),
      sport: /sport|football|basketball|tennis|swimming|boxing|mma|cricket|volleyball|skill|training\s+program/.test(combined),
      recovery: /recovery|recover|rest|sore|tired|fatigue|overtraining/.test(combined),
    };

    const chips: string[] = [];
    if (topics.match) {
      chips.push('My match history');
      if (/tomorrow|pre.match|before.*match/.test(combined)) {
        chips.push('What should I eat before the match?');
        if (!topics.workout) chips.push('Should I train today?');
      } else if (/yesterday|after.*match|played|recovery/.test(combined)) {
        chips.push('Recovery meal ideas');
        if (!topics.workout) chips.push('Light workout suggestions');
      } else {
        if (!topics.nutrition) chips.push('Pre-match nutrition tips');
        if (!topics.workout) chips.push('How am I doing this week?');
      }
    }
    if (topics.sport && !topics.match) {
      chips.push('Log a match');
      chips.push('My sport progress');
    }
    if (topics.recovery) {
      chips.push('Recovery meal ideas');
      if (!topics.workout) chips.push('Should I train today?');
    }
    if (topics.nutrition && !topics.match) {
      chips.push('How many calories left today?');
      if (!topics.workout) chips.push('What\'s my workout today?');
    }
    if (topics.workout && !topics.match) {
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

export async function generateOwnerBriefing(gymId: number, ownerName: string, isIOSNative?: boolean): Promise<{ answer: string; followUpChips: string[] }> {
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

  if (!isIOSNative) {
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
  }

  if (inactiveMemberNames.length > 0) {
    const inactiveTotal = memberIdList.length - (new Set(inactiveMemberNames).size);
    lines.push('');
    lines.push(`**Needs attention**: ${inactiveMemberNames.length} member${inactiveMemberNames.length > 1 ? 's' : ''} haven't visited in 7+ days`);
    lines.push(`  ${inactiveMemberNames.join(', ')}`);
  }

  const chips: string[] = [];
  if (!isIOSNative) {
    if (unpaidCount > 0) chips.push('Who hasn\'t paid?');
    if (expiring > 0) chips.push('Expiring memberships');
  }
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
