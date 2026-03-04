import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, comparePasswords, generateMobileToken, generateLinkToken, verifyLinkToken, consumeLinkToken, mobileAuthMiddleware } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";
import passport from "passport";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import { generateOTP, getOTPExpiryTime, sendVerificationEmail, sendKioskOtpEmail, sendEmail } from "./email";
import { db } from "./db";
import { workoutLogs, workoutLogExercises, attendance, memberSubscriptions, membershipPlans, paymentTransactions, users, weeklyReports, userProfiles, gyms, dikaConversations, waterLogs, workoutCompletions, dikaChats, dikaChatMessages, dikaInsights, dikaActionFeed, walkInVisitors, trainerMemberAssignments, feedPosts, gymEquipment, equipmentExerciseMappings, payments, userGoals } from "@shared/schema";
import { eq, and, isNotNull, isNull, inArray, sql, desc, gte, lte, like, asc } from "drizzle-orm";
import { getLocalDate } from "./timezone";
import { handleDikaQuery, getSuggestionChips, getQuickActions, generateOwnerBriefing } from "./dika";
import { executeOwnerAction, executeSupportTicket, type ActionData } from "./dika/owner-actions";
import { findExercise } from "./dika/exercise-database";
import { searchFoodByName, lookupByBarcode, FoodProduct } from "./nutrition/open-food-facts";
import { searchLocalFoods } from "./nutrition/food-database";
import { lookupBarcodeLocal } from "./nutrition/barcode-database";
import { findRestaurantSuggestion, getSuggestionForGoal, getGeneralDikaMessage, GoalType } from "./nutrition/restaurant-suggestions";
import { insertFoodLogSchema, insertCalorieGoalSchema } from "@shared/schema";

function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, 'password'> {
  const { password, ...safeUser } = user;
  return safeUser;
}

function sanitizeUsers<T extends Record<string, any>>(users: T[]): Omit<T, 'password'>[] {
  return users.map(u => sanitizeUser(u));
}

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
  
  // Add mobile token authentication middleware (supports Bearer tokens for iOS/Android)
  app.use(mobileAuthMiddleware);

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
        aiDataConsent: z.boolean().optional().default(false),
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

      if (input.aiDataConsent) {
        await db.update(users)
          .set({ aiDataConsent: true, aiDataConsentDate: new Date() })
          .where(eq(users.id, user.id));
      }

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
        
        // Generate mobile token if requested via header
        const isMobileApp = req.headers["x-mobile-app"] === "true";
        const mobileToken = isMobileApp ? generateMobileToken(user.id) : undefined;
        
        return res.status(200).json({
          ...fullUser,
          subscriptionStatus,
          mobileToken
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

  app.post("/api/auth/guest", async (req, res) => {
    try {
      const guestId = nanoid(8);
      const guestUsername = `guest_${guestId}`;
      const guestPassword = await hashPassword(nanoid(32));

      const user = await storage.createUser({
        username: guestUsername,
        email: null,
        password: guestPassword,
        role: "member",
        gymId: null,
        emailVerified: true,
        isGuest: true,
      });

      req.login(user, async (err) => {
        if (err) {
          return res.status(500).json({ message: "Guest login failed" });
        }
        const fullUser = await storage.getUser(user.id);
        const isMobileApp = req.headers["x-mobile-app"] === "true";
        const mobileToken = isMobileApp ? generateMobileToken(user.id) : undefined;

        return res.status(201).json({
          ...sanitizeUser(fullUser!),
          mobileToken,
        });
      });
    } catch (err) {
      console.error("Guest login error:", err);
      res.status(500).json({ message: "Failed to create guest account" });
    }
  });

  app.post("/api/auth/convert-guest", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!req.user!.isGuest) {
      return res.status(400).json({ message: "Account is not a guest account" });
    }

    try {
      const schema = z.object({
        username: z.string()
          .min(4, "Username must be at least 4 characters")
          .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
        email: z.string().email("Invalid email format"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      const input = schema.parse(req.body);

      const existingByUsername = await storage.getUserByUsername(input.username.toLowerCase());
      if (existingByUsername && existingByUsername.id !== req.user!.id) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const existingByEmail = await storage.getUserByEmail(input.email);
      if (existingByEmail && existingByEmail.id !== req.user!.id) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(input.password);
      await db.update(users)
        .set({
          username: input.username.toLowerCase(),
          email: input.email,
          password: hashedPassword,
          isGuest: false,
          emailVerified: false,
        })
        .where(eq(users.id, req.user!.id));

      if (!DISABLE_EMAIL_VERIFICATION) {
        const verificationCode = generateOTP();
        const verificationExpiresAt = getOTPExpiryTime();
        await storage.updateUserVerificationCode(req.user!.id, verificationCode, verificationExpiresAt);
        await sendVerificationEmail(input.email, verificationCode);
      } else {
        await db.update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, req.user!.id));
      }

      const fullUser = await storage.getUser(req.user!.id);
      return res.status(200).json({
        ...sanitizeUser(fullUser!),
        message: DISABLE_EMAIL_VERIFICATION 
          ? "Account upgraded successfully!" 
          : "Account upgraded! Please verify your email.",
        requiresVerification: !DISABLE_EMAIL_VERIFICATION,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Guest conversion error:", err);
      res.status(500).json({ message: "Failed to upgrade account" });
    }
  });

  // === ACCOUNT DELETION (Apple Guideline 5.1.1) ===
  app.delete("/api/users/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user!.id;
    const userRole = req.user!.role;

    try {
      // Owners cannot delete their account if they own a gym with active members
      if (userRole === "owner") {
        const gym = await storage.getGymByOwnerId(userId);
        if (gym) {
          const memberCount = await storage.getGymMemberCount(gym.id);
          if (memberCount > 0) {
            return res.status(400).json({ 
              message: "Cannot delete account while you have active gym members. Please transfer or remove all members first." 
            });
          }
        }
      }

      // Delete user and all associated data (cascade)
      await storage.deleteUserAccount(userId);

      // Log user out and destroy session
      req.logout((err) => {
        if (err) {
          console.error("Logout error during account deletion:", err);
        }
        req.session.destroy((sessionErr) => {
          if (sessionErr) {
            console.error("Session destroy error:", sessionErr);
          }
          res.json({ message: "Account deleted successfully" });
        });
      });
    } catch (error) {
      console.error("Account deletion error:", error);
      res.status(500).json({ message: "Failed to delete account. Please try again or contact support." });
    }
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
      ...sanitizeUser(user!),
      subscriptionStatus
    });
  });

  app.post("/api/auth/link-token", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const token = generateLinkToken(req.user!.id);
    res.json({ token });
  });

  app.post("/api/auth/token-verify", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token required" });
      }
      const decoded = verifyLinkToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username, role: user.role });
    } catch {
      res.status(500).json({ message: "Token verification failed" });
    }
  });

  app.post("/api/auth/token-confirm", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token required" });
      }
      const decoded = verifyLinkToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      consumeLinkToken(token);
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json({ id: user.id, username: user.username, role: user.role });
      });
    } catch {
      res.status(500).json({ message: "Token login failed" });
    }
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
    // Support both session auth and JWT auth (for mobile apps)
    if (!req.isAuthenticated() && !req.user) return res.sendStatus(401);
    next();
  };

  const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
    // Support both session auth and JWT auth (for mobile apps)
    const isAuthenticated = req.isAuthenticated() || !!req.user;
    if (!isAuthenticated || !req.user || !roles.includes(req.user.role)) return res.sendStatus(403);
    next();
  };

  const requireAiConsent = async (req: any, res: any, next: any) => {
    if (!req.user) return res.sendStatus(401);
    const [user] = await db.select({ aiDataConsent: users.aiDataConsent }).from(users).where(eq(users.id, req.user.id));
    if (!user?.aiDataConsent) {
      return res.status(403).json({ message: "AI data consent required", code: "AI_CONSENT_REQUIRED" });
    }
    next();
  };

  // === OWNER ROUTES ===
  app.get("/api/owner/members", requireRole(["owner"]), async (req, res) => {
    const members = await storage.getGymMembers(req.user!.gymId!);
    res.json(sanitizeUsers(members));
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
    res.json(sanitizeUsers(trainers));
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
    const schema = z.object({ 
      trainerId: z.number().nullable().optional(),
      memberId: z.number(),
      trainingMode: z.enum(['trainer_led', 'self_guided']).default('trainer_led')
    });
    const input = schema.parse(req.body);
    
    // If trainer_led mode, trainerId is required
    if (input.trainingMode === 'trainer_led' && !input.trainerId) {
      return res.status(400).json({ message: "Trainer is required for trainer-led mode" });
    }
    
    const assignment = await storage.assignTrainerWithMode(
      input.trainerId || null, 
      input.memberId, 
      req.user!.gymId!, 
      input.trainingMode
    );
    res.status(201).json({ 
      success: true, 
      assignment,
      trainingMode: input.trainingMode,
      message: input.trainingMode === 'self_guided' 
        ? "Member set to self-guided mode" 
        : "Trainer assigned successfully"
    });
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

  // === QR CHECK-IN ROUTES ===

  app.get("/api/gym/checkin-qr", requireRole(["member"]), async (req, res) => {
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "You are not assigned to a gym" });
    }
    const gym = await storage.getGym(req.user!.gymId);
    if (!gym) {
      return res.status(404).json({ message: "Gym not found" });
    }
    res.json({ gymCode: gym.code, gymName: gym.name });
  });

  app.post("/api/attendance/scan-checkin", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ qr_data: z.string() });
    const input = schema.parse(req.body);

    if (!input.qr_data.startsWith("OGYM-CHECKIN:")) {
      return res.status(400).json({ message: "Invalid QR code format" });
    }

    const gymCode = input.qr_data.replace("OGYM-CHECKIN:", "").trim().toUpperCase();
    const gym = await storage.getGymByCode(gymCode);
    if (!gym || gym.id !== req.user!.gymId) {
      return res.status(403).json({ message: "Invalid gym code or you don't belong to this gym" });
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

  app.get("/api/owner/gym-qr-code", requireRole(["owner"]), async (req, res) => {
    const gym = await storage.getGym(req.user!.gymId!);
    if (!gym) {
      return res.status(404).json({ message: "Gym not found" });
    }
    res.json({
      qrData: `OGYM-CHECKIN:${gym.code}`,
      gymCode: gym.code,
      gymName: gym.name
    });
  });

  app.post("/api/owner/attendance/mark", requireRole(["owner"]), async (req, res) => {
    const schema = z.object({
      memberIds: z.array(z.number()).min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    });
    const input = schema.parse(req.body);

    let marked = 0;
    let alreadyPresent = 0;

    for (const memberId of input.memberIds) {
      const existing = await storage.getAttendanceByMemberDate(memberId, input.date);
      if (existing && existing.status === "present") {
        alreadyPresent++;
        continue;
      }
      await storage.markAttendance({
        gymId: req.user!.gymId!,
        memberId,
        date: input.date,
        status: "present",
        verifiedMethod: "manual",
        markedByUserId: req.user!.id
      });
      marked++;
    }

    res.json({ marked, alreadyPresent });
  });

  app.post("/api/trainer/attendance/mark", requireRole(["trainer"]), async (req, res) => {
    const schema = z.object({
      memberIds: z.array(z.number()).min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    });
    const input = schema.parse(req.body);

    const assignments = await storage.getTrainerMembers(req.user!.id);
    const assignedMemberIds = new Set(assignments.map(a => a.memberId));

    const unauthorized = input.memberIds.filter(id => !assignedMemberIds.has(id));
    if (unauthorized.length > 0) {
      return res.status(403).json({ message: "Some members are not assigned to you" });
    }

    let marked = 0;
    let alreadyPresent = 0;

    for (const memberId of input.memberIds) {
      const existing = await storage.getAttendanceByMemberDate(memberId, input.date);
      if (existing && existing.status === "present") {
        alreadyPresent++;
        continue;
      }
      await storage.markAttendance({
        gymId: req.user!.gymId!,
        memberId,
        date: input.date,
        status: "present",
        verifiedMethod: "manual",
        markedByUserId: req.user!.id
      });
      marked++;
    }

    res.json({ marked, alreadyPresent });
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

  // Ask Dika - AI-powered payment queries
  app.post("/api/owner/ask-dika-payments", requireRole(["owner"]), async (req, res) => {
    try {
      const bodySchema = z.object({
        question: z.string().min(1, "Question is required").max(500, "Question too long"),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { question } = parsed.data;

      const gymId = req.user!.gymId!;
      
      const subs = await db.select({
        id: memberSubscriptions.id,
        memberId: memberSubscriptions.memberId,
        startDate: memberSubscriptions.startDate,
        endDate: memberSubscriptions.endDate,
        totalAmount: memberSubscriptions.totalAmount,
        status: memberSubscriptions.status,
        paymentMode: memberSubscriptions.paymentMode,
        notes: memberSubscriptions.notes,
        memberUsername: users.username,
        planName: membershipPlans.name,
      }).from(memberSubscriptions)
        .leftJoin(users, eq(memberSubscriptions.memberId, users.id))
        .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
        .where(eq(memberSubscriptions.gymId, gymId));

      const transactions = await db.select({
        id: paymentTransactions.id,
        memberId: paymentTransactions.memberId,
        subscriptionId: paymentTransactions.subscriptionId,
        paidOn: paymentTransactions.paidOn,
        amountPaid: paymentTransactions.amountPaid,
        method: paymentTransactions.method,
        referenceNote: paymentTransactions.referenceNote,
        memberUsername: users.username,
      }).from(paymentTransactions)
        .leftJoin(users, eq(paymentTransactions.memberId, users.id))
        .where(eq(paymentTransactions.gymId, gymId));

      const gym = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
      const currency = gym[0]?.currency || 'USD';

      const today = new Date().toISOString().split('T')[0];

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const activeSubs = subs.filter(s => s.status !== 'ended');
      const endedSubs = subs.filter(s => s.status === 'ended');

      // Pre-compute payment summaries so the AI never has to do math
      const currencySymbols: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', AED: 'AED ', CAD: 'CA$', AUD: 'A$' };
      const sym = currencySymbols[currency] || `${currency} `;
      const fmt = (cents: number) => `${sym}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisWeekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString().split('T')[0];
      const last30Start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      const last90Start = new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0];

      // By method - all time
      const byMethod: Record<string, { count: number; total: number }> = {};
      transactions.forEach(t => {
        const m = t.method || 'unknown';
        if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
        byMethod[m].count++;
        byMethod[m].total += Number(t.amountPaid) || 0;
      });

      // Normalize paidOn to YYYY-MM-DD string for reliable date comparison
      const normDate = (d: string | Date | null | undefined): string => {
        if (!d) return '';
        const str = typeof d === 'string' ? d : d.toISOString();
        return str.substring(0, 10); // YYYY-MM-DD
      };

      // By period
      const periodStats = (startDate: string) => {
        const filtered = transactions.filter(t => normDate(t.paidOn) >= startDate);
        const total = filtered.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
        const methodBreakdown: Record<string, number> = {};
        filtered.forEach(t => {
          const m = t.method || 'unknown';
          methodBreakdown[m] = (methodBreakdown[m] || 0) + (Number(t.amountPaid) || 0);
        });
        return { count: filtered.length, total, methodBreakdown };
      };

      const allTimeTotal = transactions.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
      const thisMonthStats = periodStats(thisMonthStart);
      const thisWeekStats = periodStats(thisWeekStart);
      const last30Stats = periodStats(last30Start);
      const last90Stats = periodStats(last90Start);

      // Subscription status counts
      const statusCounts = {
        active: subs.filter(s => s.status === 'active').length,
        endingSoon: subs.filter(s => s.status === 'endingSoon').length,
        overdue: subs.filter(s => s.status === 'overdue').length,
        ended: endedSubs.length,
      };

      const precomputedSummaries = `
=== PRE-COMPUTED PAYMENT SUMMARIES (use these directly, do NOT recalculate) ===

TOTAL PAYMENTS RECEIVED (ALL TIME): ${fmt(allTimeTotal)} from ${transactions.length} transactions
BY PAYMENT METHOD (ALL TIME):
${Object.entries(byMethod).map(([method, data]) => `  - ${method}: ${fmt(data.total)} (${data.count} transactions)`).join('\n')}

THIS MONTH (since ${thisMonthStart}): ${fmt(thisMonthStats.total)} from ${thisMonthStats.count} transactions
${Object.entries(thisMonthStats.methodBreakdown).map(([m, t]) => `  - ${m}: ${fmt(t)}`).join('\n') || '  No transactions this month'}

THIS WEEK (since ${thisWeekStart}): ${fmt(thisWeekStats.total)} from ${thisWeekStats.count} transactions
${Object.entries(thisWeekStats.methodBreakdown).map(([m, t]) => `  - ${m}: ${fmt(t)}`).join('\n') || '  No transactions this week'}

LAST 30 DAYS: ${fmt(last30Stats.total)} from ${last30Stats.count} transactions
LAST 90 DAYS: ${fmt(last90Stats.total)} from ${last90Stats.count} transactions

SUBSCRIPTION STATUS OVERVIEW:
  - Active: ${statusCounts.active}
  - Ending Soon: ${statusCounts.endingSoon}
  - Overdue: ${statusCounts.overdue}
  - Ended/Completed: ${statusCounts.ended}
  - Total current (non-ended): ${activeSubs.length}
`;

      const systemPrompt = `You are Dika, an AI payment assistant for a gym management platform. You are accurate, data-driven, and never guess.

TODAY'S DATE: ${today}
CURRENCY: ${currency}

${precomputedSummaries}

=== CRITICAL RULES (MUST FOLLOW) ===
1. PAYMENT AMOUNTS vs SUBSCRIPTION AMOUNTS - these are DIFFERENT:
   - "Payment transactions" = actual money RECEIVED from members (amountPaid field). Use these for questions about revenue, income, cash received, method totals.
   - "Subscription totalAmount" = the PRICE of a subscription plan (what's owed). Use these ONLY for questions about plan pricing or outstanding balances.
   - NEVER confuse these two. When asked "how much did we get through cash", use PAYMENT TRANSACTIONS only.

2. FOR ANY TOTALS/SUMS QUESTION: Use the PRE-COMPUTED SUMMARIES above. Do NOT manually add up numbers. The summaries are mathematically verified.

3. All amounts in raw data are in smallest currency unit (cents/paise). Divide by 100 for display. The pre-computed summaries are already formatted correctly.

4. STATUS DEFINITIONS:
   - "active" = subscription currently running, not expiring soon
   - "endingSoon" = STILL ACTIVE but expires within 30 days
   - "overdue" = expired, member hasn't renewed
   - "ended" = fully concluded

5. For member-specific queries, match names case-insensitively with partial matching.

6. When asked about subscriptions "ending" in a month, check the endDate field across ALL statuses.

=== RAW DATA FOR DETAILED QUERIES ===

CURRENT SUBSCRIPTIONS (${activeSubs.length}):
${JSON.stringify(activeSubs.map(s => ({
  member: s.memberUsername,
  plan: s.planName,
  startDate: s.startDate,
  endDate: s.endDate,
  subscriptionPrice: s.totalAmount,
  status: s.status,
  paymentMode: s.paymentMode,
})), null, 0)}

PAST SUBSCRIPTIONS (${endedSubs.length}):
${JSON.stringify(endedSubs.map(s => ({
  member: s.memberUsername,
  plan: s.planName,
  startDate: s.startDate,
  endDate: s.endDate,
  subscriptionPrice: s.totalAmount,
  status: s.status,
})), null, 0)}

PAYMENT TRANSACTIONS - ACTUAL MONEY RECEIVED (${transactions.length}):
${JSON.stringify(transactions.map(t => ({
  member: t.memberUsername,
  amountPaid: t.amountPaid,
  date: t.paidOn,
  method: t.method,
  note: t.referenceNote,
})), null, 0)}

=== RESPONSE FORMAT ===
Return JSON:
{
  "answer": "Brief, accurate natural language answer",
  "results": [
    { "member": "username", "plan": "plan name", "period": "start - end", "amount": "formatted amount", "status": "status", "details": "extra info" }
  ],
  "summary": "One-line summary"
}
- For totals/summary questions, results can be empty - put the answer in "answer".
- For member lists, include each matching member in results.
- If no data matches, say so honestly. Never fabricate data.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || '{"answer":"Sorry, I could not process that question.","results":[],"summary":""}';
      
      try {
        const parsed = JSON.parse(responseText);
        res.json(parsed);
      } catch {
        res.json({ answer: responseText, results: [], summary: "" });
      }
    } catch (err: any) {
      console.error("Ask Dika payments error:", err);
      res.status(500).json({ message: "Failed to process your question" });
    }
  });

  // Ask Dika - Members page
  app.post("/api/owner/ask-dika-members", requireRole(["owner"]), async (req, res) => {
    try {
      const bodySchema = z.object({
        question: z.string().min(1).max(500),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { question } = parsed.data;
      const gymId = req.user!.gymId!;

      const membersList = await db.select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
      }).from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

      const profiles = await db.select({
        userId: userProfiles.userId,
        fullName: userProfiles.fullName,
      }).from(userProfiles)
        .where(inArray(userProfiles.userId, membersList.map(m => m.id)));
      const profileMap = new Map(profiles.map(p => [p.userId, p.fullName]));

      const assignments = await db.select({
        memberId: trainerMemberAssignments.memberId,
        trainerId: trainerMemberAssignments.trainerId,
      }).from(trainerMemberAssignments)
        .where(and(eq(trainerMemberAssignments.gymId, gymId), isNull(trainerMemberAssignments.endedAt)));
      const trainerIds = Array.from(new Set(assignments.map(a => a.trainerId)));
      let trainerNameMap = new Map<number, string>();
      if (trainerIds.length > 0) {
        const trainerUsers = await db.select({ id: users.id, username: users.username })
          .from(users).where(inArray(users.id, trainerIds));
        trainerNameMap = new Map(trainerUsers.map(t => [t.id, t.username]));
      }
      const memberTrainerMap = new Map(assignments.map(a => [a.memberId, trainerNameMap.get(a.trainerId) || 'Unknown']));

      const subs = await db.select({
        memberId: memberSubscriptions.memberId,
        status: memberSubscriptions.status,
        endDate: memberSubscriptions.endDate,
        planName: membershipPlans.name,
      }).from(memberSubscriptions)
        .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
        .where(and(eq(memberSubscriptions.gymId, gymId), sql`${memberSubscriptions.status} != 'ended'`));
      const subMap = new Map(subs.map(s => [s.memberId, s]));

      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const recentAttendance = await db.select({
        memberId: attendance.memberId,
        date: attendance.date,
      }).from(attendance)
        .where(and(eq(attendance.gymId, gymId), gte(attendance.date, weekAgo)));
      const lastCheckInMap = new Map<number, string>();
      recentAttendance.forEach(a => {
        const cur = lastCheckInMap.get(a.memberId);
        if (!cur || a.date > cur) lastCheckInMap.set(a.memberId, a.date);
      });
      const checkedInThisWeek = new Set(recentAttendance.map(a => a.memberId));

      const membersData = membersList.map(m => {
        const sub = subMap.get(m.id);
        return {
          username: m.username,
          fullName: profileMap.get(m.id) || null,
          joinedDate: m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : null,
          trainer: memberTrainerMap.get(m.id) || 'none',
          subscription: sub ? { plan: sub.planName, status: sub.status, endDate: sub.endDate } : null,
          lastCheckIn: lastCheckInMap.get(m.id) || 'no recent check-in',
          checkedInThisWeek: checkedInThisWeek.has(m.id),
        };
      });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are Dika, an AI assistant for gym member management. Today is ${today}.

MEMBER DATA (${membersData.length} members):
${JSON.stringify(membersData, null, 0)}

RESPONSE FORMAT (JSON):
{
  "answer": "Brief natural language answer",
  "results": [
    { "member": "username", "detail": "relevant info like trainer, subscription, last check-in" }
  ],
  "filterNames": ["username1", "username2"]
}
- "filterNames" should contain the usernames that match the query so the table can be filtered.
- For questions about counts/totals, results can be empty.
- Match names case-insensitively with partial matching.
- When asked "who hasn't checked in", look at checkedInThisWeek=false and lastCheckIn.
- When asked about expiring members, check subscription endDate.
- When asked about new members, check joinedDate.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || '{"answer":"Sorry, I could not process that.","results":[],"filterNames":[]}';
      try {
        const parsed = JSON.parse(responseText);
        res.json(parsed);
      } catch {
        res.json({ answer: responseText, results: [], filterNames: [] });
      }
    } catch (err: any) {
      console.error("Ask Dika members error:", err);
      res.status(500).json({ message: "Failed to process your question" });
    }
  });

  // Ask Dika - Attendance page
  app.post("/api/owner/ask-dika-attendance", requireRole(["owner"]), async (req, res) => {
    try {
      const bodySchema = z.object({
        question: z.string().min(1).max(500),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { question } = parsed.data;
      const gymId = req.user!.gymId!;

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

      const records = await db.select({
        memberId: attendance.memberId,
        date: attendance.date,
        status: attendance.status,
        verifiedMethod: attendance.verifiedMethod,
        memberUsername: users.username,
      }).from(attendance)
        .leftJoin(users, eq(attendance.memberId, users.id))
        .where(and(eq(attendance.gymId, gymId), gte(attendance.date, thirtyDaysAgo)));

      const allMembers = await db.select({
        id: users.id,
        username: users.username,
      }).from(users).where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

      const memberAttendanceSummary = allMembers.map(m => {
        const memberRecords = records.filter(r => r.memberId === m.id);
        const presentDays = memberRecords.filter(r => r.status === 'present').length;
        const lastCheckIn = memberRecords.length > 0
          ? memberRecords.sort((a, b) => b.date.localeCompare(a.date))[0].date
          : null;
        const daysSinceLastCheckIn = lastCheckIn
          ? Math.floor((Date.now() - new Date(lastCheckIn).getTime()) / 86400000)
          : null;
        return {
          username: m.username,
          totalPresent30Days: presentDays,
          lastCheckIn,
          daysSinceLastCheckIn,
          checkedInToday: memberRecords.some(r => r.date === today && r.status === 'present'),
        };
      });

      const todayCount = memberAttendanceSummary.filter(m => m.checkedInToday).length;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are Dika, an AI attendance assistant for a gym. Today is ${today}.

ATTENDANCE SUMMARY (last 30 days, ${allMembers.length} members):
- Checked in today: ${todayCount}
- Not checked in today: ${allMembers.length - todayCount}

MEMBER ATTENDANCE DATA:
${JSON.stringify(memberAttendanceSummary, null, 0)}

RESPONSE FORMAT (JSON):
{
  "answer": "Brief natural language answer",
  "results": [
    { "member": "username", "detail": "relevant attendance info" }
  ],
  "filterNames": ["username1", "username2"]
}
- "filterNames" should contain the usernames matching the query for table filtering.
- When asked "who hasn't checked in" for X days, check daysSinceLastCheckIn >= X.
- When asked about today's check-ins, use checkedInToday.
- When asked about absent members, look for high daysSinceLastCheckIn values.
- Match names case-insensitively with partial matching.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || '{"answer":"Sorry, I could not process that.","results":[],"filterNames":[]}';
      try {
        const parsed = JSON.parse(responseText);
        res.json(parsed);
      } catch {
        res.json({ answer: responseText, results: [], filterNames: [] });
      }
    } catch (err: any) {
      console.error("Ask Dika attendance error:", err);
      res.status(500).json({ message: "Failed to process your question" });
    }
  });

  // Ask Dika - Trainers page
  app.post("/api/owner/ask-dika-trainers", requireRole(["owner"]), async (req, res) => {
    try {
      const bodySchema = z.object({
        question: z.string().min(1).max(500),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { question } = parsed.data;
      const gymId = req.user!.gymId!;

      const trainers = await db.select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
      }).from(users).where(and(eq(users.gymId, gymId), eq(users.role, 'trainer')));

      const assignments = await db.select({
        trainerId: trainerMemberAssignments.trainerId,
        memberId: trainerMemberAssignments.memberId,
      }).from(trainerMemberAssignments)
        .where(and(eq(trainerMemberAssignments.gymId, gymId), isNull(trainerMemberAssignments.endedAt)));

      const memberIds = Array.from(new Set(assignments.map(a => a.memberId)));
      let memberNameMap = new Map<number, string>();
      if (memberIds.length > 0) {
        const memberUsers = await db.select({ id: users.id, username: users.username })
          .from(users).where(inArray(users.id, memberIds));
        memberNameMap = new Map(memberUsers.map(m => [m.id, m.username]));
      }

      const trainersData = trainers.map(t => {
        const trainerAssignments = assignments.filter(a => a.trainerId === t.id);
        return {
          trainerName: t.username,
          memberCount: trainerAssignments.length,
          members: trainerAssignments.map(a => memberNameMap.get(a.memberId) || 'Unknown'),
          joinedDate: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : null,
        };
      });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are Dika, an AI assistant for gym trainer management. Today is ${new Date().toISOString().split('T')[0]}.

TRAINER DATA (${trainersData.length} trainers):
${JSON.stringify(trainersData, null, 0)}

RESPONSE FORMAT (JSON):
{
  "answer": "Brief natural language answer",
  "results": [
    { "trainer": "trainer_name", "memberCount": 5, "members": "member1, member2, ..." }
  ],
  "filterNames": ["trainer_name1"]
}
- "filterNames" should contain the trainer usernames matching the query for filtering.
- When asked "which trainer has the most members", compare memberCount values.
- When asked about a specific member's trainer, search through each trainer's members array.
- Match names case-insensitively with partial matching.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || '{"answer":"Sorry, I could not process that.","results":[],"filterNames":[]}';
      try {
        const parsed = JSON.parse(responseText);
        res.json(parsed);
      } catch {
        res.json({ answer: responseText, results: [], filterNames: [] });
      }
    } catch (err: any) {
      console.error("Ask Dika trainers error:", err);
      res.status(500).json({ message: "Failed to process your question" });
    }
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

  // === MEMBER AI COACH ROUTES ===
  app.get("/api/member/ai/workout-insights", requireRole(["member"]), async (req, res) => {
    try {
      const { generateWorkoutInsights } = await import('./dika/member-ai-engine');
      const result = await generateWorkoutInsights(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate workout insights" });
    }
  });

  app.get("/api/member/ai/progress-summary", requireRole(["member"]), async (req, res) => {
    try {
      const { generateProgressSummary } = await import('./dika/member-ai-engine');
      const result = await generateProgressSummary(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate progress summary" });
    }
  });

  app.get("/api/member/ai/workout-suggestions", requireRole(["member"]), async (req, res) => {
    try {
      const { generateWorkoutSuggestions } = await import('./dika/member-ai-engine');
      const result = await generateWorkoutSuggestions(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate workout suggestions" });
    }
  });

  app.get("/api/member/ai/nutrition-coaching", requireRole(["member"]), async (req, res) => {
    try {
      const { generateNutritionCoaching } = await import('./dika/member-ai-engine');
      const result = await generateNutritionCoaching(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate nutrition coaching" });
    }
  });

  app.get("/api/member/ai/stats-interpretation", requireRole(["member"]), async (req, res) => {
    try {
      const { generateStatsInterpretation } = await import('./dika/member-ai-engine');
      const result = await generateStatsInterpretation(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate stats interpretation" });
    }
  });

  app.get("/api/member/ai/nudges", requireRole(["member"]), async (req, res) => {
    try {
      const { generateProactiveNudges } = await import('./dika/member-ai-engine');
      const clientDate = (req.query.clientDate as string) || getLocalDate(req);
      const result = await generateProactiveNudges(req.user!.id, clientDate);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate nudges" });
    }
  });

  // === TRAINER ROUTES ===
  app.get("/api/trainer/dashboard", requireRole(["trainer"]), async (req, res) => {
    try {
      const assignments = await storage.getTrainerMembers(req.user!.id);
      const totalMembers = assignments.length;
      const memberIds = assignments.map(a => a.memberId);
      
      const cycles = await storage.getTrainerCycles(req.user!.id);
      const activeWorkouts = cycles.filter((c: any) => c.isActive).length;
      
      const starMembers = await storage.getStarMembers(req.user!.id);

      const today = getLocalDate(req);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const recentActivity: { memberName: string; action: string; date: string }[] = [];
      const memberProgress: { memberId: number; memberName: string; streak: number; lastWorkout: string | null }[] = [];
      const atRiskMembers: { memberId: number; memberName: string; daysSinceLastWorkout: number; reason: string }[] = [];
      let todayCheckIns = 0;
      let weeklyActiveCount = 0;

      const allMembers = await storage.getGymMembers(req.user!.gymId!);
      const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));

      for (const member of assignedMembers) {
        const completions = await db.select().from(workoutCompletions)
          .where(eq(workoutCompletions.memberId, member.id))
          .orderBy(desc(workoutCompletions.completedDate))
          .limit(30);

        const attendanceRecords = await db.select().from(attendance)
          .where(eq(attendance.memberId, member.id))
          .orderBy(desc(attendance.date))
          .limit(14);

        const todayAttendance = attendanceRecords.find(a => a.date === today);
        if (todayAttendance) todayCheckIns++;

        const recentCompletions = completions.filter(c => c.completedDate >= sevenDaysAgoStr);
        if (recentCompletions.length > 0) weeklyActiveCount++;

        for (const c of recentCompletions.slice(0, 2)) {
          recentActivity.push({
            memberName: member.username,
            action: `Completed workout`,
            date: c.completedDate
          });
        }

        let streak = 0;
        const uniqueDates = [...new Set(completions.map(c => c.completedDate))].sort((a, b) => b.localeCompare(a));
        if (uniqueDates.length > 0) {
          const d = new Date(today);
          for (let i = 0; i < uniqueDates.length; i++) {
            const checkDate = d.toISOString().split('T')[0];
            if (uniqueDates.includes(checkDate)) {
              streak++;
              d.setDate(d.getDate() - 1);
            } else if (i === 0 && checkDate === today) {
              d.setDate(d.getDate() - 1);
              continue;
            } else {
              break;
            }
          }
        }

        memberProgress.push({
          memberId: member.id,
          memberName: member.username,
          streak,
          lastWorkout: completions.length > 0 ? completions[0].completedDate : null
        });

        if (completions.length > 0) {
          const lastDate = new Date(completions[0].completedDate);
          const diffDays = Math.floor((new Date(today).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 5) {
            atRiskMembers.push({
              memberId: member.id,
              memberName: member.username,
              daysSinceLastWorkout: diffDays,
              reason: diffDays >= 14 ? 'Inactive for 2+ weeks' : diffDays >= 7 ? 'No workout in a week' : 'Slowing down'
            });
          }
        } else if (completions.length === 0) {
          atRiskMembers.push({
            memberId: member.id,
            memberName: member.username,
            daysSinceLastWorkout: 999,
            reason: 'Never logged a workout'
          });
        }
      }

      recentActivity.sort((a, b) => b.date.localeCompare(a.date));

      res.json({
        totalMembers,
        activeWorkouts,
        starMembers: starMembers.length,
        todayCheckIns,
        weeklyActiveCount,
        complianceRate: totalMembers > 0 ? Math.round((weeklyActiveCount / totalMembers) * 100) : 0,
        recentActivity: recentActivity.slice(0, 8),
        memberProgress,
        atRiskMembers: atRiskMembers.sort((a, b) => b.daysSinceLastWorkout - a.daysSinceLastWorkout).slice(0, 6),
      });
    } catch (err) {
      console.error("Trainer dashboard error:", err);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.get("/api/trainer/ai-insights", requireRole(["trainer"]), async (req, res) => {
    try {
      const assignments = await storage.getTrainerMembers(req.user!.id);
      const memberIds = assignments.map(a => a.memberId);
      const today = getLocalDate(req);
      const allMembers = await storage.getGymMembers(req.user!.gymId!);
      const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));

      const cycles = await storage.getTrainerCycles(req.user!.id);
      const insights: { type: string; priority: 'high' | 'medium' | 'low'; title: string; description: string; memberName?: string; memberId?: number; action?: string }[] = [];

      let totalCompletions = 0;
      let activeThisWeek = 0;
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      for (const member of assignedMembers) {
        const completions = await db.select().from(workoutCompletions)
          .where(eq(workoutCompletions.memberId, member.id))
          .orderBy(desc(workoutCompletions.completedDate))
          .limit(20);

        const recentCompletions = completions.filter(c => c.completedDate >= sevenDaysAgoStr);
        totalCompletions += recentCompletions.length;
        if (recentCompletions.length > 0) activeThisWeek++;

        if (completions.length > 0) {
          const lastDate = new Date(completions[0].completedDate);
          const diffDays = Math.floor((new Date(today).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays >= 14) {
            insights.push({
              type: 'churn_risk',
              priority: 'high',
              title: `${member.username} hasn't trained in ${diffDays} days`,
              description: 'High churn risk. Send a personal message or adjust their program.',
              memberName: member.username,
              memberId: member.id,
              action: 'message'
            });
          } else if (diffDays >= 7) {
            insights.push({
              type: 'inactive',
              priority: 'medium',
              title: `${member.username} is going inactive`,
              description: `Last workout was ${diffDays} days ago. Check in with them.`,
              memberName: member.username,
              memberId: member.id,
              action: 'check_in'
            });
          }

          if (recentCompletions.length >= 5) {
            insights.push({
              type: 'star_performer',
              priority: 'low',
              title: `${member.username} is crushing it!`,
              description: `${recentCompletions.length} workouts this week. Consider leveling up their program.`,
              memberName: member.username,
              memberId: member.id,
              action: 'level_up'
            });
          }
        } else {
          const cycle = cycles.find((c: any) => c.memberId === member.id);
          if (!cycle) {
            insights.push({
              type: 'needs_plan',
              priority: 'high',
              title: `${member.username} has no workout plan`,
              description: 'Assign a workout cycle to get them started.',
              memberName: member.username,
              memberId: member.id,
              action: 'assign_plan'
            });
          }
        }
      }

      const inactiveCount = assignedMembers.length - activeThisWeek;
      if (inactiveCount > 0 && assignedMembers.length >= 3) {
        insights.unshift({
          type: 'summary',
          priority: inactiveCount > assignedMembers.length / 2 ? 'high' : 'medium',
          title: `${inactiveCount} of ${assignedMembers.length} members inactive this week`,
          description: `Only ${activeThisWeek} members trained. ${totalCompletions} total sessions logged.`,
          action: 'review'
        });
      }

      insights.sort((a, b) => {
        const prio = { high: 0, medium: 1, low: 2 };
        return prio[a.priority] - prio[b.priority];
      });

      res.json({
        insights: insights.slice(0, 8),
        summary: {
          totalMembers: assignedMembers.length,
          activeThisWeek,
          totalCompletions,
          complianceRate: assignedMembers.length > 0 ? Math.round((activeThisWeek / assignedMembers.length) * 100) : 0,
        }
      });
    } catch (err) {
      console.error("Trainer AI insights error:", err);
      res.status(500).json({ message: "Failed to load insights" });
    }
  });

  app.get("/api/trainer/members", requireRole(["trainer"]), async (req, res) => {
    const assignments = await storage.getTrainerMembers(req.user!.id);
    const memberIds = assignments.map(a => a.memberId);
    const allMembers = await storage.getGymMembers(req.user!.gymId!);
    const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));
    res.json(sanitizeUsers(assignedMembers));
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
      res.json(sanitizeUsers(newMembers));
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
      const phase = await storage.getTrainingPhaseById(phaseId);
      
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
      progressionMode: z.enum(["calendar", "completion"]).optional().default("calendar"),
      calorieTarget: z.number().min(500).max(10000).optional(),
    });
    const input = schema.parse(req.body);
    
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === input.memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const cycle = await storage.createWorkoutCycle({
      memberId: input.memberId,
      name: input.name,
      cycleLength: input.cycleLength,
      dayLabels: input.dayLabels,
      startDate: input.startDate,
      endDate: input.endDate,
      progressionMode: input.progressionMode,
      gymId: req.user!.gymId!,
      trainerId: req.user!.id
    });
    
    // If calorie target provided, set it for the member
    if (input.calorieTarget) {
      await storage.setCalorieGoalByTrainer(req.user!.id, input.memberId, {
        dailyCalorieTarget: input.calorieTarget,
      });
    }
    
    res.status(201).json(cycle);
  });

  // Trainer sets calorie target for a member
  app.post("/api/trainer/members/:memberId/calorie-goal", requireRole(["trainer"]), async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    const schema = z.object({
      dailyCalorieTarget: z.number().min(500).max(10000),
      dailyProteinTarget: z.number().optional(),
      dailyCarbsTarget: z.number().optional(),
      dailyFatTarget: z.number().optional(),
    });
    const input = schema.parse(req.body);
    
    const assignments = await storage.getTrainerMembers(req.user!.id);
    if (!assignments.some(a => a.memberId === memberId)) {
      return res.status(403).json({ message: "Member not assigned to you" });
    }
    
    const goal = await storage.setCalorieGoalByTrainer(req.user!.id, memberId, input);
    res.status(201).json(goal);
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
    const exerciseTypes = ["strength", "cardio"] as const;
    const schema = z.object({
      dayIndex: z.number().min(0),
      muscleType: z.enum(muscleTypes).default("Chest"),
      bodyPart: z.enum(bodyParts).default("Upper Body"),
      exerciseName: z.string(),
      exerciseType: z.enum(exerciseTypes).default("strength"),
      sets: z.number().min(1),
      reps: z.number().min(1),
      weight: z.string().optional(),
      durationMinutes: z.number().optional(),
      distanceKm: z.string().optional(),
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
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
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
      // workoutCompletions table doesn't have a status column - presence of record means completed
      const completedItemIds = new Set(completions.filter(c => c.workoutItemId != null).map(c => c.workoutItemId));
      const skippedItemIds = new Set<number>(); // No skip tracking in Personal Mode currently
      
      let effectiveDayIndex = cycle.currentDayIndex ?? 0;
      
      // For completion-based: if workout was already completed today, show the completed day
      let personalCompletedToday = false;
      if (cycle.progressionMode === "completion" && cycle.lastWorkoutDate === todayStr) {
        const prevDayIndex = (effectiveDayIndex - 1 + cycle.cycleLength) % cycle.cycleLength;
        effectiveDayIndex = prevDayIndex;
        personalCompletedToday = true;
      }
      
      // Auto-advance past rest days in completion mode
      if (cycle.progressionMode === "completion" && !personalCompletedToday && cycle.lastWorkoutDate) {
        const today = new Date(todayStr + 'T00:00:00');
        const lastWorkout = new Date(cycle.lastWorkoutDate);
        const daysSinceLastWorkout = Math.floor((today.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
        
        const currentLabel = cycle.dayLabels?.[effectiveDayIndex] || '';
        const currentDayItems = allItems.filter(item => item.dayIndex === effectiveDayIndex);
        const currentIsRest = cycle.restDays?.includes(effectiveDayIndex) || 
                              currentLabel.toLowerCase().includes('rest') ||
                              currentDayItems.length === 0;
        
        if (currentIsRest && daysSinceLastWorkout >= 2) {
          let nextIndex = (effectiveDayIndex + 1) % cycle.cycleLength;
          let safety = 0;
          while (safety < cycle.cycleLength) {
            const nextLabel = cycle.dayLabels?.[nextIndex] || '';
            const nextItems = allItems.filter(item => item.dayIndex === nextIndex);
            const nextIsRest = cycle.restDays?.includes(nextIndex) || 
                               nextLabel.toLowerCase().includes('rest') ||
                               nextItems.length === 0;
            if (!nextIsRest) break;
            nextIndex = (nextIndex + 1) % cycle.cycleLength;
            safety++;
          }
          effectiveDayIndex = nextIndex;
          await storage.updateCycleDayIndex(cycle.id, nextIndex);
        }
      }
      
      let effectiveItems = allItems.filter(item => item.dayIndex === effectiveDayIndex);
      let dayLabel = cycle.dayLabels?.[effectiveDayIndex] || `Day ${effectiveDayIndex + 1}`;
      
      // Check for SWAP/PUSH reorder overrides
      const scheduleOverride = await storage.getCycleScheduleOverrideForDate(req.user!.id, cycle.id, todayStr);
      if (scheduleOverride) {
        effectiveDayIndex = scheduleOverride.dayIndex;
        effectiveItems = allItems.filter(item => item.dayIndex === effectiveDayIndex);
        dayLabel = cycle.dayLabels?.[effectiveDayIndex] || `Day ${effectiveDayIndex + 1}`;
      }
      
      // Check if this is a rest day (from restDays array, day label, or no exercises)
      const isRestDay = (cycle.restDays?.includes(effectiveDayIndex)) || 
                        (dayLabel?.toLowerCase().includes("rest")) || 
                        effectiveItems.length === 0;
      
      // Check if day was manually marked as done (Personal Mode - gymId is null)
      const session = await storage.getWorkoutSessionByMemberDate(null, req.user!.id, todayStr);
      const dayManuallyCompleted = session?.isManuallyCompleted === true;
      
      const completionsByItemId = new Map(
        completions.filter(c => c.workoutItemId != null).map(c => [c.workoutItemId, c])
      );

      return res.json({
        items: effectiveItems.map(item => {
          const comp = completionsByItemId.get(item.id);
          const isCompleted = personalCompletedToday || dayManuallyCompleted || completedItemIds.has(item.id);
          const replacedName = comp?.exerciseName && comp.exerciseName !== item.exerciseName ? comp.exerciseName : null;
          return {
            ...item,
            exerciseName: replacedName || item.exerciseName,
            originalExerciseName: replacedName ? item.exerciseName : undefined,
            completed: isCompleted,
            skipped: skippedItemIds.has(item.id),
            actualSets: comp?.actualSets ?? undefined,
            actualReps: comp?.actualReps ?? undefined,
            actualWeight: comp?.actualWeight ?? undefined,
          };
        }),
        currentDayIndex: effectiveDayIndex,
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleLength: cycle.cycleLength,
        dayLabel,
        isRestDay,
        progressionMode: cycle.progressionMode,
        dayManuallyCompleted,
        completedTodayAlready: personalCompletedToday,
        hasReorderOverride: !!scheduleOverride
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
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    if (!cycle) return res.json({ items: [], message: "No active workout cycle" });
    
    const todayStr = getLocalDate(req);
    const today = new Date(todayStr + 'T00:00:00');
    const startDate = new Date(cycle.startDate);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Support both progression modes
    let currentDayIndex: number;
    let wasAutoReset = false;
    let completedTodayAlready = false;
    if (cycle.progressionMode === "completion") {
      // Completion-based: use stored currentDayIndex
      currentDayIndex = cycle.currentDayIndex ?? 0;
      
      // Check if workout was already completed today (day index was advanced today)
      // If so, show the PREVIOUS day (the one just completed) instead of jumping ahead
      if (cycle.lastWorkoutDate === todayStr) {
        // Day was already advanced today - show the completed day instead
        const prevDayIndex = (currentDayIndex - 1 + cycle.cycleLength) % cycle.cycleLength;
        currentDayIndex = prevDayIndex;
        completedTodayAlready = true;
      }
      
      // Auto-advance past rest days: if current day is a rest day and at least 1 day has passed,
      // move to the next workout day automatically (rest days get exactly 1 day)
      if (!completedTodayAlready && cycle.lastWorkoutDate) {
        const lastWorkout = new Date(cycle.lastWorkoutDate);
        const daysSinceLastWorkout = Math.floor((today.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
        
        const currentLabel = cycle.dayLabels?.[currentDayIndex] || '';
        const currentIsRest = cycle.restDays?.includes(currentDayIndex) || 
                              currentLabel.toLowerCase().includes('rest');
        
        if (currentIsRest && daysSinceLastWorkout >= 2) {
          // Rest day has had its day — advance to the next day
          let nextIndex = (currentDayIndex + 1) % cycle.cycleLength;
          // Skip consecutive rest days (rare but possible)
          let safety = 0;
          while (safety < cycle.cycleLength) {
            const nextLabel = cycle.dayLabels?.[nextIndex] || '';
            const nextIsRest = cycle.restDays?.includes(nextIndex) || 
                               nextLabel.toLowerCase().includes('rest');
            if (!nextIsRest) break;
            nextIndex = (nextIndex + 1) % cycle.cycleLength;
            safety++;
          }
          currentDayIndex = nextIndex;
          await storage.updateCycleDayIndex(cycle.id, nextIndex);
        }
        
        // Auto-reset logic: if member missed more than 3 consecutive days, reset to day 0
        if (daysSinceLastWorkout > 3 && currentDayIndex !== 0) {
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
    const gymCompletionsByItemId = new Map(
      completions.filter(c => c.workoutItemId != null).map(c => [c.workoutItemId, c])
    );
    
    const itemsWithStatus = items.map(i => {
      const comp = gymCompletionsByItemId.get(i.id);
      const replacedName = comp?.exerciseName && comp.exerciseName !== i.exerciseName ? comp.exerciseName : null;
      return {
        ...i,
        exerciseName: replacedName || i.exerciseName,
        originalExerciseName: replacedName ? i.exerciseName : undefined,
        completed: completedIds.has(i.id),
        actualSets: comp?.actualSets ?? undefined,
        actualReps: comp?.actualReps ?? undefined,
        actualWeight: comp?.actualWeight ?? undefined,
      };
    });
    
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
    
    // Check for SWAP/PUSH reorder overrides
    const scheduleOverride = await storage.getCycleScheduleOverrideForDate(req.user!.id, cycle.id, todayStr);
    if (scheduleOverride) {
      effectiveDayIndex = scheduleOverride.dayIndex;
      const reorderedItems = await storage.getWorkoutItemsByDay(cycle.id, effectiveDayIndex);
      const reorderedItemsWithStatus = reorderedItems.map(i => ({
        ...i,
        completed: completedIds.has(i.id)
      }));
      effectiveItems = reorderedItemsWithStatus;
      effectiveIsRestDay = reorderedItems.length === 0;
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
      cycleId: cycle.id,
      cycleName: cycle.name, 
      currentDayIndex: effectiveDayIndex,
      dayIndex: effectiveDayIndex, 
      cycleLength: cycle.cycleLength,
      dayLabel: activeSwap ? cycle.dayLabels?.[effectiveDayIndex] || null : dayLabel,
      isRestDay: effectiveIsRestDay,
      items: effectiveItems,
      swap: swapInfo,
      canSwapRestDay,
      tomorrowDayIndex,
      progressionMode: cycle.progressionMode || "calendar",
      wasAutoReset,
      completedTodayAlready,
      hasReorderOverride: !!scheduleOverride
    });
  });
  
  // Advance day index for completion-based progression
  app.post("/api/workouts/advance-day", requireRole(["member"]), async (req, res) => {
    // Use appropriate source based on whether user has a gym
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
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
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
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

  // REST TODAY - User wants to rest on a scheduled workout day
  // For completion-based: logs rest, does NOT advance day
  // For calendar-based: logs rest, schedule unchanged (just marking intent)
  app.post("/api/workouts/rest-today", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      cycleId: z.number().optional(),
      adjustPlan: z.enum(["none", "swap_next_rest", "push_workout"]).optional().default("none"),
      notes: z.string().optional()
    });
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request", errors: input.error.errors });
    }
    
    const { adjustPlan, notes } = input.data;
    const todayStr = getLocalDate(req);
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    
    if (!cycle) {
      return res.status(400).json({ message: "No active workout cycle" });
    }
    
    // Calculate current day index
    let currentDayIndex: number;
    if (cycle.progressionMode === "completion") {
      currentDayIndex = cycle.currentDayIndex ?? 0;
    } else {
      const today = new Date(todayStr + 'T00:00:00');
      const startDate = new Date(cycle.startDate);
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    }
    
    // Check if already rested today
    const existingAction = await storage.getCycleDayActionForDate(req.user!.id, cycle.id, todayStr);
    if (existingAction && existingAction.action === 'rest') {
      return res.json({ message: "Already marked as rest day", action: existingAction });
    }
    
    // Get all items to understand the cycle structure
    const allItems = await storage.getWorkoutItems(cycle.id);
    
    // Check if today is already a rest day (no exercises)
    const currentDayItems = allItems.filter(item => item.dayIndex === currentDayIndex);
    const currentLabel = cycle.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
    const isCurrentRestDay = cycle.restDays?.includes(currentDayIndex) || 
                              currentLabel.toLowerCase().includes("rest") || 
                              currentDayItems.length === 0;
    
    // If already a rest day, just log rest (adjustPlan doesn't apply)
    if (isCurrentRestDay) {
      const action = await storage.createCycleDayAction({
        gymId: req.user!.gymId || null,
        memberId: req.user!.id,
        cycleId: cycle.id,
        date: todayStr,
        action: 'rest',
        originalDayIndex: currentDayIndex,
        notes: notes || null
      });
      
      return res.json({ 
        message: "Rest day logged", 
        action,
        progressionMode: cycle.progressionMode,
        note: "Today was already a scheduled rest day."
      });
    }
    
    // Today is a WORKOUT day - handle adjustPlan options
    
    if (adjustPlan === "none") {
      // Just log rest, don't adjust schedule
      const action = await storage.createCycleDayAction({
        gymId: req.user!.gymId || null,
        memberId: req.user!.id,
        cycleId: cycle.id,
        date: todayStr,
        action: 'rest',
        originalDayIndex: currentDayIndex,
        notes: notes || null
      });
      
      return res.json({ 
        message: "Rest day logged", 
        action,
        progressionMode: cycle.progressionMode,
        note: cycle.progressionMode === 'completion' 
          ? "Your next workout will be the same planned workout." 
          : "Your schedule remains unchanged."
      });
    }
    
    // Build list of workout days and rest days
    const workoutDays: number[] = [];
    const restDays: number[] = [];
    for (let i = 0; i < cycle.cycleLength; i++) {
      const dayItems = allItems.filter(item => item.dayIndex === i);
      const label = cycle.dayLabels?.[i] || `Day ${i + 1}`;
      const isRest = cycle.restDays?.includes(i) || label.toLowerCase().includes("rest") || dayItems.length === 0;
      if (isRest) {
        restDays.push(i);
      } else {
        workoutDays.push(i);
      }
    }
    
    // Clear any existing overrides from today onwards
    await storage.clearCycleScheduleOverrides(req.user!.id, cycle.id, todayStr);
    
    if (adjustPlan === "swap_next_rest") {
      // SWAP: Today's workout swaps with the NEXT rest day
      // Find the next rest day in the cycle (after current position)
      
      if (restDays.length === 0) {
        return res.status(400).json({ message: "No rest day in cycle to swap with" });
      }
      
      // Find next rest day after current position
      let nextRestDayIndex: number | null = null;
      for (const restIdx of restDays) {
        if (restIdx > currentDayIndex) {
          nextRestDayIndex = restIdx;
          break;
        }
      }
      // If no rest day after current, wrap around
      if (nextRestDayIndex === null) {
        nextRestDayIndex = restDays[0];
      }
      
      const nextRestLabel = cycle.dayLabels?.[nextRestDayIndex] || `Day ${nextRestDayIndex + 1}`;
      
      if (cycle.progressionMode === "completion") {
        // COMPLETION MODE SWAP
        // Today becomes rest, the rest day slot gets today's workout
        // Create override: today = rest (mark via action)
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'rest',
          originalDayIndex: currentDayIndex,
          notes: notes || `Swapped with ${nextRestLabel}`
        });
        
        // Create schedule override: when we reach nextRestDayIndex position, do currentDayIndex workout
        const daysUntilNextRest = nextRestDayIndex > currentDayIndex 
          ? nextRestDayIndex - currentDayIndex 
          : cycle.cycleLength - currentDayIndex + nextRestDayIndex;
        
        const swapDate = new Date(todayStr + 'T00:00:00');
        swapDate.setDate(swapDate.getDate() + daysUntilNextRest);
        const swapDateStr = swapDate.toISOString().split('T')[0];
        
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: swapDateStr,
          dayIndex: currentDayIndex, // Today's workout moves to this day
          action: 'swap',
          originalDayIndex: nextRestDayIndex
        });
        
        return res.json({
          message: `Resting today. ${currentLabel} moved to ${nextRestLabel}'s slot.`,
          action,
          adjustPlan: "swap_next_rest",
          progressionMode: cycle.progressionMode,
          swappedTo: { dayIndex: nextRestDayIndex, label: nextRestLabel }
        });
        
      } else {
        // CALENDAR MODE SWAP
        // Today becomes rest, next rest date becomes today's workout
        const today = new Date(todayStr + 'T00:00:00');
        const startDate = new Date(cycle.startDate);
        
        // Find the date of the next rest day
        let nextRestDate: Date | null = null;
        for (let offset = 1; offset < cycle.cycleLength * 2; offset++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() + offset);
          const daysSinceStart = Math.floor((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const dayIdx = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
          
          if (restDays.includes(dayIdx)) {
            nextRestDate = checkDate;
            break;
          }
        }
        
        if (!nextRestDate) {
          return res.status(400).json({ message: "No rest day found in upcoming schedule" });
        }
        
        const nextRestDateStr = nextRestDate.toISOString().split('T')[0];
        
        // Log rest action for today
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'rest',
          originalDayIndex: currentDayIndex,
          notes: notes || `Swapped with rest on ${nextRestDateStr}`
        });
        
        // Override today to be rest
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          dayIndex: nextRestDayIndex!, // Rest day index
          action: 'swap',
          originalDayIndex: currentDayIndex
        });
        
        // Override next rest date to be today's workout
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: nextRestDateStr,
          dayIndex: currentDayIndex, // Today's workout
          action: 'swap',
          originalDayIndex: nextRestDayIndex!
        });
        
        return res.json({
          message: `Resting today. ${currentLabel} moved to ${nextRestDateStr}.`,
          action,
          adjustPlan: "swap_next_rest",
          progressionMode: cycle.progressionMode,
          swappedTo: { date: nextRestDateStr }
        });
      }
      
    } else if (adjustPlan === "push_workout") {
      // PUSH: Today's workout pushed later, all workouts between pull earlier
      // Rest goes to today, workouts shift
      
      if (cycle.progressionMode === "completion") {
        // COMPLETION MODE PUSH
        // Today = rest, push currentDayIndex to end of remaining workout block
        // All workouts after current position shift earlier by 1
        
        // Find next rest day position in sequence
        let nextRestPos = -1;
        for (let i = currentDayIndex + 1; i < cycle.cycleLength; i++) {
          if (restDays.includes(i)) {
            nextRestPos = i;
            break;
          }
        }
        
        // Log rest for today
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'rest',
          originalDayIndex: currentDayIndex,
          notes: notes || "Pushed workout, taking rest today"
        });
        
        // Create overrides: shift workouts earlier, push current workout to end
        // Example: Mon(Chest) Tue(Back) Wed(Shoulders) Thu(Rest)
        // Push on Mon => Mon(Rest) Tue(Chest) Wed(Back) Thu(Shoulders)
        
        const endPos = nextRestPos !== -1 ? nextRestPos : cycle.cycleLength;
        let dateOffset = 1;
        
        // Shift all workout days between current+1 and endPos earlier by one slot
        for (let i = currentDayIndex + 1; i < endPos; i++) {
          if (restDays.includes(i)) continue; // Skip rest days in the sequence
          
          const shiftDate = new Date(todayStr + 'T00:00:00');
          shiftDate.setDate(shiftDate.getDate() + dateOffset);
          const shiftDateStr = shiftDate.toISOString().split('T')[0];
          
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId: cycle.id,
            date: shiftDateStr,
            dayIndex: i, // This workout moves earlier
            action: 'push',
            originalDayIndex: i
          });
          dateOffset++;
        }
        
        // Current workout goes to where rest was (or end of block)
        const pushedDate = new Date(todayStr + 'T00:00:00');
        pushedDate.setDate(pushedDate.getDate() + dateOffset);
        const pushedDateStr = pushedDate.toISOString().split('T')[0];
        
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: pushedDateStr,
          dayIndex: currentDayIndex, // Today's workout pushed here
          action: 'push',
          originalDayIndex: nextRestPos !== -1 ? nextRestPos : currentDayIndex
        });
        
        return res.json({
          message: `Resting today. ${currentLabel} pushed to later in schedule.`,
          action,
          adjustPlan: "push_workout",
          progressionMode: cycle.progressionMode
        });
        
      } else {
        // CALENDAR MODE PUSH
        // Today = rest, tomorrow = today's workout, subsequent days shift forward
        // Until we reach the next rest day, which absorbs the shift
        
        const today = new Date(todayStr + 'T00:00:00');
        const startDate = new Date(cycle.startDate);
        
        // Find next rest date
        let nextRestOffset = -1;
        for (let offset = 1; offset < cycle.cycleLength * 2; offset++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() + offset);
          const daysSinceStart = Math.floor((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const dayIdx = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
          
          if (restDays.includes(dayIdx)) {
            nextRestOffset = offset;
            break;
          }
        }
        
        // Log rest for today
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'rest',
          originalDayIndex: currentDayIndex,
          notes: notes || "Pushed workout, taking rest today"
        });
        
        // Override today as rest (use any rest day index)
        const restDayIndex = restDays.length > 0 ? restDays[0] : currentDayIndex;
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          dayIndex: restDayIndex,
          action: 'push',
          originalDayIndex: currentDayIndex
        });
        
        // Shift each day from tomorrow to nextRestOffset
        // Tomorrow gets today's workout, day after gets tomorrow's original, etc.
        const endOffset = nextRestOffset !== -1 ? nextRestOffset : cycle.cycleLength;
        
        for (let offset = 1; offset <= endOffset; offset++) {
          const shiftDate = new Date(today);
          shiftDate.setDate(shiftDate.getDate() + offset);
          const shiftDateStr = shiftDate.toISOString().split('T')[0];
          
          // Calculate what workout should be on this shifted date
          // It should be the workout that WAS scheduled for (offset - 1) days from today
          const originalDate = new Date(today);
          originalDate.setDate(originalDate.getDate() + offset - 1);
          const originalDaysSinceStart = Math.floor((originalDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const originalDayIdx = originalDaysSinceStart >= 0 ? originalDaysSinceStart % cycle.cycleLength : 0;
          
          // Skip if original was a rest day (we're eating into it)
          if (restDays.includes(originalDayIdx) && offset > 1) {
            break; // Stop shifting at the rest day boundary
          }
          
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId: cycle.id,
            date: shiftDateStr,
            dayIndex: originalDayIdx,
            action: 'push',
            originalDayIndex: originalDayIdx
          });
        }
        
        return res.json({
          message: `Resting today. ${currentLabel} pushed to tomorrow, schedule shifted.`,
          action,
          adjustPlan: "push_workout",
          progressionMode: cycle.progressionMode
        });
      }
    }
    
    // Fallback (shouldn't reach here)
    return res.status(400).json({ message: "Invalid adjustPlan option" });
  });

  // TRAIN ANYWAY - User wants to train on a planned rest day
  // For completion-based: User picks which workout day to do, then that day advances
  // For calendar-based: Logs extra workout without changing schedule
  app.post("/api/workouts/train-anyway", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      dayIndex: z.number().optional(), // Which workout day to perform (for completion mode)
      asExtra: z.boolean().optional() // For calendar mode: true = extra workout, false = swap
    });
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request", errors: input.error.errors });
    }
    
    const todayStr = getLocalDate(req);
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    
    if (!cycle) {
      return res.status(400).json({ message: "No active workout cycle" });
    }
    
    // For completion-based: allow training any uncompleted day
    if (cycle.progressionMode === "completion") {
      const targetDayIndex = input.data.dayIndex ?? (cycle.currentDayIndex ?? 0);
      
      // Verify this day exists and has exercises
      const items = await storage.getWorkoutItemsByDay(cycle.id, targetDayIndex);
      if (items.length === 0) {
        return res.status(400).json({ message: "Selected day has no exercises" });
      }
      
      // Log the action
      const action = await storage.createCycleDayAction({
        gymId: req.user!.gymId || null,
        memberId: req.user!.id,
        cycleId: cycle.id,
        date: todayStr,
        action: 'train_anyway',
        originalDayIndex: cycle.currentDayIndex ?? 0,
        performedDayIndex: targetDayIndex
      });
      
      res.json({
        message: "Training on rest day - do selected workout",
        action,
        dayIndex: targetDayIndex,
        dayLabel: cycle.dayLabels?.[targetDayIndex] || `Day ${targetDayIndex + 1}`,
        items
      });
    } else {
      // Calendar-based: offer extra workout or swap
      const asExtra = input.data.asExtra !== false; // Default to extra workout
      
      if (asExtra) {
        // Extra workout - doesn't change schedule
        const nextWorkoutDayIndex = await findNextWorkoutDay(cycle, todayStr);
        const items = nextWorkoutDayIndex !== null 
          ? await storage.getWorkoutItemsByDay(cycle.id, nextWorkoutDayIndex)
          : [];
        
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'extra',
          originalDayIndex: null, // It was a rest day
          performedDayIndex: nextWorkoutDayIndex
        });
        
        res.json({
          message: "Extra workout logged - schedule unchanged",
          action,
          dayIndex: nextWorkoutDayIndex,
          dayLabel: nextWorkoutDayIndex !== null 
            ? cycle.dayLabels?.[nextWorkoutDayIndex] || `Day ${nextWorkoutDayIndex + 1}`
            : null,
          items
        });
      } else {
        // Swap with next workout day
        return res.status(400).json({ 
          message: "Use reschedule endpoint for swap operations" 
        });
      }
    }
  });

  // Helper function to find next workout day in a cycle
  async function findNextWorkoutDay(cycle: any, fromDate: string): Promise<number | null> {
    const today = new Date(fromDate + 'T00:00:00');
    const startDate = new Date(cycle.startDate);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    
    // Look for next non-rest day in the cycle
    for (let offset = 0; offset < cycle.cycleLength; offset++) {
      const dayIdx = (currentDayIndex + offset) % cycle.cycleLength;
      if (!cycle.restDays?.includes(dayIdx)) {
        const items = await storage.getWorkoutItemsByDay(cycle.id, dayIdx);
        if (items.length > 0) {
          return dayIdx;
        }
      }
    }
    return null;
  }

  // RESCHEDULE - For calendar-based cycles only
  // Allows swapping, moving, or skipping scheduled workouts
  app.post("/api/workouts/reschedule", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      action: z.enum(['swap_rest', 'move_tomorrow', 'skip', 'swap_next_workout']),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    });
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request", errors: input.error.errors });
    }
    
    const todayStr = getLocalDate(req);
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    
    if (!cycle) {
      return res.status(400).json({ message: "No active workout cycle" });
    }
    
    if (cycle.progressionMode !== "calendar") {
      return res.status(400).json({ 
        message: "Reschedule is only for calendar-based cycles. Use rest-today for completion-based cycles."
      });
    }
    
    const today = new Date(todayStr + 'T00:00:00');
    const startDate = new Date(cycle.startDate);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    
    switch (input.data.action) {
      case 'swap_rest': {
        // Swap today's workout with the next rest day
        let nextRestDayOffset = null;
        for (let offset = 1; offset < cycle.cycleLength; offset++) {
          const dayIdx = (currentDayIndex + offset) % cycle.cycleLength;
          if (cycle.restDays?.includes(dayIdx)) {
            nextRestDayOffset = offset;
            break;
          }
        }
        
        if (nextRestDayOffset === null) {
          return res.status(400).json({ message: "No rest day found in cycle to swap with" });
        }
        
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + nextRestDayOffset);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const targetDayIndex = (currentDayIndex + nextRestDayOffset) % cycle.cycleLength;
        
        // Create swap override
        await storage.createScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          swapDate: todayStr,
          targetDate: targetDateStr,
          targetDayIndex: currentDayIndex // Move today's workout to target date
        });
        
        // Log the reschedule action
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'reschedule',
          originalDayIndex: currentDayIndex,
          targetDate: targetDateStr,
          notes: 'Swapped with rest day'
        });
        
        res.json({
          message: `Workout moved to ${targetDateStr}. Today is now a rest day.`,
          action,
          newRestDay: todayStr,
          newWorkoutDay: targetDateStr
        });
        break;
      }
      
      case 'move_tomorrow': {
        // Move today's workout to tomorrow, shift schedule forward
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        // Create override to push today's workout to tomorrow
        await storage.createScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          swapDate: todayStr,
          targetDate: tomorrowStr,
          targetDayIndex: currentDayIndex
        });
        
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'reschedule',
          originalDayIndex: currentDayIndex,
          targetDate: tomorrowStr,
          notes: 'Moved to tomorrow'
        });
        
        res.json({
          message: `Workout moved to tomorrow (${tomorrowStr})`,
          action
        });
        break;
      }
      
      case 'skip': {
        // Mark as missed/skipped
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'rest', // Using rest action to mark as skipped
          originalDayIndex: currentDayIndex,
          notes: 'Workout skipped'
        });
        
        res.json({
          message: "Workout skipped. Schedule continues as normal.",
          action
        });
        break;
      }
      
      case 'swap_next_workout': {
        // On a rest day, swap with the next workout day
        let nextWorkoutOffset = null;
        for (let offset = 1; offset < cycle.cycleLength; offset++) {
          const dayIdx = (currentDayIndex + offset) % cycle.cycleLength;
          if (!cycle.restDays?.includes(dayIdx)) {
            const items = await storage.getWorkoutItemsByDay(cycle.id, dayIdx);
            if (items.length > 0) {
              nextWorkoutOffset = offset;
              break;
            }
          }
        }
        
        if (nextWorkoutOffset === null) {
          return res.status(400).json({ message: "No workout day found to swap with" });
        }
        
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + nextWorkoutOffset);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const targetDayIndex = (currentDayIndex + nextWorkoutOffset) % cycle.cycleLength;
        
        // Create swap override - do the future workout today
        await storage.createScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          swapDate: todayStr,
          targetDate: targetDateStr,
          targetDayIndex: targetDayIndex // Bring future workout to today
        });
        
        const action = await storage.createCycleDayAction({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId: cycle.id,
          date: todayStr,
          action: 'reschedule',
          originalDayIndex: currentDayIndex,
          performedDayIndex: targetDayIndex,
          targetDate: targetDateStr,
          notes: 'Swapped rest day with workout'
        });
        
        // Get items for the swapped workout
        const items = await storage.getWorkoutItemsByDay(cycle.id, targetDayIndex);
        
        res.json({
          message: `Doing ${cycle.dayLabels?.[targetDayIndex] || 'Day ' + (targetDayIndex + 1)} today. ${targetDateStr} will be rest.`,
          action,
          dayIndex: targetDayIndex,
          dayLabel: cycle.dayLabels?.[targetDayIndex] || `Day ${targetDayIndex + 1}`,
          items
        });
        break;
      }
    }
  });

  // Get available workout days for "pick different day" in completion mode
  // Query param: forRestDay=true returns only workout days (not rest days) for rest day swaps
  app.get("/api/workouts/available-days", requireRole(["member"]), async (req, res) => {
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    const forRestDay = req.query.forRestDay === 'true';
    
    if (!cycle) {
      return res.json({ days: [] });
    }
    
    const allItems = await storage.getWorkoutItems(cycle.id);
    const dayGroups = new Map<number, { label: string; exerciseCount: number; isRestDay: boolean; exercises?: string[] }>();
    
    for (let dayIdx = 0; dayIdx < cycle.cycleLength; dayIdx++) {
      const dayItems = allItems.filter(item => item.dayIndex === dayIdx);
      const label = cycle.dayLabels?.[dayIdx] || `Day ${dayIdx + 1}`;
      const isRestDay = cycle.restDays?.includes(dayIdx) || 
                        label.toLowerCase().includes("rest") || 
                        dayItems.length === 0;
      
      dayGroups.set(dayIdx, {
        label,
        exerciseCount: dayItems.length,
        isRestDay,
        exercises: dayItems.map(item => item.exerciseName)
      });
    }
    
    let days = Array.from(dayGroups.entries()).map(([dayIndex, info]) => ({
      dayIndex,
      ...info
    }));
    
    // If forRestDay=true, filter to only return workout days (not rest days)
    if (forRestDay) {
      days = days.filter(d => !d.isRestDay);
    }
    
    res.json({ 
      days,
      currentDayIndex: cycle.currentDayIndex ?? 0,
      cycleLength: cycle.cycleLength,
      progressionMode: cycle.progressionMode
    });
  });

  // REORDER - "Do Another Workout" with SWAP or PUSH
  // Works for both trainer-assigned and personal cycles
  // Works for both completion-based and calendar-based cycles
  // Also supports rest day reorder: swap a rest day with a workout day
  app.post("/api/workouts/reorder", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      cycleId: z.number(),
      targetDayIndex: z.number(), // The day the user wants to do instead
      action: z.enum(["swap", "push"]),
      isRestDayReorder: z.boolean().optional().default(false) // True if we're swapping a rest day with a workout day
    });
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request", errors: input.error.errors });
    }
    
    const { cycleId, targetDayIndex, action, isRestDayReorder } = input.data;
    const todayStr = getLocalDate(req);
    
    // Verify the cycle belongs to this user
    const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' : 'self';
    const cycle = await storage.getMemberCycle(req.user!.id, source);
    
    if (!cycle || cycle.id !== cycleId) {
      return res.status(400).json({ message: "Invalid cycle or cycle not found" });
    }
    
    // Get all workout items to validate targetDayIndex
    const allItems = await storage.getWorkoutItems(cycleId);
    const targetDayItems = allItems.filter(item => item.dayIndex === targetDayIndex);
    
    // For rest day reorder, target must be a workout day (has exercises)
    if (isRestDayReorder && targetDayItems.length === 0) {
      return res.status(400).json({ message: "Target day must be a workout day with exercises" });
    }
    
    // For normal reorder, target must have exercises
    if (!isRestDayReorder && targetDayItems.length === 0) {
      return res.status(400).json({ message: "Target day has no exercises (is a rest day)" });
    }
    
    // Calculate current day index based on progression mode
    let currentDayIndex: number;
    if (cycle.progressionMode === "completion") {
      currentDayIndex = cycle.currentDayIndex ?? 0;
    } else {
      // Calendar-based: calculate from start date
      const today = new Date(todayStr + 'T00:00:00');
      const startDate = new Date(cycle.startDate);
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    }
    
    // Validate: can't reorder to the same day you're already on
    if (targetDayIndex === currentDayIndex) {
      return res.status(400).json({ message: "You're already on this workout day" });
    }
    
    // For rest day reorder, verify today is actually a rest day
    if (isRestDayReorder) {
      const currentDayItems = allItems.filter(item => item.dayIndex === currentDayIndex);
      const currentLabel = cycle.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
      const isCurrentRestDay = cycle.restDays?.includes(currentDayIndex) || 
                                currentLabel.toLowerCase().includes("rest") || 
                                currentDayItems.length === 0;
      if (!isCurrentRestDay) {
        return res.status(400).json({ message: "Today is not a rest day" });
      }
    }
    
    // Clear any existing reorder overrides from today onwards
    await storage.clearCycleScheduleOverrides(req.user!.id, cycleId, todayStr);
    
    // Get the list of workout day indices (excluding rest days)
    const workoutDays: number[] = [];
    for (let i = 0; i < cycle.cycleLength; i++) {
      const dayItems = allItems.filter(item => item.dayIndex === i);
      const label = cycle.dayLabels?.[i] || `Day ${i + 1}`;
      const isRestDay = cycle.restDays?.includes(i) || label.toLowerCase().includes("rest") || dayItems.length === 0;
      if (!isRestDay) {
        workoutDays.push(i);
      }
    }
    
    if (cycle.progressionMode === "completion") {
      // COMPLETION-BASED REORDER
      // For completion mode, we modify the cycle's effective day order
      
      if (isRestDayReorder) {
        // REST DAY REORDER for completion mode
        // Today is a rest day (currentDayIndex is rest), we want to do targetDayIndex workout instead
        // SWAP REST: swap rest with target workout - rest moves to where target was
        // PUSH REST: do target workout today, shift workouts between, rest goes after target
        
        const targetPos = workoutDays.indexOf(targetDayIndex);
        if (targetPos === -1) {
          return res.status(400).json({ message: "Target must be a workout day" });
        }
        
        // Build the full day sequence including rest days for this cycle
        const allDaysInOrder: number[] = [];
        for (let i = 0; i < cycle.cycleLength; i++) {
          allDaysInOrder.push(i);
        }
        
        // Find position of currentDayIndex (rest) and targetDayIndex in full sequence
        const restPos = allDaysInOrder.indexOf(currentDayIndex);
        const targetPosInFull = allDaysInOrder.indexOf(targetDayIndex);
        
        // Create override for today: do targetDayIndex workout
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId,
          date: todayStr,
          dayIndex: targetDayIndex,
          action,
          originalDayIndex: currentDayIndex
        });
        
        if (action === "swap") {
          // SWAP: rest goes to where target was, target comes to today
          // We need an override for when we would have done the target workout
          // In completion mode, this means the rest day is now "at" that position
          const daysUntilTarget = Math.abs(targetPosInFull - restPos);
          
          const targetDate = new Date(todayStr + 'T00:00:00');
          targetDate.setDate(targetDate.getDate() + daysUntilTarget);
          const targetDateStr = targetDate.toISOString().split('T')[0];
          
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId,
            date: targetDateStr,
            dayIndex: currentDayIndex, // Rest day moves here
            action,
            originalDayIndex: targetDayIndex
          });
        } else {
          // PUSH: target workout today, all workouts between shift forward by 1, rest goes to end
          // For days between rest and target, each shifts one slot earlier
          const startIdx = Math.min(restPos, targetPosInFull);
          const endIdx = Math.max(restPos, targetPosInFull);
          
          let dateOffset = 1;
          for (let i = startIdx + 1; i <= endIdx; i++) {
            if (allDaysInOrder[i] === targetDayIndex) continue; // Skip target, it's already today
            
            const futureDate = new Date(todayStr + 'T00:00:00');
            futureDate.setDate(futureDate.getDate() + dateOffset);
            const futureDateStr = futureDate.toISOString().split('T')[0];
            
            await storage.createCycleScheduleOverride({
              gymId: req.user!.gymId || null,
              memberId: req.user!.id,
              cycleId,
              date: futureDateStr,
              dayIndex: allDaysInOrder[i],
              action,
              originalDayIndex: allDaysInOrder[i]
            });
            dateOffset++;
          }
          
          // Rest day goes to the end of this block
          const restDate = new Date(todayStr + 'T00:00:00');
          restDate.setDate(restDate.getDate() + dateOffset);
          const restDateStr = restDate.toISOString().split('T')[0];
          
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId,
            date: restDateStr,
            dayIndex: currentDayIndex, // Rest day
            action,
            originalDayIndex: targetDayIndex
          });
        }
        
        const targetLabel = cycle.dayLabels?.[targetDayIndex] || `Day ${targetDayIndex + 1}`;
        
        return res.json({
          message: action === "swap" 
            ? `Swapped rest day with ${targetLabel}` 
            : `Doing ${targetLabel} today, rest day moved later`,
          action,
          isRestDayReorder: true,
          todayWorkout: {
            dayIndex: targetDayIndex,
            label: targetLabel,
            items: targetDayItems
          }
        });
      }
      
      // NORMAL REORDER (not rest day)
      // SWAP: swap currentDayIndex with targetDayIndex in the remaining sequence
      // PUSH: move targetDayIndex to front, shift others forward
      
      const currentPos = workoutDays.indexOf(currentDayIndex);
      const targetPos = workoutDays.indexOf(targetDayIndex);
      
      if (currentPos === -1 || targetPos === -1) {
        return res.status(400).json({ message: "Invalid workout day selection" });
      }
      
      // Create a copy of workoutDays for reordering
      let newOrder = [...workoutDays];
      
      if (action === "swap") {
        // Swap positions
        [newOrder[currentPos], newOrder[targetPos]] = [newOrder[targetPos], newOrder[currentPos]];
      } else {
        // PUSH: remove target and insert at current position
        newOrder.splice(targetPos, 1);
        newOrder.splice(currentPos, 0, targetDayIndex);
      }
      
      // Create override for today: do targetDayIndex workout
      await storage.createCycleScheduleOverride({
        gymId: req.user!.gymId || null,
        memberId: req.user!.id,
        cycleId,
        date: todayStr,
        dayIndex: targetDayIndex,
        action,
        originalDayIndex: currentDayIndex
      });
      
      // Store overrides for the remaining reordered days
      const remainingDays = newOrder.slice(currentPos + 1);
      let dateOffset = 1;
      for (const dayIdx of remainingDays) {
        const futureDate = new Date(todayStr + 'T00:00:00');
        futureDate.setDate(futureDate.getDate() + dateOffset);
        const futureDateStr = futureDate.toISOString().split('T')[0];
        
        const originalSequenceDayIdx = workoutDays[(currentPos + dateOffset) % workoutDays.length];
        if (dayIdx !== originalSequenceDayIdx) {
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId,
            date: futureDateStr,
            dayIndex: dayIdx,
            action,
            originalDayIndex: originalSequenceDayIdx
          });
        }
        dateOffset++;
      }
      
      const targetLabel = cycle.dayLabels?.[targetDayIndex] || `Day ${targetDayIndex + 1}`;
      
      res.json({
        message: action === "swap" 
          ? `Swapped today's workout with ${targetLabel}` 
          : `Doing ${targetLabel} today, other workouts shifted forward`,
        action,
        newOrder,
        todayWorkout: {
          dayIndex: targetDayIndex,
          label: targetLabel,
          items: targetDayItems
        }
      });
      
    } else {
      // CALENDAR-BASED REORDER
      // For calendar mode, we create date-to-dayIndex mappings
      // SWAP: swap today's date and target's date workouts
      // PUSH: rotate workouts from target to today
      
      const startDate = new Date(cycle.startDate);
      const today = new Date(todayStr + 'T00:00:00');
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Find the next occurrence of targetDayIndex from today
      let targetDateOffset = 0;
      for (let i = 0; i < cycle.cycleLength; i++) {
        const checkDayIndex = (daysSinceStart + i) % cycle.cycleLength;
        if (checkDayIndex === targetDayIndex) {
          targetDateOffset = i;
          break;
        }
      }
      
      if (action === "swap") {
        // SWAP: create two overrides - one for today, one for target date
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + targetDateOffset);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // Today does targetDayIndex workout
        await storage.createCycleScheduleOverride({
          gymId: req.user!.gymId || null,
          memberId: req.user!.id,
          cycleId,
          date: todayStr,
          dayIndex: targetDayIndex,
          action,
          originalDayIndex: currentDayIndex
        });
        
        // Target date does currentDayIndex workout (if different from today)
        if (targetDateOffset > 0) {
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId,
            date: targetDateStr,
            dayIndex: currentDayIndex,
            action,
            originalDayIndex: targetDayIndex
          });
        }
        
      } else {
        // PUSH: rotate workouts so target becomes today, others shift forward
        for (let i = 0; i <= targetDateOffset; i++) {
          const overrideDate = new Date(today);
          overrideDate.setDate(today.getDate() + i);
          const overrideDateStr = overrideDate.toISOString().split('T')[0];
          
          let newDayIndex: number;
          if (i === 0) {
            newDayIndex = targetDayIndex;
          } else {
            newDayIndex = (daysSinceStart + i - 1) % cycle.cycleLength;
          }
          
          const originalDayForDate = (daysSinceStart + i) % cycle.cycleLength;
          
          await storage.createCycleScheduleOverride({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            cycleId,
            date: overrideDateStr,
            dayIndex: newDayIndex,
            action,
            originalDayIndex: originalDayForDate
          });
        }
      }
      
      const targetLabel = cycle.dayLabels?.[targetDayIndex] || `Day ${targetDayIndex + 1}`;
      
      res.json({
        message: action === "swap" 
          ? `Swapped today's workout with ${targetLabel}` 
          : `Doing ${targetLabel} today, schedule shifted`,
        action,
        todayWorkout: {
          dayIndex: targetDayIndex,
          label: targetLabel,
          items: targetDayItems
        }
      });
    }
  });

  app.post("/api/workouts/last-performance", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ exerciseNames: z.array(z.string()) });
    const input = schema.parse(req.body);
    const result = await storage.getLastPerformanceBatch(req.user!.id, input.exerciseNames);
    res.json(result);
  });

  app.post("/api/workouts/complete", requireRole(["member"]), async (req, res) => {
    const schema = z.object({ 
      workoutItemId: z.number(),
      actualSets: z.number().optional(),
      actualReps: z.number().optional(),
      actualWeight: z.string().optional(),
      actualDurationMinutes: z.number().optional(),
      actualDistanceKm: z.string().optional(),
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
      actualWeight: input.actualWeight,
      actualDurationMinutes: input.actualDurationMinutes,
      actualDistanceKm: input.actualDistanceKm
    });
    
    // Calculate current day index for session creation
    // This determines which day of the cycle we're on based on cycle start date
    const startDate = new Date(cycle.startDate);
    const todayDate = new Date(today);
    const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    
    // Create/update workout session for proper session-based stats
    const todayItems = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
    const muscleTypes = Array.from(new Set(todayItems.map(i => i.muscleType).filter(Boolean)));
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
    
    // Auto-mark attendance (only for gym members, not Personal Mode)
    if (req.user!.gymId) {
      const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
      if (!existingAttendance) {
        await storage.markAttendance({
          gymId: req.user!.gymId,
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
    const muscleTypes = Array.from(new Set(todayExercises.map(i => i.muscleType).filter(Boolean)));
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
    
    // Auto-mark attendance (only for gym members, not Personal Mode)
    if (req.user!.gymId) {
      const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
      if (!existingAttendance) {
        await storage.markAttendance({
          gymId: req.user!.gymId,
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
        const muscleTypes = Array.from(new Set(todayExercises.map(i => i.muscleType).filter(Boolean)));
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
    
    // Auto-mark attendance if any completed (only for gym members, not Personal Mode)
    if (completions.length > 0 && req.user!.gymId) {
      const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
      if (!existingAttendance) {
        await storage.markAttendance({
          gymId: req.user!.gymId,
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
        const muscleTypes = Array.from(new Set(todayItems.map(i => i.muscleType).filter(Boolean)));
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
    
    // Auto-mark attendance if any completed (only for gym members, not Personal Mode)
    if (completions.length > 0 && req.user!.gymId) {
      const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
      if (!existingAttendance) {
        await storage.markAttendance({
          gymId: req.user!.gymId,
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
      const stats = await storage.getMemberStats(req.user!.id, req.user!.gymId);
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

  // Quick Log - Parse natural language workout input via AI
  app.post("/api/workouts/quick-log/parse", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        input: z.string().min(1).max(500),
        clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      });
      const { input: userInput, clientDate } = schema.parse(req.body);
      const today = clientDate || getLocalDate(req);

      const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' as const : 'self' as const;
      const cycle = await storage.getMemberCycle(req.user!.id, source);

      let todayItems: any[] = [];
      let completions: any[] = [];
      let cycleId: number | null = null;

      if (cycle) {
        cycleId = cycle.id;
        let currentDayIndex: number;
        if (cycle.progressionMode === "completion") {
          currentDayIndex = cycle.currentDayIndex ?? 0;
          if (cycle.lastWorkoutDate === today) {
            currentDayIndex = (currentDayIndex - 1 + cycle.cycleLength) % cycle.cycleLength;
          }
        } else {
          const todayDate = new Date(today + 'T00:00:00');
          const startDate = new Date(cycle.startDate);
          const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          currentDayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
        }

        const override = await storage.getCycleScheduleOverrideForDate(req.user!.id, cycle.id, today);
        if (override) {
          currentDayIndex = override.overrideDayIndex;
        }

        todayItems = await storage.getWorkoutItemsByDay(cycle.id, currentDayIndex);
        completions = await storage.getCompletions(req.user!.id, today);
      }

      const completedItemIds = new Set(completions.filter((c: any) => c.workoutItemId != null).map((c: any) => c.workoutItemId));

      const exerciseList = todayItems.map(item => ({
        id: item.id,
        name: item.exerciseName,
        sets: item.sets,
        reps: item.reps,
        weight: item.weight || null,
        muscleType: item.muscleType,
        completed: completedItemIds.has(item.id),
      }));

      // Check recent workout history for "same as" support
      let recentHistory = '';
      try {
        const recentLogs = await db.select({
          date: workoutCompletions.completedDate,
          exerciseName: workoutCompletions.exerciseName,
          sets: workoutCompletions.actualSets,
          reps: workoutCompletions.actualReps,
          weight: workoutCompletions.actualWeight,
        })
          .from(workoutCompletions)
          .where(and(
            eq(workoutCompletions.memberId, req.user!.id),
            sql`${workoutCompletions.completedDate} >= (${today}::date - interval '14 days')::text`,
            sql`${workoutCompletions.completedDate} < ${today}`
          ))
          .orderBy(desc(workoutCompletions.completedDate))
          .limit(30);

        if (recentLogs.length > 0) {
          const byDate: Record<string, string[]> = {};
          for (const log of recentLogs) {
            if (!byDate[log.date]) byDate[log.date] = [];
            const detail = [log.exerciseName, log.sets ? `${log.sets} sets` : '', log.reps ? `${log.reps} reps` : '', log.weight ? `${log.weight}` : ''].filter(Boolean).join(', ');
            byDate[log.date].push(detail);
          }
          recentHistory = Object.entries(byDate).slice(0, 5).map(([d, exercises]) => `${d}: ${exercises.join(' | ')}`).join('\n');
        }
      } catch (e) { /* ignore history errors */ }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `You are a workout logging assistant. Parse the user's natural language workout input and match it against their planned exercises for today.

TODAY'S PLANNED EXERCISES:
${exerciseList.length > 0 ? exerciseList.map((e, i) => `${i + 1}. [ID:${e.id}] ${e.name} - ${e.sets} sets x ${e.reps} reps${e.weight ? ` @ ${e.weight}` : ''} (${e.completed ? 'ALREADY DONE' : 'PENDING'})`).join('\n') : 'No exercises planned for today.'}

RECENT WORKOUT HISTORY (last 14 days):
${recentHistory || 'No recent history available.'}

USER INPUT: "${userInput}"

Parse the input and return a JSON array of actions. Each action should be one of:
1. "complete" - Mark a planned exercise as done. Match by exercise name (fuzzy match OK). Include workoutItemId.
2. "complete_with_details" - Mark done with specific sets/reps/weight. Include workoutItemId, actualSets, actualReps, actualWeight.
3. "replace" - ONLY when user EXPLICITLY says "instead of", "replaced X with Y", "swapped X for Y", or "did X in place of Y". Include workoutItemId (the one being replaced), newExerciseName, actualSets, actualReps, actualWeight.
4. "add_extra" - User did an exercise not in today's plan AND did NOT use replacement language. Include exerciseName, actualSets, actualReps, actualWeight, muscleType (guess a reasonable muscle type).
5. "batch_complete" - User says they finished everything/all. Include workoutItemIds array of all PENDING exercise IDs.

NUMBER FORMAT PARSING:
- "3x12" or "3X12" or "3×12" = 3 sets, 12 reps → actualSets: 3, actualReps: 12
- "4x10 at 80kg" or "4x10 @ 80" = 4 sets, 10 reps, 80kg → actualSets: 4, actualReps: 10, actualWeight: "80kg"
- "3 sets 12 reps" = 3 sets, 12 reps
- "4s12r" = 4 sets, 12 reps
- IMPORTANT: Numbers/formats ALWAYS belong to the exercise name immediately BEFORE them in the input text. 
  Example: "i did bench press, incline bench press 3X12, decline bench press" means:
  - "bench press" → complete (no numbers given, use plan defaults)
  - "incline bench press" → 3 sets x 12 reps (the "3X12" follows this exercise)
  - "decline bench press" → complete (no numbers given)
  NEVER assign numbers to a different exercise than the one they immediately follow.

CRITICAL RULES:
- "replace" should ONLY be used when the user uses EXPLICIT replacement language like "instead of", "replaced", "swapped", "in place of". If the user just lists exercises they did, NEVER use replace.
- If an exercise name does NOT closely match any planned exercise → use "add_extra". Do NOT guess a replacement.
- EXERCISE MATCHING RULES (VERY IMPORTANT):
  * An exercise with a QUALIFIER (incline, decline, cable, reverse, close-grip, etc.) is ALWAYS a DIFFERENT exercise from one without that qualifier or with a different qualifier.
  * "incline bench press" ≠ "Barbell Bench Press" → add_extra
  * "incline bench press" ≠ "Dumbbell Bench Press" → add_extra
  * "decline bench press" ≠ "Barbell Bench Press" → add_extra
  * "decline bench press" ≠ "Dumbbell Bench Press" → add_extra
  * "cable rows" ≠ "Barbell Rows" → add_extra
  * "close-grip bench press" ≠ "Barbell Bench Press" → add_extra
  * "leg press" ≠ "Bench Press" → add_extra
  * Only match when the exercise is truly the same movement: "bench" or "bench press" → "Barbell Bench Press" ✓, "squats" → "Barbell Squats" ✓, "OHP" → "Overhead Press" ✓
  * If the user's exercise name has ANY qualifier/prefix not present in the planned exercise name, it is a DIFFERENT exercise → use add_extra.
- If user says "finished everything", "done all", "completed today" → batch_complete all PENDING exercises
- If user says "same as last Tuesday" or "repeat Monday" → find that date in history and create complete_with_details actions for each matching exercise found on that day
- If user mentions reps/sets/weight, use complete_with_details (not just complete)
- NEVER mark already completed exercises again (those marked ALREADY DONE above)

Each action object MUST have the key "type" (not "action") set to one of: "complete", "complete_with_details", "replace", "add_extra", "batch_complete".

Return ONLY a JSON object: {"actions": [{"type": "complete", "workoutItemId": 123}, ...], "summary": "brief description of what will happen", "suggestions": ["next exercise suggestion 1", "exercise suggestion 2"]}
The suggestions should be the names of the NEXT 1-2 pending exercises they haven't mentioned yet (if any remain).
No markdown, no code fences.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { actions: [], summary: "Couldn't understand that. Try again?", suggestions: [] };
      }

      // Normalize: AI sometimes returns "action" instead of "type"
      if (parsed.actions) {
        parsed.actions = parsed.actions.map((a: any) => {
          if (a.action && !a.type) {
            a.type = a.action;
            delete a.action;
          }
          return a;
        });
      }

      // Validate actions reference real workout item IDs
      const validItemIds = new Set(todayItems.map(i => i.id));
      if (parsed.actions) {
        parsed.actions = parsed.actions.filter((a: any) => {
          if (a.type === 'batch_complete') {
            a.workoutItemIds = (a.workoutItemIds || []).filter((id: number) => validItemIds.has(id) && !completedItemIds.has(id));
            return a.workoutItemIds.length > 0;
          }
          if (a.type === 'add_extra') return true;
          if (a.workoutItemId && !validItemIds.has(a.workoutItemId)) return false;
          if (a.workoutItemId && completedItemIds.has(a.workoutItemId)) return false;
          return true;
        });
      }

      res.json({
        actions: parsed.actions || [],
        summary: parsed.summary || '',
        suggestions: parsed.suggestions || [],
        todayExercises: exerciseList,
        completedCount: completedItemIds.size,
        totalCount: todayItems.length,
      });
    } catch (error: any) {
      console.error("Quick log parse error:", error);
      res.status(500).json({ message: error.message || "Failed to parse workout input" });
    }
  });

  // Quick Log - Execute confirmed actions
  app.post("/api/workouts/quick-log/confirm", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        actions: z.array(z.object({
          type: z.enum(["complete", "complete_with_details", "replace", "add_extra", "batch_complete"]),
          workoutItemId: z.number().optional().nullable(),
          workoutItemIds: z.array(z.number()).optional().nullable(),
          actualSets: z.number().optional().nullable(),
          actualReps: z.number().optional().nullable(),
          actualWeight: z.string().optional().nullable(),
          newExerciseName: z.string().optional().nullable(),
          exerciseName: z.string().optional().nullable(),
          muscleType: z.string().optional().nullable(),
        })),
        clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      });
      const { actions, clientDate } = schema.parse(req.body);
      const today = clientDate || getLocalDate(req);

      let completedCount = 0;
      let addedCount = 0;
      let replacedCount = 0;

      for (const action of actions) {
        if (action.type === 'complete' || action.type === 'complete_with_details') {
          if (!action.workoutItemId) continue;
          const item = await storage.getWorkoutItem(action.workoutItemId);
          if (!item) continue;
          const cycle = await storage.getCycle(item.cycleId);
          if (!cycle || cycle.memberId !== req.user!.id) continue;

          const existing = await storage.getCompletionByItemDate(action.workoutItemId, req.user!.id, today);
          if (existing) continue;

          await storage.completeWorkout({
            gymId: req.user!.gymId || null,
            cycleId: cycle.id,
            workoutItemId: action.workoutItemId,
            memberId: req.user!.id,
            completedDate: today,
            actualSets: action.actualSets,
            actualReps: action.actualReps,
            actualWeight: action.actualWeight,
          });
          completedCount++;
        } else if (action.type === 'batch_complete') {
          const ids = action.workoutItemIds || [];
          for (const itemId of ids) {
            const item = await storage.getWorkoutItem(itemId);
            if (!item) continue;
            const cycle = await storage.getCycle(item.cycleId);
            if (!cycle || cycle.memberId !== req.user!.id) continue;
            const existing = await storage.getCompletionByItemDate(itemId, req.user!.id, today);
            if (existing) continue;
            await storage.completeWorkout({
              gymId: req.user!.gymId || null,
              cycleId: cycle.id,
              workoutItemId: itemId,
              memberId: req.user!.id,
              completedDate: today,
            });
            completedCount++;
          }
        } else if (action.type === 'replace') {
          if (!action.workoutItemId || !action.newExerciseName) continue;
          const item = await storage.getWorkoutItem(action.workoutItemId);
          if (!item) continue;
          const cycle = await storage.getCycle(item.cycleId);
          if (!cycle || cycle.memberId !== req.user!.id) continue;

          const existing = await storage.getCompletionByItemDate(action.workoutItemId, req.user!.id, today);
          if (existing) continue;

          await storage.completeWorkout({
            gymId: req.user!.gymId || null,
            cycleId: cycle.id,
            workoutItemId: action.workoutItemId,
            memberId: req.user!.id,
            completedDate: today,
            exerciseName: action.newExerciseName,
            actualSets: action.actualSets ?? undefined,
            actualReps: action.actualReps ?? undefined,
            actualWeight: action.actualWeight ?? undefined,
          });
          replacedCount++;
        } else if (action.type === 'add_extra') {
          if (!action.exerciseName) continue;
          await storage.completeWorkout({
            gymId: req.user!.gymId || null,
            memberId: req.user!.id,
            completedDate: today,
            exerciseName: action.exerciseName,
            actualSets: action.actualSets ?? undefined,
            actualReps: action.actualReps ?? undefined,
            actualWeight: action.actualWeight ?? undefined,
          });
          addedCount++;
        }
      }

      // Auto-mark attendance if any actions completed (gym members only)
      if ((completedCount + addedCount + replacedCount) > 0 && req.user!.gymId) {
        const existingAttendance = await storage.getAttendanceByMemberDate(req.user!.id, today);
        if (!existingAttendance) {
          await storage.markAttendance({
            gymId: req.user!.gymId,
            memberId: req.user!.id,
            date: today,
            status: "present",
            verifiedMethod: "workout",
            markedByUserId: req.user!.id
          });
        }
      }

      // Get updated status
      const source = (req.user!.gymId && req.user!.trainingMode === 'trainer_led') ? 'trainer' as const : 'self' as const;
      const cycle = await storage.getMemberCycle(req.user!.id, source);
      let updatedCompletedCount = 0;
      let updatedTotalCount = 0;
      if (cycle) {
        let dayIndex: number;
        if (cycle.progressionMode === "completion") {
          dayIndex = cycle.currentDayIndex ?? 0;
          if (cycle.lastWorkoutDate === today) {
            dayIndex = (dayIndex - 1 + cycle.cycleLength) % cycle.cycleLength;
          }
        } else {
          const todayDate = new Date(today + 'T00:00:00');
          const startDate = new Date(cycle.startDate);
          const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          dayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
        }
        const items = await storage.getWorkoutItemsByDay(cycle.id, dayIndex);
        const comps = await storage.getCompletions(req.user!.id, today);
        const compIds = new Set(comps.filter((c: any) => c.workoutItemId).map((c: any) => c.workoutItemId));
        updatedTotalCount = items.length;
        updatedCompletedCount = items.filter(i => compIds.has(i.id)).length;
      }

      res.json({
        completed: completedCount,
        added: addedCount,
        replaced: replacedCount,
        updatedProgress: {
          completed: updatedCompletedCount,
          total: updatedTotalCount,
          allDone: updatedCompletedCount >= updatedTotalCount && updatedTotalCount > 0
        }
      });
    } catch (error: any) {
      console.error("Quick log confirm error:", error);
      res.status(500).json({ message: error.message || "Failed to execute workout actions" });
    }
  });

  app.get("/api/workouts/history/my", requireRole(["member"]), async (req, res) => {
    const history = await storage.getMemberWorkoutHistory(req.user!.id);
    res.json(history);
  });

  app.get("/api/workouts/stats/my", requireRole(["member"]), async (req, res) => {
    const stats = await storage.getMemberStats(req.user!.id, req.user!.gymId);
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
    
    const log = await storage.getDetailedWorkoutLog(req.user!.gymId ?? null, req.user!.id, req.params.date);
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
    let workoutLog = await storage.getWorkoutLog(req.user!.gymId ?? null, req.user!.id, input.date);
    if (!workoutLog) {
      // Calculate day index
      const startDate = new Date(cycle.startDate);
      const logDate = new Date(input.date);
      const daysSinceStart = Math.floor((logDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
      
      workoutLog = await storage.createWorkoutLog({
        gymId: req.user!.gymId ?? null,
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
        gymId: req.user!.gymId ?? null,
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
  
  // Create a personal workout cycle (for members without gym OR self-guided members)
  app.post("/api/personal/cycles", requireRole(["member"]), async (req, res) => {
    // Allow if user has no gym (Personal Mode) OR is in self-guided training mode
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can create their own cycles" });
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
    
    // Get all personal cycles to determine next phase number
    const existingCycles = await storage.getMemberCycles(req.user!.id, 'self');
    
    // Find the highest phase number among all cycles (active or not)
    const maxPhase = existingCycles.reduce((max, c) => Math.max(max, c.phaseNumber || 1), 0);
    const nextPhaseNumber = maxPhase + 1;
    
    // Deactivate only existing active personal cycles (source='self'), not gym cycles
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
      source: "self",
      phaseNumber: nextPhaseNumber
    });
    res.status(201).json(cycle);
  });
  
  // Get all personal cycles
  app.get("/api/personal/cycles", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can access their own cycles" });
    }
    // Only return personal workouts (source='self') - includes both active and inactive for history
    const cycles = await storage.getMemberCycles(req.user!.id, 'self');
    res.json(cycles);
  });
  
  // Get personal cycle history (inactive cycles with details)
  app.get("/api/personal/cycles/history", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can access cycle history" });
    }
    // Get all personal cycles sorted by phase number descending
    const cycles = await storage.getMemberCycles(req.user!.id, 'self');
    // Sort by phaseNumber descending (newest first)
    const sortedCycles = cycles.sort((a, b) => (b.phaseNumber || 1) - (a.phaseNumber || 1));
    
    // Fetch items for each cycle
    const cyclesWithItems = await Promise.all(
      sortedCycles.map(async (cycle) => {
        const items = await storage.getWorkoutItems(cycle.id);
        return { ...cycle, items };
      })
    );
    
    res.json(cyclesWithItems);
  });
  
  // Add workout item to personal cycle
  app.post("/api/personal/cycles/:cycleId/items", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can manage their own cycles" });
    }
    
    const cycleId = parseInt(req.params.cycleId);
    const muscleTypes = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Full Body", "Rest", "Cardio", "Biceps", "Triceps", "Hamstrings", "Quadriceps", "Calves", "Abs", "Stretching", "Mobility", "Other"] as const;
    const bodyParts = ["Upper Body", "Lower Body", "Full Body", "Recovery"] as const;
    const exerciseTypes = ["strength", "cardio"] as const;
    
    const schema = z.object({
      dayIndex: z.number().min(0),
      muscleType: z.enum(muscleTypes).default("Chest"),
      bodyPart: z.enum(bodyParts).default("Upper Body"),
      exerciseName: z.string(),
      exerciseType: z.enum(exerciseTypes).default("strength"),
      sets: z.number().min(1),
      reps: z.number().min(1),
      weight: z.string().optional(),
      durationMinutes: z.number().optional(),
      distanceKm: z.string().optional(),
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
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can manage their own cycles" });
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
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can manage their own cycles" });
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

  // Parse AI-generated workout text for import
  app.post("/api/personal/workout/parse-import", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can import workouts" });
    }
    
    try {
      const schema = z.object({
        rawText: z.string().min(10, "Please provide some workout text to parse").max(15000, "Text is too long (max 15,000 characters)")
      });
      
      const input = schema.safeParse(req.body);
      if (!input.success) {
        return res.status(400).json({ 
          success: false, 
          message: input.error.errors[0]?.message || "Invalid input",
          cycleName: "",
          days: [],
          warnings: []
        });
      }
      
      const { parseAIWorkoutText } = await import("./ai-workout-parser");
      const result = parseAIWorkoutText(input.data.rawText);
      res.json(result);
    } catch (error) {
      console.error("Parse import error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to parse workout text",
        cycleName: "",
        days: [],
        warnings: []
      });
    }
  });

  // Create cycle with items in bulk (for wizard)
  app.post("/api/personal/cycles/bulk", requireRole(["member"]), async (req, res) => {
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Only Personal Mode or self-guided members can create their own cycles" });
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
    
    // Get all personal cycles to determine next phase number
    const existingCycles = await storage.getMemberCycles(req.user!.id, 'self');
    
    // Find the highest phase number among all cycles (active or not)
    const maxPhase = existingCycles.reduce((max, c) => Math.max(max, c.phaseNumber || 1), 0);
    const nextPhaseNumber = maxPhase + 1;
    
    // Deactivate existing personal cycles
    for (const c of existingCycles) {
      if (c.isActive) {
        await storage.deactivateCycle(c.id);
      }
    }
    
    // Create cycle with user-provided dates or defaults
    const startDate = input.startDate || getLocalDate(req);
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
      source: "self",
      phaseNumber: nextPhaseNumber
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

  // === USER FITNESS GOALS ===

  app.get("/api/user/goals", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const goals = await storage.getUserGoals(req.user.id);
    res.json(goals || null);
  });

  app.put("/api/user/goals", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const schema = z.object({
      targetWeight: z.string().nullable().optional(),
      targetWeightUnit: z.enum(["kg", "lbs"]).nullable().optional(),
      dailyCalorieTarget: z.number().min(500).max(10000).nullable().optional(),
      dailyProteinTarget: z.number().min(10).max(500).nullable().optional(),
      weeklyWorkoutDays: z.number().min(1).max(7).nullable().optional(),
      primaryGoal: z.enum(["lose_fat", "build_muscle", "maintain", "improve_endurance", "general_health"]).nullable().optional(),
      customGoalText: z.string().max(500).nullable().optional(),
    });
    const input = schema.parse(req.body);
    const goals = await storage.upsertUserGoals(req.user.id, input);
    res.json(goals);
  });

  // === NUTRITION / CALORIE TRACKING ===
  
  app.get("/api/nutrition/goal", requireRole(["member"]), async (req, res) => {
    const goal = await storage.getCalorieGoal(req.user!.id);
    res.json(goal || null);
  });

  app.post("/api/nutrition/goal", requireRole(["member"]), async (req, res) => {
    const schema = insertCalorieGoalSchema.omit({ id: true, createdAt: true, updatedAt: true, isActive: true });
    const input = schema.parse(req.body);
    const goal = await storage.createCalorieGoal({ ...input, userId: req.user!.id });
    res.status(201).json(goal);
  });

  app.patch("/api/nutrition/goal/:goalId", requireRole(["member"]), async (req, res) => {
    const goalId = parseInt(req.params.goalId);
    const existing = await storage.getCalorieGoal(req.user!.id);
    if (!existing || existing.id !== goalId) {
      return res.status(404).json({ message: "Goal not found" });
    }
    const schema = z.object({
      dailyCalories: z.number().optional(),
      dailyProtein: z.number().optional(),
      dailyCarbs: z.number().optional(),
      dailyFat: z.number().optional(),
      goalType: z.enum(["lose", "maintain", "gain"]).optional(),
    });
    const input = schema.parse(req.body);
    const updated = await storage.updateCalorieGoal(goalId, input);
    res.json(updated);
  });

  app.get("/api/nutrition/logs", requireRole(["member"]), async (req, res) => {
    const date = (req.query.date as string) || getLocalDate(req);
    const logs = await storage.getFoodLogs(req.user!.id, date);
    res.json(logs);
  });

  app.get("/api/nutrition/logs/range", requireRole(["member"]), async (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate required" });
    }
    const logs = await storage.getFoodLogsByDateRange(req.user!.id, startDate, endDate);
    res.json(logs);
  });

  app.post("/api/nutrition/logs", requireRole(["member"]), async (req, res) => {
    const schema = insertFoodLogSchema.omit({ userId: true });
    const input = schema.parse(req.body);
    const log = await storage.createFoodLog({ ...input, userId: req.user!.id });
    res.status(201).json(log);
  });

  app.delete("/api/nutrition/logs/:logId", requireRole(["member"]), async (req, res) => {
    const logId = parseInt(req.params.logId);
    await storage.deleteFoodLog(logId, req.user!.id);
    res.status(204).end();
  });

  app.get("/api/nutrition/summary", requireRole(["member"]), async (req, res) => {
    const date = (req.query.date as string) || getLocalDate(req);
    const [summary, goal] = await Promise.all([
      storage.getDailySummary(req.user!.id, date),
      storage.getCalorieGoal(req.user!.id),
    ]);
    res.json({ summary, goal });
  });

  app.get("/api/nutrition/page-data", requireRole(["member"]), async (req, res) => {
    const startTime = Date.now();
    const date = (req.query.date as string) || getLocalDate(req);
    const userId = req.user!.id;

    const t1 = Date.now();
    const [goal, logs, waterLogsResult, recentFoods] = await Promise.all([
      storage.getCalorieGoal(userId).then(r => { const d = Date.now() - t1; if (d > 100) console.log(`[nutrition] getCalorieGoal: ${d}ms`); return r; }),
      storage.getFoodLogs(userId, date).then(r => { const d = Date.now() - t1; if (d > 100) console.log(`[nutrition] getFoodLogs: ${d}ms`); return r; }),
      db.select().from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date))).orderBy(desc(waterLogs.createdAt)).then(r => { const d = Date.now() - t1; if (d > 100) console.log(`[nutrition] waterLogs: ${d}ms`); return r; }),
      storage.getRecentFoods(userId, 20).then(r => { const d = Date.now() - t1; if (d > 100) console.log(`[nutrition] getRecentFoods: ${d}ms`); return r; }),
    ]);

    const summary = logs.reduce((acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (log.protein || 0),
      carbs: acc.carbs + (log.carbs || 0),
      fat: acc.fat + (log.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const totalOz = waterLogsResult.reduce((sum, w) => sum + Number(w.amountOz || 0), 0);

    const totalTime = Date.now() - startTime;
    if (totalTime > 150) {
      console.log(`[nutrition/page-data] ${totalTime}ms for user ${userId}`);
    }

    res.json({
      logs,
      summary,
      goal: goal || null,
      water: { logs: waterLogsResult, totalOz, totalCups: Math.round(totalOz / 8 * 10) / 10 },
      recent: recentFoods,
    });
  });

  // Weekly/Monthly calorie analytics
  app.get("/api/nutrition/analytics", requireRole(["member"]), async (req, res) => {
    const period = req.query.period as string || 'week'; // 'week' or 'month'
    const today = new Date();
    let startDate: string;
    let endDate = today.toISOString().split('T')[0];
    
    if (period === 'month') {
      // Last 30 days
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      startDate = start.toISOString().split('T')[0];
    } else {
      // Last 7 days (default)
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      startDate = start.toISOString().split('T')[0];
    }
    
    const analytics = await storage.getCalorieAnalytics(req.user!.id, startDate, endDate);
    const goal = await storage.getCalorieGoal(req.user!.id);
    
    // Calculate averages
    const daysWithData = analytics.filter(d => d.actual > 0);
    const avgCalories = daysWithData.length > 0 
      ? Math.round(daysWithData.reduce((sum, d) => sum + d.actual, 0) / daysWithData.length)
      : 0;
    const totalCalories = analytics.reduce((sum, d) => sum + d.actual, 0);
    const targetTotal = analytics.length * (goal?.dailyCalorieTarget || 2000);
    const adherencePercent = targetTotal > 0 ? Math.round((totalCalories / targetTotal) * 100) : 0;
    
    // Calculate protein stats
    const daysWithProtein = analytics.filter(d => d.protein > 0);
    const avgProtein = daysWithProtein.length > 0 
      ? Math.round(daysWithProtein.reduce((sum, d) => sum + d.protein, 0) / daysWithProtein.length)
      : 0;
    const totalProtein = analytics.reduce((sum, d) => sum + d.protein, 0);
    const proteinTarget = goal?.dailyProteinTarget || 100;
    const proteinTargetTotal = analytics.length * proteinTarget;
    const proteinAdherencePercent = proteinTargetTotal > 0 ? Math.round((totalProtein / proteinTargetTotal) * 100) : 0;
    
    res.json({
      period,
      startDate,
      endDate,
      dailyData: analytics,
      summary: {
        avgCalories,
        totalCalories,
        targetTotal,
        adherencePercent,
        daysLogged: daysWithData.length,
        dailyTarget: goal?.dailyCalorieTarget || 2000,
        avgProtein,
        totalProtein,
        proteinTarget,
        proteinAdherencePercent,
        daysWithProtein: daysWithProtein.length,
      },
      goal: goal || null,
    });
  });

  app.get("/api/nutrition/food/search", requireRole(["member"]), async (req, res) => {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Query must be at least 2 characters" });
    }
    
    const includeExternal = req.query.external !== 'false';
    
    const localFoods = searchLocalFoods(query);
    const localProducts: FoodProduct[] = localFoods.map(food => ({
      barcode: `local-${food.id}`,
      name: food.name,
      brandName: food.category,
      servingSize: food.servingSize,
      nutrients: {
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: null
      },
      imageUrl: null,
      isEstimate: true,
      isRestaurantItem: false,
      sourceType: 'generic_database' as const,
    }));
    
    // If we have enough local results or external is disabled, return immediately
    if (localProducts.length >= 8 || !includeExternal) {
      return res.json({
        products: localProducts.slice(0, 15),
        count: localProducts.length,
        hasExternal: false
      });
    }
    
    // Search Open Food Facts with a timeout (3 seconds max)
    try {
      const externalPromise = searchFoodByName(query, page);
      const timeoutPromise = new Promise<{ products: FoodProduct[], count: number }>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 3000)
      );
      
      const externalResults = await Promise.race([externalPromise, timeoutPromise]);
      const externalWithFlags = externalResults.products.map(p => ({
        ...p,
        isEstimate: false,
        isRestaurantItem: false,
        sourceType: 'branded_database' as const,
      }));
      const combinedProducts = [...localProducts, ...externalWithFlags].slice(0, 20);
      
      res.json({
        products: combinedProducts,
        count: localProducts.length + externalResults.count,
        hasExternal: true
      });
    } catch {
      // If external API fails or times out, just return local results
      res.json({
        products: localProducts,
        count: localProducts.length,
        hasExternal: false
      });
    }
  });

  app.get("/api/nutrition/food/barcode/:barcode", requireRole(["member"]), async (req, res) => {
    const barcode = req.params.barcode;
    if (!barcode) {
      return res.status(400).json({ message: "Barcode required" });
    }

    const localProduct = lookupBarcodeLocal(barcode);
    if (localProduct) {
      return res.json({
        barcode: localProduct.barcode,
        name: localProduct.name,
        brandName: localProduct.brand,
        servingSize: localProduct.servingSize,
        nutrients: {
          calories: localProduct.calories,
          protein: localProduct.protein,
          carbs: localProduct.carbs,
          fat: localProduct.fat,
          fiber: null,
        },
        imageUrl: null,
        isEstimate: false,
        isRestaurantItem: false,
        sourceType: 'branded_database' as const,
      });
    }

    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      const lookupPromise = lookupByBarcode(barcode);
      const product = await Promise.race([lookupPromise, timeoutPromise]);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({
        ...product,
        isEstimate: false,
        isRestaurantItem: false,
        sourceType: 'branded_database' as const,
      });
    } catch {
      return res.status(404).json({ message: "Product not found" });
    }
  });

  // Water tracking
  app.get("/api/nutrition/water", requireRole(["member"]), async (req, res) => {
    const date = (req.query.date as string) || getLocalDate(req);
    const logs = await storage.getWaterLogs(req.user!.id, date);
    const totalOz = await storage.getWaterTotal(req.user!.id, date);
    res.json({ logs, totalOz, totalCups: Math.round(totalOz / 8 * 10) / 10 });
  });

  app.post("/api/nutrition/water", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      date: z.string(),
      amountOz: z.number().min(1).max(128),
    });
    const input = schema.parse(req.body);
    const log = await storage.createWaterLog({ ...input, userId: req.user!.id });
    res.status(201).json(log);
  });

  app.delete("/api/nutrition/water/:logId", requireRole(["member"]), async (req, res) => {
    const logId = parseInt(req.params.logId);
    await storage.deleteWaterLog(logId, req.user!.id);
    res.status(204).end();
  });

  // Recent foods for quick re-logging
  app.get("/api/nutrition/recent", requireRole(["member"]), async (req, res) => {
    const recentFoods = await storage.getRecentFoods(req.user!.id, 20);
    res.json(recentFoods);
  });

  // AI-powered nutrition estimation
  app.post("/api/nutrition/food/estimate", requireRole(["member"]), requireAiConsent, async (req, res) => {
    const schema = z.object({
      description: z.string().min(2).max(200),
      servingSize: z.string().optional(),
      restaurant: z.string().max(100).optional(),
    });
    const input = schema.parse(req.body);
    
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const restaurantContext = input.restaurant 
        ? `This item is from "${input.restaurant}" restaurant. Use the EXACT official nutrition data published by ${input.restaurant} for this menu item. If ${input.restaurant} publishes nutrition facts on their website, use those exact numbers. Be as accurate as possible to the real restaurant menu item.`
        : 'Be accurate and use USDA or standard nutrition databases as reference. If it seems like a restaurant item, estimate based on typical restaurant portions.';
      
      const prompt = `Estimate the nutrition facts for this food item: "${input.description}"${input.servingSize ? ` (serving size: ${input.servingSize})` : ''}.

${restaurantContext}

Return ONLY a JSON object with these fields (numbers only, no units):
{
  "name": "cleaned up food name${input.restaurant ? ` (include restaurant name)` : ''}",
  "restaurant": "${input.restaurant || ''}",
  "servingSize": "estimated serving size like '1 sandwich' or '1 plate'",
  "calories": number,
  "protein": number in grams,
  "carbs": number in grams,
  "fat": number in grams,
  "isVerified": false
}

Return ONLY the JSON, no explanation.`;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });
      
      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      let estimated: any;
      try {
        estimated = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return res.status(500).json({ message: "Could not parse AI response" });
        }
        estimated = JSON.parse(jsonMatch[0]);
      }
      const hasRestaurant = !!input.restaurant;
      const brandLabel = hasRestaurant 
        ? `${input.restaurant} (est.)`
        : "AI Estimate";
      res.json({
        barcode: `ai-${Date.now()}`,
        name: estimated.name || input.description,
        brandName: brandLabel,
        servingSize: estimated.servingSize || "1 serving",
        nutrients: {
          calories: Math.max(0, Math.round(Number(estimated.calories) || 0)),
          protein: Math.max(0, Math.round(Number(estimated.protein) || 0)),
          carbs: Math.max(0, Math.round(Number(estimated.carbs) || 0)),
          fat: Math.max(0, Math.round(Number(estimated.fat) || 0)),
          fiber: null
        },
        imageUrl: null,
        isEstimate: true,
        isRestaurantItem: hasRestaurant,
        sourceType: 'ai_estimated' as const,
      });
    } catch (error: any) {
      console.error("AI estimation error:", error);
      res.status(500).json({ message: "Failed to estimate nutrition" });
    }
  });

  app.post("/api/nutrition/food/photo-analyze", requireRole(["member"]), requireAiConsent, async (req, res) => {
    const schema = z.object({
      imageBase64: z.string().min(100),
      mealType: z.string().optional(),
    });
    const input = schema.parse(req.body);

    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional nutritionist. Analyze food photos with MyFitnessPal / USDA FoodData Central accuracy.

RULES:
1. Identify EVERY distinct food item separately
2. Estimate portion in grams using plate size (~25cm), utensils, food depth
3. Use USDA per-100g values x estimated weight - DO NOT underestimate
4. Account for cooking method and added oils/ghee/butter
5. Include hidden calories from oils, ghee, sauces, gravies
6. Be specific: "egg biryani rice" not just "rice"

KEY BENCHMARKS:
- Chicken biryani: 500-700 cal/plate (300-400g), rice cooked in ghee
- Egg biryani: 450-600 cal/plate (300g)
- Biryani rice is NOT plain rice (180-220 cal/100g vs 130 cal/100g for plain)
- Butter chicken: 350-450 cal/serving
- Naan with ghee: 250-350 cal
- Indian curries contain significant oil (add 100-200 cal)
- Fried items absorb oil: add 50-100 cal per piece

CONFIDENCE: "high" | "medium" | "low"

Return ONLY JSON:
{
  "items": [
    {
      "name": "Specific food name (cooking method)",
      "estimatedGrams": 300,
      "calories": 500,
      "protein": 15,
      "carbs": 70,
      "fat": 18,
      "servingSize": "1 plate (300g)",
      "cookingMethod": "cooked in ghee",
      "confidence": "high"
    }
  ],
  "mealDescription": "Brief 1-line description",
  "overallConfidence": "high"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this food photo. Identify every food item, estimate portions in grams, and provide accurate USDA-based nutritional values."
              },
              {
                type: "image_url",
                image_url: {
                  url: input.imageBase64.startsWith('data:') ? input.imageBase64 : `data:image/jpeg;base64,${input.imageBase64}`,
                  detail: "auto"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return res.status(500).json({ message: "Could not parse AI response" });
        parsed = JSON.parse(jsonMatch[0]);
      }

      if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        return res.status(400).json({ message: "No food items detected in the photo. Please try a clearer photo." });
      }

      const items = parsed.items.map((item: any) => ({
        name: String(item.name || 'Unknown food'),
        estimatedGrams: Math.round(Number(item.estimatedGrams) || 100),
        calories: Math.round(Number(item.calories) || 0),
        protein: Math.round(Number(item.protein) || 0),
        carbs: Math.round(Number(item.carbs) || 0),
        fat: Math.round(Number(item.fat) || 0),
        servingSize: String(item.servingSize || '1 serving'),
        cookingMethod: String(item.cookingMethod || 'unknown'),
        confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
      }));

      res.json({
        items,
        mealDescription: parsed.mealDescription || 'Food photo analysis',
        overallConfidence: parsed.overallConfidence || 'medium',
        totalCalories: items.reduce((s: number, i: any) => s + i.calories, 0),
        totalProtein: items.reduce((s: number, i: any) => s + i.protein, 0),
        totalCarbs: items.reduce((s: number, i: any) => s + i.carbs, 0),
        totalFat: items.reduce((s: number, i: any) => s + i.fat, 0),
      });
    } catch (error: any) {
      console.error("Photo analysis error:", error);
      res.status(500).json({ message: "Failed to analyze food photo. Please try again." });
    }
  });

  app.post("/api/nutrition/food/photo-score", requireRole(["member"]), requireAiConsent, async (req, res) => {
    const schema = z.object({
      imageBase64: z.string().min(100),
    });
    const input = schema.parse(req.body);

    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const userGoals = await storage.getUserGoals(req.user!.id);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional nutritionist and food scoring expert. Analyze the food photo and provide:
1. Identify all food items
2. Estimate nutrition (calories, protein, carbs, fat per item)
3. Give a HEALTH SCORE from 0-100 based on:
   - Nutritional balance (protein/carbs/fat ratio)
   - Micronutrient density (vegetables, fruits, whole grains score higher)
   - Processing level (whole foods > processed > ultra-processed)
   - Portion appropriateness
   - Cooking method healthiness (grilled > baked > fried)
   ${userGoals?.primaryGoal ? `- User's fitness goal: ${userGoals.primaryGoal.replace(/_/g, ' ')}` : ''}

SCORING GUIDE:
90-100: Exceptional - nutrient-dense, balanced, whole foods
70-89: Good - mostly healthy with minor improvements possible
50-69: Average - decent but has notable nutritional gaps or excess
30-49: Below average - high calorie, low nutrient density, or heavily processed
0-29: Poor - mostly empty calories, ultra-processed, or extreme portions

IMPORTANT: For each food item, provide FOOD-SPECIFIC portion units that make sense for that food. Examples:
- Biryani/Rice/Pasta: ["bowl", "plate", "cup"] with baseQuantity 1
- Pizza: ["slice", "whole pizza"] with baseQuantity 2 (for 2 slices)
- Bread/Toast: ["slice"] with baseQuantity 2
- Oats/Cereal: ["bowl", "cup"] with baseQuantity 1
- Milk/Juice: ["cup", "glass", "ml"] with baseQuantity 1
- Eggs: ["egg"] with baseQuantity 2
- Chicken/Meat: ["piece", "breast", "g"] with baseQuantity 1
- Fruits: ["piece", "cup", "slice"] with baseQuantity 1
- Roti/Naan/Tortilla: ["piece"] with baseQuantity 2
- Curry/Soup: ["bowl", "cup"] with baseQuantity 1
- Salad: ["bowl", "plate"] with baseQuantity 1
The baseQuantity is what you estimate from the photo. The calories/protein/carbs/fat should be for that baseQuantity.
The portionStep is the increment for +/- buttons (e.g. 1 for slices, 0.5 for bowls).

Return ONLY JSON:
{
  "items": [
    {
      "name": "Specific food name",
      "estimatedGrams": 200,
      "calories": 300,
      "protein": 15,
      "carbs": 40,
      "fat": 10,
      "servingSize": "1 plate (200g)",
      "portionUnit": "plate",
      "portionUnits": ["plate", "bowl", "cup"],
      "baseQuantity": 1,
      "portionStep": 0.5,
      "caloriesPerUnit": 300
    }
  ],
  "mealDescription": "Brief description",
  "totalCalories": 500,
  "totalProtein": 25,
  "totalCarbs": 60,
  "totalFat": 15,
  "healthScore": 72,
  "scoreReasons": [
    {"type": "positive", "text": "Good protein content from grilled chicken"},
    {"type": "positive", "text": "Includes fresh vegetables"},
    {"type": "negative", "text": "White rice has lower fiber than brown rice"},
    {"type": "tip", "text": "Add a side salad to boost micronutrients"}
  ],
  "overallVerdict": "A solid balanced meal with room for fiber improvement"
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this food photo. Score it for healthiness and provide detailed nutrition breakdown." },
              { type: "image_url", image_url: { url: input.imageBase64.startsWith('data:') ? input.imageBase64 : `data:image/jpeg;base64,${input.imageBase64}`, detail: "auto" } }
            ]
          }
        ],
        max_tokens: 1200,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return res.status(500).json({ message: "Could not parse AI response" });
        parsed = JSON.parse(jsonMatch[0]);
      }

      const items = (parsed.items || []).map((item: any) => {
        const baseQty = Number(item.baseQuantity) || 1;
        const cals = Math.round(Number(item.calories) || 0);
        return {
          name: String(item.name || 'Unknown food'),
          estimatedGrams: Math.round(Number(item.estimatedGrams) || 100),
          calories: cals,
          protein: Math.round(Number(item.protein) || 0),
          carbs: Math.round(Number(item.carbs) || 0),
          fat: Math.round(Number(item.fat) || 0),
          servingSize: String(item.servingSize || '1 serving'),
          portionUnit: String(item.portionUnit || 'serving'),
          portionUnits: Array.isArray(item.portionUnits) ? item.portionUnits.map(String) : ['serving'],
          baseQuantity: baseQty,
          portionStep: Number(item.portionStep) || (baseQty >= 2 ? 1 : 0.5),
          caloriesPerUnit: Math.round(Number(item.caloriesPerUnit) || (cals / baseQty)),
        };
      });

      res.json({
        items,
        mealDescription: parsed.mealDescription || 'Food analysis',
        totalCalories: items.reduce((s: number, i: any) => s + i.calories, 0),
        totalProtein: items.reduce((s: number, i: any) => s + i.protein, 0),
        totalCarbs: items.reduce((s: number, i: any) => s + i.carbs, 0),
        totalFat: items.reduce((s: number, i: any) => s + i.fat, 0),
        healthScore: Math.max(0, Math.min(100, Math.round(Number(parsed.healthScore) || 50))),
        scoreReasons: (parsed.scoreReasons || []).map((r: any) => ({
          type: ['positive', 'negative', 'tip'].includes(r.type) ? r.type : 'tip',
          text: String(r.text || ''),
        })),
        overallVerdict: String(parsed.overallVerdict || ''),
      });
    } catch (error: any) {
      console.error("Photo score error:", error);
      res.status(500).json({ message: "Failed to analyze food photo. Please try again." });
    }
  });

  app.get("/api/nutrition/food/type-presets", requireRole(["member"]), async (req, res) => {
    const foodName = req.query.name as string;
    if (!foodName) {
      return res.json({ presets: null });
    }
    try {
      const { getServingPresetsForFood } = await import("./nutrition/food-type-intelligence");
      const presets = getServingPresetsForFood(foodName);
      res.json({ presets });
    } catch (error) {
      res.json({ presets: null });
    }
  });

  app.post("/api/nutrition/food/restaurant-search", requireRole(["member"]), requireAiConsent, async (req, res) => {
    const schema = z.object({
      restaurant: z.string().min(2).max(100),
      query: z.string().min(2).max(200),
    });
    const input = schema.parse(req.body);
    
    try {
      const localFoods = searchLocalFoods(`${input.restaurant} ${input.query}`);
      const localResults: FoodProduct[] = localFoods.map(food => ({
        barcode: `local-${food.id}`,
        name: food.name,
        brandName: food.category,
        servingSize: food.servingSize,
        nutrients: { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: null },
        imageUrl: null
      }));
      
      if (localResults.length >= 3) {
        return res.json({ products: localResults.slice(0, 10), source: "database" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `List the top menu items from "${input.restaurant}" that match "${input.query}". Use the EXACT official nutrition data published by ${input.restaurant}.

Return a JSON object with this format:
{
  "items": [
    {
      "name": "Full item name",
      "servingSize": "1 sandwich",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "commonModifiers": [
        {"label": "No Mayo", "calorieDelta": -90},
        {"label": "Extra Cheese", "calorieDelta": 50}
      ]
    }
  ]
}

Include up to 5 matching items. Use real published nutrition data.
For commonModifiers, include 2-4 of the most common modifications people make (like removing or adding sauces, cheese, etc.) with approximate calorie changes.
Return ONLY JSON.`
        }],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: "json_object" },
      });
      
      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      const parsed = JSON.parse(responseText);
      
      const aiResults = (parsed.items || []).map((item: any, i: number) => ({
        barcode: `restaurant-${Date.now()}-${i}`,
        name: item.name,
        brandName: input.restaurant,
        servingSize: item.servingSize || "1 serving",
        nutrients: {
          calories: Math.max(0, Math.round(Number(item.calories) || 0)),
          protein: Math.max(0, Math.round(Number(item.protein) || 0)),
          carbs: Math.max(0, Math.round(Number(item.carbs) || 0)),
          fat: Math.max(0, Math.round(Number(item.fat) || 0)),
          fiber: null
        },
        imageUrl: null,
        isEstimate: true,
        isRestaurantItem: true,
        sourceType: 'ai_estimated' as const,
        commonModifiers: Array.isArray(item.commonModifiers) ? item.commonModifiers.map((m: any) => ({
          label: String(m.label || ''),
          calorieDelta: Math.round(Number(m.calorieDelta) || 0),
        })).filter((m: any) => m.label) : [],
      }));
      
      const localWithFlags = localResults.map(r => ({ ...r, isEstimate: false, isRestaurantItem: true, sourceType: 'curated_database' as const }));
      const combined = [...localWithFlags, ...aiResults].slice(0, 10);
      res.json({ products: combined, source: "ai" });
    } catch (error: any) {
      console.error("Restaurant search error:", error);
      res.status(500).json({ message: "Failed to search restaurant menu" });
    }
  });

  app.get("/api/nutrition/restaurant-menus", requireRole(["member"]), async (req, res) => {
    try {
      const { getAllRestaurantNames } = await import("./nutrition/restaurant-menus");
      const restaurants = getAllRestaurantNames();
      res.json({ restaurants });
    } catch (error) {
      res.status(500).json({ message: "Failed to load restaurant list" });
    }
  });

  app.get("/api/nutrition/restaurant-menus/:name", requireRole(["member"]), async (req, res) => {
    try {
      const { getRestaurantMenu } = await import("./nutrition/restaurant-menus");
      const menu = getRestaurantMenu(decodeURIComponent(req.params.name));
      if (!menu) {
        return res.json({ menu: null, found: false });
      }
      res.json({ menu, found: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to load restaurant menu" });
    }
  });

  app.post("/api/nutrition/restaurant-menus/calculate", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        restaurant: z.string(),
        itemName: z.string(),
        modifierNames: z.array(z.string()),
      });
      const { restaurant, itemName, modifierNames } = schema.parse(req.body);
      const { getRestaurantMenu, applyModifiers } = await import("./nutrition/restaurant-menus");
      const menu = getRestaurantMenu(restaurant);
      if (!menu) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const item = menu.items.find(i => i.name === itemName);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      const selectedMods = menu.commonModifiers.filter(m => modifierNames.includes(m.name));
      const adjusted = applyModifiers(item, selectedMods);
      res.json({
        original: item,
        adjusted,
        appliedModifiers: selectedMods,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate" });
    }
  });

  app.get("/api/nutrition/portion-sizes", requireRole(["member"]), async (req, res) => {
    try {
      const { PORTION_CATEGORIES } = await import("./nutrition/portion-sizes");
      res.json({ categories: PORTION_CATEGORIES });
    } catch (error) {
      res.status(500).json({ message: "Failed to load portion sizes" });
    }
  });

  app.get("/api/nutrition/portion-sizes/detect", requireRole(["member"]), async (req, res) => {
    try {
      const foodName = req.query.food as string;
      if (!foodName) return res.json({ category: null });
      const { detectFoodCategory } = await import("./nutrition/portion-sizes");
      const category = detectFoodCategory(foodName);
      res.json({ category });
    } catch (error) {
      res.json({ category: null });
    }
  });

  app.post("/api/nutrition/find-nearby-restaurants", requireRole(["member"]), async (req, res) => {
    try {
      const schema = z.object({
        lat: z.number(),
        lon: z.number(),
        radiusMiles: z.number().min(0.5).max(10),
        goalType: z.enum(["lose", "maintain", "gain"]),
        remainingCalories: z.number()
      });

      const { lat, lon, radiusMiles, goalType, remainingCalories } = schema.parse(req.body);
      const radiusMeters = radiusMiles * 1609.34;

      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
          node["amenity"="fast_food"](around:${radiusMeters},${lat},${lon});
          node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
        );
        out body;
      `;

      // Multiple Overpass API servers for fallback
      const overpassServers = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
      ];

      let data: any = null;
      let lastError: Error | null = null;

      const { overpassBreaker } = await import("./circuit-breaker");
      for (const server of overpassServers) {
        try {
          const overpassUrl = `${server}?data=${encodeURIComponent(overpassQuery)}`;
          
          data = await overpassBreaker.execute(async () => {
            const response = await fetch(overpassUrl, {
              headers: {
                'User-Agent': 'OGym-FitnessApp/1.0 (contact@ogym.fitness)'
              }
            });
            if (!response.ok) throw new Error(`${server} returned ${response.status}`);
            return response.json();
          });
          break;
        } catch (err: any) {
          console.warn(`Overpass server ${server} failed:`, err?.message);
          lastError = err as Error;
          if (err?.message?.includes("Circuit breaker")) break;
        }
      }

      if (!data) {
        throw lastError || new Error('All Overpass API servers failed');
      }
      const elements = data.elements || [];

      const toRad = (deg: number) => deg * Math.PI / 180;
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3959;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const restaurantsWithSuggestions = elements
        .filter((el: any) => el.tags?.name)
        .map((el: any) => {
          const distance = haversineDistance(lat, lon, el.lat, el.lon);
          const restaurantSuggestion = findRestaurantSuggestion(el.tags.name);
          
          let suggestion = null;
          let category = 'casual';
          
          if (restaurantSuggestion) {
            const goalSuggestion = getSuggestionForGoal(restaurantSuggestion, goalType as GoalType, remainingCalories);
            suggestion = goalSuggestion;
            category = restaurantSuggestion.category;
          }

          return {
            name: el.tags.name,
            distance,
            distanceText: distance < 1 ? `${(distance * 5280).toFixed(0)} ft` : `${distance.toFixed(1)} mi`,
            suggestion,
            category,
            lat: el.lat,
            lon: el.lon
          };
        })
        .filter((r: any) => r.suggestion !== null)
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 15);

      const dikaMessage = getGeneralDikaMessage(goalType as GoalType, remainingCalories);

      res.json({
        restaurants: restaurantsWithSuggestions,
        dikaMessage,
        totalFound: elements.length,
        withSuggestions: restaurantsWithSuggestions.length
      });
    } catch (error) {
      console.error("Find nearby restaurants error:", error);
      res.status(500).json({ message: "Failed to find nearby restaurants" });
    }
  });

  // === DISCIPLINE SCORE (OGym Score) ===

  app.get("/api/discipline/score/today", requireRole(["member"]), async (req, res) => {
    try {
      const { getScoreToday } = await import("./discipline-score");
      const forceRefresh = req.query.refresh === "true";
      const result = await getScoreToday(req.user!.id, forceRefresh);
      res.json(result);
    } catch (error: any) {
      console.error("Discipline score error:", error);
      res.status(500).json({ message: "Failed to get score" });
    }
  });

  app.get("/api/discipline/score/history", requireRole(["member"]), async (req, res) => {
    try {
      const { getDailyScoreHistory } = await import("./discipline-score");
      const days = parseInt(req.query.days as string) || 30;
      const history = await getDailyScoreHistory(req.user!.id, days);
      res.json(history);
    } catch (error: any) {
      console.error("Score history error:", error);
      res.status(500).json({ message: "Failed to get score history" });
    }
  });

  app.get("/api/discipline/ogym-history", requireRole(["member"]), async (req, res) => {
    try {
      const { getOGymScoreHistory } = await import("./discipline-score");
      const weeks = parseInt(req.query.weeks as string) || 12;
      const history = await getOGymScoreHistory(req.user!.id, weeks);
      res.json(history);
    } catch (error: any) {
      console.error("OGym history error:", error);
      res.status(500).json({ message: "Failed to get OGym score history" });
    }
  });

  app.post("/api/discipline/calculate-ogym", requireRole(["member"]), async (req, res) => {
    try {
      const { calculateOGymScore } = await import("./discipline-score");
      const today = getLocalDate(req);
      const d = new Date(today + "T00:00:00");
      const dayOfWeek = d.getDay();
      const sundayOffset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const nextSunday = new Date(d);
      nextSunday.setDate(nextSunday.getDate() + sundayOffset);
      const weekEndDate = nextSunday.toISOString().split("T")[0];
      const result = await calculateOGymScore(req.user!.id, weekEndDate);
      res.json(result);
    } catch (error: any) {
      console.error("OGym calculate error:", error);
      res.status(500).json({ message: "Failed to calculate OGym score" });
    }
  });

  app.get("/api/discipline/settings", requireRole(["member"]), async (req, res) => {
    try {
      const { getSettings } = await import("./discipline-score");
      const settings = await getSettings(req.user!.id);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.patch("/api/discipline/settings", requireRole(["member"]), async (req, res) => {
    try {
      const { updateSettings } = await import("./discipline-score");
      const { visibility } = req.body;
      if (!["public", "coach", "private"].includes(visibility)) {
        return res.status(400).json({ message: "Invalid visibility value" });
      }
      const settings = await updateSettings(req.user!.id, visibility);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get("/api/trainer/discipline/members", requireRole(["trainer"]), async (req, res) => {
    try {
      const { getTrainerMemberScores } = await import("./discipline-score");
      const scores = await getTrainerMemberScores(req.user!.id);
      res.json(scores);
    } catch (error: any) {
      console.error("Trainer discipline error:", error);
      res.status(500).json({ message: "Failed to get member scores" });
    }
  });

  app.get("/api/owner/discipline/overview", requireRole(["owner"]), async (req, res) => {
    try {
      const { getOwnerDisciplineOverview } = await import("./discipline-score");
      const user = req.user!;
      if (!user.gymId) return res.status(400).json({ message: "No gym found" });
      const overview = await getOwnerDisciplineOverview(user.gymId);
      res.json(overview);
    } catch (error: any) {
      console.error("Owner discipline error:", error);
      res.status(500).json({ message: "Failed to get overview" });
    }
  });

  // === HEALTH DATA (FITNESS DEVICES) ===
  
  // Get today's health data
  app.get("/api/health/today", requireRole(["member"]), async (req, res) => {
    const today = getLocalDate(req);
    const data = await storage.getHealthData(req.user!.id, today);
    res.json(data || null);
  });

  // Get health data for a specific date
  app.get("/api/health/:date", requireRole(["member"]), async (req, res) => {
    const data = await storage.getHealthData(req.user!.id, req.params.date);
    res.json(data || null);
  });

  // Get health data for a date range
  app.get("/api/health/range/:startDate/:endDate", requireRole(["member"]), async (req, res) => {
    const data = await storage.getHealthDataByRange(
      req.user!.id,
      req.params.startDate,
      req.params.endDate
    );
    res.json(data);
  });

  // Sync health data from device
  app.post("/api/health/sync", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      steps: z.number().optional(),
      caloriesBurned: z.number().optional(),
      activeCalories: z.number().optional(),
      activeMinutes: z.number().optional(),
      distanceMeters: z.number().optional(),
      restingHeartRate: z.number().optional(),
      avgHeartRate: z.number().optional(),
      maxHeartRate: z.number().optional(),
      hrv: z.number().optional(),
      sleepMinutes: z.number().optional(),
      sleepQuality: z.enum(["poor", "fair", "good", "excellent"]).optional(),
      bedtime: z.string().optional(),
      wakeTime: z.string().optional(),
      sleepStages: z.array(z.object({
        stage: z.enum(["awake", "light", "deep", "rem", "core"]),
        minutes: z.number()
      })).optional(),
      watchWorkouts: z.array(z.object({
        type: z.string(),
        duration: z.number(),
        calories: z.number()
      })).optional(),
      source: z.enum(["apple_health", "google_fit"])
    });

    try {
      const input = schema.parse(req.body);
      const data = await storage.upsertHealthData({
        userId: req.user!.id,
        ...input
      });
      res.json(data);
    } catch (error) {
      console.error("Health sync error:", error);
      res.status(400).json({ message: "Invalid health data" });
    }
  });

  app.get("/api/health/last-sync-date", requireRole(["member"]), async (req, res) => {
    try {
      const allData = await storage.getHealthDataByRange(req.user!.id, '2000-01-01', '2099-12-31');
      const lastSyncDate = allData.length > 0 ? allData[0].date : null;
      res.json({ lastSyncDate });
    } catch (error) {
      res.json({ lastSyncDate: null });
    }
  });

  // Connect/disconnect health service
  app.post("/api/health/connect", requireRole(["member"]), async (req, res) => {
    const schema = z.object({
      connected: z.boolean(),
      source: z.enum(["apple_health", "google_fit"]).nullable()
    });

    try {
      const { connected, source } = schema.parse(req.body);
      await storage.updateUserHealthConnection(req.user!.id, connected, source);
      (req.user as any).healthConnected = connected;
      (req.user as any).healthSource = source;
      res.json({ success: true });
    } catch (error) {
      console.error("Health connect error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Get user's health connection status
  app.get("/api/health/status", requireRole(["member"]), async (req, res) => {
    const [freshUser] = await db.select({
      healthConnected: users.healthConnected,
      healthSource: users.healthSource,
    }).from(users).where(eq(users.id, req.user!.id)).limit(1);
    res.json({
      connected: freshUser?.healthConnected || false,
      source: freshUser?.healthSource || null
    });
  });

  app.get("/api/health/stats", requireRole(["member"]), async (req, res) => {
    try {
      const userId = req.user!.id;
      const allData = await storage.getHealthDataByRange(userId, '2000-01-01', '2099-12-31');
      
      const [goals] = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
      const userStepGoal = (goals as any)?.dailyStepGoal || 10000;

      let bestStepsDay = { date: '', steps: 0 };
      let bestCaloriesDay = { date: '', calories: 0 };
      let totalSteps = 0;
      let totalCalories = 0;
      let daysWithSteps = 0;
      let stepGoalDays = 0;
      let currentStreak = 0;
      let maxStreak = 0;
      
      const dataByDate = new Map<string, typeof allData[0]>();
      for (const d of allData) {
        dataByDate.set(d.date, d);
        if (d.steps && d.steps > 0) {
          totalSteps += d.steps;
          daysWithSteps++;
          if (d.steps > bestStepsDay.steps) {
            bestStepsDay = { date: d.date, steps: d.steps };
          }
          if (d.steps >= userStepGoal) {
            stepGoalDays++;
          }
        }
        if (d.caloriesBurned && d.caloriesBurned > 0) {
          totalCalories += d.caloriesBurned;
          if (d.caloriesBurned > bestCaloriesDay.calories) {
            bestCaloriesDay = { date: d.date, calories: d.caloriesBurned };
          }
        }
      }
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (allData.length > 0) {
        const sorted = [...allData].sort((a, b) => a.date.localeCompare(b.date));
        const firstDate = new Date(sorted[0].date + 'T12:00:00');
        const lastDate = new Date(sorted[sorted.length - 1].date + 'T12:00:00');
        
        let tempStreak = 0;
        const cursor = new Date(firstDate);
        while (cursor <= lastDate) {
          const ds = cursor.toISOString().split('T')[0];
          const entry = dataByDate.get(ds);
          if (entry && entry.steps && entry.steps >= userStepGoal) {
            tempStreak++;
            if (tempStreak > maxStreak) maxStreak = tempStreak;
          } else {
            tempStreak = 0;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      
      let activeStreak = 0;
      const checkDate = new Date(today);
      for (let i = 0; i < 365; i++) {
        const ds = checkDate.toISOString().split('T')[0];
        const entry = dataByDate.get(ds);
        if (entry && entry.steps && entry.steps >= userStepGoal) {
          activeStreak++;
        } else {
          break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 13);
      const prevWeekStart = sevenDaysAgo.toISOString().split('T')[0];
      const prevWeekEnd = new Date(today);
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
      const prevWeekEndStr = prevWeekEnd.toISOString().split('T')[0];
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(thisWeekStart.getDate() - 6);
      const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];
      
      const thisWeekData = allData.filter(d => d.date >= thisWeekStartStr && d.date <= todayStr);
      const prevWeekData = allData.filter(d => d.date >= prevWeekStart && d.date <= prevWeekEndStr);
      
      const thisWeekSteps = thisWeekData.reduce((s, d) => s + (d.steps || 0), 0);
      const prevWeekSteps = prevWeekData.reduce((s, d) => s + (d.steps || 0), 0);
      const weeklyChange = prevWeekSteps > 0 ? Math.round(((thisWeekSteps - prevWeekSteps) / prevWeekSteps) * 100) : 0;
      
      res.json({
        bestStepsDay,
        bestCaloriesDay,
        totalSteps,
        totalCalories,
        daysTracked: daysWithSteps,
        stepGoalDays,
        currentStreak: activeStreak,
        maxStreak,
        weeklyStepChange: weeklyChange,
        thisWeekSteps,
        prevWeekSteps,
      });
    } catch (error) {
      console.error("Health stats error:", error);
      res.status(500).json({ message: "Failed to compute health stats" });
    }
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
    const stats = await storage.getEnhancedMemberStats(req.user!.id, req.user!.gymId);
    res.json(stats);
  });

  app.get("/api/me/stats/cardio", requireRole(["member"]), async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split("T")[0];
    const todayStr = getLocalDate(req);

    const cardioCompletions = await db.select({
      completedDate: workoutCompletions.completedDate,
      exerciseName: workoutCompletions.exerciseName,
      actualDurationMinutes: workoutCompletions.actualDurationMinutes,
      actualDistanceKm: workoutCompletions.actualDistanceKm,
    })
      .from(workoutCompletions)
      .where(and(
        eq(workoutCompletions.memberId, req.user!.id),
        eq(workoutCompletions.exerciseType, 'cardio'),
        gte(workoutCompletions.completedDate, startStr),
        lte(workoutCompletions.completedDate, todayStr)
      ))
      .orderBy(desc(workoutCompletions.completedDate));

    const totalMinutes = cardioCompletions.reduce((s, c) => s + (c.actualDurationMinutes || 0), 0);
    const totalSessions = cardioCompletions.length;
    const uniqueDays = new Set(cardioCompletions.map(c => c.completedDate)).size;

    const exerciseCounts: Record<string, { count: number; totalMin: number }> = {};
    for (const c of cardioCompletions) {
      if (c.exerciseName) {
        if (!exerciseCounts[c.exerciseName]) exerciseCounts[c.exerciseName] = { count: 0, totalMin: 0 };
        exerciseCounts[c.exerciseName].count++;
        exerciseCounts[c.exerciseName].totalMin += c.actualDurationMinutes || 0;
      }
    }

    const breakdown = Object.entries(exerciseCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({
        name,
        sessions: data.count,
        totalMinutes: data.totalMin,
        percentage: totalSessions > 0 ? Math.round((data.count / totalSessions) * 100) : 0,
      }));

    const weeklyTrend: { week: string; minutes: number; sessions: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - (w * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = weekEnd.toISOString().split("T")[0];
      const weekItems = cardioCompletions.filter(c => c.completedDate >= weekStartStr && c.completedDate <= weekEndStr);
      weeklyTrend.unshift({
        week: `W${4 - w}`,
        minutes: weekItems.reduce((s, c) => s + (c.actualDurationMinutes || 0), 0),
        sessions: weekItems.length,
      });
    }

    const avgMinPerSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    res.json({
      totalMinutes,
      totalSessions,
      uniqueDays,
      avgMinPerSession,
      breakdown,
      weeklyTrend,
      favoriteExercise: breakdown[0]?.name || null,
    });
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
    
    const summary = await storage.getPerSetProgressSummary(req.user!.id, range, req.user!.gymId);
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
    const explanations = await storage.getAnalyticsExplanationWithExample(req.user!.id, req.user!.gymId);
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
    const analytics = await storage.getMemberDailyAnalytics(req.user!.gymId, req.user!.id, result.data);
    res.json(analytics);
  });

  // Daily workout summary with date filtering
  app.get("/api/me/workouts/daily", requireRole(["member"]), async (req, res) => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const workouts = await storage.getMemberDailyWorkouts(req.user!.id, startDate, endDate);
    res.json(workouts);
  });

  // === MEMBER DASHBOARD ENHANCED ROUTES ===

  app.get("/api/member/dashboard-enhanced", requireRole(["member"]), async (req, res) => {
    try {
      const memberId = req.user!.id;
      const gymId = req.user!.gymId;
      const today = getLocalDate(req);
      const todayDate = new Date(today + 'T00:00:00');
      const dayOfWeek = todayDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(todayDate);
      weekStart.setDate(todayDate.getDate() - mondayOffset);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const monthStart = today.substring(0, 7) + '-01';

      const allAttendance = await storage.getMemberAttendance(memberId);

      const monthCheckIns = allAttendance.filter(a => a.date >= monthStart && a.date <= today).length;
      const weekCheckIns = allAttendance.filter(a => a.date >= weekStartStr && a.date <= today).length;
      const lastCheckIn = allAttendance.length > 0 ? allAttendance[0].date : null;

      let attendanceStreak = 0;
      const sortedDates = allAttendance.map(a => a.date).sort((a, b) => b.localeCompare(a));
      if (sortedDates.length > 0) {
        const checkDate = new Date(today + 'T12:00:00');
        for (let i = 0; i < 365; i++) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (sortedDates.includes(dateStr)) {
            attendanceStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (i === 0) {
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          } else {
            break;
          }
        }
      }

      const weekCompletions = await db.select().from(workoutCompletions)
        .where(and(
          eq(workoutCompletions.memberId, memberId),
          gte(workoutCompletions.completedDate, weekStartStr),
          lte(workoutCompletions.completedDate, today)
        ));
      const weekWorkoutsDone = new Set(weekCompletions.map(c => c.completedDate)).size;

      let weekWorkoutsPlanned = 0;
      const memberCycle = await storage.getMemberCycle(memberId);
      if (memberCycle) {
        const totalDays = 7;
        const restDays = memberCycle.restDays || [];
        weekWorkoutsPlanned = totalDays - restDays.length;
      }

      const completions = await db.select().from(workoutCompletions)
        .where(eq(workoutCompletions.memberId, memberId))
        .orderBy(desc(workoutCompletions.createdAt));

      let heaviestLift: { exercise: string; weight: string; date: string } | null = null;
      let maxWeight = 0;
      for (const c of completions) {
        if (c.actualWeight) {
          const w = parseFloat(c.actualWeight.replace(/[^0-9.]/g, ''));
          if (w > maxWeight) {
            maxWeight = w;
            heaviestLift = { exercise: c.exerciseName || 'Unknown', weight: c.actualWeight, date: c.completedDate };
          }
        }
      }

      let longestStreak = 0;
      const workoutSummary = await storage.getMemberWorkoutSummary(gymId, memberId);
      longestStreak = workoutSummary.streak;

      const totalExercisesCompleted = completions.length;

      let recentFeed: any[] = [];
      if (gymId) {
        const feedResults = await db.select({
          id: feedPosts.id,
          type: feedPosts.type,
          content: feedPosts.content,
          createdAt: feedPosts.createdAt,
          userId: feedPosts.userId,
          username: users.username,
        }).from(feedPosts)
          .innerJoin(users, eq(feedPosts.userId, users.id))
          .where(and(
            eq(feedPosts.gymId, gymId),
            eq(feedPosts.isHidden, false)
          ))
          .orderBy(desc(feedPosts.createdAt))
          .limit(3);
        recentFeed = feedResults;
      }

      res.json({
        attendance: {
          monthCheckIns,
          weekCheckIns,
          lastCheckIn,
          streak: attendanceStreak,
        },
        weeklyProgress: {
          workoutsDone: weekWorkoutsDone,
          workoutsPlanned: weekWorkoutsPlanned,
          exercisesCompleted: weekCompletions.length,
        },
        personalBests: {
          heaviestLift,
          longestStreak,
          totalExercisesCompleted,
          currentStreak: workoutSummary.streak,
        },
        recentFeed,
      });
    } catch (error: any) {
      console.error("Member dashboard enhanced error:", error);
      res.status(500).json({ message: "Failed to load dashboard data" });
    }
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
      const result = await storage.markDayDone(req.user!.gymId ?? null, req.user!.id, date);
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

  // === DIKA AI ASSISTANT ===
  app.get("/api/exercise-info", requireAuth, async (req, res) => {
    const name = req.query.name as string;
    if (!name) return res.status(400).json({ message: "Missing exercise name" });
    const exercise = findExercise(name);
    if (!exercise) return res.json({ found: false });
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearchQuery)}`;
    res.json({
      found: true,
      name: exercise.name,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty,
      steps: exercise.steps,
      tips: exercise.tips,
      commonMistakes: exercise.commonMistakes,
      youtubeUrl,
    });
  });

  app.post("/api/dika/ask", requireAuth, requireAiConsent, async (req, res) => {
    const schema = z.object({
      message: z.string().min(1).max(2000),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional(),
      platform: z.string().optional(),
      imageBase64: z.string().optional(),
      voiceMode: z.boolean().optional(),
      detectedLanguage: z.string().optional(),
      chatId: z.number().optional(),
      source: z.enum(['text', 'voice']).optional(),
    });
    
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request", errors: input.error.errors });
    }

    const [consentCheck] = await db.select({ aiDataConsent: users.aiDataConsent })
      .from(users).where(eq(users.id, req.user!.id));
    if (!consentCheck?.aiDataConsent) {
      return res.status(403).json({ message: "AI_CONSENT_REQUIRED" });
    }
    
    const user = req.user!;
    const role = user.role as 'member' | 'trainer' | 'owner';
    const localDate = getLocalDate(req);
    const isIOSNative = input.data.platform === 'ios_native';
    const msgSource = input.data.source || 'text';

    let activeChatId = input.data.chatId || null;

    if (activeChatId) {
      const [chat] = await db.select().from(dikaChats)
        .where(and(eq(dikaChats.id, activeChatId), eq(dikaChats.userId, user.id)));
      if (!chat) activeChatId = null;
    }

    if (!activeChatId) {
      const [recentChat] = await db.select().from(dikaChats)
        .where(eq(dikaChats.userId, user.id))
        .orderBy(desc(dikaChats.lastMessageAt))
        .limit(1);
      if (recentChat) {
        activeChatId = recentChat.id;
      } else {
        const [newChat] = await db.insert(dikaChats)
          .values({ userId: user.id, title: msgSource === 'voice' ? 'Voice Chat' : 'New Chat' })
          .returning();
        activeChatId = newChat.id;
      }
    }

    let history = input.data.conversationHistory;
    if (!history && activeChatId) {
      const recentMsgs = await db.select().from(dikaChatMessages)
        .where(eq(dikaChatMessages.chatId, activeChatId))
        .orderBy(desc(dikaChatMessages.createdAt))
        .limit(10);
      history = recentMsgs.reverse().map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    }

    if (input.data.imageBase64 && role === 'member') {
      try {
        const { parseMealFromPhoto, logMealForUser, getTodayNutritionSummary, formatMealLogResponse } = await import('./dika/meal-logger');
        const parsedMeal = await parseMealFromPhoto(input.data.imageBase64);
        if (parsedMeal && parsedMeal.items.length > 0) {
          const { logged } = await logMealForUser(user.id, parsedMeal, localDate);
          if (logged) {
            const nutritionSummary = await getTodayNutritionSummary(user.id, localDate);
            const answer = formatMealLogResponse(parsedMeal, nutritionSummary);
            const responseData = {
              answer: `I analyzed your food photo!\n\n${answer}`,
              followUpChips: ['How many calories left today?', 'Log another meal', 'My nutrition summary'],
            };
            if (activeChatId) {
              await db.insert(dikaChatMessages).values({ chatId: activeChatId, role: 'user', content: `[Photo attached] ${input.data.message}`, source: msgSource });
              await db.insert(dikaChatMessages).values({ chatId: activeChatId, role: 'assistant', content: responseData.answer, followUpChips: responseData.followUpChips, source: 'text' });
              await db.update(dikaChats).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(dikaChats.id, activeChatId));
            }
            return res.json({ ...responseData, chatId: activeChatId });
          }
        }
        const fallbackResp = {
          answer: "I couldn't identify any food in that photo. Could you try taking a clearer photo, or describe what you're eating?",
          followUpChips: ['Log my meal', 'Take another photo'],
        };
        return res.json({ ...fallbackResp, chatId: activeChatId });
      } catch (error) {
        console.error('Dika photo analysis error:', error);
        return res.json({
          answer: "I had trouble analyzing that photo. Try again or just tell me what you ate!",
          followUpChips: ['Log my meal', 'Try another photo'],
          chatId: activeChatId,
        });
      }
    }
    
    try {
      if (history && history.length > 0) {
        const badPatterns = /I don't have the (current )?list|I currently don't have|check your membership (records|system)|I don't have access to the details/i;
        history = history.filter((msg, idx) => {
          if (msg.role === 'assistant' && badPatterns.test(msg.content)) {
            if (idx > 0 && history![idx - 1].role === 'user') {
              history![idx - 1] = { role: 'user', content: '[previous question - reanswer with current data]' };
            }
            return false;
          }
          return true;
        });
      }

      const response = await handleDikaQuery(
        user.id,
        role,
        user.gymId || null,
        input.data.message,
        history,
        localDate,
        isIOSNative,
        input.data.voiceMode,
        input.data.detectedLanguage
      );

      if (activeChatId) {
        await db.insert(dikaChatMessages).values({ chatId: activeChatId, role: 'user', content: input.data.message, source: msgSource });
        await db.insert(dikaChatMessages).values({ chatId: activeChatId, role: 'assistant', content: response.answer, followUpChips: response.followUpChips || [], source: 'text' });

        const chatUpdateData: any = { lastMessageAt: new Date(), updatedAt: new Date() };
        const recentMsgs = await db.select().from(dikaChatMessages)
          .where(eq(dikaChatMessages.chatId, activeChatId))
          .orderBy(desc(dikaChatMessages.createdAt)).limit(10);
        if (recentMsgs.length <= 4) {
          const msgLower = input.data.message.toLowerCase();
          const respLower = response.answer.toLowerCase();
          const combined = msgLower + ' ' + respLower;
          let detectedCategory = 'general';
          if (/calorie|nutrition|protein|carb|fat|meal|food|diet|eat|ate|hunger|macro/.test(combined)) {
            detectedCategory = 'nutrition';
          } else if (/workout|train|exercise|set|rep|bench|squat|chest|back|leg|arm|shoulder|gym|lift/.test(combined)) {
            detectedCategory = 'workouts';
          } else if (/sport|football|basketball|tennis|swimming|boxing|mma|cricket|volleyball|drill|match/.test(combined)) {
            detectedCategory = 'sports';
          }
          chatUpdateData.category = detectedCategory;
          const [currentChat] = await db.select().from(dikaChats).where(eq(dikaChats.id, activeChatId));
          if (currentChat && (currentChat.title === 'New Chat' || currentChat.title === 'Voice Chat')) {
            const words = input.data.message.split(/\s+/).slice(0, 6).join(' ');
            chatUpdateData.title = words.length > 40 ? words.slice(0, 40) + '...' : words;
          }
        }
        await db.update(dikaChats).set(chatUpdateData).where(eq(dikaChats.id, activeChatId));
      }
      
      res.json({ ...response, chatId: activeChatId });
    } catch (error) {
      console.error('Dika query error:', error);
      res.status(500).json({ answer: "Sorry, I encountered an error. Please try again.", chatId: activeChatId });
    }
  });
  
  app.get("/api/dika/suggestions", requireAuth, async (req, res) => {
    const user = req.user!;
    const role = user.role as 'member' | 'trainer' | 'owner';
    const isIOSNative = req.query.platform === 'ios_native';
    const suggestions = getSuggestionChips(role, user.gymId || null, isIOSNative);
    const quickActions = getQuickActions(role, user.gymId || null, isIOSNative);
    res.json({ suggestions, quickActions });
  });

  app.get("/api/dika/briefing", requireAuth, async (req, res) => {
    const user = req.user!;
    if (user.role === 'trainer' && user.gymId) {
      try {
        const assignments = await storage.getTrainerMembers(user.id);
        const memberIds = assignments.map(a => a.memberId);
        const today = getLocalDate(req);
        const allMembers = await storage.getGymMembers(user.gymId);
        const assignedMembers = allMembers.filter(m => memberIds.includes(m.id));

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        let activeThisWeek = 0;
        let todayCheckIns = 0;
        const atRiskNames: string[] = [];

        for (const member of assignedMembers) {
          const completions = await db.select().from(workoutCompletions)
            .where(eq(workoutCompletions.memberId, member.id))
            .orderBy(desc(workoutCompletions.completedDate))
            .limit(10);

          const recentCompletions = completions.filter(c => c.completedDate >= sevenDaysAgoStr);
          if (recentCompletions.length > 0) activeThisWeek++;

          const attendanceRecords = await db.select().from(attendance)
            .where(and(eq(attendance.memberId, member.id), eq(attendance.date, today)))
            .limit(1);
          if (attendanceRecords.length > 0) todayCheckIns++;

          if (completions.length > 0) {
            const diffDays = Math.floor((new Date(today).getTime() - new Date(completions[0].completedDate).getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 7) atRiskNames.push(member.username);
          }
        }

        const inactiveCount = assignedMembers.length - activeThisWeek;
        let answer = `Hey Coach ${user.username}! Here's your team update:\n\n`;
        answer += `- **${assignedMembers.length}** members assigned to you\n`;
        answer += `- **${activeThisWeek}** trained this week, **${inactiveCount}** inactive\n`;
        answer += `- **${todayCheckIns}** checked in today\n`;

        if (atRiskNames.length > 0) {
          answer += `\n**Needs attention:** ${atRiskNames.slice(0, 3).join(', ')}${atRiskNames.length > 3 ? ` and ${atRiskNames.length - 3} more` : ''} haven't trained in a week+`;
        }

        const followUpChips = [
          "Who skipped this week?",
          "Show at-risk members",
          "Generate a workout plan",
        ];

        return res.json({ answer, followUpChips });
      } catch (error) {
        console.error('Trainer briefing error:', error);
        return res.json({ answer: null });
      }
    }
    if (user.role !== 'owner' || !user.gymId) {
      return res.json({ answer: null });
    }
    try {
      const isIOSNative = req.query.platform === 'ios_native';
      const [profile] = await db.select({ fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id));
      const ownerName = profile?.fullName || user.username || 'there';
      const briefing = await generateOwnerBriefing(user.gymId, ownerName, isIOSNative);
      res.json(briefing);
    } catch (error) {
      console.error('Briefing error:', error);
      res.status(500).json({ answer: null });
    }
  });
  
  app.patch("/api/dika/settings", requireAuth, async (req, res) => {
    const schema = z.object({
      hideDika: z.boolean().optional(),
    });
    
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request" });
    }
    
    if (input.data.hideDika !== undefined) {
      await storage.updateUserDikaSettings(req.user!.id, { hideDika: input.data.hideDika });
    }
    
    res.json({ success: true });
  });

  app.get("/api/ai-consent", requireAuth, async (req, res) => {
    const [user] = await db.select({
      aiDataConsent: users.aiDataConsent,
      aiDataConsentDate: users.aiDataConsentDate,
    }).from(users).where(eq(users.id, req.user!.id));
    res.json({ 
      consented: user?.aiDataConsent || false,
      consentDate: user?.aiDataConsentDate || null,
    });
  });

  app.post("/api/ai-consent", requireAuth, async (req, res) => {
    const schema = z.object({
      consent: z.boolean(),
    });
    const input = schema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid request" });

    await db.update(users)
      .set({ 
        aiDataConsent: input.data.consent,
        aiDataConsentDate: input.data.consent ? new Date() : null,
      })
      .where(eq(users.id, req.user!.id));

    res.json({ success: true, consented: input.data.consent });
  });

  app.get("/api/dika/conversations", requireAuth, async (req, res) => {
    try {
      const result = await db.select().from(dikaConversations).where(eq(dikaConversations.userId, req.user!.id)).limit(1);
      if (result.length > 0) {
        res.json({ messages: result[0].messages });
      } else {
        res.json({ messages: [] });
      }
    } catch (error) {
      console.error('Failed to load dika conversation:', error);
      res.status(500).json({ message: "Failed to load conversation" });
    }
  });

  app.put("/api/dika/conversations", requireAuth, async (req, res) => {
    const schema = z.object({
      messages: z.array(z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.string(),
        followUpChips: z.array(z.string()).optional(),
      })),
    });
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request" });
    }
    try {
      const trimmed = input.data.messages.slice(-50);
      await db.insert(dikaConversations)
        .values({ userId: req.user!.id, messages: trimmed, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: dikaConversations.userId,
          set: { messages: trimmed, updatedAt: new Date() },
        });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save dika conversation:', error);
      res.status(500).json({ message: "Failed to save conversation" });
    }
  });

  app.post("/api/dika/conversations-beacon", requireAuth, async (req, res) => {
    const schema = z.object({
      messages: z.array(z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.string(),
        followUpChips: z.array(z.string()).optional(),
      })),
    });
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid request" });
    }
    try {
      const trimmed = input.data.messages.slice(-50);
      await db.insert(dikaConversations)
        .values({ userId: req.user!.id, messages: trimmed, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: dikaConversations.userId,
          set: { messages: trimmed, updatedAt: new Date() },
        });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save dika conversation (beacon):', error);
      res.status(500).json({ message: "Failed to save conversation" });
    }
  });

  app.delete("/api/dika/conversations", requireAuth, async (req, res) => {
    try {
      await db.delete(dikaConversations).where(eq(dikaConversations.userId, req.user!.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to clear dika conversation:', error);
      res.status(500).json({ message: "Failed to clear conversation" });
    }
  });

  app.post("/api/dika/execute", requireAuth, async (req, res) => {
    const schema = z.object({
      actionType: z.enum(['add_member', 'log_payment', 'assign_trainer', 'create_support_ticket']),
      payload: z.record(z.any()),
      preview: z.string(),
    });
    
    const input = schema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Invalid action data", errors: input.error.errors });
    }

    if (input.data.actionType === 'create_support_ticket') {
      try {
        const result = await executeSupportTicket(
          req.user!.id,
          req.user!.role,
          req.user!.gymId || null,
          input.data.payload
        );
        return res.json(result);
      } catch (error) {
        console.error('Dika support ticket execute error:', error);
        return res.status(500).json({ success: false, message: "Failed to create support ticket. Please try again." });
      }
    }

    if (req.user!.role !== 'owner') {
      return res.status(403).json({ message: "Only gym owners can execute this action" });
    }
    
    if (!req.user!.gymId) {
      return res.status(400).json({ message: "No gym associated with your account" });
    }
    
    try {
      const actionData: ActionData = {
        actionType: input.data.actionType,
        status: 'ready',
        payload: input.data.payload,
        preview: input.data.preview,
      };
      
      const result = await executeOwnerAction(req.user!.id, req.user!.gymId, actionData);
      res.json(result);
    } catch (error) {
      console.error('Dika execute error:', error);
      res.status(500).json({ success: false, message: "Failed to execute action. Please try again." });
    }
  });
  
  // === DIKA MULTI-CHAT SYSTEM ===
  app.get("/api/dika/chats", requireAuth, async (req, res) => {
    try {
      const chats = await db.select()
        .from(dikaChats)
        .where(eq(dikaChats.userId, req.user!.id))
        .orderBy(desc(dikaChats.lastMessageAt));
      res.json({ chats });
    } catch (error) {
      console.error('Failed to load dika chats:', error);
      res.status(500).json({ message: "Failed to load chats" });
    }
  });

  app.post("/api/dika/chats", requireAuth, async (req, res) => {
    const schema = z.object({
      title: z.string().optional(),
      category: z.string().optional(),
    });
    const input = schema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid request" });
    try {
      const [chat] = await db.insert(dikaChats)
        .values({
          userId: req.user!.id,
          title: input.data.title || 'New Chat',
          category: input.data.category || 'general',
        })
        .returning();
      res.json({ chat });
    } catch (error) {
      console.error('Failed to create dika chat:', error);
      res.status(500).json({ message: "Failed to create chat" });
    }
  });

  app.patch("/api/dika/chats/:chatId", requireAuth, async (req, res) => {
    const chatId = parseInt(req.params.chatId);
    const schema = z.object({
      title: z.string().optional(),
      category: z.string().optional(),
      isPinned: z.boolean().optional(),
    });
    const input = schema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid request" });
    try {
      const [existing] = await db.select().from(dikaChats)
        .where(and(eq(dikaChats.id, chatId), eq(dikaChats.userId, req.user!.id)));
      if (!existing) return res.status(404).json({ message: "Chat not found" });
      const updates: any = { updatedAt: new Date() };
      if (input.data.title !== undefined) updates.title = input.data.title;
      if (input.data.category !== undefined) updates.category = input.data.category;
      if (input.data.isPinned !== undefined) updates.isPinned = input.data.isPinned;
      const [updated] = await db.update(dikaChats).set(updates)
        .where(eq(dikaChats.id, chatId)).returning();
      res.json({ chat: updated });
    } catch (error) {
      console.error('Failed to update dika chat:', error);
      res.status(500).json({ message: "Failed to update chat" });
    }
  });

  app.delete("/api/dika/chats/:chatId", requireAuth, async (req, res) => {
    const chatId = parseInt(req.params.chatId);
    try {
      const [existing] = await db.select().from(dikaChats)
        .where(and(eq(dikaChats.id, chatId), eq(dikaChats.userId, req.user!.id)));
      if (!existing) return res.status(404).json({ message: "Chat not found" });
      await db.delete(dikaActionFeed).where(eq(dikaActionFeed.chatId, chatId));
      await db.delete(dikaChats).where(eq(dikaChats.id, chatId));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete dika chat:', error);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  app.get("/api/dika/chats/:chatId/messages", requireAuth, async (req, res) => {
    const chatId = parseInt(req.params.chatId);
    try {
      const [chat] = await db.select().from(dikaChats)
        .where(and(eq(dikaChats.id, chatId), eq(dikaChats.userId, req.user!.id)));
      if (!chat) return res.status(404).json({ message: "Chat not found" });
      const messages = await db.select().from(dikaChatMessages)
        .where(eq(dikaChatMessages.chatId, chatId))
        .orderBy(asc(dikaChatMessages.createdAt));
      res.json({ messages });
    } catch (error) {
      console.error('Failed to load chat messages:', error);
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post("/api/dika/chats/:chatId/messages", requireAuth, requireAiConsent, async (req, res) => {
    const chatId = parseInt(req.params.chatId);
    const schema = z.object({
      message: z.string().min(1).max(2000),
      platform: z.string().optional(),
      imageBase64: z.string().optional(),
    });
    const input = schema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid request" });
    try {
      const [chat] = await db.select().from(dikaChats)
        .where(and(eq(dikaChats.id, chatId), eq(dikaChats.userId, req.user!.id)));
      if (!chat) return res.status(404).json({ message: "Chat not found" });

      const userContent = input.data.imageBase64 ? `[Photo attached] ${input.data.message}` : input.data.message;
      const [userMsg] = await db.insert(dikaChatMessages)
        .values({ chatId, role: 'user', content: userContent })
        .returning();

      const recentMsgs = await db.select().from(dikaChatMessages)
        .where(eq(dikaChatMessages.chatId, chatId))
        .orderBy(desc(dikaChatMessages.createdAt))
        .limit(10);
      const history = recentMsgs.reverse().map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const user = req.user!;
      const role = user.role as 'member' | 'trainer' | 'owner';
      const localDate = getLocalDate(req);
      const isIOSNative = input.data.platform === 'ios_native';

      let response: { answer: string; followUpChips?: string[] };

      if (input.data.imageBase64 && role === 'member') {
        try {
          const { parseMealFromPhoto, logMealForUser, getTodayNutritionSummary, formatMealLogResponse } = await import('./dika/meal-logger');
          const parsedMeal = await parseMealFromPhoto(input.data.imageBase64);
          if (parsedMeal && parsedMeal.items.length > 0) {
            const { logged } = await logMealForUser(user.id, parsedMeal, localDate);
            if (logged) {
              const nutritionSummary = await getTodayNutritionSummary(user.id, localDate);
              const answer = formatMealLogResponse(parsedMeal, nutritionSummary);
              response = {
                answer: `I analyzed your food photo!\n\n${answer}`,
                followUpChips: ['How many calories left today?', 'Log another meal', 'My nutrition summary'],
              };
            } else {
              response = { answer: "I identified the food but couldn't log it. Please try again.", followUpChips: ['Log my meal'] };
            }
          } else {
            response = { answer: "I couldn't identify any food in that photo. Could you try a clearer photo or describe what you're eating?", followUpChips: ['Log my meal', 'Take another photo'] };
          }
        } catch (error) {
          console.error('Dika web photo analysis error:', error);
          response = { answer: "I had trouble analyzing that photo. Try again or just tell me what you ate!", followUpChips: ['Log my meal'] };
        }
      } else {
        response = await handleDikaQuery(
          user.id, role, user.gymId || null,
          input.data.message, history, localDate, isIOSNative
        );
      }

      const [assistantMsg] = await db.insert(dikaChatMessages)
        .values({
          chatId,
          role: 'assistant',
          content: response.answer,
          followUpChips: response.followUpChips || [],
        })
        .returning();

      const chatUpdateData: any = {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      };

      const msgCount = recentMsgs.length;
      if (msgCount <= 2) {
        const msgLower = input.data.message.toLowerCase();
        const respLower = response.answer.toLowerCase();
        const combined = msgLower + ' ' + respLower;

        let detectedCategory = 'general';
        if (/calorie|nutrition|protein|carb|fat|meal|food|diet|eat|ate|hunger|macro/.test(combined)) {
          detectedCategory = 'nutrition';
        } else if (/workout|train|exercise|set|rep|bench|squat|chest|back|leg|arm|shoulder|gym|lift/.test(combined)) {
          detectedCategory = 'workouts';
        } else if (/sport|football|basketball|tennis|swimming|boxing|mma|cricket|volleyball|drill|match/.test(combined)) {
          detectedCategory = 'sports';
        }
        chatUpdateData.category = detectedCategory;

        if (chat.title === 'New Chat' || chat.title.length > 40) {
          const words = input.data.message.split(/\s+/).slice(0, 6).join(' ');
          chatUpdateData.title = words.length > 40 ? words.slice(0, 40) + '...' : words;
        }
      }

      await db.update(dikaChats).set(chatUpdateData).where(eq(dikaChats.id, chatId));

      if (response.answer?.includes('MEAL_LOG_DATA:')) {
        await db.insert(dikaActionFeed).values({
          userId: user.id,
          chatId,
          actionType: 'meal_logged',
          summary: 'Logged a meal via Dika',
        });
      }
      if (response.answer?.includes('WORKOUT_PLAN_DATA:')) {
        await db.insert(dikaActionFeed).values({
          userId: user.id,
          chatId,
          actionType: 'workout_generated',
          summary: 'Generated a workout plan',
        });
      }
      if (response.answer?.includes('WEEKLY_REPORT_DATA:')) {
        await db.insert(dikaActionFeed).values({
          userId: user.id,
          chatId,
          actionType: 'report_generated',
          summary: 'Generated a weekly health report',
        });
      }

      try {
        const insightPatterns: Array<{ pattern: RegExp; key: string; extract: (m: RegExpMatchArray) => string }> = [
          { pattern: /(?:my goal|i want to|i'm trying to|aim to)\s+(.{5,60})/i, key: 'fitness_goal', extract: (m) => m[1].replace(/[.!,]+$/, '') },
          { pattern: /(?:i weigh|my weight is|i'm|i am)\s+(\d{2,3})\s*(?:kg|lbs|pounds|kilos)/i, key: 'current_weight', extract: (m) => m[0].replace(/^(i weigh|my weight is|i'm|i am)\s+/i, '') },
          { pattern: /(?:allergic to|allergy|can't eat|don't eat|avoid)\s+(.{3,40})/i, key: 'dietary_restriction', extract: (m) => m[1].replace(/[.!,]+$/, '') },
          { pattern: /(?:i'm|i am)\s+(vegan|vegetarian|pescatarian|keto|paleo|gluten.?free)/i, key: 'diet_type', extract: (m) => m[1] },
          { pattern: /(?:i train|i work out|i exercise)\s+(\d)\s*(?:times|days|x)\s*(?:a|per)\s*week/i, key: 'training_frequency', extract: (m) => `${m[1]} times/week` },
          { pattern: /(?:my calorie goal|target|aiming for)\s+(\d{3,5})\s*(?:cal|kcal|calories)/i, key: 'calorie_target', extract: (m) => `${m[1]} calories` },
        ];

        for (const p of insightPatterns) {
          const match = input.data.message.match(p.pattern);
          if (match) {
            const value = p.extract(match);
            const existing = await db.select().from(dikaInsights)
              .where(and(eq(dikaInsights.userId, user.id), eq(dikaInsights.insightKey, p.key)))
              .limit(1);
            if (existing.length > 0) {
              await db.update(dikaInsights)
                .set({ insightValue: value, source: 'conversation', updatedAt: new Date() })
                .where(eq(dikaInsights.id, existing[0].id));
            } else {
              await db.insert(dikaInsights).values({
                userId: user.id,
                insightKey: p.key,
                insightValue: value,
                source: 'conversation',
              });
            }
          }
        }
      } catch (insightError) {
        console.error('Insight extraction failed (non-critical):', insightError);
      }

      res.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        answer: response.answer,
        followUpChips: response.followUpChips,
      });
    } catch (error) {
      console.error('Dika multi-chat query error:', error);
      res.status(500).json({ answer: "Sorry, I encountered an error. Please try again." });
    }
  });

  app.get("/api/dika/search", requireAuth, async (req, res) => {
    const query = (req.query.q as string || '').trim();
    if (!query) return res.json({ results: [] });
    try {
      const messages = await db.select({
        messageId: dikaChatMessages.id,
        chatId: dikaChatMessages.chatId,
        role: dikaChatMessages.role,
        content: dikaChatMessages.content,
        createdAt: dikaChatMessages.createdAt,
      })
      .from(dikaChatMessages)
      .innerJoin(dikaChats, eq(dikaChatMessages.chatId, dikaChats.id))
      .where(and(
        eq(dikaChats.userId, req.user!.id),
        like(dikaChatMessages.content, `%${query}%`)
      ))
      .orderBy(desc(dikaChatMessages.createdAt))
      .limit(20);
      
      const chatIds = [...new Set(messages.map(m => m.chatId))];
      const chatMap = new Map<number, any>();
      if (chatIds.length > 0) {
        const chats = await db.select().from(dikaChats).where(inArray(dikaChats.id, chatIds));
        chats.forEach(c => chatMap.set(c.id, c));
      }
      
      const results = messages.map(m => ({
        ...m,
        chatTitle: chatMap.get(m.chatId)?.title || 'Chat',
        chatCategory: chatMap.get(m.chatId)?.category || 'general',
      }));
      res.json({ results });
    } catch (error) {
      console.error('Dika search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/dika/insights", requireAuth, async (req, res) => {
    try {
      const insights = await db.select().from(dikaInsights)
        .where(eq(dikaInsights.userId, req.user!.id))
        .orderBy(desc(dikaInsights.updatedAt));
      res.json({ insights });
    } catch (error) {
      console.error('Failed to load insights:', error);
      res.status(500).json({ message: "Failed to load insights" });
    }
  });

  app.delete("/api/dika/insights/:id", requireAuth, async (req, res) => {
    const insightId = parseInt(req.params.id);
    try {
      await db.delete(dikaInsights)
        .where(and(eq(dikaInsights.id, insightId), eq(dikaInsights.userId, req.user!.id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete insight:', error);
      res.status(500).json({ message: "Failed to delete insight" });
    }
  });

  app.get("/api/dika/action-feed", requireAuth, async (req, res) => {
    try {
      const feed = await db.select().from(dikaActionFeed)
        .where(eq(dikaActionFeed.userId, req.user!.id))
        .orderBy(desc(dikaActionFeed.createdAt))
        .limit(30);
      res.json({ feed });
    } catch (error) {
      console.error('Failed to load action feed:', error);
      res.status(500).json({ message: "Failed to load action feed" });
    }
  });

  app.get("/api/reports/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const [report] = await db.select().from(weeklyReports).where(eq(weeklyReports.token, token)).limit(1);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, report.userId));
      const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, report.userId));
      let gymName: string | null = null;
      if (report.gymId) {
        const [gym] = await db.select({ name: gyms.name }).from(gyms).where(eq(gyms.id, report.gymId));
        gymName = gym?.name || null;
      }
      res.json({
        report: report.reportData,
        rangeStart: report.rangeStart,
        rangeEnd: report.rangeEnd,
        userName: profile?.fullName || user?.username || "User",
        gymName,
        createdAt: report.createdAt,
      });
    } catch (error) {
      console.error("Report fetch error:", error);
      res.status(500).json({ message: "Failed to load report" });
    }
  });

  app.post("/api/reports/:token/email", requireAuth, async (req, res) => {
    try {
      const { token } = req.params;
      const [report] = await db.select().from(weeklyReports).where(eq(weeklyReports.token, token)).limit(1);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (report.userId !== req.user!.id) {
        return res.status(403).json({ message: "You can only email your own reports" });
      }
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, req.user!.id));
      if (!user?.email) {
        return res.status(400).json({ message: "No email address on your account" });
      }
      const [profile] = await db.select({ fullName: userProfiles.fullName }).from(userProfiles).where(eq(userProfiles.userId, req.user!.id));
      const reportData = report.reportData as any;
      const userName = profile?.fullName || "User";
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const reportUrl = `${baseUrl}/report/${token}`;

      const htmlSections = (reportData.sections || []).map((s: any) => `
        <div style="margin-bottom: 16px;">
          <h3 style="color: #4f46e5; margin: 0 0 4px;">${s.title}${s.grade ? ` (${s.grade})` : ""}</h3>
          <p style="margin: 0; color: #374151;">${s.content}</p>
        </div>
      `).join("");

      const sent = await sendEmail({
        to: user.email,
        subject: `Your Weekly Fitness Report (${report.rangeStart} - ${report.rangeEnd})`,
        text: `${reportData.greeting}\n\nOverall Grade: ${reportData.overallGrade}\n${reportData.overallSummary}\n\nView full report: ${reportUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 12px; color: white; text-align: center; margin-bottom: 24px;">
              <h1 style="margin: 0 0 8px; font-size: 24px;">Weekly Fitness Report</h1>
              <p style="margin: 0; opacity: 0.9;">${report.rangeStart} to ${report.rangeEnd}</p>
            </div>
            <p style="color: #374151; font-size: 16px;">${reportData.greeting}</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
              <span style="font-size: 36px; font-weight: bold; color: #4f46e5;">${reportData.overallGrade}</span>
              <p style="margin: 8px 0 0; color: #6b7280;">${reportData.overallSummary}</p>
            </div>
            ${htmlSections}
            <p style="color: #4f46e5; font-style: italic; margin-top: 16px;">${reportData.motivation}</p>
            <div style="text-align: center; margin-top: 24px;">
              <a href="${reportUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Full Report</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">Powered by OGym - Your Fitness Companion</p>
          </div>
        `,
      });

      if (sent) {
        res.json({ success: true, message: `Report sent to ${user.email}` });
      } else {
        res.status(500).json({ success: false, message: "Failed to send email" });
      }
    } catch (error) {
      console.error("Report email error:", error);
      res.status(500).json({ message: "Failed to send report email" });
    }
  });

  const intelligenceReportCache = new Map<string, { data: any; expiresAt: number }>();
  const REPORT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  app.get("/api/intelligence-report", requireAuth, requireAiConsent, async (req, res) => {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const gymId = req.user!.gymId;
      const days = parseInt(req.query.days as string) || 28;

      const cacheKey = `${userId}-${role}-${gymId}-${days}`;
      const cached = intelligenceReportCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.data);
      }

      const { generateMemberReport, generateOwnerReport, generateTrainerReport } = await import("./dika/intelligence-report");

      let report;
      if (role === "owner" && gymId) {
        report = await generateOwnerReport(gymId, days);
      } else if (role === "trainer" && gymId) {
        report = await generateTrainerReport(userId, gymId, days);
      } else {
        report = await generateMemberReport(userId, days);
      }

      intelligenceReportCache.set(cacheKey, { data: report, expiresAt: Date.now() + REPORT_CACHE_TTL });

      res.json(report);
    } catch (error) {
      console.error("Intelligence report error:", error);
      res.status(500).json({ message: "Failed to generate intelligence report" });
    }
  });

  app.post("/api/dika/find-food", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        lat: z.number(),
        lon: z.number(),
        radiusMiles: z.number().min(0.5).max(10).default(3),
      });

      const input = schema.parse(req.body);
      const userId = req.user!.id;
      const radiusMeters = input.radiusMiles * 1609.34;

      const nutritionResult = await db.execute(
        sql`SELECT COALESCE(SUM(calories * serving_quantity), 0) as calories FROM food_logs WHERE user_id = ${userId} AND date::date = CURRENT_DATE`
      );
      const nutritionRow = nutritionResult.rows?.[0] || nutritionResult[0];

      const goalRows = await db.execute(
        sql`SELECT calorie_goal, goal_type FROM calorie_goals WHERE user_id = ${userId} LIMIT 1`
      );
      const goalRow = goalRows.rows?.[0] || goalRows[0];

      const calorieGoal = Number(goalRow?.calorie_goal) || 2000;
      const goalType = ((goalRow?.goal_type as string) || 'maintain') as 'lose' | 'maintain' | 'gain';
      const consumed = Number((nutritionRow as any)?.calories) || 0;
      const remainingCalories = Math.max(0, calorieGoal - consumed);

      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"](around:${radiusMeters},${input.lat},${input.lon});
          node["amenity"="fast_food"](around:${radiusMeters},${input.lat},${input.lon});
          node["amenity"="cafe"](around:${radiusMeters},${input.lat},${input.lon});
        );
        out body;
      `;

      const overpassServers = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
      ];

      let data: any = null;
      let lastError: Error | null = null;

      for (const server of overpassServers) {
        try {
          const overpassUrl = `${server}?data=${encodeURIComponent(overpassQuery)}`;
          const response = await fetch(overpassUrl, {
            headers: { 'User-Agent': 'OGym-FitnessApp/1.0 (contact@ogym.fitness)' }
          });
          if (response.ok) {
            data = await response.json();
            break;
          }
          lastError = new Error(`${server} returned ${response.status}`);
        } catch (err) {
          lastError = err as Error;
        }
      }

      if (!data) {
        throw lastError || new Error('All Overpass API servers failed');
      }

      const elements = data.elements || [];
      const toRad = (deg: number) => deg * Math.PI / 180;
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3959;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const restaurants = elements
        .filter((el: any) => el.tags?.name)
        .map((el: any) => {
          const distance = haversineDistance(input.lat, input.lon, el.lat, el.lon);
          const restaurantSuggestion = findRestaurantSuggestion(el.tags.name);
          let suggestion = null;
          let category = 'casual';
          if (restaurantSuggestion) {
            suggestion = getSuggestionForGoal(restaurantSuggestion, goalType as GoalType, remainingCalories);
            category = restaurantSuggestion.category;
          }
          return { name: el.tags.name, distance, distanceText: distance < 1 ? `${(distance * 5280).toFixed(0)} ft` : `${distance.toFixed(1)} mi`, suggestion, category, lat: el.lat, lon: el.lon };
        })
        .filter((r: any) => r.suggestion !== null)
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 8);

      const dikaMessage = getGeneralDikaMessage(goalType as GoalType, remainingCalories);

      res.json({
        restaurants,
        dikaMessage,
        goalType,
        remainingCalories,
        calorieGoal,
        consumed,
      });
    } catch (error) {
      console.error("Dika find-food error:", error);
      res.status(500).json({ message: "Failed to find nearby restaurants" });
    }
  });

  // Save AI-generated workout plan
  app.post("/api/dika/save-workout", requireAuth, async (req, res) => {
    // Only members can save workout plans
    if (req.user!.role !== 'member') {
      return res.status(403).json({ message: "Only members can save workout plans" });
    }
    // Trainer-led gym members cannot save their own workouts
    if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
      return res.status(403).json({ message: "Trainer-led members cannot change their workout plans. Ask your trainer to update your cycle." });
    }
    
    const exerciseSchema = z.object({
      exerciseName: z.string().min(1).max(100),
      muscleType: z.string().min(1).max(100),
      bodyPart: z.string().min(1).max(50),
      sets: z.number().int().min(1).max(30),
      reps: z.number().int().min(1).max(200),
      restSeconds: z.number().int().optional(),
    });
    
    const daySchema = z.object({
      dayIndex: z.number().int().min(0).max(13),
      dayLabel: z.string().min(1).max(100),
      exercises: z.array(exerciseSchema).min(1).max(30),
    });
    
    const schema = z.object({
      plan: z.object({
        name: z.string().min(1).max(150),
        cycleLength: z.number().int().min(1).max(14),
        days: z.array(daySchema).min(1).max(14),
        restDays: z.array(z.number().int().min(0).max(13)),
      }),
    });
    
    const input = schema.safeParse(req.body);
    if (!input.success) {
      console.error('Save workout validation error:', JSON.stringify(input.error.errors, null, 2));
      console.error('Request body:', JSON.stringify(req.body, null, 2).slice(0, 500));
      return res.status(400).json({ message: "Invalid workout plan", errors: input.error.errors });
    }
    
    const user = req.user!;
    const plan = input.data.plan;
    
    try {
      const today = getLocalDate(req);
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 3);
      
      // Note: createWorkoutCycle automatically deactivates existing active cycles (moves them to phases)
      
      // Create workout cycle
      const cycle = await storage.createWorkoutCycle({
        gymId: user.gymId || null,
        trainerId: null,
        memberId: user.id,
        name: plan.name,
        cycleLength: plan.cycleLength,
        dayLabels: plan.days.map(d => d.dayLabel),
        restDays: plan.restDays,
        startDate: today,
        endDate: endDate.toISOString().split('T')[0],
        progressionMode: 'completion',
        source: 'self',
        isActive: true,
      });
      
      // Create workout items for each day
      for (const day of plan.days) {
        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];
          await storage.addWorkoutItem({
            cycleId: cycle.id,
            dayIndex: day.dayIndex,
            muscleType: ex.muscleType,
            bodyPart: ex.bodyPart,
            exerciseName: ex.exerciseName,
            sets: ex.sets,
            reps: ex.reps,
            weight: null,
            orderIndex: i,
          });
        }
      }
      
      res.json({ success: true, cycleId: cycle.id, message: "Workout saved successfully!" });
    } catch (error) {
      console.error('Save workout error:', error);
      res.status(500).json({ message: "Failed to save workout" });
    }
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
      res.json(user ? sanitizeUser(user) : null);
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

  // === TRAINING MODE ENDPOINT ===
  // Note: Training mode is now controlled by gym owners via the assign-trainer endpoint
  // Members can only view their training mode, not change it
  app.get("/api/member/training-mode", requireRole(["member"]), async (req, res) => {
    try {
      const trainingMode = await storage.getMemberTrainingMode(req.user!.id);
      res.json({ trainingMode: trainingMode || 'trainer_led' });
    } catch (error) {
      console.error("[Training Mode Get] Error:", error);
      res.status(500).json({ message: "Failed to get training mode" });
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

  // === GYM PAYMENT SETTINGS ROUTES ===
  
  app.get("/api/owner/payment-settings", requireRole(["owner"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned to this owner account" });
      }
      const settings = await storage.getGymPaymentSettings(req.user!.gymId);
      res.json(settings);
    } catch (error) {
      console.error("[Payment Settings Get] Error:", error);
      res.status(500).json({ message: "Failed to fetch payment settings" });
    }
  });

  app.put("/api/owner/payment-settings", requireRole(["owner"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned to this owner account" });
      }
      const schema = z.object({
        paymentLinks: z.object({
          upi: z.string().optional(),
          venmo: z.string().optional(),
          cashapp: z.string().optional(),
          zelle: z.string().optional(),
          paypal: z.string().optional(),
          bankDetails: z.string().optional(),
          customLink: z.string().optional(),
          customLinkLabel: z.string().optional(),
        }).optional(),
        dayPassPrice: z.number().optional(),
      });
      const input = schema.parse(req.body);
      await storage.updateGymPaymentSettings(req.user!.gymId, input);
      res.json({ success: true });
    } catch (error) {
      console.error("[Payment Settings Update] Error:", error);
      res.status(500).json({ message: "Failed to update payment settings" });
    }
  });

  // Get payment confirmation requests (for owner dashboard)
  app.get("/api/owner/payment-confirmations", requireRole(["owner"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned" });
      }
      const status = req.query.status as string | undefined;
      const confirmations = await storage.getPaymentConfirmations(req.user!.gymId, status);
      res.json(confirmations);
    } catch (error) {
      console.error("[Payment Confirmations Get] Error:", error);
      res.status(500).json({ message: "Failed to fetch payment confirmations" });
    }
  });

  // Confirm or reject a payment confirmation
  app.patch("/api/owner/payment-confirmations/:id", requireRole(["owner"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned" });
      }
      const id = parseInt(req.params.id);
      const schema = z.object({
        status: z.enum(["confirmed", "rejected"]),
      });
      const input = schema.parse(req.body);
      await storage.updatePaymentConfirmation(id, req.user!.gymId, req.user!.id, input.status);
      res.json({ success: true });
    } catch (error) {
      console.error("[Payment Confirmation Update] Error:", error);
      res.status(500).json({ message: "Failed to update payment confirmation" });
    }
  });

  // Member submits payment confirmation
  app.post("/api/member/payment-confirmation", requireRole(["member"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned" });
      }
      const schema = z.object({
        paymentType: z.enum(["subscription", "day_pass"]),
        paymentMethod: z.enum(["upi", "venmo", "cashapp", "zelle", "paypal", "bank_transfer", "cash", "other"]),
        amount: z.number(),
        referenceNote: z.string().optional(),
        subscriptionId: z.number().optional(),
      });
      const input = schema.parse(req.body);
      const confirmation = await storage.createPaymentConfirmation({
        gymId: req.user!.gymId,
        memberId: req.user!.id,
        walkInVisitorId: null,
        ...input,
      });
      res.status(201).json(confirmation);
    } catch (error) {
      console.error("[Payment Confirmation Create] Error:", error);
      res.status(500).json({ message: "Failed to submit payment confirmation" });
    }
  });

  // Get gym payment links for member (public for paying)
  app.get("/api/gym/payment-options", requireRole(["member", "trainer"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned" });
      }
      const settings = await storage.getGymPaymentSettings(req.user!.gymId);
      res.json(settings);
    } catch (error) {
      console.error("[Gym Payment Options Get] Error:", error);
      res.status(500).json({ message: "Failed to fetch payment options" });
    }
  });

  // Get membership plans for member's gym
  app.get("/api/member/membership-plans", requireRole(["member"]), async (req, res) => {
    try {
      if (!req.user!.gymId) {
        return res.status(400).json({ message: "No gym assigned" });
      }
      const plans = await storage.getMembershipPlans(req.user!.gymId);
      res.json(plans);
    } catch (error) {
      console.error("[Member Membership Plans] Error:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
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
    
    if ((member as any).cycleId) {
      const cycle = await storage.getCycle((member as any).cycleId);
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
    
    const stats = await storage.getEnhancedMemberStats(memberId, req.user!.gymId);
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
      const stats = await storage.getMemberStats(memberId, req.user!.gymId);
      const progress = await storage.getMemberProgress(memberId);
      res.json({ full: true, stats, progress });
    } else {
      const stats = await storage.getMemberStats(memberId, req.user!.gymId);
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
    const measurements = await storage.getBodyMeasurements(req.user!.gymId, req.user!.id);
    res.json(measurements);
  });

  app.get("/api/me/body/latest", requireRole(["member"]), async (req, res) => {
    const measurement = await storage.getLatestBodyMeasurement(req.user!.gymId, req.user!.id);
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
      gymId: req.user!.gymId,
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
    if (req.query.platform === 'ios_native') {
      return res.status(403).json({ message: "This feature is available on the web version at app.ogym.fitness" });
    }
    const clientDate = req.params.date || getLocalDate(req);
    const gymId = req.user!.gymId!;
    const insights = await storage.getAiInsights(gymId, clientDate);

    let equipmentActions: { name: string; category: string; action: string; urgency: string; reason: string; usage: number; changePercent: number; confidence: 'high' | 'medium' | 'low' }[] = [];
    let paymentFollowUps: { memberId: number; name: string; amount: number; month: string; daysOverdue: number }[] = [];
    let equipmentSummaryForAi = '';

    try {
      const gymEquipList = await db.select().from(gymEquipment).where(eq(gymEquipment.gymId, gymId));
      if (gymEquipList.length > 0) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(now); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];
        const sixtyStr = sixtyDaysAgo.toISOString().split('T')[0];
        const ninetyStr = ninetyDaysAgo.toISOString().split('T')[0];

        const recentExercises = await db.select({
          exerciseName: workoutLogExercises.exerciseName,
          count: sql<number>`count(*)::int`,
        }).from(workoutLogExercises)
          .innerJoin(workoutLogs, eq(workoutLogExercises.workoutLogId, workoutLogs.id))
          .where(and(eq(workoutLogs.gymId, gymId), gte(workoutLogs.completedDate, thirtyStr)))
          .groupBy(workoutLogExercises.exerciseName);

        const prevExercises = await db.select({
          exerciseName: workoutLogExercises.exerciseName,
          count: sql<number>`count(*)::int`,
        }).from(workoutLogExercises)
          .innerJoin(workoutLogs, eq(workoutLogExercises.workoutLogId, workoutLogs.id))
          .where(and(eq(workoutLogs.gymId, gymId), gte(workoutLogs.completedDate, sixtyStr), lte(workoutLogs.completedDate, thirtyStr)))
          .groupBy(workoutLogExercises.exerciseName);

        const has3MonthData = await db.select({ cnt: sql<number>`count(*)::int` }).from(workoutLogs)
          .where(and(eq(workoutLogs.gymId, gymId), gte(workoutLogs.completedDate, ninetyStr), lte(workoutLogs.completedDate, sixtyStr)));
        const hasThreeMonths = Number(has3MonthData[0]?.cnt || 0) > 0;

        const exerciseCountMap = new Map(recentExercises.map(e => [e.exerciseName.toLowerCase(), e.count]));
        const prevCountMap = new Map(prevExercises.map(e => [e.exerciseName.toLowerCase(), e.count]));

        const GENERIC_MAP: Record<string, string[]> = {
          'bench': ['bench press', 'dumbbell bench', 'incline bench', 'decline bench', 'chest press', 'dumbbell press'],
          'cable': ['cable fly', 'cable crossover', 'tricep pushdown', 'cable curl', 'face pull', 'lat pulldown', 'cable row'],
          'power rack': ['squat', 'back squat', 'front squat', 'overhead press', 'barbell row', 'military press', 'deadlift'],
          'squat rack': ['squat', 'back squat', 'front squat', 'overhead press', 'barbell row'],
          'smith machine': ['smith squat', 'smith bench', 'smith press', 'smith row', 'smith lunge'],
          'leg press': ['leg press'],
          'dumbbell': ['dumbbell curl', 'dumbbell row', 'lateral raise', 'shoulder press', 'dumbbell fly', 'hammer curl'],
          'treadmill': ['treadmill', 'running', 'walking', 'jogging'],
          'elliptical': ['elliptical'],
          'rowing machine': ['rowing'],
          'pull-up bar': ['pull-up', 'chin-up', 'hanging leg raise'],
        };

        for (const equip of gymEquipList) {
          const nameKey = equip.name.toLowerCase();
          let matchedExercises: string[] = [];
          for (const [key, exercises] of Object.entries(GENERIC_MAP)) {
            if (nameKey.includes(key)) { matchedExercises = exercises; break; }
          }

          let totalUsage = 0, prevUsage = 0;
          for (const ex of matchedExercises) {
            totalUsage += exerciseCountMap.get(ex) || 0;
            prevUsage += prevCountMap.get(ex) || 0;
          }

          const usagePerUnit = equip.quantity ? Math.round(totalUsage / equip.quantity) : totalUsage;
          const changePercent = prevUsage > 0 ? Math.round(((totalUsage - prevUsage) / prevUsage) * 100) : (totalUsage > 0 ? 100 : 0);
          const trend = prevUsage > 0 ? (totalUsage - prevUsage) / prevUsage : 0;

          const confidence: 'high' | 'medium' | 'low' = hasThreeMonths && prevUsage > 3 ? 'high' : prevUsage > 0 ? 'medium' : 'low';

          let action = 'ok';
          let urgency = 'low';
          let reason = '';

          if (usagePerUnit >= 30 && trend >= 0) {
            action = 'overloaded';
            urgency = 'high';
            reason = `${equip.name} is heavily used at ${usagePerUnit} uses/unit${trend > 0 ? `, up ${changePercent}%` : ''}. Consider adding capacity.`;
          } else if (trend >= 0.5 && totalUsage >= 10) {
            action = 'growing_fast';
            urgency = 'medium';
            reason = `Usage surging +${changePercent}% (${prevUsage} → ${totalUsage}). May need attention soon.`;
          } else if (totalUsage === 0 && prevUsage > 5) {
            action = 'unused';
            urgency = 'medium';
            reason = `Dropped from ${prevUsage} to 0 uses. Check if it needs maintenance or replacement.`;
          } else if (trend <= -0.5 && prevUsage > 5) {
            action = 'declining';
            urgency = 'low';
            reason = `Usage dropped ${Math.abs(changePercent)}%. Members may be shifting to alternatives.`;
          }

          if (action !== 'ok') {
            equipmentActions.push({
              name: equip.name,
              category: equip.category || 'Other',
              action,
              urgency,
              reason,
              usage: totalUsage,
              changePercent,
              confidence,
            });
          }
        }

        equipmentActions.sort((a, b) => {
          const urgencyOrder = { high: 0, medium: 1, low: 2 };
          return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 2) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 2);
        });

        if (equipmentActions.length > 0) {
          equipmentSummaryForAi = `Equipment: ${equipmentActions.slice(0, 3).map(e => `${e.name} (${e.action}, ${e.usage} uses, ${e.changePercent > 0 ? '+' : ''}${e.changePercent}%)`).join('; ')}`;
        }
      }
    } catch (err) {
      console.error("Equipment actions error (non-fatal):", err);
    }

    try {
      const currentMonth = clientDate.slice(0, 7);
      const allPayments = await db.select().from(payments)
        .where(and(eq(payments.gymId, gymId), eq(payments.month, currentMonth)));
      const unpaid = allPayments.filter(p => p.status === 'unpaid' || p.status === 'partial');

      for (const p of unpaid) {
        const member = await db.select({ id: users.id, username: users.username })
          .from(users).where(eq(users.id, p.memberId)).limit(1);
        if (member[0]) {
          const daysOverdue = Math.max(0, Math.floor((new Date().getTime() - new Date(p.updatedAt || p.month + '-01').getTime()) / (1000 * 60 * 60 * 24)));
          paymentFollowUps.push({
            memberId: member[0].id,
            name: member[0].username,
            amount: (p.amountDue - (p.amountPaid || 0)) / 100,
            month: p.month,
            daysOverdue,
          });
        }
      }
      paymentFollowUps.sort((a, b) => b.amount - a.amount);
    } catch (err) {
      console.error("Payment follow-ups error (non-fatal):", err);
    }

    try {
      const { generateChurnExplanations, generateAiInsightOfTheDay } = await import('./dika/owner-ai-engine');

      const churnDataForAi = insights.churnRisk.members.slice(0, 8).map(m => {
        return {
          name: m.name,
          daysAbsent: m.daysAbsent,
          churnScore: m.churnScore,
          factors: m.factors,
          predictedChurnWindow: m.predictedChurnWindow,
          recentVisitCount14d: Math.round(m.factors.attendance < 40 ? (14 - m.daysAbsent) : m.factors.attendance / 10),
          prevVisitCount14d: Math.round(m.factors.trend > 50 ? 6 : 3),
          hasOverduePayments: m.factors.payment > 30,
          memberAgeDays: m.factors.age > 60 ? 30 : m.factors.age > 40 ? 90 : 180,
          preferredDay: m.recommendation?.match(/on (\w+)s/)?.[1],
        };
      });

      const paymentSummaryForAi = paymentFollowUps.length > 0
        ? `Overdue payments: ${paymentFollowUps.length} members owe total $${paymentFollowUps.reduce((s, p) => s + p.amount, 0).toFixed(0)}`
        : '';

      const [explanations, aiInsight] = await Promise.all([
        churnDataForAi.length > 0 ? generateChurnExplanations(churnDataForAi) : Promise.resolve(new Map()),
        generateAiInsightOfTheDay({
          totalMembers: insights.memberInsights.totalActive + insights.memberInsights.atRiskCount,
          activeMembers: insights.memberInsights.totalActive,
          newThisMonth: insights.memberInsights.newThisMonth,
          atRiskCount: insights.memberInsights.atRiskCount,
          attendanceTrend: insights.attendancePatterns.trend,
          trendPercent: insights.attendancePatterns.trendPercent,
          avgDailyAttendance: insights.attendancePatterns.averageDaily,
          busiestDay: insights.attendancePatterns.busiestDays[0]?.day || 'N/A',
          quietestDay: insights.attendancePatterns.busiestDays[insights.attendancePatterns.busiestDays.length - 1]?.day || 'N/A',
          revenueThisMonth: insights.monthComparison?.revenue?.current || 0,
          revenuePrevMonth: insights.monthComparison?.revenue?.previous || 0,
          weeklyAttendance: insights.weeklyTrends?.weeks?.map(w => w.attendance) || [],
          highRiskMembers: insights.churnRisk.members.filter(m => m.riskLevel === 'high').length,
          neverVisitedNewMembers: insights.followUpReminders.items.filter(i => i.type === 'new_member').length,
          interventionSuccessRate: insights.interventionStats?.successRate || 0,
          equipmentContext: equipmentSummaryForAi,
          paymentContext: paymentSummaryForAi,
        }),
      ]);

      for (let i = 0; i < Math.min(8, insights.churnRisk.members.length); i++) {
        const explanation = explanations.get(i);
        if (explanation) {
          insights.churnRisk.members[i].recommendation = explanation;
        }
      }

      if (aiInsight) {
        insights.insightOfTheDay = aiInsight;
      }
    } catch (err) {
      console.error("AI enrichment error (non-fatal):", err);
    }

    res.json({ ...insights, equipmentActions, paymentFollowUps });
  });

  // === OWNER INTERVENTIONS ===
  app.post("/api/owner/interventions", requireRole(["owner"]), async (req, res) => {
    try {
      const { memberId, actionType, triggerReason, messageSent } = req.body;
      if (!memberId || !actionType) {
        return res.status(400).json({ message: "memberId and actionType are required" });
      }
      const intervention = await storage.createOwnerIntervention({
        gymId: req.user!.gymId!,
        ownerId: req.user!.id,
        memberId,
        actionType,
        triggerReason: triggerReason || null,
        messageSent: messageSent || null,
      });
      res.json(intervention);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to log intervention" });
    }
  });

  app.get("/api/owner/interventions", requireRole(["owner"]), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;
      const outcome = req.query.outcome as string | undefined;
      const interventions = await storage.getOwnerInterventions(req.user!.gymId!, limit);
      let filtered = interventions;
      if (memberId) {
        filtered = filtered.filter(i => i.memberId === memberId);
      }
      if (outcome === 'returned') {
        filtered = filtered.filter(i => i.memberReturnedWithin7Days === true);
      } else if (outcome === 'not_returned') {
        filtered = filtered.filter(i => i.memberReturnedWithin7Days === false);
      } else if (outcome === 'pending') {
        filtered = filtered.filter(i => i.memberReturnedWithin7Days === null);
      }
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get interventions" });
    }
  });

  app.post("/api/owner/interventions/generate-message", requireRole(["owner"]), async (req, res) => {
    try {
      const { memberId, memberName, daysAbsent, churnScore, recommendation } = req.body;
      if (!memberId || !memberName) {
        return res.status(400).json({ message: "memberId and memberName are required" });
      }
      const gym = await storage.getGym(req.user!.gymId!);
      const gymName = gym?.name || "our gym";
      const ownerName = req.user!.fullName || req.user!.username;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI();
      const prompt = `You are a friendly gym owner writing a personal re-engagement message to a member who hasn't visited in a while. Keep it warm, brief (2-3 sentences), and encouraging. Don't be pushy.

Gym name: ${gymName}
Owner name: ${ownerName}
Member name: ${memberName}
Days absent: ${daysAbsent || 'unknown'}
${recommendation ? `Context: ${recommendation}` : ''}

Write a short, personal message. No subject line, just the message body. Use their first name.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.8,
      });

      const message = response.choices[0]?.message?.content?.trim() || `Hey ${memberName}, we miss seeing you at ${gymName}! Would love to have you back. - ${ownerName}`;
      res.json({ message });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate message" });
    }
  });

  app.post("/api/owner/interventions/send-email", requireRole(["owner"]), async (req, res) => {
    try {
      const { memberId, subject, message } = req.body;
      if (!memberId || !message) {
        return res.status(400).json({ message: "memberId and message are required" });
      }
      const member = await storage.getUser(memberId);
      if (!member || member.gymId !== req.user!.gymId) {
        return res.status(404).json({ message: "Member not found in your gym" });
      }
      if (!member.email) {
        return res.status(400).json({ message: "Member does not have an email address on file" });
      }

      const gym = await storage.getGym(req.user!.gymId!);
      const gymName = gym?.name || "Your Gym";
      const emailSubject = subject || `Message from ${gymName}`;
      const emailHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0; font-size: 20px;">${gymName}</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-line;">${message}</p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">Sent via OGym</p>
      </div>`;

      const sent = await sendEmail({
        to: member.email,
        subject: emailSubject,
        text: message,
        html: emailHtml,
      });

      if (sent) {
        const intervention = await storage.createOwnerIntervention({
          gymId: req.user!.gymId!,
          ownerId: req.user!.id,
          memberId,
          actionType: 'email_sent',
          triggerReason: 'churn_risk_outreach',
          messageSent: message,
        });
        try {
          await storage.createSentEmail({
            gymId: req.user!.gymId!,
            ownerId: req.user!.id,
            recipientEmail: member.email!,
            recipientName: member.fullName || member.username,
            recipientType: 'member',
            recipientId: memberId,
            category: 'INTERVENTION',
            goal: null,
            subject: subject || `Message from ${gymName}`,
            message,
            status: 'sent',
          });
        } catch (logErr) {
          console.error(`[SENT EMAIL LOG] Failed to log:`, logErr);
        }
        res.json({ success: true, intervention });
      } else {
        res.status(500).json({ message: "Failed to send email" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send email" });
    }
  });

  // === AI-POWERED OWNER INSIGHTS ===
  app.get("/api/owner/ai/weekly-briefing", requireRole(["owner"]), async (req, res) => {
    if (req.query.platform === 'ios_native') {
      return res.status(403).json({ message: "This feature is available on the web version at app.ogym.fitness" });
    }
    try {
      const { generateWeeklyOwnerBriefing } = await import('./dika/owner-ai-engine');
      const clientDate = (req.query.clientDate as string) || getLocalDate(req);
      const briefing = await generateWeeklyOwnerBriefing(req.user!.gymId!, clientDate);
      res.json(briefing);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate weekly briefing" });
    }
  });

  app.get("/api/owner/ai/trainer-performance", requireRole(["owner"]), async (req, res) => {
    if (req.query.platform === 'ios_native') {
      return res.status(403).json({ message: "This feature is available on the web version at app.ogym.fitness" });
    }
    try {
      const { generateTrainerPerformanceSummary } = await import('./dika/owner-ai-engine');
      const clientDate = (req.query.clientDate as string) || getLocalDate(req);
      const summary = await generateTrainerPerformanceSummary(req.user!.gymId!, clientDate);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate trainer performance" });
    }
  });

  app.get("/api/owner/ai/reengagement", requireRole(["owner"]), async (req, res) => {
    if (req.query.platform === 'ios_native') {
      return res.status(403).json({ message: "This feature is available on the web version at app.ogym.fitness" });
    }
    try {
      const { generateReengagementCampaign } = await import('./dika/owner-ai-engine');
      const clientDate = (req.query.clientDate as string) || getLocalDate(req);
      const campaign = await generateReengagementCampaign(req.user!.gymId!, clientDate);
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate re-engagement campaign" });
    }
  });

  // === MEMBER WORKOUT ACTIVITY (for owner view) ===
  app.get("/api/owner/members/:memberId/workout-activity", requireRole(["owner", "trainer"]), async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const activity = await storage.getMemberWorkoutActivity(req.user!.gymId!, memberId, 30);
      res.json(activity);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get workout activity" });
    }
  });

  // === AUTOMATED EMAIL REMINDERS ===
  app.get("/api/owner/automated-emails/stats", requireRole(["owner"]), async (req, res) => {
    try {
      const { getAutomatedEmailStats } = await import('./automated-emails');
      const stats = await getAutomatedEmailStats(req.user!.gymId!);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get email stats" });
    }
  });

  app.post("/api/owner/automated-emails/send-expiry-reminders", requireRole(["owner"]), async (req, res) => {
    try {
      const { processSubscriptionExpiryReminders } = await import('./automated-emails');
      const clientDate = (req.body.clientDate as string) || getLocalDate(req);
      const result = await processSubscriptionExpiryReminders(clientDate);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send expiry reminders" });
    }
  });

  app.post("/api/owner/automated-emails/send-weekly-summary", requireRole(["owner"]), async (req, res) => {
    try {
      const { sendWeeklyOwnerSummaries } = await import('./automated-emails');
      const clientDate = (req.body.clientDate as string) || getLocalDate(req);
      const result = await sendWeeklyOwnerSummaries(clientDate);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send weekly summary" });
    }
  });

  // Admin-only cron trigger endpoint (for scheduled jobs)
  app.post("/api/cron/automated-emails", async (req, res) => {
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET && !req.user?.isAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { processSubscriptionExpiryReminders, sendWeeklyOwnerSummaries } = await import('./automated-emails');
      const clientDate = new Date().toISOString().split('T')[0];
      
      const expiryResult = await processSubscriptionExpiryReminders(clientDate);
      
      // Send weekly summaries on Mondays
      const dayOfWeek = new Date().getDay();
      let weeklyResult = null;
      if (dayOfWeek === 1) { // Monday
        weeklyResult = await sendWeeklyOwnerSummaries(clientDate);
      }
      
      res.json({ 
        expiryReminders: expiryResult,
        weeklySummaries: weeklyResult,
        message: "Automated emails processed"
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to process automated emails" });
    }
  });

  // === GYM INTELLIGENCE ===
  app.get("/api/owner/gym-intelligence/peak-hours", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const records = await db.select({
        createdAt: attendance.createdAt,
      }).from(attendance).where(
        and(
          eq(attendance.gymId, gymId),
          eq(attendance.status, 'present'),
          gte(attendance.date, thirtyDaysAgoStr)
        )
      );

      const hourCounts: Record<number, number> = {};
      for (let h = 5; h <= 23; h++) hourCounts[h] = 0;

      for (const r of records) {
        if (r.createdAt) {
          const hour = new Date(r.createdAt).getHours();
          if (hour >= 5 && hour <= 23) {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }
        }
      }

      const hourData = Object.entries(hourCounts).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
        label: `${parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`,
      }));

      const maxCount = Math.max(...hourData.map(h => h.count), 1);
      const peakThreshold = maxCount * 0.7;
      const lowThreshold = maxCount * 0.3;

      const peakHours = hourData.filter(h => h.count >= peakThreshold && h.count > 0).map(h => h.hour);
      const lowHours = hourData.filter(h => h.count <= lowThreshold || h.count === 0).map(h => h.hour);

      const formatRange = (hours: number[]) => {
        if (hours.length === 0) return null;
        hours.sort((a, b) => a - b);
        const ranges: string[] = [];
        let start = hours[0];
        let end = hours[0];
        for (let i = 1; i < hours.length; i++) {
          if (hours[i] === end + 1) {
            end = hours[i];
          } else {
            const fmt = (h: number) => `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
            ranges.push(start === end ? fmt(start) : `${fmt(start)}–${fmt(end + 1)}`);
            start = hours[i];
            end = hours[i];
          }
        }
        const fmt = (h: number) => `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
        ranges.push(start === end ? fmt(start) : `${fmt(start)}–${fmt(end + 1)}`);
        return ranges.join(', ');
      };

      res.json({
        hourData: hourData.map(h => ({
          ...h,
          level: h.count >= peakThreshold && h.count > 0 ? 'peak' : h.count <= lowThreshold || h.count === 0 ? 'low' : 'moderate',
        })),
        peakSummary: formatRange(peakHours),
        lowSummary: formatRange(lowHours),
        totalCheckIns: records.length,
        daysAnalyzed: 30,
      });
    } catch (error) {
      console.error('Peak hours error:', error);
      res.status(500).json({ error: 'Failed to compute peak hours' });
    }
  });

  app.get("/api/owner/gym-intelligence/muscle-trends", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const now = new Date();
      const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      const lastMonthEnd = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-${String(new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

      const thisMonthExercises = await db.select({
        muscleType: workoutLogExercises.muscleType,
        count: sql<number>`count(*)::int`,
      }).from(workoutLogExercises)
        .innerJoin(workoutLogs, eq(workoutLogExercises.workoutLogId, workoutLogs.id))
        .where(
          and(
            eq(workoutLogs.gymId, gymId),
            gte(workoutLogs.completedDate, thisMonthStart),
            isNotNull(workoutLogExercises.muscleType)
          )
        )
        .groupBy(workoutLogExercises.muscleType);

      const lastMonthExercises = await db.select({
        muscleType: workoutLogExercises.muscleType,
        count: sql<number>`count(*)::int`,
      }).from(workoutLogExercises)
        .innerJoin(workoutLogs, eq(workoutLogExercises.workoutLogId, workoutLogs.id))
        .where(
          and(
            eq(workoutLogs.gymId, gymId),
            gte(workoutLogs.completedDate, lastMonthStart),
            lte(workoutLogs.completedDate, lastMonthEnd),
            isNotNull(workoutLogExercises.muscleType)
          )
        )
        .groupBy(workoutLogExercises.muscleType);

      const lastMonthMap = new Map(lastMonthExercises.map(e => [e.muscleType, e.count]));
      const allMuscles = new Set([
        ...thisMonthExercises.map(e => e.muscleType),
        ...lastMonthExercises.map(e => e.muscleType),
      ]);

      const trends = Array.from(allMuscles).filter(Boolean).map(muscle => {
        const thisCount = thisMonthExercises.find(e => e.muscleType === muscle)?.count || 0;
        const lastCount = lastMonthMap.get(muscle) || 0;
        const change = lastCount > 0 ? Math.round(((thisCount - lastCount) / lastCount) * 100) : (thisCount > 0 ? 100 : 0);
        return {
          muscle: muscle!,
          thisMonth: thisCount,
          lastMonth: lastCount,
          change,
          direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
        };
      }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

      const totalThisMonth = thisMonthExercises.reduce((sum, e) => sum + e.count, 0);
      const totalLastMonth = lastMonthExercises.reduce((sum, e) => sum + e.count, 0);
      const overallChange = totalLastMonth > 0 ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100) : 0;

      res.json({
        trends,
        totalThisMonth,
        totalLastMonth,
        overallChange,
      });
    } catch (error) {
      console.error('Muscle trends error:', error);
      res.status(500).json({ error: 'Failed to compute muscle trends' });
    }
  });

  // === GYM EQUIPMENT MANAGEMENT ===
  app.get("/api/owner/gym-equipment", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const equipment = await db.select().from(gymEquipment).where(eq(gymEquipment.gymId, gymId)).orderBy(asc(gymEquipment.category), asc(gymEquipment.name));

      const equipmentIds = equipment.map(e => e.id);
      const mappings = equipmentIds.length > 0
        ? await db.select().from(equipmentExerciseMappings).where(inArray(equipmentExerciseMappings.equipmentId, equipmentIds))
        : [];

      const result = equipment.map(e => ({
        ...e,
        exercises: mappings.filter(m => m.equipmentId === e.id),
      }));

      res.json(result);
    } catch (error) {
      console.error('Get equipment error:', error);
      res.status(500).json({ error: 'Failed to fetch equipment' });
    }
  });

  app.post("/api/owner/gym-equipment", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const { name, category, quantity, notes } = req.body;
      if (!name || !category) return res.status(400).json({ error: 'Name and category are required' });

      const [created] = await db.insert(gymEquipment).values({
        gymId,
        name: name.trim(),
        category: category.trim(),
        quantity: quantity || 1,
        notes: notes?.trim() || null,
      }).returning();

      res.json({ ...created, exercises: [] });
    } catch (error) {
      console.error('Add equipment error:', error);
      res.status(500).json({ error: 'Failed to add equipment' });
    }
  });

  app.patch("/api/owner/gym-equipment/:id", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const equipId = parseInt(req.params.id);
      const existing = await db.select().from(gymEquipment).where(and(eq(gymEquipment.id, equipId), eq(gymEquipment.gymId, gymId)));
      if (existing.length === 0) return res.status(404).json({ error: 'Equipment not found' });

      const { name, category, quantity, notes } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (category !== undefined) updates.category = category.trim();
      if (quantity !== undefined) updates.quantity = quantity;
      if (notes !== undefined) updates.notes = notes?.trim() || null;

      const [updated] = await db.update(gymEquipment).set(updates).where(eq(gymEquipment.id, equipId)).returning();
      res.json(updated);
    } catch (error) {
      console.error('Update equipment error:', error);
      res.status(500).json({ error: 'Failed to update equipment' });
    }
  });

  app.delete("/api/owner/gym-equipment/:id", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const equipId = parseInt(req.params.id);
      const existing = await db.select().from(gymEquipment).where(and(eq(gymEquipment.id, equipId), eq(gymEquipment.gymId, gymId)));
      if (existing.length === 0) return res.status(404).json({ error: 'Equipment not found' });

      await db.delete(equipmentExerciseMappings).where(eq(equipmentExerciseMappings.equipmentId, equipId));
      await db.delete(gymEquipment).where(eq(gymEquipment.id, equipId));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete equipment error:', error);
      res.status(500).json({ error: 'Failed to delete equipment' });
    }
  });

  app.post("/api/owner/gym-equipment/:id/exercises", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const equipId = parseInt(req.params.id);
      const existing = await db.select().from(gymEquipment).where(and(eq(gymEquipment.id, equipId), eq(gymEquipment.gymId, gymId)));
      if (existing.length === 0) return res.status(404).json({ error: 'Equipment not found' });

      const { exerciseName, priority } = req.body;
      if (!exerciseName) return res.status(400).json({ error: 'Exercise name is required' });

      const [mapping] = await db.insert(equipmentExerciseMappings).values({
        equipmentId: equipId,
        exerciseName: exerciseName.trim(),
        priority: priority || 'primary',
      }).returning();

      res.json(mapping);
    } catch (error) {
      console.error('Add exercise mapping error:', error);
      res.status(500).json({ error: 'Failed to add exercise mapping' });
    }
  });

  app.delete("/api/owner/gym-equipment/exercises/:mappingId", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const mappingId = parseInt(req.params.mappingId);

      const [mapping] = await db.select({
        id: equipmentExerciseMappings.id,
        equipmentId: equipmentExerciseMappings.equipmentId,
      }).from(equipmentExerciseMappings)
        .innerJoin(gymEquipment, eq(equipmentExerciseMappings.equipmentId, gymEquipment.id))
        .where(and(eq(equipmentExerciseMappings.id, mappingId), eq(gymEquipment.gymId, gymId)));

      if (!mapping) return res.status(404).json({ error: 'Mapping not found' });

      await db.delete(equipmentExerciseMappings).where(eq(equipmentExerciseMappings.id, mappingId));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete exercise mapping error:', error);
      res.status(500).json({ error: 'Failed to delete exercise mapping' });
    }
  });

  app.get("/api/owner/gym-intelligence/equipment-stress", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const thirtyDaysAgoDate = new Date();
      thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
      const thirtyDaysAgo = thirtyDaysAgoDate.toISOString().split('T')[0];

      const equipment = await db.select().from(gymEquipment).where(eq(gymEquipment.gymId, gymId));
      if (equipment.length === 0) {
        return res.json({ equipment: [], hasSetup: false });
      }

      const equipmentIds = equipment.map(e => e.id);
      const mappings = await db.select().from(equipmentExerciseMappings).where(inArray(equipmentExerciseMappings.equipmentId, equipmentIds));

      const sixtyDaysAgoDate = new Date();
      sixtyDaysAgoDate.setDate(sixtyDaysAgoDate.getDate() - 60);
      const sixtyDaysAgo = sixtyDaysAgoDate.toISOString().split('T')[0];

      const recentExercises = await db.select({
        exerciseName: workoutLogExercises.exerciseName,
        muscleType: workoutLogExercises.muscleType,
        count: sql<number>`count(*)::int`,
      }).from(workoutLogExercises)
        .innerJoin(workoutLogs, eq(workoutLogExercises.workoutLogId, workoutLogs.id))
        .where(and(eq(workoutLogs.gymId, gymId), gte(workoutLogs.completedDate, thirtyDaysAgo)))
        .groupBy(workoutLogExercises.exerciseName, workoutLogExercises.muscleType);

      const previousExercises = await db.select({
        exerciseName: workoutLogExercises.exerciseName,
        muscleType: workoutLogExercises.muscleType,
        count: sql<number>`count(*)::int`,
      }).from(workoutLogExercises)
        .innerJoin(workoutLogs, eq(workoutLogExercises.workoutLogId, workoutLogs.id))
        .where(and(
          eq(workoutLogs.gymId, gymId),
          gte(workoutLogs.completedDate, sixtyDaysAgo),
          lte(workoutLogs.completedDate, thirtyDaysAgo)
        ))
        .groupBy(workoutLogExercises.exerciseName, workoutLogExercises.muscleType);

      const exerciseMuscleMap = new Map<string, string>();
      for (const e of [...recentExercises, ...previousExercises]) {
        if (e.muscleType) exerciseMuscleMap.set(e.exerciseName.toLowerCase(), e.muscleType);
      }

      const exerciseCountMap = new Map(recentExercises.map(e => [e.exerciseName.toLowerCase(), e.count]));
      const prevExerciseCountMap = new Map(previousExercises.map(e => [e.exerciseName.toLowerCase(), e.count]));

      const GENERIC_MAP: Record<string, string[]> = {
        'bench': ['bench press', 'dumbbell bench', 'incline bench', 'decline bench', 'chest press', 'dumbbell press', 'incline press', 'decline press'],
        'cable': ['cable fly', 'cable crossover', 'tricep pushdown', 'cable curl', 'face pull', 'lat pulldown', 'cable row', 'cable crunch', 'rope pushdown', 'cable lateral raise'],
        'squat rack': ['squat', 'back squat', 'front squat', 'overhead press', 'barbell row', 'military press', 'rack pull'],
        'power rack': ['squat', 'back squat', 'front squat', 'overhead press', 'barbell row', 'military press', 'rack pull', 'deadlift'],
        'rack': ['squat', 'back squat', 'front squat', 'overhead press', 'rack pull'],
        'leg press': ['leg press', 'calf raise', 'seated calf raise'],
        'smith machine': ['smith machine', 'smith squat', 'smith bench'],
        'treadmill': ['treadmill', 'running', 'walking', 'jogging'],
        'elliptical': ['elliptical'],
        'stationary bike': ['cycling', 'bike', 'stationary bike'],
        'rowing machine': ['rowing', 'row machine'],
        'pull-up bar': ['pull up', 'chin up', 'hanging leg raise', 'pullup', 'chinup'],
        'dumbbell': ['dumbbell', 'db curl', 'hammer curl', 'lateral raise', 'shoulder press', 'dumbbell fly'],
        'barbell': ['deadlift', 'barbell curl', 'barbell row', 'clean', 'snatch'],
        'leg curl machine': ['leg curl', 'hamstring curl'],
        'leg extension machine': ['leg extension', 'quad extension'],
        'chest fly machine': ['pec deck', 'chest fly machine', 'pec fly'],
        'shoulder press machine': ['shoulder press machine', 'overhead press machine'],
        'lat pulldown machine': ['lat pulldown'],
        'seated row machine': ['seated row', 'machine row'],
        'ab machine': ['ab crunch machine', 'ab machine'],
        'preacher curl bench': ['preacher curl'],
      };

      const getUsageForEquip = (equip: any, countMap: Map<string, number>, collectBreakdown = false) => {
        const customMappings = mappings.filter(m => m.equipmentId === equip.id);
        let totalUsage = 0;
        const breakdown: { exercise: string; count: number; muscle: string | null }[] = [];
        if (customMappings.length > 0) {
          for (const cm of customMappings) {
            const count = countMap.get(cm.exerciseName.toLowerCase()) || 0;
            const effectiveCount = cm.priority === 'primary' ? count : Math.round(count * 0.5);
            totalUsage += effectiveCount;
            if (collectBreakdown && effectiveCount > 0) {
              breakdown.push({ exercise: cm.exerciseName, count: effectiveCount, muscle: exerciseMuscleMap.get(cm.exerciseName.toLowerCase()) || null });
            }
          }
        } else {
          const equipNameLower = equip.name.toLowerCase();
          for (const [genericName, exercises] of Object.entries(GENERIC_MAP)) {
            if (equipNameLower.includes(genericName) || genericName.includes(equipNameLower)) {
              for (const ex of exercises) {
                for (const [loggedName, count] of countMap) {
                  if (loggedName.includes(ex) || ex.includes(loggedName)) {
                    totalUsage += count;
                    if (collectBreakdown && count > 0) {
                      breakdown.push({ exercise: loggedName, count, muscle: exerciseMuscleMap.get(loggedName) || null });
                    }
                  }
                }
              }
              break;
            }
          }
        }
        return { totalUsage, breakdown };
      };

      const results = equipment.map(equip => {
        const customMappings = mappings.filter(m => m.equipmentId === equip.id);
        const { totalUsage, breakdown } = getUsageForEquip(equip, exerciseCountMap, true);
        const { totalUsage: prevUsage } = getUsageForEquip(equip, prevExerciseCountMap);
        const usagePerUnit = equip.quantity ? Math.round(totalUsage / equip.quantity) : totalUsage;
        const changePercent = prevUsage > 0 ? Math.round(((totalUsage - prevUsage) / prevUsage) * 100) : (totalUsage > 0 ? 100 : 0);

        const muscleGroups = new Map<string, number>();
        let topExercise = '';
        let topExerciseCount = 0;
        for (const b of breakdown) {
          if (b.muscle) muscleGroups.set(b.muscle, (muscleGroups.get(b.muscle) || 0) + b.count);
          if (b.count > topExerciseCount) { topExercise = b.exercise; topExerciseCount = b.count; }
        }
        const muscles = [...muscleGroups.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

        return {
          id: equip.id,
          name: equip.name,
          category: equip.category,
          quantity: equip.quantity,
          totalUsage,
          prevUsage,
          changePercent,
          usagePerUnit,
          hasCustomMapping: customMappings.length > 0,
          mappedExercises: customMappings.length,
          topExercise: topExercise || null,
          muscles,
          exerciseBreakdown: breakdown.sort((a, b) => b.count - a.count).slice(0, 5),
        };
      });

      const maxUsagePerUnit = Math.max(...results.map(r => r.usagePerUnit), 1);
      const stressResults = results.map(r => ({
        ...r,
        stressLevel: r.usagePerUnit >= maxUsagePerUnit * 0.7 && r.usagePerUnit > 0 ? 'high' as const :
          r.usagePerUnit >= maxUsagePerUnit * 0.3 ? 'medium' as const : 'low' as const,
      })).sort((a, b) => b.totalUsage - a.totalUsage);

      const insights: { type: 'warning' | 'success' | 'info' | 'action'; icon: string; text: string }[] = [];

      const highStress = stressResults.filter(r => r.stressLevel === 'high');
      const lowStress = stressResults.filter(r => r.stressLevel === 'low' && r.totalUsage === 0);
      const risingEquip = stressResults.filter(r => r.changePercent >= 30 && r.totalUsage > 0);
      const droppingEquip = stressResults.filter(r => r.changePercent <= -30 && r.prevUsage > 0);
      const totalCurrentUsage = stressResults.reduce((s, r) => s + r.totalUsage, 0);
      const totalPrevUsage = stressResults.reduce((s, r) => s + r.prevUsage, 0);

      for (const equip of highStress) {
        if (equip.quantity === 1) {
          insights.push({
            type: 'action',
            icon: '🔴',
            text: `Add more ${equip.name} units — usage per unit is very high (${equip.usagePerUnit} uses/unit)`,
          });
        } else {
          insights.push({
            type: 'warning',
            icon: '⚠️',
            text: `${equip.name} is under heavy stress with ${equip.usagePerUnit} uses per unit across ${equip.quantity} units`,
          });
        }
      }

      for (const equip of risingEquip) {
        insights.push({
          type: 'info',
          icon: '📈',
          text: `${equip.name} demand increasing — usage up ${equip.changePercent}% vs last month`,
        });
      }

      for (const equip of droppingEquip) {
        insights.push({
          type: 'info',
          icon: '📉',
          text: `${equip.name} usage dropped ${Math.abs(equip.changePercent)}% — consider if it needs maintenance or replacement`,
        });
      }

      for (const equip of lowStress) {
        if (equip.totalUsage === 0 && equip.prevUsage === 0) {
          insights.push({
            type: 'warning',
            icon: '💤',
            text: `${equip.name} is completely unused — consider repositioning, replacing, or promoting it`,
          });
        }
      }

      const categoryUsage = new Map<string, number>();
      for (const r of stressResults) {
        categoryUsage.set(r.category, (categoryUsage.get(r.category) || 0) + r.totalUsage);
      }
      const topCategory = [...categoryUsage.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topCategory && topCategory[1] > 0) {
        insights.push({
          type: 'success',
          icon: '🏆',
          text: `${topCategory[0]} equipment is the most used category with ${topCategory[1]} total uses this month`,
        });
      }

      if (totalCurrentUsage > 0 && totalPrevUsage > 0) {
        const overallChange = Math.round(((totalCurrentUsage - totalPrevUsage) / totalPrevUsage) * 100);
        if (overallChange > 10) {
          insights.push({
            type: 'success',
            icon: '💪',
            text: `Overall equipment usage is up ${overallChange}% — your gym is getting busier!`,
          });
        } else if (overallChange < -10) {
          insights.push({
            type: 'warning',
            icon: '📊',
            text: `Overall equipment usage dropped ${Math.abs(overallChange)}% compared to last month`,
          });
        }
      }

      const unmappedHigh = highStress.filter(r => !r.hasCustomMapping);
      if (unmappedHigh.length > 0) {
        insights.push({
          type: 'info',
          icon: '🔗',
          text: `${unmappedHigh.length} high-stress item${unmappedHigh.length > 1 ? 's use' : ' uses'} generic mapping — add custom exercise mappings for more precise tracking`,
        });
      }

      const predictions = stressResults.filter(r => r.totalUsage > 0 || r.prevUsage > 0).map(r => {
        const trend = r.prevUsage > 0 ? (r.totalUsage - r.prevUsage) / r.prevUsage : 0;
        const predictedNext = Math.max(0, Math.round(r.totalUsage * (1 + trend)));
        const predictedPerUnit = r.quantity ? Math.round(predictedNext / r.quantity) : predictedNext;
        let action: 'buy_more' | 'monitor' | 'consider_replacing' | 'maintain' = 'maintain';
        let urgency: 'high' | 'medium' | 'low' = 'low';
        let reason = '';

        if (r.stressLevel === 'high' && trend >= 0) {
          action = 'buy_more';
          urgency = 'high';
          reason = `Currently overloaded at ${r.usagePerUnit} uses/unit${trend > 0 ? ` and still growing ${Math.round(trend * 100)}%` : ''}. Predicted ${predictedPerUnit} uses/unit next month.`;
        } else if (trend >= 0.3) {
          action = 'buy_more';
          urgency = 'medium';
          reason = `Demand growing rapidly at +${Math.round(trend * 100)}%. Expected to reach ${predictedNext} uses next month (${predictedPerUnit}/unit).`;
        } else if (r.totalUsage === 0 && r.prevUsage > 0) {
          action = 'consider_replacing';
          urgency = 'medium';
          reason = `Usage dropped from ${r.prevUsage} to 0 this month. May need maintenance or replacement.`;
        } else if (trend <= -0.3 && r.prevUsage > 3) {
          action = 'consider_replacing';
          urgency = 'low';
          reason = `Usage declining ${Math.round(Math.abs(trend) * 100)}%. Predicted ${predictedNext} uses next month. Members may be shifting to alternatives.`;
        } else if (r.stressLevel === 'medium') {
          action = 'monitor';
          urgency = 'low';
          reason = `Healthy usage at ${r.usagePerUnit}/unit. Predicted ${predictedNext} uses next month. No action needed now.`;
        } else if (r.totalUsage > 0) {
          action = 'maintain';
          urgency = 'low';
          reason = `Light usage. Predicted ${predictedNext} uses next month (${predictedPerUnit}/unit).`;
        }

        return {
          id: r.id,
          name: r.name,
          category: r.category,
          quantity: r.quantity,
          currentUsage: r.totalUsage,
          prevUsage: r.prevUsage,
          predictedNext,
          predictedPerUnit,
          trend: Math.round(trend * 100),
          action,
          urgency,
          reason,
        };
      });

      const muscleDemand = new Map<string, number>();
      const prevMuscleDemand = new Map<string, number>();
      for (const ex of recentExercises) {
        if (ex.muscleType) muscleDemand.set(ex.muscleType, (muscleDemand.get(ex.muscleType) || 0) + ex.count);
      }
      for (const ex of previousExercises) {
        if (ex.muscleType) prevMuscleDemand.set(ex.muscleType, (prevMuscleDemand.get(ex.muscleType) || 0) + ex.count);
      }

      const muscleEquipCount = new Map<string, { count: number; totalQty: number; names: string[] }>();
      for (const r of stressResults) {
        for (const m of r.muscles || []) {
          const existing = muscleEquipCount.get(m.name) || { count: 0, totalQty: 0, names: [] };
          existing.count++;
          existing.totalQty += r.quantity;
          existing.names.push(r.name);
          muscleEquipCount.set(m.name, existing);
        }
      }

      const EQUIPMENT_SUGGESTIONS: Record<string, string[]> = {
        'Quadriceps': ['Hack Squat Machine', 'Leg Extension Machine', 'Leg Press Machine', 'Sissy Squat Bench'],
        'Back': ['Lat Pulldown Machine', 'Seated Row Machine', 'T-Bar Row', 'Assisted Pull-Up Machine'],
        'Chest': ['Incline Bench', 'Pec Deck Machine', 'Chest Press Machine', 'Decline Bench'],
        'Shoulders': ['Shoulder Press Machine', 'Lateral Raise Machine', 'Rear Delt Machine', 'Cable Crossover'],
        'Biceps': ['Preacher Curl Bench', 'Cable Curl Station', 'EZ Curl Bar'],
        'Triceps': ['Tricep Dip Station', 'Cable Pushdown Station', 'Skull Crusher Bench'],
        'Hamstrings': ['Leg Curl Machine', 'Romanian Deadlift Platform', 'Glute Ham Developer'],
        'Glutes': ['Hip Thrust Station', 'Glute Kickback Machine', 'Cable Pull-Through Station'],
        'Core': ['Ab Crunch Machine', 'Captain\'s Chair', 'Cable Woodchop Station', 'Decline Ab Bench'],
        'Calves': ['Standing Calf Raise Machine', 'Seated Calf Raise Machine'],
        'Cardio': ['Treadmill', 'Rowing Machine', 'Stairmaster', 'Assault Bike'],
      };

      const recommendations: { muscle: string; demand: number; demandChange: number; equipmentCount: number; currentEquipment: string[]; suggestion: string; reason: string; priority: 'high' | 'medium' | 'low' }[] = [];

      const sortedMuscles = [...muscleDemand.entries()].sort((a, b) => b[1] - a[1]);
      for (const [muscle, demand] of sortedMuscles) {
        const prevDem = prevMuscleDemand.get(muscle) || 0;
        const demandChange = prevDem > 0 ? Math.round(((demand - prevDem) / prevDem) * 100) : (demand > 0 ? 100 : 0);
        const equipInfo = muscleEquipCount.get(muscle);
        const equipCount = equipInfo?.totalQty || 0;
        const equipNames = equipInfo?.names || [];

        const demandPerEquip = equipCount > 0 ? demand / equipCount : demand;
        const isNoEquipment = equipCount === 0;
        const isUnderserved = demandPerEquip > 15;
        const isGrowing = demandChange > 30;
        const minDemand = isNoEquipment ? 5 : 10;

        if ((isNoEquipment || isUnderserved || isGrowing) && demand >= minDemand) {
          const existingNamesLower = equipNames.map(n => n.toLowerCase());
          const suggestions = EQUIPMENT_SUGGESTIONS[muscle] || [];
          const newSuggestion = suggestions.find(s => {
            const suggLower = s.toLowerCase();
            return !existingNamesLower.some(en => en.includes(suggLower) || suggLower.includes(en));
          });

          let suggestion = '';
          let reason = '';
          let priority: 'high' | 'medium' | 'low' = 'medium';

          if (equipCount === 0) {
            suggestion = newSuggestion || `Add ${muscle}-focused equipment`;
            reason = `Your members logged ${demand} ${muscle.toLowerCase()} exercises this month but you have no dedicated ${muscle.toLowerCase()} equipment registered.`;
            priority = 'high';
          } else if (demandPerEquip > 25) {
            const highStressEquip = stressResults.filter(r => (r.muscles || []).some(m => m.name === muscle) && r.stressLevel === 'high');
            if (highStressEquip.length > 0) {
              suggestion = newSuggestion || `Add another ${equipNames[0]}`;
              reason = `${equipNames[0]} is overloaded with ${demand} ${muscle.toLowerCase()} exercises across ${equipCount} unit${equipCount > 1 ? 's' : ''}. Adding ${suggestion.toLowerCase()} would spread the load.`;
              priority = 'high';
            } else {
              suggestion = newSuggestion || `Consider more ${muscle.toLowerCase()} equipment`;
              reason = `High demand (${demand} exercises) for only ${equipCount} ${muscle.toLowerCase()} equipment unit${equipCount > 1 ? 's' : ''}.`;
              priority = 'medium';
            }
          } else if (isGrowing && demand >= minDemand) {
            suggestion = newSuggestion || `Consider adding ${muscle.toLowerCase()} variety`;
            reason = `${muscle} exercises grew ${demandChange}% this month (${prevDem} → ${demand}). ${equipCount > 0 ? `Currently served by ${equipNames.slice(0, 2).join(' & ')}.` : ''} Adding variety could keep members engaged.`;
            priority = 'medium';
          }

          if (suggestion) {
            recommendations.push({
              muscle,
              demand,
              demandChange,
              equipmentCount: equipCount,
              currentEquipment: equipNames.slice(0, 3),
              suggestion,
              reason,
              priority,
            });
          }
        }
      }

      recommendations.sort((a, b) => {
        const p = { high: 3, medium: 2, low: 1 };
        return p[b.priority] - p[a.priority] || b.demand - a.demand;
      });

      res.json({ equipment: stressResults, insights, predictions, recommendations: recommendations.slice(0, 3), hasSetup: true });
    } catch (error) {
      console.error('Equipment stress error:', error);
      res.status(500).json({ error: 'Failed to compute equipment stress' });
    }
  });

  // === OWNER DASHBOARD & ATTENDANCE ANALYTICS ===
  app.get("/api/owner/dashboard-metrics", requireRole(["owner"]), async (req, res) => {
    // Accept client's local date to handle timezone differences
    const clientToday = (req.query.clientToday as string) || getLocalDate(req);
    const metrics = await storage.getOwnerDashboardMetrics(req.user!.gymId!, clientToday);
    res.json(metrics);
  });

  // Enhanced Dashboard Data (subscription health, revenue comparison, payment method split, etc.)
  app.get("/api/owner/dashboard-enhanced", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const clientToday = (req.query.clientToday as string) || getLocalDate(req);
      const todayDate = new Date(clientToday + 'T00:00:00');
      const clientYear = todayDate.getFullYear();
      const clientMonth = todayDate.getMonth();

      const monthStart = `${clientYear}-${String(clientMonth + 1).padStart(2, '0')}-01`;
      const monthEnd = `${clientYear}-${String(clientMonth + 1).padStart(2, '0')}-${String(new Date(clientYear, clientMonth + 1, 0).getDate()).padStart(2, '0')}`;
      const lastMonthDate = new Date(clientYear, clientMonth - 1, 1);
      const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      const lastMonthEnd = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-${String(new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

      // 1. Subscription Health
      const allMembers = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
      const allMemberIds = new Set(allMembers.map(m => m.id));

      const allSubs = await db.select({
        memberId: memberSubscriptions.memberId,
        endDate: memberSubscriptions.endDate,
        status: memberSubscriptions.status,
      }).from(memberSubscriptions).where(eq(memberSubscriptions.gymId, gymId));

      const memberSubMap = new Map<number, { endDate: string | null; status: string }>();
      for (const s of allSubs) {
        const existing = memberSubMap.get(s.memberId);
        if (!existing || (s.endDate && (!existing.endDate || s.endDate > existing.endDate))) {
          memberSubMap.set(s.memberId, { endDate: s.endDate, status: s.status });
        }
      }

      const sevenDaysFromNow = new Date(todayDate.getTime() + 7 * 86400000).toISOString().split('T')[0];
      let subActive = 0, subExpiringSoon = 0, subExpired = 0, subNone = 0;
      for (const memberId of allMemberIds) {
        const sub = memberSubMap.get(memberId);
        if (!sub || !sub.endDate) { subNone++; continue; }
        if (sub.endDate < clientToday) { subExpired++; }
        else if (sub.endDate <= sevenDaysFromNow) { subExpiringSoon++; }
        else { subActive++; }
      }

      // 2. Revenue comparison (this month vs last month)
      const thisMonthRevResult = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
        .from(paymentTransactions)
        .where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, monthStart), lte(paymentTransactions.paidOn, monthEnd)));
      const thisMonthRevenue = Number(thisMonthRevResult[0]?.total) || 0;

      const lastMonthRevResult = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
        .from(paymentTransactions)
        .where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, lastMonthStart), lte(paymentTransactions.paidOn, lastMonthEnd)));
      const lastMonthRevenue = Number(lastMonthRevResult[0]?.total) || 0;
      const revenueChangePercent = lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : (thisMonthRevenue > 0 ? 100 : 0);

      // 3. Payment method breakdown (this month)
      const methodBreakdown = await db.select({
        method: paymentTransactions.method,
        total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(paymentTransactions)
        .where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, monthStart), lte(paymentTransactions.paidOn, monthEnd)))
        .groupBy(paymentTransactions.method);

      const paymentMethods = methodBreakdown.map(m => ({
        method: m.method || 'other',
        total: Number(m.total) || 0,
        count: Number(m.count) || 0,
      }));

      // 4. Weekly comparison (this week vs last week attendance)
      const weekStart = new Date(todayDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const thisWeekStart = weekStart.toISOString().split('T')[0];
      const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000).toISOString().split('T')[0];
      const lastWeekEnd = new Date(weekStart.getTime() - 86400000).toISOString().split('T')[0];

      const thisWeekAtt = await db.select({ count: sql<number>`COUNT(DISTINCT ${attendance.memberId})` })
        .from(attendance)
        .where(and(eq(attendance.gymId, gymId), gte(attendance.date, thisWeekStart), lte(attendance.date, clientToday), eq(attendance.status, 'present')));
      const lastWeekAtt = await db.select({ count: sql<number>`COUNT(DISTINCT ${attendance.memberId})` })
        .from(attendance)
        .where(and(eq(attendance.gymId, gymId), gte(attendance.date, lastWeekStart), lte(attendance.date, lastWeekEnd), eq(attendance.status, 'present')));
      const thisWeekCount = Number(thisWeekAtt[0]?.count) || 0;
      const lastWeekCount = Number(lastWeekAtt[0]?.count) || 0;
      const weeklyChangePercent = lastWeekCount > 0 ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) : (thisWeekCount > 0 ? 100 : 0);

      // 5. Trainer coverage
      const trainers = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, 'trainer')));
      const membersWithTrainerResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${trainerMemberAssignments.memberId})` })
        .from(trainerMemberAssignments)
        .where(and(eq(trainerMemberAssignments.gymId, gymId), isNull(trainerMemberAssignments.endedAt)));
      const membersWithoutTrainer = allMembers.length - (Number(membersWithTrainerResult[0]?.count) || 0);

      // 6. Month so far summary
      const monthCheckIns = await db.select({ count: sql<number>`COUNT(*)` })
        .from(attendance)
        .where(and(eq(attendance.gymId, gymId), gte(attendance.date, monthStart), lte(attendance.date, clientToday), eq(attendance.status, 'present')));
      const monthPaymentsCount = await db.select({ count: sql<number>`COUNT(*)` })
        .from(paymentTransactions)
        .where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, monthStart), lte(paymentTransactions.paidOn, monthEnd)));
      const monthNewMembers = await db.select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, 'member'), sql`${users.createdAt} >= ${monthStart}::date`));

      res.json({
        subscriptionHealth: { active: subActive, expiringSoon: subExpiringSoon, expired: subExpired, noSubscription: subNone, total: allMemberIds.size },
        revenueComparison: { thisMonth: thisMonthRevenue, lastMonth: lastMonthRevenue, changePercent: revenueChangePercent },
        paymentMethods,
        weeklyComparison: { thisWeek: thisWeekCount, lastWeek: lastWeekCount, changePercent: weeklyChangePercent },
        trainerCoverage: { totalTrainers: trainers.length, membersWithoutTrainer, totalMembers: allMembers.length },
        monthSoFar: {
          members: allMembers.length,
          checkIns: Number(monthCheckIns[0]?.count) || 0,
          payments: Number(monthPaymentsCount[0]?.count) || 0,
          newJoins: Number(monthNewMembers[0]?.count) || 0,
          revenue: thisMonthRevenue,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/owner/property-analytics", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const clientToday = (req.query.clientToday as string) || getLocalDate(req);

      const allMembersRaw = await db.select({ id: users.id, username: users.username })
        .from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
      const totalResidents = allMembersRaw.length;

      const profileRows = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, allMembersRaw.map(m => m.id).length > 0 ? allMembersRaw.map(m => m.id) : [0]));
      const profileMap = new Map(profileRows.map(p => [p.userId, p.fullName]));
      const allMembers = allMembersRaw.map(m => ({ ...m, displayName: profileMap.get(m.id) || m.username }));

      const recentAttendance = await db.select({
        memberId: attendance.memberId,
        date: attendance.date,
        createdAt: attendance.createdAt,
        status: attendance.status,
      }).from(attendance)
        .where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present')))
        .orderBy(desc(attendance.createdAt))
        .limit(50);

      const activeToday = new Set(recentAttendance.filter(a => a.date === clientToday).map(a => a.memberId)).size;

      const accessLog = recentAttendance
        .filter(a => a.createdAt)
        .map(a => {
          const member = allMembers.find(m => m.id === a.memberId);
          return {
            name: member?.displayName || member?.username || 'Unknown',
            time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
            date: a.date,
            type: 'entry' as const,
          };
        });

      res.json({
        totalResidents,
        activeToday,
        accessLog,
      });
    } catch (error: any) {
      console.error("Property analytics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/owner/property-intelligence", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const clientToday = (req.query.clientToday as string) || getLocalDate(req);
      const todayDate = new Date(clientToday + "T00:00:00");

      const thirtyDaysAgo = new Date(todayDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

      const allMembersRaw = await db.select({ id: users.id, username: users.username })
        .from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, "member")));
      const totalResidents = allMembersRaw.length;

      const profileRows = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, allMembersRaw.map(m => m.id).length > 0 ? allMembersRaw.map(m => m.id) : [0]));
      const profileMap = new Map(profileRows.map(p => [p.userId, p.fullName]));
      const memberMap = new Map(allMembersRaw.map(m => [m.id, profileMap.get(m.id) || m.username]));

      const records = await db.select({
        memberId: attendance.memberId,
        date: attendance.date,
        createdAt: attendance.createdAt,
      }).from(attendance)
        .where(and(
          eq(attendance.gymId, gymId),
          eq(attendance.status, "present"),
          gte(attendance.date, thirtyDaysAgoStr),
          lte(attendance.date, clientToday),
        ));

      const hourCounts: Record<number, number> = {};
      for (let h = 5; h <= 23; h++) hourCounts[h] = 0;
      for (const r of records) {
        if (r.createdAt) {
          const hour = new Date(r.createdAt).getHours();
          if (hour >= 5 && hour <= 23) hourCounts[hour]++;
        }
      }

      const hourData = Object.entries(hourCounts).map(([hour, count]) => {
        const h = parseInt(hour);
        return {
          hour: h,
          count,
          label: `${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`,
        };
      });
      const maxCount = Math.max(...hourData.map(h => h.count), 1);
      const peakThreshold = maxCount * 0.7;
      const lowThreshold = maxCount * 0.3;

      const peakHourData = hourData.map(h => ({
        ...h,
        level: (h.count >= peakThreshold && h.count > 0 ? "peak" : h.count <= lowThreshold ? "low" : "moderate") as "peak" | "moderate" | "low",
      }));

      const peakHours = peakHourData.filter(h => h.level === "peak").map(h => h.hour);
      const lowHoursList = peakHourData.filter(h => h.level === "low" && h.count === 0).map(h => h.hour);

      const fmtHr = (h: number) => `${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`;
      const formatRange = (hours: number[]) => {
        if (hours.length === 0) return null;
        hours.sort((a, b) => a - b);
        const ranges: string[] = [];
        let start = hours[0], end = hours[0];
        for (let i = 1; i < hours.length; i++) {
          if (hours[i] === end + 1) { end = hours[i]; }
          else { ranges.push(start === end ? fmtHr(start) : `${fmtHr(start)}–${fmtHr(end + 1)}`); start = hours[i]; end = hours[i]; }
        }
        ranges.push(start === end ? fmtHr(start) : `${fmtHr(start)}–${fmtHr(end + 1)}`);
        return ranges.join(", ");
      };

      const daysAnalyzed = Math.min(30, Math.ceil((todayDate.getTime() - thirtyDaysAgo.getTime()) / 86400000));

      const weeks: { week: string; label: string; start: string; end: string }[] = [];
      for (let w = 3; w >= 0; w--) {
        const ws = new Date(todayDate);
        ws.setDate(ws.getDate() - (w * 7 + 6));
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        weeks.push({
          week: `W${4 - w}`,
          label: `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          start: ws.toISOString().split("T")[0],
          end: we.toISOString().split("T")[0],
        });
      }

      const weeklyTrends = weeks.map(w => {
        const weekRecords = records.filter(r => r.date >= w.start && r.date <= w.end);
        return {
          week: w.week,
          label: w.label,
          visits: weekRecords.length,
          uniqueResidents: new Set(weekRecords.map(r => r.memberId)).size,
        };
      });

      const firstWeekVisits = weeklyTrends[0]?.visits || 0;
      const lastWeekVisits = weeklyTrends[weeklyTrends.length - 1]?.visits || 0;
      const overallChange = firstWeekVisits > 0 ? Math.round(((lastWeekVisits - firstWeekVisits) / firstWeekVisits) * 100) : 0;
      const avgWeeklyVisits = Math.round(weeklyTrends.reduce((s, w) => s + w.visits, 0) / Math.max(weeklyTrends.length, 1));

      const memberVisitCounts = new Map<number, { total: number; lastDate: string }>();
      for (const r of records) {
        const existing = memberVisitCounts.get(r.memberId);
        if (!existing) {
          memberVisitCounts.set(r.memberId, { total: 1, lastDate: r.date });
        } else {
          existing.total++;
          if (r.date > existing.lastDate) existing.lastDate = r.date;
        }
      }

      let regulars = 0, occasional = 0, inactive = 0;
      const residentBreakdown: { name: string; lastVisit: string; totalVisits: number; segment: "regular" | "occasional" | "inactive" }[] = [];

      for (const m of allMembersRaw) {
        const stats = memberVisitCounts.get(m.id);
        const name = memberMap.get(m.id) || m.username;
        if (!stats) {
          inactive++;
          residentBreakdown.push({ name, lastVisit: "Never", totalVisits: 0, segment: "inactive" });
        } else if (stats.total >= 3) {
          regulars++;
          residentBreakdown.push({ name, lastVisit: stats.lastDate === clientToday ? "Today" : stats.lastDate, totalVisits: stats.total, segment: "regular" });
        } else {
          occasional++;
          residentBreakdown.push({ name, lastVisit: stats.lastDate === clientToday ? "Today" : stats.lastDate, totalVisits: stats.total, segment: "occasional" });
        }
      }

      residentBreakdown.sort((a, b) => b.totalVisits - a.totalVisits);

      const engagementRate = totalResidents > 0 ? Math.round(((regulars + occasional) / totalResidents) * 100) : 0;

      res.json({
        peakHours: {
          data: peakHourData,
          peakSummary: formatRange(peakHours),
          lowSummary: formatRange(lowHoursList),
          totalCheckIns: records.length,
          daysAnalyzed,
        },
        usageTrends: {
          weeks: weeklyTrends,
          overallChange,
          avgWeeklyVisits,
        },
        residentEngagement: {
          totalResidents,
          regulars,
          occasional,
          inactive,
          engagementRate,
          residents: residentBreakdown,
        },
      });
    } catch (error: any) {
      console.error("Property intelligence error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/owner/access-history", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const startDate = req.query.start as string;
      const endDate = req.query.end as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "start and end query params required" });
      }

      const allMembersRaw = await db.select({ id: users.id, username: users.username })
        .from(users)
        .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

      const profileRows = await db.select({ userId: userProfiles.userId, fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, allMembersRaw.map(m => m.id).length > 0 ? allMembersRaw.map(m => m.id) : [0]));
      const profileMap = new Map(profileRows.map(p => [p.userId, p.fullName]));
      const allMembers = allMembersRaw.map(m => ({ ...m, displayName: profileMap.get(m.id) || m.username }));

      const records = await db.select({
        memberId: attendance.memberId,
        date: attendance.date,
        createdAt: attendance.createdAt,
      }).from(attendance)
        .where(and(
          eq(attendance.gymId, gymId),
          eq(attendance.status, 'present'),
          gte(attendance.date, startDate),
          lte(attendance.date, endDate),
        ))
        .orderBy(desc(attendance.createdAt));

      const entries = records
        .filter(a => a.createdAt)
        .map(a => {
          const member = allMembers.find(m => m.id === a.memberId);
          return {
            name: member?.displayName || member?.username || 'Unknown',
            time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
            date: a.date,
          };
        });

      res.json({ entries, totalCount: entries.length });
    } catch (error: any) {
      console.error("Access history error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Today's Activity Feed
  app.get("/api/owner/today-activity", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const today = (req.query.clientToday as string) || getLocalDate(req);

      const newMembersToday = await db.select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
      })
        .from(users)
        .where(and(
          eq(users.gymId, gymId),
          eq(users.role, 'member'),
          sql`${users.createdAt} >= ${today}::date AND ${users.createdAt} < (${today}::date + interval '1 day')`
        ));

      const paymentsToday = await db.select({
        id: paymentTransactions.id,
        memberId: paymentTransactions.memberId,
        amountPaid: paymentTransactions.amountPaid,
        method: paymentTransactions.method,
        paidOn: paymentTransactions.paidOn,
        memberName: users.username,
      })
        .from(paymentTransactions)
        .innerJoin(users, eq(paymentTransactions.memberId, users.id))
        .where(and(
          eq(paymentTransactions.gymId, gymId),
          eq(paymentTransactions.paidOn, today)
        ))
        .orderBy(desc(paymentTransactions.createdAt));

      const expiringToday = await db.select({
        id: memberSubscriptions.id,
        memberId: memberSubscriptions.memberId,
        endDate: memberSubscriptions.endDate,
        status: memberSubscriptions.status,
        memberName: users.username,
        planName: membershipPlans.name,
      })
        .from(memberSubscriptions)
        .innerJoin(users, eq(memberSubscriptions.memberId, users.id))
        .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
        .where(and(
          eq(memberSubscriptions.gymId, gymId),
          eq(memberSubscriptions.endDate, today),
          sql`${memberSubscriptions.status} IN ('active', 'endingSoon')`
        ));

      res.json({
        newMembers: newMembersToday,
        payments: paymentsToday,
        expiringSubscriptions: expiringToday,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Daily Activity Detail Page
  app.get("/api/owner/daily-activity", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const date = (req.query.date as string) || getLocalDate(req);

      const newMembersOnDate = await db.select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
      })
        .from(users)
        .where(and(
          eq(users.gymId, gymId),
          eq(users.role, 'member'),
          sql`${users.createdAt} >= ${date}::date AND ${users.createdAt} < (${date}::date + interval '1 day')`
        ));

      const paymentsOnDate = await db.select({
        id: paymentTransactions.id,
        memberId: paymentTransactions.memberId,
        amountPaid: paymentTransactions.amountPaid,
        method: paymentTransactions.method,
        paidOn: paymentTransactions.paidOn,
        memberName: users.username,
        notes: paymentTransactions.notes,
      })
        .from(paymentTransactions)
        .innerJoin(users, eq(paymentTransactions.memberId, users.id))
        .where(and(
          eq(paymentTransactions.gymId, gymId),
          eq(paymentTransactions.paidOn, date)
        ))
        .orderBy(desc(paymentTransactions.createdAt));

      const expiringOnDate = await db.select({
        id: memberSubscriptions.id,
        memberId: memberSubscriptions.memberId,
        endDate: memberSubscriptions.endDate,
        status: memberSubscriptions.status,
        memberName: users.username,
        planName: membershipPlans.name,
      })
        .from(memberSubscriptions)
        .innerJoin(users, eq(memberSubscriptions.memberId, users.id))
        .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
        .where(and(
          eq(memberSubscriptions.gymId, gymId),
          eq(memberSubscriptions.endDate, date),
          sql`${memberSubscriptions.status} IN ('active', 'endingSoon')`
        ));

      const endedOnDate = await db.select({
        id: memberSubscriptions.id,
        memberId: memberSubscriptions.memberId,
        endDate: memberSubscriptions.endDate,
        status: memberSubscriptions.status,
        memberName: users.username,
        planName: membershipPlans.name,
      })
        .from(memberSubscriptions)
        .innerJoin(users, eq(memberSubscriptions.memberId, users.id))
        .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
        .where(and(
          eq(memberSubscriptions.gymId, gymId),
          eq(memberSubscriptions.endDate, date),
          eq(memberSubscriptions.status, 'ended')
        ));

      const walkInsOnDate = await db.select({
        id: walkInVisitors.id,
        visitorName: walkInVisitors.visitorName,
        phone: walkInVisitors.phone,
        visitType: walkInVisitors.visitType,
        daysCount: walkInVisitors.daysCount,
        amountPaid: walkInVisitors.amountPaid,
        paymentMethod: walkInVisitors.paymentMethod,
      })
        .from(walkInVisitors)
        .where(and(
          eq(walkInVisitors.gymId, gymId),
          eq(walkInVisitors.visitDate, date)
        ));

      const attendanceOnDate = await db.select({
        id: attendance.id,
        memberId: attendance.memberId,
        status: attendance.status,
        verifiedMethod: attendance.verifiedMethod,
        memberName: users.username,
      })
        .from(attendance)
        .innerJoin(users, eq(attendance.memberId, users.id))
        .where(and(
          eq(attendance.gymId, gymId),
          eq(attendance.date, date)
        ));

      const totalRevenue = paymentsOnDate.reduce((sum, p) => sum + p.amountPaid, 0);
      const walkInRevenue = walkInsOnDate.filter(w => w.visitType === 'day_pass').reduce((sum, w) => sum + (w.amountPaid || 0), 0);
      const dayPasses = walkInsOnDate.filter(w => w.visitType === 'day_pass');
      const trials = walkInsOnDate.filter(w => w.visitType === 'trial');
      const enquiries = walkInsOnDate.filter(w => w.visitType === 'enquiry');
      const presentCount = attendanceOnDate.filter(a => a.status === 'present').length;

      let aiSummary: string | null = null;
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI();
        const prompt = `You are a gym business analyst. Summarize this day's activity at the gym in 2-3 short, helpful sentences. Focus on what stands out and any actionable insights. Be conversational and concise.

Date: ${date}
- New members joined: ${newMembersOnDate.length}
- Payments received: ${paymentsOnDate.length} (total: ${totalRevenue / 100})
- Members checked in: ${presentCount}
- Subscriptions expiring: ${expiringOnDate.length}
- Subscriptions ended: ${endedOnDate.length}
- Walk-in visitors: ${walkInsOnDate.length} (Day passes: ${dayPasses.length}, Trials: ${trials.length}, Enquiries: ${enquiries.length})
- Walk-in revenue: ${walkInRevenue / 100}

Respond with just the summary text, no formatting.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
          temperature: 0.7,
        });
        aiSummary = completion.choices[0]?.message?.content?.trim() || null;
      } catch (aiErr) {
        aiSummary = null;
      }

      res.json({
        date,
        newMembers: newMembersOnDate,
        payments: paymentsOnDate,
        totalRevenue,
        expiringSubscriptions: expiringOnDate,
        endedSubscriptions: endedOnDate,
        walkIns: walkInsOnDate,
        dayPasses,
        trials,
        enquiries,
        walkInRevenue,
        attendance: attendanceOnDate,
        presentCount,
        absentCount: attendanceOnDate.filter(a => a.status === 'absent').length,
        aiSummary,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Revenue Analytics
  app.get("/api/owner/revenue", requireRole(["owner"]), async (req, res) => {
    const month = (req.query.month as string) || getLocalDate(req).slice(0, 7);
    const revenueData = await storage.getRevenueAnalytics(req.user!.gymId!, month);
    res.json(revenueData);
  });

  // Walk-in/Day Pass Revenue
  app.get("/api/owner/walk-in-revenue", requireRole(["owner"]), async (req, res) => {
    try {
      const month = (req.query.month as string) || getLocalDate(req).slice(0, 7);
      const walkInRevenue = await storage.getWalkInRevenue(req.user!.gymId!, month);
      res.json(walkInRevenue);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch walk-in revenue" });
    }
  });

  // Daily Revenue Breakdown
  app.get("/api/owner/revenue/daily", requireRole(["owner"]), async (req, res) => {
    try {
      const month = (req.query.month as string) || getLocalDate(req).slice(0, 7);
      const dailyData = await storage.getDailyRevenueBreakdown(req.user!.gymId!, month);
      res.json(dailyData);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch daily revenue" });
    }
  });

  // Get transactions for a specific day
  app.get("/api/owner/revenue/day/:date", requireRole(["owner"]), async (req, res) => {
    try {
      const date = req.params.date;
      const transactions = await storage.getDayTransactions(req.user!.gymId!, date);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch day transactions" });
    }
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
    const stats = await storage.getEnhancedMemberStats(memberId, req.user!.gymId);
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
      const { name, phone, city, email, visitDate, visitType, daysCount, amountPaid, notes, enquiryCategory, enquiryDetails } = req.body;
      if (!name || !visitDate) {
        return res.status(400).json({ message: "Name and visit date are required" });
      }
      const visitor = await storage.createWalkInVisitor({
        gymId: req.user!.gymId!,
        visitorName: name,
        phone: phone || null,
        city: city || null,
        email,
        visitDate,
        visitType: visitType || "day_pass",
        daysCount: daysCount || 1,
        amountPaid: amountPaid || 0,
        notes,
        enquiryCategory: enquiryCategory || null,
        enquiryDetails: enquiryDetails || null,
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

  app.get("/api/owner/walk-in-visitors/lead-scores", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const visitors = await storage.getWalkInVisitors(gymId, {});
      const gym = await storage.getGym(gymId);
      const gymCity = gym?.city?.toLowerCase()?.trim() || '';

      const visitCounts = new Map<string, number>();
      for (const v of visitors) {
        const key = v.email?.toLowerCase()?.trim() || (v.phone?.trim() ? `phone:${v.phone.trim()}` : null);
        if (key) visitCounts.set(key, (visitCounts.get(key) || 0) + 1);
      }

      const getRepeatCount = (v: any) => {
        const key = v.email?.toLowerCase()?.trim() || (v.phone?.trim() ? `phone:${v.phone.trim()}` : null);
        return key ? (visitCounts.get(key) || 1) : 1;
      };

      const scoreVisitor = (v: any) => {
        let score = 0;
        const reasons: string[] = [];
        const repeatCount = getRepeatCount(v);
        if (repeatCount >= 2) { score += 25; reasons.push(`Visited ${repeatCount} times`); }
        if (v.city && gymCity && v.city.toLowerCase().trim() === gymCity) { score += 15; reasons.push('Same city as gym'); }
        if (v.enquiryCategory && v.enquiryCategory !== 'Other') { score += 20; reasons.push(`Enquired about ${v.enquiryCategory}`); }
        else if (v.visitType === 'enquiry') { score += 10; reasons.push('Made an enquiry'); }
        if (v.paymentVerified) { score += 10; reasons.push('Payment verified'); }
        const visitTime = v.visitDate ? new Date(v.visitDate).getTime() : 0;
        const now = Date.now();
        if (visitTime && (now - visitTime) < 3 * 24 * 60 * 60 * 1000) { score += 15; reasons.push('Visited in last 3 days'); }
        if (v.email || v.phone) { score += 10; reasons.push('Contact info available'); }
        if (v.visitType === 'trial') { score += 5; reasons.push('Tried a free session'); }
        return { leadScore: Math.min(score, 100), reasons, repeatVisitCount: repeatCount };
      };

      const scored = visitors.map(v => ({ ...v, ...scoreVisitor(v) }));
      scored.sort((a, b) => b.leadScore - a.leadScore);
      res.json(scored);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to calculate lead scores" });
    }
  });

  app.get("/api/owner/walk-in-visitors/ai-suggestions", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const visitors = await storage.getWalkInVisitors(gymId, {});
      const gym = await storage.getGym(gymId);
      const gymCity = gym?.city?.toLowerCase()?.trim() || '';

      const visitCounts = new Map<string, number>();
      for (const v of visitors) {
        const key = v.email?.toLowerCase()?.trim() || (v.phone?.trim() ? `phone:${v.phone.trim()}` : null);
        if (key) visitCounts.set(key, (visitCounts.get(key) || 0) + 1);
      }

      const now = Date.now();

      const unconverted = visitors.filter(v => !v.convertedToMember);

      const lanes: {
        hotLeads: any[];
        nurture: any[];
        winBack: any[];
        paymentPending: any[];
      } = { hotLeads: [], nurture: [], winBack: [], paymentPending: [] };

      for (const v of unconverted) {
        let score = 0;
        const reasons: string[] = [];
        const key = v.email?.toLowerCase()?.trim() || (v.phone?.trim() ? `phone:${v.phone.trim()}` : null);
        const repeatCount = key ? (visitCounts.get(key) || 1) : 1;
        const visitTime = v.visitDate ? new Date(v.visitDate).getTime() : 0;
        const daysSince = visitTime ? Math.floor((now - visitTime) / (24 * 60 * 60 * 1000)) : 999;

        if (repeatCount >= 2) { score += 25; reasons.push(`Visited ${repeatCount} times`); }
        if (v.city && gymCity && v.city.toLowerCase().trim() === gymCity) { score += 15; reasons.push('Same city'); }
        if (v.enquiryCategory && v.enquiryCategory !== 'Other') { score += 20; reasons.push(`Enquired about ${v.enquiryCategory}`); }
        else if (v.visitType === 'enquiry') { score += 10; reasons.push('Made an enquiry'); }
        if (v.paymentVerified) { score += 10; }
        if (visitTime && (now - visitTime) < 3 * 24 * 60 * 60 * 1000) { score += 15; reasons.push('Recent visit'); }
        if (v.email || v.phone) { score += 10; }
        if (v.visitType === 'trial') { score += 5; }

        score = Math.min(score, 100);

        const suggestion: any = {
          visitorId: v.id,
          visitorName: v.visitorName,
          email: v.email,
          phone: v.phone,
          visitType: v.visitType,
          visitDate: v.visitDate,
          leadScore: score,
          repeatVisitCount: repeatCount,
          daysSinceVisit: daysSince,
          enquiryCategory: v.enquiryCategory,
        };

        if (v.visitType === 'day_pass' && !v.paymentVerified && v.amountPaid && v.amountPaid > 0) {
          suggestion.reason = 'Payment not yet verified';
          suggestion.suggestedGoal = 'collect_payment';
          lanes.paymentPending.push(suggestion);
        } else if (score >= 70 && daysSince <= 7) {
          suggestion.reason = reasons.slice(0, 2).join(' + ') + ' → high conversion chance';
          suggestion.suggestedGoal = 'convert';
          lanes.hotLeads.push(suggestion);
        } else if (v.visitType === 'day_pass' && daysSince >= 3 && daysSince <= 30) {
          suggestion.reason = `Day pass ended ${daysSince} days ago → send comeback message`;
          suggestion.suggestedGoal = 'bring_back';
          lanes.winBack.push(suggestion);
        } else if (v.visitType === 'enquiry' && daysSince >= 1 && daysSince <= 14) {
          const cat = v.enquiryCategory ? ` about ${v.enquiryCategory}` : '';
          suggestion.reason = `Enquired${cat} ${daysSince}d ago → follow up with offer`;
          suggestion.suggestedGoal = 'convert';
          lanes.nurture.push(suggestion);
        } else if (v.visitType === 'trial' && daysSince >= 1 && daysSince <= 14) {
          suggestion.reason = `Free trial ${daysSince}d ago → convert to membership`;
          suggestion.suggestedGoal = 'convert';
          lanes.nurture.push(suggestion);
        }
      }

      lanes.hotLeads = lanes.hotLeads.sort((a, b) => b.leadScore - a.leadScore).slice(0, 3);
      lanes.nurture = lanes.nurture.sort((a, b) => a.daysSinceVisit - b.daysSinceVisit).slice(0, 3);
      lanes.winBack = lanes.winBack.sort((a, b) => a.daysSinceVisit - b.daysSinceVisit).slice(0, 3);
      lanes.paymentPending = lanes.paymentPending.slice(0, 3);

      res.json(lanes);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate AI suggestions" });
    }
  });

  app.get("/api/owner/walk-in-visitors/conversion-funnel", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const visitors = await storage.getWalkInVisitors(gymId, {});
      const enquiry = visitors.filter(v => v.visitType === 'enquiry').length;
      const trial = visitors.filter(v => v.visitType === 'trial').length;
      const dayPass = visitors.filter(v => v.visitType === 'day_pass').length;
      const converted = visitors.filter(v => v.convertedToMember).length;
      const total = visitors.length || 1;

      res.json({
        enquiry,
        trial,
        dayPass,
        converted,
        total: visitors.length,
        conversionRate: Math.round((converted / total) * 100),
        enquiryToTrialRate: enquiry > 0 ? Math.round((trial / enquiry) * 100) : 0,
        trialToConvertRate: trial > 0 ? Math.round((converted / trial) * 100) : 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch conversion funnel" });
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

  // Owner: Verify day pass payment
  app.post("/api/owner/walk-in-visitors/:id/verify-payment", requireRole(["owner"]), async (req, res) => {
    try {
      const visitor = await storage.getWalkInVisitorById(parseInt(req.params.id));
      if (!visitor || visitor.gymId !== req.user!.gymId) {
        return res.status(404).json({ message: "Visitor not found" });
      }
      if (visitor.visitType !== "day_pass") {
        return res.status(400).json({ message: "Only day pass payments can be verified" });
      }
      const updated = await storage.updateWalkInVisitor(parseInt(req.params.id), {
        paymentVerified: true
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to verify payment" });
    }
  });

  // Update follow-up status for a walk-in visitor
  app.patch("/api/owner/walk-in-visitors/:id/follow-up", requireRole(["owner"]), async (req, res) => {
    try {
      const { status, notes, priority, tags, assignedTrainerId, scheduledFollowUpDate, interaction } = req.body;
      const visitorId = parseInt(req.params.id);
      
      const visitor = await storage.getWalkInVisitorById(visitorId);
      if (!visitor || visitor.gymId !== req.user!.gymId) {
        return res.status(404).json({ message: "Visitor not found" });
      }
      
      const validStatuses = ["pending", "contacted", "follow_up_scheduled", "converted", "not_interested"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid follow-up status" });
      }
      
      const updateData: any = {};
      if (status !== undefined) {
        updateData.followUpStatus = status;
        updateData.followUpDate = new Date();
        updateData.followUpByUserId = req.user!.id;
        if (status === "converted") {
          updateData.convertedToMember = true;
        }
      }
      if (notes !== undefined) {
        updateData.followUpNotes = notes;
      }
      if (priority !== undefined) {
        const validPriorities = ["hot", "warm", "cold"];
        if (validPriorities.includes(priority)) {
          updateData.priority = priority;
        }
      }
      if (tags !== undefined) {
        updateData.tags = tags;
      }
      if (assignedTrainerId !== undefined) {
        updateData.assignedTrainerId = assignedTrainerId || null;
      }
      if (scheduledFollowUpDate !== undefined) {
        updateData.scheduledFollowUpDate = scheduledFollowUpDate ? new Date(scheduledFollowUpDate) : null;
      }
      if (interaction) {
        const currentHistory = (visitor.interactionHistory as any[]) || [];
        const newInteraction = {
          type: interaction.type,
          content: interaction.content,
          timestamp: new Date().toISOString(),
          byUserId: req.user!.id
        };
        updateData.interactionHistory = [...currentHistory, newInteraction];
      }
      
      const updated = await storage.updateWalkInVisitor(visitorId, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to update follow-up" });
    }
  });
  
  // Bulk update follow-up status for multiple visitors
  app.patch("/api/owner/walk-in-visitors/bulk-follow-up", requireRole(["owner"]), async (req, res) => {
    try {
      const { visitorIds, status, notes } = req.body;
      
      if (!Array.isArray(visitorIds) || visitorIds.length === 0) {
        return res.status(400).json({ message: "visitorIds must be a non-empty array" });
      }
      
      const validStatuses = ["pending", "contacted", "follow_up_scheduled", "converted", "not_interested"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid follow-up status" });
      }
      
      const results = [];
      for (const id of visitorIds) {
        const visitor = await storage.getWalkInVisitorById(id);
        if (visitor && visitor.gymId === req.user!.gymId) {
          const updateData: any = {
            followUpStatus: status,
            followUpDate: new Date(),
            followUpByUserId: req.user!.id
          };
          if (notes) {
            updateData.followUpNotes = notes;
          }
          if (status === "converted") {
            updateData.convertedToMember = true;
          }
          const updated = await storage.updateWalkInVisitor(id, updateData);
          results.push(updated);
        }
      }
      
      res.json({ updated: results.length, visitors: results });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to bulk update follow-ups" });
    }
  });

  // === GYM EMAIL SETTINGS ===
  
  // Get gym email settings
  app.get("/api/gym/email/settings", requireRole(["owner"]), async (req, res) => {
    try {
      const settings = await storage.getGymEmailSettings(req.user!.gymId!);
      const gym = await storage.getGym(req.user!.gymId!);
      res.json({
        settings: settings || { sendMode: "ogym", replyToEmail: req.user!.email },
        gymName: gym?.name || "Your Gym"
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get email settings" });
    }
  });

  // Save gym email settings
  app.post("/api/gym/email/settings", requireRole(["owner"]), async (req, res) => {
    try {
      const { sendMode, replyToEmail, senderName } = req.body;
      const existing = await storage.getGymEmailSettings(req.user!.gymId!);
      
      if (existing) {
        const updated = await storage.updateGymEmailSettings(req.user!.gymId!, {
          sendMode,
          replyToEmail,
          senderName
        });
        return res.json(updated);
      }
      
      const created = await storage.createGymEmailSettings({
        gymId: req.user!.gymId!,
        sendMode,
        replyToEmail,
        senderName
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to save email settings" });
    }
  });

  // === FOLLOW-UPS API (Day Pass, Inactive, Payments) ===

  app.get("/api/followups/ai-queue", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const today = getLocalDate(req);

      const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 14);
      const cutoff14Str = cutoff14.toISOString().split("T")[0];
      const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
      const cutoff30Str = cutoff30.toISOString().split("T")[0];
      const next7 = new Date(); next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split("T")[0];

      const [members, lastAttendanceQuery, subsWithMembers, paymentTotals, recentInterventions] = await Promise.all([
        storage.getGymMembers(gymId),
        db.select({
          memberId: attendance.memberId,
          lastDate: sql<string>`MAX(${attendance.date})`,
          totalVisits: sql<number>`count(*)::int`,
        }).from(attendance)
          .where(and(eq(attendance.gymId, gymId), eq(attendance.status, "present")))
          .groupBy(attendance.memberId),
        db.select({
          id: memberSubscriptions.id,
          memberId: memberSubscriptions.memberId,
          totalAmount: memberSubscriptions.totalAmount,
          endDate: memberSubscriptions.endDate,
          status: memberSubscriptions.status,
          planName: membershipPlans.name,
        }).from(memberSubscriptions)
          .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
          .where(eq(memberSubscriptions.gymId, gymId)),
        db.select({
          subscriptionId: paymentTransactions.subscriptionId,
          totalPaid: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`,
        }).from(paymentTransactions).groupBy(paymentTransactions.subscriptionId),
        storage.getOwnerInterventions(gymId, 200),
      ]);

      const lastPresentMap = new Map(lastAttendanceQuery.map(r => [r.memberId, { lastDate: r.lastDate, totalVisits: r.totalVisits }]));
      const paymentMap = new Map(paymentTotals.map(p => [p.subscriptionId, Number(p.totalPaid)]));
      const memberMap = new Map(members.map(m => [m.id, m]));
      const recentInterventionIds = new Set(recentInterventions
        .filter(i => {
          const created = i.createdAt ? new Date(i.createdAt).getTime() : 0;
          return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
        })
        .map(i => i.memberId));

      type QueueItem = {
        memberId: number;
        name: string;
        email: string | null;
        category: 'churn_risk' | 'expiring' | 'inactive' | 'payment_due' | 'new_member';
        priority: 'high' | 'medium' | 'low';
        reason: string;
        details: Record<string, any>;
        alreadyContacted: boolean;
      };

      const queue: QueueItem[] = [];
      const addedMemberCategories = new Set<string>();

      for (const member of members) {
        const attData = lastPresentMap.get(member.id);
        const lastVisit = attData?.lastDate || null;
        const totalVisits = attData?.totalVisits || 0;
        const alreadyContacted = recentInterventionIds.has(member.id);
        const key = (cat: string) => `${member.id}-${cat}`;

        if (lastVisit) {
          const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));

          if (daysSince >= 7 && daysSince < 14 && totalVisits > 5 && !addedMemberCategories.has(key('churn_risk'))) {
            addedMemberCategories.add(key('churn_risk'));
            queue.push({
              memberId: member.id,
              name: member.username,
              email: member.email || null,
              category: 'churn_risk',
              priority: 'high',
              reason: `Absent ${daysSince} days — was a regular (${totalVisits} visits). Risk of losing them.`,
              details: { daysSince, totalVisits, lastVisit },
              alreadyContacted,
            });
          } else if (daysSince >= 14 && daysSince < 45 && !addedMemberCategories.has(key('inactive'))) {
            addedMemberCategories.add(key('inactive'));
            queue.push({
              memberId: member.id,
              name: member.username,
              email: member.email || null,
              category: 'inactive',
              priority: daysSince >= 30 ? 'high' : 'medium',
              reason: `No visit in ${daysSince} days. ${totalVisits > 3 ? 'They used to come regularly.' : 'Low engagement.'}`,
              details: { daysSince, totalVisits, lastVisit },
              alreadyContacted,
            });
          }
        } else if (totalVisits === 0) {
          const joined = member.createdAt ? new Date(member.createdAt) : null;
          if (joined) {
            const daysSinceJoin = Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceJoin >= 3 && daysSinceJoin <= 14 && !addedMemberCategories.has(key('new_member'))) {
              addedMemberCategories.add(key('new_member'));
              queue.push({
                memberId: member.id,
                name: member.username,
                email: member.email || null,
                category: 'new_member',
                priority: 'medium',
                reason: `Joined ${daysSinceJoin} days ago but hasn't visited yet. Welcome them!`,
                details: { daysSinceJoin },
                alreadyContacted,
              });
            }
          }
        }
      }

      for (const sub of subsWithMembers) {
        const member = memberMap.get(sub.memberId);
        if (!member) continue;
        const alreadyContacted = recentInterventionIds.has(sub.memberId);
        const totalPaid = paymentMap.get(sub.id) || 0;
        const balance = sub.totalAmount - totalPaid;

        if (sub.endDate && sub.endDate >= today && sub.endDate <= next7Str && !addedMemberCategories.has(`${sub.memberId}-expiring`)) {
          addedMemberCategories.add(`${sub.memberId}-expiring`);
          const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          queue.push({
            memberId: sub.memberId,
            name: member.username,
            email: member.email || null,
            category: 'expiring',
            priority: daysLeft <= 2 ? 'high' : 'medium',
            reason: `${sub.planName || 'Subscription'} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew now.`,
            details: { planName: sub.planName, expiryDate: sub.endDate, daysLeft },
            alreadyContacted,
          });
        }

        if (balance > 0 && !addedMemberCategories.has(`${sub.memberId}-payment_due`)) {
          addedMemberCategories.add(`${sub.memberId}-payment_due`);
          queue.push({
            memberId: sub.memberId,
            name: member.username,
            email: member.email || null,
            category: 'payment_due',
            priority: balance >= sub.totalAmount * 0.5 ? 'high' : 'medium',
            reason: `Outstanding balance of ${balance}. ${sub.planName || 'Subscription'} payment pending.`,
            details: { planName: sub.planName, balance, totalAmount: sub.totalAmount },
            alreadyContacted,
          });
        }
      }

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      queue.sort((a, b) => {
        if (a.alreadyContacted !== b.alreadyContacted) return a.alreadyContacted ? 1 : -1;
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });

      const summary = {
        churnRisk: queue.filter(q => q.category === 'churn_risk').length,
        expiring: queue.filter(q => q.category === 'expiring').length,
        inactive: queue.filter(q => q.category === 'inactive').length,
        paymentDue: queue.filter(q => q.category === 'payment_due').length,
        newMember: queue.filter(q => q.category === 'new_member').length,
        total: queue.length,
        contactedToday: queue.filter(q => q.alreadyContacted).length,
      };

      res.json({ queue, summary });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get AI follow-up queue" });
    }
  });

  app.post("/api/followups/ai-generate-message", requireRole(["owner"]), async (req, res) => {
    try {
      const { memberId, memberName, category, goal, reason, details } = req.body;
      if (!memberName || !category) {
        return res.status(400).json({ message: "memberName and category are required" });
      }

      const gym = await storage.getGym(req.user!.gymId!);
      const gymName = gym?.name || "our gym";
      const emailSettings = await storage.getGymEmailSettings(req.user!.gymId!);
      const ownerName = emailSettings?.senderName || req.user!.fullName || req.user!.username;

      const goalDescriptions: Record<string, string> = {
        renew: "Encourage the member to renew their membership",
        bring_back: "Motivate the member to come back to the gym",
        collect_payment: "Professionally remind the member about their pending payment",
        welcome: "Give a warm welcome and encourage their first visit",
        general: "Send a friendly check-in message",
      };

      const toneGuide: Record<string, string> = {
        renew: "friendly and appreciative, highlighting their value as a member",
        bring_back: "motivational and supportive, no guilt-tripping",
        collect_payment: "professional and respectful, brief and clear",
        welcome: "warm, excited, and welcoming",
        general: "casual and friendly",
      };

      const selectedGoal = goal || 'general';
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `You are a gym owner writing a personal email. Generate both a subject line and message body.

Gym: ${gymName}
Owner: ${ownerName}
Member: ${memberName}
Goal: ${goalDescriptions[selectedGoal] || goalDescriptions.general}
Tone: ${toneGuide[selectedGoal] || toneGuide.general}
Context: ${reason || 'General follow-up'}
${details ? `Additional details: ${JSON.stringify(details)}` : ''}

Rules:
- Keep the message 2-4 sentences
- Use the member's first name
- Be genuine, not corporate
- Don't use too many exclamation marks
- Sign off with the actual name "${ownerName.split(' ')[0]}" — NEVER use placeholders like [Your Name] or [Owner Name]
- Match the tone to the goal

Return a JSON object with "subject" and "message" fields.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content?.trim();
      let result = { subject: `Message from ${gymName}`, message: `Hey ${memberName}, hope you're doing great! - ${ownerName}` };
      
      try {
        if (content) {
          const parsed = JSON.parse(content);
          result = { subject: parsed.subject || result.subject, message: parsed.message || result.message };
        }
      } catch {}

      const suggestions = [];
      if (selectedGoal === 'renew' || selectedGoal === 'bring_back') {
        suggestions.push(
          { id: 'free_session', label: 'Offer a free trainer session', active: false },
          { id: 'discount', label: 'Include a renewal discount', active: false },
        );
      }
      if (selectedGoal === 'bring_back' || selectedGoal === 'general') {
        suggestions.push(
          { id: 'reminder_3d', label: 'Schedule follow-up in 3 days', active: false },
        );
      }
      if (selectedGoal === 'collect_payment') {
        suggestions.push(
          { id: 'payment_plan', label: 'Offer a payment plan', active: false },
          { id: 'reminder_3d', label: 'Schedule payment reminder in 3 days', active: false },
        );
      }
      if (selectedGoal === 'welcome') {
        suggestions.push(
          { id: 'free_session', label: 'Offer a complimentary first session', active: false },
          { id: 'gym_tour', label: 'Invite for a guided gym tour', active: false },
        );
      }

      res.json({ ...result, suggestions });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate AI message" });
    }
  });

  app.get("/api/followups/ai-tracking", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const interventions = await storage.getOwnerInterventions(gymId, 500);

      const now = Date.now();
      const last30Days = interventions.filter(i => {
        const created = i.createdAt ? new Date(i.createdAt).getTime() : 0;
        return now - created < 30 * 24 * 60 * 60 * 1000;
      });
      const last7Days = last30Days.filter(i => {
        const created = i.createdAt ? new Date(i.createdAt).getTime() : 0;
        return now - created < 7 * 24 * 60 * 60 * 1000;
      });

      const totalSent = last30Days.length;
      const returned = last30Days.filter(i => i.memberReturnedWithin7Days === true).length;
      const pending = last30Days.filter(i => i.memberReturnedWithin7Days === null).length;
      const notReturned = last30Days.filter(i => i.memberReturnedWithin7Days === false).length;

      const byReason: Record<string, { sent: number; returned: number }> = {};
      for (const i of last30Days) {
        const r = i.triggerReason || 'other';
        if (!byReason[r]) byReason[r] = { sent: 0, returned: 0 };
        byReason[r].sent++;
        if (i.memberReturnedWithin7Days) byReason[r].returned++;
      }

      res.json({
        period: '30_days',
        totalSent,
        returned,
        pending,
        notReturned,
        successRate: totalSent > 0 ? Math.round((returned / totalSent) * 100) : 0,
        sentThisWeek: last7Days.length,
        byReason,
        recentActions: last7Days.slice(0, 10).map(i => ({
          id: i.id,
          memberId: i.memberId,
          actionType: i.actionType,
          triggerReason: i.triggerReason,
          returned: i.memberReturnedWithin7Days,
          createdAt: i.createdAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get AI tracking data" });
    }
  });

  // === OUTCOME DETECTION & PERFORMANCE ===

  app.post("/api/followups/detect-outcomes", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const interventions = await storage.getOwnerInterventions(gymId, 500);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const pending = interventions.filter(i => {
        if (i.outcomeType && i.outcomeType !== 'pending') return false;
        const created = i.createdAt ? new Date(i.createdAt) : null;
        return created && created > thirtyDaysAgo;
      });

      let updated = 0;

      const attendanceRecords = await storage.getAttendance(gymId);
      const allMembers = await storage.getMembers(gymId);
      const memberEmailMap = new Map(allMembers.filter(m => m.email).map(m => [m.id, m.email!.toLowerCase()]));

      for (const intervention of pending) {
        const created = new Date(intervention.createdAt!);
        let detectedOutcome: string | null = null;

        const memberAttendance = attendanceRecords.filter(a =>
          a.memberId === intervention.memberId &&
          a.status === 'present' &&
          new Date(a.date) > created
        );

        const subs = await db.select().from(memberSubscriptions)
          .where(eq(memberSubscriptions.memberId, intervention.memberId));
        const renewedSub = subs.find(s => {
          const start = s.startDate ? new Date(s.startDate) : null;
          return start && start > created && s.status === 'active';
        });

        const memberPayments = await db.select().from(paymentTransactions)
          .where(eq(paymentTransactions.memberId, intervention.memberId));
        const recentPayment = memberPayments.find(p => {
          const paidOn = p.paidOn ? new Date(p.paidOn) : null;
          return paidOn && paidOn > created;
        });

        const memberEmail = memberEmailMap.get(intervention.memberId);
        let wasConverted = false;
        if (memberEmail) {
          const walkins = await db.select().from(walkInVisitors)
            .where(eq(walkInVisitors.gymId, gymId));
          wasConverted = walkins.some(w =>
            w.convertedToMember === true &&
            w.email &&
            w.email.toLowerCase() === memberEmail &&
            w.visitDate &&
            new Date(w.visitDate) <= created
          );
        }

        if (wasConverted) {
          detectedOutcome = 'converted';
        } else if (renewedSub) {
          detectedOutcome = 'renewed';
        } else if (recentPayment) {
          detectedOutcome = 'paid';
        } else if (memberAttendance.length > 0) {
          detectedOutcome = 'returned';
        }

        const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

        let nextAction: string | null = null;
        let nextActionDate: Date | null = null;

        if (!detectedOutcome) {
          if (daysSince >= 10) {
            nextAction = 'Send a final personal follow-up with a special offer';
            nextActionDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
          } else if (daysSince >= 7) {
            nextAction = 'Offer a discount or free session to re-engage';
            nextActionDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
          } else if (daysSince >= 5) {
            nextAction = 'Try a phone call or WhatsApp message';
            nextActionDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
          }
        }

        if (detectedOutcome || nextAction) {
          const updateData: any = {};
          if (detectedOutcome) {
            updateData.outcomeType = detectedOutcome;
            updateData.outcomeDetectedAt = now;
            updateData.memberReturnedWithin7Days = ['returned', 'renewed', 'paid', 'converted'].includes(detectedOutcome);
            if (memberAttendance.length > 0) {
              updateData.memberReturnDate = memberAttendance[0].date;
            }
          }
          if (nextAction && !detectedOutcome) {
            updateData.nextActionSuggestion = nextAction;
            updateData.nextActionDueDate = nextActionDate;
          }
          await storage.updateOwnerIntervention(intervention.id, updateData);
          updated++;
        }
      }

      res.json({ scanned: pending.length, updated, message: `Detected outcomes for ${updated} interventions` });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to detect outcomes" });
    }
  });

  app.get("/api/followups/outcomes", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const interventions = await storage.getOwnerInterventions(gymId, 500);
      const now = Date.now();
      const last30Days = interventions.filter(i => {
        const created = i.createdAt ? new Date(i.createdAt).getTime() : 0;
        return now - created < 30 * 24 * 60 * 60 * 1000;
      });

      const totalSent = last30Days.length;
      const returned = last30Days.filter(i => i.outcomeType === 'returned').length;
      const paid = last30Days.filter(i => i.outcomeType === 'paid').length;
      const renewed = last30Days.filter(i => i.outcomeType === 'renewed').length;
      const converted = last30Days.filter(i => i.outcomeType === 'converted').length;
      const pending = last30Days.filter(i => !i.outcomeType || i.outcomeType === 'pending').length;
      const noResponse = last30Days.filter(i => i.outcomeType === 'no_response').length;

      const allMembers = await storage.getMembers(gymId);
      const memberMap = new Map(allMembers.map(m => [m.id, m]));

      const recentOutcomes = last30Days
        .filter(i => i.outcomeType && i.outcomeType !== 'pending')
        .slice(0, 15)
        .map(i => {
          const member = memberMap.get(i.memberId);
          const daysSinceIntervention = i.outcomeDetectedAt && i.createdAt
            ? Math.floor((new Date(i.outcomeDetectedAt).getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return {
            id: i.id,
            memberId: i.memberId,
            memberName: member?.fullName || member?.username || 'Unknown',
            outcomeType: i.outcomeType,
            followUpGoal: i.followUpGoal,
            triggerReason: i.triggerReason,
            daysSinceIntervention,
            outcomeDetectedAt: i.outcomeDetectedAt,
            createdAt: i.createdAt,
          };
        });

      const pendingActions = last30Days
        .filter(i => (!i.outcomeType || i.outcomeType === 'pending') && i.nextActionSuggestion)
        .slice(0, 10)
        .map(i => {
          const member = memberMap.get(i.memberId);
          const daysSince = i.createdAt
            ? Math.floor((now - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return {
            id: i.id,
            memberId: i.memberId,
            memberName: member?.fullName || member?.username || 'Unknown',
            triggerReason: i.triggerReason,
            followUpGoal: i.followUpGoal,
            daysSinceContact: daysSince,
            suggestion: i.nextActionSuggestion,
            dueDate: i.nextActionDueDate,
            createdAt: i.createdAt,
          };
        });

      res.json({
        period: '30_days',
        totalSent,
        outcomes: { returned, paid, renewed, converted, pending, noResponse },
        successRate: totalSent > 0 ? Math.round(((returned + paid + renewed + converted) / totalSent) * 100) : 0,
        recentOutcomes,
        pendingActions,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get outcomes" });
    }
  });

  app.get("/api/followups/performance", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const interventions = await storage.getOwnerInterventions(gymId, 500);
      const now = Date.now();
      const last30Days = interventions.filter(i => {
        const created = i.createdAt ? new Date(i.createdAt).getTime() : 0;
        return now - created < 30 * 24 * 60 * 60 * 1000;
      });

      const byGoal: Record<string, { sent: number; returned: number; paid: number; renewed: number; converted: number }> = {};
      const byCategory: Record<string, { sent: number; returned: number; paid: number; renewed: number; converted: number }> = {};

      for (const i of last30Days) {
        const goal = i.followUpGoal || 'unknown';
        const cat = i.triggerReason || 'unknown';

        if (!byGoal[goal]) byGoal[goal] = { sent: 0, returned: 0, paid: 0, renewed: 0, converted: 0 };
        if (!byCategory[cat]) byCategory[cat] = { sent: 0, returned: 0, paid: 0, renewed: 0, converted: 0 };

        byGoal[goal].sent++;
        byCategory[cat].sent++;

        const outcome = i.outcomeType;
        if (outcome === 'returned' || i.memberReturnedWithin7Days === true) {
          byGoal[goal].returned++;
          byCategory[cat].returned++;
        }
        if (outcome === 'paid') { byGoal[goal].paid++; byCategory[cat].paid++; }
        if (outcome === 'renewed') { byGoal[goal].renewed++; byCategory[cat].renewed++; }
        if (outcome === 'converted') { byGoal[goal].converted++; byCategory[cat].converted++; }
      }

      const goalLabels: Record<string, string> = {
        bring_back: 'Bring Back',
        renew: 'Renew',
        collect_payment: 'Collect Payment',
        welcome: 'Welcome',
        general: 'General Check-in',
      };

      const categoryLabels: Record<string, string> = {
        churn_risk: 'Churn Risk',
        inactive: 'Inactive',
        expiring: 'Expiring',
        payment_due: 'Payment Due',
        new_member: 'New Member',
      };

      const goalPerformance = Object.entries(byGoal).map(([key, stats]) => ({
        goal: key,
        label: goalLabels[key] || key,
        ...stats,
        successRate: stats.sent > 0 ? Math.round(((stats.returned + stats.paid + stats.renewed + stats.converted) / stats.sent) * 100) : 0,
      })).sort((a, b) => b.successRate - a.successRate);

      const categoryPerformance = Object.entries(byCategory).map(([key, stats]) => ({
        category: key,
        label: categoryLabels[key] || key,
        ...stats,
        successRate: stats.sent > 0 ? Math.round(((stats.returned + stats.paid + stats.renewed + stats.converted) / stats.sent) * 100) : 0,
      })).sort((a, b) => b.successRate - a.successRate);

      res.json({
        period: '30_days',
        totalSent: last30Days.length,
        goalPerformance,
        categoryPerformance,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get performance data" });
    }
  });

  // Get day pass visitors for follow-up
  app.get("/api/followups/daypass", requireRole(["owner"]), async (req, res) => {
    try {
      const { from, to, min_visits, search } = req.query;
      const gymId = req.user!.gymId!;
      
      // Get all day pass visitors
      const visitors = await storage.getWalkInVisitors(gymId);
      const dayPassVisitors = visitors.filter(v => v.visitType === "day_pass");
      
      // Calculate visit counts and apply filters
      let results = dayPassVisitors.map(v => ({
        id: v.id,
        name: v.visitorName,
        email: v.email,
        phone: v.phone,
        visitsCount: 1, // Will aggregate later
        lastVisitDate: v.visitDate,
        dayPassCount: v.daysCount || 1
      }));
      
      // Aggregate by email (same person multiple visits)
      const emailMap = new Map<string, typeof results[0]>();
      results.forEach(r => {
        if (r.email) {
          const existing = emailMap.get(r.email);
          if (existing) {
            existing.visitsCount++;
            existing.dayPassCount += r.dayPassCount;
            if (r.lastVisitDate > existing.lastVisitDate) {
              existing.lastVisitDate = r.lastVisitDate;
              existing.name = r.name;
              existing.phone = r.phone;
            }
          } else {
            emailMap.set(r.email, { ...r });
          }
        }
      });
      results = Array.from(emailMap.values());
      
      // Apply date filter
      if (from) {
        results = results.filter(r => r.lastVisitDate >= (from as string));
      }
      if (to) {
        results = results.filter(r => r.lastVisitDate <= (to as string));
      }
      
      // Apply min visits filter
      if (min_visits) {
        results = results.filter(r => r.visitsCount >= parseInt(min_visits as string));
      }
      
      // Apply search filter
      if (search) {
        const q = (search as string).toLowerCase();
        results = results.filter(r => 
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.includes(q)
        );
      }
      
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get day pass members" });
    }
  });

  // Get inactive members for follow-up (ultra-optimized - all direct SQL)
  app.get("/api/followups/inactive", requireRole(["owner"]), async (req, res) => {
    try {
      const { inactive_days, search } = req.query;
      const gymId = req.user!.gymId!;
      const days = parseInt((inactive_days as string) || "30");
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];
      
      // All 3 queries run in parallel - all are simple/fast direct SQL
      const [members, lastAttendanceQuery, subscriptionStatuses] = await Promise.all([
        storage.getGymMembers(gymId),
        // Fast: aggregate last attendance per member (one row per member)
        db.select({
          memberId: attendance.memberId,
          lastDate: sql<string>`MAX(${attendance.date})`
        })
        .from(attendance)
        .where(and(
          eq(attendance.gymId, gymId),
          eq(attendance.status, "present")
        ))
        .groupBy(attendance.memberId),
        // Fast: just get memberId + status (no joins, no payment calculations)
        db.select({
          memberId: memberSubscriptions.memberId,
          status: memberSubscriptions.status
        })
        .from(memberSubscriptions)
        .where(eq(memberSubscriptions.gymId, gymId))
      ]);
      
      // Create lookup maps
      const lastPresentMap = new Map(lastAttendanceQuery.map(r => [r.memberId, r.lastDate]));
      const subscriptionMap = new Map(subscriptionStatuses.map(s => [s.memberId, s.status]));
      
      // Build results
      const results: Array<{
        id: number;
        name: string;
        email: string | null;
        lastVisit: string | null;
        membershipStatus: string;
      }> = [];
      
      for (const member of members) {
        const lastPresent = lastPresentMap.get(member.id) || null;
        
        // Check if inactive
        if (!lastPresent || lastPresent <= cutoffStr) {
          results.push({
            id: member.id,
            name: member.username,
            email: member.email,
            lastVisit: lastPresent,
            membershipStatus: subscriptionMap.get(member.id) || "no_subscription"
          });
        }
      }
      
      // Apply search filter
      let filtered = results;
      if (search) {
        const q = (search as string).toLowerCase();
        filtered = results.filter(r => 
          r.name.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q)
        );
      }
      
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get inactive members" });
    }
  });

  // Get members with payment issues for follow-up (ultra-optimized - direct SQL)
  app.get("/api/followups/payments", requireRole(["owner"]), async (req, res) => {
    try {
      const { type, search } = req.query;
      const gymId = req.user!.gymId!;
      
      // Run 2 fast parallel queries instead of N+1 pattern
      const [subscriptionsWithMembers, paymentTotals] = await Promise.all([
        // Get subscriptions with member and plan info in one query
        db.select({
          id: memberSubscriptions.id,
          memberId: memberSubscriptions.memberId,
          totalAmount: memberSubscriptions.totalAmount,
          endDate: memberSubscriptions.endDate,
          status: memberSubscriptions.status,
          memberUsername: users.username,
          memberEmail: users.email,
          planName: membershipPlans.name
        })
        .from(memberSubscriptions)
        .leftJoin(users, eq(memberSubscriptions.memberId, users.id))
        .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
        .where(eq(memberSubscriptions.gymId, gymId)),
        // Get total paid per subscription in one aggregation
        db.select({
          subscriptionId: paymentTransactions.subscriptionId,
          totalPaid: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
        })
        .from(paymentTransactions)
        .groupBy(paymentTransactions.subscriptionId)
      ]);
      
      // Create payment lookup
      const paymentMap = new Map(paymentTotals.map(p => [p.subscriptionId, Number(p.totalPaid)]));
      
      const today = getLocalDate(req);
      const next7Days = new Date();
      next7Days.setDate(next7Days.getDate() + 7);
      const next30Days = new Date();
      next30Days.setDate(next30Days.getDate() + 30);
      
      const results: Array<{
        id: number;
        name: string;
        email: string | null;
        planName: string | null;
        expiryDate: string | null;
        balance: number;
        lastPaymentDate: string | null;
        status: string;
      }> = [];
      
      for (const sub of subscriptionsWithMembers) {
        const totalPaid = paymentMap.get(sub.id) || 0;
        const balance = sub.totalAmount - totalPaid;
        
        // Filter by type
        let include = false;
        if (type === "expires_soon" && sub.endDate <= next7Days.toISOString().split("T")[0] && sub.endDate >= today) {
          include = true;
        } else if (type === "next_month" && sub.endDate <= next30Days.toISOString().split("T")[0] && sub.endDate > next7Days.toISOString().split("T")[0]) {
          include = true;
        } else if (type === "balance" && balance > 0) {
          include = true;
        } else if (type === "expired" && sub.endDate < today) {
          include = true;
        } else if (!type) {
          include = true; // Show all if no filter
        }
        
        if (include) {
          results.push({
            id: sub.memberId,
            name: sub.memberUsername || "Unknown",
            email: sub.memberEmail,
            planName: sub.planName || "Custom",
            expiryDate: sub.endDate,
            balance,
            lastPaymentDate: null,
            status: sub.status
          });
        }
      }
      
      // Apply search filter
      let filtered = results;
      if (search) {
        const q = (search as string).toLowerCase();
        filtered = results.filter(r => 
          r.name.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q)
        );
      }
      
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get payment follow-ups" });
    }
  });

  // Send bulk emails for follow-up
  app.post("/api/followups/send", requireRole(["owner"]), async (req, res) => {
    try {
      const { category, member_ids, subject, message, goal } = req.body;
      
      if (!subject || !message || !Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ message: "subject, message, and member_ids are required" });
      }
      
      const gymId = req.user!.gymId!;
      const gym = await storage.getGym(gymId);
      const settings = await storage.getGymEmailSettings(gymId);
      const replyTo = settings?.replyToEmail || req.user!.email || undefined;
      
      let recipients: { email: string; name: string; type: string; id: number }[] = [];
      
      if (category === "DAY_PASS") {
        const visitors = await storage.getWalkInVisitors(gymId);
        recipients = visitors
          .filter(v => member_ids.includes(v.id) && v.email)
          .map(v => ({ email: v.email!, name: v.visitorName, type: 'walk_in', id: v.id }));
      } else {
        const members = await storage.getUsersByIds(member_ids);
        recipients = members
          .filter(m => m.gymId === gymId && !!m.email)
          .map(m => ({ email: m.email!, name: m.fullName || m.username, type: 'member', id: m.id }));
      }
      
      if (recipients.length === 0) {
        return res.status(400).json({ message: "No valid email addresses found" });
      }
      
      const results = {
        sent: 0,
        failed: 0,
        emails: [] as string[]
      };
      
      for (const recipient of recipients) {
        try {
          const success = await sendEmail({
            to: recipient.email,
            subject,
            text: message,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4f46e5;">${gym?.name || "Your Gym"}</h2>
                <div style="white-space: pre-wrap; line-height: 1.6;">${message}</div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">
                  This email was sent by ${gym?.name || "Your Gym"} via OGym.
                  ${replyTo ? `Reply to: ${replyTo}` : ""}
                </p>
              </div>
            `
          });
          
          if (success) {
            results.sent++;
            results.emails.push(recipient.email);
            try {
              await storage.createSentEmail({
                gymId,
                ownerId: req.user!.id,
                recipientEmail: recipient.email,
                recipientName: recipient.name,
                recipientType: recipient.type,
                recipientId: recipient.id,
                category: category || 'GENERAL',
                goal: goal || null,
                subject,
                message,
                status: 'sent',
              });
            } catch (logErr) {
              console.error(`[SENT EMAIL LOG] Failed to log:`, logErr);
            }
          } else {
            results.failed++;
          }
        } catch (err) {
          console.error(`[FOLLOWUP EMAIL] Failed to send to ${recipient.email}:`, err);
          results.failed++;
        }
      }
      
      console.log(`[FOLLOWUP EMAIL] Category: ${category}, Sent: ${results.sent}, Failed: ${results.failed}`);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send emails" });
    }
  });

  app.get("/api/followups/sent-history", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const { category, goal, search, startDate, endDate, limit, offset } = req.query;
      const result = await storage.getSentEmails(gymId, {
        category: category as string | undefined,
        goal: goal as string | undefined,
        search: search as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch sent history" });
    }
  });

  app.get("/api/followups/last-contact/:email", requireRole(["owner"]), async (req, res) => {
    try {
      const gymId = req.user!.gymId!;
      const email = decodeURIComponent(req.params.email);
      const lastEmail = await storage.getLastEmailToRecipient(gymId, email);
      res.json(lastEmail);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to check last contact" });
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
      
      // Get gym info for display including payment options
      const gym = await storage.getGym(session.gymId);
      res.json({ 
        valid: true, 
        gymName: gym?.name,
        gymId: session.gymId,
        sessionId: session.id,
        currency: gym?.currency || "INR",
        dayPassPrice: gym?.dayPassPrice,
        paymentLinks: gym?.paymentLinks || {}
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
      const { email, otp, name, phone, city, visitType, daysCount, amountPaid, paymentMethod, paymentScreenshot, notes, enquiryCategory, enquiryDetails } = req.body;
      
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }
      
      // Validate day_pass requires payment proof
      if (visitType === "day_pass") {
        if (!paymentScreenshot || !paymentMethod) {
          return res.status(400).json({ message: "Payment proof and method are required for day pass" });
        }
        // Validate screenshot size (max 2MB base64 ~2.7M chars)
        if (paymentScreenshot.length > 3000000) {
          return res.status(400).json({ message: "Payment screenshot is too large. Please use a smaller image." });
        }
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
      
      // Generate unique check-in code for day passes (6 alphanumeric characters)
      let checkinCode = null;
      let codeExpiresAt = null;
      if (visitType === "day_pass") {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars like 0/O, 1/I
        const now = new Date();
        // Try up to 5 times to generate a unique code
        for (let attempt = 0; attempt < 5; attempt++) {
          let candidateCode = "";
          for (let i = 0; i < 6; i++) {
            candidateCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          // Check if code is unique for this gym (only check active codes)
          const existing = await storage.getWalkInVisitorByCheckinCode(session.gymId, candidateCode);
          if (!existing || (existing.codeExpiresAt && new Date(existing.codeExpiresAt) < now)) {
            checkinCode = candidateCode;
            break;
          }
        }
        if (!checkinCode) {
          // Fallback: append timestamp suffix for guaranteed uniqueness
          checkinCode = "";
          for (let i = 0; i < 4; i++) {
            checkinCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          checkinCode += (Date.now() % 100).toString().padStart(2, "0");
        }
        // Code expires in 24 hours
        codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      
      // Create walk-in visitor entry
      const today = getLocalDate(req);
      const visitorNameVal = name || email.split("@")[0];
      const visitor = await storage.createWalkInVisitor({
        gymId: session.gymId,
        visitorName: visitorNameVal,
        phone: phone || null,
        city: city || null,
        email: email || null,
        visitDate: today,
        visitType: visitType || "enquiry",
        daysCount: daysCount || 1,
        amountPaid: amountPaid || 0,
        paymentMethod: paymentMethod || null,
        paymentScreenshot: paymentScreenshot || null,
        checkinCode,
        codeExpiresAt,
        notes: notes || null,
        source: "kiosk",
        kioskSessionId: session.id,
        enquiryCategory: visitType === 'enquiry' ? (enquiryCategory || null) : null,
        enquiryDetails: visitType === 'enquiry' ? (enquiryDetails || null) : null,
        createdByUserId: null
      });
      
      res.status(201).json({ 
        message: "Check-in successful! The gym has been notified.",
        checkinCode,
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
      const result: { unreadAnnouncements: number; pendingRequests: number; pendingTransfers?: number; pendingJoinRequests?: number; hotLeadsCount?: number } = {
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

        // Hot leads count for walk-in visitors (score >= 70)
        try {
          const visitors = await storage.getWalkInVisitors(user.gymId, {});
          const gym = await storage.getGym(user.gymId);
          const gymCity = gym?.city?.toLowerCase()?.trim() || '';
          const now = Date.now();
          const threeDays = 3 * 24 * 60 * 60 * 1000;
          const visitCounts = new Map<string, number>();
          for (const v of visitors) {
            const key = v.email?.toLowerCase()?.trim() || (v.phone?.trim() ? `phone:${v.phone.trim()}` : null);
            if (key) visitCounts.set(key, (visitCounts.get(key) || 0) + 1);
          }
          let hotCount = 0;
          for (const v of visitors) {
            if (v.convertedToMember) continue;
            let score = 0;
            const key = v.email?.toLowerCase()?.trim() || (v.phone?.trim() ? `phone:${v.phone.trim()}` : null);
            const repeatCount = key ? (visitCounts.get(key) || 1) : 1;
            if (repeatCount >= 2) score += 25;
            if (v.city && gymCity && v.city.toLowerCase().trim() === gymCity) score += 15;
            if (v.enquiryCategory && v.enquiryCategory !== 'Other') score += 20;
            else if (v.visitType === 'enquiry') score += 10;
            if (v.paymentVerified) score += 10;
            const visitTime = v.visitDate ? new Date(v.visitDate).getTime() : 0;
            if (visitTime && (now - visitTime) < threeDays) score += 15;
            if (v.email || v.phone) score += 10;
            if (v.visitType === 'trial') score += 5;
            if (Math.min(score, 100) >= 70) hotCount++;
          }
          result.hotLeadsCount = hotCount;
        } catch { result.hotLeadsCount = 0; }
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
  
  // Create initial body measurement (member only - works for both gym and personal mode)
  app.post("/api/body-measurements/initial", requireRole(["member"]), async (req, res) => {
    try {
      // For Personal Mode, all fields are optional. For gym members, height and weight required.
      const isPersonalMode = !req.user!.gymId;
      
      const schema = isPersonalMode 
        ? z.object({
            height: z.number().min(50).max(300).optional(),
            weight: z.number().min(20).max(500).optional(),
            bodyFat: z.number().min(1).max(70).optional(),
            chest: z.number().min(30).max(300).optional(),
            waist: z.number().min(30).max(300).optional(),
            hips: z.number().min(30).max(300).optional()
          })
        : z.object({
            height: z.number().min(50, "Height must be at least 50 cm").max(300, "Height must be less than 300 cm"),
            weight: z.number().min(20, "Weight must be at least 20 kg").max(500, "Weight must be less than 500 kg"),
            bodyFat: z.number().min(1).max(70).optional(),
            chest: z.number().min(30).max(300).optional(),
            waist: z.number().min(30).max(300).optional(),
            hips: z.number().min(30).max(300).optional()
          });
      
      const input = schema.parse(req.body);
      
      // Check if any measurement data was provided
      const hasData = input.height || input.weight || input.bodyFat || input.chest || input.waist || input.hips;
      
      if (hasData) {
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
      } else {
        // No data provided, just mark onboarding as complete
        await storage.setOnboardingCompleted(req.user!.id);
        console.log(`[Onboarding] Onboarding completed (no measurements) for user ${req.user!.id}`);
        res.json({ measurement: null, onboardingCompleted: true });
      }
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      console.error("[Onboarding] Failed to save initial body measurement:", err);
      res.status(500).json({ message: "Failed to save body measurement" });
    }
  });
  
  // Skip onboarding (Personal Mode only - gym members must complete full onboarding)
  app.post("/api/onboarding/skip", requireRole(["member"]), async (req, res) => {
    try {
      // Only allow Personal Mode users to skip onboarding
      if (req.user!.gymId) {
        return res.status(403).json({ message: "Gym members must complete onboarding" });
      }
      
      await storage.setOnboardingCompleted(req.user!.id);
      console.log(`[Onboarding] Skipped onboarding for Personal Mode user ${req.user!.id}`);
      res.json({ success: true, onboardingCompleted: true });
    } catch (err) {
      console.error("[Onboarding] Failed to skip onboarding:", err);
      res.status(500).json({ message: "Failed to skip onboarding" });
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
        propertyType: z.enum(["gym", "apartment", "recreation_center", "corporate", "society"]).default("gym"),
        gymName: z.string().min(1, "Name is required"),
        phone: z.string().optional(),
        address: z.string().optional(),
        pointOfContactName: z.string().optional(),
        pointOfContactEmail: z.string().email().optional().or(z.literal("")),
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
        country: z.string().min(1, "Country is required"),
        gymSize: z.enum(["0-50", "51-150", "151-300", "300+"], { 
          errorMap: () => ({ message: "Please select a valid size" }) 
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
        propertyType: input.propertyType,
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
      if (req.user!.isGuest) {
        return res.status(403).json({ message: "Please create an account to join a gym" });
      }
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
          status: (owner as any).status || "active"
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

  // === UGC MODERATION (App Store compliance) ===
  
  // Report a post
  app.post("/api/feed/:postId/report", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const schema = z.object({
        reason: z.enum(["inappropriate", "spam", "harassment", "other"]),
        description: z.string().optional(),
      });
      const input = schema.parse(req.body);
      
      const report = await storage.createPostReport({
        postId,
        reporterId: req.user!.id,
        reason: input.reason,
        description: input.description || null,
      });
      
      res.json({ success: true, reportId: report.id });
    } catch (error) {
      console.error("Report post error:", error);
      res.status(400).json({ message: "Failed to report post" });
    }
  });

  // Block a user
  app.post("/api/users/:userId/block", requireAuth, async (req, res) => {
    try {
      const blockedUserId = parseInt(req.params.userId);
      
      if (blockedUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot block yourself" });
      }
      
      await storage.blockUser(req.user!.id, blockedUserId);
      res.json({ success: true });
    } catch (error) {
      console.error("Block user error:", error);
      res.status(400).json({ message: "Failed to block user" });
    }
  });

  // Unblock a user
  app.delete("/api/users/:userId/block", requireAuth, async (req, res) => {
    try {
      const blockedUserId = parseInt(req.params.userId);
      await storage.unblockUser(req.user!.id, blockedUserId);
      res.json({ success: true });
    } catch (error) {
      console.error("Unblock user error:", error);
      res.status(400).json({ message: "Failed to unblock user" });
    }
  });

  // Get blocked users list
  app.get("/api/users/blocked", requireAuth, async (req, res) => {
    const blockedUserIds = await storage.getBlockedUsers(req.user!.id);
    res.json(blockedUserIds);
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
  app.post("/api/support", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      const schema = z.object({
        issueType: z.enum(["attendance", "payments", "profile_update", "trainer_assignment", "bug_report", "workout", "nutrition", "account", "subscription", "other"]),
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
  app.get("/api/support/my-tickets", requireAuth, async (req, res) => {
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
  app.get("/api/support/ticket/:id", requireAuth, async (req, res) => {
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
  app.post("/api/support/ticket/:id/message", requireAuth, async (req, res) => {
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
      const filters: { status?: string; priority?: string; issueType?: string; gymId?: number; personalMode?: boolean } = {};
      
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
      if (req.query.personalMode === 'true') {
        filters.personalMode = true;
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
      
      res.json(sanitizeUser(user));
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
      
      res.json(sanitizeUser(updatedUser));
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
      
      res.json(sanitizeUser(updatedUser));
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
      
      res.json(sanitizeUser(updatedUser));
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

  // ==================== SPORTS MODE ====================
  
  app.get("/api/sport/profile", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getSportProfile(req.user!.id);
      res.json(profile || null);
    } catch (err) {
      console.error("Get sport profile error:", err);
      res.status(500).json({ message: "Failed to get sport profile" });
    }
  });

  app.post("/api/sport/profile", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        sport: z.string().min(1),
        role: z.string().min(1),
        fitnessScore: z.number().min(0).max(100).optional(),
        testAnswers: z.any().optional(),
      });
      const data = schema.parse(req.body);
      const profile = await storage.createSportProfile({
        userId: req.user!.id,
        sport: data.sport,
        role: data.role,
        fitnessScore: data.fitnessScore ?? null,
        testAnswers: data.testAnswers ?? null,
        isActive: true,
      });
      res.json(profile);
    } catch (err) {
      console.error("Create sport profile error:", err);
      res.status(500).json({ message: "Failed to create sport profile" });
    }
  });

  app.post("/api/sport/profile/end", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getSportProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "No active sport profile found" });
      }
      const ended = await storage.endSportProfile(profile.id);
      res.json(ended);
    } catch (err) {
      console.error("End sport profile error:", err);
      res.status(500).json({ message: "Failed to end sport profile" });
    }
  });

  app.get("/api/sport/profile/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getSportProfileHistory(req.user!.id);
      res.json(history);
    } catch (err) {
      console.error("Get sport profile history error:", err);
      res.status(500).json({ message: "Failed to get sport profile history" });
    }
  });

  app.get("/api/sport/programs", requireAuth, async (req, res) => {
    try {
      const programs = await storage.getSportPrograms(req.user!.id);
      res.json(programs);
    } catch (err) {
      console.error("Get sport programs error:", err);
      res.status(500).json({ message: "Failed to get sport programs" });
    }
  });

  app.get("/api/sport/programs/:id", requireAuth, async (req, res) => {
    try {
      const program = await storage.getSportProgram(parseInt(req.params.id));
      if (!program || program.userId !== req.user!.id) {
        return res.status(404).json({ message: "Program not found" });
      }
      res.json(program);
    } catch (err) {
      console.error("Get sport program error:", err);
      res.status(500).json({ message: "Failed to get sport program" });
    }
  });

  app.post("/api/sport/preview-modifications", requireAuth, requireAiConsent, async (req, res) => {
    try {
      if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
        return res.status(403).json({ message: "Sports Mode cycle modifications are only available for Self-Guided and Personal Mode members" });
      }

      const schema = z.object({
        sportProfileId: z.number(),
        sport: z.string(),
        role: z.string(),
        skillCategory: z.string(),
        skillName: z.string(),
        fitnessScore: z.number().optional(),
      });
      const data = schema.parse(req.body);

      const sportProfile = await storage.getSportProfile(req.user!.id);
      if (!sportProfile || sportProfile.id !== data.sportProfileId) {
        return res.status(403).json({ message: "Sport profile not found or not authorized" });
      }

      const activeCycle = await storage.getMemberCycle(req.user!.id);
      let currentExercises: any[] = [];
      let cycleInfo: any = null;

      if (activeCycle) {
        const items = await storage.getWorkoutItems(activeCycle.id);
        const activeItems = items.filter(i => !i.isDeleted);
        cycleInfo = {
          id: activeCycle.id,
          name: activeCycle.name,
          cycleLength: activeCycle.cycleLength,
          dayLabels: activeCycle.dayLabels,
          restDays: activeCycle.restDays || [],
        };
        currentExercises = activeItems.map(i => ({
          id: i.id,
          dayIndex: i.dayIndex,
          exerciseName: i.exerciseName,
          muscleType: i.muscleType,
          bodyPart: i.bodyPart,
          sets: i.sets,
          reps: i.reps,
          weight: i.weight,
          exerciseType: i.exerciseType,
          orderIndex: i.orderIndex,
        }));
      }

      if (!activeCycle || currentExercises.length === 0) {
        return res.json({ noCycle: true, cycleInfo: null, previews: [] });
      }

      const exercisesByDay: Record<number, any[]> = {};
      for (const ex of currentExercises) {
        if (!exercisesByDay[ex.dayIndex]) exercisesByDay[ex.dayIndex] = [];
        exercisesByDay[ex.dayIndex].push(ex);
      }

      const cycleDescription = Object.entries(exercisesByDay).map(([day, exs]) => {
        const dayLabel = cycleInfo.dayLabels?.[parseInt(day)] || `Day ${parseInt(day) + 1}`;
        const isRest = cycleInfo.restDays?.includes(parseInt(day));
        if (isRest) return `${dayLabel} (Rest Day)`;
        return `${dayLabel}: ${exs.map((e: any) => `${e.exerciseName} (${e.muscleType}, ${e.sets}x${e.reps})`).join(', ')}`;
      }).join('\n');

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `You are a sports fitness coach. A ${data.role} in ${data.sport} wants to improve their ${data.skillName} (${data.skillCategory}).
${data.fitnessScore ? `Fitness score: ${data.fitnessScore}/100.` : ''}

Their current workout cycle has ${cycleInfo.cycleLength} days:
${cycleDescription}

Create 3 modification plans at 50%, 80%, and 100% priority levels. For each level, suggest which exercises to REPLACE with sport-targeted exercises that help improve ${data.skillName} in ${data.sport}.

RULES:
- Only suggest gym exercises (weight training, bodyweight, resistance) - NO sport drills
- Each replacement exercise must specify the target muscle group
- At 50%: replace few exercises across the cycle with sport-targeted ones
- At 80%: replace most exercises, keeping only essential compound movements
- At 100%: replace all exercises with sport-focused training
- Do NOT touch rest days
- Keep the same dayIndex structure

Return JSON:
{
  "analysis": {
    "targetMuscles": ["muscle1", "muscle2"],
    "whyTheseMuscles": "Why these muscles matter for ${data.skillName}"
  },
  "previews": [
    {
      "priority": 50,
      "summary": "Brief description of changes at 50%",
      "changes": [
        {
          "dayIndex": 0,
          "removals": [{"exerciseName": "Original exercise name", "muscleType": "Original muscle"}],
          "additions": [{"exerciseName": "New exercise", "muscleType": "Target muscle", "bodyPart": "Body part", "sets": 3, "reps": 10}]
        }
      ]
    },
    {
      "priority": 80,
      "summary": "Brief description of changes at 80%",
      "changes": [...]
    },
    {
      "priority": 100,
      "summary": "Brief description of changes at 100%",
      "changes": [...]
    }
  ]
}

Only return valid JSON.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
      });

      const aiResult = JSON.parse(completion.choices[0].message.content || "{}");

      res.json({
        noCycle: false,
        cycleInfo,
        currentExercises: exercisesByDay,
        analysis: aiResult.analysis,
        previews: aiResult.previews || [],
      });
    } catch (err) {
      console.error("Preview sport modifications error:", err);
      res.status(500).json({ message: "Failed to generate modification previews" });
    }
  });

  app.post("/api/sport/apply-modifications", requireAuth, async (req, res) => {
    try {
      if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
        return res.status(403).json({ message: "Only Self-Guided and Personal Mode members" });
      }

      const schema = z.object({
        sportProfileId: z.number(),
        sport: z.string(),
        role: z.string(),
        skillCategory: z.string(),
        skillName: z.string(),
        priority: z.number(),
        changes: z.array(z.object({
          dayIndex: z.number(),
          removals: z.array(z.object({ exerciseName: z.string(), muscleType: z.string() })),
          additions: z.array(z.object({
            exerciseName: z.string(),
            muscleType: z.string(),
            bodyPart: z.string(),
            sets: z.number(),
            reps: z.number(),
          })),
        })),
        analysis: z.any().optional(),
      });
      const data = schema.parse(req.body);

      const sportProfile = await storage.getSportProfile(req.user!.id);
      if (!sportProfile || sportProfile.id !== data.sportProfileId) {
        return res.status(403).json({ message: "Sport profile not found or not authorized" });
      }

      const activeCycle = await storage.getMemberCycle(req.user!.id);
      if (!activeCycle) {
        return res.status(400).json({ message: "No active workout cycle found" });
      }

      const existingItems = await storage.getWorkoutItems(activeCycle.id);
      const replacedItemIds: number[] = [];

      const program = await storage.createSportProgram({
        userId: req.user!.id,
        sportProfileId: data.sportProfileId,
        sport: data.sport,
        role: data.role,
        skillCategory: data.skillCategory,
        skillName: data.skillName,
        aiAnalysis: data.analysis || null,
        programPlan: { changes: data.changes },
        priority: data.priority,
        durationWeeks: 0,
        isActive: true,
        cycleId: activeCycle.id,
      });

      for (const change of data.changes) {
        const dayItems = existingItems.filter(i => i.dayIndex === change.dayIndex && !i.isDeleted);

        for (const removal of change.removals) {
          const match = dayItems.find(i =>
            i.exerciseName.toLowerCase() === removal.exerciseName.toLowerCase() &&
            !replacedItemIds.includes(i.id)
          );
          if (match) {
            replacedItemIds.push(match.id);
            await storage.deleteWorkoutItem(match.id);
          }
        }

        const maxOrder = dayItems.reduce((max, i) => Math.max(max, i.orderIndex || 0), 0);
        for (let i = 0; i < change.additions.length; i++) {
          const addition = change.additions[i];
          await storage.addWorkoutItem({
            cycleId: activeCycle.id,
            dayIndex: change.dayIndex,
            exerciseName: addition.exerciseName,
            muscleType: addition.muscleType,
            bodyPart: addition.bodyPart,
            exerciseType: "strength",
            sets: addition.sets,
            reps: addition.reps,
            orderIndex: maxOrder + i + 1,
            sportProgramId: program.id,
          });
        }
      }

      await storage.updateSportProgram(program.id, {
        replacedItems: replacedItemIds,
      });

      res.json({ success: true, programId: program.id });
    } catch (err) {
      console.error("Apply sport modifications error:", err);
      res.status(500).json({ message: "Failed to apply modifications" });
    }
  });

  app.post("/api/sport/create-full-cycle", requireAuth, requireAiConsent, async (req, res) => {
    try {
      if (req.user!.gymId && req.user!.trainingMode === 'trainer_led') {
        return res.status(403).json({ message: "Only Self-Guided and Personal Mode members" });
      }

      const schema = z.object({
        sportProfileId: z.number(),
        sport: z.string(),
        role: z.string(),
        skillCategory: z.string(),
        skillName: z.string(),
        fitnessScore: z.number().optional(),
      });
      const data = schema.parse(req.body);

      const sportProfile = await storage.getSportProfile(req.user!.id);
      if (!sportProfile || sportProfile.id !== data.sportProfileId) {
        return res.status(403).json({ message: "Sport profile not found or not authorized" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `You are a sports fitness coach. Create a complete gym workout cycle for a ${data.role} in ${data.sport} who wants to improve ${data.skillName} (${data.skillCategory}).
${data.fitnessScore ? `Fitness score: ${data.fitnessScore}/100.` : ''}

RULES:
- Create a 5-day cycle (with 2 rest days) focused on muscles that improve ${data.skillName}
- Only gym exercises (weight training, bodyweight, resistance) - NO sport drills
- Each exercise must have a target muscle group and body part
- Progressive and balanced across the week

Return JSON:
{
  "analysis": {
    "targetMuscles": ["muscle1", "muscle2"],
    "whyTheseMuscles": "Why these muscles matter"
  },
  "cycle": {
    "name": "Cycle name for ${data.skillName}",
    "cycleLength": 7,
    "dayLabels": ["Day 1 Name", "Day 2 Name", "Day 3 Name", "Day 4 Name", "Day 5 Name", "Rest", "Rest"],
    "restDays": [5, 6],
    "exercises": [
      {"dayIndex": 0, "exerciseName": "Exercise", "muscleType": "Muscle", "bodyPart": "Body part", "sets": 3, "reps": 10, "orderIndex": 0},
      {"dayIndex": 0, "exerciseName": "Exercise 2", "muscleType": "Muscle", "bodyPart": "Body part", "sets": 3, "reps": 12, "orderIndex": 1}
    ]
  }
}

Only return valid JSON.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
      });

      const aiResult = JSON.parse(completion.choices[0].message.content || "{}");
      const cycleData = aiResult.cycle;

      if (!cycleData) {
        return res.status(500).json({ message: "AI failed to generate cycle" });
      }

      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 90);

      const cycle = await storage.createWorkoutCycle({
        memberId: req.user!.id,
        name: cycleData.name || `${data.sport} - ${data.skillName} Training`,
        cycleLength: cycleData.cycleLength || 7,
        dayLabels: cycleData.dayLabels,
        restDays: cycleData.restDays,
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        progressionMode: "calendar",
        source: "self",
        isActive: true,
      });

      const program = await storage.createSportProgram({
        userId: req.user!.id,
        sportProfileId: data.sportProfileId,
        sport: data.sport,
        role: data.role,
        skillCategory: data.skillCategory,
        skillName: data.skillName,
        aiAnalysis: aiResult.analysis,
        programPlan: { fullCycle: true },
        priority: 100,
        durationWeeks: 0,
        isActive: true,
        cycleId: cycle.id,
      });

      if (cycleData.exercises && Array.isArray(cycleData.exercises)) {
        for (const ex of cycleData.exercises) {
          await storage.addWorkoutItem({
            cycleId: cycle.id,
            dayIndex: ex.dayIndex,
            exerciseName: ex.exerciseName,
            muscleType: ex.muscleType,
            bodyPart: ex.bodyPart,
            exerciseType: "strength",
            sets: ex.sets || 3,
            reps: ex.reps || 10,
            orderIndex: ex.orderIndex || 0,
            sportProgramId: program.id,
          });
        }
      }

      res.json({ success: true, programId: program.id, cycleId: cycle.id });
    } catch (err) {
      console.error("Create full sport cycle error:", err);
      res.status(500).json({ message: "Failed to create sport cycle" });
    }
  });

  app.get("/api/sport/programs/:id/analytics", requireAuth, async (req, res) => {
    try {
      const program = await storage.getSportProgram(parseInt(req.params.id));
      if (!program || program.userId !== req.user!.id) {
        return res.status(404).json({ message: "Program not found" });
      }

      const cycleId = program.cycleId;
      let totalExercises = 0;
      let sportExercises = 0;
      let muscleDistribution: Record<string, { total: number; sport: number }> = {};

      if (cycleId) {
        const allItems = await storage.getWorkoutItems(cycleId);
        totalExercises = allItems.length;
        sportExercises = allItems.filter(i => i.sportProgramId === program.id).length;

        for (const item of allItems) {
          const muscle = item.muscleType || "Other";
          if (!muscleDistribution[muscle]) {
            muscleDistribution[muscle] = { total: 0, sport: 0 };
          }
          muscleDistribution[muscle].total++;
          if (item.sportProgramId === program.id) {
            muscleDistribution[muscle].sport++;
          }
        }
      }

      const planData = program.programPlan as any;
      const changes = planData?.changes || [];
      let volumeBefore = { sets: 0, reps: 0 };
      let volumeAfter = { sets: 0, reps: 0 };
      for (const change of changes) {
        for (const r of (change.removals || [])) {
          volumeBefore.sets += (r.sets || 3);
          volumeBefore.reps += (r.sets || 3) * (r.reps || 10);
        }
        for (const a of (change.additions || [])) {
          volumeAfter.sets += (a.sets || 3);
          volumeAfter.reps += (a.sets || 3) * (a.reps || 10);
        }
      }

      let completionRate = null;
      let completedSportExercises = 0;
      let totalSportExerciseOccurrences = 0;

      if (cycleId) {
        const sportItems = (await storage.getWorkoutItems(cycleId)).filter(i => i.sportProgramId === program.id);
        if (sportItems.length > 0) {
          const today = getLocalDate(req);
          const createdDate = program.createdAt ? new Date(program.createdAt).toISOString().split("T")[0] : today;
          
          const completions = await db.select().from(workoutCompletions).where(
            and(
              eq(workoutCompletions.memberId, req.user!.id),
              gte(workoutCompletions.completedDate, createdDate)
            )
          );

          const sportItemIds = sportItems.map(i => i.id);
          completedSportExercises = completions.filter(c => c.workoutItemId && sportItemIds.includes(c.workoutItemId)).length;
          
          const daysSinceCreated = Math.max(1, Math.floor((Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24)));
          const cycleLength = Math.max(...sportItems.map(i => i.dayIndex)) + 1;
          const cyclesCompleted = Math.max(1, Math.floor(daysSinceCreated / Math.max(1, cycleLength)));
          totalSportExerciseOccurrences = sportItems.length * cyclesCompleted;
          completionRate = totalSportExerciseOccurrences > 0 
            ? Math.round((completedSportExercises / totalSportExerciseOccurrences) * 100) 
            : null;
        }
      }

      const daysActive = program.createdAt 
        ? Math.floor((Date.now() - new Date(program.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      res.json({
        impactScore: totalExercises > 0 ? Math.round((sportExercises / totalExercises) * 100) : 0,
        totalExercises,
        sportExercises,
        muscleDistribution,
        volumeChange: {
          removedSets: volumeBefore.sets,
          removedReps: volumeBefore.reps,
          addedSets: volumeAfter.sets,
          addedReps: volumeAfter.reps,
          netSets: volumeAfter.sets - volumeBefore.sets,
          netReps: volumeAfter.reps - volumeBefore.reps,
        },
        completionRate,
        completedSportExercises,
        totalSportExerciseOccurrences,
        daysActive,
      });
    } catch (err) {
      console.error("Sport program analytics error:", err);
      res.status(500).json({ message: "Failed to get analytics" });
    }
  });

  app.delete("/api/sport/programs/:id", requireAuth, async (req, res) => {
    try {
      const program = await storage.getSportProgram(parseInt(req.params.id));
      if (!program || program.userId !== req.user!.id) {
        return res.status(404).json({ message: "Program not found" });
      }
      await storage.deactivateSportProgram(program.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete sport program error:", err);
      res.status(500).json({ message: "Failed to delete sport program" });
    }
  });

  // === MATCH LOGS ===

  app.post("/api/match-logs", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        sport: z.string(),
        sportProfileId: z.number(),
        matchDate: z.string(),
        matchTiming: z.enum(["today", "tomorrow", "yesterday"]),
        status: z.enum(["going", "done", "scheduled", "recovery"]),
        duration: z.number().optional(),
        intensity: z.enum(["casual", "competitive"]).optional(),
        caloriesBurned: z.number().optional(),
        workoutAction: z.enum(["rest", "warmup", "recovery", "normal"]),
        notes: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const log = await storage.createMatchLog({
        ...input,
        userId: req.user!.id,
      });
      res.status(201).json(log);
    } catch (err) {
      console.error("Create match log error:", err);
      res.status(500).json({ message: "Failed to log match" });
    }
  });

  app.get("/api/match-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getMatchLogs(req.user!.id);
      res.json(logs);
    } catch (err) {
      console.error("Get match logs error:", err);
      res.status(500).json({ message: "Failed to get match logs" });
    }
  });

  app.get("/api/match-logs/date/:date", requireAuth, async (req, res) => {
    try {
      const log = await storage.getMatchLogByDate(req.user!.id, req.params.date);
      res.json(log || null);
    } catch (err) {
      console.error("Get match log by date error:", err);
      res.status(500).json({ message: "Failed to get match log" });
    }
  });

  app.post("/api/match-logs/:id/cancel", requireAuth, async (req, res) => {
    try {
      await storage.cancelMatchLog(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error("Cancel match log error:", err);
      res.status(500).json({ message: "Failed to cancel match log" });
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
          reactionType: reactions[Math.floor(Math.random() * reactions.length)] as "like" | "fire" | "muscle" | "clap"
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
    daysPerCycle: 1,
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
    daysPerCycle: 3,
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
