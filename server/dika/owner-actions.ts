import OpenAI from "openai";
import { db } from "../db";
import { users, userProfiles, gyms, memberSubscriptions, trainerMemberAssignments, membershipPlans } from "@shared/schema";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type OwnerActionType = 
  | 'navigate'
  | 'add_member'
  | 'log_payment'
  | 'assign_trainer';

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
];

const ASSIGN_TRAINER_PATTERNS = [
  /assign\s+(?:a\s+)?trainer/i,
  /(?:set|change|move|switch)\s+(?:the\s+)?trainer\s+(?:for|to|of)/i,
  /assign\s+\w+\s+(?:to|as\s+trainer\s+for)/i,
  /(?:give|put)\s+\w+\s+(?:to|under|with)\s+(?:trainer\s+)?\w+/i,
];

export function detectOwnerAction(message: string): OwnerActionType | null {
  const lower = message.toLowerCase().trim();

  for (const pattern of NAVIGATION_PATTERNS) {
    if (pattern.test(lower)) return 'navigate';
  }

  for (const pattern of ADD_MEMBER_PATTERNS) {
    if (pattern.test(lower)) return 'add_member';
  }

  for (const pattern of LOG_PAYMENT_PATTERNS) {
    if (pattern.test(lower)) return 'log_payment';
  }

  for (const pattern of ASSIGN_TRAINER_PATTERNS) {
    if (pattern.test(lower)) return 'assign_trainer';
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
    actionInstructions = `The owner wants to log a payment for a member.
To log a payment, we need:
- memberName (required): Which member paid - must match someone in the gym
- amount (required): Payment amount in the gym's currency (${gym.currency || 'INR'})
- method (required): Payment method - one of: cash, upi, card, bank, other (default: cash). If the user says something like "venmo", "zelle", "gpay", "phonepe", or any other payment app/service, map it to "other" and include the original method name in the note field. NEVER reject a payment method - always accept it and map to the closest category or "other".
- date (optional): Payment date in YYYY-MM-DD format (default: today)
- note (optional): Reference note

Current gym members: ${memberList || 'No members'}
Currency: ${gym.currency || 'INR'}

Extract whatever info the owner provided from the ENTIRE conversation (including previous messages). The user may provide member name, amount, and method across multiple messages.
The amount should be the raw number in the main currency unit (not paise). Parse amounts like "49$", "$49", "49 dollars", "49" as the number 49.
Match the member name against the gym's member list using fuzzy matching. If the name is close but not exact (e.g., "varshel" for "Varshel"), still match it.
If ambiguous (multiple matches), ask to clarify.
If we can't match any member, let the owner know.
CRITICAL: Once you have memberId, amount, and method, you MUST set status to "pending_confirmation" immediately. Do NOT ask for optional fields like date or note - proceed straight to confirmation.

IMPORTANT: You must respond in this exact JSON format:
{
  "message": "Your conversational response to the owner",
  "action": {
    "actionType": "log_payment",
    "status": "pending_confirmation" or "needs_info",
    "payload": { "memberId": number, "memberName": "...", "amount": number, "method": "cash", "date": "YYYY-MM-DD", "note": "..." },
    "preview": "A human-readable summary of what will be done",
    "missingFields": ["field1", "field2"]
  }
}

Set status to "needs_info" if member or amount is missing/ambiguous. Set to "pending_confirmation" if we have enough.`;
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
): Promise<{ success: boolean; message: string }> {
  try {
    const { memberId, amount, method, date, note } = payload;

    if (!memberId || !amount) {
      return { success: false, message: "Member and amount are required to log a payment." };
    }

    const [member] = await db.select({
      id: users.id,
      username: users.username,
      gymId: users.gymId,
    }).from(users).where(and(eq(users.id, memberId), eq(users.gymId, gymId)));

    if (!member) {
      return { success: false, message: "Member not found in your gym." };
    }

    const subs = await db.select()
      .from(memberSubscriptions)
      .where(and(
        eq(memberSubscriptions.memberId, memberId),
        eq(memberSubscriptions.gymId, gymId),
      ))
      .orderBy(desc(memberSubscriptions.createdAt))
      .limit(1);

    if (subs.length === 0) {
      return { success: false, message: "This member has no active subscription. Please create a subscription first before logging a payment." };
    }

    const subscription = subs[0];
    const amountInPaise = Math.round(amount * 100);
    const paidOn = date || new Date().toISOString().split('T')[0];
    const paymentMethod = method || 'cash';

    await storage.addPaymentTransaction({
      subscriptionId: subscription.id,
      memberId,
      gymId,
      amountPaid: amountInPaise,
      paidOn,
      method: paymentMethod,
      referenceNote: note || `Logged via Dika assistant`,
    });

    const [gym] = await db.select({ currency: gyms.currency }).from(gyms).where(eq(gyms.id, gymId));
    const currencySymbol = (gym?.currency || 'INR') === 'INR' ? '\u20B9' : (gym?.currency || '');

    return {
      success: true,
      message: `Payment of **${currencySymbol}${amount.toLocaleString()}** logged for **${payload.memberName || 'member'}** via ${paymentMethod}. Date: ${paidOn}.`,
    };
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
    default:
      return ['Gym overview', 'Go to dashboard'];
  }
}
