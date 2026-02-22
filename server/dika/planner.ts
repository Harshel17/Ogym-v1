import OpenAI from "openai";
import { type ToolName, type UserRole, getToolDescriptionsForRole, isValidTool, getToolsForRole } from "./tool-registry";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface PlanStep {
  tool: ToolName;
  args: Record<string, any>;
  reason: string;
}

export interface PlannerOutput {
  goal: string;
  steps: PlanStep[];
  confidence: number;
}

interface CompoundSignal {
  pattern: RegExp;
  tools: ToolName[];
}

const COMPOUND_SIGNALS: CompoundSignal[] = [
  { pattern: /(?:calorie|nutrition|protein|food|diet|eat|ate|meal).*(?:workout|training|exercise|gym|train)/i,
    tools: ['getNutritionSummary', 'getWorkoutProgress'] },
  { pattern: /(?:workout|training|exercise|train).*(?:calorie|nutrition|protein|food|diet|eat)/i,
    tools: ['getWorkoutProgress', 'getNutritionSummary'] },

  { pattern: /(?:sleep|recovery|heart rate|steps|health).*(?:workout|training|exercise)/i,
    tools: ['getHealthSummary', 'getWorkoutProgress'] },
  { pattern: /(?:workout|training|exercise).*(?:sleep|recovery|heart rate|steps|health)/i,
    tools: ['getWorkoutProgress', 'getHealthSummary'] },

  { pattern: /(?:weight|body fat|measurement|body).*(?:calorie|nutrition|diet|eat)/i,
    tools: ['getBodyMeasurements', 'getNutritionSummary'] },
  { pattern: /(?:calorie|nutrition|diet).*(?:weight|body fat|measurement)/i,
    tools: ['getNutritionSummary', 'getBodyMeasurements'] },

  { pattern: /(?:weight|body fat|measurement).*(?:workout|training|exercise)/i,
    tools: ['getBodyMeasurements', 'getWorkoutProgress'] },
  { pattern: /(?:workout|training|exercise).*(?:weight|body fat|measurement)/i,
    tools: ['getWorkoutProgress', 'getBodyMeasurements'] },

  { pattern: /(?:calorie|nutrition|food).*(?:sleep|recovery|health|steps)/i,
    tools: ['getNutritionSummary', 'getHealthSummary'] },
  { pattern: /(?:sleep|recovery|health|steps).*(?:calorie|nutrition|food)/i,
    tools: ['getHealthSummary', 'getNutritionSummary'] },

  { pattern: /(?:sport|match|game).*(?:workout|training)/i,
    tools: ['getSportsData', 'getWorkoutProgress'] },
  { pattern: /(?:workout|training).*(?:sport|match|game)/i,
    tools: ['getWorkoutProgress', 'getSportsData'] },

  { pattern: /(?:goal|target).*(?:calorie|nutrition|protein)/i,
    tools: ['getGoals', 'getNutritionSummary'] },
  { pattern: /(?:goal|target).*(?:workout|training|exercise)/i,
    tools: ['getGoals', 'getWorkoutProgress'] },

  { pattern: /(?:overall|everything|full picture|all my data|complete summary|complete overview)\b/i,
    tools: ['getNutritionSummary', 'getWorkoutProgress', 'getHealthSummary'] },

  { pattern: /\b(?:and also|and how|and what about|plus show|as well as|along with|together with)\b/i,
    tools: [] },
  { pattern: /\bboth\b.*\band\b/i,
    tools: [] },
];

export function detectCompoundQuery(message: string, role: UserRole): { isCompound: boolean; suggestedTools: ToolName[] } {
  const matchedTools: ToolName[] = [];

  for (const signal of COMPOUND_SIGNALS) {
    if (signal.pattern.test(message)) {
      if (signal.tools.length > 0) {
        matchedTools.push(...signal.tools);
      } else {
        return { isCompound: true, suggestedTools: [] };
      }
    }
  }

  const unique = Array.from(new Set(matchedTools));
  const roleFiltered = unique.filter(tool => isValidTool(tool, role));

  if (roleFiltered.length >= 2) {
    return { isCompound: true, suggestedTools: roleFiltered.slice(0, 3) };
  }

  return { isCompound: false, suggestedTools: [] };
}

export async function generatePlan(
  message: string,
  role: UserRole,
  suggestedTools: ToolName[]
): Promise<PlannerOutput | null> {
  if (suggestedTools.length >= 2) {
    return {
      goal: 'Compound query — tools selected by pattern matching',
      steps: suggestedTools.map(tool => ({
        tool,
        args: {},
        reason: 'Pattern-matched from message',
      })),
      confidence: 0.85,
    };
  }

  const availableTools = getToolDescriptionsForRole(role);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You select tools to answer a fitness app user's compound question. Pick 2-3 tools from the list below. Return JSON only.

Available tools:
${availableTools}

Rules:
- Pick ONLY tools needed to fully answer the question
- Minimum 2 tools, maximum 3
- If the question only needs 1 tool, return {"confidence": 0.3} to let the regular system handle it
- Return: {"goal": "brief description", "steps": [{"tool": "toolName", "reason": "why needed"}], "confidence": 0.0-1.0}`,
        },
        { role: 'user', content: message },
      ],
      max_completion_tokens: 150,
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content?.trim() || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.confidence && parsed.confidence < 0.6) {
        return null;
      }
      if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length >= 2) {
        const validSteps: PlanStep[] = parsed.steps
          .slice(0, 3)
          .filter((s: any) => s.tool && isValidTool(s.tool, role))
          .map((s: any) => ({
            tool: s.tool as ToolName,
            args: s.args || {},
            reason: s.reason || '',
          }));

        if (validSteps.length >= 2) {
          return {
            goal: parsed.goal || 'Compound query',
            steps: validSteps,
            confidence: parsed.confidence || 0.7,
          };
        }
      }
    }
  } catch (error) {
    console.error('[Dika Planner] GPT planning failed:', error);
  }

  return null;
}
