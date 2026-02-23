export interface PortionSize {
  label: string;
  emoji: string;
  description: string;
  gramsEstimate: number;
}

export interface FoodCategory {
  name: string;
  examples: string[];
  portions: PortionSize[];
  defaultPortionIndex: number;
}

export const PORTION_CATEGORIES: FoodCategory[] = [
  {
    name: "Rice, Pasta & Grains",
    examples: ["rice", "pasta", "noodles", "oatmeal", "quinoa", "couscous", "bulgur"],
    portions: [
      { label: "Small", emoji: "🤏", description: "Cupped hand (~½ cup)", gramsEstimate: 100 },
      { label: "Medium", emoji: "✊", description: "Fist-sized (~1 cup)", gramsEstimate: 200 },
      { label: "Large", emoji: "🫲", description: "Two fists (~1.5 cups)", gramsEstimate: 300 },
      { label: "Extra Large", emoji: "🍽️", description: "Full plate (~2 cups)", gramsEstimate: 400 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Meat & Poultry",
    examples: ["chicken", "beef", "steak", "pork", "lamb", "turkey", "duck", "mutton"],
    portions: [
      { label: "Small", emoji: "🤏", description: "Deck of cards (~3 oz)", gramsEstimate: 85 },
      { label: "Medium", emoji: "🫱", description: "Palm-sized (~5 oz)", gramsEstimate: 140 },
      { label: "Large", emoji: "🥩", description: "Full palm + thickness (~7 oz)", gramsEstimate: 200 },
      { label: "Extra Large", emoji: "🍖", description: "Both palms (~10 oz)", gramsEstimate: 280 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Fish & Seafood",
    examples: ["salmon", "tuna", "fish", "shrimp", "prawns", "cod", "tilapia", "lobster", "crab"],
    portions: [
      { label: "Small", emoji: "🤏", description: "Checkbook size (~3 oz)", gramsEstimate: 85 },
      { label: "Medium", emoji: "🫱", description: "Palm-sized (~5 oz)", gramsEstimate: 140 },
      { label: "Large", emoji: "🐟", description: "Full fillet (~7 oz)", gramsEstimate: 200 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Vegetables (Cooked)",
    examples: ["broccoli", "spinach", "carrots", "beans", "peas", "corn", "cauliflower", "zucchini", "peppers"],
    portions: [
      { label: "Small", emoji: "🤏", description: "Cupped hand (~½ cup)", gramsEstimate: 80 },
      { label: "Medium", emoji: "✊", description: "Fist-sized (~1 cup)", gramsEstimate: 160 },
      { label: "Large", emoji: "🥗", description: "Two fists (~2 cups)", gramsEstimate: 300 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Vegetables (Raw/Salad)",
    examples: ["salad", "lettuce", "tomato", "cucumber", "raw vegetables", "raw veggies"],
    portions: [
      { label: "Small", emoji: "🤏", description: "Side salad (~1 cup)", gramsEstimate: 60 },
      { label: "Medium", emoji: "🥗", description: "Regular bowl (~2 cups)", gramsEstimate: 120 },
      { label: "Large", emoji: "🫙", description: "Large bowl (~3 cups)", gramsEstimate: 200 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Bread & Bakery",
    examples: ["bread", "toast", "bagel", "naan", "roti", "pita", "tortilla", "bun", "roll", "croissant", "muffin"],
    portions: [
      { label: "1 Slice/Piece", emoji: "🍞", description: "1 slice or small piece", gramsEstimate: 30 },
      { label: "2 Slices/Pieces", emoji: "🥪", description: "2 slices or medium portion", gramsEstimate: 60 },
      { label: "Large/Whole", emoji: "🫓", description: "Whole bagel, large naan, etc.", gramsEstimate: 100 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Eggs",
    examples: ["egg", "eggs", "omelette", "omelet", "scrambled eggs", "fried egg", "boiled egg"],
    portions: [
      { label: "1 Egg", emoji: "🥚", description: "1 whole egg", gramsEstimate: 50 },
      { label: "2 Eggs", emoji: "🥚🥚", description: "2 eggs", gramsEstimate: 100 },
      { label: "3 Eggs", emoji: "🍳", description: "3 eggs", gramsEstimate: 150 },
      { label: "4+ Eggs", emoji: "🍳🍳", description: "4 or more eggs", gramsEstimate: 200 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Dairy & Cheese",
    examples: ["cheese", "yogurt", "milk", "cottage cheese", "cream cheese", "paneer"],
    portions: [
      { label: "Small", emoji: "👍", description: "Thumb-sized (~1 oz)", gramsEstimate: 28 },
      { label: "Medium", emoji: "🧀", description: "2 thumbs (~2 oz)", gramsEstimate: 56 },
      { label: "Large", emoji: "🥛", description: "1 cup / large slice", gramsEstimate: 120 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Nuts & Seeds",
    examples: ["almonds", "peanuts", "cashews", "walnuts", "seeds", "peanut butter", "almond butter", "nutella"],
    portions: [
      { label: "Small", emoji: "👍", description: "1 thumb (~1 tbsp)", gramsEstimate: 15 },
      { label: "Medium", emoji: "🤲", description: "Small handful (~1 oz)", gramsEstimate: 28 },
      { label: "Large", emoji: "✊", description: "Full handful (~2 oz)", gramsEstimate: 56 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Fruits",
    examples: ["apple", "banana", "orange", "berries", "grapes", "mango", "pineapple", "watermelon", "strawberry"],
    portions: [
      { label: "Small", emoji: "🍎", description: "1 small fruit or ½ cup", gramsEstimate: 80 },
      { label: "Medium", emoji: "🍌", description: "1 medium fruit or 1 cup", gramsEstimate: 150 },
      { label: "Large", emoji: "🥭", description: "1 large fruit or 1.5 cups", gramsEstimate: 250 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Soups & Curries",
    examples: ["soup", "curry", "stew", "chili", "dal", "broth", "gravy"],
    portions: [
      { label: "Small Cup", emoji: "☕", description: "~1 cup", gramsEstimate: 240 },
      { label: "Medium Bowl", emoji: "🥣", description: "~1.5 cups", gramsEstimate: 360 },
      { label: "Large Bowl", emoji: "🍲", description: "~2 cups", gramsEstimate: 480 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Oils, Butter & Sauces",
    examples: ["oil", "butter", "ghee", "mayo", "mayonnaise", "ketchup", "sauce", "dressing"],
    portions: [
      { label: "Light", emoji: "💧", description: "1 tsp (thin coating)", gramsEstimate: 5 },
      { label: "Medium", emoji: "👍", description: "1 tbsp", gramsEstimate: 14 },
      { label: "Heavy", emoji: "🫗", description: "2 tbsp (generous)", gramsEstimate: 28 },
    ],
    defaultPortionIndex: 1,
  },
  {
    name: "Drinks",
    examples: ["juice", "soda", "smoothie", "milkshake", "protein shake", "lemonade", "tea", "coffee"],
    portions: [
      { label: "Small", emoji: "🥤", description: "Small cup (~8 oz)", gramsEstimate: 240 },
      { label: "Medium", emoji: "🥤", description: "Medium (~16 oz)", gramsEstimate: 480 },
      { label: "Large", emoji: "🥤", description: "Large (~24 oz)", gramsEstimate: 710 },
    ],
    defaultPortionIndex: 1,
  },
];

export function detectFoodCategory(foodName: string): FoodCategory | null {
  const lower = foodName.toLowerCase();
  for (const cat of PORTION_CATEGORIES) {
    if (cat.examples.some(ex => lower.includes(ex))) {
      return cat;
    }
  }
  return null;
}

export function getPortionMultiplier(category: FoodCategory, portionIndex: number): number {
  const defaultGrams = category.portions[category.defaultPortionIndex].gramsEstimate;
  const selectedGrams = category.portions[portionIndex]?.gramsEstimate || defaultGrams;
  return selectedGrams / defaultGrams;
}
