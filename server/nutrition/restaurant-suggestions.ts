export type GoalType = 'lose' | 'maintain' | 'gain';

export interface RestaurantSuggestion {
  chainName: string;
  chainAliases: string[];
  suggestions: {
    lose: { item: string; reason: string; approxCalories: string };
    maintain: { item: string; reason: string; approxCalories: string };
    gain: { item: string; reason: string; approxCalories: string };
  };
  category: 'fast_food' | 'casual' | 'coffee' | 'pizza' | 'indian' | 'asian' | 'mexican' | 'healthy';
}

export const RESTAURANT_SUGGESTIONS: RestaurantSuggestion[] = [
  // US Fast Food Chains
  {
    chainName: "McDonald's",
    chainAliases: ["mcdonalds", "mcd", "mickey d"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Grilled Chicken Salad (no dressing)", reason: "High protein, low carb option that keeps you full", approxCalories: "~350" },
      maintain: { item: "McChicken with Side Salad", reason: "Balanced protein and carbs for steady energy", approxCalories: "~550" },
      gain: { item: "Double Quarter Pounder with Cheese + Fries", reason: "High calorie, protein-rich meal for muscle building", approxCalories: "~1200" }
    }
  },
  {
    chainName: "Subway",
    chainAliases: ["subway sandwiches"],
    category: "fast_food",
    suggestions: {
      lose: { item: "6\" Oven Roasted Chicken on Wheat (no cheese, mustard)", reason: "Lean protein with fiber, under 300 cal", approxCalories: "~280" },
      maintain: { item: "6\" Turkey Breast with cheese and veggies", reason: "Balanced macros with good protein", approxCalories: "~400" },
      gain: { item: "Footlong Steak & Cheese with extra meat", reason: "High protein and calories for bulking", approxCalories: "~900" }
    }
  },
  {
    chainName: "Chipotle",
    chainAliases: ["chipotle mexican grill"],
    category: "mexican",
    suggestions: {
      lose: { item: "Salad Bowl: Chicken, Fajita Veggies, Mild Salsa, Lettuce", reason: "High protein, no rice/beans keeps carbs low", approxCalories: "~400" },
      maintain: { item: "Bowl: Chicken, Brown Rice, Black Beans, Salsa, Cheese", reason: "Complete macros with fiber and protein", approxCalories: "~650" },
      gain: { item: "Burrito: Double Chicken, Rice, Beans, Cheese, Guac, Sour Cream", reason: "Calorie-dense with 60g+ protein", approxCalories: "~1200" }
    }
  },
  {
    chainName: "Chick-fil-A",
    chainAliases: ["chick fil a", "chickfila", "cfa"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Grilled Nuggets (12-count) with Side Salad", reason: "Pure protein, very low carb and fat", approxCalories: "~300" },
      maintain: { item: "Grilled Chicken Sandwich with Fruit Cup", reason: "Lean protein with healthy carbs", approxCalories: "~450" },
      gain: { item: "Spicy Deluxe Sandwich + Waffle Fries + Milkshake", reason: "High calorie combo for mass building", approxCalories: "~1400" }
    }
  },
  {
    chainName: "Taco Bell",
    chainAliases: ["tacobell"],
    category: "mexican",
    suggestions: {
      lose: { item: "Power Menu Bowl - Chicken (no sour cream, no cheese)", reason: "Protein-focused with veggies", approxCalories: "~400" },
      maintain: { item: "2 Chicken Soft Tacos + Black Beans", reason: "Moderate calories with good protein and fiber", approxCalories: "~500" },
      gain: { item: "Crunchwrap Supreme + Cheesy Gordita Crunch", reason: "Calorie-dense combo for bulking", approxCalories: "~1000" }
    }
  },
  {
    chainName: "Wendy's",
    chainAliases: ["wendys"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Grilled Chicken Wrap (no sauce)", reason: "Low cal protein option", approxCalories: "~270" },
      maintain: { item: "Jr. Bacon Cheeseburger + Apple Bites", reason: "Balanced meal with protein", approxCalories: "~450" },
      gain: { item: "Baconator + Large Fries", reason: "High protein and calories for gains", approxCalories: "~1300" }
    }
  },
  {
    chainName: "Panera Bread",
    chainAliases: ["panera"],
    category: "casual",
    suggestions: {
      lose: { item: "Mediterranean Veggie Sandwich (half) + Green Goddess Salad", reason: "Light but filling with fiber", approxCalories: "~400" },
      maintain: { item: "Turkey Avocado BLT + Apple", reason: "Balanced protein and healthy fats", approxCalories: "~600" },
      gain: { item: "Steak & White Cheddar Panini + Mac & Cheese", reason: "High calorie, high protein combo", approxCalories: "~1100" }
    }
  },
  {
    chainName: "Starbucks",
    chainAliases: ["starbucks coffee"],
    category: "coffee",
    suggestions: {
      lose: { item: "Egg White & Roasted Red Pepper Sous Vide Bites + Black Coffee", reason: "High protein, minimal calories", approxCalories: "~180" },
      maintain: { item: "Spinach Feta Wrap + Latte (non-fat milk)", reason: "Balanced breakfast with protein", approxCalories: "~400" },
      gain: { item: "Double-Smoked Bacon Sandwich + Venti Mocha", reason: "Calorie-dense breakfast for bulking", approxCalories: "~800" }
    }
  },
  {
    chainName: "Whataburger",
    chainAliases: ["whata burger", "what a burger"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Grilled Chicken Sandwich (no bun, as lettuce wrap)", reason: "Low carb, high protein option", approxCalories: "~280" },
      maintain: { item: "Whataburger Jr. with side salad", reason: "Moderate burger with veggies", approxCalories: "~450" },
      gain: { item: "Double Meat Whataburger + Large Fries", reason: "Classic bulking combo", approxCalories: "~1400" }
    }
  },
  {
    chainName: "Five Guys",
    chainAliases: ["five guys burgers", "5 guys"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Bunless Little Bacon Burger with all veggies", reason: "Skip the bun, keep the protein", approxCalories: "~400" },
      maintain: { item: "Little Hamburger with lettuce, tomato, onion", reason: "Smaller portion, balanced", approxCalories: "~550" },
      gain: { item: "Bacon Cheeseburger + Regular Fries", reason: "High calorie, high protein meal", approxCalories: "~1500" }
    }
  },
  {
    chainName: "Panda Express",
    chainAliases: ["panda", "pandaexpress"],
    category: "asian",
    suggestions: {
      lose: { item: "String Bean Chicken Breast + Super Greens", reason: "Lean protein with fiber-rich veggies", approxCalories: "~300" },
      maintain: { item: "Grilled Teriyaki Chicken + Mixed Veggies + Half Rice", reason: "Balanced Asian bowl", approxCalories: "~500" },
      gain: { item: "Orange Chicken + Beijing Beef + Fried Rice", reason: "Calorie-dense for mass", approxCalories: "~1100" }
    }
  },
  {
    chainName: "In-N-Out",
    chainAliases: ["in n out", "innout", "in-n-out burger"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Protein Style Hamburger (lettuce wrap)", reason: "No bun keeps it low carb", approxCalories: "~240" },
      maintain: { item: "Cheeseburger with onions", reason: "Classic, moderate calories", approxCalories: "~480" },
      gain: { item: "Double-Double Animal Style + Fries", reason: "Perfect bulking burger", approxCalories: "~1000" }
    }
  },
  {
    chainName: "Domino's",
    chainAliases: ["dominos pizza", "domino's pizza"],
    category: "pizza",
    suggestions: {
      lose: { item: "2 slices Thin Crust Veggie Pizza", reason: "Lower calories than regular crust", approxCalories: "~320" },
      maintain: { item: "2 slices Hand Tossed Chicken + Side Salad", reason: "Protein with balance", approxCalories: "~500" },
      gain: { item: "4 slices Meat Lover's Pizza + Breadsticks", reason: "Carb and protein loading", approxCalories: "~1200" }
    }
  },
  {
    chainName: "Pizza Hut",
    chainAliases: ["pizzahut"],
    category: "pizza",
    suggestions: {
      lose: { item: "2 slices Thin 'N Crispy Veggie Lover's", reason: "Lighter crust, veggie toppings", approxCalories: "~340" },
      maintain: { item: "2 slices Pan Supreme", reason: "Moderate pizza option", approxCalories: "~560" },
      gain: { item: "Personal Pan Meat Lover's + Wings", reason: "High calorie pizza combo", approxCalories: "~1300" }
    }
  },
  {
    chainName: "KFC",
    chainAliases: ["kentucky fried chicken"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Grilled Chicken Breast + Green Beans + Coleslaw", reason: "High protein, skip the fried", approxCalories: "~350" },
      maintain: { item: "Original Recipe Chicken Thigh + Mashed Potatoes", reason: "Classic combo, moderate portions", approxCalories: "~550" },
      gain: { item: "3-piece Original Recipe + Mac & Cheese + Biscuit", reason: "High calorie for gains", approxCalories: "~1100" }
    }
  },
  {
    chainName: "Popeyes",
    chainAliases: ["popeyes louisiana kitchen", "popeye's"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Blackened Chicken Tenders + Green Beans", reason: "Blackened = not fried, high protein", approxCalories: "~300" },
      maintain: { item: "Classic Chicken Sandwich (no mayo)", reason: "Popular sandwich, cut some fat", approxCalories: "~500" },
      gain: { item: "Spicy Chicken Sandwich + 3-piece Tenders + Fries", reason: "Calorie-dense fried combo", approxCalories: "~1400" }
    }
  },
  {
    chainName: "Chili's",
    chainAliases: ["chilis", "chili's grill"],
    category: "casual",
    suggestions: {
      lose: { item: "6oz Sirloin with Steamed Broccoli + House Salad", reason: "Lean steak with veggies", approxCalories: "~450" },
      maintain: { item: "Grilled Chicken Salad with Avocado", reason: "Balanced protein and healthy fats", approxCalories: "~600" },
      gain: { item: "Classic Bacon Burger + Loaded Mashed Potatoes", reason: "High calorie restaurant meal", approxCalories: "~1400" }
    }
  },
  {
    chainName: "Applebee's",
    chainAliases: ["applebees"],
    category: "casual",
    suggestions: {
      lose: { item: "Grilled Chicken Breast + Steamed Broccoli", reason: "Simple, clean protein meal", approxCalories: "~380" },
      maintain: { item: "Blackened Cajun Salmon with veggies", reason: "Healthy fats and protein", approxCalories: "~550" },
      gain: { item: "Riblet Platter + Loaded Fries", reason: "High calorie comfort food", approxCalories: "~1300" }
    }
  },
  // Indian Chains
  {
    chainName: "Saravana Bhavan",
    chainAliases: ["saravana bhavan", "saravanabhavan"],
    category: "indian",
    suggestions: {
      lose: { item: "Idli (4) with Sambar (no coconut chutney)", reason: "Light, steamed, high fiber breakfast", approxCalories: "~300" },
      maintain: { item: "Masala Dosa with Sambar", reason: "Complete South Indian meal", approxCalories: "~450" },
      gain: { item: "Ghee Roast Dosa + Pongal + Filter Coffee", reason: "Calorie-rich traditional combo", approxCalories: "~800" }
    }
  },
  {
    chainName: "Haldiram's",
    chainAliases: ["haldiram", "haldirams"],
    category: "indian",
    suggestions: {
      lose: { item: "Dhokla + Jaljeera", reason: "Light, steamed snack low in oil", approxCalories: "~250" },
      maintain: { item: "Chole Bhature (1 bhatura only)", reason: "Classic with portion control", approxCalories: "~500" },
      gain: { item: "Thali with Paneer Sabzi, Dal, Rice, Roti", reason: "Complete high-calorie meal", approxCalories: "~900" }
    }
  },
  {
    chainName: "Barbeque Nation",
    chainAliases: ["barbeque nation", "bbq nation"],
    category: "indian",
    suggestions: {
      lose: { item: "Grilled Chicken Tikka + Grilled Fish + Salad Bar", reason: "Focus on grilled proteins, skip starters", approxCalories: "~500" },
      maintain: { item: "Mix of Kebabs + One Roti + Dal", reason: "Balanced protein with some carbs", approxCalories: "~700" },
      gain: { item: "Full Buffet with focus on Paneer, Chicken, Biryani", reason: "High calorie buffet style", approxCalories: "~1500" }
    }
  },
  {
    chainName: "Pizza Hut India",
    chainAliases: ["pizza hut"],
    category: "pizza",
    suggestions: {
      lose: { item: "2 slices Veggie Supreme Thin Crust", reason: "Thinner crust = fewer carbs", approxCalories: "~300" },
      maintain: { item: "Personal Pan Pizza Chicken Supreme", reason: "Portion controlled with protein", approxCalories: "~550" },
      gain: { item: "Medium Meat Feast + Garlic Bread + Pepsi", reason: "Full pizza meal for bulking", approxCalories: "~1200" }
    }
  },
  {
    chainName: "Domino's India",
    chainAliases: ["dominos"],
    category: "pizza",
    suggestions: {
      lose: { item: "2 slices Classic Hand Tossed Margherita (Regular)", reason: "Simple pizza, moderate portions", approxCalories: "~320" },
      maintain: { item: "Personal Chicken Dominator", reason: "Protein-focused pizza", approxCalories: "~500" },
      gain: { item: "Medium Non-Veg Supreme + Stuffed Garlic Bread", reason: "Loaded pizza combo", approxCalories: "~1100" }
    }
  },
  {
    chainName: "McDonald's India",
    chainAliases: ["mcdonalds", "mcd"],
    category: "fast_food",
    suggestions: {
      lose: { item: "McAloo Tikki (without mayo) + Side Salad", reason: "Lower calorie veggie option", approxCalories: "~300" },
      maintain: { item: "Chicken McGrill + Corn", reason: "Grilled chicken, balanced sides", approxCalories: "~450" },
      gain: { item: "Maharaja Mac + Large Fries + McFlurry", reason: "India's biggest burger combo", approxCalories: "~1300" }
    }
  },
  {
    chainName: "Cafe Coffee Day",
    chainAliases: ["ccd", "cafe coffee day"],
    category: "coffee",
    suggestions: {
      lose: { item: "Americano + Multigrain Sandwich", reason: "Black coffee keeps it light", approxCalories: "~250" },
      maintain: { item: "Cappuccino + Paneer Tikka Sandwich", reason: "Balanced coffee snack", approxCalories: "~400" },
      gain: { item: "Frappe + Club Sandwich + Brownie", reason: "Full cafe indulgence", approxCalories: "~850" }
    }
  },
  {
    chainName: "Wow! Momo",
    chainAliases: ["wow momo", "wowmomo"],
    category: "asian",
    suggestions: {
      lose: { item: "Steamed Chicken Momos (6 pcs)", reason: "Steamed = no oil, high protein", approxCalories: "~240" },
      maintain: { item: "Steamed Paneer Momos + Momo Soup", reason: "Filling combo with protein", approxCalories: "~400" },
      gain: { item: "Fried Momos + Momo Burger + Momo Thali", reason: "Momo feast for gains", approxCalories: "~900" }
    }
  },
  {
    chainName: "Subway India",
    chainAliases: ["subway"],
    category: "fast_food",
    suggestions: {
      lose: { item: "6\" Veggie Delite on Wheat (no cheese, mustard only)", reason: "Ultra-light sub option", approxCalories: "~230" },
      maintain: { item: "6\" Tandoori Chicken on Wheat with veggies", reason: "Indian flavor with protein", approxCalories: "~380" },
      gain: { item: "Footlong Chicken Tikka with extra cheese", reason: "Double length for bulking", approxCalories: "~800" }
    }
  },
  {
    chainName: "Burger King",
    chainAliases: ["burger king", "bk"],
    category: "fast_food",
    suggestions: {
      lose: { item: "Grilled Chicken Sandwich (no mayo) + Side Salad", reason: "Lean protein choice", approxCalories: "~350" },
      maintain: { item: "Whopper Jr. with small fries", reason: "Portion-controlled classic", approxCalories: "~550" },
      gain: { item: "Double Whopper + Large Fries + Shake", reason: "Maximum calories for gains", approxCalories: "~1500" }
    }
  },
  // Healthy Chains
  {
    chainName: "Sweetgreen",
    chainAliases: ["sweet green"],
    category: "healthy",
    suggestions: {
      lose: { item: "Harvest Bowl (no dressing)", reason: "Nutrient-dense, low calorie bowl", approxCalories: "~400" },
      maintain: { item: "Chicken Pesto Parm with dressing", reason: "Balanced protein bowl", approxCalories: "~550" },
      gain: { item: "Crispy Chicken + Extra Grains + Avocado", reason: "Healthy but calorie-boosted", approxCalories: "~750" }
    }
  },
  {
    chainName: "CAVA",
    chainAliases: ["cava grill"],
    category: "healthy",
    suggestions: {
      lose: { item: "Greens + Grilled Chicken + Tzatziki + Veggies", reason: "Mediterranean protein bowl", approxCalories: "~380" },
      maintain: { item: "Grain Bowl with Braised Lamb + Hummus", reason: "Complete balanced meal", approxCalories: "~580" },
      gain: { item: "Pita + Double Protein + All Dips + Extra Falafel", reason: "Loaded Mediterranean feast", approxCalories: "~900" }
    }
  }
];

export function findRestaurantSuggestion(restaurantName: string): RestaurantSuggestion | null {
  const normalizedName = restaurantName.toLowerCase();
  
  for (const restaurant of RESTAURANT_SUGGESTIONS) {
    if (restaurant.chainName.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(restaurant.chainName.toLowerCase())) {
      return restaurant;
    }
    
    for (const alias of restaurant.chainAliases) {
      if (normalizedName.includes(alias) || alias.includes(normalizedName)) {
        return restaurant;
      }
    }
  }
  
  return null;
}

export function getSuggestionForGoal(restaurant: RestaurantSuggestion, goal: GoalType, remainingCalories: number) {
  const suggestion = restaurant.suggestions[goal];
  
  let dikaMessage = "";
  if (goal === 'lose') {
    if (remainingCalories < 400) {
      dikaMessage = `You have ${remainingCalories} cal left. Go light - ${suggestion.item} fits perfectly!`;
    } else {
      dikaMessage = `Cutting phase focus: lean protein, minimal carbs. This keeps you on track.`;
    }
  } else if (goal === 'maintain') {
    if (remainingCalories < 500) {
      dikaMessage = `${remainingCalories} cal to go. This balanced option won't push you over.`;
    } else {
      dikaMessage = `Maintenance mode: balanced macros help you stay steady.`;
    }
  } else {
    if (remainingCalories > 800) {
      dikaMessage = `Bulk mode! You need ${remainingCalories} more cal. Time to eat big.`;
    } else {
      dikaMessage = `Building muscle requires fuel. This calorie-dense option helps you grow.`;
    }
  }
  
  return {
    ...suggestion,
    dikaMessage
  };
}

export function getGeneralDikaMessage(goal: GoalType, remainingCalories: number): string {
  if (goal === 'lose') {
    if (remainingCalories < 300) {
      return `Only ${remainingCalories} calories left today. Look for grilled proteins, skip the carbs, and avoid sauces. You've got this!`;
    }
    return `Cutting phase tip: Focus on lean proteins and veggies. Skip fried foods and heavy sauces.`;
  } else if (goal === 'maintain') {
    if (remainingCalories < 400) {
      return `${remainingCalories} calories to hit your target. Pick something balanced - not too heavy, not too light.`;
    }
    return `Maintenance mode: Look for balanced meals with protein, some carbs, and healthy fats.`;
  } else {
    if (remainingCalories > 1000) {
      return `You need ${remainingCalories} more calories! Don't be shy - go for calorie-dense meals with extra protein.`;
    }
    return `Bulking tip: Prioritize protein-rich, calorie-dense options. Add extras like cheese, avocado, or sides.`;
  }
}
