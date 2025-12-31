import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const gyms = pgTable("gyms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // Unique code for members/trainers to join
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
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  markedByUserId: integer("marked_by_user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  status: text("status", { enum: ["present", "absent"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").references(() => gyms.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  month: text("month").notNull(), // YYYY-MM
  amountDue: integer("amount_due").notNull(), // Stored as integer (e.g. cents or whole numbers)
  amountPaid: integer("amount_paid").default(0),
  status: text("status", { enum: ["paid", "unpaid", "partial"] }).notNull(),
  note: text("note"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
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

// === EXPLICIT TYPES ===

export type Gym = typeof gyms.$inferSelect;
export type User = typeof users.$inferSelect;
export type TrainerMember = typeof trainerMembers.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Payment = typeof payments.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertGym = z.infer<typeof insertGymSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
