import { z } from 'zod';
import { 
  insertUserSchema, 
  insertGymSchema, 
  insertAttendanceSchema, 
  insertPaymentSchema,
  insertWorkoutCycleSchema,
  insertWorkoutItemSchema,
  insertWorkoutCompletionSchema,
  users, 
  gyms, 
  attendance, 
  payments,
  trainerMembers,
  workoutCycles,
  workoutItems,
  workoutCompletions
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  auth: {
    registerOwner: {
      method: 'POST' as const,
      path: '/api/auth/register-owner',
      input: z.object({
        username: z.string().min(1),
        password: z.string().min(6),
        gymName: z.string().min(1),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    registerJoin: {
      method: 'POST' as const,
      path: '/api/auth/register-join',
      input: z.object({
        username: z.string().min(1),
        password: z.string().min(6),
        gymCode: z.string().min(1),
        role: z.enum(['trainer', 'member']),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.custom<typeof users.$inferSelect & { gym: typeof gyms.$inferSelect }>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  owner: {
    getMembers: {
      method: 'GET' as const,
      path: '/api/owner/members',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    getTrainers: {
      method: 'GET' as const,
      path: '/api/owner/trainers',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    assignTrainer: {
      method: 'POST' as const,
      path: '/api/owner/assign-trainer',
      input: z.object({
        trainerId: z.number(),
        memberId: z.number(),
      }),
      responses: {
        201: z.custom<typeof trainerMembers.$inferSelect>(),
      },
    },
    getAssignments: {
      method: 'GET' as const,
      path: '/api/owner/assignments',
      responses: {
        200: z.array(z.custom<typeof trainerMembers.$inferSelect>()),
      },
    },
    getQRData: {
      method: 'GET' as const,
      path: '/api/owner/qr-data',
      responses: {
        200: z.object({
          type: z.string(),
          gym_code: z.string(),
        }),
      },
    },
  },
  attendance: {
    checkin: {
      method: 'POST' as const,
      path: '/api/attendance/checkin',
      input: z.object({
        gym_code: z.string(),
      }),
      responses: {
        201: z.custom<typeof attendance.$inferSelect>(),
        200: z.custom<typeof attendance.$inferSelect>(),
      },
    },
    my: {
      method: 'GET' as const,
      path: '/api/attendance/my',
      responses: {
        200: z.array(z.custom<typeof attendance.$inferSelect>()),
      },
    },
    gym: {
      method: 'GET' as const,
      path: '/api/attendance/gym',
      responses: {
        200: z.array(z.custom<typeof attendance.$inferSelect & { member: typeof users.$inferSelect }>()),
      },
    },
  },
  payments: {
    my: {
      method: 'GET' as const,
      path: '/api/payments/my',
      responses: {
        200: z.array(z.custom<typeof payments.$inferSelect>()),
      },
    },
    gym: {
      method: 'GET' as const,
      path: '/api/payments/gym',
      responses: {
        200: z.array(z.custom<typeof payments.$inferSelect & { member: typeof users.$inferSelect }>()),
      },
    },
    mark: {
      method: 'POST' as const,
      path: '/api/payments/mark',
      input: z.object({
        memberId: z.number(),
        month: z.string(),
        amountDue: z.number(),
        amountPaid: z.number(),
        status: z.enum(['paid', 'unpaid', 'partial']),
        note: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof payments.$inferSelect>(),
      },
    },
  },
  trainer: {
    getMembers: {
      method: 'GET' as const,
      path: '/api/trainer/members',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    getCycles: {
      method: 'GET' as const,
      path: '/api/trainer/cycles',
      responses: {
        200: z.array(z.custom<typeof workoutCycles.$inferSelect>()),
      },
    },
    createCycle: {
      method: 'POST' as const,
      path: '/api/trainer/cycles',
      input: z.object({
        memberId: z.number(),
        name: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      }),
      responses: {
        201: z.custom<typeof workoutCycles.$inferSelect>(),
      },
    },
    addWorkoutItem: {
      method: 'POST' as const,
      path: '/api/trainer/cycles/:cycleId/items',
      input: z.object({
        dayOfWeek: z.number().min(0).max(6),
        exerciseName: z.string(),
        sets: z.number().min(1),
        reps: z.number().min(1),
        weight: z.string().optional(),
        orderIndex: z.number().default(0),
      }),
      responses: {
        201: z.custom<typeof workoutItems.$inferSelect>(),
      },
    },
    getActivity: {
      method: 'GET' as const,
      path: '/api/trainer/activity',
      responses: {
        200: z.array(z.object({
          type: z.string(),
          memberName: z.string(),
          memberId: z.number(),
          exerciseName: z.string(),
          date: z.string(),
          createdAt: z.date().nullable(),
        })),
      },
    },
  },
  member: {
    getCycle: {
      method: 'GET' as const,
      path: '/api/workouts/cycles/my',
      responses: {
        200: z.object({
          id: z.number(),
          name: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          items: z.array(z.custom<typeof workoutItems.$inferSelect>()),
        }).nullable(),
      },
    },
    getToday: {
      method: 'GET' as const,
      path: '/api/workouts/today',
      responses: {
        200: z.object({
          cycleName: z.string().optional(),
          dayOfWeek: z.number(),
          items: z.array(z.custom<typeof workoutItems.$inferSelect & { completed: boolean }>()),
          message: z.string().optional(),
        }),
      },
    },
    completeWorkout: {
      method: 'POST' as const,
      path: '/api/workouts/complete',
      input: z.object({
        workoutItemId: z.number(),
      }),
      responses: {
        201: z.custom<typeof workoutCompletions.$inferSelect>(),
        200: z.object({ message: z.string(), id: z.number() }),
      },
    },
    getHistory: {
      method: 'GET' as const,
      path: '/api/workouts/history/my',
      responses: {
        200: z.array(z.custom<typeof workoutCompletions.$inferSelect>()),
      },
    },
    getStats: {
      method: 'GET' as const,
      path: '/api/workouts/stats/my',
      responses: {
        200: z.object({
          streak: z.number(),
          totalWorkouts: z.number(),
          last7Days: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
