import OpenAI from "openai";
import { db } from "../db";
import { users, userProfiles, gyms, memberSubscriptions, trainerMemberAssignments, membershipPlans, paymentTransactions, attendance, workoutCompletions, bodyMeasurements } from "@shared/schema";
import { eq, and, ilike, desc, sql, gte, inArray } from "drizzle-orm";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type OwnerActionType = 
  | 'navigate'
  | 'member_lookup'
  | 'add_member'
  | 'log_payment'
  | 'assign_trainer'
  | 'create_support_ticket';

export interface ActionData {
  actionType: OwnerActionType;
  status: 'pending_confirmation' | 'needs_info' | 'ready';
  payload: Record<string, any>;
  preview: string;
  missingFields?: string[];
}

const ROUTE_MAP: Record<string, { path: string; label: string }> = {
  'dashboard': { path: '/', label: 'Dashboard' },
  'home': { path: '/', label: 'Dashboard' },
  'members': { path: '/members', label: 'Members' },
  'trainers': { path: '/trainers', label: 'Trainers' },
  'attendance': { path: '/attendance', label: 'Attendance' },
  'payments': { path: '/payments', label: 'Payments' },
  'workouts': { path: '/workouts', label: 'Workouts' },
  'revenue': { path: '/owner/revenue', label: 'Revenue' },
  'analytics': { path: '/owner/member-analytics', label: 'Member Analytics' },
  'member analytics': { path: '/owner/member-analytics', label: 'Member Analytics' },
  'announcements': { path: '/owner/announcements', label: 'Announcements' },
  'walk-ins': { path: '/owner/walk-in-visitors', label: 'Walk-in Visitors' },
  'walkins': { path: '/owner/walk-in-visitors', label: 'Walk-in Visitors' },
  'walk in': { path: '/owner/walk-in-visitors', label: 'Walk-in Visitors' },
  'visitors': { path: '/owner/walk-in-visitors', label: 'Walk-in Visitors' },
  'follow ups': { path: '/owner/follow-ups', label: 'Follow-ups' },
  'followups': { path: '/owner/follow-ups', label: 'Follow-ups' },
  'follow-ups': { path: '/owner/follow-ups', label: 'Follow-ups' },
  'kiosk': { path: '/owner/kiosk', label: 'Kiosk' },
  'ai insights': { path: '/owner/ai-insights', label: 'AI Insights' },
  'insights': { path: '/owner/ai-insights', label: 'AI Insights' },
  'emails': { path: '/owner/automated-emails', label: 'Automated Emails' },
  'automated emails': { path: '/owner/automated-emails', label: 'Automated Emails' },
  'join requests': { path: '/owner/join-requests', label: 'Join Requests' },
  'requests': { path: '/owner/join-requests', label: 'Join Requests' },
  'feed': { path: '/feed', label: 'Social Feed' },
  'social': { path: '/feed', label: 'Social Feed' },
  'tournaments': { path: '/tournaments', label: 'Tournaments' },
  'profile': { path: '/profile', label: 'Profile' },
  'settings': { path: '/profile', label: 'Profile & Settings' },
  'support': { path: '/support', label: 'Support' },
  'owner attendance': { path: '/owner/attendance', label: 'Attendance Details' },
};

const NAVIGATION_PATTERNS = [
  /(?:go\s+to|take\s+me\s+to|open|show|navigate\s+to|switch\s+to|show\s+me|open\s+up|go\s+back\s+to|head\s+to|move\s+to|jump\s+to|bring\s+up|pull\s+up|let\s+me\s+see)\s+(?:the\s+)?(.+)/i,
  /(?:i\s+want\s+to\s+(?:see|view|check|go\s+to))\s+(?:the\s+)?(.+)/i,
];

const MEMBER_LOOKUP_PATTERNS = [
  /(?:tell\s+me\s+about|info\s+(?:on|about)|details?\s+(?:on|about|for)|who\s+is|how\s+is)\s+(.+)/i,
  /(?:check|look\s+up|find|search)\s+(?:on\s+)?(.+?)(?:'s)?\s*(?:details?|info|profile|status|data)?$/i,
  /(.+?)(?:'s)?\s+(?:profile|details?|info|status|attendance|progress|overview)/i,
  /(?:what\s+(?:do\s+(?:you|we)\s+know|can\s+you\s+tell\s+me)\s+about)\s+(.+)/i,
  /(?:how\s+is|how's)\s+(.+?)\s+doing/i,
  /(?:show\s+me|pull\s+up|get\s+me)\s+(.+?)(?:'s)?\s+(?:details?|info|profile|data|record)/i,
  /(?:member)\s+(?:details?|info|lookup|search)\s+(?:for\s+)?(.+)/i,
];

const ADD_MEMBER_PATTERNS = [
  /(?:add|create|register|enroll|sign\s+up|new)\s+(?:a\s+)?(?:new\s+)?member/i,
  /add\s+(?:a\s+)?(?:new\s+)?(?:person|user|student|client)\s+(?:to\s+(?:the\s+)?(?:gym|my\s+gym))/i,
  /add\s+.+\s+as\s+(?:a\s+)?(?:new\s+)?member/i,
  /(?:add|register|enroll)\s+\w+.+(?:@[\w.-]+\.\w+)/i,
  /(?:add|register|enroll)\s+.+\s+to\s+(?:the\s+)?members/i,
  /(?:register|enroll)\s+\w+.*\s+(?:for|in)\s+(?:a\s+)?membership/i,
];

const LOG_PAYMENT_PATTERNS = [
  /(?:log|record|add|mark|enter)[.\s]+(?:a\s+)?payment/i,
  /(?:paid|received|got)\s+(?:payment|money|cash|amount|dues)/i,
  /(?:payment|fees?)\s+(?:from|by|for)\s+/i,
  /(?:log|record|add|mark|enter)[.\s]+(?:a\s+)?payment\s+(?:for|to)\s+\w+/i,
  /(?:assign|set|give|add|create|start)\s+(?:a\s+)?(?:an?\s+)?(?:subscription|membership)\s*(?:plan)?/i,
  /(?:assign|set|give|add|create|start)\s+(?:a\s+)?(?:an?\s+)?plan/i,
  /(?:subscription|membership)\s+(?:plan\s+)?(?:for|to)\s+/i,
  /(?:subscribe|enroll)\s+(?:\w+\s+)?(?:to|in|for)\s+(?:a\s+)?(?:plan|membership|subscription)/i,
  /(?:renew|extend)\s+(?:the\s+)?(?:subscription|membership|plan)/i,
];

const ASSIGN_TRAINER_PATTERNS = [
  /assign\s+(?:a\s+)?trainer/i,
  /(?:set|change|move|switch)\s+(?:the\s+)?trainer\s+(?:for|to|of)/i,
  /assign\s+\w+\s+(?:to|as\s+trainer\s+for)/i,
  /(?:give|put)\s+\w+\s+(?:to|under|with)\s+(?:trainer\s+)?\w+/i,
];

const SUPPORT_TICKET_PATTERNS = [
  /(?:report|submit|file|create|open|raise)\s+(?:a\s+)?(?:support\s+)?(?:ticket|issue|problem|bug|complaint|request)/i,
  /(?:i\s+(?:have|got|need|want)\s+(?:a\s+)?(?:an?\s+)?)?(?:issue|problem|bug|complaint|concern)\s+(?:with|about|regarding)/i,
  /(?:something\s+is\s+(?:wrong|broken|not\s+working)|(?:it|this|that)\s+(?:doesn't|does\s+not|isn't|is\s+not)\s+work)/i,
  /(?:need|want)\s+(?:to\s+)?(?:report|submit|file)\s+(?:a\s+)?(?:support|issue|problem|bug)/i,
  /(?:i\s+need|i\s+want)\s+(?:help|support|assistance)\s+(?:with|about|regarding|for)/i,
  /(?:can\s+you\s+)?(?:help\s+me\s+)?(?:report|submit|file|create)\s+(?:a\s+)?(?:ticket|issue|bug)/i,
  /(?:raise|open)\s+(?:a\s+)?(?:support\s+)?(?:request|case|ticket)/i,
  /(?:contact|reach)\s+(?:support|help|customer\s+service)/i,
];

const SUPPORT_FLOW_MARKER = '<!-- SUPPORT_FLOW_ACTIVE -->';

export function detectOngoingSupportTicketFlow(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): boolean {
  if (!conversationHistory || conversationHistory.length < 2) return false;
  const recentMessages = conversationHistory.slice(-8);
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.role === 'assistant' && msg.content.includes(SUPPORT_FLOW_MARKER)) {
      if (msg.content.includes('DIKA_ACTION_DATA')) {
        return false;
      }
      return true;
    }
    if (msg.role === 'assistant' && msg.content.includes('DIKA_ACTION_DATA')) {
      return false;
    }
    if (msg.role === 'assistant' && /ticket.*created|ticket.*submitted|done/i.test(msg.content)) {
      return false;
    }
  }
  return false;
}

type SupportTicketState = 'needs_description' | 'needs_priority' | 'ready';

function extractPriorityFromMessage(msg: string): string | null {
  const trimmed = msg.trim().toLowerCase();
  if (/^(low|medium|high)$/.test(trimmed)) return trimmed;
  if (/^(low|medium|high)\s+priority$/i.test(trimmed)) return trimmed.split(/\s/)[0];
  if (/^priority\s*[:\-]?\s*(low|medium|high)$/i.test(trimmed)) {
    const m = trimmed.match(/(low|medium|high)/i);
    return m ? m[1].toLowerCase() : null;
  }
  return null;
}

function detectSupportTicketState(
  currentMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): SupportTicketState {
  if (!conversationHistory || conversationHistory.length < 2) return 'needs_description';
  const recentMessages = conversationHistory.slice(-10);
  let hasDescription = false;
  for (const msg of recentMessages) {
    if (msg.role === 'assistant' && msg.content.includes('<!-- SUPPORT_STEP:description_collected -->')) {
      hasDescription = true;
    }
  }
  if (!hasDescription) return 'needs_description';
  if (extractPriorityFromMessage(currentMessage)) {
    return 'ready';
  }
  return 'needs_priority';
}

export function extractMemberNameFromLookup(message: string): string | null {
  const lower = message.toLowerCase().trim();
  const generalPhrases = [
    /^what\s+(should|do|can)\s+i\s+do/i,
    /^what('s| is)\s+my\s+(priority|focus|to.?do|task|action|plan)/i,
    /^(give|show)\s+me\s+(a\s+)?(to.?do|action|task|priority)/i,
    /^(anything|what('s| is))\s+(urgent|important|critical|pending)/i,
    /^what\s+(needs|requires)\s+my\s+attention/i,
    /^how\s+(is|are|has)\s+(the\s+)?(gym|business|things?|everything|it)\s+(doing|going|been)/i,
    /^how('s| is)\s+(the\s+)?(gym|business|things?|everything)\b/i,
    /^what\s+should\s+i\s+(focus|prioritize|work)\s+on/i,
    /^(my|today('s)?)\s+(priority|focus|tasks?|to.?do)/i,
  ];
  if (generalPhrases.some(p => p.test(lower))) return null;

  for (const pattern of MEMBER_LOOKUP_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const name = (match[1] || '').trim()
        .replace(/^(a |the |my |our )/i, '')
        .replace(/\?$/, '')
        .trim();
      if (name.length >= 2 && !isPageKeyword(name) && !isGenericPhrase(name)) {
        return name;
      }
    }
  }
  return null;
}

function isGenericPhrase(name: string): boolean {
  const genericWords = [
    'gym doing', 'gym going', 'business doing', 'business going',
    'things doing', 'things going', 'everything doing', 'everything going',
    'it doing', 'it going', 'today', 'priority', 'focus', 'urgent',
    'to do list', 'todo list', 'action list', 'task list',
  ];
  const lower = name.toLowerCase();
  return genericWords.some(w => lower === w || lower.startsWith(w));
}

function isPageKeyword(name: string): boolean {
  const pageKeywords = [
    'dashboard', 'home', 'members', 'trainers', 'attendance', 'payments',
    'workouts', 'revenue', 'analytics', 'announcements', 'walk-ins', 'walkins',
    'visitors', 'kiosk', 'insights', 'emails', 'feed', 'social', 'tournaments',
    'profile', 'settings', 'support', 'requests', 'follow ups', 'followups',
    'gym overview', 'gym', 'my gym', 'member analytics',
  ];
  const lower = name.toLowerCase();
  return pageKeywords.some(kw => lower === kw || lower === kw + 's');
}

export function detectSupportTicketRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  for (const pattern of SUPPORT_TICKET_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

export function detectOwnerAction(message: string): OwnerActionType | null {
  const lower = message.toLowerCase().trim();

  for (const pattern of ADD_MEMBER_PATTERNS) {
    if (pattern.test(lower)) return 'add_member';
  }

  for (const pattern of LOG_PAYMENT_PATTERNS) {
    if (pattern.test(lower)) return 'log_payment';
  }

  for (const pattern of ASSIGN_TRAINER_PATTERNS) {
    if (pattern.test(lower)) return 'assign_trainer';
  }

  if (detectSupportTicketRequest(message)) return 'create_support_ticket';

  const lookupName = extractMemberNameFromLookup(message);
  if (lookupName) return 'member_lookup';

  for (const pattern of NAVIGATION_PATTERNS) {
    if (pattern.test(lower)) return 'navigate';
  }

  return null;
}

function resolveNavigation(message: string): { path: string; label: string } | null {
  const lower = message.toLowerCase().trim();

  for (const pattern of NAVIGATION_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const target = match[1].trim()
        .replace(/\s+page$/i, '')
        .replace(/\s+section$/i, '')
        .replace(/\s+tab$/i, '')
        .replace(/\s+screen$/i, '');

      for (const [key, route] of Object.entries(ROUTE_MAP)) {
        if (target.includes(key) || key.includes(target)) {
          return route;
        }
      }

      const words = target.split(/\s+/);
      for (const word of words) {
        if (word.length >= 3) {
          for (const [key, route] of Object.entries(ROUTE_MAP)) {
            if (key.includes(word) || word.includes(key)) {
              return route;
            }
          }
        }
      }
    }
  }

  return null;
}

export async function processOwnerAction(
  userId: number,
  gymId: number,
  message: string,
  actionType: OwnerActionType,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; followUpChips: string[] }> {
  if (actionType === 'navigate') {
    return handleNavigation(message);
  }

  if (actionType === 'member_lookup') {
    return handleMemberLookup(gymId, message);
  }

  return handleActionWithAI(userId, gymId, message, actionType, conversationHistory);
}

function handleNavigation(message: string): { answer: string; followUpChips: string[] } {
  const route = resolveNavigation(message);

  if (route) {
    const actionData: ActionData = {
      actionType: 'navigate',
      status: 'ready',
      payload: { path: route.path, label: route.label },
      preview: `Navigate to ${route.label}`,
    };

    const answer = `Taking you to **${route.label}**.\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`;
    return {
      answer,
      followUpChips: ['Go back to Dashboard', 'Show my members', 'Revenue overview'],
    };
  }

  return {
    answer: "I'm not sure which section you want to visit. You can say things like:\n- \"Go to payments\"\n- \"Show me members\"\n- \"Open revenue\"\n- \"Take me to attendance\"",
    followUpChips: ['Go to members', 'Go to payments', 'Go to attendance', 'Go to revenue'],
  };
}

async function handleActionWithAI(
  userId: number,
  gymId: number,
  message: string,
  actionType: OwnerActionType,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; followUpChips: string[] }> {
  const [gym] = await db.select({
    name: gyms.name,
    code: gyms.code,
    currency: gyms.currency,
  }).from(gyms).where(eq(gyms.id, gymId));

  if (!gym) {
    return {
      answer: "I couldn't find your gym information. Please try again.",
      followUpChips: [],
    };
  }

  const members = await db.select({
    id: users.id,
    username: users.username,
    fullName: userProfiles.fullName,
  })
  .from(users)
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

  const trainers = await db.select({
    id: users.id,
    username: users.username,
    fullName: userProfiles.fullName,
  })
  .from(users)
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(and(eq(users.gymId, gymId), eq(users.role, 'trainer')));

  const plans = await db.select({
    id: membershipPlans.id,
    name: membershipPlans.name,
    durationMonths: membershipPlans.durationMonths,
    priceAmount: membershipPlans.priceAmount,
  })
  .from(membershipPlans)
  .where(and(eq(membershipPlans.gymId, gymId), eq(membershipPlans.isActive, true)));

  const memberList = members.map(m => `${m.fullName || m.username} (ID: ${m.id})`).join(', ');
  const trainerList = trainers.map(t => `${t.fullName || t.username} (ID: ${t.id})`).join(', ');
  const planList = plans.map(p => `${p.name} - ${p.durationMonths} months - ${p.priceAmount} paise (ID: ${p.id})`).join(', ');

  let actionInstructions = '';

  if (actionType === 'add_member') {
    actionInstructions = `The owner wants to add a new member to their gym.
To register a member, we need:
- fullName (required): The member's full name
- email (required): Their email address
- phone (optional): Phone number
- planId (optional): Membership plan ID

Available membership plans: ${planList || 'No plans configured'}
Gym code: ${gym.code}
Currency: ${gym.currency || 'INR'}

Extract info from the ENTIRE conversation (including previous messages). The user may provide name and email across multiple messages.
CRITICAL: Once you have both fullName AND email, you MUST set status to "pending_confirmation" immediately. Do NOT ask for optional fields - proceed straight to confirmation.
Only set status to "needs_info" if fullName or email is still missing.

IMPORTANT: You must respond in this exact JSON format:
{
  "message": "Your conversational response to the owner",
  "action": {
    "actionType": "add_member",
    "status": "pending_confirmation" or "needs_info",
    "payload": { "fullName": "...", "email": "...", "phone": "...", "planId": number or null, "planName": "..." },
    "preview": "Add [fullName] ([email]) as a new member",
    "missingFields": ["field1", "field2"]
  }
}

Set status to "needs_info" ONLY if name or email is missing. Set to "pending_confirmation" if we have both name and email.`;
  } else if (actionType === 'log_payment') {
    const currencySymbol = (gym.currency || 'INR') === 'INR' ? '₹' : '$';
    const planDetails = plans.map(p => `"${p.name}" - ${p.durationMonths} month(s) - ${currencySymbol}${(p.priceAmount / 100).toFixed(0)} (ID: ${p.id})`).join('\n  ');

    const activeSubsWithBalance = await db.select({
      memberId: memberSubscriptions.memberId,
      subscriptionId: memberSubscriptions.id,
      totalAmount: memberSubscriptions.totalAmount,
      endDate: memberSubscriptions.endDate,
      planId: memberSubscriptions.planId,
      planName: membershipPlans.name,
      memberName: users.username,
    })
    .from(memberSubscriptions)
    .innerJoin(users, eq(memberSubscriptions.memberId, users.id))
    .leftJoin(membershipPlans, eq(memberSubscriptions.planId, membershipPlans.id))
    .where(and(
      eq(memberSubscriptions.gymId, gymId),
      eq(memberSubscriptions.status, 'active')
    ));

    let membersWithBalance = '';
    if (activeSubsWithBalance.length > 0) {
      const subIds = activeSubsWithBalance.map(s => s.subscriptionId);
      const paidAmounts = await db.select({
        subscriptionId: paymentTransactions.subscriptionId,
        totalPaid: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
      })
      .from(paymentTransactions)
      .where(sql`${paymentTransactions.subscriptionId} IN (${sql.join(subIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(paymentTransactions.subscriptionId);

      const paidMap = new Map(paidAmounts.map(p => [p.subscriptionId, Number(p.totalPaid)]));

      const withBalance = activeSubsWithBalance.filter(s => {
        const paid = paidMap.get(s.subscriptionId) || 0;
        return paid < s.totalAmount;
      }).map(s => {
        const paid = paidMap.get(s.subscriptionId) || 0;
        const balance = (s.totalAmount - paid) / 100;
        return `${s.memberName} (ID: ${s.memberId}) - ${s.planName || 'Subscription'} - Outstanding: ${currencySymbol}${balance}`;
      });

      if (withBalance.length > 0) {
        membersWithBalance = `\n\nMEMBERS WITH OUTSTANDING BALANCE (existing active subscriptions):\n  ${withBalance.join('\n  ')}`;
      }
    }

    actionInstructions = `The owner wants to log a payment for a member. This handles TWO scenarios:

SCENARIO A - Member has an EXISTING active subscription with outstanding balance:
  Skip plan selection. Just ask for payment amount and method, then confirm. Use the existing subscription's plan info.
  
SCENARIO B - Member has NO active subscription (or fully paid):
  Guide through full subscription creation: plan selection → full/partial amount → payment method → confirm.

${membersWithBalance}

CONVERSATION FLOW:
1. First, identify the MEMBER. Match the name against the gym's member list using fuzzy matching.
2. Check if the member appears in the "MEMBERS WITH OUTSTANDING BALANCE" list above.
   - If YES (Scenario A): Tell the owner the outstanding balance and ask how much they want to pay now and by which method. Do NOT ask about plans.
   - If NO (Scenario B): Ask which PLAN they want. Show available plans with prices.
3. For Scenario B: Once plan is chosen, tell them the total cost and ask: "Is [member] paying the full amount of ${currencySymbol}[price]?"
4. If FULL payment: ask for payment METHOD, then confirm.
5. If PARTIAL payment (e.g., "no, ${currencySymbol}60 now"): note the amount paid, ask for payment METHOD, then confirm.

REQUIRED FIELDS:
- memberId (required): Must match a gym member
- memberName (required): The matched member's name
- planId (required): Which membership plan (use existing plan ID for Scenario A)
- planName (required): Name of the selected plan
- totalAmount (required): Full plan price in main currency units (NOT paise). For Scenario A, this is the original subscription total.
- amountPaid (required): How much the member is paying now
- paymentMode (required): "full" if paying entire amount, "partial" if paying less
- method (required): Payment method - one of: cash, upi, card, bank, venmo, cashapp, zelle, paypal, other
- startDate (optional): Start date in YYYY-MM-DD format (default: today ${new Date().toISOString().split('T')[0]})

Current gym members: ${memberList || 'No members'}
Currency: ${gym.currency || 'INR'} (${currencySymbol})

Available plans:
  ${planDetails || 'No plans configured'}

RULES:
- Extract info from the ENTIRE conversation history. The user provides details across multiple messages.
- Parse amounts like "49$", "$49", "49 dollars", "49" as the number 49.
- If the user says "full" or "yes" to "paying full amount?", set amountPaid = totalAmount and paymentMode = "full".
- If the user gives a partial amount less than the total, set amountPaid to that amount and paymentMode = "partial". Show the remaining balance in your message.
- For payment method, accept anything. Map "gpay", "phonepe", "google pay" to "upi". Map unknown methods to "other".
- CRITICAL: Once you have memberId, planId, amountPaid, and method, set status to "pending_confirmation" immediately.

IMPORTANT: You must respond in this exact JSON format:
{
  "message": "Your conversational response to the owner",
  "action": {
    "actionType": "log_payment",
    "status": "pending_confirmation" or "needs_info",
    "payload": { "memberId": number, "memberName": "...", "planId": number, "planName": "...", "totalAmount": number, "amountPaid": number, "paymentMode": "full" or "partial", "method": "cash", "startDate": "YYYY-MM-DD" },
    "preview": "A human-readable summary including plan, amount paid, balance if partial, and method",
    "missingFields": ["field1", "field2"]
  }
}

Set status to "needs_info" if any required field is missing/ambiguous. Set to "pending_confirmation" when you have everything.`;
  } else if (actionType === 'assign_trainer') {
    actionInstructions = `The owner wants to assign a trainer to a member.
To assign a trainer, we need:
- memberName (required): Which member to assign
- trainerName (required): Which trainer to assign
- trainingMode (optional): "trainer_led" (default) or "self_guided"

Current gym members: ${memberList || 'No members'}
Current gym trainers: ${trainerList || 'No trainers'}

Match names against the lists. If ambiguous (multiple matches), ask to clarify.
If the trainer or member name doesn't match anyone, let the owner know.

IMPORTANT: You must respond in this exact JSON format:
{
  "message": "Your conversational response to the owner",
  "action": {
    "actionType": "assign_trainer",
    "status": "pending_confirmation" or "needs_info",
    "payload": { "memberId": number, "memberName": "...", "trainerId": number, "trainerName": "...", "trainingMode": "trainer_led" },
    "preview": "A human-readable summary of what will be done",
    "missingFields": ["field1", "field2"]
  }
}

Set status to "needs_info" if member or trainer is missing/ambiguous. Set to "pending_confirmation" if we have enough.`;
  }

  const systemPrompt = `You are Dika, an AI assistant for gym owners. You are helping the owner of "${gym.name}" perform an action.

${actionInstructions}

Be concise and friendly. If info is missing, ask naturally in one short question. Don't be overly formal.`;

  try {
    const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-8);
      for (const msg of recentHistory) {
        let cleanContent = msg.content
          .replace(/<!--\s*DIKA_ACTION_DATA:[\s\S]*?-->/g, '')
          .replace(/&lt;!--\s*DIKA_ACTION_DATA:[\s\S]*?--&gt;/g, '')
          .trim();
        if (cleanContent) {
          historyMessages.push({ role: msg.role, content: cleanContent });
        }
      }
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        answer: "I had trouble understanding that. Could you try again?",
        followUpChips: [],
      };
    }

    const parsed = JSON.parse(content);
    const actionData: ActionData = parsed.action;

    if (actionData && actionData.status === 'pending_confirmation') {
      const answer = `${parsed.message}\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`;
      return {
        answer,
        followUpChips: [],
      };
    }

    const followUpChips = getActionFollowUpChips(actionType);
    return {
      answer: parsed.message || "Could you provide more details?",
      followUpChips,
    };
  } catch (error) {
    console.error('Owner action AI processing error:', error);
    return {
      answer: "I encountered an error processing that request. Please try again.",
      followUpChips: [],
    };
  }
}

async function handleMemberLookup(
  gymId: number,
  message: string,
): Promise<{ answer: string; followUpChips: string[] }> {
  const searchName = extractMemberNameFromLookup(message);
  if (!searchName) {
    return {
      answer: "I couldn't figure out which member you're asking about. Try saying something like \"tell me about John\" or \"how is Sarah doing?\"",
      followUpChips: ['Who checked in today?', 'Show my members'],
    };
  }

  const normalizedSearch = searchName.toLowerCase().replace(/[_\-\.]/g, ' ').trim();

  const allMembers = await db.select({
    id: users.id,
    username: users.username,
    createdAt: users.createdAt,
  })
  .from(users)
  .where(and(eq(users.gymId, gymId), eq(users.role, 'member')));

  const allProfiles = await db.select({
    userId: userProfiles.userId,
    fullName: userProfiles.fullName,
    phone: userProfiles.phone,
    gender: userProfiles.gender,
  })
  .from(userProfiles)
  .where(inArray(userProfiles.userId, allMembers.map(m => m.id)));

  const profileMap = new Map(allProfiles.map(p => [p.userId, p]));

  let bestMatch: { id: number; username: string; createdAt: Date | null; profile: typeof allProfiles[0] | undefined } | null = null;
  let bestScore = 0;

  for (const member of allMembers) {
    const profile = profileMap.get(member.id);
    const fullName = (profile?.fullName || '').toLowerCase();
    const username = member.username.toLowerCase().replace(/[_\-\.]/g, ' ');

    let score = 0;
    if (fullName === normalizedSearch || username === normalizedSearch) {
      score = 100;
    } else if ((fullName && fullName.includes(normalizedSearch)) || username.includes(normalizedSearch)) {
      score = 80;
    } else if ((fullName && normalizedSearch.includes(fullName)) || (username.length >= 3 && normalizedSearch.includes(username))) {
      score = 60;
    } else {
      const searchWords = normalizedSearch.split(/\s+/);
      const nameWords = [...(fullName ? fullName.split(/\s+/) : []), ...username.split(/\s+/)].filter(w => w.length >= 2);
      const matchedWords = searchWords.filter(sw => sw.length >= 2 && nameWords.some(nw => nw.includes(sw) || sw.includes(nw)));
      if (matchedWords.length > 0) {
        score = 40 + (matchedWords.length / searchWords.length) * 30;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...member, profile };
    }
  }

  if (!bestMatch || bestScore < 50) {
    return {
      answer: `I couldn't find a member matching "${searchName}" in your gym. Double-check the name and try again.`,
      followUpChips: ['Show my members', 'Add a new member'],
    };
  }

  const memberId = bestMatch.id;
  const memberName = bestMatch.profile?.fullName || bestMatch.username;
  const today = new Date().toISOString().split('T')[0];

  const [gym] = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
  const currencySymbol = (gym?.currency || 'INR') === 'INR' ? '₹' : '$';

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

  const [attendanceLast30] = await db.select({
    count: sql<number>`count(*)`
  })
  .from(attendance)
  .where(and(
    eq(attendance.memberId, memberId),
    eq(attendance.gymId, gymId),
    gte(attendance.date, thirtyDaysAgoStr),
    eq(attendance.status, 'present')
  ));

  const lastCheckIn = await db.select({ date: attendance.date })
    .from(attendance)
    .where(and(
      eq(attendance.memberId, memberId),
      eq(attendance.gymId, gymId),
      eq(attendance.status, 'present')
    ))
    .orderBy(desc(attendance.date))
    .limit(1);

  const [workoutsLast30] = await db.select({
    count: sql<number>`count(distinct ${workoutCompletions.completedDate})`
  })
  .from(workoutCompletions)
  .where(and(
    eq(workoutCompletions.memberId, memberId),
    gte(workoutCompletions.completedDate, thirtyDaysAgoStr)
  ));

  const activeSub = await db.select({
    id: memberSubscriptions.id,
    planId: memberSubscriptions.planId,
    startDate: memberSubscriptions.startDate,
    endDate: memberSubscriptions.endDate,
    totalAmount: memberSubscriptions.totalAmount,
    status: memberSubscriptions.status,
  })
  .from(memberSubscriptions)
  .where(and(
    eq(memberSubscriptions.memberId, memberId),
    eq(memberSubscriptions.gymId, gymId),
  ))
  .orderBy(desc(memberSubscriptions.startDate))
  .limit(1);

  let subInfo = 'No active subscription';
  let balanceInfo = '';
  if (activeSub.length > 0) {
    const sub = activeSub[0];
    let plan: { name: string } | undefined;
    if (sub.planId) {
      [plan] = await db.select({ name: membershipPlans.name })
        .from(membershipPlans)
        .where(eq(membershipPlans.id, sub.planId));
    }

    const [paidResult] = await db.select({
      total: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
    })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.subscriptionId, sub.id));

    const totalPaid = Number(paidResult?.total || 0);
    const remaining = (sub.totalAmount || 0) - totalPaid;

    const endDate = new Date(sub.endDate + 'T00:00:00');
    const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    subInfo = `${plan?.name || 'Plan'} (${sub.status})`;
    if (daysLeft > 0) {
      subInfo += ` - ${daysLeft} days left (expires ${sub.endDate})`;
    } else {
      subInfo += ` - Expired on ${sub.endDate}`;
    }
    if (remaining > 0) {
      balanceInfo = `Outstanding balance: ${currencySymbol}${(remaining / 100).toFixed(0)}`;
    } else {
      balanceInfo = 'Fully paid';
    }
  }

  const latestMeasurement = await db.select({
    weight: bodyMeasurements.weight,
    bodyFat: bodyMeasurements.bodyFat,
    recordedDate: bodyMeasurements.recordedDate,
  })
  .from(bodyMeasurements)
  .where(eq(bodyMeasurements.memberId, memberId))
  .orderBy(desc(bodyMeasurements.recordedDate))
  .limit(1);

  const trainerAssignment = await db.select({
    trainerId: trainerMemberAssignments.trainerId,
  })
  .from(trainerMemberAssignments)
  .where(and(
    eq(trainerMemberAssignments.memberId, memberId),
    eq(trainerMemberAssignments.gymId, gymId),
    sql`${trainerMemberAssignments.endedAt} IS NULL`
  ))
  .limit(1);

  let trainerName = 'None assigned';
  if (trainerAssignment.length > 0) {
    const [trainer] = await db.select({ username: users.username })
      .from(users)
      .where(eq(users.id, trainerAssignment[0].trainerId));
    const [trainerProfile] = await db.select({ fullName: userProfiles.fullName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, trainerAssignment[0].trainerId));
    trainerName = trainerProfile?.fullName || trainer?.username || 'Unknown';
  }

  const lastCheckInDate = lastCheckIn[0]?.date || 'Never';
  let daysSinceCheckIn = '';
  if (lastCheckIn[0]?.date) {
    const lastDate = new Date(lastCheckIn[0].date + 'T00:00:00');
    const diff = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) daysSinceCheckIn = '(today)';
    else if (diff === 1) daysSinceCheckIn = '(yesterday)';
    else daysSinceCheckIn = `(${diff} days ago)`;
  }

  const joinedDate = bestMatch.createdAt ? new Date(bestMatch.createdAt).toISOString().split('T')[0] : 'Unknown';

  let lines = [
    `**${memberName}**`,
    '',
    `**Attendance** (last 30 days): ${attendanceLast30?.count || 0} check-ins`,
    `**Last check-in**: ${lastCheckInDate} ${daysSinceCheckIn}`,
    `**Workouts** (last 30 days): ${workoutsLast30?.count || 0} days`,
    '',
    `**Subscription**: ${subInfo}`,
  ];

  if (balanceInfo) {
    lines.push(`**Payment**: ${balanceInfo}`);
  }

  lines.push(`**Trainer**: ${trainerName}`);

  if (latestMeasurement.length > 0) {
    const m = latestMeasurement[0];
    const parts = [];
    if (m.weight) parts.push(`${m.weight}kg`);
    if (m.bodyFat) parts.push(`${m.bodyFat}% body fat`);
    if (parts.length > 0) {
      lines.push(`**Body**: ${parts.join(', ')} (as of ${m.recordedDate})`);
    }
  }

  lines.push(`**Joined**: ${joinedDate}`);

  let riskFlag = '';
  if (lastCheckIn[0]?.date) {
    const lastDate = new Date(lastCheckIn[0].date + 'T00:00:00');
    const diff = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 14) {
      riskFlag = `\n\n**Attention**: ${memberName} hasn't visited in ${diff} days. Consider reaching out to keep them engaged.`;
    } else if (diff >= 7) {
      riskFlag = `\n\n**Note**: ${memberName} hasn't checked in for ${diff} days.`;
    }
  } else if (attendanceLast30?.count === 0) {
    riskFlag = `\n\n**Attention**: ${memberName} has no check-ins in the last 30 days. They may need a follow-up.`;
  }

  const answer = lines.join('\n') + riskFlag;

  return {
    answer,
    followUpChips: [
      `Log a payment for ${memberName.split(' ')[0]}`,
      `Assign a trainer to ${memberName.split(' ')[0]}`,
      'Who checked in today?',
    ],
  };
}

export async function executeOwnerAction(
  userId: number,
  gymId: number,
  actionData: ActionData
): Promise<{ success: boolean; message: string }> {
  switch (actionData.actionType) {
    case 'add_member':
      return executeAddMember(userId, gymId, actionData.payload);
    case 'log_payment':
      return executeLogPayment(userId, gymId, actionData.payload);
    case 'assign_trainer':
      return executeAssignTrainer(userId, gymId, actionData.payload);
    default:
      return { success: false, message: "Unknown action type." };
  }
}

async function executeAddMember(
  ownerId: number,
  gymId: number,
  payload: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  try {
    const { fullName, email, phone, planId } = payload;

    if (!fullName || !email) {
      return { success: false, message: "Name and email are required to add a member." };
    }

    const [gym] = await db.select({ code: gyms.code }).from(gyms).where(eq(gyms.id, gymId));
    if (!gym) {
      return { success: false, message: "Could not find your gym." };
    }

    const existingUser = await storage.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return { success: false, message: `A user with email ${email} already exists.` };
    }

    const username = fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Math.floor(Math.random() * 1000);
    const tempPassword = 'Welcome@' + Math.floor(1000 + Math.random() * 9000);

    const newUser = await storage.createUser({
      username,
      email: email.toLowerCase(),
      password: tempPassword,
      role: 'member',
      gymId,
      emailVerified: true,
    });

    if (fullName || phone) {
      await db.insert(userProfiles).values({
        userId: newUser.id,
        fullName: fullName || '',
        phone: phone || '',
        gender: 'prefer_not_to_say',
        dob: '',
      }).onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          fullName: fullName || undefined,
          phone: phone || undefined,
        },
      });
    }

    if (planId) {
      const [plan] = await db.select().from(membershipPlans).where(
        and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, gymId))
      );

      if (plan) {
        const today = new Date().toISOString().split('T')[0];
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.durationMonths);

        await storage.createMemberSubscription({
          gymId,
          memberId: newUser.id,
          planId: plan.id,
          startDate: today,
          endDate: endDate.toISOString().split('T')[0],
          totalAmount: plan.priceAmount,
          paymentMode: 'full',
          status: 'active',
        });
      }
    }

    return {
      success: true,
      message: `**${fullName}** has been added as a member! Their login credentials:\n- Username: **${username}**\n- Temporary password: **${tempPassword}**\n\nPlease share these with the member so they can log in and change their password.`,
    };
  } catch (error: any) {
    console.error('Execute add member error:', error);
    return { success: false, message: `Failed to add member: ${error.message || 'Unknown error'}` };
  }
}

async function executeLogPayment(
  ownerId: number,
  gymId: number,
  payload: Record<string, any>
): Promise<{ success: boolean; message: string; data?: Record<string, any> }> {
  try {
    const { memberId, memberName, planId, planName, totalAmount, amountPaid, paymentMode, method, startDate } = payload;

    if (!memberId || !planId || !amountPaid) {
      return { success: false, message: "Member, plan, and payment amount are required." };
    }

    const [member] = await db.select({
      id: users.id,
      username: users.username,
      gymId: users.gymId,
    }).from(users).where(and(eq(users.id, memberId), eq(users.gymId, gymId)));

    if (!member) {
      return { success: false, message: "Member not found in your gym." };
    }

    const [plan] = await db.select().from(membershipPlans).where(
      and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, gymId))
    );

    if (!plan) {
      return { success: false, message: "Selected plan not found." };
    }

    const existingSubs = await db.select()
      .from(memberSubscriptions)
      .where(and(
        eq(memberSubscriptions.memberId, memberId),
        eq(memberSubscriptions.gymId, gymId),
        eq(memberSubscriptions.status, 'active')
      ))
      .limit(1);

    if (existingSubs.length > 0) {
      const existingSub = existingSubs[0];
      const existingPlan = existingSub.planId ? await db.select({ name: membershipPlans.name }).from(membershipPlans).where(eq(membershipPlans.id, existingSub.planId)).then(r => r[0]) : null;

      const existingPayments = await db.select({
        totalPaid: sql<number>`COALESCE(SUM(${paymentTransactions.amountPaid}), 0)`
      })
        .from(paymentTransactions)
        .where(eq(paymentTransactions.subscriptionId, existingSub.id));
      const totalPaidSoFar = Number(existingPayments[0]?.totalPaid || 0);
      const outstandingBalance = existingSub.totalAmount - totalPaidSoFar;

      if (outstandingBalance <= 0) {
        return {
          success: false,
          message: `${memberName || 'This member'} already has a fully paid active subscription${existingPlan ? ` (${existingPlan.name})` : ''} running until ${existingSub.endDate}. Please end the existing subscription first or go to Payments to manage it.`,
        };
      }

      const paidOn = new Date().toISOString().split('T')[0];
      const paymentMethod = method || 'cash';
      let amountPaidPaise = Math.round(amountPaid * 100);
      if (amountPaidPaise > outstandingBalance) {
        amountPaidPaise = outstandingBalance;
      }

      await storage.addPaymentTransaction({
        subscriptionId: existingSub.id,
        memberId,
        gymId,
        amountPaid: amountPaidPaise,
        paidOn,
        method: paymentMethod,
        referenceNote: `Additional payment logged via Dika assistant`,
      });

      const newTotalPaid = totalPaidSoFar + amountPaidPaise;
      const newBalance = existingSub.totalAmount - newTotalPaid;

      if (newBalance <= 0) {
        await db.update(memberSubscriptions)
          .set({ paymentMode: 'full', updatedAt: new Date() })
          .where(eq(memberSubscriptions.id, existingSub.id));
      }

      const [gymData] = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
      const currencySymbol = (gymData?.currency || 'INR') === 'INR' ? '\u20B9' : '$';
      const paidInCurrency = amountPaidPaise / 100;
      const newBalanceInCurrency = newBalance / 100;
      const subPlanName = existingPlan?.name || planName || 'Subscription';

      let message = `Additional payment logged for **${memberName || 'member'}**'s **${subPlanName}**!\n`;
      message += `- Paid now: **${currencySymbol}${paidInCurrency.toLocaleString()}** via ${paymentMethod}\n`;
      message += `- Total paid so far: **${currencySymbol}${(newTotalPaid / 100).toLocaleString()}** of **${currencySymbol}${(existingSub.totalAmount / 100).toLocaleString()}**\n`;
      if (newBalance > 0) {
        message += `- Remaining balance: **${currencySymbol}${newBalanceInCurrency.toLocaleString()}**\n`;
      } else {
        message += `- Subscription is now **fully paid**!\n`;
      }

      return {
        success: true,
        message,
        data: {
          subscriptionId: existingSub.id,
          amountPaid: paidInCurrency,
          totalPaid: newTotalPaid / 100,
          totalAmount: existingSub.totalAmount / 100,
          balance: newBalance > 0 ? newBalanceInCurrency : 0,
          method: paymentMethod,
        },
      };
    }

    const subStartDate = startDate || new Date().toISOString().split('T')[0];
    const endDateObj = new Date(subStartDate);
    endDateObj.setMonth(endDateObj.getMonth() + plan.durationMonths);
    const subEndDate = endDateObj.toISOString().split('T')[0];

    const totalAmountPaise = plan.priceAmount;
    let amountPaidPaise = Math.round(amountPaid * 100);
    if (amountPaidPaise > totalAmountPaise) {
      amountPaidPaise = totalAmountPaise;
    }
    const paidOn = new Date().toISOString().split('T')[0];
    const paymentMethod = method || 'cash';
    const mode = paymentMode || (amountPaidPaise >= totalAmountPaise ? 'full' : 'partial');

    const subscription = await storage.createMemberSubscription({
      gymId,
      memberId,
      planId: plan.id,
      startDate: subStartDate,
      endDate: subEndDate,
      totalAmount: totalAmountPaise,
      paymentMode: mode,
      status: 'active',
    });

    await storage.addPaymentTransaction({
      subscriptionId: subscription.id,
      memberId,
      gymId,
      amountPaid: amountPaidPaise,
      paidOn,
      method: paymentMethod,
      referenceNote: `Logged via Dika assistant`,
    });

    const [gymData] = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
    const currencySymbol = (gymData?.currency || 'INR') === 'INR' ? '\u20B9' : '$';
    const totalInCurrency = totalAmountPaise / 100;
    const paidInCurrency = amountPaidPaise / 100;
    const balanceInCurrency = (totalAmountPaise - amountPaidPaise) / 100;

    let message = `**${planName || plan.name}** subscription created for **${memberName || 'member'}**!\n`;
    message += `- Duration: ${subStartDate} → ${subEndDate}\n`;
    message += `- Total: **${currencySymbol}${totalInCurrency.toLocaleString()}**\n`;
    message += `- Paid: **${currencySymbol}${paidInCurrency.toLocaleString()}** via ${paymentMethod}\n`;

    if (balanceInCurrency > 0) {
      message += `- Balance: **${currencySymbol}${balanceInCurrency.toLocaleString()}** remaining`;
    } else {
      message += `- Status: **Fully paid**`;
    }

    return { success: true, message };
  } catch (error: any) {
    console.error('Execute log payment error:', error);
    return { success: false, message: `Failed to log payment: ${error.message || 'Unknown error'}` };
  }
}

async function executeAssignTrainer(
  ownerId: number,
  gymId: number,
  payload: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  try {
    const { memberId, trainerId, trainingMode, memberName, trainerName } = payload;

    if (!memberId || !trainerId) {
      return { success: false, message: "Both member and trainer are required." };
    }

    const [member] = await db.select({ id: users.id, gymId: users.gymId })
      .from(users)
      .where(and(eq(users.id, memberId), eq(users.gymId, gymId)));

    if (!member) {
      return { success: false, message: "Member not found in your gym." };
    }

    const [trainer] = await db.select({ id: users.id, gymId: users.gymId })
      .from(users)
      .where(and(eq(users.id, trainerId), eq(users.gymId, gymId), eq(users.role, 'trainer')));

    if (!trainer) {
      return { success: false, message: "Trainer not found in your gym." };
    }

    const mode = trainingMode || 'trainer_led';
    await storage.assignTrainerWithMode(trainerId, memberId, gymId, mode);

    return {
      success: true,
      message: `**${trainerName || 'Trainer'}** has been assigned to **${memberName || 'member'}** in **${mode === 'trainer_led' ? 'Trainer-Led' : 'Self-Guided'}** mode.`,
    };
  } catch (error: any) {
    console.error('Execute assign trainer error:', error);
    return { success: false, message: `Failed to assign trainer: ${error.message || 'Unknown error'}` };
  }
}

function getActionFollowUpChips(actionType: OwnerActionType): string[] {
  switch (actionType) {
    case 'add_member':
      return ['Add another member', 'Go to members', 'Assign a trainer'];
    case 'log_payment':
      return ['Log another payment', 'Go to payments', 'Revenue overview'];
    case 'assign_trainer':
      return ['Assign another trainer', 'Go to trainers', 'Go to members'];
    case 'create_support_ticket':
      return ['Go to support', 'Report another issue'];
    default:
      return ['Gym overview', 'Go to dashboard'];
  }
}

export async function processSupportTicketAction(
  userId: number,
  role: string,
  gymId: number | null,
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; followUpChips: string[] }> {
  const isPersonalMode = role === 'member' && !gymId;

  const validIssueTypes = isPersonalMode
    ? ['workout', 'nutrition', 'account', 'subscription', 'bug_report', 'other']
    : role === 'owner'
      ? ['attendance', 'payments', 'profile_update', 'bug_report', 'other']
      : role === 'trainer'
        ? ['attendance', 'payments', 'trainer_assignment', 'bug_report', 'other']
        : ['attendance', 'payments', 'profile_update', 'trainer_assignment', 'bug_report', 'workout', 'nutrition', 'account', 'subscription', 'other'];

  const issueTypeLabels: Record<string, string> = {
    attendance: 'Attendance Issue',
    payments: 'Payment Issue',
    profile_update: 'Profile Update',
    trainer_assignment: 'Trainer Assignment',
    bug_report: 'Bug Report',
    workout: 'Workout Issue',
    nutrition: 'Nutrition / Calorie Tracking',
    account: 'Account Issue',
    subscription: 'Subscription / Billing',
    other: 'Other',
  };

  const availableTypes = validIssueTypes.map(t => `${t} (${issueTypeLabels[t] || t})`).join(', ');

  const state = detectSupportTicketState(message, conversationHistory);

  if (state === 'needs_description') {
    return {
      answer: `Sure, I can help you create a support ticket! Could you describe what's going wrong? The more detail you provide, the faster our team can help.\n${SUPPORT_FLOW_MARKER}`,
      followUpChips: ['Report a bug', 'Payment issue', 'Something is broken'],
    };
  }

  if (state === 'needs_priority') {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `The user described an issue. Acknowledge it briefly in 1-2 short sentences, then ask how urgent it is. End with: "Would you say this is **low**, **medium**, or **high** priority?". Be warm and empathetic. Do NOT create the ticket yet.`
          },
          { role: "user", content: message }
        ],
        max_completion_tokens: 150,
      });
      const aiResponse = response.choices[0]?.message?.content?.trim() || 
        "Thanks for explaining that. How urgent is this for you - would you say it's **low**, **medium**, or **high** priority?";
      return {
        answer: `${aiResponse}\n<!-- SUPPORT_STEP:description_collected -->\n${SUPPORT_FLOW_MARKER}`,
        followUpChips: ['Low priority', 'Medium priority', 'High priority'],
      };
    } catch {
      return {
        answer: `Thanks for explaining that. How urgent is this for you - would you say it's **low**, **medium**, or **high** priority?\n<!-- SUPPORT_STEP:description_collected -->\n${SUPPORT_FLOW_MARKER}`,
        followUpChips: ['Low priority', 'Medium priority', 'High priority'],
      };
    }
  }

  const priority = extractPriorityFromMessage(message) || 'medium';

  const descriptionMessages = conversationHistory
    ? conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .filter(c => !detectSupportTicketRequest(c) && !/\b(low|medium|high)\s+priority\b/i.test(c))
    : [];
  const userDescription = descriptionMessages.length > 0
    ? descriptionMessages[descriptionMessages.length - 1]
    : message;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You extract support ticket data. Given the user's issue description, respond ONLY with a JSON object (no markdown, no extra text):
{"issueType":"...","description":"..."}

issueType must be one of: [${validIssueTypes.join(', ')}]. Pick the best match.
description: Write a clear, professional summary of their issue in 1-2 sentences (minimum 15 characters). Don't just repeat their words - summarize clearly.`
        },
        { role: "user", content: userDescription }
      ],
      max_completion_tokens: 150,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const issueType = validIssueTypes.includes(parsed.issueType) ? parsed.issueType : 'bug_report';
    const description = (parsed.description?.trim() && parsed.description.trim().length >= 10)
      ? parsed.description.trim()
      : userDescription;

    const actionData: ActionData = {
      actionType: 'create_support_ticket',
      status: 'pending_confirmation',
      payload: {
        issueType,
        issueTypeLabel: issueTypeLabels[issueType] || issueType,
        priority,
        description,
      },
      preview: `Create support ticket: ${issueTypeLabels[issueType] || issueType}`,
    };

    return {
      answer: `Here's your support ticket - please confirm the details:\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`,
      followUpChips: ['Go to support', 'Report another issue'],
    };
  } catch (error) {
    console.error('Support ticket AI processing error:', error);
    const actionData: ActionData = {
      actionType: 'create_support_ticket',
      status: 'pending_confirmation',
      payload: {
        issueType: 'bug_report',
        issueTypeLabel: 'Bug Report',
        priority,
        description: userDescription,
      },
      preview: 'Create support ticket: Bug Report',
    };

    return {
      answer: `Here's your support ticket - please confirm the details:\n<!-- DIKA_ACTION_DATA:${JSON.stringify(actionData)} -->`,
      followUpChips: ['Go to support', 'Report another issue'],
    };
  }
}

export async function executeSupportTicket(
  userId: number,
  role: string,
  gymId: number | null,
  payload: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  try {
    const { issueType, priority, description } = payload;

    if (!description || description.length < 10) {
      return { success: false, message: "Description must be at least 10 characters." };
    }

    const [user] = await db.select({
      email: users.email,
      phone: users.phone,
    }).from(users).where(eq(users.id, userId));

    const ticket = await storage.createSupportTicket({
      userId,
      userRole: role as 'owner' | 'member' | 'trainer',
      gymId: gymId || null,
      contactEmailOrPhone: user?.email || user?.phone || `user_${userId}`,
      issueType: issueType || 'other',
      priority: priority || 'medium',
      description,
      attachmentUrl: null,
      status: 'open',
    });

    const issueTypeLabels: Record<string, string> = {
      attendance: 'Attendance Issue',
      payments: 'Payment Issue',
      profile_update: 'Profile Update',
      trainer_assignment: 'Trainer Assignment',
      bug_report: 'Bug Report',
      workout: 'Workout Issue',
      nutrition: 'Nutrition / Calorie Tracking',
      account: 'Account Issue',
      subscription: 'Subscription / Billing',
      other: 'Other',
    };

    return {
      success: true,
      message: `Your support ticket has been created!\n- **Ticket #${ticket.id}**\n- **Type**: ${issueTypeLabels[issueType] || issueType}\n- **Priority**: ${(priority || 'medium').toUpperCase()}\n\nOur team will review your request and get back to you. You can track your ticket status in the Support page.`,
    };
  } catch (error: any) {
    console.error('Execute support ticket error:', error);
    return { success: false, message: `Failed to create support ticket: ${error.message || 'Unknown error'}` };
  }
}
