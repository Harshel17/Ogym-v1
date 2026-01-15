import { db } from "./db";
import { 
  users, gyms, gymSubscriptions, trainerMembers, trainerMemberAssignments,
  attendance, membershipPlans, memberSubscriptions, paymentTransactions, payments,
  workoutCycles, workoutItems, workoutCompletions, workoutSessions, workoutSessionExercises,
  bodyMeasurements, starMembers, gymHistory, dietPlans, dietPlanMeals, announcements, announcementReads,
  memberNotes, workoutTemplates, workoutTemplateItems, memberRequests,
  feedPosts, feedReactions, feedComments, tournaments, tournamentParticipants,
  userProfiles, supportTickets, supportMessages, walkInVisitors,
  workoutPlanSets, workoutLogs, workoutLogExercises, workoutLogSets, memberRestDaySwaps,
  trainingPhases, phaseExercises, joinRequests, transferRequests, gymRequests, passwordResetCodes
} from "@shared/schema";
import { eq, or, inArray, sql } from "drizzle-orm";
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

const USA_FIRST_NAMES = [
  "Michael", "Jennifer", "David", "Jessica", "James", "Ashley", "Robert", "Amanda",
  "John", "Stephanie", "William", "Nicole", "Richard", "Sarah", "Joseph", "Heather",
  "Thomas", "Elizabeth", "Christopher", "Megan", "Charles", "Rachel", "Daniel", "Laura",
  "Matthew", "Michelle", "Anthony", "Emily", "Mark", "Kimberly", "Donald", "Angela",
  "Steven", "Melissa", "Paul", "Brenda", "Andrew", "Amy", "Joshua", "Anna"
];

const USA_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor",
  "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Sanchez",
  "Clark", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright"
];

const GYM_CONFIG = {
  name: "Gym 24/7",
  code: "GYM247",
  phone: "(205) 555-0142",
  address: "1847 Montclair Road",
  city: "Birmingham",
  state: "Alabama",
  country: "USA",
  currency: "USD" as const,
  timezone: "America/Chicago",
  ownerUsername: "gym247_owner",
  ownerEmail: "owner@gym247.com",
  subscriptionStatus: "paid" as const,
  trainerCount: 3,
  memberCount: 35
};

const TRAINER_DATA = [
  { first: "Marcus", last: "Williams", email: "marcus@gym247.com" },
  { first: "Sarah", last: "Johnson", email: "sarah@gym247.com" },
  { first: "Tyler", last: "Davis", email: "tyler@gym247.com" }
];

const WORKOUT_TEMPLATES_DATA = [
  {
    name: "PPL Split",
    description: "Push/Pull/Legs split - the gold standard for muscle building",
    cycleLength: 6,
    restDays: [] as number[],
    dayLabels: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
    days: [
      { label: "Push", muscles: "Chest+Shoulders+Triceps", exercises: [
        { name: "Bench Press", sets: 4, reps: 10, weight: "135 lbs", muscle: "Chest", body: "Upper Body" },
        { name: "Incline Dumbbell Press", sets: 3, reps: 12, weight: "45 lbs", muscle: "Chest", body: "Upper Body" },
        { name: "Overhead Press", sets: 4, reps: 8, weight: "95 lbs", muscle: "Shoulders", body: "Upper Body" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "20 lbs", muscle: "Shoulders", body: "Upper Body" },
        { name: "Tricep Pushdowns", sets: 3, reps: 12, weight: "55 lbs", muscle: "Triceps", body: "Arms" }
      ]},
      { label: "Pull", muscles: "Back+Biceps", exercises: [
        { name: "Deadlifts", sets: 4, reps: 6, weight: "225 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 4, reps: 10, weight: "110 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "135 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Barbell Curls", sets: 3, reps: 12, weight: "55 lbs", muscle: "Biceps", body: "Arms" }
      ]},
      { label: "Legs", muscles: "Quads+Hamstrings+Calves", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "185 lbs", muscle: "Quads", body: "Lower Body" },
        { name: "Leg Press", sets: 4, reps: 12, weight: "360 lbs", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 3, reps: 10, weight: "135 lbs", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "135 lbs", muscle: "Calves", body: "Lower Body" }
      ]}
    ]
  },
  {
    name: "Upper Lower Split",
    description: "Classic upper/lower split for balanced development",
    cycleLength: 4,
    restDays: [] as number[],
    dayLabels: ["Upper Body", "Lower Body", "Upper Body", "Lower Body"],
    days: [
      { label: "Upper Body", muscles: "Chest+Back+Shoulders+Arms", exercises: [
        { name: "Bench Press", sets: 4, reps: 8, weight: "155 lbs", muscle: "Chest", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "135 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Overhead Press", sets: 3, reps: 10, weight: "85 lbs", muscle: "Shoulders", body: "Upper Body" },
        { name: "Pull Ups", sets: 3, reps: 8, weight: "BW", muscle: "Back", body: "Upper Body" },
        { name: "Dumbbell Curls", sets: 3, reps: 12, weight: "30 lbs", muscle: "Biceps", body: "Arms" }
      ]},
      { label: "Lower Body", muscles: "Quads+Hamstrings+Glutes", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "205 lbs", muscle: "Quads", body: "Lower Body" },
        { name: "Romanian Deadlifts", sets: 4, reps: 10, weight: "155 lbs", muscle: "Hamstrings", body: "Lower Body" },
        { name: "Leg Press", sets: 3, reps: 12, weight: "400 lbs", muscle: "Quads", body: "Lower Body" },
        { name: "Hip Thrusts", sets: 3, reps: 12, weight: "185 lbs", muscle: "Glutes", body: "Lower Body" },
        { name: "Calf Raises", sets: 4, reps: 15, weight: "115 lbs", muscle: "Calves", body: "Lower Body" }
      ]}
    ]
  },
  {
    name: "Full Body 3x",
    description: "Full body workout 3 times per week - efficient and effective",
    cycleLength: 3,
    restDays: [] as number[],
    dayLabels: ["Full Body A", "Full Body B", "Full Body C"],
    days: [
      { label: "Full Body A", muscles: "Compound Focus", exercises: [
        { name: "Squats", sets: 4, reps: 8, weight: "175 lbs", muscle: "Quads", body: "Lower Body" },
        { name: "Bench Press", sets: 4, reps: 8, weight: "135 lbs", muscle: "Chest", body: "Upper Body" },
        { name: "Barbell Rows", sets: 4, reps: 8, weight: "125 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Overhead Press", sets: 3, reps: 10, weight: "75 lbs", muscle: "Shoulders", body: "Upper Body" }
      ]},
      { label: "Full Body B", muscles: "Strength Focus", exercises: [
        { name: "Deadlifts", sets: 4, reps: 5, weight: "245 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Incline Press", sets: 4, reps: 10, weight: "115 lbs", muscle: "Chest", body: "Upper Body" },
        { name: "Lat Pulldowns", sets: 4, reps: 10, weight: "120 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Lunges", sets: 3, reps: 12, weight: "45 lbs", muscle: "Quads", body: "Lower Body" }
      ]},
      { label: "Full Body C", muscles: "Volume Focus", exercises: [
        { name: "Front Squats", sets: 4, reps: 10, weight: "135 lbs", muscle: "Quads", body: "Lower Body" },
        { name: "Dumbbell Press", sets: 4, reps: 12, weight: "55 lbs", muscle: "Chest", body: "Upper Body" },
        { name: "Cable Rows", sets: 4, reps: 12, weight: "110 lbs", muscle: "Back", body: "Upper Body" },
        { name: "Lateral Raises", sets: 3, reps: 15, weight: "17.5 lbs", muscle: "Shoulders", body: "Upper Body" }
      ]}
    ]
  }
];

const CONSISTENCY_PROFILES = [
  { name: "very_consistent", daysPerWeek: [5, 6], percentage: 0.25 },
  { name: "moderate", daysPerWeek: [3, 4], percentage: 0.50 },
  { name: "irregular", daysPerWeek: [1, 2], percentage: 0.25 }
];

const ANNOUNCEMENT_TEMPLATES = [
  { title: "Welcome to the New Year!", body: "Happy 2026! Let's make this year our strongest yet. New Year, new gains!", audience: "everyone" as const },
  { title: "Extended Hours This Month", body: "We're now open 24/7! Use your key fob for after-hours access.", audience: "everyone" as const },
  { title: "January Fitness Challenge", body: "Complete 20 workouts this month and win a free month membership!", audience: "members" as const },
  { title: "Trainer Meeting - Monday 7 AM", body: "All trainers please attend the weekly sync on Monday morning.", audience: "trainers" as const },
  { title: "Equipment Maintenance Notice", body: "The cable crossover machine will be serviced Saturday morning. We apologize for any inconvenience.", audience: "everyone" as const },
  { title: "Payment Reminder", body: "Monthly subscriptions are due by the 5th. Please ensure your payment is up to date.", audience: "members" as const },
  { title: "New Cardio Equipment!", body: "Check out our 4 brand new Peloton bikes and 2 new rowers!", audience: "everyone" as const },
  { title: "Client Progress Reports Due", body: "Trainers, please submit your client progress reports by Friday.", audience: "trainers" as const }
];

const DIET_PLAN_TEMPLATES = [
  {
    title: "Fat Loss Plan",
    durationWeeks: 8,
    notes: "Calorie deficit with high protein. Stay hydrated - at least 1 gallon daily.",
    meals: [
      { dayIndex: 0, mealType: "breakfast" as const, description: "3 egg whites + 1 whole egg, 1 slice whole wheat toast, black coffee", calories: 250, protein: 22 },
      { dayIndex: 0, mealType: "snack" as const, description: "Apple + 1 tbsp almond butter", calories: 180, protein: 4 },
      { dayIndex: 0, mealType: "lunch" as const, description: "Grilled chicken breast 6oz, brown rice 1 cup, steamed broccoli", calories: 450, protein: 45 },
      { dayIndex: 0, mealType: "snack" as const, description: "Protein shake with water", calories: 120, protein: 25 },
      { dayIndex: 0, mealType: "dinner" as const, description: "Salmon 6oz, quinoa 1 cup, asparagus", calories: 480, protein: 40 }
    ]
  },
  {
    title: "Muscle Building Plan",
    durationWeeks: 12,
    notes: "High protein, moderate surplus. Eat every 3-4 hours.",
    meals: [
      { dayIndex: 0, mealType: "breakfast" as const, description: "4 whole eggs, 2 slices whole grain toast, banana, protein shake", calories: 700, protein: 45 },
      { dayIndex: 0, mealType: "snack" as const, description: "Greek yogurt with granola and berries", calories: 350, protein: 20 },
      { dayIndex: 0, mealType: "lunch" as const, description: "8oz chicken breast, sweet potato, mixed vegetables, avocado", calories: 750, protein: 55 },
      { dayIndex: 0, mealType: "snack" as const, description: "Protein bar + banana", calories: 350, protein: 25 },
      { dayIndex: 0, mealType: "dinner" as const, description: "8oz steak, rice, grilled vegetables", calories: 800, protein: 50 }
    ]
  }
];

const MEMBER_NOTE_TEMPLATES = [
  "Great form on squats today. Increased weight by 10 lbs.",
  "Missed last 2 sessions due to work travel. Following up this week.",
  "Excellent progress! Lost 8 lbs in the last month.",
  "Needs to work on mobility. Recommended daily stretching routine.",
  "Diet compliance improving. Discussed meal prep strategies.",
  "Very dedicated. Comes 5-6 days a week consistently.",
  "Recovering from minor knee issue. Avoiding heavy leg work for 2 weeks.",
  "Interested in competing. Starting bodybuilding prep discussion.",
  "Goal: Lose 25 lbs by summer. Currently ahead of schedule.",
  "Responds well to morning sessions. High energy before 9 AM."
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUSPhoneNumber(): string {
  const areaCode = getRandomInt(200, 999);
  const exchange = getRandomInt(200, 999);
  const subscriber = getRandomInt(1000, 9999);
  return `(${areaCode}) ${exchange}-${subscriber}`;
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
      possibleDays.push(format(subDays(new Date(), d), 'yyyy-MM-dd'));
    }
    
    const shuffled = possibleDays.sort(() => Math.random() - 0.5);
    const selectedDays = shuffled.slice(0, Math.min(daysPerWeek, shuffled.length));
    days.push(...selectedDays);
  }
  
  return days.sort();
}

export async function clearAllDemoData(): Promise<void> {
  console.log("Clearing all existing demo data...");
  
  try {
    await db.execute(sql`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        -- Delete from tables in dependency order
        DELETE FROM feed_reactions;
        DELETE FROM feed_comments;
        DELETE FROM feed_posts;
        DELETE FROM tournament_participants;
        DELETE FROM tournaments;
        DELETE FROM announcement_reads;
        DELETE FROM announcements;
        DELETE FROM diet_plan_meals;
        DELETE FROM diet_plans;
        DELETE FROM star_members;
        DELETE FROM member_notes;
        DELETE FROM body_measurements;
        DELETE FROM workout_session_exercises;
        DELETE FROM workout_sessions;
        DELETE FROM workout_log_sets;
        DELETE FROM workout_log_exercises;
        DELETE FROM workout_logs;
        DELETE FROM member_rest_day_swaps;
        DELETE FROM workout_completions;
        DELETE FROM workout_plan_sets;
        DELETE FROM workout_items;
        DELETE FROM workout_template_items;
        DELETE FROM workout_templates;
        DELETE FROM phase_exercises;
        DELETE FROM training_phases;
        DELETE FROM workout_cycles;
        DELETE FROM payment_transactions;
        DELETE FROM member_subscriptions;
        DELETE FROM membership_plans;
        DELETE FROM payments;
        DELETE FROM attendance;
        DELETE FROM member_requests;
        DELETE FROM trainer_member_assignments;
        DELETE FROM trainer_members;
        DELETE FROM gym_history;
        DELETE FROM user_profiles;
        DELETE FROM support_messages;
        DELETE FROM support_tickets;
        DELETE FROM gym_subscriptions;
        DELETE FROM join_requests;
        DELETE FROM transfer_requests;
        DELETE FROM gym_requests;
        DELETE FROM password_reset_codes;
        DELETE FROM user_notification_preferences;
        
        -- Try optional tables
        BEGIN DELETE FROM walk_in_visitors; EXCEPTION WHEN undefined_table THEN END;
        BEGIN DELETE FROM kiosk_otp_codes; EXCEPTION WHEN undefined_table THEN END;
        BEGIN DELETE FROM kiosk_sessions; EXCEPTION WHEN undefined_table THEN END;
        BEGIN DELETE FROM audit_logs; EXCEPTION WHEN undefined_table THEN END;
        
        -- Finally delete users and gyms
        DELETE FROM users WHERE is_admin = false;
        DELETE FROM gyms;
      END $$;
    `);
    
    console.log("All demo data cleared successfully!");
  } catch (error) {
    console.error("Error clearing demo data:", error);
    throw error;
  }
}

export async function seedUSADemo(): Promise<void> {
  const PASSWORD = "Demo@12345!";
  const hashedPassword = await hashPassword(PASSWORD);
  const today = new Date();
  const gymStartDate = subDays(today, 90);
  
  console.log("\n=== Creating Gym 24/7 (Birmingham, AL) ===\n");
  
  const [gym] = await db.insert(gyms).values({
    name: GYM_CONFIG.name,
    code: GYM_CONFIG.code,
    phone: GYM_CONFIG.phone,
    address: GYM_CONFIG.address,
    city: GYM_CONFIG.city,
    state: GYM_CONFIG.state,
    country: GYM_CONFIG.country,
    currency: GYM_CONFIG.currency,
    timezone: GYM_CONFIG.timezone,
    timings: "24/7 Access with Key Fob",
    gymType: "unisex",
    facilities: "Free Weights, Machines, Cardio, Showers, Lockers"
  }).returning();
  
  console.log(`Created gym: ${gym.name} (${gym.code})`);
  
  const [owner] = await db.insert(users).values({
    publicId: generatePublicId("OWN"),
    gymId: gym.id,
    username: GYM_CONFIG.ownerUsername,
    password: hashedPassword,
    role: "owner",
    email: GYM_CONFIG.ownerEmail,
    emailVerified: true,
    phone: GYM_CONFIG.phone,
    onboardingCompleted: true
  }).returning();
  
  await db.update(gyms).set({ ownerUserId: owner.id }).where(eq(gyms.id, gym.id));
  
  console.log(`Created owner: ${owner.username} (${owner.email})`);
  
  await db.insert(gymSubscriptions).values({
    gymId: gym.id,
    planType: "6_month",
    amountPaid: 59400,
    currency: "USD",
    paymentStatus: "paid",
    paidOn: gymStartDate,
    validUntil: addMonths(gymStartDate, 6),
    notes: "6-month plan - $99/month"
  });
  
  const trainers: typeof users.$inferSelect[] = [];
  for (const trainerData of TRAINER_DATA) {
    const [trainer] = await db.insert(users).values({
      publicId: generatePublicId("TRN"),
      gymId: gym.id,
      username: `${trainerData.first.toLowerCase()}_trainer`,
      password: hashedPassword,
      role: "trainer",
      email: trainerData.email,
      emailVerified: true,
      phone: generateUSPhoneNumber(),
      onboardingCompleted: true
    }).returning();
    
    await db.insert(userProfiles).values({
      userId: trainer.id,
      fullName: `${trainerData.first} ${trainerData.last}`,
      phone: trainer.phone || generateUSPhoneNumber(),
      gender: trainerData.first === "Sarah" ? "female" : "male",
      dob: `19${getRandomInt(85, 95)}-${String(getRandomInt(1,12)).padStart(2,'0')}-${String(getRandomInt(1,28)).padStart(2,'0')}`,
      age: getRandomInt(28, 40)
    });
    
    trainers.push(trainer);
    console.log(`Created trainer: ${trainerData.first} ${trainerData.last} (${trainer.email})`);
  }
  
  const memberCount = GYM_CONFIG.memberCount;
  const members: (typeof users.$inferSelect & { consistency: string; daysPerWeek: number })[] = [];
  const usedNames = new Set<string>();
  
  console.log(`\nCreating ${memberCount} members...`);
  
  for (let i = 0; i < memberCount; i++) {
    let firstName: string, lastName: string, fullName: string;
    do {
      firstName = getRandomElement(USA_FIRST_NAMES);
      lastName = getRandomElement(USA_LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);
    
    const consistency = assignConsistencyProfile();
    const daysPerWeek = getDaysPerWeek(consistency);
    const memberStartDays = getRandomInt(14, 90);
    
    const [member] = await db.insert(users).values({
      publicId: generatePublicId("MEM"),
      gymId: gym.id,
      username: `${firstName.toLowerCase()}_${lastName.toLowerCase().slice(0,3)}`,
      password: hashedPassword,
      role: "member",
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      emailVerified: true,
      phone: generateUSPhoneNumber(),
      onboardingCompleted: true,
      createdAt: subDays(today, memberStartDays)
    }).returning();
    
    const isMale = ["Michael", "David", "James", "Robert", "John", "William", "Richard", "Joseph", "Thomas", "Christopher", "Charles", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua"].includes(firstName);
    const age = getRandomInt(18, 55);
    const birthYear = new Date().getFullYear() - age;
    
    await db.insert(userProfiles).values({
      userId: member.id,
      fullName: fullName,
      phone: member.phone || generateUSPhoneNumber(),
      gender: isMale ? "male" : "female",
      dob: `${birthYear}-${String(getRandomInt(1,12)).padStart(2,'0')}-${String(getRandomInt(1,28)).padStart(2,'0')}`,
      age: age
    });
    
    const assignedTrainer = trainers[i % trainers.length];
    await db.insert(trainerMembers).values({
      gymId: gym.id,
      trainerId: assignedTrainer.id,
      memberId: member.id
    });
    
    await db.insert(trainerMemberAssignments).values({
      gymId: gym.id,
      trainerId: assignedTrainer.id,
      memberId: member.id,
      startedAt: subDays(today, memberStartDays)
    });
    
    await db.insert(gymHistory).values({
      memberId: member.id,
      gymId: gym.id,
      joinedAt: subDays(today, memberStartDays)
    });
    
    members.push({ ...member, consistency, daysPerWeek });
  }
  
  console.log(`Created ${memberCount} members`);
  
  console.log("\nCreating membership plans and subscriptions...");
  
  const [monthlyPlan] = await db.insert(membershipPlans).values({
    gymId: gym.id,
    name: "Monthly Membership",
    durationMonths: 1,
    priceAmount: 4900,
    isActive: true
  }).returning();
  
  const [quarterlyPlan] = await db.insert(membershipPlans).values({
    gymId: gym.id,
    name: "3-Month Membership",
    durationMonths: 3,
    priceAmount: 12900,
    isActive: true
  }).returning();
  
  const [semiAnnualPlan] = await db.insert(membershipPlans).values({
    gymId: gym.id,
    name: "6-Month Membership",
    durationMonths: 6,
    priceAmount: 23400,
    isActive: true
  }).returning();
  
  const plans = [monthlyPlan, quarterlyPlan, semiAnnualPlan];
  
  for (const member of members) {
    const planChoice = Math.random();
    let selectedPlan = monthlyPlan;
    if (planChoice > 0.7) selectedPlan = semiAnnualPlan;
    else if (planChoice > 0.4) selectedPlan = quarterlyPlan;
    
    const memberJoinDays = getRandomInt(14, 90);
    const startDate = format(subDays(today, memberJoinDays), 'yyyy-MM-dd');
    const endDate = format(addMonths(subDays(today, memberJoinDays), selectedPlan.durationMonths), 'yyyy-MM-dd');
    
    const isPaid = Math.random() > 0.15;
    const status = isPaid ? "active" : (Math.random() > 0.5 ? "overdue" : "endingSoon");
    
    const [subscription] = await db.insert(memberSubscriptions).values({
      gymId: gym.id,
      memberId: member.id,
      planId: selectedPlan.id,
      startDate,
      endDate,
      totalAmount: selectedPlan.priceAmount,
      status: status as any,
      paymentMode: "full"
    }).returning();
    
    if (isPaid) {
      await db.insert(paymentTransactions).values({
        gymId: gym.id,
        memberId: member.id,
        subscriptionId: subscription.id,
        paidOn: startDate,
        amountPaid: selectedPlan.priceAmount,
        method: getRandomElement(["cash", "card", "upi"] as const),
        referenceNote: "Subscription payment"
      });
    }
  }
  
  console.log("Created membership subscriptions and payments");
  
  console.log("\nCreating workout cycles and completions...");
  
  let totalCompletions = 0;
  
  for (const member of members) {
    const template = getRandomElement(WORKOUT_TEMPLATES_DATA);
    const memberStartDays = getRandomInt(14, 85);
    const startDate = format(subDays(today, memberStartDays), 'yyyy-MM-dd');
    const endDate = format(addMonths(new Date(startDate), 3), 'yyyy-MM-dd');
    
    const assignedTrainer = trainers[members.indexOf(member) % trainers.length];
    
    const [cycle] = await db.insert(workoutCycles).values({
      gymId: gym.id,
      trainerId: assignedTrainer.id,
      memberId: member.id,
      name: template.name,
      cycleLength: template.cycleLength,
      dayLabels: template.dayLabels,
      restDays: template.restDays,
      startDate,
      endDate,
      isActive: true
    }).returning();
    
    const workoutItemsCreated: (typeof workoutItems.$inferSelect)[] = [];
    for (let dayIdx = 0; dayIdx < template.days.length; dayIdx++) {
      const day = template.days[dayIdx];
      for (let exIdx = 0; exIdx < day.exercises.length; exIdx++) {
        const ex = day.exercises[exIdx];
        const [item] = await db.insert(workoutItems).values({
          cycleId: cycle.id,
          dayIndex: dayIdx,
          muscleType: ex.muscle,
          bodyPart: ex.body,
          exerciseName: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          orderIndex: exIdx
        }).returning();
        workoutItemsCreated.push(item);
      }
    }
    
    const workoutDays = generateWorkoutDays(memberStartDays, 0, member.daysPerWeek);
    
    for (const workoutDate of workoutDays) {
      const dayIndex = getRandomInt(0, template.days.length - 1);
      const dayExercises = workoutItemsCreated.filter(w => w.dayIndex === dayIndex);
      
      const completeAll = Math.random() > 0.15;
      const exercisesToComplete = completeAll 
        ? dayExercises 
        : dayExercises.slice(0, Math.max(1, Math.floor(dayExercises.length * 0.7)));
      
      for (const exercise of exercisesToComplete) {
        await db.insert(workoutCompletions).values({
          gymId: gym.id,
          cycleId: cycle.id,
          workoutItemId: exercise.id,
          memberId: member.id,
          completedDate: workoutDate,
          exerciseName: exercise.exerciseName,
          actualSets: exercise.sets + getRandomInt(-1, 1),
          actualReps: exercise.reps + getRandomInt(-2, 2),
          actualWeight: exercise.weight
        });
        totalCompletions++;
      }
      
      await db.insert(attendance).values({
        gymId: gym.id,
        memberId: member.id,
        markedByUserId: member.id,
        date: workoutDate,
        status: "present",
        verifiedMethod: "workout"
      });
    }
  }
  
  console.log(`Created ${totalCompletions} workout completions`);
  
  console.log("\nCreating body measurements...");
  
  let measurementCount = 0;
  for (const member of members.slice(0, 20)) {
    const measurementDates = [
      format(subDays(today, 90), 'yyyy-MM-dd'),
      format(subDays(today, 60), 'yyyy-MM-dd'),
      format(subDays(today, 30), 'yyyy-MM-dd'),
      format(today, 'yyyy-MM-dd')
    ];
    
    const isMale = getRandomInt(0, 1) === 1;
    let baseWeight = isMale ? getRandomInt(160, 220) : getRandomInt(120, 170);
    
    for (let i = 0; i < measurementDates.length; i++) {
      const weightChange = getRandomInt(-3, 5);
      await db.insert(bodyMeasurements).values({
        gymId: gym.id,
        memberId: member.id,
        recordedDate: measurementDates[i],
        weight: (baseWeight + (i * weightChange)) * 10,
        height: isMale ? getRandomInt(66, 74) * 10 : getRandomInt(62, 68) * 10,
        bodyFat: isMale ? getRandomInt(12, 25) * 10 : getRandomInt(18, 32) * 10,
        chest: isMale ? getRandomInt(38, 46) * 10 : getRandomInt(32, 40) * 10,
        waist: isMale ? getRandomInt(30, 38) * 10 : getRandomInt(26, 34) * 10,
        biceps: isMale ? getRandomInt(13, 17) * 10 : getRandomInt(10, 14) * 10,
        isInitial: i === 0
      });
      measurementCount++;
    }
  }
  
  console.log(`Created ${measurementCount} body measurements`);
  
  console.log("\nCreating announcements...");
  
  for (let i = 0; i < ANNOUNCEMENT_TEMPLATES.length; i++) {
    const template = ANNOUNCEMENT_TEMPLATES[i];
    const createdDays = 90 - (i * 10);
    
    const [announcement] = await db.insert(announcements).values({
      gymId: gym.id,
      title: template.title,
      body: template.body,
      audience: template.audience,
      createdByOwnerId: owner.id,
      createdAt: subDays(today, createdDays)
    }).returning();
    
    const readCount = Math.floor(members.length * getRandomInt(40, 80) / 100);
    for (let j = 0; j < readCount; j++) {
      try {
        await db.insert(announcementReads).values({
          announcementId: announcement.id,
          userId: members[j].id,
          readAt: subDays(today, createdDays - getRandomInt(0, 5))
        });
      } catch (e) { }
    }
  }
  
  console.log(`Created ${ANNOUNCEMENT_TEMPLATES.length} announcements`);
  
  console.log("\nCreating star members and diet plans...");
  
  const starMemberCandidates = members.filter(m => m.consistency === "very_consistent").slice(0, 6);
  
  for (let i = 0; i < starMemberCandidates.length; i++) {
    const member = starMemberCandidates[i];
    const trainer = trainers[i % trainers.length];
    
    await db.insert(starMembers).values({
      gymId: gym.id,
      trainerId: trainer.id,
      memberId: member.id
    });
    
    const dietTemplate = getRandomElement(DIET_PLAN_TEMPLATES);
    const [dietPlan] = await db.insert(dietPlans).values({
      gymId: gym.id,
      trainerId: trainer.id,
      memberId: member.id,
      title: dietTemplate.title,
      durationWeeks: dietTemplate.durationWeeks,
      notes: dietTemplate.notes,
      isActive: true
    }).returning();
    
    for (const meal of dietTemplate.meals) {
      await db.insert(dietPlanMeals).values({
        planId: dietPlan.id,
        dayIndex: meal.dayIndex,
        mealType: meal.mealType,
        description: meal.description,
        calories: meal.calories,
        protein: meal.protein
      });
    }
  }
  
  console.log(`Created ${starMemberCandidates.length} star members with diet plans`);
  
  console.log("\nCreating feed posts...");
  
  let feedPostCount = 0;
  for (const member of members.slice(0, 20)) {
    if (Math.random() > 0.4) {
      const postDays = getRandomInt(1, 60);
      const postTypes = ["workout_complete", "streak", "personal_best"];
      const postType = getRandomElement(postTypes);
      
      let content = "";
      if (postType === "workout_complete") {
        content = `Just crushed ${getRandomElement(["leg day", "push day", "pull day", "full body"])}! 💪`;
      } else if (postType === "streak") {
        content = `${getRandomInt(7, 30)} day streak! Consistency is key! 🔥`;
      } else {
        content = `New PR on ${getRandomElement(["bench press", "squats", "deadlifts"])}! ${getRandomInt(185, 315)} lbs! 🏆`;
      }
      
      const [post] = await db.insert(feedPosts).values({
        gymId: gym.id,
        userId: member.id,
        type: postType as any,
        content,
        createdAt: subDays(today, postDays)
      }).returning();
      
      const reactionCount = getRandomInt(1, 8);
      for (let r = 0; r < reactionCount; r++) {
        const reactor = members[getRandomInt(0, members.length - 1)];
        if (reactor.id !== member.id) {
          try {
            await db.insert(feedReactions).values({
              postId: post.id,
              userId: reactor.id,
              reactionType: getRandomElement(["like", "fire", "muscle"] as const)
            });
          } catch (e) { }
        }
      }
      
      feedPostCount++;
    }
  }
  
  console.log(`Created ${feedPostCount} feed posts`);
  
  console.log("\nCreating member notes...");
  
  for (const trainer of trainers) {
    const trainerMembers$ = members.filter((_, idx) => idx % trainers.length === trainers.indexOf(trainer));
    for (const member of trainerMembers$.slice(0, 5)) {
      await db.insert(memberNotes).values({
        gymId: gym.id,
        trainerId: trainer.id,
        memberId: member.id,
        content: getRandomElement(MEMBER_NOTE_TEMPLATES),
        createdAt: subDays(today, getRandomInt(1, 30))
      });
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("USA DEMO DATA SEEDED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log("\n📋 DEMO LOGIN CREDENTIALS");
  console.log("-".repeat(40));
  console.log(`\nPassword for ALL accounts: ${PASSWORD}`);
  console.log("\n👤 OWNER:");
  console.log(`   Email: ${GYM_CONFIG.ownerEmail}`);
  console.log(`   Username: ${GYM_CONFIG.ownerUsername}`);
  console.log("\n🏋️ TRAINERS:");
  for (const t of TRAINER_DATA) {
    console.log(`   ${t.first} ${t.last}: ${t.email}`);
  }
  console.log("\n👥 HIGHLIGHT MEMBERS (for demos):");
  for (const member of members.slice(0, 5)) {
    console.log(`   ${member.email}`);
  }
  console.log("\n" + "-".repeat(40));
  console.log(`\n🏢 Gym: ${GYM_CONFIG.name}`);
  console.log(`📍 Location: ${GYM_CONFIG.city}, ${GYM_CONFIG.state}`);
  console.log(`🔑 Gym Code: ${GYM_CONFIG.code}`);
  console.log(`💵 Currency: ${GYM_CONFIG.currency}`);
  console.log(`👥 Total Members: ${memberCount}`);
  console.log(`📊 Data Range: Last 90 days`);
  console.log("=".repeat(60) + "\n");
}

export async function resetAndSeedUSADemo(): Promise<void> {
  await clearAllDemoData();
  await seedUSADemo();
}
