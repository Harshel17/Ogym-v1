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
  /i (?:had|have|ate|just had|just ate|consumed|grabbed|took|drank|drink|having|got|gotten|eaten)\b/i,
  /(?:log|track|add|record|save)\s+(?:my\s+)?(?:meal|food|breakfast|lunch|dinner|snack|what i (?:had|ate))/i,
  /(?:for\s+)?(?:breakfast|lunch|dinner|snack|snak|brekfast|lnch)\s+(?:i\s+)?(?:had|ate|was)/i,
  /(?:breakfast|lunch|dinner|snack|snak|brekfast|lnch)\s*(?::|was|is)\s+/i,
  /ate\s+(?:some|a|an|the|my)\s+/i,
  /my\s+(?:breakfast|lunch|dinner|snack)\s+was\s+/i,
  /^(?!.*(?:saving|save|room|plan|ready|prepare|preparing|skip|wait))[\w\s]+\s+for\s+(?:my\s+)?(?:breakfast|lunch|dinner|snack|snak|brekfast|lnch|brunch|supper)$/i,
  /^[\w\s]+\s+(?:half|full|quarter)\s+(?:plate|bowl|cup|piece|serving|glass|scoop)\b/i,
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
    'have a question',
    'have question',
    'got a question',
    'need help',
    'help me',
  ];
  if (nonMealKeywords.some(kw => lower.includes(kw))) return false;

  return MEAL_LOG_PATTERNS.some(pattern => pattern.test(lower));
}

function guessMealType(message: string): "breakfast" | "lunch" | "dinner" | "snack" | "extra" {
  const lower = message.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('brekfast') || lower.includes('morning')) return 'breakfast';
  if (lower.includes('lunch') || lower.includes('lnch') || lower.includes('midday') || lower.includes('noon')) return 'lunch';
  if (lower.includes('dinner') || lower.includes('supper') || lower.includes('evening')) return 'dinner';
  if (lower.includes('snack') || lower.includes('snak') || lower.includes('snacking')) return 'snack';
  if (lower.includes('brunch')) return 'breakfast';

  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner';
}

const RESTAURANT_FOOD_KEYWORDS = [
  'sandwich', 'burger', 'fries', 'nuggets', 'wrap', 'sub', 'taco', 'burrito',
  'quesadilla', 'pizza', 'wings', 'tenders', 'combo', 'meal deal', 'value meal',
  'whopper', 'big mac', 'mcchicken', 'mcnuggets', 'chalupa', 'crunchwrap',
  'baconator', 'frosty', 'blizzard', 'frappe', 'frappuccino', 'latte', 'macchiato',
  'chicken sandwich', 'fish sandwich', 'cheesesteak', 'gyro', 'shawarma',
  'bowl', 'nachos', 'loaded fries', 'onion rings', 'mozzarella sticks',
  'milkshake', 'smoothie', 'iced coffee', 'cold brew',
  'paneer', 'butter chicken', 'tikka', 'masala', 'biryani', 'naan', 'tandoori',
  'dal makhani', 'chole', 'palak', 'korma', 'vindaloo', 'curry',
  'pad thai', 'fried rice', 'lo mein', 'chow mein', 'kung pao', 'orange chicken',
  'sushi', 'ramen', 'pho', 'banh mi', 'dumplings', 'dim sum', 'spring roll',
  'kebab', 'falafel', 'hummus plate', 'tikka masala', 'butter masala',
];

const KNOWN_RESTAURANTS = [
  'mcdonald', 'mcdonalds', 'burger king', 'wendy', 'wendys', 'chick-fil-a', 'chickfila',
  'subway', 'taco bell', 'chipotle', 'five guys', 'popeyes', 'kfc',
  'whataburger', 'in-n-out', 'sonic', 'jack in the box', 'arby', 'arbys',
  'panda express', 'domino', 'papa john', 'pizza hut', 'little caesars',
  'starbucks', 'dunkin', 'panera', 'chili', 'applebee', 'olive garden',
  'red lobster', 'outback', 'ihop', 'denny', 'waffle house', 'shake shack',
  'wingstop', 'buffalo wild wings', 'jersey mike', 'jimmy john', 'firehouse sub',
  'zaxby', 'raising cane', 'culver', 'sweetgreen', 'cava', 'nando',
];

export function detectRestaurantInMessage(message: string): string | null {
  const lower = message.toLowerCase();
  for (const restaurant of KNOWN_RESTAURANTS) {
    if (lower.includes(restaurant)) {
      const words = restaurant.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
      return words.join(' ');
    }
  }
  const atPattern = /(?:at|from|@)\s+([a-zA-Z][a-zA-Z'\-\s]{2,25})/i;
  const match = message.match(atPattern);
  if (match) {
    const name = match[1].trim();
    if (!['home', 'a', 'the', 'my', 'our', 'work', 'school'].includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

const GENERIC_FOOD_KEYWORDS = [
  'egg', 'eggs', 'boiled egg', 'oats', 'oatmeal', 'rice', 'chicken breast',
  'broccoli', 'banana', 'apple', 'orange', 'avocado', 'almonds', 'peanuts',
  'yogurt', 'milk', 'bread', 'toast', 'cereal', 'protein shake', 'whey',
  'salad', 'vegetables', 'veggies', 'fruit', 'berries', 'nuts', 'seeds',
  'sweet potato', 'potato', 'salmon', 'tuna', 'steak', 'ground beef',
  'pasta', 'noodles', 'soup', 'water', 'juice', 'tea', 'coffee',
  'homemade', 'home made', 'cooked at home', 'made at home',
];

export function looksLikeRestaurantFood(message: string): boolean {
  const lower = message.toLowerCase();
  if (GENERIC_FOOD_KEYWORDS.some(keyword => lower.includes(keyword))) {
    const hasRestaurantKeyword = RESTAURANT_FOOD_KEYWORDS.some(keyword => lower.includes(keyword));
    if (!hasRestaurantKeyword) return false;
  }
  return RESTAURANT_FOOD_KEYWORDS.some(keyword => lower.includes(keyword));
}

export async function parseMealFromMessage(message: string, restaurantName?: string): Promise<ParsedMeal | null> {
  try {
    const guessedMealType = guessMealType(message);
    const detectedRestaurant = restaurantName || detectRestaurantInMessage(message);

    const restaurantInstruction = detectedRestaurant
      ? `IMPORTANT: This food is from "${detectedRestaurant}". Use the EXACT official nutrition data published by ${detectedRestaurant}. Be as accurate as possible to the actual restaurant menu item.`
      : 'Estimate realistic calorie, protein, carb, and fat values per item. Use common serving sizes if not specified.';

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a nutrition data parser. Extract food items from the user's message and provide nutritional values.

RULES:
1. Extract each food item mentioned separately
2. ${restaurantInstruction}
3. Be accurate with well-known foods, estimate conservatively for unknown ones
4. Return a JSON object with the exact format below - NO markdown, NO code blocks, JUST the JSON
${detectedRestaurant ? `5. Include "${detectedRestaurant}" in the food name for clarity` : ''}

RESPONSE FORMAT (pure JSON only):
{
  "mealType": "${guessedMealType}",
  "items": [
    {
      "foodName": "Food Name${detectedRestaurant ? ` (${detectedRestaurant})` : ''}",
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
        isEstimate: true,
        sourceType: 'ai_estimated',
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

export async function parseMealFromPhoto(imageBase64: string): Promise<ParsedMeal | null> {
  try {
    const hour = new Date().getHours();
    let mealType: ParsedMeal["mealType"] = "snack";
    if (hour >= 5 && hour < 11) mealType = "breakfast";
    else if (hour >= 11 && hour < 15) mealType = "lunch";
    else if (hour >= 15 && hour < 18) mealType = "snack";
    else mealType = "dinner";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist analyzing a food photo. Identify every food item and provide accurate USDA-based nutrition data.

RULES:
1. Identify EVERY distinct food item separately
2. Estimate portion size in grams using plate size (~25cm), utensils, food-to-plate ratio
3. Use USDA FoodData Central per-100g values × estimated weight
4. Account for cooking method (grilled, fried, steamed, raw, baked)
5. Recognize international cuisines (Indian, Middle Eastern, Asian, Mexican, etc.)
6. Be specific with food names including cooking method

Return ONLY JSON:
{
  "mealType": "${mealType}",
  "items": [
    {
      "foodName": "Specific food name (cooking method)",
      "calories": 250,
      "protein": 30,
      "carbs": 5,
      "fat": 12,
      "servingSize": "1 piece (150g)",
      "servingQuantity": 1
    }
  ]
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this food photo and provide nutritional breakdown for each item." },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;

    const validMealTypes = ["breakfast", "lunch", "dinner", "snack", "extra", "protein"];
    const finalMealType = validMealTypes.includes(parsed.mealType) ? parsed.mealType : mealType;

    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
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
        calories, protein, carbs, fat,
        servingSize: String(item.servingSize || '1 serving'),
        servingQuantity: Number(item.servingQuantity) || 1,
      };
    });

    return { mealType: finalMealType as ParsedMeal["mealType"], items, totalCalories, totalProtein, totalCarbs, totalFat };
  } catch (error) {
    console.error('Failed to parse meal from photo:', error);
    return null;
  }
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

  let response = `logged your ${mealLabel.toLowerCase()}!\n\n`;

  if (nutritionSummary.calorieGoal) {
    const remaining = nutritionSummary.calorieGoal - nutritionSummary.totalCalories;
    if (remaining > 0) {
      response += `you've got **${remaining.toLocaleString()} cal** left for today — still plenty of room`;
    } else if (remaining === 0) {
      response += `you just hit your calorie target exactly — that's solid`;
    } else {
      response += `heads up, you're **${Math.abs(remaining).toLocaleString()} cal** over your target for today`;
    }
  } else {
    response += `that puts you at **${nutritionSummary.totalCalories.toLocaleString()} cal** and **${nutritionSummary.totalProtein}g protein** today`;
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
