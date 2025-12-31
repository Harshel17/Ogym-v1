import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const gyms = pgTable("gyms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["owner", "trainer", "member"] }).notNull(),
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

export const insertGymSchema = createInsertSchema(gyms).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTrainerMemberSchema = createInsertSchema(trainerMembers).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, updatedAt: true });
export const insertWorkoutCycleSchema = createInsertSchema(workoutCycles).omit({ id: true, createdAt: true });
export const insertWorkoutItemSchema = createInsertSchema(workoutItems).omit({ id: true });
export const insertWorkoutCompletionSchema = createInsertSchema(workoutCompletions).omit({ id: true, createdAt: true });
export const insertMemberRequestSchema = createInsertSchema(memberRequests).omit({ id: true, createdAt: true, updatedAt: true });

// === EXPLICIT TYPES ===

export type Gym = typeof gyms.$inferSelect;
export type User = typeof users.$inferSelect;
export type TrainerMember = typeof trainerMembers.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WorkoutCycle = typeof workoutCycles.$inferSelect;
export type WorkoutItem = typeof workoutItems.$inferSelect;
export type WorkoutCompletion = typeof workoutCompletions.$inferSelect;
export type MemberRequest = typeof memberRequests.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertGym = z.infer<typeof insertGymSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertWorkoutCycle = z.infer<typeof insertWorkoutCycleSchema>;
export type InsertWorkoutItem = z.infer<typeof insertWorkoutItemSchema>;
export type InsertWorkoutCompletion = z.infer<typeof insertWorkoutCompletionSchema>;
export type InsertMemberRequest = z.infer<typeof insertMemberRequestSchema>;
