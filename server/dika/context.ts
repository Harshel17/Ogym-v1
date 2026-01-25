import { DikaIntent } from './intents';

export interface DikaContext {
  lastMemberId?: number;
  lastMemberName?: string;
  lastDateRange?: { start: string; end: string };
  lastDate?: string;
  lastIntent?: DikaIntent;
  role: 'member' | 'trainer' | 'owner';
  gymId: number | null;
  userId: number;
  turnCount: number;
  lastActivityAt: number;
}

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TURNS = 5;

const contextStore = new Map<string, DikaContext>();

function getContextKey(userId: number): string {
  return `dika_context_${userId}`;
}

export function getContext(userId: number): DikaContext | null {
  const key = getContextKey(userId);
  const context = contextStore.get(key);
  
  if (!context) {
    return null;
  }
  
  if (Date.now() - context.lastActivityAt > SESSION_TIMEOUT_MS) {
    contextStore.delete(key);
    return null;
  }
  
  return context;
}

export function initContext(userId: number, role: 'member' | 'trainer' | 'owner', gymId: number | null): DikaContext {
  const context: DikaContext = {
    role,
    gymId,
    userId,
    turnCount: 0,
    lastActivityAt: Date.now(),
  };
  
  const key = getContextKey(userId);
  contextStore.set(key, context);
  
  return context;
}

export function updateContext(
  userId: number, 
  updates: Partial<Omit<DikaContext, 'role' | 'gymId' | 'userId'>>
): DikaContext | null {
  const key = getContextKey(userId);
  const context = contextStore.get(key);
  
  if (!context) {
    return null;
  }
  
  const updatedContext: DikaContext = {
    ...context,
    ...updates,
    turnCount: Math.min(context.turnCount + 1, MAX_TURNS),
    lastActivityAt: Date.now(),
  };
  
  if (updatedContext.turnCount >= MAX_TURNS) {
    delete updatedContext.lastMemberId;
    delete updatedContext.lastMemberName;
    delete updatedContext.lastDateRange;
    delete updatedContext.lastDate;
    delete updatedContext.lastIntent;
    updatedContext.turnCount = 0;
  }
  
  contextStore.set(key, updatedContext);
  
  return updatedContext;
}

export function clearContext(userId: number): void {
  const key = getContextKey(userId);
  contextStore.delete(key);
}

export function resolveContextualReference(
  message: string, 
  context: DikaContext | null
): { resolvedMemberName?: string; resolvedDate?: string } {
  const result: { resolvedMemberName?: string; resolvedDate?: string } = {};
  
  if (!context) {
    return result;
  }
  
  const pronounPatterns = /\b(he|she|they|him|her|them|his|her|their)\b/i;
  const contextualPatterns = /\b(what about|how about|and)\s+(today|yesterday|this week|last week)/i;
  
  if (pronounPatterns.test(message) && context.lastMemberName) {
    result.resolvedMemberName = context.lastMemberName;
  }
  
  const contextualMatch = message.match(contextualPatterns);
  if (contextualMatch) {
    if (context.lastMemberName) {
      result.resolvedMemberName = context.lastMemberName;
    }
    result.resolvedDate = contextualMatch[2];
  }
  
  return result;
}
