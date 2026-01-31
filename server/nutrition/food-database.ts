export interface LocalFood {
  id: string;
  name: string;
  category: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const LOCAL_FOOD_DATABASE: LocalFood[] = [
  // South Indian
  { id: "dosa", name: "Dosa (Plain)", category: "South Indian", servingSize: "1 piece (100g)", calories: 133, protein: 4, carbs: 22, fat: 3 },
  { id: "masala-dosa", name: "Masala Dosa", category: "South Indian", servingSize: "1 piece (180g)", calories: 250, protein: 6, carbs: 35, fat: 10 },
  { id: "rava-dosa", name: "Rava Dosa", category: "South Indian", servingSize: "1 piece (120g)", calories: 180, protein: 4, carbs: 28, fat: 6 },
  { id: "onion-dosa", name: "Onion Dosa", category: "South Indian", servingSize: "1 piece (130g)", calories: 165, protein: 4, carbs: 25, fat: 5 },
  { id: "idli", name: "Idli", category: "South Indian", servingSize: "2 pieces (100g)", calories: 78, protein: 3, carbs: 16, fat: 0.4 },
  { id: "medu-vada", name: "Medu Vada", category: "South Indian", servingSize: "2 pieces (80g)", calories: 200, protein: 7, carbs: 20, fat: 10 },
  { id: "upma", name: "Upma", category: "South Indian", servingSize: "1 cup (200g)", calories: 245, protein: 6, carbs: 32, fat: 10 },
  { id: "pongal", name: "Pongal (Ven)", category: "South Indian", servingSize: "1 cup (200g)", calories: 280, protein: 6, carbs: 40, fat: 10 },
  { id: "uttapam", name: "Uttapam", category: "South Indian", servingSize: "1 piece (150g)", calories: 180, protein: 5, carbs: 28, fat: 5 },
  { id: "appam", name: "Appam", category: "South Indian", servingSize: "2 pieces (120g)", calories: 150, protein: 3, carbs: 30, fat: 2 },
  { id: "pesarattu", name: "Pesarattu", category: "South Indian", servingSize: "1 piece (120g)", calories: 140, protein: 6, carbs: 22, fat: 3 },
  { id: "sambar", name: "Sambar", category: "South Indian", servingSize: "1 cup (200ml)", calories: 90, protein: 4, carbs: 14, fat: 2 },
  { id: "rasam", name: "Rasam", category: "South Indian", servingSize: "1 cup (200ml)", calories: 45, protein: 2, carbs: 8, fat: 0.5 },
  { id: "coconut-chutney", name: "Coconut Chutney", category: "South Indian", servingSize: "2 tbsp (30g)", calories: 55, protein: 1, carbs: 4, fat: 4 },
  { id: "lemon-rice", name: "Lemon Rice", category: "South Indian", servingSize: "1 cup (200g)", calories: 280, protein: 5, carbs: 48, fat: 8 },
  { id: "curd-rice", name: "Curd Rice", category: "South Indian", servingSize: "1 cup (200g)", calories: 220, protein: 6, carbs: 38, fat: 5 },
  { id: "tamarind-rice", name: "Tamarind Rice (Puliyogare)", category: "South Indian", servingSize: "1 cup (200g)", calories: 290, protein: 5, carbs: 50, fat: 8 },
  
  // North Indian
  { id: "roti", name: "Roti / Chapati", category: "North Indian", servingSize: "1 piece (40g)", calories: 104, protein: 3, carbs: 18, fat: 2.5 },
  { id: "paratha", name: "Plain Paratha", category: "North Indian", servingSize: "1 piece (80g)", calories: 200, protein: 5, carbs: 30, fat: 7 },
  { id: "aloo-paratha", name: "Aloo Paratha", category: "North Indian", servingSize: "1 piece (120g)", calories: 280, protein: 6, carbs: 38, fat: 12 },
  { id: "gobi-paratha", name: "Gobi Paratha", category: "North Indian", servingSize: "1 piece (100g)", calories: 220, protein: 5, carbs: 32, fat: 8 },
  { id: "paneer-paratha", name: "Paneer Paratha", category: "North Indian", servingSize: "1 piece (120g)", calories: 300, protein: 10, carbs: 35, fat: 14 },
  { id: "naan", name: "Naan (Butter)", category: "North Indian", servingSize: "1 piece (90g)", calories: 260, protein: 7, carbs: 40, fat: 8 },
  { id: "garlic-naan", name: "Garlic Naan", category: "North Indian", servingSize: "1 piece (90g)", calories: 280, protein: 7, carbs: 42, fat: 9 },
  { id: "puri", name: "Puri", category: "North Indian", servingSize: "2 pieces (60g)", calories: 180, protein: 3, carbs: 22, fat: 9 },
  { id: "bhatura", name: "Bhatura", category: "North Indian", servingSize: "1 piece (100g)", calories: 300, protein: 6, carbs: 42, fat: 12 },
  { id: "chole", name: "Chole (Chana Masala)", category: "North Indian", servingSize: "1 cup (200g)", calories: 220, protein: 12, carbs: 32, fat: 6 },
  { id: "rajma", name: "Rajma Masala", category: "North Indian", servingSize: "1 cup (200g)", calories: 210, protein: 10, carbs: 34, fat: 4 },
  { id: "dal-fry", name: "Dal Fry", category: "North Indian", servingSize: "1 cup (200g)", calories: 180, protein: 10, carbs: 24, fat: 5 },
  { id: "dal-tadka", name: "Dal Tadka", category: "North Indian", servingSize: "1 cup (200g)", calories: 190, protein: 11, carbs: 26, fat: 5 },
  { id: "paneer-butter-masala", name: "Paneer Butter Masala", category: "North Indian", servingSize: "1 cup (200g)", calories: 380, protein: 16, carbs: 16, fat: 28 },
  { id: "palak-paneer", name: "Palak Paneer", category: "North Indian", servingSize: "1 cup (200g)", calories: 320, protein: 15, carbs: 12, fat: 24 },
  { id: "shahi-paneer", name: "Shahi Paneer", category: "North Indian", servingSize: "1 cup (200g)", calories: 400, protein: 16, carbs: 18, fat: 30 },
  { id: "matar-paneer", name: "Matar Paneer", category: "North Indian", servingSize: "1 cup (200g)", calories: 310, protein: 14, carbs: 18, fat: 22 },
  { id: "aloo-gobi", name: "Aloo Gobi", category: "North Indian", servingSize: "1 cup (200g)", calories: 160, protein: 4, carbs: 22, fat: 7 },
  { id: "bhindi-masala", name: "Bhindi Masala", category: "North Indian", servingSize: "1 cup (200g)", calories: 120, protein: 3, carbs: 14, fat: 6 },
  { id: "malai-kofta", name: "Malai Kofta", category: "North Indian", servingSize: "2 pieces with gravy", calories: 450, protein: 12, carbs: 28, fat: 32 },
  { id: "kadai-paneer", name: "Kadai Paneer", category: "North Indian", servingSize: "1 cup (200g)", calories: 350, protein: 15, carbs: 14, fat: 26 },

  // Biryani & Rice
  { id: "veg-biryani", name: "Veg Biryani", category: "Rice", servingSize: "1 plate (300g)", calories: 350, protein: 8, carbs: 55, fat: 12 },
  { id: "chicken-biryani", name: "Chicken Biryani", category: "Rice", servingSize: "1 plate (350g)", calories: 480, protein: 28, carbs: 50, fat: 18 },
  { id: "mutton-biryani", name: "Mutton Biryani", category: "Rice", servingSize: "1 plate (350g)", calories: 520, protein: 30, carbs: 48, fat: 22 },
  { id: "egg-biryani", name: "Egg Biryani", category: "Rice", servingSize: "1 plate (300g)", calories: 420, protein: 18, carbs: 52, fat: 16 },
  { id: "plain-rice", name: "Plain Rice (Steamed)", category: "Rice", servingSize: "1 cup (200g)", calories: 240, protein: 4, carbs: 52, fat: 0.5 },
  { id: "jeera-rice", name: "Jeera Rice", category: "Rice", servingSize: "1 cup (200g)", calories: 260, protein: 5, carbs: 50, fat: 4 },
  { id: "veg-pulao", name: "Veg Pulao", category: "Rice", servingSize: "1 cup (200g)", calories: 280, protein: 6, carbs: 48, fat: 8 },
  { id: "fried-rice", name: "Veg Fried Rice", category: "Rice", servingSize: "1 plate (250g)", calories: 320, protein: 8, carbs: 48, fat: 12 },
  { id: "chicken-fried-rice", name: "Chicken Fried Rice", category: "Rice", servingSize: "1 plate (280g)", calories: 400, protein: 20, carbs: 50, fat: 14 },

  // Non-Veg Curries
  { id: "butter-chicken", name: "Butter Chicken", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 440, protein: 28, carbs: 12, fat: 32 },
  { id: "chicken-curry", name: "Chicken Curry", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 350, protein: 26, carbs: 10, fat: 24 },
  { id: "chicken-tikka", name: "Chicken Tikka", category: "Non-Veg", servingSize: "6 pieces (150g)", calories: 220, protein: 30, carbs: 4, fat: 10 },
  { id: "tandoori-chicken", name: "Tandoori Chicken", category: "Non-Veg", servingSize: "1 leg piece (150g)", calories: 260, protein: 32, carbs: 4, fat: 14 },
  { id: "chicken-tikka-masala", name: "Chicken Tikka Masala", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 400, protein: 28, carbs: 14, fat: 26 },
  { id: "mutton-curry", name: "Mutton Curry", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 420, protein: 28, carbs: 10, fat: 30 },
  { id: "mutton-rogan-josh", name: "Mutton Rogan Josh", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 450, protein: 30, carbs: 8, fat: 34 },
  { id: "keema", name: "Keema (Mutton Mince)", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 380, protein: 26, carbs: 10, fat: 28 },
  { id: "fish-curry", name: "Fish Curry", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 280, protein: 24, carbs: 8, fat: 18 },
  { id: "fish-fry", name: "Fish Fry", category: "Non-Veg", servingSize: "1 piece (120g)", calories: 220, protein: 22, carbs: 8, fat: 12 },
  { id: "prawn-curry", name: "Prawn Curry", category: "Non-Veg", servingSize: "1 cup (200g)", calories: 260, protein: 22, carbs: 10, fat: 16 },
  { id: "egg-curry", name: "Egg Curry", category: "Non-Veg", servingSize: "2 eggs with gravy", calories: 280, protein: 16, carbs: 12, fat: 20 },
  { id: "boiled-egg", name: "Boiled Egg", category: "Non-Veg", servingSize: "1 large egg", calories: 78, protein: 6, carbs: 0.5, fat: 5 },
  { id: "egg-omelette", name: "Egg Omelette", category: "Non-Veg", servingSize: "2 eggs", calories: 180, protein: 12, carbs: 2, fat: 14 },
  { id: "egg-bhurji", name: "Egg Bhurji", category: "Non-Veg", servingSize: "2 eggs", calories: 200, protein: 12, carbs: 4, fat: 16 },

  // Street Food / Snacks
  { id: "samosa", name: "Samosa", category: "Snacks", servingSize: "1 piece (80g)", calories: 250, protein: 4, carbs: 28, fat: 14 },
  { id: "pakora", name: "Pakora / Bhajji", category: "Snacks", servingSize: "4 pieces (100g)", calories: 240, protein: 5, carbs: 26, fat: 13 },
  { id: "pav-bhaji", name: "Pav Bhaji", category: "Snacks", servingSize: "1 plate (2 pav)", calories: 380, protein: 10, carbs: 52, fat: 16 },
  { id: "vada-pav", name: "Vada Pav", category: "Snacks", servingSize: "1 piece", calories: 290, protein: 6, carbs: 42, fat: 11 },
  { id: "pani-puri", name: "Pani Puri / Gol Gappa", category: "Snacks", servingSize: "6 pieces", calories: 150, protein: 3, carbs: 28, fat: 4 },
  { id: "bhel-puri", name: "Bhel Puri", category: "Snacks", servingSize: "1 plate (150g)", calories: 220, protein: 5, carbs: 38, fat: 7 },
  { id: "sev-puri", name: "Sev Puri", category: "Snacks", servingSize: "4 pieces", calories: 180, protein: 4, carbs: 28, fat: 6 },
  { id: "dabeli", name: "Dabeli", category: "Snacks", servingSize: "1 piece", calories: 240, protein: 5, carbs: 36, fat: 9 },
  { id: "aloo-tikki", name: "Aloo Tikki", category: "Snacks", servingSize: "2 pieces", calories: 200, protein: 4, carbs: 30, fat: 8 },
  { id: "kachori", name: "Kachori", category: "Snacks", servingSize: "1 piece (80g)", calories: 280, protein: 5, carbs: 32, fat: 15 },
  { id: "spring-roll", name: "Veg Spring Roll", category: "Snacks", servingSize: "2 pieces", calories: 180, protein: 4, carbs: 22, fat: 9 },
  { id: "momos-veg", name: "Veg Momos (Steamed)", category: "Snacks", servingSize: "6 pieces", calories: 180, protein: 5, carbs: 28, fat: 6 },
  { id: "momos-chicken", name: "Chicken Momos (Steamed)", category: "Snacks", servingSize: "6 pieces", calories: 240, protein: 14, carbs: 26, fat: 8 },
  { id: "momos-fried", name: "Fried Momos", category: "Snacks", servingSize: "6 pieces", calories: 320, protein: 8, carbs: 32, fat: 18 },

  // Chinese / Indo-Chinese
  { id: "manchurian-dry", name: "Veg Manchurian (Dry)", category: "Chinese", servingSize: "1 cup (150g)", calories: 220, protein: 5, carbs: 28, fat: 10 },
  { id: "manchurian-gravy", name: "Veg Manchurian (Gravy)", category: "Chinese", servingSize: "1 cup (200g)", calories: 280, protein: 6, carbs: 32, fat: 14 },
  { id: "gobi-manchurian", name: "Gobi Manchurian", category: "Chinese", servingSize: "1 cup (150g)", calories: 240, protein: 5, carbs: 30, fat: 12 },
  { id: "chilli-paneer", name: "Chilli Paneer", category: "Chinese", servingSize: "1 cup (150g)", calories: 280, protein: 12, carbs: 18, fat: 18 },
  { id: "chilli-chicken", name: "Chilli Chicken", category: "Chinese", servingSize: "1 cup (180g)", calories: 320, protein: 22, carbs: 20, fat: 18 },
  { id: "noodles-veg", name: "Veg Noodles / Hakka Noodles", category: "Chinese", servingSize: "1 plate (250g)", calories: 340, protein: 8, carbs: 52, fat: 12 },
  { id: "noodles-chicken", name: "Chicken Noodles", category: "Chinese", servingSize: "1 plate (280g)", calories: 420, protein: 20, carbs: 50, fat: 16 },
  { id: "schezwan-fried-rice", name: "Schezwan Fried Rice", category: "Chinese", servingSize: "1 plate (250g)", calories: 360, protein: 8, carbs: 52, fat: 14 },
  { id: "sweet-corn-soup", name: "Sweet Corn Soup", category: "Chinese", servingSize: "1 bowl (200ml)", calories: 110, protein: 3, carbs: 18, fat: 3 },
  { id: "hot-sour-soup", name: "Hot & Sour Soup", category: "Chinese", servingSize: "1 bowl (200ml)", calories: 90, protein: 4, carbs: 12, fat: 3 },
  { id: "manchow-soup", name: "Manchow Soup", category: "Chinese", servingSize: "1 bowl (200ml)", calories: 100, protein: 3, carbs: 14, fat: 4 },

  // Beverages
  { id: "chai", name: "Tea / Chai", category: "Beverages", servingSize: "1 cup (150ml)", calories: 50, protein: 1, carbs: 8, fat: 1.5 },
  { id: "coffee", name: "Coffee (with milk)", category: "Beverages", servingSize: "1 cup (150ml)", calories: 45, protein: 2, carbs: 6, fat: 1.5 },
  { id: "filter-coffee", name: "Filter Coffee", category: "Beverages", servingSize: "1 cup (150ml)", calories: 60, protein: 2, carbs: 8, fat: 2 },
  { id: "black-coffee", name: "Black Coffee", category: "Beverages", servingSize: "1 cup (200ml)", calories: 5, protein: 0, carbs: 1, fat: 0 },
  { id: "black-tea", name: "Black Tea (no sugar)", category: "Beverages", servingSize: "1 cup (200ml)", calories: 2, protein: 0, carbs: 0.5, fat: 0 },
  { id: "lassi-sweet", name: "Sweet Lassi", category: "Beverages", servingSize: "1 glass (250ml)", calories: 180, protein: 5, carbs: 28, fat: 6 },
  { id: "lassi-salted", name: "Salted Lassi", category: "Beverages", servingSize: "1 glass (250ml)", calories: 100, protein: 5, carbs: 8, fat: 6 },
  { id: "buttermilk", name: "Buttermilk / Chaas", category: "Beverages", servingSize: "1 glass (250ml)", calories: 60, protein: 3, carbs: 6, fat: 2 },
  { id: "mango-lassi", name: "Mango Lassi", category: "Beverages", servingSize: "1 glass (300ml)", calories: 280, protein: 6, carbs: 45, fat: 8 },
  { id: "nimbu-pani", name: "Nimbu Pani / Lemonade", category: "Beverages", servingSize: "1 glass (250ml)", calories: 60, protein: 0, carbs: 16, fat: 0 },
  { id: "coconut-water", name: "Coconut Water", category: "Beverages", servingSize: "1 glass (250ml)", calories: 45, protein: 1, carbs: 10, fat: 0 },
  { id: "sugarcane-juice", name: "Sugarcane Juice", category: "Beverages", servingSize: "1 glass (250ml)", calories: 180, protein: 0, carbs: 45, fat: 0 },

  // Sweets / Desserts
  { id: "gulab-jamun", name: "Gulab Jamun", category: "Sweets", servingSize: "2 pieces", calories: 300, protein: 4, carbs: 42, fat: 14 },
  { id: "rasgulla", name: "Rasgulla", category: "Sweets", servingSize: "2 pieces", calories: 180, protein: 4, carbs: 36, fat: 2 },
  { id: "rasmalai", name: "Rasmalai", category: "Sweets", servingSize: "2 pieces", calories: 260, protein: 6, carbs: 38, fat: 10 },
  { id: "jalebi", name: "Jalebi", category: "Sweets", servingSize: "3 pieces (80g)", calories: 280, protein: 2, carbs: 48, fat: 10 },
  { id: "ladoo-besan", name: "Besan Ladoo", category: "Sweets", servingSize: "2 pieces (60g)", calories: 280, protein: 5, carbs: 30, fat: 16 },
  { id: "ladoo-motichoor", name: "Motichoor Ladoo", category: "Sweets", servingSize: "2 pieces (50g)", calories: 220, protein: 3, carbs: 32, fat: 10 },
  { id: "barfi", name: "Barfi (Kaju/Pista)", category: "Sweets", servingSize: "2 pieces (50g)", calories: 240, protein: 4, carbs: 28, fat: 14 },
  { id: "kheer", name: "Kheer / Rice Pudding", category: "Sweets", servingSize: "1 cup (150g)", calories: 220, protein: 5, carbs: 36, fat: 6 },
  { id: "halwa", name: "Halwa (Sooji/Gajar)", category: "Sweets", servingSize: "1/2 cup (100g)", calories: 280, protein: 4, carbs: 38, fat: 14 },
  { id: "payasam", name: "Payasam", category: "Sweets", servingSize: "1 cup (150ml)", calories: 250, protein: 5, carbs: 40, fat: 8 },
  { id: "kulfi", name: "Kulfi", category: "Sweets", servingSize: "1 piece (80ml)", calories: 160, protein: 3, carbs: 20, fat: 8 },
  { id: "ice-cream", name: "Ice Cream (Vanilla)", category: "Sweets", servingSize: "1 scoop (70g)", calories: 140, protein: 2, carbs: 16, fat: 8 },

  // Common Breakfast
  { id: "poha", name: "Poha", category: "Breakfast", servingSize: "1 cup (180g)", calories: 240, protein: 5, carbs: 42, fat: 6 },
  { id: "aloo-poha", name: "Aloo Poha", category: "Breakfast", servingSize: "1 cup (200g)", calories: 280, protein: 5, carbs: 48, fat: 8 },
  { id: "misal-pav", name: "Misal Pav", category: "Breakfast", servingSize: "1 plate", calories: 380, protein: 12, carbs: 52, fat: 14 },
  { id: "sabudana-khichdi", name: "Sabudana Khichdi", category: "Breakfast", servingSize: "1 cup (180g)", calories: 300, protein: 4, carbs: 52, fat: 10 },
  { id: "bread-butter", name: "Bread with Butter", category: "Breakfast", servingSize: "2 slices", calories: 200, protein: 4, carbs: 26, fat: 10 },
  { id: "bread-jam", name: "Bread with Jam", category: "Breakfast", servingSize: "2 slices", calories: 180, protein: 4, carbs: 36, fat: 2 },
  { id: "bread-omelette", name: "Bread Omelette", category: "Breakfast", servingSize: "2 eggs + 2 bread", calories: 340, protein: 16, carbs: 28, fat: 18 },
  { id: "cornflakes", name: "Cornflakes with Milk", category: "Breakfast", servingSize: "1 bowl (40g + 200ml)", calories: 250, protein: 8, carbs: 42, fat: 6 },
  { id: "muesli", name: "Muesli with Milk", category: "Breakfast", servingSize: "1 bowl (50g + 200ml)", calories: 300, protein: 10, carbs: 48, fat: 8 },
  { id: "oats-porridge", name: "Oats Porridge", category: "Breakfast", servingSize: "1 bowl (200g)", calories: 180, protein: 6, carbs: 30, fat: 4 },

  // International Basics
  { id: "pizza-slice", name: "Pizza (1 slice)", category: "International", servingSize: "1 slice (100g)", calories: 270, protein: 10, carbs: 32, fat: 12 },
  { id: "burger-veg", name: "Veg Burger", category: "International", servingSize: "1 burger", calories: 350, protein: 10, carbs: 42, fat: 16 },
  { id: "burger-chicken", name: "Chicken Burger", category: "International", servingSize: "1 burger", calories: 420, protein: 22, carbs: 40, fat: 20 },
  { id: "french-fries", name: "French Fries", category: "International", servingSize: "medium (120g)", calories: 380, protein: 4, carbs: 48, fat: 20 },
  { id: "pasta-white", name: "Pasta (White Sauce)", category: "International", servingSize: "1 plate (250g)", calories: 450, protein: 12, carbs: 52, fat: 22 },
  { id: "pasta-red", name: "Pasta (Red Sauce)", category: "International", servingSize: "1 plate (250g)", calories: 380, protein: 10, carbs: 58, fat: 14 },
  { id: "sandwich-veg", name: "Veg Sandwich", category: "International", servingSize: "1 sandwich", calories: 280, protein: 8, carbs: 36, fat: 12 },
  { id: "sandwich-grilled", name: "Grilled Cheese Sandwich", category: "International", servingSize: "1 sandwich", calories: 350, protein: 12, carbs: 32, fat: 20 },
  { id: "wrap-veg", name: "Veg Wrap", category: "International", servingSize: "1 wrap", calories: 320, protein: 10, carbs: 44, fat: 12 },
  { id: "wrap-chicken", name: "Chicken Wrap", category: "International", servingSize: "1 wrap", calories: 400, protein: 22, carbs: 42, fat: 16 },

  // Fruits
  { id: "apple", name: "Apple", category: "Fruits", servingSize: "1 medium (180g)", calories: 95, protein: 0.5, carbs: 25, fat: 0 },
  { id: "banana", name: "Banana", category: "Fruits", servingSize: "1 medium (120g)", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { id: "orange", name: "Orange", category: "Fruits", servingSize: "1 medium (130g)", calories: 62, protein: 1, carbs: 15, fat: 0 },
  { id: "mango", name: "Mango", category: "Fruits", servingSize: "1 cup (165g)", calories: 100, protein: 1, carbs: 25, fat: 0.5 },
  { id: "watermelon", name: "Watermelon", category: "Fruits", servingSize: "1 cup (150g)", calories: 46, protein: 1, carbs: 12, fat: 0 },
  { id: "grapes", name: "Grapes", category: "Fruits", servingSize: "1 cup (150g)", calories: 104, protein: 1, carbs: 27, fat: 0 },
  { id: "papaya", name: "Papaya", category: "Fruits", servingSize: "1 cup (145g)", calories: 62, protein: 1, carbs: 16, fat: 0 },
  { id: "pomegranate", name: "Pomegranate", category: "Fruits", servingSize: "1/2 cup seeds (87g)", calories: 72, protein: 1, carbs: 16, fat: 1 },
  { id: "guava", name: "Guava", category: "Fruits", servingSize: "1 medium (100g)", calories: 68, protein: 2.5, carbs: 14, fat: 1 },
  { id: "pineapple", name: "Pineapple", category: "Fruits", servingSize: "1 cup (165g)", calories: 82, protein: 1, carbs: 22, fat: 0 },

  // Dairy & Protein
  { id: "milk-full", name: "Milk (Full Fat)", category: "Dairy", servingSize: "1 glass (250ml)", calories: 150, protein: 8, carbs: 12, fat: 8 },
  { id: "milk-toned", name: "Milk (Toned)", category: "Dairy", servingSize: "1 glass (250ml)", calories: 120, protein: 8, carbs: 12, fat: 4 },
  { id: "milk-skim", name: "Milk (Skimmed)", category: "Dairy", servingSize: "1 glass (250ml)", calories: 85, protein: 8, carbs: 12, fat: 0.5 },
  { id: "curd", name: "Curd / Yogurt", category: "Dairy", servingSize: "1 cup (200g)", calories: 120, protein: 6, carbs: 8, fat: 7 },
  { id: "greek-yogurt", name: "Greek Yogurt", category: "Dairy", servingSize: "1 cup (200g)", calories: 140, protein: 14, carbs: 8, fat: 5 },
  { id: "paneer", name: "Paneer", category: "Dairy", servingSize: "100g", calories: 265, protein: 18, carbs: 3, fat: 21 },
  { id: "cheese-slice", name: "Cheese Slice", category: "Dairy", servingSize: "1 slice (20g)", calories: 70, protein: 4, carbs: 1, fat: 6 },
  { id: "whey-protein", name: "Whey Protein Shake", category: "Protein", servingSize: "1 scoop (30g)", calories: 120, protein: 24, carbs: 3, fat: 1 },
  { id: "chicken-breast", name: "Chicken Breast (Grilled)", category: "Protein", servingSize: "100g", calories: 165, protein: 31, carbs: 0, fat: 3.5 },
  { id: "chicken-thigh", name: "Chicken Thigh", category: "Protein", servingSize: "100g", calories: 209, protein: 26, carbs: 0, fat: 11 },
];

export function searchLocalFoods(query: string): LocalFood[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery || normalizedQuery.length < 2) return [];
  
  const queryWords = normalizedQuery.split(/\s+/);
  
  return LOCAL_FOOD_DATABASE.filter(food => {
    const searchText = `${food.name} ${food.category}`.toLowerCase();
    return queryWords.every(word => searchText.includes(word));
  }).slice(0, 10);
}
