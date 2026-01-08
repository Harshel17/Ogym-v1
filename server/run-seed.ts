#!/usr/bin/env npx tsx
/**
 * Seed Runner Script - FOR DEVELOPMENT/STAGING ONLY
 * 
 * Usage:
 *   npx tsx server/run-seed.ts              # Run admin + demo seed
 *   npx tsx server/run-seed.ts --reset      # Reset and reseed demo data
 *   npx tsx server/run-seed.ts --admin-only # Only seed admin user (safe for production first-time setup)
 * 
 * WARNING: This script should NEVER be run automatically on production server startup.
 * Production servers start clean - use --admin-only for initial admin setup if needed.
 * 
 * Demo credentials: All demo accounts use password "demo123"
 */

import { seedDemoData, resetDemoData } from "./seed-demo";
import { seedAdminUser } from "./seed-admin";

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");
  const adminOnly = args.includes("--admin-only");

  console.log("=== OGym Seed Runner ===\n");
  
  if (process.env.NODE_ENV === "production" && !adminOnly) {
    console.warn("WARNING: Running demo seed in production environment!");
    console.warn("Use --admin-only for production initial setup.\n");
  }
  
  try {
    console.log("Seeding admin user...");
    await seedAdminUser();
    console.log("Admin user ready.\n");
    
    if (adminOnly) {
      console.log("--admin-only flag set, skipping demo data.");
      console.log("Done!");
      process.exit(0);
    }
    
    if (shouldReset) {
      console.log("--reset flag detected, resetting demo data...");
      await resetDemoData();
      console.log("Demo data reset complete.\n");
    }
    
    console.log("Seeding demo data (this may take a few minutes)...");
    await seedDemoData();
    
    console.log("\nDone! Demo data seeded successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
