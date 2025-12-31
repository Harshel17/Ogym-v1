import { z } from 'zod';
import { 
  insertUserSchema, 
  insertGymSchema, 
  insertAttendanceSchema, 
  insertPaymentSchema,
  insertWorkoutCycleSchema,
  insertWorkoutSchema,
  insertWorkoutCompletionSchema,
  users, 
  gyms, 
  attendance, 
  payments,
  trainerMembers,
  workoutCycles,
  workouts,
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
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: insertUserSchema.extend({
        gymName: z.string().optional(), // For owners creating a gym
        gymCode: z.string().optional(), // For members/trainers joining
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
  },
  attendance: {
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      input: z.object({
        memberId: z.coerce.number().optional(),
        date: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof attendance.$inferSelect & { member: typeof users.$inferSelect }>()),
      },
    },
    mark: {
      method: 'POST' as const,
      path: '/api/attendance',
      input: insertAttendanceSchema.omit({ gymId: true, markedByUserId: true }), // Backend infers these
      responses: {
        201: z.custom<typeof attendance.$inferSelect>(),
      },
    },
  },
  payments: {
    list: {
      method: 'GET' as const,
      path: '/api/payments',
      input: z.object({
        memberId: z.coerce.number().optional(),
        month: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof payments.$inferSelect & { member: typeof users.$inferSelect }>()),
      },
    },
    mark: {
      method: 'POST' as const,
      path: '/api/payments',
      input: insertPaymentSchema.omit({ gymId: true, updatedByUserId: true }), // Backend infers these
      responses: {
        201: z.custom<typeof payments.$inferSelect>(),
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
