import { seedPerfectDemoData, resetPerfectDemoData } from "./seed-perfect-demo";
import { seedAdminUser } from "./seed-admin";

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");
  
  try {
    if (shouldReset) {
      console.log("Resetting perfect demo data...");
      await resetPerfectDemoData();
    }
    
    console.log("Seeding admin user...");
    await seedAdminUser();
    
    console.log("Seeding perfect demo data...");
    await seedPerfectDemoData();
    
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
