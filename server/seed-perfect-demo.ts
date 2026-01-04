import { db } from "./db";
import { 
  users, gyms, gymSubscriptions, trainerMembers, trainerMemberAssignments,
  attendance, membershipPlans, memberSubscriptions, paymentTransactions, payments,
  workoutCycles, workoutItems, workoutCompletions, workoutSessions, workoutSessionExercises,
  bodyMeasurements, starMembers, gymHistory, dietPlans, dietPlanMeals, announcements, announcementReads,
  memberNotes, workoutTemplates, workoutTemplateItems, memberRequests, transferRequests, joinRequests,
  feedPosts, feedReactions, feedComments, tournaments, tournamentParticipants, memberRestDaySwaps,
  trainingPhases, phaseExercises
} from "@shared/schema";
import { eq, or, inArray } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { format, subDays, addMonths, addDays } from "date-fns";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function generatePublicId(prefix: string): string {
  return `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const FIRST_NAMES = [
  "Rahul", "Priya", "Amit", "Neha", "Vikram", "Ananya", "Karan", "Divya",
  "Arjun", "Sneha", "Rohan", "Pooja", "Aditya", "Riya", "Siddharth", "Kavya",
  "Nikhil", "Aishwarya", "Varun", "Meera", "Akash", "Shreya", "Harsh", "Tanya",
  "Manish", "Kritika", "Rajat", "Simran", "Dhruv", "Nidhi", "Gaurav", "Ishita",
  "Pranav", "Sakshi", "Ayush", "Anjali", "Kunal", "Nikita", "Shubham", "Swati",
  "Ankit", "Tanvi", "Vivek", "Kriti", "Mohit", "Bhavna", "Tushar", "Deepika",
  "Abhishek", "Jyoti", "Saurabh", "Pallavi", "Himanshu", "Ritika", "Aman", "Sonali",
  "Pankaj", "Komal", "Yash", "Garima"
];

const TRAINER_NAMES = [
  { first: "Rajesh", last: "Sharma" },
  { first: "Deepak", last: "Verma" },
  { first: "Sunita", last: "Reddy" },
  { first: "Kavitha", last: "Nair" },
  { first: "Vijay", last: "Singh" },
];

const WORKOUT_TEMPLATES = [
  {
    name: "Beginner Full Body",
    description: "Full body workout for beginners. 3-day cycle with progressive overload.",
    cycleLength: 3,
    restDays: [] as number[],
    dayLabels: ["Full Body A", "Full Body B", "Full Body C"],
    days: [
      { label: "Full Body A", exercises: [
        { name: "Goblet Squats", sets: 3, reps: 12, weight: "12kg", muscle: "Quads", body: "Lower Body" },
        { name: "Push Ups", sets: 3, reps: 10, weight: "BW", muscle: "Chest", body: "Upper Body" },
        { name: "Dumbbell Rows", sets: 3, reps: 12, weight: "10kg", muscle: "Back", body: "Upper Body" },
        { name: "Plank", sets: 3, reps: 30, weight: "sec", muscle: "Core", body: "Core" },
        { name: "Lunges", sets: 3, reps: 10, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "Shoulder Press", sets: 3, reps: 10, weight: "8kg", muscle: "Shoulders", body: "Upper Body" },
      ]},
      { label: "Full Body B", exercises: [
        { name: "Romanian Deadlift", sets: 3, reps: 12, weight: "20kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Incline Push Ups", sets: 3, reps: 12, weight: "BW", muscle: "Chest", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 3, reps: 12, weight: "30kg", muscle: "Back", body: "Upper Body" },
        { name: "Russian Twists", sets: 3, reps: 20, weight: "5kg", muscle: "Core", body: "Core" },
        { name: "Step Ups", sets: 3, reps: 10, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "Lateral Raises", sets: 3, reps: 12, weight: "5kg", muscle: "Shoulders", body: "Upper Body" },
      ]},
      { label: "Full Body C", exercises: [
        { name: "Leg Press", sets: 3, reps: 12, weight: "60kg", muscle: "Quads", body: "Lower Body" },
        { name: "Bench Press", sets: 3, reps: 10, weight: "30kg", muscle: "Chest", body: "Upper Body" },
        { name: "Seated Rows", sets: 3, reps: 12, weight: "35kg", muscle: "Back", body: "Upper Body" },
        { name: "Bicycle Crunches", sets: 3, reps: 20, weight: "BW", muscle: "Core", body: "Core" },
        { name: "Calf Raises", sets: 3, reps: 15, weight: "30kg", muscle: "Calves", body: "Lower Body" },
        { name: "Face Pulls", sets: 3, reps: 15, weight: "15kg", muscle: "Back", body: "Upper Body" },
      ]}
    ]
  },
  {
    name: "Push/Pull/Legs + Rest",
    description: "Classic PPL split with built-in rest days. 7-day cycle.",
    cycleLength: 7,
    restDays: [3, 6] as number[],
    dayLabels: ["Push", "Pull", "Legs", "Rest Day", "Push", "Pull", "Rest Day"],
    days: [
      { label: "Push", exercises: [
        { name: "Bench Press", sets: 4, reps: 10, weight: "60kg", muscle: "Chest", body: "Upper Body" },
        { name: "Incline Dumbbell Press", sets: 3, reps: 12, weight: "20kg", muscle: "Chest", body: "Upper Body" },
        { name: "Overhead Press", sets: 4, reps: 8, weight: "40kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "10kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Tricep Pushdowns", sets: 3, reps: 12, weight: "25kg", muscle: "Triceps", body: "Arms" },
        { name: "Skull Crushers", sets: 3, reps: 10, weight: "20kg", muscle: "Triceps", body: "Arms" },
      ]},
      { label: "Pull", exercises: [
        { name: "Deadlifts", sets: 4, reps: 6, weight: "100kg", muscle: "Back", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 4, reps: 10, weight: "50kg", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "60kg", muscle: "Back", body: "Upper Body" },
        { name: "Face Pulls", sets: 3, reps: 15, weight: "20kg", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Curls", sets: 3, reps: 12, weight: "25kg", muscle: "Biceps", body: "Arms" },
        { name: "Hammer Curls", sets: 3, reps: 10, weight: "12kg", muscle: "Biceps", body: "Arms" },
      ]},
      { label: "Legs", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "80kg", muscle: "Quads", body: "Lower Body" },
        { name: "Leg Press", sets: 4, reps: 12, weight: "150kg", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 3, reps: 10, weight: "60kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Leg Curls", sets: 3, reps: 12, weight: "40kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "60kg", muscle: "Calves", body: "Lower Body" },
        { name: "Lunges", sets: 3, reps: 12, weight: "20kg", muscle: "Quads", body: "Lower Body" },
      ]}
    ]
  },
  {
    name: "Upper/Lower + Rest",
    description: "Upper/lower split with rest. 5-day cycle.",
    cycleLength: 5,
    restDays: [4] as number[],
    dayLabels: ["Upper Body", "Lower Body", "Upper Body", "Lower Body", "Rest Day"],
    days: [
      { label: "Upper Body", exercises: [
        { name: "Bench Press", sets: 4, reps: 8, weight: "70kg", muscle: "Chest", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "60kg", muscle: "Back", body: "Upper Body" },
        { name: "Overhead Press", sets: 3, reps: 10, weight: "40kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Pull Ups", sets: 3, reps: 8, weight: "BW", muscle: "Back", body: "Upper Body" },
        { name: "Dumbbell Curls", sets: 3, reps: 12, weight: "14kg", muscle: "Biceps", body: "Arms" },
        { name: "Tricep Dips", sets: 3, reps: 10, weight: "BW", muscle: "Triceps", body: "Arms" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "8kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Cable Flyes", sets: 3, reps: 12, weight: "15kg", muscle: "Chest", body: "Upper Body" },
      ]},
      { label: "Lower Body", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "90kg", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 4, reps: 10, weight: "70kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Leg Press", sets: 3, reps: 12, weight: "160kg", muscle: "Quads", body: "Lower Body" },
        { name: "Hip Thrusts", sets: 3, reps: 12, weight: "80kg", muscle: "Glutes", body: "Lower Body" },
        { name: "Leg Extensions", sets: 3, reps: 15, weight: "40kg", muscle: "Quads", body: "Lower Body" },
        { name: "Leg Curls", sets: 3, reps: 12, weight: "35kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "50kg", muscle: "Calves", body: "Lower Body" },
      ]}
    ]
  },
  {
    name: "Fat Loss HIIT Circuit",
    description: "High intensity circuit for fat loss. 4-day cycle.",
    cycleLength: 4,
    restDays: [] as number[],
    dayLabels: ["Circuit A", "Circuit B", "Circuit C", "Circuit D"],
    days: [
      { label: "Circuit A", exercises: [
        { name: "Burpees", sets: 4, reps: 12, weight: "BW", muscle: "Full Body", body: "Full Body" },
        { name: "Mountain Climbers", sets: 4, reps: 20, weight: "BW", muscle: "Core", body: "Core" },
        { name: "Jump Squats", sets: 4, reps: 15, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "Push Ups", sets: 4, reps: 15, weight: "BW", muscle: "Chest", body: "Upper Body" },
        { name: "High Knees", sets: 4, reps: 30, weight: "sec", muscle: "Cardio", body: "Full Body" },
      ]},
      { label: "Circuit B", exercises: [
        { name: "Kettlebell Swings", sets: 4, reps: 15, weight: "16kg", muscle: "Full Body", body: "Full Body" },
        { name: "Box Jumps", sets: 4, reps: 10, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "Battle Ropes", sets: 4, reps: 30, weight: "sec", muscle: "Arms", body: "Arms" },
        { name: "Thrusters", sets: 4, reps: 12, weight: "20kg", muscle: "Full Body", body: "Full Body" },
        { name: "Plank Jacks", sets: 4, reps: 20, weight: "BW", muscle: "Core", body: "Core" },
      ]},
      { label: "Circuit C", exercises: [
        { name: "Rowing Machine", sets: 4, reps: 250, weight: "m", muscle: "Cardio", body: "Full Body" },
        { name: "Squat Jumps", sets: 4, reps: 12, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "TRX Rows", sets: 4, reps: 15, weight: "BW", muscle: "Back", body: "Upper Body" },
        { name: "Bear Crawls", sets: 4, reps: 30, weight: "sec", muscle: "Core", body: "Core" },
        { name: "Jumping Lunges", sets: 4, reps: 10, weight: "BW", muscle: "Quads", body: "Lower Body" },
      ]},
      { label: "Circuit D", exercises: [
        { name: "Sled Push", sets: 4, reps: 20, weight: "m", muscle: "Full Body", body: "Full Body" },
        { name: "Med Ball Slams", sets: 4, reps: 12, weight: "8kg", muscle: "Core", body: "Core" },
        { name: "Treadmill Sprints", sets: 4, reps: 30, weight: "sec", muscle: "Cardio", body: "Full Body" },
        { name: "Dumbbell Snatch", sets: 4, reps: 8, weight: "15kg", muscle: "Full Body", body: "Full Body" },
        { name: "Bicycle Crunches", sets: 4, reps: 20, weight: "BW", muscle: "Core", body: "Core" },
      ]}
    ]
  },
  {
    name: "Strength Block",
    description: "Heavy compound focus for strength gains. 4-day cycle.",
    cycleLength: 4,
    restDays: [] as number[],
    dayLabels: ["Squat Focus", "Bench Focus", "Deadlift Focus", "Overhead Focus"],
    days: [
      { label: "Squat Focus", exercises: [
        { name: "Back Squats", sets: 5, reps: 5, weight: "100kg", muscle: "Quads", body: "Lower Body" },
        { name: "Pause Squats", sets: 3, reps: 3, weight: "80kg", muscle: "Quads", body: "Lower Body" },
        { name: "Front Squats", sets: 3, reps: 6, weight: "70kg", muscle: "Quads", body: "Lower Body" },
        { name: "Leg Press", sets: 3, reps: 10, weight: "180kg", muscle: "Quads", body: "Lower Body" },
        { name: "Walking Lunges", sets: 3, reps: 12, weight: "30kg", muscle: "Quads", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 12, weight: "80kg", muscle: "Calves", body: "Lower Body" },
      ]},
      { label: "Bench Focus", exercises: [
        { name: "Bench Press", sets: 5, reps: 5, weight: "90kg", muscle: "Chest", body: "Upper Body" },
        { name: "Pause Bench", sets: 3, reps: 3, weight: "75kg", muscle: "Chest", body: "Upper Body" },
        { name: "Close Grip Bench", sets: 3, reps: 8, weight: "65kg", muscle: "Triceps", body: "Arms" },
        { name: "Incline Dumbbell Press", sets: 3, reps: 10, weight: "30kg", muscle: "Chest", body: "Upper Body" },
        { name: "Tricep Dips", sets: 3, reps: 10, weight: "+10kg", muscle: "Triceps", body: "Arms" },
        { name: "Cable Crossovers", sets: 3, reps: 12, weight: "20kg", muscle: "Chest", body: "Upper Body" },
      ]},
      { label: "Deadlift Focus", exercises: [
        { name: "Conventional Deadlift", sets: 5, reps: 5, weight: "140kg", muscle: "Back", body: "Upper Body" },
        { name: "Deficit Deadlift", sets: 3, reps: 4, weight: "110kg", muscle: "Back", body: "Upper Body" },
        { name: "Romanian Deadlift", sets: 3, reps: 8, weight: "90kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "70kg", muscle: "Back", body: "Upper Body" },
        { name: "Pull Ups", sets: 4, reps: 6, weight: "+10kg", muscle: "Back", body: "Upper Body" },
        { name: "Face Pulls", sets: 3, reps: 15, weight: "25kg", muscle: "Back", body: "Upper Body" },
      ]},
      { label: "Overhead Focus", exercises: [
        { name: "Overhead Press", sets: 5, reps: 5, weight: "50kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Push Press", sets: 3, reps: 5, weight: "60kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Arnold Press", sets: 3, reps: 10, weight: "18kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Lateral Raises", sets: 4, reps: 12, weight: "12kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Rear Delt Flyes", sets: 3, reps: 15, weight: "10kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Shrugs", sets: 4, reps: 12, weight: "40kg", muscle: "Traps", body: "Upper Body" },
      ]}
    ]
  }
];

const ANNOUNCEMENT_TEMPLATES = [
  { title: "New Year Fitness Goals", body: "Welcome to the new year! Let's crush those fitness goals together. Update your body measurements this week.", audience: "everyone" as const },
  { title: "Gym Timing Update", body: "Starting next week, we'll be open 5 AM to 11 PM on weekdays. Weekend timings remain 6 AM - 9 PM.", audience: "everyone" as const },
  { title: "Monthly Fitness Challenge", body: "Join our monthly fitness challenge! Complete 20 workouts this month and win prizes.", audience: "members" as const },
  { title: "Trainer Sync - Monday 8 AM", body: "All trainers please join the weekly sync meeting on Monday at 8 AM.", audience: "trainers" as const },
  { title: "Equipment Maintenance Notice", body: "The cable machines will be under maintenance on Saturday. We apologize for the inconvenience.", audience: "everyone" as const },
  { title: "Payment Reminder", body: "Monthly subscriptions are due by the 5th. Please clear any pending dues.", audience: "members" as const },
  { title: "New Cardio Equipment Added", body: "We've added 4 new treadmills and 2 rowing machines! Come try them out.", audience: "everyone" as const },
  { title: "Progress Reports Due", body: "Trainers, please submit your client progress reports by Friday EOD.", audience: "trainers" as const },
  { title: "Personal Training Special", body: "Book 10 personal training sessions and get 2 free! Limited time offer.", audience: "members" as const },
  { title: "Holiday Hours", body: "Gym will be open 8 AM - 6 PM during the upcoming holidays.", audience: "everyone" as const },
];

const DIET_PLAN_TEMPLATES = [
  {
    title: "Weight Loss Plan",
    durationWeeks: 8,
    notes: "Calorie deficit diet with high protein. Drink at least 3L water daily.",
    meals: [
      { dayIndex: 0, mealType: "breakfast" as const, description: "2 boiled eggs, 1 multigrain toast, green tea", calories: 280, protein: 18 },
      { dayIndex: 0, mealType: "snack" as const, description: "1 apple + 10 almonds", calories: 150, protein: 4 },
      { dayIndex: 0, mealType: "lunch" as const, description: "Grilled chicken breast 150g, brown rice 1 cup, mixed salad", calories: 450, protein: 40 },
      { dayIndex: 0, mealType: "snack" as const, description: "Protein shake with water", calories: 120, protein: 25 },
      { dayIndex: 0, mealType: "dinner" as const, description: "Fish curry 150g, 2 rotis, vegetables", calories: 380, protein: 35 }
    ]
  },
  {
    title: "Muscle Gain Plan",
    durationWeeks: 12,
    notes: "High protein, moderate carb surplus. Eat every 3 hours.",
    meals: [
      { dayIndex: 0, mealType: "breakfast" as const, description: "4 egg omelette, 2 toast with peanut butter, banana shake", calories: 650, protein: 35 },
      { dayIndex: 0, mealType: "snack" as const, description: "Protein bar + banana", calories: 300, protein: 20 },
      { dayIndex: 0, mealType: "lunch" as const, description: "Chicken biryani 2 cups, raita, paneer tikka", calories: 750, protein: 50 },
      { dayIndex: 0, mealType: "snack" as const, description: "Greek yogurt with honey and nuts", calories: 250, protein: 15 },
      { dayIndex: 0, mealType: "dinner" as const, description: "Mutton curry 200g, 3 rotis, dal, vegetables", calories: 700, protein: 45 }
    ]
  },
  {
    title: "Lean Maintenance",
    durationWeeks: 4,
    notes: "Maintenance calories with balanced macros. Good for maintaining current physique.",
    meals: [
      { dayIndex: 0, mealType: "breakfast" as const, description: "Oats with milk, 1 banana, 2 boiled eggs", calories: 400, protein: 22 },
      { dayIndex: 0, mealType: "lunch" as const, description: "Paneer bhurji 150g, 2 rotis, salad", calories: 500, protein: 30 },
      { dayIndex: 0, mealType: "snack" as const, description: "Sprouts chaat + buttermilk", calories: 180, protein: 12 },
      { dayIndex: 0, mealType: "dinner" as const, description: "Grilled fish 150g, quinoa 1 cup, vegetables", calories: 420, protein: 35 }
    ]
  }
];

const MEMBER_NOTE_TEMPLATES = [
  "Good form on squats today. Increased weight by 5kg.",
  "Missed last 2 sessions due to work. Need to follow up.",
  "Showing great progress. Lost 3kg in the last month.",
  "Needs to focus on mobility. Suggested daily stretching routine.",
  "Diet compliance is low. Discussed meal prep strategies.",
  "Excellent dedication. Comes 6 days a week consistently.",
  "Recovering from minor shoulder injury. Avoiding overhead pressing.",
  "Interested in competing. Discussing bodybuilding prep.",
  "Goals: Lose 10kg by March. Currently on track.",
  "Prefers morning sessions. Performs better with caffeine."
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateWorkoutDays(startDays: number, endDays: number, daysPerWeek: number): string[] {
  const days: string[] = [];
  const totalWeeks = Math.ceil((startDays - endDays) / 7);
  const today = new Date();
  
  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = startDays - (week * 7);
    const weekEnd = Math.max(weekStart - 6, endDays);
    
    const possibleDays: string[] = [];
    for (let d = weekStart; d >= weekEnd; d--) {
      possibleDays.push(format(subDays(today, d), "yyyy-MM-dd"));
    }
    
    const shuffled = possibleDays.sort(() => Math.random() - 0.5);
    const selectedCount = Math.min(daysPerWeek, shuffled.length);
    days.push(...shuffled.slice(0, selectedCount));
  }
  
  return days.sort();
}

const DEMO_GYM_CODE = "OGYMDEMOE";
const SECONDARY_GYM_CODE = "OGYMTRANS";

export async function resetPerfectDemoData(): Promise<void> {
  console.log("\n========================================");
  console.log("RESETTING PERFECT DEMO DATA");
  console.log("========================================\n");
  
  const demoGyms = await db.select().from(gyms).where(
    or(eq(gyms.code, DEMO_GYM_CODE), eq(gyms.code, SECONDARY_GYM_CODE))
  );
  
  const gymIds = demoGyms.map(g => g.id);
  
  if (gymIds.length === 0) {
    console.log("[Demo Reset] No perfect demo gyms found.");
    return;
  }
  
  console.log(`[Demo Reset] Found ${demoGyms.length} demo gyms to delete...`);
  
  const demoSessions = await db.select().from(workoutSessions).where(inArray(workoutSessions.gymId, gymIds));
  const sessionIds = demoSessions.map(s => s.id);
  if (sessionIds.length > 0) {
    await db.delete(workoutSessionExercises).where(inArray(workoutSessionExercises.sessionId, sessionIds));
    await db.delete(workoutSessions).where(inArray(workoutSessions.id, sessionIds));
  }
  
  const demoCycles = await db.select().from(workoutCycles).where(inArray(workoutCycles.gymId, gymIds));
  const cycleIds = demoCycles.map(c => c.id);
  if (cycleIds.length > 0) {
    await db.delete(memberRestDaySwaps).where(inArray(memberRestDaySwaps.cycleId, cycleIds));
    await db.delete(workoutCompletions).where(inArray(workoutCompletions.cycleId, cycleIds));
    await db.delete(workoutItems).where(inArray(workoutItems.cycleId, cycleIds));
    await db.delete(workoutCycles).where(inArray(workoutCycles.id, cycleIds));
  }
  
  const demoPhases = await db.select().from(trainingPhases).where(inArray(trainingPhases.gymId, gymIds));
  const phaseIds = demoPhases.map(p => p.id);
  if (phaseIds.length > 0) {
    await db.delete(phaseExercises).where(inArray(phaseExercises.phaseId, phaseIds));
    await db.delete(trainingPhases).where(inArray(trainingPhases.id, phaseIds));
  }
  
  await db.delete(attendance).where(inArray(attendance.gymId, gymIds));
  await db.delete(bodyMeasurements).where(inArray(bodyMeasurements.gymId, gymIds));
  await db.delete(paymentTransactions).where(inArray(paymentTransactions.gymId, gymIds));
  await db.delete(memberSubscriptions).where(inArray(memberSubscriptions.gymId, gymIds));
  await db.delete(membershipPlans).where(inArray(membershipPlans.gymId, gymIds));
  await db.delete(trainerMemberAssignments).where(inArray(trainerMemberAssignments.gymId, gymIds));
  await db.delete(trainerMembers).where(inArray(trainerMembers.gymId, gymIds));
  await db.delete(starMembers).where(inArray(starMembers.gymId, gymIds));
  await db.delete(gymHistory).where(inArray(gymHistory.gymId, gymIds));
  await db.delete(memberRequests).where(inArray(memberRequests.gymId, gymIds));
  await db.delete(memberNotes).where(inArray(memberNotes.gymId, gymIds));
  await db.delete(payments).where(inArray(payments.gymId, gymIds));
  
  const demoAnnouncements = await db.select().from(announcements).where(inArray(announcements.gymId, gymIds));
  const announcementIds = demoAnnouncements.map(a => a.id);
  if (announcementIds.length > 0) {
    await db.delete(announcementReads).where(inArray(announcementReads.announcementId, announcementIds));
    await db.delete(announcements).where(inArray(announcements.id, announcementIds));
  }
  
  const demoFeedPosts = await db.select().from(feedPosts).where(inArray(feedPosts.gymId, gymIds));
  const feedPostIds = demoFeedPosts.map(p => p.id);
  if (feedPostIds.length > 0) {
    await db.delete(feedReactions).where(inArray(feedReactions.postId, feedPostIds));
    await db.delete(feedComments).where(inArray(feedComments.postId, feedPostIds));
    await db.delete(feedPosts).where(inArray(feedPosts.id, feedPostIds));
  }
  
  const demoTournaments = await db.select().from(tournaments).where(inArray(tournaments.gymId, gymIds));
  const tournamentIds = demoTournaments.map(t => t.id);
  if (tournamentIds.length > 0) {
    await db.delete(tournamentParticipants).where(inArray(tournamentParticipants.tournamentId, tournamentIds));
    await db.delete(tournaments).where(inArray(tournaments.id, tournamentIds));
  }
  
  const templates = await db.select().from(workoutTemplates).where(inArray(workoutTemplates.gymId, gymIds));
  const templateIds = templates.map(t => t.id);
  if (templateIds.length > 0) {
    await db.delete(workoutTemplateItems).where(inArray(workoutTemplateItems.templateId, templateIds));
    await db.delete(workoutTemplates).where(inArray(workoutTemplates.id, templateIds));
  }
  
  const diets = await db.select().from(dietPlans).where(inArray(dietPlans.gymId, gymIds));
  const dietIds = diets.map(d => d.id);
  if (dietIds.length > 0) {
    await db.delete(dietPlanMeals).where(inArray(dietPlanMeals.planId, dietIds));
    await db.delete(dietPlans).where(inArray(dietPlans.id, dietIds));
  }
  
  const demoUsers = await db.select().from(users).where(inArray(users.gymId, gymIds));
  const userIds = demoUsers.map(u => u.id);
  
  if (userIds.length > 0) {
    await db.delete(transferRequests).where(inArray(transferRequests.memberId, userIds));
    await db.delete(joinRequests).where(inArray(joinRequests.userId, userIds));
  }
  
  await db.delete(gymSubscriptions).where(inArray(gymSubscriptions.gymId, gymIds));
  await db.delete(users).where(inArray(users.gymId, gymIds));
  
  for (const gymId of gymIds) {
    await db.update(gyms).set({ ownerUserId: null }).where(eq(gyms.id, gymId));
    await db.delete(gyms).where(eq(gyms.id, gymId));
  }
  
  console.log("[Demo Reset] Perfect demo data cleared successfully!");
}

export async function seedPerfectDemoData(): Promise<void> {
  console.log("\n========================================");
  console.log("SEEDING PERFECT DEMO GYM DATA");
  console.log("========================================\n");
  
  const existingDemoGym = await db.select().from(gyms).where(eq(gyms.code, DEMO_GYM_CODE)).limit(1);
  
  if (existingDemoGym.length > 0) {
    console.log("[Demo Seed] Perfect demo gym already exists. Run reset first.");
    console.log("Command: npx tsx server/run-perfect-seed.ts --reset");
    return;
  }

  const hashedPassword = await hashPassword("demo123");
  const today = new Date();
  const historyStartDays = 180;
  const historyEndDays = 0;
  const MEMBER_COUNT = 55;
  const TRAINER_COUNT = 5;
  
  const stats = {
    gyms: 0, trainers: 0, members: 0, workoutCycles: 0, workoutCompletions: 0,
    payments: 0, dietPlans: 0, bodyMeasurements: 0, announcements: 0,
    starMembers: 0, memberNotes: 0, trainingPhases: 0, templates: 0,
    transfers: 0, joinRequests: 0, feedPosts: 0, feedReactions: 0,
    feedComments: 0, tournaments: 0, tournamentParticipants: 0,
    partialDays: 0, missedDays: 0
  };

  console.log("[Demo Seed] Creating OGym Demo Elite...");
  
  const [mainGym] = await db.insert(gyms).values({
    name: "OGym Demo Elite",
    code: DEMO_GYM_CODE,
    phone: "+91 9876543210",
    address: "Plot 42, Jubilee Hills, Hyderabad, Telangana 500033",
  }).returning();
  stats.gyms++;
  
  const [owner] = await db.insert(users).values({
    username: "ogym_demo_owner",
    password: hashedPassword,
    role: "owner",
    gymId: mainGym.id,
    publicId: generatePublicId("OWN"),
    email: "owner@ogymdemo.in",
    phone: "+91 9876543210",
  }).returning();
  
  await db.update(gyms).set({ ownerUserId: owner.id }).where(eq(gyms.id, mainGym.id));
  
  await db.insert(gymSubscriptions).values({
    gymId: mainGym.id,
    planType: "6_month",
    amountPaid: 1000000,
    paymentStatus: "paid",
    paidOn: subDays(today, 30),
    validUntil: addMonths(today, 5),
    notes: "6-month platform subscription - Active",
  });
  
  const [secondaryGym] = await db.insert(gyms).values({
    name: "OGym Transfer Partner",
    code: SECONDARY_GYM_CODE,
    phone: "+91 9123456789",
    address: "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
  }).returning();
  stats.gyms++;
  
  const [secondaryOwner] = await db.insert(users).values({
    username: "ogym_partner_owner",
    password: hashedPassword,
    role: "owner",
    gymId: secondaryGym.id,
    publicId: generatePublicId("OWN"),
    email: "partner@ogymdemo.in",
    phone: "+91 9123456789",
  }).returning();
  
  await db.update(gyms).set({ ownerUserId: secondaryOwner.id }).where(eq(gyms.id, secondaryGym.id));
  
  await db.insert(gymSubscriptions).values({
    gymId: secondaryGym.id,
    planType: "1_month",
    amountPaid: 200000,
    paymentStatus: "paid",
    paidOn: subDays(today, 10),
    validUntil: addMonths(today, 1),
    notes: "Partner gym for transfers",
  });
  
  const plans: any[] = [];
  const [planMonthly] = await db.insert(membershipPlans).values({
    gymId: mainGym.id, name: "Monthly Basic", durationMonths: 1, priceAmount: 150000, isActive: true,
  }).returning();
  plans.push(planMonthly);
  
  const [planQuarterly] = await db.insert(membershipPlans).values({
    gymId: mainGym.id, name: "Quarterly Standard", durationMonths: 3, priceAmount: 400000, isActive: true,
  }).returning();
  plans.push(planQuarterly);
  
  const [planHalfYear] = await db.insert(membershipPlans).values({
    gymId: mainGym.id, name: "Half-Year Premium", durationMonths: 6, priceAmount: 700000, isActive: true,
  }).returning();
  plans.push(planHalfYear);
  
  console.log("[Demo Seed] Creating trainers...");
  const trainers: any[] = [];
  for (let t = 0; t < TRAINER_COUNT; t++) {
    const trainerName = TRAINER_NAMES[t];
    const trainerUsername = `${trainerName.first.toLowerCase()}_trainer`;
    
    const [trainer] = await db.insert(users).values({
      username: trainerUsername,
      password: hashedPassword,
      role: "trainer",
      gymId: mainGym.id,
      publicId: generatePublicId("TRN"),
      email: `${trainerName.first.toLowerCase()}@ogymdemo.in`,
      phone: `+91 98${getRandomInt(10000000, 99999999)}`,
    }).returning();
    
    trainers.push(trainer);
    stats.trainers++;
    
    const template = WORKOUT_TEMPLATES[t % WORKOUT_TEMPLATES.length];
    const [wt] = await db.insert(workoutTemplates).values({
      gymId: mainGym.id,
      trainerId: trainer.id,
      name: template.name,
      description: template.description,
      daysPerCycle: template.cycleLength,
      dayLabels: template.dayLabels,
      isActive: true,
    }).returning();
    
    for (let dayIdx = 0; dayIdx < template.days.length; dayIdx++) {
      const dayData = template.days[dayIdx];
      for (let exIdx = 0; exIdx < dayData.exercises.length; exIdx++) {
        const ex = dayData.exercises[exIdx];
        await db.insert(workoutTemplateItems).values({
          templateId: wt.id,
          dayIndex: dayIdx,
          muscleType: ex.muscle,
          bodyPart: ex.body,
          exerciseName: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          orderIndex: exIdx,
        });
      }
    }
    stats.templates++;
  }
  console.log(`  Created ${TRAINER_COUNT} trainers with templates`);
  
  console.log("[Demo Seed] Creating members...");
  const members: any[] = [];
  const usedNames = new Set<string>();
  
  const CONSISTENCY_PROFILES = [
    { name: "very_consistent", daysPerWeek: [5, 6], percentage: 0.20 },
    { name: "moderate", daysPerWeek: [3, 4], percentage: 0.50 },
    { name: "irregular", daysPerWeek: [0, 1, 2], percentage: 0.30 }
  ];
  
  function assignConsistencyProfile(): string {
    const rand = Math.random();
    let cumulative = 0;
    for (const profile of CONSISTENCY_PROFILES) {
      cumulative += profile.percentage;
      if (rand <= cumulative) return profile.name;
    }
    return "moderate";
  }
  
  function getDaysPerWeek(profile: string): number {
    const config = CONSISTENCY_PROFILES.find(p => p.name === profile);
    if (!config) return 3;
    return getRandomElement(config.daysPerWeek);
  }
  
  for (let m = 0; m < MEMBER_COUNT; m++) {
    let firstName: string;
    let attempts = 0;
    do {
      firstName = getRandomElement(FIRST_NAMES);
      attempts++;
    } while (usedNames.has(firstName) && attempts < 50);
    usedNames.add(firstName);
    
    const memberUsername = `${firstName.toLowerCase()}_member${m}`;
    const isCompletionMode = m < Math.floor(MEMBER_COUNT * 0.3);
    const consistencyProfile = assignConsistencyProfile();
    
    const [member] = await db.insert(users).values({
      username: memberUsername,
      password: hashedPassword,
      role: "member",
      gymId: mainGym.id,
      publicId: generatePublicId("MEM"),
      email: `${firstName.toLowerCase()}${getRandomInt(1, 999)}@gmail.com`,
      phone: `+91 ${getRandomInt(7000000000, 9999999999)}`,
    }).returning();
    
    const assignedTrainer = trainers[m % trainers.length];
    
    members.push({
      ...member,
      consistencyProfile,
      isCompletionMode,
      assignedTrainer,
      firstName
    });
    stats.members++;
    
    await db.insert(trainerMembers).values({
      gymId: mainGym.id,
      trainerId: assignedTrainer.id,
      memberId: member.id,
    });
    
    await db.insert(trainerMemberAssignments).values({
      gymId: mainGym.id,
      trainerId: assignedTrainer.id,
      memberId: member.id,
      startedAt: subDays(today, historyStartDays + getRandomInt(0, 10)),
    });
    
    await db.insert(gymHistory).values({
      gymId: mainGym.id,
      memberId: member.id,
      joinedAt: subDays(today, historyStartDays + getRandomInt(0, 15)),
    });
    
    const joinDateOffset = getRandomInt(0, 30);
    const joinDate = subDays(today, historyStartDays + joinDateOffset);
    const selectedPlan = getRandomElement(plans);
    const endDate = addMonths(joinDate, selectedPlan.durationMonths);
    
    let status: "active" | "ended" | "endingSoon" | "overdue" = "active";
    const rand = Math.random();
    if (rand < 0.08) status = "ended";
    else if (rand < 0.15) status = "endingSoon";
    else if (rand < 0.25) status = "overdue";
    
    const paymentMode = rand < 0.60 ? "full" : (rand < 0.80 ? "partial" : "emi");
    
    const [subscription] = await db.insert(memberSubscriptions).values({
      gymId: mainGym.id,
      memberId: member.id,
      planId: selectedPlan.id,
      startDate: format(joinDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      status,
      totalAmount: selectedPlan.priceAmount,
      paymentMode,
      notes: paymentMode === "emi" ? "3 EMI payments" : null,
    }).returning();
    
    members[m].subscription = subscription;
    members[m].plan = selectedPlan;
    
    if (paymentMode === "full" && status !== "overdue") {
      await db.insert(paymentTransactions).values({
        gymId: mainGym.id,
        memberId: member.id,
        subscriptionId: subscription.id,
        paidOn: format(joinDate, "yyyy-MM-dd"),
        amountPaid: selectedPlan.priceAmount,
        method: getRandomElement(["cash", "upi", "card", "bank"]),
        referenceNote: `Full payment - ${selectedPlan.name}`,
      });
      stats.payments++;
    } else if (paymentMode === "partial" || paymentMode === "emi") {
      const numPayments = paymentMode === "emi" ? 3 : 2;
      const paymentAmount = Math.floor(selectedPlan.priceAmount / numPayments);
      const paymentsMade = status === "overdue" ? 1 : (Math.random() > 0.3 ? numPayments : numPayments - 1);
      
      for (let p = 0; p < paymentsMade; p++) {
        const payDate = addDays(joinDate, p * 15);
        if (payDate <= today) {
          await db.insert(paymentTransactions).values({
            gymId: mainGym.id,
            memberId: member.id,
            subscriptionId: subscription.id,
            paidOn: format(payDate, "yyyy-MM-dd"),
            amountPaid: paymentAmount,
            method: getRandomElement(["cash", "upi", "card"]),
            referenceNote: `${paymentMode.toUpperCase()} ${p + 1}/${numPayments}`,
          });
          stats.payments++;
        }
      }
    } else if (status === "overdue") {
      const partialAmount = Math.floor(selectedPlan.priceAmount * 0.3);
      await db.insert(paymentTransactions).values({
        gymId: mainGym.id,
        memberId: member.id,
        subscriptionId: subscription.id,
        paidOn: format(joinDate, "yyyy-MM-dd"),
        amountPaid: partialAmount,
        method: "cash",
        referenceNote: "Partial advance payment",
      });
      stats.payments++;
    }
  }
  console.log(`  Created ${MEMBER_COUNT} members (${Math.floor(MEMBER_COUNT * 0.3)} completion mode, ${MEMBER_COUNT - Math.floor(MEMBER_COUNT * 0.3)} calendar mode)`);
  console.log(`  Created ${stats.payments} payment transactions`);
  
  console.log("[Demo Seed] Creating workout cycles and completions...");
  for (const member of members) {
    const templateIndex = trainers.findIndex((t: any) => t.id === member.assignedTrainer.id);
    const template = WORKOUT_TEMPLATES[templateIndex % WORKOUT_TEMPLATES.length];
    
    const cycleStart = subDays(today, historyStartDays);
    const cycleEnd = addDays(today, 30);
    
    const [cycle] = await db.insert(workoutCycles).values({
      gymId: mainGym.id,
      trainerId: member.assignedTrainer.id,
      memberId: member.id,
      name: template.name,
      cycleLength: template.cycleLength,
      dayLabels: template.dayLabels,
      restDays: template.restDays || [],
      startDate: format(cycleStart, "yyyy-MM-dd"),
      endDate: format(cycleEnd, "yyyy-MM-dd"),
      progressionMode: member.isCompletionMode ? "completion" : "calendar",
      currentDayIndex: member.isCompletionMode ? getRandomInt(0, template.cycleLength - 1) : 0,
      isActive: true,
    }).returning();
    stats.workoutCycles++;
    member.cycle = cycle;
    
    const itemsForCycle: any[] = [];
    for (let dayIdx = 0; dayIdx < template.days.length; dayIdx++) {
      const dayTemplate = template.days[dayIdx];
      for (let exIdx = 0; exIdx < dayTemplate.exercises.length; exIdx++) {
        const ex = dayTemplate.exercises[exIdx];
        const weightVariation = Math.random() > 0.5 ? getRandomInt(-5, 10) : 0;
        let adjustedWeight = ex.weight;
        if (ex.weight && ex.weight !== "BW" && ex.weight !== "sec" && ex.weight !== "m") {
          const baseWeight = parseInt(ex.weight);
          if (!isNaN(baseWeight)) {
            adjustedWeight = `${baseWeight + weightVariation}kg`;
          }
        }
        
        const [item] = await db.insert(workoutItems).values({
          cycleId: cycle.id,
          dayIndex: dayIdx,
          muscleType: ex.muscle,
          bodyPart: ex.body,
          exerciseName: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: adjustedWeight,
          orderIndex: exIdx,
        }).returning();
        
        itemsForCycle.push({ ...item, dayIdx });
      }
    }
    member.cycleItems = itemsForCycle;
    
    const daysPerWeek = getDaysPerWeek(member.consistencyProfile);
    const workoutDays = generateWorkoutDays(historyStartDays, historyEndDays, daysPerWeek);
    
    for (const workoutDate of workoutDays) {
      const daysSinceStart = Math.floor(
        (new Date(workoutDate).getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const currentDayIndex = ((daysSinceStart % template.cycleLength) + template.cycleLength) % template.cycleLength;
      
      if (template.restDays?.includes(currentDayIndex)) {
        continue;
      }
      
      const effectiveDayIndex = currentDayIndex < template.days.length ? currentDayIndex : currentDayIndex % template.days.length;
      const dayItems = itemsForCycle.filter((i: any) => i.dayIdx === effectiveDayIndex);
      
      if (dayItems.length === 0) continue;
      
      let completionRate: number;
      const dayRand = Math.random();
      
      if (member.consistencyProfile === "very_consistent") {
        if (dayRand < 0.85) completionRate = 1.0;
        else if (dayRand < 0.95) completionRate = 0.5 + Math.random() * 0.4;
        else completionRate = 0;
      } else if (member.consistencyProfile === "moderate") {
        if (dayRand < 0.70) completionRate = 1.0;
        else if (dayRand < 0.90) completionRate = 0.3 + Math.random() * 0.5;
        else completionRate = 0;
      } else {
        if (dayRand < 0.50) completionRate = 1.0;
        else if (dayRand < 0.75) completionRate = 0.2 + Math.random() * 0.5;
        else completionRate = 0;
      }
      
      if (completionRate === 0) {
        stats.missedDays++;
        continue;
      }
      
      const exercisesToComplete = Math.max(1, Math.round(dayItems.length * completionRate));
      const shuffledItems = [...dayItems].sort(() => Math.random() - 0.5);
      const completedItems = shuffledItems.slice(0, exercisesToComplete);
      
      if (completionRate < 1.0) {
        stats.partialDays++;
      }
      
      for (const item of completedItems) {
        const setsVar = Math.random() > 0.8 ? getRandomInt(-1, 1) : 0;
        const repsVar = Math.random() > 0.7 ? getRandomInt(-2, 2) : 0;
        
        const notes = Math.random() > 0.92 ? 
          getRandomElement(["Felt strong", "Struggled a bit", "New PR!", "Need more rest", "Good pump", "Form check needed"]) : 
          null;
        
        await db.insert(workoutCompletions).values({
          gymId: mainGym.id,
          cycleId: cycle.id,
          workoutItemId: item.id,
          memberId: member.id,
          completedDate: workoutDate,
          actualSets: Math.max(1, item.sets + setsVar),
          actualReps: Math.max(1, item.reps + repsVar),
          actualWeight: item.weight,
          notes,
        });
        stats.workoutCompletions++;
      }
      
      if (completedItems.length > 0) {
        await db.insert(attendance).values({
          gymId: mainGym.id,
          memberId: member.id,
          markedByUserId: member.id,
          date: workoutDate,
          status: "present",
          verifiedMethod: getRandomElement(["workout", "qr", "both"]),
        });
      }
    }
  }
  console.log(`  Created ${stats.workoutCycles} workout cycles with ${stats.workoutCompletions} completions`);
  console.log(`  Partial days: ${stats.partialDays}, Fully missed days: ${stats.missedDays}`);
  
  console.log("[Demo Seed] Creating star members, diet plans, and training phases...");
  const starMemberCandidates = members.filter(m => m.consistencyProfile === "very_consistent").slice(0, 12);
  for (const starMember of starMemberCandidates) {
    await db.insert(starMembers).values({
      gymId: mainGym.id,
      trainerId: starMember.assignedTrainer.id,
      memberId: starMember.id,
    });
    stats.starMembers++;
    
    if (Math.random() > 0.3) {
      const dietTemplate = getRandomElement(DIET_PLAN_TEMPLATES);
      const [dietPlan] = await db.insert(dietPlans).values({
        gymId: mainGym.id,
        trainerId: starMember.assignedTrainer.id,
        memberId: starMember.id,
        title: dietTemplate.title,
        durationWeeks: dietTemplate.durationWeeks,
        notes: dietTemplate.notes,
        isActive: true,
      }).returning();
      
      for (const meal of dietTemplate.meals) {
        await db.insert(dietPlanMeals).values({
          planId: dietPlan.id,
          dayIndex: meal.dayIndex,
          mealType: meal.mealType,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein,
          orderIndex: 0,
        });
      }
      stats.dietPlans++;
    }
  }
  
  const phaseMembers = members.slice(0, 25);
  const goalTypes = ["cut", "bulk", "strength", "endurance", "rehab", "general"] as const;
  const phaseNames: Record<string, string[]> = {
    cut: ["Summer Cut", "Fat Loss Phase", "Shred Phase", "Cutting Block"],
    bulk: ["Muscle Building", "Off-Season Bulk", "Mass Phase", "Hypertrophy Block"],
    strength: ["Strength Block", "Power Phase", "Max Strength", "Powerlifting Prep"],
    endurance: ["Cardio Focus", "Conditioning Phase", "Endurance Block", "Stamina Build"],
    rehab: ["Recovery Phase", "Rehab Block", "Return to Training", "Injury Recovery"],
    general: ["Fitness Phase", "General Conditioning", "Base Building", "Maintenance Phase"]
  };
  
  for (const member of phaseMembers) {
    const numPhases = getRandomInt(2, 3);
    
    for (let pi = 0; pi < numPhases; pi++) {
      const phaseStartOffset = 30 + (pi * 60);
      const phaseDuration = getRandomInt(28, 42);
      const phaseStart = subDays(today, phaseStartOffset + phaseDuration);
      const phaseEnd = subDays(today, phaseStartOffset);
      const goalType = getRandomElement([...goalTypes]);
      
      const useCustomExercises = Math.random() > 0.7;
      
      const [phase] = await db.insert(trainingPhases).values({
        gymId: mainGym.id,
        trainerId: member.assignedTrainer.id,
        memberId: member.id,
        cycleId: useCustomExercises ? null : member.cycle.id,
        name: getRandomElement(phaseNames[goalType]),
        goalType,
        startDate: format(phaseStart, "yyyy-MM-dd"),
        endDate: format(phaseEnd, "yyyy-MM-dd"),
        autoAssignCycle: !useCustomExercises && Math.random() > 0.5,
        useCustomExercises,
        notes: pi === 0 ? "Good progress so far. Keep pushing!" : null,
      }).returning();
      stats.trainingPhases++;
      
      if (useCustomExercises) {
        const phaseTemplates = WORKOUT_TEMPLATES[getRandomInt(0, WORKOUT_TEMPLATES.length - 1)];
        for (let dayIdx = 0; dayIdx < Math.min(3, phaseTemplates.days.length); dayIdx++) {
          const dayData = phaseTemplates.days[dayIdx];
          for (let exIdx = 0; exIdx < Math.min(4, dayData.exercises.length); exIdx++) {
            const ex = dayData.exercises[exIdx];
            await db.insert(phaseExercises).values({
              phaseId: phase.id,
              dayIndex: dayIdx,
              muscleType: ex.muscle,
              bodyPart: ex.body,
              exerciseName: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              orderIndex: exIdx,
            });
          }
        }
      }
    }
  }
  console.log(`  Created ${stats.starMembers} star members, ${stats.dietPlans} diet plans, ${stats.trainingPhases} training phases`);
  
  for (const member of members.slice(0, 40)) {
    if (Math.random() > 0.5) {
      await db.insert(memberNotes).values({
        gymId: mainGym.id,
        trainerId: member.assignedTrainer.id,
        memberId: member.id,
        content: getRandomElement(MEMBER_NOTE_TEMPLATES),
      });
      stats.memberNotes++;
    }
  }
  
  console.log("[Demo Seed] Creating body measurements...");
  for (const member of members) {
    const isMale = members.indexOf(member) % 3 !== 0;
    let baseWeight = isMale ? getRandomInt(65, 90) : getRandomInt(50, 70);
    const baseHeight = isMale ? getRandomInt(165, 185) : getRandomInt(155, 170);
    let baseBodyFat = isMale ? getRandomInt(15, 25) : getRandomInt(22, 32);
    let baseChest = isMale ? getRandomInt(90, 105) : getRandomInt(80, 95);
    let baseWaist = isMale ? getRandomInt(78, 95) : getRandomInt(65, 80);
    let baseHips = isMale ? getRandomInt(90, 100) : getRandomInt(90, 105);
    let baseBiceps = isMale ? getRandomInt(30, 38) : getRandomInt(25, 32);
    let baseThighs = isMale ? getRandomInt(50, 60) : getRandomInt(48, 58);
    
    const profile = members.indexOf(member) % 4 === 0 ? "fat_loss" : 
                    members.indexOf(member) % 4 === 1 ? "muscle_gain" : 
                    members.indexOf(member) % 4 === 2 ? "recomp" : "inconsistent";
    
    const frequency = member.consistencyProfile === "very_consistent" ? 7 : 
                      member.consistencyProfile === "moderate" ? 14 : 21;
    
    const measurementDays: number[] = [];
    for (let d = historyStartDays; d >= 0; d -= frequency + getRandomInt(-2, 2)) {
      measurementDays.push(d);
    }
    
    for (let i = 0; i < measurementDays.length; i++) {
      const daysAgo = Math.max(0, measurementDays[i]);
      const measureDate = format(subDays(today, daysAgo), "yyyy-MM-dd");
      const progressFactor = i / Math.max(1, measurementDays.length - 1);
      
      let weight = baseWeight;
      let bodyFat = baseBodyFat;
      let chest = baseChest;
      let waist = baseWaist;
      let hips = baseHips;
      let biceps = baseBiceps;
      let thighs = baseThighs;
      
      if (profile === "fat_loss") {
        weight = baseWeight - progressFactor * getRandomInt(10, 40) / 10;
        bodyFat = baseBodyFat - progressFactor * getRandomInt(10, 30) / 10;
        waist = baseWaist - progressFactor * getRandomInt(20, 60) / 10;
      } else if (profile === "muscle_gain") {
        weight = baseWeight + progressFactor * getRandomInt(5, 30) / 10;
        chest = baseChest + progressFactor * getRandomInt(10, 30) / 10;
        biceps = baseBiceps + progressFactor * getRandomInt(5, 15) / 10;
        thighs = baseThighs + progressFactor * getRandomInt(5, 20) / 10;
      } else if (profile === "recomp") {
        weight = baseWeight + (Math.random() - 0.5) * 2;
        waist = baseWaist - progressFactor * getRandomInt(5, 20) / 10;
        chest = baseChest + progressFactor * getRandomInt(5, 15) / 10;
      } else {
        weight = baseWeight + (Math.random() - 0.5) * 6;
        waist = baseWaist + (Math.random() - 0.5) * 4;
      }
      
      weight = Math.round((weight + (Math.random() - 0.5) * 1) * 10) / 10;
      
      await db.insert(bodyMeasurements).values({
        gymId: mainGym.id,
        memberId: member.id,
        recordedDate: measureDate,
        weight: Math.round(weight),
        height: baseHeight,
        bodyFat: Math.random() > 0.3 ? Math.round(bodyFat) : null,
        chest: Math.random() > 0.2 ? Math.round(chest) : null,
        waist: Math.round(waist),
        hips: Math.random() > 0.4 ? Math.round(hips) : null,
        biceps: Math.random() > 0.5 ? Math.round(biceps) : null,
        thighs: Math.random() > 0.5 ? Math.round(thighs) : null,
        notes: null,
      });
      stats.bodyMeasurements++;
    }
  }
  console.log(`  Created ${stats.bodyMeasurements} body measurements`);
  
  console.log("[Demo Seed] Creating announcements...");
  for (let month = 0; month < 6; month++) {
    const announcementsThisMonth = getRandomInt(2, 3);
    for (let a = 0; a < announcementsThisMonth; a++) {
      const template = ANNOUNCEMENT_TEMPLATES[(month * 2 + a) % ANNOUNCEMENT_TEMPLATES.length];
      const daysAgo = month * 30 + getRandomInt(5, 25);
      
      const [announcement] = await db.insert(announcements).values({
        gymId: mainGym.id,
        title: template.title,
        body: template.body,
        audience: template.audience,
        createdByOwnerId: owner.id,
        createdAt: subDays(today, daysAgo),
      }).returning();
      stats.announcements++;
      
      const targetUsers = template.audience === "trainers" 
        ? trainers 
        : template.audience === "members" 
          ? members 
          : [...trainers, ...members];
      
      const readPercentage = Math.random() * 0.6 + 0.2;
      const usersToMark = targetUsers.slice(0, Math.floor(targetUsers.length * readPercentage));
      
      for (const user of usersToMark) {
        await db.insert(announcementReads).values({
          announcementId: announcement.id,
          userId: user.id,
          readAt: subDays(today, daysAgo - getRandomInt(0, Math.min(daysAgo, 5))),
        });
      }
    }
  }
  console.log(`  Created ${stats.announcements} announcements with read tracking`);
  
  console.log("[Demo Seed] Creating tournaments...");
  const tournamentConfigs = [
    { name: "January Points Challenge", metric: "workout_count" as const, startDaysAgo: 180, endDaysAgo: 150, status: "completed" as const },
    { name: "February Attendance Champion", metric: "attendance_days" as const, startDaysAgo: 150, endDaysAgo: 120, status: "completed" as const },
    { name: "March Exercise Marathon", metric: "total_exercises" as const, startDaysAgo: 120, endDaysAgo: 90, status: "completed" as const },
    { name: "April Streak King/Queen", metric: "streak_days" as const, startDaysAgo: 90, endDaysAgo: 60, status: "completed" as const },
    { name: "May Fitness Frenzy", metric: "workout_count" as const, startDaysAgo: 60, endDaysAgo: 30, status: "completed" as const },
    { name: "June Summer Challenge", metric: "total_exercises" as const, startDaysAgo: 30, endDaysAgo: -1, status: "active" as const },
    { name: "July Transformation", metric: "workout_count" as const, startDaysAgo: -7, endDaysAgo: -37, status: "upcoming" as const },
  ];
  
  for (const config of tournamentConfigs) {
    const [tournament] = await db.insert(tournaments).values({
      gymId: mainGym.id,
      createdByUserId: owner.id,
      name: config.name,
      description: `Complete as many ${config.metric.replace('_', ' ')} as possible! Top 3 winners get rewards.`,
      metricType: config.metric,
      startDate: format(subDays(today, config.startDaysAgo), "yyyy-MM-dd"),
      endDate: format(subDays(today, config.endDaysAgo), "yyyy-MM-dd"),
      status: config.status,
      prizeDescription: config.status === "completed" ? "Winners announced!" : "1st: Free Month | 2nd: 50% Off | 3rd: Merchandise",
      maxParticipants: 50,
      isPublic: true,
    }).returning();
    stats.tournaments++;
    
    const participantMembers = config.status === "upcoming" 
      ? members.slice(0, getRandomInt(10, 25))
      : members.slice(0, getRandomInt(30, Math.min(50, members.length)));
    
    for (const member of participantMembers) {
      const score = config.status === "completed" 
        ? (member.consistencyProfile === "very_consistent" ? getRandomInt(20, 35) : 
           member.consistencyProfile === "moderate" ? getRandomInt(10, 25) : getRandomInt(3, 15))
        : (config.status === "active" ? getRandomInt(5, 20) : 0);
      
      await db.insert(tournamentParticipants).values({
        tournamentId: tournament.id,
        userId: member.id,
        currentScore: score,
        joinedAt: subDays(today, config.startDaysAgo - getRandomInt(0, 5)),
      });
      stats.tournamentParticipants++;
    }
  }
  console.log(`  Created ${stats.tournaments} tournaments with ${stats.tournamentParticipants} participants`);
  
  console.log("[Demo Seed] Creating social feed...");
  const COMMENT_TEMPLATES = ["Great work!", "Keep it up!", "Inspiring!", "Amazing progress!", "You're crushing it!", "Well done!", "Let's go!", "Proud of you!"];
  const reactionTypes: ("like" | "fire" | "muscle" | "clap")[] = ["like", "fire", "muscle", "clap"];
  
  for (const member of members.slice(0, 15)) {
    const joinDaysAgo = getRandomInt(30, historyStartDays);
    await db.insert(feedPosts).values({
      gymId: mainGym.id,
      userId: member.id,
      type: "new_member",
      content: null,
      metadata: JSON.stringify({}),
      isVisible: true,
      createdAt: subDays(today, joinDaysAgo),
    });
    stats.feedPosts++;
  }
  
  const consistentMembers = members.filter(m => m.consistencyProfile === "very_consistent").slice(0, 12);
  for (const member of consistentMembers) {
    for (let month = 0; month < 6; month++) {
      const postsThisMonth = getRandomInt(2, 4);
      for (let p = 0; p < postsThisMonth; p++) {
        const daysAgo = month * 30 + getRandomInt(0, 28);
        if (daysAgo <= historyStartDays) {
          const [post] = await db.insert(feedPosts).values({
            gymId: mainGym.id,
            userId: member.id,
            type: "workout_complete",
            content: null,
            metadata: JSON.stringify({ 
              exerciseCount: getRandomInt(4, 8), 
              focusLabel: getRandomElement(["Push Day", "Pull Day", "Leg Day", "Upper Body", "Lower Body", "Full Body"]) 
            }),
            isVisible: true,
            createdAt: subDays(today, daysAgo),
          }).returning();
          stats.feedPosts++;
          
          const reactorCount = getRandomInt(2, 8);
          const reactors = members.filter(m => m.id !== member.id).slice(0, reactorCount);
          for (const reactor of reactors) {
            await db.insert(feedReactions).values({
              postId: post.id,
              userId: reactor.id,
              reactionType: getRandomElement(reactionTypes),
            });
            stats.feedReactions++;
          }
          
          if (Math.random() > 0.5) {
            const commenters = members.filter(m => m.id !== member.id).slice(0, getRandomInt(1, 2));
            for (const commenter of commenters) {
              await db.insert(feedComments).values({
                postId: post.id,
                userId: commenter.id,
                content: getRandomElement(COMMENT_TEMPLATES),
                createdAt: subDays(today, daysAgo - getRandomInt(0, 1)),
              });
              stats.feedComments++;
            }
          }
        }
      }
    }
  }
  
  for (const member of consistentMembers.slice(0, 8)) {
    const streakMilestones = [7, 14, 30, 60];
    for (const streak of streakMilestones) {
      if (Math.random() > 0.4) {
        const daysAgo = getRandomInt(streak, 150);
        const [post] = await db.insert(feedPosts).values({
          gymId: mainGym.id,
          userId: member.id,
          type: "streak_milestone",
          content: null,
          metadata: JSON.stringify({ streakDays: streak }),
          isVisible: true,
          createdAt: subDays(today, daysAgo),
        }).returning();
        stats.feedPosts++;
        
        const reactorCount = getRandomInt(3, 12);
        const reactors = members.filter(m => m.id !== member.id).slice(0, reactorCount);
        for (const reactor of reactors) {
          await db.insert(feedReactions).values({
            postId: post.id,
            userId: reactor.id,
            reactionType: getRandomElement(reactionTypes),
          });
          stats.feedReactions++;
        }
      }
    }
  }
  
  for (const member of consistentMembers.slice(0, 6)) {
    const [post] = await db.insert(feedPosts).values({
      gymId: mainGym.id,
      userId: member.id,
      type: "achievement",
      content: null,
      metadata: JSON.stringify({ 
        type: "personal_record", 
        exercise: getRandomElement(["Bench Press", "Squat", "Deadlift", "Overhead Press"]), 
        value: `${getRandomInt(60, 140)}kg` 
      }),
      isVisible: true,
      createdAt: subDays(today, getRandomInt(5, 60)),
    }).returning();
    stats.feedPosts++;
    
    const reactorCount = getRandomInt(5, 15);
    const reactors = members.filter(m => m.id !== member.id).slice(0, reactorCount);
    for (const reactor of reactors) {
      await db.insert(feedReactions).values({
        postId: post.id,
        userId: reactor.id,
        reactionType: getRandomElement(reactionTypes),
      });
      stats.feedReactions++;
    }
  }
  console.log(`  Created ${stats.feedPosts} feed posts, ${stats.feedReactions} reactions, ${stats.feedComments} comments`);
  
  console.log("[Demo Seed] Creating transfer and join requests...");
  const transferMembers = members.slice(5, 10);
  for (let i = 0; i < transferMembers.length; i++) {
    const statuses = ["approved", "rejected", "pending", "pending", "approved"] as const;
    const status = statuses[i % statuses.length];
    
    await db.insert(transferRequests).values({
      memberId: transferMembers[i].id,
      fromGymId: mainGym.id,
      toGymId: secondaryGym.id,
      status,
      approvedByFromOwner: status === "approved",
      approvedByToOwner: status === "approved",
      createdAt: subDays(today, getRandomInt(3, 45)),
    });
    stats.transfers++;
  }
  
  for (let j = 0; j < 5; j++) {
    const member = members[getRandomInt(30, 50)];
    try {
      await db.insert(joinRequests).values({
        gymId: secondaryGym.id,
        userId: member.id,
        status: j < 3 ? "pending" : "approved",
        createdAt: subDays(today, getRandomInt(1, 30)),
        reviewedAt: j >= 3 ? subDays(today, getRandomInt(0, 5)) : null,
      });
      stats.joinRequests++;
    } catch (e) {
    }
  }
  console.log(`  Created ${stats.transfers} transfer requests, ${stats.joinRequests} join requests`);
  
  const calendarConsistent = members.filter(m => !m.isCompletionMode && m.consistencyProfile === "very_consistent").slice(0, 2);
  const calendarIrregular = members.filter(m => !m.isCompletionMode && m.consistencyProfile === "irregular").slice(0, 2);
  const completionConsistent = members.filter(m => m.isCompletionMode && m.consistencyProfile === "very_consistent").slice(0, 1);
  const completionIrregular = members.filter(m => m.isCompletionMode && m.consistencyProfile === "irregular").slice(0, 1);
  
  console.log("\n\n========================================");
  console.log("PERFECT DEMO LOGIN CREDENTIALS");
  console.log("========================================");
  console.log("Password for ALL demo accounts: demo123");
  console.log("========================================\n");
  
  console.log("ADMIN:");
  console.log("  Username: (Use ADMIN_USERNAME from environment)");
  console.log("  Password: (Use ADMIN_PASSWORD from environment)");
  console.log("");
  
  console.log("OGYM DEMO ELITE (Main Gym):");
  console.log(`  Owner: ${owner.username}`);
  console.log(`  Trainers: ${trainers[0].username}, ${trainers[1].username}`);
  console.log("");
  
  console.log("SAMPLE MEMBERS:");
  console.log("  Calendar Mode - Consistent:");
  for (const m of calendarConsistent) {
    console.log(`    - ${m.username} (${m.firstName}): Has ${stats.trainingPhases > 0 ? '2-3' : '0'} phases, regular measurements, high completion rate`);
  }
  console.log("  Calendar Mode - Irregular:");
  for (const m of calendarIrregular) {
    console.log(`    - ${m.username} (${m.firstName}): Sporadic attendance, many missed/partial days`);
  }
  console.log("  Completion Mode - Consistent:");
  for (const m of completionConsistent) {
    console.log(`    - ${m.username} (${m.firstName}): Completion mode, advances on workout complete`);
  }
  console.log("  Completion Mode - Irregular:");
  for (const m of completionIrregular) {
    console.log(`    - ${m.username} (${m.firstName}): Completion mode, gaps in activity`);
  }
  
  console.log("\n\n========================================");
  console.log("SEED SUMMARY");
  console.log("========================================");
  console.log(`Gyms created:            ${stats.gyms} (1 main + 1 for transfers)`);
  console.log(`Trainers created:        ${stats.trainers}`);
  console.log(`Members created:         ${stats.members} (${Math.floor(MEMBER_COUNT * 0.3)} completion, ${MEMBER_COUNT - Math.floor(MEMBER_COUNT * 0.3)} calendar)`);
  console.log(`Workout templates:       ${stats.templates}`);
  console.log(`Workout cycles:          ${stats.workoutCycles}`);
  console.log(`Workout completions:     ${stats.workoutCompletions}`);
  console.log(`Partial workout days:    ${stats.partialDays}`);
  console.log(`Fully missed days:       ${stats.missedDays}`);
  console.log(`Payments recorded:       ${stats.payments}`);
  console.log(`Diet plans:              ${stats.dietPlans}`);
  console.log(`Star members:            ${stats.starMembers}`);
  console.log(`Training phases:         ${stats.trainingPhases}`);
  console.log(`Member notes:            ${stats.memberNotes}`);
  console.log(`Body measurements:       ${stats.bodyMeasurements}`);
  console.log(`Announcements:           ${stats.announcements}`);
  console.log(`Transfer requests:       ${stats.transfers}`);
  console.log(`Join requests:           ${stats.joinRequests}`);
  console.log(`Feed posts:              ${stats.feedPosts}`);
  console.log(`Feed reactions:          ${stats.feedReactions}`);
  console.log(`Feed comments:           ${stats.feedComments}`);
  console.log(`Tournaments:             ${stats.tournaments}`);
  console.log(`Tournament participants: ${stats.tournamentParticipants}`);
  
  console.log("\n========================================");
  console.log("DEMO WALKTHROUGH PATH");
  console.log("========================================");
  console.log("1. Admin Login: Review gym subscriptions and platform status");
  console.log("2. Owner Dashboard: Check revenue, outstanding balances, payment breakdown");
  console.log("3. Owner Requests: View pending transfers and join requests");
  console.log("4. Owner Members: See member list with subscriptions, expiring soon, overdue");
  console.log("5. Owner Announcements: View created announcements and read stats");
  console.log("6. Trainer Dashboard: See assigned members, star members");
  console.log("7. Trainer Star Members: View phases, diet plans, detailed stats");
  console.log("8. Trainer Phases: Check phase analytics (workouts, points, measurements)");
  console.log("9. Member Dashboard: Check points earned today vs planned");
  console.log("10. Member Workouts: See history, missed workouts (partial + full)");
  console.log("11. Member Progress: View 6-month body measurement trends");
  console.log("12. Member Feed: Browse social activity with reactions/comments");
  console.log("13. Member Tournaments: View current leaderboard and past winners");
  console.log("14. Member Payments: Check payment history and outstanding dues");
  console.log("15. Member Attendance: View streak and attendance calendar");
  console.log("16. Completion Mode Member: Test day advancement on workout complete");
  
  console.log("\n========================================");
  console.log("COMMANDS");
  console.log("========================================");
  console.log("Run seed:    npx tsx server/run-perfect-seed.ts");
  console.log("Reset demo:  npx tsx server/run-perfect-seed.ts --reset");
  console.log("========================================\n");
}
