import { db } from "./db";
import { 
  users, gyms, gymSubscriptions, trainerMembers, trainerMemberAssignments,
  attendance, membershipPlans, memberSubscriptions, paymentTransactions, payments,
  workoutCycles, workoutItems, workoutCompletions, workoutSessions, workoutSessionExercises,
  bodyMeasurements, starMembers, gymHistory, dietPlans, dietPlanMeals, announcements, announcementReads,
  memberNotes, workoutTemplates, workoutTemplateItems, memberRequests, transferRequests, joinRequests,
  feedPosts, feedReactions, feedComments, tournaments, tournamentParticipants, memberRestDaySwaps,
  trainingPhases, userProfiles, supportTickets, supportMessages
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
  "Pankaj", "Komal", "Yash", "Garima", "Rishabh", "Aditi", "Tarun", "Megha",
  "Vishal", "Preeti", "Arun", "Shweta", "Sumit", "Radhika", "Kapil", "Namita",
  "Suresh", "Vandana", "Ramesh", "Rekha", "Mahesh", "Sunita", "Dinesh", "Geeta",
  "Ashok", "Savita", "Rajendra", "Manju", "Sandeep", "Nisha", "Deepak", "Seema",
  "Naveen", "Usha", "Manoj", "Kiran", "Vikas", "Asha", "Sanjay", "Mamta"
];

const GYM_CONFIGS = [
  {
    name: "IronForge Fitness",
    code: "IRONFORGE",
    phone: "+91 9876543210",
    address: "Plot 42, Jubilee Hills, Hyderabad, Telangana 500033",
    ownerUsername: "ironforge_owner",
    ownerEmail: "owner@ironforge.in",
    subscriptionStatus: "paid" as const,
    trainerCount: 5,
    memberCount: 80
  },
  {
    name: "PulseArena Gym",
    code: "PULSEARENA",
    phone: "+91 9123456780",
    address: "78 Indiranagar, 100 Feet Road, Bengaluru, Karnataka 560038",
    ownerUsername: "pulsearena_owner",
    ownerEmail: "owner@pulsearena.in",
    subscriptionStatus: "overdue" as const,
    trainerCount: 4,
    memberCount: 65
  }
];

const TRAINER_NAMES = [
  { first: "Rajesh", last: "Sharma" },
  { first: "Deepak", last: "Verma" },
  { first: "Sanjay", last: "Patel" },
  { first: "Sunita", last: "Reddy" },
  { first: "Kavitha", last: "Nair" },
  { first: "Manoj", last: "Kumar" },
  { first: "Anitha", last: "Rao" },
  { first: "Vijay", last: "Singh" },
  { first: "Lakshmi", last: "Menon" },
  { first: "Ravi", last: "Gupta" }
];

const WORKOUT_TEMPLATES_DATA = [
  {
    name: "PPL + Rest Split",
    description: "Push/Pull/Legs split with rest days. 7-day cycle with built-in recovery.",
    cycleLength: 7,
    restDays: [3, 6] as number[], // Wednesday and Saturday are rest days
    dayLabels: ["Push", "Pull", "Legs", "Rest Day", "Push", "Pull", "Rest Day"],
    days: [
      { label: "Push", muscles: "Chest+Shoulders+Triceps", exercises: [
        { name: "Bench Press", sets: 4, reps: 10, weight: "60kg", muscle: "Chest", body: "Upper Body" },
        { name: "Incline Dumbbell Press", sets: 3, reps: 12, weight: "20kg", muscle: "Chest", body: "Upper Body" },
        { name: "Overhead Press", sets: 4, reps: 8, weight: "40kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "10kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Tricep Pushdowns", sets: 3, reps: 12, weight: "25kg", muscle: "Triceps", body: "Arms" }
      ]},
      { label: "Pull", muscles: "Back+Biceps", exercises: [
        { name: "Deadlifts", sets: 4, reps: 6, weight: "100kg", muscle: "Back", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 4, reps: 10, weight: "50kg", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "60kg", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Curls", sets: 3, reps: 12, weight: "25kg", muscle: "Biceps", body: "Arms" }
      ]},
      { label: "Legs", muscles: "Quads+Hamstrings+Calves", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "80kg", muscle: "Quads", body: "Lower Body" },
        { name: "Leg Press", sets: 4, reps: 12, weight: "150kg", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 3, reps: 10, weight: "60kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "60kg", muscle: "Calves", body: "Lower Body" }
      ]}
      // Days 3 and 6 are rest days - no exercises
    ]
  },
  {
    name: "PPL Split - Beginner",
    description: "Push/Pull/Legs split for beginners. 6-day cycle with moderate volume.",
    cycleLength: 6,
    restDays: [] as number[],
    dayLabels: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
    days: [
      { label: "Push", muscles: "Chest+Shoulders+Triceps", exercises: [
        { name: "Bench Press", sets: 4, reps: 10, weight: "60kg", muscle: "Chest", body: "Upper Body" },
        { name: "Incline Dumbbell Press", sets: 3, reps: 12, weight: "20kg", muscle: "Chest", body: "Upper Body" },
        { name: "Overhead Press", sets: 4, reps: 8, weight: "40kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "10kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Tricep Pushdowns", sets: 3, reps: 12, weight: "25kg", muscle: "Triceps", body: "Arms" },
        { name: "Skull Crushers", sets: 3, reps: 10, weight: "20kg", muscle: "Triceps", body: "Arms" }
      ]},
      { label: "Pull", muscles: "Back+Biceps", exercises: [
        { name: "Deadlifts", sets: 4, reps: 6, weight: "100kg", muscle: "Back", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 4, reps: 10, weight: "50kg", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "60kg", muscle: "Back", body: "Upper Body" },
        { name: "Face Pulls", sets: 3, reps: 15, weight: "20kg", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Curls", sets: 3, reps: 12, weight: "25kg", muscle: "Biceps", body: "Arms" },
        { name: "Hammer Curls", sets: 3, reps: 10, weight: "12kg", muscle: "Biceps", body: "Arms" }
      ]},
      { label: "Legs", muscles: "Quads+Hamstrings+Calves", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "80kg", muscle: "Quads", body: "Lower Body" },
        { name: "Leg Press", sets: 4, reps: 12, weight: "150kg", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 3, reps: 10, weight: "60kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Leg Curls", sets: 3, reps: 12, weight: "40kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "60kg", muscle: "Calves", body: "Lower Body" },
        { name: "Lunges", sets: 3, reps: 12, weight: "20kg", muscle: "Quads", body: "Lower Body" }
      ]}
    ]
  },
  {
    name: "Upper Lower Split",
    description: "Classic upper/lower split. Great for intermediate lifters. 4-day cycle.",
    cycleLength: 4,
    restDays: [] as number[],
    dayLabels: ["Upper Body", "Lower Body", "Upper Body", "Lower Body"],
    days: [
      { label: "Upper Body", muscles: "Chest+Back+Shoulders+Arms", exercises: [
        { name: "Bench Press", sets: 4, reps: 8, weight: "70kg", muscle: "Chest", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "60kg", muscle: "Back", body: "Upper Body" },
        { name: "Overhead Press", sets: 3, reps: 10, weight: "40kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Pull Ups", sets: 3, reps: 8, weight: "BW", muscle: "Back", body: "Upper Body" },
        { name: "Dumbbell Curls", sets: 3, reps: 12, weight: "14kg", muscle: "Biceps", body: "Arms" },
        { name: "Tricep Dips", sets: 3, reps: 10, weight: "BW", muscle: "Triceps", body: "Arms" }
      ]},
      { label: "Lower Body", muscles: "Quads+Hamstrings+Glutes", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "90kg", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 4, reps: 10, weight: "70kg", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Leg Press", sets: 3, reps: 12, weight: "160kg", muscle: "Quads", body: "Lower Body" },
        { name: "Hip Thrusts", sets: 3, reps: 12, weight: "80kg", muscle: "Glutes", body: "Lower Body" },
        { name: "Leg Extensions", sets: 3, reps: 15, weight: "40kg", muscle: "Quads", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "50kg", muscle: "Calves", body: "Lower Body" }
      ]}
    ]
  },
  {
    name: "Full Body 3 Day",
    description: "Full body workout 3x per week. Perfect for busy schedules.",
    cycleLength: 3,
    restDays: [] as number[],
    dayLabels: ["Full Body A", "Full Body B", "Full Body C"],
    days: [
      { label: "Full Body A", muscles: "Compound Focus", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "80kg", muscle: "Quads", body: "Lower Body" },
        { name: "Bench Press", sets: 4, reps: 8, weight: "60kg", muscle: "Chest", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "55kg", muscle: "Back", body: "Upper Body" },
        { name: "Overhead Press", sets: 3, reps: 10, weight: "35kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Plank", sets: 3, reps: 60, weight: "sec", muscle: "Core", body: "Core" }
      ]},
      { label: "Full Body B", muscles: "Strength Focus", exercises: [
        { name: "Deadlifts", sets: 4, reps: 5, weight: "110kg", muscle: "Back", body: "Upper Body" },
        { name: "Incline Press", sets: 4, reps: 10, weight: "50kg", muscle: "Chest", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 4, reps: 10, weight: "55kg", muscle: "Back", body: "Upper Body" },
        { name: "Lunges", sets: 3, reps: 12, weight: "20kg", muscle: "Quads", body: "Lower Body" },
        { name: "Face Pulls", sets: 3, reps: 15, weight: "18kg", muscle: "Shoulders", body: "Upper Body" }
      ]},
      { label: "Full Body C", muscles: "Volume Focus", exercises: [
        { name: "Front Squats", sets: 4, reps: 10, weight: "60kg", muscle: "Quads", body: "Lower Body" },
        { name: "Dumbbell Press", sets: 4, reps: 12, weight: "24kg", muscle: "Chest", body: "Upper Body" },
        { name: "Cable Rows", sets: 4, reps: 12, weight: "50kg", muscle: "Back", body: "Upper Body" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "8kg", muscle: "Shoulders", body: "Upper Body" },
        { name: "Leg Curls", sets: 3, reps: 12, weight: "35kg", muscle: "Hamstrings", body: "Lower Body" }
      ]}
    ]
  },
  {
    name: "Fat Loss HIIT",
    description: "High intensity circuit for fat loss. Minimal rest between exercises.",
    cycleLength: 4,
    restDays: [] as number[],
    dayLabels: ["Circuit A", "Circuit B", "Circuit A", "Circuit B"],
    days: [
      { label: "Circuit A", muscles: "Full Body Cardio", exercises: [
        { name: "Burpees", sets: 4, reps: 12, weight: "BW", muscle: "Full Body", body: "Full Body" },
        { name: "Mountain Climbers", sets: 4, reps: 20, weight: "BW", muscle: "Core", body: "Core" },
        { name: "Jump Squats", sets: 4, reps: 15, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "Push Ups", sets: 4, reps: 15, weight: "BW", muscle: "Chest", body: "Upper Body" },
        { name: "High Knees", sets: 4, reps: 30, weight: "sec", muscle: "Cardio", body: "Full Body" }
      ]},
      { label: "Circuit B", muscles: "Strength Cardio", exercises: [
        { name: "Kettlebell Swings", sets: 4, reps: 15, weight: "16kg", muscle: "Full Body", body: "Full Body" },
        { name: "Box Jumps", sets: 4, reps: 10, weight: "BW", muscle: "Quads", body: "Lower Body" },
        { name: "Battle Ropes", sets: 4, reps: 30, weight: "sec", muscle: "Arms", body: "Arms" },
        { name: "Thrusters", sets: 4, reps: 12, weight: "20kg", muscle: "Full Body", body: "Full Body" },
        { name: "Plank Jacks", sets: 4, reps: 20, weight: "BW", muscle: "Core", body: "Core" }
      ]}
    ]
  }
];

const CONSISTENCY_PROFILES = [
  { name: "very_consistent", daysPerWeek: [5, 6], percentage: 0.30 },
  { name: "moderate", daysPerWeek: [3, 4], percentage: 0.50 },
  { name: "irregular", daysPerWeek: [0, 1, 2], percentage: 0.20 }
];

const ANNOUNCEMENT_TEMPLATES = [
  { title: "New Year, New Goals!", body: "Welcome to 2026! Let's crush those fitness goals together. Don't forget to update your body measurements this week.", audience: "everyone" as const },
  { title: "Gym Timings Update", body: "Starting next week, we'll be open from 5 AM to 11 PM on weekdays. Weekend timings remain the same (6 AM - 9 PM).", audience: "everyone" as const },
  { title: "Monthly Fitness Challenge", body: "Join our January fitness challenge! Complete 20 workouts this month and get a free protein shake.", audience: "members" as const },
  { title: "Trainer Meeting - Monday 8 AM", body: "All trainers please join the weekly sync meeting on Monday at 8 AM. We'll discuss new member onboarding.", audience: "trainers" as const },
  { title: "Equipment Maintenance", body: "The cable machines will be under maintenance on Saturday. We apologize for the inconvenience.", audience: "everyone" as const },
  { title: "Payment Reminder", body: "Monthly subscriptions are due by the 5th. Please clear any pending dues to continue uninterrupted access.", audience: "members" as const },
  { title: "New Cardio Equipment", body: "We've added 4 new treadmills and 2 rowing machines! Come try them out.", audience: "everyone" as const },
  { title: "Client Progress Reports Due", body: "Trainers, please submit your client progress reports by Friday EOD.", audience: "trainers" as const }
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

function generateWorkoutDays(startDays: number, endDays: number, daysPerWeek: number): string[] {
  const days: string[] = [];
  const totalWeeks = Math.ceil((startDays - endDays) / 7);
  
  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = startDays - (week * 7);
    const weekEnd = Math.max(weekStart - 6, endDays);
    
    const possibleDays: string[] = [];
    for (let d = weekStart; d >= weekEnd; d--) {
      possibleDays.push(format(subDays(new Date(), d), "yyyy-MM-dd"));
    }
    
    const shuffled = possibleDays.sort(() => Math.random() - 0.5);
    const selectedCount = Math.min(daysPerWeek, shuffled.length);
    days.push(...shuffled.slice(0, selectedCount));
  }
  
  return days.sort();
}

export async function resetDemoData(): Promise<void> {
  console.log("\n========================================");
  console.log("RESETTING DEMO DATA");
  console.log("========================================\n");
  
  const demoGyms = await db.select().from(gyms).where(
    or(eq(gyms.code, "IRONFORGE"), eq(gyms.code, "PULSEARENA"), eq(gyms.code, "FITZONE1"), eq(gyms.code, "IRONTEMP"))
  );
  
  const gymIds = demoGyms.map(g => g.id);
  
  if (gymIds.length === 0) {
    console.log("[Demo Reset] No demo gyms found.");
    return;
  }
  
  console.log(`[Demo Reset] Found ${demoGyms.length} demo gyms to delete...`);
  
  const demoSessions = await db.select().from(workoutSessions).where(inArray(workoutSessions.gymId, gymIds));
  const sessionIds = demoSessions.map(s => s.id);
  if (sessionIds.length > 0) {
    await db.delete(workoutSessionExercises).where(inArray(workoutSessionExercises.sessionId, sessionIds));
    await db.delete(workoutSessions).where(inArray(workoutSessions.id, sessionIds));
  }
  
  // Delete workout completions by gymId first (before items)
  await db.delete(workoutCompletions).where(inArray(workoutCompletions.gymId, gymIds));
  
  const demoCycles = await db.select().from(workoutCycles).where(inArray(workoutCycles.gymId, gymIds));
  const cycleIds = demoCycles.map(c => c.id);
  if (cycleIds.length > 0) {
    await db.delete(memberRestDaySwaps).where(inArray(memberRestDaySwaps.cycleId, cycleIds));
    await db.delete(workoutItems).where(inArray(workoutItems.cycleId, cycleIds));
    await db.delete(workoutCycles).where(inArray(workoutCycles.id, cycleIds));
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
  
  // Delete feed posts and related data
  const demoFeedPosts = await db.select().from(feedPosts).where(inArray(feedPosts.gymId, gymIds));
  const feedPostIds = demoFeedPosts.map(p => p.id);
  if (feedPostIds.length > 0) {
    await db.delete(feedReactions).where(inArray(feedReactions.postId, feedPostIds));
    await db.delete(feedComments).where(inArray(feedComments.postId, feedPostIds));
    await db.delete(feedPosts).where(inArray(feedPosts.id, feedPostIds));
  }
  
  // Delete tournaments and participants
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
  
  await db.delete(trainingPhases).where(inArray(trainingPhases.gymId, gymIds));
  
  const demoUsers = await db.select().from(users).where(inArray(users.gymId, gymIds));
  const userIds = demoUsers.map(u => u.id);
  
  if (userIds.length > 0) {
    await db.delete(userProfiles).where(inArray(userProfiles.userId, userIds));
    await db.delete(transferRequests).where(inArray(transferRequests.memberId, userIds));
    await db.delete(joinRequests).where(inArray(joinRequests.userId, userIds));
    
    // Delete support tickets and messages for demo users
    const demoTickets = await db.select().from(supportTickets).where(inArray(supportTickets.userId, userIds));
    const ticketIds = demoTickets.map(t => t.id);
    if (ticketIds.length > 0) {
      await db.delete(supportMessages).where(inArray(supportMessages.ticketId, ticketIds));
      await db.delete(supportTickets).where(inArray(supportTickets.id, ticketIds));
    }
  }
  
  await db.delete(gymSubscriptions).where(inArray(gymSubscriptions.gymId, gymIds));
  await db.delete(users).where(inArray(users.gymId, gymIds));
  
  for (const gymId of gymIds) {
    await db.update(gyms).set({ ownerUserId: null }).where(eq(gyms.id, gymId));
    await db.delete(gyms).where(eq(gyms.id, gymId));
  }
  
  console.log("[Demo Reset] Demo data cleared successfully!");
}

export async function seedDemoData(): Promise<void> {
  console.log("\n========================================");
  console.log("SEEDING COMPREHENSIVE DEMO DATA");
  console.log("========================================\n");
  
  const existingDemoGym = await db.select().from(gyms).where(
    or(eq(gyms.code, "IRONFORGE"), eq(gyms.code, "PULSEARENA"))
  ).limit(1);
  
  if (existingDemoGym.length > 0) {
    console.log("[Demo Seed] Demo gyms already exist. Run reset first.");
    console.log("Command: npx tsx server/run-seed.ts --reset");
    return;
  }

  const hashedPassword = await hashPassword("demo123");
  const today = new Date();
  const historyStartDays = 240; // 8 months of history
  const historyEndDays = 0;
  
  const allCredentials: { gym: string; role: string; username: string; password: string; profile?: string }[] = [];
  const stats = {
    gyms: 0,
    trainers: 0,
    members: 0,
    workoutCycles: 0,
    workoutCompletions: 0,
    payments: 0,
    dietPlans: 0,
    bodyMeasurements: 0,
    announcements: 0,
    starMembers: 0,
    memberNotes: 0,
    trainingPhases: 0,
    templates: 0,
    transfers: 0,
    joinRequests: 0,
    feedPosts: 0,
    feedReactions: 0,
    feedComments: 0,
    tournaments: 0,
    tournamentParticipants: 0
  };
  
  let usedNames = new Set<string>();
  const allGymsData: { gym: any; owner: any; trainers: any[]; members: any[]; plans: any[] }[] = [];
  
  for (const gymConfig of GYM_CONFIGS) {
    console.log(`\n[Demo Seed] Creating gym: ${gymConfig.name}...`);
    
    // Track per-gym stats
    const gymStats = {
      trainers: 0,
      members: 0,
      templates: 0,
      workoutCycles: 0,
      workoutCompletions: 0,
      payments: 0,
      starMembers: 0,
      dietPlans: 0,
      memberNotes: 0,
      trainingPhases: 0,
      bodyMeasurements: 0,
      announcements: 0
    };
    
    const [gym] = await db.insert(gyms).values({
      name: gymConfig.name,
      code: gymConfig.code,
      phone: gymConfig.phone,
      address: gymConfig.address,
    }).returning();
    stats.gyms++;
    
    const [owner] = await db.insert(users).values({
      username: gymConfig.ownerUsername,
      password: hashedPassword,
      role: "owner",
      gymId: gym.id,
      publicId: generatePublicId("OWN"),
      email: gymConfig.ownerEmail,
      phone: gymConfig.phone,
    }).returning();
    
    await db.update(gyms).set({ ownerUserId: owner.id }).where(eq(gyms.id, gym.id));
    allCredentials.push({ gym: gymConfig.name, role: "owner", username: gymConfig.ownerUsername, password: "demo123" });
    
    await db.insert(gymSubscriptions).values({
      gymId: gym.id,
      planType: gymConfig.subscriptionStatus === "paid" ? "6_month" : "1_month",
      amountPaid: gymConfig.subscriptionStatus === "paid" ? 1000000 : 50000,
      paymentStatus: gymConfig.subscriptionStatus,
      paidOn: gymConfig.subscriptionStatus === "paid" ? subDays(today, 45) : subDays(today, 35),
      validUntil: gymConfig.subscriptionStatus === "paid" ? addMonths(today, 4) : subDays(today, 5),
      notes: gymConfig.subscriptionStatus === "paid" ? "6-month platform subscription - Active" : "Payment overdue - Please renew",
    });
    
    const plans: any[] = [];
    const [plan1] = await db.insert(membershipPlans).values({
      gymId: gym.id,
      name: "Monthly Basic",
      durationMonths: 1,
      priceAmount: 150000,
      isActive: true,
    }).returning();
    plans.push(plan1);
    
    const [plan3] = await db.insert(membershipPlans).values({
      gymId: gym.id,
      name: "3 Month Standard",
      durationMonths: 3,
      priceAmount: 400000,
      isActive: true,
    }).returning();
    plans.push(plan3);
    
    const [plan6] = await db.insert(membershipPlans).values({
      gymId: gym.id,
      name: "6 Month Premium",
      durationMonths: 6,
      priceAmount: 700000,
      isActive: true,
    }).returning();
    plans.push(plan6);
    
    const trainers: any[] = [];
    for (let t = 0; t < gymConfig.trainerCount; t++) {
      const trainerName = TRAINER_NAMES[t % TRAINER_NAMES.length];
      const trainerUsername = `${trainerName.first.toLowerCase()}_${gym.code.toLowerCase()}`;
      
      const [trainer] = await db.insert(users).values({
        username: trainerUsername,
        password: hashedPassword,
        role: "trainer",
        gymId: gym.id,
        publicId: generatePublicId("TRN"),
        email: `${trainerName.first.toLowerCase()}@${gymConfig.name.toLowerCase().replace(/\s+/g, '')}.in`,
        phone: `+91 98${getRandomInt(10000000, 99999999)}`,
      }).returning();
      
      trainers.push(trainer);
      stats.trainers++;
      gymStats.trainers++;
      
      if (t < 2) {
        allCredentials.push({ gym: gymConfig.name, role: "trainer", username: trainerUsername, password: "demo123" });
      }
    }
    console.log(`  Created ${trainers.length} trainers`);
    
    for (let t = 0; t < trainers.length; t++) {
      const template = WORKOUT_TEMPLATES_DATA[t % WORKOUT_TEMPLATES_DATA.length];
      const [wt] = await db.insert(workoutTemplates).values({
        gymId: gym.id,
        trainerId: trainers[t].id,
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
      gymStats.templates++;
    }
    console.log(`  Created ${gymStats.templates} workout templates`);
    
    const members: any[] = [];
    for (let m = 0; m < gymConfig.memberCount; m++) {
      let firstName: string;
      let attempts = 0;
      do {
        firstName = getRandomElement(FIRST_NAMES);
        attempts++;
      } while (usedNames.has(`${firstName}_${gym.code}`) && attempts < 50);
      usedNames.add(`${firstName}_${gym.code}`);
      
      const memberUsername = `${firstName.toLowerCase()}_${gym.code.toLowerCase()}${m}`;
      
      const [member] = await db.insert(users).values({
        username: memberUsername,
        password: hashedPassword,
        role: "member",
        gymId: gym.id,
        publicId: generatePublicId("MEM"),
        email: `${firstName.toLowerCase()}${getRandomInt(1, 999)}@gmail.com`,
        phone: `+91 ${getRandomInt(7000000000, 9999999999)}`,
      }).returning();
      
      const assignedTrainer = trainers[m % trainers.length];
      const consistencyProfile = assignConsistencyProfile();
      
      members.push({
        ...member,
        consistencyProfile,
        assignedTrainer
      });
      stats.members++;
      gymStats.members++;
      
      // Add sample members with different consistency profiles to credentials
      if (m === 0) {
        allCredentials.push({ gym: gymConfig.name, role: "member (very consistent)", username: memberUsername, password: "demo123", profile: "very_consistent" });
      } else if (m === Math.floor(gymConfig.memberCount * 0.3)) {
        allCredentials.push({ gym: gymConfig.name, role: "member (moderate)", username: memberUsername, password: "demo123", profile: "moderate" });
      } else if (m === Math.floor(gymConfig.memberCount * 0.8)) {
        allCredentials.push({ gym: gymConfig.name, role: "member (irregular)", username: memberUsername, password: "demo123", profile: "irregular" });
      }
    }
    console.log(`  Created ${gymStats.members} members`);
    
    for (const member of members) {
      await db.insert(trainerMembers).values({
        gymId: gym.id,
        trainerId: member.assignedTrainer.id,
        memberId: member.id,
      });
      
      await db.insert(trainerMemberAssignments).values({
        gymId: gym.id,
        trainerId: member.assignedTrainer.id,
        memberId: member.id,
        startedAt: subDays(today, historyStartDays + getRandomInt(0, 10)),
      });
      
      await db.insert(gymHistory).values({
        gymId: gym.id,
        memberId: member.id,
        joinedAt: subDays(today, historyStartDays + getRandomInt(0, 15)),
      });
    }
    
    for (const member of members) {
      const joinDateOffset = getRandomInt(0, 30);
      const joinDate = subDays(today, historyStartDays + joinDateOffset);
      const selectedPlan = getRandomElement(plans);
      const endDate = addMonths(joinDate, selectedPlan.durationMonths);
      
      let status: "active" | "ended" | "endingSoon" | "overdue" = "active";
      const rand = Math.random();
      if (rand < 0.10) status = "ended";
      else if (rand < 0.15) status = "endingSoon";
      else if (rand < 0.25) status = "overdue";
      
      const paymentMode = rand < 0.70 ? "full" : (rand < 0.85 ? "partial" : "emi");
      
      const [subscription] = await db.insert(memberSubscriptions).values({
        gymId: gym.id,
        memberId: member.id,
        planId: selectedPlan.id,
        startDate: format(joinDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        status,
        totalAmount: selectedPlan.priceAmount,
        paymentMode,
        notes: paymentMode === "emi" ? "3 EMI payments" : null,
      }).returning();
      
      member.subscription = subscription;
      member.plan = selectedPlan;
      
      let amountPaidTotal = 0;
      if (paymentMode === "full" && status !== "overdue") {
        await db.insert(paymentTransactions).values({
          gymId: gym.id,
          memberId: member.id,
          subscriptionId: subscription.id,
          paidOn: format(joinDate, "yyyy-MM-dd"),
          amountPaid: selectedPlan.priceAmount,
          method: getRandomElement(["cash", "upi", "card", "bank"]),
          referenceNote: `Full payment - ${selectedPlan.name}`,
        });
        amountPaidTotal = selectedPlan.priceAmount;
        stats.payments++;
        gymStats.payments++;
      } else if (paymentMode === "partial" || paymentMode === "emi") {
        const numPayments = paymentMode === "emi" ? 3 : 2;
        const paymentAmount = Math.floor(selectedPlan.priceAmount / numPayments);
        const paymentsMade = status === "overdue" ? 1 : (Math.random() > 0.3 ? numPayments : numPayments - 1);
        
        for (let p = 0; p < paymentsMade; p++) {
          const payDate = addDays(joinDate, p * 15);
          if (payDate <= today) {
            await db.insert(paymentTransactions).values({
              gymId: gym.id,
              memberId: member.id,
              subscriptionId: subscription.id,
              paidOn: format(payDate, "yyyy-MM-dd"),
              amountPaid: paymentAmount,
              method: getRandomElement(["cash", "upi", "card"]),
              referenceNote: `${paymentMode.toUpperCase()} ${p + 1}/${numPayments}`,
            });
            amountPaidTotal += paymentAmount;
            stats.payments++;
            gymStats.payments++;
          }
        }
      } else if (status === "overdue") {
        const partialAmount = Math.floor(selectedPlan.priceAmount * 0.3);
        await db.insert(paymentTransactions).values({
          gymId: gym.id,
          memberId: member.id,
          subscriptionId: subscription.id,
          paidOn: format(joinDate, "yyyy-MM-dd"),
          amountPaid: partialAmount,
          method: "cash",
          referenceNote: "Partial advance payment",
        });
        amountPaidTotal = partialAmount;
        stats.payments++;
        gymStats.payments++;
      }
      
      member.amountPaid = amountPaidTotal;
    }
    console.log(`  Created subscriptions and ${gymStats.payments} payment transactions`);
    
    for (let t = 0; t < trainers.length; t++) {
      const trainer = trainers[t];
      const trainerMembers = members.filter(m => m.assignedTrainer.id === trainer.id);
      const template = WORKOUT_TEMPLATES_DATA[t % WORKOUT_TEMPLATES_DATA.length];
      
      const starMemberCandidates = trainerMembers.filter(m => m.consistencyProfile === "very_consistent").slice(0, 3);
      for (const starMember of starMemberCandidates) {
        await db.insert(starMembers).values({
          gymId: gym.id,
          trainerId: trainer.id,
          memberId: starMember.id,
        });
        stats.starMembers++;
        gymStats.starMembers++;
        
        if (Math.random() > 0.3) {
          const dietTemplate = getRandomElement(DIET_PLAN_TEMPLATES);
          const [dietPlan] = await db.insert(dietPlans).values({
            gymId: gym.id,
            trainerId: trainer.id,
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
          gymStats.dietPlans++;
        }
        
        // Add training phases for star members who have workout cycles
        const starMemberCycles = await db.select().from(workoutCycles)
          .where(eq(workoutCycles.memberId, starMember.id));
        
        if (starMemberCycles.length > 0) {
          const goalTypes = ["cut", "bulk", "strength", "endurance", "rehab", "general"] as const;
          const phaseCount = Math.random() > 0.5 ? 2 : 1;
          
          for (let pi = 0; pi < phaseCount; pi++) {
            const phaseStartOffset = 60 + (pi * 90); // Each phase offset by ~3 months
            const phaseDuration = getRandomInt(28, 56); // 4-8 weeks
            const phaseStart = subDays(today, phaseStartOffset);
            const phaseEnd = subDays(today, phaseStartOffset - phaseDuration);
            const goalType = getRandomElement([...goalTypes]);
            
            const phaseNames: Record<string, string[]> = {
              cut: ["Summer Cut", "Fat Loss Phase", "Shred Phase"],
              bulk: ["Muscle Building", "Off-Season Bulk", "Mass Phase"],
              strength: ["Strength Block", "Power Phase", "Max Strength"],
              endurance: ["Cardio Focus", "Conditioning Phase", "Endurance Block"],
              rehab: ["Recovery Phase", "Rehab Block", "Return to Training"],
              general: ["Fitness Phase", "General Conditioning", "Base Building"]
            };
            
            await db.insert(trainingPhases).values({
              gymId: gym.id,
              trainerId: trainer.id,
              memberId: starMember.id,
              cycleId: starMemberCycles[0].id,
              name: getRandomElement(phaseNames[goalType]),
              goalType,
              startDate: format(phaseStart, "yyyy-MM-dd"),
              endDate: format(phaseEnd, "yyyy-MM-dd"),
              notes: pi === 0 ? "Good progress so far. Keep pushing!" : null,
            });
            stats.trainingPhases++;
            gymStats.trainingPhases++;
          }
        }
      }
      
      for (const member of trainerMembers) {
        if (Math.random() > 0.5) {
          await db.insert(memberNotes).values({
            gymId: gym.id,
            trainerId: trainer.id,
            memberId: member.id,
            content: getRandomElement(MEMBER_NOTE_TEMPLATES),
          });
          stats.memberNotes++;
          gymStats.memberNotes++;
        }
      }
      
      for (const member of trainerMembers) {
        const cycleStart = subDays(today, historyStartDays);
        const cycleEnd = addDays(today, 30);
        
        const [cycle] = await db.insert(workoutCycles).values({
          gymId: gym.id,
          trainerId: trainer.id,
          memberId: member.id,
          name: template.name,
          cycleLength: template.cycleLength,
          dayLabels: template.dayLabels,
          restDays: template.restDays || [],
          startDate: format(cycleStart, "yyyy-MM-dd"),
          endDate: format(cycleEnd, "yyyy-MM-dd"),
          isActive: true,
        }).returning();
        stats.workoutCycles++;
        gymStats.workoutCycles++;
        
        const itemsForCycle: any[] = [];
        for (let dayIdx = 0; dayIdx < template.days.length; dayIdx++) {
          const dayTemplate = template.days[dayIdx];
          for (let exIdx = 0; exIdx < dayTemplate.exercises.length; exIdx++) {
            const ex = dayTemplate.exercises[exIdx];
            const weightVariation = Math.random() > 0.5 ? getRandomInt(-5, 10) : 0;
            let adjustedWeight = ex.weight;
            if (ex.weight && ex.weight !== "BW" && ex.weight !== "sec") {
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
        
        const daysPerWeek = getDaysPerWeek(member.consistencyProfile);
        const workoutDays = generateWorkoutDays(historyStartDays, historyEndDays, daysPerWeek);
        
        for (const workoutDate of workoutDays) {
          const daysSinceStart = Math.floor(
            (new Date(workoutDate).getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          const currentDayIndex = ((daysSinceStart % template.cycleLength) + template.cycleLength) % template.cycleLength;
          const effectiveDayIndex = currentDayIndex % template.days.length;
          
          const dayItems = itemsForCycle.filter((i: any) => i.dayIdx === effectiveDayIndex);
          
          const completionRate = member.consistencyProfile === "very_consistent" ? 0.95 :
                                 member.consistencyProfile === "moderate" ? 0.80 : 0.60;
          
          const completedItems = dayItems.filter(() => Math.random() < completionRate);
          
          for (const item of completedItems) {
            const setsVar = Math.random() > 0.8 ? getRandomInt(-1, 1) : 0;
            const repsVar = Math.random() > 0.7 ? getRandomInt(-2, 2) : 0;
            
            const notes = Math.random() > 0.9 ? 
              getRandomElement(["Felt strong", "Struggled a bit", "New PR!", "Need more rest", "Good pump"]) : 
              null;
            
            await db.insert(workoutCompletions).values({
              gymId: gym.id,
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
            gymStats.workoutCompletions++;
          }
          
          if (completedItems.length > 0) {
            await db.insert(attendance).values({
              gymId: gym.id,
              memberId: member.id,
              markedByUserId: member.id,
              date: workoutDate,
              status: "present",
              verifiedMethod: getRandomElement(["workout", "qr", "both"]),
            });
          }
        }
      }
    }
    console.log(`  Created ${gymStats.workoutCycles} workout cycles with ${gymStats.workoutCompletions} completions`);
    console.log(`  Created ${gymStats.starMembers} star members, ${gymStats.dietPlans} diet plans, ${gymStats.trainingPhases} phases, ${gymStats.memberNotes} notes`);
    
    const MEASUREMENT_NOTES = [
      "Feeling great", "Cut going well", "Bulk phase", "Post cheat meal", 
      "Felt bloated", "Morning weigh-in", "After workout", "Dehydrated",
      "Good progress", "Need to focus on diet", "Consistent training",
      null, null, null, null, null
    ];
    
    type MeasurementProfile = "fat_loss" | "muscle_gain" | "recomp" | "inconsistent";
    
    const getMemberProfile = (index: number): MeasurementProfile => {
      const rand = index % 10;
      if (rand < 3) return "fat_loss";
      if (rand < 6) return "muscle_gain";
      if (rand < 9) return "recomp";
      return "inconsistent";
    };
    
    const getMeasurementFrequency = (index: number): number => {
      const rand = index % 10;
      if (rand < 6) return 7 + getRandomInt(0, 3);
      if (rand < 9) return 12 + getRandomInt(0, 4);
      return 999;
    };
    
    for (let mIdx = 0; mIdx < members.length; mIdx++) {
      const member = members[mIdx];
      const profile = getMemberProfile(mIdx);
      const frequency = getMeasurementFrequency(mIdx);
      
      const isMale = mIdx % 3 !== 0;
      let baseWeight = isMale ? getRandomInt(65, 90) : getRandomInt(50, 70);
      let baseHeight = isMale ? getRandomInt(165, 185) : getRandomInt(155, 170);
      let baseBodyFat = isMale ? getRandomInt(15, 28) : getRandomInt(22, 35);
      let baseChest = isMale ? getRandomInt(90, 110) : getRandomInt(80, 100);
      let baseWaist = isMale ? getRandomInt(78, 95) : getRandomInt(65, 85);
      let baseHips = isMale ? getRandomInt(90, 105) : getRandomInt(90, 110);
      let baseBiceps = isMale ? getRandomInt(30, 38) : getRandomInt(25, 32);
      let baseThighs = isMale ? getRandomInt(50, 62) : getRandomInt(48, 58);
      
      const measurementDays: number[] = [];
      if (frequency >= 999) {
        measurementDays.push(getRandomInt(10, 200));
        if (Math.random() > 0.5) measurementDays.push(getRandomInt(5, 100));
      } else {
        for (let day = historyStartDays; day >= 0; day -= frequency) {
          measurementDays.push(day + getRandomInt(-2, 2));
        }
      }
      
      for (let i = 0; i < measurementDays.length; i++) {
        const daysAgo = Math.max(0, Math.min(historyStartDays, measurementDays[i]));
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
          waist = baseWaist + progressFactor * getRandomInt(0, 15) / 10;
        } else if (profile === "recomp") {
          weight = baseWeight + (Math.random() - 0.5) * 2;
          waist = baseWaist - progressFactor * getRandomInt(5, 20) / 10;
          chest = baseChest + progressFactor * getRandomInt(5, 15) / 10;
        } else {
          weight = baseWeight + (Math.random() - 0.5) * 6;
          waist = baseWaist + (Math.random() - 0.5) * 4;
        }
        
        weight = Math.round((weight + (Math.random() - 0.5) * 1) * 10) / 10;
        chest = Math.round((chest + (Math.random() - 0.5) * 1) * 10) / 10;
        waist = Math.round((waist + (Math.random() - 0.5) * 1) * 10) / 10;
        hips = Math.round((hips + (Math.random() - 0.5) * 1) * 10) / 10;
        biceps = Math.round((biceps + (Math.random() - 0.5) * 0.5) * 10) / 10;
        thighs = Math.round((thighs + (Math.random() - 0.5) * 1) * 10) / 10;
        bodyFat = Math.round((bodyFat + (Math.random() - 0.5) * 1) * 10) / 10;
        
        await db.insert(bodyMeasurements).values({
          gymId: gym.id,
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
          notes: getRandomElement(MEASUREMENT_NOTES),
        });
        stats.bodyMeasurements++;
        gymStats.bodyMeasurements++;
      }
    }
    console.log(`  Created ${gymStats.bodyMeasurements} body measurements`);
    
    // Create announcements spread across 8 months (2-3 per month)
    const allAnnouncementTemplates = [...ANNOUNCEMENT_TEMPLATES];
    for (let month = 0; month < 8; month++) {
      const announcementsThisMonth = getRandomInt(2, 3);
      for (let a = 0; a < announcementsThisMonth; a++) {
        const template = allAnnouncementTemplates[a % allAnnouncementTemplates.length];
        const daysAgo = month * 30 + getRandomInt(5, 25);
      
      const [announcement] = await db.insert(announcements).values({
        gymId: gym.id,
        title: template.title,
        body: template.body,
        audience: template.audience,
        createdByOwnerId: owner.id,
        createdAt: subDays(today, daysAgo),
      }).returning();
      stats.announcements++;
      gymStats.announcements++;
      
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
    console.log(`  Created ${gymStats.announcements} announcements with read tracking`);
    
    // ===== TOURNAMENTS (Last 4 months) =====
    const tournamentConfigs = [
      { name: "January Workout Challenge", metric: "workout_count" as const, startDaysAgo: 180, endDaysAgo: 150, status: "completed" as const },
      { name: "February Attendance Champion", metric: "attendance_days" as const, startDaysAgo: 150, endDaysAgo: 120, status: "completed" as const },
      { name: "March Exercise Marathon", metric: "total_exercises" as const, startDaysAgo: 120, endDaysAgo: 90, status: "completed" as const },
      { name: "April Points Challenge", metric: "workout_count" as const, startDaysAgo: 90, endDaysAgo: 60, status: "completed" as const },
      { name: "May Streak King", metric: "attendance_days" as const, startDaysAgo: 60, endDaysAgo: 30, status: "completed" as const },
      { name: "June Fitness Frenzy", metric: "workout_count" as const, startDaysAgo: 30, endDaysAgo: -1, status: "active" as const },
      { name: "Summer Body Challenge", metric: "total_exercises" as const, startDaysAgo: -7, endDaysAgo: -37, status: "upcoming" as const },
    ];
    
    let gymTournaments = 0;
    let gymTournamentParticipants = 0;
    
    for (const config of tournamentConfigs) {
      const [tournament] = await db.insert(tournaments).values({
        gymId: gym.id,
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
      gymTournaments++;
      stats.tournaments++;
      
      // Add participants (all members for active/completed, some for upcoming)
      const participantMembers = config.status === "upcoming" 
        ? members.slice(0, getRandomInt(10, 30))
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
        gymTournamentParticipants++;
        stats.tournamentParticipants++;
      }
    }
    console.log(`  Created ${gymTournaments} tournaments with ${gymTournamentParticipants} participants`);
    
    // ===== SOCIAL FEED (8 months of activity) =====
    let gymFeedPosts = 0;
    let gymFeedReactions = 0;
    let gymFeedComments = 0;
    
    const COMMENT_TEMPLATES = ["Great work!", "Keep it up!", "Inspiring!", "Amazing progress!", "You're crushing it!", "Well done!"];
    const reactionTypes: ("like" | "fire" | "muscle" | "clap")[] = ["like", "fire", "muscle", "clap"];
    
    // New member posts (when they joined)
    for (const member of members.slice(0, 20)) {
      const joinDaysAgo = getRandomInt(30, historyStartDays);
      await db.insert(feedPosts).values({
        gymId: gym.id,
        userId: member.id,
        type: "new_member",
        content: null,
        metadata: JSON.stringify({}),
        isVisible: true,
        createdAt: subDays(today, joinDaysAgo),
      });
      gymFeedPosts++;
      stats.feedPosts++;
    }
    
    // Workout completion posts (distributed across history)
    const consistentMembers = members.filter(m => m.consistencyProfile === "very_consistent").slice(0, 15);
    for (const member of consistentMembers) {
      // Create 2-4 workout completion posts per month for consistent members
      for (let month = 0; month < 8; month++) {
        const postsThisMonth = getRandomInt(2, 4);
        for (let p = 0; p < postsThisMonth; p++) {
          const daysAgo = month * 30 + getRandomInt(0, 28);
          if (daysAgo <= historyStartDays) {
            const [post] = await db.insert(feedPosts).values({
              gymId: gym.id,
              userId: member.id,
              type: "workout_complete",
              content: null,
              metadata: JSON.stringify({ exerciseCount: getRandomInt(4, 8), focusLabel: getRandomElement(["Push Day", "Pull Day", "Leg Day", "Upper Body", "Lower Body", "Full Body"]) }),
              isVisible: true,
              createdAt: subDays(today, daysAgo),
            }).returning();
            gymFeedPosts++;
            stats.feedPosts++;
            
            // Add reactions (2-8 per post)
            const reactorCount = getRandomInt(2, 8);
            const reactors = members.filter(m => m.id !== member.id).slice(0, reactorCount);
            for (const reactor of reactors) {
              await db.insert(feedReactions).values({
                postId: post.id,
                userId: reactor.id,
                reactionType: getRandomElement(reactionTypes),
              });
              gymFeedReactions++;
              stats.feedReactions++;
            }
            
            // Add comments (0-2 per post)
            if (Math.random() > 0.5) {
              const commenters = members.filter(m => m.id !== member.id).slice(0, getRandomInt(1, 2));
              for (const commenter of commenters) {
                await db.insert(feedComments).values({
                  postId: post.id,
                  userId: commenter.id,
                  content: getRandomElement(COMMENT_TEMPLATES),
                  createdAt: subDays(today, daysAgo - getRandomInt(0, 1)),
                });
                gymFeedComments++;
                stats.feedComments++;
              }
            }
          }
        }
      }
    }
    
    // Streak milestone posts
    for (const member of consistentMembers.slice(0, 10)) {
      const streakMilestones = [7, 14, 30];
      for (const streak of streakMilestones) {
        if (Math.random() > 0.4) {
          const daysAgo = getRandomInt(streak, 180);
          const [post] = await db.insert(feedPosts).values({
            gymId: gym.id,
            userId: member.id,
            type: "streak_milestone",
            content: null,
            metadata: JSON.stringify({ streakDays: streak }),
            isVisible: true,
            createdAt: subDays(today, daysAgo),
          }).returning();
          gymFeedPosts++;
          stats.feedPosts++;
          
          // Add reactions
          const reactorCount = getRandomInt(3, 10);
          const reactors = members.filter(m => m.id !== member.id).slice(0, reactorCount);
          for (const reactor of reactors) {
            await db.insert(feedReactions).values({
              postId: post.id,
              userId: reactor.id,
              reactionType: getRandomElement(reactionTypes),
            });
            gymFeedReactions++;
            stats.feedReactions++;
          }
        }
      }
    }
    
    // Achievement posts
    for (const member of consistentMembers.slice(0, 8)) {
      if (Math.random() > 0.3) {
        const [post] = await db.insert(feedPosts).values({
          gymId: gym.id,
          userId: member.id,
          type: "achievement",
          content: null,
          metadata: JSON.stringify({ type: "personal_record", exercise: getRandomElement(["Bench Press", "Squat", "Deadlift"]), value: `${getRandomInt(60, 120)}kg` }),
          isVisible: true,
          createdAt: subDays(today, getRandomInt(5, 60)),
        }).returning();
        gymFeedPosts++;
        stats.feedPosts++;
        
        // Add reactions
        const reactorCount = getRandomInt(5, 15);
        const reactors = members.filter(m => m.id !== member.id).slice(0, reactorCount);
        for (const reactor of reactors) {
          await db.insert(feedReactions).values({
            postId: post.id,
            userId: reactor.id,
            reactionType: getRandomElement(reactionTypes),
          });
          gymFeedReactions++;
          stats.feedReactions++;
        }
      }
    }
    
    console.log(`  Created ${gymFeedPosts} feed posts, ${gymFeedReactions} reactions, ${gymFeedComments} comments`);
    
    // Note: Join requests will be seeded across gyms after all gyms are created
    // This ensures logical correctness (members from gym A requesting to join gym B)
    
    allGymsData.push({ gym, owner, trainers, members, plans });
  }
  
  if (allGymsData.length >= 2) {
    const gym1 = allGymsData[0];
    const gym2 = allGymsData[1];
    
    // Transfer requests from Gym A -> Gym B (3 requests: approved, rejected, pending)
    const transferMember1 = gym1.members[getRandomInt(10, 20)];
    await db.insert(transferRequests).values({
      memberId: transferMember1.id,
      fromGymId: gym1.gym.id,
      toGymId: gym2.gym.id,
      status: "approved",
      approvedByFromOwner: true,
      approvedByToOwner: true,
      createdAt: subDays(today, 45),
    });
    stats.transfers++;
    
    const transferMember2 = gym1.members[getRandomInt(21, 30)];
    await db.insert(transferRequests).values({
      memberId: transferMember2.id,
      fromGymId: gym1.gym.id,
      toGymId: gym2.gym.id,
      status: "rejected",
      approvedByFromOwner: true,
      approvedByToOwner: false,
      createdAt: subDays(today, 20),
    });
    stats.transfers++;
    
    const pendingTransferMember1 = gym1.members[getRandomInt(31, 40)];
    await db.insert(transferRequests).values({
      memberId: pendingTransferMember1.id,
      fromGymId: gym1.gym.id,
      toGymId: gym2.gym.id,
      status: "pending",
      approvedByFromOwner: false,
      approvedByToOwner: false,
      createdAt: subDays(today, 3),
    });
    stats.transfers++;
    
    // Transfer requests from Gym B -> Gym A (3 requests: approved, rejected, pending)
    const transferMember3 = gym2.members[getRandomInt(5, 15)];
    await db.insert(transferRequests).values({
      memberId: transferMember3.id,
      fromGymId: gym2.gym.id,
      toGymId: gym1.gym.id,
      status: "approved",
      approvedByFromOwner: true,
      approvedByToOwner: true,
      createdAt: subDays(today, 60),
    });
    stats.transfers++;
    
    const transferMember4 = gym2.members[getRandomInt(16, 25)];
    await db.insert(transferRequests).values({
      memberId: transferMember4.id,
      fromGymId: gym2.gym.id,
      toGymId: gym1.gym.id,
      status: "rejected",
      approvedByFromOwner: true,
      approvedByToOwner: false,
      createdAt: subDays(today, 15),
    });
    stats.transfers++;
    
    const pendingTransferMember2 = gym2.members[getRandomInt(26, 35)];
    await db.insert(transferRequests).values({
      memberId: pendingTransferMember2.id,
      fromGymId: gym2.gym.id,
      toGymId: gym1.gym.id,
      status: "pending",
      approvedByFromOwner: false,
      approvedByToOwner: false,
      createdAt: subDays(today, 5),
    });
    stats.transfers++;
    
    console.log(`\n[Demo Seed] Created ${stats.transfers} transfer requests (3 each direction)`);
    
    // Create cross-gym join requests (members from gym1 requesting to join gym2 and vice versa)
    // This represents users who are members of one gym wanting to also join another
    for (let j = 0; j < 5; j++) {
      const gym1Member = gym1.members[getRandomInt(40, 60)];
      try {
        await db.insert(joinRequests).values({
          gymId: gym2.gym.id,
          userId: gym1Member.id,
          status: j < 3 ? "pending" : "approved",
          createdAt: subDays(today, getRandomInt(1, 30)),
          reviewedAt: j >= 3 ? subDays(today, getRandomInt(0, 5)) : null,
        });
        stats.joinRequests++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    for (let j = 0; j < 5; j++) {
      const gym2Member = gym2.members[getRandomInt(30, 50)];
      try {
        await db.insert(joinRequests).values({
          gymId: gym1.gym.id,
          userId: gym2Member.id,
          status: j < 2 ? "pending" : "approved",
          createdAt: subDays(today, getRandomInt(1, 30)),
          reviewedAt: j >= 2 ? subDays(today, getRandomInt(0, 5)) : null,
        });
        stats.joinRequests++;
      } catch (e) {
        // Skip duplicates
      }
    }
    console.log(`[Demo Seed] Created ${stats.joinRequests} cross-gym join requests`);
  }
  
  console.log("\n\n========================================");
  console.log("DEMO LOGIN CREDENTIALS");
  console.log("========================================");
  console.log("Password for ALL accounts: demo123");
  console.log("========================================\n");
  
  console.log("ADMIN:");
  console.log("  Username: (Use ADMIN_USERNAME from environment)");
  console.log("  Password: (Use ADMIN_PASSWORD from environment)");
  console.log("");
  
  let currentGym = "";
  for (const cred of allCredentials) {
    if (cred.gym !== currentGym) {
      console.log(`\n${cred.gym.toUpperCase()}:`);
      currentGym = cred.gym;
    }
    console.log(`  ${cred.role.charAt(0).toUpperCase() + cred.role.slice(1)}: ${cred.username}`);
  }
  
  console.log("\n\n========================================");
  console.log("SEED SUMMARY");
  console.log("========================================");
  console.log(`Gyms created:            ${stats.gyms}`);
  console.log(`Trainers created:        ${stats.trainers}`);
  console.log(`Members created:         ${stats.members}`);
  console.log(`Workout templates:       ${stats.templates}`);
  console.log(`Workout cycles created:  ${stats.workoutCycles}`);
  console.log(`Workout completions:     ${stats.workoutCompletions}`);
  console.log(`Payments recorded:       ${stats.payments}`);
  console.log(`Diet plans created:      ${stats.dietPlans}`);
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
  console.log("1. Admin Login: Approve pending gym requests");
  console.log("2. Owner Dashboard: Check revenue, outstanding balances, payment breakdown");
  console.log("3. Owner Requests: View pending transfers and join requests");
  console.log("4. Owner Members: See member list with subscriptions and expiring soon");
  console.log("5. Owner Announcements: View created announcements and read stats");
  console.log("6. Trainer Dashboard: See assigned members and star members");
  console.log("7. Trainer Diet Plans: View/edit diet plans for star members");
  console.log("8. Member Dashboard: Check points earned today vs planned");
  console.log("9. Member Workouts: See workout history, missed workouts, recover option");
  console.log("10. Member Progress: View 6-month body measurement trends");
  console.log("11. Member Feed: Browse 8 months of social activity with reactions");
  console.log("12. Member Tournaments: View current leaderboard and past winners");
  console.log("13. Member Payments: Check payment history and any outstanding dues");
  console.log("14. Member Attendance: View streak and attendance calendar");
  
  console.log("\n========================================");
  console.log("COMMANDS");
  console.log("========================================");
  console.log("Run seed:    npx tsx server/run-seed.ts");
  console.log("Reset demo:  npx tsx server/run-seed.ts --reset");
  console.log("========================================\n");
}
