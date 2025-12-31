import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";
import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // === AUTH ROUTES ===
  app.post("/api/auth/register-owner", async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(6),
        gymName: z.string().min(1),
      });
      const input = schema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const code = nanoid(6).toUpperCase();
      const gym = await storage.createGym({ name: input.gymName, code });

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
        role: "owner",
        gymId: gym.id
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.status(201).json({ ...user, gym });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register-join", async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(6),
        gymCode: z.string().min(1),
        role: z.enum(["trainer", "member"]),
      });
      const input = schema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const gym = await storage.getGymByCode(input.gymCode.toUpperCase());
      if (!gym) {
        return res.status(400).json({ message: "Invalid gym code" });
      }

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
        role: input.role,
        gymId: gym.id
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.status(201).json({ ...user, gym });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    res.json(user);
  });

  // === MIDDLEWARE ===
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    next();
  };

  const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || !roles.includes(req.user.role)) return res.sendStatus(403);
    next();
  };

  // === OWNER ROUTES ===
  app.get("/api/owner/members", requireRole(["owner"]), async (req, res) => {
    const members = await storage.getGymMembers(req.user!.gymId!);
    res.json(members);
  });

  app.get("/api/owner/trainers", requireRole(["owner"]), async (req, res) => {
    const trainers = await storage.getGymTrainers(req.user!.gymId!);
    res.json(trainers);
  });

  app.get("/api/owner/trainers-overview", requireRole(["owner"]), async (req, res) => {
    const trainersWithMembers = await storage.getGymTrainersWithMembers(req.user!.gymId!);
    const sanitized = trainersWithMembers.map(({ trainer, members }) => ({
      trainer: { id: trainer.id, username: trainer.username, role: trainer.role, createdAt: trainer.createdAt },
      members: members.map(m => ({ id: m.id, username: m.username, role: m.role, createdAt: m.createdAt }))
    }));
    res.json(sanitized);
  });

  app.post("/api/owner/assign-trainer", requireRole(["owner"]), async (req, res) => {
    const schema = z.object({ trainerId: z.number(), memberId: z.number() });
    const input = schema.parse(req.body);
    const assignment = await storage.assignTrainer(input.trainerId, input.memberId, req.user!.gymId!);
    res.status(201).json(assignment);
  });

  app.get("/api/owner/assignments", requireRole(["owner"]), async (req, res) => {
    const assignments = await storage.getGymAssignments(req.user!.gymId!);
    res.json(assignments);
  });

  app.get("/api/owner/qr-data", requireRole(["owner"]), async (req, res) => {
    const gym = await storage.getGym(req.user!.gymId!);
    res.json({ type: "ogym_checkin", gym_code: gym?.code });
  });

  // === ATTENDANCE ROUTES ===
  app.post("/api/attendance/checkin", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ gym_code: z.string() });
    const input = schema.parse(req.body);
    
    const gym = await storage.getGymByCode(input.gym_code.toUpperCase());
    if (!gym || gym.id !== req.user!.gymId) {
      return res.status(403).json({ message: "Invalid gym code" });
    }
    
    const today = new Date().toISOString().split("T")[0];
    const existing = await storage.getAttendanceByMemberDate(req.user!.id, today);
    
    if (existing) {
      if (existing.verifiedMethod === "workout") {
        await storage.updateAttendanceMethod(existing.id, "both");
      }
      return res.json(existing);
    }
    
    const record = await storage.markAttendance({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      date: today,
      status: "present",
      verifiedMethod: "qr",
      markedByUserId: req.user!.id
    });
    res.status(201).json(record);
  });

  app.get("/api/attendance/my", requireRole(["member"]), async (req, res) => {
    const records = await storage.getMemberAttendance(req.user!.id);
    res.json(records);
  });

  app.get("/api/attendance/gym", requireRole(["owner"]), async (req, res) => {
    const records = await storage.getAttendance(req.user!.gymId!);
    res.json(records);
  });

  // === PAYMENTS ROUTES ===
  app.get("/api/payments/my", requireRole(["member"]), async (req, res) => {
    const records = await storage.getMemberPayments(req.user!.id);
    res.json(records);
  });

  app.get("/api/payments/gym", requireRole(["owner"]), async (req, res) => {
    const records = await storage.getPayments(req.user!.gymId!);
    res.json(records);
  });

  app.post("/api/payments/mark", requireRole(["owner"]), async (req, res) => {
    const schema = z.object({
      memberId: z.number(),
      month: z.string(),
      amountDue: z.number(),
      amountPaid: z.number(),
      status: z.enum(["paid", "unpaid", "partial"]),
      note: z.string().optional()
    });
    const input = schema.parse(req.body);
    const record = await storage.markPayment({
      ...input,
      gymId: req.user!.gymId!,
      updatedByUserId: req.user!.id
    });
    res.status(201).json(record);
  });

  // === TRAINER ROUTES ===
  app.get("/api/trainer/members", requireRole(["trainer"]), async (req, res) => {
    const assignments = await storage.getTrainerMembers(req.user!.id);
    const memberIds = assignments.map(a => a.memberId);
    const allMembers = await storage.getGymMembers(req.user!.gymId!);
    const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));
    res.json(assignedMembers);
  });

  app.get("/api/trainer/cycles", requireRole(["trainer"]), async (req, res) => {
    const cycles = await storage.getTrainerCycles(req.user!.id);
    res.json(cycles);
  });

  app.post("/api/trainer/cycles", requireRole(["trainer"]), async (req, res) => {
    const schema = z.object({
      memberId: z.number(),
      name: z.string(),
      startDate: z.string(),
      endDate: z.string()
    });
    const input = schema.parse(req.body);
    
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === input.memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const cycle = await storage.createWorkoutCycle({
      ...input,
      gymId: req.user!.gymId!,
      trainerId: req.user!.id
    });
    res.status(201).json(cycle);
  });

  app.get("/api/trainer/cycles/:cycleId/items", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(404).json({ message: "Cycle not found" });
    }
    const items = await storage.getWorkoutItems(cycleId);
    res.json(items);
  });

  app.post("/api/trainer/cycles/:cycleId/items", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const muscleTypes = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Full Body"] as const;
    const bodyParts = ["Upper Body", "Lower Body", "Full Body"] as const;
    const schema = z.object({
      dayOfWeek: z.number().min(0).max(6),
      muscleType: z.enum(muscleTypes).default("Chest"),
      bodyPart: z.enum(bodyParts).default("Upper Body"),
      exerciseName: z.string(),
      sets: z.number().min(1),
      reps: z.number().min(1),
      weight: z.string().optional(),
      orderIndex: z.number().default(0)
    });
    const input = schema.parse(req.body);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const item = await storage.addWorkoutItem({ ...input, cycleId });
    res.status(201).json(item);
  });

  app.get("/api/trainer/activity", requireRole(["trainer"]), async (req, res) => {
    const assignments = await storage.getTrainerMembers(req.user!.id);
    const memberIds = assignments.map(a => a.memberId);
    const activity = await storage.getActivityFeed(req.user!.gymId!, memberIds);
    res.json(activity);
  });

  // === MEMBER WORKOUT ROUTES ===
  app.get("/api/workouts/cycles/my", requireRole(["member"]), async (req, res) => {
    const cycle = await storage.getMemberCycle(req.user!.id);
    if (!cycle) return res.json(null);
    const items = await storage.getWorkoutItems(cycle.id);
    res.json({ ...cycle, items });
  });

  app.get("/api/workouts/today", requireRole(["member"]), async (req, res) => {
    const cycle = await storage.getMemberCycle(req.user!.id);
    if (!cycle) return res.json({ items: [], message: "No active workout cycle" });
    
    const todayDow = (new Date().getDay());
    const items = await storage.getWorkoutItemsByDay(cycle.id, todayDow);
    const today = new Date().toISOString().split("T")[0];
    const completions = await storage.getCompletions(req.user!.id, today);
    const completedIds = new Set(completions.map(c => c.workoutItemId));
    
    const itemsWithStatus = items.map(i => ({
      ...i,
      completed: completedIds.has(i.id)
    }));
    
    res.json({ cycleName: cycle.name, dayOfWeek: todayDow, items: itemsWithStatus });
  });

  app.post("/api/workouts/complete", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ 
      workoutItemId: z.number(),
      actualSets: z.number().optional(),
      actualReps: z.number().optional(),
      actualWeight: z.string().optional()
    });
    const input = schema.parse(req.body);
    
    const item = await storage.getWorkoutItem(input.workoutItemId);
    if (!item) return res.status(404).json({ message: "Workout item not found" });
    
    const cycle = await storage.getCycle(item.cycleId);
    if (!cycle || cycle.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not your workout" });
    }
    
    const today = new Date().toISOString().split("T")[0];
    
    const existing = await storage.getCompletionByItemDate(input.workoutItemId, req.user!.id, today);
    if (existing) {
      return res.json({ message: "Already completed", id: existing.id });
    }
    
    const completion = await storage.completeWorkout({
      gymId: req.user!.gymId!,
      cycleId: cycle.id,
      workoutItemId: input.workoutItemId,
      memberId: req.user!.id,
      completedDate: today,
      actualSets: input.actualSets,
      actualReps: input.actualReps,
      actualWeight: input.actualWeight
    });
    
    // Auto-mark attendance
    const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
    if (!existingAttendance) {
      await storage.markAttendance({
        gymId: req.user!.gymId!,
        memberId: req.user!.id,
        date: today,
        status: "present",
        verifiedMethod: "workout",
        markedByUserId: req.user!.id
      });
    } else if (existingAttendance.verifiedMethod === "qr") {
      await storage.updateAttendanceMethod(existingAttendance.id, "both");
    }
    
    res.status(201).json(completion);
  });

  app.post("/api/workouts/complete-all", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ workoutItemIds: z.array(z.number()) });
    const input = schema.parse(req.body);
    
    const today = new Date().toISOString().split("T")[0];
    const completions = [];
    
    for (const workoutItemId of input.workoutItemIds) {
      const item = await storage.getWorkoutItem(workoutItemId);
      if (!item) continue;
      
      const cycle = await storage.getCycle(item.cycleId);
      if (!cycle || cycle.memberId !== req.user!.id) continue;
      
      const existing = await storage.getCompletionByItemDate(workoutItemId, req.user!.id, today);
      if (existing) continue;
      
      const completion = await storage.completeWorkout({
        gymId: req.user!.gymId!,
        cycleId: cycle.id,
        workoutItemId,
        memberId: req.user!.id,
        completedDate: today
      });
      completions.push(completion);
    }
    
    // Auto-mark attendance if any completed
    if (completions.length > 0) {
      const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
      if (!existingAttendance) {
        await storage.markAttendance({
          gymId: req.user!.gymId!,
          memberId: req.user!.id,
          date: today,
          status: "present",
          verifiedMethod: "workout",
          markedByUserId: req.user!.id
        });
      } else if (existingAttendance.verifiedMethod === "qr") {
        await storage.updateAttendanceMethod(existingAttendance.id, "both");
      }
    }
    
    res.status(201).json({ completed: completions.length });
  });

  app.get("/api/workouts/history/my", requireRole(["member"]), async (req, res) => {
    const history = await storage.getMemberWorkoutHistory(req.user!.id);
    res.json(history);
  });

  app.get("/api/workouts/stats/my", requireRole(["member"]), async (req, res) => {
    const stats = await storage.getMemberStats(req.user!.id);
    res.json(stats);
  });

  await seedDemoData();
  return httpServer;
}

async function seedDemoData() {
  const existingGym = await storage.getGymByCode("DEMO01");
  if (existingGym) return;

  console.log("Seeding demo data...");
  const gym = await storage.createGym({ name: "OGym Demo", code: "DEMO01" });
  const gymId = gym.id;

  const password = await hashPassword("password123");

  const owner = await storage.createUser({ username: "owner", password, role: "owner", gymId });
  const trainer = await storage.createUser({ username: "trainer", password, role: "trainer", gymId });
  const member1 = await storage.createUser({ username: "member1", password, role: "member", gymId });
  const member2 = await storage.createUser({ username: "member2", password, role: "member", gymId });

  await storage.assignTrainer(trainer.id, member1.id, gymId);
  await storage.assignTrainer(trainer.id, member2.id, gymId);

  const today = new Date();
  const startDate = today.toISOString().split("T")[0];
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const cycle = await storage.createWorkoutCycle({
    gymId,
    memberId: member1.id,
    trainerId: trainer.id,
    name: "Push-Pull-Legs Beginner",
    startDate,
    endDate
  });

  const exercises = [
    { dayOfWeek: 1, exerciseName: "Bench Press", sets: 3, reps: 10, weight: "40kg", orderIndex: 0 },
    { dayOfWeek: 1, exerciseName: "Overhead Press", sets: 3, reps: 10, weight: "20kg", orderIndex: 1 },
    { dayOfWeek: 2, exerciseName: "Deadlift", sets: 3, reps: 8, weight: "60kg", orderIndex: 0 },
    { dayOfWeek: 2, exerciseName: "Barbell Row", sets: 3, reps: 10, weight: "40kg", orderIndex: 1 },
    { dayOfWeek: 3, exerciseName: "Squats", sets: 3, reps: 10, weight: "50kg", orderIndex: 0 },
    { dayOfWeek: 3, exerciseName: "Leg Press", sets: 3, reps: 12, weight: "80kg", orderIndex: 1 },
  ];

  for (const ex of exercises) {
    await storage.addWorkoutItem({ ...ex, cycleId: cycle.id });
  }

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  await storage.markAttendance({
    gymId,
    memberId: member1.id,
    date: yesterday,
    status: "present",
    verifiedMethod: "qr",
    markedByUserId: owner.id
  });

  const thisMonth = today.toISOString().slice(0, 7);
  await storage.markPayment({
    gymId,
    memberId: member1.id,
    month: thisMonth,
    amountDue: 5000,
    amountPaid: 5000,
    status: "paid",
    note: "Monthly membership"
  });

  console.log("Seed complete! Gym Code: DEMO01");
  console.log("Users: owner/password123, trainer/password123, member1/password123, member2/password123");
}
