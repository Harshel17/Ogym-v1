import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";
import passport from "passport";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import { generateOTP, getOTPExpiryTime, sendVerificationEmail, sendKioskOtpEmail } from "./email";
import { db } from "./db";
import { workoutLogs, workoutLogExercises } from "@shared/schema";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { getLocalDate } from "./timezone";

function getAdminJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: SESSION_SECRET environment variable is required for admin JWT in production");
  }
  return secret || "dev-only-admin-jwt-secret";
}
const ADMIN_JWT_SECRET = getAdminJwtSecret();

/**
 * Email Verification Control
 * 
 * In development: Can be disabled for testing with DISABLE_EMAIL_VERIFICATION=true
 * In production: MUST always be enabled (throws error if bypass attempted)
 */
const DISABLE_EMAIL_VERIFICATION = (() => {
  const isDisabled = process.env.DISABLE_EMAIL_VERIFICATION === "true";
  if (isDisabled && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: Email verification cannot be disabled in production. Remove DISABLE_EMAIL_VERIFICATION env var.");
  }
  return isDisabled;
})();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: { message: "Please wait 60 seconds before requesting another code." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Kiosk rate limiters to prevent spam
const kioskOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { message: "Too many OTP requests. Please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

const kioskSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many submissions. Please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // === AUTH ROUTES ===
  
  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        username: z.string()
          .min(4, "Username must be at least 4 characters")
          .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
        email: z.string().email("Invalid email format"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        role: z.enum(["owner", "trainer", "member"]),
        gymCode: z.string().optional(),
      }).refine((data) => {
        if (data.role === "trainer") {
          return data.gymCode && data.gymCode.length > 0;
        }
        return true;
      }, {
        message: "Gym code is required for trainers",
        path: ["gymCode"],
      });
      
      const input = schema.parse(req.body);
      
      const existingUserByUsername = await storage.getUserByUsername(input.username.toLowerCase());
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already taken. Please choose another." });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(input.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      let gym = null;
      if (input.role !== "owner" && input.gymCode) {
        gym = await storage.getGymByCode(input.gymCode.toUpperCase());
        if (!gym) {
          return res.status(400).json({ message: "Invalid gym code" });
        }
      }

      const hashedPassword = await hashPassword(input.password);

      // TEMPORARY DEV MODE: If email verification is disabled, auto-verify the user
      const shouldBypassVerification = DISABLE_EMAIL_VERIFICATION;

      const user = await storage.createUser({
        username: input.username.toLowerCase(),
        email: input.email,
        password: hashedPassword,
        role: input.role,
        gymId: null,
        emailVerified: shouldBypassVerification, // Auto-verify if bypass enabled
      });

      // Only generate and send OTP if email verification is NOT bypassed
      if (!shouldBypassVerification) {
        const verificationCode = generateOTP();
        const verificationExpiresAt = getOTPExpiryTime();
        await storage.updateUserVerificationCode(user.id, verificationCode, verificationExpiresAt);
        console.log(`[EMAIL] Attempting to send verification email to ${input.email}`);
        const emailSent = await sendVerificationEmail(input.email, verificationCode);
        console.log(`[EMAIL] Verification email to ${input.email}: ${emailSent ? 'SUCCESS' : 'FAILED'}`);
      }

      if (input.role !== "owner" && gym) {
        await storage.createJoinRequest({
          userId: user.id,
          gymId: gym.id,
        });
      }

      // TEMPORARY DEV MODE: Different response based on bypass status
      if (shouldBypassVerification) {
        res.status(201).json({ 
          message: "Registration successful. You can now log in.",
          email: input.email,
          requiresVerification: false,
        });
      } else {
        res.status(201).json({ 
          message: "Registration successful. Please verify your email.",
          email: input.email,
          requiresVerification: true,
        });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Registration error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/verify-email", authRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        code: z.string().length(6, "Verification code must be 6 digits"),
      });
      const input = schema.parse(req.body);

      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      if (!user.verificationCode || !user.verificationExpiresAt) {
        return res.status(400).json({ message: "No verification code found. Please request a new one." });
      }

      if (new Date() > new Date(user.verificationExpiresAt)) {
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      if (user.verificationCode !== input.code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      await storage.verifyUserEmail(user.id);

      req.login(user, async (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after verification" });
        }
        const fullUser = await storage.getUser(user.id);
        return res.status(200).json({ 
          message: "Email verified successfully",
          user: fullUser,
        });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Verification error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/resend-code", resendRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });
      const input = schema.parse(req.body);

      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(200).json({ message: "If this email exists, a new code has been sent." });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      const verificationCode = generateOTP();
      const verificationExpiresAt = getOTPExpiryTime();

      await storage.updateUserVerificationCode(user.id, verificationCode, verificationExpiresAt);
      await sendVerificationEmail(input.email, verificationCode);

      res.status(200).json({ message: "Verification code sent successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Resend code error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(1, "Password is required"),
      });
      const input = schema.parse(req.body);

      const user = await storage.getUserByEmail(input.email);
      if (!user || !(await comparePasswords(input.password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // TEMPORARY DEV MODE: Skip email verification check if bypass is enabled
      if (!user.emailVerified && !DISABLE_EMAIL_VERIFICATION) {
        const verificationCode = generateOTP();
        const verificationExpiresAt = getOTPExpiryTime();
        await storage.updateUserVerificationCode(user.id, verificationCode, verificationExpiresAt);
        await sendVerificationEmail(input.email, verificationCode);
        
        return res.status(403).json({ 
          message: "Please verify your email first. A new verification code has been sent.",
          requiresVerification: true,
          email: input.email,
        });
      }

      req.login(user, async (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        const fullUser = await storage.getUser(user.id);
        
        // Include subscription status in login response
        let subscriptionStatus = null;
        if (fullUser?.gymId) {
          subscriptionStatus = await storage.checkGymSubscriptionStatus(fullUser.gymId);
        }
        
        return res.status(200).json({
          ...fullUser,
          subscriptionStatus
        });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Login error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
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
    
    // If user has a gym, check subscription status
    let subscriptionStatus = null;
    if (user?.gymId) {
      subscriptionStatus = await storage.checkGymSubscriptionStatus(user.gymId);
    }
    
    res.json({
      ...user,
      subscriptionStatus
    });
  });

  // Rate limiter for forgot password (stricter: 3 per 15 minutes per IP)
  const forgotPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { message: "Too many password reset attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/auth/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email("Invalid email format"),
      });
      const input = schema.parse(req.body);
      const email = input.email.toLowerCase();

      // Check if user exists (silently - don't reveal to client)
      const user = await storage.getUserByEmail(email);
      
      if (user) {
        // Invalidate any existing reset codes for this email
        await storage.invalidatePasswordResetCodes(email);
        
        // Generate and hash OTP
        const otp = generateOTP();
        const { hashPassword } = await import("./auth");
        const codeHash = await hashPassword(otp);
        const expiresAt = getOTPExpiryTime();
        
        // Store the reset code
        await storage.createPasswordResetCode(email, codeHash, expiresAt);
        
        // Send email with the code
        const { sendPasswordResetEmail } = await import("./email");
        await sendPasswordResetEmail(email, otp);
      }
      
      // Always return success to prevent user enumeration
      res.status(200).json({ 
        message: "If an account exists with this email, you will receive a password reset code." 
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", authRateLimiter, async (req, res) => {
    try {
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      const schema = z.object({
        email: z.string().email("Invalid email format"),
        otp: z.string().length(6, "OTP must be 6 digits"),
        newPassword: z.string()
          .min(8, "Password must be at least 8 characters")
          .regex(passwordRegex, "Password must contain at least 1 letter and 1 number"),
      });
      
      const input = schema.parse(req.body);
      const email = input.email.toLowerCase();

      // Get valid reset code
      const resetCode = await storage.getValidPasswordResetCode(email);
      if (!resetCode) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      // Verify OTP
      const { comparePasswords, hashPassword } = await import("./auth");
      const isValid = await comparePasswords(input.otp, resetCode.codeHash);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      // Get the user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(input.newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);

      // Mark reset code as used and invalidate any others
      await storage.markPasswordResetCodeUsed(resetCode.id);
      await storage.invalidatePasswordResetCodes(email);

      res.status(200).json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
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
    const startTime = Date.now();
    console.log(`[members-details] Starting query for gym ${req.user!.gymId}`);
    try {
      const members = await storage.getMembersWithDetails(req.user!.gymId!);
      console.log(`[members-details] Completed in ${Date.now() - startTime}ms, returned ${members.length} members`);
      res.json(members);
    } catch (error) {
      console.error(`[members-details] Failed after ${Date.now() - startTime}ms:`, error);
      throw error;
    }
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
    
    const today = getLocalDate(req);
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

  // Allow members to mark past attendance (for missed days where they actually went to gym)
  app.post("/api/attendance/mark-past", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    });
    const input = schema.parse(req.body);
    
    const today = getLocalDate(req);
    // Only allow marking past dates (not future, not more than 7 days ago)
    if (input.date >= today) {
      return res.status(400).json({ message: "Can only mark past dates as attended" });
    }
    
    // Calculate 7 days ago from client's local date
    const todayDate = new Date(today + 'T00:00:00');
    todayDate.setDate(todayDate.getDate() - 7);
    const minDate = todayDate.toISOString().split("T")[0];
    if (input.date < minDate) {
      return res.status(400).json({ message: "Can only mark attendance for the last 7 days" });
    }
    
    // Check if already marked
    const existing = await storage.getAttendanceByMemberDate(req.user!.id, input.date);
    if (existing && existing.status === "present") {
      return res.json(existing);
    }
    
    const record = await storage.markAttendance({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      date: input.date,
      status: "present",
      verifiedMethod: "manual",
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

  // Get all gym transactions with optional method and date filters
  app.get("/api/owner/transactions", requireRole(["owner"]), async (req, res) => {
    const method = req.query.method as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const transactions = await storage.getAllGymTransactions(req.user!.gymId!, method, startDate, endDate);
    res.json(transactions);
  });

  // Get payment method summary with optional date filters
  app.get("/api/owner/transactions/summary", requireRole(["owner"]), async (req, res) => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const summary = await storage.getPaymentMethodSummary(req.user!.gymId!, startDate, endDate);
    res.json(summary);
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

  // Members needing subscription
  app.get("/api/owner/members-need-subscription", requireRole(["owner"]), async (req, res) => {
    const members = await storage.getMembersNeedingSubscription(req.user!.gymId!);
    res.json(members);
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

  app.get("/api/trainer/new-members", requireRole(["trainer"]), async (req, res) => {
    try {
      const assignments = await storage.getTrainerMembers(req.user!.id);
      const memberIds = assignments.map(a => a.memberId);
      const allMembers = await storage.getGymMembers(req.user!.gymId!);
      const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));
      
      const cycles = await storage.getTrainerCycles(req.user!.id);
      const membersWithCycles = new Set(cycles.map((c: any) => c.memberId));
      
      const newMembers = assignedMembers.filter(m => !membersWithCycles.has(m.id));
      res.json(newMembers);
    } catch (err) {
      console.error("Error fetching new members:", err);
      res.status(500).json({ message: "Failed to fetch new members" });
    }
  });

  app.get("/api/trainer/cycles", requireRole(["trainer"]), async (req, res) => {
    const cycles = await storage.getTrainerCycles(req.user!.id);
    res.json(cycles);
  });

  app.get("/api/trainer/active-phases", requireRole(["trainer"]), async (req, res) => {
    try {
      const assignments = await storage.getTrainerMembers(req.user!.id);
      const memberIds = assignments.map(a => a.memberId);
      const today = getLocalDate(req);
      const gymId = req.user!.gymId!;
      
      const activePhases: any[] = [];
      for (const memberId of memberIds) {
        const phases = await storage.getTrainingPhases(gymId, memberId);
        const active = phases.find((p: any) => 
          p.startDate <= today && p.endDate >= today && p.useCustomExercises
        );
        if (active) {
          activePhases.push(active);
        }
      }
      
      res.json(activePhases);
    } catch (err) {
      console.error("Error fetching active phases:", err);
      res.status(500).json({ message: "Failed to fetch active phases" });
    }
  });

  app.get("/api/trainer/phases/:phaseId/exercises", requireRole(["trainer"]), async (req, res) => {
    try {
      const phaseId = parseInt(req.params.phaseId);
      const phase = await storage.getTrainingPhase(phaseId);
      
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }
      
      const assignments = await storage.getTrainerMembers(req.user!.id);
      if (!assignments.some(a => a.memberId === phase.memberId)) {
        return res.status(403).json({ message: "Not authorized to view this phase" });
      }
      
      const exercises = await storage.getPhaseExercises(phaseId);
      res.json(exercises);
    } catch (err) {
      console.error("Error fetching phase exercises:", err);
      res.status(500).json({ message: "Failed to fetch phase exercises" });
    }
  });

  app.get("/api/trainer/members/:memberId/workouts", requireRole(["trainer"]), async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const gymId = req.user!.gymId!;
      
      const assignments = await storage.getTrainerMembers(req.user!.id);
      if (!assignments.some(a => a.memberId === memberId)) {
        return res.status(403).json({ message: "Member not assigned to you" });
      }
      
      // Only show gym-assigned cycles (source='trainer'), not personal workouts
      const cycle = await storage.getMemberCycle(memberId, 'trainer');
      let cycleItems: any[] = [];
      if (cycle) {
        cycleItems = await storage.getWorkoutItems(cycle.id);
      }
      
      const phases = await storage.getTrainingPhases(gymId, memberId);
      const phasesWithExercises = await Promise.all(phases.map(async (phase) => {
        const exercises = await storage.getPhaseExercises(phase.id);
        return { ...phase, exercises };
      }));
      
      const today = getLocalDate(req);
      const activePhase = phasesWithExercises.find(p => 
        p.startDate <= today && p.endDate >= today && p.useCustomExercises
      );
      
      res.json({
        cycle: cycle ? { ...cycle, items: cycleItems } : null,
        phases: phasesWithExercises,
        activePhase: activePhase || null
      });
    } catch (err) {
      console.error("Error fetching member workouts:", err);
      res.status(500).json({ message: "Failed to fetch member workouts" });
    }
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

  // Add a new day to a cycle
  app.post("/api/trainer/cycles/:cycleId/add-day", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const schema = z.object({
      dayLabel: z.string().optional().default(""),
      position: z.number().min(0).optional() // Position to insert at. If not provided, adds at end
    });
    const input = schema.parse(req.body);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    if (cycle.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized for this gym" });
    }
    
    const newLength = cycle.cycleLength + 1;
    const position = input.position !== undefined ? Math.min(input.position, cycle.cycleLength) : cycle.cycleLength;
    
    // If inserting in the middle, shift existing workout items
    if (position < cycle.cycleLength) {
      await storage.shiftWorkoutItemsDays(cycleId, position, 1);
    }
    
    // Update day labels array
    const currentLabels = cycle.dayLabels || Array.from({ length: cycle.cycleLength }, () => "");
    const newLabels = [...currentLabels];
    newLabels.splice(position, 0, input.dayLabel);
    
    // Update rest days array (shift indices >= position)
    const currentRestDays = cycle.restDays || [];
    const newRestDays = currentRestDays.map(d => d >= position ? d + 1 : d);
    
    const updated = await storage.updateCycleStructure(cycleId, newLength, newLabels, newRestDays);
    res.json(updated);
  });

  // Remove a day from a cycle
  app.delete("/api/trainer/cycles/:cycleId/remove-day/:dayIndex", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const dayIndex = parseInt(req.params.dayIndex);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    if (cycle.gymId !== req.user!.gymId) {
      return res.status(403).json({ message: "Not authorized for this gym" });
    }
    
    if (cycle.cycleLength <= 1) {
      return res.status(400).json({ message: "Cannot remove the last day from a cycle" });
    }
    
    if (dayIndex < 0 || dayIndex >= cycle.cycleLength) {
      return res.status(400).json({ message: "Invalid day index" });
    }
    
    // Delete all workout items for this day
    await storage.deleteWorkoutItemsByDay(cycleId, dayIndex);
    
    // Shift remaining workout items
    await storage.shiftWorkoutItemsDays(cycleId, dayIndex + 1, -1);
    
    const newLength = cycle.cycleLength - 1;
    
    // Update day labels array
    const currentLabels = cycle.dayLabels || Array.from({ length: cycle.cycleLength }, () => "");
    const newLabels = [...currentLabels];
    newLabels.splice(dayIndex, 1);
    
    // Update rest days array (remove this day and shift indices > dayIndex)
    const currentRestDays = cycle.restDays || [];
    const newRestDays = currentRestDays
      .filter(d => d !== dayIndex)
      .map(d => d > dayIndex ? d - 1 : d);
    
    const updated = await storage.updateCycleStructure(cycleId, newLength, newLabels, newRestDays);
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
    const bodyParts = ["Upper Body", "Lower Body", "Full Body", "Recovery"] as const;
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

  // Per-set targets for workout items
  app.get("/api/trainer/cycles/:cycleId/items/:itemId/sets", requireRole(["trainer"]), async (req, res) => {
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
    
    const sets = await storage.getWorkoutPlanSets(itemId);
    res.json(sets);
  });

  app.post("/api/trainer/cycles/:cycleId/items/:itemId/sets", requireRole(["trainer"]), async (req, res) => {
    const cycleId = parseInt(req.params.cycleId);
    const itemId = parseInt(req.params.itemId);
    
    const schema = z.object({
      sets: z.array(z.object({
        setNumber: z.number().min(1),
        targetReps: z.number().min(1),
        targetWeight: z.string().optional().nullable()
      }))
    });
    const input = schema.parse(req.body);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.trainerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const item = await storage.getWorkoutItem(itemId);
    if (!item || item.cycleId !== cycleId) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    // Delete existing sets for this item and create new ones
    await storage.deleteWorkoutPlanSetsByItem(itemId);
    
    const newSets = await storage.createWorkoutPlanSets(
      input.sets.map(s => ({
        workoutItemId: itemId,
        setNumber: s.setNumber,
        targetReps: s.targetReps,
        targetWeight: s.targetWeight ?? null
      }))
    );
    
    res.status(201).json(newSets);
  });

  app.patch("/api/trainer/plan-sets/:setId", requireRole(["trainer"]), async (req, res) => {
    const setId = parseInt(req.params.setId);
    
    const schema = z.object({
      targetReps: z.number().min(1).optional(),
      targetWeight: z.string().optional().nullable()
    });
    const input = schema.parse(req.body);
    
    const updated = await storage.updateWorkoutPlanSet(setId, input);
    res.json(updated);
  });

  app.delete("/api/trainer/plan-sets/:setId", requireRole(["trainer"]), async (req, res) => {
    const setId = parseInt(req.params.setId);
    await storage.deleteWorkoutPlanSet(setId);
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
    // Check for active phase with custom exercises first
    const activePhase = await storage.getActivePhaseForMember(req.user!.id, req.user!.gymId!);
    if (activePhase && activePhase.useCustomExercises) {
      const phaseExercises = await storage.getPhaseExercises(activePhase.id);
      // Return phase data formatted like a cycle
      return res.json({
        id: activePhase.id,
        name: activePhase.name,
        cycleLength: activePhase.cycleLength || 3,
        dayLabels: activePhase.dayLabels || [],
        restDays: activePhase.restDays || [],
        startDate: activePhase.startDate,
        endDate: activePhase.endDate,
        progressionMode: "calendar",
        currentDayIndex: 0,
        isPhase: true,
        items: phaseExercises.map(ex => ({
          id: ex.id,
          cycleId: activePhase.id,
          dayIndex: ex.dayIndex,
          muscleType: ex.muscleType,
          bodyPart: ex.bodyPart,
          exerciseName: ex.exerciseName,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          orderIndex: ex.orderIndex
        }))
      });
    }
    
    // Use appropriate source based on whether user has a gym
    const source = req.user!.gymId ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    if (!cycle) return res.json(null);
    const items = await storage.getWorkoutItems(cycle.id);
    res.json({ ...cycle, items });
  });

  app.get("/api/workouts/today", requireRole(["member"]), async (req, res) => {
    // Personal Mode members don't have phases - skip to cycle check
    if (!req.user!.gymId) {
      const source = 'self' as const;
      const cycle = await storage.getMemberCycle(req.user!.id, source);
      if (!cycle) {
        return res.json({ items: [], currentDayIndex: 0, cycleId: null, cycleName: null, dayLabel: null, isRestDay: true });
      }
      
      const allItems = await storage.getWorkoutItems(cycle.id);
      const todayStr = getLocalDate(req);
      const completions = await storage.getCompletions(req.user!.id, todayStr);
      const completedItemIds = new Set(completions.filter(c => c.status === 'completed').map(c => c.workoutItemId));
      const skippedItemIds = new Set(completions.filter(c => c.status === 'skipped').map(c => c.workoutItemId));
      
      const currentDayIndex = cycle.currentDayIndex ?? 0;
      const todayItems = allItems.filter(item => item.dayIndex === currentDayIndex);
      const dayLabel = cycle.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
      
      // Check if this is a rest day (from restDays array, day label, or no exercises)
      const isRestDay = (cycle.restDays?.includes(currentDayIndex)) || 
                        (dayLabel?.toLowerCase().includes("rest")) || 
                        todayItems.length === 0;
      
      // Check if day was manually marked as done (Personal Mode - gymId is null)
      const session = await storage.getWorkoutSessionByMemberDate(null, req.user!.id, todayStr);
      const dayManuallyCompleted = session?.isManuallyCompleted === true;
      
      return res.json({
        items: todayItems.map(item => ({
          ...item,
          completed: dayManuallyCompleted || completedItemIds.has(item.id),
          skipped: skippedItemIds.has(item.id)
        })),
        currentDayIndex,
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleLength: cycle.cycleLength,
        dayLabel,
        isRestDay,
        progressionMode: cycle.progressionMode,
        dayManuallyCompleted
      });
    }
    
    // Check for active phase with custom exercises first (gym members only)
    const activePhase = await storage.getActivePhaseForMember(req.user!.id, req.user!.gymId!);
    if (activePhase && activePhase.useCustomExercises) {
      const todayStr = getLocalDate(req);
      const today = new Date(todayStr + 'T00:00:00');
      const startDate = new Date(activePhase.startDate);
      const cycleLength = activePhase.cycleLength || 3;
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycleLength : 0;
      
      const phaseExercises = await storage.getPhaseExercises(activePhase.id);
      const todayExercises = phaseExercises.filter(ex => ex.dayIndex === currentDayIndex);
      
      // Get completions for today (use negative IDs to distinguish phase exercises)
      const completions = await storage.getCompletions(req.user!.id, todayStr);
      const completedNames = new Set(completions.map(c => c.exerciseName));
      
      const itemsWithStatus = todayExercises.map(ex => ({
        id: ex.id,
        cycleId: activePhase.id,
        dayIndex: ex.dayIndex,
        muscleType: ex.muscleType,
        bodyPart: ex.bodyPart,
        exerciseName: ex.exerciseName,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        orderIndex: ex.orderIndex,
        completed: completedNames.has(ex.exerciseName)
      }));
      
      const dayLabel = activePhase.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
      const isRestDay = activePhase.restDays?.includes(currentDayIndex) || todayExercises.length === 0;
      
      return res.json({
        items: itemsWithStatus,
        dayIndex: currentDayIndex,
        dayLabel,
        isRestDay,
        cycleLength,
        cycleName: activePhase.name,
        isPhase: true,
        phaseId: activePhase.id,
        progressionMode: "calendar"
      });
    }
    
    // Use appropriate source based on whether user has a gym
    const source = req.user!.gymId ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    if (!cycle) return res.json({ items: [], message: "No active workout cycle" });
    
    const todayStr = getLocalDate(req);
    const today = new Date(todayStr + 'T00:00:00');
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
    // Use appropriate source based on whether user has a gym
    const source = req.user!.gymId ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    if (!cycle) return res.status(400).json({ message: "No active workout cycle" });
    
    if (cycle.progressionMode !== "completion") {
      return res.status(400).json({ message: "Cycle uses calendar-based progression" });
    }
    
    const newDayIndex = ((cycle.currentDayIndex ?? 0) + 1) % cycle.cycleLength;
    const todayStr = getLocalDate(req);
    await storage.updateCycleDayIndexAndLastWorkout(cycle.id, newDayIndex, todayStr);
    
    res.json({ message: "Day advanced", newDayIndex });
  });

  app.post("/api/workouts/rest-day-swap", requireRole(["member"]), async (req, res) => {
    // Use appropriate source based on whether user has a gym
    const source = req.user!.gymId ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    if (!cycle) return res.status(400).json({ message: "No active workout cycle" });
    
    const todayStr = getLocalDate(req);
    const today = new Date(todayStr + 'T00:00:00');
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
      actualWeight: z.string().optional(),
      clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    });
    const input = schema.parse(req.body);
    
    const item = await storage.getWorkoutItem(input.workoutItemId);
    if (!item) return res.status(404).json({ message: "Workout item not found" });
    
    const cycle = await storage.getCycle(item.cycleId);
    if (!cycle || cycle.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not your workout" });
    }
    
    // Use client's local date from header (preferred) or body, with server fallback
    const today = input.clientDate || getLocalDate(req);
    
    const existing = await storage.getCompletionByItemDate(input.workoutItemId, req.user!.id, today);
    if (existing) {
      return res.json({ message: "Already completed", id: existing.id });
    }
    
    const completion = await storage.completeWorkout({
      gymId: req.user!.gymId || null,
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

  // Complete a phase exercise
  app.post("/api/workouts/complete-phase", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ 
      phaseExerciseId: z.number(),
      actualSets: z.number().optional(),
      actualReps: z.number().optional(),
      actualWeight: z.string().optional(),
      clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    });
    const input = schema.parse(req.body);
    
    // Get the phase exercise
    const phaseExercise = await storage.getPhaseExercise(input.phaseExerciseId);
    if (!phaseExercise) {
      return res.status(404).json({ message: "Phase exercise not found" });
    }
    
    // Verify the phase belongs to this member
    const phase = await storage.getTrainingPhaseById(phaseExercise.phaseId);
    if (!phase || phase.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not your workout" });
    }
    
    // Use client's local date from header (preferred) or body, with server fallback
    const today = input.clientDate || getLocalDate(req);
    
    // Check for existing completion by exercise name for today
    const completions = await storage.getCompletions(req.user!.id, today);
    const existingByName = completions.find(c => c.exerciseName === phaseExercise.exerciseName);
    if (existingByName) {
      return res.json({ message: "Already completed", id: existingByName.id });
    }
    
    // Create a completion record for phase exercise
    const completion = await storage.completePhaseExercise({
      gymId: req.user!.gymId!,
      phaseExerciseId: input.phaseExerciseId,
      memberId: req.user!.id,
      completedDate: today,
      exerciseName: phaseExercise.exerciseName,
      actualSets: input.actualSets || phaseExercise.sets,
      actualReps: input.actualReps || phaseExercise.reps,
      actualWeight: input.actualWeight || phaseExercise.weight
    });
    
    // Calculate current day index for session
    const startDate = new Date(phase.startDate);
    const todayDate = new Date(today);
    const cycleLength = phase.cycleLength || 3;
    const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycleLength : 0;
    
    // Get focus label from phase
    const phaseExercises = await storage.getPhaseExercises(phase.id);
    const todayExercises = phaseExercises.filter(ex => ex.dayIndex === currentDayIndex);
    const muscleTypes = [...new Set(todayExercises.map(i => i.muscleType).filter(Boolean))];
    const focusLabel = muscleTypes.join(" + ") || phase.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
    
    // Create/update workout session
    const session = await storage.getOrCreateWorkoutSession({
      gymId: req.user!.gymId!,
      memberId: req.user!.id,
      date: today,
      cycleId: phase.id,
      cycleDayIndex: currentDayIndex,
      focusLabel
    });
    
    // Add exercise to session
    await storage.addWorkoutSessionExercise({
      sessionId: session.id,
      exerciseName: phaseExercise.exerciseName,
      sets: input.actualSets || phaseExercise.sets,
      reps: input.actualReps || phaseExercise.reps,
      weight: input.actualWeight || phaseExercise.weight || null
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
    
    // Check if we should ask user to share on feed
    let askToShare = false;
    try {
      const user = await storage.getUser(req.user!.id);
      if (user?.autoPostEnabled !== false) {
        const todayCompletions = await storage.getCompletions(req.user!.id, today);
        if (todayCompletions.length === 1) {
          askToShare = true;
        }
      }
    } catch (feedErr) {
      console.error("Error checking feed post status:", feedErr);
    }
    
    res.status(201).json({ ...completion, askToShare, focusLabel });
  });

  // Complete all phase exercises for today
  app.post("/api/workouts/complete-phase-all", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ 
      phaseExerciseIds: z.array(z.number()),
      clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    });
    const input = schema.parse(req.body);
    
    // Use client's local date from header (preferred) or body, with server fallback
    const today = input.clientDate || getLocalDate(req);
    const completions = [];
    let session: any = null;
    let phase: any = null;
    
    for (const phaseExerciseId of input.phaseExerciseIds) {
      const phaseExercise = await storage.getPhaseExercise(phaseExerciseId);
      if (!phaseExercise) continue;
      
      if (!phase) {
        phase = await storage.getTrainingPhaseById(phaseExercise.phaseId);
        if (!phase || phase.memberId !== req.user!.id) continue;
      }
      
      // Check if already completed by exercise name
      const existingCompletions = await storage.getCompletions(req.user!.id, today);
      const alreadyDone = existingCompletions.find(c => c.exerciseName === phaseExercise.exerciseName);
      if (alreadyDone) continue;
      
      const completion = await storage.completePhaseExercise({
        gymId: req.user!.gymId!,
        phaseExerciseId: phaseExerciseId,
        memberId: req.user!.id,
        completedDate: today,
        exerciseName: phaseExercise.exerciseName,
        actualSets: phaseExercise.sets,
        actualReps: phaseExercise.reps,
        actualWeight: phaseExercise.weight
      });
      completions.push(completion);
      
      // Create workout session on first completion
      if (!session && phase) {
        const startDate = new Date(phase.startDate);
        const todayDate = new Date(today);
        const cycleLength = phase.cycleLength || 3;
        const daysDiff = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentDayIndex = daysDiff % cycleLength;
        
        const phaseExercises = await storage.getPhaseExercises(phase.id);
        const todayExercises = phaseExercises.filter(ex => ex.dayIndex === currentDayIndex);
        const muscleTypes = [...new Set(todayExercises.map(i => i.muscleType).filter(Boolean))];
        const focusLabel = muscleTypes.join(" + ") || phase.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
        
        session = await storage.getOrCreateWorkoutSession({
          gymId: req.user!.gymId!,
          memberId: req.user!.id,
          date: today,
          cycleId: phase.id,
          cycleDayIndex: currentDayIndex,
          focusLabel
        });
      }
      
      // Add exercise to session
      if (session) {
        await storage.addWorkoutSessionExercise({
          sessionId: session.id,
          exerciseName: phaseExercise.exerciseName,
          sets: phaseExercise.sets,
          reps: phaseExercise.reps,
          weight: phaseExercise.weight || null
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
    
    res.status(201).json({ completed: completions.length, total: input.phaseExerciseIds.length });
  });

  app.post("/api/workouts/complete-all", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ 
      workoutItemIds: z.array(z.number()),
      clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    });
    const input = schema.parse(req.body);
    
    // Use client's local date from header (preferred) or body, with server fallback
    const today = input.clientDate || getLocalDate(req);
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

  // === PER-SET WORKOUT LOGGING ===
  // Get plan sets for a workout item (member view)
  app.get("/api/workouts/items/:itemId/plan-sets", requireRole(["member"]), async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    const item = await storage.getWorkoutItem(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    const cycle = await storage.getCycle(item.cycleId);
    if (!cycle || cycle.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not your workout" });
    }
    
    const planSets = await storage.getWorkoutPlanSets(itemId);
    res.json(planSets);
  });

  // Get detailed workout log for a date
  app.get("/api/workouts/log/:date", requireRole(["member"]), async (req, res) => {
    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
    const result = dateSchema.safeParse(req.params.date);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }
    
    const log = await storage.getDetailedWorkoutLog(req.user!.gymId!, req.user!.id, req.params.date);
    res.json(log);
  });

  // Log per-set workout completion
  app.post("/api/workouts/log-sets", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      workoutItemId: z.number(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sets: z.array(z.object({
        setNumber: z.number().min(1),
        targetReps: z.number().optional(),
        targetWeight: z.string().optional().nullable(),
        actualReps: z.number().optional(),
        actualWeight: z.string().optional().nullable(),
        completed: z.boolean().default(false)
      }))
    });
    const input = schema.parse(req.body);
    
    const item = await storage.getWorkoutItem(input.workoutItemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    const cycle = await storage.getCycle(item.cycleId);
    if (!cycle || cycle.memberId !== req.user!.id) {
      return res.status(403).json({ message: "Not your workout" });
    }
    
    // Get or create workout log for this date
    let workoutLog = await storage.getWorkoutLog(req.user!.gymId!, req.user!.id, input.date);
    if (!workoutLog) {
      // Calculate day index
      const startDate = new Date(cycle.startDate);
      const logDate = new Date(input.date);
      const daysSinceStart = Math.floor((logDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
      
      workoutLog = await storage.createWorkoutLog({
        gymId: req.user!.gymId!,
        memberId: req.user!.id,
        cycleId: cycle.id,
        dayIndex,
        completedDate: input.date,
        completedAt: new Date()
      });
    }
    
    // Create log exercise entry
    const logExercise = await storage.createWorkoutLogExercise({
      workoutLogId: workoutLog.id,
      workoutItemId: item.id,
      exerciseName: item.exerciseName,
      muscleType: item.muscleType,
      bodyPart: item.bodyPart,
      orderIndex: item.orderIndex
    });
    
    // Create log sets
    for (const set of input.sets) {
      await storage.createWorkoutLogSet({
        logExerciseId: logExercise.id,
        setNumber: set.setNumber,
        targetReps: set.targetReps,
        targetWeight: set.targetWeight ?? null,
        actualReps: set.actualReps,
        actualWeight: set.actualWeight ?? null,
        completed: set.completed
      });
    }
    
    // Also create legacy workout completion for backward compatibility
    const existingCompletion = await storage.getCompletionByItemDate(item.id, req.user!.id, input.date);
    if (!existingCompletion) {
      const completedSets = input.sets.filter(s => s.completed);
      const avgReps = completedSets.length > 0 
        ? Math.round(completedSets.reduce((sum, s) => sum + (s.actualReps || 0), 0) / completedSets.length)
        : null;
      const lastWeight = completedSets.length > 0 ? completedSets[completedSets.length - 1].actualWeight : null;
      
      await storage.completeWorkout({
        gymId: req.user!.gymId!,
        cycleId: cycle.id,
        workoutItemId: item.id,
        memberId: req.user!.id,
        completedDate: input.date,
        actualSets: completedSets.length,
        actualReps: avgReps,
        actualWeight: lastWeight
      });
    }
    
    res.status(201).json({ 
      workoutLogId: workoutLog.id, 
      logExerciseId: logExercise.id,
      message: "Sets logged successfully" 
    });
  });

  // Update a logged set
  app.patch("/api/workouts/log-sets/:setId", requireRole(["member"]), async (req, res) => {
    const setId = parseInt(req.params.setId);
    const schema = z.object({
      actualReps: z.number().optional(),
      actualWeight: z.string().optional().nullable(),
      completed: z.boolean().optional()
    });
    const input = schema.parse(req.body);
    
    const updated = await storage.updateWorkoutLogSet(setId, input);
    res.json(updated);
  });

  // === PERSONAL MODE ROUTES (Members without gym) ===
  
  // Create a personal workout cycle (for members without gym)
  app.post("/api/personal/cycles", requireRole(["member"]), async (req, res) => {
    // Only allow if user has no gym (Personal Mode)
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      cycleLength: z.number().min(1).max(7).default(3),
      dayLabels: z.array(z.string()).optional(),
      startDate: z.string(),
      endDate: z.string(),
      progressionMode: z.enum(["calendar", "completion"]).optional().default("calendar")
    });
    const input = schema.parse(req.body);
    
    // Deactivate only existing active personal cycles (source='self'), not gym cycles
    const existingCycles = await storage.getMemberCycles(req.user!.id, 'self');
    for (const c of existingCycles) {
      if (c.isActive) {
        await storage.deactivateCycle(c.id);
      }
    }
    
    const cycle = await storage.createWorkoutCycle({
      ...input,
      gymId: null,
      trainerId: null,
      memberId: req.user!.id,
      source: "self"
    });
    res.status(201).json(cycle);
  });
  
  // Get all personal cycles
  app.get("/api/personal/cycles", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    // Only return personal workouts (source='self')
    const cycles = await storage.getMemberCycles(req.user!.id, 'self');
    res.json(cycles);
  });
  
  // Add workout item to personal cycle
  app.post("/api/personal/cycles/:cycleId/items", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    
    const cycleId = parseInt(req.params.cycleId);
    const muscleTypes = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Full Body", "Rest", "Cardio", "Biceps", "Triceps", "Hamstrings", "Quadriceps", "Calves", "Abs", "Stretching", "Mobility", "Other"] as const;
    const bodyParts = ["Upper Body", "Lower Body", "Full Body", "Recovery"] as const;
    
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
    if (!cycle || cycle.memberId !== req.user!.id || cycle.source !== "self") {
      return res.status(403).json({ message: "Not your personal cycle" });
    }
    
    const item = await storage.addWorkoutItem({
      ...input,
      cycleId
    });
    res.status(201).json(item);
  });
  
  // Delete workout item from personal cycle
  app.delete("/api/personal/cycles/:cycleId/items/:itemId", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    
    const cycleId = parseInt(req.params.cycleId);
    const itemId = parseInt(req.params.itemId);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.memberId !== req.user!.id || cycle.source !== "self") {
      return res.status(403).json({ message: "Not your personal cycle" });
    }
    
    await storage.deleteWorkoutItem(itemId);
    res.json({ message: "Item deleted" });
  });
  
  // Update personal cycle structure (add/remove days)
  app.patch("/api/personal/cycles/:cycleId", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    
    const cycleId = parseInt(req.params.cycleId);
    const schema = z.object({
      name: z.string().optional(),
      cycleLength: z.number().min(1).max(7).optional(),
      dayLabels: z.array(z.string()).optional(),
      restDays: z.array(z.number()).optional(),
      isActive: z.boolean().optional()
    });
    const input = schema.parse(req.body);
    
    const cycle = await storage.getCycle(cycleId);
    if (!cycle || cycle.memberId !== req.user!.id || cycle.source !== "self") {
      return res.status(403).json({ message: "Not your personal cycle" });
    }
    
    if (input.cycleLength && input.dayLabels) {
      const updated = await storage.updateCycleStructure(cycleId, input.cycleLength, input.dayLabels, input.restDays || []);
      return res.json(updated);
    }
    
    if (input.dayLabels) {
      const updated = await storage.updateCycleDayLabels(cycleId, input.dayLabels);
      return res.json(updated);
    }
    
    if (input.restDays) {
      const updated = await storage.updateCycleRestDays(cycleId, input.restDays);
      return res.json(updated);
    }
    
    res.json(cycle);
  });

  // Suggest workout cycle templates based on questionnaire
  app.post("/api/personal/suggest-cycle", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    
    const schema = z.object({
      goal: z.enum(["strength", "muscle", "fat_loss", "general"]),
      daysPerWeek: z.number().min(2).max(6),
      restDaysPerWeek: z.number().min(0).max(3).optional().default(1),
      experience: z.enum(["beginner", "intermediate", "advanced"]),
      equipment: z.array(z.enum(["dumbbells", "barbell", "machines", "cables", "cardio", "no_equipment"])),
      timePerWorkout: z.enum(["30", "45", "60", "75+"]),
      splitPreference: z.enum(["no_pref", "full_body", "upper_lower", "ppl"])
    });
    
    const input = schema.parse(req.body);
    const { generateCycleTemplates } = await import("./workout-templates");
    const templates = generateCycleTemplates(input, input.restDaysPerWeek ?? 1);
    res.json(templates);
  });

  // Create cycle with items in bulk (for wizard)
  app.post("/api/personal/cycles/bulk", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId) {
      return res.status(403).json({ message: "Personal Mode is for users without a gym" });
    }
    
    const itemSchema = z.object({
      exerciseName: z.string(),
      muscleType: z.string(),
      bodyPart: z.string(),
      sets: z.number(),
      reps: z.number(),
      orderIndex: z.number().optional()
    });
    
    const daySchema = z.object({
      dayIndex: z.number(),
      label: z.string(),
      items: z.array(itemSchema)
    });
    
    const schema = z.object({
      name: z.string().min(1),
      cycleLength: z.number().min(1).max(7),
      days: z.array(daySchema),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      progressionMode: z.enum(['calendar', 'completion']).optional(),
      restDays: z.array(z.number()).optional()
    });
    
    const input = schema.parse(req.body);
    
    // Deactivate existing personal cycles
    const existingCycles = await storage.getMemberCycles(req.user!.id, 'self');
    for (const c of existingCycles) {
      if (c.isActive) {
        await storage.deactivateCycle(c.id);
      }
    }
    
    // Create cycle with user-provided dates or defaults
    const startDate = input.startDate || new Date().toISOString().split('T')[0];
    const endDate = input.endDate || new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const progressionMode = input.progressionMode || 'calendar';
    
    const cycle = await storage.createWorkoutCycle({
      name: input.name,
      cycleLength: input.cycleLength,
      dayLabels: input.days.map(d => d.label),
      restDays: input.restDays || [],
      startDate,
      endDate,
      progressionMode,
      gymId: null,
      trainerId: null,
      memberId: req.user!.id,
      source: "self"
    });
    
    // Add all items - use day.dayIndex for each item
    for (const day of input.days) {
      for (let i = 0; i < day.items.length; i++) {
        const item = day.items[i];
        await storage.addWorkoutItem({
          cycleId: cycle.id,
          dayIndex: day.dayIndex,
          exerciseName: item.exerciseName,
          muscleType: item.muscleType,
          bodyPart: item.bodyPart,
          sets: item.sets,
          reps: item.reps,
          orderIndex: item.orderIndex ?? i
        });
      }
    }
    
    res.status(201).json(cycle);
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

  // Per-set progress analytics endpoints
  app.get("/api/progress/summary", requireRole(["member"]), async (req, res) => {
    const rangeParam = req.query.range as string || 'month';
    const validRanges = ['week', 'month', 'year', 'all'] as const;
    const range = validRanges.includes(rangeParam as any) ? rangeParam as 'week' | 'month' | 'year' | 'all' : 'month';
    
    const summary = await storage.getPerSetProgressSummary(req.user!.id, range);
    res.json(summary);
  });

  app.get("/api/progress/exercise/:exerciseName", requireRole(["member"]), async (req, res) => {
    const exerciseName = decodeURIComponent(req.params.exerciseName);
    const rangeParam = req.query.range as string || '90d';
    const validRanges = ['90d', 'year', 'all'] as const;
    const range = validRanges.includes(rangeParam as any) ? rangeParam as '90d' | 'year' | 'all' : '90d';
    
    const analytics = await storage.getExerciseAnalytics(req.user!.id, exerciseName, range);
    res.json(analytics);
  });

  app.get("/api/progress/prs", requireRole(["member"]), async (req, res) => {
    const prs = await storage.getPersonalRecords(req.user!.id);
    res.json(prs);
  });

  // Get list of unique exercise names for autocomplete
  app.get("/api/progress/exercises", requireRole(["member"]), async (req, res) => {
    const allLogs = await db.select().from(workoutLogs)
      .where(and(
        eq(workoutLogs.memberId, req.user!.id),
        isNotNull(workoutLogs.completedAt)
      ));
    
    if (allLogs.length === 0) {
      return res.json([]);
    }
    
    const logIds = allLogs.map(l => l.id);
    const exercises = await db.selectDistinct({ exerciseName: workoutLogExercises.exerciseName })
      .from(workoutLogExercises)
      .where(inArray(workoutLogExercises.workoutLogId, logIds));
    
    res.json(exercises.map(e => e.exerciseName).sort());
  });

  // Analytics explanations with example calculation
  app.get("/api/progress/explanations", requireRole(["member"]), async (req, res) => {
    const explanations = await storage.getAnalyticsExplanationWithExample(req.user!.id);
    res.json(explanations);
  });

  app.get("/api/me/calendar", requireRole(["member"]), async (req, res) => {
    const month = req.query.month as string || getLocalDate(req).slice(0, 7);
    const calendar = await storage.getMemberCalendar(req.user!.id, month);
    res.json(calendar);
  });

  app.get("/api/me/calendar/enhanced", requireRole(["member"]), async (req, res) => {
    const month = req.query.month as string || getLocalDate(req).slice(0, 7);
    const clientToday = req.query.today as string | undefined;
    const calendar = await storage.getMemberCalendarEnhanced(req.user!.gymId, req.user!.id, month, clientToday);
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
    // Check and apply auto-assign phase before fetching summary (only for gym members)
    if (req.user!.gymId) {
      await storage.checkAndApplyAutoAssignPhase(req.user!.gymId, req.user!.id);
    }
    const summary = await storage.getMemberWorkoutSummary(req.user!.gymId, req.user!.id);
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
  // Note: /api/member/profile is defined below in ENHANCED MEMBER PROFILE ROUTES section

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
    
    // Default to last 7 days if not provided (using client's local date)
    const todayStr = getLocalDate(req);
    const today = new Date(todayStr + 'T00:00:00');
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    
    const from = fromStr || defaultFrom.toISOString().split("T")[0];
    const to = toStr || todayStr;
    
    // Support Personal Mode (no gymId)
    const dailyPoints = await storage.getDailyWorkoutPoints(
      req.user!.gymId ?? null,
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
      const profile = await storage.getFullMemberProfile(req.user!.id, getLocalDate(req));
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

  // === ENHANCED MEMBER PROFILE ROUTES ===
  app.get("/api/member/profile", requireRole(["member"]), async (req, res) => {
    try {
      const profile = await storage.getEnhancedMemberProfile(req.user!.id);
      res.json(profile);
    } catch (error) {
      console.error("[Member Profile] Error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch("/api/member/profile", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        phone: z.string().optional(),
        address: z.string().optional(),
        emergencyContact: z.string().optional()
      });
      const input = schema.parse(req.body);
      await storage.updateMemberProfileDetails(req.user!.id, input);
      res.json({ success: true });
    } catch (error) {
      console.error("[Member Profile Update] Error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/member/profile/change-request", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        field: z.enum(["email", "gender", "dob"]),
        currentValue: z.string().optional(),
        requestedValue: z.string()
      });
      const input = schema.parse(req.body);
      
      const user = await storage.getUser(req.user!.id);
      const requestContent = `Profile Change Request\n\nField: ${input.field}\nCurrent Value: ${input.currentValue || 'Not set'}\nRequested Value: ${input.requestedValue}\n\nPlease review and update my profile.`;
      
      await storage.createSupportTicket({
        gymId: user!.gymId!,
        userId: req.user!.id,
        subject: `Profile Change Request - ${input.field}`,
        description: requestContent,
        priority: "medium"
      });
      
      res.json({ success: true, message: "Change request submitted. Gym owner will review it." });
    } catch (error) {
      console.error("[Profile Change Request] Error:", error);
      res.status(500).json({ message: "Failed to submit change request" });
    }
  });

  // === ENHANCED OWNER PROFILE ROUTES ===
  app.get("/api/owner/profile", requireRole(["owner"]), async (req, res) => {
    try {
      const profile = await storage.getEnhancedOwnerProfile(req.user!.id);
      res.json(profile);
    } catch (error) {
      console.error("[Owner Profile] Error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch("/api/owner/profile", requireRole(["owner"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned to this owner account" });
      }
      const schema = z.object({
        phone: z.string().optional(),
        address: z.string().optional(),
        timings: z.string().optional()
      });
      const input = schema.parse(req.body);
      await storage.updateOwnerProfile(req.user!.id, req.user!.gymId, input);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Owner Profile Update] Error:", error);
      if (error.message === "Unauthorized: You do not own this gym") {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
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
    
    // Get member's current cycle info - check both user.cycleId and member's assigned cycles
    let currentCycleName: string | null = null;
    let currentCycleLength: number | null = null;
    
    if (member.cycleId) {
      const cycle = await storage.getCycle(member.cycleId);
      if (cycle) {
        currentCycleName = cycle.name;
        currentCycleLength = cycle.cycleLength;
      }
    }
    
    // If no cycleId on user, check for cycles assigned to member (gym cycles only)
    if (!currentCycleName) {
      const memberCycles = await storage.getMemberCycles(memberId, 'trainer');
      if (memberCycles.length > 0) {
        const latestCycle = memberCycles[0]; // Already sorted by createdAt desc
        currentCycleName = latestCycle.name;
        currentCycleLength = latestCycle.cycleLength;
      }
    }
    
    res.json({
      id: member.id,
      username: member.username,
      publicId: member.publicId,
      gymName: gym?.name || null,
      gymCode: gym?.code || null,
      currentCycleName,
      currentCycleLength
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
      notes: z.string().nullable().optional(),
      cycleLength: z.number().min(1).optional(),
      dayLabels: z.array(z.string()).nullable().optional(),
      restDays: z.array(z.number()).nullable().optional()
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
    
    // Auto-enable custom exercises when exercises are added
    if (!phase.useCustomExercises) {
      await storage.updateTrainingPhase(phaseId, { useCustomExercises: true });
    }
    
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
    
    // Auto-enable custom exercises when copying from cycle
    if (!phase.useCustomExercises && exercises.length > 0) {
      await storage.updateTrainingPhase(phaseId, { useCustomExercises: true });
    }
    
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
    // Only show gym-assigned cycles (source='trainer'), not personal workouts
    const cycles = await storage.getMemberCycles(memberId, 'trainer');
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

  // === AI INSIGHTS ===
  app.get("/api/owner/ai-insights/:date", requireRole(["owner"]), async (req, res) => {
    const clientDate = req.params.date || getLocalDate(req);
    const insights = await storage.getAiInsights(req.user!.gymId!, clientDate);
    res.json(insights);
  });

  // === OWNER DASHBOARD & ATTENDANCE ANALYTICS ===
  app.get("/api/owner/dashboard-metrics", requireRole(["owner"]), async (req, res) => {
    // Accept client's local date to handle timezone differences
    const clientToday = (req.query.clientToday as string) || getLocalDate(req);
    const metrics = await storage.getOwnerDashboardMetrics(req.user!.gymId!, clientToday);
    res.json(metrics);
  });

  // Revenue Analytics
  app.get("/api/owner/revenue", requireRole(["owner"]), async (req, res) => {
    const month = (req.query.month as string) || getLocalDate(req).slice(0, 7);
    const revenueData = await storage.getRevenueAnalytics(req.user!.gymId!, month);
    res.json(revenueData);
  });

  // Member Analytics
  app.get("/api/owner/member-analytics", requireRole(["owner"]), async (req, res) => {
    const analytics = await storage.getMemberAnalytics(req.user!.gymId!);
    res.json(analytics);
  });

  // Inactive Members
  app.get("/api/owner/members/inactive", requireRole(["owner"]), async (req, res) => {
    const days = parseInt(req.query.days as string) || 3;
    const includeEnded = req.query.includeEnded === 'true';
    const mode = (req.query.mode as 'attendance' | 'workouts') || 'attendance';
    const clientDate = (req.query.clientDate as string) || getLocalDate(req);
    const search = req.query.search as string | undefined;
    
    const inactiveMembers = await storage.getInactiveMembers(req.user!.gymId!, {
      days,
      includeEnded,
      mode,
      clientDate,
      search
    });
    res.json(inactiveMembers);
  });

  app.get("/api/owner/attendance/summary", requireRole(["owner"]), async (req, res) => {
    const date = (req.query.date as string) || getLocalDate(req);
    const summary = await storage.getOwnerAttendanceSummary(req.user!.gymId!, date);
    res.json(summary);
  });

  app.get("/api/owner/attendance/day", requireRole(["owner"]), async (req, res) => {
    const date = (req.query.date as string) || getLocalDate(req);
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
    const profile = await storage.getFullMemberProfile(memberId, getLocalDate(req));
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

  // === WALK-IN VISITORS ===
  app.post("/api/owner/walk-in-visitors", requireRole(["owner"]), async (req, res) => {
    try {
      const { name, phone, email, visitDate, visitType, daysCount, amountPaid, notes } = req.body;
      if (!name || !phone || !visitDate) {
        return res.status(400).json({ message: "Name, phone, and visit date are required" });
      }
      const visitor = await storage.createWalkInVisitor({
        gymId: req.user!.gymId!,
        name,
        phone,
        email,
        visitDate,
        visitType: visitType || "day_pass",
        daysCount: daysCount || 1,
        amountPaid: amountPaid || 0,
        notes,
        createdByUserId: req.user!.id
      });
      res.status(201).json(visitor);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create walk-in visitor" });
    }
  });

  app.get("/api/owner/walk-in-visitors", requireRole(["owner"]), async (req, res) => {
    try {
      const { date, visitType } = req.query;
      const visitors = await storage.getWalkInVisitors(req.user!.gymId!, {
        date: date as string,
        visitType: visitType as string
      });
      res.json(visitors);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch walk-in visitors" });
    }
  });

  app.get("/api/owner/walk-in-visitors/stats", requireRole(["owner"]), async (req, res) => {
    try {
      const stats = await storage.getWalkInVisitorStats(req.user!.gymId!);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch walk-in visitor stats" });
    }
  });

  app.get("/api/owner/walk-in-visitors/:id", requireRole(["owner"]), async (req, res) => {
    try {
      const visitor = await storage.getWalkInVisitorById(parseInt(req.params.id));
      if (!visitor || visitor.gymId !== req.user!.gymId) {
        return res.status(404).json({ message: "Visitor not found" });
      }
      res.json(visitor);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch walk-in visitor" });
    }
  });

  app.patch("/api/owner/walk-in-visitors/:id", requireRole(["owner"]), async (req, res) => {
    try {
      const visitor = await storage.getWalkInVisitorById(parseInt(req.params.id));
      if (!visitor || visitor.gymId !== req.user!.gymId) {
        return res.status(404).json({ message: "Visitor not found" });
      }
      const updated = await storage.updateWalkInVisitor(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to update walk-in visitor" });
    }
  });

  // === KIOSK ROUTES (Self Check-in) ===
  
  // Owner: Create a new kiosk session (generates QR code link)
  app.post("/api/owner/kiosk-sessions", requireRole(["owner"]), async (req, res) => {
    try {
      const { label, expiryHours } = req.body;
      const token = nanoid(12);
      const expiresAt = new Date(Date.now() + (expiryHours || 8) * 60 * 60 * 1000);
      
      const session = await storage.createKioskSession({
        gymId: req.user!.gymId!,
        token,
        label: label || `Check-in ${new Date().toLocaleDateString()}`,
        expiresAt,
        isActive: true,
        createdByUserId: req.user!.id
      });
      
      res.status(201).json(session);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create kiosk session" });
    }
  });

  // Owner: Get all kiosk sessions
  app.get("/api/owner/kiosk-sessions", requireRole(["owner"]), async (req, res) => {
    try {
      const sessions = await storage.getKioskSessionsByGym(req.user!.gymId!);
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch kiosk sessions" });
    }
  });

  // Owner: Deactivate a kiosk session
  app.post("/api/owner/kiosk-sessions/:id/deactivate", requireRole(["owner"]), async (req, res) => {
    try {
      const session = await storage.getKioskSessionById(parseInt(req.params.id));
      if (!session || session.gymId !== req.user!.gymId) {
        return res.status(404).json({ message: "Session not found" });
      }
      const updated = await storage.deactivateKioskSession(parseInt(req.params.id));
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to deactivate kiosk session" });
    }
  });

  // Public: Validate a kiosk token (no auth required)
  app.get("/api/kiosk/:token", async (req, res) => {
    try {
      const session = await storage.getKioskSessionByToken(req.params.token);
      if (!session) {
        return res.status(404).json({ message: "Invalid check-in link" });
      }
      if (!session.isActive) {
        return res.status(400).json({ message: "This check-in link has been deactivated" });
      }
      if (new Date(session.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This check-in link has expired" });
      }
      
      // Get gym info for display
      const gym = await storage.getGym(session.gymId);
      res.json({ 
        valid: true, 
        gymName: gym?.name,
        gymId: session.gymId,
        sessionId: session.id
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to validate kiosk token" });
    }
  });

  // Public: Request OTP for kiosk check-in (rate limited) - uses email
  app.post("/api/kiosk/:token/request-otp", kioskOtpLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email address required" });
      }
      
      const session = await storage.getKioskSessionByToken(req.params.token);
      if (!session || !session.isActive || new Date(session.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired check-in link" });
      }
      
      // Get gym name for email
      const gym = await storage.getGym(session.gymId);
      const gymName = gym?.name || "the gym";
      
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await storage.createKioskOtpCode({
        phone: email, // Using phone field to store email (reusing existing column)
        kioskSessionId: session.id,
        codeHash: otpHash,
        expiresAt,
        verified: false
      });
      
      // Send OTP via email using Resend
      const emailSent = await sendKioskOtpEmail(email, otp, gymName);
      // Security: Never log OTPs in production
      
      res.json({ 
        message: "OTP sent to your email", 
        expiresIn: 600
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send OTP" });
    }
  });

  // Public: Verify OTP and submit visitor info
  app.post("/api/kiosk/:token/submit", kioskSubmitLimiter, async (req, res) => {
    try {
      const { email, otp, name, phone, visitType, daysCount, amountPaid, notes } = req.body;
      
      if (!email || !otp || !name) {
        return res.status(400).json({ message: "Email, OTP, and name are required" });
      }
      
      const session = await storage.getKioskSessionByToken(req.params.token);
      if (!session || !session.isActive || new Date(session.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired check-in link" });
      }
      
      // Verify OTP (email is stored in phone field)
      const otpCode = await storage.getValidKioskOtpCode(email, session.id);
      if (!otpCode) {
        return res.status(400).json({ message: "Invalid or expired OTP. Please request a new one." });
      }
      
      const isValidOtp = await bcrypt.compare(otp, otpCode.codeHash);
      if (!isValidOtp) {
        return res.status(400).json({ message: "Invalid OTP code" });
      }
      
      // Mark OTP as verified
      await storage.markKioskOtpVerified(otpCode.id);
      
      // Create walk-in visitor entry
      const today = new Date().toISOString().split('T')[0];
      const visitor = await storage.createWalkInVisitor({
        gymId: session.gymId,
        name,
        phone,
        email: email || null,
        visitDate: today,
        visitType: visitType || "enquiry",
        daysCount: daysCount || 1,
        amountPaid: amountPaid || 0,
        notes: notes || null,
        source: "kiosk",
        kioskSessionId: session.id,
        createdByUserId: null
      });
      
      res.status(201).json({ 
        message: "Check-in successful! The gym has been notified.",
        visitor 
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to complete check-in" });
    }
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
      res.setHeader("Content-Disposition", `attachment; filename=payments_export_${getLocalDate(req)}.csv`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Failed to export payments" });
    }
  });

  app.get("/api/owner/export/attendance", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const { startDate, endDate } = req.query;
      const localToday = getLocalDate(req);
      const localTodayDate = new Date(localToday + 'T00:00:00');
      const start = startDate as string || new Date(localTodayDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate as string || localToday;
      
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
      res.setHeader("Content-Disposition", `attachment; filename=members_export_${getLocalDate(req)}.csv`);
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

  // === MEMBER ONBOARDING ROUTES ===
  
  // Get current user profile and onboarding status
  app.get("/api/profile/me", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getUserProfile(req.user!.id);
      const user = await storage.getUser(req.user!.id);
      res.json({
        profile,
        onboardingCompleted: user?.onboardingCompleted ?? false,
        email: user?.email,
        phone: user?.phone
      });
    } catch (err) {
      console.error("[Onboarding] Failed to get profile:", err);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });
  
  // Create or update user profile (member only)
  app.post("/api/profile", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        fullName: z.string().min(1, "Full name is required"),
        phone: z.string().min(1, "Phone number is required"),
        gender: z.enum(["male", "female", "prefer_not_to_say"]),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        address: z.string().optional()
      });
      
      const input = schema.parse(req.body);
      
      // Calculate age from DOB
      const dobDate = new Date(input.dob);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      
      const profile = await storage.createOrUpdateUserProfile(req.user!.id, {
        fullName: input.fullName,
        phone: input.phone,
        gender: input.gender,
        dob: input.dob,
        age,
        address: input.address
      });
      
      console.log(`[Onboarding] Profile saved for user ${req.user!.id}`);
      res.json(profile);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      console.error("[Onboarding] Failed to save profile:", err);
      res.status(500).json({ message: "Failed to save profile" });
    }
  });
  
  // Create initial body measurement (member only)
  app.post("/api/body-measurements/initial", requireRole(["member"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "User must be assigned to a gym" });
      }
      
      const schema = z.object({
        height: z.number().min(50, "Height must be at least 50 cm").max(300, "Height must be less than 300 cm"),
        weight: z.number().min(20, "Weight must be at least 20 kg").max(500, "Weight must be less than 500 kg"),
        bodyFat: z.number().min(1).max(70).optional(),
        chest: z.number().min(30).max(300).optional(),
        waist: z.number().min(30).max(300).optional(),
        hips: z.number().min(30).max(300).optional()
      });
      
      const input = schema.parse(req.body);
      
      // Check if initial measurement already exists
      const existing = await storage.getInitialBodyMeasurement(req.user!.id);
      if (existing) {
        return res.status(400).json({ message: "Initial body measurement already exists" });
      }
      
      const measurement = await storage.createInitialBodyMeasurement({
        gymId: req.user!.gymId,
        memberId: req.user!.id,
        height: input.height,
        weight: input.weight,
        bodyFat: input.bodyFat,
        chest: input.chest,
        waist: input.waist,
        hips: input.hips
      });
      
      // Mark onboarding as complete
      await storage.setOnboardingCompleted(req.user!.id);
      
      console.log(`[Onboarding] Initial body measurement saved and onboarding completed for user ${req.user!.id}`);
      res.json({ measurement, onboardingCompleted: true });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      console.error("[Onboarding] Failed to save initial body measurement:", err);
      res.status(500).json({ message: "Failed to save body measurement" });
    }
  });
  
  // Get body measurement history for current user
  app.get("/api/body-measurements/me", requireAuth, async (req, res) => {
    try {
      const measurements = await storage.getMemberBodyMeasurements(req.user!.id);
      res.json(measurements);
    } catch (err) {
      console.error("[Onboarding] Failed to get body measurements:", err);
      res.status(500).json({ message: "Failed to get body measurements" });
    }
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
        gymName: z.string().min(1, "Gym name is required"),
        phone: z.string().optional(),
        address: z.string().optional(),
        pointOfContactName: z.string().optional(),
        pointOfContactEmail: z.string().email().optional().or(z.literal("")),
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
        country: z.string().min(1, "Country is required"),
        gymSize: z.enum(["0-50", "51-150", "151-300", "300+"], { 
          errorMap: () => ({ message: "Please select a valid gym size" }) 
        }),
        trainerCount: z.number().int().min(0, "Number of trainers must be 0 or greater"),
        preferredStart: z.enum(["immediately", "next_week", "next_month"], {
          errorMap: () => ({ message: "Please select when you want to start" })
        }),
        referralSource: z.enum(["friend", "instagram", "direct_visit", "other"], {
          errorMap: () => ({ message: "Please select how you heard about us" })
        }),
        referralOtherText: z.string().optional(),
      }).refine((data) => {
        if (data.referralSource === "other") {
          return data.referralOtherText && data.referralOtherText.trim().length > 0;
        }
        return true;
      }, {
        message: "Please specify how you heard about us",
        path: ["referralOtherText"],
      });
      const input = schema.parse(req.body);
      
      const request = await storage.createGymRequest({
        ownerUserId: req.user!.id,
        gymName: input.gymName,
        phone: input.phone || null,
        address: input.address || null,
        pointOfContactName: input.pointOfContactName || null,
        pointOfContactEmail: input.pointOfContactEmail || null,
        city: input.city,
        state: input.state,
        country: input.country,
        gymSize: input.gymSize,
        trainerCount: input.trainerCount,
        preferredStart: input.preferredStart,
        referralSource: input.referralSource,
        referralOtherText: input.referralSource === "other" ? input.referralOtherText || null : null,
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
  app.get("/api/owner/join-requests", requireRole(["owner"]), async (req, res) => {
    const requests = await storage.getPendingJoinRequestsForGym(req.user!.gymId!);
    res.json(requests);
  });
  
  // Owner approves a join request
  app.post("/api/owner/join-requests/:id/approve", requireRole(["owner"]), async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const result = await storage.approveJoinRequest(requestId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to approve request" });
    }
  });
  
  // Owner rejects a join request
  app.post("/api/owner/join-requests/:id/reject", requireRole(["owner"]), async (req, res) => {
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
  
  // Get single gym request details
  app.get("/api/admin/gym-requests/:id", requireAdmin, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const request = await storage.getGymRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Gym request not found" });
      }
      res.json(request);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch request details" });
    }
  });
  
  // Get all gyms with owner and subscription info (with optional filters)
  app.get("/api/admin/all-gyms", requireAdmin, async (req, res) => {
    const { name, city, state } = req.query as { name?: string; city?: string; state?: string };
    const gyms = await storage.getAllGymsWithDetails({ name, city, state });
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
      const owner = gym.ownerUserId ? await storage.getUser(gym.ownerUserId) : null;
      res.json({
        gym,
        owner: owner ? { 
          id: owner.id, 
          username: owner.username, 
          email: owner.email, 
          phone: owner.phone, 
          publicId: owner.publicId,
          status: owner.status || "active"
        } : null,
        members: members.map(m => ({ 
          id: m.id, 
          username: m.username, 
          email: m.email, 
          phone: m.phone, 
          publicId: m.publicId,
          status: (m as any).status || "active"
        })),
        trainers: trainers.map(t => ({ 
          id: t.id, 
          username: t.username, 
          email: t.email, 
          phone: t.phone, 
          publicId: t.publicId,
          status: (t as any).status || "active"
        })),
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
  
  // Owner: Get their gym's subscription status (read-only) - duplicate removed, see line ~3197

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
    const today = getLocalDate(req);
    
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
    const today = getLocalDate(req);
    
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

  // === SUPPORT SYSTEM ROUTES ===

  // Public support ticket creation (for unauthenticated users)
  app.post("/api/support/public", async (req, res) => {
    try {
      const schema = z.object({
        userRole: z.enum(["owner", "trainer", "member"]),
        contactEmailOrPhone: z.string().min(3, "Contact information is required"),
        gymCode: z.string().optional(),
        issueType: z.enum(["login", "otp", "password", "gym_code", "other"]),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        description: z.string().min(10, "Description must be at least 10 characters"),
        attachmentUrl: z.string().optional(),
      });

      const input = schema.parse(req.body);
      
      let gymId: number | null = null;
      if (input.gymCode) {
        const gym = await storage.getGymByCode(input.gymCode.toUpperCase());
        if (gym) gymId = gym.id;
      }

      const ticket = await storage.createSupportTicket({
        userId: null,
        userRole: input.userRole,
        gymId,
        contactEmailOrPhone: input.contactEmailOrPhone,
        issueType: input.issueType,
        priority: input.priority,
        description: input.description,
        attachmentUrl: input.attachmentUrl || null,
        status: "open",
      });

      res.status(201).json({ message: "Support ticket created", ticketId: ticket.id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Support ticket error:", err);
      res.status(500).json({ message: "Failed to create support ticket" });
    }
  });

  // Authenticated user support ticket creation
  app.post("/api/support", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      
      const schema = z.object({
        issueType: z.enum(["attendance", "payments", "profile_update", "trainer_assignment", "bug_report", "other"]),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        description: z.string().min(10, "Description must be at least 10 characters"),
        attachmentUrl: z.string().optional(),
      });

      const input = schema.parse(req.body);

      const ticket = await storage.createSupportTicket({
        userId: user.id,
        userRole: user.role,
        gymId: user.gymId,
        contactEmailOrPhone: user.email || user.phone || `user_${user.id}`,
        issueType: input.issueType,
        priority: input.priority,
        description: input.description,
        attachmentUrl: input.attachmentUrl || null,
        status: "open",
      });

      res.status(201).json({ message: "Support ticket created", ticketId: ticket.id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Support ticket error:", err);
      res.status(500).json({ message: "Failed to create support ticket" });
    }
  });

  // Get current user's support tickets
  app.get("/api/support/my-tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const tickets = await storage.getUserSupportTickets(user.id);
      res.json(tickets);
    } catch (err) {
      console.error("Get tickets error:", err);
      res.status(500).json({ message: "Failed to get tickets" });
    }
  });

  // Get a specific ticket (for the ticket owner)
  app.get("/api/support/ticket/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const ticketId = parseInt(req.params.id);
      
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Only allow viewing own tickets or admin
      if (ticket.userId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(ticket);
    } catch (err) {
      console.error("Get ticket error:", err);
      res.status(500).json({ message: "Failed to get ticket" });
    }
  });

  // User adds a message to their ticket
  app.post("/api/support/ticket/:id/message", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const ticketId = parseInt(req.params.id);
      
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      if (ticket.userId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const schema = z.object({
        message: z.string().min(1, "Message is required"),
      });
      const input = schema.parse(req.body);
      
      const message = await storage.createSupportMessage({
        ticketId,
        senderType: "user",
        senderId: user.id,
        message: input.message,
      });
      
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Add message error:", err);
      res.status(500).json({ message: "Failed to add message" });
    }
  });

  // === ADMIN SUPPORT ROUTES ===

  // Admin: Get all support tickets with filters (enriched with gym/user info)
  app.get("/api/admin/support", requireAdmin, async (req, res) => {
    try {
      const filters: { status?: string; priority?: string; issueType?: string; gymId?: number } = {};
      
      if (req.query.status && typeof req.query.status === 'string') {
        filters.status = req.query.status;
      }
      if (req.query.priority && typeof req.query.priority === 'string') {
        filters.priority = req.query.priority;
      }
      if (req.query.issueType && typeof req.query.issueType === 'string') {
        filters.issueType = req.query.issueType;
      }
      if (req.query.gymId && typeof req.query.gymId === 'string') {
        filters.gymId = parseInt(req.query.gymId);
      }
      
      const tickets = await storage.getAdminSupportTickets(filters);
      res.json(tickets);
    } catch (err) {
      console.error("Admin get tickets error:", err);
      res.status(500).json({ message: "Failed to get tickets" });
    }
  });

  // Admin: Get a specific ticket (enriched with gym/user info)
  app.get("/api/admin/support/:id", requireAdmin, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getAdminSupportTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      res.json(ticket);
    } catch (err) {
      console.error("Admin get ticket error:", err);
      res.status(500).json({ message: "Failed to get ticket" });
    }
  });

  // Admin: Update ticket status
  app.patch("/api/admin/support/:id/status", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const ticketId = parseInt(req.params.id);
      
      const schema = z.object({
        status: z.enum(["open", "in_progress", "waiting_user", "closed"]),
      });
      const input = schema.parse(req.body);
      
      const oldTicket = await storage.getSupportTicket(ticketId);
      if (!oldTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const ticket = await storage.updateSupportTicketStatus(ticketId, input.status);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "support_ticket",
        entityId: ticketId,
        action: "status_update",
        oldValue: oldTicket.status,
        newValue: input.status,
        reason: null,
      });
      
      res.json(ticket);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin update status error:", err);
      res.status(500).json({ message: "Failed to update ticket status" });
    }
  });

  // Admin: Add message/reply to ticket
  app.post("/api/admin/support/:id/message", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const ticketId = parseInt(req.params.id);
      
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const schema = z.object({
        message: z.string().min(1, "Message is required"),
      });
      const input = schema.parse(req.body);
      
      const message = await storage.createSupportMessage({
        ticketId,
        senderType: "admin",
        senderId: adminUser.userId,
        message: input.message,
      });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "support_ticket",
        entityId: ticketId,
        action: "admin_reply",
        oldValue: null,
        newValue: input.message.substring(0, 100),
        reason: null,
      });
      
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin add message error:", err);
      res.status(500).json({ message: "Failed to add message" });
    }
  });

  // === ADMIN USER MANAGEMENT ROUTES ===

  // Admin: Get all gyms with owners
  app.get("/api/admin/gyms-with-owners", requireAdmin, async (req, res) => {
    try {
      const gymsWithOwners = await storage.getAllGymsWithOwners();
      res.json(gymsWithOwners);
    } catch (err) {
      console.error("Admin get gyms error:", err);
      res.status(500).json({ message: "Failed to get gyms" });
    }
  });

  // Admin: Get gym roster (owner, trainers, members)
  app.get("/api/admin/gyms/:gymId/roster", requireAdmin, async (req, res) => {
    try {
      const gymId = parseInt(req.params.gymId);
      const roster = await storage.getGymWithRoster(gymId);
      
      if (!roster) {
        return res.status(404).json({ message: "Gym not found" });
      }
      
      res.json(roster);
    } catch (err) {
      console.error("Admin get gym roster error:", err);
      res.status(500).json({ message: "Failed to get gym roster" });
    }
  });

  // Admin: Get user details
  app.get("/api/admin/users/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (err) {
      console.error("Admin get user error:", err);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Admin: Update user details
  app.patch("/api/admin/users/:userId", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = parseInt(req.params.userId);
      
      const schema = z.object({
        username: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        status: z.enum(["active", "suspended", "banned"]).optional(),
        reason: z.string().min(1, "Reason is required for admin edits"),
      });
      const input = schema.parse(req.body);
      
      const oldUser = await storage.getUser(userId);
      if (!oldUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { reason, ...updateData } = input;
      const updatedUser = await storage.adminUpdateUser(userId, updateData);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "user",
        entityId: userId,
        action: "admin_user_update",
        oldValue: JSON.stringify({ username: oldUser.username, email: oldUser.email, phone: oldUser.phone, status: oldUser.status }),
        newValue: JSON.stringify(updateData),
        reason: reason,
      });
      
      res.json(updatedUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin update user error:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin: Reset user password
  app.post("/api/admin/users/:userId/reset-password", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = parseInt(req.params.userId);
      
      const schema = z.object({
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
        reason: z.string().min(1, "Reason is required"),
      });
      const input = schema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const hashedPassword = await hashPassword(input.newPassword);
      await storage.adminResetPassword(userId, hashedPassword);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "user",
        entityId: userId,
        action: "admin_password_reset",
        oldValue: null,
        newValue: "Password reset by admin",
        reason: input.reason,
      });
      
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin reset password error:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Admin: Update user status (suspend/activate/ban)
  app.post("/api/admin/users/:userId/status", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = parseInt(req.params.userId);
      
      const schema = z.object({
        status: z.enum(["active", "suspended", "banned"]),
        reason: z.string().min(1, "Reason is required for status change"),
      });
      const input = schema.parse(req.body);
      
      const oldUser = await storage.getUser(userId);
      if (!oldUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updatedUser = await storage.adminUpdateUser(userId, { status: input.status });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "user",
        entityId: userId,
        action: "admin_status_change",
        oldValue: oldUser.status || "active",
        newValue: input.status,
        reason: input.reason,
      });
      
      res.json(updatedUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin status change error:", err);
      res.status(500).json({ message: "Failed to change status" });
    }
  });

  // Admin: Move user to different gym
  app.post("/api/admin/users/:userId/move-gym", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = parseInt(req.params.userId);
      
      const schema = z.object({
        newGymId: z.number().nullable(),
        reason: z.string().min(1, "Reason is required for gym transfer"),
      });
      const input = schema.parse(req.body);
      
      const oldUser = await storage.getUser(userId);
      if (!oldUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updatedUser = await storage.adminMoveUserToGym(userId, input.newGymId);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "user",
        entityId: userId,
        action: "admin_gym_transfer",
        oldValue: oldUser.gymId?.toString() || "none",
        newValue: input.newGymId?.toString() || "none",
        reason: input.reason,
      });
      
      res.json(updatedUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin move gym error:", err);
      res.status(500).json({ message: "Failed to move user" });
    }
  });

  // Admin: Reassign member to different trainer
  app.post("/api/admin/users/:userId/reassign-trainer", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = parseInt(req.params.userId);
      
      const schema = z.object({
        newTrainerId: z.number().nullable(),
        reason: z.string().min(1, "Reason is required for trainer reassignment"),
      });
      const input = schema.parse(req.body);
      
      const oldUser = await storage.getUser(userId);
      if (!oldUser || oldUser.role !== "member") {
        return res.status(404).json({ message: "Member not found" });
      }
      
      await storage.adminReassignTrainer(userId, input.newTrainerId);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "user",
        entityId: userId,
        action: "admin_trainer_reassign",
        oldValue: oldUser.trainerId?.toString() || "none",
        newValue: input.newTrainerId?.toString() || "none",
        reason: input.reason,
      });
      
      res.json({ message: "Trainer reassigned successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin reassign trainer error:", err);
      res.status(500).json({ message: "Failed to reassign trainer" });
    }
  });

  // === ADMIN ATTENDANCE & WORKOUT MANAGEMENT ===
  
  // Get member data for a specific date
  app.get("/api/admin/members/:id/day/:date", requireAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const date = req.params.date;
      
      const data = await storage.getAdminMemberDayData(memberId, date);
      if (!data.member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      res.json(data);
    } catch (err) {
      console.error("Admin get member day data error:", err);
      res.status(500).json({ message: "Failed to get member data" });
    }
  });

  // Set/update attendance for a member on a date
  app.post("/api/admin/members/:id/attendance", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const memberId = parseInt(req.params.id);
      
      const schema = z.object({
        date: z.string().min(1, "Date is required"),
        status: z.enum(["present", "absent"]),
        reason: z.string().min(1, "Reason is required for attendance changes"),
      });
      const input = schema.parse(req.body);
      
      const member = await storage.getUser(memberId);
      if (!member || !member.gymId) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Get old attendance for audit
      const oldAttendance = await storage.getAttendanceByMemberDate(memberId, input.date);
      
      const attendance = await storage.adminSetAttendance({
        gymId: member.gymId,
        memberId,
        date: input.date,
        status: input.status,
        adminId: adminUser.userId,
        reason: input.reason
      });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "attendance",
        entityId: attendance.id,
        action: oldAttendance ? "admin_update_attendance" : "admin_create_attendance",
        oldValue: oldAttendance ? JSON.stringify({ status: oldAttendance.status }) : null,
        newValue: JSON.stringify({ status: input.status }),
        reason: input.reason,
      });
      
      res.json(attendance);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin set attendance error:", err);
      res.status(500).json({ message: "Failed to set attendance" });
    }
  });

  // Create workout session
  app.post("/api/admin/members/:id/workout/session/create", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const memberId = parseInt(req.params.id);
      
      const schema = z.object({
        date: z.string().min(1, "Date is required"),
        focusLabel: z.string().min(1, "Focus label/body part is required"),
        notes: z.string().optional(),
        reason: z.string().min(1, "Reason is required for creating sessions"),
      });
      const input = schema.parse(req.body);
      
      const member = await storage.getUser(memberId);
      if (!member || !member.gymId) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const session = await storage.adminCreateWorkoutSession({
        gymId: member.gymId,
        memberId,
        date: input.date,
        focusLabel: input.focusLabel,
        notes: input.notes,
        adminId: adminUser.userId,
        reason: input.reason
      });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_session",
        entityId: session.id,
        action: "admin_create_session",
        oldValue: null,
        newValue: JSON.stringify({ date: input.date, focusLabel: input.focusLabel }),
        reason: input.reason,
      });
      
      res.json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin create session error:", err);
      res.status(500).json({ message: "Failed to create workout session" });
    }
  });

  // Update workout session
  app.patch("/api/admin/workout/session/:sessionId", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const sessionId = parseInt(req.params.sessionId);
      
      const schema = z.object({
        focusLabel: z.string().optional(),
        notes: z.string().optional(),
        reason: z.string().min(1, "Reason is required for session updates"),
      });
      const input = schema.parse(req.body);
      
      const oldSession = await storage.getWorkoutSessionById(sessionId);
      if (!oldSession) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const session = await storage.adminUpdateWorkoutSession(sessionId, {
        focusLabel: input.focusLabel,
        notes: input.notes,
        adminId: adminUser.userId,
        reason: input.reason
      });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_session",
        entityId: sessionId,
        action: "admin_update_session",
        oldValue: JSON.stringify({ focusLabel: oldSession.focusLabel, notes: oldSession.notes }),
        newValue: JSON.stringify({ focusLabel: session.focusLabel, notes: session.notes }),
        reason: input.reason,
      });
      
      res.json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin update session error:", err);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Delete workout session (soft delete)
  app.delete("/api/admin/workout/session/:sessionId", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const sessionId = parseInt(req.params.sessionId);
      
      const schema = z.object({
        reason: z.string().min(1, "Reason is required for deleting sessions"),
      });
      const input = schema.parse(req.body);
      
      const session = await storage.getWorkoutSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      await storage.adminDeleteWorkoutSession(sessionId, adminUser.userId, input.reason);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_session",
        entityId: sessionId,
        action: "admin_delete_session",
        oldValue: JSON.stringify({ focusLabel: session.focusLabel, date: session.date }),
        newValue: JSON.stringify({ isDeleted: true }),
        reason: input.reason,
      });
      
      res.json({ message: "Session deleted successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin delete session error:", err);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Add exercise to session
  app.post("/api/admin/workout/session/:sessionId/exercise/add", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const sessionId = parseInt(req.params.sessionId);
      
      const schema = z.object({
        exerciseName: z.string().min(1, "Exercise name is required"),
        sets: z.number().optional(),
        reps: z.number().optional(),
        weight: z.string().optional(),
        duration: z.number().optional(),
        reason: z.string().min(1, "Reason is required for adding exercises"),
      });
      const input = schema.parse(req.body);
      
      const session = await storage.getWorkoutSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const exercise = await storage.adminAddExercise({
        sessionId,
        exerciseName: input.exerciseName,
        sets: input.sets,
        reps: input.reps,
        weight: input.weight,
        duration: input.duration,
        adminId: adminUser.userId,
        reason: input.reason
      });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_exercise",
        entityId: exercise.id,
        action: "admin_add_exercise",
        oldValue: null,
        newValue: JSON.stringify({ exerciseName: input.exerciseName, sets: input.sets, reps: input.reps }),
        reason: input.reason,
      });
      
      res.json(exercise);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin add exercise error:", err);
      res.status(500).json({ message: "Failed to add exercise" });
    }
  });

  // Update exercise
  app.patch("/api/admin/workout/exercise/:exerciseId", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const exerciseId = parseInt(req.params.exerciseId);
      
      const schema = z.object({
        exerciseName: z.string().optional(),
        sets: z.number().optional(),
        reps: z.number().optional(),
        weight: z.string().optional(),
        duration: z.number().optional(),
        reason: z.string().min(1, "Reason is required for updating exercises"),
      });
      const input = schema.parse(req.body);
      
      const oldExercise = await storage.getWorkoutExerciseById(exerciseId);
      if (!oldExercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }
      
      const exercise = await storage.adminUpdateExercise(exerciseId, {
        exerciseName: input.exerciseName,
        sets: input.sets,
        reps: input.reps,
        weight: input.weight,
        duration: input.duration,
        adminId: adminUser.userId,
        reason: input.reason
      });
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_exercise",
        entityId: exerciseId,
        action: "admin_update_exercise",
        oldValue: JSON.stringify({ exerciseName: oldExercise.exerciseName, sets: oldExercise.sets, reps: oldExercise.reps }),
        newValue: JSON.stringify({ exerciseName: exercise.exerciseName, sets: exercise.sets, reps: exercise.reps }),
        reason: input.reason,
      });
      
      res.json(exercise);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin update exercise error:", err);
      res.status(500).json({ message: "Failed to update exercise" });
    }
  });

  // Delete exercise (soft delete)
  app.delete("/api/admin/workout/exercise/:exerciseId", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const exerciseId = parseInt(req.params.exerciseId);
      
      const schema = z.object({
        reason: z.string().min(1, "Reason is required for deleting exercises"),
      });
      const input = schema.parse(req.body);
      
      const exercise = await storage.getWorkoutExerciseById(exerciseId);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }
      
      await storage.adminDeleteExercise(exerciseId, adminUser.userId, input.reason);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_exercise",
        entityId: exerciseId,
        action: "admin_delete_exercise",
        oldValue: JSON.stringify({ exerciseName: exercise.exerciseName }),
        newValue: JSON.stringify({ isDeleted: true }),
        reason: input.reason,
      });
      
      res.json({ message: "Exercise deleted successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin delete exercise error:", err);
      res.status(500).json({ message: "Failed to delete exercise" });
    }
  });

  // Reorder exercises
  app.post("/api/admin/workout/session/:sessionId/exercises/reorder", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const sessionId = parseInt(req.params.sessionId);
      
      const schema = z.object({
        orderedExerciseIds: z.array(z.number()),
        reason: z.string().min(1, "Reason is required for reordering exercises"),
      });
      const input = schema.parse(req.body);
      
      const session = await storage.getWorkoutSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      await storage.adminReorderExercises(sessionId, input.orderedExerciseIds, adminUser.userId, input.reason);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "workout_session",
        entityId: sessionId,
        action: "admin_reorder_exercises",
        oldValue: null,
        newValue: JSON.stringify({ orderedExerciseIds: input.orderedExerciseIds }),
        reason: input.reason,
      });
      
      res.json({ message: "Exercises reordered successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Admin reorder exercises error:", err);
      res.status(500).json({ message: "Failed to reorder exercises" });
    }
  });

  // Recalculate member streaks
  app.post("/api/admin/members/:id/streak/recalculate", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const memberId = parseInt(req.params.id);
      
      const member = await storage.getUser(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const streaks = await storage.calculateMemberStreaks(memberId);
      
      // Log the action
      await storage.createAuditLog({
        adminId: adminUser.userId,
        entityType: "member",
        entityId: memberId,
        action: "admin_recalculate_streak",
        oldValue: null,
        newValue: JSON.stringify(streaks),
        reason: "Manual streak recalculation",
      });
      
      res.json(streaks);
    } catch (err) {
      console.error("Admin recalculate streak error:", err);
      res.status(500).json({ message: "Failed to recalculate streak" });
    }
  });

  // Admin: Get audit logs
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const filters: { entityType?: string; entityId?: number; adminId?: number } = {};
      
      if (req.query.entityType && typeof req.query.entityType === 'string') {
        filters.entityType = req.query.entityType;
      }
      if (req.query.entityId && typeof req.query.entityId === 'string') {
        filters.entityId = parseInt(req.query.entityId);
      }
      if (req.query.adminId && typeof req.query.adminId === 'string') {
        filters.adminId = parseInt(req.query.adminId);
      }
      
      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (err) {
      console.error("Admin get audit logs error:", err);
      res.status(500).json({ message: "Failed to get audit logs" });
    }
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
