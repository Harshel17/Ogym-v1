import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ANALYTICS_INTENT_DESCRIPTIONS: Record<string, string> = {
  workout_frequency_trend: "How often am I working out, workout frequency, training frequency, sessions per week trend",
  muscle_volume_analysis: "Which muscles am I training most/least, muscle volume, body part balance, am I overtraining one muscle",
  strength_progression: "Am I getting stronger, strength gains, weight progression on an exercise, personal records, bench/squat/deadlift progress",
  training_load_trend: "Total training load/volume over time, workload, am I overtraining, training intensity trend",
  workout_consistency: "Am I being consistent, workout streak, how many days I trained, consistency rate, attendance streak",
  exercise_frequency_ranking: "Which exercises do I do most/least, most/least common exercises, exercise variety",
  rest_day_pattern: "Rest days analysis, am I resting enough, overtraining, rest between workouts",
  workout_completion_rate: "Am I finishing my planned workouts, completion rate, skipping exercises, adherence to plan",
  day_of_week_patterns: "Which days do I usually train, training schedule pattern, when do I work out",
  calorie_trend: "Calorie trend, am I eating enough/too much, calorie intake over time, eating habits trend",
  protein_adherence: "Am I hitting my protein goal, protein intake trend, protein target adherence",
  macro_balance_trend: "Macro split, protein/carbs/fat balance, macro distribution, macronutrient trend",
  meal_timing_patterns: "When do I eat, meal timing, do I eat breakfast, meals per day, eating schedule",
  water_intake_consistency: "Water intake, hydration, am I drinking enough water",
  calorie_goal_adherence: "Am I hitting my calorie goal, over/under eating, calorie target adherence",
  body_composition_trend: "Weight trend, body fat changes, body composition, am I gaining/losing weight",
  health_metrics_trend: "Steps, sleep, heart rate trends, activity level, health data summary",
  recovery_score_history: "Recovery score, am I recovering well, sleep quality impact, readiness to train",
  activity_nutrition_correlation: "Calories eaten vs burned, energy balance, am I eating enough for my activity, surplus/deficit",
  match_frequency_trend: "How many matches have I played, match frequency, games per week, match activity",
  sport_performance_correlation: "How does sleep/training affect my matches, pre-match preparation, sport recovery analysis",
  churn_risk_scoring: "Which members might leave, at-risk members, member retention risk, who is going to quit",
  attendance_trend_per_member: "Member attendance trends, who is coming less, individual attendance history",
  revenue_trend: "Revenue over time, monthly income, payment trends, financial overview",
  gym_utilization_patterns: "Busiest days, peak hours, gym usage patterns, when is the gym most/least busy",
  new_member_retention: "New member retention, are new signups sticking around, retention rate by cohort",
  trainer_effectiveness: "Trainer performance, which trainer is best, trainer comparison, trainer member outcomes",
  period_comparison: "Compare this month vs last month, monthly comparison, how does this period compare, period over period",
  full_synthesis: "Full summary, complete overview, overall report, how am I doing overall, summarize my last 60 days, full analysis across all metrics",
};

export interface ClassifiedIntent {
  intent: string;
  params: Record<string, any>;
  confidence: number;
}

export async function classifyAnalyticsIntent(
  message: string,
  role: string
): Promise<ClassifiedIntent | null> {
  const isOwner = role === "owner";
  const lower = message.toLowerCase();

  const quickPatterns: Array<{ pattern: RegExp; intent: string; params?: Record<string, any> }> = [
    { pattern: /(?:how\s+)?(?:often|frequent|many\s+times)\s+(?:do\s+i|am\s+i)\s+(?:work|train)/i, intent: "workout_frequency_trend" },
    { pattern: /(?:workout|training)\s+(?:frequency|trend|pattern)/i, intent: "workout_frequency_trend" },
    { pattern: /(?:muscle|body\s+part)\s+(?:volume|balance|split|distribution)/i, intent: "muscle_volume_analysis" },
    { pattern: /(?:which|what)\s+muscle\s+(?:do\s+i|am\s+i)\s+(?:train|work|hit)/i, intent: "muscle_volume_analysis" },
    { pattern: /(?:am\s+i|getting)\s+stronger/i, intent: "strength_progression" },
    { pattern: /(?:strength|weight)\s+(?:progress|trend|gains?)/i, intent: "strength_progression" },
    { pattern: /(?:bench|squat|deadlift|overhead)\s+(?:press\s+)?(?:progress|trend|pr|max)/i, intent: "strength_progression" },
    { pattern: /(?:training|workout)\s+(?:load|volume|intensity)\s+(?:trend|over\s+time)/i, intent: "training_load_trend" },
    { pattern: /(?:am\s+i|how)\s+(?:being\s+)?consistent/i, intent: "workout_consistency" },
    { pattern: /(?:workout|training)\s+(?:streak|consistency)/i, intent: "workout_consistency" },
    { pattern: /(?:how\s+many|total)\s+(?:days?|workouts?|sessions?)\s+(?:did\s+i|have\s+i)/i, intent: "workout_consistency" },
    { pattern: /(?:which|what|most|least)\s+(?:common|frequent|popular|rare)\s+exercise/i, intent: "exercise_frequency_ranking" },
    { pattern: /(?:rest|recovery)\s+(?:day|pattern|analysis|enough)/i, intent: "rest_day_pattern" },
    { pattern: /(?:am\s+i)\s+(?:over|under)\s*train/i, intent: "rest_day_pattern" },
    { pattern: /(?:workout|plan)\s+(?:completion|adherence|finish)/i, intent: "workout_completion_rate" },
    { pattern: /(?:which|what)\s+day[s]?\s+(?:do\s+i|am\s+i)\s+(?:usually\s+)?(?:train|work)/i, intent: "day_of_week_patterns" },
    { pattern: /calorie[s]?\s+(?:trend|intake|over\s+time|history)/i, intent: "calorie_trend" },
    { pattern: /(?:am\s+i|how\s+am\s+i)\s+(?:eating|doing\s+with\s+(?:calorie|food|nutrition|diet))/i, intent: "calorie_trend" },
    { pattern: /protein\s+(?:goal|target|intake|adherence|trend)/i, intent: "protein_adherence" },
    { pattern: /(?:am\s+i|hitting)\s+(?:my\s+)?protein/i, intent: "protein_adherence" },
    { pattern: /macro[s]?\s+(?:split|balance|distribution|ratio|breakdown)/i, intent: "macro_balance_trend" },
    { pattern: /(?:meal|eating)\s+(?:timing|pattern|schedule|habit)/i, intent: "meal_timing_patterns" },
    { pattern: /(?:when\s+do\s+i|what\s+time)\s+(?:usually\s+)?eat/i, intent: "meal_timing_patterns" },
    { pattern: /water\s+(?:intake|consumption|hydration|track)/i, intent: "water_intake_consistency" },
    { pattern: /(?:am\s+i\s+)?drink(?:ing)?\s+enough\s+water/i, intent: "water_intake_consistency" },
    { pattern: /calorie\s+(?:goal|target)\s+(?:adherence|hit|met)/i, intent: "calorie_goal_adherence" },
    { pattern: /(?:weight|body\s+fat|body\s+composition)\s+(?:trend|change|progress|history)/i, intent: "body_composition_trend" },
    { pattern: /(?:am\s+i\s+)?(?:losing|gaining)\s+weight/i, intent: "body_composition_trend" },
    { pattern: /(?:step[s]?|sleep|heart\s+rate|health)\s+(?:trend|data|metrics|history|summary)/i, intent: "health_metrics_trend" },
    { pattern: /recovery\s+(?:score|trend|history|data)/i, intent: "recovery_score_history" },
    { pattern: /(?:am\s+i)\s+recover(?:ing|ed)\s+(?:well|enough)/i, intent: "recovery_score_history" },
    { pattern: /(?:calorie[s]?\s+)?(?:eaten|intake)\s+vs?\s+(?:burned|output)/i, intent: "activity_nutrition_correlation" },
    { pattern: /energy\s+balance/i, intent: "activity_nutrition_correlation" },
    { pattern: /(?:surplus|deficit)\s+(?:trend|analysis|history)/i, intent: "activity_nutrition_correlation" },
    { pattern: /(?:calorie[s]?\s+)?(?:surplus|deficit)/i, intent: "activity_nutrition_correlation" },
    { pattern: /(?:am\s+i\s+)?(?:in\s+a\s+)?(?:caloric?\s+)?(?:surplus|deficit)/i, intent: "activity_nutrition_correlation" },
    { pattern: /(?:eating\s+)?(?:more|less)\s+than\s+(?:i\s+)?(?:burn|burning|spend)/i, intent: "activity_nutrition_correlation" },
    { pattern: /(?:calories?\s+)?(?:burned?\s+vs?\s+)?(?:consumed|eaten|intake)/i, intent: "activity_nutrition_correlation" },
    { pattern: /match\s+(?:frequency|history|trend|log|stats)/i, intent: "match_frequency_trend" },
    { pattern: /how\s+many\s+(?:match|game)/i, intent: "match_frequency_trend" },
    { pattern: /(?:sport|match)\s+(?:performance|recovery|correlation)/i, intent: "sport_performance_correlation" },
    { pattern: /(?:compare|comparison|vs|versus)\s+(?:my\s+)?(?:this|last|previous)\s+(?:\d+\s+)?(?:month|week|period|day)/i, intent: "period_comparison" },
    { pattern: /compare\s+(?:my\s+)?(?:last|past)\s+\d+\s+(?:week|month|day)/i, intent: "period_comparison" },
    { pattern: /which\s+week\s+was\s+(?:my\s+)?(?:strong|best|worst|busiest)/i, intent: "period_comparison" },
    { pattern: /this\s+month\s+(?:vs|compared\s+to|versus)\s+last/i, intent: "period_comparison" },
    { pattern: /(?:month|week)\s+over\s+(?:month|week)/i, intent: "period_comparison" },
    { pattern: /compare\s+(?:the\s+)?(?:last|past)\s+\d+\s+(?:week|month|day)s?\s+(?:insight|data|stat|metric|number)/i, intent: "period_comparison" },
    { pattern: /(?:last|past)\s+\d+\s+(?:week|month)s?\s+(?:comparison|breakdown|insight)/i, intent: "period_comparison" },
    { pattern: /how\s+(?:is|are|has|have)\s+(?:my\s+)?(?:gym|business|things?)\s+(?:been\s+)?(?:doing|going|trending|performing)/i, intent: "period_comparison" },
    { pattern: /(?:when|what\s+day|which\s+day)\s+(?:do\s+i\s+)?(?:usually\s+)?(?:skip|miss)\s+(?:my\s+)?(?:workout|training|gym|session)/i, intent: "day_of_week_patterns" },
    { pattern: /(?:skip|miss)\s+(?:my\s+)?(?:workout|training|gym)/i, intent: "workout_completion_rate" },
    { pattern: /(?:what|how).{0,20}(?:trend|progress|pattern).{0,20}(?:recovery|sleep|rest)/i, intent: "recovery_score_history" },
    { pattern: /(?:last|past)\s+\d+\s+(?:day|week|month).{0,30}(?:muscle|undertraining|overtrain)/i, intent: "muscle_volume_analysis" },
    { pattern: /(?:muscle\s+group|body\s+part).{0,20}(?:undertraining|neglect|miss|skip|weak)/i, intent: "muscle_volume_analysis" },
    { pattern: /(?:strength|how\s+(?:has\s+)?(?:my\s+)?strength)\s+(?:has\s+)?(?:progressed|improved|changed)/i, intent: "strength_progression" },
    { pattern: /how\s+(?:has|have|is)\s+my\s+.{2,30}\s+(?:progressed|improved|changed|gotten\s+(?:better|stronger|weaker))/i, intent: "strength_progression" },
    { pattern: /(?:bench\s*press|squat|deadlift|overhead\s*press|curl|pull[\s-]?up|row|press|lat\s*pull).{0,30}(?:progress|trend|improve|change|percentage|%)/i, intent: "strength_progression" },
    { pattern: /(?:how\s+(?:is|has)\s+my)\s+(?:training|workout|fitness)\s+(?:going|been|progress)/i, intent: "workout_frequency_trend" },
    { pattern: /(?:full|complete|overall|total)\s+(?:summary|overview|report|breakdown|analysis)\s+(?:of\s+)?(?:my\s+)?(?:last|past)?\s*\d*\s*(?:day|week|month)?/i, intent: "full_synthesis" },
    { pattern: /(?:give\s+me|show\s+me|what's)\s+(?:a\s+)?(?:full|complete|overall|detailed)\s+(?:summary|overview|report|breakdown|analysis|picture)/i, intent: "full_synthesis" },
    { pattern: /(?:how\s+(?:am\s+i|have\s+i\s+been)\s+doing)\s+(?:over(?:all)?|in\s+(?:the\s+)?(?:last|past))/i, intent: "full_synthesis" },
    { pattern: /(?:last|past)\s+\d+\s+(?:day|week|month).{0,20}(?:summary|overview|report|how\s+(?:am|did|have))/i, intent: "full_synthesis" },
    { pattern: /(?:summarize|analyze|break\s*down)\s+(?:my\s+)?(?:last|past)\s+\d+\s+(?:day|week|month)/i, intent: "full_synthesis" },
    { pattern: /^how\s+am\s+i\s+doing\s*\??$/i, intent: "full_synthesis" },
    { pattern: /(?:my\s+)?(?:fitness|progress|training)\s+(?:summary|overview|report)/i, intent: "full_synthesis" },
  ];

  if (isOwner) {
    quickPatterns.push(
      { pattern: /(?:churn|at.?risk|leaving|quit|cancel)\s+(?:risk|member|score|analysis)/i, intent: "churn_risk_scoring" },
      { pattern: /(?:which|who)\s+(?:member[s]?)\s+(?:might|could|will|are\s+going\s+to)\s+(?:leave|quit|cancel|churn)/i, intent: "churn_risk_scoring" },
      { pattern: /(?:member[s]?)\s+(?:attendance|check.?in)\s+(?:trend|pattern|history)/i, intent: "attendance_trend_per_member" },
      { pattern: /(?:who|which\s+member)\s+(?:is|are)\s+(?:coming|attending|checking)\s+(?:less|more)/i, intent: "attendance_trend_per_member" },
      { pattern: /revenue\s+(?:trend|history|over\s+time|monthly|report)/i, intent: "revenue_trend" },
      { pattern: /(?:how\s+much|total)\s+(?:money|revenue|income|earnings)/i, intent: "revenue_trend" },
      { pattern: /(?:busiest|quietest|peak|popular)\s+(?:day|time|hour)/i, intent: "gym_utilization_patterns" },
      { pattern: /gym\s+(?:utilization|usage|traffic|footfall)/i, intent: "gym_utilization_patterns" },
      { pattern: /(?:new\s+member|signup)\s+(?:retention|sticking|staying)/i, intent: "new_member_retention" },
      { pattern: /(?:trainer|coach)\s+(?:effectiveness|performance|comparison|ranking)/i, intent: "trainer_effectiveness" },
      { pattern: /(?:which|best|worst)\s+trainer/i, intent: "trainer_effectiveness" },
    );
  }

  for (const { pattern, intent, params } of quickPatterns) {
    if (pattern.test(lower)) {
      const memberOnly = ["workout_frequency_trend", "muscle_volume_analysis", "strength_progression", "training_load_trend", "workout_consistency", "exercise_frequency_ranking", "rest_day_pattern", "workout_completion_rate", "day_of_week_patterns", "calorie_trend", "protein_adherence", "macro_balance_trend", "meal_timing_patterns", "water_intake_consistency", "calorie_goal_adherence", "body_composition_trend", "health_metrics_trend", "recovery_score_history", "activity_nutrition_correlation", "match_frequency_trend", "sport_performance_correlation", "full_synthesis"];
      const ownerOnly = ["churn_risk_scoring", "attendance_trend_per_member", "revenue_trend", "gym_utilization_patterns", "new_member_retention", "trainer_effectiveness"];

      if (ownerOnly.includes(intent) && !isOwner) continue;

      const extractedParams = extractPeriodFromMessage(lower);
      if (intent === "strength_progression") {
        const exerciseMatch = lower.match(/(?:bench\s*press|squat|deadlift|overhead\s*press|bicep\s*curl|lat\s*pull|shoulder\s*press|leg\s*press|cable\s*row|dumbbell\s*press)/i);
        if (exerciseMatch) extractedParams.exercise = exerciseMatch[0];
      }
      if (intent === "muscle_volume_analysis") {
        const muscleMatch = lower.match(/(?:chest|back|legs?|shoulders?|arms?|biceps?|triceps?|core|abs|glutes?|hamstrings?|quads?|calves?)/i);
        if (muscleMatch) extractedParams.muscle = muscleMatch[0];
      }

      return { intent, params: { ...params, ...extractedParams, role }, confidence: 0.9 };
    }
  }

  const analyticsKeywords = /(?:trend|analysis|progress|frequency|pattern|correlation|comparison|adherence|retention|effectiveness|score|history|over\s+time|how\s+(?:am\s+i|often|many|much|consistent))/i;
  if (!analyticsKeywords.test(lower)) {
    return null;
  }

  try {
    const availableIntents = Object.entries(ANALYTICS_INTENT_DESCRIPTIONS)
      .filter(([key]) => {
        const ownerOnly = ["churn_risk_scoring", "attendance_trend_per_member", "revenue_trend", "gym_utilization_patterns", "new_member_retention", "trainer_effectiveness"];
        if (ownerOnly.includes(key) && !isOwner) return false;
        return true;
      })
      .map(([key, desc]) => `${key}: ${desc}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You classify fitness app user messages into analytics intents. If the message is asking about data, trends, progress, or analytics that match one of the intents below, return the intent name. If it's a casual question, greeting, action request (log meal, etc.), or doesn't match analytics, return "none".

Available intents:
${availableIntents}

Respond with ONLY a JSON object: {"intent": "intent_name_or_none", "confidence": 0.0-1.0}
No explanation.`,
        },
        { role: "user", content: message },
      ],
      max_completion_tokens: 60,
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.intent && parsed.intent !== "none" && ANALYTICS_INTENT_DESCRIPTIONS[parsed.intent] && parsed.confidence >= 0.6) {
        const params = extractPeriodFromMessage(lower);
        params.role = role;
        return { intent: parsed.intent, params, confidence: parsed.confidence };
      }
    }
  } catch (error) {
    console.error("Intent classification failed:", error);
  }

  return null;
}

function extractPeriodFromMessage(msg: string): Record<string, any> {
  const params: Record<string, any> = {};

  const periodMatch = msg.match(/(?:last|past|previous)\s+(\d+)\s*(week|month|day)s?/i);
  if (periodMatch) {
    params.period = `${periodMatch[1]}_${periodMatch[2].toLowerCase()}s`;
    return params;
  }

  if (/(?:this|past)\s+week/i.test(msg)) params.period = "1_weeks";
  else if (/(?:this|past)\s+month/i.test(msg)) params.period = "4_weeks";
  else if (/last\s+few\s+weeks/i.test(msg)) params.period = "4_weeks";
  else if (/(?:all\s+time|ever|since\s+i\s+start)/i.test(msg)) params.period = "12_months";

  return params;
}
