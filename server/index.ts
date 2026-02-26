import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.error('[SIGNAL] SIGTERM received — process being terminated');
});

process.on('SIGINT', () => {
  console.error('[SIGNAL] SIGINT received');
});

process.on('SIGHUP', () => {
  console.error('[SIGNAL] SIGHUP received');
});

process.on('beforeExit', (code) => {
  console.error(`[PROCESS] beforeExit with code ${code}`);
});

process.on('exit', (code) => {
  console.error(`[PROCESS] exit with code ${code}`);
});

const originalExit = process.exit;
process.exit = function(code?: number) {
  if (code !== 0) {
    console.error(`[PROCESS] process.exit(${code}) blocked — keeping server alive`);
    console.error(new Error('process.exit call stack').stack);
    return undefined as never;
  }
  return originalExit.call(process, code);
} as typeof process.exit;

const app = express();
const isProduction = process.env.NODE_ENV === "production";
app.set('trust proxy', 1); // Trust first proxy (for rate limiting to work correctly)
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const isMobileApp = req.headers['x-mobile-app'] === 'true' || 
    origin.includes('capacitor://') ||
    origin.includes('localhost') ||
    req.headers['user-agent']?.includes('OGym');
  if (isMobileApp && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mobile-App, X-Timezone, X-Timezone-Offset');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'", "capacitor://localhost", "https://localhost", "https://app.ogym.fitness"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "capacitor://localhost", "https://localhost", "https://app.ogym.fitness"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "capacitor://localhost", "https://localhost", "https://app.ogym.fitness", "https://*.unsplash.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "capacitor://localhost", "https://localhost", "https://app.ogym.fitness", "https://*.overpass-api.de", "wss://app.ogym.fitness"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'", "capacitor://localhost", "https://localhost", "https://app.ogym.fitness"],
      upgradeInsecureRequests: null,
    },
  } : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.unsplash.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 mutations per minute
  message: { message: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip GET and OPTIONS
    if (req.method === "GET" || req.method === "OPTIONS") return true;
    // Skip auth endpoints (they have their own stricter limiter)
    // Use originalUrl since req.path excludes mount path when using app.use("/api", ...)
    if (req.originalUrl.startsWith("/api/auth/")) return true;
    return false;
  },
});

app.use("/api", mutationRateLimiter);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.post("/api/debug-touch", async (req, res) => {
  try {
    await db.execute(sql`INSERT INTO debug_touch_logs (data) VALUES (${JSON.stringify({ ts: Date.now(), ...req.body })}::jsonb)`);
  } catch {}
  res.json({ ok: true });
});
app.get("/api/debug-touch", async (_req, res) => {
  try {
    const rows = await db.execute(sql`SELECT data, created_at FROM debug_touch_logs ORDER BY id DESC LIMIT 50`);
    res.json(rows.rows);
  } catch (e: any) {
    res.json({ error: e.message });
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[ERROR] ${status} - ${message}`, err.stack || err);

    if (res.headersSent) return;

    res.status(status).json({
      message: isProduction && status === 500 ? "Internal Server Error" : message,
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
