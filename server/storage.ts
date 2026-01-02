import { 
  users, gyms, attendance, payments, trainerMembers, workoutCycles, workoutItems, workoutCompletions, memberRequests,
  gymHistory, starMembers, dietPlans, dietPlanMeals, transferRequests, announcements, userNotificationPreferences, announcementReads,
  membershipPlans, memberSubscriptions, paymentTransactions, workoutSessions, workoutSessionExercises,
  type User, type InsertUser, type Gym, type InsertGym,
  type Attendance, type InsertAttendance,
  type Payment, type InsertPayment,
  type TrainerMember,
  type WorkoutCycle, type InsertWorkoutCycle,
  type WorkoutItem, type InsertWorkoutItem,
  type WorkoutCompletion, type InsertWorkoutCompletion,
  type MemberRequest, type InsertMemberRequest,
  type GymHistory, type InsertGymHistory,
  type StarMember, type InsertStarMember,
  type DietPlan, type InsertDietPlan,
  type DietPlanMeal, type InsertDietPlanMeal,
  type TransferRequest, type InsertTransferRequest,
  type Announcement, type InsertAnnouncement,
  type UserNotificationPreferences, type InsertUserNotificationPreferences,
  type AnnouncementRead, type InsertAnnouncementRead,
  type MembershipPlan, type InsertMembershipPlan,
  type MemberSubscription, type InsertMemberSubscription,
  type PaymentTransaction, type InsertPaymentTransaction,
  type WorkoutSession, type InsertWorkoutSession,
  type WorkoutSessionExercise, type InsertWorkoutSessionExercise
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, inArray, gte, lt, sql, isNull } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { nanoid } from "nanoid";

const PostgresSessionStore = connectPg(session);

function generatePublicId(role: string): string {
  const prefix = role === "owner" ? "OWN" : role === "trainer" ? "TRN" : "MEM";
  const suffix = nanoid(5).toUpperCase();
  return `${prefix}-${suffix}`;
}

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
  getMemberDailyWorkouts(memberId: number, startDate?: string, endDate?: string): Promise<{
    date: string;
    muscleGroups: string[];
    exerciseCount: number;
    exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
  }[]>;
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
  
  // Member Profile & Progress
  getMemberProfile(memberId: number): Promise<{
    trainerName: string | null;
    cycleEndDate: string | null;
    cycleName: string | null;
  }>;
  getMemberProgress(memberId: number): Promise<{
    exerciseName: string;
    muscleType: string;
    history: { date: string; weight: string | null; reps: number | null }[];
    personalRecord: { weight: string | null; reps: number | null; date: string } | null;
  }[]>;
  
  // Member Requests
  createMemberRequest(data: InsertMemberRequest): Promise<MemberRequest>;
  getMemberRequests(memberId: number): Promise<(MemberRequest & { trainerName: string | null })[]>;
  getTrainerRequests(trainerId: number): Promise<(MemberRequest & { memberName: string })[]>;
  respondToRequest(requestId: number, response: string): Promise<MemberRequest>;
  
  // Profile
  updateUserProfile(userId: number, data: { email?: string; phone?: string }): Promise<User>;
  getFullMemberProfile(memberId: number): Promise<any>;
  getTrainerProfile(trainerId: number): Promise<any>;
  
  // Gym History
  getGymHistory(memberId: number): Promise<GymHistory[]>;
  createGymHistory(data: InsertGymHistory): Promise<GymHistory>;
  
  // Star Members
  getStarMembers(trainerId: number): Promise<StarMember[]>;
  addStarMember(data: InsertStarMember): Promise<StarMember>;
  removeStarMember(trainerId: number, memberId: number): Promise<void>;
  isStarMember(trainerId: number, memberId: number): Promise<boolean>;
  
  // Diet Plans
  getDietPlans(trainerId: number): Promise<DietPlan[]>;
  getMemberDietPlans(memberId: number): Promise<(DietPlan & { meals: DietPlanMeal[] })[]>;
  createDietPlan(data: InsertDietPlan): Promise<DietPlan>;
  addDietPlanMeal(data: InsertDietPlanMeal): Promise<DietPlanMeal>;
  getDietPlanMeals(planId: number): Promise<DietPlanMeal[]>;
  
  // Transfer Requests
  createTransferRequest(data: InsertTransferRequest): Promise<TransferRequest>;
  getTransferRequestsForOwner(gymId: number): Promise<(TransferRequest & { memberName: string; fromGymName: string; toGymName: string })[]>;
  getMemberTransferRequest(memberId: number): Promise<TransferRequest | undefined>;
  approveTransferByOwner(requestId: number, gymId: number): Promise<TransferRequest>;
  rejectTransferRequest(requestId: number): Promise<TransferRequest>;
  executeTransfer(requestId: number): Promise<void>;
  
  // Workout Cycle deletion
  deleteCycle(cycleId: number): Promise<void>;
  
  // Member Progress - Grouped Sessions
  getMemberWorkoutSessions(memberId: number): Promise<{
    date: string;
    title: string;
    exercises: {
      completionId: number;
      exerciseName: string;
      muscleType: string;
      sets: number;
      reps: number;
      weight: string | null;
      actualSets: number | null;
      actualReps: number | null;
      actualWeight: string | null;
      notes: string | null;
    }[];
  }[]>;
  updateWorkoutCompletion(completionId: number, memberId: number, data: { actualSets?: number; actualReps?: number; actualWeight?: string; notes?: string }): Promise<WorkoutCompletion | null>;
  getEnhancedMemberStats(memberId: number): Promise<{
    streak: number;
    totalWorkouts: number;
    last7Days: number;
    thisMonth: number;
    muscleGroupBreakdown: { name: string; count: number; percentage: number }[];
    volumeStats: { totalSets: number; totalReps: number; totalVolume: number };
    weeklyTrend: { week: string; count: number }[];
  }>;
  getMemberCalendar(memberId: number, month: string): Promise<{ date: string; title: string; count: number }[]>;
  
  // Owner Dashboard & Attendance Analytics
  getOwnerDashboardMetrics(gymId: number): Promise<{
    totalMembers: number;
    checkedInToday: number;
    checkedInYesterday: number;
    newEnrollmentsLast30Days: number;
  }>;
  getOwnerAttendanceSummary(gymId: number, date: string): Promise<{
    date: string;
    totalMembers: number;
    checkedInCount: number;
    notCheckedInCount: number;
    newEnrollmentsLast30Days: number;
  }>;
  getOwnerAttendanceDay(gymId: number, date: string): Promise<{
    date: string;
    checkedIn: { memberId: number; name: string; time: string; method: string }[];
    notCheckedIn: { memberId: number; name: string; trainerName: string | null }[];
  }>;
  getOwnerAttendanceTrend(gymId: number, days: number): Promise<{ date: string; count: number }[]>;
  
  // Announcements
  createAnnouncement(data: InsertAnnouncement): Promise<Announcement>;
  getOwnerAnnouncements(gymId: number): Promise<Announcement[]>;
  deleteAnnouncement(announcementId: number): Promise<void>;
  getUserAnnouncements(gymId: number, role: string): Promise<(Announcement & { isRead: boolean })[]>;
  markAnnouncementRead(announcementId: number, userId: number): Promise<AnnouncementRead>;
  getUnreadAnnouncementCount(gymId: number, userId: number, role: string): Promise<number>;
  
  // Notification Preferences
  getNotificationPreferences(userId: number): Promise<UserNotificationPreferences | undefined>;
  upsertNotificationPreferences(userId: number, gymId: number, data: { emailEnabled?: boolean; smsEnabled?: boolean }): Promise<UserNotificationPreferences>;
  
  // Membership Plans
  getMembershipPlans(gymId: number): Promise<MembershipPlan[]>;
  createMembershipPlan(data: InsertMembershipPlan): Promise<MembershipPlan>;
  updateMembershipPlan(planId: number, data: Partial<InsertMembershipPlan>): Promise<MembershipPlan>;
  deactivateMembershipPlan(planId: number): Promise<void>;
  
  // Member Subscriptions
  getMemberSubscriptions(gymId: number): Promise<(MemberSubscription & { member: User; plan: MembershipPlan | null; totalPaid: number })[]>;
  getMemberSubscription(memberId: number): Promise<(MemberSubscription & { plan: MembershipPlan | null; totalPaid: number }) | null>;
  createMemberSubscription(data: InsertMemberSubscription): Promise<MemberSubscription>;
  updateSubscriptionStatus(subscriptionId: number, status: string): Promise<void>;
  
  // Payment Transactions
  getSubscriptionTransactions(subscriptionId: number): Promise<PaymentTransaction[]>;
  addPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  
  // Subscription Alerts
  getSubscriptionAlerts(gymId: number): Promise<{ endingSoon: number; overdue: number }>;
  updateExpiredSubscriptions(gymId: number): Promise<void>;
  
  // Workout Sessions
  getOrCreateWorkoutSession(data: InsertWorkoutSession): Promise<WorkoutSession>;
  getWorkoutSession(gymId: number, sessionId: number): Promise<(WorkoutSession & { exercises: WorkoutSessionExercise[] }) | null>;
  getWorkoutSessionByMemberDate(gymId: number, memberId: number, date: string): Promise<WorkoutSession | null>;
  addWorkoutSessionExercise(data: InsertWorkoutSessionExercise): Promise<WorkoutSessionExercise>;
  getMemberWorkoutSummary(gymId: number, memberId: number): Promise<{
    streak: number;
    totalWorkouts: number;
    last7DaysCount: number;
    thisMonthCount: number;
    calendarDays: { date: string; focusLabel: string }[];
  }>;
  getMemberWorkoutHistory(gymId: number, memberId: number, from?: string, to?: string): Promise<{
    sessionId: number;
    date: string;
    focusLabel: string;
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
    const publicId = generatePublicId(insertUser.role);
    const [user] = await db.insert(users).values({ ...insertUser, publicId }).returning();
    
    // Create gym history record for new member/trainer
    if (insertUser.gymId && (insertUser.role === "member" || insertUser.role === "trainer")) {
      await db.insert(gymHistory).values({
        memberId: user.id,
        gymId: insertUser.gymId
      });
    }
    
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

  async getMemberDailyWorkouts(memberId: number, startDate?: string, endDate?: string): Promise<{
    date: string;
    muscleGroups: string[];
    exerciseCount: number;
    exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
  }[]> {
    let query = db.select({
      completion: workoutCompletions,
      workoutItem: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate));

    const completions = await query;

    // Filter by date range if provided
    let filtered = completions;
    if (startDate) {
      filtered = filtered.filter(c => c.completion.completedDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(c => c.completion.completedDate <= endDate);
    }

    // Group by date
    const byDate = new Map<string, typeof filtered>();
    for (const c of filtered) {
      const date = c.completion.completedDate;
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(c);
    }

    // Transform to result format
    const result: {
      date: string;
      muscleGroups: string[];
      exerciseCount: number;
      exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
    }[] = [];

    for (const [date, items] of byDate) {
      const muscleGroups = Array.from(new Set(items.map(i => i.workoutItem.muscleType).filter(Boolean)));
      result.push({
        date,
        muscleGroups,
        exerciseCount: items.length,
        exercises: items.map(i => ({
          name: i.workoutItem.exerciseName,
          muscleType: i.workoutItem.muscleType,
          sets: i.completion.actualSets,
          reps: i.completion.actualReps,
          weight: i.completion.actualWeight
        }))
      });
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
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

  async getMemberProfile(memberId: number): Promise<{
    trainerName: string | null;
    cycleEndDate: string | null;
    cycleName: string | null;
  }> {
    const [assignment] = await db.select()
      .from(trainerMembers)
      .where(eq(trainerMembers.memberId, memberId));
    
    let trainerName: string | null = null;
    if (assignment) {
      const [trainer] = await db.select().from(users).where(eq(users.id, assignment.trainerId));
      trainerName = trainer?.username || null;
    }
    
    const cycle = await this.getMemberCycle(memberId);
    
    return {
      trainerName,
      cycleEndDate: cycle?.endDate || null,
      cycleName: cycle?.name || null
    };
  }

  async getMemberProgress(memberId: number): Promise<{
    exerciseName: string;
    muscleType: string;
    history: { date: string; weight: string | null; reps: number | null }[];
    personalRecord: { weight: string | null; reps: number | null; date: string } | null;
  }[]> {
    const completions = await db.select({
      completion: workoutCompletions,
      item: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate));

    const exerciseMap = new Map<string, {
      exerciseName: string;
      muscleType: string;
      history: { date: string; weight: string | null; reps: number | null }[];
    }>();

    for (const { completion, item } of completions) {
      const key = item.exerciseName;
      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, {
          exerciseName: item.exerciseName,
          muscleType: item.muscleType,
          history: []
        });
      }
      exerciseMap.get(key)!.history.push({
        date: completion.completedDate,
        weight: completion.actualWeight,
        reps: completion.actualReps
      });
    }

    return Array.from(exerciseMap.values()).map(exercise => {
      let personalRecord: { weight: string | null; reps: number | null; date: string } | null = null;
      let maxWeight = 0;

      for (const h of exercise.history) {
        const weight = parseFloat(h.weight || '0');
        if (weight > maxWeight) {
          maxWeight = weight;
          personalRecord = { weight: h.weight, reps: h.reps, date: h.date };
        }
      }

      return { ...exercise, personalRecord };
    });
  }

  async createMemberRequest(data: InsertMemberRequest): Promise<MemberRequest> {
    const [request] = await db.insert(memberRequests).values(data).returning();
    return request;
  }

  async getMemberRequests(memberId: number): Promise<(MemberRequest & { trainerName: string | null })[]> {
    const requests = await db.select()
      .from(memberRequests)
      .where(eq(memberRequests.memberId, memberId))
      .orderBy(desc(memberRequests.createdAt));

    const result = await Promise.all(requests.map(async (req) => {
      let trainerName: string | null = null;
      if (req.trainerId) {
        const [trainer] = await db.select().from(users).where(eq(users.id, req.trainerId));
        trainerName = trainer?.username || null;
      }
      return { ...req, trainerName };
    }));

    return result;
  }

  async getTrainerRequests(trainerId: number): Promise<(MemberRequest & { memberName: string })[]> {
    const requests = await db.select({
      request: memberRequests,
      member: users
    })
    .from(memberRequests)
    .innerJoin(users, eq(memberRequests.memberId, users.id))
    .where(eq(memberRequests.trainerId, trainerId))
    .orderBy(desc(memberRequests.createdAt));

    return requests.map(r => ({ ...r.request, memberName: r.member.username }));
  }

  async respondToRequest(requestId: number, response: string): Promise<MemberRequest> {
    const [updated] = await db.update(memberRequests)
      .set({ response, status: 'resolved', updatedAt: new Date() })
      .where(eq(memberRequests.id, requestId))
      .returning();
    return updated;
  }

  // === Profile Methods ===
  async updateUserProfile(userId: number, data: { email?: string; phone?: string }): Promise<User> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getFullMemberProfile(memberId: number): Promise<any> {
    const [member] = await db.select().from(users).where(eq(users.id, memberId));
    if (!member) return null;

    const [gym] = await db.select().from(gyms).where(eq(gyms.id, member.gymId!));
    
    const [assignment] = await db.select().from(trainerMembers).where(eq(trainerMembers.memberId, memberId));
    let trainer = null;
    if (assignment) {
      const [t] = await db.select().from(users).where(eq(users.id, assignment.trainerId));
      trainer = t ? { id: t.id, publicId: t.publicId, username: t.username } : null;
    }

    const cycle = await this.getMemberCycle(memberId);
    const history = await this.getGymHistory(memberId);
    const stats = await this.getMemberStats(memberId);

    return {
      id: member.id,
      publicId: member.publicId,
      username: member.username,
      email: member.email,
      phone: member.phone,
      role: member.role,
      createdAt: member.createdAt,
      gym: gym ? { id: gym.id, name: gym.name, code: gym.code } : null,
      trainer,
      cycle: cycle ? { id: cycle.id, name: cycle.name, endDate: cycle.endDate } : null,
      gymHistory: history,
      stats
    };
  }

  async getTrainerProfile(trainerId: number): Promise<any> {
    const [trainer] = await db.select().from(users).where(eq(users.id, trainerId));
    if (!trainer) return null;

    const [gym] = await db.select().from(gyms).where(eq(gyms.id, trainer.gymId!));
    const assignments = await this.getTrainerMembers(trainerId);
    const memberIds = assignments.map(a => a.memberId);
    
    let members: User[] = [];
    if (memberIds.length > 0) {
      members = await db.select().from(users).where(inArray(users.id, memberIds));
    }

    const stars = await this.getStarMembers(trainerId);
    const starMemberIds = new Set(stars.map(s => s.memberId));

    return {
      id: trainer.id,
      publicId: trainer.publicId,
      username: trainer.username,
      email: trainer.email,
      phone: trainer.phone,
      role: trainer.role,
      createdAt: trainer.createdAt,
      gym: gym ? { id: gym.id, name: gym.name, code: gym.code } : null,
      totalMembers: members.length,
      totalStarMembers: stars.length,
      members: members.map(m => ({
        id: m.id,
        publicId: m.publicId,
        username: m.username,
        isStar: starMemberIds.has(m.id)
      }))
    };
  }

  // === Gym History Methods ===
  async getGymHistory(memberId: number): Promise<GymHistory[]> {
    const history = await db.select({
      history: gymHistory,
      gym: gyms
    })
    .from(gymHistory)
    .innerJoin(gyms, eq(gymHistory.gymId, gyms.id))
    .where(eq(gymHistory.memberId, memberId))
    .orderBy(desc(gymHistory.joinedAt));

    return history.map(h => ({ ...h.history, gymName: (h.gym as any).name })) as any;
  }

  async createGymHistory(data: InsertGymHistory): Promise<GymHistory> {
    const [record] = await db.insert(gymHistory).values(data).returning();
    return record;
  }

  async getGymHistoryForGym(gymId: number): Promise<any[]> {
    const history = await db.select({
      history: gymHistory,
      member: users,
      gym: gyms
    })
    .from(gymHistory)
    .innerJoin(users, eq(gymHistory.memberId, users.id))
    .innerJoin(gyms, eq(gymHistory.gymId, gyms.id))
    .where(eq(gymHistory.gymId, gymId))
    .orderBy(desc(gymHistory.joinedAt));

    return history.map(h => ({
      id: h.history.id,
      memberId: h.history.memberId,
      memberName: h.member.username,
      gymId: h.history.gymId,
      gymName: (h.gym as any).name,
      joinedAt: h.history.joinedAt,
      leftAt: h.history.leftAt
    }));
  }

  // === Star Members Methods ===
  async getStarMembers(trainerId: number): Promise<StarMember[]> {
    return await db.select().from(starMembers).where(eq(starMembers.trainerId, trainerId));
  }

  async addStarMember(data: InsertStarMember): Promise<StarMember> {
    const [star] = await db.insert(starMembers).values(data).returning();
    return star;
  }

  async removeStarMember(trainerId: number, memberId: number): Promise<void> {
    await db.delete(starMembers).where(
      and(eq(starMembers.trainerId, trainerId), eq(starMembers.memberId, memberId))
    );
  }

  async isStarMember(trainerId: number, memberId: number): Promise<boolean> {
    const [star] = await db.select().from(starMembers).where(
      and(eq(starMembers.trainerId, trainerId), eq(starMembers.memberId, memberId))
    );
    return !!star;
  }

  // === Diet Plans Methods ===
  async getDietPlans(trainerId: number): Promise<DietPlan[]> {
    return await db.select().from(dietPlans)
      .where(eq(dietPlans.trainerId, trainerId))
      .orderBy(desc(dietPlans.createdAt));
  }

  async getMemberDietPlans(memberId: number): Promise<(DietPlan & { meals: DietPlanMeal[] })[]> {
    const plans = await db.select().from(dietPlans)
      .where(and(eq(dietPlans.memberId, memberId), eq(dietPlans.isActive, true)))
      .orderBy(desc(dietPlans.createdAt));

    const result = await Promise.all(plans.map(async (plan) => {
      const meals = await this.getDietPlanMeals(plan.id);
      return { ...plan, meals };
    }));

    return result;
  }

  async createDietPlan(data: InsertDietPlan): Promise<DietPlan> {
    const [plan] = await db.insert(dietPlans).values(data).returning();
    return plan;
  }

  async addDietPlanMeal(data: InsertDietPlanMeal): Promise<DietPlanMeal> {
    const [meal] = await db.insert(dietPlanMeals).values(data).returning();
    return meal;
  }

  async getDietPlanMeals(planId: number): Promise<DietPlanMeal[]> {
    return await db.select().from(dietPlanMeals)
      .where(eq(dietPlanMeals.planId, planId))
      .orderBy(dietPlanMeals.dayIndex, dietPlanMeals.orderIndex);
  }

  // === Transfer Requests Methods ===
  async createTransferRequest(data: InsertTransferRequest): Promise<TransferRequest> {
    const [request] = await db.insert(transferRequests).values(data).returning();
    return request;
  }

  async getTransferRequestsForOwner(gymId: number): Promise<(TransferRequest & { memberName: string; fromGymName: string; toGymName: string })[]> {
    const requests = await db.select().from(transferRequests)
      .where(
        and(
          eq(transferRequests.status, 'pending'),
          sql`(${transferRequests.fromGymId} = ${gymId} OR ${transferRequests.toGymId} = ${gymId})`
        )
      )
      .orderBy(desc(transferRequests.createdAt));

    const result = await Promise.all(requests.map(async (req) => {
      const [member] = await db.select().from(users).where(eq(users.id, req.memberId));
      const [fromGym] = await db.select().from(gyms).where(eq(gyms.id, req.fromGymId));
      const [toGym] = await db.select().from(gyms).where(eq(gyms.id, req.toGymId));
      return {
        ...req,
        memberName: member?.username || 'Unknown',
        fromGymName: fromGym?.name || 'Unknown',
        toGymName: toGym?.name || 'Unknown'
      };
    }));

    return result;
  }

  async getMemberTransferRequest(memberId: number): Promise<TransferRequest | undefined> {
    const [request] = await db.select().from(transferRequests)
      .where(and(eq(transferRequests.memberId, memberId), eq(transferRequests.status, 'pending')));
    return request;
  }

  async approveTransferByOwner(requestId: number, gymId: number): Promise<TransferRequest> {
    const [request] = await db.select().from(transferRequests).where(eq(transferRequests.id, requestId));
    if (!request) throw new Error('Request not found');

    let updateData: any = { updatedAt: new Date() };
    if (request.fromGymId === gymId) {
      updateData.approvedByFromOwner = true;
    } else if (request.toGymId === gymId) {
      updateData.approvedByToOwner = true;
    }

    const [updated] = await db.update(transferRequests)
      .set(updateData)
      .where(eq(transferRequests.id, requestId))
      .returning();

    // Check if both owners approved
    if (updated.approvedByFromOwner && updated.approvedByToOwner) {
      await this.executeTransfer(requestId);
    }

    return updated;
  }

  async rejectTransferRequest(requestId: number): Promise<TransferRequest> {
    const [updated] = await db.update(transferRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(transferRequests.id, requestId))
      .returning();
    return updated;
  }

  async executeTransfer(requestId: number): Promise<void> {
    const [request] = await db.select().from(transferRequests).where(eq(transferRequests.id, requestId));
    if (!request) return;

    // Update gym history - mark left_at for old gym
    await db.update(gymHistory)
      .set({ leftAt: new Date() })
      .where(and(
        eq(gymHistory.memberId, request.memberId),
        eq(gymHistory.gymId, request.fromGymId),
        isNull(gymHistory.leftAt)
      ));

    // Create new gym history record
    await db.insert(gymHistory).values({
      memberId: request.memberId,
      gymId: request.toGymId
    });

    // Update member's gym
    await db.update(users)
      .set({ gymId: request.toGymId })
      .where(eq(users.id, request.memberId));

    // Remove trainer assignment
    await db.delete(trainerMembers).where(eq(trainerMembers.memberId, request.memberId));

    // Update transfer request status
    await db.update(transferRequests)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(transferRequests.id, requestId));
  }

  // === Workout Cycle Deletion ===
  async deleteCycle(cycleId: number): Promise<void> {
    // Soft delete - just deactivate
    await db.update(workoutCycles)
      .set({ isActive: false })
      .where(eq(workoutCycles.id, cycleId));
  }

  async getMemberWorkoutSessions(memberId: number): Promise<{
    date: string;
    title: string;
    exercises: {
      completionId: number;
      exerciseName: string;
      muscleType: string;
      sets: number;
      reps: number;
      weight: string | null;
      actualSets: number | null;
      actualReps: number | null;
      actualWeight: string | null;
      notes: string | null;
    }[];
  }[]> {
    const completions = await db.select({
      completion: workoutCompletions,
      item: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate));

    // Group by date
    const sessionMap = new Map<string, {
      date: string;
      title: string;
      exercises: any[];
    }>();

    for (const { completion, item } of completions) {
      const date = completion.completedDate;
      if (!sessionMap.has(date)) {
        sessionMap.set(date, {
          date,
          title: "",
          exercises: []
        });
      }
      const session = sessionMap.get(date)!;
      session.exercises.push({
        completionId: completion.id,
        exerciseName: item.exerciseName,
        muscleType: item.muscleType,
        sets: item.sets,
        reps: item.reps,
        weight: item.weight,
        actualSets: completion.actualSets,
        actualReps: completion.actualReps,
        actualWeight: completion.actualWeight,
        notes: completion.notes
      });
    }

    // Generate titles from muscle types
    for (const session of sessionMap.values()) {
      const muscleTypes = [...new Set(session.exercises.map(e => e.muscleType))];
      session.title = muscleTypes.join(" + ") || "Workout";
    }

    return Array.from(sessionMap.values());
  }

  async updateWorkoutCompletion(completionId: number, memberId: number, data: { actualSets?: number; actualReps?: number; actualWeight?: string; notes?: string }): Promise<WorkoutCompletion | null> {
    const [existing] = await db.select().from(workoutCompletions)
      .where(and(eq(workoutCompletions.id, completionId), eq(workoutCompletions.memberId, memberId)));
    
    if (!existing) return null;

    const updateData: any = {};
    if (data.actualSets !== undefined) updateData.actualSets = data.actualSets;
    if (data.actualReps !== undefined) updateData.actualReps = data.actualReps;
    if (data.actualWeight !== undefined) updateData.actualWeight = data.actualWeight;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await db.update(workoutCompletions)
      .set(updateData)
      .where(eq(workoutCompletions.id, completionId))
      .returning();
    
    return updated;
  }

  async getEnhancedMemberStats(memberId: number): Promise<{
    streak: number;
    totalWorkouts: number;
    last7Days: number;
    thisMonth: number;
    muscleGroupBreakdown: { name: string; count: number; percentage: number }[];
    volumeStats: { totalSets: number; totalReps: number; totalVolume: number };
    weeklyTrend: { week: string; count: number }[];
  }> {
    const completions = await db.select({
      completion: workoutCompletions,
      item: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate));

    const basicStats = await this.getMemberStats(memberId);
    
    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const thisMonth = completions.filter(c => c.completion.completedDate >= thisMonthStart).length;

    // Muscle group breakdown
    const muscleMap = new Map<string, number>();
    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;

    for (const { completion, item } of completions) {
      const muscle = item.muscleType || "Other";
      muscleMap.set(muscle, (muscleMap.get(muscle) || 0) + 1);
      
      const sets = completion.actualSets || item.sets;
      const reps = completion.actualReps || item.reps;
      totalSets += sets;
      totalReps += sets * reps;
      
      const weightStr = completion.actualWeight || item.weight;
      if (weightStr) {
        const weight = parseFloat(weightStr);
        if (!isNaN(weight)) {
          totalVolume += sets * reps * weight;
        }
      }
    }

    const totalExercises = completions.length;
    const muscleGroupBreakdown = Array.from(muscleMap.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: totalExercises > 0 ? Math.round((count / totalExercises) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Weekly trend (last 8 weeks)
    const weeklyTrend: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startStr = weekStart.toISOString().split("T")[0];
      const endStr = weekEnd.toISOString().split("T")[0];
      
      const count = completions.filter(c => 
        c.completion.completedDate >= startStr && c.completion.completedDate <= endStr
      ).length;
      
      const weekLabel = `${(weekStart.getMonth() + 1)}/${weekStart.getDate()}`;
      weeklyTrend.push({ week: weekLabel, count });
    }

    return {
      streak: basicStats.streak,
      totalWorkouts: basicStats.totalWorkouts,
      last7Days: basicStats.last7Days,
      thisMonth,
      muscleGroupBreakdown,
      volumeStats: { totalSets, totalReps, totalVolume: Math.round(totalVolume) },
      weeklyTrend
    };
  }

  async getMemberCalendar(memberId: number, month: string): Promise<{ date: string; title: string; count: number }[]> {
    const [year, mon] = month.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(mon + 1).padStart(2, "0")}-01`;

    const completions = await db.select({
      completion: workoutCompletions,
      item: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(and(
      eq(workoutCompletions.memberId, memberId),
      gte(workoutCompletions.completedDate, startDate),
      lt(workoutCompletions.completedDate, endDate)
    ));

    const dateMap = new Map<string, { muscles: Set<string>; count: number }>();
    for (const { completion, item } of completions) {
      const date = completion.completedDate;
      if (!dateMap.has(date)) {
        dateMap.set(date, { muscles: new Set(), count: 0 });
      }
      const entry = dateMap.get(date)!;
      entry.muscles.add(item.muscleType);
      entry.count++;
    }

    return Array.from(dateMap.entries()).map(([date, { muscles, count }]) => ({
      date,
      title: Array.from(muscles).join(" + ") || "Workout",
      count
    }));
  }

  // Owner Dashboard & Attendance Analytics
  async getOwnerDashboardMetrics(gymId: number): Promise<{
    totalMembers: number;
    checkedInToday: number;
    checkedInYesterday: number;
    newEnrollmentsLast30Days: number;
  }> {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const members = await db.select().from(users).where(and(eq(users.gymId, gymId), eq(users.role, "member")));
    const totalMembers = members.length;

    const todayAttendance = await db.select({ memberId: attendance.memberId })
      .from(attendance)
      .where(and(eq(attendance.gymId, gymId), eq(attendance.date, today), eq(attendance.status, "present")));
    const checkedInToday = new Set(todayAttendance.map(a => a.memberId)).size;

    const yesterdayAttendance = await db.select({ memberId: attendance.memberId })
      .from(attendance)
      .where(and(eq(attendance.gymId, gymId), eq(attendance.date, yesterday), eq(attendance.status, "present")));
    const checkedInYesterday = new Set(yesterdayAttendance.map(a => a.memberId)).size;

    const newEnrollmentsLast30Days = members.filter(m => m.createdAt && m.createdAt >= thirtyDaysAgo).length;

    return { totalMembers, checkedInToday, checkedInYesterday, newEnrollmentsLast30Days };
  }

  async getOwnerAttendanceSummary(gymId: number, date: string): Promise<{
    date: string;
    totalMembers: number;
    checkedInCount: number;
    notCheckedInCount: number;
    newEnrollmentsLast30Days: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const members = await db.select().from(users).where(and(eq(users.gymId, gymId), eq(users.role, "member")));
    const totalMembers = members.length;

    const dayAttendance = await db.select({ memberId: attendance.memberId })
      .from(attendance)
      .where(and(eq(attendance.gymId, gymId), eq(attendance.date, date), eq(attendance.status, "present")));
    const checkedInCount = new Set(dayAttendance.map(a => a.memberId)).size;
    const notCheckedInCount = totalMembers - checkedInCount;

    const newEnrollmentsLast30Days = members.filter(m => m.createdAt && m.createdAt >= thirtyDaysAgo).length;

    return { date, totalMembers, checkedInCount, notCheckedInCount, newEnrollmentsLast30Days };
  }

  async getOwnerAttendanceDay(gymId: number, date: string): Promise<{
    date: string;
    checkedIn: { memberId: number; name: string; time: string; method: string }[];
    notCheckedIn: { memberId: number; name: string; trainerName: string | null }[];
  }> {
    const members = await db.select().from(users).where(and(eq(users.gymId, gymId), eq(users.role, "member")));
    
    const dayAttendance = await db.select({
      memberId: attendance.memberId,
      createdAt: attendance.createdAt,
      verifiedMethod: attendance.verifiedMethod
    })
    .from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.date, date), eq(attendance.status, "present")));

    const checkedInMemberIds = new Set(dayAttendance.map(a => a.memberId));

    // Get trainer assignments
    const assignments = await db.select({
      memberId: trainerMembers.memberId,
      trainerId: trainerMembers.trainerId
    }).from(trainerMembers).where(eq(trainerMembers.gymId, gymId));
    
    const trainers = await db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.gymId, gymId));
    const trainerMap = new Map(trainers.map(t => [t.id, t.username]));
    const memberTrainerMap = new Map(assignments.map(a => [a.memberId, a.trainerId]));

    const checkedIn = dayAttendance.map(a => {
      const member = members.find(m => m.id === a.memberId);
      return {
        memberId: a.memberId,
        name: member?.username || "Unknown",
        time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString() : "",
        method: a.verifiedMethod || "manual"
      };
    });

    const notCheckedIn = members
      .filter(m => !checkedInMemberIds.has(m.id))
      .map(m => ({
        memberId: m.id,
        name: m.username,
        trainerName: trainerMap.get(memberTrainerMap.get(m.id) || 0) || null
      }));

    return { date, checkedIn, notCheckedIn };
  }

  async getOwnerAttendanceTrend(gymId: number, days: number): Promise<{ date: string; count: number }[]> {
    const result: { date: string; count: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      const dayAttendance = await db.select({ memberId: attendance.memberId })
        .from(attendance)
        .where(and(eq(attendance.gymId, gymId), eq(attendance.date, date), eq(attendance.status, "present")));
      
      result.push({ date, count: new Set(dayAttendance.map(a => a.memberId)).size });
    }
    
    return result;
  }

  // Announcements
  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db.insert(announcements).values(data).returning();
    return announcement;
  }

  async getOwnerAnnouncements(gymId: number): Promise<Announcement[]> {
    return db.select().from(announcements)
      .where(and(eq(announcements.gymId, gymId), eq(announcements.isDeleted, false)))
      .orderBy(desc(announcements.createdAt));
  }

  async deleteAnnouncement(announcementId: number): Promise<void> {
    await db.update(announcements).set({ isDeleted: true }).where(eq(announcements.id, announcementId));
  }

  async getUserAnnouncements(gymId: number, role: string, userId?: number): Promise<(Announcement & { isRead: boolean })[]> {
    const allAnnouncements = await db.select().from(announcements)
      .where(and(eq(announcements.gymId, gymId), eq(announcements.isDeleted, false)))
      .orderBy(desc(announcements.createdAt));
    
    const filtered = allAnnouncements.filter(a => 
      a.audience === "everyone" || 
      (a.audience === "members" && role === "member") ||
      (a.audience === "trainers" && role === "trainer")
    );

    // Get read status if userId is provided
    let readIds = new Set<number>();
    if (userId) {
      const reads = await db.select({ announcementId: announcementReads.announcementId })
        .from(announcementReads)
        .where(eq(announcementReads.userId, userId));
      readIds = new Set(reads.map(r => r.announcementId));
    }

    return filtered.map(a => ({ ...a, isRead: readIds.has(a.id) }));
  }

  async markAnnouncementRead(announcementId: number, userId: number): Promise<AnnouncementRead> {
    try {
      const existing = await db.select().from(announcementReads)
        .where(and(eq(announcementReads.announcementId, announcementId), eq(announcementReads.userId, userId)));
      
      if (existing.length > 0) {
        return existing[0];
      }

      const [read] = await db.insert(announcementReads).values({ announcementId, userId }).returning();
      return read;
    } catch (error: any) {
      // Handle duplicate key violation gracefully (race condition)
      if (error.code === '23505') {
        const [existing] = await db.select().from(announcementReads)
          .where(and(eq(announcementReads.announcementId, announcementId), eq(announcementReads.userId, userId)));
        return existing;
      }
      throw error;
    }
  }

  async getUnreadAnnouncementCount(gymId: number, userId: number, role: string): Promise<number> {
    // Get announcements with read status
    const allAnnouncements = await this.getUserAnnouncements(gymId, role, userId);
    return allAnnouncements.filter(a => !a.isRead).length;
  }

  // Notification Preferences
  async getNotificationPreferences(userId: number): Promise<UserNotificationPreferences | undefined> {
    const [prefs] = await db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId));
    return prefs;
  }

  async upsertNotificationPreferences(userId: number, gymId: number, data: { emailEnabled?: boolean; smsEnabled?: boolean }): Promise<UserNotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId);
    
    if (existing) {
      const [updated] = await db.update(userNotificationPreferences)
        .set(data)
        .where(eq(userNotificationPreferences.userId, userId))
        .returning();
      return updated;
    }

    const [created] = await db.insert(userNotificationPreferences)
      .values({ userId, gymId, ...data })
      .returning();
    return created;
  }

  // === MEMBERSHIP PLANS ===
  async getMembershipPlans(gymId: number): Promise<MembershipPlan[]> {
    return await db.select().from(membershipPlans)
      .where(eq(membershipPlans.gymId, gymId))
      .orderBy(membershipPlans.durationMonths);
  }

  async createMembershipPlan(data: InsertMembershipPlan): Promise<MembershipPlan> {
    const [plan] = await db.insert(membershipPlans).values(data).returning();
    return plan;
  }

  async updateMembershipPlan(planId: number, data: Partial<InsertMembershipPlan>): Promise<MembershipPlan> {
    const [updated] = await db.update(membershipPlans)
      .set(data)
      .where(eq(membershipPlans.id, planId))
      .returning();
    return updated;
  }

  async deactivateMembershipPlan(planId: number): Promise<void> {
    await db.update(membershipPlans)
      .set({ isActive: false })
      .where(eq(membershipPlans.id, planId));
  }

  // === MEMBER SUBSCRIPTIONS ===
  async getMemberSubscriptions(gymId: number): Promise<(MemberSubscription & { member: User; plan: MembershipPlan | null; totalPaid: number })[]> {
    const subs = await db.select().from(memberSubscriptions)
      .leftJoin(users, eq(memberSubscriptions.memberId, users.id))
      .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
      .where(eq(memberSubscriptions.gymId, gymId))
      .orderBy(desc(memberSubscriptions.createdAt));
    
    const result = [];
    for (const row of subs) {
      const transactions = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
        .from(paymentTransactions)
        .where(eq(paymentTransactions.subscriptionId, row.member_subscriptions.id));
      
      result.push({
        ...row.member_subscriptions,
        member: row.users!,
        plan: row.membership_plans,
        totalPaid: Number(transactions[0]?.total || 0)
      });
    }
    return result;
  }

  async getMemberSubscription(memberId: number): Promise<(MemberSubscription & { plan: MembershipPlan | null; totalPaid: number }) | null> {
    const [sub] = await db.select().from(memberSubscriptions)
      .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
      .where(eq(memberSubscriptions.memberId, memberId))
      .orderBy(desc(memberSubscriptions.createdAt))
      .limit(1);
    
    if (!sub) return null;

    const transactions = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.subscriptionId, sub.member_subscriptions.id));
    
    return {
      ...sub.member_subscriptions,
      plan: sub.membership_plans,
      totalPaid: Number(transactions[0]?.total || 0)
    };
  }

  async createMemberSubscription(data: InsertMemberSubscription): Promise<MemberSubscription> {
    const [sub] = await db.insert(memberSubscriptions).values(data).returning();
    return sub;
  }

  async updateSubscriptionStatus(subscriptionId: number, status: string): Promise<void> {
    await db.update(memberSubscriptions)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(memberSubscriptions.id, subscriptionId));
  }

  async getSubscriptionById(subscriptionId: number, gymId: number): Promise<MemberSubscription | null> {
    const [sub] = await db.select().from(memberSubscriptions)
      .where(and(eq(memberSubscriptions.id, subscriptionId), eq(memberSubscriptions.gymId, gymId)));
    return sub || null;
  }

  // === PAYMENT TRANSACTIONS ===
  async getSubscriptionTransactions(subscriptionId: number): Promise<PaymentTransaction[]> {
    return await db.select().from(paymentTransactions)
      .where(eq(paymentTransactions.subscriptionId, subscriptionId))
      .orderBy(desc(paymentTransactions.paidOn));
  }

  async addPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const [txn] = await db.insert(paymentTransactions).values(data).returning();
    return txn;
  }

  // === SUBSCRIPTION ALERTS ===
  async getSubscriptionAlerts(gymId: number): Promise<{ endingSoon: number; overdue: number }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const subs = await db.select().from(memberSubscriptions)
      .where(eq(memberSubscriptions.gymId, gymId));
    
    let endingSoon = 0;
    let overdue = 0;
    
    for (const sub of subs) {
      if (sub.status === 'endingSoon' || (sub.endDate >= today && sub.endDate <= sevenDaysLater && sub.status === 'active')) {
        endingSoon++;
      }
      if (sub.status === 'overdue' || (sub.endDate < today && sub.status !== 'ended')) {
        overdue++;
      }
    }
    
    return { endingSoon, overdue };
  }

  async updateExpiredSubscriptions(gymId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Update endingSoon status
    await db.update(memberSubscriptions)
      .set({ status: 'endingSoon', updatedAt: new Date() })
      .where(and(
        eq(memberSubscriptions.gymId, gymId),
        eq(memberSubscriptions.status, 'active'),
        gte(memberSubscriptions.endDate, today),
        lt(memberSubscriptions.endDate, sevenDaysLater)
      ));
    
    // Update overdue status (past end date but not fully paid)
    const allSubs = await db.select().from(memberSubscriptions)
      .where(and(eq(memberSubscriptions.gymId, gymId), lt(memberSubscriptions.endDate, today)));
    
    for (const sub of allSubs) {
      if (sub.status === 'ended') continue;
      
      const [totalPaidResult] = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
        .from(paymentTransactions)
        .where(eq(paymentTransactions.subscriptionId, sub.id));
      
      const totalPaid = Number(totalPaidResult?.total || 0);
      const remaining = sub.totalAmount - totalPaid;
      
      if (remaining > 0) {
        await db.update(memberSubscriptions)
          .set({ status: 'overdue', updatedAt: new Date() })
          .where(eq(memberSubscriptions.id, sub.id));
      } else {
        await db.update(memberSubscriptions)
          .set({ status: 'ended', updatedAt: new Date() })
          .where(eq(memberSubscriptions.id, sub.id));
      }
    }
  }

  // === WORKOUT SESSIONS ===
  async getOrCreateWorkoutSession(data: InsertWorkoutSession): Promise<WorkoutSession> {
    const existing = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.gymId, data.gymId),
        eq(workoutSessions.memberId, data.memberId),
        eq(workoutSessions.date, data.date)
      ));
    
    if (existing.length > 0) {
      // Update focus label if different
      if (existing[0].focusLabel !== data.focusLabel) {
        const [updated] = await db.update(workoutSessions)
          .set({ focusLabel: data.focusLabel, cycleId: data.cycleId, cycleDayIndex: data.cycleDayIndex })
          .where(eq(workoutSessions.id, existing[0].id))
          .returning();
        return updated;
      }
      return existing[0];
    }
    
    const [session] = await db.insert(workoutSessions).values(data).returning();
    return session;
  }

  async getWorkoutSession(gymId: number, sessionId: number): Promise<(WorkoutSession & { exercises: WorkoutSessionExercise[] }) | null> {
    const [session] = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.gymId, gymId)));
    
    if (!session) return null;
    
    const exercises = await db.select().from(workoutSessionExercises)
      .where(eq(workoutSessionExercises.sessionId, sessionId))
      .orderBy(workoutSessionExercises.orderIndex);
    
    return { ...session, exercises };
  }

  async getWorkoutSessionByMemberDate(gymId: number, memberId: number, date: string): Promise<WorkoutSession | null> {
    const [session] = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.gymId, gymId),
        eq(workoutSessions.memberId, memberId),
        eq(workoutSessions.date, date)
      ));
    return session || null;
  }

  async addWorkoutSessionExercise(data: InsertWorkoutSessionExercise): Promise<WorkoutSessionExercise> {
    // Check for existing exercise with same name in session to avoid duplicates
    const existing = await db.select().from(workoutSessionExercises)
      .where(and(
        eq(workoutSessionExercises.sessionId, data.sessionId),
        eq(workoutSessionExercises.exerciseName, data.exerciseName)
      ));
    
    if (existing.length > 0) {
      // Update existing exercise instead of creating duplicate
      const [updated] = await db.update(workoutSessionExercises)
        .set({ sets: data.sets, reps: data.reps, weight: data.weight })
        .where(eq(workoutSessionExercises.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [exercise] = await db.insert(workoutSessionExercises).values(data).returning();
    return exercise;
  }

  async getMemberWorkoutSummary(gymId: number, memberId: number): Promise<{
    streak: number;
    totalWorkouts: number;
    last7DaysCount: number;
    thisMonthCount: number;
    calendarDays: { date: string; focusLabel: string }[];
  }> {
    const sessions = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.gymId, gymId), eq(workoutSessions.memberId, memberId)))
      .orderBy(desc(workoutSessions.date));
    
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';
    
    // Calculate streak
    let streak = 0;
    const sessionDates = new Set(sessions.map(s => s.date));
    let checkDate = new Date(today);
    
    // If no workout today, start from yesterday
    if (!sessionDates.has(today)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (sessionDates.has(checkDate.toISOString().split('T')[0])) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Calculate counts
    const last7DaysCount = sessions.filter(s => s.date >= sevenDaysAgo).length;
    const thisMonthCount = sessions.filter(s => s.date >= monthStart).length;
    
    // Calendar days (last 90 days for display)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const calendarDays = sessions
      .filter(s => s.date >= ninetyDaysAgo)
      .map(s => ({ date: s.date, focusLabel: s.focusLabel }));
    
    return {
      streak,
      totalWorkouts: sessions.length,
      last7DaysCount,
      thisMonthCount,
      calendarDays
    };
  }

  async getMemberWorkoutHistory(gymId: number, memberId: number, from?: string, to?: string): Promise<{
    sessionId: number;
    date: string;
    focusLabel: string;
  }[]> {
    const sessions = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.gymId, gymId), eq(workoutSessions.memberId, memberId)))
      .orderBy(desc(workoutSessions.date));
    
    let filtered = sessions;
    if (from) {
      filtered = filtered.filter(s => s.date >= from);
    }
    if (to) {
      filtered = filtered.filter(s => s.date <= to);
    }
    
    return filtered.map(s => ({
      sessionId: s.id,
      date: s.date,
      focusLabel: s.focusLabel
    }));
  }
}

export const storage = new DatabaseStorage();
