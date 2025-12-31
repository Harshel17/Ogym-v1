import { 
  users, gyms, attendance, payments, trainerMembers, workoutCycles, workoutItems, workoutCompletions,
  type User, type InsertUser, type Gym, type InsertGym,
  type Attendance, type InsertAttendance,
  type Payment, type InsertPayment,
  type TrainerMember,
  type WorkoutCycle, type InsertWorkoutCycle,
  type WorkoutItem, type InsertWorkoutItem,
  type WorkoutCompletion, type InsertWorkoutCompletion
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
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
  getGymAssignments(gymId: number): Promise<TrainerMember[]>;
  
  // Attendance
  getAttendance(gymId: number): Promise<(Attendance & { member: User })[]>;
  getMemberAttendance(memberId: number): Promise<Attendance[]>;
  getAttendanceByMemberDate(memberId: number, date: string): Promise<Attendance | undefined>;
  markAttendance(data: InsertAttendance): Promise<Attendance>;
  updateAttendanceMethod(id: number, method: string): Promise<void>;
  
  // Payments
  getPayments(gymId: number): Promise<(Payment & { member: User })[]>;
  getMemberPayments(memberId: number): Promise<Payment[]>;
  markPayment(data: InsertPayment): Promise<Payment>;
  
  // Workout Cycles
  createWorkoutCycle(data: InsertWorkoutCycle): Promise<WorkoutCycle>;
  getTrainerCycles(trainerId: number): Promise<WorkoutCycle[]>;
  getMemberCycle(memberId: number): Promise<WorkoutCycle | undefined>;
  getCycle(cycleId: number): Promise<WorkoutCycle | undefined>;
  updateCycleDayLabels(cycleId: number, dayLabels: string[]): Promise<WorkoutCycle>;
  addWorkoutItem(data: InsertWorkoutItem): Promise<WorkoutItem>;
  getWorkoutItems(cycleId: number): Promise<WorkoutItem[]>;
  getWorkoutItemsByDay(cycleId: number, dayIndex: number): Promise<WorkoutItem[]>;
  getWorkoutItem(id: number): Promise<WorkoutItem | undefined>;
  completeWorkout(data: InsertWorkoutCompletion): Promise<WorkoutCompletion>;
  getCompletions(memberId: number, date: string): Promise<WorkoutCompletion[]>;
  getCompletionByItemDate(workoutItemId: number, memberId: number, date: string): Promise<WorkoutCompletion | undefined>;
  getMemberWorkoutHistory(memberId: number): Promise<WorkoutCompletion[]>;
  getMemberStats(memberId: number): Promise<{ streak: number; totalWorkouts: number; last7Days: number }>;
  getActivityFeed(gymId: number, memberIds: number[]): Promise<any[]>;
  getGymTrainersWithMembers(gymId: number): Promise<{ trainer: User; members: User[] }[]>;
  getMemberOverview(gymId: number, memberId: number): Promise<{
    member: User | null;
    cycle: (WorkoutCycle & { items: WorkoutItem[]; trainerName: string }) | null;
    history: { id: number; exerciseName: string; muscleType: string | null; completedDate: string; actualSets: number | null; actualReps: number | null; actualWeight: string | null }[];
  }>;
  getMembersWithDetails(gymId: number): Promise<{
    id: number;
    username: string;
    role: string;
    createdAt: Date | null;
    trainerName: string | null;
    cycleEndDate: string | null;
    paymentStatus: string | null;
  }[]>;
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
    await db.delete(trainerMembers).where(
      and(eq(trainerMembers.gymId, gymId), eq(trainerMembers.memberId, memberId))
    );
    
    const [assignment] = await db.insert(trainerMembers).values({
      trainerId, memberId, gymId
    }).returning();
    return assignment;
  }

  async getTrainerMembers(trainerId: number): Promise<TrainerMember[]> {
    return await db.select().from(trainerMembers).where(eq(trainerMembers.trainerId, trainerId));
  }

  async getGymAssignments(gymId: number): Promise<TrainerMember[]> {
    return await db.select().from(trainerMembers).where(eq(trainerMembers.gymId, gymId));
  }

  async getAttendance(gymId: number): Promise<(Attendance & { member: User })[]> {
    const result = await db.select({
      attendance: attendance,
      member: users
    })
    .from(attendance)
    .innerJoin(users, eq(attendance.memberId, users.id))
    .where(eq(attendance.gymId, gymId))
    .orderBy(desc(attendance.date));

    return result.map(r => ({ ...r.attendance, member: r.member }));
  }

  async getMemberAttendance(memberId: number): Promise<Attendance[]> {
    return await db.select().from(attendance)
      .where(eq(attendance.memberId, memberId))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByMemberDate(memberId: number, date: string): Promise<Attendance | undefined> {
    const [record] = await db.select().from(attendance)
      .where(and(eq(attendance.memberId, memberId), eq(attendance.date, date)));
    return record;
  }

  async markAttendance(data: InsertAttendance): Promise<Attendance> {
    const [record] = await db.insert(attendance).values(data).returning();
    return record;
  }

  async updateAttendanceMethod(id: number, method: string): Promise<void> {
    await db.update(attendance).set({ verifiedMethod: method as any }).where(eq(attendance.id, id));
  }

  async getPayments(gymId: number): Promise<(Payment & { member: User })[]> {
    const result = await db.select({
      payment: payments,
      member: users
    })
    .from(payments)
    .innerJoin(users, eq(payments.memberId, users.id))
    .where(eq(payments.gymId, gymId))
    .orderBy(desc(payments.month));

    return result.map(r => ({ ...r.payment, member: r.member }));
  }

  async getMemberPayments(memberId: number): Promise<Payment[]> {
    return await db.select().from(payments)
      .where(eq(payments.memberId, memberId))
      .orderBy(desc(payments.month));
  }

  async markPayment(data: InsertPayment): Promise<Payment> {
    const [record] = await db.insert(payments).values(data).returning();
    return record;
  }

  async createWorkoutCycle(data: InsertWorkoutCycle): Promise<WorkoutCycle> {
    // Deactivate any existing active cycles for this member first
    await db.update(workoutCycles)
      .set({ isActive: false })
      .where(and(eq(workoutCycles.memberId, data.memberId), eq(workoutCycles.isActive, true)));
    
    const [cycle] = await db.insert(workoutCycles).values(data).returning();
    return cycle;
  }

  async getTrainerCycles(trainerId: number): Promise<WorkoutCycle[]> {
    return await db.select().from(workoutCycles).where(eq(workoutCycles.trainerId, trainerId));
  }

  async getMemberCycle(memberId: number): Promise<WorkoutCycle | undefined> {
    const [cycle] = await db.select().from(workoutCycles)
      .where(and(eq(workoutCycles.memberId, memberId), eq(workoutCycles.isActive, true)))
      .orderBy(desc(workoutCycles.id));
    return cycle;
  }

  async getCycle(cycleId: number): Promise<WorkoutCycle | undefined> {
    const [cycle] = await db.select().from(workoutCycles).where(eq(workoutCycles.id, cycleId));
    return cycle;
  }

  async updateCycleDayLabels(cycleId: number, dayLabels: string[]): Promise<WorkoutCycle> {
    const [cycle] = await db.update(workoutCycles)
      .set({ dayLabels })
      .where(eq(workoutCycles.id, cycleId))
      .returning();
    return cycle;
  }

  async addWorkoutItem(data: InsertWorkoutItem): Promise<WorkoutItem> {
    const [item] = await db.insert(workoutItems).values(data).returning();
    return item;
  }

  async getWorkoutItems(cycleId: number): Promise<WorkoutItem[]> {
    return await db.select().from(workoutItems)
      .where(eq(workoutItems.cycleId, cycleId))
      .orderBy(workoutItems.dayIndex, workoutItems.orderIndex);
  }

  async getWorkoutItemsByDay(cycleId: number, dayIndex: number): Promise<WorkoutItem[]> {
    return await db.select().from(workoutItems)
      .where(and(eq(workoutItems.cycleId, cycleId), eq(workoutItems.dayIndex, dayIndex)))
      .orderBy(workoutItems.orderIndex);
  }

  async getWorkoutItem(id: number): Promise<WorkoutItem | undefined> {
    const [item] = await db.select().from(workoutItems).where(eq(workoutItems.id, id));
    return item;
  }

  async completeWorkout(data: InsertWorkoutCompletion): Promise<WorkoutCompletion> {
    const [record] = await db.insert(workoutCompletions).values(data).returning();
    return record;
  }

  async getCompletions(memberId: number, date: string): Promise<WorkoutCompletion[]> {
    return await db.select().from(workoutCompletions).where(
      and(eq(workoutCompletions.memberId, memberId), eq(workoutCompletions.completedDate, date))
    );
  }

  async getCompletionByItemDate(workoutItemId: number, memberId: number, date: string): Promise<WorkoutCompletion | undefined> {
    const [record] = await db.select().from(workoutCompletions).where(
      and(
        eq(workoutCompletions.workoutItemId, workoutItemId),
        eq(workoutCompletions.memberId, memberId),
        eq(workoutCompletions.completedDate, date)
      )
    );
    return record;
  }

  async getMemberWorkoutHistory(memberId: number): Promise<WorkoutCompletion[]> {
    return await db.select().from(workoutCompletions)
      .where(eq(workoutCompletions.memberId, memberId))
      .orderBy(desc(workoutCompletions.completedDate));
  }

  async getMemberStats(memberId: number): Promise<{ streak: number; totalWorkouts: number; last7Days: number }> {
    const allCompletions = await db.select().from(workoutCompletions)
      .where(eq(workoutCompletions.memberId, memberId))
      .orderBy(desc(workoutCompletions.completedDate));
    
    const totalWorkouts = allCompletions.length;
    
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
    const last7Days = allCompletions.filter(c => c.completedDate >= sevenDaysAgoStr).length;
    
    let streak = 0;
    const uniqueDates = Array.from(new Set(allCompletions.map(c => c.completedDate))).sort().reverse();
    
    if (uniqueDates.length > 0) {
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
        let currentDate = new Date(uniqueDates[0]);
        for (const dateStr of uniqueDates) {
          const checkDate = currentDate.toISOString().split("T")[0];
          if (dateStr === checkDate) {
            streak++;
            currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
          } else {
            break;
          }
        }
      }
    }
    
    return { streak, totalWorkouts, last7Days };
  }

  async getActivityFeed(gymId: number, memberIds: number[]): Promise<any[]> {
    if (memberIds.length === 0) return [];
    
    const completions = await db.select({
      completion: workoutCompletions,
      member: users,
      workoutItem: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(users, eq(workoutCompletions.memberId, users.id))
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(inArray(workoutCompletions.memberId, memberIds))
    .orderBy(desc(workoutCompletions.createdAt))
    .limit(50);
    
    return completions.map(c => ({
      type: "workout_completed",
      memberName: c.member.username,
      memberId: c.member.id,
      exerciseName: c.workoutItem.exerciseName,
      date: c.completion.completedDate,
      createdAt: c.completion.createdAt
    }));
  }

  async getGymTrainersWithMembers(gymId: number): Promise<{ trainer: User; members: User[] }[]> {
    const trainers = await this.getGymTrainers(gymId);
    
    const result: { trainer: User; members: User[] }[] = [];
    
    for (const trainer of trainers) {
      const assignments = await this.getTrainerMembers(trainer.id);
      const memberIds = assignments.map(a => a.memberId);
      
      let members: User[] = [];
      if (memberIds.length > 0) {
        members = await db.select().from(users).where(inArray(users.id, memberIds));
      }
      
      result.push({ trainer, members });
    }
    
    return result;
  }

  async getMemberOverview(gymId: number, memberId: number): Promise<{
    member: User | null;
    cycle: (WorkoutCycle & { items: WorkoutItem[]; trainerName: string }) | null;
    history: { id: number; exerciseName: string; muscleType: string | null; completedDate: string; actualSets: number | null; actualReps: number | null; actualWeight: string | null }[];
  }> {
    const [member] = await db.select().from(users)
      .where(and(eq(users.id, memberId), eq(users.gymId, gymId), eq(users.role, "member")));
    
    if (!member) {
      return { member: null, cycle: null, history: [] };
    }

    const cycle = await this.getMemberCycle(memberId);
    let cycleWithDetails = null;
    
    if (cycle) {
      const items = await this.getWorkoutItems(cycle.id);
      const [trainer] = await db.select().from(users).where(eq(users.id, cycle.trainerId));
      cycleWithDetails = { ...cycle, items, trainerName: trainer?.username || "Unknown" };
    }

    const completionsWithItems = await db.select({
      completion: workoutCompletions,
      workoutItem: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate))
    .limit(50);

    const history = completionsWithItems.map(c => ({
      id: c.completion.id,
      exerciseName: c.workoutItem.exerciseName,
      muscleType: c.workoutItem.muscleType,
      completedDate: c.completion.completedDate,
      actualSets: c.completion.actualSets,
      actualReps: c.completion.actualReps,
      actualWeight: c.completion.actualWeight
    }));

    return { member, cycle: cycleWithDetails, history };
  }

  async getMembersWithDetails(gymId: number): Promise<{
    id: number;
    username: string;
    role: string;
    createdAt: Date | null;
    trainerName: string | null;
    cycleEndDate: string | null;
    paymentStatus: string | null;
  }[]> {
    const members = await this.getGymMembers(gymId);
    const assignments = await this.getGymAssignments(gymId);
    const trainers = await this.getGymTrainers(gymId);
    
    const trainerMap = new Map(trainers.map(t => [t.id, t.username]));
    const memberTrainerMap = new Map(assignments.map(a => [a.memberId, a.trainerId]));
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const result = await Promise.all(members.map(async (member) => {
      const trainerId = memberTrainerMap.get(member.id);
      const trainerName = trainerId ? trainerMap.get(trainerId) || null : null;
      
      const cycle = await this.getMemberCycle(member.id);
      const cycleEndDate = cycle?.endDate || null;
      
      const [latestPayment] = await db.select()
        .from(payments)
        .where(and(eq(payments.memberId, member.id), eq(payments.month, currentMonth)))
        .limit(1);
      
      const paymentStatus = latestPayment?.status || null;
      
      return {
        id: member.id,
        username: member.username,
        role: member.role,
        createdAt: member.createdAt,
        trainerName,
        cycleEndDate,
        paymentStatus
      };
    }));
    
    return result;
  }
}

export const storage = new DatabaseStorage();
