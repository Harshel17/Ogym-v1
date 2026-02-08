import OpenAI from "openai";
import { db } from "../db";
import { 
  weeklyReports, users, userProfiles, gyms,
  workoutCompletions, foodLogs, bodyMeasurements, 
  attendance, calorieGoals, waterLogs, healthData
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const WEEKLY_REPORT_PATTERNS = [
  /(?:weekly|week(?:'s)?)\s*(?:report|summary|recap|review|progress|update)/i,
  /(?:give|show|send|get|generate|create)\s+(?:me\s+)?(?:a\s+)?(?:my\s+)?(?:weekly|week)\s*(?:report|summary|recap|review|progress)/i,
  /how\s+(?:did|was)\s+(?:my|the)\s+week\s+(?:go|look)/i,
  /(?:summarize|recap|review)\s+(?:my|this)\s+(?:past\s+)?week/i,
  /(?:my|this)\s+week(?:'s)?\s+(?:progress|performance|stats|data)/i,
  /week\s+in\s+review/i,
];

export function detectWeeklyReportRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (lower.length < 6) return false;
  return WEEKLY_REPORT_PATTERNS.some(pattern => pattern.test(lower));
}

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 6);
  const start = startDate.toISOString().split("T")[0];
  return { start, end };
}

interface WeeklyData {
  workoutDays: number;
  workoutDates: string[];
  totalCaloriesConsumed: number;
  avgDailyCalories: number;
  totalProtein: number;
  avgDailyProtein: number;
  calorieGoal: number | null;
  proteinGoal: number | null;
  daysLogged: number;
  attendanceDays: number;
  waterAvgOz: number;
  bodyWeight: { current: number | null; previous: number | null };
  bodyFat: { current: number | null; previous: number | null };
  stepsAvg: number | null;
  caloriesBurnedAvg: number | null;
  sleepAvgMinutes: number | null;
}

async function gatherWeeklyData(userId: number, gymId: number | null, start: string, end: string): Promise<WeeklyData> {
  const [workoutResult] = await db.select({
    count: sql<number>`count(distinct ${workoutCompletions.completedDate})`,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, start),
    lte(workoutCompletions.completedDate, end)
  ));

  const workoutDates = await db.select({
    date: workoutCompletions.completedDate,
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, userId),
    gte(workoutCompletions.completedDate, start),
    lte(workoutCompletions.completedDate, end)
  ))
  .groupBy(workoutCompletions.completedDate);

  const [nutritionResult] = await db.select({
    totalCalories: sql<number>`COALESCE(SUM(${foodLogs.calories}), 0)`,
    totalProtein: sql<number>`COALESCE(SUM(${foodLogs.protein}), 0)`,
    daysLogged: sql<number>`COUNT(DISTINCT ${foodLogs.date})`,
  })
  .from(foodLogs)
  .where(and(
    eq(foodLogs.userId, userId),
    gte(foodLogs.date, start),
    lte(foodLogs.date, end)
  ));

  const [goal] = await db.select({
    dailyCalorieTarget: calorieGoals.dailyCalorieTarget,
    dailyProteinTarget: calorieGoals.dailyProteinTarget,
  })
  .from(calorieGoals)
  .where(and(
    eq(calorieGoals.userId, userId),
    eq(calorieGoals.isActive, true)
  ))
  .limit(1);

  let attendanceDays = 0;
  if (gymId) {
    const [att] = await db.select({
      count: sql<number>`count(distinct ${attendance.date})`,
    })
    .from(attendance)
    .where(and(
      eq(attendance.memberId, userId),
      gte(attendance.date, start),
      lte(attendance.date, end)
    ));
    attendanceDays = Number(att?.count) || 0;
  }

  const [waterResult] = await db.select({
    totalOz: sql<number>`COALESCE(SUM(${waterLogs.amountOz}), 0)`,
    daysLogged: sql<number>`COUNT(DISTINCT ${waterLogs.date})`,
  })
  .from(waterLogs)
  .where(and(
    eq(waterLogs.userId, userId),
    gte(waterLogs.date, start),
    lte(waterLogs.date, end)
  ));

  const recentMeasurements = await db.select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.memberId, userId))
    .orderBy(desc(bodyMeasurements.recordedDate))
    .limit(2);

  const [healthResult] = await db.select({
    avgSteps: sql<number>`AVG(${healthData.steps})`,
    avgCalBurned: sql<number>`AVG(${healthData.caloriesBurned})`,
    avgSleep: sql<number>`AVG(${healthData.sleepMinutes})`,
    count: sql<number>`COUNT(*)`,
  })
  .from(healthData)
  .where(and(
    eq(healthData.userId, userId),
    gte(healthData.date, start),
    lte(healthData.date, end)
  ));

  const totalCalories = Number(nutritionResult?.totalCalories) || 0;
  const totalProtein = Number(nutritionResult?.totalProtein) || 0;
  const daysLogged = Number(nutritionResult?.daysLogged) || 0;
  const waterDaysLogged = Number(waterResult?.daysLogged) || 0;
  const waterTotalOz = Number(waterResult?.totalOz) || 0;

  return {
    workoutDays: Number(workoutResult?.count) || 0,
    workoutDates: workoutDates.map(w => w.date),
    totalCaloriesConsumed: totalCalories,
    avgDailyCalories: daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0,
    totalProtein,
    avgDailyProtein: daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0,
    calorieGoal: goal?.dailyCalorieTarget || null,
    proteinGoal: goal?.dailyProteinTarget || null,
    daysLogged,
    attendanceDays,
    waterAvgOz: waterDaysLogged > 0 ? Math.round(waterTotalOz / waterDaysLogged) : 0,
    bodyWeight: {
      current: recentMeasurements[0]?.weight || null,
      previous: recentMeasurements[1]?.weight || null,
    },
    bodyFat: {
      current: recentMeasurements[0]?.bodyFat || null,
      previous: recentMeasurements[1]?.bodyFat || null,
    },
    stepsAvg: Number(healthResult?.count) > 0 ? Math.round(Number(healthResult?.avgSteps) || 0) : null,
    caloriesBurnedAvg: Number(healthResult?.count) > 0 ? Math.round(Number(healthResult?.avgCalBurned) || 0) : null,
    sleepAvgMinutes: Number(healthResult?.count) > 0 ? Math.round(Number(healthResult?.avgSleep) || 0) : null,
  };
}

interface ReportSection {
  title: string;
  icon: string;
  content: string;
  grade?: string;
}

interface GeneratedReport {
  greeting: string;
  overallGrade: string;
  overallSummary: string;
  sections: ReportSection[];
  motivation: string;
  weeklyData: WeeklyData;
}

async function generateAIReport(userName: string, data: WeeklyData, start: string, end: string): Promise<GeneratedReport> {
  const prompt = `Analyze this person's weekly fitness data and write a concise, motivating weekly report.

User: ${userName}
Period: ${start} to ${end}

DATA:
- Workout days: ${data.workoutDays}/7
- Workout dates: ${data.workoutDates.join(", ") || "None"}
- Gym attendance: ${data.attendanceDays} days
- Nutrition logged: ${data.daysLogged} days
- Avg daily calories: ${data.avgDailyCalories}${data.calorieGoal ? ` (goal: ${data.calorieGoal})` : ""}
- Avg daily protein: ${data.avgDailyProtein}g${data.proteinGoal ? ` (goal: ${data.proteinGoal}g)` : ""}
- Avg water intake: ${data.waterAvgOz}oz/day
- Weight: ${data.bodyWeight.current ? `${data.bodyWeight.current}kg` : "N/A"}${data.bodyWeight.previous ? ` (prev: ${data.bodyWeight.previous}kg)` : ""}
- Body fat: ${data.bodyFat.current ? `${data.bodyFat.current}%` : "N/A"}${data.bodyFat.previous ? ` (prev: ${data.bodyFat.previous}%)` : ""}
${data.stepsAvg ? `- Avg steps: ${data.stepsAvg}/day` : ""}
${data.caloriesBurnedAvg ? `- Avg calories burned: ${data.caloriesBurnedAvg}/day` : ""}
${data.sleepAvgMinutes ? `- Avg sleep: ${Math.floor(data.sleepAvgMinutes / 60)}h ${data.sleepAvgMinutes % 60}m` : ""}

Return a JSON object (no markdown, no code blocks) with this exact format:
{
  "greeting": "Short personalized greeting using their name",
  "overallGrade": "A+/A/B+/B/C+/C/D/F based on overall performance",
  "overallSummary": "2-3 sentence overall assessment",
  "sections": [
    {"title": "Workouts", "icon": "dumbbell", "content": "2-3 sentence analysis of workout consistency", "grade": "A/B/C/D/F"},
    {"title": "Nutrition", "icon": "apple", "content": "2-3 sentence analysis of nutrition tracking", "grade": "A/B/C/D/F"},
    {"title": "Body Progress", "icon": "trending", "content": "1-2 sentence body composition analysis (skip if no data)"},
    {"title": "Hydration", "icon": "droplets", "content": "1 sentence on water intake (skip if no data)"},
    {"title": "Activity", "icon": "footprints", "content": "1-2 sentence on steps/activity (skip if no data)"}
  ],
  "motivation": "1-2 sentence motivating closing message"
}

RULES:
- Only include sections where data exists. Skip sections with no data.
- Be honest but encouraging. Grade fairly.
- Use specific numbers from the data.
- Keep it concise and actionable.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a fitness coach writing a weekly progress report. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 800,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");

    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      greeting: parsed.greeting || `Hey ${userName}!`,
      overallGrade: parsed.overallGrade || "B",
      overallSummary: parsed.overallSummary || "Keep pushing!",
      sections: (parsed.sections || []).filter((s: any) => s.content && s.content.length > 5),
      motivation: parsed.motivation || "Keep up the great work!",
      weeklyData: data,
    };
  } catch (error) {
    console.error("Failed to generate AI report:", error);
    return {
      greeting: `Hey ${userName}!`,
      overallGrade: data.workoutDays >= 4 ? "A" : data.workoutDays >= 2 ? "B" : "C",
      overallSummary: `You worked out ${data.workoutDays} days this week${data.daysLogged > 0 ? ` and logged nutrition for ${data.daysLogged} days` : ""}. ${data.workoutDays >= 4 ? "Great consistency!" : "Let's aim for more next week!"}`,
      sections: [],
      motivation: "Every day is a chance to get better. Let's crush next week!",
      weeklyData: data,
    };
  }
}

export async function generateWeeklyReport(
  userId: number, 
  gymId: number | null
): Promise<{ token: string; report: GeneratedReport; rangeStart: string; rangeEnd: string }> {
  const { start, end } = getWeekRange();

  const [user] = await db.select({ username: users.username })
    .from(users).where(eq(users.id, userId));
  const [profile] = await db.select({ fullName: userProfiles.fullName })
    .from(userProfiles).where(eq(userProfiles.userId, userId));
  const userName = profile?.fullName || user?.username || "User";

  const data = await gatherWeeklyData(userId, gymId, start, end);
  const report = await generateAIReport(userName, data, start, end);

  const token = generateToken();

  await db.insert(weeklyReports).values({
    userId,
    gymId,
    token,
    rangeStart: start,
    rangeEnd: end,
    reportData: report as any,
  });

  return { token, report, rangeStart: start, rangeEnd: end };
}

export function formatWeeklyReportResponse(
  token: string, 
  report: GeneratedReport, 
  rangeStart: string, 
  rangeEnd: string
): string {
  let response = `${report.greeting} Here's your weekly fitness report.\n\n`;
  response += `**Overall Grade: ${report.overallGrade}** - ${report.overallSummary}\n\n`;

  if (report.sections.length > 0) {
    for (const section of report.sections) {
      const grade = section.grade ? ` (${section.grade})` : "";
      response += `**${section.title}${grade}:** ${section.content}\n\n`;
    }
  }

  response += `${report.motivation}`;

  const reportData = JSON.stringify({
    token,
    rangeStart,
    rangeEnd,
    overallGrade: report.overallGrade,
    workoutDays: report.weeklyData.workoutDays,
    avgDailyCalories: report.weeklyData.avgDailyCalories,
    avgDailyProtein: report.weeklyData.avgDailyProtein,
    attendanceDays: report.weeklyData.attendanceDays,
  });

  response += `\n<!-- WEEKLY_REPORT_DATA:${reportData} -->`;

  return response;
}
