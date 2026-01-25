export type DikaIntent = 
  | 'member_weekly_workouts'
  | 'member_monthly_workout_count'
  | 'member_current_cycle'
  | 'member_last_rest_day'
  | 'member_skipped_this_week'
  | 'trainer_member_workout_on_date'
  | 'trainer_members_skipped_this_week'
  | 'owner_unpaid_this_month'
  | 'owner_member_payment_status'
  | 'owner_active_members_today'
  | 'owner_checked_in_today'
  | 'owner_not_checked_in_today'
  | 'owner_active_memberships'
  | 'owner_expiring_memberships'
  | 'ambiguous'
  | 'unknown';

export type UserRole = 'member' | 'trainer' | 'owner';

export type ResponseMode = 'count' | 'list';

export interface IntentResult {
  intent: DikaIntent;
  confidence: 'high' | 'low';
  responseMode: ResponseMode;
  ambiguityType?: string;
  clarificationQuestion?: string;
  extractedEntities: {
    memberName?: string;
    date?: string;
    dateRange?: { start: string; end: string };
    month?: string;
  };
}

interface IntentPattern {
  intent: DikaIntent;
  patterns: RegExp[];
  requiredRole: UserRole[];
  extractors?: {
    memberName?: RegExp;
    date?: RegExp;
    month?: RegExp;
  };
}

function normalizeMessage(message: string): string {
  let normalized = message.toLowerCase().trim();
  normalized = normalized.replace(/[.,!?;:'"()]/g, '');
  const replacements: Record<string, string> = {
    'checkedin': 'checked in',
    'checkin': 'check in',
    'didnt': 'did not',
    'havent': 'have not',
    'hasnt': 'has not',
    'wont': 'will not',
    'dont': 'do not',
    'subs': 'subscriptions',
    'mem': 'members',
    'mems': 'members',
  };
  for (const [from, to] of Object.entries(replacements)) {
    normalized = normalized.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return normalized;
}

function detectResponseMode(message: string): ResponseMode {
  const countPatterns = [/how many/i, /count/i, /number of/i, /total/i];
  const listPatterns = [/who/i, /list/i, /names?/i, /show me/i, /which/i];
  
  for (const pattern of countPatterns) {
    if (pattern.test(message)) return 'count';
  }
  for (const pattern of listPatterns) {
    if (pattern.test(message)) return 'list';
  }
  return 'count';
}

interface AmbiguityCheck {
  isAmbiguous: boolean;
  type?: string;
  clarification?: string;
}

function checkAmbiguity(message: string): AmbiguityCheck {
  const normalized = normalizeMessage(message);
  if (/active\s+members?\s+today/i.test(normalized)) {
    return {
      isAmbiguous: true,
      type: 'active_meaning',
      clarification: "Do you mean active memberships, or members who checked in today?"
    };
  }
  const subjectiveWords = ['best', 'worst', 'top', 'consistent', 'lazy', 'strongest', 'weakest'];
  const hasSubjectiveWord = subjectiveWords.some(word => 
    new RegExp(`\\b${word}\\b`, 'i').test(normalized)
  );
  
  if (hasSubjectiveWord) {
    return {
      isAmbiguous: true,
      type: 'subjective_request',
      clarification: "Dika doesn't rank or judge people. I can show attendance or workout counts if you want."
    };
  }
  return { isAmbiguous: false };
}

const intentPatterns: IntentPattern[] = [
  {
    intent: 'member_weekly_workouts',
    patterns: [
      /what\s+did\s+i\s+train\s+this\s+week/i,
      /my\s+workouts?\s+this\s+week/i,
      /show\s+(me\s+)?this\s+week('s)?\s+(training|workouts?)/i,
      /this\s+week('s)?\s+workouts?/i,
      /what\s+i\s+trained\s+this\s+week/i,
      /workouts?\s+i\s+did\s+this\s+week/i,
    ],
    requiredRole: ['member'],
  },
  {
    intent: 'member_monthly_workout_count',
    patterns: [
      /how\s+many\s+(days?\s+)?did\s+i\s+work\s*out\s+this\s+month/i,
      /my\s+workout\s+count\s+this\s+month/i,
      /workouts?\s+this\s+month/i,
      /how\s+many\s+times?\s+did\s+i\s+(train|exercise)\s+this\s+month/i,
      /days?\s+i\s+worked?\s*out\s+this\s+month/i,
    ],
    requiredRole: ['member'],
  },
  {
    intent: 'member_current_cycle',
    patterns: [
      /what\s+is\s+my\s+(current\s+)?workout\s+cycle/i,
      /my\s+(current\s+)?cycle/i,
      /show\s+(me\s+)?my\s+cycle/i,
      /what\s+cycle\s+am\s+i\s+on/i,
      /current\s+workout\s+plan/i,
      /my\s+workout\s+plan/i,
    ],
    requiredRole: ['member'],
  },
  {
    intent: 'member_last_rest_day',
    patterns: [
      /when\s+was\s+my\s+last\s+rest\s+day/i,
      /my\s+last\s+rest\s+day/i,
      /when\s+did\s+i\s+(last\s+)?rest/i,
      /last\s+time\s+i\s+rested/i,
    ],
    requiredRole: ['member'],
  },
  {
    intent: 'member_skipped_this_week',
    patterns: [
      /did\s+i\s+skip\s+(any\s+)?workouts?\s+this\s+week/i,
      /how\s+many\s+workouts?\s+did\s+i\s+skip/i,
      /missed\s+workouts?\s+this\s+week/i,
      /skipped\s+days?\s+this\s+week/i,
    ],
    requiredRole: ['member'],
  },
  {
    intent: 'trainer_member_workout_on_date',
    patterns: [
      /what\s+did\s+(\w+)\s+train\s+(yesterday|today|on\s+\w+)/i,
      /(\w+)('s)?\s+workout\s+(yesterday|today|on\s+\w+)/i,
      /show\s+(me\s+)?(\w+)('s)?\s+(training|workout)/i,
      /what\s+about\s+(today|yesterday|his|her|their)/i,
    ],
    requiredRole: ['trainer', 'owner'],
    extractors: {
      memberName: /(?:what\s+did\s+|show\s+(?:me\s+)?)(\w+)/i,
      date: /(yesterday|today|on\s+\w+)/i,
    },
  },
  {
    intent: 'trainer_members_skipped_this_week',
    patterns: [
      /who\s+skipped\s+workouts?\s+this\s+week/i,
      /members?\s+who\s+skipped/i,
      /who\s+missed\s+workouts?/i,
      /skipped\s+members?\s+this\s+week/i,
    ],
    requiredRole: ['trainer', 'owner'],
  },
  {
    intent: 'owner_unpaid_this_month',
    patterns: [
      /who\s+hasn'?t\s+paid\s+this\s+month/i,
      /unpaid\s+members?\s+this\s+month/i,
      /members?\s+(with\s+)?pending\s+payments?/i,
      /who\s+owes\s+money/i,
      /outstanding\s+payments?/i,
    ],
    requiredRole: ['owner'],
  },
  {
    intent: 'owner_member_payment_status',
    patterns: [
      /(\w+)('s)?\s+payment\s+status/i,
      /has\s+(\w+)\s+paid/i,
      /did\s+(\w+)\s+pay/i,
      /check\s+(\w+)('s)?\s+payment/i,
    ],
    requiredRole: ['owner'],
    extractors: {
      memberName: /(\w+)(?:'s)?\s+payment|has\s+(\w+)\s+paid|did\s+(\w+)\s+pay|check\s+(\w+)/i,
    },
  },
  {
    intent: 'owner_active_members_today',
    patterns: [
      /how\s+many\s+active\s+members?\s+today/i,
      /today('s)?\s+attendance/i,
    ],
    requiredRole: ['owner'],
  },
  {
    intent: 'owner_checked_in_today',
    patterns: [
      /who\s+checked\s+in\s+today/i,
      /members?\s+who\s+came\s+today/i,
      /who\s+came\s+in\s+today/i,
      /list\s+of\s+members?\s+today/i,
    ],
    requiredRole: ['owner'],
  },
  {
    intent: 'owner_not_checked_in_today',
    patterns: [
      /who\s+did\s+not\s+check\s+in\s+today/i,
      /who\s+has\s+not\s+checked\s+in/i,
      /members?\s+who\s+did\s+not\s+come/i,
      /absent\s+members?\s+today/i,
      /who\s+is\s+absent/i,
    ],
    requiredRole: ['owner'],
  },
  {
    intent: 'owner_active_memberships',
    patterns: [
      /active\s+memberships?(\s+count)?/i,
      /how\s+many\s+memberships?\s+active/i,
      /total\s+active\s+memberships?/i,
    ],
    requiredRole: ['owner'],
  },
  {
    intent: 'owner_expiring_memberships',
    patterns: [
      /expiring\s+memberships?/i,
      /memberships?\s+expiring/i,
      /expiring\s+(this|next)\s+month/i,
      /who\s+is\s+expiring/i,
    ],
    requiredRole: ['owner'],
    extractors: {
      month: /(this|next)\s+month/i,
    },
  },
];

const ADVICE_PATTERNS = [
  /what\s+(workout|exercise)\s+should\s+i/i,
  /should\s+i\s+(rest|train|exercise|lift|workout)/i,
  /how\s+much\s+(weight|should\s+i\s+lift)/i,
  /is\s+.+\s+overtraining/i,
  /give\s+me\s+a?\s*(diet|meal|nutrition)\s+plan/i,
  /recommend\s+(a\s+)?(workout|exercise|diet)/i,
  /what\s+should\s+i\s+eat/i,
  /am\s+i\s+(overtraining|doing\s+enough)/i,
];

export function isAdviceQuestion(message: string): boolean {
  const normalized = normalizeMessage(message);
  return ADVICE_PATTERNS.some(pattern => pattern.test(normalized));
}

export function classifyIntent(message: string, role: UserRole): IntentResult {
  const normalized = normalizeMessage(message);
  const responseMode = detectResponseMode(message);
  
  const ambiguity = checkAmbiguity(message);
  if (ambiguity.isAmbiguous) {
    return {
      intent: 'ambiguous',
      confidence: 'low',
      responseMode,
      ambiguityType: ambiguity.type,
      clarificationQuestion: ambiguity.clarification,
      extractedEntities: {},
    };
  }
  
  for (const intentPattern of intentPatterns) {
    if (!intentPattern.requiredRole.includes(role)) {
      continue;
    }
    
    for (const pattern of intentPattern.patterns) {
      if (pattern.test(normalized)) {
        const extractedEntities: IntentResult['extractedEntities'] = {};
        
        if (intentPattern.extractors?.memberName) {
          const match = message.match(intentPattern.extractors.memberName);
          if (match) {
            extractedEntities.memberName = match[1] || match[2] || match[3] || match[4];
          }
        }
        
        if (intentPattern.extractors?.date) {
          const match = message.match(intentPattern.extractors.date);
          if (match) {
            extractedEntities.date = match[1];
          }
        }
        
        if (intentPattern.extractors?.month) {
          const match = message.match(intentPattern.extractors.month);
          if (match) {
            extractedEntities.month = match[1];
          }
        }
        
        return {
          intent: intentPattern.intent,
          confidence: 'high',
          responseMode,
          extractedEntities,
        };
      }
    }
  }
  
  return {
    intent: 'unknown',
    confidence: 'low',
    responseMode,
    extractedEntities: {},
  };
}

export function getRefusalMessage(): string {
  return "That question requires judgment, which Dika doesn't do. I can show attendance, workouts, or payments.";
}

export function getUnknownIntentMessage(): string {
  return "I can help with workout history, attendance, and payments. Try asking something like 'What did I train this week?' or 'How many workouts did I do this month?'";
}
