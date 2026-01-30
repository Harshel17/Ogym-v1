import { db } from './db';
import { 
  users, memberSubscriptions, gyms, automatedEmailReminders, weeklyOwnerSummaries,
  attendance, paymentTransactions
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, isNull } from 'drizzle-orm';
import { sendEmail } from './email';

type ReminderType = 'expiry_7_days' | 'expiry_3_days' | 'expiry_1_day' | 'expired';

interface ExpiringMember {
  memberId: number;
  memberName: string;
  memberEmail: string;
  subscriptionId: number;
  endDate: string;
  daysUntilExpiry: number;
  gymId: number;
  gymName: string;
  currency: string;
}

function getReminderType(daysUntilExpiry: number): ReminderType | null {
  if (daysUntilExpiry === 7) return 'expiry_7_days';
  if (daysUntilExpiry === 3) return 'expiry_3_days';
  if (daysUntilExpiry === 1) return 'expiry_1_day';
  if (daysUntilExpiry === 0) return 'expired';
  return null;
}

function getSubscriptionExpiryEmailTemplate(member: ExpiringMember, reminderType: ReminderType): { subject: string; html: string; text: string } {
  const daysText = {
    'expiry_7_days': '7 days',
    'expiry_3_days': '3 days',
    'expiry_1_day': 'tomorrow',
    'expired': 'today'
  }[reminderType];

  const urgencyText = {
    'expiry_7_days': 'upcoming',
    'expiry_3_days': 'soon',
    'expiry_1_day': 'urgent',
    'expired': 'expiring today'
  }[reminderType];

  const subject = reminderType === 'expired' 
    ? `${member.gymName}: Your membership expires today!`
    : `${member.gymName}: Your membership expires in ${daysText}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .alert { background: ${reminderType === 'expired' ? '#fef2f2' : reminderType === 'expiry_1_day' ? '#fffbeb' : '#f0fdf4'}; border-left: 4px solid ${reminderType === 'expired' ? '#ef4444' : reminderType === 'expiry_1_day' ? '#f59e0b' : '#22c55e'}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .cta { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">${member.gymName}</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Membership Reminder</p>
        </div>
        <div class="content">
          <p>Hi ${member.memberName},</p>
          
          <div class="alert">
            <strong>${reminderType === 'expired' ? 'Your membership expires today!' : `Your membership expires in ${daysText}!`}</strong>
            <p style="margin: 5px 0 0;">Expiry Date: <strong>${member.endDate}</strong></p>
          </div>
          
          <p>To continue enjoying our gym facilities and services, please renew your membership before it expires.</p>
          
          <p>Visit the gym or contact us to renew your subscription and maintain uninterrupted access to:</p>
          <ul>
            <li>Full gym access</li>
            <li>Workout tracking</li>
            <li>Trainer support</li>
          </ul>
          
          <p>If you have any questions, feel free to reach out to us.</p>
          
          <p>Best regards,<br><strong>${member.gymName} Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from OGym.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${member.memberName},

Your membership at ${member.gymName} ${reminderType === 'expired' ? 'expires today!' : `expires in ${daysText}!`}

Expiry Date: ${member.endDate}

To continue enjoying our gym facilities and services, please renew your membership before it expires.

Best regards,
${member.gymName} Team
  `.trim();

  return { subject, html, text };
}

export async function processSubscriptionExpiryReminders(clientDate: string): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
  details: { memberName: string; reminderType: string; status: string }[];
}> {
  const today = new Date(clientDate);
  const details: { memberName: string; reminderType: string; status: string }[] = [];
  let sent = 0, skipped = 0, errors = 0;

  const daysToCheck = [7, 3, 1, 0];

  for (const daysAhead of daysToCheck) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysAhead);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const reminderType = getReminderType(daysAhead)!;

    const expiringMembers = await db.select({
      memberId: users.id,
      memberName: users.username,
      memberEmail: users.email,
      subscriptionId: memberSubscriptions.id,
      endDate: memberSubscriptions.endDate,
      gymId: gyms.id,
      gymName: gyms.name,
      currency: gyms.currency,
    })
    .from(memberSubscriptions)
    .innerJoin(users, eq(memberSubscriptions.memberId, users.id))
    .innerJoin(gyms, eq(memberSubscriptions.gymId, gyms.id))
    .where(and(
      eq(memberSubscriptions.endDate, targetDateStr),
      sql`${users.email} IS NOT NULL`
    ));

    for (const member of expiringMembers) {
      if (!member.memberEmail) {
        details.push({ memberName: member.memberName, reminderType, status: 'skipped - no email' });
        skipped++;
        continue;
      }

      const existingReminder = await db.select()
        .from(automatedEmailReminders)
        .where(and(
          eq(automatedEmailReminders.memberId, member.memberId),
          eq(automatedEmailReminders.subscriptionId, member.subscriptionId),
          eq(automatedEmailReminders.reminderType, reminderType)
        ))
        .limit(1);

      if (existingReminder.length > 0) {
        details.push({ memberName: member.memberName, reminderType, status: 'skipped - already sent' });
        skipped++;
        continue;
      }

      const emailTemplate = getSubscriptionExpiryEmailTemplate({
        ...member,
        daysUntilExpiry: daysAhead,
        currency: member.currency || 'INR'
      }, reminderType);

      const emailSent = await sendEmail({
        to: member.memberEmail,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });

      await db.insert(automatedEmailReminders).values({
        gymId: member.gymId,
        memberId: member.memberId,
        subscriptionId: member.subscriptionId,
        reminderType,
        emailTo: member.memberEmail,
        status: emailSent ? 'sent' : 'failed',
        errorMessage: emailSent ? null : 'Email sending failed',
      });

      if (emailSent) {
        details.push({ memberName: member.memberName, reminderType, status: 'sent' });
        sent++;
      } else {
        details.push({ memberName: member.memberName, reminderType, status: 'failed' });
        errors++;
      }
    }
  }

  return {
    processed: sent + skipped + errors,
    sent,
    skipped,
    errors,
    details,
  };
}

interface WeeklySummaryData {
  gymName: string;
  ownerName: string;
  weekStartDate: string;
  weekEndDate: string;
  newMembers: number;
  totalMembers: number;
  totalAttendance: number;
  averageDailyAttendance: number;
  revenue: number;
  currency: string;
  expiringThisWeek: number;
  churnRiskCount: number;
}

function getWeeklySummaryEmailTemplate(data: WeeklySummaryData): { subject: string; html: string; text: string } {
  const currencySymbol = data.currency === 'USD' ? '$' : '₹';
  const revenueFormatted = data.currency === 'USD' 
    ? `${currencySymbol}${(data.revenue / 100).toFixed(2)}` 
    : `${currencySymbol}${(data.revenue / 100).toLocaleString('en-IN')}`;

  const subject = `${data.gymName} Weekly Summary (${data.weekStartDate} - ${data.weekEndDate})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 28px; font-weight: bold; color: #4f46e5; }
        .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 5px; }
        .alert { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Weekly Summary</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">${data.gymName}</p>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.8;">${data.weekStartDate} - ${data.weekEndDate}</p>
        </div>
        <div class="content">
          <p>Hi ${data.ownerName},</p>
          <p>Here's your weekly performance summary:</p>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${data.totalMembers}</div>
              <div class="stat-label">Total Members</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #22c55e;">+${data.newMembers}</div>
              <div class="stat-label">New This Week</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.totalAttendance}</div>
              <div class="stat-label">Total Check-ins</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.averageDailyAttendance.toFixed(1)}</div>
              <div class="stat-label">Avg. Daily Attendance</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #22c55e;">${revenueFormatted}</div>
              <div class="stat-label">Revenue</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: ${data.expiringThisWeek > 0 ? '#f59e0b' : '#22c55e'};">${data.expiringThisWeek}</div>
              <div class="stat-label">Expiring Soon</div>
            </div>
          </div>
          
          ${data.churnRiskCount > 0 ? `
          <div class="alert">
            <strong>Attention Needed:</strong> ${data.churnRiskCount} member${data.churnRiskCount > 1 ? 's are' : ' is'} at risk of churning (inactive 7+ days).
            <br><small>Visit your dashboard to send follow-up emails.</small>
          </div>
          ` : ''}
          
          <p>Keep up the great work!</p>
          <p>Best regards,<br><strong>OGym Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated weekly summary from OGym.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Weekly Summary for ${data.gymName}
${data.weekStartDate} - ${data.weekEndDate}

Hi ${data.ownerName},

Here's your weekly performance summary:

- Total Members: ${data.totalMembers}
- New This Week: +${data.newMembers}
- Total Check-ins: ${data.totalAttendance}
- Avg. Daily Attendance: ${data.averageDailyAttendance.toFixed(1)}
- Revenue: ${revenueFormatted}
- Expiring Soon: ${data.expiringThisWeek}
${data.churnRiskCount > 0 ? `\nAttention: ${data.churnRiskCount} member(s) at risk of churning.` : ''}

Keep up the great work!

Best regards,
OGym Team
  `.trim();

  return { subject, html, text };
}

export async function sendWeeklyOwnerSummaries(clientDate: string): Promise<{
  processed: number;
  sent: number;
  errors: number;
  details: { gymName: string; ownerEmail: string; status: string }[];
}> {
  const details: { gymName: string; ownerEmail: string; status: string }[] = [];
  let sent = 0, errors = 0;

  const today = new Date(clientDate);
  const dayOfWeek = today.getDay();
  
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() - dayOfWeek);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const allGyms = await db.select({
    gymId: gyms.id,
    gymName: gyms.name,
    currency: gyms.currency,
    ownerId: gyms.ownerUserId,
  }).from(gyms).where(sql`${gyms.ownerUserId} IS NOT NULL`);

  for (const gym of allGyms) {
    if (!gym.ownerId) continue;

    const existingSummary = await db.select()
      .from(weeklyOwnerSummaries)
      .where(and(
        eq(weeklyOwnerSummaries.gymId, gym.gymId),
        eq(weeklyOwnerSummaries.weekStartDate, weekStartStr),
        eq(weeklyOwnerSummaries.weekEndDate, weekEndStr)
      ))
      .limit(1);

    if (existingSummary.length > 0) {
      details.push({ gymName: gym.gymName, ownerEmail: '', status: 'skipped - already sent' });
      continue;
    }

    const owner = await db.select().from(users).where(eq(users.id, gym.ownerId)).limit(1);
    if (!owner[0]?.email) {
      details.push({ gymName: gym.gymName, ownerEmail: '', status: 'skipped - no owner email' });
      continue;
    }

    const members = await db.select().from(users)
      .where(and(eq(users.gymId, gym.gymId), eq(users.role, 'member')));
    const totalMembers = members.length;

    const newMembersCount = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        eq(users.gymId, gym.gymId),
        eq(users.role, 'member'),
        gte(users.createdAt, new Date(weekStartStr)),
        lte(users.createdAt, new Date(weekEndStr + 'T23:59:59'))
      ));

    const attendanceCount = await db.select({ count: sql<number>`count(*)` })
      .from(attendance)
      .where(and(
        eq(attendance.gymId, gym.gymId),
        eq(attendance.status, 'present'),
        gte(attendance.date, weekStartStr),
        lte(attendance.date, weekEndStr)
      ));

    const revenueSum = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.gymId, gym.gymId),
        gte(paymentTransactions.transactionDate, weekStartStr),
        lte(paymentTransactions.transactionDate, weekEndStr)
      ));

    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(today.getDate() + 7);
    const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0];
    
    const expiringCount = await db.select({ count: sql<number>`count(*)` })
      .from(memberSubscriptions)
      .where(and(
        eq(memberSubscriptions.gymId, gym.gymId),
        gte(memberSubscriptions.endDate, clientDate),
        lte(memberSubscriptions.endDate, nextWeekEndStr)
      ));

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const activeWithSub = await db.select({ memberId: memberSubscriptions.memberId })
      .from(memberSubscriptions)
      .where(and(
        eq(memberSubscriptions.gymId, gym.gymId),
        gte(memberSubscriptions.endDate, clientDate)
      ));
    
    const activeIds = activeWithSub.map(m => m.memberId);
    
    let churnRiskCount = 0;
    if (activeIds.length > 0) {
      const recentAttenders = await db.select({ memberId: attendance.memberId })
        .from(attendance)
        .where(and(
          eq(attendance.gymId, gym.gymId),
          eq(attendance.status, 'present'),
          gte(attendance.date, sevenDaysAgoStr)
        ))
        .groupBy(attendance.memberId);
      
      const recentAttenderIds = new Set(recentAttenders.map(a => a.memberId));
      churnRiskCount = activeIds.filter(id => !recentAttenderIds.has(id)).length;
    }

    const summaryData: WeeklySummaryData = {
      gymName: gym.gymName,
      ownerName: owner[0].username,
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr,
      newMembers: Number(newMembersCount[0]?.count || 0),
      totalMembers,
      totalAttendance: Number(attendanceCount[0]?.count || 0),
      averageDailyAttendance: Number(attendanceCount[0]?.count || 0) / 7,
      revenue: Number(revenueSum[0]?.total || 0),
      currency: gym.currency || 'INR',
      expiringThisWeek: Number(expiringCount[0]?.count || 0),
      churnRiskCount,
    };

    const emailTemplate = getWeeklySummaryEmailTemplate(summaryData);

    const emailSent = await sendEmail({
      to: owner[0].email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    await db.insert(weeklyOwnerSummaries).values({
      gymId: gym.gymId,
      ownerUserId: gym.ownerId,
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr,
      summaryData,
      emailTo: owner[0].email,
      status: emailSent ? 'sent' : 'failed',
      errorMessage: emailSent ? null : 'Email sending failed',
    });

    if (emailSent) {
      details.push({ gymName: gym.gymName, ownerEmail: owner[0].email, status: 'sent' });
      sent++;
    } else {
      details.push({ gymName: gym.gymName, ownerEmail: owner[0].email, status: 'failed' });
      errors++;
    }
  }

  return {
    processed: sent + errors + details.filter(d => d.status.startsWith('skipped')).length,
    sent,
    errors,
    details,
  };
}

export async function getAutomatedEmailStats(gymId: number): Promise<{
  expiryReminders: { sent: number; pending: { memberId: number; memberName: string; email: string; daysUntilExpiry: number; endDate: string }[] };
  weeklySummaries: { lastSent: string | null; totalSent: number };
}> {
  const today = new Date().toISOString().split('T')[0];

  const remindersSent = await db.select({ count: sql<number>`count(*)` })
    .from(automatedEmailReminders)
    .where(eq(automatedEmailReminders.gymId, gymId));

  const pendingReminders: { memberId: number; memberName: string; email: string; daysUntilExpiry: number; endDate: string }[] = [];
  
  for (const days of [7, 3, 1, 0]) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const reminderType = getReminderType(days)!;

    const expiring = await db.select({
      memberId: users.id,
      memberName: users.username,
      email: users.email,
      endDate: memberSubscriptions.endDate,
      subscriptionId: memberSubscriptions.id,
    })
    .from(memberSubscriptions)
    .innerJoin(users, eq(memberSubscriptions.memberId, users.id))
    .where(and(
      eq(memberSubscriptions.gymId, gymId),
      eq(memberSubscriptions.endDate, targetDateStr),
      sql`${users.email} IS NOT NULL`
    ));

    for (const member of expiring) {
      const alreadySent = await db.select()
        .from(automatedEmailReminders)
        .where(and(
          eq(automatedEmailReminders.memberId, member.memberId),
          eq(automatedEmailReminders.subscriptionId, member.subscriptionId),
          eq(automatedEmailReminders.reminderType, reminderType)
        ))
        .limit(1);

      if (alreadySent.length === 0 && member.email) {
        pendingReminders.push({
          memberId: member.memberId,
          memberName: member.memberName,
          email: member.email,
          daysUntilExpiry: days,
          endDate: member.endDate,
        });
      }
    }
  }

  const lastSummary = await db.select()
    .from(weeklyOwnerSummaries)
    .where(eq(weeklyOwnerSummaries.gymId, gymId))
    .orderBy(desc(weeklyOwnerSummaries.sentAt))
    .limit(1);

  const summaryCount = await db.select({ count: sql<number>`count(*)` })
    .from(weeklyOwnerSummaries)
    .where(eq(weeklyOwnerSummaries.gymId, gymId));

  return {
    expiryReminders: {
      sent: Number(remindersSent[0]?.count || 0),
      pending: pendingReminders,
    },
    weeklySummaries: {
      lastSent: lastSummary[0]?.sentAt?.toISOString() || null,
      totalSent: Number(summaryCount[0]?.count || 0),
    },
  };
}
