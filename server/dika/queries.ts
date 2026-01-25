import { db } from '../db';
import { 
  workoutCycles, 
  workoutItems, 
  workoutCompletions, 
  cycleDayActions,
  attendance,
  payments,
  users,
  userProfiles,
  trainerMemberAssignments
} from '@shared/schema';
import { eq, and, gte, lte, isNull, sql, desc, inArray } from 'drizzle-orm';

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: endOfWeek.toISOString().split('T')[0],
  };
}

function getMonthRange(): { start: string; end: string } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    start: startOfMonth.toISOString().split('T')[0],
    end: endOfMonth.toISOString().split('T')[0],
  };
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(dateRef: string): string {
  const today = new Date();
  const normalized = dateRef.toLowerCase().trim();
  
  if (normalized === 'today') {
    return today.toISOString().split('T')[0];
  }
  
  if (normalized === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  return today.toISOString().split('T')[0];
}

export async function getMemberWeeklyWorkouts(memberId: number, gymId: number | null): Promise<string> {
  const { start, end } = getWeekRange();
  
  const completions = await db.select({
    completedDate: workoutCompletions.completedDate,
    exerciseName: workoutItems.exerciseName,
    muscleType: workoutItems.muscleType,
    sets: workoutCompletions.actualSets,
    reps: workoutCompletions.actualReps,
    weight: workoutCompletions.actualWeight,
  })
  .from(workoutCompletions)
  .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
  .where(
    and(
      eq(workoutCompletions.memberId, memberId),
      gte(workoutCompletions.completedDate, start),
      lte(workoutCompletions.completedDate, end)
    )
  )
  .orderBy(desc(workoutCompletions.completedDate));
  
  if (completions.length === 0) {
    return "You haven't logged any workouts this week yet.";
  }
  
  const byDate = new Map<string, typeof completions>();
  for (const c of completions) {
    const dateKey = c.completedDate;
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey)!.push(c);
  }
  
  const lines: string[] = ["Here's your workout history this week:"];
  for (const [date, exercises] of Array.from(byDate)) {
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const muscleTypes = Array.from(new Set(exercises.map(e => e.muscleType).filter(Boolean)));
    lines.push(`• ${dayName}: ${muscleTypes.join(', ') || exercises.length + ' exercises'}`);
  }
  
  return lines.join('\n');
}

export async function getMemberMonthlyWorkoutCount(memberId: number, gymId: number | null): Promise<string> {
  const { start, end } = getMonthRange();
  
  const result = await db.select({
    count: sql<number>`count(distinct ${workoutCompletions.completedDate})`,
  })
  .from(workoutCompletions)
  .where(
    and(
      eq(workoutCompletions.memberId, memberId),
      gte(workoutCompletions.completedDate, start),
      lte(workoutCompletions.completedDate, end)
    )
  );
  
  const count = result[0]?.count || 0;
  const now = new Date();
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  
  if (count === 0) {
    return `You haven't logged any workouts in ${monthName} yet.`;
  }
  
  return `You've worked out on ${count} day${count === 1 ? '' : 's'} this ${monthName}.`;
}

export async function getMemberCurrentCycle(memberId: number, gymId: number | null): Promise<string> {
  const source = gymId ? 'trainer' : 'self';
  
  const cycles = await db.select()
    .from(workoutCycles)
    .where(
      and(
        eq(workoutCycles.memberId, memberId),
        eq(workoutCycles.source, source),
        eq(workoutCycles.isActive, true)
      )
    )
    .limit(1);
  
  if (cycles.length === 0) {
    return gymId 
      ? "You don't have an active workout cycle assigned by your trainer."
      : "You don't have an active workout cycle. You can create one from the workout page.";
  }
  
  const cycle = cycles[0];
  const items = await db.select()
    .from(workoutItems)
    .where(eq(workoutItems.cycleId, cycle.id));
  
  const workoutDays = Array.from(new Set(items.map(i => i.dayIndex))).length;
  const restDays = cycle.cycleLength - workoutDays;
  
  let response = `Your current cycle is "${cycle.name}".\n`;
  response += `• ${cycle.cycleLength} days total (${workoutDays} workout days, ${restDays} rest days)\n`;
  response += `• Progression: ${cycle.progressionMode === 'completion' ? 'Completion-based' : 'Calendar-based'}`;
  
  if (cycle.currentDayIndex !== null && cycle.currentDayIndex !== undefined) {
    response += `\n• Currently on day ${cycle.currentDayIndex + 1}`;
  }
  
  return response;
}

export async function getMemberLastRestDay(memberId: number, gymId: number | null): Promise<string> {
  const restActions = await db.select()
    .from(cycleDayActions)
    .where(
      and(
        eq(cycleDayActions.memberId, memberId),
        eq(cycleDayActions.action, 'rest')
      )
    )
    .orderBy(desc(cycleDayActions.date))
    .limit(1);
  
  if (restActions.length === 0) {
    return "I couldn't find any logged rest days in your history.";
  }
  
  const lastRest = restActions[0];
  const dateObj = new Date(lastRest.date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  
  return `Your last rest day was on ${dayName}.`;
}

export async function getMemberSkippedThisWeek(memberId: number, gymId: number | null): Promise<string> {
  const { start, end } = getWeekRange();
  
  const skipActions = await db.select()
    .from(cycleDayActions)
    .where(
      and(
        eq(cycleDayActions.memberId, memberId),
        eq(cycleDayActions.action, 'rest'),
        gte(cycleDayActions.date, start),
        lte(cycleDayActions.date, end)
      )
    );
  
  const completions = await db.select({
    completedDate: workoutCompletions.completedDate,
  })
  .from(workoutCompletions)
  .where(
    and(
      eq(workoutCompletions.memberId, memberId),
      gte(workoutCompletions.completedDate, start),
      lte(workoutCompletions.completedDate, end)
    )
  );
  
  const completedDates = new Set(completions.map(c => c.completedDate));
  const restDates = skipActions.filter(a => !completedDates.has(a.date));
  
  if (restDates.length === 0) {
    return "You haven't skipped any workouts this week!";
  }
  
  return `You took rest on ${restDates.length} day${restDates.length === 1 ? '' : 's'} this week when workouts were scheduled.`;
}

export async function getTrainerMemberWorkoutOnDate(
  trainerId: number, 
  gymId: number, 
  memberName: string, 
  dateRef: string
): Promise<string> {
  const members = await db.select({
    userId: users.id,
    fullName: userProfiles.fullName,
  })
  .from(users)
  .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(
    and(
      eq(users.gymId, gymId),
      eq(users.role, 'member'),
      sql`lower(${userProfiles.fullName}) like ${`%${memberName.toLowerCase()}%`}`
    )
  );
  
  if (members.length === 0) {
    return `I couldn't find a member named "${memberName}" in your gym.`;
  }
  
  if (members.length > 1) {
    const names = members.map(m => m.fullName).join(', ');
    return `I found multiple members matching "${memberName}": ${names}. Please be more specific.`;
  }
  
  const member = members[0];
  const targetDate = parseDate(dateRef);
  
  const completions = await db.select({
    exerciseName: workoutItems.exerciseName,
    muscleType: workoutItems.muscleType,
    sets: workoutCompletions.actualSets,
    reps: workoutCompletions.actualReps,
  })
  .from(workoutCompletions)
  .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
  .where(
    and(
      eq(workoutCompletions.memberId, member.userId),
      eq(workoutCompletions.completedDate, targetDate)
    )
  );
  
  const dateLabel = dateRef.toLowerCase() === 'yesterday' ? 'yesterday' : 
                    dateRef.toLowerCase() === 'today' ? 'today' : `on ${targetDate}`;
  
  if (completions.length === 0) {
    return `${member.fullName} didn't log any workouts ${dateLabel}.`;
  }
  
  const muscleTypes = Array.from(new Set(completions.map(c => c.muscleType).filter(Boolean)));
  return `${member.fullName} trained ${muscleTypes.join(', ')} ${dateLabel} (${completions.length} exercises).`;
}

export async function getTrainerMembersSkippedThisWeek(trainerId: number, gymId: number): Promise<string> {
  const { start, end } = getWeekRange();
  
  const assignments = await db.select({
    memberId: trainerMemberAssignments.memberId,
  })
  .from(trainerMemberAssignments)
  .where(
    and(
      eq(trainerMemberAssignments.trainerId, trainerId),
      eq(trainerMemberAssignments.gymId, gymId),
      isNull(trainerMemberAssignments.endedAt)
    )
  );
  
  if (assignments.length === 0) {
    return "You don't have any assigned members.";
  }
  
  const memberIds = assignments.map(a => a.memberId);
  
  const completions = await db.select({
    memberId: workoutCompletions.memberId,
  })
  .from(workoutCompletions)
  .where(
    and(
      inArray(workoutCompletions.memberId, memberIds),
      gte(workoutCompletions.completedDate, start),
      lte(workoutCompletions.completedDate, end)
    )
  );
  
  const activeMemberIds = new Set(completions.map(c => c.memberId));
  const skippedMemberIds = memberIds.filter(id => !activeMemberIds.has(id));
  
  if (skippedMemberIds.length === 0) {
    return "All your assigned members have logged workouts this week!";
  }
  
  const skippedMembers = await db.select({
    fullName: userProfiles.fullName,
  })
  .from(userProfiles)
  .where(inArray(userProfiles.userId, skippedMemberIds));
  
  const names = skippedMembers.map(m => m.fullName).join(', ');
  return `These members haven't logged workouts this week: ${names}`;
}

export async function getOwnerUnpaidThisMonth(gymId: number): Promise<string> {
  const currentMonth = getCurrentMonth();
  
  const activeMembers = await db.select({
    userId: users.id,
    fullName: userProfiles.fullName,
  })
  .from(users)
  .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(
    and(
      eq(users.gymId, gymId),
      eq(users.role, 'member')
    )
  );
  
  if (activeMembers.length === 0) {
    return "You don't have any members in your gym.";
  }
  
  const memberIds = activeMembers.map(m => m.userId);
  
  const paidMembers = await db.select({
    memberId: payments.memberId,
  })
  .from(payments)
  .where(
    and(
      inArray(payments.memberId, memberIds),
      eq(payments.gymId, gymId),
      eq(payments.month, currentMonth),
      eq(payments.status, 'paid')
    )
  );
  
  const paidMemberIds = new Set(paidMembers.map(p => p.memberId));
  const unpaidMembers = activeMembers.filter(m => !paidMemberIds.has(m.userId));
  
  if (unpaidMembers.length === 0) {
    return "All members have paid this month!";
  }
  
  const names = unpaidMembers.slice(0, 5).map(m => m.fullName).join(', ');
  const moreCount = unpaidMembers.length > 5 ? ` and ${unpaidMembers.length - 5} more` : '';
  
  return `These members haven't paid this month: ${names}${moreCount}`;
}

export async function getOwnerMemberPaymentStatus(gymId: number, memberName: string): Promise<string> {
  const currentMonth = getCurrentMonth();
  
  const members = await db.select({
    userId: users.id,
    fullName: userProfiles.fullName,
  })
  .from(users)
  .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(
    and(
      eq(users.gymId, gymId),
      eq(users.role, 'member'),
      sql`lower(${userProfiles.fullName}) like ${`%${memberName.toLowerCase()}%`}`
    )
  );
  
  if (members.length === 0) {
    return `I couldn't find a member named "${memberName}" in your gym.`;
  }
  
  if (members.length > 1) {
    const names = members.map(m => m.fullName).join(', ');
    return `I found multiple members matching "${memberName}": ${names}. Please be more specific.`;
  }
  
  const member = members[0];
  
  const recentPayments = await db.select()
    .from(payments)
    .where(
      and(
        eq(payments.memberId, member.userId),
        eq(payments.gymId, gymId)
      )
    )
    .orderBy(desc(payments.month))
    .limit(1);
  
  if (recentPayments.length === 0) {
    return `${member.fullName} has no payment records.`;
  }
  
  const lastPayment = recentPayments[0];
  const paidThisMonth = lastPayment.month === currentMonth && lastPayment.status === 'paid';
  
  if (paidThisMonth) {
    return `${member.fullName} has paid this month.`;
  }
  
  return `${member.fullName} hasn't paid this month. Last payment was for ${lastPayment.month}.`;
}

export async function getOwnerActiveMembersToday(gymId: number): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  const checkIns = await db.select({
    memberId: attendance.memberId,
  })
  .from(attendance)
  .where(
    and(
      eq(attendance.gymId, gymId),
      eq(attendance.date, today)
    )
  );
  
  const uniqueMembers = new Set(checkIns.map(c => c.memberId));
  const count = uniqueMembers.size;
  
  if (count === 0) {
    return "No members have checked in today yet.";
  }
  
  return `${count} member${count === 1 ? ' has' : 's have'} checked in today.`;
}
