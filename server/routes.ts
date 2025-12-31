import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { nanoid } from "nanoid";
import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth (Passport + Session)
  setupAuth(app);

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      let gymId: number;

      if (input.role === 'owner') {
        if (!input.gymName) return res.status(400).json({ message: "Gym name required for owner" });
        // Create Gym
        const code = nanoid(6).toUpperCase();
        const gym = await storage.createGym({ name: input.gymName, code });
        gymId = gym.id;
      } else {
        if (!input.gymCode) return res.status(400).json({ message: "Gym code required for joining" });
        // Find Gym
        const gym = await storage.getGymByCode(input.gymCode);
        if (!gym) return res.status(400).json({ message: "Invalid gym code" });
        gymId = gym.id;
      }

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
        role: input.role,
        gymId: gymId
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after register" });
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    try {
      api.auth.login.input.parse(req.body);
    } catch (err) {
      return res.status(400).json({ message: "Invalid input" });
    }
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
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
  app.get(api.owner.getMembers.path, requireAuth, async (req, res) => {
    if (req.user!.role === 'member') return res.sendStatus(403); // Trainers can see members too? Spec says trainer sees *assigned* members. Owner sees all.
    // For simplicity, letting trainers see all members of gym for now or restricted. 
    // Spec: "Trainer: Can view members assigned to them".
    // I will restrict this endpoint to owner, or filter for trainer.
    
    if (req.user!.role === 'owner') {
      const members = await storage.getGymMembers(req.user!.gymId!);
      return res.json(members);
    }
    
    if (req.user!.role === 'trainer') {
       // Trainer sees assigned members
       const assignments = await storage.getTrainerMembers(req.user!.id);
       const memberIds = assignments.map(a => a.memberId);
       // Fetch member details (reuse getGymMembers but filter? Storage method needs update?
       // Let's just fetch all gym members and filter in code for MVP simplicity/speed
       const allMembers = await storage.getGymMembers(req.user!.gymId!);
       const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));
       return res.json(assignedMembers);
    }
    
    res.sendStatus(403);
  });

  app.get(api.owner.getTrainers.path, requireRole(['owner']), async (req, res) => {
    const trainers = await storage.getGymTrainers(req.user!.gymId!);
    res.json(trainers);
  });

  app.post(api.owner.assignTrainer.path, requireRole(['owner']), async (req, res) => {
    const input = api.owner.assignTrainer.input.parse(req.body);
    const assignment = await storage.assignTrainer(input.trainerId, input.memberId, req.user!.gymId!);
    res.status(201).json(assignment);
  });

  // === ATTENDANCE ROUTES ===
  app.get(api.attendance.list.path, requireAuth, async (req, res) => {
    // Filter logic based on role
    let memberId = req.query.memberId ? Number(req.query.memberId) : undefined;
    
    if (req.user!.role === 'member') {
      memberId = req.user!.id; // Force own ID
    }
    
    // Trainers: can they see all or only assigned? Spec: "Trainer: Can view attendance for assigned members only"
    // For MVP, if memberId is provided, check assignment? 
    // If no memberId provided, only return assigned members' attendance?
    
    const records = await storage.getAttendance(req.user!.gymId!, memberId, req.query.date as string);
    
    // Post-filter for trainers if needed (security)
    if (req.user!.role === 'trainer' && !memberId) {
       const assignments = await storage.getTrainerMembers(req.user!.id);
       const assignedIds = assignments.map(a => a.memberId);
       const filtered = records.filter(r => assignedIds.includes(r.memberId));
       return res.json(filtered);
    }

    res.json(records);
  });

  app.post(api.attendance.mark.path, requireAuth, async (req, res) => {
    if (req.user!.role === 'member') return res.sendStatus(403); // Members cannot mark attendance
    
    const input = api.attendance.mark.input.parse(req.body);
    
    // Trainers check assignment
    if (req.user!.role === 'trainer') {
      const assignments = await storage.getTrainerMembers(req.user!.id);
      if (!assignments.some(a => a.memberId === input.memberId)) {
        return res.status(403).json({ message: "Member not assigned to you" });
      }
    }

    const record = await storage.markAttendance({
      ...input,
      gymId: req.user!.gymId!,
      markedByUserId: req.user!.id
    });
    res.status(201).json(record);
  });

  // === PAYMENTS ROUTES ===
  app.get(api.payments.list.path, requireAuth, async (req, res) => {
    let memberId = req.query.memberId ? Number(req.query.memberId) : undefined;
    
    if (req.user!.role === 'member') {
      memberId = req.user!.id;
    }

    const records = await storage.getPayments(req.user!.gymId!, memberId, req.query.month as string);

    // Trainer filter
    if (req.user!.role === 'trainer' && !memberId) {
       const assignments = await storage.getTrainerMembers(req.user!.id);
       const assignedIds = assignments.map(a => a.memberId);
       const filtered = records.filter(r => assignedIds.includes(r.memberId));
       return res.json(filtered);
    }

    res.json(records);
  });

  app.post(api.payments.mark.path, requireRole(['owner']), async (req, res) => {
    const input = api.payments.mark.input.parse(req.body);
    const record = await storage.markPayment({
      ...input,
      gymId: req.user!.gymId!,
      updatedByUserId: req.user!.id
    });
    res.status(201).json(record);
  });

  // === WORKOUT ROUTES ===
  app.get(api.trainer.getCycles.path, requireRole(['trainer']), async (req, res) => {
    const cycles = await storage.getTrainerCycles(req.user!.id);
    res.json(cycles);
  });

  app.post(api.trainer.createCycle.path, requireRole(['trainer']), async (req, res) => {
    const input = api.trainer.createCycle.input.parse(req.body);
    const cycle = await storage.createWorkoutCycle({
      ...input,
      gymId: req.user!.gymId!,
      trainerId: req.user!.id
    });
    res.status(201).json(cycle);
  });

  app.post(api.trainer.addWorkout.path, requireRole(['trainer']), async (req, res) => {
    const input = api.trainer.addWorkout.input.parse(req.body);
    const cycle = await storage.getCycle(input.cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const workout = await storage.addWorkout(input);
    res.status(201).json(workout);
  });

  app.get(api.member.getCycle.path, requireRole(['member']), async (req, res) => {
    const cycle = await storage.getMemberCycle(req.user!.id);
    if (!cycle) return res.json(null);
    const workouts = await storage.getWorkoutsByCycle(cycle.id);
    res.json({ cycle, workouts });
  });

  app.post(api.member.completeWorkout.path, requireRole(['member']), async (req, res) => {
    const input = api.member.completeWorkout.input.parse(req.body);
    const completion = await storage.completeWorkout({
      ...input,
      memberId: req.user!.id
    });
    res.status(201).json(completion);
  });

  // Seed Data function (internal use or via special endpoint if needed, but easier to just call it)
  // We'll call it once server starts in index.ts or here if table empty.
  // Actually, let's just create a quick endpoint for demo setup or auto-seed on first request to login?
  // Better: Check in this file at the end of registerRoutes if we should seed.
  await seedDemoData();

  return httpServer;
}

async function seedDemoData() {
  const existingGym = await storage.getGymByCode("DEMO123");
  if (existingGym) return; // Already seeded

  console.log("Seeding demo data...");
  const gym = await storage.createGym({ name: "OGym Demo", code: "DEMO123" });
  const gymId = gym.id;

  const password = await hashPassword("password123");

  // Owner
  const owner = await storage.createUser({
    username: "owner", password, role: "owner", gymId
  });

  // Trainer
  const trainer = await storage.createUser({
    username: "trainer", password, role: "trainer", gymId
  });

  // Members
  const m1 = await storage.createUser({
    username: "member1", password, role: "member", gymId
  });
  const m2 = await storage.createUser({
    username: "member2", password, role: "member", gymId
  });

  // Assign trainer
  await storage.assignTrainer(trainer.id, m1.id, gymId);
  await storage.assignTrainer(trainer.id, m2.id, gymId);

  // Attendance
  await storage.markAttendance({
    gymId, memberId: m1.id, markedByUserId: owner.id, date: "2024-01-01", status: "present"
  });

  // Payment
  await storage.markPayment({
    gymId, memberId: m1.id, month: "2024-01", amountDue: 5000, amountPaid: 5000, status: "paid", note: "January fee"
  });

  console.log("Seeding complete. Use gym code DEMO123 to join.");
}
