import OpenAI from "openai";
import { db } from "../db";
import {
  users,
  attendance,
  paymentTransactions,
  memberSubscriptions,
  trainerMembers,
  ownerInterventions,
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface ChurnMemberData {
  name: string;
  daysAbsent: number;
  churnScore: number;
  factors: { attendance: number; payment: number; trend: number; age: number };
  predictedChurnWindow?: string;
  recentVisitCount14d: number;
  prevVisitCount14d: number;
  hasOverduePayments: boolean;
  memberAgeDays: number;
  preferredDay?: string;
}

export async function generateChurnExplanations(
  members: ChurnMemberData[]
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  if (members.length === 0) return results;

  const topMembers = members.slice(0, 8);

  const memberSummaries = topMembers.map((m, i) => {
    const parts: string[] = [];
    parts.push(`Member ${i + 1}: "${m.name}"`);
    parts.push(`- Days absent: ${m.daysAbsent === 999 ? 'Never visited' : m.daysAbsent}`);
    parts.push(`- Churn score: ${m.churnScore}/100`);
    parts.push(`- Last 14 days visits: ${m.recentVisitCount14d}, Previous 14 days: ${m.prevVisitCount14d}`);
    parts.push(`- Has overdue payments: ${m.hasOverduePayments ? 'Yes' : 'No'}`);
    parts.push(`- Member for: ${m.memberAgeDays} days`);
    if (m.preferredDay) parts.push(`- Usually trains on: ${m.preferredDay}s`);
    if (m.predictedChurnWindow) parts.push(`- Predicted to leave in: ${m.predictedChurnWindow}`);
    const topFactor = Object.entries(m.factors).sort((a, b) => b[1] - a[1])[0];
    parts.push(`- Biggest risk factor: ${topFactor[0]} (score ${topFactor[1]}/100)`);
    return parts.join('\n');
  });

  const prompt = `You are a gym business analyst. For each member below, write a 1-2 sentence explanation of WHY they're at risk of leaving. Be specific — reference their actual data patterns. Use their first name. Be direct and actionable, not generic.

${memberSummaries.join('\n\n')}

Respond with ONLY a JSON array of strings, one explanation per member, in the same order. No markdown, no code fences.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const explanations: string[] = JSON.parse(cleaned);

    topMembers.forEach((m, i) => {
      if (explanations[i]) {
        results.set(i, explanations[i]);
      }
    });
  } catch (err) {
    console.error("GPT churn explanation error:", err);
  }

  return results;
}

export async function generateAiInsightOfTheDay(
  gymData: {
    totalMembers: number;
    activeMembers: number;
    newThisMonth: number;
    atRiskCount: number;
    attendanceTrend: string;
    trendPercent: number;
    avgDailyAttendance: number;
    busiestDay: string;
    quietestDay: string;
    revenueThisMonth: number;
    revenuePrevMonth: number;
    weeklyAttendance: number[];
    highRiskMembers: number;
    neverVisitedNewMembers: number;
    interventionSuccessRate: number;
  }
): Promise<{ title: string; description: string; severity: 'info' | 'warning' | 'positive' } | null> {
  const prompt = `You are a gym business intelligence analyst. Based on this gym's data, generate ONE actionable insight. Pick the most important pattern or opportunity. Be specific with numbers.

Gym Data:
- Total members: ${gymData.totalMembers}, Active: ${gymData.activeMembers}
- New this month: ${gymData.newThisMonth}
- At-risk members: ${gymData.atRiskCount} (high risk: ${gymData.highRiskMembers})
- Attendance trend: ${gymData.attendanceTrend} (${gymData.trendPercent}%)
- Average daily attendance: ${gymData.avgDailyAttendance}
- Busiest day: ${gymData.busiestDay}, Quietest: ${gymData.quietestDay}
- Revenue this month: ${gymData.revenueThisMonth}, Last month: ${gymData.revenuePrevMonth}
- Weekly attendance (last 4 weeks): ${gymData.weeklyAttendance.join(', ')}
- New members who never visited: ${gymData.neverVisitedNewMembers}
- Intervention success rate: ${gymData.interventionSuccessRate}%

Respond with ONLY a JSON object: {"title": "short title (8 words max)", "description": "2-3 sentence actionable insight with specific numbers", "severity": "info|warning|positive"}
No markdown, no code fences.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.title && parsed.description && ['info', 'warning', 'positive'].includes(parsed.severity)) {
      return parsed;
    }
  } catch (err) {
    console.error("GPT insight error:", err);
  }
  return null;
}

export async function generateWeeklyOwnerBriefing(gymId: number, clientDate: string): Promise<{
  summary: string;
  priorities: string[];
  highlights: { label: string; value: string; trend: 'up' | 'down' | 'stable' }[];
  memberAlerts: { name: string; reason: string }[];
  generatedAt: string;
}> {
  const today = new Date(clientDate);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenStr = sevenDaysAgo.toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0];

  const allMembers = await db.select().from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

  const thisWeekAttendance = await db.select({ cnt: sql<number>`count(*)` })
    .from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present'), gte(attendance.date, sevenStr)));
  const lastWeekAttendance = await db.select({ cnt: sql<number>`count(*)` })
    .from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present'), gte(attendance.date, fourteenStr), lte(attendance.date, sevenStr)));

  const thisWeekAtt = Number(thisWeekAttendance[0]?.cnt || 0);
  const lastWeekAtt = Number(lastWeekAttendance[0]?.cnt || 0);
  const attChange = lastWeekAtt > 0 ? Math.round(((thisWeekAtt - lastWeekAtt) / lastWeekAtt) * 100) : 0;

  const newMembersThisWeek = allMembers.filter(m => m.createdAt && m.createdAt >= sevenDaysAgo).length;

  const allSubs = await db.select().from(memberSubscriptions).where(eq(memberSubscriptions.gymId, gymId));
  const expiringNextWeek = allSubs.filter(s => {
    const end = new Date(s.endDate);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return end >= today && end <= nextWeek && (s.status === 'active' || s.status === 'endingSoon');
  });

  const lastAttendanceMap = new Map<number, string>();
  const recentAtt = await db.select({ memberId: attendance.memberId, lastDate: sql<string>`MAX(${attendance.date})`.as('ld') })
    .from(attendance).where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present'))).groupBy(attendance.memberId);
  for (const r of recentAtt) lastAttendanceMap.set(r.memberId, r.lastDate);

  const absentMembers = allMembers.filter(m => {
    const last = lastAttendanceMap.get(m.id);
    if (!last) return true;
    const daysAgo = Math.floor((today.getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo >= 10;
  }).slice(0, 5);

  const neverVisited = allMembers.filter(m => !lastAttendanceMap.has(m.id) && m.createdAt && m.createdAt >= fourteenDaysAgo);

  const thisMonthPayments = await db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)` })
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.gymId, gymId), gte(paymentTransactions.paidOn, sevenStr)));
  const revenue = Number(thisMonthPayments[0]?.total || 0);

  const interventions = await db.select().from(ownerInterventions)
    .where(and(eq(ownerInterventions.gymId, gymId), gte(ownerInterventions.createdAt, sevenDaysAgo)));

  const prompt = `You are a smart gym business consultant giving a weekly briefing to a gym owner. Write in a conversational, direct style. Based on this data, generate a brief weekly summary.

This Week's Data:
- Total members: ${allMembers.length}
- Attendance this week: ${thisWeekAtt} check-ins (${attChange > 0 ? '+' : ''}${attChange}% vs last week's ${lastWeekAtt})
- New members joined: ${newMembersThisWeek}
- Subscriptions expiring next week: ${expiringNextWeek.length}
- Revenue collected this week: ${revenue}
- Members absent 10+ days: ${absentMembers.length} (${absentMembers.map(m => m.username).join(', ') || 'none'})
- New members who never visited: ${neverVisited.length}
- Outreach actions taken this week: ${interventions.length}

Respond with ONLY a JSON object:
{
  "summary": "3-4 sentence overview of the week. Be specific with numbers. Mention what's going well and what needs attention.",
  "priorities": ["priority 1 - most urgent action item", "priority 2", "priority 3"],
  "memberAlerts": [{"name": "member name", "reason": "why they need attention"}]
}
Keep priorities actionable and specific. Only include memberAlerts for the most urgent 3 members max. No markdown, no code fences.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const attTrend: 'up' | 'down' | 'stable' = attChange > 5 ? 'up' : attChange < -5 ? 'down' : 'stable';

    return {
      summary: parsed.summary || "No data available for this week.",
      priorities: parsed.priorities || [],
      highlights: [
        { label: "Check-ins", value: String(thisWeekAtt), trend: attTrend },
        { label: "New Members", value: String(newMembersThisWeek), trend: newMembersThisWeek > 0 ? 'up' : 'stable' },
        { label: "Expiring Soon", value: String(expiringNextWeek.length), trend: expiringNextWeek.length > 2 ? 'down' : 'stable' },
        { label: "Revenue", value: String(Math.round(revenue)), trend: revenue > 0 ? 'up' : 'stable' },
      ],
      memberAlerts: parsed.memberAlerts || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("GPT weekly briefing error:", err);
    return {
      summary: "Unable to generate briefing at this time.",
      priorities: [],
      highlights: [
        { label: "Check-ins", value: String(thisWeekAtt), trend: 'stable' },
        { label: "New Members", value: String(newMembersThisWeek), trend: 'stable' },
      ],
      memberAlerts: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function generateTrainerPerformanceSummary(gymId: number, clientDate: string): Promise<{
  trainers: {
    id: number;
    name: string;
    memberCount: number;
    avgAttendance: number;
    atRiskMembers: number;
    topPerformer: string | null;
    aiSummary: string;
  }[];
  generatedAt: string;
}> {
  const today = new Date(clientDate);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

  const trainers = await db.select().from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'trainer')));

  if (trainers.length === 0) {
    return { trainers: [], generatedAt: new Date().toISOString() };
  }

  const assignments = await db.select().from(trainerMembers)
    .where(eq(trainerMembers.gymId, gymId));

  const allMembers = await db.select().from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  const recentAttendance = await db.select({
    memberId: attendance.memberId,
    cnt: sql<number>`count(*)`.as('cnt'),
  }).from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present'), gte(attendance.date, thirtyStr)))
    .groupBy(attendance.memberId);
  const attMap = new Map(recentAttendance.map(r => [r.memberId, Number(r.cnt)]));

  const lastAttendance = await db.select({
    memberId: attendance.memberId,
    lastDate: sql<string>`MAX(${attendance.date})`.as('ld'),
  }).from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present')))
    .groupBy(attendance.memberId);
  const lastAttMap = new Map(lastAttendance.map(r => [r.memberId, r.lastDate]));

  const trainerData = trainers.map(trainer => {
    const trainerAssignments = assignments.filter(a => a.trainerId === trainer.id);
    const memberIds = trainerAssignments.map(a => a.memberId);

    const memberDetails = memberIds.map(mid => {
      const member = memberMap.get(mid);
      const att30d = attMap.get(mid) || 0;
      const lastVisit = lastAttMap.get(mid);
      const daysAbsent = lastVisit ? Math.floor((today.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return {
        name: member?.username || `Member #${mid}`,
        attendance30d: att30d,
        daysAbsent,
        isAtRisk: daysAbsent >= 10,
      };
    });

    const avgAtt = memberDetails.length > 0
      ? Math.round(memberDetails.reduce((s, m) => s + m.attendance30d, 0) / memberDetails.length)
      : 0;
    const atRisk = memberDetails.filter(m => m.isAtRisk).length;
    const topPerformer = memberDetails.length > 0
      ? memberDetails.sort((a, b) => b.attendance30d - a.attendance30d)[0]?.name || null
      : null;

    return {
      id: trainer.id,
      name: trainer.username,
      memberCount: memberIds.length,
      avgAttendance: avgAtt,
      atRiskMembers: atRisk,
      topPerformer,
      memberDetails,
    };
  });

  const trainerSummaries = trainerData.map((t, i) => {
    return `Trainer ${i + 1}: "${t.name}"
- Assigned members: ${t.memberCount}
- Avg attendance (30d): ${t.avgAttendance} visits per member
- At-risk members (10+ days absent): ${t.atRiskMembers}
- Top performer: ${t.topPerformer || 'N/A'}
- Members: ${t.memberDetails.map(m => `${m.name} (${m.attendance30d} visits, ${m.daysAbsent === 999 ? 'never visited' : m.daysAbsent + 'd absent'})`).join('; ')}`;
  });

  const prompt = `You are a gym business consultant reviewing trainer performance. For each trainer, write a 1-2 sentence performance summary. Be specific, mention numbers, highlight strengths and concerns. Use their name.

${trainerSummaries.join('\n\n')}

Respond with ONLY a JSON array of strings, one summary per trainer in order. No markdown, no code fences.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const summaries: string[] = JSON.parse(cleaned);

    return {
      trainers: trainerData.map((t, i) => ({
        id: t.id,
        name: t.name,
        memberCount: t.memberCount,
        avgAttendance: t.avgAttendance,
        atRiskMembers: t.atRiskMembers,
        topPerformer: t.topPerformer,
        aiSummary: summaries[i] || "Summary unavailable.",
      })),
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("GPT trainer summary error:", err);
    return {
      trainers: trainerData.map(t => ({
        id: t.id,
        name: t.name,
        memberCount: t.memberCount,
        avgAttendance: t.avgAttendance,
        atRiskMembers: t.atRiskMembers,
        topPerformer: t.topPerformer,
        aiSummary: `${t.name} manages ${t.memberCount} members with ${t.atRiskMembers} at risk.`,
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function generateReengagementCampaign(gymId: number, clientDate: string): Promise<{
  expiredMembers: { id: number; name: string; lastVisit: string | null; daysSinceExpiry: number; suggestedAction: string }[];
  campaignIdea: string;
  generatedAt: string;
}> {
  const today = new Date(clientDate);
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const allMembers = await db.select().from(users)
    .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

  const allSubs = await db.select().from(memberSubscriptions)
    .where(eq(memberSubscriptions.gymId, gymId));

  const subMap = new Map<number, typeof allSubs[0]>();
  for (const sub of allSubs) {
    if (!subMap.has(sub.memberId) || (sub.endDate > (subMap.get(sub.memberId)?.endDate || ''))) {
      subMap.set(sub.memberId, sub);
    }
  }

  const lastAttendance = await db.select({
    memberId: attendance.memberId,
    lastDate: sql<string>`MAX(${attendance.date})`.as('ld'),
  }).from(attendance)
    .where(and(eq(attendance.gymId, gymId), eq(attendance.status, 'present')))
    .groupBy(attendance.memberId);
  const lastAttMap = new Map(lastAttendance.map(r => [r.memberId, r.lastDate]));

  const expiredMembers = allMembers.filter(m => {
    const sub = subMap.get(m.id);
    if (!sub) return false;
    return sub.endDate < clientDate && sub.endDate >= sixtyDaysAgo.toISOString().split('T')[0];
  }).map(m => {
    const sub = subMap.get(m.id)!;
    const lastVisit = lastAttMap.get(m.id) || null;
    const daysSinceExpiry = Math.floor((today.getTime() - new Date(sub.endDate).getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: m.id,
      name: m.username,
      lastVisit,
      daysSinceExpiry,
      email: m.email,
    };
  }).sort((a, b) => a.daysSinceExpiry - b.daysSinceExpiry).slice(0, 15);

  if (expiredMembers.length === 0) {
    return {
      expiredMembers: [],
      campaignIdea: "No expired members in the last 60 days. Great retention!",
      generatedAt: new Date().toISOString(),
    };
  }

  const memberList = expiredMembers.map(m =>
    `- ${m.name}: expired ${m.daysSinceExpiry} days ago, last visited ${m.lastVisit || 'never'}`
  ).join('\n');

  const prompt = `You are a gym marketing consultant. Based on these expired members, create a re-engagement strategy.

Expired Members (last 60 days):
${memberList}

Total expired: ${expiredMembers.length}

Respond with ONLY a JSON object:
{
  "actions": ["brief suggested action for each member, same order as list above"],
  "campaignIdea": "A 2-3 sentence campaign idea to bring back these members. Be creative and specific — mention a concrete offer or angle."
}
No markdown, no code fences.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      expiredMembers: expiredMembers.map((m, i) => ({
        id: m.id,
        name: m.name,
        lastVisit: m.lastVisit,
        daysSinceExpiry: m.daysSinceExpiry,
        suggestedAction: parsed.actions?.[i] || `Send a personalized "we miss you" message to ${m.name}`,
      })),
      campaignIdea: parsed.campaignIdea || "Consider a limited-time comeback offer for expired members.",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("GPT re-engagement error:", err);
    return {
      expiredMembers: expiredMembers.map(m => ({
        id: m.id,
        name: m.name,
        lastVisit: m.lastVisit,
        daysSinceExpiry: m.daysSinceExpiry,
        suggestedAction: `Reach out to ${m.name} with a comeback offer`,
      })),
      campaignIdea: "Consider offering a free week trial or discounted month for returning members.",
      generatedAt: new Date().toISOString(),
    };
  }
}
