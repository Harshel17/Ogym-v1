import { 
  users, gyms, attendance, payments, trainerMembers, workoutCycles, workouts, workoutCompletions,
  type User, type InsertUser, type Gym, type InsertGym,
  type Attendance, type InsertAttendance,
  type Payment, type InsertPayment,
  type TrainerMember,
  type WorkoutCycle, type InsertWorkoutCycle,
  type Workout, type InsertWorkout,
  type WorkoutCompletion, type InsertWorkoutCompletion
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // User & Gym
  getUser(id: number): Promise<(User & { gym: Gym | null }) | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getGym(id: number): Promise<Gym | undefined>;
  getGymByCode(code: string): Promise<Gym | undefined>;
  createGym(gym: InsertGym): Promise<Gym>;
  
  // Relationships
  getGymMembers(gymId: number): Promise<User[]>;
  getGymTrainers(gymId: number): Promise<User[]>;
  assignTrainer(trainerId: number, memberId: number, gymId: number): Promise<TrainerMember>;
  getTrainerMembers(trainerId: number): Promise<TrainerMember[]>;
  
  // Attendance
  getAttendance(gymId: number, memberId?: number, date?: string): Promise<(Attendance & { member: User })[]>;
  markAttendance(data: InsertAttendance): Promise<Attendance>;
  
  // Payments
  getPayments(gymId: number, memberId?: number, month?: string): Promise<(Payment & { member: User })[]>;
  markPayment(data: InsertPayment): Promise<Payment>;
  
  // Workout Cycles
  createWorkoutCycle(data: InsertWorkoutCycle): Promise<WorkoutCycle>;
  getTrainerCycles(trainerId: number): Promise<WorkoutCycle[]>;
  getMemberCycle(memberId: number): Promise<WorkoutCycle | undefined>;
  getCycle(cycleId: number): Promise<WorkoutCycle | undefined>;
  addWorkout(data: InsertWorkout): Promise<Workout>;
  getWorkoutsByCycle(cycleId: number): Promise<Workout[]>;
  getMemberWorkouts(memberId: number): Promise<Workout[]>;
  completeWorkout(data: InsertWorkoutCompletion): Promise<WorkoutCompletion>;
  getCompletions(memberId: number, date: string): Promise<WorkoutCompletion[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<(User & { gym: Gym | null }) | undefined> {
    const result = await db.select().from(users).leftJoin(gyms, eq(users.gymId, gyms.id)).where(eq(users.id, id));
    if (result.length === 0) return undefined;
    const { users: user, gyms: gym } = result[0];
    return { ...user, gym };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getGym(id: number): Promise<Gym | undefined> {
    const [gym] = await db.select().from(gyms).where(eq(gyms.id, id));
    return gym;
  }

  async getGymByCode(code: string): Promise<Gym | undefined> {
    const [gym] = await db.select().from(gyms).where(eq(gyms.code, code));
    return gym;
  }

  async createGym(insertGym: InsertGym): Promise<Gym> {
    const [gym] = await db.insert(gyms).values(insertGym).returning();
    return gym;
  }

  async getGymMembers(gymId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.gymId, gymId), eq(users.role, "member")));
  }

  async getGymTrainers(gymId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.gymId, gymId), eq(users.role, "trainer")));
  }

  async assignTrainer(trainerId: number, memberId: number, gymId: number): Promise<TrainerMember> {
    const [assignment] = await db.insert(trainerMembers).values({
      trainerId, memberId, gymId
    }).returning();
    return assignment;
  }

  async getTrainerMembers(trainerId: number): Promise<TrainerMember[]> {
    return await db.select().from(trainerMembers).where(eq(trainerMembers.trainerId, trainerId));
  }

  async getAttendance(gymId: number, memberId?: number, date?: string): Promise<(Attendance & { member: User })[]> {
    let conditions = [eq(attendance.gymId, gymId)];
    if (memberId) conditions.push(eq(attendance.memberId, memberId));
    if (date) conditions.push(eq(attendance.date, date));

    const result = await db.select({
      attendance: attendance,
      member: users
    })
    .from(attendance)
    .innerJoin(users, eq(attendance.memberId, users.id))
    .where(and(...conditions))
    .orderBy(desc(attendance.date));

    return result.map(r => ({ ...r.attendance, member: r.member }));
  }

  async markAttendance(data: InsertAttendance): Promise<Attendance> {
    const [record] = await db.insert(attendance).values(data).returning();
    return record;
  }

  async getPayments(gymId: number, memberId?: number, month?: string): Promise<(Payment & { member: User })[]> {
    let conditions = [eq(payments.gymId, gymId)];
    if (memberId) conditions.push(eq(payments.memberId, memberId));
    if (month) conditions.push(eq(payments.month, month));

    const result = await db.select({
      payment: payments,
      member: users
    })
    .from(payments)
    .innerJoin(users, eq(payments.memberId, users.id))
    .where(and(...conditions))
    .orderBy(desc(payments.month));

    return result.map(r => ({ ...r.payment, member: r.member }));
  }

  async markPayment(data: InsertPayment): Promise<Payment> {
    const [record] = await db.insert(payments).values(data).returning();
    return record;
  }

  async createWorkoutCycle(data: InsertWorkoutCycle): Promise<WorkoutCycle> {
    const [cycle] = await db.insert(workoutCycles).values(data).returning();
    return cycle;
  }

  async getTrainerCycles(trainerId: number): Promise<WorkoutCycle[]> {
    return await db.select().from(workoutCycles).where(eq(workoutCycles.trainerId, trainerId));
  }

  async getMemberCycle(memberId: number): Promise<WorkoutCycle | undefined> {
    const [cycle] = await db.select().from(workoutCycles).where(eq(workoutCycles.memberId, memberId));
    return cycle;
  }

  async getCycle(cycleId: number): Promise<WorkoutCycle | undefined> {
    const [cycle] = await db.select().from(workoutCycles).where(eq(workoutCycles.id, cycleId));
    return cycle;
  }

  async addWorkout(data: InsertWorkout): Promise<Workout> {
    const [workout] = await db.insert(workouts).values(data).returning();
    return workout;
  }

  async getWorkoutsByCycle(cycleId: number): Promise<Workout[]> {
    return await db.select().from(workouts).where(eq(workouts.cycleId, cycleId));
  }

  async getMemberWorkouts(memberId: number): Promise<Workout[]> {
    const cycle = await this.getMemberCycle(memberId);
    if (!cycle) return [];
    return await this.getWorkoutsByCycle(cycle.id);
  }

  async completeWorkout(data: InsertWorkoutCompletion): Promise<WorkoutCompletion> {
    const [record] = await db.insert(workoutCompletions).values(data).returning();
    return record;
  }

  async getCompletions(memberId: number, date: string): Promise<WorkoutCompletion[]> {
    return await db.select().from(workoutCompletions).where(
      and(eq(workoutCompletions.memberId, memberId), eq(workoutCompletions.date, date))
    );
  }
}

export const storage = new DatabaseStorage();
