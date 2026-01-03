import { db } from "./db";
import { 
  users, gyms, gymSubscriptions, trainerMembers, trainerMemberAssignments,
  attendance, membershipPlans, memberSubscriptions, paymentTransactions, payments,
  workoutCycles, workoutItems, workoutCompletions, workoutSessions, workoutSessionExercises,
  bodyMeasurements, starMembers, gymHistory, dietPlans, dietPlanMeals, announcements, announcementReads,
  memberNotes, workoutTemplates, workoutTemplateItems, memberRequests
} from "@shared/schema";
import { eq, like, or, and, inArray } from "drizzle-orm";
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
  "Suresh", "Vandana", "Ramesh", "Rekha", "Mahesh", "Sunita", "Dinesh", "Geeta"
];

const GYM_CONFIGS = [
  {
    name: "FitZone Pro Gym",
    code: "FITZONE1",
    phone: "+91 9876543210",
    address: "123 MG Road, Koramangala, Bangalore, Karnataka 560034",
    ownerUsername: "fitzone_owner",
    ownerEmail: "owner@fitzonepro.in",
    subscriptionStatus: "paid" as const,
    trainerCount: 5,
    memberCount: 75
  },
  {
    name: "Iron Temple Fitness",
    code: "IRONTEMP",
    phone: "+91 9123456780",
    address: "45 Anna Salai, T Nagar, Chennai, Tamil Nadu 600017",
    ownerUsername: "irontemple_owner",
    ownerEmail: "owner@irontemple.in",
    subscriptionStatus: "overdue" as const,
    trainerCount: 4,
    memberCount: 60
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

const WORKOUT_TEMPLATES = [
  {
    name: "PPL Split",
    cycleLength: 6,
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
    cycleLength: 4,
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
    cycleLength: 3,
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
  }
];

const CONSISTENCY_PROFILES = [
  { name: "very_consistent", daysPerWeek: [5, 6], percentage: 0.30 },
  { name: "moderate", daysPerWeek: [3, 4], percentage: 0.50 },
  { name: "irregular", daysPerWeek: [0, 1, 2], percentage: 0.20 }
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
  console.log("[Demo Reset] Clearing demo data...");
  
  const demoGyms = await db.select().from(gyms).where(
    or(eq(gyms.code, "FITZONE1"), eq(gyms.code, "IRONTEMP"), eq(gyms.code, "DEMO01"))
  );
  
  const gymIds = demoGyms.map(g => g.id);
  
  if (gymIds.length === 0) {
    console.log("[Demo Reset] No demo gyms found.");
    return;
  }
  
  console.log(`[Demo Reset] Found ${demoGyms.length} demo gyms with IDs: ${gymIds.join(", ")}`);
  
  const demoSessions = await db.select().from(workoutSessions).where(inArray(workoutSessions.gymId, gymIds));
  const sessionIds = demoSessions.map(s => s.id);
  
  if (sessionIds.length > 0) {
    await db.delete(workoutSessionExercises).where(inArray(workoutSessionExercises.sessionId, sessionIds));
    await db.delete(workoutSessions).where(inArray(workoutSessions.id, sessionIds));
  }
  
  const demoCycles = await db.select().from(workoutCycles).where(inArray(workoutCycles.gymId, gymIds));
  const cycleIds = demoCycles.map(c => c.id);
  
  if (cycleIds.length > 0) {
    await db.delete(workoutCompletions).where(inArray(workoutCompletions.cycleId, cycleIds));
    await db.delete(workoutItems).where(inArray(workoutItems.cycleId, cycleIds));
    await db.delete(workoutCycles).where(inArray(workoutCycles.id, cycleIds));
  }
  
  await db.delete(attendance).where(inArray(attendance.gymId, gymIds));
  await db.delete(bodyMeasurements).where(inArray(bodyMeasurements.gymId, gymIds));
  await db.delete(paymentTransactions).where(inArray(paymentTransactions.gymId, gymIds));
  await db.delete(payments).where(inArray(payments.gymId, gymIds));
  await db.delete(memberSubscriptions).where(inArray(memberSubscriptions.gymId, gymIds));
  await db.delete(membershipPlans).where(inArray(membershipPlans.gymId, gymIds));
  await db.delete(trainerMemberAssignments).where(inArray(trainerMemberAssignments.gymId, gymIds));
  await db.delete(trainerMembers).where(inArray(trainerMembers.gymId, gymIds));
  await db.delete(starMembers).where(inArray(starMembers.gymId, gymIds));
  await db.delete(gymHistory).where(inArray(gymHistory.gymId, gymIds));
  await db.delete(memberRequests).where(inArray(memberRequests.gymId, gymIds));
  await db.delete(memberNotes).where(inArray(memberNotes.gymId, gymIds));
  
  const demoAnnouncements = await db.select().from(announcements).where(inArray(announcements.gymId, gymIds));
  const announcementIds = demoAnnouncements.map(a => a.id);
  if (announcementIds.length > 0) {
    await db.delete(announcementReads).where(inArray(announcementReads.announcementId, announcementIds));
    await db.delete(announcements).where(inArray(announcements.id, announcementIds));
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
  
  await db.delete(gymSubscriptions).where(inArray(gymSubscriptions.gymId, gymIds));
  
  await db.delete(users).where(inArray(users.gymId, gymIds));
  
  for (const gymId of gymIds) {
    await db.update(gyms).set({ ownerUserId: null }).where(eq(gyms.id, gymId));
    await db.delete(gyms).where(eq(gyms.id, gymId));
  }
  
  console.log("[Demo Reset] Demo data cleared successfully.");
}

export async function seedDemoData(): Promise<void> {
  console.log("[Demo Seed] Starting comprehensive demo data seeding...");
  
  const existingDemoGym = await db.select().from(gyms).where(
    or(eq(gyms.code, "FITZONE1"), eq(gyms.code, "IRONTEMP"))
  ).limit(1);
  
  if (existingDemoGym.length > 0) {
    console.log("[Demo Seed] Demo gyms already exist. Run reset first or skip.");
    return;
  }

  const hashedPassword = await hashPassword("demo123");
  const today = new Date();
  const historyStartDays = 55;
  const historyEndDays = 0;
  
  const allCredentials: { gym: string; role: string; username: string; password: string }[] = [];
  let usedNames = new Set<string>();
  
  for (const gymConfig of GYM_CONFIGS) {
    console.log(`\n[Demo Seed] Creating gym: ${gymConfig.name}...`);
    
    const [gym] = await db.insert(gyms).values({
      name: gymConfig.name,
      code: gymConfig.code,
      phone: gymConfig.phone,
      address: gymConfig.address,
    }).returning();
    
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
      planType: gymConfig.subscriptionStatus === "paid" ? "3_month" : "1_month",
      amountPaid: gymConfig.subscriptionStatus === "paid" ? 500000 : 0,
      paymentStatus: gymConfig.subscriptionStatus,
      paidOn: gymConfig.subscriptionStatus === "paid" ? subDays(today, 20) : null,
      validUntil: gymConfig.subscriptionStatus === "paid" ? addMonths(today, 2) : subDays(today, 5),
      notes: gymConfig.subscriptionStatus === "paid" ? "Active subscription" : "Payment pending",
    });
    
    const [plan] = await db.insert(membershipPlans).values({
      gymId: gym.id,
      name: "Standard Monthly",
      durationMonths: 1,
      priceAmount: 200000,
      isActive: true,
    }).returning();
    
    const trainers: any[] = [];
    const randSuffix = getRandomInt(100, 999);
    for (let t = 0; t < gymConfig.trainerCount; t++) {
      const trainerName = TRAINER_NAMES[t % TRAINER_NAMES.length];
      const trainerUsername = `${trainerName.first.toLowerCase()}${t}_${gym.code.toLowerCase().slice(0, 4)}${randSuffix}`;
      
      const [trainer] = await db.insert(users).values({
        username: trainerUsername,
        password: hashedPassword,
        role: "trainer",
        gymId: gym.id,
        publicId: generatePublicId("TRN"),
        email: `${trainerName.first.toLowerCase()}${t}@${gymConfig.name.toLowerCase().replace(/\s+/g, '')}.in`,
        phone: `+91 98${getRandomInt(10000000, 99999999)}`,
      }).returning();
      
      trainers.push(trainer);
      if (t < 2) {
        allCredentials.push({ gym: gymConfig.name, role: "trainer", username: trainerUsername, password: "demo123" });
      }
    }
    console.log(`[Demo Seed] Created ${trainers.length} trainers for ${gymConfig.name}`);
    
    const members: any[] = [];
    const membersPerTrainer = Math.ceil(gymConfig.memberCount / trainers.length);
    
    for (let m = 0; m < gymConfig.memberCount; m++) {
      let firstName: string;
      do {
        firstName = getRandomElement(FIRST_NAMES);
      } while (usedNames.has(`${firstName}_${gym.code}`));
      usedNames.add(`${firstName}_${gym.code}`);
      
      const memberUsername = `${firstName.toLowerCase()}${m}_${gym.code.toLowerCase().slice(0, 4)}${randSuffix}`;
      
      const [member] = await db.insert(users).values({
        username: memberUsername,
        password: hashedPassword,
        role: "member",
        gymId: gym.id,
        publicId: generatePublicId("MEM"),
        email: `${firstName.toLowerCase()}${getRandomInt(1, 999)}@email.com`,
        phone: `+91 ${getRandomInt(7000000000, 9999999999)}`,
      }).returning();
      
      members.push({
        ...member,
        consistencyProfile: assignConsistencyProfile(),
        assignedTrainer: trainers[m % trainers.length]
      });
      
      if (m < 3) {
        allCredentials.push({ gym: gymConfig.name, role: "member", username: memberUsername, password: "demo123" });
      }
    }
    console.log(`[Demo Seed] Created ${members.length} members for ${gymConfig.name}`);
    
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
      
      const joinDate = subDays(today, historyStartDays + getRandomInt(0, 15));
      const [subscription] = await db.insert(memberSubscriptions).values({
        gymId: gym.id,
        memberId: member.id,
        planId: plan.id,
        startDate: format(joinDate, "yyyy-MM-dd"),
        endDate: format(addDays(joinDate, 60), "yyyy-MM-dd"),
        status: Math.random() > 0.15 ? "active" : "ended",
        totalAmount: plan.priceAmount,
        paymentMode: "full",
      }).returning();
      
      member.subscriptionId = subscription.id;
    }
    console.log(`[Demo Seed] Assigned members to trainers for ${gymConfig.name}`);
    
    const workoutCyclesCreated: any[] = [];
    for (let t = 0; t < trainers.length; t++) {
      const template = WORKOUT_TEMPLATES[t % WORKOUT_TEMPLATES.length];
      const trainerMembers = members.filter(m => m.assignedTrainer.id === trainers[t].id);
      
      for (const member of trainerMembers) {
        const cycleStart = subDays(today, historyStartDays);
        const cycleEnd = addDays(today, 30);
        
        const [cycle] = await db.insert(workoutCycles).values({
          gymId: gym.id,
          trainerId: trainers[t].id,
          memberId: member.id,
          name: template.name,
          cycleLength: template.cycleLength,
          dayLabels: template.dayLabels,
          startDate: format(cycleStart, "yyyy-MM-dd"),
          endDate: format(cycleEnd, "yyyy-MM-dd"),
          isActive: true,
        }).returning();
        
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
        
        workoutCyclesCreated.push({ cycle, items: itemsForCycle, member, template });
      }
    }
    console.log(`[Demo Seed] Created workout cycles for ${gymConfig.name}`);
    
    let completionsCount = 0;
    let attendanceCount = 0;
    
    for (const { cycle, items, member, template } of workoutCyclesCreated) {
      const daysPerWeek = getDaysPerWeek(member.consistencyProfile);
      const workoutDays = generateWorkoutDays(historyStartDays, historyEndDays, daysPerWeek);
      
      for (const workoutDate of workoutDays) {
        const daysSinceStart = Math.floor(
          (new Date(workoutDate).getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const currentDayIndex = ((daysSinceStart % template.cycleLength) + template.cycleLength) % template.cycleLength;
        const effectiveDayIndex = currentDayIndex % template.days.length;
        
        const dayItems = items.filter((i: any) => i.dayIdx === effectiveDayIndex);
        
        const completionRate = member.consistencyProfile === "very_consistent" ? 0.95 :
                               member.consistencyProfile === "moderate" ? 0.80 : 0.60;
        
        const completedItems = dayItems.filter(() => Math.random() < completionRate);
        
        for (const item of completedItems) {
          const setsVar = Math.random() > 0.8 ? getRandomInt(-1, 1) : 0;
          const repsVar = Math.random() > 0.7 ? getRandomInt(-2, 2) : 0;
          
          const notes = Math.random() > 0.9 ? 
            getRandomElement(["Felt strong", "Increase weight next time", "Good form", "Slightly tired", "PR attempt"]) : 
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
          completionsCount++;
        }
        
        if (completedItems.length > 0) {
          await db.insert(attendance).values({
            gymId: gym.id,
            memberId: member.id,
            markedByUserId: member.id,
            date: workoutDate,
            status: "present",
            verifiedMethod: "workout",
          });
          attendanceCount++;
        }
      }
    }
    console.log(`[Demo Seed] Created ${completionsCount} workout completions and ${attendanceCount} attendance records for ${gymConfig.name}`);
    
    let paymentsCount = 0;
    for (const member of members) {
      if (!member.subscriptionId) continue;
      
      const paymentDate = subDays(today, getRandomInt(20, 50));
      await db.insert(paymentTransactions).values({
        gymId: gym.id,
        memberId: member.id,
        subscriptionId: member.subscriptionId,
        paidOn: format(paymentDate, "yyyy-MM-dd"),
        amountPaid: plan.priceAmount,
        method: getRandomElement(["cash", "upi", "card", "bank"]),
        referenceNote: `Monthly payment - ${format(paymentDate, "MMM yyyy")}`,
      });
      paymentsCount++;
    }
    console.log(`[Demo Seed] Created ${paymentsCount} payment records for ${gymConfig.name}`);
    
    // === BODY MEASUREMENTS SEEDING ===
    const MEASUREMENT_NOTES = [
      "Feeling great", "Cut going well", "Bulk phase", "Post cheat meal", 
      "Felt bloated", "Morning weigh-in", "After workout", "Dehydrated",
      "Good progress", "Need to focus on diet", "Consistent training",
      null, null, null, null, null // More nulls for realism
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
      if (rand < 6) return 7 + getRandomInt(0, 3); // 60%: weekly (7-10 days)
      if (rand < 9) return 12 + getRandomInt(0, 4); // 30%: bi-weekly (12-16 days)
      return 999; // 10%: only 1-2 entries
    };
    
    let measurementsCount = 0;
    const sampleMemberLogs: { username: string; profile: MeasurementProfile; entries: any[] }[] = [];
    
    for (let mIdx = 0; mIdx < members.length; mIdx++) {
      const member = members[mIdx];
      const profile = getMemberProfile(mIdx);
      const frequency = getMeasurementFrequency(mIdx);
      
      // Base measurements - realistic starting values
      const isMale = mIdx % 3 !== 0; // Roughly 2/3 male
      let baseWeight = isMale ? getRandomInt(65, 90) : getRandomInt(50, 70);
      let baseHeight = isMale ? getRandomInt(165, 185) : getRandomInt(155, 170);
      let baseBodyFat = isMale ? getRandomInt(15, 28) : getRandomInt(22, 35);
      let baseChest = isMale ? getRandomInt(90, 110) : getRandomInt(80, 100);
      let baseWaist = isMale ? getRandomInt(78, 95) : getRandomInt(65, 85);
      let baseHips = isMale ? getRandomInt(90, 105) : getRandomInt(90, 110);
      let baseBiceps = isMale ? getRandomInt(30, 38) : getRandomInt(25, 32);
      let baseThighs = isMale ? getRandomInt(50, 62) : getRandomInt(48, 58);
      
      const memberEntries: any[] = [];
      
      // Generate entries over the last 55 days
      const measurementDays: number[] = [];
      if (frequency >= 999) {
        // Inconsistent: only 1-2 entries
        measurementDays.push(getRandomInt(10, 50));
        if (Math.random() > 0.5) measurementDays.push(getRandomInt(5, 25));
      } else {
        // Regular frequency
        for (let day = 55; day >= 0; day -= frequency) {
          measurementDays.push(day + getRandomInt(-2, 2));
        }
      }
      
      for (let i = 0; i < measurementDays.length; i++) {
        const daysAgo = Math.max(0, Math.min(55, measurementDays[i]));
        const measureDate = format(subDays(today, daysAgo), "yyyy-MM-dd");
        
        // Apply profile-based progression
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
          // Inconsistent - random variation
          weight = baseWeight + (Math.random() - 0.5) * 6;
          waist = baseWaist + (Math.random() - 0.5) * 4;
        }
        
        // Add small random noise
        weight = Math.round((weight + (Math.random() - 0.5) * 1) * 10) / 10;
        chest = Math.round((chest + (Math.random() - 0.5) * 1) * 10) / 10;
        waist = Math.round((waist + (Math.random() - 0.5) * 1) * 10) / 10;
        hips = Math.round((hips + (Math.random() - 0.5) * 1) * 10) / 10;
        biceps = Math.round((biceps + (Math.random() - 0.5) * 0.5) * 10) / 10;
        thighs = Math.round((thighs + (Math.random() - 0.5) * 1) * 10) / 10;
        bodyFat = Math.round((bodyFat + (Math.random() - 0.5) * 1) * 10) / 10;
        
        const entry = {
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
        };
        
        await db.insert(bodyMeasurements).values(entry);
        measurementsCount++;
        memberEntries.push({ date: measureDate, weight: entry.weight, waist: entry.waist, bodyFat: entry.bodyFat });
      }
      
      // Log sample members (first 3 from each gym)
      if (mIdx < 3) {
        sampleMemberLogs.push({
          username: member.username,
          profile,
          entries: memberEntries
        });
      }
    }
    
    console.log(`[Demo Seed] Created ${measurementsCount} body measurement records for ${gymConfig.name}`);
    
    // Print sample member data
    if (sampleMemberLogs.length > 0) {
      console.log(`\n[Demo Seed] Sample Body Measurement History for ${gymConfig.name}:`);
      for (const sample of sampleMemberLogs) {
        console.log(`  ${sample.username} (${sample.profile}):`);
        for (const entry of sample.entries.slice(0, 5)) {
          console.log(`    ${entry.date}: ${entry.weight}kg, waist ${entry.waist}cm${entry.bodyFat ? `, bf ${entry.bodyFat}%` : ''}`);
        }
      }
    }
  }
  
  console.log("\n========================================");
  console.log("DEMO LOGIN CREDENTIALS");
  console.log("Password for all accounts: demo123");
  console.log("========================================\n");
  
  for (const cred of allCredentials) {
    console.log(`[${cred.gym}] ${cred.role.toUpperCase()}: ${cred.username}`);
  }
  
  console.log("\n========================================");
  console.log("Demo data seeding completed successfully!");
  console.log("========================================\n");
}
