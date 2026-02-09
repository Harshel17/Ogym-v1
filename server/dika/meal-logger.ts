import OpenAI from "openai";
import { db } from "../db";
import { foodLogs, calorieGoals } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ParsedMealItem {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  servingQuantity: number;
}

export interface ParsedMeal {
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "extra" | "protein";
  items: ParsedMealItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const MEAL_LOG_PATTERNS = [
  /i (?:had|ate|just had|just ate|consumed|grabbed|took|drank|drink)\b/i,
  /(?:log|track|add|record|save)\s+(?:my\s+)?(?:meal|food|breakfast|lunch|dinner|snack|what i (?:had|ate))/i,
  /(?:for\s+)?(?:breakfast|lunch|dinner|snack)\s+(?:i\s+)?(?:had|ate|was)/i,
  /(?:breakfast|lunch|dinner|snack)\s*(?::|was|is)\s+/i,
  /ate\s+(?:some|a|an|the|my)\s+/i,
  /my\s+(?:breakfast|lunch|dinner|snack)\s+was\s+/i,
];

export function detectMealLogRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();

  if (lower.length < 8) return false;

  const nonMealKeywords = [
    'how many calories',
    'what should i eat',
    'suggest',
    'recommend',
    'what\'s good',
    'calories in',
    'how much protein',
    'meal plan',
    'diet plan',
    'what to eat',
    'should i eat',
    'can i eat',
  ];
  if (nonMealKeywords.some(kw => lower.includes(kw))) return false;

  return MEAL_LOG_PATTERNS.some(pattern => pattern.test(lower));
}

function guessMealType(message: string): "breakfast" | "lunch" | "dinner" | "snack" | "extra" {
  const lower = message.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('morning')) return 'breakfast';
  if (lower.includes('lunch') || lower.includes('midday') || lower.includes('noon')) return 'lunch';
  if (lower.includes('dinner') || lower.includes('supper') || lower.includes('evening')) return 'dinner';
  if (lower.includes('snack') || lower.includes('snacking')) return 'snack';

  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner';
}

export async function parseMealFromMessage(message: string): Promise<ParsedMeal | null> {
  try {
    const guessedMealType = guessMealType(message);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a nutrition data parser. Extract food items from the user's message and estimate nutritional values.

RULES:
1. Extract each food item mentioned separately
2. Estimate realistic calorie, protein, carb, and fat values per item
3. Use common serving sizes if not specified
4. Be accurate with well-known foods, estimate conservatively for unknown ones
5. Return a JSON object with the exact format below - NO markdown, NO code blocks, JUST the JSON

RESPONSE FORMAT (pure JSON only):
{
  "mealType": "${guessedMealType}",
  "items": [
    {
      "foodName": "Food Name",
      "calories": 200,
      "protein": 10,
      "carbs": 25,
      "fat": 8,
      "servingSize": "1 cup",
      "servingQuantity": 1
    }
  ]
}`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_completion_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const cleanedContent = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    const parsed = JSON.parse(cleanedContent);

    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;

    const validMealTypes = ["breakfast", "lunch", "dinner", "snack", "extra", "protein"];
    const mealType = validMealTypes.includes(parsed.mealType) ? parsed.mealType : guessedMealType;

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    const items: ParsedMealItem[] = parsed.items.map((item: any) => {
      const calories = Math.round(Number(item.calories) || 0);
      const protein = Math.round(Number(item.protein) || 0);
      const carbs = Math.round(Number(item.carbs) || 0);
      const fat = Math.round(Number(item.fat) || 0);

      totalCalories += calories;
      totalProtein += protein;
      totalCarbs += carbs;
      totalFat += fat;

      return {
        foodName: String(item.foodName || 'Unknown food'),
        calories,
        protein,
        carbs,
        fat,
        servingSize: String(item.servingSize || '1 serving'),
        servingQuantity: Number(item.servingQuantity) || 1,
      };
    });

    return {
      mealType: mealType as ParsedMeal["mealType"],
      items,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
    };
  } catch (error) {
    console.error('Failed to parse meal from message:', error);
    return null;
  }
}

export async function logMealForUser(userId: number, meal: ParsedMeal, localDate?: string): Promise<{ logged: boolean; logIds: number[] }> {
  const today = localDate || new Date().toISOString().split('T')[0];
  const logIds: number[] = [];

  try {
    for (const item of meal.items) {
      const [log] = await db.insert(foodLogs).values({
        userId,
        date: today,
        mealType: meal.mealType,
        foodName: item.foodName,
        servingSize: item.servingSize,
        servingQuantity: item.servingQuantity,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      }).returning({ id: foodLogs.id });

      if (log) logIds.push(log.id);
    }

    return { logged: true, logIds };
  } catch (error) {
    console.error('Failed to log meal:', error);
    return { logged: false, logIds: [] };
  }
}

export async function getTodayNutritionSummary(userId: number, localDate?: string): Promise<{
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  calorieGoal: number | null;
  proteinGoal: number | null;
  mealsLogged: number;
}> {
  const today = localDate || new Date().toISOString().split('T')[0];

  const [summary] = await db.select({
    totalCalories: sql<number>`COALESCE(SUM(${foodLogs.calories}), 0)`,
    totalProtein: sql<number>`COALESCE(SUM(${foodLogs.protein}), 0)`,
    totalCarbs: sql<number>`COALESCE(SUM(${foodLogs.carbs}), 0)`,
    totalFat: sql<number>`COALESCE(SUM(${foodLogs.fat}), 0)`,
    mealsLogged: sql<number>`COUNT(*)`,
  })
  .from(foodLogs)
  .where(and(
    eq(foodLogs.userId, userId),
    eq(foodLogs.date, today)
  ));

  const [goal] = await db.select({
    dailyCalorieTarget: calorieGoals.dailyCalorieTarget,
    dailyProteinTarget: calorieGoals.dailyProteinTarget,
  })
  .from(calorieGoals)
  .where(and(
    eq(calorieGoals.userId, userId),
    eq(calorieGoals.isActive, true)
  ))
  .limit(1);

  return {
    totalCalories: Number(summary?.totalCalories) || 0,
    totalProtein: Number(summary?.totalProtein) || 0,
    totalCarbs: Number(summary?.totalCarbs) || 0,
    totalFat: Number(summary?.totalFat) || 0,
    calorieGoal: goal?.dailyCalorieTarget || null,
    proteinGoal: goal?.dailyProteinTarget || null,
    mealsLogged: Number(summary?.mealsLogged) || 0,
  };
}

export function formatMealLogResponse(meal: ParsedMeal, nutritionSummary: {
  totalCalories: number;
  totalProtein: number;
  calorieGoal: number | null;
  proteinGoal: number | null;
}): string {
  const mealTypeLabels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    extra: 'Extra Meal',
    protein: 'Protein',
  };

  const mealLabel = mealTypeLabels[meal.mealType] || 'Meal';

  let response = `Got it! I've logged your **${mealLabel.toLowerCase()}** for you.\n\n`;

  const calorieGoalText = nutritionSummary.calorieGoal
    ? ` out of ${nutritionSummary.calorieGoal.toLocaleString()}`
    : '';
  const proteinGoalText = nutritionSummary.proteinGoal
    ? `/${nutritionSummary.proteinGoal}g`
    : 'g';

  if (nutritionSummary.calorieGoal) {
    const remaining = nutritionSummary.calorieGoal - nutritionSummary.totalCalories;
    if (remaining > 0) {
      response += `You have **${remaining.toLocaleString()} cal** remaining for today. Keep going!`;
    } else if (remaining === 0) {
      response += `You've hit your calorie target for today. Nice work!`;
    } else {
      response += `You're ${Math.abs(remaining).toLocaleString()} cal over your daily target. Maybe go easy on the next meal.`;
    }
  } else {
    response += `Today's total: **${nutritionSummary.totalCalories.toLocaleString()} cal** | **${nutritionSummary.totalProtein}g protein**. Consider setting a daily calorie goal for better tracking!`;
  }

  const mealData = JSON.stringify({
    mealType: meal.mealType,
    mealLabel,
    items: meal.items,
    totalCalories: meal.totalCalories,
    totalProtein: meal.totalProtein,
    totalCarbs: meal.totalCarbs,
    totalFat: meal.totalFat,
    dailyTotals: {
      calories: nutritionSummary.totalCalories,
      protein: nutritionSummary.totalProtein,
      calorieGoal: nutritionSummary.calorieGoal,
      proteinGoal: nutritionSummary.proteinGoal,
    }
  });

  response += `\n<!-- MEAL_LOG_DATA:${mealData} -->`;

  return response;
}
