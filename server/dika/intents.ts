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
  | 'unknown';

export type UserRole = 'member' | 'trainer' | 'owner';

export interface IntentResult {
  intent: DikaIntent;
  confidence: 'high' | 'low';
  extractedEntities: {
    memberName?: string;
    date?: string;
    dateRange?: { start: string; end: string };
  };
}

interface IntentPattern {
  intent: DikaIntent;
  patterns: RegExp[];
  requiredRole: UserRole[];
  extractors?: {
    memberName?: RegExp;
    date?: RegExp;
  };
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
      /active\s+members?\s+today/i,
      /who\s+checked\s+in\s+today/i,
      /today('s)?\s+attendance/i,
      /members?\s+who\s+came\s+today/i,
    ],
    requiredRole: ['owner'],
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
  return ADVICE_PATTERNS.some(pattern => pattern.test(message));
}

export function classifyIntent(message: string, role: UserRole): IntentResult {
  const normalizedMessage = message.toLowerCase().trim();
  
  for (const intentPattern of intentPatterns) {
    if (!intentPattern.requiredRole.includes(role)) {
      continue;
    }
    
    for (const pattern of intentPattern.patterns) {
      if (pattern.test(normalizedMessage)) {
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
        
        return {
          intent: intentPattern.intent,
          confidence: 'high',
          extractedEntities,
        };
      }
    }
  }
  
  return {
    intent: 'unknown',
    confidence: 'low',
    extractedEntities: {},
  };
}

export function getRefusalMessage(): string {
  return "I can't give training or medical advice. I can help with workout history, attendance, and payments.";
}

export function getUnknownIntentMessage(): string {
  return "I can help with workout history, attendance, and payments. Try asking something like 'What did I train this week?' or 'How many workouts did I do this month?'";
}
