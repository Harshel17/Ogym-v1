import OpenAI from "openai";
import { exerciseDatabase, Exercise } from "./exercise-database";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface GeneratedExercise {
  exerciseName: string;
  muscleType: string;
  bodyPart: string;
  sets: number;
  reps: number;
  restSeconds?: number;
}

export interface GeneratedDay {
  dayIndex: number;
  dayLabel: string;
  exercises: GeneratedExercise[];
}

export interface GeneratedWorkoutPlan {
  name: string;
  cycleLength: number;
  days: GeneratedDay[];
  restDays: number[];
}

export function detectWorkoutGenerationRequest(message: string): boolean {
  const patterns = [
    /create\s+(me\s+)?(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /generate\s+(me\s+)?(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /make\s+(me\s+)?(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /build\s+(me\s+)?(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /design\s+(me\s+)?(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /give\s+me\s+(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /i\s+need\s+(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /i\s+want\s+(a\s+)?(\d+[\s-]?day\s+)?workout/i,
    /suggest\s+(me\s+)?(a\s+)?workout/i,
    /recommend\s+(me\s+)?(a\s+)?workout/i,
    /set\s+up\s+(me\s+)?(a\s+)?workout/i,
    /start\s+(me\s+)?(a\s+)?workout/i,
    /plan\s+(me\s+)?(a\s+)?workout/i,
    /can\s+you\s+(create|make|build|generate|give\s+me|design)\s+(me\s+)?(a\s+)?workout/i,
    /help\s+me\s+(create|make|build|plan|start)\s+(a\s+)?workout/i,
    /workout\s+plan\s+(for|which|to|that)/i,
    /workout\s+plan$/i,
    /training\s+plan\s+(for|to|that)/i,
    /training\s+plan$/i,
    /exercise\s+(routine|plan)\s+(for|to)/i,
    /exercise\s+(routine|plan)$/i,
    /gym\s+program/i,
    /gym\s+plan/i,
    /split\s+routine/i,
    /ppl\s+(split|routine|program)/i,
    /push\s*pull\s*legs/i,
    /upper\s*[\/-]?\s*lower\s+(split|routine|program|workout)/i,
    /full\s+body\s+(routine|program|workout|split)/i,
    /bro\s+split/i,
    /abs?\s+workout/i,
    /6[\s-]?pack\s+workout/i,
    /six[\s-]?pack\s+(workout|plan|routine)/i,
    /workout\s+for\s+(abs|6[\s-]?pack|six[\s-]?pack|beginners?|weight\s+(loss|gain)|muscle|strength|bulking|cutting|toning)/i,
    /plan\s+for\s+(abs|6[\s-]?pack|six[\s-]?pack|muscle|strength|weight\s+(loss|gain)|bulking|cutting|toning|beginners?)/i,
    /workout\s+.*\s+(abs|chest|back|legs|arms|shoulders|biceps|triceps|glutes|core)/i,
    /(\d+)\s*day\s+(split|program|routine|plan|workout)/i,
    /new\s+workout\s+(plan|routine|program|cycle)/i,
    /workout\s+cycle/i,
  ];
  
  return patterns.some(pattern => pattern.test(message));
}

function getExercisesByMuscle(muscleGroup: string): Exercise[] {
  return exerciseDatabase.filter((e: Exercise) => 
    e.primaryMuscles.some((m: string) => m.toLowerCase().includes(muscleGroup.toLowerCase())) ||
    e.category.toLowerCase() === muscleGroup.toLowerCase()
  );
}

function getAvailableExerciseList(): string {
  const byCategory: Record<string, string[]> = {};
  
  exerciseDatabase.forEach((e: Exercise) => {
    if (!byCategory[e.category]) {
      byCategory[e.category] = [];
    }
    byCategory[e.category].push(e.name);
  });
  
  return Object.entries(byCategory)
    .map(([cat, exs]) => `${cat}: ${exs.join(', ')}`)
    .join('\n');
}

export async function generateWorkoutPlan(
  userMessage: string,
  userContext: {
    fitnessLevel?: string;
    goals?: string;
    equipment?: string[];
  } = {}
): Promise<{ plan: GeneratedWorkoutPlan; formattedResponse: string }> {
  
  const exerciseList = getAvailableExerciseList();
  
  const systemPrompt = `You are a professional fitness coach creating personalized workout plans.

AVAILABLE EXERCISES (use ONLY these exact names):
${exerciseList}

RULES:
1. ONLY use exercises from the list above - use exact names
2. Each workout day should have 4-6 exercises
3. Include warm-up exercises where appropriate
4. Balance muscle groups appropriately
5. Consider rest days between intense muscle group training
6. Vary rep ranges based on goals (strength: 3-6, hypertrophy: 8-12, endurance: 15-20)

USER CONTEXT:
- Fitness Level: ${userContext.fitnessLevel || 'intermediate'}
- Goals: ${userContext.goals || 'general fitness'}
- Available Equipment: ${userContext.equipment?.join(', ') || 'full gym'}

Respond with ONLY valid JSON in this exact format:
{
  "name": "Plan Name (e.g., '4-Day Muscle Building Split')",
  "cycleLength": 4,
  "restDays": [3, 6],
  "days": [
    {
      "dayIndex": 0,
      "dayLabel": "Day 1 - Push (Chest/Shoulders/Triceps)",
      "exercises": [
        {"exerciseName": "Bench Press", "muscleType": "Chest", "bodyPart": "Upper Body", "sets": 4, "reps": 8},
        {"exerciseName": "Overhead Press", "muscleType": "Shoulders", "bodyPart": "Upper Body", "sets": 3, "reps": 10}
      ]
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }
    
    const plan: GeneratedWorkoutPlan = JSON.parse(content);
    
    // Validate exercises exist in our database
    plan.days.forEach(day => {
      day.exercises = day.exercises.filter(ex => {
        const found = exerciseDatabase.find((e: Exercise) => 
          e.name.toLowerCase() === ex.exerciseName.toLowerCase() ||
          e.aliases.some((a: string) => a.toLowerCase() === ex.exerciseName.toLowerCase())
        );
        if (found) {
          ex.exerciseName = found.name;
          ex.muscleType = found.primaryMuscles[0] || ex.muscleType;
          const lowerMuscles = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'hip flexors', 'abductors', 'adductors'];
          const coreMuscles = ['abdominals', 'obliques', 'lower back', 'core'];
          const primaryLower = found.primaryMuscles[0]?.toLowerCase() || '';
          ex.bodyPart = lowerMuscles.some(m => primaryLower.includes(m)) || coreMuscles.some(m => primaryLower.includes(m)) 
            ? 'Lower Body' 
            : 'Upper Body';
        }
        return !!found;
      });
    });
    
    // Remove days with no valid exercises after filtering
    plan.days = plan.days.filter(day => day.exercises.length > 0);
    
    if (plan.days.length === 0) {
      throw new Error("No valid exercises found in generated plan");
    }
    
    // Update cycleLength to match actual days
    plan.cycleLength = plan.days.length;
    
    const formattedResponse = formatWorkoutPlanResponse(plan);
    
    return { plan, formattedResponse };
  } catch (error) {
    console.error('Workout generation error:', error);
    throw error;
  }
}

function formatWorkoutPlanResponse(plan: GeneratedWorkoutPlan): string {
  let response = `## ${plan.name}\n\n`;
  response += `**Duration:** ${plan.cycleLength} training days per cycle\n`;
  
  if (plan.restDays.length > 0) {
    response += `**Rest Days:** Day ${plan.restDays.map(d => d + 1).join(', Day ')}\n`;
  }
  response += '\n---\n\n';
  
  plan.days.forEach(day => {
    response += `### ${day.dayLabel}\n\n`;
    response += `| Exercise | Sets | Reps | Muscle |\n`;
    response += `|----------|------|------|--------|\n`;
    
    day.exercises.forEach(ex => {
      response += `| ${ex.exerciseName} | ${ex.sets} | ${ex.reps} | ${ex.muscleType} |\n`;
    });
    
    response += '\n';
  });
  
  response += '---\n\n';
  response += '**Ready to start this workout plan?** Click "Save to My Workouts" below to add it to your training schedule!\n\n';
  response += `<!-- WORKOUT_PLAN_DATA:${JSON.stringify(plan)} -->`;
  
  return response;
}

export function extractWorkoutPlanFromResponse(response: string): GeneratedWorkoutPlan | null {
  const match = response.match(/<!-- WORKOUT_PLAN_DATA:(.+?) -->/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}
