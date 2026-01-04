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
      endDate: z.string(),
      progressionMode: z.enum(["calendar", "completion"]).optional().default("calendar")
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

  app.patch("/api/trainer/cycles/:cycleId/rest-days", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const schema = z.object({
      restDays: z.array(z.number().min(0))
    });
    const input = schema.parse(req.body);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    if (cycle.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized for this gym" });
    }
    
    const validRestDays = input.restDays.filter(d => d < cycle.cycleLength);
    
    const updated = await storage.updateCycleRestDays(cycleId, validRestDays);
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
    const muscleTypes = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Full Body", "Rest", "Cardio", "Biceps", "Triceps", "Hamstrings", "Quadriceps", "Calves", "Abs", "Stretching", "Mobility", "Other"] as const;
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

  app.delete("/api/trainer/cycles/:cycleId/items/:itemId", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const itemId = parseInt(req.params.itemId);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const item = await storage.getWorkoutItem(itemId);
    if (!item || item.cycleId !== cycleId) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    await storage.deleteWorkoutItem(itemId);
    res.status(204).send();
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
    
    // Support both progression modes
    let currentDayIndex: number;
    let wasAutoReset = false;
    if (cycle.progressionMode === "completion") {
      // Completion-based: use stored currentDayIndex
      currentDayIndex = cycle.currentDayIndex ?? 0;
      
      // Auto-reset logic: if member missed more than 3 consecutive days, reset to day 0
      if (cycle.lastWorkoutDate) {
        const lastWorkout = new Date(cycle.lastWorkoutDate);
        const daysSinceLastWorkout = Math.floor((today.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastWorkout > 3 && currentDayIndex !== 0) {
          // Reset to day 0
          currentDayIndex = 0;
          await storage.updateCycleDayIndex(cycle.id, 0);
          wasAutoReset = true;
        }
      }
    } else {
      // Calendar-based (default): calculate from dates
      currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    }
    
    const items = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
    const completions = await storage.getCompletions(req.user!.id, todayStr);
    const completedIds = new Set(completions.map(c => c.workoutItemId));
    
    const itemsWithStatus = items.map(i => ({
      ...i,
      completed: completedIds.has(i.id)
    }));
    
    const dayLabel = cycle.dayLabels?.[currentDayIndex] || null;
    const isRestDay = (cycle.restDays?.includes(currentDayIndex)) || 
                      (dayLabel?.toLowerCase().includes("rest")) || 
                      items.length === 0;
    // Check for active swap
    const activeSwap = await storage.getActiveRestDaySwap(req.user!.id, cycle.id, todayStr);
    
    // If there's an active swap where today is the swap date, use the target day's exercises
    let effectiveDayIndex = currentDayIndex;
    let effectiveItems = itemsWithStatus;
    let effectiveIsRestDay = isRestDay;
    let swapInfo: { id: number; targetDate: string } | null = null;
    
    if (activeSwap && activeSwap.swapDate === todayStr) {
      effectiveDayIndex = activeSwap.targetDayIndex;
      const swappedItems = await storage.getWorkoutItemsByDay(cycle.id, effectiveDayIndex);
      const swappedItemsWithStatus = swappedItems.map(i => ({
        ...i,
        completed: completedIds.has(i.id)
      }));
      effectiveItems = swappedItemsWithStatus;
      effectiveIsRestDay = false;
      swapInfo = { id: activeSwap.id, targetDate: activeSwap.targetDate };
    }
    
    // Check if today is the targetDate of a swap (meaning it was pushed here)
    const pushedSwap = await storage.getActiveRestDaySwap(req.user!.id, cycle.id, 
      new Date(today.getTime() - 86400000).toISOString().split("T")[0]);
    if (pushedSwap && pushedSwap.targetDate === todayStr) {
      effectiveIsRestDay = true;
      effectiveItems = [];
    }
    
    // Check if tomorrow can be swapped (for UI)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const tomorrowDayIndex = (currentDayIndex + 1) % cycle.cycleLength;
    const tomorrowItems = await storage.getWorkoutItemsByDay(cycle.id, tomorrowDayIndex);
    const tomorrowDayLabel = cycle.dayLabels?.[tomorrowDayIndex] || null;
    const tomorrowIsRestDay = (cycle.restDays?.includes(tomorrowDayIndex)) || 
                              (tomorrowDayLabel?.toLowerCase().includes("rest")) || 
                              tomorrowItems.length === 0;
    
    const canSwapRestDay = isRestDay && !tomorrowIsRestDay && tomorrowItems.length > 0 && !activeSwap;
    
    res.json({ 
      cycleName: cycle.name, 
      dayIndex: effectiveDayIndex, 
      cycleLength: cycle.cycleLength,
      dayLabel: activeSwap ? cycle.dayLabels?.[effectiveDayIndex] || null : dayLabel,
      isRestDay: effectiveIsRestDay,
      items: effectiveItems,
      swap: swapInfo,
      canSwapRestDay,
      tomorrowDayIndex,
      progressionMode: cycle.progressionMode || "calendar",
      wasAutoReset
    });
  });
  
  // Advance day index for completion-based progression
  app.post("/api/workouts/advance-day", requireRole(["member"]), async (req, res) => {
    const cycle = await storage.getMemberCycle(req.user!.id);
    if (!cycle) return res.status(400).json({ message: "No active workout cycle" });
    
    if (cycle.progressionMode !== "completion") {
      return res.status(400).json({ message: "Cycle uses calendar-based progression" });
    }
    
    const newDayIndex = ((cycle.currentDayIndex ?? 0) + 1) % cycle.cycleLength;
    const todayStr = new Date().toISOString().split("T")[0];
    await storage.updateCycleDayIndexAndLastWorkout(cycle.id, newDayIndex, todayStr);
    
    res.json({ message: "Day advanced", newDayIndex });
  });

  app.post("/api/workouts/rest-day-swap", requireRole(["member"]), async (req, res) => {
    const cycle = await storage.getMemberCycle(req.user!.id);
    if (!cycle) return res.status(400).json({ message: "No active workout cycle" });
    
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const startDate = new Date(cycle.startDate);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Support both progression modes
    let currentDayIndex: number;
    if (cycle.progressionMode === "completion") {
      currentDayIndex = cycle.currentDayIndex ?? 0;
    } else {
      currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    }
    
    // Verify today is a rest day
    const todayItems = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
    const dayLabel = cycle.dayLabels?.[currentDayIndex] || null;
    const isRestDay = (cycle.restDays?.includes(currentDayIndex)) || 
                      (dayLabel?.toLowerCase().includes("rest")) || 
                      todayItems.length === 0;
    
    if (!isRestDay) {
      return res.status(400).json({ message: "Today is not a rest day" });
    }
    
    // Verify tomorrow has a workout
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const tomorrowDayIndex = (currentDayIndex + 1) % cycle.cycleLength;
    const tomorrowItems = await storage.getWorkoutItemsByDay(cycle.id, tomorrowDayIndex);
    const tomorrowDayLabel = cycle.dayLabels?.[tomorrowDayIndex] || null;
    const tomorrowIsRestDay = (cycle.restDays?.includes(tomorrowDayIndex)) || 
                              (tomorrowDayLabel?.toLowerCase().includes("rest")) || 
                              tomorrowItems.length === 0;
    
    if (tomorrowIsRestDay || tomorrowItems.length === 0) {
      return res.status(400).json({ message: "Tomorrow is also a rest day or has no exercises" });
    }
    
    // Check for existing swap
    const existingSwap = await storage.getActiveRestDaySwap(req.user!.id, cycle.id, todayStr);
    if (existingSwap) {
      return res.status(400).json({ message: "Swap already exists for today" });
    }
    
    const swap = await storage.createRestDaySwap({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      cycleId: cycle.id,
      swapDate: todayStr,
      targetDate: tomorrowStr,
      targetDayIndex: tomorrowDayIndex
    });
    
    res.status(201).json(swap);
  });

  app.delete("/api/workouts/rest-day-swap/:swapId", requireRole(["member"]), async (req, res) => {
    const swapId = parseInt(req.params.swapId);
    if (isNaN(swapId)) {
      return res.status(400).json({ message: "Invalid swap ID" });
    }
    
    await storage.deleteRestDaySwap(swapId, req.user!.id);
    res.json({ message: "Swap cancelled" });
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
    
    // Check if we should ask user to share on feed (first completion of day + auto-post enabled)
    let askToShare = false;
    let shareFocusLabel = focusLabel;
    try {
      const user = await storage.getUser(req.user!.id);
      if (user?.autoPostEnabled !== false) {
        const todayCompletions = await storage.getCompletions(req.user!.id, today);
        if (todayCompletions.length === 1) {
          // First completion of the day - ask user if they want to share
          askToShare = true;
        }
      }
    } catch (feedErr) {
      console.error("Error checking feed post status:", feedErr);
    }
    
    res.status(201).json({ ...completion, askToShare, focusLabel: shareFocusLabel });
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
    
    // Collect shareable achievements if auto-post is enabled
    const shareableAchievements: { type: string; label: string; metadata: Record<string, unknown> }[] = [];
    
    if (completions.length > 0 && req.user!.autoPostEnabled !== false) {
      const todayPosts = await storage.getMemberFeedPostsForDate(req.user!.id, today);
      
      // 1. Workout completion
      const hasSharedWorkout = todayPosts.some((p: { type: string }) => p.type === "workout_completed");
      if (!hasSharedWorkout) {
        shareableAchievements.push({
          type: "workout_completed",
          label: session?.focusLabel || "Workout",
          metadata: { focusLabel: session?.focusLabel || "Workout" }
        });
      }
      
      // 2. Streak milestones (7, 14, 30, 60, 100 days)
      const stats = await storage.getMemberStats(req.user!.id);
      const streakMilestones = [7, 14, 30, 60, 100];
      if (streakMilestones.includes(stats.streak)) {
        const hasSharedStreak = todayPosts.some((p: { type: string; metadata: string | null }) => {
          if (p.type !== "streak_milestone") return false;
          try {
            const meta = p.metadata ? JSON.parse(p.metadata) : {};
            return meta.days === stats.streak;
          } catch { return false; }
        });
        if (!hasSharedStreak) {
          shareableAchievements.push({
            type: "streak_milestone",
            label: `${stats.streak} Day Streak`,
            metadata: { days: stats.streak }
          });
        }
      }
      
      // 3. Workout count milestones (10, 25, 50, 100, 200, 500)
      const countMilestones = [10, 25, 50, 100, 200, 500];
      if (countMilestones.includes(stats.totalWorkouts)) {
        const hasSharedCount = todayPosts.some((p: { type: string; metadata: string | null }) => {
          if (p.type !== "achievement") return false;
          try {
            const meta = p.metadata ? JSON.parse(p.metadata) : {};
            return meta.type === "workout_count" && meta.count === stats.totalWorkouts;
          } catch { return false; }
        });
        if (!hasSharedCount) {
          shareableAchievements.push({
            type: "achievement",
            label: `${stats.totalWorkouts} Workouts Completed`,
            metadata: { type: "workout_count", count: stats.totalWorkouts }
          });
        }
      }
    }
    
    res.status(201).json({ completed: completions.length, shareableAchievements });
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

  app.get("/api/me/stats/consistency", requireRole(["member"]), async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const consistencyStats = await storage.getMemberConsistencyStats(req.user!.gymId!, req.user!.id, days);
    res.json(consistencyStats);
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
    // Check and apply auto-assign phase before fetching summary
    await storage.checkAndApplyAutoAssignPhase(req.user!.gymId!, req.user!.id);
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

  // === DAILY WORKOUT POINTS ===
  // Returns daily workout points data for a date range
  // plannedPoints = number of exercises planned for that day
  // earnedPoints = number of unique exercises completed that day
  app.get("/api/member/daily-points", requireRole(["member"]), async (req, res) => {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    
    // Default to last 7 days if not provided
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    
    const from = fromStr || defaultFrom.toISOString().split("T")[0];
    const to = toStr || today.toISOString().split("T")[0];
    
    const dailyPoints = await storage.getDailyWorkoutPoints(
      req.user!.gymId!,
      req.user!.id,
      from,
      to
    );
    res.json(dailyPoints);
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

  // === TRAINING PHASES ROUTES ===
  app.post("/api/training-phases", requireRole(["trainer"]), async (req, res) => {
    const schema = z.object({
      memberId: z.number(),
      name: z.string().min(1),
      goalType: z.enum(["cut", "bulk", "strength", "endurance", "rehab", "general"]),
      startDate: z.string(),
      endDate: z.string(),
      cycleId: z.number().nullable().optional(),
      dietPlanId: z.number().optional(),
      notes: z.string().optional()
    });
    const input = schema.parse(req.body);
    
    const phase = await storage.createTrainingPhase({
      gymId: req.user!.gymId!,
      trainerId: req.user!.id,
      memberId: input.memberId,
      name: input.name,
      goalType: input.goalType,
      startDate: input.startDate,
      endDate: input.endDate,
      cycleId: input.cycleId,
      dietPlanId: input.dietPlanId,
      notes: input.notes
    });
    res.status(201).json(phase);
  });

  app.get("/api/training-phases/member/:memberId", requireRole(["trainer", "owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const phases = await storage.getTrainingPhases(req.user!.gymId!, memberId);
    res.json(phases);
  });

  app.get("/api/training-phases/me", requireRole(["member"]), async (req, res) => {
    const phases = await storage.getTrainingPhases(req.user!.gymId!, req.user!.id);
    res.json(phases);
  });

  app.get("/api/training-phases/:phaseId", requireRole(["trainer", "member", "owner"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    // Members can only view their own phases
    if (req.user!.role === "member" && phase.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    res.json(phase);
  });

  app.get("/api/training-phases/:phaseId/analytics", requireRole(["trainer", "member", "owner"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    // Members can only view their own phase analytics
    if (req.user!.role === "member" && phase.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const analytics = await storage.getPhaseAnalytics(
      phaseId, 
      phase.memberId, 
      phase.startDate, 
      phase.endDate,
      phase.gymId
    );
    res.json(analytics);
  });

  app.delete("/api/training-phases/:phaseId", requireRole(["trainer"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the trainer who created this phase can delete it" });
    }
    await storage.deleteTrainingPhase(phaseId);
    res.json({ success: true });
  });

  app.patch("/api/training-phases/:phaseId", requireRole(["trainer"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the trainer who created this phase can update it" });
    }
    const schema = z.object({
      name: z.string().min(1).optional(),
      goalType: z.enum(["cut", "bulk", "strength", "endurance", "rehab", "general"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      notes: z.string().nullable().optional()
    });
    const input = schema.parse(req.body);
    const updated = await storage.updateTrainingPhase(phaseId, input);
    res.json(updated);
  });

  // Phase Exercises routes
  app.get("/api/training-phases/:phaseId/exercises", requireRole(["trainer", "member", "owner"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const exercises = await storage.getPhaseExercises(phaseId);
    res.json(exercises);
  });

  app.post("/api/training-phases/:phaseId/exercises", requireRole(["trainer"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const exercise = await storage.addPhaseExercise({ ...req.body, phaseId });
    res.status(201).json(exercise);
  });

  app.patch("/api/training-phases/exercises/:exerciseId", requireRole(["trainer"]), async (req, res) => {
    const exerciseId = parseInt(req.params.exerciseId);
    const exercise = await storage.updatePhaseExercise(exerciseId, req.body);
    res.json(exercise);
  });

  app.delete("/api/training-phases/exercises/:exerciseId", requireRole(["trainer"]), async (req, res) => {
    const exerciseId = parseInt(req.params.exerciseId);
    await storage.deletePhaseExercise(exerciseId);
    res.json({ success: true });
  });

  app.post("/api/training-phases/:phaseId/copy-from-cycle", requireRole(["trainer"]), async (req, res) => {
    const phaseId = parseInt(req.params.phaseId);
    const { cycleId } = req.body;
    const phase = await storage.getTrainingPhaseById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: "Phase not found" });
    }
    if (phase.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const exercises = await storage.copyExercisesFromCycle(phaseId, cycleId);
    res.json(exercises);
  });

  // Get member's active phase (for auto-assign cycle logic)
  app.get("/api/member/active-phase", requireRole(["member"]), async (req, res) => {
    const phase = await storage.getActivePhaseForMember(req.user!.id, req.user!.gymId!);
    res.json(phase || null);
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

  // Get member's workout cycles (for phase creation)
  app.get("/api/trainer/members/:memberId/cycles", requireRole(["trainer", "owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }
    const cycles = await storage.getMemberCycles(memberId);
    res.json(cycles.map(c => ({ id: c.id, name: c.name })));
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

  // Revenue Analytics
  app.get("/api/owner/revenue", requireRole(["owner"]), async (req, res) => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const revenueData = await storage.getRevenueAnalytics(req.user!.gymId!, month);
    res.json(revenueData);
  });

  // Member Analytics
  app.get("/api/owner/member-analytics", requireRole(["owner"]), async (req, res) => {
    const analytics = await storage.getMemberAnalytics(req.user!.gymId!);
    res.json(analytics);
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

  app.get("/api/owner/members/:memberId/payments", requireRole(["owner"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const members = await storage.getGymMembers(req.user!.gymId!);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const paymentDetails = await storage.getMemberPaymentDetails(memberId, req.user!.gymId!);
    res.json(paymentDetails || { subscription: null, totalPaid: 0, remainingBalance: 0, transactions: [] });
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

  // === SIDEBAR NOTIFICATION COUNTS ===
  app.get("/api/notification-counts", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const result: { unreadAnnouncements: number; pendingRequests: number; pendingTransfers?: number; pendingJoinRequests?: number } = {
        unreadAnnouncements: 0,
        pendingRequests: 0
      };

      if (!user.gymId) {
        return res.json(result);
      }

      // Unread announcements (all roles)
      result.unreadAnnouncements = await storage.getUnreadAnnouncementCount(user.gymId, user.id, user.role);

      if (user.role === "owner") {
        // Pending transfer requests for owner
        const transfers = await storage.getTransferRequestsForOwner(user.gymId);
        result.pendingTransfers = transfers.filter(t => t.status === "pending").length;
        
        // Pending join requests for owner (already filtered to pending)
        const joinRequests = await storage.getPendingJoinRequestsForGym(user.gymId);
        result.pendingJoinRequests = joinRequests.length;
      } else if (user.role === "trainer") {
        // Pending requests from members assigned to this trainer
        const requests = await storage.getTrainerRequests(user.id);
        result.pendingRequests = requests.filter(r => r.status === "pending").length;
      } else if (user.role === "member") {
        // Member's own pending requests
        const requests = await storage.getMemberRequests(user.id);
        result.pendingRequests = requests.filter(r => r.status === "pending").length;
      }

      res.json(result);
    } catch (err) {
      console.error("Error fetching notification counts:", err);
      res.status(500).json({ message: "Failed to fetch notification counts" });
    }
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

  // === AUTO-POST SETTINGS ===
  app.get("/api/me/auto-post", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    res.json({ autoPostEnabled: user?.autoPostEnabled ?? true });
  });

  app.put("/api/me/auto-post", requireAuth, async (req, res) => {
    const schema = z.object({ autoPostEnabled: z.boolean() });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid request" });
    }
    await storage.updateUserAutoPost(req.user!.id, result.data.autoPostEnabled);
    res.json({ autoPostEnabled: result.data.autoPostEnabled });
  });

  // === MY POSTS ===
  app.get("/api/me/posts", requireAuth, async (req, res) => {
    const posts = await storage.getUserPosts(req.user!.id);
    res.json(posts);
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

  // ==================== SOCIAL FEED ====================
  
  // Get gym feed
  app.get("/api/feed", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const posts = await storage.getFeedPosts(req.user!.gymId, limit);
    res.json(posts);
  });
  
  // Share workout completion on feed (triggered by user confirmation) - LEGACY
  app.post("/api/feed/share-workout", requireRole(["member"]), async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    const { focusLabel } = req.body;
    const today = new Date().toISOString().split("T")[0];
    
    // Get today's completions to include count
    const todayCompletions = await storage.getCompletions(req.user!.id, today);
    
    const post = await storage.createFeedPost({
      gymId: req.user!.gymId,
      userId: req.user!.id,
      type: "workout_complete",
      content: null,
      metadata: { exerciseCount: todayCompletions.length || 1, focusLabel: focusLabel || "Workout" }
    });
    res.status(201).json(post);
  });
  
  // Share any achievement on feed (generic endpoint)
  app.post("/api/feed/share-achievement", requireRole(["member"]), async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    const { type, label, metadata } = req.body;
    const today = new Date().toISOString().split("T")[0];
    
    let feedPostType = type;
    let feedMetadata: Record<string, unknown> = { ...metadata };
    
    if (type === "workout_completed") {
      feedPostType = "workout_complete";
      const todayCompletions = await storage.getCompletions(req.user!.id, today);
      feedMetadata = { exerciseCount: todayCompletions.length || 1, focusLabel: metadata?.focusLabel || label || "Workout" };
    } else if (type === "streak_milestone") {
      feedMetadata = { days: metadata?.days };
    } else if (type === "achievement") {
      feedMetadata = metadata || {};
    }
    
    const post = await storage.createFeedPost({
      gymId: req.user!.gymId,
      userId: req.user!.id,
      type: feedPostType,
      content: null,
      metadata: feedMetadata
    });
    res.status(201).json(post);
  });

  // Create a manual feed post
  app.post("/api/feed", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "Content is required" });
    }
    if (content.length > 500) {
      return res.status(400).json({ message: "Content too long (max 500 characters)" });
    }
    
    const post = await storage.createFeedPost({
      gymId: req.user!.gymId,
      userId: req.user!.id,
      type: "manual",
      content: content.trim(),
      metadata: {},
      isVisible: true,
    });
    res.status(201).json(post);
  });
  
  // Add reaction to post
  app.post("/api/feed/:postId/react", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const postId = parseInt(req.params.postId);
    const { reactionType } = req.body;
    
    // Verify post belongs to user's gym and is visible
    const post = await storage.getFeedPost(postId);
    if (!post || post.gymId !== req.user!.gymId || post.isVisible === false) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    if (!reactionType || !["like", "fire", "muscle", "clap"].includes(reactionType)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }
    
    const reaction = await storage.addFeedReaction({
      postId,
      userId: req.user!.id,
      reactionType
    });
    res.json(reaction);
  });
  
  // Remove reaction from post
  app.delete("/api/feed/:postId/react", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const postId = parseInt(req.params.postId);
    
    // Verify post belongs to user's gym
    const post = await storage.getFeedPost(postId);
    if (!post || post.gymId !== req.user!.gymId) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    await storage.removeFeedReaction(postId, req.user!.id);
    res.json({ success: true });
  });
  
  // Get comments for a post
  app.get("/api/feed/:postId/comments", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const postId = parseInt(req.params.postId);
    
    // Verify post belongs to user's gym and is visible
    const post = await storage.getFeedPost(postId);
    if (!post || post.gymId !== req.user!.gymId || post.isVisible === false) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const comments = await storage.getFeedComments(postId);
    res.json(comments);
  });
  
  // Add comment to post
  app.post("/api/feed/:postId/comments", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const postId = parseInt(req.params.postId);
    const { content } = req.body;
    
    // Verify post belongs to user's gym and is visible
    const post = await storage.getFeedPost(postId);
    if (!post || post.gymId !== req.user!.gymId || post.isVisible === false) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Comment content required" });
    }
    
    const comment = await storage.addFeedComment({
      postId,
      userId: req.user!.id,
      content: content.trim()
    });
    res.json(comment);
  });
  
  // Delete comment (own only)
  app.delete("/api/feed/comments/:commentId", requireAuth, async (req, res) => {
    const commentId = parseInt(req.params.commentId);
    await storage.deleteFeedComment(commentId, req.user!.id);
    res.json({ success: true });
  });
  
  // Hide post (owner/trainer moderation)
  app.patch("/api/feed/:postId/hide", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" && req.user!.role !== "trainer") {
      return res.status(403).json({ message: "Only owners and trainers can hide posts" });
    }
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    const postId = parseInt(req.params.postId);
    await storage.hideFeedPost(postId, req.user!.gymId);
    res.json({ success: true });
  });
  
  // ==================== TOURNAMENTS ====================
  
  // Get all tournaments for gym
  app.get("/api/tournaments", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    const tournamentList = await storage.getTournaments(req.user!.gymId);
    res.json(tournamentList);
  });
  
  // Get single tournament with participants
  app.get("/api/tournaments/:id", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const tournamentId = parseInt(req.params.id);
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament || tournament.gymId !== req.user!.gymId) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    
    // Update scores before returning
    await storage.updateTournamentScores(tournamentId);
    
    const participants = await storage.getTournamentParticipants(tournamentId);
    const leaderboard = await storage.getTournamentLeaderboard(tournamentId);
    
    // Check if current user is participating
    const isParticipating = participants.some(p => p.userId === req.user!.id);
    
    res.json({ ...tournament, participants, leaderboard, isParticipating });
  });
  
  // Create tournament (owner/trainer only)
  app.post("/api/tournaments", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" && req.user!.role !== "trainer") {
      return res.status(403).json({ message: "Only owners and trainers can create tournaments" });
    }
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const { name, description, metricType, startDate, endDate, prizeDescription, maxParticipants } = req.body;
    
    if (!name || !metricType || !startDate || !endDate) {
      return res.status(400).json({ message: "Name, metric type, start date, and end date required" });
    }
    
    const tournament = await storage.createTournament({
      gymId: req.user!.gymId,
      createdByUserId: req.user!.id,
      name,
      description,
      metricType,
      startDate,
      endDate,
      prizeDescription,
      maxParticipants,
      status: "upcoming"
    });
    
    res.json(tournament);
  });
  
  // Update tournament status
  app.patch("/api/tournaments/:id", requireAuth, async (req, res) => {
    if (req.user!.role !== "owner" && req.user!.role !== "trainer") {
      return res.status(403).json({ message: "Only owners and trainers can update tournaments" });
    }
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const tournamentId = parseInt(req.params.id);
    
    // Verify tournament belongs to user's gym
    const existingTournament = await storage.getTournament(tournamentId);
    if (!existingTournament || existingTournament.gymId !== req.user!.gymId) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    
    const { status, prizeDescription } = req.body;
    
    const tournament = await storage.updateTournament(tournamentId, { status, prizeDescription });
    res.json(tournament);
  });
  
  // Join tournament (members)
  app.post("/api/tournaments/:id/join", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const tournamentId = parseInt(req.params.id);
    const tournament = await storage.getTournament(tournamentId);
    
    // Verify tournament exists and belongs to user's gym
    if (!tournament || tournament.gymId !== req.user!.gymId) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    
    if (tournament.status !== "upcoming" && tournament.status !== "active") {
      return res.status(400).json({ message: "Cannot join this tournament" });
    }
    
    // Check max participants
    if (tournament.maxParticipants) {
      const participants = await storage.getTournamentParticipants(tournamentId);
      if (participants.length >= tournament.maxParticipants) {
        return res.status(400).json({ message: "Tournament is full" });
      }
    }
    
    try {
      const participant = await storage.joinTournament({
        tournamentId,
        userId: req.user!.id,
        currentScore: 0
      });
      res.json(participant);
    } catch (err: any) {
      if (err.code === "23505") {
        return res.status(400).json({ message: "Already joined" });
      }
      throw err;
    }
  });
  
  // Leave tournament
  app.delete("/api/tournaments/:id/leave", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const tournamentId = parseInt(req.params.id);
    
    // Verify tournament belongs to user's gym
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament || tournament.gymId !== req.user!.gymId) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    
    await storage.leaveTournament(tournamentId, req.user!.id);
    res.json({ success: true });
  });
  
  // Get tournament leaderboard
  app.get("/api/tournaments/:id/leaderboard", requireAuth, async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "Not in a gym" });
    }
    
    const tournamentId = parseInt(req.params.id);
    
    // Verify tournament belongs to user's gym
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament || tournament.gymId !== req.user!.gymId) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    
    // Update scores first
    await storage.updateTournamentScores(tournamentId);
    
    const leaderboard = await storage.getTournamentLeaderboard(tournamentId);
    res.json(leaderboard);
  });

  await seedDemoData();
  return httpServer;
}

async function seedDemoData() {
  const existingGym = await storage.getGymByCode("DEMO01");
  if (existingGym) return;

  console.log("Seeding comprehensive demo data...");
  const gym = await storage.createGym({ name: "OGym Demo", code: "DEMO01" });
  const gymId = gym.id;

  const password = await hashPassword("password123");

  // Create users with profile info
  const owner = await storage.createUser({ username: "owner", password, role: "owner", gymId, email: "owner@ogym.demo", phone: "9876543210" });
  const trainer = await storage.createUser({ username: "trainer", password, role: "trainer", gymId, email: "trainer@ogym.demo", phone: "9876543211" });
  const trainer2 = await storage.createUser({ username: "trainer2", password, role: "trainer", gymId, email: "trainer2@ogym.demo" });
  const member1 = await storage.createUser({ username: "member1", password, role: "member", gymId, email: "member1@ogym.demo", phone: "9876543212" });
  const member2 = await storage.createUser({ username: "member2", password, role: "member", gymId, email: "member2@ogym.demo", phone: "9876543213" });
  const member3 = await storage.createUser({ username: "member3", password, role: "member", gymId, email: "member3@ogym.demo" });
  const member4 = await storage.createUser({ username: "member4", password, role: "member", gymId });
  const member5 = await storage.createUser({ username: "member5", password, role: "member", gymId });

  // Assign trainers
  await storage.assignTrainer(trainer.id, member1.id, gymId);
  await storage.assignTrainer(trainer.id, member2.id, gymId);
  await storage.assignTrainer(trainer.id, member3.id, gymId);
  await storage.assignTrainer(trainer2.id, member4.id, gymId);
  await storage.assignTrainer(trainer2.id, member5.id, gymId);

  // Mark star members
  await storage.addStarMember({ trainerId: trainer.id, memberId: member1.id, gymId });
  await storage.addStarMember({ trainerId: trainer.id, memberId: member2.id, gymId });

  const today = new Date();
  const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

  // ===== WORKOUT CYCLES =====
  // Member1: Push-Pull-Legs (active, very consistent)
  const cycle1 = await storage.createWorkoutCycle({
    gymId, memberId: member1.id, trainerId: trainer.id,
    name: "Push-Pull-Legs Pro", cycleLength: 3,
    startDate: toDateStr(daysAgo(60)), endDate: toDateStr(daysFromNow(30))
  });
  
  const cycle1Exercises = [
    { dayIndex: 0, exerciseName: "Bench Press", sets: 4, reps: 8, weight: "60kg", orderIndex: 0, muscleType: "Chest", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Incline Dumbbell Press", sets: 3, reps: 10, weight: "22kg", orderIndex: 1, muscleType: "Chest", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Overhead Press", sets: 3, reps: 10, weight: "30kg", orderIndex: 2, muscleType: "Shoulders", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Tricep Pushdown", sets: 3, reps: 12, weight: "25kg", orderIndex: 3, muscleType: "Triceps", bodyPart: "Upper Body" },
    { dayIndex: 1, exerciseName: "Deadlift", sets: 4, reps: 6, weight: "100kg", orderIndex: 0, muscleType: "Back", bodyPart: "Full Body" },
    { dayIndex: 1, exerciseName: "Barbell Row", sets: 4, reps: 8, weight: "50kg", orderIndex: 1, muscleType: "Back", bodyPart: "Upper Body" },
    { dayIndex: 1, exerciseName: "Lat Pulldown", sets: 3, reps: 10, weight: "55kg", orderIndex: 2, muscleType: "Back", bodyPart: "Upper Body" },
    { dayIndex: 1, exerciseName: "Bicep Curls", sets: 3, reps: 12, weight: "12kg", orderIndex: 3, muscleType: "Biceps", bodyPart: "Upper Body" },
    { dayIndex: 2, exerciseName: "Squats", sets: 4, reps: 8, weight: "80kg", orderIndex: 0, muscleType: "Legs", bodyPart: "Lower Body" },
    { dayIndex: 2, exerciseName: "Leg Press", sets: 3, reps: 12, weight: "120kg", orderIndex: 1, muscleType: "Legs", bodyPart: "Lower Body" },
    { dayIndex: 2, exerciseName: "Romanian Deadlift", sets: 3, reps: 10, weight: "50kg", orderIndex: 2, muscleType: "Hamstrings", bodyPart: "Lower Body" },
    { dayIndex: 2, exerciseName: "Calf Raises", sets: 4, reps: 15, weight: "60kg", orderIndex: 3, muscleType: "Calves", bodyPart: "Lower Body" },
  ];
  for (const ex of cycle1Exercises) await storage.addWorkoutItem({ ...ex, cycleId: cycle1.id });

  // Member2: Upper-Lower Split (moderate consistency)
  const cycle2 = await storage.createWorkoutCycle({
    gymId, memberId: member2.id, trainerId: trainer.id,
    name: "Upper-Lower Split", cycleLength: 2,
    startDate: toDateStr(daysAgo(45)), endDate: toDateStr(daysFromNow(30))
  });
  
  const cycle2Exercises = [
    { dayIndex: 0, exerciseName: "Bench Press", sets: 3, reps: 10, weight: "40kg", orderIndex: 0, muscleType: "Chest", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Seated Row", sets: 3, reps: 10, weight: "40kg", orderIndex: 1, muscleType: "Back", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Shoulder Press", sets: 3, reps: 10, weight: "15kg", orderIndex: 2, muscleType: "Shoulders", bodyPart: "Upper Body" },
    { dayIndex: 1, exerciseName: "Squats", sets: 3, reps: 10, weight: "50kg", orderIndex: 0, muscleType: "Legs", bodyPart: "Lower Body" },
    { dayIndex: 1, exerciseName: "Leg Curl", sets: 3, reps: 12, weight: "30kg", orderIndex: 1, muscleType: "Hamstrings", bodyPart: "Lower Body" },
    { dayIndex: 1, exerciseName: "Leg Extension", sets: 3, reps: 12, weight: "35kg", orderIndex: 2, muscleType: "Quadriceps", bodyPart: "Lower Body" },
  ];
  for (const ex of cycle2Exercises) await storage.addWorkoutItem({ ...ex, cycleId: cycle2.id });

  // Member3: Full Body (inconsistent)
  const cycle3 = await storage.createWorkoutCycle({
    gymId, memberId: member3.id, trainerId: trainer.id,
    name: "Full Body Beginner", cycleLength: 1,
    startDate: toDateStr(daysAgo(30)), endDate: toDateStr(daysFromNow(30))
  });
  
  const cycle3Exercises = [
    { dayIndex: 0, exerciseName: "Goblet Squat", sets: 3, reps: 12, weight: "16kg", orderIndex: 0, muscleType: "Legs", bodyPart: "Lower Body" },
    { dayIndex: 0, exerciseName: "Push-ups", sets: 3, reps: 15, weight: "BW", orderIndex: 1, muscleType: "Chest", bodyPart: "Upper Body" },
    { dayIndex: 0, exerciseName: "Dumbbell Row", sets: 3, reps: 10, weight: "12kg", orderIndex: 2, muscleType: "Back", bodyPart: "Upper Body" },
  ];
  for (const ex of cycle3Exercises) await storage.addWorkoutItem({ ...ex, cycleId: cycle3.id });

  // ===== 60+ DAYS HISTORICAL DATA =====
  // Get workout items for each cycle
  const cycle1Items = await storage.getWorkoutItems(cycle1.id);
  const cycle2Items = await storage.getWorkoutItems(cycle2.id);
  const cycle3Items = await storage.getWorkoutItems(cycle3.id);

  // Helper function to complete a workout item
  const completeItem = async (item: any, cycleId: number, memberId: number, date: string) => {
    await storage.completeWorkout({
      gymId, cycleId, workoutItemId: item.id, memberId, completedDate: date,
      actualSets: item.sets, actualReps: item.reps, actualWeight: item.weight
    });
  };

  // Member1: Very consistent (5-6 days/week), good completion rates
  for (let i = 60; i >= 0; i--) {
    const date = toDateStr(daysAgo(i));
    const dayOfWeek = daysAgo(i).getDay();
    
    // Skip some Sundays (rest day)
    if (dayOfWeek === 0 && Math.random() > 0.3) continue;
    
    // 85% attendance rate
    if (Math.random() > 0.85) continue;
    
    await storage.markAttendance({ gymId, memberId: member1.id, date, status: "present", verifiedMethod: "qr", markedByUserId: owner.id });
    
    const dayIndex = i % 3;
    const dayItems = cycle1Items.filter(item => item.dayIndex === dayIndex);
    
    // Completion patterns: 70% full, 25% partial, 5% missed after attending
    const rand = Math.random();
    if (rand < 0.70) {
      // Complete all exercises
      for (const item of dayItems) {
        await completeItem(item, cycle1.id, member1.id, date);
      }
    } else if (rand < 0.95) {
      // Partial completion (2-3 exercises)
      const completeCount = Math.floor(Math.random() * 2) + 2;
      for (let j = 0; j < Math.min(completeCount, dayItems.length); j++) {
        await completeItem(dayItems[j], cycle1.id, member1.id, date);
      }
    }
    // else: attended but didn't complete workout (5%)
  }

  // Member2: Moderate consistency (3-4 days/week)
  for (let i = 45; i >= 0; i--) {
    const date = toDateStr(daysAgo(i));
    const dayOfWeek = daysAgo(i).getDay();
    
    // Skip weekends mostly
    if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() > 0.4) continue;
    
    // 65% attendance rate
    if (Math.random() > 0.65) continue;
    
    await storage.markAttendance({ gymId, memberId: member2.id, date, status: "present", verifiedMethod: "manual", markedByUserId: trainer.id });
    
    const dayIndex = i % 2;
    const dayItems = cycle2Items.filter(item => item.dayIndex === dayIndex);
    
    // 60% full completion, 30% partial
    const rand = Math.random();
    if (rand < 0.60) {
      for (const item of dayItems) {
        await completeItem(item, cycle2.id, member2.id, date);
      }
    } else if (rand < 0.90) {
      const completeCount = Math.floor(Math.random() * 2) + 1;
      for (let j = 0; j < Math.min(completeCount, dayItems.length); j++) {
        await completeItem(dayItems[j], cycle2.id, member2.id, date);
      }
    }
  }

  // Member3: Inconsistent (1-2 days/week)
  for (let i = 30; i >= 0; i--) {
    const date = toDateStr(daysAgo(i));
    
    // Only 30% attendance rate
    if (Math.random() > 0.30) continue;
    
    await storage.markAttendance({ gymId, memberId: member3.id, date, status: "present", verifiedMethod: "qr", markedByUserId: owner.id });
    
    const dayItems = cycle3Items;
    
    // 50% full, 40% partial
    const rand = Math.random();
    if (rand < 0.50) {
      for (const item of dayItems) {
        await completeItem(item, cycle3.id, member3.id, date);
      }
    } else if (rand < 0.90) {
      await completeItem(dayItems[0], cycle3.id, member3.id, date);
    }
  }

  // Member4 & 5: Some attendance but no workout cycle yet
  for (let i = 20; i >= 0; i--) {
    const date = toDateStr(daysAgo(i));
    if (Math.random() < 0.4) {
      await storage.markAttendance({ gymId, memberId: member4.id, date, status: "present", verifiedMethod: "manual", markedByUserId: trainer2.id });
    }
    if (Math.random() < 0.25) {
      await storage.markAttendance({ gymId, memberId: member5.id, date, status: "present", verifiedMethod: "qr", markedByUserId: owner.id });
    }
  }

  // ===== PAYMENT HISTORY (6 months) =====
  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const month = monthDate.toISOString().slice(0, 7);
    
    // Member1: Always paid on time
    await storage.markPayment({ gymId, memberId: member1.id, month, amountDue: 150000, amountPaid: 150000, status: "paid", note: "Monthly premium" });
    
    // Member2: Paid but sometimes partial
    const m2Paid = m === 0 ? 100000 : 120000;
    await storage.markPayment({ gymId, memberId: member2.id, month, amountDue: 120000, amountPaid: m2Paid, status: m2Paid >= 120000 ? "paid" : "partial", note: m2Paid < 120000 ? "Balance pending" : "" });
    
    // Member3: Irregular payments
    if (m % 2 === 0) {
      await storage.markPayment({ gymId, memberId: member3.id, month, amountDue: 100000, amountPaid: 100000, status: "paid" });
    } else if (m > 0) {
      await storage.markPayment({ gymId, memberId: member3.id, month, amountDue: 100000, amountPaid: 50000, status: "partial", note: "Promised to pay balance" });
    }
  }
  
  // Current month pending for members 4 & 5
  const currentMonth = today.toISOString().slice(0, 7);
  await storage.markPayment({ gymId, memberId: member4.id, month: currentMonth, amountDue: 100000, amountPaid: 0, status: "unpaid" });
  await storage.markPayment({ gymId, memberId: member5.id, month: currentMonth, amountDue: 100000, amountPaid: 50000, status: "partial" });

  // ===== BODY MEASUREMENTS (Monthly for 6 months) =====
  for (let m = 5; m >= 0; m--) {
    const measureDate = toDateStr(new Date(today.getFullYear(), today.getMonth() - m, 15));
    
    // Member1: Consistent progress (all values in integers - weight in grams for precision, measurements in mm)
    await storage.createBodyMeasurement({
      gymId, memberId: member1.id, recordedDate: measureDate,
      weight: Math.round(78000 - m * 800), height: 178,
      chest: Math.round(102 + m * 0.3), waist: Math.round(82 - m * 0.5),
      hips: Math.round(98 - m * 0.2), biceps: Math.round(35 + m * 0.2),
      thighs: Math.round(58 + m * 0.3), bodyFat: Math.round(18 - m * 0.4)
    });
    
    // Member2: Moderate progress
    if (m % 2 === 0) {
      await storage.createBodyMeasurement({
        gymId, memberId: member2.id, recordedDate: measureDate,
        weight: Math.round(65000 - m * 300), height: 165,
        chest: Math.round(88 + m * 0.2), waist: Math.round(72 - m * 0.3)
      });
    }
  }

  // ===== MEMBER NOTES =====
  await storage.createMemberNote({ gymId, trainerId: trainer.id, memberId: member1.id, content: "Excellent form on deadlifts. Ready to increase weight next week." });
  await storage.createMemberNote({ gymId, trainerId: trainer.id, memberId: member1.id, content: "Mentioned mild shoulder discomfort. Recommend lighter overhead work." });
  await storage.createMemberNote({ gymId, trainerId: trainer.id, memberId: member2.id, content: "Needs motivation. Suggest group workout sessions." });
  await storage.createMemberNote({ gymId, trainerId: trainer.id, memberId: member3.id, content: "Struggling with consistency. Set up reminder system." });

  // ===== SOCIAL FEED POSTS (Various types over 14 days) =====
  // Valid types: workout_complete, streak_milestone, new_member, achievement, manual
  
  // New member posts
  await storage.createFeedPost({ gymId, userId: member4.id, type: "new_member", content: null, metadata: JSON.stringify({}) });
  await storage.createFeedPost({ gymId, userId: member5.id, type: "new_member", content: null, metadata: JSON.stringify({}) });
  
  // Workout completion posts
  for (let i = 7; i >= 0; i--) {
    if (Math.random() < 0.7) {
      await storage.createFeedPost({
        gymId, userId: member1.id, type: "workout_complete", content: null,
        metadata: JSON.stringify({ exerciseCount: 4, focusLabel: ["Push Day", "Pull Day", "Leg Day"][i % 3] })
      });
    }
    if (Math.random() < 0.5) {
      await storage.createFeedPost({
        gymId, userId: member2.id, type: "workout_complete", content: null,
        metadata: JSON.stringify({ exerciseCount: 3, focusLabel: ["Upper Body", "Lower Body"][i % 2] })
      });
    }
  }
  
  // Streak milestone posts
  await storage.createFeedPost({
    gymId, userId: member1.id, type: "streak_milestone", content: null,
    metadata: JSON.stringify({ streakDays: 50, milestoneType: "workouts" })
  });
  await storage.createFeedPost({
    gymId, userId: member1.id, type: "streak_milestone", content: null,
    metadata: JSON.stringify({ streakDays: 14 })
  });
  await storage.createFeedPost({
    gymId, userId: member2.id, type: "streak_milestone", content: null,
    metadata: JSON.stringify({ streakDays: 7 })
  });
  
  // Achievement posts
  await storage.createFeedPost({
    gymId, userId: member1.id, type: "achievement", content: null,
    metadata: JSON.stringify({ type: "personal_record", exercise: "Bench Press", value: "60kg" })
  });

  // Add reactions to feed posts
  const allPosts = await storage.getFeedPosts(gymId, 20);
  for (const post of allPosts.slice(0, 10)) {
    const reactions = ["like", "fire", "muscle", "clap"];
    const reactors = [member1, member2, member3, trainer, owner];
    
    for (const reactor of reactors) {
      if (reactor.id !== post.userId && Math.random() < 0.4) {
        await storage.addFeedReaction({
          postId: post.id,
          userId: reactor.id,
          reactionType: reactions[Math.floor(Math.random() * reactions.length)]
        });
      }
    }
  }

  // Add comments to some posts
  if (allPosts.length > 0) {
    await storage.addFeedComment({ postId: allPosts[0].id, userId: trainer.id, content: "Great work! Keep it up!" });
    await storage.addFeedComment({ postId: allPosts[0].id, userId: member2.id, content: "Inspiring!" });
  }
  if (allPosts.length > 2) {
    await storage.addFeedComment({ postId: allPosts[2].id, userId: owner.id, content: "Proud of your progress!" });
  }

  // ===== TOURNAMENTS =====
  // Active tournament
  const activeTournament = await storage.createTournament({
    gymId, createdByUserId: owner.id,
    name: "January Fitness Challenge",
    description: "Complete as many workouts as possible this month! Top 3 winners get prizes.",
    metricType: "workout_count",
    startDate: toDateStr(daysAgo(10)),
    endDate: toDateStr(daysFromNow(20)),
    status: "active",
    prizeDescription: "1st: 1 Month Free | 2nd: 50% Off | 3rd: Free T-Shirt",
    maxParticipants: 30,
    isPublic: true
  });
  await storage.joinTournament({ tournamentId: activeTournament.id, userId: member1.id, currentScore: 0 });
  await storage.joinTournament({ tournamentId: activeTournament.id, userId: member2.id, currentScore: 0 });
  await storage.joinTournament({ tournamentId: activeTournament.id, userId: member3.id, currentScore: 0 });
  await storage.joinTournament({ tournamentId: activeTournament.id, userId: member4.id, currentScore: 0 });
  await storage.updateTournamentScores(activeTournament.id);

  // Completed tournament
  const completedTournament = await storage.createTournament({
    gymId, createdByUserId: owner.id,
    name: "December Attendance Challenge",
    description: "Most gym attendance days wins!",
    metricType: "attendance_days",
    startDate: toDateStr(daysAgo(45)),
    endDate: toDateStr(daysAgo(15)),
    status: "completed",
    prizeDescription: "Gift Voucher Worth Rs. 2000",
    maxParticipants: 50,
    isPublic: true
  });
  await storage.joinTournament({ tournamentId: completedTournament.id, userId: member1.id, currentScore: 0 });
  await storage.joinTournament({ tournamentId: completedTournament.id, userId: member2.id, currentScore: 0 });
  await storage.updateTournamentScores(completedTournament.id);

  // Upcoming tournament
  const upcomingTournament = await storage.createTournament({
    gymId, createdByUserId: trainer.id,
    name: "February Exercise Marathon",
    description: "Complete the most total exercises across all your workouts!",
    metricType: "total_exercises",
    startDate: toDateStr(daysFromNow(15)),
    endDate: toDateStr(daysFromNow(45)),
    status: "upcoming",
    prizeDescription: "Personal Training Session + Protein Pack",
    maxParticipants: 25,
    isPublic: true
  });
  await storage.joinTournament({ tournamentId: upcomingTournament.id, userId: member1.id, currentScore: 0 });
  await storage.joinTournament({ tournamentId: upcomingTournament.id, userId: member2.id, currentScore: 0 });

  // ===== ANNOUNCEMENTS =====
  await storage.createAnnouncement({
    gymId, createdByOwnerId: owner.id,
    title: "New Year Schedule Changes",
    body: "Starting January 15th, we will have extended hours on weekends (7 AM - 10 PM). Happy New Year!",
    audience: "everyone"
  });
  await storage.createAnnouncement({
    gymId, createdByOwnerId: owner.id,
    title: "Equipment Maintenance",
    body: "The cable machines will be under maintenance on Thursday. Please plan accordingly.",
    audience: "everyone"
  });
  await storage.createAnnouncement({
    gymId, createdByOwnerId: owner.id,
    title: "Group HIIT Class This Saturday",
    body: "Join us for an intense HIIT session at 9 AM. All fitness levels welcome!",
    audience: "members"
  });

  // ===== WORKOUT TEMPLATES =====
  const template1 = await storage.createWorkoutTemplate({
    gymId, trainerId: trainer.id,
    name: "Beginner Full Body",
    cycleLength: 1,
    description: "Perfect for newcomers - covers all major muscle groups"
  });
  await storage.createWorkoutTemplateItems([
    { templateId: template1.id, dayIndex: 0, exerciseName: "Goblet Squat", sets: 3, reps: 12, weight: "10kg", orderIndex: 0, muscleType: "Legs", bodyPart: "Lower Body" },
    { templateId: template1.id, dayIndex: 0, exerciseName: "Push-ups", sets: 3, reps: 10, weight: "BW", orderIndex: 1, muscleType: "Chest", bodyPart: "Upper Body" },
    { templateId: template1.id, dayIndex: 0, exerciseName: "Lat Pulldown", sets: 3, reps: 12, weight: "30kg", orderIndex: 2, muscleType: "Back", bodyPart: "Upper Body" },
    { templateId: template1.id, dayIndex: 0, exerciseName: "Plank", sets: 3, reps: 30, weight: "BW", orderIndex: 3, muscleType: "Core", bodyPart: "Core" },
  ]);

  const template2 = await storage.createWorkoutTemplate({
    gymId, trainerId: trainer.id,
    name: "Intermediate PPL",
    cycleLength: 3,
    description: "Push-Pull-Legs split for intermediate lifters"
  });
  await storage.createWorkoutTemplateItems([
    { templateId: template2.id, dayIndex: 0, exerciseName: "Bench Press", sets: 4, reps: 8, weight: "50kg", orderIndex: 0, muscleType: "Chest", bodyPart: "Upper Body" },
    { templateId: template2.id, dayIndex: 0, exerciseName: "Overhead Press", sets: 3, reps: 10, weight: "25kg", orderIndex: 1, muscleType: "Shoulders", bodyPart: "Upper Body" },
    { templateId: template2.id, dayIndex: 1, exerciseName: "Deadlift", sets: 4, reps: 6, weight: "80kg", orderIndex: 0, muscleType: "Back", bodyPart: "Full Body" },
    { templateId: template2.id, dayIndex: 1, exerciseName: "Barbell Row", sets: 4, reps: 8, weight: "45kg", orderIndex: 1, muscleType: "Back", bodyPart: "Upper Body" },
    { templateId: template2.id, dayIndex: 2, exerciseName: "Squats", sets: 4, reps: 8, weight: "70kg", orderIndex: 0, muscleType: "Legs", bodyPart: "Lower Body" },
    { templateId: template2.id, dayIndex: 2, exerciseName: "Leg Press", sets: 3, reps: 12, weight: "100kg", orderIndex: 1, muscleType: "Legs", bodyPart: "Lower Body" },
  ]);

  console.log("=".repeat(60));
  console.log("COMPREHENSIVE DEMO DATA SEEDED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log("Gym Code: DEMO01");
  console.log("");
  console.log("Users (all passwords: password123):");
  console.log("  - owner    : Gym Owner with full access");
  console.log("  - trainer  : Primary trainer (5 members, 2 starred)");
  console.log("  - trainer2 : Secondary trainer (2 members)");
  console.log("  - member1  : Star member, very active (60 days history)");
  console.log("  - member2  : Star member, moderate activity");
  console.log("  - member3  : Inconsistent attendance");
  console.log("  - member4  : New member, no workout cycle");
  console.log("  - member5  : New member, minimal activity");
  console.log("");
  console.log("Features seeded:");
  console.log("  - Workout Points: 60+ days of completion data");
  console.log("  - Attendance: Mixed patterns (present/partial/missed)");
  console.log("  - Payments: 6 months history (paid/partial/unpaid)");
  console.log("  - Body Measurements: 6 months progress tracking");
  console.log("  - Social Feed: Workout posts, milestones, reactions, comments");
  console.log("  - Tournaments: 1 active, 1 completed, 1 upcoming");
  console.log("  - Announcements: 3 announcements with priorities");
  console.log("  - Templates: 2 workout templates ready to assign");
  console.log("  - Member Notes: Trainer notes on members");
  console.log("=".repeat(60));
}
