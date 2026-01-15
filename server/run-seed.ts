#!/usr/bin/env npx tsx
/**
 * Seed Runner Script - FOR DEVELOPMENT/STAGING ONLY
 * 
 * Usage:
 *   npx tsx server/run-seed.ts              # Run admin + demo seed (India gyms)
 *   npx tsx server/run-seed.ts --reset      # Reset and reseed demo data
 *   npx tsx server/run-seed.ts --admin-only # Only seed admin user (safe for production first-time setup)
 *   npx tsx server/run-seed.ts --usa        # Clear all + seed USA demo gym (Gym 24/7 Birmingham, AL)
 *   npx tsx server/run-seed.ts --usa-reset  # Same as --usa (clear all + reseed USA demo)
 * 
 * WARNING: This script should NEVER be run automatically on production server startup.
 * Production servers start clean - use --admin-only for initial admin setup if needed.
 * 
 * Demo credentials: 
 *   - India demo: All accounts use password "demo123"
 *   - USA demo: All accounts use password "Demo@12345!"
 */

import { seedDemoData, resetDemoData } from "./seed-demo";
import { seedAdminUser } from "./seed-admin";
import { resetAndSeedUSADemo } from "./seed-usa-demo";

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");
  const adminOnly = args.includes("--admin-only");
  const usaDemo = args.includes("--usa") || args.includes("--usa-reset");

  console.log("=== OGym Seed Runner ===\n");
  
  if (process.env.NODE_ENV === "production" && !adminOnly) {
    console.warn("WARNING: Running demo seed in production environment!");
    console.warn("Use --admin-only for production initial setup.\n");
  }
  
  try {
    if (usaDemo) {
      console.log("--usa flag detected, seeding USA demo data...");
      await resetAndSeedUSADemo();
      console.log("\nDone! USA demo data seeded successfully.");
      process.exit(0);
    }
    
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
