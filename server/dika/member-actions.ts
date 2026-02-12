import OpenAI from "openai";
import { db } from "../db";
import { 
  bodyMeasurements, fitnessGoals, workoutCompletions, workoutItems, workoutCycles,
  foodLogs, calorieGoals
} from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { parseMealFromMessage, logMealForUser, getTodayNutritionSummary, formatMealLogResponse } from "./meal-logger";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type MemberActionType = 
  | 'log_body_measurement'
  | 'swap_exercise'
  | 'set_goal'
  | 'update_goal'
  | 'suggest_meal';

const BODY_MEASUREMENT_PATTERNS = [
  /(?:log|record|save|update|enter)\s+(?:my\s+)?(?:weight|body\s*fat|measurements?|body\s+measurements?)/i,
  /(?:my\s+)?weight\s+(?:is|was)\s+(\d+)/i,
  /(?:i\s+)?weigh\s+(\d+)/i,
  /(?:i'm|i am|im)\s+(\d+)\s*(?:kg|lbs?|pounds?|kilos?)/i,
  /(?:body\s*fat|bf)\s+(?:is|was|at)?\s*(\d+)/i,
  /(?:weight|body\s*fat)\s*[:=]\s*(\d+)/i,
  /(\d+)\s*(?:kg|lbs?|pounds?|kilos?)\s+(?:today|now|currently)/i,
  /(?:my\s+)?(?:chest|waist|hips?|biceps?|thighs?)\s+(?:is|are|was|measures?)\s+(\d+)/i,
];

const EXERCISE_SWAP_PATTERNS = [
  /(?:can't|cannot|cant|unable\s+to|don't\s+want\s+to|skip)\s+(?:do\s+)?(.+?)(?:\s+today)?$/i,
  /(?:replace|swap|substitute|switch|change)\s+(.+?)\s+(?:with|for|to)\s+(.+)/i,
  /(?:alternative|substitute|replacement)\s+(?:for|to)\s+(.+)/i,
  /(?:what\s+(?:can|should)\s+i\s+do\s+instead\s+of)\s+(.+)/i,
  /(?:give|suggest|show)\s+(?:me\s+)?(?:an?\s+)?(?:alternative|substitute|replacement)\s+(?:for|to)\s+(.+)/i,
];

const EXERCISE_SWAP_CONFIRM_PATTERNS = [
  /(?:replace|swap|switch)\s+(?:with|to)\s+(.+)/i,
  /(?:yes|yeah|sure|ok|okay|yep|do\s+it|go\s+ahead|let's\s+do|replace\s+it|swap\s+it)\s*(?:with\s+)?(.+)?/i,
];

const GOAL_SET_PATTERNS = [
  /(?:i\s+want\s+to|my\s+goal\s+is\s+to|i\s+(?:aim|plan)\s+to)\s+(.+)/i,
  /(?:set|create|add|make)\s+(?:a\s+)?goal\s*(?:to|for|:)?\s*(.+)/i,
  /(?:target|goal)\s*(?::|is|of)?\s+(.+)/i,
  /(?:i\s+want\s+to\s+(?:reach|hit|get\s+to|achieve))\s+(.+)/i,
];

const GOAL_CHECK_PATTERNS = [
  /(?:how\s+(?:are|is)\s+)?my\s+goals?/i,
  /(?:check|show|view|see)\s+(?:my\s+)?goals?/i,
  /goal\s+progress/i,
  /(?:how\s+(?:am|is))\s+(?:my\s+)?(?:goal|progress)/i,
];

const MEAL_SUGGESTION_PATTERNS = [
  /what\s+(?:should|can|could)\s+i\s+eat/i,
  /suggest\s+(?:me\s+)?(?:a\s+)?(?:meal|food|something\s+to\s+eat)/i,
  /(?:i'm|im|i\s+am)\s+hungry/i,
  /(?:meal|food)\s+(?:suggestion|recommendation|idea)/i,
  /what\s+(?:to|should\s+i)\s+(?:eat|have)\s+(?:for\s+)?(?:now|next|tonight|lunch|dinner|breakfast)/i,
  /(?:recommend|suggest)\s+(?:something|a\s+meal|food)/i,
  /(?:help\s+me\s+)?(?:pick|choose|decide)\s+(?:what\s+to\s+eat|a\s+meal|food)/i,
];

export function detectMemberAction(message: string): MemberActionType | null {
  const lower = message.toLowerCase().trim();
  
  if (MEAL_SUGGESTION_PATTERNS.some(p => p.test(lower))) return 'suggest_meal';
  if (GOAL_CHECK_PATTERNS.some(p => p.test(lower))) return 'update_goal';
  if (GOAL_SET_PATTERNS.some(p => p.test(lower))) return 'set_goal';
  if (BODY_MEASUREMENT_PATTERNS.some(p => p.test(lower))) return 'log_body_measurement';
  if (EXERCISE_SWAP_PATTERNS.some(p => p.test(lower))) return 'swap_exercise';
  
  return null;
}

export function detectPendingMemberAction(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): MemberActionType | null {
  if (!conversationHistory || conversationHistory.length < 2) return null;
  const recent = conversationHistory.slice(-4);
  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i];
    if (msg.role === 'assistant') {
      if (msg.content.includes('<!-- PENDING_BODY_MEASUREMENT:')) return 'log_body_measurement';
      if (msg.content.includes('<!-- PENDING_EXERCISE_SWAP:')) return 'swap_exercise';
      if (msg.content.includes('<!-- PENDING_GOAL:')) return 'set_goal';
      if (msg.content.includes('<!-- PENDING_MEAL_SUGGESTION:')) return 'suggest_meal';
      if (msg.content.includes('DIKA_ACTION_DATA')) return null;
    }
  }
  return null;
}

function extractPendingData(conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>, marker: string): any | null {
  const recent = conversationHistory.slice(-6);
  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i];
    if (msg.role === 'assistant') {
      const regex = new RegExp(`<!-- ${marker}:([\\s\\S]+?) -->`);
      const match = msg.content.match(regex);
      if (match) {
        try { return JSON.parse(match[1].trim()); } catch { return null; }
      }
    }
  }
  return null;
}

export async function processBodyMeasurement(
  userId: number,
  gymId: number | null,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; followUpChips: string[] }> {
  const pendingData = conversationHistory ? extractPendingData(conversationHistory, 'PENDING_BODY_MEASUREMENT') : null;
  
  if (pendingData) {
    const lower = message.toLowerCase().trim();
    if (/^(yes|yeah|sure|ok|okay|yep|do\s*it|go\s*ahead|log\s*it|confirm|save|yes,?\s*log)/i.test(lower)) {
      try {
        await db.insert(bodyMeasurements).values({
          memberId: userId,
          gymId: gymId,
          recordedDate: new Date().toISOString().split('T')[0],
          weight: pendingData.weight || null,
          bodyFat: pendingData.bodyFat || null,
          height: pendingData.height || null,
          chest: pendingData.chest || null,
          waist: pendingData.waist || null,
          hips: pendingData.hips || null,
          biceps: pendingData.biceps || null,
          thighs: pendingData.thighs || null,
        });

        const parts: string[] = [];
        if (pendingData.weight) parts.push(`Weight: ${pendingData.weight}kg`);
        if (pendingData.bodyFat) parts.push(`Body Fat: ${pendingData.bodyFat}%`);
        if (pendingData.height) parts.push(`Height: ${pendingData.height}cm`);
        if (pendingData.chest) parts.push(`Chest: ${pendingData.chest}cm`);
        if (pendingData.waist) parts.push(`Waist: ${pendingData.waist}cm`);
        if (pendingData.hips) parts.push(`Hips: ${pendingData.hips}cm`);
        if (pendingData.biceps) parts.push(`Biceps: ${pendingData.biceps}cm`);
        if (pendingData.thighs) parts.push(`Thighs: ${pendingData.thighs}cm`);

        const [prev] = await db.select()
          .from(bodyMeasurements)
          .where(eq(bodyMeasurements.memberId, userId))
          .orderBy(desc(bodyMeasurements.createdAt))
          .offset(1)
          .limit(1);

        let comparison = '';
        if (prev && pendingData.weight && prev.weight) {
          const diff = pendingData.weight - prev.weight;
          if (diff < 0) comparison = ` That's down ${Math.abs(diff)}kg from your last entry — nice progress!`;
          else if (diff > 0) comparison = ` That's up ${diff}kg from your last entry.`;
          else comparison = ' Same as your last entry — staying consistent!';
        }

        const actionData = {
          actionType: 'log_body_measurement',
          status: 'completed',
          preview: parts.join(', '),
          data: pendingData,
        };

        return {
          answer: `Logged! ${parts.join(', ')} for today.${comparison}\n\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`,
          followUpChips: ['Show my body progress', 'My workout today', 'How am I doing?'],
        };
      } catch (error) {
        console.error('Body measurement logging failed:', error);
        return {
          answer: "Something went wrong logging your measurements. Try again?",
          followUpChips: ['Try again', 'My workout progress'],
        };
      }
    } else {
      return {
        answer: "No problem, cancelled! Let me know if you want to log anything later.",
        followUpChips: ['My workout today', 'How am I doing?'],
      };
    }
  }

  const measurements = parseMeasurementsFromMessage(message);
  if (!measurements || Object.keys(measurements).length === 0) {
    return {
      answer: "I'd love to log your measurements! Just tell me your numbers, like:\n\n\"Weight 75kg\" or \"Weight 75, body fat 18%\"\n\nI can log weight, body fat, height, chest, waist, hips, biceps, and thighs.",
      followUpChips: ['Log my weight', 'Show my body progress'],
    };
  }

  const parts: string[] = [];
  if (measurements.weight) parts.push(`Weight: ${measurements.weight}kg`);
  if (measurements.bodyFat) parts.push(`Body Fat: ${measurements.bodyFat}%`);
  if (measurements.height) parts.push(`Height: ${measurements.height}cm`);
  if (measurements.chest) parts.push(`Chest: ${measurements.chest}cm`);
  if (measurements.waist) parts.push(`Waist: ${measurements.waist}cm`);
  if (measurements.hips) parts.push(`Hips: ${measurements.hips}cm`);
  if (measurements.biceps) parts.push(`Biceps: ${measurements.biceps}cm`);
  if (measurements.thighs) parts.push(`Thighs: ${measurements.thighs}cm`);

  return {
    answer: `I'll log ${parts.join(', ')} for today. Sound right?\n\n<!-- PENDING_BODY_MEASUREMENT:${JSON.stringify(measurements)} -->`,
    followUpChips: ['Yes, log it', 'No, cancel'],
  };
}

function parseMeasurementsFromMessage(message: string): Record<string, number> | null {
  const measurements: Record<string, number> = {};
  const lower = message.toLowerCase();

  const weightMatch = lower.match(/(?:weight|weigh|i'm|im|i\s+am)\s*(?:is|was|at|:)?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|lbs?|pounds?)?/i) ||
    lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)\b/i);
  if (weightMatch) measurements.weight = Math.round(parseFloat(weightMatch[1]));

  const bfMatch = lower.match(/(?:body\s*fat|bf|fat)\s*(?:is|was|at|:|\s)?\s*(\d+(?:\.\d+)?)\s*%?/i);
  if (bfMatch) measurements.bodyFat = Math.round(parseFloat(bfMatch[1]));

  const heightMatch = lower.match(/(?:height)\s*(?:is|was|at|:)?\s*(\d+(?:\.\d+)?)\s*(?:cm)?/i);
  if (heightMatch) measurements.height = Math.round(parseFloat(heightMatch[1]));

  const fields = ['chest', 'waist', 'hips', 'biceps', 'thighs'];
  for (const field of fields) {
    const regex = new RegExp(`${field}\\s*(?:is|was|at|:|measures?)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:cm|inches?|in)?`, 'i');
    const match = lower.match(regex);
    if (match) measurements[field] = Math.round(parseFloat(match[1]));
  }

  return Object.keys(measurements).length > 0 ? measurements : null;
}

export async function processExerciseSwap(
  userId: number,
  gymId: number | null,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  localDate?: string
): Promise<{ answer: string; followUpChips: string[] }> {
  const pendingData = conversationHistory ? extractPendingData(conversationHistory, 'PENDING_EXERCISE_SWAP') : null;

  if (pendingData) {
    const lower = message.toLowerCase().trim();
    
    let chosenExercise: string | null = null;
    
    if (pendingData.alternatives) {
      for (const alt of pendingData.alternatives) {
        if (lower.includes(alt.toLowerCase()) || 
            lower.includes(`replace with ${alt.toLowerCase()}`) ||
            lower.includes(`swap to ${alt.toLowerCase()}`)) {
          chosenExercise = alt;
          break;
        }
      }
    }

    if (!chosenExercise && /^(yes|yeah|sure|ok|1|first|go\s*ahead|do\s*it)/i.test(lower) && pendingData.alternatives?.[0]) {
      chosenExercise = pendingData.alternatives[0];
    }

    if (!chosenExercise && /^(no|nah|cancel|never\s*mind|skip)/i.test(lower)) {
      return {
        answer: "No worries! Your original exercise stays. Let me know if you need anything else.",
        followUpChips: ['My workout today', 'How am I doing?'],
      };
    }

    if (chosenExercise && pendingData.workoutItemId) {
      try {
        const today = localDate || new Date().toISOString().split('T')[0];
        await db.insert(workoutCompletions).values({
          gymId: gymId,
          cycleId: pendingData.cycleId,
          workoutItemId: pendingData.workoutItemId,
          memberId: userId,
          completedDate: today,
          exerciseName: chosenExercise,
          exerciseType: pendingData.exerciseType || 'strength',
          actualSets: pendingData.sets || null,
          actualReps: pendingData.reps || null,
        });

        const actionData = {
          actionType: 'swap_exercise',
          status: 'completed',
          preview: `${pendingData.originalExercise} → ${chosenExercise}`,
          data: { original: pendingData.originalExercise, replacement: chosenExercise, date: today },
        };

        return {
          answer: `Done! Swapped **${pendingData.originalExercise}** with **${chosenExercise}** for today. Your workout plan stays the same for future days.\n\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`,
          followUpChips: ['My workout today', 'Log another swap', 'How am I doing?'],
        };
      } catch (error) {
        console.error('Exercise swap failed:', error);
        return {
          answer: "Something went wrong with the swap. Want to try again?",
          followUpChips: ['Try again', 'My workout today'],
        };
      }
    }
  }

  const exerciseName = extractExerciseFromSwapRequest(message);
  if (!exerciseName) {
    return {
      answer: "Which exercise would you like to swap? Tell me something like \"I can't do barbell squats today\" or \"give me an alternative to bench press.\"",
      followUpChips: ['My workout today', 'Show my exercises'],
    };
  }

  const source = gymId ? 'trainer' as const : 'self' as const;
  const [cycle] = await db.select({
    id: workoutCycles.id,
    cycleLength: workoutCycles.cycleLength,
    startDate: workoutCycles.startDate,
    restDays: workoutCycles.restDays,
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

  if (!cycle) {
    return {
      answer: "You don't have an active workout cycle right now, so there's nothing to swap. Set up a workout plan first!",
      followUpChips: ['Create a workout plan', 'My workout progress'],
    };
  }

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

  const todayExercises = await db.select({
    id: workoutItems.id,
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

  const matchedExercise = todayExercises.find(e => 
    e.exerciseName.toLowerCase().includes(exerciseName.toLowerCase()) ||
    exerciseName.toLowerCase().includes(e.exerciseName.toLowerCase())
  );

  if (!matchedExercise) {
    const exerciseList = todayExercises.map(e => e.exerciseName).join(', ');
    return {
      answer: `I couldn't find "${exerciseName}" in today's workout. Your exercises today are: ${exerciseList || 'none scheduled'}. Which one would you like to swap?`,
      followUpChips: todayExercises.slice(0, 3).map(e => `Swap ${e.exerciseName}`),
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `You are a fitness expert. Suggest exactly 3 alternative exercises for "${matchedExercise.exerciseName}" that target the same muscle group (${matchedExercise.muscleType}). Return ONLY a JSON array of 3 exercise names, nothing else. Example: ["Goblet Squats","Leg Press","Bulgarian Split Squats"]`
      }],
      max_completion_tokens: 100,
    });

    let alternatives: string[] = [];
    try {
      const raw = response.choices[0]?.message?.content || '[]';
      alternatives = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      alternatives = ['Dumbbell variation', 'Machine variation', 'Bodyweight variation'];
    }

    const pendingSwap = {
      workoutItemId: matchedExercise.id,
      cycleId: cycle.id,
      originalExercise: matchedExercise.exerciseName,
      muscleType: matchedExercise.muscleType,
      exerciseType: matchedExercise.exerciseType,
      sets: matchedExercise.sets,
      reps: matchedExercise.reps,
      alternatives,
    };

    return {
      answer: `Here are 3 alternatives for **${matchedExercise.exerciseName}** (${matchedExercise.muscleType}):\n\n1. **${alternatives[0]}**\n2. **${alternatives[1]}**\n3. **${alternatives[2]}**\n\nWhich one would you like to swap in for today? Your plan stays the same for future days.\n\n<!-- PENDING_EXERCISE_SWAP:${JSON.stringify(pendingSwap)} -->`,
      followUpChips: alternatives.map(a => `Replace with ${a}`),
    };
  } catch (error) {
    console.error('Exercise swap AI suggestion failed:', error);
    return {
      answer: `I can swap **${matchedExercise.exerciseName}** for you. What exercise would you like to do instead?`,
      followUpChips: ['Dumbbell variation', 'Machine variation', 'Skip this exercise'],
    };
  }
}

function extractExerciseFromSwapRequest(message: string): string | null {
  for (const pattern of EXERCISE_SWAP_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const name = (match[1] || '').trim()
        .replace(/^(do|the|my)\s+/i, '')
        .replace(/\s+today$/i, '')
        .replace(/\?$/, '')
        .trim();
      if (name.length >= 3) return name;
    }
  }
  return null;
}

export async function processGoalAction(
  userId: number,
  gymId: number | null,
  message: string,
  actionType: 'set_goal' | 'update_goal',
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; followUpChips: string[] }> {
  const pendingData = conversationHistory ? extractPendingData(conversationHistory, 'PENDING_GOAL') : null;

  if (pendingData) {
    const lower = message.toLowerCase().trim();
    if (/^(yes|yeah|sure|ok|okay|yep|do\s*it|go\s*ahead|set\s*it|save|confirm)/i.test(lower)) {
      try {
        const milestones = generateMilestones(pendingData.category, pendingData.currentValue, pendingData.targetValue);
        
        await db.insert(fitnessGoals).values({
          userId,
          gymId,
          category: pendingData.category,
          title: pendingData.title,
          targetValue: pendingData.targetValue || null,
          targetUnit: pendingData.targetUnit || null,
          currentValue: pendingData.currentValue || null,
          milestones,
          isActive: true,
        });

        const actionData = {
          actionType: 'set_goal',
          status: 'completed',
          preview: pendingData.title,
          data: pendingData,
        };

        let milestonesText = '';
        if (milestones && milestones.length > 0) {
          milestonesText = `\n\nMilestones I'll track:\n${milestones.map(m => `- ${m}`).join('\n')}`;
        }

        return {
          answer: `Goal set! "${pendingData.title}"${milestonesText}\n\nI'll keep track of your progress and check in when it's relevant.${pendingData.targetValue ? ` Target: ${pendingData.targetValue}${pendingData.targetUnit || ''}` : ''}\n\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`,
          followUpChips: ['Show my goals', 'My workout today', 'How am I doing?'],
        };
      } catch (error) {
        console.error('Goal creation failed:', error);
        return {
          answer: "Something went wrong setting your goal. Want to try again?",
          followUpChips: ['Try again', 'My workout progress'],
        };
      }
    } else {
      return {
        answer: "No problem, cancelled! Let me know when you want to set a goal.",
        followUpChips: ['My workout today', 'How am I doing?'],
      };
    }
  }

  if (actionType === 'update_goal') {
    const activeGoals = await db.select()
      .from(fitnessGoals)
      .where(and(
        eq(fitnessGoals.userId, userId),
        eq(fitnessGoals.isActive, true)
      ))
      .orderBy(desc(fitnessGoals.createdAt));

    if (activeGoals.length === 0) {
      return {
        answer: "You don't have any active goals yet! Want to set one? Just tell me something like \"I want to bench 80kg\" or \"I want to lose 5kg.\"",
        followUpChips: ['Set a weight goal', 'Set a strength goal', 'Set a consistency goal'],
      };
    }

    const goalSummaries = activeGoals.map((g, i) => {
      let progress = '';
      if (g.targetValue && g.currentValue) {
        const pct = Math.round((g.currentValue / g.targetValue) * 100);
        progress = ` (${pct}% — currently ${g.currentValue}${g.targetUnit || ''})`;
      }
      const milestoneText = g.milestones && g.milestones.length > 0 
        ? `\n   Milestones: ${g.milestones.join(' → ')}` : '';
      return `${i + 1}. **${g.title}**${progress}${milestoneText}`;
    });

    return {
      answer: `Here are your active goals:\n\n${goalSummaries.join('\n\n')}\n\nWant to update any of these or set a new goal?`,
      followUpChips: ['Set a new goal', 'How am I doing overall?', 'My workout today'],
    };
  }

  const goalInfo = await parseGoalFromMessage(message);
  if (!goalInfo) {
    return {
      answer: "I'd love to help you set a goal! What would you like to achieve? For example:\n\n- \"I want to bench 80kg\"\n- \"I want to lose 5kg\"\n- \"I want to work out 5 times a week\"\n- \"I want to hit 2000 calories daily\"",
      followUpChips: ['Set a weight goal', 'Set a strength goal', 'Set a consistency goal'],
    };
  }

  const confirmParts: string[] = [];
  confirmParts.push(`I'll set this goal for you:`);
  confirmParts.push(`\n**${goalInfo.title}**`);
  if (goalInfo.targetValue) confirmParts.push(`Target: ${goalInfo.targetValue}${goalInfo.targetUnit || ''}`);
  if (goalInfo.currentValue) confirmParts.push(`Current: ${goalInfo.currentValue}${goalInfo.targetUnit || ''}`);
  confirmParts.push(`\nSound good?`);

  return {
    answer: `${confirmParts.join('\n')}\n\n<!-- PENDING_GOAL:${JSON.stringify(goalInfo)} -->`,
    followUpChips: ['Yes, set it', 'No, cancel'],
  };
}

async function parseGoalFromMessage(message: string): Promise<{
  category: string; title: string; targetValue?: number; targetUnit?: string; currentValue?: number;
} | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `Parse this fitness goal. Return JSON with: category (one of: strength, weight, body_fat, consistency, nutrition, custom), title (short readable goal), targetValue (number or null), targetUnit (kg, lbs, %, times/week, cal, etc or null), currentValue (if mentioned, null otherwise). Example: {"category":"strength","title":"Bench press 80kg","targetValue":80,"targetUnit":"kg","currentValue":null}`
      }, {
        role: "user",
        content: message
      }],
      max_completion_tokens: 150,
    });

    const raw = response.choices[0]?.message?.content || '';
    return JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch {
    const lower = message.toLowerCase();
    if (/\d+\s*kg/i.test(lower)) {
      const val = parseInt(lower.match(/(\d+)\s*kg/i)?.[1] || '0');
      if (lower.includes('lose') || lower.includes('weight')) {
        return { category: 'weight', title: `Reach ${val}kg`, targetValue: val, targetUnit: 'kg' };
      }
      return { category: 'strength', title: `Lift ${val}kg`, targetValue: val, targetUnit: 'kg' };
    }
    return { category: 'custom', title: message.replace(/^(i want to|my goal is to|set a goal to)\s*/i, '').trim() };
  }
}

function generateMilestones(category: string, currentValue?: number, targetValue?: number): string[] {
  if (!targetValue) return [];
  const current = currentValue || 0;
  const diff = targetValue - current;
  if (diff === 0) return [];

  const steps = Math.min(4, Math.max(2, Math.ceil(Math.abs(diff) / 5)));
  const increment = diff / steps;
  const milestones: string[] = [];

  for (let i = 1; i <= steps; i++) {
    const val = Math.round(current + increment * i);
    milestones.push(`${val}`);
  }
  return milestones;
}

export async function processMealSuggestion(
  userId: number,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  localDate?: string
): Promise<{ answer: string; followUpChips: string[] }> {
  const pendingData = conversationHistory ? extractPendingData(conversationHistory, 'PENDING_MEAL_SUGGESTION') : null;

  if (pendingData) {
    const lower = message.toLowerCase().trim();
    
    let chosenMeal: any = null;
    if (pendingData.suggestions) {
      for (const s of pendingData.suggestions) {
        if (lower.includes(s.name.toLowerCase()) || lower.includes(`log ${s.name.toLowerCase()}`)) {
          chosenMeal = s;
          break;
        }
      }
    }

    if (!chosenMeal && /^(1|first|option\s*1)/i.test(lower) && pendingData.suggestions?.[0]) {
      chosenMeal = pendingData.suggestions[0];
    }
    if (!chosenMeal && /^(2|second|option\s*2)/i.test(lower) && pendingData.suggestions?.[1]) {
      chosenMeal = pendingData.suggestions[1];
    }
    if (!chosenMeal && /^(3|third|option\s*3)/i.test(lower) && pendingData.suggestions?.[2]) {
      chosenMeal = pendingData.suggestions[2];
    }

    if (!chosenMeal && /^(no|nah|cancel|skip|none|not\s*now)/i.test(lower)) {
      return {
        answer: "No problem! Let me know when you're ready to eat.",
        followUpChips: ['My workout today', 'How many calories left?'],
      };
    }

    if (chosenMeal) {
      try {
        const mealMessage = `I ate ${chosenMeal.name}`;
        const parsedMeal = await parseMealFromMessage(mealMessage);
        if (parsedMeal && parsedMeal.items.length > 0) {
          const { logged } = await logMealForUser(userId, parsedMeal, localDate);
          if (logged) {
            const nutritionSummary = await getTodayNutritionSummary(userId, localDate);
            const answer = formatMealLogResponse(parsedMeal, nutritionSummary);
            return { answer, followUpChips: ['How many calories left?', 'Suggest another meal', 'My nutrition summary'] };
          }
        }
      } catch (error) {
        console.error('Meal suggestion logging failed:', error);
      }
    }
  }

  const nutrition = await getTodayNutritionSummary(userId, localDate);
  const remainingCal = nutrition.calorieGoal ? Math.max(0, nutrition.calorieGoal - nutrition.totalCalories) : null;
  const remainingProtein = nutrition.proteinGoal ? Math.max(0, nutrition.proteinGoal - nutrition.totalProtein) : null;

  try {
    const context = remainingCal !== null 
      ? `Remaining today: ${remainingCal} calories, ${remainingProtein || '?'}g protein. Already consumed: ${nutrition.totalCalories} cal, ${nutrition.totalProtein}g protein, ${nutrition.totalCarbs}g carbs, ${nutrition.totalFat}g fat. Meals logged: ${nutrition.mealsLogged}.`
      : `Consumed today: ${nutrition.totalCalories} cal, ${nutrition.totalProtein}g protein. Meals logged: ${nutrition.mealsLogged}. No calorie goal set.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `You are a nutrition advisor. Based on the user's remaining macros, suggest exactly 3 meal options. Each should be realistic and common. Return ONLY a JSON array with objects: [{name: "Meal name", calories: 400, protein: 30, description: "Brief description"}]. Consider time of day and what they've already eaten. Keep it practical and varied.`
      }, {
        role: "user",
        content: `${context}\n\nUser asked: ${message}`
      }],
      max_completion_tokens: 300,
    });

    let suggestions: Array<{ name: string; calories: number; protein: number; description: string }> = [];
    try {
      const raw = response.choices[0]?.message?.content || '[]';
      suggestions = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      suggestions = [
        { name: "Grilled chicken with rice", calories: 450, protein: 35, description: "A balanced option" },
        { name: "Protein shake with banana", calories: 300, protein: 30, description: "Quick and easy" },
        { name: "Greek yogurt with nuts", calories: 250, protein: 20, description: "Light but protein-rich" },
      ];
    }

    const header = remainingCal !== null
      ? `You have **${remainingCal} calories** and **${remainingProtein || '?'}g protein** left today. Here are some ideas:`
      : `Based on what you've eaten today (${nutrition.totalCalories} cal), here are some ideas:`;

    const suggestionText = suggestions.map((s, i) => 
      `${i + 1}. **${s.name}** — ~${s.calories} cal, ${s.protein}g protein\n   ${s.description}`
    ).join('\n\n');

    const pendingMealData = { suggestions };

    return {
      answer: `${header}\n\n${suggestionText}\n\nTap one to log it, or tell me what you actually eat!\n\n<!-- PENDING_MEAL_SUGGESTION:${JSON.stringify(pendingMealData)} -->`,
      followUpChips: suggestions.map(s => `Log ${s.name}`),
    };
  } catch (error) {
    console.error('Meal suggestion failed:', error);
    return {
      answer: `You've had ${nutrition.totalCalories} calories today${remainingCal !== null ? ` with ${remainingCal} remaining` : ''}. I'd suggest something with good protein — like grilled chicken, fish, or a protein shake. Tell me what you eat and I'll log it!`,
      followUpChips: ['Log a meal', 'My nutrition summary', 'How many calories left?'],
    };
  }
}

export async function getActiveGoals(userId: number): Promise<Array<{ title: string; category: string; targetValue: number | null; currentValue: number | null; targetUnit: string | null }>> {
  const goals = await db.select({
    title: fitnessGoals.title,
    category: fitnessGoals.category,
    targetValue: fitnessGoals.targetValue,
    currentValue: fitnessGoals.currentValue,
    targetUnit: fitnessGoals.targetUnit,
  })
  .from(fitnessGoals)
  .where(and(
    eq(fitnessGoals.userId, userId),
    eq(fitnessGoals.isActive, true)
  ))
  .orderBy(desc(fitnessGoals.createdAt))
  .limit(5);
  
  return goals;
}
