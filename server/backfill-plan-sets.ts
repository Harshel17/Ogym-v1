import { db } from "./db";
import { workoutItems, workoutPlanSets } from "@shared/schema";
import { eq, isNull, and, inArray } from "drizzle-orm";

/**
 * Backfill script to create workout_plan_sets entries for existing workout_items.
 * Each existing workout_item will get sets created based on its `sets` count,
 * all with the same reps/weight from the item (uniform sets).
 */
async function backfillPlanSets() {
  console.log("Starting backfill of workout_plan_sets...");

  // Get all non-deleted workout items
  const existingItems = await db
    .select()
    .from(workoutItems)
    .where(eq(workoutItems.isDeleted, false));

  console.log(`Found ${existingItems.length} workout items to process`);

  // Get existing plan sets to avoid duplicates
  const existingPlanSets = await db
    .select({ workoutItemId: workoutPlanSets.workoutItemId })
    .from(workoutPlanSets)
    .where(eq(workoutPlanSets.isDeleted, false));

  const existingItemIds = new Set(existingPlanSets.map(ps => ps.workoutItemId));

  let created = 0;
  let skipped = 0;

  for (const item of existingItems) {
    // Skip if already has plan sets
    if (existingItemIds.has(item.id)) {
      skipped++;
      continue;
    }

    // Create plan sets for each set in the item
    const setsToCreate = [];
    for (let setNum = 1; setNum <= item.sets; setNum++) {
      setsToCreate.push({
        workoutItemId: item.id,
        setNumber: setNum,
        targetReps: item.reps,
        targetWeight: item.weight,
      });
    }

    if (setsToCreate.length > 0) {
      await db.insert(workoutPlanSets).values(setsToCreate);
      created += setsToCreate.length;
    }
  }

  console.log(`Backfill complete: Created ${created} plan sets, skipped ${skipped} items (already had sets)`);
}

// Run if called directly
backfillPlanSets()
  .then(() => {
    console.log("Backfill completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
