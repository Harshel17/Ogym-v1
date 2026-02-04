import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || "dev-only-secret-do-not-use-in-prod";

// Generate JWT token for mobile apps
export function generateMobileToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

// Verify JWT token
export function verifyMobileToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

// Middleware to authenticate mobile requests via Bearer token
export async function mobileAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip if already authenticated via session
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyMobileToken(token);
    
    if (decoded) {
      const user = await storage.getUser(decoded.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }
  }
  
  next();
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const isProduction = app.get("env") === "production";
  
  if (isProduction && !process.env.SESSION_SECRET) {
    console.error("FATAL: SESSION_SECRET environment variable is required in production");
    process.exit(1);
  }
  
  const sessionSecret = process.env.SESSION_SECRET || "dev-only-secret-do-not-use-in-prod";
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          }
          if (!user.emailVerified) {
            return done(null, false, { message: "Email not verified" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, (user as SelectUser).id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id as number);
      // If user no longer exists (deleted), return false to indicate "no user"
      // This gracefully handles cases where users were deleted but sessions remain
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}
