import { type ToolName, type ToolResult, type UserRole, getToolsForRole, sanitizeToolResultForIOS } from "./tool-registry";
import { type PlannerOutput } from "./planner";

export async function executePlan(
  plan: PlannerOutput,
  userId: number,
  role: UserRole,
  gymId: number | null,
  memberContext: any,
  ownerContext: any,
  localDate?: string,
  isIOSNative?: boolean
): Promise<{ results: ToolResult[]; narrativeContext: string }> {
  const results: ToolResult[] = [];
  const toolMap = getToolsForRole(role, isIOSNative);

  for (const step of plan.steps) {
    const tool = toolMap.get(step.tool);
    if (!tool) {
      results.push({
        success: false,
        toolName: step.tool,
        data: null,
        summary: '',
        error: `Unknown or disallowed tool: ${step.tool}`,
      });
      continue;
    }

    try {
      let result = await tool.execute({
        userId,
        gymId,
        localDate,
        _memberContext: memberContext,
        _ownerContext: ownerContext,
        ...step.args,
      });
      if (isIOSNative) {
        result = sanitizeToolResultForIOS(result);
      }
      results.push(result);
    } catch (error) {
      console.error(`[ToolExecutor] ${step.tool} failed:`, error);
      results.push({
        success: false,
        toolName: step.tool,
        data: null,
        summary: '',
        error: String(error),
      });
    }
  }

  const narrativeContext = results
    .filter(r => r.success && r.summary)
    .map(r => `[${r.toolName}]: ${r.summary}`)
    .join('\n\n');

  return { results, narrativeContext };
}
