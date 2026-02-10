export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const BARCODE_DATABASE: BarcodeProduct[] = [
  // Lay's Chips
  { barcode: "0028400090858", name: "Lay's Classic Potato Chips", brand: "Lay's", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 15, fat: 10 },
  { barcode: "0028400064057", name: "Lay's Barbecue Potato Chips", brand: "Lay's", servingSize: "1 oz (28g)", calories: 150, protein: 2, carbs: 15, fat: 9 },
  { barcode: "0028400047449", name: "Lay's Sour Cream & Onion", brand: "Lay's", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 15, fat: 10 },
  { barcode: "0028400083720", name: "Lay's Salt & Vinegar", brand: "Lay's", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 15, fat: 10 },
  { barcode: "0028400049887", name: "Lay's Kettle Cooked Original", brand: "Lay's", servingSize: "1 oz (28g)", calories: 150, protein: 2, carbs: 16, fat: 8 },
  { barcode: "8901491101752", name: "Lay's Classic Salted (India)", brand: "Lay's", servingSize: "1 pack (52g)", calories: 280, protein: 3, carbs: 28, fat: 18 },
  { barcode: "8901491101745", name: "Lay's Magic Masala (India)", brand: "Lay's", servingSize: "1 pack (52g)", calories: 270, protein: 3, carbs: 28, fat: 17 },
  { barcode: "8901491101738", name: "Lay's American Style Cream & Onion (India)", brand: "Lay's", servingSize: "1 pack (52g)", calories: 275, protein: 3, carbs: 27, fat: 17 },
  { barcode: "8901491103428", name: "Lay's Chile Limon (India)", brand: "Lay's", servingSize: "1 pack (52g)", calories: 268, protein: 3, carbs: 28, fat: 16 },

  // Doritos
  { barcode: "0028400443685", name: "Doritos Nacho Cheese", brand: "Doritos", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 18, fat: 7 },
  { barcode: "0028400058872", name: "Doritos Cool Ranch", brand: "Doritos", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 18, fat: 7 },
  { barcode: "0028400362948", name: "Doritos Spicy Sweet Chili", brand: "Doritos", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 18, fat: 7 },

  // Pringles
  { barcode: "0038000138416", name: "Pringles Original", brand: "Pringles", servingSize: "1 oz (28g)", calories: 150, protein: 1, carbs: 15, fat: 9 },
  { barcode: "0038000138447", name: "Pringles Sour Cream & Onion", brand: "Pringles", servingSize: "1 oz (28g)", calories: 150, protein: 1, carbs: 15, fat: 9 },
  { barcode: "0038000138454", name: "Pringles Cheddar Cheese", brand: "Pringles", servingSize: "1 oz (28g)", calories: 150, protein: 1, carbs: 15, fat: 9 },
  { barcode: "0038000845536", name: "Pringles BBQ", brand: "Pringles", servingSize: "1 oz (28g)", calories: 150, protein: 1, carbs: 16, fat: 9 },

  // Cheetos
  { barcode: "0028400443579", name: "Cheetos Crunchy", brand: "Cheetos", servingSize: "1 oz (28g)", calories: 150, protein: 2, carbs: 13, fat: 10 },
  { barcode: "0028400443586", name: "Cheetos Puffs", brand: "Cheetos", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 13, fat: 10 },
  { barcode: "0028400443593", name: "Cheetos Flamin' Hot", brand: "Cheetos", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 15, fat: 11 },

  // Kurkure (India)
  { barcode: "8901491100977", name: "Kurkure Masala Munch", brand: "Kurkure", servingSize: "1 pack (75g)", calories: 400, protein: 5, carbs: 45, fat: 22 },
  { barcode: "8901491100960", name: "Kurkure Chilli Chatka", brand: "Kurkure", servingSize: "1 pack (75g)", calories: 395, protein: 5, carbs: 44, fat: 22 },

  // Bingo (India)
  { barcode: "8901725181116", name: "Bingo Mad Angles Achari Masti", brand: "Bingo", servingSize: "1 pack (66g)", calories: 330, protein: 4, carbs: 38, fat: 18 },
  { barcode: "8901725181123", name: "Bingo Mad Angles Tomato Madness", brand: "Bingo", servingSize: "1 pack (66g)", calories: 330, protein: 4, carbs: 38, fat: 18 },
  { barcode: "8901725133412", name: "Bingo Original Style Chilli Sprinkled", brand: "Bingo", servingSize: "1 pack (55g)", calories: 280, protein: 3, carbs: 30, fat: 16 },

  // Haldiram's (India)
  { barcode: "8904004401578", name: "Haldiram's Aloo Bhujia", brand: "Haldiram's", servingSize: "1 pack (200g)", calories: 1060, protein: 16, carbs: 100, fat: 66 },
  { barcode: "8904004402704", name: "Haldiram's Moong Dal", brand: "Haldiram's", servingSize: "1 pack (200g)", calories: 980, protein: 24, carbs: 88, fat: 58 },
  { barcode: "8904004401561", name: "Haldiram's Bhujia Sev", brand: "Haldiram's", servingSize: "1 pack (200g)", calories: 1040, protein: 14, carbs: 96, fat: 64 },
  { barcode: "8904004401486", name: "Haldiram's Navrattan Mixture", brand: "Haldiram's", servingSize: "1 pack (200g)", calories: 1000, protein: 18, carbs: 90, fat: 60 },

  // Snickers
  { barcode: "0040000424239", name: "Snickers Original Bar", brand: "Snickers", servingSize: "1 bar (52.7g)", calories: 250, protein: 4, carbs: 33, fat: 12 },
  { barcode: "0040000520429", name: "Snickers Almond Bar", brand: "Snickers", servingSize: "1 bar (49.9g)", calories: 230, protein: 4, carbs: 29, fat: 11 },

  // Kit Kat
  { barcode: "0028000515232", name: "Kit Kat Wafer Bar", brand: "Kit Kat", servingSize: "1 bar (42g)", calories: 210, protein: 3, carbs: 27, fat: 11 },
  { barcode: "0028000517700", name: "Kit Kat Big Kat", brand: "Kit Kat", servingSize: "1 bar (70g)", calories: 350, protein: 5, carbs: 45, fat: 18 },
  { barcode: "8901030790225", name: "Kit Kat (India)", brand: "Kit Kat", servingSize: "1 bar (37.3g)", calories: 195, protein: 3, carbs: 24, fat: 10 },

  // Cadbury
  { barcode: "7622210100115", name: "Cadbury Dairy Milk", brand: "Cadbury", servingSize: "1 bar (45g)", calories: 240, protein: 3, carbs: 26, fat: 14 },
  { barcode: "8901233020396", name: "Cadbury Dairy Milk (India)", brand: "Cadbury", servingSize: "1 bar (50g)", calories: 260, protein: 4, carbs: 29, fat: 15 },
  { barcode: "8901233010854", name: "Cadbury Dairy Milk Silk", brand: "Cadbury", servingSize: "1 bar (60g)", calories: 330, protein: 4, carbs: 35, fat: 19 },
  { barcode: "8901233024769", name: "Cadbury Dairy Milk Silk Bubbly", brand: "Cadbury", servingSize: "1 bar (50g)", calories: 275, protein: 4, carbs: 30, fat: 16 },
  { barcode: "8901233024646", name: "Cadbury Dairy Milk Silk Oreo", brand: "Cadbury", servingSize: "1 bar (60g)", calories: 320, protein: 4, carbs: 37, fat: 18 },
  { barcode: "8901233020327", name: "Cadbury 5 Star", brand: "Cadbury", servingSize: "1 bar (40g)", calories: 195, protein: 2, carbs: 26, fat: 9 },
  { barcode: "8901233025216", name: "Cadbury Perk", brand: "Cadbury", servingSize: "1 bar (35g)", calories: 180, protein: 2, carbs: 22, fat: 9 },
  { barcode: "8901233020280", name: "Cadbury Gems", brand: "Cadbury", servingSize: "1 pack (18g)", calories: 85, protein: 1, carbs: 12, fat: 4 },
  { barcode: "8901233020259", name: "Cadbury Bournville Dark Chocolate", brand: "Cadbury", servingSize: "1 bar (80g)", calories: 425, protein: 5, carbs: 46, fat: 25 },

  // M&M's
  { barcode: "0040000520337", name: "M&M's Milk Chocolate", brand: "M&M's", servingSize: "1 pack (47.9g)", calories: 230, protein: 2, carbs: 34, fat: 10 },
  { barcode: "0040000520344", name: "M&M's Peanut", brand: "M&M's", servingSize: "1 pack (49.3g)", calories: 250, protein: 5, carbs: 30, fat: 13 },

  // Reese's
  { barcode: "0034000401505", name: "Reese's Peanut Butter Cups", brand: "Reese's", servingSize: "1 pack (42g)", calories: 210, protein: 5, carbs: 24, fat: 12 },

  // Hershey's
  { barcode: "0034000002467", name: "Hershey's Milk Chocolate Bar", brand: "Hershey's", servingSize: "1 bar (43g)", calories: 220, protein: 3, carbs: 26, fat: 13 },
  { barcode: "0034000031023", name: "Hershey's Cookies 'n' Creme", brand: "Hershey's", servingSize: "1 bar (43g)", calories: 220, protein: 3, carbs: 25, fat: 12 },

  // Twix
  { barcode: "0040000496908", name: "Twix Caramel Cookie Bar", brand: "Twix", servingSize: "1 pack (50.7g)", calories: 250, protein: 2, carbs: 34, fat: 12 },

  // Milky Bar (India)
  { barcode: "8901030811074", name: "Milkybar White Chocolate", brand: "Nestle", servingSize: "1 bar (25g)", calories: 140, protein: 2, carbs: 15, fat: 8 },

  // Oreo
  { barcode: "0044000032159", name: "Oreo Original Cookies", brand: "Oreo", servingSize: "3 cookies (34g)", calories: 160, protein: 1, carbs: 25, fat: 7 },
  { barcode: "0044000032234", name: "Oreo Double Stuf", brand: "Oreo", servingSize: "2 cookies (29g)", calories: 140, protein: 1, carbs: 21, fat: 7 },
  { barcode: "0044000032241", name: "Oreo Golden", brand: "Oreo", servingSize: "3 cookies (34g)", calories: 160, protein: 1, carbs: 25, fat: 7 },

  // Parle-G (India)
  { barcode: "8901725133610", name: "Parle-G Biscuits", brand: "Parle", servingSize: "1 pack (80g)", calories: 380, protein: 6, carbs: 64, fat: 10 },
  { barcode: "8901725134921", name: "Parle Hide & Seek", brand: "Parle", servingSize: "1 pack (120g)", calories: 580, protein: 7, carbs: 72, fat: 28 },
  { barcode: "8901725134914", name: "Parle Monaco", brand: "Parle", servingSize: "1 pack (63g)", calories: 290, protein: 5, carbs: 42, fat: 12 },

  // Britannia (India)
  { barcode: "8901063056398", name: "Britannia Good Day Cashew", brand: "Britannia", servingSize: "1 pack (72g)", calories: 350, protein: 5, carbs: 48, fat: 15 },
  { barcode: "8901063056404", name: "Britannia Good Day Butter", brand: "Britannia", servingSize: "1 pack (72g)", calories: 355, protein: 5, carbs: 46, fat: 16 },
  { barcode: "8901063016248", name: "Britannia Marie Gold", brand: "Britannia", servingSize: "1 pack (83g)", calories: 375, protein: 6, carbs: 64, fat: 10 },
  { barcode: "8901063120037", name: "Britannia 50-50", brand: "Britannia", servingSize: "1 pack (62g)", calories: 290, protein: 5, carbs: 40, fat: 12 },
  { barcode: "8901063170414", name: "Britannia Jim Jam", brand: "Britannia", servingSize: "1 pack (100g)", calories: 450, protein: 5, carbs: 68, fat: 18 },
  { barcode: "8901063080058", name: "Britannia Bourbon", brand: "Britannia", servingSize: "1 pack (100g)", calories: 480, protein: 5, carbs: 70, fat: 20 },

  // Coca-Cola
  { barcode: "0049000028904", name: "Coca-Cola Classic", brand: "Coca-Cola", servingSize: "1 can (355ml)", calories: 140, protein: 0, carbs: 39, fat: 0 },
  { barcode: "0049000042566", name: "Coca-Cola Zero Sugar", brand: "Coca-Cola", servingSize: "1 can (355ml)", calories: 0, protein: 0, carbs: 0, fat: 0 },
  { barcode: "0049000050103", name: "Diet Coke", brand: "Coca-Cola", servingSize: "1 can (355ml)", calories: 0, protein: 0, carbs: 0, fat: 0 },
  { barcode: "8901764010083", name: "Coca-Cola (India)", brand: "Coca-Cola", servingSize: "1 can (300ml)", calories: 128, protein: 0, carbs: 33, fat: 0 },
  { barcode: "8901764010076", name: "Thums Up (India)", brand: "Coca-Cola", servingSize: "1 bottle (300ml)", calories: 128, protein: 0, carbs: 33, fat: 0 },

  // Pepsi
  { barcode: "0012000001253", name: "Pepsi Cola", brand: "Pepsi", servingSize: "1 can (355ml)", calories: 150, protein: 0, carbs: 41, fat: 0 },
  { barcode: "0012000100079", name: "Pepsi Zero Sugar", brand: "Pepsi", servingSize: "1 can (355ml)", calories: 0, protein: 0, carbs: 0, fat: 0 },
  { barcode: "0012000001086", name: "Mountain Dew", brand: "PepsiCo", servingSize: "1 can (355ml)", calories: 170, protein: 0, carbs: 46, fat: 0 },
  { barcode: "8901588001594", name: "Pepsi (India)", brand: "Pepsi", servingSize: "1 bottle (300ml)", calories: 132, protein: 0, carbs: 34, fat: 0 },

  // Sprite / Fanta
  { barcode: "0049000005714", name: "Sprite", brand: "Coca-Cola", servingSize: "1 can (355ml)", calories: 140, protein: 0, carbs: 38, fat: 0 },
  { barcode: "0049000031652", name: "Fanta Orange", brand: "Coca-Cola", servingSize: "1 can (355ml)", calories: 160, protein: 0, carbs: 44, fat: 0 },
  { barcode: "8901764011332", name: "Sprite (India)", brand: "Coca-Cola", servingSize: "1 bottle (300ml)", calories: 120, protein: 0, carbs: 31, fat: 0 },
  { barcode: "8901764012285", name: "Fanta Orange (India)", brand: "Coca-Cola", servingSize: "1 bottle (300ml)", calories: 138, protein: 0, carbs: 36, fat: 0 },
  { barcode: "8901764013206", name: "Limca (India)", brand: "Coca-Cola", servingSize: "1 bottle (300ml)", calories: 120, protein: 0, carbs: 31, fat: 0 },
  { barcode: "8901588002119", name: "7UP (India)", brand: "PepsiCo", servingSize: "1 bottle (300ml)", calories: 116, protein: 0, carbs: 30, fat: 0 },
  { barcode: "8901588002225", name: "Mirinda Orange (India)", brand: "PepsiCo", servingSize: "1 bottle (300ml)", calories: 140, protein: 0, carbs: 36, fat: 0 },

  // Red Bull / Monster
  { barcode: "0611269991000", name: "Red Bull Energy Drink", brand: "Red Bull", servingSize: "1 can (250ml)", calories: 110, protein: 0, carbs: 28, fat: 0 },
  { barcode: "0611269991017", name: "Red Bull Sugar Free", brand: "Red Bull", servingSize: "1 can (250ml)", calories: 5, protein: 0, carbs: 0, fat: 0 },
  { barcode: "0070847811169", name: "Monster Energy Original", brand: "Monster", servingSize: "1 can (473ml)", calories: 210, protein: 0, carbs: 54, fat: 0 },
  { barcode: "0070847010890", name: "Monster Energy Zero Ultra", brand: "Monster", servingSize: "1 can (473ml)", calories: 0, protein: 0, carbs: 0, fat: 0 },

  // Protein Bars
  { barcode: "0722252100207", name: "Quest Bar Chocolate Chip Cookie Dough", brand: "Quest", servingSize: "1 bar (60g)", calories: 190, protein: 21, carbs: 22, fat: 7 },
  { barcode: "0722252100115", name: "Quest Bar Cookies & Cream", brand: "Quest", servingSize: "1 bar (60g)", calories: 200, protein: 21, carbs: 22, fat: 8 },
  { barcode: "0097421460100", name: "RXBar Chocolate Sea Salt", brand: "RXBAR", servingSize: "1 bar (52g)", calories: 210, protein: 12, carbs: 24, fat: 9 },
  { barcode: "0722252199907", name: "Quest Protein Chips Nacho Cheese", brand: "Quest", servingSize: "1 bag (32g)", calories: 140, protein: 19, carbs: 5, fat: 5 },

  // KIND Bars
  { barcode: "0602652171017", name: "KIND Dark Chocolate Nuts & Sea Salt", brand: "KIND", servingSize: "1 bar (40g)", calories: 200, protein: 6, carbs: 16, fat: 15 },
  { barcode: "0602652171024", name: "KIND Peanut Butter Dark Chocolate", brand: "KIND", servingSize: "1 bar (40g)", calories: 190, protein: 7, carbs: 16, fat: 14 },

  // Nature Valley
  { barcode: "0016000264809", name: "Nature Valley Oats 'n Honey Bars", brand: "Nature Valley", servingSize: "2 bars (42g)", calories: 190, protein: 4, carbs: 29, fat: 7 },
  { barcode: "0016000451971", name: "Nature Valley Protein Bar Peanut Butter", brand: "Nature Valley", servingSize: "1 bar (40g)", calories: 190, protein: 10, carbs: 15, fat: 12 },

  // Clif Bar
  { barcode: "0722252100603", name: "Clif Bar Chocolate Chip", brand: "Clif", servingSize: "1 bar (68g)", calories: 250, protein: 9, carbs: 45, fat: 5 },
  { barcode: "0722252100610", name: "Clif Bar Crunchy Peanut Butter", brand: "Clif", servingSize: "1 bar (68g)", calories: 260, protein: 11, carbs: 42, fat: 6 },

  // Greek Yogurt
  { barcode: "0846548000016", name: "Chobani Greek Yogurt Plain", brand: "Chobani", servingSize: "1 cup (170g)", calories: 100, protein: 17, carbs: 6, fat: 0 },
  { barcode: "0846548000023", name: "Chobani Greek Yogurt Strawberry", brand: "Chobani", servingSize: "1 cup (150g)", calories: 120, protein: 12, carbs: 14, fat: 0 },
  { barcode: "0036632036223", name: "Fage Total 0% Greek Yogurt", brand: "Fage", servingSize: "1 cup (170g)", calories: 90, protein: 18, carbs: 5, fat: 0 },

  // Nutella
  { barcode: "0009800800001", name: "Nutella Hazelnut Spread", brand: "Nutella", servingSize: "2 tbsp (37g)", calories: 200, protein: 2, carbs: 23, fat: 12 },

  // Kellogg's
  { barcode: "0038000596193", name: "Kellogg's Corn Flakes", brand: "Kellogg's", servingSize: "1 cup (30g)", calories: 100, protein: 2, carbs: 24, fat: 0 },
  { barcode: "0038000199318", name: "Kellogg's Frosted Flakes", brand: "Kellogg's", servingSize: "3/4 cup (30g)", calories: 110, protein: 1, carbs: 28, fat: 0 },
  { barcode: "0038000596230", name: "Kellogg's Special K Original", brand: "Kellogg's", servingSize: "1 cup (31g)", calories: 120, protein: 7, carbs: 22, fat: 0 },
  { barcode: "8901499006400", name: "Kellogg's Chocos (India)", brand: "Kellogg's", servingSize: "1 cup (30g)", calories: 116, protein: 2, carbs: 24, fat: 1 },

  // Oats
  { barcode: "0030000010006", name: "Quaker Oats Old Fashioned", brand: "Quaker", servingSize: "1/2 cup (40g)", calories: 150, protein: 5, carbs: 27, fat: 3 },
  { barcode: "0030000310106", name: "Quaker Instant Oatmeal Original", brand: "Quaker", servingSize: "1 packet (28g)", calories: 100, protein: 4, carbs: 19, fat: 2 },
  { barcode: "8901725184308", name: "Saffola Oats (India)", brand: "Saffola", servingSize: "1 cup (40g)", calories: 148, protein: 5, carbs: 24, fat: 3 },

  // Bread
  { barcode: "0073410013769", name: "Wonder Bread Classic White", brand: "Wonder", servingSize: "2 slices (50g)", calories: 130, protein: 4, carbs: 25, fat: 1.5 },
  { barcode: "0073410013820", name: "Dave's Killer Bread 21 Whole Grains", brand: "Dave's", servingSize: "1 slice (45g)", calories: 110, protein: 5, carbs: 22, fat: 1.5 },

  // Peanut Butter
  { barcode: "0051500280171", name: "Jif Creamy Peanut Butter", brand: "Jif", servingSize: "2 tbsp (33g)", calories: 190, protein: 7, carbs: 8, fat: 16 },
  { barcode: "0051100631104", name: "Skippy Creamy Peanut Butter", brand: "Skippy", servingSize: "2 tbsp (33g)", calories: 190, protein: 7, carbs: 6, fat: 16 },
  { barcode: "0051500006320", name: "Jif Natural Peanut Butter", brand: "Jif", servingSize: "2 tbsp (33g)", calories: 190, protein: 7, carbs: 8, fat: 16 },

  // Milk
  { barcode: "0041900065485", name: "Horizon Organic Whole Milk", brand: "Horizon", servingSize: "1 cup (240ml)", calories: 150, protein: 8, carbs: 12, fat: 8 },
  { barcode: "8901030652684", name: "Amul Gold Full Cream Milk", brand: "Amul", servingSize: "1 glass (200ml)", calories: 124, protein: 6, carbs: 10, fat: 6 },
  { barcode: "8901030793486", name: "Amul Taaza Toned Milk", brand: "Amul", servingSize: "1 glass (200ml)", calories: 98, protein: 6, carbs: 10, fat: 3 },

  // Juice
  { barcode: "0048500340660", name: "Tropicana Orange Juice", brand: "Tropicana", servingSize: "1 cup (240ml)", calories: 110, protein: 2, carbs: 26, fat: 0 },
  { barcode: "0048500202830", name: "Tropicana Apple Juice", brand: "Tropicana", servingSize: "1 cup (240ml)", calories: 120, protein: 0, carbs: 30, fat: 0 },
  { barcode: "8901396527008", name: "Real Fruit Power Mixed Fruit (India)", brand: "Real", servingSize: "1 glass (200ml)", calories: 112, protein: 0, carbs: 28, fat: 0 },
  { barcode: "8901396527015", name: "Real Fruit Power Mango (India)", brand: "Real", servingSize: "1 glass (200ml)", calories: 118, protein: 0, carbs: 30, fat: 0 },

  // Gatorade / Sports Drinks
  { barcode: "0052000324174", name: "Gatorade Lemon Lime", brand: "Gatorade", servingSize: "1 bottle (591ml)", calories: 140, protein: 0, carbs: 36, fat: 0 },
  { barcode: "0052000328110", name: "Gatorade Fruit Punch", brand: "Gatorade", servingSize: "1 bottle (591ml)", calories: 140, protein: 0, carbs: 36, fat: 0 },
  { barcode: "0052000122497", name: "Gatorade Zero Glacier Cherry", brand: "Gatorade", servingSize: "1 bottle (591ml)", calories: 0, protein: 0, carbs: 1, fat: 0 },

  // Whey Protein
  { barcode: "0748927028683", name: "Optimum Nutrition Gold Standard Whey (Double Rich Chocolate)", brand: "ON", servingSize: "1 scoop (31g)", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { barcode: "0748927050677", name: "Optimum Nutrition Gold Standard Whey (Vanilla Ice Cream)", brand: "ON", servingSize: "1 scoop (31g)", calories: 120, protein: 24, carbs: 3, fat: 1 },
  { barcode: "0790011517818", name: "MuscleBlaze Raw Whey Protein (India)", brand: "MuscleBlaze", servingSize: "1 scoop (33g)", calories: 125, protein: 25, carbs: 2, fat: 2 },
  { barcode: "0790011520818", name: "MuscleBlaze Biozyme Whey (India)", brand: "MuscleBlaze", servingSize: "1 scoop (33g)", calories: 130, protein: 25, carbs: 4, fat: 1.5 },

  // Instant Noodles
  { barcode: "0041789001253", name: "Nissin Cup Noodles Chicken", brand: "Nissin", servingSize: "1 cup (64g)", calories: 290, protein: 7, carbs: 37, fat: 13 },
  { barcode: "8901058852158", name: "Maggi 2-Minute Noodles (India)", brand: "Maggi", servingSize: "1 pack (70g)", calories: 310, protein: 7, carbs: 42, fat: 13 },
  { barcode: "8901058852165", name: "Maggi Masala Noodles (India)", brand: "Maggi", servingSize: "1 pack (70g)", calories: 312, protein: 7, carbs: 43, fat: 13 },
  { barcode: "8852018101019", name: "Mama Top Ramen Chicken", brand: "Top Ramen", servingSize: "1 pack (70g)", calories: 300, protein: 6, carbs: 40, fat: 13 },
  { barcode: "8801043157346", name: "Samyang Buldak Fire Noodles", brand: "Samyang", servingSize: "1 pack (140g)", calories: 530, protein: 9, carbs: 80, fat: 19 },

  // MTR (India)
  { barcode: "8901042503004", name: "MTR Ready to Eat Rajma Masala", brand: "MTR", servingSize: "1 pack (300g)", calories: 330, protein: 12, carbs: 42, fat: 12 },
  { barcode: "8901042502007", name: "MTR Ready to Eat Dal Fry", brand: "MTR", servingSize: "1 pack (300g)", calories: 270, protein: 14, carbs: 36, fat: 8 },

  // Amul Products
  { barcode: "8901030790034", name: "Amul Butter", brand: "Amul", servingSize: "1 tbsp (10g)", calories: 72, protein: 0, carbs: 0, fat: 8 },
  { barcode: "8901030792182", name: "Amul Cheese Slices", brand: "Amul", servingSize: "1 slice (20g)", calories: 62, protein: 3, carbs: 1, fat: 5 },
  { barcode: "8901030791086", name: "Amul Dark Chocolate", brand: "Amul", servingSize: "1 bar (40g)", calories: 210, protein: 2, carbs: 24, fat: 12 },
  { barcode: "8901030790041", name: "Amul Milk Chocolate", brand: "Amul", servingSize: "1 bar (40g)", calories: 215, protein: 3, carbs: 24, fat: 12 },

  // Ferrero Rocher
  { barcode: "0009800200573", name: "Ferrero Rocher", brand: "Ferrero", servingSize: "3 pieces (37.5g)", calories: 210, protein: 3, carbs: 17, fat: 15 },

  // Toblerone
  { barcode: "7614500010013", name: "Toblerone Milk Chocolate", brand: "Toblerone", servingSize: "1/3 bar (33g)", calories: 170, protein: 2, carbs: 19, fat: 10 },

  // Lindt
  { barcode: "0037466083803", name: "Lindt Excellence 70% Dark Chocolate", brand: "Lindt", servingSize: "4 squares (40g)", calories: 230, protein: 3, carbs: 17, fat: 17 },
  { barcode: "0037466083810", name: "Lindt Excellence 85% Dark Chocolate", brand: "Lindt", servingSize: "4 squares (40g)", calories: 230, protein: 4, carbs: 11, fat: 20 },

  // Tostitos / Tortilla Chips
  { barcode: "0028400039574", name: "Tostitos Scoops", brand: "Tostitos", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 19, fat: 7 },
  { barcode: "0028400064255", name: "Tostitos Restaurant Style", brand: "Tostitos", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 19, fat: 7 },

  // Ruffles
  { barcode: "0028400090872", name: "Ruffles Original", brand: "Ruffles", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 14, fat: 10 },
  { barcode: "0028400064064", name: "Ruffles Cheddar & Sour Cream", brand: "Ruffles", servingSize: "1 oz (28g)", calories: 160, protein: 2, carbs: 14, fat: 10 },

  // Sun Chips
  { barcode: "0028400090889", name: "SunChips Garden Salsa", brand: "SunChips", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 19, fat: 6 },
  { barcode: "0028400064071", name: "SunChips Harvest Cheddar", brand: "SunChips", servingSize: "1 oz (28g)", calories: 140, protein: 2, carbs: 18, fat: 6 },

  // Pop Tarts
  { barcode: "0038000317101", name: "Pop-Tarts Frosted Strawberry", brand: "Kellogg's", servingSize: "1 pastry (52g)", calories: 200, protein: 2, carbs: 37, fat: 5 },
  { barcode: "0038000317125", name: "Pop-Tarts Frosted Brown Sugar Cinnamon", brand: "Kellogg's", servingSize: "1 pastry (50g)", calories: 200, protein: 3, carbs: 34, fat: 6 },

  // Goldfish
  { barcode: "0014100085560", name: "Goldfish Cheddar Crackers", brand: "Pepperidge Farm", servingSize: "55 pieces (30g)", calories: 140, protein: 4, carbs: 20, fat: 5 },

  // Cheez-It
  { barcode: "0024100789566", name: "Cheez-It Original Crackers", brand: "Cheez-It", servingSize: "27 crackers (30g)", calories: 150, protein: 4, carbs: 17, fat: 8 },

  // Trail Mix / Nuts
  { barcode: "0029000076581", name: "Planters Mixed Nuts", brand: "Planters", servingSize: "1 oz (28g)", calories: 170, protein: 5, carbs: 6, fat: 15 },
  { barcode: "0029000073098", name: "Planters Honey Roasted Peanuts", brand: "Planters", servingSize: "1 oz (28g)", calories: 160, protein: 6, carbs: 8, fat: 13 },

  // Gummy Bears / Candy
  { barcode: "0042238301207", name: "Haribo Goldbears Gummy Bears", brand: "Haribo", servingSize: "13 pieces (30g)", calories: 100, protein: 2, carbs: 23, fat: 0 },
  { barcode: "0034000002535", name: "Jolly Rancher Hard Candy", brand: "Jolly Rancher", servingSize: "3 pieces (17g)", calories: 70, protein: 0, carbs: 17, fat: 0 },
  { barcode: "0040000563570", name: "Skittles Original", brand: "Skittles", servingSize: "1 pack (61g)", calories: 250, protein: 0, carbs: 56, fat: 2 },

  // Ice Cream (common)
  { barcode: "0076840100156", name: "Ben & Jerry's Chocolate Fudge Brownie", brand: "Ben & Jerry's", servingSize: "2/3 cup (122g)", calories: 290, protein: 4, carbs: 35, fat: 15 },
  { barcode: "0076840100163", name: "Ben & Jerry's Half Baked", brand: "Ben & Jerry's", servingSize: "2/3 cup (125g)", calories: 290, protein: 4, carbs: 34, fat: 14 },
  { barcode: "0077567254108", name: "Haagen-Dazs Vanilla", brand: "Haagen-Dazs", servingSize: "2/3 cup (122g)", calories: 290, protein: 5, carbs: 26, fat: 19 },

  // Tortilla / Wraps
  { barcode: "0073731071144", name: "Mission Flour Tortillas", brand: "Mission", servingSize: "1 tortilla (49g)", calories: 140, protein: 4, carbs: 24, fat: 3.5 },
  { barcode: "0073731071151", name: "Mission Whole Wheat Tortillas", brand: "Mission", servingSize: "1 tortilla (49g)", calories: 130, protein: 5, carbs: 24, fat: 3 },

  // Hummus
  { barcode: "0052159702816", name: "Sabra Classic Hummus", brand: "Sabra", servingSize: "2 tbsp (28g)", calories: 70, protein: 2, carbs: 4, fat: 5 },

  // Ritz Crackers
  { barcode: "0044000003029", name: "Ritz Original Crackers", brand: "Ritz", servingSize: "5 crackers (16g)", calories: 80, protein: 1, carbs: 10, fat: 4 },

  // Indian Snacks (Packaged)
  { barcode: "8901491503914", name: "Uncle Chipps Spicy Treat", brand: "Uncle Chipps", servingSize: "1 pack (55g)", calories: 280, protein: 3, carbs: 30, fat: 16 },
  { barcode: "8901491503921", name: "Uncle Chipps Plain Salted", brand: "Uncle Chipps", servingSize: "1 pack (55g)", calories: 285, protein: 3, carbs: 30, fat: 17 },
  { barcode: "8904215100100", name: "Too Yumm Multigrain Chips", brand: "Too Yumm", servingSize: "1 pack (54g)", calories: 245, protein: 4, carbs: 30, fat: 12 },
  { barcode: "8901725181130", name: "Bingo Tedhe Medhe Masala Tadka", brand: "Bingo", servingSize: "1 pack (66g)", calories: 340, protein: 4, carbs: 36, fat: 20 },

  // Protein Drinks
  { barcode: "0812135021238", name: "Fairlife Core Power Chocolate", brand: "Fairlife", servingSize: "1 bottle (340ml)", calories: 170, protein: 26, carbs: 7, fat: 4.5 },
  { barcode: "0818411000108", name: "Premier Protein Shake Chocolate", brand: "Premier Protein", servingSize: "1 bottle (325ml)", calories: 160, protein: 30, carbs: 5, fat: 3 },

  // Sting Energy (India)
  { barcode: "8901588003003", name: "Sting Energy Drink Berry Blast (India)", brand: "Sting", servingSize: "1 bottle (250ml)", calories: 115, protein: 0, carbs: 29, fat: 0 },
  { barcode: "8901588003010", name: "Sting Energy Drink Gold Rush (India)", brand: "Sting", servingSize: "1 bottle (250ml)", calories: 115, protein: 0, carbs: 29, fat: 0 },

  // Paper Boat (India)
  { barcode: "8906058200012", name: "Paper Boat Aam Panna (India)", brand: "Paper Boat", servingSize: "1 pack (200ml)", calories: 86, protein: 0, carbs: 22, fat: 0 },
  { barcode: "8906058200029", name: "Paper Boat Jaljeera (India)", brand: "Paper Boat", servingSize: "1 pack (200ml)", calories: 60, protein: 0, carbs: 15, fat: 0 },

  // Frooti / Maaza (India)
  { barcode: "8901526401017", name: "Frooti Mango Drink (India)", brand: "Frooti", servingSize: "1 pack (200ml)", calories: 112, protein: 0, carbs: 28, fat: 0 },
  { barcode: "8901764010106", name: "Maaza Mango Drink (India)", brand: "Coca-Cola", servingSize: "1 bottle (250ml)", calories: 128, protein: 0, carbs: 32, fat: 0 },
];

const barcodeMap = new Map<string, BarcodeProduct>();
for (const product of BARCODE_DATABASE) {
  barcodeMap.set(product.barcode, product);
  const stripped = product.barcode.replace(/^0+/, '');
  if (stripped !== product.barcode) {
    barcodeMap.set(stripped, product);
  }
}

export function lookupBarcodeLocal(barcode: string): BarcodeProduct | null {
  const clean = barcode.trim();
  if (barcodeMap.has(clean)) {
    return barcodeMap.get(clean)!;
  }
  const stripped = clean.replace(/^0+/, '');
  if (barcodeMap.has(stripped)) {
    return barcodeMap.get(stripped)!;
  }
  const padded = clean.padStart(13, '0');
  if (barcodeMap.has(padded)) {
    return barcodeMap.get(padded)!;
  }
  return null;
}
