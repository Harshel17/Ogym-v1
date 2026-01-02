import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trainerMembers = pgTable("trainer_members", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
}, (table) => ({
  uniqueMemberPerGym: uniqueIndex("unique_member_per_gym").on(table.gymId, table.memberId),
}));

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  markedByUserId: integer("marked_by_user_id").references(() => users.id).notNull(),
  date: text("date").notNull(),
  status: text("status", { enum: ["present", "absent"] }).notNull(),
  verifiedMethod: text("verified_method", { enum: ["qr", "workout", "both", "manual"] }).default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  month: text("month").notNull(),
  amountDue: integer("amount_due").notNull(),
  amountPaid: integer("amount_paid").default(0),
  status: text("status", { enum: ["paid", "unpaid", "partial"] }).notNull(),
  note: text("note"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workoutCycles = pgTable("workout_cycles", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  trainerId: integer("trainer_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  cycleLength: integer("cycle_length").notNull().default(3),
  dayLabels: text("day_labels").array(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workoutItems = pgTable("workout_items", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id).notNull(),
  dayIndex: integer("day_index").notNull(),
  muscleType: text("muscle_type").notNull().default("Chest"),
  bodyPart: text("body_part").notNull().default("Upper Body"),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  weight: text("weight"),
  orderIndex: integer("order_index").default(0),
});

export const workoutCompletions = pgTable("workout_completions", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  cycleId: integer("cycle_id").references(() => workoutCycles.id).notNull(),
  workoutItemId: integer("workout_item_id").references(() => workoutItems.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  completedDate: text("completed_date").notNull(),
  actualSets: integer("actual_sets"),
  actualReps: integer("actual_reps"),
  actualWeight: text("actual_weight"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  cycleId: integer("cycle_id").references(() => workoutCycles.id),
  cycleDayIndex: integer("cycle_day_index"),
  focusLabel: text("focus_label").notNull(), // e.g., "Chest", "Back + Shoulders"
  isManuallyCompleted: boolean("is_manually_completed").default(false), // User clicked "Mark Day Done"
  completedAt: timestamp("completed_at"), // When marked done (null if not completed)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueSessionPerDay: uniqueIndex("unique_session_per_member_date_gym").on(table.gymId, table.memberId, table.date),
}));

export const workoutSessionExercises = pgTable("workout_session_exercises", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => workoutSessions.id).notNull(),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: text("weight"),
  notes: text("notes"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
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
  method: text("method", { enum: ["cash", "upi", "card", "bank", "other"] }).notNull(),
  referenceNote: text("reference_note"),
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

// === SCHEMAS ===

export const insertGymSchema = createInsertSchema(gyms).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertGymRequestSchema = createInsertSchema(gymRequests).omit({ id: true, createdAt: true, reviewedAt: true, status: true, adminNotes: true });
export const insertJoinRequestSchema = createInsertSchema(joinRequests).omit({ id: true, createdAt: true, reviewedAt: true, status: true });
export const insertTrainerMemberSchema = createInsertSchema(trainerMembers).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, updatedAt: true });
export const insertWorkoutCycleSchema = createInsertSchema(workoutCycles).omit({ id: true, createdAt: true });
export const insertWorkoutItemSchema = createInsertSchema(workoutItems).omit({ id: true });
export const insertWorkoutCompletionSchema = createInsertSchema(workoutCompletions).omit({ id: true, createdAt: true });
export const insertMemberRequestSchema = createInsertSchema(memberRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGymHistorySchema = createInsertSchema(gymHistory).omit({ id: true });
export const insertStarMemberSchema = createInsertSchema(starMembers).omit({ id: true, createdAt: true });
export const insertDietPlanSchema = createInsertSchema(dietPlans).omit({ id: true, createdAt: true });
export const insertDietPlanMealSchema = createInsertSchema(dietPlanMeals).omit({ id: true });
export const insertTransferRequestSchema = createInsertSchema(transferRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true, isDeleted: true });
export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({ id: true });
export const insertAnnouncementReadSchema = createInsertSchema(announcementReads).omit({ id: true, readAt: true });
export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({ id: true, createdAt: true });
export const insertMemberSubscriptionSchema = createInsertSchema(memberSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true });
export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({ id: true, createdAt: true });
export const insertWorkoutSessionExerciseSchema = createInsertSchema(workoutSessionExercises).omit({ id: true, createdAt: true });

// === EXPLICIT TYPES ===

export type Gym = typeof gyms.$inferSelect;
export type GymRequest = typeof gymRequests.$inferSelect;
export type JoinRequest = typeof joinRequests.$inferSelect;
export type User = typeof users.$inferSelect;
export type TrainerMember = typeof trainerMembers.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WorkoutCycle = typeof workoutCycles.$inferSelect;
export type WorkoutItem = typeof workoutItems.$inferSelect;
export type WorkoutCompletion = typeof workoutCompletions.$inferSelect;
export type MemberRequest = typeof memberRequests.$inferSelect;
export type GymHistory = typeof gymHistory.$inferSelect;
export type StarMember = typeof starMembers.$inferSelect;
export type DietPlan = typeof dietPlans.$inferSelect;
export type DietPlanMeal = typeof dietPlanMeals.$inferSelect;
export type TransferRequest = typeof transferRequests.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertGym = z.infer<typeof insertGymSchema>;
export type InsertGymRequest = z.infer<typeof insertGymRequestSchema>;
export type InsertJoinRequest = z.infer<typeof insertJoinRequestSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertWorkoutCycle = z.infer<typeof insertWorkoutCycleSchema>;
export type InsertWorkoutItem = z.infer<typeof insertWorkoutItemSchema>;
export type InsertWorkoutCompletion = z.infer<typeof insertWorkoutCompletionSchema>;
export type InsertMemberRequest = z.infer<typeof insertMemberRequestSchema>;
export type InsertGymHistory = z.infer<typeof insertGymHistorySchema>;
export type InsertStarMember = z.infer<typeof insertStarMemberSchema>;
export type InsertDietPlan = z.infer<typeof insertDietPlanSchema>;
export type InsertDietPlanMeal = z.infer<typeof insertDietPlanMealSchema>;
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
