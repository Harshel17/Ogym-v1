export interface FoodTypeInfo {
  type: string;
  countUnit: string;
  countOptions: number[];
  defaultCount: number;
  sizeOptions?: { label: string; multiplier: number }[];
  styleOptions?: string[];
  styleCalorieMultipliers?: Record<string, number>;
  followUpTemplate: string;
}

const FOOD_TYPE_MAP: Record<string, FoodTypeInfo> = {
  pizza: {
    type: "sliced",
    countUnit: "slices",
    countOptions: [1, 2, 3, 4, 6, 8],
    defaultCount: 2,
    sizeOptions: [
      { label: "Regular slice", multiplier: 1 },
      { label: "Large slice", multiplier: 1.3 },
      { label: "Half pizza", multiplier: 4 },
      { label: "Full pizza", multiplier: 8 },
    ],
    styleOptions: ["Cheese", "Pepperoni", "Veggie", "Margherita", "BBQ Chicken", "Meat Lovers", "Supreme"],
    followUpTemplate: "How many slices and what type? (e.g., 2 slices pepperoni, half cheese pizza)",
  },
  wing: {
    type: "countable",
    countUnit: "wings",
    countOptions: [4, 6, 8, 10, 12, 15, 20],
    defaultCount: 6,
    styleOptions: ["Plain/Naked", "Buffalo", "BBQ", "Honey Garlic", "Lemon Pepper", "Teriyaki", "Garlic Parmesan"],
    followUpTemplate: "How many wings and what sauce/style? (e.g., 6 buffalo, 10 BBQ)",
  },
  dosa: {
    type: "countable",
    countUnit: "dosas",
    countOptions: [1, 2, 3, 4],
    defaultCount: 1,
    styleOptions: ["Plain", "Masala", "Rava", "Onion", "Set Dosa", "Neer Dosa"],
    followUpTemplate: "How many and what type? (e.g., 2 masala dosa, 1 plain)",
  },
  idli: {
    type: "countable",
    countUnit: "idlis",
    countOptions: [1, 2, 3, 4, 6],
    defaultCount: 2,
    followUpTemplate: "How many idlis? (e.g., 2, 3, 4)",
  },
  roti: {
    type: "countable",
    countUnit: "rotis",
    countOptions: [1, 2, 3, 4, 5],
    defaultCount: 2,
    styleOptions: ["Plain Roti", "Butter Roti", "Tandoori Roti"],
    styleCalorieMultipliers: { "Plain Roti": 1.0, "Butter Roti": 1.25, "Tandoori Roti": 1.1 },
    followUpTemplate: "How many rotis? (e.g., 2 butter roti, 3 plain)",
  },
  naan: {
    type: "countable",
    countUnit: "naans",
    countOptions: [1, 2, 3],
    defaultCount: 1,
    styleOptions: ["Plain Naan", "Butter Naan", "Garlic Naan", "Cheese Naan"],
    styleCalorieMultipliers: { "Plain Naan": 1.0, "Butter Naan": 1.2, "Garlic Naan": 1.15, "Cheese Naan": 1.4 },
    followUpTemplate: "How many and what type? (e.g., 1 garlic naan, 2 butter naan)",
  },
  paratha: {
    type: "countable",
    countUnit: "parathas",
    countOptions: [1, 2, 3, 4],
    defaultCount: 2,
    styleOptions: ["Plain", "Aloo", "Gobi", "Paneer", "Egg"],
    followUpTemplate: "How many and what type? (e.g., 2 aloo paratha)",
  },
  rice: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Half bowl", multiplier: 0.5 },
      { label: "1 bowl", multiplier: 1 },
      { label: "1 plate", multiplier: 1.5 },
      { label: "Large plate", multiplier: 2 },
    ],
    styleOptions: ["Plain Rice", "Jeera Rice", "Fried Rice", "Lemon Rice", "Curd Rice"],
    followUpTemplate: "How much and what type? (e.g., 1 plate jeera rice, half bowl plain)",
  },
  biryani: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Half plate", multiplier: 0.5 },
      { label: "Full plate", multiplier: 1 },
      { label: "Large plate", multiplier: 1.5 },
    ],
    styleOptions: ["Chicken", "Mutton", "Veg", "Egg", "Paneer", "Hyderabadi"],
    followUpTemplate: "How much and what type? (e.g., full plate chicken biryani, half plate veg)",
  },
  burger: {
    type: "countable",
    countUnit: "burgers",
    countOptions: [1, 2],
    defaultCount: 1,
    styleOptions: ["Single patty", "Double patty", "Chicken", "Veggie"],
    followUpTemplate: "How many and what type? Any sides? (e.g., 1 double patty with fries)",
  },
  sandwich: {
    type: "countable",
    countUnit: "sandwiches",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "6 inch / Half", multiplier: 1 },
      { label: "Footlong / Full", multiplier: 2 },
    ],
    followUpTemplate: "What size and any extras? (e.g., footlong, 6 inch with extra cheese)",
  },
  taco: {
    type: "countable",
    countUnit: "tacos",
    countOptions: [1, 2, 3, 4],
    defaultCount: 2,
    styleOptions: ["Beef", "Chicken", "Fish", "Veggie", "Carnitas"],
    followUpTemplate: "How many and what type? (e.g., 3 chicken tacos)",
  },
  egg: {
    type: "countable",
    countUnit: "eggs",
    countOptions: [1, 2, 3, 4],
    defaultCount: 2,
    styleOptions: ["Boiled", "Scrambled", "Fried", "Omelette", "Poached"],
    styleCalorieMultipliers: { "Boiled": 0.78, "Scrambled": 1.0, "Fried": 1.17, "Omelette": 1.1, "Poached": 0.8 },
    followUpTemplate: "How many and how cooked? (e.g., 2 scrambled, 3 boiled)",
  },
  samosa: {
    type: "countable",
    countUnit: "samosas",
    countOptions: [1, 2, 3, 4],
    defaultCount: 2,
    styleOptions: ["Aloo/Potato", "Paneer", "Chicken", "Onion"],
    followUpTemplate: "How many and what type? (e.g., 2 aloo samosa)",
  },
  nugget: {
    type: "countable",
    countUnit: "nuggets",
    countOptions: [4, 6, 8, 10, 12, 20],
    defaultCount: 6,
    styleOptions: ["Plain", "Spicy"],
    followUpTemplate: "How many nuggets? (e.g., 6, 10, 20 piece)",
  },
  cookie: {
    type: "countable",
    countUnit: "cookies",
    countOptions: [1, 2, 3, 4],
    defaultCount: 1,
    followUpTemplate: "How many cookies and what type? (e.g., 2 chocolate chip)",
  },
  pancake: {
    type: "countable",
    countUnit: "pancakes",
    countOptions: [1, 2, 3, 4, 5],
    defaultCount: 2,
    followUpTemplate: "How many pancakes? Any toppings? (e.g., 3 with maple syrup)",
  },
  chapati: {
    type: "countable",
    countUnit: "chapatis",
    countOptions: [1, 2, 3, 4, 5],
    defaultCount: 2,
    followUpTemplate: "How many chapatis? (e.g., 2, 3)",
  },
  puri: {
    type: "countable",
    countUnit: "puris",
    countOptions: [2, 3, 4, 5, 6],
    defaultCount: 3,
    followUpTemplate: "How many puris? (e.g., 3, 4)",
  },
  vada: {
    type: "countable",
    countUnit: "vadas",
    countOptions: [1, 2, 3, 4],
    defaultCount: 2,
    followUpTemplate: "How many vadas? (e.g., 2 medu vada)",
  },
  dal: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Half bowl", multiplier: 0.5 },
      { label: "1 bowl", multiplier: 1 },
      { label: "1.5 bowls", multiplier: 1.5 },
    ],
    styleOptions: ["Moong", "Toor", "Masoor", "Dal Makhani", "Chana", "Dal Tadka"],
    followUpTemplate: "How much and what type? (e.g., 1 bowl dal makhani)",
  },
  curry: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Half portion", multiplier: 0.5 },
      { label: "1 bowl", multiplier: 1 },
      { label: "Large bowl", multiplier: 1.5 },
    ],
    followUpTemplate: "How much? (e.g., 1 bowl, half portion)",
  },
  pasta: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Small", multiplier: 0.75 },
      { label: "Regular", multiplier: 1 },
      { label: "Large", multiplier: 1.5 },
    ],
    styleOptions: ["Marinara", "Alfredo", "Pesto", "Carbonara", "Bolognese"],
    followUpTemplate: "What size and type? (e.g., large alfredo pasta)",
  },
  soup: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Cup", multiplier: 0.75 },
      { label: "Bowl", multiplier: 1 },
      { label: "Large bowl", multiplier: 1.5 },
    ],
    followUpTemplate: "What size? (e.g., cup or bowl)",
  },
  fries: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1],
    defaultCount: 1,
    sizeOptions: [
      { label: "Small", multiplier: 0.7 },
      { label: "Medium", multiplier: 1 },
      { label: "Large", multiplier: 1.4 },
    ],
    followUpTemplate: "What size? (e.g., small, medium, large)",
  },
  drink: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1, 2],
    defaultCount: 1,
    sizeOptions: [
      { label: "Small (12oz)", multiplier: 0.75 },
      { label: "Medium (16oz)", multiplier: 1 },
      { label: "Large (20oz)", multiplier: 1.25 },
      { label: "Venti (24oz)", multiplier: 1.5 },
    ],
    followUpTemplate: "What size? (e.g., medium, large, venti)",
  },
  smoothie: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1],
    defaultCount: 1,
    sizeOptions: [
      { label: "Small (12oz)", multiplier: 0.75 },
      { label: "Regular (16oz)", multiplier: 1 },
      { label: "Large (24oz)", multiplier: 1.5 },
    ],
    followUpTemplate: "What size? (e.g., small, regular, large)",
  },
  bowl: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1],
    defaultCount: 1,
    sizeOptions: [
      { label: "Half", multiplier: 0.5 },
      { label: "Regular", multiplier: 1 },
      { label: "Large", multiplier: 1.3 },
    ],
    followUpTemplate: "What size bowl? Any protein/toppings? (e.g., regular bowl with chicken)",
  },
  sushi: {
    type: "countable",
    countUnit: "pieces",
    countOptions: [4, 6, 8, 10, 12],
    defaultCount: 8,
    styleOptions: ["California Roll", "Salmon", "Tuna", "Shrimp Tempura", "Spicy Tuna"],
    followUpTemplate: "How many pieces and what type? (e.g., 8 pieces california roll)",
  },
  dumpling: {
    type: "countable",
    countUnit: "dumplings",
    countOptions: [4, 6, 8, 10, 12],
    defaultCount: 6,
    styleOptions: ["Steamed", "Fried", "Pan-fried"],
    followUpTemplate: "How many and steamed or fried? (e.g., 6 steamed, 8 fried)",
  },
  momo: {
    type: "countable",
    countUnit: "momos",
    countOptions: [4, 6, 8, 10],
    defaultCount: 6,
    styleOptions: ["Steamed", "Fried", "Tandoori"],
    followUpTemplate: "How many and what type? (e.g., 6 steamed chicken momos)",
  },
  chocolate: {
    type: "countable",
    countUnit: "pieces/bars",
    countOptions: [1, 2, 3, 4],
    defaultCount: 1,
    sizeOptions: [
      { label: "Fun size", multiplier: 0.4 },
      { label: "Regular bar", multiplier: 1 },
      { label: "King size", multiplier: 1.8 },
      { label: "A few squares", multiplier: 0.3 },
    ],
    styleOptions: ["Milk chocolate", "Dark chocolate", "White chocolate", "With nuts", "With caramel", "With crisp/wafer"],
    followUpTemplate: "Which chocolate? Brand and size help — e.g., Snickers regular, 2 squares of dark chocolate",
  },
  icecream: {
    type: "portioned",
    countUnit: "scoops",
    countOptions: [1, 2, 3],
    defaultCount: 1,
    sizeOptions: [
      { label: "1 scoop / small cup", multiplier: 1 },
      { label: "2 scoops / regular", multiplier: 2 },
      { label: "3 scoops / large", multiplier: 3 },
      { label: "Pint", multiplier: 4 },
    ],
    styleOptions: ["Vanilla", "Chocolate", "Strawberry", "Cookies & Cream", "Mango", "Butterscotch", "Kulfi"],
    followUpTemplate: "What flavor and how much? Brand too if you know it (e.g., 2 scoops chocolate Baskin Robbins, small vanilla cone)",
  },
  cake: {
    type: "sliced",
    countUnit: "slices",
    countOptions: [1, 2, 3],
    defaultCount: 1,
    sizeOptions: [
      { label: "Thin slice", multiplier: 0.6 },
      { label: "Regular slice", multiplier: 1 },
      { label: "Thick/large slice", multiplier: 1.5 },
    ],
    styleOptions: ["Chocolate cake", "Vanilla", "Red velvet", "Cheesecake", "Carrot cake", "Black forest", "Tres leches"],
    followUpTemplate: "What kind and how much? (e.g., 1 slice chocolate cake, 2 slices cheesecake)",
  },
  brownie: {
    type: "countable",
    countUnit: "brownies",
    countOptions: [1, 2, 3],
    defaultCount: 1,
    sizeOptions: [
      { label: "Small square", multiplier: 0.7 },
      { label: "Regular", multiplier: 1 },
      { label: "Large/bakery size", multiplier: 1.5 },
    ],
    styleOptions: ["Plain", "Walnut", "Fudge", "With ice cream"],
    followUpTemplate: "How many and what type? (e.g., 1 walnut brownie, 2 fudge brownies)",
  },
  candy: {
    type: "countable",
    countUnit: "pieces",
    countOptions: [1, 2, 3, 5, 10],
    defaultCount: 2,
    styleOptions: ["Hard candy", "Gummy", "Sour", "Caramel", "Lollipop", "Toffee"],
    followUpTemplate: "What kind and how many? Brand helps too (e.g., 3 Jolly Ranchers, a handful of gummy bears)",
  },
  chips: {
    type: "portioned",
    countUnit: "servings",
    countOptions: [1],
    defaultCount: 1,
    sizeOptions: [
      { label: "Small bag/handful", multiplier: 0.5 },
      { label: "Regular bag", multiplier: 1 },
      { label: "Large/sharing bag", multiplier: 2.5 },
    ],
    styleOptions: ["Plain/Salted", "BBQ", "Sour Cream", "Hot/Spicy", "Cheese", "Masala"],
    followUpTemplate: "What kind and how much? (e.g., regular bag of Lays classic, handful of Doritos)",
  },
  donut: {
    type: "countable",
    countUnit: "donuts",
    countOptions: [1, 2, 3, 4],
    defaultCount: 1,
    styleOptions: ["Glazed", "Chocolate", "Sprinkles", "Cream-filled", "Jelly-filled", "Plain"],
    followUpTemplate: "How many and what kind? (e.g., 2 glazed donuts, 1 chocolate from Dunkin)",
  },
  pastry: {
    type: "countable",
    countUnit: "pieces",
    countOptions: [1, 2, 3],
    defaultCount: 1,
    styleOptions: ["Croissant", "Danish", "Muffin", "Cinnamon roll", "Eclair", "Puff pastry"],
    followUpTemplate: "What kind and how many? (e.g., 1 chocolate croissant, 2 blueberry muffins)",
  },
  biscuit: {
    type: "countable",
    countUnit: "biscuits",
    countOptions: [1, 2, 3, 4, 5, 6],
    defaultCount: 2,
    styleOptions: ["Plain", "Cream-filled", "Chocolate-coated", "Digestive", "Marie", "Bourbon"],
    followUpTemplate: "How many and what brand/type? (e.g., 3 Oreos, 4 digestive biscuits)",
  },
};

const FOOD_KEYWORD_MAP: Array<{ keywords: string[]; type: string }> = [
  { keywords: ["pizza", "piza", "pizzza", "piazza", "slice", "pie"], type: "pizza" },
  { keywords: ["wing", "wings", "wigns", "buffalo wing", "chicken wing"], type: "wing" },
  { keywords: ["dosa", "dosai", "dhosa", "dossa"], type: "dosa" },
  { keywords: ["idli", "idly", "idlli"], type: "idli" },
  { keywords: ["roti", "rotis", "phulka", "rotti"], type: "roti" },
  { keywords: ["naan", "nan", "naaan"], type: "naan" },
  { keywords: ["paratha", "parantha", "pratha", "paratha", "paratta"], type: "paratha" },
  { keywords: ["biryani", "biriyani", "briyani", "biryanis", "bryani", "biryni", "biriyni"], type: "biryani" },
  { keywords: ["rice", "chawal", "chaval", "pulao", "pulav"], type: "rice" },
  { keywords: ["burger", "burgar", "burgr", "whopper", "big mac", "mcchicken", "hamburger"], type: "burger" },
  { keywords: ["sandwich", "sandwhich", "sandwitch", "sub", "hoagie", "panini"], type: "sandwich" },
  { keywords: ["taco", "tacos", "takos"], type: "taco" },
  { keywords: ["egg", "eggs", "omelette", "omelet", "omlet"], type: "egg" },
  { keywords: ["samosa", "samosas", "somosa"], type: "samosa" },
  { keywords: ["nugget", "nuggets", "nuggts", "mcnugget", "nugets"], type: "nugget" },
  { keywords: ["cookie", "cookies", "cooki"], type: "cookie" },
  { keywords: ["pancake", "pancakes", "hotcake", "pankake"], type: "pancake" },
  { keywords: ["chapati", "chapatis", "chapathi", "chappati"], type: "chapati" },
  { keywords: ["puri", "poori", "puris"], type: "puri" },
  { keywords: ["vada", "vadas", "medu vada", "vadai"], type: "vada" },
  { keywords: ["dal", "daal", "dhal", "lentil"], type: "dal" },
  { keywords: ["curry", "masala", "gravy", "korma", "tikka masala", "butter chicken", "palak paneer", "chole", "rajma"], type: "curry" },
  { keywords: ["pasta", "spaghetti", "penne", "fettuccine", "mac and cheese", "macaroni", "lasagna"], type: "pasta" },
  { keywords: ["soup", "broth", "stew", "chowder"], type: "soup" },
  { keywords: ["fries", "french fries", "curly fries"], type: "fries" },
  { keywords: ["latte", "cappuccino", "frappuccino", "frappe", "mocha", "cold brew", "iced coffee", "coffee"], type: "drink" },
  { keywords: ["smoothie", "shake", "milkshake", "protein shake"], type: "smoothie" },
  { keywords: ["bowl", "poke", "acai", "burrito bowl", "grain bowl"], type: "bowl" },
  { keywords: ["sushi", "maki", "roll", "nigiri", "sashimi"], type: "sushi" },
  { keywords: ["dumpling", "dumplings", "gyoza", "wonton", "potsticker"], type: "dumpling" },
  { keywords: ["momo", "momos"], type: "momo" },
  { keywords: ["chocolate", "chocolates", "choclate", "choclet", "snickers", "kitkat", "kit kat", "twix", "m&m", "hershey", "cadbury", "dairy milk", "ferrero", "lindt", "toblerone", "milky bar", "5 star", "five star", "perk", "munch", "silk"], type: "chocolate" },
  { keywords: ["ice cream", "icecream", "ice-cream", "gelato", "sundae", "kulfi", "cornetto", "magnum", "cone ice", "softy", "frozen yogurt", "froyo"], type: "icecream" },
  { keywords: ["cake", "cakes", "pastry cake", "cupcake", "cupcakes", "cheesecake", "red velvet", "black forest", "pound cake"], type: "cake" },
  { keywords: ["brownie", "brownies", "browny"], type: "brownie" },
  { keywords: ["candy", "candies", "gummy", "gummies", "gummy bear", "jolly rancher", "skittles", "starburst", "sour patch", "toffee", "toffees", "jelly bean"], type: "candy" },
  { keywords: ["chips", "crisps", "lays", "lay's", "doritos", "pringles", "cheetos", "kurkure", "nachos", "potato chips", "tortilla chips"], type: "chips" },
  { keywords: ["donut", "donuts", "doughnut", "doughnuts", "glazed donut", "dunkin"], type: "donut" },
  { keywords: ["croissant", "muffin", "muffins", "cinnamon roll", "danish", "eclair", "puff"], type: "pastry" },
  { keywords: ["biscuit", "biscuits", "oreo", "oreos", "bourbon", "digestive", "marie", "cream biscuit", "hide and seek", "parle-g", "parle g", "good day", "monaco"], type: "biscuit" },
];

export function detectFoodType(message: string): FoodTypeInfo | null {
  const lower = message.toLowerCase().trim();

  for (const entry of FOOD_KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
      if (regex.test(lower)) {
        return FOOD_TYPE_MAP[entry.type] || null;
      }
    }
  }
  return null;
}

export function detectFoodTypeByName(foodName: string): string | null {
  const lower = foodName.toLowerCase().trim();
  for (const entry of FOOD_KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
      if (regex.test(lower)) {
        return entry.type;
      }
    }
  }
  return null;
}

export function getFoodTypeInfo(typeName: string): FoodTypeInfo | null {
  return FOOD_TYPE_MAP[typeName] || null;
}

export function hasQuantityInMessage(message: string): boolean {
  const quantityPatterns = [
    /\b\d+\s*(?:slice|piece|wing|nugget|dosa|idli|roti|naan|paratha|chapati|puri|vada|samosa|egg|taco|cookie|pancake|momo|dumpling|brownie|donut|biscuit|bar|scoop|square)/i,
    /\b(?:half|full|quarter|one|two|three|four|five|six|seven|eight|nine|ten|dozen)\b/i,
    /\b\d+\s*(?:bowl|plate|cup|serving|portion|pc|pcs)\b/i,
    /\b(?:small|medium|large|regular|venti|grande|tall|lg|sm|med)\b/i,
  ];
  return quantityPatterns.some(p => p.test(message));
}

export function buildSmartFollowUp(foodType: FoodTypeInfo, foodName: string): string {
  const parts: string[] = [];

  if (foodType.type === "countable" || foodType.type === "sliced") {
    parts.push(`**How many ${foodType.countUnit}?** (${foodType.countOptions.join(", ")})`);
  }

  if (foodType.sizeOptions && foodType.sizeOptions.length > 0) {
    const sizeLabels = foodType.sizeOptions.map(s => s.label);
    parts.push(`**Size?** (${sizeLabels.join(" / ")})`);
  }

  if (foodType.type === "portioned" && !foodType.sizeOptions) {
    parts.push(`**How much?** (half, 1 bowl, 1 plate)`);
  }

  if (foodType.styleOptions && foodType.styleOptions.length > 0) {
    parts.push(`**Type/style?** (${foodType.styleOptions.slice(0, 5).join(", ")})`);
  }

  let result = `Before I log that, a quick question to get the calories right:\n\n`;
  result += parts.join("\n");
  result += `\n\n*Tip: More detail = more accurate calories. Answer what you can, I'll estimate the rest!*`;

  return result;
}

export function generateFollowUpChips(foodType: FoodTypeInfo): string[] {
  const chips: string[] = [];

  if (foodType.type === "countable" || foodType.type === "sliced") {
    const defaultQty = foodType.defaultCount;
    const nextQty = foodType.countOptions.find(c => c > defaultQty) || defaultQty;
    
    if (foodType.styleOptions && foodType.styleOptions.length > 0) {
      chips.push(`${defaultQty} ${foodType.styleOptions[0].toLowerCase()}`);
      chips.push(`${nextQty} ${foodType.styleOptions[1]?.toLowerCase() || foodType.styleOptions[0].toLowerCase()}`);
    } else {
      chips.push(`${defaultQty}`);
      chips.push(`${nextQty}`);
    }
  }

  if (foodType.sizeOptions && foodType.sizeOptions.length > 0) {
    chips.push(foodType.sizeOptions[1]?.label || foodType.sizeOptions[0].label);
  }

  return chips.slice(0, 3);
}

export function getServingPresetsForFood(foodName: string): {
  countUnit?: string;
  countOptions?: number[];
  defaultCount?: number;
  sizeOptions?: { label: string; multiplier: number }[];
  styleOptions?: string[];
  styleCalorieMultipliers?: Record<string, number>;
  foodType?: string;
} | null {
  const typeName = detectFoodTypeByName(foodName);
  if (!typeName) return null;
  
  const info = FOOD_TYPE_MAP[typeName];
  if (!info) return null;

  return {
    countUnit: info.countUnit,
    countOptions: info.countOptions,
    defaultCount: info.defaultCount,
    sizeOptions: info.sizeOptions,
    styleOptions: info.styleOptions,
    styleCalorieMultipliers: info.styleCalorieMultipliers,
    foodType: typeName,
  };
}
