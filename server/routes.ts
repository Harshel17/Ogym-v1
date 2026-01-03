import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";
import passport from "passport";
import jwt from "jsonwebtoken";

const ADMIN_JWT_SECRET = process.env.SESSION_SECRET || "admin-jwt-fallback-secret";

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
      });
      const input = schema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
        role: "owner",
        gymId: null
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.status(201).json({ ...user, gym: null });
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
        gymId: null
      });

      await storage.createJoinRequest({
        userId: user.id,
        gymId: gym.id,
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.status(201).json({ ...user, gym: null, pendingJoinRequest: true, requestedGymName: gym.name });
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

  // === UTILITY ROUTES ===
  // Server date endpoint to get server's current date (avoids timezone mismatch with client)
  app.get("/api/server-date", (req, res) => {
    const now = new Date();
    const serverDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    res.json({ serverDate });
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

  app.get("/api/owner/members-details", requireRole(["owner"]), async (req, res) => {
    const members = await storage.getMembersWithDetails(req.user!.gymId!);
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

  app.get("/api/owner/members/:memberId/overview", requireRole(["owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }
    const overview = await storage.getMemberOverview(req.user!.gymId!, memberId);
    if (!overview.member) {
      return res.status(404).json({ message: "Member not found" });
    }
    res.json(overview);
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

  // === MEMBERSHIP PLANS & SUBSCRIPTIONS (INR-based tracking) ===
  
  // Plans CRUD
  app.get("/api/owner/membership-plans", requireRole(["owner"]), async (req, res) => {
    const plans = await storage.getMembershipPlans(req.user!.gymId!);
    res.json(plans);
  });

  app.post("/api/owner/membership-plans", requireRole(["owner"]), async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      durationMonths: z.number().min(1),
      priceAmount: z.number().min(0), // in paise
      isActive: z.boolean().optional().default(true)
    });
    const input = schema.parse(req.body);
    const plan = await storage.createMembershipPlan({
      ...input,
      gymId: req.user!.gymId!
    });
    res.status(201).json(plan);
  });

  app.patch("/api/owner/membership-plans/:planId", requireRole(["owner"]), async (req, res) => {
    const planId = parseInt(req.params.planId);
    const schema = z.object({
      name: z.string().min(1).optional(),
      durationMonths: z.number().min(1).optional(),
      priceAmount: z.number().min(0).optional(),
      isActive: z.boolean().optional()
    });
    const input = schema.parse(req.body);
    const plan = await storage.updateMembershipPlan(planId, input);
    res.json(plan);
  });

  app.delete("/api/owner/membership-plans/:planId", requireRole(["owner"]), async (req, res) => {
    const planId = parseInt(req.params.planId);
    await storage.deactivateMembershipPlan(planId);
    res.sendStatus(204);
  });

  // Subscriptions
  app.get("/api/owner/subscriptions", requireRole(["owner"]), async (req, res) => {
    // Update expired subscriptions first
    await storage.updateExpiredSubscriptions(req.user!.gymId!);
    const subs = await storage.getMemberSubscriptions(req.user!.gymId!);
    res.json(subs);
  });

  app.post("/api/owner/subscriptions", requireRole(["owner"]), async (req, res) => {
    const schema = z.object({
      memberId: z.number(),
      planId: z.number().optional(),
      startDate: z.string(),
      durationMonths: z.number().min(1),
      totalAmount: z.number().min(0), // in paise
      paymentMode: z.enum(["full", "partial", "emi"]).default("full"),
      notes: z.string().optional()
    });
    const input = schema.parse(req.body);
    
    // Calculate end date
    const startDate = new Date(input.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + input.durationMonths);
    
    const sub = await storage.createMemberSubscription({
      gymId: req.user!.gymId!,
      memberId: input.memberId,
      planId: input.planId || null,
      startDate: input.startDate,
      endDate: endDate.toISOString().split('T')[0],
      totalAmount: input.totalAmount,
      paymentMode: input.paymentMode,
      notes: input.notes,
      status: "active"
    });
    res.status(201).json(sub);
  });

  // Payment Transactions
  app.get("/api/owner/subscriptions/:subscriptionId/transactions", requireRole(["owner"]), async (req, res) => {
    const subscriptionId = parseInt(req.params.subscriptionId);
    const transactions = await storage.getSubscriptionTransactions(subscriptionId);
    res.json(transactions);
  });

  app.post("/api/owner/subscriptions/:subscriptionId/payments", requireRole(["owner"]), async (req, res) => {
    const subscriptionId = parseInt(req.params.subscriptionId);
    
    // Verify subscription belongs to this gym
    const subscription = await storage.getSubscriptionById(subscriptionId, req.user!.gymId!);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }
    
    const schema = z.object({
      paidOn: z.string(),
      amountPaid: z.number().min(1), // in paise
      method: z.enum(["cash", "upi", "card", "bank", "other"]),
      referenceNote: z.string().optional()
    });
    const input = schema.parse(req.body);
    
    // Derive memberId from the verified subscription
    const txn = await storage.addPaymentTransaction({
      gymId: req.user!.gymId!,
      memberId: subscription.memberId,
      subscriptionId,
      paidOn: input.paidOn,
      amountPaid: input.amountPaid,
      method: input.method,
      referenceNote: input.referenceNote
    });
    res.status(201).json(txn);
  });

  // Subscription Alerts
  app.get("/api/owner/subscription-alerts", requireRole(["owner"]), async (req, res) => {
    await storage.updateExpiredSubscriptions(req.user!.gymId!);
    const alerts = await storage.getSubscriptionAlerts(req.user!.gymId!);
    res.json(alerts);
  });

  // Member subscription view (read-only for members)
  app.get("/api/member/subscription", requireRole(["member"]), async (req, res) => {
    const sub = await storage.getMemberSubscription(req.user!.id);
    res.json(sub);
  });

  // === TRAINER ROUTES ===
  app.get("/api/trainer/dashboard", requireRole(["trainer"]), async (req, res) => {
    try {
      const assignments = await storage.getTrainerMembers(req.user!.id);
      const totalMembers = assignments.length;
      
      const cycles = await storage.getTrainerCycles(req.user!.id);
      const activeWorkouts = cycles.filter((c: any) => c.isActive).length;
      
      const starMembers = await storage.getStarMembers(req.user!.id);
      
      res.json({
        totalMembers,
        activeWorkouts,
        starMembers: starMembers.length,
        recentActivity: [],
        memberProgress: []
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

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
      cycleLength: z.number().min(1).max(7),
      dayLabels: z.array(z.string()).optional(),
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

  app.patch("/api/trainer/cycles/:cycleId/labels", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const schema = z.object({
      dayLabels: z.array(z.string())
    });
    const input = schema.parse(req.body);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    if (cycle.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized for this gym" });
    }
    
    let normalizedLabels = input.dayLabels.slice(0, cycle.cycleLength);
    while (normalizedLabels.length < cycle.cycleLength) {
      normalizedLabels.push("");
    }
    
    const updated = await storage.updateCycleDayLabels(cycleId, normalizedLabels);
    res.json(updated);
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
      dayIndex: z.number().min(0),
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
    
    if (input.dayIndex >= cycle.cycleLength) {
      return res.status(400).json({ message: "Day index exceeds cycle length" });
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
    
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const startDate = new Date(cycle.startDate);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    
    const items = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
    const completions = await storage.getCompletions(req.user!.id, todayStr);
    const completedIds = new Set(completions.map(c => c.workoutItemId));
    
    const itemsWithStatus = items.map(i => ({
      ...i,
      completed: completedIds.has(i.id)
    }));
    
    const dayLabel = cycle.dayLabels?.[currentDayIndex] || null;
    res.json({ 
      cycleName: cycle.name, 
      dayIndex: currentDayIndex, 
      cycleLength: cycle.cycleLength,
      dayLabel,
      items: itemsWithStatus 
    });
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
    
    // Calculate current day index for session creation
    // This determines which day of the cycle we're on based on cycle start date
    const startDate = new Date(cycle.startDate);
    const todayDate = new Date(today);
    const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    
    // Create/update workout session for proper session-based stats
    const todayItems = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
    const muscleTypes = [...new Set(todayItems.map(i => i.muscleType).filter(Boolean))];
    const focusLabel = muscleTypes.join(" + ") || cycle.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
    
    const session = await storage.getOrCreateWorkoutSession({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      date: today,
      cycleId: cycle.id,
      cycleDayIndex: currentDayIndex,
      focusLabel
    });
    
    // Add exercise to session
    await storage.addWorkoutSessionExercise({
      sessionId: session.id,
      exerciseName: item.exerciseName,
      sets: input.actualSets || item.sets,
      reps: input.actualReps || item.reps,
      weight: input.actualWeight || item.weight || null
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
    let session: any = null;
    
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
      
      // Create workout session on first completion
      if (!session) {
        const startDate = new Date(cycle.startDate);
        const todayDate = new Date(today);
        const daysDiff = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentDayIndex = daysDiff % cycle.cycleLength;
        
        const todayItems = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
        const muscleTypes = [...new Set(todayItems.map(i => i.muscleType).filter(Boolean))];
        const focusLabel = muscleTypes.join(" + ") || cycle.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
        
        session = await storage.getOrCreateWorkoutSession({
          gymId: req.user!.gymId!,
          memberId: req.user!.id,
          date: today,
          cycleId: cycle.id,
          cycleDayIndex: currentDayIndex,
          focusLabel
        });
      }
      
      // Add exercise to session
      if (session) {
        await storage.addWorkoutSessionExercise({
          sessionId: session.id,
          exerciseName: item.exerciseName,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight || null
        });
      }
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

  // === MEMBER PROGRESS - GROUPED SESSIONS ===
  app.get("/api/me/workouts", requireRole(["member"]), async (req, res) => {
    const sessions = await storage.getMemberWorkoutSessions(req.user!.id);
    res.json(sessions);
  });

  app.put("/api/me/workouts/exercise/:completionId", requireRole(["member"]), async (req, res) => {
    const completionId = parseInt(req.params.completionId);
    const schema = z.object({
      actualSets: z.number().optional(),
      actualReps: z.number().optional(),
      actualWeight: z.string().optional(),
      notes: z.string().optional()
    });
    const input = schema.parse(req.body);
    
    const updated = await storage.updateWorkoutCompletion(completionId, req.user!.id, input);
    if (!updated) {
      return res.status(404).json({ message: "Completion not found" });
    }
    res.json(updated);
  });

  app.get("/api/me/stats", requireRole(["member"]), async (req, res) => {
    const stats = await storage.getEnhancedMemberStats(req.user!.id);
    res.json(stats);
  });

  app.get("/api/me/calendar", requireRole(["member"]), async (req, res) => {
    const month = req.query.month as string || new Date().toISOString().slice(0, 7);
    const calendar = await storage.getMemberCalendar(req.user!.id, month);
    res.json(calendar);
  });

  app.get("/api/me/calendar/enhanced", requireRole(["member"]), async (req, res) => {
    const month = req.query.month as string || new Date().toISOString().slice(0, 7);
    const calendar = await storage.getMemberCalendarEnhanced(req.user!.gymId!, req.user!.id, month);
    res.json(calendar);
  });

  app.get("/api/me/workout/daily/:date", requireRole(["member"]), async (req, res) => {
    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
    const result = dateSchema.safeParse(req.params.date);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }
    const analytics = await storage.getMemberDailyAnalytics(req.user!.gymId!, req.user!.id, result.data);
    res.json(analytics);
  });

  // Daily workout summary with date filtering
  app.get("/api/me/workouts/daily", requireRole(["member"]), async (req, res) => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const workouts = await storage.getMemberDailyWorkouts(req.user!.id, startDate, endDate);
    res.json(workouts);
  });

  // === MEMBER WORKOUT SESSION ROUTES ===
  
  // Get workout summary (streak, total, last 7 days, this month, calendar days)
  app.get("/api/member/workout/summary", requireRole(["member"]), async (req, res) => {
    const summary = await storage.getMemberWorkoutSummary(req.user!.gymId!, req.user!.id);
    res.json(summary);
  });

  // Get workout history with optional date filtering
  app.get("/api/member/workout/history", requireRole(["member"]), async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const history = await storage.getMemberWorkoutHistory(req.user!.gymId!, req.user!.id, from, to);
    res.json(history);
  });

  // Get single session with exercises
  app.get("/api/member/workout/session/:sessionId", requireRole(["member"]), async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    // Fetch session with gym scoping for multi-tenant security
    const session = await storage.getWorkoutSession(req.user!.gymId!, sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    // Verify member owns this session
    if (session.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(session);
  });

  // Create or update workout session with exercises
  app.post("/api/member/workout/session", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      date: z.string(),
      focusLabel: z.string(),
      cycleId: z.number().nullable().optional(),
      cycleDayIndex: z.number().nullable().optional(),
      exercises: z.array(z.object({
        exerciseName: z.string(),
        sets: z.number().nullable().optional(),
        reps: z.number().nullable().optional(),
        weight: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      })).optional()
    });
    
    const input = schema.parse(req.body);
    
    // Get or create session
    const session = await storage.getOrCreateWorkoutSession({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      date: input.date,
      focusLabel: input.focusLabel,
      cycleId: input.cycleId || null,
      cycleDayIndex: input.cycleDayIndex || null
    });
    
    // Add exercises if provided
    if (input.exercises && input.exercises.length > 0) {
      for (let i = 0; i < input.exercises.length; i++) {
        const ex = input.exercises[i];
        await storage.addWorkoutSessionExercise({
          sessionId: session.id,
          exerciseName: ex.exerciseName,
          sets: ex.sets || null,
          reps: ex.reps || null,
          weight: ex.weight || null,
          notes: ex.notes || null,
          orderIndex: i
        });
      }
    }
    
    // Return full session with exercises
    const fullSession = await storage.getWorkoutSession(req.user!.gymId!, session.id);
    res.status(201).json(fullSession);
  });

  // Update a workout session exercise (for editing past workouts)
  app.put("/api/member/workout/session/exercise/:exerciseId", requireRole(["member"]), async (req, res) => {
    const exerciseId = parseInt(req.params.exerciseId);
    if (isNaN(exerciseId)) {
      return res.status(400).json({ message: "Invalid exercise ID" });
    }
    
    const schema = z.object({
      sets: z.number().nullable().optional(),
      reps: z.number().nullable().optional(),
      weight: z.string().nullable().optional(),
      notes: z.string().nullable().optional()
    });
    const input = schema.parse(req.body);
    
    const updated = await storage.updateWorkoutSessionExercise(
      exerciseId, 
      req.user!.gymId!, 
      req.user!.id, 
      {
        sets: input.sets ?? undefined,
        reps: input.reps ?? undefined,
        weight: input.weight ?? undefined,
        notes: input.notes ?? undefined
      }
    );
    
    if (!updated) {
      return res.status(404).json({ message: "Exercise not found or access denied" });
    }
    
    res.json(updated);
  });

  // Get full cycle schedule with planned + completed merged
  app.get("/api/member/workout/schedule", requireRole(["member"]), async (req, res) => {
    const schedule = await storage.getCycleSchedule(req.user!.gymId!, req.user!.id);
    res.json(schedule);
  });

  // Mark a workout day as done (even with partial completion)
  app.post("/api/member/workout/day/:date/mark-done", requireRole(["member"]), async (req, res) => {
    const date = req.params.date;
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }
    
    try {
      const result = await storage.markDayDone(req.user!.gymId!, req.user!.id, date);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get missed workouts
  app.get("/api/member/workout/missed", requireRole(["member"]), async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const missed = await storage.getMissedWorkouts(req.user!.gymId!, req.user!.id, from, to);
    res.json(missed);
  });

  // === MEMBER PROFILE & PROGRESS ROUTES ===
  app.get("/api/member/profile", requireRole(["member"]), async (req, res) => {
    const profile = await storage.getMemberProfile(req.user!.id);
    res.json(profile);
  });

  app.get("/api/member/progress", requireRole(["member"]), async (req, res) => {
    const progress = await storage.getMemberProgress(req.user!.id);
    res.json(progress);
  });

  // === MEMBER REQUESTS ROUTES ===
  app.post("/api/member/requests", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      type: z.enum(["feedback", "change_request", "question"]),
      message: z.string().min(1)
    });
    const input = schema.parse(req.body);
    
    // Find member's trainer
    const assignments = await storage.getGymAssignments(req.user!.gymId!);
    const assignment = assignments.find(a => a.memberId === req.user!.id);
    
    const request = await storage.createMemberRequest({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      trainerId: assignment?.trainerId || null,
      type: input.type,
      message: input.message
    });
    res.status(201).json(request);
  });

  app.get("/api/member/requests", requireRole(["member"]), async (req, res) => {
    const requests = await storage.getMemberRequests(req.user!.id);
    res.json(requests);
  });

  app.get("/api/trainer/requests", requireRole(["trainer"]), async (req, res) => {
    const requests = await storage.getTrainerRequests(req.user!.id);
    res.json(requests);
  });

  app.patch("/api/trainer/requests/:requestId/respond", requireRole(["trainer"]), async (req, res) => {
    const requestId = parseInt(req.params.requestId);
    const schema = z.object({ response: z.string().min(1) });
    const input = schema.parse(req.body);
    
    const updated = await storage.respondToRequest(requestId, input.response);
    res.json(updated);
  });

  // === PROFILE ROUTES ===
  app.get("/api/profile/my", requireAuth, async (req, res) => {
    if (req.user!.role === "member") {
      const profile = await storage.getFullMemberProfile(req.user!.id);
      res.json(profile);
    } else if (req.user!.role === "trainer") {
      const profile = await storage.getTrainerProfile(req.user!.id);
      res.json(profile);
    } else {
      const user = await storage.getUser(req.user!.id);
      res.json(user);
    }
  });

  app.patch("/api/profile/my", requireAuth, async (req, res) => {
    const schema = z.object({
      email: z.string().email().optional(),
      phone: z.string().optional()
    });
    const input = schema.parse(req.body);
    const updated = await storage.updateUserProfile(req.user!.id, input);
    res.json(updated);
  });

  // === STAR MEMBERS ROUTES ===
  app.get("/api/trainer/star-members", requireRole(["trainer"]), async (req, res) => {
    const stars = await storage.getStarMembers(req.user!.id);
    res.json(stars);
  });

  app.post("/api/trainer/star-members", requireRole(["trainer"]), async (req, res) => {
    const schema = z.object({ memberId: z.number() });
    const input = schema.parse(req.body);
    
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === input.memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const star = await storage.addStarMember({
      gymId: req.user!.gymId!,
      trainerId: req.user!.id,
      memberId: input.memberId
    });
    res.status(201).json(star);
  });

  app.delete("/api/trainer/star-members/:memberId", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    await storage.removeStarMember(req.user!.id, memberId);
    res.sendStatus(204);
  });

  // Star member detail - get member info
  app.get("/api/trainer/star-members/:memberId", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    
    // Access control: must be assigned, starred, and same gym
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const isStar = await storage.isStarMember(req.user!.id, memberId);
    if (!isStar) {
      return res.status(403).json({ message: "Member is not a star member" });
    }
    
    const member = await storage.getUser(memberId);
    if (!member || member.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Member not in your gym" });
    }
    
    const gym = await storage.getGym(req.user!.gymId!);
    
    res.json({
      id: member.id,
      username: member.username,
      publicId: member.publicId,
      gymName: gym?.name || null,
      gymCode: gym?.code || null
    });
  });

  // Star member detail - get workout sessions
  app.get("/api/trainer/star-members/:memberId/workouts", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    
    // Access control
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const isStar = await storage.isStarMember(req.user!.id, memberId);
    if (!isStar) {
      return res.status(403).json({ message: "Member is not a star member" });
    }
    
    const member = await storage.getUser(memberId);
    if (!member || member.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Member not in your gym" });
    }
    
    const sessions = await storage.getMemberWorkoutSessions(memberId);
    res.json(sessions);
  });

  // Star member detail - get specific workout session
  app.get("/api/trainer/star-members/:memberId/workouts/:date", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const { date } = req.params;
    
    // Access control
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const isStar = await storage.isStarMember(req.user!.id, memberId);
    if (!isStar) {
      return res.status(403).json({ message: "Member is not a star member" });
    }
    
    const member = await storage.getUser(memberId);
    if (!member || member.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Member not in your gym" });
    }
    
    const sessions = await storage.getMemberWorkoutSessions(memberId);
    const session = sessions.find(s => s.date === date);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    res.json(session);
  });

  // Star member detail - get stats
  app.get("/api/trainer/star-members/:memberId/stats", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    
    // Access control
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const isStar = await storage.isStarMember(req.user!.id, memberId);
    if (!isStar) {
      return res.status(403).json({ message: "Member is not a star member" });
    }
    
    const member = await storage.getUser(memberId);
    if (!member || member.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Member not in your gym" });
    }
    
    const stats = await storage.getEnhancedMemberStats(memberId);
    const progress = await storage.getMemberProgress(memberId);
    
    res.json({ stats, progress });
  });

  // Star member detail - get missed workouts
  app.get("/api/trainer/star-members/:memberId/missed", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    
    // Access control
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const isStar = await storage.isStarMember(req.user!.id, memberId);
    if (!isStar) {
      return res.status(403).json({ message: "Member is not a star member" });
    }
    
    const member = await storage.getUser(memberId);
    if (!member || member.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Member not in your gym" });
    }
    
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const missed = await storage.getMissedWorkouts(req.user!.gymId!, memberId, from, to);
    res.json(missed);
  });

  app.get("/api/trainer/members/:memberId/stats", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const isStar = await storage.isStarMember(req.user!.id, memberId);
    
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    if (isStar) {
      const stats = await storage.getMemberStats(memberId);
      const progress = await storage.getMemberProgress(memberId);
      res.json({ full: true, stats, progress });
    } else {
      const stats = await storage.getMemberStats(memberId);
      res.json({ full: false, stats: { totalWorkouts: stats.totalWorkouts, streak: stats.streak } });
    }
  });

  // === DIET PLANS ROUTES ===
  app.get("/api/trainer/diet-plans", requireRole(["trainer"]), async (req, res) => {
    const plans = await storage.getDietPlans(req.user!.id);
    res.json(plans);
  });

  app.post("/api/trainer/diet-plans", requireRole(["trainer"]), async (req, res) => {
    const schema = z.object({
      memberId: z.number(),
      title: z.string().min(1),
      durationWeeks: z.number().min(1).default(4),
      notes: z.string().optional()
    });
    const input = schema.parse(req.body);
    
    const isStar = await storage.isStarMember(req.user!.id, input.memberId);
    if (!isStar) {
      return res.status(403).json({ message: "Diet plans can only be created for star members" });
    }
    
    const plan = await storage.createDietPlan({
      gymId: req.user!.gymId!,
      trainerId: req.user!.id,
      memberId: input.memberId,
      title: input.title,
      durationWeeks: input.durationWeeks,
      notes: input.notes
    });
    res.status(201).json(plan);
  });

  app.post("/api/trainer/diet-plans/:planId/meals", requireRole(["trainer"]), async (req, res) => {
    const planId = parseInt(req.params.planId);
    const schema = z.object({
      dayIndex: z.number().min(0),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      description: z.string().min(1),
      calories: z.number().optional(),
      protein: z.number().optional(),
      orderIndex: z.number().default(0)
    });
    const input = schema.parse(req.body);
    
    const meal = await storage.addDietPlanMeal({ ...input, planId });
    res.status(201).json(meal);
  });

  app.get("/api/member/diet-plans", requireRole(["member"]), async (req, res) => {
    const plans = await storage.getMemberDietPlans(req.user!.id);
    res.json(plans);
  });

  // === TRANSFER REQUESTS ROUTES ===
  app.post("/api/member/transfer-request", requireRole(["member", "trainer"]), async (req, res) => {
    const schema = z.object({ gymCode: z.string().min(1) });
    const input = schema.parse(req.body);
    
    const existingRequest = await storage.getMemberTransferRequest(req.user!.id);
    if (existingRequest) {
      return res.status(400).json({ message: "You already have a pending transfer request" });
    }
    
    const toGym = await storage.getGymByCode(input.gymCode.toUpperCase());
    if (!toGym) {
      return res.status(400).json({ message: "Invalid gym code" });
    }
    
    if (toGym.id === req.user!.gymId) {
      return res.status(400).json({ message: "You are already in this gym" });
    }
    
    const request = await storage.createTransferRequest({
      memberId: req.user!.id,
      fromGymId: req.user!.gymId!,
      toGymId: toGym.id
    });
    res.status(201).json(request);
  });

  app.get("/api/member/transfer-request", requireRole(["member", "trainer"]), async (req, res) => {
    const request = await storage.getMemberTransferRequest(req.user!.id);
    res.json(request || null);
  });

  app.get("/api/owner/transfer-requests", requireRole(["owner"]), async (req, res) => {
    const requests = await storage.getTransferRequestsForOwner(req.user!.gymId!);
    res.json(requests);
  });

  app.post("/api/owner/transfer-requests/:requestId/approve", requireRole(["owner"]), async (req, res) => {
    const requestId = parseInt(req.params.requestId);
    const updated = await storage.approveTransferByOwner(requestId, req.user!.gymId!);
    res.json(updated);
  });

  app.post("/api/owner/transfer-requests/:requestId/reject", requireRole(["owner"]), async (req, res) => {
    const requestId = parseInt(req.params.requestId);
    const updated = await storage.rejectTransferRequest(requestId);
    res.json(updated);
  });

  app.get("/api/owner/gym-history", requireRole(["owner"]), async (req, res) => {
    const history = await storage.getGymHistoryForGym(req.user!.gymId!);
    res.json(history);
  });

  // === CYCLE DELETION ===
  app.delete("/api/trainer/cycles/:cycleId", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const cycle = await storage.getCycle(cycleId);
    
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    await storage.deleteCycle(cycleId);
    res.sendStatus(204);
  });

  // === WORKOUT TEMPLATES ===
  app.get("/api/trainer/templates", requireRole(["trainer"]), async (req, res) => {
    try {
      const templates = await storage.getWorkoutTemplates(req.user!.gymId!, req.user!.id);
      res.json(templates);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/trainer/templates/:id", requireRole(["trainer"]), async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }
      
      const template = await storage.getWorkoutTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.trainerId !== req.user!.id || template.gymId !== req.user!.gymId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      res.json(template);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/trainer/templates", requireRole(["trainer"]), async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        daysPerCycle: z.number().min(1).max(14),
        dayLabels: z.array(z.string()).optional(),
        items: z.array(z.object({
          dayIndex: z.number().min(0),
          muscleType: z.string(),
          bodyPart: z.string(),
          exerciseName: z.string().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          weight: z.string().optional().nullable(),
          orderIndex: z.number().optional().default(0)
        })).optional().default([])
      });
      
      const input = schema.parse(req.body);
      
      const template = await storage.createWorkoutTemplate({
        gymId: req.user!.gymId!,
        trainerId: req.user!.id,
        name: input.name,
        description: input.description || null,
        daysPerCycle: input.daysPerCycle,
        dayLabels: input.dayLabels || null,
        isActive: true
      });
      
      let items: any[] = [];
      if (input.items.length > 0) {
        const itemsToInsert = input.items.map(item => ({
          templateId: template.id,
          dayIndex: item.dayIndex,
          muscleType: item.muscleType,
          bodyPart: item.bodyPart,
          exerciseName: item.exerciseName,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight || null,
          orderIndex: item.orderIndex
        }));
        items = await storage.createWorkoutTemplateItems(itemsToInsert);
      }
      
      res.status(201).json({ ...template, items });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.delete("/api/trainer/templates/:id", requireRole(["trainer"]), async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }
      
      const template = await storage.getWorkoutTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.trainerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      await storage.deleteWorkoutTemplate(templateId, req.user!.id);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  app.post("/api/trainer/templates/:id/assign", requireRole(["trainer"]), async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }
      
      const schema = z.object({
        memberId: z.number(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      });
      
      const input = schema.parse(req.body);
      
      const template = await storage.getWorkoutTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.trainerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const cycle = await storage.assignTemplateToMember(
        templateId,
        input.memberId,
        input.startDate,
        input.endDate,
        req.user!.gymId!,
        req.user!.id
      );
      
      res.status(201).json(cycle);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "Template not found") {
        return res.status(404).json({ message: "Template not found" });
      }
      res.status(500).json({ message: "Failed to assign template" });
    }
  });

  // === BODY MEASUREMENTS ===
  app.get("/api/me/body", requireRole(["member"]), async (req, res) => {
    const measurements = await storage.getBodyMeasurements(req.user!.gymId!, req.user!.id);
    res.json(measurements);
  });

  app.get("/api/me/body/latest", requireRole(["member"]), async (req, res) => {
    const measurement = await storage.getLatestBodyMeasurement(req.user!.gymId!, req.user!.id);
    res.json(measurement);
  });

  app.post("/api/me/body", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      recordedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weight: z.number().optional(),
      height: z.number().optional(),
      bodyFat: z.number().optional(),
      chest: z.number().optional(),
      waist: z.number().optional(),
      hips: z.number().optional(),
      biceps: z.number().optional(),
      thighs: z.number().optional(),
      notes: z.string().optional()
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.errors[0].message });
    }
    const measurement = await storage.createBodyMeasurement({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      ...result.data
    });
    res.status(201).json(measurement);
  });

  // === MEMBER NOTES (Trainer writes notes about members) ===
  app.get("/api/trainer/members/:memberId/notes", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }
    const notes = await storage.getMemberNotes(req.user!.gymId!, req.user!.id, memberId);
    res.json(notes);
  });

  app.post("/api/trainer/members/:memberId/notes", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }
    const schema = z.object({
      content: z.string().min(1, "Note content is required")
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.errors[0].message });
    }
    const note = await storage.createMemberNote({
      gymId: req.user!.gymId!,
      trainerId: req.user!.id,
      memberId,
      content: result.data.content
    });
    res.status(201).json(note);
  });

  app.delete("/api/trainer/members/:memberId/notes/:noteId", requireRole(["trainer"]), async (req, res) => {
    const noteId = parseInt(req.params.noteId);
    if (isNaN(noteId)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }
    await storage.deleteMemberNote(noteId, req.user!.id);
    res.status(204).end();
  });

  // === GYM HISTORY ===
  app.get("/api/member/gym-history", requireRole(["member"]), async (req, res) => {
    const history = await storage.getGymHistory(req.user!.id);
    res.json(history);
  });

  // === OWNER GYM SUBSCRIPTION STATUS (OGym Platform Subscription) ===
  app.get("/api/owner/gym-subscription", requireRole(["owner"]), async (req, res) => {
    const subscription = await storage.getGymSubscription(req.user!.gymId!);
    res.json(subscription);
  });

  // === OWNER DASHBOARD & ATTENDANCE ANALYTICS ===
  app.get("/api/owner/dashboard-metrics", requireRole(["owner"]), async (req, res) => {
    const metrics = await storage.getOwnerDashboardMetrics(req.user!.gymId!);
    res.json(metrics);
  });

  app.get("/api/owner/attendance/summary", requireRole(["owner"]), async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const summary = await storage.getOwnerAttendanceSummary(req.user!.gymId!, date);
    res.json(summary);
  });

  app.get("/api/owner/attendance/day", requireRole(["owner"]), async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const data = await storage.getOwnerAttendanceDay(req.user!.gymId!, date);
    res.json(data);
  });

  app.get("/api/owner/attendance/trend", requireRole(["owner"]), async (req, res) => {
    const days = parseInt(req.query.days as string) || 14;
    const trend = await storage.getOwnerAttendanceTrend(req.user!.gymId!, days);
    res.json({ days, trend });
  });

  // === OWNER MEMBER STATS (reuse trainer star member logic) ===
  app.get("/api/owner/members/:memberId/profile", requireRole(["owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const members = await storage.getGymMembers(req.user!.gymId!);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const profile = await storage.getFullMemberProfile(memberId);
    res.json(profile);
  });

  app.get("/api/owner/members/:memberId/workouts", requireRole(["owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const members = await storage.getGymMembers(req.user!.gymId!);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const sessions = await storage.getMemberWorkoutSessions(memberId);
    res.json(sessions);
  });

  app.get("/api/owner/members/:memberId/workouts/:date", requireRole(["owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const date = req.params.date;
    const members = await storage.getGymMembers(req.user!.gymId!);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const sessions = await storage.getMemberWorkoutSessions(memberId);
    const session = sessions.find(s => s.date === date);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(session);
  });

  app.get("/api/owner/members/:memberId/stats", requireRole(["owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const members = await storage.getGymMembers(req.user!.gymId!);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const stats = await storage.getEnhancedMemberStats(memberId);
    const progress = await storage.getMemberProgress(memberId);
    res.json({ ...stats, progress });
  });

  // === ANNOUNCEMENTS ===
  app.post("/api/owner/announcements", requireRole(["owner"]), async (req, res) => {
    const { title, body, audience } = req.body;
    if (!title || !body || !audience) {
      return res.status(400).json({ message: "Title, body, and audience are required" });
    }
    const announcement = await storage.createAnnouncement({
      gymId: req.user!.gymId!,
      title,
      body,
      audience,
      createdByOwnerId: req.user!.id
    });
    res.status(201).json(announcement);
  });

  app.get("/api/owner/announcements", requireRole(["owner"]), async (req, res) => {
    const announcements = await storage.getOwnerAnnouncements(req.user!.gymId!);
    res.json(announcements);
  });

  app.delete("/api/owner/announcements/:id", requireRole(["owner"]), async (req, res) => {
    const announcementId = parseInt(req.params.id);
    await storage.deleteAnnouncement(announcementId);
    res.sendStatus(204);
  });

  // === EXPORT ROUTES ===
  app.get("/api/owner/export/payments", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const subscriptions = await storage.getSubscriptionsWithPayments(gymId);
      
      let csv = "Member,Plan,Start Date,End Date,Total Amount (INR),Status,Payment Mode,Paid Amount (INR),Last Payment Date,Method\n";
      
      for (const sub of subscriptions) {
        const member = await storage.getUser(sub.memberId);
        const memberName = member?.username || "Unknown";
        const totalAmountInr = (sub.totalAmount / 100).toFixed(2);
        const paidAmount = sub.transactions?.reduce((sum: number, t: any) => sum + t.amountPaid, 0) || 0;
        const paidAmountInr = (paidAmount / 100).toFixed(2);
        const lastPayment = sub.transactions?.[0];
        const lastPaymentDate = lastPayment?.paidOn || "-";
        const method = lastPayment?.method || "-";
        
        csv += `"${memberName}","${sub.plan?.name || 'Custom'}","${sub.startDate}","${sub.endDate}","${totalAmountInr}","${sub.status}","${sub.paymentMode}","${paidAmountInr}","${lastPaymentDate}","${method}"\n`;
      }
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=payments_export_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Failed to export payments" });
    }
  });

  app.get("/api/owner/export/attendance", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const { startDate, endDate } = req.query;
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate as string || new Date().toISOString().split('T')[0];
      
      const attendanceRecords = await storage.getAttendance(gymId);
      const filteredRecords = attendanceRecords.filter(a => a.date >= start && a.date <= end);
      
      let csv = "Date,Member,Status,Method\n";
      
      for (const record of filteredRecords) {
        const memberName = (record as any).member?.username || "Unknown";
        csv += `"${record.date}","${memberName}","${record.status}","${record.verifiedMethod || 'manual'}"\n`;
      }
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=attendance_export_${start}_to_${end}.csv`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Failed to export attendance" });
    }
  });

  app.get("/api/owner/export/members", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const members = await storage.getMembersWithDetails(gymId);
      
      let csv = "ID,Username,Email,Phone,Trainer,Subscription Status,Join Date\n";
      
      for (const member of members) {
        csv += `"${member.publicId || member.id}","${member.username}","${member.email || '-'}","${member.phone || '-'}","${member.trainerUsername || '-'}","${member.subscriptionStatus || 'None'}","${member.createdAt ? new Date(member.createdAt).toISOString().split('T')[0] : '-'}"\n`;
      }
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=members_export_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Failed to export members" });
    }
  });

  app.get("/api/announcements", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "No gym associated" });
    }
    const announcements = await storage.getUserAnnouncements(req.user!.gymId, req.user!.role, req.user!.id);
    res.json(announcements);
  });

  app.post("/api/announcements/:id/read", requireAuth, async (req, res) => {
    const announcementId = parseInt(req.params.id);
    const read = await storage.markAnnouncementRead(announcementId, req.user!.id);
    res.json(read);
  });

  app.get("/api/announcements/unread-count", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.json({ count: 0 });
    }
    const count = await storage.getUnreadAnnouncementCount(req.user!.gymId, req.user!.id, req.user!.role);
    res.json({ count });
  });

  // === NOTIFICATION PREFERENCES ===
  app.get("/api/me/notification-preferences", requireAuth, async (req, res) => {
    const prefs = await storage.getNotificationPreferences(req.user!.id);
    res.json(prefs || { emailEnabled: false, smsEnabled: false });
  });

  app.put("/api/me/notification-preferences", requireAuth, async (req, res) => {
    const { emailEnabled, smsEnabled } = req.body;
    const prefs = await storage.upsertNotificationPreferences(
      req.user!.id,
      req.user!.gymId!,
      { emailEnabled, smsEnabled }
    );
    res.json(prefs);
  });

  // === GYM REQUESTS (Owner Onboarding) ===
  // Owner creates a gym request
  app.post("/api/gym-requests", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "owner") {
        return res.status(403).json({ message: "Only owners can create gym requests" });
      }
      if (req.user!.gymId) {
        return res.status(400).json({ message: "You already have a gym" });
      }
      
      const existingRequest = await storage.getGymRequestByOwner(req.user!.id);
      if (existingRequest && existingRequest.status === "pending") {
        return res.status(400).json({ message: "You already have a pending request" });
      }
      
      const schema = z.object({
        gymName: z.string().min(1),
        phone: z.string().optional(),
        address: z.string().optional(),
        pointOfContactName: z.string().optional(),
        pointOfContactEmail: z.string().email().optional().or(z.literal(""))
      });
      const input = schema.parse(req.body);
      
      const request = await storage.createGymRequest({
        ownerUserId: req.user!.id,
        gymName: input.gymName,
        phone: input.phone || null,
        address: input.address || null,
        pointOfContactName: input.pointOfContactName || null,
        pointOfContactEmail: input.pointOfContactEmail || null
      });
      
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create gym request" });
    }
  });
  
  // Owner gets their gym request status
  app.get("/api/gym-requests/my", requireAuth, async (req, res) => {
    const request = await storage.getGymRequestByOwner(req.user!.id);
    res.json(request || null);
  });
  
  // === JOIN REQUESTS (Trainer/Member joining gym) ===
  // User submits a join request
  app.post("/api/join-requests", requireAuth, async (req, res) => {
    try {
      if (req.user!.gymId) {
        return res.status(400).json({ message: "You already belong to a gym" });
      }
      
      const existingRequest = await storage.getJoinRequestByUser(req.user!.id);
      if (existingRequest && existingRequest.status === "pending") {
        return res.status(400).json({ message: "You already have a pending request" });
      }
      
      const schema = z.object({
        gymCode: z.string().min(1)
      });
      const input = schema.parse(req.body);
      
      const gym = await storage.getGymByCode(input.gymCode.toUpperCase());
      if (!gym) {
        return res.status(400).json({ message: "Invalid gym code" });
      }
      
      const request = await storage.createJoinRequest({
        userId: req.user!.id,
        gymId: gym.id
      });
      
      res.status(201).json({ ...request, gymName: gym.name, gymCode: gym.code });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create join request" });
    }
  });
  
  // User gets their join request status
  app.get("/api/join-requests/my", requireAuth, async (req, res) => {
    const request = await storage.getJoinRequestByUser(req.user!.id);
    res.json(request || null);
  });
  
  // Owner gets pending join requests for their gym
  app.get("/api/owner/join-requests", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" || !req.user!.gymId) {
      return res.status(403).json({ message: "Owner access required" });
    }
    const requests = await storage.getPendingJoinRequestsForGym(req.user!.gymId);
    res.json(requests);
  });
  
  // Owner approves a join request
  app.post("/api/owner/join-requests/:id/approve", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" || !req.user!.gymId) {
      return res.status(403).json({ message: "Owner access required" });
    }
    try {
      const requestId = parseInt(req.params.id);
      const result = await storage.approveJoinRequest(requestId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to approve request" });
    }
  });
  
  // Owner rejects a join request
  app.post("/api/owner/join-requests/:id/reject", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" || !req.user!.gymId) {
      return res.status(403).json({ message: "Owner access required" });
    }
    try {
      const requestId = parseInt(req.params.id);
      const result = await storage.rejectJoinRequest(requestId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to reject request" });
    }
  });

  // === ADMIN AUTH ROUTES (Separate from user auth) ===
  
  // Admin JWT middleware
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { userId: number; username: string; isAdmin: boolean };
      if (!decoded.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      (req as any).adminUser = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired admin token" });
    }
  };
  
  // Admin login - completely separate from user login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(1)
      });
      const { username, password } = schema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isAdmin) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }
      
      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }
      
      const token = jwt.sign(
        { userId: user.id, username: user.username, isAdmin: true },
        ADMIN_JWT_SECRET,
        { expiresIn: "8h" }
      );
      
      res.json({ token, user: { id: user.id, username: user.username, isAdmin: true } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Admin me - verify token
  app.get("/api/admin/me", requireAdmin, async (req, res) => {
    const adminUser = (req as any).adminUser;
    res.json({ id: adminUser.userId, username: adminUser.username, isAdmin: true });
  });
  
  // === ADMIN DASHBOARD ROUTES ===
  
  // Get all gym requests (with owner info)
  app.get("/api/admin/all-gym-requests", requireAdmin, async (req, res) => {
    const requests = await storage.getAllGymRequestsWithOwner();
    res.json(requests);
  });
  
  // Get all gyms with owner and subscription info
  app.get("/api/admin/all-gyms", requireAdmin, async (req, res) => {
    const gyms = await storage.getAllGymsWithDetails();
    res.json(gyms);
  });
  
  app.get("/api/admin/gyms/:gymId/profile", requireAdmin, async (req, res) => {
    try {
      const gymId = parseInt(req.params.gymId);
      const gym = await storage.getGym(gymId);
      if (!gym) {
        return res.status(404).json({ message: "Gym not found" });
      }
      const members = await storage.getGymMembers(gymId);
      const trainers = await storage.getGymTrainers(gymId);
      res.json({
        gym,
        members: members.map(m => ({ id: m.id, username: m.username, email: m.email, phone: m.phone, publicId: m.publicId })),
        trainers: trainers.map(t => ({ id: t.id, username: t.username, email: t.email, phone: t.phone, publicId: t.publicId })),
        memberCount: members.length,
        trainerCount: trainers.length,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch gym profile" });
    }
  });
  
  // Admin approve gym request
  app.post("/api/admin/gym-requests/:id/approve", requireAdmin, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const result = await storage.approveGymRequest(requestId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to approve request" });
    }
  });
  
  // Admin reject gym request
  app.post("/api/admin/gym-requests/:id/reject", requireAdmin, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { adminNotes } = req.body;
      const result = await storage.rejectGymRequest(requestId, adminNotes || "");
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to reject request" });
    }
  });
  
  // === GYM SUBSCRIPTION MANAGEMENT ===
  
  // Get all gym subscriptions
  app.get("/api/admin/gym-subscriptions", requireAdmin, async (req, res) => {
    const subscriptions = await storage.getAllGymSubscriptions();
    res.json(subscriptions);
  });
  
  // Get subscription for a specific gym
  app.get("/api/admin/gym-subscriptions/:gymId", requireAdmin, async (req, res) => {
    const gymId = parseInt(req.params.gymId);
    const subscription = await storage.getGymSubscription(gymId);
    res.json(subscription || null);
  });
  
  // Create or update gym subscription
  app.post("/api/admin/gym-subscriptions/:gymId", requireAdmin, async (req, res) => {
    try {
      const gymId = parseInt(req.params.gymId);
      const schema = z.object({
        planType: z.enum(["1_month", "3_month", "6_month", "custom"]),
        amountPaid: z.number().min(0),
        paymentStatus: z.enum(["pending", "paid", "overdue"]),
        validUntil: z.string().optional(),
        notes: z.string().optional()
      });
      const input = schema.parse(req.body);
      
      const subscription = await storage.upsertGymSubscription(gymId, {
        gymId,
        planType: input.planType,
        amountPaid: input.amountPaid,
        paymentStatus: input.paymentStatus,
        paidOn: input.paymentStatus === "paid" ? new Date() : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        notes: input.notes || null
      });
      
      res.json(subscription);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });
  
  // Owner: Get their gym's subscription status (read-only)
  app.get("/api/owner/gym-subscription", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" || !req.user!.gymId) {
      return res.status(403).json({ message: "Owner access required" });
    }
    const subscription = await storage.getGymSubscription(req.user!.gymId);
    res.json(subscription || null);
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
    cycleLength: 3,
    startDate,
    endDate
  });

  const exercises = [
    { dayIndex: 0, exerciseName: "Bench Press", sets: 3, reps: 10, weight: "40kg", orderIndex: 0, muscleType: "Chest", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Overhead Press", sets: 3, reps: 10, weight: "20kg", orderIndex: 1, muscleType: "Shoulders", bodyPart: "Upper Body" },
    { dayIndex: 1, exerciseName: "Deadlift", sets: 3, reps: 8, weight: "60kg", orderIndex: 0, muscleType: "Back", bodyPart: "Full Body" },
    { dayIndex: 1, exerciseName: "Barbell Row", sets: 3, reps: 10, weight: "40kg", orderIndex: 1, muscleType: "Back", bodyPart: "Upper Body" },
    { dayIndex: 2, exerciseName: "Squats", sets: 3, reps: 10, weight: "50kg", orderIndex: 0, muscleType: "Legs", bodyPart: "Lower Body" },
    { dayIndex: 2, exerciseName: "Leg Press", sets: 3, reps: 12, weight: "80kg", orderIndex: 1, muscleType: "Legs", bodyPart: "Lower Body" },
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
