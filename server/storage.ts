import { 
  users, gyms, attendance, payments, trainerMembers, trainerMemberAssignments, workoutCycles, workoutItems, workoutCompletions, memberRequests,
  gymHistory, starMembers, dietPlans, dietPlanMeals, transferRequests, announcements, userNotificationPreferences, announcementReads,
  membershipPlans, memberSubscriptions, paymentTransactions, workoutSessions, workoutSessionExercises,
  gymRequests, joinRequests, gymSubscriptions, workoutTemplates, workoutTemplateItems, bodyMeasurements, memberNotes,
  workoutPlanSets, workoutLogs, workoutLogExercises, workoutLogSets,
  type User, type InsertUser, type Gym, type InsertGym,
  type Attendance, type InsertAttendance,
  type Payment, type InsertPayment,
  type TrainerMember, type TrainerMemberAssignment, type InsertTrainerMemberAssignment,
  type WorkoutCycle, type InsertWorkoutCycle,
  type WorkoutItem, type InsertWorkoutItem,
  type WorkoutCompletion, type InsertWorkoutCompletion,
  type WorkoutPlanSet, type InsertWorkoutPlanSet,
  type WorkoutLog, type InsertWorkoutLog,
  type WorkoutLogExercise, type InsertWorkoutLogExercise,
  type WorkoutLogSet, type InsertWorkoutLogSet,
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
  type WorkoutSessionExercise, type InsertWorkoutSessionExercise,
  type GymRequest, type InsertGymRequest,
  type JoinRequest, type InsertJoinRequest,
  type GymSubscription, type InsertGymSubscription,
  type WorkoutTemplate, type InsertWorkoutTemplate,
  type WorkoutTemplateItem, type InsertWorkoutTemplateItem,
  type BodyMeasurement, type InsertBodyMeasurement,
  type MemberNote, type InsertMemberNote,
  feedPosts, feedReactions, feedComments, tournaments, tournamentParticipants, memberRestDaySwaps,
  type FeedPost, type InsertFeedPost,
  type FeedReaction, type InsertFeedReaction,
  type FeedComment, type InsertFeedComment,
  type Tournament, type InsertTournament,
  type TournamentParticipant, type InsertTournamentParticipant,
  type MemberRestDaySwap, type InsertMemberRestDaySwap,
  trainingPhases, phaseExercises, type TrainingPhase, type InsertTrainingPhase, type PhaseExercise, type InsertPhaseExercise,
  userProfiles, type UserProfile,
  passwordResetCodes, type PasswordResetCode, type InsertPasswordResetCode,
  supportTickets, supportMessages, auditLogs,
  type SupportTicket, type InsertSupportTicket,
  type SupportMessage, type InsertSupportMessage,
  type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, inArray, gte, lt, lte, sql, isNull, isNotNull, or, ilike } from "drizzle-orm";
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
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserAutoPost(userId: number, autoPostEnabled: boolean): Promise<void>;
  updateUserVerificationCode(userId: number, code: string, expiresAt: Date): Promise<void>;
  verifyUserEmail(userId: number): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  
  // Password Reset
  createPasswordResetCode(email: string, codeHash: string, expiresAt: Date): Promise<PasswordResetCode>;
  getValidPasswordResetCode(email: string): Promise<PasswordResetCode | null>;
  markPasswordResetCodeUsed(codeId: number): Promise<void>;
  invalidatePasswordResetCodes(email: string): Promise<void>;
  
  getUserPosts(userId: number): Promise<FeedPost[]>;
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
  getMemberCycles(memberId: number): Promise<WorkoutCycle[]>;
  getCycle(cycleId: number): Promise<WorkoutCycle | undefined>;
  updateCycleDayLabels(cycleId: number, dayLabels: string[]): Promise<WorkoutCycle>;
  updateCycleRestDays(cycleId: number, restDays: number[]): Promise<WorkoutCycle>;
  updateCycleStructure(cycleId: number, cycleLength: number, dayLabels: string[], restDays: number[]): Promise<WorkoutCycle>;
  deleteWorkoutItemsByDay(cycleId: number, dayIndex: number): Promise<void>;
  shiftWorkoutItemsDays(cycleId: number, fromDayIndex: number, shiftAmount: number): Promise<void>;
  updateCycleDayIndex(cycleId: number, currentDayIndex: number): Promise<WorkoutCycle>;
  updateCycleDayIndexAndLastWorkout(cycleId: number, currentDayIndex: number, lastWorkoutDate: string): Promise<WorkoutCycle>;
  addWorkoutItem(data: InsertWorkoutItem): Promise<WorkoutItem>;
  deleteWorkoutItem(itemId: number): Promise<void>;
  getWorkoutItems(cycleId: number): Promise<WorkoutItem[]>;
  getWorkoutItemsByDay(cycleId: number, dayIndex: number): Promise<WorkoutItem[]>;
  getWorkoutItem(id: number): Promise<WorkoutItem | undefined>;
  completeWorkout(data: InsertWorkoutCompletion): Promise<WorkoutCompletion>;
  completePhaseExercise(data: {
    gymId: number;
    phaseExerciseId: number;
    memberId: number;
    completedDate: string;
    exerciseName: string;
    actualSets?: number | null;
    actualReps?: number | null;
    actualWeight?: string | null;
  }): Promise<WorkoutCompletion>;
  getCompletions(memberId: number, date: string): Promise<WorkoutCompletion[]>;
  getCompletionByItemDate(workoutItemId: number, memberId: number, date: string): Promise<WorkoutCompletion | undefined>;
  getMemberWorkoutHistory(memberId: number): Promise<WorkoutCompletion[]>;
  
  // Per-set workout plan targets
  getWorkoutPlanSets(workoutItemId: number): Promise<WorkoutPlanSet[]>;
  createWorkoutPlanSets(sets: InsertWorkoutPlanSet[]): Promise<WorkoutPlanSet[]>;
  updateWorkoutPlanSet(id: number, data: Partial<InsertWorkoutPlanSet>): Promise<WorkoutPlanSet>;
  deleteWorkoutPlanSet(id: number): Promise<void>;
  deleteWorkoutPlanSetsByItem(workoutItemId: number): Promise<void>;
  
  // Per-set workout logging
  createWorkoutLog(data: InsertWorkoutLog): Promise<WorkoutLog>;
  getWorkoutLog(gymId: number, memberId: number, date: string): Promise<WorkoutLog | undefined>;
  createWorkoutLogExercise(data: InsertWorkoutLogExercise): Promise<WorkoutLogExercise>;
  getWorkoutLogExercises(workoutLogId: number): Promise<WorkoutLogExercise[]>;
  createWorkoutLogSet(data: InsertWorkoutLogSet): Promise<WorkoutLogSet>;
  updateWorkoutLogSet(id: number, data: Partial<InsertWorkoutLogSet>): Promise<WorkoutLogSet>;
  getWorkoutLogSets(logExerciseId: number): Promise<WorkoutLogSet[]>;
  getDetailedWorkoutLog(gymId: number, memberId: number, date: string): Promise<{
    log: WorkoutLog;
    exercises: (WorkoutLogExercise & { sets: WorkoutLogSet[] })[];
  } | null>;
  
  // Per-set progress analytics
  getPerSetProgressSummary(memberId: number, range: 'week' | 'month' | 'year' | 'all'): Promise<{
    totalVolume: number;
    totalSets: number;
    totalReps: number;
    sessionsCount: number;
    streak: number;
    topExercises: { name: string; volume: number; sessions: number }[];
    weeklyVolume: { week: string; volume: number; sessions: number }[];
  }>;
  getExerciseAnalytics(memberId: number, exerciseName: string, range: '90d' | 'year' | 'all'): Promise<{
    dates: { date: string; volume: number; maxWeight: number | null; maxReps: number | null; est1rm: number | null }[];
    recentSets: { date: string; setNumber: number; reps: number | null; weight: string | null }[];
    pr: { maxWeight: number | null; maxReps: number | null; bestEst1rm: number | null; bestVolumeDate: string | null };
  }>;
  getPersonalRecords(memberId: number): Promise<{
    exerciseName: string;
    maxWeight: number | null;
    maxReps: number | null;
    bestEst1rm: number | null;
    bestVolumeDate: string | null;
    bestVolume: number;
  }[]>;
  
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
    subscriptionEndDate: string | null;
    subscriptionStatus: string | null;
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
  
  // Daily Workout Points
  getDailyWorkoutPoints(gymId: number, memberId: number, from: string, to: string): Promise<{
    date: string;
    plannedPoints: number;
    earnedPoints: number;
    status: "REST" | "NOT_STARTED" | "IN_PROGRESS" | "DONE_FULL" | "DONE_PARTIAL";
    completionPercent: number;
    missedPoints: number;
    missedExercises: string[];
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
  
  // Enhanced Member Profile
  getEnhancedMemberProfile(memberId: number): Promise<{
    id: number;
    publicId: string | null;
    username: string;
    email: string | null;
    phone: string | null;
    role: string;
    createdAt: Date | null;
    gym: { id: number; name: string } | null;
    trainer: { id: number; username: string } | null;
    cycle: { id: number; name: string } | null;
    subscription: { status: 'active' | 'expired' | 'none'; endDate: string | null; planName: string | null } | null;
    profile: { fullName: string; gender: string; dob: string; address: string | null; emergencyContact: string | null } | null;
  }>;
  updateMemberProfileDetails(memberId: number, data: { phone?: string; address?: string; emergencyContact?: string }): Promise<void>;
  
  // Enhanced Owner Profile
  getEnhancedOwnerProfile(ownerId: number): Promise<{
    id: number;
    publicId: string | null;
    username: string;
    email: string | null;
    phone: string | null;
    role: string;
    createdAt: Date | null;
    gym: {
      id: number;
      name: string;
      code: string;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      timings: string | null;
      gymType: string | null;
      facilities: string | null;
      createdAt: Date | null;
      onboardingData: any;
    } | null;
  }>;
  updateOwnerProfile(ownerId: number, gymId: number, data: { phone?: string; address?: string; timings?: string }): Promise<void>;
  
  // User Profiles (Onboarding)
  getUserProfile(userId: number): Promise<UserProfile | null>;
  createOrUpdateUserProfile(userId: number, data: { fullName: string; phone: string; gender: string; dob: string; age?: number; address?: string }): Promise<UserProfile>;
  setOnboardingCompleted(userId: number): Promise<void>;
  getInitialBodyMeasurement(memberId: number): Promise<BodyMeasurement | null>;
  createInitialBodyMeasurement(data: { gymId: number; memberId: number; height: number; weight: number; bodyFat?: number; chest?: number; waist?: number; hips?: number }): Promise<BodyMeasurement>;
  getMemberBodyMeasurements(memberId: number): Promise<BodyMeasurement[]>;
  
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
  
  // Training Phases
  createTrainingPhase(data: InsertTrainingPhase): Promise<TrainingPhase>;
  getTrainingPhases(gymId: number, memberId: number): Promise<(TrainingPhase & { cycleName: string | null })[]>;
  getTrainingPhaseById(phaseId: number): Promise<(TrainingPhase & { cycleName: string | null }) | undefined>;
  deleteTrainingPhase(phaseId: number): Promise<void>;
  updateTrainingPhase(phaseId: number, data: Partial<InsertTrainingPhase>): Promise<TrainingPhase>;
  getPhaseExercises(phaseId: number): Promise<PhaseExercise[]>;
  getPhaseExercise(exerciseId: number): Promise<PhaseExercise | undefined>;
  addPhaseExercise(data: InsertPhaseExercise): Promise<PhaseExercise>;
  updatePhaseExercise(exerciseId: number, data: Partial<InsertPhaseExercise>): Promise<PhaseExercise>;
  deletePhaseExercise(exerciseId: number): Promise<void>;
  copyExercisesFromCycle(phaseId: number, cycleId: number): Promise<PhaseExercise[]>;
  getActivePhaseForMember(memberId: number, gymId: number): Promise<TrainingPhase | undefined>;
  getPhaseAnalytics(phaseId: number, memberId: number, startDate: string, endDate: string, gymId: number): Promise<{
    attendanceDays: number;
    totalDays: number;
    totalPoints: number;
    avgPointsPerDay: number;
    totalWorkouts: number;
    startWeight: number | null;
    endWeight: number | null;
    weightChange: number | null;
    pointsTrend: { date: string; points: number }[];
    weightTrend: { date: string; weight: number }[];
    dailyWorkouts: { date: string; exercises: { name: string; sets: number; reps: number; weight: string }[]; points: number; expectedPoints: number }[];
  }>;
  
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
      completionId: number | null;
      exerciseName: string;
      muscleType: string;
      sets: number;
      reps: number;
      weight: string | null;
      actualSets: number | null;
      actualReps: number | null;
      actualWeight: string | null;
      notes: string | null;
      completed: boolean;
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
    restRecoveryStats: {
      workoutDays: number;
      restDays: number;
      last30Days: { workoutDays: number; restDays: number };
      breakdown: { name: string; value: number; percentage: number }[];
      trackingWindowDays: number;
    };
  }>;
  getMemberCalendar(memberId: number, month: string): Promise<{ date: string; title: string; count: number }[]>;
  getMemberCalendarEnhanced(gymId: number, memberId: number, month: string, clientToday?: string): Promise<{
    date: string;
    status: "present" | "absent" | "rest" | "future";
    completed: { name: string; sets: number; reps: number; weight: string | null }[];
    missed: { name: string; sets: number; reps: number; weight: string | null }[];
  }[]>;
  getMemberDailyAnalytics(gymId: number, memberId: number, date: string): Promise<{
    date: string;
    totalExercises: number;
    completedCount: number;
    missedCount: number;
    totalVolume: number;
    muscleBreakdown: { muscle: string; count: number; volume: number }[];
    exercises: {
      name: string;
      muscle: string;
      sets: number;
      reps: number;
      weight: string | null;
      completed: boolean;
      volume: number;
    }[];
  }>;
  
  // Owner Dashboard & Attendance Analytics
  getOwnerDashboardMetrics(gymId: number): Promise<{
    totalMembers: number;
    checkedInToday: number;
    checkedInYesterday: number;
    newEnrollmentsLast30Days: number;
    pendingPayments: number;
    totalRevenue: number;
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
  getSubscriptionsWithPayments(gymId: number): Promise<(MemberSubscription & { plan: MembershipPlan | null; transactions: PaymentTransaction[] })[]>;
  
  // Payment Transactions
  getSubscriptionTransactions(subscriptionId: number): Promise<PaymentTransaction[]>;
  addPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  
  // Member Payment Details (for owner view)
  getMemberPaymentDetails(memberId: number, gymId: number): Promise<{
    subscription: (MemberSubscription & { plan: MembershipPlan | null }) | null;
    totalPaid: number;
    remainingBalance: number;
    transactions: PaymentTransaction[];
  } | null>;
  
  // Revenue Analytics
  getRevenueAnalytics(gymId: number, month: string): Promise<{
    monthlyRevenue: number;
    totalTransactions: number;
    uniquePayers: number;
    transactions: (PaymentTransaction & { member: User })[];
    monthlyBreakdown: { month: string; revenue: number }[];
  }>;
  
  // Subscription Alerts
  getSubscriptionAlerts(gymId: number): Promise<{ active: number; endingSoon: number; overdue: number; needSubscription: number }>;
  getMembersNeedingSubscription(gymId: number): Promise<{ id: number; username: string; publicId: string | null; createdAt: Date | null }[]>;
  updateExpiredSubscriptions(gymId: number): Promise<void>;
  
  // Member Analytics
  getMemberAnalytics(gymId: number): Promise<{
    counts: { active: number; ended: number; transferredOut: number; transferredIn: number };
    activeMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; trainerName: string | null }[];
    endedMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; reason: string }[];
    transferredOut: { id: number; username: string; publicId: string | null; toGymName: string; transferDate: string }[];
    transferredIn: { id: number; username: string; publicId: string | null; fromGymName: string; transferDate: string }[];
    monthlyTrend: { month: string; active: number; ended: number }[];
  }>;
  
  // Inactive Members
  getInactiveMembers(gymId: number, options: {
    days: number;
    includeEnded: boolean;
    mode: 'attendance' | 'workouts';
    clientDate: string;
    search?: string;
  }): Promise<{
    memberId: number;
    name: string;
    email: string | null;
    publicId: string | null;
    status: 'active' | 'ended' | 'transferred';
    lastAttendedDate: string | null;
    daysAbsent: number;
  }[]>;
  
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
  getMemberSessionHistory(gymId: number, memberId: number, from?: string, to?: string): Promise<{
    sessionId: number;
    date: string;
    focusLabel: string;
  }[]>;
  
  updateWorkoutSessionExercise(exerciseId: number, gymId: number, memberId: number, data: { sets?: number; reps?: number; weight?: string; notes?: string }): Promise<WorkoutSessionExercise | null>;
  
  // Cycle Schedule - Full cycle with planned + completed merged
  getCycleSchedule(gymId: number, memberId: number): Promise<{
    cycleId: number | null;
    cycleName: string | null;
    cycleLength: number;
    startDate: string | null;
    endDate: string | null;
    schedule: {
      date: string;
      dayIndex: number;
      dayLabel: string;
      status: "done" | "in_progress" | "not_started" | "rest_day";
      isManuallyCompleted: boolean;
      completedExercises: number;
      totalExercises: number;
      sessionId: number | null;
    }[];
  }>;
  
  // Mark day done (partial completion)
  markDayDone(gymId: number, memberId: number, date: string): Promise<{ success: boolean; sessionId: number }>;
  
  // Missed workouts
  getMissedWorkouts(gymId: number, memberId: number, from?: string, to?: string): Promise<{
    date: string;
    dayLabel: string;
    completedCount: number;
    totalCount: number;
    status: "missed" | "partial";
    missedExercises: string[];
  }[]>;
  
  // Gym Requests (Owner onboarding)
  createGymRequest(data: InsertGymRequest): Promise<GymRequest>;
  getGymRequestByOwner(ownerUserId: number): Promise<GymRequest | undefined>;
  getGymRequestById(requestId: number): Promise<(GymRequest & { ownerName: string; ownerEmail: string | null }) | undefined>;
  getPendingGymRequests(): Promise<(GymRequest & { ownerName: string })[]>;
  approveGymRequest(requestId: number): Promise<{ gymRequest: GymRequest; gym: Gym }>;
  rejectGymRequest(requestId: number, adminNotes: string): Promise<GymRequest>;
  
  // Join Requests (Trainer/Member joining gym)
  createJoinRequest(data: InsertJoinRequest): Promise<JoinRequest>;
  getJoinRequestByUser(userId: number): Promise<(JoinRequest & { gymName: string; gymCode: string }) | undefined>;
  getPendingJoinRequestsForGym(gymId: number): Promise<(JoinRequest & { userName: string; userRole: string })[]>;
  approveJoinRequest(requestId: number): Promise<JoinRequest>;
  rejectJoinRequest(requestId: number): Promise<JoinRequest>;
  
  // Admin functions
  getAllGymRequestsWithOwner(): Promise<(GymRequest & { ownerName: string; ownerEmail: string | null })[]>;
  getAllGymsWithDetails(filters?: { name?: string; city?: string; state?: string }): Promise<{
    id: number;
    name: string;
    code: string;
    city: string | null;
    state: string | null;
    country: string | null;
    createdAt: Date | null;
    ownerName: string | null;
    ownerEmail: string | null;
    subscriptionStatus: string | null;
    planType: string | null;
    validUntil: Date | null;
  }[]>;
  getGymSubscription(gymId: number): Promise<GymSubscription | null>;
  getAllGymSubscriptions(): Promise<(GymSubscription & { gymName: string })[]>;
  upsertGymSubscription(gymId: number, data: Partial<InsertGymSubscription>): Promise<GymSubscription>;
  
  // Workout Templates
  getWorkoutTemplates(gymId: number, trainerId: number): Promise<WorkoutTemplate[]>;
  getWorkoutTemplate(templateId: number): Promise<(WorkoutTemplate & { items: WorkoutTemplateItem[] }) | null>;
  createWorkoutTemplate(data: InsertWorkoutTemplate): Promise<WorkoutTemplate>;
  createWorkoutTemplateItems(items: InsertWorkoutTemplateItem[]): Promise<WorkoutTemplateItem[]>;
  deleteWorkoutTemplate(templateId: number, trainerId: number): Promise<void>;
  assignTemplateToMember(templateId: number, memberId: number, startDate: string, endDate: string, gymId: number, trainerId: number): Promise<WorkoutCycle>;
  
  // Body Measurements
  getBodyMeasurements(gymId: number, memberId: number): Promise<BodyMeasurement[]>;
  getLatestBodyMeasurement(gymId: number, memberId: number): Promise<BodyMeasurement | null>;
  createBodyMeasurement(data: InsertBodyMeasurement): Promise<BodyMeasurement>;
  
  // Member Notes
  getMemberNotes(gymId: number, trainerId: number, memberId: number): Promise<MemberNote[]>;
  createMemberNote(data: InsertMemberNote): Promise<MemberNote>;
  deleteMemberNote(noteId: number, trainerId: number): Promise<void>;
  
  // Social Feed
  getFeedPosts(gymId: number, limit?: number): Promise<(FeedPost & { user: User; reactions: FeedReaction[]; commentCount: number })[]>;
  getFeedPost(postId: number): Promise<FeedPost | null>;
  getMemberFeedPostsForDate(memberId: number, date: string): Promise<FeedPost[]>;
  createFeedPost(data: InsertFeedPost): Promise<FeedPost>;
  getFeedPostReactions(postId: number): Promise<FeedReaction[]>;
  addFeedReaction(data: InsertFeedReaction): Promise<FeedReaction>;
  removeFeedReaction(postId: number, userId: number): Promise<void>;
  getFeedComments(postId: number): Promise<(FeedComment & { user: User })[]>;
  addFeedComment(data: InsertFeedComment): Promise<FeedComment>;
  deleteFeedComment(commentId: number, userId: number): Promise<void>;
  hideFeedPost(postId: number, gymId: number): Promise<void>;
  
  // Tournaments
  getTournaments(gymId: number): Promise<Tournament[]>;
  getTournament(tournamentId: number): Promise<Tournament | null>;
  createTournament(data: InsertTournament): Promise<Tournament>;
  updateTournament(tournamentId: number, data: Partial<InsertTournament>): Promise<Tournament>;
  getTournamentParticipants(tournamentId: number): Promise<(TournamentParticipant & { user: User })[]>;
  joinTournament(data: InsertTournamentParticipant): Promise<TournamentParticipant>;
  leaveTournament(tournamentId: number, userId: number): Promise<void>;
  updateTournamentScores(tournamentId: number): Promise<void>;
  getTournamentLeaderboard(tournamentId: number): Promise<{ rank: number; username: string; score: number; userId: number }[]>;
  
  // Rest Day Swaps
  getActiveRestDaySwap(memberId: number, cycleId: number, date: string): Promise<MemberRestDaySwap | null>;
  createRestDaySwap(data: InsertMemberRestDaySwap): Promise<MemberRestDaySwap>;
  deleteRestDaySwap(swapId: number, memberId: number): Promise<void>;
  
  // Support System
  createSupportTicket(data: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(ticketId: number): Promise<(SupportTicket & { messages: SupportMessage[] }) | null>;
  getSupportTickets(filters?: { status?: string; priority?: string; issueType?: string; gymId?: number }): Promise<SupportTicket[]>;
  getUserSupportTickets(userId: number): Promise<SupportTicket[]>;
  updateSupportTicketStatus(ticketId: number, status: string): Promise<SupportTicket>;
  createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessages(ticketId: number): Promise<SupportMessage[]>;
  
  // Admin Support (enriched with gym/user info)
  getAdminSupportTickets(filters?: { status?: string; priority?: string; issueType?: string; gymId?: number }): Promise<AdminSupportTicket[]>;
  getAdminSupportTicket(ticketId: number): Promise<AdminSupportTicketDetail | null>;
  
  // Admin User Management
  getGymWithRoster(gymId: number): Promise<GymRoster | null>;
  getAllGymsWithOwners(): Promise<GymWithOwner[]>;
  adminUpdateUser(userId: number, data: Partial<{ username: string; email: string; phone: string; status: string }>): Promise<User>;
  adminResetPassword(userId: number, hashedPassword: string): Promise<void>;
  adminMoveUserToGym(userId: number, newGymId: number | null): Promise<User>;
  adminReassignTrainer(memberId: number, newTrainerId: number | null): Promise<void>;
  
  // Audit Logs
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { entityType?: string; entityId?: number; adminId?: number }): Promise<(AuditLog & { adminName: string })[]>;
}

// Admin Types
export type AdminSupportTicket = SupportTicket & {
  gymName: string | null;
  gymCode: string | null;
  gymCity: string | null;
  gymState: string | null;
  userName: string | null;
  userEmail: string | null;
};

export type AdminSupportTicketDetail = AdminSupportTicket & {
  messages: SupportMessage[];
};

export type GymWithOwner = Gym & {
  ownerName: string | null;
  ownerEmail: string | null;
  ownerId: number | null;
};

export type GymRoster = {
  gym: Gym;
  owner: User | null;
  trainers: User[];
  members: User[];
};

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
      errorLog: console.error.bind(console),
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserVerificationCode(userId: number, code: string, expiresAt: Date): Promise<void> {
    await db.update(users).set({
      verificationCode: code,
      verificationExpiresAt: expiresAt,
    }).where(eq(users.id, userId));
  }

  async verifyUserEmail(userId: number): Promise<void> {
    await db.update(users).set({
      emailVerified: true,
      verificationCode: null,
      verificationExpiresAt: null,
    }).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async createPasswordResetCode(email: string, codeHash: string, expiresAt: Date): Promise<PasswordResetCode> {
    const [code] = await db.insert(passwordResetCodes).values({
      email,
      codeHash,
      expiresAt,
      used: false,
    }).returning();
    return code;
  }

  async getValidPasswordResetCode(email: string): Promise<PasswordResetCode | null> {
    const [code] = await db.select().from(passwordResetCodes).where(
      and(
        eq(passwordResetCodes.email, email),
        eq(passwordResetCodes.used, false),
        gte(passwordResetCodes.expiresAt, new Date())
      )
    ).orderBy(desc(passwordResetCodes.createdAt)).limit(1);
    return code || null;
  }

  async markPasswordResetCodeUsed(codeId: number): Promise<void> {
    await db.update(passwordResetCodes).set({ used: true }).where(eq(passwordResetCodes.id, codeId));
  }

  async invalidatePasswordResetCodes(email: string): Promise<void> {
    await db.update(passwordResetCodes).set({ used: true }).where(
      and(eq(passwordResetCodes.email, email), eq(passwordResetCodes.used, false))
    );
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

  async updateUserAutoPost(userId: number, autoPostEnabled: boolean): Promise<void> {
    await db.update(users).set({ autoPostEnabled }).where(eq(users.id, userId));
  }

  async getUserPosts(userId: number): Promise<FeedPost[]> {
    return await db.select().from(feedPosts).where(eq(feedPosts.userId, userId)).orderBy(desc(feedPosts.createdAt));
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
    // Close any existing assignment for this member in this gym
    await db.update(trainerMemberAssignments)
      .set({ endedAt: new Date(), endReason: 'reassignment' })
      .where(and(
        eq(trainerMemberAssignments.gymId, gymId),
        eq(trainerMemberAssignments.memberId, memberId),
        isNull(trainerMemberAssignments.endedAt)
      ));
    
    // Delete current assignment from trainerMembers
    await db.delete(trainerMembers).where(
      and(eq(trainerMembers.gymId, gymId), eq(trainerMembers.memberId, memberId))
    );
    
    // Create new current assignment
    const [assignment] = await db.insert(trainerMembers).values({
      trainerId, memberId, gymId
    }).returning();
    
    // Record in assignment history
    await db.insert(trainerMemberAssignments).values({
      trainerId, memberId, gymId, startedAt: new Date()
    });
    
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

  async getMemberCycles(memberId: number): Promise<WorkoutCycle[]> {
    return await db.select().from(workoutCycles)
      .where(eq(workoutCycles.memberId, memberId))
      .orderBy(desc(workoutCycles.createdAt));
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

  async updateCycleRestDays(cycleId: number, restDays: number[]): Promise<WorkoutCycle> {
    const [cycle] = await db.update(workoutCycles)
      .set({ restDays })
      .where(eq(workoutCycles.id, cycleId))
      .returning();
    return cycle;
  }

  async updateCycleStructure(cycleId: number, cycleLength: number, dayLabels: string[], restDays: number[]): Promise<WorkoutCycle> {
    const [cycle] = await db.update(workoutCycles)
      .set({ cycleLength, dayLabels, restDays })
      .where(eq(workoutCycles.id, cycleId))
      .returning();
    return cycle;
  }

  async deleteWorkoutItemsByDay(cycleId: number, dayIndex: number): Promise<void> {
    // Soft-delete to preserve historical workout completions
    await db.update(workoutItems)
      .set({ isDeleted: true })
      .where(and(eq(workoutItems.cycleId, cycleId), eq(workoutItems.dayIndex, dayIndex)));
  }

  async shiftWorkoutItemsDays(cycleId: number, fromDayIndex: number, shiftAmount: number): Promise<void> {
    const items = await db.select().from(workoutItems)
      .where(and(
        eq(workoutItems.cycleId, cycleId),
        gte(workoutItems.dayIndex, fromDayIndex),
        eq(workoutItems.isDeleted, false)
      ));
    
    for (const item of items) {
      const newDayIndex = Math.max(0, item.dayIndex + shiftAmount);
      await db.update(workoutItems)
        .set({ dayIndex: newDayIndex })
        .where(eq(workoutItems.id, item.id));
    }
  }

  async updateCycleDayIndex(cycleId: number, currentDayIndex: number): Promise<WorkoutCycle> {
    const [cycle] = await db.update(workoutCycles)
      .set({ currentDayIndex })
      .where(eq(workoutCycles.id, cycleId))
      .returning();
    return cycle;
  }

  async updateCycleDayIndexAndLastWorkout(cycleId: number, currentDayIndex: number, lastWorkoutDate: string): Promise<WorkoutCycle> {
    const [cycle] = await db.update(workoutCycles)
      .set({ currentDayIndex, lastWorkoutDate })
      .where(eq(workoutCycles.id, cycleId))
      .returning();
    return cycle;
  }

  async addWorkoutItem(data: InsertWorkoutItem): Promise<WorkoutItem> {
    const [item] = await db.insert(workoutItems).values(data).returning();
    return item;
  }

  async deleteWorkoutItem(itemId: number): Promise<void> {
    // Soft-delete to preserve historical workout completions
    await db.update(workoutItems)
      .set({ isDeleted: true })
      .where(eq(workoutItems.id, itemId));
  }

  async getWorkoutItems(cycleId: number): Promise<WorkoutItem[]> {
    return await db.select().from(workoutItems)
      .where(and(
        eq(workoutItems.cycleId, cycleId),
        eq(workoutItems.isDeleted, false)
      ))
      .orderBy(workoutItems.dayIndex, workoutItems.orderIndex);
  }

  async getWorkoutItemsByDay(cycleId: number, dayIndex: number): Promise<WorkoutItem[]> {
    return await db.select().from(workoutItems)
      .where(and(
        eq(workoutItems.cycleId, cycleId),
        eq(workoutItems.dayIndex, dayIndex),
        eq(workoutItems.isDeleted, false)
      ))
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

  async completePhaseExercise(data: {
    gymId: number;
    phaseExerciseId: number;
    memberId: number;
    completedDate: string;
    exerciseName: string;
    actualSets?: number | null;
    actualReps?: number | null;
    actualWeight?: string | null;
  }): Promise<WorkoutCompletion> {
    const [record] = await db.insert(workoutCompletions).values({
      gymId: data.gymId,
      phaseExerciseId: data.phaseExerciseId,
      memberId: data.memberId,
      completedDate: data.completedDate,
      exerciseName: data.exerciseName,
      actualSets: data.actualSets,
      actualReps: data.actualReps,
      actualWeight: data.actualWeight
    }).returning();
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

  // Per-set workout plan targets
  async getWorkoutPlanSets(workoutItemId: number): Promise<WorkoutPlanSet[]> {
    return await db.select().from(workoutPlanSets)
      .where(and(
        eq(workoutPlanSets.workoutItemId, workoutItemId),
        eq(workoutPlanSets.isDeleted, false)
      ))
      .orderBy(workoutPlanSets.setNumber);
  }

  async createWorkoutPlanSets(sets: InsertWorkoutPlanSet[]): Promise<WorkoutPlanSet[]> {
    if (sets.length === 0) return [];
    return await db.insert(workoutPlanSets).values(sets).returning();
  }

  async updateWorkoutPlanSet(id: number, data: Partial<InsertWorkoutPlanSet>): Promise<WorkoutPlanSet> {
    const [updated] = await db.update(workoutPlanSets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workoutPlanSets.id, id))
      .returning();
    return updated;
  }

  async deleteWorkoutPlanSet(id: number): Promise<void> {
    await db.update(workoutPlanSets)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(workoutPlanSets.id, id));
  }

  async deleteWorkoutPlanSetsByItem(workoutItemId: number): Promise<void> {
    await db.update(workoutPlanSets)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(workoutPlanSets.workoutItemId, workoutItemId));
  }

  // Per-set workout logging
  async createWorkoutLog(data: InsertWorkoutLog): Promise<WorkoutLog> {
    const [log] = await db.insert(workoutLogs).values(data).returning();
    return log;
  }

  async getWorkoutLog(gymId: number, memberId: number, date: string): Promise<WorkoutLog | undefined> {
    const [log] = await db.select().from(workoutLogs)
      .where(and(
        eq(workoutLogs.gymId, gymId),
        eq(workoutLogs.memberId, memberId),
        eq(workoutLogs.completedDate, date)
      ));
    return log;
  }

  async createWorkoutLogExercise(data: InsertWorkoutLogExercise): Promise<WorkoutLogExercise> {
    const [exercise] = await db.insert(workoutLogExercises).values(data).returning();
    return exercise;
  }

  async getWorkoutLogExercises(workoutLogId: number): Promise<WorkoutLogExercise[]> {
    return await db.select().from(workoutLogExercises)
      .where(eq(workoutLogExercises.workoutLogId, workoutLogId))
      .orderBy(workoutLogExercises.orderIndex);
  }

  async createWorkoutLogSet(data: InsertWorkoutLogSet): Promise<WorkoutLogSet> {
    const [set] = await db.insert(workoutLogSets).values(data).returning();
    return set;
  }

  async updateWorkoutLogSet(id: number, data: Partial<InsertWorkoutLogSet>): Promise<WorkoutLogSet> {
    const [updated] = await db.update(workoutLogSets)
      .set(data)
      .where(eq(workoutLogSets.id, id))
      .returning();
    return updated;
  }

  async getWorkoutLogSets(logExerciseId: number): Promise<WorkoutLogSet[]> {
    return await db.select().from(workoutLogSets)
      .where(eq(workoutLogSets.logExerciseId, logExerciseId))
      .orderBy(workoutLogSets.setNumber);
  }

  async getDetailedWorkoutLog(gymId: number, memberId: number, date: string): Promise<{
    log: WorkoutLog;
    exercises: (WorkoutLogExercise & { sets: WorkoutLogSet[] })[];
  } | null> {
    const log = await this.getWorkoutLog(gymId, memberId, date);
    if (!log) return null;

    const exercises = await this.getWorkoutLogExercises(log.id);
    const exercisesWithSets = await Promise.all(
      exercises.map(async (ex) => ({
        ...ex,
        sets: await this.getWorkoutLogSets(ex.id),
      }))
    );

    return { log, exercises: exercisesWithSets };
  }

  // Per-set progress analytics implementation
  async getPerSetProgressSummary(memberId: number, range: 'week' | 'month' | 'year' | 'all'): Promise<{
    totalVolume: number;
    totalSets: number;
    totalReps: number;
    sessionsCount: number;
    streak: number;
    topExercises: { name: string; volume: number; sessions: number }[];
    weeklyVolume: { week: string; volume: number; sessions: number }[];
  }> {
    const today = new Date();
    let startDate: string | null = null;
    
    if (range === 'week') {
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (range === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    } else if (range === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
    }
    
    // Get all completed workout logs for this member
    let logsQuery = db.select().from(workoutLogs)
      .where(and(
        eq(workoutLogs.memberId, memberId),
        isNotNull(workoutLogs.completedAt)
      ));
    
    const allLogs = await logsQuery;
    const filteredLogs = startDate 
      ? allLogs.filter(l => l.completedDate >= startDate!)
      : allLogs;
    
    const logIds = filteredLogs.map(l => l.id);
    if (logIds.length === 0) {
      const basicStats = await this.getMemberStats(memberId);
      return {
        totalVolume: 0,
        totalSets: 0,
        totalReps: 0,
        sessionsCount: 0,
        streak: basicStats.streak,
        topExercises: [],
        weeklyVolume: []
      };
    }
    
    // Get all exercises for these logs
    const allExercises = await db.select().from(workoutLogExercises)
      .where(inArray(workoutLogExercises.workoutLogId, logIds));
    
    const exerciseIds = allExercises.map(e => e.id);
    
    // Get all sets for these exercises
    const allSets = exerciseIds.length > 0 
      ? await db.select().from(workoutLogSets)
          .where(inArray(workoutLogSets.logExerciseId, exerciseIds))
      : [];
    
    // Calculate totals
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;
    
    for (const set of allSets) {
      if (set.actualReps) {
        totalReps += set.actualReps;
        totalSets++;
        if (set.actualWeight) {
          const weight = parseFloat(set.actualWeight);
          if (!isNaN(weight)) {
            totalVolume += set.actualReps * weight;
          }
        }
      }
    }
    
    // Calculate top exercises
    const exerciseMap = new Map<string, { volume: number; sessions: Set<number> }>();
    for (const ex of allExercises) {
      const exSets = allSets.filter(s => s.logExerciseId === ex.id);
      let exVolume = 0;
      for (const set of exSets) {
        if (set.actualReps && set.actualWeight) {
          const weight = parseFloat(set.actualWeight);
          if (!isNaN(weight)) {
            exVolume += set.actualReps * weight;
          }
        }
      }
      if (!exerciseMap.has(ex.exerciseName)) {
        exerciseMap.set(ex.exerciseName, { volume: 0, sessions: new Set() });
      }
      const data = exerciseMap.get(ex.exerciseName)!;
      data.volume += exVolume;
      data.sessions.add(ex.workoutLogId);
    }
    
    const topExercises = Array.from(exerciseMap.entries())
      .map(([name, data]) => ({ name, volume: data.volume, sessions: data.sessions.size }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
    
    // Calculate weekly volume
    const weekMap = new Map<string, { volume: number; sessions: Set<number> }>();
    for (const log of filteredLogs) {
      const logDate = new Date(log.completedDate);
      const weekStart = new Date(logDate);
      weekStart.setDate(logDate.getDate() - logDate.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { volume: 0, sessions: new Set() });
      }
      const weekData = weekMap.get(weekKey)!;
      weekData.sessions.add(log.id);
      
      const logExercises = allExercises.filter(e => e.workoutLogId === log.id);
      for (const ex of logExercises) {
        const exSets = allSets.filter(s => s.logExerciseId === ex.id);
        for (const set of exSets) {
          if (set.actualReps && set.actualWeight) {
            const weight = parseFloat(set.actualWeight);
            if (!isNaN(weight)) {
              weekData.volume += set.actualReps * weight;
            }
          }
        }
      }
    }
    
    const weeklyVolume = Array.from(weekMap.entries())
      .map(([week, data]) => ({ week, volume: data.volume, sessions: data.sessions.size }))
      .sort((a, b) => a.week.localeCompare(b.week));
    
    const basicStats = await this.getMemberStats(memberId);
    
    return {
      totalVolume: Math.round(totalVolume),
      totalSets,
      totalReps,
      sessionsCount: filteredLogs.length,
      streak: basicStats.streak,
      topExercises,
      weeklyVolume
    };
  }

  async getExerciseAnalytics(memberId: number, exerciseName: string, range: '90d' | 'year' | 'all'): Promise<{
    dates: { date: string; volume: number; maxWeight: number | null; maxReps: number | null; est1rm: number | null }[];
    recentSets: { date: string; setNumber: number; reps: number | null; weight: string | null }[];
    pr: { maxWeight: number | null; maxReps: number | null; bestEst1rm: number | null; bestVolumeDate: string | null };
  }> {
    const today = new Date();
    let startDate: string | null = null;
    
    if (range === '90d') {
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (range === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
    }
    
    // Get all workout logs for this member
    const allLogs = await db.select().from(workoutLogs)
      .where(and(
        eq(workoutLogs.memberId, memberId),
        isNotNull(workoutLogs.completedAt)
      ));
    
    const filteredLogs = startDate 
      ? allLogs.filter(l => l.completedDate >= startDate!)
      : allLogs;
    
    if (filteredLogs.length === 0) {
      return {
        dates: [],
        recentSets: [],
        pr: { maxWeight: null, maxReps: null, bestEst1rm: null, bestVolumeDate: null }
      };
    }
    
    const logIds = filteredLogs.map(l => l.id);
    
    // Get exercises matching the name
    const exercises = await db.select().from(workoutLogExercises)
      .where(and(
        inArray(workoutLogExercises.workoutLogId, logIds),
        sql`LOWER(${workoutLogExercises.exerciseName}) = LOWER(${exerciseName})`
      ));
    
    if (exercises.length === 0) {
      return {
        dates: [],
        recentSets: [],
        pr: { maxWeight: null, maxReps: null, bestEst1rm: null, bestVolumeDate: null }
      };
    }
    
    const exerciseIds = exercises.map(e => e.id);
    const allSets = await db.select().from(workoutLogSets)
      .where(inArray(workoutLogSets.logExerciseId, exerciseIds));
    
    // Calculate per-date analytics
    const dateMap = new Map<string, { volume: number; maxWeight: number; maxReps: number; best1rm: number }>();
    let globalMaxWeight: number | null = null;
    let globalMaxReps: number | null = null;
    let globalBest1rm: number | null = null;
    let bestVolumeDate: string | null = null;
    let bestVolume = 0;
    
    for (const ex of exercises) {
      const log = filteredLogs.find(l => l.id === ex.workoutLogId);
      if (!log) continue;
      
      const exSets = allSets.filter(s => s.logExerciseId === ex.id);
      let dayVolume = 0;
      let dayMaxWeight = 0;
      let dayMaxReps = 0;
      let dayBest1rm = 0;
      
      for (const set of exSets) {
        const reps = set.actualReps || 0;
        const weight = set.actualWeight ? parseFloat(set.actualWeight) : 0;
        
        if (reps > 0) {
          if (reps > dayMaxReps) dayMaxReps = reps;
          if (globalMaxReps === null || reps > globalMaxReps) globalMaxReps = reps;
        }
        
        if (weight > 0) {
          if (weight > dayMaxWeight) dayMaxWeight = weight;
          if (globalMaxWeight === null || weight > globalMaxWeight) globalMaxWeight = weight;
          dayVolume += reps * weight;
          
          // Epley 1RM formula for reps 1-12
          if (reps >= 1 && reps <= 12) {
            const est1rm = weight * (1 + reps / 30);
            if (est1rm > dayBest1rm) dayBest1rm = est1rm;
            if (globalBest1rm === null || est1rm > globalBest1rm) globalBest1rm = est1rm;
          }
        }
      }
      
      if (!dateMap.has(log.completedDate)) {
        dateMap.set(log.completedDate, { volume: 0, maxWeight: 0, maxReps: 0, best1rm: 0 });
      }
      const dateData = dateMap.get(log.completedDate)!;
      dateData.volume += dayVolume;
      if (dayMaxWeight > dateData.maxWeight) dateData.maxWeight = dayMaxWeight;
      if (dayMaxReps > dateData.maxReps) dateData.maxReps = dayMaxReps;
      if (dayBest1rm > dateData.best1rm) dateData.best1rm = dayBest1rm;
      
      if (dayVolume > bestVolume) {
        bestVolume = dayVolume;
        bestVolumeDate = log.completedDate;
      }
    }
    
    const dates = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        volume: Math.round(data.volume),
        maxWeight: data.maxWeight > 0 ? data.maxWeight : null,
        maxReps: data.maxReps > 0 ? data.maxReps : null,
        est1rm: data.best1rm > 0 ? Math.round(data.best1rm * 10) / 10 : null
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Recent sets (last 20)
    const recentSets: { date: string; setNumber: number; reps: number | null; weight: string | null }[] = [];
    const sortedExercises = exercises
      .map(e => ({ ...e, log: filteredLogs.find(l => l.id === e.workoutLogId) }))
      .filter(e => e.log)
      .sort((a, b) => b.log!.completedDate.localeCompare(a.log!.completedDate));
    
    for (const ex of sortedExercises.slice(0, 5)) {
      const exSets = allSets.filter(s => s.logExerciseId === ex.id).sort((a, b) => a.setNumber - b.setNumber);
      for (const set of exSets) {
        recentSets.push({
          date: ex.log!.completedDate,
          setNumber: set.setNumber,
          reps: set.actualReps,
          weight: set.actualWeight
        });
      }
    }
    
    return {
      dates,
      recentSets: recentSets.slice(0, 20),
      pr: {
        maxWeight: globalMaxWeight,
        maxReps: globalMaxReps,
        bestEst1rm: globalBest1rm ? Math.round(globalBest1rm * 10) / 10 : null,
        bestVolumeDate
      }
    };
  }

  async getPersonalRecords(memberId: number): Promise<{
    exerciseName: string;
    maxWeight: number | null;
    maxReps: number | null;
    bestEst1rm: number | null;
    bestVolumeDate: string | null;
    bestVolume: number;
  }[]> {
    // Get all completed workout logs for this member
    const allLogs = await db.select().from(workoutLogs)
      .where(and(
        eq(workoutLogs.memberId, memberId),
        isNotNull(workoutLogs.completedAt)
      ));
    
    if (allLogs.length === 0) return [];
    
    const logIds = allLogs.map(l => l.id);
    
    // Get all exercises
    const allExercises = await db.select().from(workoutLogExercises)
      .where(inArray(workoutLogExercises.workoutLogId, logIds));
    
    if (allExercises.length === 0) return [];
    
    const exerciseIds = allExercises.map(e => e.id);
    const allSets = await db.select().from(workoutLogSets)
      .where(inArray(workoutLogSets.logExerciseId, exerciseIds));
    
    // Group by exercise name
    const exerciseMap = new Map<string, {
      maxWeight: number;
      maxReps: number;
      bestEst1rm: number;
      volumeByDate: Map<string, number>;
    }>();
    
    for (const ex of allExercises) {
      const log = allLogs.find(l => l.id === ex.workoutLogId);
      if (!log) continue;
      
      const name = ex.exerciseName.toLowerCase();
      if (!exerciseMap.has(name)) {
        exerciseMap.set(name, { maxWeight: 0, maxReps: 0, bestEst1rm: 0, volumeByDate: new Map() });
      }
      const data = exerciseMap.get(name)!;
      
      const exSets = allSets.filter(s => s.logExerciseId === ex.id);
      let dayVolume = 0;
      
      for (const set of exSets) {
        const reps = set.actualReps || 0;
        const weight = set.actualWeight ? parseFloat(set.actualWeight) : 0;
        
        if (reps > data.maxReps) data.maxReps = reps;
        if (weight > data.maxWeight) data.maxWeight = weight;
        
        if (weight > 0 && reps > 0) {
          dayVolume += reps * weight;
          if (reps >= 1 && reps <= 12) {
            const est1rm = weight * (1 + reps / 30);
            if (est1rm > data.bestEst1rm) data.bestEst1rm = est1rm;
          }
        }
      }
      
      const currentVolume = data.volumeByDate.get(log.completedDate) || 0;
      data.volumeByDate.set(log.completedDate, currentVolume + dayVolume);
    }
    
    // Build result
    const result: {
      exerciseName: string;
      maxWeight: number | null;
      maxReps: number | null;
      bestEst1rm: number | null;
      bestVolumeDate: string | null;
      bestVolume: number;
    }[] = [];
    
    for (const [name, data] of exerciseMap.entries()) {
      let bestVolumeDate: string | null = null;
      let bestVolume = 0;
      for (const [date, volume] of data.volumeByDate.entries()) {
        if (volume > bestVolume) {
          bestVolume = volume;
          bestVolumeDate = date;
        }
      }
      
      // Capitalize exercise name
      const displayName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      result.push({
        exerciseName: displayName,
        maxWeight: data.maxWeight > 0 ? data.maxWeight : null,
        maxReps: data.maxReps > 0 ? data.maxReps : null,
        bestEst1rm: data.bestEst1rm > 0 ? Math.round(data.bestEst1rm * 10) / 10 : null,
        bestVolumeDate,
        bestVolume: Math.round(bestVolume)
      });
    }
    
    return result.sort((a, b) => b.bestVolume - a.bestVolume);
  }

  async getAnalyticsExplanationWithExample(memberId: number): Promise<{
    explanations: {
      metric: string;
      definition: string;
      formula: string;
      tablesUsed: string;
    }[];
    exampleCalculation: {
      workoutDate: string;
      exercises: {
        name: string;
        sets: { setNumber: number; reps: number | null; weight: number | null; setVolume: number }[];
        exerciseVolume: number;
      }[];
      dayVolume: number;
      totalSets: number;
      totalReps: number;
    } | null;
    streakExplanation: {
      currentStreak: number;
      lastCompletedDate: string | null;
      explanation: string;
    };
  }> {
    const explanations = [
      {
        metric: "Set Volume",
        definition: "The volume for a single set, calculated as reps multiplied by weight.",
        formula: "set_volume = actual_reps × actual_weight",
        tablesUsed: "workout_log_sets (actual_reps, actual_weight)"
      },
      {
        metric: "Exercise Volume",
        definition: "Total volume for one exercise on a given day, summing all set volumes.",
        formula: "exercise_volume = Σ(set_volume) for all sets of that exercise",
        tablesUsed: "workout_log_exercises, workout_log_sets"
      },
      {
        metric: "Day/Workout Volume",
        definition: "Total volume for all exercises completed in a single workout session.",
        formula: "day_volume = Σ(exercise_volume) for all exercises that day",
        tablesUsed: "workout_logs, workout_log_exercises, workout_log_sets"
      },
      {
        metric: "Weekly/Monthly Volume",
        definition: "Sum of all day volumes within the selected time range.",
        formula: "weekly_volume = Σ(day_volume) within week range",
        tablesUsed: "workout_logs (completed_date), workout_log_sets"
      },
      {
        metric: "Total Sets",
        definition: "Count of all logged sets where actual_reps is recorded.",
        formula: "total_sets = COUNT(sets) WHERE actual_reps IS NOT NULL",
        tablesUsed: "workout_log_sets (actual_reps)"
      },
      {
        metric: "Total Reps",
        definition: "Sum of all reps across all completed sets.",
        formula: "total_reps = Σ(actual_reps) across all sets",
        tablesUsed: "workout_log_sets (actual_reps)"
      },
      {
        metric: "Sessions Completed",
        definition: "Number of workout logs marked as completed in the time range.",
        formula: "sessions_count = COUNT(workout_logs) WHERE completed_at IS NOT NULL",
        tablesUsed: "workout_logs (completed_at)"
      },
      {
        metric: "Streak",
        definition: "Consecutive days with at least one completed workout, counting backwards from today or the last completed day.",
        formula: "streak = count of consecutive days ending at last_completed_date",
        tablesUsed: "workout_completions (completed_date)"
      },
      {
        metric: "Max Weight PR",
        definition: "The heaviest weight lifted for an exercise across all time.",
        formula: "max_weight_PR = MAX(actual_weight) for that exercise",
        tablesUsed: "workout_log_sets (actual_weight)"
      },
      {
        metric: "Max Reps PR",
        definition: "The highest rep count achieved for an exercise in a single set.",
        formula: "max_reps_PR = MAX(actual_reps) for that exercise",
        tablesUsed: "workout_log_sets (actual_reps)"
      },
      {
        metric: "Estimated 1RM",
        definition: "Estimated one-rep max using the Epley formula. Only valid for sets with 1-12 reps.",
        formula: "est_1rm = weight × (1 + reps/30) [for reps between 1 and 12]",
        tablesUsed: "workout_log_sets (actual_reps, actual_weight)"
      },
      {
        metric: "Best Volume Day",
        definition: "The date when the highest total volume was achieved for an exercise.",
        formula: "best_volume_day = MAX(exercise_volume per day)",
        tablesUsed: "workout_logs, workout_log_exercises, workout_log_sets"
      }
    ];

    // Get last completed workout for example calculation
    const lastLog = await db.select().from(workoutLogs)
      .where(and(
        eq(workoutLogs.memberId, memberId),
        isNotNull(workoutLogs.completedAt)
      ))
      .orderBy(desc(workoutLogs.completedAt))
      .limit(1);

    let exampleCalculation: {
      workoutDate: string;
      exercises: {
        name: string;
        sets: { setNumber: number; reps: number | null; weight: number | null; setVolume: number }[];
        exerciseVolume: number;
      }[];
      dayVolume: number;
      totalSets: number;
      totalReps: number;
    } | null = null;

    if (lastLog.length > 0) {
      const log = lastLog[0];
      const exercises = await db.select().from(workoutLogExercises)
        .where(eq(workoutLogExercises.workoutLogId, log.id));

      const exerciseData: typeof exampleCalculation extends null ? never : NonNullable<typeof exampleCalculation>['exercises'] = [];
      let dayVolume = 0;
      let totalSets = 0;
      let totalReps = 0;

      for (const ex of exercises) {
        const sets = await db.select().from(workoutLogSets)
          .where(eq(workoutLogSets.logExerciseId, ex.id))
          .orderBy(workoutLogSets.setNumber);

        const setData: { setNumber: number; reps: number | null; weight: number | null; setVolume: number }[] = [];
        let exerciseVolume = 0;

        for (const set of sets) {
          const reps = set.actualReps || 0;
          const weight = set.actualWeight ? parseFloat(set.actualWeight) : 0;
          const setVolume = reps * weight;

          setData.push({
            setNumber: set.setNumber,
            reps: set.actualReps,
            weight: weight > 0 ? weight : null,
            setVolume
          });

          exerciseVolume += setVolume;
          if (set.actualReps) {
            totalSets++;
            totalReps += set.actualReps;
          }
        }

        exerciseData.push({
          name: ex.exerciseName,
          sets: setData,
          exerciseVolume
        });
        dayVolume += exerciseVolume;
      }

      exampleCalculation = {
        workoutDate: log.completedDate,
        exercises: exerciseData,
        dayVolume: Math.round(dayVolume),
        totalSets,
        totalReps
      };
    }

    // Get streak info
    const stats = await this.getMemberStats(memberId);
    const lastCompleted = await db.select().from(workoutCompletions)
      .where(eq(workoutCompletions.memberId, memberId))
      .orderBy(desc(workoutCompletions.completedDate))
      .limit(1);

    const streakExplanation = {
      currentStreak: stats.streak,
      lastCompletedDate: lastCompleted.length > 0 ? lastCompleted[0].completedDate : null,
      explanation: `Your streak counts consecutive days with completed workouts, starting from ${lastCompleted.length > 0 ? lastCompleted[0].completedDate : 'N/A'} and counting backwards. You currently have ${stats.streak} consecutive day(s).`
    };

    return { explanations, exampleCalculation, streakExplanation };
  }

  /**
   * Pre-load all schedule data for a member to enable fast streak calculation.
   * Returns cached data structure for use with getScheduledDayStatusFromCache.
   */
  async loadMemberScheduleData(memberId: number): Promise<{
    phases: (typeof trainingPhases.$inferSelect)[];
    directCycles: (typeof workoutCycles.$inferSelect)[]; // Cycles directly assigned to member
    phaseExerciseDays: Map<number, Set<number>>; // phaseId -> set of dayIndices with exercises
    cycleExerciseDays: Map<number, Set<number>>; // cycleId -> set of dayIndices with exercises
    cycleRestDays: Map<number, Set<number>>; // cycleId -> set of rest day indices
    cycleLengths: Map<number, number>; // cycleId -> cycle length
    swaps: Map<string, number>; // "phaseId-date" -> targetDayIndex
  }> {
    // Get all phases for this member
    const phases = await db.select().from(trainingPhases)
      .where(eq(trainingPhases.memberId, memberId));
    
    // Get all workout cycles directly assigned to this member (not via trainingPhases)
    const directCycles = await db.select().from(workoutCycles)
      .where(and(
        eq(workoutCycles.memberId, memberId),
        eq(workoutCycles.isActive, true)
      ));
    
    // Get all phase exercises and group by phaseId
    const phaseIds = phases.map(p => p.id);
    const phaseExerciseDays = new Map<number, Set<number>>();
    
    if (phaseIds.length > 0) {
      const exercises = await db.select().from(phaseExercises)
        .where(inArray(phaseExercises.phaseId, phaseIds));
      
      for (const ex of exercises) {
        if (!phaseExerciseDays.has(ex.phaseId)) {
          phaseExerciseDays.set(ex.phaseId, new Set());
        }
        phaseExerciseDays.get(ex.phaseId)!.add(ex.dayIndex);
      }
    }
    
    // Collect all cycle IDs (from phases and direct assignments)
    const phaseCycleIds = phases.filter(p => p.cycleId).map(p => p.cycleId!);
    const directCycleIds = directCycles.map(c => c.id);
    const allCycleIds = [...new Set([...phaseCycleIds, ...directCycleIds])];
    
    const cycleExerciseDays = new Map<number, Set<number>>();
    const cycleRestDays = new Map<number, Set<number>>();
    const cycleLengths = new Map<number, number>();
    
    // Store direct cycle metadata
    for (const cycle of directCycles) {
      cycleLengths.set(cycle.id, cycle.cycleLength);
      const restDaysArr = cycle.restDays || [];
      cycleRestDays.set(cycle.id, new Set(restDaysArr));
    }
    
    if (allCycleIds.length > 0) {
      // Get cycle metadata for phase-linked cycles (if not already from directCycles)
      const phaseCyclesOnly = phaseCycleIds.filter(id => !directCycleIds.includes(id));
      if (phaseCyclesOnly.length > 0) {
        const phaseCycles = await db.select().from(workoutCycles)
          .where(inArray(workoutCycles.id, phaseCyclesOnly));
        
        for (const cycle of phaseCycles) {
          cycleLengths.set(cycle.id, cycle.cycleLength);
          const restDaysArr = cycle.restDays || [];
          cycleRestDays.set(cycle.id, new Set(restDaysArr));
        }
      }
      
      // Get cycle exercises
      const cycleItems = await db.select().from(workoutItems)
        .where(inArray(workoutItems.cycleId, allCycleIds));
      
      for (const item of cycleItems) {
        if (!cycleExerciseDays.has(item.cycleId)) {
          cycleExerciseDays.set(item.cycleId, new Set());
        }
        cycleExerciseDays.get(item.cycleId)!.add(item.dayIndex);
      }
    }
    
    // Get all swaps for this member
    const swapsData = await db.select().from(memberRestDaySwaps)
      .where(eq(memberRestDaySwaps.memberId, memberId));
    
    const swaps = new Map<string, number>();
    for (const swap of swapsData) {
      swaps.set(`${swap.phaseId}-${swap.swapDate}`, swap.targetDayIndex);
    }
    
    return { phases, directCycles, phaseExerciseDays, cycleExerciseDays, cycleRestDays, cycleLengths, swaps };
  }

  /**
   * Determine if a specific date is a scheduled workout day, rest day, or unplanned.
   * Uses pre-loaded cache for performance.
   */
  getScheduledDayStatusFromCache(
    dateStr: string,
    cache: {
      phases: (typeof trainingPhases.$inferSelect)[];
      directCycles: (typeof workoutCycles.$inferSelect)[];
      phaseExerciseDays: Map<number, Set<number>>;
      cycleExerciseDays: Map<number, Set<number>>;
      cycleRestDays: Map<number, Set<number>>;
      cycleLengths: Map<number, number>;
      swaps: Map<string, number>;
    }
  ): "workout" | "rest" | "unplanned" {
    const date = new Date(dateStr + 'T00:00:00');
    
    // First check: Direct workout cycles assigned to member
    const directCycle = cache.directCycles.find(c => c.startDate <= dateStr && c.endDate >= dateStr);
    
    if (directCycle) {
      const cycleLength = directCycle.cycleLength;
      const startDate = new Date(directCycle.startDate + 'T00:00:00');
      const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const dayIndex = daysDiff % cycleLength;
      
      // Check if this day is a rest day in the cycle
      const cycleRestDaysSet = cache.cycleRestDays.get(directCycle.id);
      if (cycleRestDaysSet && cycleRestDaysSet.has(dayIndex)) {
        return "rest";
      }
      
      // Check if there are actually exercises scheduled for this day
      const cycleExerciseDaysSet = cache.cycleExerciseDays.get(directCycle.id);
      if (cycleExerciseDaysSet && cycleExerciseDaysSet.has(dayIndex)) {
        return "workout";
      }
      
      // No exercises scheduled and not explicitly a rest day = treat as rest
      return "rest";
    }
    
    // Second check: Training phases
    const phase = cache.phases.find(p => p.startDate <= dateStr && p.endDate >= dateStr);
    
    if (!phase) {
      return "unplanned";
    }
    
    // Use phase cycleLength, or fall back to linked cycle's length, or default to 7
    const cycleLength = phase.cycleLength || 
      (phase.cycleId ? cache.cycleLengths.get(phase.cycleId) : null) || 7;
    
    const startDate = new Date(phase.startDate + 'T00:00:00');
    const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const dayIndex = daysDiff % cycleLength;
    
    // Check for swap - note: swaps use targetDayIndex which is the day being swapped TO
    const swapKey = `${phase.id}-${dateStr}`;
    const effectiveDayIndex = cache.swaps.has(swapKey) ? cache.swaps.get(swapKey)! : dayIndex;
    
    // Determine if this day is a workout or rest day
    // Priority: 1) Custom phase exercises, 2) Cycle exercises, 3) Cycle restDays metadata
    
    if (phase.useCustomExercises) {
      // Phase has custom exercises defined
      const hasExercises = cache.phaseExerciseDays.get(phase.id)?.has(effectiveDayIndex) || false;
      return hasExercises ? "workout" : "rest";
    }
    
    if (phase.cycleId) {
      // Phase is linked to a cycle
      const cycleHasExercises = cache.cycleExerciseDays.get(phase.cycleId)?.has(effectiveDayIndex) || false;
      
      if (cycleHasExercises) {
        return "workout";
      }
      
      // Check if this day is explicitly marked as a rest day in the cycle
      const cycleRestDaysSet = cache.cycleRestDays.get(phase.cycleId);
      if (cycleRestDaysSet && cycleRestDaysSet.has(effectiveDayIndex)) {
        return "rest";
      }
      
      // If autoAssignCycle is true, non-rest days are workout days even without exercises
      if (phase.autoAssignCycle) {
        // Day is NOT in restDays = it's a workout day
        return "workout";
      }
      
      // No explicit exercises and not autoAssignCycle - treat as rest
      return "rest";
    }
    
    // No cycle linked - check phase restDays array
    if (phase.restDays && phase.restDays.includes(effectiveDayIndex)) {
      return "rest";
    }
    
    // Default: if phase has explicit restDays defined, non-rest days are workouts
    if (phase.restDays && phase.restDays.length > 0) {
      return "workout";
    }
    
    // No schedule info - treat as unplanned
    return "unplanned";
  }

  /**
   * Legacy method for single date lookup (still used for non-performance-critical paths)
   */
  async getScheduledDayStatus(memberId: number, dateStr: string): Promise<"workout" | "rest" | "unplanned"> {
    const cache = await this.loadMemberScheduleData(memberId);
    return this.getScheduledDayStatusFromCache(dateStr, cache);
  }

  async getMemberStats(memberId: number): Promise<{ streak: number; totalWorkouts: number; last7Days: number }> {
    // Get data from BOTH workout systems:
    // 1. workoutSessions - standalone sessions members create
    // 2. workoutCompletions - completions from trainer-assigned cycles
    
    const allCompletions = await db.select().from(workoutCompletions)
      .where(eq(workoutCompletions.memberId, memberId))
      .orderBy(desc(workoutCompletions.completedDate));
    
    const allSessions = await db.select().from(workoutSessions)
      .where(eq(workoutSessions.memberId, memberId))
      .orderBy(desc(workoutSessions.date));
    
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
    
    // Combine unique dates from both sources
    const completionDatesSet = new Set(allCompletions.map(c => c.completedDate));
    const sessionDatesSet = new Set(allSessions.map(s => s.date));
    const allDates = new Set([...Array.from(completionDatesSet), ...Array.from(sessionDatesSet)]);
    const uniqueDates = Array.from(allDates).sort().reverse();
    
    const totalWorkouts = uniqueDates.length;
    const last7DaysDates = uniqueDates.filter(d => d >= sevenDaysAgoStr);
    const last7Days = last7DaysDates.length;
    
    // Pre-load schedule data for fast streak calculation
    const scheduleCache = await this.loadMemberScheduleData(memberId);
    
    // Smart rest day streak calculation:
    // - If today has a workout → count it, then check yesterday onwards
    // - If today is incomplete → don't penalize (day not over), start from yesterday
    // - Going backwards: workout completion → streak++, rest/unplanned → continue, missed workout → break
    let streak = 0;
    let checkDate = new Date(todayStr + 'T00:00:00');
    const maxDaysToCheck = 365;
    
    // Check if today already has a workout completed
    const todayHasWorkout = allDates.has(todayStr);
    
    if (todayHasWorkout) {
      // Today counts toward streak
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Today not completed yet - don't penalize, just skip to yesterday
      // (The day isn't over, so we can't call it "missed" yet)
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Now check from yesterday backwards
    for (let i = 0; i < maxDaysToCheck; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasWorkout = allDates.has(dateStr);
      
      if (hasWorkout) {
        streak++;
      } else {
        const dayStatus = this.getScheduledDayStatusFromCache(dateStr, scheduleCache);
        if (dayStatus === "workout") {
          // Scheduled workout was missed - streak breaks
          break;
        }
        // Rest day or unplanned - streak continues (no increment)
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return { streak, totalWorkouts, last7Days };
  }

  async getMemberDailyWorkouts(memberId: number, startDate?: string, endDate?: string): Promise<{
    date: string;
    muscleGroups: string[];
    exerciseCount: number;
    exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
  }[]> {
    // Use left join to include both cycle and phase exercise completions
    let query = db.select({
      completion: workoutCompletions,
      workoutItem: workoutItems,
      phaseExercise: phaseExercises
    })
    .from(workoutCompletions)
    .leftJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .leftJoin(phaseExercises, eq(workoutCompletions.phaseExerciseId, phaseExercises.id))
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

    // Transform to result format - handle both cycle and phase exercises
    const result: {
      date: string;
      muscleGroups: string[];
      exerciseCount: number;
      exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
    }[] = [];

    for (const [date, items] of Array.from(byDate.entries())) {
      const muscleGroups: string[] = Array.from(new Set(items.map((i: typeof filtered[0]) => 
        i.workoutItem?.muscleType || i.phaseExercise?.muscleType
      ).filter((m): m is string => Boolean(m))));
      result.push({
        date,
        muscleGroups,
        exerciseCount: items.length,
        exercises: items.map((i: typeof filtered[0]) => ({
          name: i.workoutItem?.exerciseName || i.phaseExercise?.exerciseName || i.completion.exerciseName || "Unknown",
          muscleType: i.workoutItem?.muscleType || i.phaseExercise?.muscleType || "",
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
    
    // Use left join to include both cycle and phase exercise completions
    const completions = await db.select({
      completion: workoutCompletions,
      member: users,
      workoutItem: workoutItems,
      phaseExercise: phaseExercises
    })
    .from(workoutCompletions)
    .innerJoin(users, eq(workoutCompletions.memberId, users.id))
    .leftJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .leftJoin(phaseExercises, eq(workoutCompletions.phaseExerciseId, phaseExercises.id))
    .where(inArray(workoutCompletions.memberId, memberIds))
    .orderBy(desc(workoutCompletions.createdAt))
    .limit(50);
    
    return completions.map(c => ({
      type: "workout_completed",
      memberName: c.member.username,
      memberId: c.member.id,
      exerciseName: c.workoutItem?.exerciseName || c.phaseExercise?.exerciseName || c.completion.exerciseName || "Unknown",
      date: c.completion.completedDate,
      createdAt: c.completion.createdAt
    }));
  }

  async getGymTrainersWithMembers(gymId: number): Promise<{ trainer: User; members: User[] }[]> {
    const trainers = await this.getGymTrainers(gymId);
    
    const result: { trainer: User; members: User[] }[] = [];
    
    for (const trainer of trainers) {
      const assignments = await db.select().from(trainerMembers)
        .where(and(eq(trainerMembers.trainerId, trainer.id), eq(trainerMembers.gymId, gymId)));
      const memberIds = assignments.map(a => a.memberId);
      
      let members: User[] = [];
      if (memberIds.length > 0) {
        members = await db.select().from(users)
          .where(and(inArray(users.id, memberIds), eq(users.gymId, gymId)));
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
    subscriptionEndDate: string | null;
    subscriptionStatus: string | null;
  }[]> {
    const members = await this.getGymMembers(gymId);
    const assignments = await this.getGymAssignments(gymId);
    const trainers = await this.getGymTrainers(gymId);
    
    const trainerMap = new Map(trainers.map(t => [t.id, t.username]));
    const memberTrainerMap = new Map(assignments.map(a => [a.memberId, a.trainerId]));
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const allSubscriptions = await db.select()
      .from(memberSubscriptions)
      .where(eq(memberSubscriptions.gymId, gymId));
    
    const subscriptionMap = new Map(allSubscriptions.map(s => [s.memberId, s]));
    
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
      
      const subscription = subscriptionMap.get(member.id);
      const subscriptionEndDate = subscription?.endDate || null;
      const subscriptionStatus = subscription?.status || null;
      
      return {
        id: member.id,
        username: member.username,
        role: member.role,
        createdAt: member.createdAt,
        trainerName,
        cycleEndDate,
        paymentStatus,
        subscriptionEndDate,
        subscriptionStatus
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

  async getDailyWorkoutPoints(gymId: number, memberId: number, from: string, to: string): Promise<{
    date: string;
    plannedPoints: number;
    earnedPoints: number;
    status: "REST" | "NOT_STARTED" | "IN_PROGRESS" | "DONE_FULL" | "DONE_PARTIAL";
    completionPercent: number;
    missedPoints: number;
    missedExercises: string[];
  }[]> {
    // Get member's active cycle
    const cycle = await this.getMemberCycle(memberId);
    if (!cycle) {
      return [];
    }
    
    // Get all workout items for this cycle
    const allItems = await db.select()
      .from(workoutItems)
      .where(eq(workoutItems.cycleId, cycle.id));
    
    // Group items by dayIndex
    const itemsByDay = new Map<number, typeof allItems>();
    for (const item of allItems) {
      const dayItems = itemsByDay.get(item.dayIndex) || [];
      dayItems.push(item);
      itemsByDay.set(item.dayIndex, dayItems);
    }
    
    // Get all rest day swaps where swapDate or targetDate falls in the date range
    const swaps = await db.select()
      .from(memberRestDaySwaps)
      .where(
        and(
          eq(memberRestDaySwaps.memberId, memberId),
          eq(memberRestDaySwaps.cycleId, cycle.id),
          or(
            and(
              gte(memberRestDaySwaps.swapDate, from),
              lte(memberRestDaySwaps.swapDate, to)
            ),
            and(
              gte(memberRestDaySwaps.targetDate, from),
              lte(memberRestDaySwaps.targetDate, to)
            )
          )
        )
      );
    
    // Build swap maps: swapDate -> targetDayIndex, targetDate -> isSwappedRestDay
    // Only map dates that actually fall within the query range
    const swapDateToTargetDayIndex = new Map<string, number>();
    const targetDateIsSwappedRestDay = new Set<string>();
    for (const swap of swaps) {
      // Only apply swap logic for dates within the queried range
      if (swap.swapDate >= from && swap.swapDate <= to) {
        swapDateToTargetDayIndex.set(swap.swapDate, swap.targetDayIndex);
      }
      if (swap.targetDate >= from && swap.targetDate <= to) {
        targetDateIsSwappedRestDay.add(swap.targetDate);
      }
    }
    
    // Get all completions in the date range
    const completions = await db.select()
      .from(workoutCompletions)
      .where(
        and(
          eq(workoutCompletions.gymId, gymId),
          eq(workoutCompletions.memberId, memberId),
          gte(workoutCompletions.completedDate, from),
          lte(workoutCompletions.completedDate, to)
        )
      );
    
    // Get workout sessions to check for "mark done" status
    const sessions = await db.select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.gymId, gymId),
          eq(workoutSessions.memberId, memberId),
          gte(workoutSessions.date, from),
          lte(workoutSessions.date, to)
        )
      );
    
    // Build a map of sessions by date
    const sessionsByDate = new Map<string, typeof sessions[0]>();
    for (const session of sessions) {
      sessionsByDate.set(session.date, session);
    }
    
    // Build completion map by date -> set of workoutItemIds completed
    const completionsByDate = new Map<string, Set<number>>();
    for (const c of completions) {
      const dateSet = completionsByDate.get(c.completedDate) || new Set();
      dateSet.add(c.workoutItemId);
      completionsByDate.set(c.completedDate, dateSet);
    }
    
    // Generate daily points for each date in range
    const result: {
      date: string;
      plannedPoints: number;
      earnedPoints: number;
      status: "REST" | "NOT_STARTED" | "IN_PROGRESS" | "DONE_FULL" | "DONE_PARTIAL";
      completionPercent: number;
      missedPoints: number;
      missedExercises: string[];
    }[] = [];
    
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const cycleStartDate = new Date(cycle.startDate);
    
    for (let d = fromDate; d <= toDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      
      // Calculate which day of the cycle this date falls on
      const daysSinceStart = Math.floor((d.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
      let currentDayIndex = ((daysSinceStart % cycle.cycleLength) + cycle.cycleLength) % cycle.cycleLength;
      
      // Check for rest day swaps - if this date was a swap date, use the target day index
      if (swapDateToTargetDayIndex.has(dateStr)) {
        currentDayIndex = swapDateToTargetDayIndex.get(dateStr)!;
      }
      
      // Check if this date is a swapped rest day (it was the target of a swap)
      const isSwappedRestDay = targetDateIsSwappedRestDay.has(dateStr);
      
      // Get planned exercises for this day
      const dayItems = isSwappedRestDay ? [] : (itemsByDay.get(currentDayIndex) || []);
      const dayLabel = cycle.dayLabels?.[currentDayIndex] || `Day ${currentDayIndex + 1}`;
      const isRestDay = isSwappedRestDay || (cycle.restDays?.includes(currentDayIndex)) || dayLabel.toLowerCase().includes("rest") || dayItems.length === 0;
      const plannedPoints = isRestDay ? 0 : dayItems.length;
      
      // Get earned points (unique completed items for this date)
      const completedItemIds = completionsByDate.get(dateStr) || new Set();
      const earnedPoints = completedItemIds.size;
      
      // Check if day was marked done
      const session = sessionsByDate.get(dateStr);
      const isMarkedDone = session?.isManuallyCompleted || session?.completedAt !== null;
      
      // Calculate missed exercises
      const missedExercises: string[] = [];
      for (const item of dayItems) {
        if (!completedItemIds.has(item.id)) {
          missedExercises.push(item.exerciseName);
        }
      }
      const missedPoints = plannedPoints - earnedPoints;
      
      // Determine status
      let status: "REST" | "NOT_STARTED" | "IN_PROGRESS" | "DONE_FULL" | "DONE_PARTIAL";
      if (isRestDay) {
        status = "REST";
      } else if (earnedPoints === 0 && !isMarkedDone) {
        status = "NOT_STARTED";
      } else if (earnedPoints >= plannedPoints) {
        status = "DONE_FULL";
      } else if (isMarkedDone) {
        status = "DONE_PARTIAL";
      } else {
        status = "IN_PROGRESS";
      }
      
      // Calculate completion percent
      const completionPercent = plannedPoints > 0 
        ? Math.round((earnedPoints / plannedPoints) * 100) 
        : 100;
      
      result.push({
        date: dateStr,
        plannedPoints,
        earnedPoints,
        status,
        completionPercent,
        missedPoints,
        missedExercises
      });
    }
    
    return result;
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

  async getFullMemberProfile(memberId: number, localDate?: string): Promise<any> {
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
    
    const [userProfile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, memberId));
    
    const [subscription] = await db.select().from(memberSubscriptions)
      .where(eq(memberSubscriptions.memberId, memberId))
      .orderBy(desc(memberSubscriptions.endDate))
      .limit(1);
    
    let membershipStatus: 'active' | 'inactive' | 'expired' = 'inactive';
    let subscriptionEndDate: string | null = null;
    
    if (subscription) {
      subscriptionEndDate = subscription.endDate;
      const today = localDate || new Date().toISOString().split('T')[0];
      if (subscription.endDate < today) {
        membershipStatus = 'expired';
      } else {
        membershipStatus = 'active';
      }
    }

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
      stats,
      membershipStatus,
      subscriptionEndDate,
      profile: userProfile ? {
        fullName: userProfile.fullName,
        gender: userProfile.gender,
        dob: userProfile.dob,
        age: userProfile.age,
        address: userProfile.address,
        emergencyContact: userProfile.emergencyContact
      } : null
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

  // === Enhanced Profile Methods ===
  async getEnhancedMemberProfile(memberId: number): Promise<{
    id: number;
    publicId: string | null;
    username: string;
    email: string | null;
    phone: string | null;
    role: string;
    createdAt: Date | null;
    gym: { id: number; name: string } | null;
    trainer: { id: number; username: string } | null;
    cycle: { id: number; name: string } | null;
    subscription: { status: 'active' | 'expired' | 'none'; endDate: string | null; planName: string | null } | null;
    profile: { fullName: string; gender: string; dob: string; address: string | null; emergencyContact: string | null } | null;
  }> {
    const [member] = await db.select().from(users).where(eq(users.id, memberId));
    if (!member) throw new Error("Member not found");

    let gym = null;
    if (member.gymId) {
      const [g] = await db.select().from(gyms).where(eq(gyms.id, member.gymId));
      gym = g ? { id: g.id, name: g.name } : null;
    }

    const [assignment] = await db.select().from(trainerMembers).where(eq(trainerMembers.memberId, memberId));
    let trainer = null;
    if (assignment) {
      const [t] = await db.select().from(users).where(eq(users.id, assignment.trainerId));
      trainer = t ? { id: t.id, username: t.username } : null;
    }

    const cycle = await this.getMemberCycle(memberId);
    
    let subscription: { status: 'active' | 'expired' | 'none'; endDate: string | null; planName: string | null } = { status: 'none', endDate: null, planName: null };
    if (member.gymId) {
      const [sub] = await db.select().from(memberSubscriptions).where(eq(memberSubscriptions.memberId, memberId));
      if (sub) {
        const today = new Date().toISOString().split('T')[0];
        const isActive = sub.endDate && sub.endDate >= today;
        const [plan] = sub.planId ? await db.select().from(membershipPlans).where(eq(membershipPlans.id, sub.planId)) : [null];
        subscription = {
          status: isActive ? 'active' : 'expired',
          endDate: sub.endDate,
          planName: plan?.name || null
        };
      }
    }

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, memberId));

    return {
      id: member.id,
      publicId: member.publicId,
      username: member.username,
      email: member.email,
      phone: member.phone,
      role: member.role,
      createdAt: member.createdAt,
      gym,
      trainer,
      cycle: cycle ? { id: cycle.id, name: cycle.name } : null,
      subscription,
      profile: profile ? {
        fullName: profile.fullName,
        gender: profile.gender,
        dob: profile.dob,
        address: profile.address,
        emergencyContact: profile.emergencyContact
      } : null
    };
  }

  async updateMemberProfileDetails(memberId: number, data: { phone?: string; address?: string; emergencyContact?: string }): Promise<void> {
    if (data.phone !== undefined) {
      await db.update(users).set({ phone: data.phone }).where(eq(users.id, memberId));
    }
    const [existingProfile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, memberId));
    if (existingProfile) {
      await db.update(userProfiles).set({
        address: data.address !== undefined ? data.address : existingProfile.address,
        emergencyContact: data.emergencyContact !== undefined ? data.emergencyContact : existingProfile.emergencyContact,
        updatedAt: new Date()
      }).where(eq(userProfiles.userId, memberId));
    }
  }

  async getEnhancedOwnerProfile(ownerId: number): Promise<{
    id: number;
    publicId: string | null;
    username: string;
    email: string | null;
    phone: string | null;
    role: string;
    createdAt: Date | null;
    gym: {
      id: number;
      name: string;
      code: string;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      timings: string | null;
      gymType: string | null;
      facilities: string | null;
      createdAt: Date | null;
      onboardingData: any;
    } | null;
  }> {
    const [owner] = await db.select().from(users).where(eq(users.id, ownerId));
    if (!owner) throw new Error("Owner not found");

    let gym = null;
    if (owner.gymId) {
      const [g] = await db.select().from(gyms).where(eq(gyms.id, owner.gymId));
      gym = g ? {
        id: g.id,
        name: g.name,
        code: g.code,
        phone: g.phone,
        address: g.address,
        city: g.city,
        state: g.state,
        country: g.country,
        timings: g.timings,
        gymType: g.gymType,
        facilities: g.facilities,
        createdAt: g.createdAt,
        onboardingData: g.onboardingData
      } : null;
    }

    return {
      id: owner.id,
      publicId: owner.publicId,
      username: owner.username,
      email: owner.email,
      phone: owner.phone,
      role: owner.role,
      createdAt: owner.createdAt,
      gym
    };
  }

  async updateOwnerProfile(ownerId: number, gymId: number, data: { phone?: string; address?: string; timings?: string }): Promise<void> {
    const [gym] = await db.select().from(gyms).where(eq(gyms.id, gymId));
    if (!gym || gym.ownerUserId !== ownerId) {
      throw new Error("Unauthorized: You do not own this gym");
    }
    
    if (data.phone !== undefined) {
      await db.update(users).set({ phone: data.phone }).where(eq(users.id, ownerId));
    }
    const gymUpdate: Record<string, any> = {};
    if (data.address !== undefined) gymUpdate.address = data.address;
    if (data.timings !== undefined) gymUpdate.timings = data.timings;
    
    if (Object.keys(gymUpdate).length > 0) {
      await db.update(gyms).set(gymUpdate).where(eq(gyms.id, gymId));
    }
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

    const memberIds = history.filter(h => h.history.leftAt).map(h => h.member.id);
    
    const transfers = memberIds.length > 0 ? await db.select({
      transfer: transferRequests,
      toGym: gyms
    })
    .from(transferRequests)
    .innerJoin(gyms, eq(transferRequests.toGymId, gyms.id))
    .where(
      and(
        eq(transferRequests.fromGymId, gymId),
        eq(transferRequests.status, "approved"),
        inArray(transferRequests.memberId, memberIds)
      )
    ) : [];
    
    const transferMap = new Map<number, string>();
    for (const t of transfers) {
      if (!transferMap.has(t.transfer.memberId)) {
        transferMap.set(t.transfer.memberId, (t.toGym as any).name);
      }
    }

    return history.map(h => ({
      id: h.history.id,
      memberId: h.history.memberId,
      memberName: h.member.username,
      memberRole: h.member.role,
      gymId: h.history.gymId,
      gymName: (h.gym as any).name,
      joinedAt: h.history.joinedAt,
      leftAt: h.history.leftAt,
      destinationGymName: h.history.leftAt ? transferMap.get(h.member.id) || null : null
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

  // === Training Phases Methods ===
  async createTrainingPhase(data: InsertTrainingPhase): Promise<TrainingPhase> {
    const [phase] = await db.insert(trainingPhases).values(data).returning();
    return phase;
  }

  async getTrainingPhases(gymId: number, memberId: number): Promise<(TrainingPhase & { cycleName: string | null })[]> {
    const phases = await db.select({
      phase: trainingPhases,
      cycleName: workoutCycles.name
    }).from(trainingPhases)
      .leftJoin(workoutCycles, eq(trainingPhases.cycleId, workoutCycles.id))
      .where(and(eq(trainingPhases.gymId, gymId), eq(trainingPhases.memberId, memberId)))
      .orderBy(desc(trainingPhases.createdAt));
    return phases.map(p => ({ ...p.phase, cycleName: p.cycleName }));
  }

  async getTrainingPhaseById(phaseId: number): Promise<(TrainingPhase & { cycleName: string | null }) | undefined> {
    const [result] = await db.select({
      phase: trainingPhases,
      cycleName: workoutCycles.name
    }).from(trainingPhases)
      .leftJoin(workoutCycles, eq(trainingPhases.cycleId, workoutCycles.id))
      .where(eq(trainingPhases.id, phaseId));
    if (!result) return undefined;
    return { ...result.phase, cycleName: result.cycleName };
  }

  async deleteTrainingPhase(phaseId: number): Promise<void> {
    await db.delete(phaseExercises).where(eq(phaseExercises.phaseId, phaseId));
    await db.delete(trainingPhases).where(eq(trainingPhases.id, phaseId));
  }

  async updateTrainingPhase(phaseId: number, data: Partial<InsertTrainingPhase>): Promise<TrainingPhase> {
    const [phase] = await db.update(trainingPhases)
      .set(data)
      .where(eq(trainingPhases.id, phaseId))
      .returning();
    return phase;
  }

  async getPhaseExercises(phaseId: number): Promise<PhaseExercise[]> {
    return await db.select().from(phaseExercises)
      .where(eq(phaseExercises.phaseId, phaseId))
      .orderBy(phaseExercises.dayIndex, phaseExercises.orderIndex);
  }

  async getPhaseExercise(exerciseId: number): Promise<PhaseExercise | undefined> {
    const [exercise] = await db.select().from(phaseExercises)
      .where(eq(phaseExercises.id, exerciseId));
    return exercise;
  }

  async addPhaseExercise(data: InsertPhaseExercise): Promise<PhaseExercise> {
    const [exercise] = await db.insert(phaseExercises).values(data).returning();
    return exercise;
  }

  async updatePhaseExercise(exerciseId: number, data: Partial<InsertPhaseExercise>): Promise<PhaseExercise> {
    const [exercise] = await db.update(phaseExercises)
      .set(data)
      .where(eq(phaseExercises.id, exerciseId))
      .returning();
    return exercise;
  }

  async deletePhaseExercise(exerciseId: number): Promise<void> {
    await db.delete(phaseExercises).where(eq(phaseExercises.id, exerciseId));
  }

  async copyExercisesFromCycle(phaseId: number, cycleId: number): Promise<PhaseExercise[]> {
    const cycleExercises = await db.select().from(workoutItems)
      .where(eq(workoutItems.cycleId, cycleId))
      .orderBy(workoutItems.dayIndex, workoutItems.orderIndex);
    
    const inserted: PhaseExercise[] = [];
    for (const ex of cycleExercises) {
      const [newEx] = await db.insert(phaseExercises).values({
        phaseId,
        dayIndex: ex.dayIndex,
        muscleType: ex.muscleType,
        bodyPart: ex.bodyPart,
        exerciseName: ex.exerciseName,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        orderIndex: ex.orderIndex ?? 0,
      }).returning();
      inserted.push(newEx);
    }
    return inserted;
  }

  async getActivePhaseForMember(memberId: number, gymId: number): Promise<TrainingPhase | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [phase] = await db.select().from(trainingPhases)
      .where(and(
        eq(trainingPhases.memberId, memberId),
        eq(trainingPhases.gymId, gymId),
        lte(trainingPhases.startDate, today),
        gte(trainingPhases.endDate, today)
      ))
      .orderBy(desc(trainingPhases.createdAt))
      .limit(1);
    return phase;
  }

  async getPhaseAnalytics(phaseId: number, memberId: number, startDate: string, endDate: string, gymId: number): Promise<{
    attendanceDays: number;
    totalDays: number;
    totalPoints: number;
    avgPointsPerDay: number;
    totalWorkouts: number;
    startWeight: number | null;
    endWeight: number | null;
    weightChange: number | null;
    pointsTrend: { date: string; points: number }[];
    weightTrend: { date: string; weight: number }[];
    dailyWorkouts: { date: string; exercises: { name: string; sets: number; reps: number; weight: string }[]; points: number; expectedPoints: number }[];
  }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const effectiveEnd = end > today ? today : end;
    const effectiveEndStr = effectiveEnd.toISOString().split('T')[0];
    
    const totalDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    // Get the phase to find linked cycle
    const phase = await db.select().from(trainingPhases).where(eq(trainingPhases.id, phaseId)).limit(1);
    const cycleId = phase[0]?.cycleId;
    const cycleLength = phase[0]?.cycleLength || 7;
    const restDays = phase[0]?.restDays || [];
    
    // Get cycle items to calculate expected exercises per day
    let cycleItemsByDay: Map<number, number> = new Map();
    if (cycleId) {
      const cycleItems = await db.select().from(workoutItems).where(eq(workoutItems.cycleId, cycleId));
      cycleItems.forEach(item => {
        const count = cycleItemsByDay.get(item.dayIndex) || 0;
        cycleItemsByDay.set(item.dayIndex, count + 1);
      });
    } else {
      // Use phase exercises if no cycle linked
      const phaseExerciseItems = await db.select().from(phaseExercises).where(eq(phaseExercises.phaseId, phaseId));
      phaseExerciseItems.forEach(item => {
        const count = cycleItemsByDay.get(item.dayIndex) || 0;
        cycleItemsByDay.set(item.dayIndex, count + 1);
      });
    }
    
    // Attendance records within the phase period and for this gym
    const attendanceRecords = await db.select().from(attendance)
      .where(and(
        eq(attendance.memberId, memberId),
        eq(attendance.gymId, gymId),
        gte(attendance.date, startDate),
        lte(attendance.date, effectiveEndStr)
      ));
    const attendanceDays = attendanceRecords.length;
    
    // Workout completions within the phase period with exercise details
    const completions = await db.select({
      id: workoutCompletions.id,
      completedDate: workoutCompletions.completedDate,
      actualSets: workoutCompletions.actualSets,
      actualReps: workoutCompletions.actualReps,
      actualWeight: workoutCompletions.actualWeight,
      workoutItemId: workoutCompletions.workoutItemId,
    }).from(workoutCompletions)
      .where(and(
        eq(workoutCompletions.memberId, memberId),
        gte(workoutCompletions.completedDate, startDate),
        lte(workoutCompletions.completedDate, effectiveEndStr)
      ));
    
    // Get workout item details for all completions
    const workoutItemIds = [...new Set(completions.map(c => c.workoutItemId))];
    const itemDetails = workoutItemIds.length > 0 ? await db.select({
      id: workoutItems.id,
      exerciseName: workoutItems.exerciseName,
      sets: workoutItems.sets,
      reps: workoutItems.reps,
      weight: workoutItems.weight,
    }).from(workoutItems)
      .where(sql`${workoutItems.id} IN ${workoutItemIds}`) : [];
    
    const itemMap = new Map(itemDetails.map(i => [i.id, i]));
    
    const completionsByDate = new Map<string, number>();
    completions.forEach(c => {
      const date = c.completedDate;
      completionsByDate.set(date, (completionsByDate.get(date) || 0) + 1);
    });
    
    const totalPoints = completions.length;
    const avgPointsPerDay = totalDays > 0 ? totalPoints / totalDays : 0;
    
    const uniqueWorkoutDates = new Set(completions.map(c => c.completedDate));
    const totalWorkouts = uniqueWorkoutDates.size;
    
    // Body measurements within the phase period and for this gym
    const measurements = await db.select().from(bodyMeasurements)
      .where(and(
        eq(bodyMeasurements.memberId, memberId),
        eq(bodyMeasurements.gymId, gymId),
        gte(bodyMeasurements.recordedDate, startDate),
        lte(bodyMeasurements.recordedDate, effectiveEndStr)
      ))
      .orderBy(bodyMeasurements.recordedDate);
    
    let startWeight: number | null = null;
    let endWeight: number | null = null;
    
    if (measurements.length > 0) {
      const firstMeasurement = measurements[0];
      const lastMeasurement = measurements[measurements.length - 1];
      if (firstMeasurement.weight) startWeight = firstMeasurement.weight;
      if (lastMeasurement.weight) endWeight = lastMeasurement.weight;
    }
    
    const weightChange = (startWeight !== null && endWeight !== null) ? 
      Math.round((endWeight - startWeight) * 10) / 10 : null;
    
    const pointsTrend: { date: string; points: number }[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= effectiveEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      pointsTrend.push({
        date: dateStr,
        points: completionsByDate.get(dateStr) || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const weightTrend = measurements
      .filter(m => m.weight !== null)
      .map(m => ({
        date: m.recordedDate,
        weight: m.weight!
      }));
    
    // Build daily workouts with exercise details
    const exercisesByDate = new Map<string, { name: string; sets: number; reps: number; weight: string }[]>();
    completions.forEach(c => {
      const item = itemMap.get(c.workoutItemId);
      if (item) {
        const exercises = exercisesByDate.get(c.completedDate) || [];
        exercises.push({
          name: item.exerciseName,
          sets: c.actualSets ?? item.sets,
          reps: c.actualReps ?? item.reps,
          weight: c.actualWeight ?? item.weight,
        });
        exercisesByDate.set(c.completedDate, exercises);
      }
    });
    
    // Helper to calculate day index for a date
    const getDayIndex = (dateStr: string): number => {
      const date = new Date(dateStr);
      const daysSinceStart = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceStart % cycleLength;
    };
    
    const dailyWorkouts = Array.from(exercisesByDate.entries()).map(([date, exercises]) => {
      const dayIndex = getDayIndex(date);
      const expectedPoints = cycleItemsByDay.get(dayIndex) || 0;
      return {
        date,
        exercises,
        points: exercises.length,
        expectedPoints
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      attendanceDays,
      totalDays,
      totalPoints,
      avgPointsPerDay,
      totalWorkouts,
      startWeight,
      endWeight,
      weightChange,
      pointsTrend,
      weightTrend,
      dailyWorkouts
    };
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

    // Get user to determine role (member or trainer)
    const [user] = await db.select().from(users).where(eq(users.id, request.memberId));
    if (!user) return;
    
    const isTrainer = user.role === 'trainer';

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

    // Update user's gym
    await db.update(users)
      .set({ gymId: request.toGymId })
      .where(eq(users.id, request.memberId));

    if (isTrainer) {
      // When trainer transfers, close ALL their member assignments (preserve history)
      await db.update(trainerMemberAssignments)
        .set({ endedAt: new Date(), endReason: 'trainer_transfer' })
        .where(and(
          eq(trainerMemberAssignments.trainerId, request.memberId),
          eq(trainerMemberAssignments.gymId, request.fromGymId),
          isNull(trainerMemberAssignments.endedAt)
        ));
      
      // Remove current assignments from trainerMembers
      await db.delete(trainerMembers).where(eq(trainerMembers.trainerId, request.memberId));
    } else {
      // When member transfers, close their assignment with their trainer (preserve history)
      await db.update(trainerMemberAssignments)
        .set({ endedAt: new Date(), endReason: 'member_transfer' })
        .where(and(
          eq(trainerMemberAssignments.memberId, request.memberId),
          eq(trainerMemberAssignments.gymId, request.fromGymId),
          isNull(trainerMemberAssignments.endedAt)
        ));
      
      // Remove current assignment from trainerMembers
      await db.delete(trainerMembers).where(eq(trainerMembers.memberId, request.memberId));
    }

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
      completionId: number | null;
      exerciseName: string;
      muscleType: string;
      sets: number;
      reps: number;
      weight: string | null;
      actualSets: number | null;
      actualReps: number | null;
      actualWeight: string | null;
      notes: string | null;
      completed: boolean;
    }[];
  }[]> {
    const [member] = await db.select().from(users).where(eq(users.id, memberId));
    if (!member || !member.gymId) return [];

    const sessionMap = new Map<string, {
      date: string;
      title: string;
      exercises: any[];
    }>();

    // SOURCE 1: Standalone workout sessions (workoutSessions + workoutSessionExercises)
    const standaloneSessionsWithExercises = await db.select({
      session: workoutSessions,
      exercise: workoutSessionExercises
    })
    .from(workoutSessions)
    .leftJoin(workoutSessionExercises, eq(workoutSessionExercises.sessionId, workoutSessions.id))
    .where(eq(workoutSessions.memberId, memberId))
    .orderBy(desc(workoutSessions.date));

    // Group exercises by session
    const sessionsById = new Map<number, { session: typeof standaloneSessionsWithExercises[0]['session']; exercises: typeof standaloneSessionsWithExercises[0]['exercise'][] }>();
    for (const row of standaloneSessionsWithExercises) {
      if (!sessionsById.has(row.session.id)) {
        sessionsById.set(row.session.id, { session: row.session, exercises: [] });
      }
      if (row.exercise) {
        sessionsById.get(row.session.id)!.exercises.push(row.exercise);
      }
    }

    // Add standalone sessions to map
    for (const { session, exercises } of sessionsById.values()) {
      // Only add if session has been completed or has exercises
      if (session.isManuallyCompleted || exercises.length > 0) {
        sessionMap.set(session.date, {
          date: session.date,
          title: session.focusLabel || "Workout",
          exercises: exercises.map(ex => ({
            completionId: ex?.id || null,
            exerciseName: ex?.exerciseName || "",
            muscleType: "",
            sets: ex?.sets || 0,
            reps: ex?.reps || 0,
            weight: ex?.weight || null,
            actualSets: ex?.sets || null,
            actualReps: ex?.reps || null,
            actualWeight: ex?.weight || null,
            notes: ex?.notes || null,
            completed: true
          }))
        });
      }
    }

    // SOURCE 2: Trainer-assigned cycle completions (workoutCompletions) - from ANY cycle, not just active
    const completions = await db.select({
      completion: workoutCompletions,
      item: workoutItems,
      cycle: workoutCycles
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .innerJoin(workoutCycles, eq(workoutCompletions.cycleId, workoutCycles.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate));

    // Group completions by date
    const completionsByDate = new Map<string, typeof completions>();
    for (const row of completions) {
      const date = row.completion.completedDate;
      if (!completionsByDate.has(date)) {
        completionsByDate.set(date, []);
      }
      completionsByDate.get(date)!.push(row);
    }

    // For each date with completions, build a session
    for (const [date, dateCompletions] of completionsByDate.entries()) {
      // Skip if already added from standalone sessions
      if (sessionMap.has(date)) continue;
      
      // Get muscle types from the completed exercises
      const muscleTypes = Array.from(new Set(dateCompletions.map(c => c.item.muscleType).filter(Boolean)));
      const title = muscleTypes.join(" + ") || "Workout";

      const exercises = dateCompletions.map(row => ({
        completionId: row.completion.id,
        exerciseName: row.item.exerciseName,
        muscleType: row.item.muscleType || "",
        sets: row.item.sets,
        reps: row.item.reps,
        weight: row.item.weight,
        actualSets: row.completion.actualSets,
        actualReps: row.completion.actualReps,
        actualWeight: row.completion.actualWeight,
        notes: row.completion.notes,
        completed: true
      }));

      sessionMap.set(date, { date, title, exercises });
    }

    // Sort by date descending
    return Array.from(sessionMap.values()).sort((a, b) => b.date.localeCompare(a.date));
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

    // Calculate rest/recovery stats
    // Get unique workout dates
    const workoutDatesAll = new Set<string>();
    for (const { completion } of completions) {
      workoutDatesAll.add(completion.completedDate);
    }
    
    // Calculate based on actual data: unique dates with workouts
    const totalWorkoutDays = workoutDatesAll.size;
    
    // Calculate tracked period - from first workout to today
    const firstWorkoutDate = completions.length > 0 
      ? completions[completions.length - 1].completion.completedDate 
      : today.toISOString().split("T")[0];
    const firstDate = new Date(firstWorkoutDate);
    const daysSinceFirst = Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    // Bound the window by actual tracking period (max 30 days, but not more than tracked days)
    const trackingWindow = Math.min(30, daysSinceFirst);
    const windowStartDate = new Date(today);
    windowStartDate.setDate(windowStartDate.getDate() - trackingWindow + 1);
    const windowStartStr = windowStartDate.toISOString().split("T")[0];
    
    // Count workout days within the bounded window
    let workoutDaysInWindow = 0;
    const datesArray = Array.from(workoutDatesAll);
    for (const date of datesArray) {
      if (date >= windowStartStr) {
        workoutDaysInWindow++;
      }
    }
    const restDaysInWindow = Math.max(0, trackingWindow - workoutDaysInWindow);
    
    // Calculate total estimated rest days (total tracked period)
    const estimatedRestDays = Math.max(0, daysSinceFirst - totalWorkoutDays);
    
    // Build breakdown for pie chart (using actual tracking window)
    const workoutPercentage = trackingWindow > 0 ? Math.round((workoutDaysInWindow / trackingWindow) * 100) : 0;
    const restPercentage = trackingWindow > 0 ? Math.round((restDaysInWindow / trackingWindow) * 100) : 0;
    
    const restRecoveryBreakdown = [
      { name: "Workout Days", value: workoutDaysInWindow, percentage: workoutPercentage },
      { name: "Rest Days", value: restDaysInWindow, percentage: restPercentage }
    ];

    return {
      streak: basicStats.streak,
      totalWorkouts: basicStats.totalWorkouts,
      last7Days: basicStats.last7Days,
      thisMonth,
      muscleGroupBreakdown,
      volumeStats: { totalSets, totalReps, totalVolume: Math.round(totalVolume) },
      weeklyTrend,
      restRecoveryStats: {
        workoutDays: totalWorkoutDays,
        restDays: estimatedRestDays,
        last30Days: { workoutDays: workoutDaysInWindow, restDays: restDaysInWindow },
        breakdown: restRecoveryBreakdown,
        trackingWindowDays: trackingWindow
      }
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

  async getMemberCalendarEnhanced(gymId: number, memberId: number, month: string, clientToday?: string): Promise<{
    date: string;
    status: "present" | "absent" | "rest" | "future";
    completed: { name: string; sets: number; reps: number; weight: string | null }[];
    missed: { name: string; sets: number; reps: number; weight: string | null }[];
  }[]> {
    const [year, mon] = month.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const nextMon = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMon).padStart(2, "0")}-01`;
    const today = clientToday || new Date().toISOString().split("T")[0];

    const memberAttendance = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.gymId, gymId),
        eq(attendance.memberId, memberId),
        gte(attendance.date, startDate),
        lt(attendance.date, endDate)
      ));
    const attendanceDates = new Set(memberAttendance.filter(a => a.status === "present").map(a => a.date));

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

    const memberCycle = await db.select()
      .from(workoutCycles)
      .where(and(eq(workoutCycles.gymId, gymId), eq(workoutCycles.memberId, memberId)))
      .limit(1);
    
    let scheduledItems: typeof workoutItems.$inferSelect[] = [];
    if (memberCycle.length > 0) {
      scheduledItems = await db.select()
        .from(workoutItems)
        .where(eq(workoutItems.cycleId, memberCycle[0].id))
        .orderBy(workoutItems.dayIndex, workoutItems.orderIndex);
    }

    const completedByDate = new Map<string, Set<number>>();
    const completedExercisesByDate = new Map<string, { name: string; sets: number; reps: number; weight: string | null }[]>();
    
    for (const { completion, item } of completions) {
      const date = completion.completedDate;
      if (!completedByDate.has(date)) {
        completedByDate.set(date, new Set());
        completedExercisesByDate.set(date, []);
      }
      completedByDate.get(date)!.add(completion.workoutItemId);
      completedExercisesByDate.get(date)!.push({
        name: item.exerciseName,
        sets: completion.actualSets || item.sets,
        reps: completion.actualReps || item.reps,
        weight: completion.actualWeight || item.weight
      });
    }

    const result: {
      date: string;
      status: "present" | "absent" | "rest" | "future";
      completed: { name: string; sets: number; reps: number; weight: string | null }[];
      missed: { name: string; sets: number; reps: number; weight: string | null }[];
    }[] = [];

    const daysInMonth = new Date(year, mon, 0).getDate();
    const cycle = memberCycle.length > 0 ? memberCycle[0] : null;
    const cycleEndDate = cycle?.endDate || null;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      
      if (dateStr > today) {
        result.push({ date: dateStr, status: "future", completed: [], missed: [] });
        continue;
      }

      const wasPresent = attendanceDates.has(dateStr);
      const completedIds = completedByDate.get(dateStr) || new Set();
      const completed = completedExercisesByDate.get(dateStr) || [];

      let dayIndex = -1;
      let isCycleActive = false;
      if (cycle) {
        const cycleStart = new Date(cycle.startDate);
        const currentDate = new Date(dateStr);
        const daysDiff = Math.floor((currentDate.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only consider cycle active if:
        // 1. Date is on or after cycle start date (no showing "missed" for pre-cycle dates)
        // 2. Date is within cycle end date (if specified)
        const withinStart = dateStr >= cycle.startDate;
        const withinEnd = !cycleEndDate || dateStr <= cycleEndDate;
        
        if (withinStart && withinEnd) {
          dayIndex = daysDiff % cycle.cycleLength;
          isCycleActive = true;
        }
      }

      const scheduledForDay = isCycleActive ? scheduledItems.filter(item => item.dayIndex === dayIndex) : [];
      const missed = scheduledForDay
        .filter(item => !completedIds.has(item.id))
        .map(item => ({
          name: item.exerciseName,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight
        }));

      let status: "present" | "absent" | "rest" | "future" = "rest";
      if (wasPresent || completed.length > 0) {
        status = "present";
      } else if (scheduledForDay.length > 0) {
        status = "absent";
      }

      result.push({ date: dateStr, status, completed, missed });
    }

    return result;
  }

  async getMemberConsistencyStats(gymId: number, memberId: number, days: number = 30): Promise<{
    scheduledDays: number;
    completedDays: number;
    missedDays: number;
    partialDays: number;
    restDays: number;
    completionRate: number;
    totalExercisesScheduled: number;
    totalExercisesCompleted: number;
    exerciseCompletionRate: number;
    recentPartialDays: { date: string; completed: number; missed: number }[];
  }> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    
    let scheduledDays = 0;
    let completedDays = 0;
    let missedDays = 0;
    let partialDays = 0;
    let restDays = 0;
    let totalExercisesScheduled = 0;
    let totalExercisesCompleted = 0;
    const recentPartialDays: { date: string; completed: number; missed: number }[] = [];

    // Get member's cycle
    const memberCycle = await db.select()
      .from(workoutCycles)
      .where(and(eq(workoutCycles.gymId, gymId), eq(workoutCycles.memberId, memberId)))
      .limit(1);
    
    const cycle = memberCycle.length > 0 ? memberCycle[0] : null;
    if (!cycle) {
      return {
        scheduledDays: 0, completedDays: 0, missedDays: 0, partialDays: 0, restDays: days,
        completionRate: 0, totalExercisesScheduled: 0, totalExercisesCompleted: 0,
        exerciseCompletionRate: 0, recentPartialDays: []
      };
    }

    // Get scheduled items for the cycle
    const scheduledItems = await db.select()
      .from(workoutItems)
      .where(eq(workoutItems.cycleId, cycle.id));

    // Get completions for the period
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    
    const completions = await db.select()
      .from(workoutCompletions)
      .where(and(
        eq(workoutCompletions.memberId, memberId),
        gte(workoutCompletions.completedDate, startStr),
        lte(workoutCompletions.completedDate, endStr)
      ));

    const completionsByDate = new Map<string, Set<number>>();
    for (const c of completions) {
      if (!completionsByDate.has(c.completedDate)) {
        completionsByDate.set(c.completedDate, new Set());
      }
      completionsByDate.get(c.completedDate)!.add(c.workoutItemId);
    }

    // Iterate through each day
    const cycleEndDate = cycle.endDate || null;
    
    for (let d = 0; d < days; d++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + d);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (dateStr > endStr) break;

      // Check if cycle is active for this date (must be within cycle end date)
      const withinEnd = !cycleEndDate || dateStr <= cycleEndDate;
      
      if (!withinEnd) {
        // Day is after cycle ended - treat as rest
        restDays++;
        continue;
      }

      const cycleStart = new Date(cycle.startDate);
      const daysDiff = Math.floor((currentDate.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
      const dayIndex = ((daysDiff % cycle.cycleLength) + cycle.cycleLength) % cycle.cycleLength;
      
      const scheduled = scheduledItems.filter(item => item.dayIndex === dayIndex);
      const completedIds = completionsByDate.get(dateStr) || new Set();
      
      if (scheduled.length === 0) {
        restDays++;
      } else {
        scheduledDays++;
        totalExercisesScheduled += scheduled.length;
        const completedCount = scheduled.filter(item => completedIds.has(item.id)).length;
        totalExercisesCompleted += completedCount;
        
        if (completedCount === 0) {
          missedDays++;
        } else if (completedCount === scheduled.length) {
          completedDays++;
        } else {
          partialDays++;
          // Track all partial days, we'll keep only the most recent N at the end
          recentPartialDays.push({
            date: dateStr,
            completed: completedCount,
            missed: scheduled.length - completedCount
          });
        }
      }
    }

    return {
      scheduledDays,
      completedDays,
      missedDays,
      partialDays,
      restDays,
      completionRate: scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : 0,
      totalExercisesScheduled,
      totalExercisesCompleted,
      exerciseCompletionRate: totalExercisesScheduled > 0 ? Math.round((totalExercisesCompleted / totalExercisesScheduled) * 100) : 0,
      recentPartialDays: recentPartialDays.slice(-5).reverse()
    };
  }

  async getMemberDailyAnalytics(gymId: number, memberId: number, date: string): Promise<{
    date: string;
    totalExercises: number;
    completedCount: number;
    missedCount: number;
    totalVolume: number;
    muscleBreakdown: { muscle: string; count: number; volume: number }[];
    exercises: {
      name: string;
      muscle: string;
      sets: number;
      reps: number;
      weight: string | null;
      completed: boolean;
      volume: number;
    }[];
  }> {
    const completions = await db.select({
      completion: workoutCompletions,
      item: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(and(
      eq(workoutCompletions.memberId, memberId),
      eq(workoutCompletions.completedDate, date)
    ));

    const memberCycle = await db.select()
      .from(workoutCycles)
      .where(and(eq(workoutCycles.gymId, gymId), eq(workoutCycles.memberId, memberId)))
      .limit(1);

    let scheduledItems: typeof workoutItems.$inferSelect[] = [];
    let dayIndex = -1;

    if (memberCycle.length > 0) {
      const cycle = memberCycle[0];
      const cycleStart = new Date(cycle.startDate);
      const currentDate = new Date(date);
      
      if (!isNaN(cycleStart.getTime()) && !isNaN(currentDate.getTime()) && cycle.cycleLength > 0) {
        const daysDiff = Math.floor((currentDate.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
        
        const withinStart = daysDiff >= 0;
        const withinEnd = !cycle.endDate || date <= cycle.endDate;
        
        if (withinStart && withinEnd) {
          dayIndex = daysDiff % cycle.cycleLength;
          scheduledItems = await db.select()
            .from(workoutItems)
            .where(and(eq(workoutItems.cycleId, cycle.id), eq(workoutItems.dayIndex, dayIndex)))
            .orderBy(workoutItems.orderIndex);
        }
      }
    }

    const completedIds = new Set(completions.map(c => c.completion.workoutItemId));
    const muscleMap = new Map<string, { count: number; volume: number }>();
    const exercises: {
      name: string;
      muscle: string;
      sets: number;
      reps: number;
      weight: string | null;
      completed: boolean;
      volume: number;
    }[] = [];

    let totalVolume = 0;

    for (const { completion, item } of completions) {
      const sets = completion.actualSets || item.sets;
      const reps = completion.actualReps || item.reps;
      const weight = parseFloat((completion.actualWeight || item.weight || "0").replace(/[^\d.]/g, "")) || 0;
      const volume = sets * reps * weight;
      totalVolume += volume;

      const existing = muscleMap.get(item.muscleType) || { count: 0, volume: 0 };
      muscleMap.set(item.muscleType, { count: existing.count + 1, volume: existing.volume + volume });

      exercises.push({
        name: item.exerciseName,
        muscle: item.muscleType,
        sets,
        reps,
        weight: completion.actualWeight || item.weight,
        completed: true,
        volume
      });
    }

    for (const item of scheduledItems) {
      if (!completedIds.has(item.id)) {
        exercises.push({
          name: item.exerciseName,
          muscle: item.muscleType,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight,
          completed: false,
          volume: 0
        });
      }
    }

    const muscleBreakdown = Array.from(muscleMap.entries()).map(([muscle, data]) => ({
      muscle,
      count: data.count,
      volume: data.volume
    })).sort((a, b) => b.count - a.count);

    return {
      date,
      totalExercises: scheduledItems.length || completions.length,
      completedCount: completions.length,
      missedCount: Math.max(0, scheduledItems.length - completions.length),
      totalVolume,
      muscleBreakdown,
      exercises
    };
  }

  // Owner Dashboard & Attendance Analytics
  async getOwnerDashboardMetrics(gymId: number, clientToday?: string): Promise<{
    totalMembers: number;
    checkedInToday: number;
    checkedInYesterday: number;
    newEnrollmentsLast30Days: number;
    pendingPayments: number;
    totalRevenue: number;
  }> {
    // Use client's local date if provided, otherwise fall back to server UTC
    const today = clientToday || new Date().toISOString().split("T")[0];
    // Calculate yesterday based on the provided today date
    const todayDate = new Date(today + 'T00:00:00');
    const yesterday = new Date(todayDate.getTime() - 86400000).toISOString().split("T")[0];
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

    // Calculate pending payments (subscriptions with remaining balance for EMI/partial)
    const subscriptions = await db.select().from(memberSubscriptions)
      .where(and(eq(memberSubscriptions.gymId, gymId), inArray(memberSubscriptions.paymentMode, ['emi', 'partial'])));
    
    let pendingPayments = 0;
    for (const sub of subscriptions) {
      const txns = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
        .from(paymentTransactions)
        .where(eq(paymentTransactions.subscriptionId, sub.id));
      const totalPaid = Number(txns[0]?.total) || 0;
      if (sub.totalAmount > totalPaid) {
        pendingPayments++;
      }
    }

    // Calculate this month's revenue (not total)
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    
    const revenueResult = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.gymId, gymId),
        gte(paymentTransactions.paidOn, monthStart),
        lte(paymentTransactions.paidOn, monthEnd)
      ));
    const totalRevenue = Number(revenueResult[0]?.total) || 0;

    return { totalMembers, checkedInToday, checkedInYesterday, newEnrollmentsLast30Days, pendingPayments, totalRevenue };
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

  async getSubscriptionsWithPayments(gymId: number): Promise<(MemberSubscription & { plan: MembershipPlan | null; transactions: PaymentTransaction[] })[]> {
    const subs = await db.select()
      .from(memberSubscriptions)
      .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
      .where(eq(memberSubscriptions.gymId, gymId))
      .orderBy(desc(memberSubscriptions.createdAt));
    
    const result = [];
    for (const sub of subs) {
      const transactions = await db.select().from(paymentTransactions)
        .where(eq(paymentTransactions.subscriptionId, sub.member_subscriptions.id))
        .orderBy(desc(paymentTransactions.paidOn));
      
      result.push({
        ...sub.member_subscriptions,
        plan: sub.membership_plans,
        transactions
      });
    }
    return result;
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

  async getMemberPaymentDetails(memberId: number, gymId: number): Promise<{
    subscription: (MemberSubscription & { plan: MembershipPlan | null }) | null;
    totalPaid: number;
    remainingBalance: number;
    transactions: PaymentTransaction[];
  } | null> {
    const [sub] = await db.select().from(memberSubscriptions)
      .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
      .where(and(
        eq(memberSubscriptions.memberId, memberId),
        eq(memberSubscriptions.gymId, gymId)
      ))
      .orderBy(desc(memberSubscriptions.createdAt))
      .limit(1);
    
    if (!sub) return null;

    const transactions = await db.select().from(paymentTransactions)
      .where(eq(paymentTransactions.subscriptionId, sub.member_subscriptions.id))
      .orderBy(desc(paymentTransactions.paidOn));
    
    const totalPaid = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const remainingBalance = sub.member_subscriptions.totalAmount - totalPaid;
    
    return {
      subscription: {
        ...sub.member_subscriptions,
        plan: sub.membership_plans
      },
      totalPaid,
      remainingBalance,
      transactions
    };
  }

  // === REVENUE ANALYTICS ===
  async getRevenueAnalytics(gymId: number, month: string): Promise<{
    monthlyRevenue: number;
    totalTransactions: number;
    uniquePayers: number;
    transactions: (PaymentTransaction & { member: User })[];
    monthlyBreakdown: { month: string; revenue: number }[];
  }> {
    // Helper to format date as YYYY-MM-DD without timezone issues
    const formatDateStr = (y: number, m: number, d: number): string => {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };
    
    // Get last day of month
    const getLastDayOfMonth = (y: number, m: number): number => {
      return new Date(y, m, 0).getDate();
    };
    
    // Parse month (YYYY-MM format)
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = formatDateStr(year, monthNum, 1);
    const endDate = formatDateStr(year, monthNum, getLastDayOfMonth(year, monthNum));
    
    // Get transactions for the selected month
    const monthTxns = await db.select({
      transaction: paymentTransactions,
      member: users
    })
      .from(paymentTransactions)
      .leftJoin(users, eq(paymentTransactions.memberId, users.id))
      .where(and(
        eq(paymentTransactions.gymId, gymId),
        gte(paymentTransactions.paidOn, startDate),
        lte(paymentTransactions.paidOn, endDate)
      ))
      .orderBy(desc(paymentTransactions.paidOn));
    
    const transactions = monthTxns.map(t => ({
      ...t.transaction,
      member: t.member!
    }));
    
    const monthlyRevenue = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const totalTransactions = transactions.length;
    const uniquePayers = new Set(transactions.map(t => t.memberId)).size;
    
    // Get 6-month breakdown
    const monthlyBreakdown: { month: string; revenue: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      let targetMonth = monthNum - i;
      let targetYear = year;
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear--;
      }
      
      const mStart = formatDateStr(targetYear, targetMonth, 1);
      const mEnd = formatDateStr(targetYear, targetMonth, getLastDayOfMonth(targetYear, targetMonth));
      
      const result = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
        .from(paymentTransactions)
        .where(and(
          eq(paymentTransactions.gymId, gymId),
          gte(paymentTransactions.paidOn, mStart),
          lte(paymentTransactions.paidOn, mEnd)
        ));
      
      monthlyBreakdown.push({
        month: `${monthNames[targetMonth - 1]} '${String(targetYear).slice(-2)}`,
        revenue: Number(result[0]?.total) || 0
      });
    }
    
    return {
      monthlyRevenue,
      totalTransactions,
      uniquePayers,
      transactions,
      monthlyBreakdown
    };
  }

  // === MEMBER ANALYTICS ===
  async getMemberAnalytics(gymId: number): Promise<{
    counts: { active: number; ended: number; transferredOut: number; transferredIn: number };
    activeMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; trainerName: string | null }[];
    endedMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; reason: string }[];
    transferredOut: { id: number; username: string; publicId: string | null; toGymName: string; transferDate: string }[];
    transferredIn: { id: number; username: string; publicId: string | null; fromGymName: string; transferDate: string }[];
    monthlyTrend: { month: string; active: number; ended: number }[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all gym members
    const allMembers = await db.select().from(users)
      .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
    
    // Get all subscriptions with plans - select individual columns
    const allSubs = await db.select({
      subId: memberSubscriptions.id,
      subMemberId: memberSubscriptions.memberId,
      subStatus: memberSubscriptions.status,
      subStartDate: memberSubscriptions.startDate,
      subEndDate: memberSubscriptions.endDate,
      planName: membershipPlans.name,
      memberId: users.id,
      memberUsername: users.username,
      memberPublicId: users.publicId
    })
      .from(memberSubscriptions)
      .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
      .leftJoin(users, eq(memberSubscriptions.memberId, users.id))
      .where(eq(memberSubscriptions.gymId, gymId));
    
    // Get trainer assignments (active = endedAt is null)
    const assignments = await db.select({
      memberId: trainerMemberAssignments.memberId,
      trainerUsername: users.username
    })
      .from(trainerMemberAssignments)
      .leftJoin(users, eq(trainerMemberAssignments.trainerId, users.id))
      .where(and(
        eq(trainerMemberAssignments.gymId, gymId),
        isNull(trainerMemberAssignments.endedAt)
      ));
    
    const trainerMap = new Map(assignments.map(a => [a.memberId, a.trainerUsername || null]));
    
    // Group subscriptions by member, prioritizing active subscriptions
    type SubItem = { 
      subId: number; subMemberId: number; subStatus: string; subStartDate: string | null; subEndDate: string | null; 
      planName: string | null; memberId: number | null; memberUsername: string | null; memberPublicId: string | null 
    };
    const memberSubMap = new Map<number, SubItem[]>();
    
    for (const item of allSubs) {
      if (!item.memberId) continue;
      const list = memberSubMap.get(item.memberId) || [];
      list.push(item);
      memberSubMap.set(item.memberId, list);
    }
    
    // Classify members based on subscription endDate vs today (not stored status)
    const activeMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; trainerName: string | null }[] = [];
    const endedMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; reason: string }[] = [];
    
    for (const [memberId, subs] of memberSubMap) {
      // Sort subscriptions by endDate descending to get most recent first
      const sortedSubs = [...subs].sort((a, b) => (b.subEndDate || '').localeCompare(a.subEndDate || ''));
      
      // Check if ANY subscription's endDate is >= today (not expired)
      const activeSub = sortedSubs.find(s => s.subEndDate && s.subEndDate >= today);
      
      if (activeSub) {
        activeMembers.push({
          id: activeSub.memberId!,
          username: activeSub.memberUsername || '',
          publicId: activeSub.memberPublicId,
          planName: activeSub.planName,
          startDate: activeSub.subStartDate,
          endDate: activeSub.subEndDate,
          trainerName: trainerMap.get(memberId) || null
        });
      } else if (sortedSubs.length > 0) {
        // No active subscription - use most recent subscription (already sorted)
        const latestSub = sortedSubs[0];
        // All subscriptions have expired
        endedMembers.push({
          id: latestSub.memberId!,
          username: latestSub.memberUsername || '',
          publicId: latestSub.memberPublicId,
          planName: latestSub.planName,
          startDate: latestSub.subStartDate,
          endDate: latestSub.subEndDate,
          reason: latestSub.subStatus === 'cancelled' ? 'Cancelled' : 'Expired'
        });
      }
    }
    
    // Get transfer requests - select individual columns
    const transfersOut = await db.select({
      requestUpdatedAt: transferRequests.updatedAt,
      memberId: users.id,
      memberUsername: users.username,
      memberPublicId: users.publicId,
      toGymName: gyms.name
    })
      .from(transferRequests)
      .leftJoin(users, eq(transferRequests.memberId, users.id))
      .leftJoin(gyms, eq(transferRequests.toGymId, gyms.id))
      .where(and(
        eq(transferRequests.fromGymId, gymId),
        eq(transferRequests.status, 'approved')
      ));
    
    const transferredOut = transfersOut.map(t => ({
      id: t.memberId || 0,
      username: t.memberUsername || 'Unknown',
      publicId: t.memberPublicId || null,
      toGymName: t.toGymName || 'Unknown Gym',
      transferDate: t.requestUpdatedAt?.toISOString().split('T')[0] || ''
    }));
    
    const transfersIn = await db.select({
      requestUpdatedAt: transferRequests.updatedAt,
      memberId: users.id,
      memberUsername: users.username,
      memberPublicId: users.publicId,
      fromGymName: gyms.name
    })
      .from(transferRequests)
      .leftJoin(users, eq(transferRequests.memberId, users.id))
      .leftJoin(gyms, eq(transferRequests.fromGymId, gyms.id))
      .where(and(
        eq(transferRequests.toGymId, gymId),
        eq(transferRequests.status, 'approved')
      ));
    
    const transferredIn = transfersIn.map(t => ({
      id: t.memberId || 0,
      username: t.memberUsername || 'Unknown',
      publicId: t.memberPublicId || null,
      fromGymName: t.fromGymName || 'Unknown Gym',
      transferDate: t.requestUpdatedAt?.toISOString().split('T')[0] || ''
    }));
    
    // Calculate monthly trend (last 6 months) - count unique members
    const monthlyTrend: { month: string; active: number; ended: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      // Count unique members at month end using memberSubMap
      const activeMembersSet = new Set<number>();
      const endedMembersSet = new Set<number>();
      
      for (const [memberId, subs] of memberSubMap) {
        // Check if member had an active subscription at month end (endDate >= monthEnd)
        const hadActive = subs.some(s => 
          (s.subStartDate || '') <= monthEnd && 
          (s.subEndDate === null || s.subEndDate >= monthEnd)
        );
        
        if (hadActive) {
          activeMembersSet.add(memberId);
        } else {
          // Check if they had any subscription that ended by month end
          const hadEnded = subs.some(s => 
            (s.subStartDate || '') <= monthEnd && 
            s.subEndDate && s.subEndDate < monthEnd
          );
          if (hadEnded) {
            endedMembersSet.add(memberId);
          }
        }
      }
      
      monthlyTrend.push({
        month: `${monthNames[targetDate.getMonth()]} '${String(targetDate.getFullYear()).slice(-2)}`,
        active: activeMembersSet.size,
        ended: endedMembersSet.size
      });
    }
    
    return {
      counts: {
        active: activeMembers.length,
        ended: endedMembers.length,
        transferredOut: transferredOut.length,
        transferredIn: transferredIn.length
      },
      activeMembers,
      endedMembers,
      transferredOut,
      transferredIn,
      monthlyTrend
    };
  }

  // === INACTIVE MEMBERS ===
  async getInactiveMembers(gymId: number, options: {
    days: number;
    includeEnded: boolean;
    mode: 'attendance' | 'workouts';
    clientDate: string;
    search?: string;
  }): Promise<{
    memberId: number;
    name: string;
    email: string | null;
    publicId: string | null;
    status: 'active' | 'ended' | 'transferred';
    lastAttendedDate: string | null;
    daysAbsent: number;
  }[]> {
    const { days, includeEnded, mode, clientDate, search } = options;
    const today = clientDate; // Use client's local date
    
    // Get all gym members
    const allMembers = await db.select().from(users)
      .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
    
    if (allMembers.length === 0) return [];
    
    // Get subscription status for each member
    const allSubs = await db.select()
      .from(memberSubscriptions)
      .where(eq(memberSubscriptions.gymId, gymId));
    
    // Get approved transfer requests (members who left)
    const transferredOutIds = new Set(
      (await db.select({ memberId: transferRequests.memberId })
        .from(transferRequests)
        .where(and(
          eq(transferRequests.fromGymId, gymId),
          eq(transferRequests.status, 'approved')
        ))
      ).map(t => t.memberId)
    );
    
    // Group subscriptions by member
    const memberSubMap = new Map<number, typeof allSubs>();
    for (const sub of allSubs) {
      const list = memberSubMap.get(sub.memberId) || [];
      list.push(sub);
      memberSubMap.set(sub.memberId, list);
    }
    
    // Determine member status based on subscription endDate vs today
    const memberStatusMap = new Map<number, 'active' | 'ended' | 'transferred'>();
    for (const member of allMembers) {
      if (transferredOutIds.has(member.id)) {
        memberStatusMap.set(member.id, 'transferred');
        continue;
      }
      const subs = memberSubMap.get(member.id) || [];
      // Check if any subscription's endDate is >= today (not expired)
      const hasActive = subs.some(s => s.endDate >= today);
      memberStatusMap.set(member.id, hasActive ? 'active' : 'ended');
    }
    
    // Filter members based on includeEnded
    let filteredMembers = allMembers;
    if (!includeEnded) {
      filteredMembers = allMembers.filter(m => memberStatusMap.get(m.id) === 'active');
    }
    
    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredMembers = filteredMembers.filter(m => 
        m.username.toLowerCase().includes(searchLower) ||
        (m.email && m.email.toLowerCase().includes(searchLower)) ||
        (m.publicId && m.publicId.toLowerCase().includes(searchLower))
      );
    }
    
    if (filteredMembers.length === 0) return [];
    
    const memberIds = filteredMembers.map(m => m.id);
    
    // Get last attendance/workout date based on mode
    let lastDateMap = new Map<number, string | null>();
    
    if (mode === 'attendance') {
      // Get MAX(date) from attendance where status='present' for each member
      const attendanceData = await db.select({
        memberId: attendance.memberId,
        lastDate: sql<string>`MAX(${attendance.date})`.as('lastDate')
      })
        .from(attendance)
        .where(and(
          eq(attendance.gymId, gymId),
          eq(attendance.status, 'present'),
          inArray(attendance.memberId, memberIds)
        ))
        .groupBy(attendance.memberId);
      
      for (const row of attendanceData) {
        lastDateMap.set(row.memberId, row.lastDate);
      }
    } else {
      // Get MAX(date) from workout_logs for each member
      const workoutData = await db.select({
        memberId: workoutLogs.memberId,
        lastDate: sql<string>`MAX(${workoutLogs.date})`.as('lastDate')
      })
        .from(workoutLogs)
        .where(and(
          eq(workoutLogs.gymId, gymId),
          inArray(workoutLogs.memberId, memberIds)
        ))
        .groupBy(workoutLogs.memberId);
      
      for (const row of workoutData) {
        lastDateMap.set(row.memberId, row.lastDate);
      }
    }
    
    // Calculate days absent and filter
    const results: {
      memberId: number;
      name: string;
      email: string | null;
      publicId: string | null;
      status: 'active' | 'ended' | 'transferred';
      lastAttendedDate: string | null;
      daysAbsent: number;
    }[] = [];
    
    const todayDate = new Date(today);
    
    for (const member of filteredMembers) {
      const lastDate = lastDateMap.get(member.id) || null;
      let daysAbsent: number;
      
      if (!lastDate) {
        // Never attended - set very high value
        daysAbsent = 9999;
      } else {
        const lastDateObj = new Date(lastDate);
        daysAbsent = Math.floor((todayDate.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      // Only include if days absent >= threshold
      if (daysAbsent >= days) {
        results.push({
          memberId: member.id,
          name: member.username,
          email: member.email,
          publicId: member.publicId,
          status: memberStatusMap.get(member.id) || 'active',
          lastAttendedDate: lastDate,
          daysAbsent
        });
      }
    }
    
    // Sort by days absent descending (most inactive first)
    results.sort((a, b) => b.daysAbsent - a.daysAbsent);
    
    return results;
  }

  // === SUBSCRIPTION ALERTS ===
  async getSubscriptionAlerts(gymId: number): Promise<{ active: number; endingSoon: number; overdue: number; needSubscription: number }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const subs = await db.select().from(memberSubscriptions)
      .where(eq(memberSubscriptions.gymId, gymId));
    
    const allMembers = await db.select().from(users)
      .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
    
    const memberIdsWithSub = new Set(subs.map(s => s.memberId));
    const needSubscription = allMembers.filter(m => !memberIdsWithSub.has(m.id)).length;
    
    let active = 0;
    let endingSoon = 0;
    let overdue = 0;
    
    for (const sub of subs) {
      if (sub.status === 'active' || sub.status === 'endingSoon') {
        active++;
      }
      if (sub.status === 'endingSoon' || (sub.endDate >= today && sub.endDate <= sevenDaysLater && sub.status === 'active')) {
        endingSoon++;
      }
      if (sub.status === 'overdue' || (sub.endDate < today && sub.status !== 'ended')) {
        overdue++;
      }
    }
    
    return { active, endingSoon, overdue, needSubscription };
  }

  async getMembersNeedingSubscription(gymId: number): Promise<{ id: number; username: string; publicId: string | null; createdAt: Date | null }[]> {
    const allMembers = await db.select().from(users)
      .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
    
    const subs = await db.select().from(memberSubscriptions)
      .where(eq(memberSubscriptions.gymId, gymId));
    
    const memberIdsWithSub = new Set(subs.map(s => s.memberId));
    
    return allMembers
      .filter(m => !memberIdsWithSub.has(m.id))
      .map(m => ({
        id: m.id,
        username: m.username,
        publicId: m.publicId,
        createdAt: m.createdAt
      }));
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
    // Get data from BOTH workout systems:
    // 1. workoutSessions - standalone sessions members create
    // 2. workoutCompletions - completions from trainer-assigned cycles

    const sessions = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.gymId, gymId), eq(workoutSessions.memberId, memberId)))
      .orderBy(desc(workoutSessions.date));
    
    // Also get workout completions (from trainer cycles) - these may be in different gyms historically
    const completions = await db.select({
      completion: workoutCompletions,
      workoutItem: workoutItems
    })
    .from(workoutCompletions)
    .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
    .where(eq(workoutCompletions.memberId, memberId))
    .orderBy(desc(workoutCompletions.completedDate));
    
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';
    
    // Combine unique dates from both sources
    const sessionDatesSet = new Set(sessions.map(s => s.date));
    const completionDatesSet = new Set(completions.map(c => c.completion.completedDate));
    const allDates = new Set([...Array.from(sessionDatesSet), ...Array.from(completionDatesSet)]);
    const uniqueDates = Array.from(allDates).sort().reverse();
    
    // Pre-load schedule data for fast streak calculation
    const scheduleCache = await this.loadMemberScheduleData(memberId);
    
    // Smart rest day streak calculation (consistent with getMemberStats):
    // - If today has workout → count it, then check from yesterday
    // - If today incomplete → skip today (day not over), start from yesterday
    // - Going backwards: workout → streak++, rest/unplanned → continue, missed → break
    let streak = 0;
    let checkDate = new Date(today + 'T00:00:00');
    const maxDaysToCheck = 365;
    
    // Check if today already has a workout completed
    const todayHasWorkout = allDates.has(today);
    
    if (todayHasWorkout) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Today not completed yet - skip to yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Check from yesterday backwards
    for (let i = 0; i < maxDaysToCheck; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasWorkout = allDates.has(dateStr);
      
      if (hasWorkout) {
        streak++;
      } else {
        const dayStatus = this.getScheduledDayStatusFromCache(dateStr, scheduleCache);
        if (dayStatus === "workout") {
          break;
        }
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Calculate counts using unique dates
    const last7DaysDates = uniqueDates.filter(d => d >= sevenDaysAgo);
    const thisMonthDates = uniqueDates.filter(d => d >= monthStart);
    
    // Calendar days (last 90 days for display) - combine both sources
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Group completions by date with muscle group info
    const completionsByDate = new Map<string, string>();
    for (const c of completions) {
      if (c.completion.completedDate >= ninetyDaysAgo) {
        if (!completionsByDate.has(c.completion.completedDate)) {
          completionsByDate.set(c.completion.completedDate, c.workoutItem.muscleType);
        }
      }
    }
    
    // Start with sessions and add completion-only days
    const calendarDays = sessions
      .filter(s => s.date >= ninetyDaysAgo)
      .map(s => ({ date: s.date, focusLabel: s.focusLabel }));
    
    // Add days from completions that aren't in sessions
    completionsByDate.forEach((muscleType, date) => {
      if (!sessionDatesSet.has(date)) {
        calendarDays.push({ date, focusLabel: muscleType });
      }
    });
    
    // Sort by date descending
    calendarDays.sort((a, b) => b.date.localeCompare(a.date));
    
    return {
      streak,
      totalWorkouts: uniqueDates.length,
      last7DaysCount: last7DaysDates.length,
      thisMonthCount: thisMonthDates.length,
      calendarDays
    };
  }

  async getMemberSessionHistory(gymId: number, memberId: number, from?: string, to?: string): Promise<{
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

  async updateWorkoutSessionExercise(exerciseId: number, gymId: number, memberId: number, data: { sets?: number; reps?: number; weight?: string; notes?: string }): Promise<WorkoutSessionExercise | null> {
    const [exercise] = await db.select({
      exercise: workoutSessionExercises,
      session: workoutSessions
    })
    .from(workoutSessionExercises)
    .innerJoin(workoutSessions, eq(workoutSessionExercises.sessionId, workoutSessions.id))
    .where(eq(workoutSessionExercises.id, exerciseId));
    
    if (!exercise) return null;
    if (exercise.session.gymId !== gymId || exercise.session.memberId !== memberId) return null;
    
    const updateData: any = {};
    if (data.sets !== undefined) updateData.sets = data.sets;
    if (data.reps !== undefined) updateData.reps = data.reps;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.notes !== undefined) updateData.notes = data.notes;
    
    const [updated] = await db.update(workoutSessionExercises)
      .set(updateData)
      .where(eq(workoutSessionExercises.id, exerciseId))
      .returning();
    
    return updated;
  }

  async getCycleSchedule(gymId: number, memberId: number): Promise<{
    cycleId: number | null;
    cycleName: string | null;
    cycleLength: number;
    startDate: string | null;
    endDate: string | null;
    schedule: {
      date: string;
      dayIndex: number;
      dayLabel: string;
      status: "done" | "in_progress" | "not_started" | "rest_day";
      isManuallyCompleted: boolean;
      completedExercises: number;
      totalExercises: number;
      sessionId: number | null;
      plannedExercises: {
        id: number;
        exerciseName: string;
        sets: number;
        reps: number;
        weight: string | null;
        muscleType: string | null;
        completed: boolean;
        completedSets?: number;
        completedReps?: number;
        completedWeight?: string;
      }[];
    }[];
  }> {
    const cycle = await this.getMemberCycle(memberId);
    if (!cycle) {
      return { cycleId: null, cycleName: null, cycleLength: 0, startDate: null, endDate: null, schedule: [] };
    }

    const items = await this.getWorkoutItems(cycle.id);
    const sessions = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.gymId, gymId), eq(workoutSessions.memberId, memberId)));
    
    // Get exercises for each session with details
    const sessionExerciseCounts: Record<number, number> = {};
    const sessionExercisesByName: Record<number, Record<string, { sets: number; reps: number; weight: string | null }>> = {};
    for (const session of sessions) {
      const exercises = await db.select().from(workoutSessionExercises)
        .where(eq(workoutSessionExercises.sessionId, session.id));
      sessionExerciseCounts[session.id] = exercises.length;
      sessionExercisesByName[session.id] = {};
      for (const ex of exercises) {
        sessionExercisesByName[session.id][ex.exerciseName] = {
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight
        };
      }
    }
    
    // Build session map by date
    const sessionsByDate: Record<string, typeof sessions[0]> = {};
    for (const s of sessions) {
      sessionsByDate[s.date] = s;
    }
    
    // Get items grouped by dayIndex
    const itemsByDay: Record<number, typeof items> = {};
    for (const item of items) {
      if (!itemsByDay[item.dayIndex]) {
        itemsByDay[item.dayIndex] = [];
      }
      itemsByDay[item.dayIndex].push(item);
    }
    
    // Generate schedule from startDate to today (or endDate if past)
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(Math.min(new Date(cycle.endDate).getTime(), new Date(today).getTime()));
    
    type PlannedExercise = {
      id: number;
      exerciseName: string;
      sets: number;
      reps: number;
      weight: string | null;
      muscleType: string | null;
      completed: boolean;
      completedSets?: number;
      completedReps?: number;
      completedWeight?: string;
    };
    
    const schedule: {
      date: string;
      dayIndex: number;
      dayLabel: string;
      status: "done" | "in_progress" | "not_started" | "rest_day";
      isManuallyCompleted: boolean;
      completedExercises: number;
      totalExercises: number;
      sessionId: number | null;
      plannedExercises: PlannedExercise[];
    }[] = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayIndex = daysSinceStart % cycle.cycleLength;
      const dayLabel = cycle.dayLabels?.[dayIndex] || `Day ${dayIndex + 1}`;
      const dayItems = itemsByDay[dayIndex] || [];
      const isRestDay = (cycle.restDays?.includes(dayIndex)) || dayLabel.toLowerCase().includes("rest") || dayItems.length === 0;
      
      const session = sessionsByDate[dateStr];
      const totalExercises = dayItems.length;
      const completedExercises = session ? (sessionExerciseCounts[session.id] || 0) : 0;
      const isManuallyCompleted = Boolean(session?.isManuallyCompleted);
      
      // Build planned exercises with completion status
      const completedByName = session ? (sessionExercisesByName[session.id] || {}) : {};
      const plannedExercises: PlannedExercise[] = dayItems.map(item => {
        const completed = completedByName[item.exerciseName];
        return {
          id: item.id,
          exerciseName: item.exerciseName,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight,
          muscleType: item.muscleType,
          completed: !!completed,
          completedSets: completed?.sets,
          completedReps: completed?.reps,
          completedWeight: completed?.weight || undefined
        };
      });
      
      // Status priority: manual completion > rest day > organic completion
      let status: "done" | "in_progress" | "not_started" | "rest_day";
      if (isManuallyCompleted || (completedExercises >= totalExercises && totalExercises > 0)) {
        status = "done";
      } else if (isRestDay) {
        status = "rest_day";
      } else if (completedExercises > 0) {
        status = "in_progress";
      } else {
        status = "not_started";
      }
      
      schedule.push({
        date: dateStr,
        dayIndex,
        dayLabel,
        status,
        isManuallyCompleted,
        completedExercises,
        totalExercises,
        sessionId: session?.id || null,
        plannedExercises
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Return in reverse chronological order (most recent first)
    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      cycleLength: cycle.cycleLength,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      schedule: schedule.reverse()
    };
  }

  async markDayDone(gymId: number, memberId: number, date: string): Promise<{ success: boolean; sessionId: number }> {
    const cycle = await this.getMemberCycle(memberId);
    if (!cycle) {
      throw new Error("No active cycle found");
    }
    
    // Calculate dayIndex for this date
    const startDate = new Date(cycle.startDate);
    const targetDate = new Date(date);
    const daysSinceStart = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
    const dayLabel = cycle.dayLabels?.[dayIndex] || `Day ${dayIndex + 1}`;
    
    // Check for existing session
    let session = await this.getWorkoutSessionByMemberDate(gymId, memberId, date);
    
    if (session) {
      // Update existing session to mark as done
      const [updated] = await db.update(workoutSessions)
        .set({ isManuallyCompleted: true, completedAt: new Date() })
        .where(eq(workoutSessions.id, session.id))
        .returning();
      return { success: true, sessionId: updated.id };
    } else {
      // Create new session with manual completion
      const [newSession] = await db.insert(workoutSessions).values({
        gymId,
        memberId,
        date,
        cycleId: cycle.id,
        cycleDayIndex: dayIndex,
        focusLabel: dayLabel,
        isManuallyCompleted: true,
        completedAt: new Date()
      }).returning();
      return { success: true, sessionId: newSession.id };
    }
  }

  async getMissedWorkouts(gymId: number, memberId: number, from?: string, to?: string): Promise<{
    date: string;
    dayLabel: string;
    completedCount: number;
    totalCount: number;
    status: "missed" | "partial";
    missedExercises: string[];
  }[]> {
    const scheduleData = await this.getCycleSchedule(gymId, memberId);
    if (!scheduleData.cycleId) {
      return [];
    }
    
    const items = await this.getWorkoutItems(scheduleData.cycleId);
    const itemsByDay: Record<number, string[]> = {};
    for (const item of items) {
      if (!itemsByDay[item.dayIndex]) {
        itemsByDay[item.dayIndex] = [];
      }
      itemsByDay[item.dayIndex].push(item.exerciseName);
    }
    
    const today = new Date().toISOString().split('T')[0];
    const missed: {
      date: string;
      dayLabel: string;
      completedCount: number;
      totalCount: number;
      status: "missed" | "partial";
      missedExercises: string[];
    }[] = [];
    
    for (const day of scheduleData.schedule) {
      // Skip future dates (but allow today if manually completed)
      const isFutureDate = day.date > today;
      const isTodayNotDone = day.date === today && !day.isManuallyCompleted;
      if (isFutureDate || isTodayNotDone) continue;
      
      // Skip rest days
      if (day.status === "rest_day") continue;
      
      // Apply date filters
      if (from && day.date < from) continue;
      if (to && day.date > to) continue;
      
      // Get completed exercise names for this day
      let completedExerciseNames: string[] = [];
      if (day.sessionId) {
        const exercises = await db.select().from(workoutSessionExercises)
          .where(eq(workoutSessionExercises.sessionId, day.sessionId));
        completedExerciseNames = exercises.map(e => e.exerciseName);
      }
      
      const allExercises = itemsByDay[day.dayIndex] || [];
      const missedExercises = allExercises.filter(e => !completedExerciseNames.includes(e));
      
      // Include if: not done, OR done but has missed exercises (partial completion)
      const isDone = day.status === "done";
      const hasIncompleteExercises = missedExercises.length > 0 && allExercises.length > 0;
      
      if (!isDone || (isDone && hasIncompleteExercises)) {
        missed.push({
          date: day.date,
          dayLabel: day.dayLabel,
          completedCount: day.completedExercises,
          totalCount: day.totalExercises,
          status: day.completedExercises === 0 ? "missed" : "partial",
          missedExercises
        });
      }
    }
    
    return missed;
  }
  
  // === Gym Requests Methods ===
  async createGymRequest(data: InsertGymRequest): Promise<GymRequest> {
    const [request] = await db.insert(gymRequests).values(data).returning();
    return request;
  }
  
  async getGymRequestByOwner(ownerUserId: number): Promise<GymRequest | undefined> {
    const [request] = await db.select().from(gymRequests)
      .where(eq(gymRequests.ownerUserId, ownerUserId))
      .orderBy(desc(gymRequests.createdAt))
      .limit(1);
    return request;
  }
  
  async getGymRequestById(requestId: number): Promise<(GymRequest & { ownerName: string; ownerEmail: string | null }) | undefined> {
    const [result] = await db.select({
      request: gymRequests,
      owner: users
    })
    .from(gymRequests)
    .innerJoin(users, eq(gymRequests.ownerUserId, users.id))
    .where(eq(gymRequests.id, requestId));
    
    if (!result) return undefined;
    return {
      ...result.request,
      ownerName: result.owner.username,
      ownerEmail: result.owner.email
    };
  }
  
  async getPendingGymRequests(): Promise<(GymRequest & { ownerName: string })[]> {
    const requests = await db.select({
      request: gymRequests,
      owner: users
    })
    .from(gymRequests)
    .innerJoin(users, eq(gymRequests.ownerUserId, users.id))
    .where(eq(gymRequests.status, "pending"))
    .orderBy(desc(gymRequests.createdAt));
    
    return requests.map(r => ({
      ...r.request,
      ownerName: r.owner.username
    }));
  }
  
  async approveGymRequest(requestId: number): Promise<{ gymRequest: GymRequest; gym: Gym }> {
    const [request] = await db.select().from(gymRequests).where(eq(gymRequests.id, requestId));
    if (!request) throw new Error("Gym request not found");
    
    const code = nanoid(6).toUpperCase();
    
    const [gym] = await db.insert(gyms).values({
      name: request.gymName,
      code,
      phone: request.phone,
      address: request.address,
      city: request.city,
      state: request.state,
      country: request.country,
      ownerUserId: request.ownerUserId
    }).returning();
    
    await db.update(users).set({ gymId: gym.id }).where(eq(users.id, request.ownerUserId));
    
    const [updatedRequest] = await db.update(gymRequests)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(gymRequests.id, requestId))
      .returning();
    
    return { gymRequest: updatedRequest, gym };
  }
  
  async rejectGymRequest(requestId: number, adminNotes: string): Promise<GymRequest> {
    const [request] = await db.update(gymRequests)
      .set({ status: "rejected", adminNotes, reviewedAt: new Date() })
      .where(eq(gymRequests.id, requestId))
      .returning();
    return request;
  }
  
  // === Join Requests Methods ===
  async createJoinRequest(data: InsertJoinRequest): Promise<JoinRequest> {
    const [request] = await db.insert(joinRequests).values(data).returning();
    return request;
  }
  
  async getJoinRequestByUser(userId: number): Promise<(JoinRequest & { gymName: string; gymCode: string }) | undefined> {
    const result = await db.select({
      request: joinRequests,
      gym: gyms
    })
    .from(joinRequests)
    .innerJoin(gyms, eq(joinRequests.gymId, gyms.id))
    .where(eq(joinRequests.userId, userId))
    .orderBy(desc(joinRequests.createdAt))
    .limit(1);
    
    if (result.length === 0) return undefined;
    return { ...result[0].request, gymName: result[0].gym.name, gymCode: result[0].gym.code };
  }
  
  async getPendingJoinRequestsForGym(gymId: number): Promise<(JoinRequest & { userName: string; userRole: string })[]> {
    const requests = await db.select({
      request: joinRequests,
      user: users
    })
    .from(joinRequests)
    .innerJoin(users, eq(joinRequests.userId, users.id))
    .where(and(eq(joinRequests.gymId, gymId), eq(joinRequests.status, "pending")))
    .orderBy(desc(joinRequests.createdAt));
    
    return requests.map(r => ({
      ...r.request,
      userName: r.user.username,
      userRole: r.user.role
    }));
  }
  
  async approveJoinRequest(requestId: number): Promise<JoinRequest> {
    const [request] = await db.select().from(joinRequests).where(eq(joinRequests.id, requestId));
    if (!request) throw new Error("Join request not found");
    
    await db.update(users).set({ gymId: request.gymId }).where(eq(users.id, request.userId));
    
    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
    if (user && (user.role === "member" || user.role === "trainer")) {
      await db.insert(gymHistory).values({
        memberId: request.userId,
        gymId: request.gymId
      });
    }
    
    const [updatedRequest] = await db.update(joinRequests)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(joinRequests.id, requestId))
      .returning();
    
    return updatedRequest;
  }
  
  async rejectJoinRequest(requestId: number): Promise<JoinRequest> {
    const [request] = await db.update(joinRequests)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(eq(joinRequests.id, requestId))
      .returning();
    return request;
  }
  
  // === Admin Functions ===
  async getAllGymRequestsWithOwner(): Promise<(GymRequest & { ownerName: string; ownerEmail: string | null })[]> {
    const requests = await db.select({
      request: gymRequests,
      owner: users
    })
    .from(gymRequests)
    .innerJoin(users, eq(gymRequests.ownerUserId, users.id))
    .orderBy(desc(gymRequests.createdAt));
    
    return requests.map(r => ({
      ...r.request,
      ownerName: r.owner.username,
      ownerEmail: r.owner.email
    }));
  }
  
  async getAllGymsWithDetails(filters?: { name?: string; city?: string; state?: string }): Promise<{
    id: number;
    name: string;
    code: string;
    city: string | null;
    state: string | null;
    country: string | null;
    createdAt: Date | null;
    ownerName: string | null;
    ownerEmail: string | null;
    subscriptionStatus: string | null;
    planType: string | null;
    validUntil: Date | null;
  }[]> {
    const conditions: ReturnType<typeof ilike>[] = [];
    if (filters?.name) {
      conditions.push(ilike(gyms.name, `%${filters.name}%`));
    }
    if (filters?.city) {
      conditions.push(ilike(gyms.city, `%${filters.city}%`));
    }
    if (filters?.state) {
      conditions.push(ilike(gyms.state, `%${filters.state}%`));
    }
    
    let query = db.select({
      gym: gyms,
      owner: users,
      subscription: gymSubscriptions
    })
    .from(gyms)
    .leftJoin(users, eq(gyms.ownerUserId, users.id))
    .leftJoin(gymSubscriptions, eq(gyms.id, gymSubscriptions.gymId));
    
    let results;
    if (conditions.length === 0) {
      results = await query.orderBy(desc(gyms.createdAt));
    } else if (conditions.length === 1) {
      results = await query.where(conditions[0]).orderBy(desc(gyms.createdAt));
    } else {
      results = await query.where(and(...conditions)).orderBy(desc(gyms.createdAt));
    }
    
    return results.map(r => ({
      id: r.gym.id,
      name: r.gym.name,
      code: r.gym.code,
      city: r.gym.city,
      state: r.gym.state,
      country: r.gym.country,
      createdAt: r.gym.createdAt,
      ownerName: r.owner?.username || null,
      ownerEmail: r.owner?.email || null,
      subscriptionStatus: r.subscription?.paymentStatus || null,
      planType: r.subscription?.planType || null,
      validUntil: r.subscription?.validUntil || null
    }));
  }
  
  async getGymSubscription(gymId: number): Promise<GymSubscription | null> {
    const [subscription] = await db.select().from(gymSubscriptions).where(eq(gymSubscriptions.gymId, gymId));
    return subscription || null;
  }
  
  async getAllGymSubscriptions(): Promise<(GymSubscription & { gymName: string })[]> {
    const results = await db.select({
      subscription: gymSubscriptions,
      gym: gyms
    })
    .from(gymSubscriptions)
    .innerJoin(gyms, eq(gymSubscriptions.gymId, gyms.id))
    .orderBy(desc(gymSubscriptions.updatedAt));
    
    return results.map(r => ({
      ...r.subscription,
      gymName: r.gym.name
    }));
  }
  
  async upsertGymSubscription(gymId: number, data: Partial<InsertGymSubscription>): Promise<GymSubscription> {
    const existing = await this.getGymSubscription(gymId);
    
    if (existing) {
      const [updated] = await db.update(gymSubscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(gymSubscriptions.gymId, gymId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(gymSubscriptions)
        .values({
          gymId,
          planType: data.planType || "1_month",
          amountPaid: data.amountPaid || 0,
          paymentStatus: data.paymentStatus || "pending",
          paidOn: data.paidOn,
          validUntil: data.validUntil,
          notes: data.notes
        })
        .returning();
      return created;
    }
  }
  
  // === Workout Templates Methods ===
  async getWorkoutTemplates(gymId: number, trainerId: number): Promise<WorkoutTemplate[]> {
    return await db.select().from(workoutTemplates)
      .where(and(
        eq(workoutTemplates.gymId, gymId),
        eq(workoutTemplates.trainerId, trainerId),
        eq(workoutTemplates.isActive, true)
      ))
      .orderBy(desc(workoutTemplates.createdAt));
  }
  
  async getWorkoutTemplate(templateId: number): Promise<(WorkoutTemplate & { items: WorkoutTemplateItem[] }) | null> {
    const [template] = await db.select().from(workoutTemplates).where(eq(workoutTemplates.id, templateId));
    if (!template) return null;
    
    const items = await db.select().from(workoutTemplateItems)
      .where(eq(workoutTemplateItems.templateId, templateId))
      .orderBy(workoutTemplateItems.dayIndex, workoutTemplateItems.orderIndex);
    
    return { ...template, items };
  }
  
  async createWorkoutTemplate(data: InsertWorkoutTemplate): Promise<WorkoutTemplate> {
    const [template] = await db.insert(workoutTemplates).values(data).returning();
    return template;
  }
  
  async createWorkoutTemplateItems(items: InsertWorkoutTemplateItem[]): Promise<WorkoutTemplateItem[]> {
    if (items.length === 0) return [];
    const created = await db.insert(workoutTemplateItems).values(items).returning();
    return created;
  }
  
  async deleteWorkoutTemplate(templateId: number, trainerId: number): Promise<void> {
    await db.update(workoutTemplates)
      .set({ isActive: false })
      .where(and(
        eq(workoutTemplates.id, templateId),
        eq(workoutTemplates.trainerId, trainerId)
      ));
  }
  
  async assignTemplateToMember(templateId: number, memberId: number, startDate: string, endDate: string, gymId: number, trainerId: number): Promise<WorkoutCycle> {
    const template = await this.getWorkoutTemplate(templateId);
    if (!template) throw new Error("Template not found");
    
    const [cycle] = await db.insert(workoutCycles).values({
      gymId,
      trainerId,
      memberId,
      name: template.name,
      cycleLength: template.daysPerCycle,
      dayLabels: template.dayLabels,
      startDate,
      endDate,
      isActive: true
    }).returning();
    
    if (template.items.length > 0) {
      const itemsToInsert = template.items.map(item => ({
        cycleId: cycle.id,
        dayIndex: item.dayIndex,
        muscleType: item.muscleType,
        bodyPart: item.bodyPart,
        exerciseName: item.exerciseName,
        sets: item.sets,
        reps: item.reps,
        weight: item.weight,
        orderIndex: item.orderIndex
      }));
      await db.insert(workoutItems).values(itemsToInsert);
    }
    
    return cycle;
  }
  
  // Body Measurements
  async getBodyMeasurements(gymId: number, memberId: number): Promise<BodyMeasurement[]> {
    return await db.select()
      .from(bodyMeasurements)
      .where(and(eq(bodyMeasurements.gymId, gymId), eq(bodyMeasurements.memberId, memberId)))
      .orderBy(desc(bodyMeasurements.recordedDate));
  }
  
  async getLatestBodyMeasurement(gymId: number, memberId: number): Promise<BodyMeasurement | null> {
    const [measurement] = await db.select()
      .from(bodyMeasurements)
      .where(and(eq(bodyMeasurements.gymId, gymId), eq(bodyMeasurements.memberId, memberId)))
      .orderBy(desc(bodyMeasurements.recordedDate))
      .limit(1);
    return measurement || null;
  }
  
  async createBodyMeasurement(data: InsertBodyMeasurement): Promise<BodyMeasurement> {
    const [measurement] = await db.insert(bodyMeasurements).values(data).returning();
    return measurement;
  }
  
  // User Profiles (Onboarding)
  async getUserProfile(userId: number): Promise<UserProfile | null> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile || null;
  }
  
  async createOrUpdateUserProfile(userId: number, data: { fullName: string; phone: string; gender: string; dob: string; age?: number; address?: string }): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (existing) {
      const [updated] = await db.update(userProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userProfiles)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }
  
  async setOnboardingCompleted(userId: number): Promise<void> {
    await db.update(users)
      .set({ onboardingCompleted: true })
      .where(eq(users.id, userId));
  }
  
  async getInitialBodyMeasurement(memberId: number): Promise<BodyMeasurement | null> {
    const [measurement] = await db.select()
      .from(bodyMeasurements)
      .where(and(eq(bodyMeasurements.memberId, memberId), eq(bodyMeasurements.isInitial, true)))
      .limit(1);
    return measurement || null;
  }
  
  async createInitialBodyMeasurement(data: { gymId: number; memberId: number; height: number; weight: number; bodyFat?: number; chest?: number; waist?: number; hips?: number }): Promise<BodyMeasurement> {
    const today = new Date().toISOString().split("T")[0];
    const [measurement] = await db.insert(bodyMeasurements)
      .values({
        gymId: data.gymId,
        memberId: data.memberId,
        recordedDate: today,
        height: data.height,
        weight: data.weight,
        bodyFat: data.bodyFat || null,
        chest: data.chest || null,
        waist: data.waist || null,
        hips: data.hips || null,
        isInitial: true,
      })
      .returning();
    return measurement;
  }
  
  async getMemberBodyMeasurements(memberId: number): Promise<BodyMeasurement[]> {
    return await db.select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.memberId, memberId))
      .orderBy(desc(bodyMeasurements.recordedDate));
  }
  
  // Member Notes
  async getMemberNotes(gymId: number, trainerId: number, memberId: number): Promise<MemberNote[]> {
    return await db.select()
      .from(memberNotes)
      .where(and(
        eq(memberNotes.gymId, gymId),
        eq(memberNotes.trainerId, trainerId),
        eq(memberNotes.memberId, memberId)
      ))
      .orderBy(desc(memberNotes.createdAt));
  }
  
  async createMemberNote(data: InsertMemberNote): Promise<MemberNote> {
    const [note] = await db.insert(memberNotes).values(data).returning();
    return note;
  }
  
  async deleteMemberNote(noteId: number, trainerId: number): Promise<void> {
    await db.delete(memberNotes)
      .where(and(eq(memberNotes.id, noteId), eq(memberNotes.trainerId, trainerId)));
  }
  
  // Social Feed
  async getFeedPosts(gymId: number, limit: number = 50): Promise<(FeedPost & { user: User; reactions: FeedReaction[]; commentCount: number })[]> {
    const posts = await db.select()
      .from(feedPosts)
      .leftJoin(users, eq(feedPosts.userId, users.id))
      .where(and(eq(feedPosts.gymId, gymId), eq(feedPosts.isVisible, true)))
      .orderBy(desc(feedPosts.createdAt))
      .limit(limit);
    
    const result: (FeedPost & { user: User; reactions: FeedReaction[]; commentCount: number })[] = [];
    
    for (const row of posts) {
      if (!row.users) continue;
      
      const reactions = await db.select()
        .from(feedReactions)
        .where(eq(feedReactions.postId, row.feed_posts.id));
      
      const [commentResult] = await db.select({ count: sql<number>`count(*)` })
        .from(feedComments)
        .where(and(eq(feedComments.postId, row.feed_posts.id), eq(feedComments.isDeleted, false)));
      
      result.push({
        ...row.feed_posts,
        user: row.users,
        reactions,
        commentCount: Number(commentResult?.count || 0)
      });
    }
    
    return result;
  }
  
  async getFeedPost(postId: number): Promise<FeedPost | null> {
    const [post] = await db.select().from(feedPosts).where(eq(feedPosts.id, postId));
    return post || null;
  }
  
  async getMemberFeedPostsForDate(memberId: number, date: string): Promise<FeedPost[]> {
    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");
    return await db.select()
      .from(feedPosts)
      .where(and(
        eq(feedPosts.userId, memberId),
        gte(feedPosts.createdAt, startOfDay),
        lte(feedPosts.createdAt, endOfDay)
      ));
  }
  
  async createFeedPost(data: InsertFeedPost): Promise<FeedPost> {
    const [post] = await db.insert(feedPosts).values(data).returning();
    return post;
  }
  
  async getFeedPostReactions(postId: number): Promise<FeedReaction[]> {
    return await db.select().from(feedReactions).where(eq(feedReactions.postId, postId));
  }
  
  async addFeedReaction(data: InsertFeedReaction): Promise<FeedReaction> {
    // Upsert - remove existing reaction first if any
    await db.delete(feedReactions)
      .where(and(eq(feedReactions.postId, data.postId), eq(feedReactions.userId, data.userId)));
    const [reaction] = await db.insert(feedReactions).values(data).returning();
    return reaction;
  }
  
  async removeFeedReaction(postId: number, userId: number): Promise<void> {
    await db.delete(feedReactions)
      .where(and(eq(feedReactions.postId, postId), eq(feedReactions.userId, userId)));
  }
  
  async getFeedComments(postId: number): Promise<(FeedComment & { user: User })[]> {
    const comments = await db.select()
      .from(feedComments)
      .leftJoin(users, eq(feedComments.userId, users.id))
      .where(and(eq(feedComments.postId, postId), eq(feedComments.isDeleted, false)))
      .orderBy(feedComments.createdAt);
    
    return comments.filter(c => c.users).map(c => ({
      ...c.feed_comments,
      user: c.users as User
    }));
  }
  
  async addFeedComment(data: InsertFeedComment): Promise<FeedComment> {
    const [comment] = await db.insert(feedComments).values(data).returning();
    return comment;
  }
  
  async deleteFeedComment(commentId: number, userId: number): Promise<void> {
    await db.update(feedComments)
      .set({ isDeleted: true })
      .where(and(eq(feedComments.id, commentId), eq(feedComments.userId, userId)));
  }
  
  async hideFeedPost(postId: number, gymId: number): Promise<void> {
    await db.update(feedPosts)
      .set({ isVisible: false })
      .where(and(eq(feedPosts.id, postId), eq(feedPosts.gymId, gymId)));
  }
  
  // Tournaments
  async getTournaments(gymId: number): Promise<Tournament[]> {
    return await db.select()
      .from(tournaments)
      .where(eq(tournaments.gymId, gymId))
      .orderBy(desc(tournaments.createdAt));
  }
  
  async getTournament(tournamentId: number): Promise<Tournament | null> {
    const [tournament] = await db.select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));
    return tournament || null;
  }
  
  async createTournament(data: InsertTournament): Promise<Tournament> {
    const [tournament] = await db.insert(tournaments).values(data).returning();
    return tournament;
  }
  
  async updateTournament(tournamentId: number, data: Partial<InsertTournament>): Promise<Tournament> {
    const [tournament] = await db.update(tournaments)
      .set(data)
      .where(eq(tournaments.id, tournamentId))
      .returning();
    return tournament;
  }
  
  async getTournamentParticipants(tournamentId: number): Promise<(TournamentParticipant & { user: User })[]> {
    const participants = await db.select()
      .from(tournamentParticipants)
      .leftJoin(users, eq(tournamentParticipants.userId, users.id))
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(tournamentParticipants.rank);
    
    return participants.filter(p => p.users).map(p => ({
      ...p.tournament_participants,
      user: p.users as User
    }));
  }
  
  async joinTournament(data: InsertTournamentParticipant): Promise<TournamentParticipant> {
    const [participant] = await db.insert(tournamentParticipants).values(data).returning();
    return participant;
  }
  
  async leaveTournament(tournamentId: number, userId: number): Promise<void> {
    await db.delete(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)));
  }
  
  async updateTournamentScores(tournamentId: number): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) return;
    
    const participants = await this.getTournamentParticipants(tournamentId);
    
    for (const participant of participants) {
      let score = 0;
      
      if (tournament.metricType === "workout_count") {
        const completions = await db.select()
          .from(workoutCompletions)
          .where(and(
            eq(workoutCompletions.memberId, participant.userId),
            gte(workoutCompletions.completedDate, tournament.startDate),
            lte(workoutCompletions.completedDate, tournament.endDate)
          ));
        // Count unique dates
        const uniqueDates = new Set(completions.map(c => c.completedDate));
        score = uniqueDates.size;
      } else if (tournament.metricType === "total_exercises") {
        const [result] = await db.select({ count: sql<number>`count(*)` })
          .from(workoutCompletions)
          .where(and(
            eq(workoutCompletions.memberId, participant.userId),
            gte(workoutCompletions.completedDate, tournament.startDate),
            lte(workoutCompletions.completedDate, tournament.endDate)
          ));
        score = Number(result?.count || 0);
      } else if (tournament.metricType === "attendance_days") {
        const [result] = await db.select({ count: sql<number>`count(*)` })
          .from(attendance)
          .where(and(
            eq(attendance.memberId, participant.userId),
            eq(attendance.status, "present"),
            gte(attendance.date, tournament.startDate),
            lte(attendance.date, tournament.endDate)
          ));
        score = Number(result?.count || 0);
      }
      
      await db.update(tournamentParticipants)
        .set({ currentScore: score })
        .where(eq(tournamentParticipants.id, participant.id));
    }
    
    // Update ranks
    const updatedParticipants = await db.select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(desc(tournamentParticipants.currentScore));
    
    for (let i = 0; i < updatedParticipants.length; i++) {
      await db.update(tournamentParticipants)
        .set({ rank: i + 1 })
        .where(eq(tournamentParticipants.id, updatedParticipants[i].id));
    }
  }
  
  async getTournamentLeaderboard(tournamentId: number): Promise<{ rank: number; username: string; score: number; userId: number }[]> {
    const participants = await db.select()
      .from(tournamentParticipants)
      .leftJoin(users, eq(tournamentParticipants.userId, users.id))
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(tournamentParticipants.rank);
    
    return participants.filter(p => p.users).map(p => ({
      rank: p.tournament_participants.rank || 0,
      username: p.users!.username,
      score: p.tournament_participants.currentScore || 0,
      userId: p.tournament_participants.userId
    }));
  }
  
  // Rest Day Swaps
  async getActiveRestDaySwap(memberId: number, cycleId: number, date: string): Promise<MemberRestDaySwap | null> {
    const [swap] = await db.select()
      .from(memberRestDaySwaps)
      .where(and(
        eq(memberRestDaySwaps.memberId, memberId),
        eq(memberRestDaySwaps.cycleId, cycleId),
        eq(memberRestDaySwaps.swapDate, date)
      ));
    return swap || null;
  }
  
  async createRestDaySwap(data: InsertMemberRestDaySwap): Promise<MemberRestDaySwap> {
    const [swap] = await db.insert(memberRestDaySwaps).values(data).returning();
    return swap;
  }
  
  async deleteRestDaySwap(swapId: number, memberId: number): Promise<void> {
    await db.delete(memberRestDaySwaps).where(and(
      eq(memberRestDaySwaps.id, swapId),
      eq(memberRestDaySwaps.memberId, memberId)
    ));
  }

  // Auto-assign cycle from active phase
  async checkAndApplyAutoAssignPhase(gymId: number, memberId: number): Promise<{ phaseApplied: boolean; phaseName?: string }> {
    const today = new Date().toISOString().split('T')[0];
    
    // Find active phase with autoAssignCycle enabled for this member
    const activePhases = await db.select()
      .from(trainingPhases)
      .where(and(
        eq(trainingPhases.memberId, memberId),
        eq(trainingPhases.gymId, gymId),
        eq(trainingPhases.autoAssignCycle, true),
        lte(trainingPhases.startDate, today),
        gte(trainingPhases.endDate, today)
      ))
      .orderBy(desc(trainingPhases.startDate))
      .limit(1);

    if (activePhases.length === 0) {
      return { phaseApplied: false };
    }

    const activePhase = activePhases[0];
    const expectedCycleName = `${activePhase.name} Cycle [Phase ${activePhase.id}]`;
    
    // Get member's current cycle
    const memberCycles = await db.select()
      .from(workoutCycles)
      .where(and(eq(workoutCycles.gymId, gymId), eq(workoutCycles.memberId, memberId)))
      .limit(1);

    let memberCycle: typeof workoutCycles.$inferSelect;

    if (memberCycles.length === 0) {
      // Create a new cycle for the member if they don't have one
      const trainerId = activePhase.trainerId;
      const [newCycle] = await db.insert(workoutCycles).values({
        gymId,
        trainerId,
        memberId,
        name: expectedCycleName,
        cycleLength: 3,
        startDate: activePhase.startDate,
        endDate: activePhase.endDate,
        isActive: true
      }).returning();
      memberCycle = newCycle;
    } else {
      memberCycle = memberCycles[0];
      
      // Check if already applied (idempotence check)
      if (memberCycle.name === expectedCycleName) {
        return { phaseApplied: false }; // Already applied
      }
    }
    
    if (activePhase.useCustomExercises) {
      // Get phase exercises and apply to member's cycle
      const phaseExercisesList = await db.select()
        .from(phaseExercises)
        .where(eq(phaseExercises.phaseId, activePhase.id))
        .orderBy(phaseExercises.dayIndex, phaseExercises.orderIndex);

      if (phaseExercisesList.length > 0) {
        // Delete existing workout items for member's cycle
        await db.delete(workoutItems).where(eq(workoutItems.cycleId, memberCycle.id));
        
        // Insert phase exercises as workout items
        for (const ex of phaseExercisesList) {
          await db.insert(workoutItems).values({
            cycleId: memberCycle.id,
            dayIndex: ex.dayIndex,
            muscleType: ex.muscleType,
            bodyPart: ex.bodyPart,
            exerciseName: ex.exerciseName,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            orderIndex: ex.orderIndex
          });
        }

        // Update cycle dates to match phase
        const maxDayIndex = Math.max(...phaseExercisesList.map(e => e.dayIndex));
        await db.update(workoutCycles)
          .set({
            startDate: activePhase.startDate,
            endDate: activePhase.endDate,
            cycleLength: maxDayIndex + 1,
            name: expectedCycleName
          })
          .where(eq(workoutCycles.id, memberCycle.id));
      }
    } else if (activePhase.cycleId) {
      // Copy exercises from template cycle to member's cycle
      const templateItems = await db.select()
        .from(workoutItems)
        .where(eq(workoutItems.cycleId, activePhase.cycleId))
        .orderBy(workoutItems.dayIndex, workoutItems.orderIndex);

      if (templateItems.length > 0) {
        // Delete existing workout items for member's cycle
        await db.delete(workoutItems).where(eq(workoutItems.cycleId, memberCycle.id));
        
        // Copy template items
        for (const item of templateItems) {
          await db.insert(workoutItems).values({
            cycleId: memberCycle.id,
            dayIndex: item.dayIndex,
            muscleType: item.muscleType,
            bodyPart: item.bodyPart,
            exerciseName: item.exerciseName,
            sets: item.sets,
            reps: item.reps,
            weight: item.weight,
            orderIndex: item.orderIndex
          });
        }

        // Get template cycle to copy settings
        const [templateCycle] = await db.select()
          .from(workoutCycles)
          .where(eq(workoutCycles.id, activePhase.cycleId));

        if (templateCycle) {
          await db.update(workoutCycles)
            .set({
              startDate: activePhase.startDate,
              endDate: activePhase.endDate,
              cycleLength: templateCycle.cycleLength,
              name: expectedCycleName,
              dayLabels: templateCycle.dayLabels,
              restDays: templateCycle.restDays
            })
            .where(eq(workoutCycles.id, memberCycle.id));
        }
      }
    }

    return { phaseApplied: true, phaseName: activePhase.name };
  }

  // Support System Implementation
  async createSupportTicket(data: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values(data).returning();
    return ticket;
  }

  async getSupportTicket(ticketId: number): Promise<(SupportTicket & { messages: SupportMessage[] }) | null> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
    if (!ticket) return null;
    
    const messages = await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(desc(supportMessages.createdAt));
    
    return { ...ticket, messages };
  }

  async getSupportTickets(filters?: { status?: string; priority?: string; issueType?: string; gymId?: number }): Promise<SupportTicket[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(supportTickets.status, filters.status as any));
    }
    if (filters?.priority) {
      conditions.push(eq(supportTickets.priority, filters.priority as any));
    }
    if (filters?.issueType) {
      conditions.push(eq(supportTickets.issueType, filters.issueType as any));
    }
    if (filters?.gymId) {
      conditions.push(eq(supportTickets.gymId, filters.gymId));
    }
    
    if (conditions.length > 0) {
      return await db.select()
        .from(supportTickets)
        .where(and(...conditions))
        .orderBy(desc(supportTickets.createdAt));
    }
    
    return await db.select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  }

  async getUserSupportTickets(userId: number): Promise<SupportTicket[]> {
    return await db.select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async updateSupportTicketStatus(ticketId: number, status: string): Promise<SupportTicket> {
    const [ticket] = await db.update(supportTickets)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return ticket;
  }

  async createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage> {
    const [message] = await db.insert(supportMessages).values(data).returning();
    return message;
  }

  async getSupportMessages(ticketId: number): Promise<SupportMessage[]> {
    return await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }

  // Audit Logs Implementation
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async getAuditLogs(filters?: { entityType?: string; entityId?: number; adminId?: number }): Promise<(AuditLog & { adminName: string })[]> {
    const conditions = [];
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters?.adminId) {
      conditions.push(eq(auditLogs.adminId, filters.adminId));
    }
    
    let query;
    if (conditions.length > 0) {
      query = db.select({
        id: auditLogs.id,
        adminId: auditLogs.adminId,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        reason: auditLogs.reason,
        createdAt: auditLogs.createdAt,
        adminName: users.username,
      })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.adminId, users.id))
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt));
    } else {
      query = db.select({
        id: auditLogs.id,
        adminId: auditLogs.adminId,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        reason: auditLogs.reason,
        createdAt: auditLogs.createdAt,
        adminName: users.username,
      })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.adminId, users.id))
        .orderBy(desc(auditLogs.createdAt));
    }
    
    const results = await query;
    return results.map(r => ({ ...r, adminName: r.adminName || 'Unknown' }));
  }

  // Admin Support (enriched with gym/user info)
  async getAdminSupportTickets(filters?: { status?: string; priority?: string; issueType?: string; gymId?: number }): Promise<AdminSupportTicket[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(supportTickets.status, filters.status as any));
    }
    if (filters?.priority) {
      conditions.push(eq(supportTickets.priority, filters.priority as any));
    }
    if (filters?.issueType) {
      conditions.push(eq(supportTickets.issueType, filters.issueType as any));
    }
    if (filters?.gymId) {
      conditions.push(eq(supportTickets.gymId, filters.gymId));
    }
    
    const baseQuery = db.select({
      id: supportTickets.id,
      userId: supportTickets.userId,
      userRole: supportTickets.userRole,
      gymId: supportTickets.gymId,
      contactEmailOrPhone: supportTickets.contactEmailOrPhone,
      issueType: supportTickets.issueType,
      priority: supportTickets.priority,
      description: supportTickets.description,
      attachmentUrl: supportTickets.attachmentUrl,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      gymName: gyms.name,
      gymCode: gyms.code,
      gymCity: gyms.city,
      gymState: gyms.state,
      userName: users.username,
      userEmail: users.email,
    })
      .from(supportTickets)
      .leftJoin(gyms, eq(supportTickets.gymId, gyms.id))
      .leftJoin(users, eq(supportTickets.userId, users.id));
    
    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
    }
    return await baseQuery.orderBy(desc(supportTickets.createdAt));
  }

  async getAdminSupportTicket(ticketId: number): Promise<AdminSupportTicketDetail | null> {
    const [result] = await db.select({
      id: supportTickets.id,
      userId: supportTickets.userId,
      userRole: supportTickets.userRole,
      gymId: supportTickets.gymId,
      contactEmailOrPhone: supportTickets.contactEmailOrPhone,
      issueType: supportTickets.issueType,
      priority: supportTickets.priority,
      description: supportTickets.description,
      attachmentUrl: supportTickets.attachmentUrl,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      gymName: gyms.name,
      gymCode: gyms.code,
      gymCity: gyms.city,
      gymState: gyms.state,
      userName: users.username,
      userEmail: users.email,
    })
      .from(supportTickets)
      .leftJoin(gyms, eq(supportTickets.gymId, gyms.id))
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(eq(supportTickets.id, ticketId));
    
    if (!result) return null;
    
    const messages = await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
    
    return { ...result, messages };
  }

  // Admin User Management
  async getGymWithRoster(gymId: number): Promise<GymRoster | null> {
    const [gym] = await db.select().from(gyms).where(eq(gyms.id, gymId));
    if (!gym) return null;
    
    const allUsers = await db.select().from(users).where(eq(users.gymId, gymId));
    
    const owner = allUsers.find(u => u.role === 'owner') || null;
    const trainers = allUsers.filter(u => u.role === 'trainer');
    const members = allUsers.filter(u => u.role === 'member');
    
    return { gym, owner, trainers, members };
  }

  async getAllGymsWithOwners(): Promise<GymWithOwner[]> {
    const gymsList = await db.select().from(gyms).orderBy(desc(gyms.createdAt));
    
    const result: GymWithOwner[] = [];
    for (const gym of gymsList) {
      const [owner] = await db.select()
        .from(users)
        .where(and(eq(users.gymId, gym.id), eq(users.role, 'owner')));
      
      result.push({
        ...gym,
        ownerName: owner?.username || null,
        ownerEmail: owner?.email || null,
        ownerId: owner?.id || null,
      });
    }
    return result;
  }

  async adminUpdateUser(userId: number, data: Partial<{ username: string; email: string; phone: string; status: string }>): Promise<User> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async adminResetPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async adminMoveUserToGym(userId: number, newGymId: number | null): Promise<User> {
    const [user] = await db.update(users)
      .set({ gymId: newGymId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async adminReassignTrainer(memberId: number, newTrainerId: number | null): Promise<void> {
    await db.update(users)
      .set({ trainerId: newTrainerId } as any)
      .where(eq(users.id, memberId));
  }

  // === ADMIN ATTENDANCE & WORKOUT MANAGEMENT ===
  
  async getAdminMemberDayData(memberId: number, date: string): Promise<{
    attendance: Attendance | null;
    workoutSessions: (typeof workoutSessions.$inferSelect & { exercises: (typeof workoutSessionExercises.$inferSelect)[] })[];
    member: User | null;
  }> {
    const [member] = await db.select().from(users).where(eq(users.id, memberId));
    
    const [attendanceRecord] = await db.select().from(attendance)
      .where(and(eq(attendance.memberId, memberId), eq(attendance.date, date)));
    
    const sessions = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.memberId, memberId), 
        eq(workoutSessions.date, date),
        eq(workoutSessions.isDeleted, false)
      ));
    
    const sessionsWithExercises = await Promise.all(sessions.map(async (session) => {
      const exercises = await db.select().from(workoutSessionExercises)
        .where(and(
          eq(workoutSessionExercises.sessionId, session.id),
          eq(workoutSessionExercises.isDeleted, false)
        ))
        .orderBy(workoutSessionExercises.orderIndex);
      return { ...session, exercises };
    }));
    
    return {
      attendance: attendanceRecord || null,
      workoutSessions: sessionsWithExercises,
      member: member || null
    };
  }

  async adminSetAttendance(data: {
    gymId: number;
    memberId: number;
    date: string;
    status: "present" | "absent";
    adminId: number;
    reason: string;
  }): Promise<Attendance> {
    const existing = await db.select().from(attendance)
      .where(and(eq(attendance.memberId, data.memberId), eq(attendance.date, data.date)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(attendance)
        .set({
          status: data.status,
          verifiedMethod: "admin_adjustment",
          adjustedByAdminId: data.adminId,
          adjustmentReason: data.reason,
          updatedAt: new Date()
        })
        .where(eq(attendance.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(attendance).values({
      gymId: data.gymId,
      memberId: data.memberId,
      markedByUserId: data.adminId,
      date: data.date,
      status: data.status,
      verifiedMethod: "admin_adjustment",
      adjustedByAdminId: data.adminId,
      adjustmentReason: data.reason
    }).returning();
    
    return created;
  }

  async adminCreateWorkoutSession(data: {
    gymId: number;
    memberId: number;
    date: string;
    focusLabel: string;
    notes?: string;
    adminId: number;
    reason: string;
  }): Promise<typeof workoutSessions.$inferSelect> {
    const [session] = await db.insert(workoutSessions).values({
      gymId: data.gymId,
      memberId: data.memberId,
      date: data.date,
      focusLabel: data.focusLabel,
      notes: data.notes || null,
      isManuallyCompleted: true,
      completedAt: new Date(),
      adjustedByAdminId: data.adminId
    }).returning();
    
    return session;
  }

  async adminUpdateWorkoutSession(sessionId: number, data: {
    focusLabel?: string;
    notes?: string;
    adminId: number;
    reason: string;
  }): Promise<typeof workoutSessions.$inferSelect> {
    const updates: Record<string, any> = { updatedAt: new Date(), adjustedByAdminId: data.adminId };
    if (data.focusLabel !== undefined) updates.focusLabel = data.focusLabel;
    if (data.notes !== undefined) updates.notes = data.notes;
    
    const [session] = await db.update(workoutSessions)
      .set(updates)
      .where(eq(workoutSessions.id, sessionId))
      .returning();
    
    return session;
  }

  async adminDeleteWorkoutSession(sessionId: number, adminId: number, reason: string): Promise<void> {
    await db.update(workoutSessions)
      .set({
        isDeleted: true,
        deletedByAdminId: adminId,
        deletedReason: reason,
        updatedAt: new Date()
      })
      .where(eq(workoutSessions.id, sessionId));
  }

  async adminAddExercise(data: {
    sessionId: number;
    exerciseName: string;
    sets?: number;
    reps?: number;
    weight?: string;
    duration?: number;
    adminId: number;
    reason: string;
  }): Promise<typeof workoutSessionExercises.$inferSelect> {
    const existingExercises = await db.select().from(workoutSessionExercises)
      .where(eq(workoutSessionExercises.sessionId, data.sessionId));
    const maxOrder = existingExercises.reduce((max, e) => Math.max(max, e.orderIndex || 0), 0);
    
    const [exercise] = await db.insert(workoutSessionExercises).values({
      sessionId: data.sessionId,
      exerciseName: data.exerciseName,
      sets: data.sets,
      reps: data.reps,
      weight: data.weight,
      duration: data.duration,
      orderIndex: maxOrder + 1,
      adjustedByAdminId: data.adminId
    }).returning();
    
    return exercise;
  }

  async adminUpdateExercise(exerciseId: number, data: {
    exerciseName?: string;
    sets?: number;
    reps?: number;
    weight?: string;
    duration?: number;
    adminId: number;
    reason: string;
  }): Promise<typeof workoutSessionExercises.$inferSelect> {
    const updates: Record<string, any> = { updatedAt: new Date(), adjustedByAdminId: data.adminId };
    if (data.exerciseName !== undefined) updates.exerciseName = data.exerciseName;
    if (data.sets !== undefined) updates.sets = data.sets;
    if (data.reps !== undefined) updates.reps = data.reps;
    if (data.weight !== undefined) updates.weight = data.weight;
    if (data.duration !== undefined) updates.duration = data.duration;
    
    const [exercise] = await db.update(workoutSessionExercises)
      .set(updates)
      .where(eq(workoutSessionExercises.id, exerciseId))
      .returning();
    
    return exercise;
  }

  async adminDeleteExercise(exerciseId: number, adminId: number, reason: string): Promise<void> {
    await db.update(workoutSessionExercises)
      .set({
        isDeleted: true,
        adjustedByAdminId: adminId,
        updatedAt: new Date()
      })
      .where(eq(workoutSessionExercises.id, exerciseId));
  }

  async adminReorderExercises(sessionId: number, orderedExerciseIds: number[], adminId: number, reason: string): Promise<void> {
    for (let i = 0; i < orderedExerciseIds.length; i++) {
      await db.update(workoutSessionExercises)
        .set({ orderIndex: i, updatedAt: new Date(), adjustedByAdminId: adminId })
        .where(eq(workoutSessionExercises.id, orderedExerciseIds[i]));
    }
  }

  async calculateMemberStreaks(memberId: number): Promise<{ attendanceStreak: number; workoutStreak: number }> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const attendanceRecords = await db.select().from(attendance)
      .where(and(eq(attendance.memberId, memberId), eq(attendance.status, "present")))
      .orderBy(desc(attendance.date));
    
    let attendanceStreak = 0;
    let currentDate = new Date(todayStr);
    for (const record of attendanceRecords) {
      const recordDate = new Date(record.date);
      const diff = Math.floor((currentDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 1) {
        attendanceStreak++;
        currentDate = recordDate;
      } else {
        break;
      }
    }
    
    const sessions = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.memberId, memberId), eq(workoutSessions.isDeleted, false)))
      .orderBy(desc(workoutSessions.date));
    
    let workoutStreak = 0;
    currentDate = new Date(todayStr);
    for (const session of sessions) {
      const sessionDate = new Date(session.date);
      const diff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 1) {
        workoutStreak++;
        currentDate = sessionDate;
      } else {
        break;
      }
    }
    
    return { attendanceStreak, workoutStreak };
  }

  async getWorkoutSessionById(sessionId: number): Promise<typeof workoutSessions.$inferSelect | null> {
    const [session] = await db.select().from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId));
    return session || null;
  }

  async getWorkoutExerciseById(exerciseId: number): Promise<typeof workoutSessionExercises.$inferSelect | null> {
    const [exercise] = await db.select().from(workoutSessionExercises)
      .where(eq(workoutSessionExercises.id, exerciseId));
    return exercise || null;
  }
}

export const storage = new DatabaseStorage();
