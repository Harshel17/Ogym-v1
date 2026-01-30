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
import { eq, and, gte, lte, isNull, sql, desc, inArray, or } from 'drizzle-orm';

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
  
  if (normalized === 'today' || !normalized) {
    return today.toISOString().split('T')[0];
  }
  
  if (normalized === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  // Handle weekday names (monday, tuesday, etc.) - find the most recent occurrence
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekdayIndex = weekdays.indexOf(normalized);
  if (weekdayIndex !== -1) {
    const currentDay = today.getDay();
    let daysAgo = currentDay - weekdayIndex;
    if (daysAgo <= 0) daysAgo += 7; // Go to previous week if needed
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    return targetDate.toISOString().split('T')[0];
  }
  
  // Handle "last <weekday>" - always go to previous week
  const lastWeekdayMatch = normalized.match(/^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (lastWeekdayMatch) {
    const targetDayIndex = weekdays.indexOf(lastWeekdayMatch[1]);
    const currentDay = today.getDay();
    let daysAgo = currentDay - targetDayIndex;
    if (daysAgo <= 0) daysAgo += 7;
    daysAgo += 7; // Add another week for "last"
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    return targetDate.toISOString().split('T')[0];
  }
  
  // Handle ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  
  // Handle "jan 15", "january 15", etc.
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthDayMatch = normalized.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (monthDayMatch) {
    const monthName = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2], 10);
    let monthIndex = months.findIndex(m => monthName.startsWith(m));
    if (monthIndex === -1) monthIndex = monthFull.indexOf(monthName);
    if (monthIndex !== -1 && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      const targetDate = new Date(year, monthIndex, day);
      // If the date is in the future, go to previous year
      if (targetDate > today) {
        targetDate.setFullYear(year - 1);
      }
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  // Handle "<day> <month>" format (e.g., "15 january")
  const dayMonthMatch = normalized.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const monthName = dayMonthMatch[2].toLowerCase();
    let monthIndex = months.findIndex(m => monthName.startsWith(m));
    if (monthIndex === -1) monthIndex = monthFull.indexOf(monthName);
    if (monthIndex !== -1 && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      const targetDate = new Date(year, monthIndex, day);
      if (targetDate > today) {
        targetDate.setFullYear(year - 1);
      }
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  // Default to today if we can't parse
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

export async function getMemberWorkoutLogsDetailed(memberId: number, gymId: number | null, dateRef?: string): Promise<string> {
  let targetDate: string;
  let dateLabel: string;
  
  if (dateRef?.toLowerCase() === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
    dateLabel = 'yesterday';
  } else if (dateRef?.toLowerCase() === 'today') {
    targetDate = new Date().toISOString().split('T')[0];
    dateLabel = 'today';
  } else {
    // Default: show recent workouts (last 7 days)
    const { start, end } = getWeekRange();
    
    const completions = await db.select({
      completedDate: workoutCompletions.completedDate,
      exerciseName: workoutItems.exerciseName,
      muscleType: workoutItems.muscleType,
      actualSets: workoutCompletions.actualSets,
      actualReps: workoutCompletions.actualReps,
      actualWeight: workoutCompletions.actualWeight,
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
      return "You haven't logged any workouts this week yet. Complete a workout and mark it as done to see logs here!";
    }
    
    const byDate = new Map<string, typeof completions>();
    for (const c of completions) {
      if (!byDate.has(c.completedDate)) {
        byDate.set(c.completedDate, []);
      }
      byDate.get(c.completedDate)!.push(c);
    }
    
    const lines: string[] = ["Here are your recent workout logs:"];
    for (const [date, exercises] of Array.from(byDate)) {
      const dateObj = new Date(date + 'T00:00:00');
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      lines.push(`\n${dayName}:`);
      for (const ex of exercises) {
        const details = [];
        if (ex.actualSets) details.push(`${ex.actualSets} sets`);
        if (ex.actualReps) details.push(`${ex.actualReps} reps`);
        if (ex.actualWeight) details.push(ex.actualWeight);
        const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
        lines.push(`• ${ex.exerciseName}${detailStr}`);
      }
    }
    
    return lines.join('\n');
  }
  
  // For specific date (today/yesterday)
  const completions = await db.select({
    exerciseName: workoutItems.exerciseName,
    muscleType: workoutItems.muscleType,
    actualSets: workoutCompletions.actualSets,
    actualReps: workoutCompletions.actualReps,
    actualWeight: workoutCompletions.actualWeight,
  })
  .from(workoutCompletions)
  .innerJoin(workoutItems, eq(workoutCompletions.workoutItemId, workoutItems.id))
  .where(
    and(
      eq(workoutCompletions.memberId, memberId),
      eq(workoutCompletions.completedDate, targetDate)
    )
  );
  
  if (completions.length === 0) {
    return `You didn't log any workouts ${dateLabel}.`;
  }
  
  const lines: string[] = [`Here's what you did ${dateLabel}:`];
  for (const ex of completions) {
    const details = [];
    if (ex.actualSets) details.push(`${ex.actualSets} sets`);
    if (ex.actualReps) details.push(`${ex.actualReps} reps`);
    if (ex.actualWeight) details.push(ex.actualWeight);
    const detailStr = details.length > 0 ? ` - ${details.join(', ')}` : '';
    lines.push(`• ${ex.exerciseName}${detailStr}`);
  }
  
  return lines.join('\n');
}

export async function getMemberUpcomingWorkout(memberId: number, gymId: number | null): Promise<string> {
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
      ? "You don't have an active workout cycle assigned by your trainer yet."
      : "You don't have an active workout cycle. Create one from your dashboard!";
  }
  
  const cycle = cycles[0];
  
  // Calculate tomorrow's dayIndex
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  
  const startDate = new Date(cycle.startDate + 'T00:00:00');
  const targetDate = new Date(tomorrowDate + 'T00:00:00');
  const daysSinceStart = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const dayIndex = daysSinceStart >= 0 ? daysSinceStart % cycle.cycleLength : 0;
  
  const dayLabel = cycle.dayLabels?.[dayIndex] || `Day ${dayIndex + 1}`;
  
  // Get exercises for that day
  const items = await db.select()
    .from(workoutItems)
    .where(
      and(
        eq(workoutItems.cycleId, cycle.id),
        eq(workoutItems.dayIndex, dayIndex),
        eq(workoutItems.isDeleted, false)
      )
    );
  
  if (items.length === 0) {
    return `Tomorrow is ${dayLabel} - it's a rest day!`;
  }
  
  const lines: string[] = [`Tomorrow is ${dayLabel}:`];
  for (const item of items) {
    const details = [];
    if (item.sets) details.push(`${item.sets} sets`);
    if (item.reps) details.push(`${item.reps} reps`);
    if (item.weight) details.push(item.weight);
    const detailStr = details.length > 0 ? ` - ${details.join(', ')}` : '';
    lines.push(`• ${item.exerciseName}${detailStr}`);
  }
  
  return lines.join('\n');
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
  
  // Count rest days based on day labels containing "rest" (case-insensitive)
  const dayLabels = cycle.dayLabels || [];
  const restDays = dayLabels.filter(label => 
    label.toLowerCase().includes('rest')
  ).length;
  const workoutDays = cycle.cycleLength - restDays;
  
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
    trainingMode: users.trainingMode,
  })
  .from(users)
  .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(
    and(
      eq(users.gymId, gymId),
      eq(users.role, 'member'),
      eq(users.trainingMode, 'trainer_led'),
      sql`lower(${userProfiles.fullName}) like ${`%${memberName.toLowerCase()}%`}`
    )
  );
  
  if (members.length === 0) {
    return `I couldn't find a trainer-led member named "${memberName}" in your gym. Note: Self-guided members are not visible to trainers.`;
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
  const searchTerm = memberName.toLowerCase();
  
  const members = await db.select({
    userId: users.id,
    fullName: userProfiles.fullName,
    username: users.username,
  })
  .from(users)
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(
    and(
      eq(users.gymId, gymId),
      eq(users.role, 'member'),
      or(
        sql`lower(${userProfiles.fullName}) like ${`%${searchTerm}%`}`,
        sql`lower(${users.username}) like ${`%${searchTerm}%`}`
      )
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

export async function getOwnerCheckedInToday(gymId: number): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  const checkIns = await db.select({
    memberId: attendance.memberId,
    fullName: userProfiles.fullName,
  })
  .from(attendance)
  .innerJoin(userProfiles, eq(attendance.memberId, userProfiles.userId))
  .where(
    and(
      eq(attendance.gymId, gymId),
      eq(attendance.date, today)
    )
  );
  
  if (checkIns.length === 0) {
    return "No members have checked in today yet.";
  }
  
  const uniqueMembers = new Map<number, string>();
  checkIns.forEach(c => uniqueMembers.set(c.memberId, c.fullName));
  
  const names = Array.from(uniqueMembers.values()).slice(0, 10);
  const moreCount = uniqueMembers.size > 10 ? ` (and ${uniqueMembers.size - 10} more)` : '';
  
  return `Members who checked in today: ${names.join(', ')}${moreCount}`;
}

export async function getOwnerNotCheckedInToday(gymId: number): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  const allMembers = await db.select({
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
  
  if (allMembers.length === 0) {
    return "You don't have any members in your gym.";
  }
  
  const memberIds = allMembers.map(m => m.userId);
  
  const checkedIn = await db.select({
    memberId: attendance.memberId,
  })
  .from(attendance)
  .where(
    and(
      inArray(attendance.memberId, memberIds),
      eq(attendance.gymId, gymId),
      eq(attendance.date, today)
    )
  );
  
  const checkedInIds = new Set(checkedIn.map(c => c.memberId));
  const absent = allMembers.filter(m => !checkedInIds.has(m.userId));
  
  if (absent.length === 0) {
    return "All members have checked in today!";
  }
  
  const names = absent.slice(0, 10).map(m => m.fullName);
  const moreCount = absent.length > 10 ? ` (and ${absent.length - 10} more)` : '';
  
  return `Members who haven't checked in today: ${names.join(', ')}${moreCount}`;
}

export async function getOwnerActiveMemberships(gymId: number): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  const activeCount = await db.select({
    count: sql<number>`count(distinct ${users.id})`,
  })
  .from(users)
  .where(
    and(
      eq(users.gymId, gymId),
      eq(users.role, 'member')
    )
  );
  
  const count = activeCount[0]?.count || 0;
  
  return `You have ${count} active member${count === 1 ? '' : 's'} in your gym.`;
}

export async function getOwnerExpiringMemberships(gymId: number, nextMonth: boolean = false): Promise<string> {
  return "Membership expiry dates aren't tracked by Dika. Check your Subscriptions page for payment and expiry details.";
}
