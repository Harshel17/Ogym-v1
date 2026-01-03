import { db } from "./db";
import { 
  users, gyms, gymSubscriptions, trainerMembers, trainerMemberAssignments,
  attendance, membershipPlans, memberSubscriptions, paymentTransactions,
  workoutCycles, workoutItems, workoutCompletions, workoutSessions, workoutSessionExercises
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { format, subDays, addMonths } from "date-fns";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function generatePublicId(prefix: string): string {
  return `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function generateGymCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

export async function seedDemoData(): Promise<void> {
  console.log("[Demo Seed] Starting demo data seeding...");

  const existingDemoGym = await db.select().from(gyms).where(eq(gyms.code, "DEMO01")).limit(1);
  if (existingDemoGym.length > 0) {
    console.log("[Demo Seed] Demo gym already exists. Skipping.");
    return;
  }

  const hashedPassword = await hashPassword("demo123");
  const today = format(new Date(), "yyyy-MM-dd");

  const [demoGym] = await db.insert(gyms).values({
    name: "FitZone Demo Gym",
    code: "DEMO01",
    phone: "+91 9876543210",
    address: "123 Fitness Street, Mumbai, Maharashtra 400001",
  }).returning();

  console.log(`[Demo Seed] Created demo gym: ${demoGym.name} (Code: ${demoGym.code})`);

  const [owner] = await db.insert(users).values({
    username: "demoowner",
    password: hashedPassword,
    role: "owner",
    gymId: demoGym.id,
    publicId: generatePublicId("OWN"),
    email: "owner@fitzone.demo",
    phone: "+91 9876543210",
  }).returning();

  await db.update(gyms).set({ ownerUserId: owner.id }).where(eq(gyms.id, demoGym.id));

  const [trainer1] = await db.insert(users).values({
    username: "demotrainer1",
    password: hashedPassword,
    role: "trainer",
    gymId: demoGym.id,
    publicId: generatePublicId("TRN"),
    email: "trainer1@fitzone.demo",
    phone: "+91 9876543211",
  }).returning();

  const [trainer2] = await db.insert(users).values({
    username: "demotrainer2",
    password: hashedPassword,
    role: "trainer",
    gymId: demoGym.id,
    publicId: generatePublicId("TRN"),
    email: "trainer2@fitzone.demo",
    phone: "+91 9876543212",
  }).returning();

  console.log(`[Demo Seed] Created trainers: ${trainer1.username}, ${trainer2.username}`);

  const memberNames = ["rahul", "priya", "amit", "neha", "vikram", "ananya", "karan", "divya"];
  const members: any[] = [];

  for (let i = 0; i < memberNames.length; i++) {
    const [member] = await db.insert(users).values({
      username: `demo${memberNames[i]}`,
      password: hashedPassword,
      role: "member",
      gymId: demoGym.id,
      publicId: generatePublicId("MEM"),
      email: `${memberNames[i]}@fitzone.demo`,
      phone: `+91 98765432${20 + i}`,
    }).returning();
    members.push(member);
  }

  console.log(`[Demo Seed] Created ${members.length} demo members`);

  for (let i = 0; i < members.length; i++) {
    const assignedTrainer = i < 4 ? trainer1 : trainer2;
    await db.insert(trainerMembers).values({
      gymId: demoGym.id,
      trainerId: assignedTrainer.id,
      memberId: members[i].id,
    });
    await db.insert(trainerMemberAssignments).values({
      gymId: demoGym.id,
      trainerId: assignedTrainer.id,
      memberId: members[i].id,
      startedAt: subDays(new Date(), 30),
    });
  }

  console.log("[Demo Seed] Assigned members to trainers");

  await db.insert(gymSubscriptions).values({
    gymId: demoGym.id,
    planType: "3_month",
    amountPaid: 500000,
    paymentStatus: "paid",
    paidOn: subDays(new Date(), 15),
    validUntil: addMonths(new Date(), 3),
    notes: "Demo gym subscription",
  });

  const [basicPlan] = await db.insert(membershipPlans).values({
    gymId: demoGym.id,
    name: "Basic Monthly",
    durationMonths: 1,
    priceAmount: 150000,
    isActive: true,
  }).returning();

  const [premiumPlan] = await db.insert(membershipPlans).values({
    gymId: demoGym.id,
    name: "Premium Quarterly",
    durationMonths: 3,
    priceAmount: 400000,
    isActive: true,
  }).returning();

  console.log("[Demo Seed] Created membership plans");

  for (let i = 0; i < members.length; i++) {
    const plan = i % 2 === 0 ? basicPlan : premiumPlan;
    const startDate = format(subDays(new Date(), 15 + (i * 3)), "yyyy-MM-dd");
    const endDate = format(addMonths(new Date(startDate), plan.durationMonths), "yyyy-MM-dd");
    const isPaid = i < 6;

    const [subscription] = await db.insert(memberSubscriptions).values({
      gymId: demoGym.id,
      memberId: members[i].id,
      planId: plan.id,
      startDate,
      endDate,
      totalAmount: plan.priceAmount,
      status: isPaid ? "active" : "overdue",
      paymentMode: "full",
    }).returning();

    if (isPaid) {
      await db.insert(paymentTransactions).values({
        gymId: demoGym.id,
        memberId: members[i].id,
        subscriptionId: subscription.id,
        paidOn: startDate,
        amountPaid: plan.priceAmount,
        method: i % 3 === 0 ? "cash" : i % 3 === 1 ? "upi" : "card",
        referenceNote: `Payment for ${plan.name}`,
      });
    }
  }

  console.log("[Demo Seed] Created member subscriptions and payments");

  for (let i = 0; i < members.length; i++) {
    const attendanceDays = 10 + Math.floor(Math.random() * 15);
    for (let d = 0; d < attendanceDays; d++) {
      const date = format(subDays(new Date(), d + Math.floor(Math.random() * 5)), "yyyy-MM-dd");
      try {
        await db.insert(attendance).values({
          gymId: demoGym.id,
          memberId: members[i].id,
          markedByUserId: members[i].id,
          date,
          status: "present",
          verifiedMethod: d % 3 === 0 ? "qr" : d % 3 === 1 ? "workout" : "manual",
        });
      } catch (e) {
      }
    }
  }

  console.log("[Demo Seed] Created attendance records");

  const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
  const exercises: Record<string, string[]> = {
    "Chest": ["Bench Press", "Incline Dumbbell Press", "Cable Fly", "Push-ups", "Chest Dips"],
    "Back": ["Deadlift", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "Pull-ups"],
    "Legs": ["Squats", "Leg Press", "Lunges", "Leg Curl", "Calf Raises"],
    "Shoulders": ["Overhead Press", "Lateral Raises", "Front Raises", "Face Pulls", "Arnold Press"],
    "Arms": ["Bicep Curls", "Tricep Pushdown", "Hammer Curls", "Skull Crushers", "Preacher Curls"],
    "Core": ["Planks", "Crunches", "Russian Twists", "Leg Raises", "Mountain Climbers"],
  };

  for (let m = 0; m < 4; m++) {
    const trainer = m < 2 ? trainer1 : trainer2;
    const member = members[m];
    const startDate = format(subDays(new Date(), 14), "yyyy-MM-dd");
    const endDate = format(addMonths(new Date(), 1), "yyyy-MM-dd");

    const [cycle] = await db.insert(workoutCycles).values({
      gymId: demoGym.id,
      trainerId: trainer.id,
      memberId: member.id,
      name: `${member.username}'s Training Program`,
      cycleLength: 6,
      dayLabels: ["Push Day", "Pull Day", "Leg Day", "Shoulders", "Arms", "Rest"],
      startDate,
      endDate,
      isActive: true,
    }).returning();

    for (let day = 0; day < 5; day++) {
      const muscle = muscleGroups[day];
      const dayExercises = exercises[muscle];
      
      for (let e = 0; e < Math.min(4, dayExercises.length); e++) {
        await db.insert(workoutItems).values({
          cycleId: cycle.id,
          dayIndex: day,
          muscleType: muscle,
          bodyPart: day < 3 ? "Upper Body" : "Lower Body",
          exerciseName: dayExercises[e],
          sets: 3 + Math.floor(Math.random() * 2),
          reps: 8 + Math.floor(Math.random() * 5),
          weight: `${20 + Math.floor(Math.random() * 30)}kg`,
          orderIndex: e,
        });
      }
    }

    await db.insert(workoutItems).values({
      cycleId: cycle.id,
      dayIndex: 5,
      muscleType: "Rest",
      bodyPart: "Full Body",
      exerciseName: "Rest Day - Active Recovery",
      sets: 1,
      reps: 1,
      orderIndex: 0,
    });
  }

  console.log("[Demo Seed] Created workout cycles with exercises");

  for (let m = 0; m < 4; m++) {
    const member = members[m];
    for (let d = 0; d < 10; d++) {
      const date = format(subDays(new Date(), d + 1), "yyyy-MM-dd");
      const muscleIndex = d % 5;
      const muscle = muscleGroups[muscleIndex];

      try {
        const [session] = await db.insert(workoutSessions).values({
          gymId: demoGym.id,
          memberId: member.id,
          date,
          focusLabel: muscle,
          isManuallyCompleted: true,
          completedAt: new Date(),
        }).returning();

        const sessionExercises = exercises[muscle].slice(0, 3);
        for (let e = 0; e < sessionExercises.length; e++) {
          await db.insert(workoutSessionExercises).values({
            sessionId: session.id,
            exerciseName: sessionExercises[e],
            sets: 3,
            reps: 10,
            weight: `${20 + Math.floor(Math.random() * 20)}kg`,
            orderIndex: e,
          });
        }
      } catch (e) {
      }
    }
  }

  console.log("[Demo Seed] Created workout sessions and completions");

  console.log("\n========================================");
  console.log("DEMO ACCOUNTS CREATED:");
  console.log("========================================");
  console.log("Gym Code: DEMO01");
  console.log("Password for all accounts: demo123");
  console.log("");
  console.log("Owner: demoowner");
  console.log("Trainers: demotrainer1, demotrainer2");
  console.log("Members: demorahul, demopriya, demoamit, demoneha, demovikram, demoananya, demokaran, demodivya");
  console.log("========================================\n");
}
