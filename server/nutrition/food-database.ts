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

  // American / Fast Food
  { id: "cheeseburger", name: "Cheeseburger", category: "American", servingSize: "1 burger", calories: 540, protein: 28, carbs: 42, fat: 28 },
  { id: "double-cheeseburger", name: "Double Cheeseburger", category: "American", servingSize: "1 burger", calories: 740, protein: 42, carbs: 44, fat: 42 },
  { id: "bacon-burger", name: "Bacon Cheeseburger", category: "American", servingSize: "1 burger", calories: 620, protein: 32, carbs: 42, fat: 36 },
  { id: "burger-veg", name: "Veggie Burger", category: "American", servingSize: "1 burger", calories: 350, protein: 10, carbs: 42, fat: 16 },
  { id: "burger-chicken", name: "Crispy Chicken Sandwich", category: "American", servingSize: "1 sandwich", calories: 520, protein: 26, carbs: 52, fat: 24 },
  { id: "grilled-chicken-sandwich", name: "Grilled Chicken Sandwich", category: "American", servingSize: "1 sandwich", calories: 380, protein: 32, carbs: 38, fat: 12 },
  { id: "french-fries", name: "French Fries", category: "American", servingSize: "medium (117g)", calories: 380, protein: 4, carbs: 48, fat: 20 },
  { id: "french-fries-large", name: "French Fries (Large)", category: "American", servingSize: "large (154g)", calories: 510, protein: 6, carbs: 66, fat: 24 },
  { id: "onion-rings", name: "Onion Rings", category: "American", servingSize: "8 pieces (120g)", calories: 410, protein: 6, carbs: 42, fat: 24 },
  { id: "chicken-nuggets", name: "Chicken Nuggets", category: "American", servingSize: "6 pieces (96g)", calories: 280, protein: 14, carbs: 18, fat: 18 },
  { id: "chicken-tenders", name: "Chicken Tenders", category: "American", servingSize: "4 pieces (150g)", calories: 450, protein: 30, carbs: 28, fat: 24 },
  { id: "buffalo-wings", name: "Buffalo Wings", category: "American", servingSize: "6 pieces (160g)", calories: 480, protein: 36, carbs: 8, fat: 34 },
  { id: "hot-dog", name: "Hot Dog", category: "American", servingSize: "1 hot dog", calories: 290, protein: 10, carbs: 24, fat: 18 },
  { id: "corn-dog", name: "Corn Dog", category: "American", servingSize: "1 piece", calories: 330, protein: 10, carbs: 38, fat: 16 },
  { id: "pizza-slice", name: "Pizza Slice (Cheese)", category: "American", servingSize: "1 slice (107g)", calories: 285, protein: 12, carbs: 36, fat: 10 },
  { id: "pizza-pepperoni", name: "Pizza Slice (Pepperoni)", category: "American", servingSize: "1 slice (110g)", calories: 313, protein: 14, carbs: 34, fat: 14 },
  { id: "pizza-supreme", name: "Pizza Slice (Supreme)", category: "American", servingSize: "1 slice (130g)", calories: 340, protein: 15, carbs: 38, fat: 14 },
  { id: "mac-cheese", name: "Mac and Cheese", category: "American", servingSize: "1 cup (200g)", calories: 380, protein: 14, carbs: 42, fat: 18 },
  { id: "mashed-potatoes", name: "Mashed Potatoes", category: "American", servingSize: "1 cup (210g)", calories: 240, protein: 4, carbs: 36, fat: 10 },
  { id: "baked-potato", name: "Baked Potato (with butter)", category: "American", servingSize: "1 medium (200g)", calories: 280, protein: 6, carbs: 52, fat: 8 },
  { id: "loaded-potato", name: "Loaded Baked Potato", category: "American", servingSize: "1 potato", calories: 480, protein: 14, carbs: 54, fat: 24 },
  { id: "coleslaw", name: "Coleslaw", category: "American", servingSize: "1/2 cup (100g)", calories: 150, protein: 1, carbs: 14, fat: 10 },
  { id: "bbq-ribs", name: "BBQ Ribs", category: "American", servingSize: "4 ribs (200g)", calories: 620, protein: 38, carbs: 18, fat: 44 },
  { id: "pulled-pork", name: "Pulled Pork Sandwich", category: "American", servingSize: "1 sandwich", calories: 520, protein: 32, carbs: 42, fat: 24 },
  { id: "fried-chicken", name: "Fried Chicken (2 pieces)", category: "American", servingSize: "2 pieces (180g)", calories: 540, protein: 36, carbs: 18, fat: 36 },
  { id: "grilled-chicken", name: "Grilled Chicken Breast", category: "American", servingSize: "1 breast (150g)", calories: 248, protein: 46, carbs: 0, fat: 6 },
  { id: "steak", name: "Steak (Ribeye)", category: "American", servingSize: "8 oz (227g)", calories: 580, protein: 52, carbs: 0, fat: 42 },
  { id: "steak-sirloin", name: "Steak (Sirloin)", category: "American", servingSize: "8 oz (227g)", calories: 420, protein: 56, carbs: 0, fat: 22 },
  
  // American Breakfast
  { id: "pancakes", name: "Pancakes", category: "American Breakfast", servingSize: "3 pancakes", calories: 450, protein: 12, carbs: 68, fat: 14 },
  { id: "waffles", name: "Waffles", category: "American Breakfast", servingSize: "2 waffles", calories: 420, protein: 10, carbs: 58, fat: 16 },
  { id: "french-toast", name: "French Toast", category: "American Breakfast", servingSize: "2 slices", calories: 380, protein: 12, carbs: 44, fat: 18 },
  { id: "bacon", name: "Bacon", category: "American Breakfast", servingSize: "4 strips (32g)", calories: 172, protein: 12, carbs: 0, fat: 14 },
  { id: "sausage-links", name: "Breakfast Sausage Links", category: "American Breakfast", servingSize: "3 links (84g)", calories: 280, protein: 14, carbs: 2, fat: 24 },
  { id: "hash-browns", name: "Hash Browns", category: "American Breakfast", servingSize: "1 cup (150g)", calories: 320, protein: 4, carbs: 36, fat: 18 },
  { id: "eggs-scrambled", name: "Scrambled Eggs", category: "American Breakfast", servingSize: "2 eggs", calories: 200, protein: 14, carbs: 2, fat: 16 },
  { id: "eggs-fried", name: "Fried Eggs", category: "American Breakfast", servingSize: "2 eggs", calories: 180, protein: 12, carbs: 0, fat: 14 },
  { id: "eggs-benedict", name: "Eggs Benedict", category: "American Breakfast", servingSize: "1 serving", calories: 580, protein: 24, carbs: 32, fat: 40 },
  { id: "breakfast-burrito", name: "Breakfast Burrito", category: "American Breakfast", servingSize: "1 burrito", calories: 520, protein: 24, carbs: 48, fat: 26 },
  { id: "bagel-cream-cheese", name: "Bagel with Cream Cheese", category: "American Breakfast", servingSize: "1 bagel", calories: 380, protein: 12, carbs: 56, fat: 12 },
  { id: "donut", name: "Donut (Glazed)", category: "American Breakfast", servingSize: "1 donut", calories: 240, protein: 4, carbs: 32, fat: 12 },
  { id: "muffin", name: "Blueberry Muffin", category: "American Breakfast", servingSize: "1 muffin", calories: 380, protein: 6, carbs: 52, fat: 16 },
  
  // Sandwiches & Subs
  { id: "blt-sandwich", name: "BLT Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 420, protein: 16, carbs: 36, fat: 24 },
  { id: "club-sandwich", name: "Club Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 540, protein: 32, carbs: 42, fat: 28 },
  { id: "turkey-sandwich", name: "Turkey Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 360, protein: 24, carbs: 38, fat: 12 },
  { id: "ham-cheese-sandwich", name: "Ham & Cheese Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 420, protein: 22, carbs: 38, fat: 20 },
  { id: "tuna-sandwich", name: "Tuna Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 460, protein: 28, carbs: 36, fat: 22 },
  { id: "philly-cheesesteak", name: "Philly Cheesesteak", category: "Sandwiches", servingSize: "1 sub (300g)", calories: 680, protein: 40, carbs: 48, fat: 36 },
  { id: "meatball-sub", name: "Meatball Sub", category: "Sandwiches", servingSize: "1 sub (300g)", calories: 620, protein: 28, carbs: 54, fat: 32 },
  { id: "italian-sub", name: "Italian Sub", category: "Sandwiches", servingSize: "1 sub (300g)", calories: 580, protein: 26, carbs: 48, fat: 32 },
  { id: "grilled-cheese", name: "Grilled Cheese Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 350, protein: 12, carbs: 32, fat: 20 },
  { id: "pbj-sandwich", name: "PB&J Sandwich", category: "Sandwiches", servingSize: "1 sandwich", calories: 380, protein: 12, carbs: 52, fat: 16 },
  
  // Salads
  { id: "caesar-salad", name: "Caesar Salad", category: "Salads", servingSize: "1 bowl (250g)", calories: 320, protein: 12, carbs: 18, fat: 24 },
  { id: "caesar-chicken", name: "Caesar Salad with Grilled Chicken", category: "Salads", servingSize: "1 bowl (350g)", calories: 440, protein: 36, carbs: 18, fat: 26 },
  { id: "garden-salad", name: "Garden Salad", category: "Salads", servingSize: "1 bowl (200g)", calories: 120, protein: 4, carbs: 14, fat: 6 },
  { id: "cobb-salad", name: "Cobb Salad", category: "Salads", servingSize: "1 bowl (350g)", calories: 520, protein: 32, carbs: 12, fat: 40 },
  { id: "greek-salad", name: "Greek Salad", category: "Salads", servingSize: "1 bowl (280g)", calories: 280, protein: 8, carbs: 16, fat: 22 },
  { id: "taco-salad", name: "Taco Salad", category: "Salads", servingSize: "1 bowl (400g)", calories: 620, protein: 28, carbs: 48, fat: 36 },
  
  // Mexican
  { id: "taco-beef", name: "Beef Taco", category: "Mexican", servingSize: "1 taco", calories: 210, protein: 10, carbs: 18, fat: 12 },
  { id: "taco-chicken", name: "Chicken Taco", category: "Mexican", servingSize: "1 taco", calories: 180, protein: 14, carbs: 18, fat: 8 },
  { id: "burrito-beef", name: "Beef Burrito", category: "Mexican", servingSize: "1 burrito", calories: 580, protein: 28, carbs: 62, fat: 24 },
  { id: "burrito-chicken", name: "Chicken Burrito", category: "Mexican", servingSize: "1 burrito", calories: 520, protein: 32, carbs: 58, fat: 18 },
  { id: "burrito-bowl", name: "Burrito Bowl", category: "Mexican", servingSize: "1 bowl (450g)", calories: 680, protein: 36, carbs: 72, fat: 26 },
  { id: "quesadilla-cheese", name: "Cheese Quesadilla", category: "Mexican", servingSize: "1 quesadilla", calories: 420, protein: 16, carbs: 38, fat: 24 },
  { id: "quesadilla-chicken", name: "Chicken Quesadilla", category: "Mexican", servingSize: "1 quesadilla", calories: 520, protein: 28, carbs: 40, fat: 28 },
  { id: "nachos", name: "Nachos with Cheese", category: "Mexican", servingSize: "1 plate (250g)", calories: 580, protein: 14, carbs: 52, fat: 36 },
  { id: "nachos-loaded", name: "Loaded Nachos", category: "Mexican", servingSize: "1 plate (400g)", calories: 780, protein: 26, carbs: 68, fat: 46 },
  { id: "enchiladas", name: "Beef Enchiladas (2)", category: "Mexican", servingSize: "2 enchiladas", calories: 520, protein: 22, carbs: 42, fat: 30 },
  { id: "chips-salsa", name: "Chips & Salsa", category: "Mexican", servingSize: "10 chips + salsa", calories: 180, protein: 2, carbs: 24, fat: 8 },
  { id: "guacamole", name: "Guacamole", category: "Mexican", servingSize: "1/4 cup (60g)", calories: 110, protein: 1, carbs: 6, fat: 10 },
  
  // Pasta & Italian
  { id: "pasta-white", name: "Pasta Alfredo", category: "Italian", servingSize: "1 plate (300g)", calories: 520, protein: 18, carbs: 58, fat: 24 },
  { id: "pasta-red", name: "Pasta Marinara", category: "Italian", servingSize: "1 plate (300g)", calories: 380, protein: 12, carbs: 64, fat: 10 },
  { id: "spaghetti-meatballs", name: "Spaghetti & Meatballs", category: "Italian", servingSize: "1 plate (400g)", calories: 620, protein: 30, carbs: 68, fat: 26 },
  { id: "lasagna", name: "Lasagna", category: "Italian", servingSize: "1 piece (300g)", calories: 520, protein: 26, carbs: 42, fat: 28 },
  { id: "chicken-parmesan", name: "Chicken Parmesan", category: "Italian", servingSize: "1 serving (280g)", calories: 560, protein: 38, carbs: 36, fat: 30 },
  { id: "garlic-bread", name: "Garlic Bread", category: "Italian", servingSize: "2 slices", calories: 240, protein: 6, carbs: 28, fat: 12 },
  { id: "breadsticks", name: "Breadsticks", category: "Italian", servingSize: "2 pieces", calories: 180, protein: 4, carbs: 32, fat: 4 },
  
  // American Desserts
  { id: "apple-pie", name: "Apple Pie", category: "Desserts", servingSize: "1 slice", calories: 410, protein: 4, carbs: 58, fat: 18 },
  { id: "cheesecake", name: "Cheesecake", category: "Desserts", servingSize: "1 slice", calories: 480, protein: 8, carbs: 36, fat: 34 },
  { id: "brownie", name: "Chocolate Brownie", category: "Desserts", servingSize: "1 piece (60g)", calories: 260, protein: 3, carbs: 36, fat: 12 },
  { id: "cookie-chocolate", name: "Chocolate Chip Cookie", category: "Desserts", servingSize: "1 large cookie", calories: 220, protein: 3, carbs: 30, fat: 10 },
  { id: "milkshake", name: "Chocolate Milkshake", category: "Desserts", servingSize: "16 oz (473ml)", calories: 580, protein: 12, carbs: 78, fat: 24 },
  { id: "sundae", name: "Hot Fudge Sundae", category: "Desserts", servingSize: "1 sundae", calories: 420, protein: 8, carbs: 58, fat: 18 },
  
  // American Beverages
  { id: "soda", name: "Soda (Cola)", category: "Beverages", servingSize: "12 oz (355ml)", calories: 140, protein: 0, carbs: 39, fat: 0 },
  { id: "diet-soda", name: "Diet Soda", category: "Beverages", servingSize: "12 oz (355ml)", calories: 0, protein: 0, carbs: 0, fat: 0 },
  { id: "iced-tea", name: "Iced Tea (Sweetened)", category: "Beverages", servingSize: "16 oz (473ml)", calories: 120, protein: 0, carbs: 32, fat: 0 },
  { id: "lemonade", name: "Lemonade", category: "Beverages", servingSize: "16 oz (473ml)", calories: 180, protein: 0, carbs: 48, fat: 0 },
  { id: "orange-juice", name: "Orange Juice", category: "Beverages", servingSize: "8 oz (240ml)", calories: 112, protein: 2, carbs: 26, fat: 0 },
  { id: "smoothie-fruit", name: "Fruit Smoothie", category: "Beverages", servingSize: "16 oz (473ml)", calories: 280, protein: 4, carbs: 64, fat: 2 },
  { id: "protein-smoothie", name: "Protein Smoothie", category: "Beverages", servingSize: "16 oz (473ml)", calories: 340, protein: 28, carbs: 42, fat: 6 },
  { id: "latte", name: "Latte", category: "Beverages", servingSize: "12 oz (355ml)", calories: 180, protein: 10, carbs: 18, fat: 8 },
  { id: "cappuccino", name: "Cappuccino", category: "Beverages", servingSize: "12 oz (355ml)", calories: 120, protein: 8, carbs: 12, fat: 5 },
  { id: "americano", name: "Americano", category: "Beverages", servingSize: "12 oz (355ml)", calories: 15, protein: 1, carbs: 2, fat: 0 },
  { id: "mocha", name: "Mocha", category: "Beverages", servingSize: "12 oz (355ml)", calories: 290, protein: 10, carbs: 42, fat: 10 },
  { id: "frappuccino", name: "Frappuccino", category: "Beverages", servingSize: "16 oz (473ml)", calories: 420, protein: 6, carbs: 68, fat: 14 },

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
  
  // Protein Supplements - Indian Brands
  { id: "muscleblaze-biozyme", name: "MuscleBlaze Biozyme Whey", category: "Protein", servingSize: "1 scoop (33g)", calories: 130, protein: 25, carbs: 4, fat: 2 },
  { id: "muscleblaze-raw", name: "MuscleBlaze Raw Whey Isolate", category: "Protein", servingSize: "1 scoop (30g)", calories: 113, protein: 27, carbs: 1, fat: 0.5 },
  { id: "muscleblaze-super-gainer", name: "MuscleBlaze Super Gainer XXL", category: "Protein", servingSize: "1 scoop (75g)", calories: 290, protein: 15, carbs: 54, fat: 2 },
  { id: "muscleblaze-mass-gainer", name: "MuscleBlaze Mass Gainer PRO", category: "Protein", servingSize: "1 scoop (50g)", calories: 190, protein: 10, carbs: 35, fat: 2 },
  { id: "muscleblaze-beginner", name: "MuscleBlaze Beginner's Whey", category: "Protein", servingSize: "1 scoop (35g)", calories: 128, protein: 24, carbs: 5, fat: 1 },
  { id: "asitis-whey", name: "AS-IT-IS Whey Protein", category: "Protein", servingSize: "1 scoop (30g)", calories: 117, protein: 24, carbs: 3, fat: 1 },
  { id: "fast-up-whey", name: "Fast&Up Whey Essentials", category: "Protein", servingSize: "1 scoop (32g)", calories: 120, protein: 24, carbs: 4, fat: 1 },
  { id: "bigmuscles-premium", name: "BigMuscles Premium Gold Whey", category: "Protein", servingSize: "1 scoop (33g)", calories: 130, protein: 25, carbs: 4, fat: 2 },
  { id: "nakpro-platinum", name: "Nakpro Platinum Whey Isolate", category: "Protein", servingSize: "1 scoop (30g)", calories: 115, protein: 27, carbs: 1, fat: 0.5 },
  
  // Protein Supplements - International Brands  
  { id: "on-gold-standard", name: "Optimum Nutrition Gold Standard Whey", category: "Protein", servingSize: "1 scoop (31g)", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: "on-serious-mass", name: "Optimum Nutrition Serious Mass", category: "Protein", servingSize: "1 scoop (167g)", calories: 625, protein: 25, carbs: 125, fat: 3 },
  { id: "on-casein", name: "Optimum Nutrition Gold Standard Casein", category: "Protein", servingSize: "1 scoop (34g)", calories: 120, protein: 24, carbs: 3, fat: 1 },
  { id: "myprotein-impact", name: "MyProtein Impact Whey", category: "Protein", servingSize: "1 scoop (25g)", calories: 103, protein: 21, carbs: 1, fat: 1.9 },
  { id: "myprotein-isolate", name: "MyProtein Impact Whey Isolate", category: "Protein", servingSize: "1 scoop (25g)", calories: 93, protein: 23, carbs: 0.6, fat: 0.1 },
  { id: "dymatize-iso100", name: "Dymatize ISO100 Hydrolyzed", category: "Protein", servingSize: "1 scoop (32g)", calories: 120, protein: 25, carbs: 2, fat: 0.5 },
  { id: "dymatize-elite", name: "Dymatize Elite Whey", category: "Protein", servingSize: "1 scoop (36g)", calories: 140, protein: 25, carbs: 4, fat: 2.5 },
  { id: "bsn-syntha6", name: "BSN Syntha-6", category: "Protein", servingSize: "1 scoop (47g)", calories: 200, protein: 22, carbs: 15, fat: 6 },
  { id: "musclepharm-combat", name: "MusclePharm Combat Protein", category: "Protein", servingSize: "1 scoop (34g)", calories: 130, protein: 25, carbs: 3, fat: 1.5 },
  { id: "isopure-zero-carb", name: "Isopure Zero Carb Whey", category: "Protein", servingSize: "1 scoop (31g)", calories: 100, protein: 25, carbs: 0, fat: 0 },
  { id: "muscletech-nitrotech", name: "MuscleTech Nitro-Tech", category: "Protein", servingSize: "1 scoop (46g)", calories: 160, protein: 30, carbs: 4, fat: 2.5 },
  
  // Protein Bars
  { id: "quest-bar", name: "Quest Protein Bar", category: "Protein", servingSize: "1 bar (60g)", calories: 190, protein: 21, carbs: 21, fat: 8 },
  { id: "quest-cookie", name: "Quest Protein Cookie", category: "Protein", servingSize: "1 cookie (59g)", calories: 220, protein: 15, carbs: 20, fat: 9 },
  { id: "rxbar", name: "RXBar Protein Bar", category: "Protein", servingSize: "1 bar (52g)", calories: 210, protein: 12, carbs: 23, fat: 9 },
  { id: "one-bar", name: "ONE Protein Bar", category: "Protein", servingSize: "1 bar (60g)", calories: 220, protein: 20, carbs: 23, fat: 8 },
  { id: "muscleblaze-bar", name: "MuscleBlaze Protein Bar", category: "Protein", servingSize: "1 bar (72g)", calories: 280, protein: 20, carbs: 32, fat: 8 },
  { id: "ritebite-max", name: "RiteBite Max Protein Bar", category: "Protein", servingSize: "1 bar (70g)", calories: 248, protein: 20, carbs: 26, fat: 8 },
  { id: "yoga-bar-protein", name: "Yoga Bar Protein Bar", category: "Protein", servingSize: "1 bar (60g)", calories: 210, protein: 20, carbs: 18, fat: 7 },
  { id: "barebells-bar", name: "Barebells Protein Bar", category: "Protein", servingSize: "1 bar (55g)", calories: 198, protein: 20, carbs: 18, fat: 8 },
  { id: "grenade-carb-killa", name: "Grenade Carb Killa Bar", category: "Protein", servingSize: "1 bar (60g)", calories: 220, protein: 23, carbs: 18, fat: 9 },
  { id: "kind-protein-bar", name: "KIND Protein Bar", category: "Protein", servingSize: "1 bar (50g)", calories: 250, protein: 12, carbs: 17, fat: 17 },
  
  // Other Protein Supplements
  { id: "bcaa-powder", name: "BCAA Powder", category: "Protein", servingSize: "1 scoop (7g)", calories: 0, protein: 5, carbs: 0, fat: 0 },
  { id: "creatine-mono", name: "Creatine Monohydrate", category: "Protein", servingSize: "1 scoop (5g)", calories: 0, protein: 0, carbs: 0, fat: 0 },
  { id: "pre-workout", name: "Pre-Workout Supplement", category: "Protein", servingSize: "1 scoop (10g)", calories: 10, protein: 0, carbs: 2, fat: 0 },
  { id: "casein-protein", name: "Casein Protein Shake", category: "Protein", servingSize: "1 scoop (33g)", calories: 120, protein: 24, carbs: 3, fat: 1 },
  { id: "plant-protein", name: "Plant-Based Protein Shake", category: "Protein", servingSize: "1 scoop (30g)", calories: 120, protein: 20, carbs: 4, fat: 2 },
  { id: "pea-protein", name: "Pea Protein Isolate", category: "Protein", servingSize: "1 scoop (33g)", calories: 120, protein: 24, carbs: 1, fat: 1.5 },
  { id: "egg-white-protein", name: "Egg White Protein Powder", category: "Protein", servingSize: "1 scoop (30g)", calories: 110, protein: 25, carbs: 2, fat: 0 },
  { id: "collagen-peptides", name: "Collagen Peptides", category: "Protein", servingSize: "1 scoop (11g)", calories: 40, protein: 10, carbs: 0, fat: 0 },
  { id: "mass-gainer", name: "Mass Gainer Shake", category: "Protein", servingSize: "1 scoop (75g)", calories: 300, protein: 15, carbs: 55, fat: 3 },
  { id: "whey-isolate", name: "Whey Protein Isolate", category: "Protein", servingSize: "1 scoop (30g)", calories: 110, protein: 27, carbs: 1, fat: 0.5 },
];

// Common spelling variations / aliases for food items
const FOOD_ALIASES: Record<string, string[]> = {
  'biryani': ['briyani', 'biriyani', 'bryani', 'biriani'],
  'chicken': ['chiken', 'chikn', 'chickin'],
  'burger': ['burgar', 'buger', 'burgur'],
  'pizza': ['piza', 'pizzza'],
  'paratha': ['parantha', 'pratha', 'parota', 'porotta'],
  'dosa': ['dosai', 'thosai'],
  'samosa': ['samose', 'somosa'],
  'paneer': ['panner', 'panir'],
  'chapati': ['chapathi', 'roti'],
  'naan': ['nan', 'naaan'],
  'quesadilla': ['quesadila', 'quesedia'],
  'burrito': ['burito', 'buritto'],
  'taco': ['tako'],
  'lasagna': ['lasagne', 'lazagna'],
  'spaghetti': ['spagetti', 'sphaghetti'],
  'sandwich': ['sandwitch', 'sandwhich', 'sandwch'],
  'omelette': ['omlet', 'omelet', 'omlette'],
  'smoothie': ['smoothy', 'smoothi'],
  'cappuccino': ['capuccino', 'capuchino'],
  'frappuccino': ['frapuccino', 'frappucino'],
  'milkshake': ['milk shake', 'milkshak'],
  'fries': ['frys', 'fry'],
  'nuggets': ['nugets', 'nugits'],
  'waffles': ['wafles', 'waffle'],
  'pancakes': ['pancake', 'pankcakes'],
  'muscleblaze': ['muscle blaze', 'mb', 'muscle blazze'],
  'optimum nutrition': ['on', 'gold standard'],
  'myprotein': ['my protein', 'mp'],
  'quest': ['quest bar', 'quest cookie'],
  'dymatize': ['dymatise', 'iso 100', 'iso100'],
  'whey': ['wey', 'whay'],
  'protein': ['protien', 'protin'],
  'isolate': ['iso', 'issolate'],
  'bcaa': ['bca', 'amino'],
  'creatine': ['creataine', 'creatin'],
};

function normalizeQuery(query: string): string {
  let normalized = query.toLowerCase().trim();
  
  // Replace aliases with canonical terms
  for (const [canonical, aliases] of Object.entries(FOOD_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(alias)) {
        normalized = normalized.replace(alias, canonical);
      }
    }
  }
  
  return normalized;
}

export function searchLocalFoods(query: string): LocalFood[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];
  
  const queryWords = normalizedQuery.split(/\s+/);
  
  // First pass: exact match on all words
  const exactMatches = LOCAL_FOOD_DATABASE.filter(food => {
    const searchText = `${food.name} ${food.category}`.toLowerCase();
    return queryWords.every(word => searchText.includes(word));
  });
  
  if (exactMatches.length >= 5) {
    return exactMatches.slice(0, 15);
  }
  
  // Second pass: partial match (at least one word matches)
  const partialMatches = LOCAL_FOOD_DATABASE.filter(food => {
    const searchText = `${food.name} ${food.category}`.toLowerCase();
    return queryWords.some(word => word.length >= 3 && searchText.includes(word));
  });
  
  // Combine and deduplicate
  const combined = [...exactMatches];
  for (const item of partialMatches) {
    if (!combined.some(x => x.id === item.id)) {
      combined.push(item);
    }
  }
  
  return combined.slice(0, 15);
}
