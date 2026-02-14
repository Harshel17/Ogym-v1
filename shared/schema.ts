import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const gyms = pgTable("gyms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country").default("India"),
  currency: text("currency", { enum: ["INR", "USD"] }).default("INR"),
  timezone: text("timezone").default("Asia/Kolkata"),
  timings: text("timings"),
  gymType: text("gym_type", { enum: ["men", "women", "unisex"] }),
  facilities: text("facilities"),
  onboardingData: jsonb("onboarding_data"),
  paymentLinks: jsonb("payment_links"), // Stores payment methods: { upi, venmo, cashapp, zelle, paypal, bankDetails, customLink }
  dayPassPrice: integer("day_pass_price"), // Price in smallest unit (paise/cents)
  ownerUserId: integer("owner_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gymRequests = pgTable("gym_requests", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").references(() => users.id).notNull(),
  gymName: text("gym_name").notNull(),
  phone: text("phone"),
  address: text("address"),
  pointOfContactName: text("point_of_contact_name"),
  pointOfContactEmail: text("point_of_contact_email"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("India"),
  currency: text("currency", { enum: ["INR", "USD"] }).default("INR"),
  timezone: text("timezone").default("Asia/Kolkata"),
  gymSize: text("gym_size", { enum: ["0-50", "51-150", "151-300", "300+"] }).notNull(),
  trainerCount: integer("trainer_count").notNull().default(0),
  preferredStart: text("preferred_start", { enum: ["immediately", "next_week", "next_month"] }).notNull(),
  referralSource: text("referral_source", { enum: ["friend", "instagram", "direct_visit", "other"] }).notNull(),
  referralOtherText: text("referral_other_text"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const joinRequests = pgTable("join_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => ({
  uniquePendingRequest: uniqueIndex("unique_pending_join_request").on(table.userId, table.gymId),
}));

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  publicId: text("public_id").unique(),
  gymId: integer("gym_id").references(() => gyms.id),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["owner", "trainer", "member"] }).notNull(),
  isAdmin: boolean("is_admin").default(false),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false),
  verificationCode: text("verification_code"),
  verificationExpiresAt: timestamp("verification_expires_at"),
  phone: text("phone"),
  autoPostEnabled: boolean("auto_post_enabled").default(true),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  hideDika: boolean("hide_dika").default(false),
  dikaIconPreference: text("dika_icon_preference").default("circle"),
  trainingMode: text("training_mode", { enum: ["trainer_led", "self_guided"] }).default("trainer_led"),
  healthConnected: boolean("health_connected").default(false),
  healthSource: text("health_source", { enum: ["apple_health", "google_fit"] }),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Profiles (extended profile data for members)
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  gender: text("gender", { enum: ["male", "female", "prefer_not_to_say"] }).notNull(),
  dob: text("dob").notNull(),
  age: integer("age"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetCodes = pgTable("password_reset_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetCodeSchema = createInsertSchema(passwordResetCodes).omit({ id: true, createdAt: true });

export const gymSubscriptions = pgTable("gym_subscriptions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull().unique(),
  planType: text("plan_type", { enum: ["1_month", "3_month", "6_month", "custom"] }).notNull().default("1_month"),
  amountPaid: integer("amount_paid").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "overdue"] }).notNull().default("pending"),
  paidOn: timestamp("paid_on"),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainerMembers = pgTable("trainer_members", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
}, (table) => ({
  uniqueMemberPerGym: uniqueIndex("unique_member_per_gym").on(table.gymId, table.memberId),
}));

export const trainerMemberAssignments = pgTable("trainer_member_assignments", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  endReason: text("end_reason", { enum: ["trainer_transfer", "member_transfer", "reassignment", "trainer_left_gym", "manual"] }),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  markedByUserId: integer("marked_by_user_id").references(() => users.id).notNull(),
  date: text("date").notNull(),
  status: text("status", { enum: ["present", "absent"] }).notNull(),
  verifiedMethod: text("verified_method", { enum: ["qr", "workout", "both", "manual", "admin_adjustment"] }).default("manual"),
  adjustedByAdminId: integer("adjusted_by_admin_id").references(() => users.id),
  adjustmentReason: text("adjustment_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => ({
  gymDateIdx: index("attendance_gym_date_idx").on(table.gymId, table.date),
  memberDateIdx: index("attendance_member_date_idx").on(table.memberId, table.date),
}));

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  month: text("month").notNull(),
  amountDue: integer("amount_due").notNull(),
  amountPaid: integer("amount_paid").default(0),
  status: text("status", { enum: ["paid", "unpaid", "partial"] }).notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "venmo", "zelle", "cashapp", "card", "bank_transfer", "other"] }),
  note: text("note"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  gymUpdatedAtIdx: index("payments_gym_updated_at_idx").on(table.gymId, table.updatedAt),
}));

export const workoutCycles = pgTable("workout_cycles", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id),
  trainerId: integer("trainer_id").references(() => users.id),
  memberId: integer("member_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  cycleLength: integer("cycle_length").notNull().default(3),
  dayLabels: text("day_labels").array(),
  restDays: integer("rest_days").array(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  progressionMode: text("progression_mode", { enum: ["calendar", "completion"] }).default("calendar"),
  currentDayIndex: integer("current_day_index").default(0),
  lastWorkoutDate: text("last_workout_date"),
  isActive: boolean("is_active").default(true),
  source: text("source", { enum: ["trainer", "self"] }).default("trainer"),
  phaseNumber: integer("phase_number").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workoutItems = pgTable("workout_items", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id).notNull(),
  dayIndex: integer("day_index").notNull(),
  muscleType: text("muscle_type").notNull().default("Chest"),
  bodyPart: text("body_part").notNull().default("Upper Body"),
  exerciseName: text("exercise_name").notNull(),
  exerciseType: text("exercise_type").notNull().default("strength"), // 'strength' or 'cardio'
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  weight: text("weight"),
  durationMinutes: integer("duration_minutes"), // For cardio exercises
  distanceKm: text("distance_km"), // For cardio exercises (text to allow "5km", "3.2mi" etc)
  orderIndex: integer("order_index").default(0),
  isDeleted: boolean("is_deleted").default(false),
  sportProgramId: integer("sport_program_id"),
});

export const workoutCompletions = pgTable("workout_completions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id),
  cycleId: integer("cycle_id"),
  workoutItemId: integer("workout_item_id").references(() => workoutItems.id),
  phaseExerciseId: integer("phase_exercise_id").references(() => phaseExercises.id),
  memberId: integer("member_id").references(() => users.id).notNull(),
  completedDate: text("completed_date").notNull(),
  exerciseName: text("exercise_name"),
  exerciseType: text("exercise_type").default("strength"), // 'strength' or 'cardio'
  actualSets: integer("actual_sets"),
  actualReps: integer("actual_reps"),
  actualWeight: text("actual_weight"),
  actualDurationMinutes: integer("actual_duration_minutes"), // For cardio
  actualDistanceKm: text("actual_distance_km"), // For cardio
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  memberDateIdx: index("workout_completions_member_date_idx").on(table.memberId, table.completedDate),
  gymDateIdx: index("workout_completions_gym_date_idx").on(table.gymId, table.completedDate),
}));

// Per-set targets for workout items (trainer defines different reps/weight per set)
export const workoutPlanSets = pgTable("workout_plan_sets", {
  id: serial("id").primaryKey(),
  workoutItemId: integer("workout_item_id").references(() => workoutItems.id).notNull(),
  setNumber: integer("set_number").notNull(), // 1, 2, 3, etc.
  targetReps: integer("target_reps").notNull(),
  targetWeight: text("target_weight"), // e.g., "10kg", "bodyweight"
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workout session log (one per member per date)
export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id), // Nullable for Personal Mode users
  memberId: integer("member_id").references(() => users.id).notNull(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id),
  dayIndex: integer("day_index").notNull(),
  completedDate: text("completed_date").notNull(), // YYYY-MM-DD
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Exercises within a workout log (immutable history)
export const workoutLogExercises = pgTable("workout_log_exercises", {
  id: serial("id").primaryKey(),
  workoutLogId: integer("workout_log_id").references(() => workoutLogs.id).notNull(),
  workoutItemId: integer("workout_item_id").references(() => workoutItems.id), // Reference to plan exercise
  exerciseName: text("exercise_name").notNull(),
  muscleType: text("muscle_type"),
  bodyPart: text("body_part"),
  orderIndex: integer("order_index").default(0),
  gymId: integer("gym_id").references(() => gyms.id), // Keep to match production
});

// Per-set actuals logged by member (immutable history)
export const workoutLogSets = pgTable("workout_log_sets", {
  id: serial("id").primaryKey(),
  logExerciseId: integer("log_exercise_id").references(() => workoutLogExercises.id).notNull(),
  setNumber: integer("set_number").notNull(),
  targetReps: integer("target_reps"), // Snapshot of plan target at time of logging
  targetWeight: text("target_weight"), // Snapshot of plan target at time of logging
  actualReps: integer("actual_reps"),
  actualWeight: text("actual_weight"),
  completed: boolean("completed").default(false),
  gymId: integer("gym_id").references(() => gyms.id), // Keep to match production
});

export const memberRestDaySwaps = pgTable("member_rest_day_swaps", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id), // Nullable for Personal Mode
  memberId: integer("member_id").references(() => users.id).notNull(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id).notNull(),
  swapDate: text("swap_date").notNull(),
  targetDate: text("target_date").notNull(),
  targetDayIndex: integer("target_day_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cycle day action logs - tracks rest/train/reschedule decisions for both modes
export const cycleDayActions = pgTable("cycle_day_actions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id), // Nullable for Personal Mode
  memberId: integer("member_id").references(() => users.id).notNull(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  action: text("action", { enum: ["rest", "train_anyway", "reschedule", "complete", "extra"] }).notNull(),
  originalDayIndex: integer("original_day_index"), // The day that was scheduled
  performedDayIndex: integer("performed_day_index"), // The day that was actually done (for train_anyway)
  targetDate: text("target_date"), // For reschedule: the date workout moved to
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  memberDateIdx: index("cycle_day_actions_member_date_idx").on(table.memberId, table.date),
  cycleIdx: index("cycle_day_actions_cycle_idx").on(table.cycleId),
}));

// Cycle schedule overrides - stores SWAP/PUSH reordering for "Do Another Workout"
// For completion-based: stores the new day order for remaining workouts
// For calendar-based: stores date-to-dayIndex mappings for the current cycle window
export const cycleScheduleOverrides = pgTable("cycle_schedule_overrides", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id), // Nullable for Personal Mode
  memberId: integer("member_id").references(() => users.id).notNull(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD - the date this override applies to
  dayIndex: integer("day_index").notNull(), // The workout day index to show on this date
  action: text("action", { enum: ["swap", "push"] }).notNull(), // How this override was created
  originalDayIndex: integer("original_day_index"), // What was originally scheduled
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
}, (table) => ({
  memberCycleDateIdx: index("cycle_schedule_overrides_member_cycle_date_idx").on(table.memberId, table.cycleId, table.date),
  cycleIdx: index("cycle_schedule_overrides_cycle_idx").on(table.cycleId),
}));

export const memberRequests = pgTable("member_requests", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id),
  type: text("type", { enum: ["feedback", "change_request", "question"] }).notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["pending", "read", "resolved"] }).default("pending"),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gymHistory = pgTable("gym_history", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
});

export const starMembers = pgTable("star_members", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueStarMember: uniqueIndex("unique_star_member").on(table.trainerId, table.memberId),
}));

export const dietPlans = pgTable("diet_plans", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  durationWeeks: integer("duration_weeks").default(4),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dietPlanMeals = pgTable("diet_plan_meals", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => dietPlans.id).notNull(),
  dayIndex: integer("day_index").notNull(),
  mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
  description: text("description").notNull(),
  calories: integer("calories"),
  protein: integer("protein"),
  orderIndex: integer("order_index").default(0),
});

// === TRAINING PHASES ===
export const trainingPhases = pgTable("training_phases", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id),
  name: text("name").notNull(),
  goalType: text("goal_type", { enum: ["cut", "bulk", "strength", "endurance", "rehab", "general"] }).notNull().default("general"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id),
  dietPlanId: integer("diet_plan_id").references(() => dietPlans.id),
  autoAssignCycle: boolean("auto_assign_cycle").default(false),
  useCustomExercises: boolean("use_custom_exercises").default(false),
  cycleLength: integer("cycle_length").default(3),
  dayLabels: text("day_labels").array(),
  restDays: integer("rest_days").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const phaseExercises = pgTable("phase_exercises", {
  id: serial("id").primaryKey(),
  phaseId: integer("phase_id").references(() => trainingPhases.id).notNull(),
  dayIndex: integer("day_index").notNull(),
  muscleType: text("muscle_type").notNull().default("Chest"),
  bodyPart: text("body_part").notNull().default("Upper Body"),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  weight: text("weight"),
  orderIndex: integer("order_index").default(0),
});

export const transferRequests = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  fromGymId: integer("from_gym_id").references(() => gyms.id).notNull(),
  toGymId: integer("to_gym_id").references(() => gyms.id).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "cancelled"] }).default("pending"),
  approvedByFromOwner: boolean("approved_by_from_owner").default(false),
  approvedByToOwner: boolean("approved_by_to_owner").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience", { enum: ["members", "trainers", "everyone"] }).notNull(),
  createdByOwnerId: integer("created_by_owner_id").references(() => users.id).notNull(),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  emailEnabled: boolean("email_enabled").default(false),
  smsEnabled: boolean("sms_enabled").default(false),
});

export const announcementReads = pgTable("announcement_reads", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").references(() => announcements.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  readAt: timestamp("read_at").defaultNow(),
}, (table) => ({
  uniqueRead: uniqueIndex("unique_announcement_read").on(table.announcementId, table.userId),
}));

// === WORKOUT SESSIONS (Session-level tracking for stats) ===

export const workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id), // Nullable for Personal Mode users
  memberId: integer("member_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  cycleId: integer("cycle_id").references(() => workoutCycles.id),
  cycleDayIndex: integer("cycle_day_index"),
  focusLabel: text("focus_label").notNull(), // e.g., "Chest", "Back + Shoulders"
  notes: text("notes"),
  isManuallyCompleted: boolean("is_manually_completed").default(false), // User clicked "Mark Day Done"
  completedAt: timestamp("completed_at"), // When marked done (null if not completed)
  isDeleted: boolean("is_deleted").default(false),
  deletedByAdminId: integer("deleted_by_admin_id").references(() => users.id),
  deletedReason: text("deleted_reason"),
  adjustedByAdminId: integer("adjusted_by_admin_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const workoutSessionExercises = pgTable("workout_session_exercises", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => workoutSessions.id).notNull(),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: text("weight"),
  duration: integer("duration"),
  notes: text("notes"),
  orderIndex: integer("order_index").default(0),
  isDeleted: boolean("is_deleted").default(false),
  adjustedByAdminId: integer("adjusted_by_admin_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// === MEMBERSHIP & SUBSCRIPTION TABLES (INR-based, amounts in paise) ===

export const membershipPlans = pgTable("membership_plans", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  name: text("name").notNull(),
  durationMonths: integer("duration_months").notNull(),
  priceAmount: integer("price_amount").notNull(), // in paise (100 paise = 1 rupee)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberSubscriptions = pgTable("member_subscriptions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  planId: integer("plan_id").references(() => membershipPlans.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalAmount: integer("total_amount").notNull(), // in paise
  status: text("status", { enum: ["active", "endingSoon", "overdue", "ended"] }).notNull().default("active"),
  paymentMode: text("payment_mode", { enum: ["full", "partial", "emi"] }).notNull().default("full"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => memberSubscriptions.id).notNull(),
  paidOn: text("paid_on").notNull(),
  amountPaid: integer("amount_paid").notNull(), // in paise
  method: text("method", { enum: ["cash", "upi", "card", "bank", "venmo", "cashapp", "zelle", "paypal", "other"] }).notNull(),
  referenceNote: text("reference_note"),
  source: text("source", { enum: ["owner", "member"] }).default("owner"), // "owner" = entered by owner, "member" = member self-payment
  createdAt: timestamp("created_at").defaultNow(),
});

// === BODY MEASUREMENTS ===

export const bodyMeasurements = pgTable("body_measurements", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id),
  memberId: integer("member_id").references(() => users.id).notNull(),
  recordedDate: text("recorded_date").notNull(),
  weight: integer("weight"),
  height: integer("height"),
  bodyFat: integer("body_fat"),
  chest: integer("chest"),
  waist: integer("waist"),
  hips: integer("hips"),
  biceps: integer("biceps"),
  thighs: integer("thighs"),
  notes: text("notes"),
  isInitial: boolean("is_initial").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// === WORKOUT TEMPLATES ===

export const workoutTemplates = pgTable("workout_templates", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  daysPerCycle: integer("days_per_cycle").notNull().default(3),
  dayLabels: text("day_labels").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workoutTemplateItems = pgTable("workout_template_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => workoutTemplates.id).notNull(),
  dayIndex: integer("day_index").notNull(),
  muscleType: text("muscle_type").notNull().default("Chest"),
  bodyPart: text("body_part").notNull().default("Upper Body"),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  weight: text("weight"),
  orderIndex: integer("order_index").default(0),
});

// === SOCIAL FEED ===

export const feedPosts = pgTable("feed_posts", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["workout_complete", "streak_milestone", "new_member", "achievement", "manual"] }).notNull(),
  content: text("content"),
  metadata: text("metadata"), // JSON string for additional data (exercise count, streak days, etc.)
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  gymCreatedAtIdx: index("feed_posts_gym_created_at_idx").on(table.gymId, table.createdAt),
}));

export const feedReactions = pgTable("feed_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reactionType: text("reaction_type", { enum: ["like", "fire", "muscle", "clap"] }).notNull().default("like"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueReaction: uniqueIndex("unique_feed_reaction").on(table.postId, table.userId),
}));

export const feedComments = pgTable("feed_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// === GYM TOURNAMENTS ===

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  metricType: text("metric_type", { enum: ["workout_count", "streak_days", "total_exercises", "attendance_days"] }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status", { enum: ["upcoming", "active", "completed", "cancelled"] }).notNull().default("upcoming"),
  prizeDescription: text("prize_description"),
  maxParticipants: integer("max_participants"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournamentParticipants = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  currentScore: integer("current_score").default(0),
  rank: integer("rank"),
}, (table) => ({
  uniqueParticipant: uniqueIndex("unique_tournament_participant").on(table.tournamentId, table.userId),
}));

// === MEMBER NOTES ===

export const memberNotes = pgTable("member_notes", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const gymsRelations = relations(gyms, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  gym: one(gyms, {
    fields: [users.gymId],
    references: [gyms.id],
  }),
}));

// === SUPPORT SYSTEM TABLES ===

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  userRole: text("user_role", { enum: ["owner", "trainer", "member"] }),
  gymId: integer("gym_id").references(() => gyms.id),
  contactEmailOrPhone: text("contact_email_or_phone").notNull(),
  issueType: text("issue_type", { 
    enum: ["login", "otp", "password", "gym_code", "attendance", "payments", "profile_update", "trainer_assignment", "bug_report", "workout", "nutrition", "account", "subscription", "other"] 
  }).notNull(),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  description: text("description").notNull(),
  attachmentUrl: text("attachment_url"),
  status: text("status", { enum: ["open", "in_progress", "waiting_user", "closed"] }).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id).notNull(),
  senderType: text("sender_type", { enum: ["user", "admin"] }).notNull(),
  senderId: integer("sender_id"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const walkInVisitors = pgTable("walk_in_visitors", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  visitorName: text("name").notNull(),
  phone: text("phone"),
  city: text("city"),
  email: text("email"),
  visitDate: text("visit_date").notNull(),
  visitType: text("visit_type", { enum: ["day_pass", "trial", "enquiry"] }).notNull().default("day_pass"),
  daysCount: integer("days_count").default(1),
  amountPaid: integer("amount_paid").default(0),
  paymentMethod: text("payment_method"),
  paymentScreenshot: text("payment_screenshot"),
  checkinCode: text("checkin_code"),
  codeExpiresAt: timestamp("code_expires_at"),
  paymentVerified: boolean("payment_verified").default(false),
  notes: text("notes"),
  source: text("source", { enum: ["owner", "trainer", "kiosk"] }).notNull().default("owner"),
  convertedToMember: boolean("converted_to_member").default(false),
  convertedUserId: integer("converted_user_id").references(() => users.id),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  kioskSessionId: integer("kiosk_session_id"),
  // Follow-up tracking
  followUpStatus: text("follow_up_status", { enum: ["pending", "contacted", "follow_up_scheduled", "converted", "not_interested"] }).default("pending"),
  followUpNotes: text("follow_up_notes"),
  followUpDate: timestamp("follow_up_date"),
  followUpByUserId: integer("follow_up_by_user_id").references(() => users.id),
  // Enhanced follow-up features
  priority: text("priority", { enum: ["hot", "warm", "cold"] }).default("warm"),
  tags: text("tags").array(),
  assignedTrainerId: integer("assigned_trainer_id").references(() => users.id),
  scheduledFollowUpDate: timestamp("scheduled_follow_up_date"),
  interactionHistory: jsonb("interaction_history").$type<Array<{
    type: "call" | "whatsapp" | "email" | "visit" | "note";
    content: string;
    timestamp: string;
    byUserId: number;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Kiosk sessions for self check-in QR codes
export const kioskSessions = pgTable("kiosk_sessions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  token: text("token").notNull().unique(),
  label: text("label"),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// OTP codes for kiosk phone verification
export const kioskOtpCodes = pgTable("kiosk_otp_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  kioskSessionId: integer("kiosk_session_id").references(() => kioskSessions.id).notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// === PAYMENT CONFIRMATIONS (member claims payment, owner confirms) ===
export const paymentConfirmations = pgTable("payment_confirmations", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id),
  walkInVisitorId: integer("walk_in_visitor_id").references(() => walkInVisitors.id),
  paymentType: text("payment_type", { enum: ["subscription", "day_pass"] }).notNull(),
  paymentMethod: text("payment_method", { enum: ["upi", "venmo", "cashapp", "zelle", "paypal", "bank_transfer", "cash", "other"] }).notNull(),
  amount: integer("amount").notNull(),
  referenceNote: text("reference_note"),
  status: text("status", { enum: ["pending", "confirmed", "rejected"] }).notNull().default("pending"),
  confirmedByUserId: integer("confirmed_by_user_id").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  subscriptionId: integer("subscription_id").references(() => memberSubscriptions.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === GYM EMAIL SETTINGS ===
export const gymEmailSettings = pgTable("gym_email_settings", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull().unique(),
  sendMode: text("send_mode", { enum: ["ogym", "custom"] }).notNull().default("ogym"),
  replyToEmail: text("reply_to_email"),
  connectedProvider: text("connected_provider", { enum: ["gmail", "outlook"] }),
  connectedEmail: text("connected_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === AUTOMATED EMAIL REMINDERS ===
export const automatedEmailReminders = pgTable("automated_email_reminders", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => memberSubscriptions.id),
  reminderType: text("reminder_type", { enum: ["expiry_7_days", "expiry_3_days", "expiry_1_day", "expired"] }).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  emailTo: text("email_to").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull().default("sent"),
  errorMessage: text("error_message"),
});

// === WEEKLY OWNER SUMMARIES ===
export const weeklyOwnerSummaries = pgTable("weekly_owner_summaries", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  ownerUserId: integer("owner_user_id").references(() => users.id).notNull(),
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD
  weekEndDate: text("week_end_date").notNull(),
  summaryData: jsonb("summary_data"), // Stores the summary stats
  sentAt: timestamp("sent_at").defaultNow(),
  emailTo: text("email_to").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull().default("sent"),
  errorMessage: text("error_message"),
});

// === CALORIE TRACKING ===

export const calorieGoals = pgTable("calorie_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  dailyCalorieTarget: integer("daily_calorie_target").notNull(),
  dailyProteinTarget: integer("daily_protein_target"), // in grams
  dailyCarbsTarget: integer("daily_carbs_target"), // in grams
  dailyFatTarget: integer("daily_fat_target"), // in grams
  goalType: text("goal_type", { enum: ["lose", "maintain", "gain"] }).default("maintain"),
  setBy: text("set_by", { enum: ["trainer", "self"] }).default("self"), // Who set this target
  setByUserId: integer("set_by_user_id").references(() => users.id), // Trainer who set it (if trainer)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("calorie_goals_user_idx").on(table.userId),
}));

export const foodLogs = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner", "snack", "extra", "protein"] }).notNull(),
  mealLabel: text("meal_label"), // custom label for "extra" meal type
  foodName: text("food_name").notNull(),
  brandName: text("brand_name"),
  servingSize: text("serving_size"), // e.g., "100g", "1 cup"
  servingQuantity: integer("serving_quantity").default(1),
  calories: integer("calories").notNull(),
  protein: integer("protein"), // in grams
  carbs: integer("carbs"), // in grams
  fat: integer("fat"), // in grams
  fiber: integer("fiber"), // in grams
  barcode: text("barcode"), // for quick re-logging
  isEstimate: boolean("is_estimate").default(true),
  sourceType: text("source_type", { enum: ["branded_database", "generic_database", "curated_database", "ai_estimated", "manual"] }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userDateIdx: index("food_logs_user_date_idx").on(table.userId, table.date),
  barcodeIdx: index("food_logs_barcode_idx").on(table.barcode),
}));

// Water intake tracking
export const waterLogs = pgTable("water_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(),
  amountOz: integer("amount_oz").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userDateIdx: index("water_logs_user_date_idx").on(table.userId, table.date),
}));

export const insertWaterLogSchema = createInsertSchema(waterLogs).omit({ id: true, createdAt: true });

export const weeklyReports = pgTable("weekly_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gymId: integer("gym_id").references(() => gyms.id),
  token: text("token").notNull().unique(),
  rangeStart: text("range_start").notNull(),
  rangeEnd: text("range_end").notNull(),
  reportData: jsonb("report_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex("weekly_reports_token_idx").on(table.token),
  userIdx: index("weekly_reports_user_idx").on(table.userId),
}));

export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true, createdAt: true });

export const dikaConversations = pgTable("dika_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  messages: jsonb("messages").notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex("dika_conversations_user_idx").on(table.userId),
}));

// Health data from fitness devices (Apple Health, Google Fit)
export const healthData = pgTable("health_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  
  // Activity metrics
  steps: integer("steps"),
  caloriesBurned: integer("calories_burned"), // Total daily burn including BMR
  activeCalories: integer("active_calories"), // Exercise/activity only
  activeMinutes: integer("active_minutes"),
  distanceMeters: integer("distance_meters"), // Walking/running distance
  
  // Heart rate
  restingHeartRate: integer("resting_heart_rate"),
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  
  // Sleep
  sleepMinutes: integer("sleep_minutes"),
  sleepQuality: text("sleep_quality", { enum: ["poor", "fair", "good", "excellent"] }),
  
  // Workouts auto-detected by watch
  watchWorkouts: jsonb("watch_workouts"), // [{type: 'running', duration: 30, calories: 250}]
  
  // Meta
  source: text("source", { enum: ["apple_health", "google_fit"] }).notNull(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userDateIdx: index("health_data_user_date_idx").on(table.userId, table.date),
  userDateUnique: uniqueIndex("health_data_user_date_unique").on(table.userId, table.date),
}));

// Post Reports (UGC moderation for App Store compliance)
export const postReports = pgTable("post_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id).notNull(),
  reporterId: integer("reporter_id").references(() => users.id).notNull(),
  reason: text("reason", { enum: ["inappropriate", "spam", "harassment", "other"] }).notNull(),
  description: text("description"),
  status: text("status", { enum: ["pending", "reviewed", "dismissed"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Blocks (UGC moderation for App Store compliance)
export const userBlocks = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").references(() => users.id).notNull(),
  blockedUserId: integer("blocked_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueBlock: uniqueIndex("unique_user_block").on(table.blockerId, table.blockedUserId),
}));

export const insertPostReportSchema = createInsertSchema(postReports).omit({ id: true, createdAt: true, status: true });
export type PostReport = typeof postReports.$inferSelect;
export type InsertPostReport = typeof postReports.$inferInsert;

export const insertUserBlockSchema = createInsertSchema(userBlocks).omit({ id: true, createdAt: true });
export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = typeof userBlocks.$inferInsert;

// === SCHEMAS ===

export const insertCalorieGoalSchema = createInsertSchema(calorieGoals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFoodLogSchema = createInsertSchema(foodLogs).omit({ id: true, createdAt: true });
export const insertHealthDataSchema = createInsertSchema(healthData).omit({ id: true, createdAt: true, lastSyncedAt: true });

export const insertGymEmailSettingsSchema = createInsertSchema(gymEmailSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGymSchema = createInsertSchema(gyms).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, onboardingCompleted: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGymRequestSchema = createInsertSchema(gymRequests).omit({ id: true, createdAt: true, reviewedAt: true, status: true, adminNotes: true });
export const insertJoinRequestSchema = createInsertSchema(joinRequests).omit({ id: true, createdAt: true, reviewedAt: true, status: true });
export const insertTrainerMemberSchema = createInsertSchema(trainerMembers).omit({ id: true });
export const insertTrainerMemberAssignmentSchema = createInsertSchema(trainerMemberAssignments).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, updatedAt: true });
export const insertWorkoutCycleSchema = createInsertSchema(workoutCycles).omit({ id: true, createdAt: true });
export const insertWorkoutItemSchema = createInsertSchema(workoutItems).omit({ id: true });
export const insertWorkoutCompletionSchema = createInsertSchema(workoutCompletions).omit({ id: true, createdAt: true });
export const insertWorkoutPlanSetSchema = createInsertSchema(workoutPlanSets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({ id: true, createdAt: true });
export const insertWorkoutLogExerciseSchema = createInsertSchema(workoutLogExercises).omit({ id: true });
export const insertWorkoutLogSetSchema = createInsertSchema(workoutLogSets).omit({ id: true });
export const insertMemberRestDaySwapSchema = createInsertSchema(memberRestDaySwaps).omit({ id: true, createdAt: true });
export const insertCycleDayActionSchema = createInsertSchema(cycleDayActions).omit({ id: true, createdAt: true });
export const insertCycleScheduleOverrideSchema = createInsertSchema(cycleScheduleOverrides).omit({ id: true, createdAt: true });
export const insertMemberRequestSchema = createInsertSchema(memberRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGymHistorySchema = createInsertSchema(gymHistory).omit({ id: true });
export const insertStarMemberSchema = createInsertSchema(starMembers).omit({ id: true, createdAt: true });
export const insertDietPlanSchema = createInsertSchema(dietPlans).omit({ id: true, createdAt: true });
export const insertDietPlanMealSchema = createInsertSchema(dietPlanMeals).omit({ id: true });
export const insertTrainingPhaseSchema = createInsertSchema(trainingPhases).omit({ id: true, createdAt: true });
export const insertPhaseExerciseSchema = createInsertSchema(phaseExercises).omit({ id: true });
export const insertTransferRequestSchema = createInsertSchema(transferRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true, isDeleted: true });
export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({ id: true });
export const insertAnnouncementReadSchema = createInsertSchema(announcementReads).omit({ id: true, readAt: true });
export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({ id: true, createdAt: true });
export const insertMemberSubscriptionSchema = createInsertSchema(memberSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true });
export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({ id: true, createdAt: true });
export const insertWorkoutSessionExerciseSchema = createInsertSchema(workoutSessionExercises).omit({ id: true, createdAt: true });
export const insertGymSubscriptionSchema = createInsertSchema(gymSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurements).omit({ id: true, createdAt: true });
export const insertWorkoutTemplateSchema = createInsertSchema(workoutTemplates).omit({ id: true, createdAt: true });
export const insertWorkoutTemplateItemSchema = createInsertSchema(workoutTemplateItems).omit({ id: true });
export const insertMemberNoteSchema = createInsertSchema(memberNotes).omit({ id: true, createdAt: true });
export const insertFeedPostSchema = createInsertSchema(feedPosts).omit({ id: true, createdAt: true });
export const insertFeedReactionSchema = createInsertSchema(feedReactions).omit({ id: true, createdAt: true });
export const insertFeedCommentSchema = createInsertSchema(feedComments).omit({ id: true, createdAt: true });
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true });
export const insertTournamentParticipantSchema = createInsertSchema(tournamentParticipants).omit({ id: true, joinedAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertWalkInVisitorSchema = createInsertSchema(walkInVisitors).omit({ id: true, createdAt: true, convertedToMember: true, convertedUserId: true });
export const insertKioskSessionSchema = createInsertSchema(kioskSessions).omit({ id: true, createdAt: true });
export const insertKioskOtpCodeSchema = createInsertSchema(kioskOtpCodes).omit({ id: true, createdAt: true });
export const insertPaymentConfirmationSchema = createInsertSchema(paymentConfirmations).omit({ id: true, createdAt: true, confirmedAt: true, confirmedByUserId: true });
export const insertAutomatedEmailReminderSchema = createInsertSchema(automatedEmailReminders).omit({ id: true, sentAt: true });
export const insertWeeklyOwnerSummarySchema = createInsertSchema(weeklyOwnerSummaries).omit({ id: true, sentAt: true });

// === SPORTS MODE ===

export const sportProfiles = pgTable("sport_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sport: text("sport").notNull(),
  role: text("role").notNull(),
  fitnessScore: integer("fitness_score"),
  testAnswers: jsonb("test_answers"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("sport_profiles_user_idx").on(table.userId),
}));

export const sportPrograms = pgTable("sport_programs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sportProfileId: integer("sport_profile_id").references(() => sportProfiles.id).notNull(),
  sport: text("sport").notNull(),
  role: text("role").notNull(),
  skillCategory: text("skill_category").notNull(),
  skillName: text("skill_name").notNull(),
  aiAnalysis: jsonb("ai_analysis"),
  programPlan: jsonb("program_plan"),
  priority: integer("priority").default(100),
  replacedItems: jsonb("replaced_items"),
  durationWeeks: integer("duration_weeks").default(3),
  isActive: boolean("is_active").default(true),
  cycleId: integer("cycle_id").references(() => workoutCycles.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("sport_programs_user_idx").on(table.userId),
  profileIdx: index("sport_programs_profile_idx").on(table.sportProfileId),
}));

export const insertSportProfileSchema = createInsertSchema(sportProfiles).omit({ id: true, createdAt: true });
export const insertSportProgramSchema = createInsertSchema(sportPrograms).omit({ id: true, createdAt: true });

export type SportProfile = typeof sportProfiles.$inferSelect;
export type InsertSportProfile = z.infer<typeof insertSportProfileSchema>;
export type SportProgram = typeof sportPrograms.$inferSelect;
export type InsertSportProgram = z.infer<typeof insertSportProgramSchema>;

// === FITNESS GOALS (Dika AI) ===

export const fitnessGoals = pgTable("fitness_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gymId: integer("gym_id").references(() => gyms.id),
  category: text("category", { enum: ["strength", "weight", "body_fat", "consistency", "nutrition", "custom"] }).notNull(),
  title: text("title").notNull(),
  targetValue: integer("target_value"),
  targetUnit: text("target_unit"),
  currentValue: integer("current_value"),
  milestones: text("milestones").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userIdx: index("fitness_goals_user_idx").on(table.userId),
}));

export const insertFitnessGoalSchema = createInsertSchema(fitnessGoals).omit({ id: true, createdAt: true, completedAt: true });

// Payment Links type for gym settings
export const paymentLinksSchema = z.object({
  upi: z.string().optional(),
  venmo: z.string().optional(),
  cashapp: z.string().optional(),
  zelle: z.string().optional(),
  paypal: z.string().optional(),
  bankDetails: z.string().optional(),
  customLink: z.string().optional(),
  customLinkLabel: z.string().optional(),
});
export type PaymentLinks = z.infer<typeof paymentLinksSchema>;

// === EXPLICIT TYPES ===

export type Gym = typeof gyms.$inferSelect;
export type GymRequest = typeof gymRequests.$inferSelect;
export type JoinRequest = typeof joinRequests.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type TrainerMember = typeof trainerMembers.$inferSelect;
export type TrainerMemberAssignment = typeof trainerMemberAssignments.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WorkoutCycle = typeof workoutCycles.$inferSelect;
export type WorkoutItem = typeof workoutItems.$inferSelect;
export type WorkoutCompletion = typeof workoutCompletions.$inferSelect;
export type WorkoutPlanSet = typeof workoutPlanSets.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type WorkoutLogExercise = typeof workoutLogExercises.$inferSelect;
export type WorkoutLogSet = typeof workoutLogSets.$inferSelect;
export type MemberRestDaySwap = typeof memberRestDaySwaps.$inferSelect;
export type CycleDayAction = typeof cycleDayActions.$inferSelect;
export type CycleScheduleOverride = typeof cycleScheduleOverrides.$inferSelect;
export type MemberRequest = typeof memberRequests.$inferSelect;
export type GymHistory = typeof gymHistory.$inferSelect;
export type StarMember = typeof starMembers.$inferSelect;
export type DietPlan = typeof dietPlans.$inferSelect;
export type DietPlanMeal = typeof dietPlanMeals.$inferSelect;
export type TrainingPhase = typeof trainingPhases.$inferSelect;
export type PhaseExercise = typeof phaseExercises.$inferSelect;
export type TransferRequest = typeof transferRequests.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertGym = z.infer<typeof insertGymSchema>;
export type InsertGymRequest = z.infer<typeof insertGymRequestSchema>;
export type InsertJoinRequest = z.infer<typeof insertJoinRequestSchema>;
export type InsertTrainerMemberAssignment = z.infer<typeof insertTrainerMemberAssignmentSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertWorkoutCycle = z.infer<typeof insertWorkoutCycleSchema>;
export type InsertWorkoutItem = z.infer<typeof insertWorkoutItemSchema>;
export type InsertWorkoutCompletion = z.infer<typeof insertWorkoutCompletionSchema>;
export type InsertWorkoutPlanSet = z.infer<typeof insertWorkoutPlanSetSchema>;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type InsertWorkoutLogExercise = z.infer<typeof insertWorkoutLogExerciseSchema>;
export type InsertWorkoutLogSet = z.infer<typeof insertWorkoutLogSetSchema>;
export type InsertMemberRestDaySwap = z.infer<typeof insertMemberRestDaySwapSchema>;
export type InsertCycleDayAction = z.infer<typeof insertCycleDayActionSchema>;
export type InsertCycleScheduleOverride = z.infer<typeof insertCycleScheduleOverrideSchema>;
export type InsertMemberRequest = z.infer<typeof insertMemberRequestSchema>;
export type InsertGymHistory = z.infer<typeof insertGymHistorySchema>;
export type InsertStarMember = z.infer<typeof insertStarMemberSchema>;
export type InsertDietPlan = z.infer<typeof insertDietPlanSchema>;
export type InsertDietPlanMeal = z.infer<typeof insertDietPlanMealSchema>;
export type InsertTrainingPhase = z.infer<typeof insertTrainingPhaseSchema>;
export type InsertPhaseExercise = z.infer<typeof insertPhaseExerciseSchema>;
export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;

export type Announcement = typeof announcements.$inferSelect;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type InsertAnnouncementRead = z.infer<typeof insertAnnouncementReadSchema>;

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type MemberSubscription = typeof memberSubscriptions.$inferSelect;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;
export type InsertMemberSubscription = z.infer<typeof insertMemberSubscriptionSchema>;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type WorkoutSessionExercise = typeof workoutSessionExercises.$inferSelect;
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type InsertWorkoutSessionExercise = z.infer<typeof insertWorkoutSessionExerciseSchema>;

export type GymSubscription = typeof gymSubscriptions.$inferSelect;
export type InsertGymSubscription = z.infer<typeof insertGymSubscriptionSchema>;

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type WorkoutTemplateItem = typeof workoutTemplateItems.$inferSelect;
export type MemberNote = typeof memberNotes.$inferSelect;
export type FeedPost = typeof feedPosts.$inferSelect;
export type FeedReaction = typeof feedReactions.$inferSelect;
export type FeedComment = typeof feedComments.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type InsertBodyMeasurement = z.infer<typeof insertBodyMeasurementSchema>;
export type InsertWorkoutTemplate = z.infer<typeof insertWorkoutTemplateSchema>;
export type InsertWorkoutTemplateItem = z.infer<typeof insertWorkoutTemplateItemSchema>;
export type InsertMemberNote = z.infer<typeof insertMemberNoteSchema>;
export type InsertFeedPost = z.infer<typeof insertFeedPostSchema>;
export type InsertFeedReaction = z.infer<typeof insertFeedReactionSchema>;
export type InsertFeedComment = z.infer<typeof insertFeedCommentSchema>;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type InsertTournamentParticipant = z.infer<typeof insertTournamentParticipantSchema>;

export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;
export type InsertPasswordResetCode = z.infer<typeof insertPasswordResetCodeSchema>;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type WalkInVisitor = typeof walkInVisitors.$inferSelect;
export type InsertWalkInVisitor = z.infer<typeof insertWalkInVisitorSchema>;

export type GymEmailSettings = typeof gymEmailSettings.$inferSelect;
export type InsertGymEmailSettings = z.infer<typeof insertGymEmailSettingsSchema>;

export type KioskSession = typeof kioskSessions.$inferSelect;
export type InsertKioskSession = z.infer<typeof insertKioskSessionSchema>;
export type KioskOtpCode = typeof kioskOtpCodes.$inferSelect;
export type InsertKioskOtpCode = z.infer<typeof insertKioskOtpCodeSchema>;

export type PaymentConfirmation = typeof paymentConfirmations.$inferSelect;
export type InsertPaymentConfirmation = z.infer<typeof insertPaymentConfirmationSchema>;

export type AutomatedEmailReminder = typeof automatedEmailReminders.$inferSelect;
export type InsertAutomatedEmailReminder = z.infer<typeof insertAutomatedEmailReminderSchema>;

export type WeeklyOwnerSummary = typeof weeklyOwnerSummaries.$inferSelect;
export type InsertWeeklyOwnerSummary = z.infer<typeof insertWeeklyOwnerSummarySchema>;

export type CalorieGoal = typeof calorieGoals.$inferSelect;
export type InsertCalorieGoal = z.infer<typeof insertCalorieGoalSchema>;
export type FoodLog = typeof foodLogs.$inferSelect;
export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;

export type HealthData = typeof healthData.$inferSelect;
export type InsertHealthData = z.infer<typeof insertHealthDataSchema>;

export type WaterLog = typeof waterLogs.$inferSelect;
export type InsertWaterLog = z.infer<typeof insertWaterLogSchema>;

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;

export type FitnessGoal = typeof fitnessGoals.$inferSelect;
export type InsertFitnessGoal = z.infer<typeof insertFitnessGoalSchema>;
