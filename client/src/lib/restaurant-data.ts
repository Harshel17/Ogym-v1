export interface RestaurantEntry {
  name: string;
  aliases: string[];
  category: string;
}

export const RESTAURANTS: RestaurantEntry[] = [
  { name: "McDonald's", aliases: ["mcdonalds", "mcdonald", "mcd", "mickey d"], category: "Fast Food" },
  { name: "Burger King", aliases: ["burger king", "bk"], category: "Fast Food" },
  { name: "Wendy's", aliases: ["wendys", "wendy"], category: "Fast Food" },
  { name: "Chick-fil-A", aliases: ["chick fil a", "chickfila", "chick-fil-a", "cfa"], category: "Fast Food" },
  { name: "Subway", aliases: ["subway", "sub way"], category: "Sandwich" },
  { name: "Taco Bell", aliases: ["taco bell", "tacobell", "tb"], category: "Mexican" },
  { name: "Chipotle", aliases: ["chipotle", "chipotlé"], category: "Mexican" },
  { name: "Five Guys", aliases: ["five guys", "5 guys", "fiveguys"], category: "Burger" },
  { name: "Popeyes", aliases: ["popeyes", "popeye"], category: "Chicken" },
  { name: "KFC", aliases: ["kfc", "kentucky fried chicken", "kentucky"], category: "Chicken" },
  { name: "Whataburger", aliases: ["whataburger", "whatburger", "what a burger", "whata"], category: "Burger" },
  { name: "In-N-Out", aliases: ["in n out", "in-n-out", "innout", "in and out"], category: "Burger" },
  { name: "Sonic", aliases: ["sonic", "sonic drive-in"], category: "Fast Food" },
  { name: "Jack in the Box", aliases: ["jack in the box", "jack box", "jitb"], category: "Fast Food" },
  { name: "Arby's", aliases: ["arbys", "arby"], category: "Fast Food" },
  { name: "Panda Express", aliases: ["panda express", "panda"], category: "Chinese" },
  { name: "Domino's", aliases: ["dominos", "domino"], category: "Pizza" },
  { name: "Papa John's", aliases: ["papa johns", "papa john"], category: "Pizza" },
  { name: "Pizza Hut", aliases: ["pizza hut", "pizzahut"], category: "Pizza" },
  { name: "Little Caesars", aliases: ["little caesars", "little ceasars", "lc"], category: "Pizza" },
  { name: "Starbucks", aliases: ["starbucks", "sbux", "starbuck"], category: "Coffee" },
  { name: "Dunkin'", aliases: ["dunkin", "dunkin donuts", "dunkin doughnuts", "dd"], category: "Coffee" },
  { name: "Panera Bread", aliases: ["panera", "panera bread"], category: "Bakery/Cafe" },
  { name: "Chili's", aliases: ["chilis", "chili"], category: "Casual Dining" },
  { name: "Applebee's", aliases: ["applebees", "applebee"], category: "Casual Dining" },
  { name: "Olive Garden", aliases: ["olive garden"], category: "Italian" },
  { name: "Red Lobster", aliases: ["red lobster"], category: "Seafood" },
  { name: "Outback Steakhouse", aliases: ["outback", "outback steakhouse"], category: "Steakhouse" },
  { name: "IHOP", aliases: ["ihop", "i hop"], category: "Breakfast" },
  { name: "Denny's", aliases: ["dennys", "denny"], category: "Breakfast" },
  { name: "Waffle House", aliases: ["waffle house", "wafflehouse"], category: "Breakfast" },
  { name: "Shake Shack", aliases: ["shake shack", "shakeshack"], category: "Burger" },
  { name: "Wingstop", aliases: ["wingstop", "wing stop"], category: "Wings" },
  { name: "Buffalo Wild Wings", aliases: ["buffalo wild wings", "bww", "bdubs", "b dubs"], category: "Wings" },
  { name: "Jersey Mike's", aliases: ["jersey mikes", "jersey mike"], category: "Sandwich" },
  { name: "Jimmy John's", aliases: ["jimmy johns", "jimmy john", "jj"], category: "Sandwich" },
  { name: "Firehouse Subs", aliases: ["firehouse subs", "firehouse sub", "firehouse"], category: "Sandwich" },
  { name: "Zaxby's", aliases: ["zaxbys", "zaxby"], category: "Chicken" },
  { name: "Raising Cane's", aliases: ["raising canes", "raising cane", "canes"], category: "Chicken" },
  { name: "Culver's", aliases: ["culvers", "culver"], category: "Fast Food" },
  { name: "Sweetgreen", aliases: ["sweetgreen", "sweet green"], category: "Salad" },
  { name: "CAVA", aliases: ["cava"], category: "Mediterranean" },
  { name: "Nando's", aliases: ["nandos", "nando"], category: "Chicken" },
  { name: "Tropical Smoothie", aliases: ["tropical smoothie", "tropical smoothie cafe"], category: "Smoothie" },
  { name: "Smoothie King", aliases: ["smoothie king"], category: "Smoothie" },
  { name: "Wawa", aliases: ["wawa"], category: "Convenience" },
  { name: "Chick-fil-A", aliases: ["chick-fil-a"], category: "Chicken" },
  { name: "Cracker Barrel", aliases: ["cracker barrel"], category: "Casual Dining" },
  { name: "Texas Roadhouse", aliases: ["texas roadhouse"], category: "Steakhouse" },
  { name: "The Cheesecake Factory", aliases: ["cheesecake factory", "tcf"], category: "Casual Dining" },
  { name: "P.F. Chang's", aliases: ["pf changs", "pf chang"], category: "Chinese" },
  { name: "Qdoba", aliases: ["qdoba"], category: "Mexican" },
  { name: "Moe's", aliases: ["moes", "moe"], category: "Mexican" },
  { name: "El Pollo Loco", aliases: ["el pollo loco", "pollo loco"], category: "Mexican" },
  { name: "Carl's Jr.", aliases: ["carls jr", "carl"], category: "Fast Food" },
  { name: "Hardee's", aliases: ["hardees", "hardee"], category: "Fast Food" },
  { name: "Dairy Queen", aliases: ["dairy queen", "dq"], category: "Fast Food" },
  { name: "Tim Hortons", aliases: ["tim hortons", "tims", "timmy"], category: "Coffee" },
  { name: "Krispy Kreme", aliases: ["krispy kreme"], category: "Bakery" },
  { name: "Bojangles", aliases: ["bojangles"], category: "Chicken" },
  { name: "Church's Chicken", aliases: ["churchs chicken", "church chicken"], category: "Chicken" },
];

const uniqueMap = new Map<string, RestaurantEntry>();
RESTAURANTS.forEach(r => {
  if (!uniqueMap.has(r.name)) uniqueMap.set(r.name, r);
});
const UNIQUE_RESTAURANTS = Array.from(uniqueMap.values());

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatchRestaurants(query: string, limit = 5): RestaurantEntry[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();

  const scored = UNIQUE_RESTAURANTS.map(r => {
    let bestScore = Infinity;

    for (const alias of r.aliases) {
      if (alias === q) return { restaurant: r, score: -1000 };
      if (alias.startsWith(q)) bestScore = Math.min(bestScore, -100 + alias.length - q.length);
      else if (alias.includes(q)) bestScore = Math.min(bestScore, -50 + alias.length - q.length);
      else {
        const dist = levenshtein(q, alias.substring(0, Math.max(q.length + 2, alias.length)));
        const threshold = Math.max(2, Math.floor(q.length * 0.4));
        if (dist <= threshold) bestScore = Math.min(bestScore, dist);
      }
    }

    const nameLower = r.name.toLowerCase();
    if (nameLower.startsWith(q)) bestScore = Math.min(bestScore, -100 + nameLower.length - q.length);
    else if (nameLower.includes(q)) bestScore = Math.min(bestScore, -50 + nameLower.length - q.length);

    return { restaurant: r, score: bestScore };
  });

  return scored
    .filter(s => s.score < Infinity)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(s => s.restaurant);
}

const RECENT_RESTAURANTS_KEY = 'ogym_recent_restaurants';

export function getRecentRestaurants(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_RESTAURANTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentRestaurant(name: string) {
  try {
    const recent = getRecentRestaurants().filter(r => r !== name);
    recent.unshift(name);
    localStorage.setItem(RECENT_RESTAURANTS_KEY, JSON.stringify(recent.slice(0, 10)));
  } catch {}
}
