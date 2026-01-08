# OGym V1 - Multi-Gym Management Platform

**Status: V1 FROZEN - Ready for Demo & Deployment**

## Overview

OGym is a multi-tenant B2B web application designed for gym management. It provides role-based access for gym owners, trainers, and members to manage attendance, track payments, and organize workout cycles. The platform ensures data isolation by `gym_id` for multi-tenant safety.

**Key Capabilities:**
- Role-based access: Owner, Trainer, Member.
- QR code-based and auto-attendance tracking.
- Payment tracking (not processing) with INR-based subscription management.
- Comprehensive workout cycle management with exercise ordering.
- Member statistics (streak, total workouts, etc.) and trainer activity feeds.
- Gym code-based membership joining system.
- User profiles with `publicId`, email, and phone.
- "Star Members" feature for trainers to track and manage top performers, including diet plans.
- Gym transfer requests with dual-owner approval.
- Admin panel for platform subscription management and overall system oversight.
- Mobile application for all user roles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework:** React 18 with TypeScript and Vite.
- **UI Components:** shadcn/ui built on Radix UI primitives.
- **Styling:** Tailwind CSS with CSS variables for theming (Indigo/Slate).
- **Chart Visualization:** Recharts for dashboards.
- **Mobile Application:** React Native + Expo with role-based navigation.

### Technical Implementations
- **Backend:** Express.js with TypeScript.
- **Authentication:** Passport.js with Local Strategy and session-based auth stored in PostgreSQL. Separate JWT authentication for Admin system.
- **State Management (Frontend):** TanStack React Query for server state.
- **Form Handling:** React Hook Form with Zod validation.
- **API Design:** RESTful with shared Zod schemas for type-safe client-server communication.
- **Database ORM:** Drizzle ORM with PostgreSQL.
- **Multi-Tenancy:** All backend queries are filtered by `gym_id` from the authenticated user's session, enforcing tenant isolation.
- **Build System:** `tsx` for development, `esbuild` and Vite for production builds.

### Feature Specifications
- **Attendance:** QR-based check-in, auto-attendance on workout completion, and detailed attendance analytics for owners.
- **Payment & Subscriptions:** INR-based membership plans, member subscriptions, and payment transaction tracking. Amounts stored in paise for precision.
- **Workout Management:** Creation and assignment of workout cycles, tracking of completed exercises, and member progress monitoring.
- **User Management:** User profiles, gym membership joining, and role-based access control.
- **Admin System:** Separate authenticated admin interface for managing gym requests, gyms, and platform subscriptions.
- **Announcements:** Owner-to-member/trainer communication module with audience targeting and read tracking.
- **Trainer-Member Relationship:** `trainer_member_assignments` table for historical tracking of assignments, preserving workout data on transfers.
- **Star Members & Diet Plans:** Trainers can mark star members, access their full stats, and create diet plans for them.
- **Social Feed:** Activity feed with workout completions, streak milestones, achievements, reactions, and comments.
- **Tournaments:** Monthly gym challenges with leaderboards and participant tracking.
- **Daily Points:** Computed dynamically from workout completions (planned vs completed exercises).

## Demo Seeding

The project includes comprehensive demo data seeding that generates 8 months of realistic activity:

**Demo Gyms:**
- IronForge Fitness (Hyderabad) - Gym code: IRONFORGE
- PulseArena Gym (Bengaluru) - Gym code: PULSEARENA

**Demo Data Scope:**
- 2 gyms with 4-5 trainers and 60-80 members each
- 87,000+ workout completions across 8 months
- 3,300+ body measurements with progression trends
- 800+ social feed posts with 4,000+ reactions
- 14 tournaments with 540+ participants
- 6 transfer requests (3 each direction between gyms)
- 8 cross-gym join requests
- 39 announcements with read tracking
- Diet plans for star members

**Commands:**
```bash
npx tsx server/run-seed.ts        # Run demo seed
npx tsx server/run-seed.ts --reset  # Reset and reseed demo data
```

**All demo accounts use password:** `demo123`

## Email Integration

**Resend Integration** (connection:conn_resend_01KED8ZB2Z1KAHGC4G9C3WC6PE)
- Real email OTP verification for account creation and password reset
- Uses Replit Connectors for secure API key management
- Falls back to console logging if Resend is not configured
- Email templates in `server/email.ts`

**OTP Flow:**
1. User registers → 6-digit OTP sent to email
2. User enters OTP on verification page
3. OTP expires in 10 minutes
4. Rate-limited resend available
5. Unverified users cannot log in

**Development Mode - Email Bypass:**
Set `DISABLE_EMAIL_VERIFICATION=true` in development environment to:
- Auto-verify new users on registration (no OTP required)
- Skip OTP email sending
- Allow login without email verification

**WARNING:** This must be disabled (`false` or removed) for production!

## Production Deployment (Railway/Render)

**Production Readiness: ~8/10**

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `SESSION_SECRET` | **Yes (prod)** | 32+ char random string for session encryption. Server will NOT start without this in production. |
| `NODE_ENV` | **Yes** | Set to `production` |
| `PORT` | Optional | Defaults to 5000 |
| `ADMIN_USERNAME` | Recommended | Admin panel username |
| `ADMIN_PASSWORD` | Recommended | Admin panel password |
| `RESEND_API_KEY` | Recommended | For email OTP verification |

### Security Features (Production)
- **Helmet.js:** All security headers enabled (CSP without unsafe-eval, HSTS, X-Frame-Options, etc.)
- **Session cookies:** `sameSite: "lax"`, `secure: true`, `httpOnly: true`
- **Rate limiting:** Auth endpoints (10 req/15min), All mutations (60 req/min)
- **Request body limits:** 1MB max for JSON and form data
- **Session cleanup:** Expired sessions automatically pruned every 15 minutes
- **No demo seeding:** Production startup does NOT seed demo data

### Database Indexes (Performance)
The following indexes are configured for optimal query performance at scale:
- `attendance(gym_id, date)` - Daily attendance lookups
- `attendance(member_id, date)` - Member attendance history
- `workout_completions(member_id, completed_date)` - Member workout history
- `workout_completions(gym_id, completed_date)` - Gym workout analytics
- `payments(gym_id, updated_at)` - Payment history
- `feed_posts(gym_id, created_at)` - Social feed queries

### Railway Deployment Commands

```bash
# 1. Railway Build Command (set in Railway dashboard):
npm run build

# 2. Railway Start Command:
npm run start

# 3. After first deploy, run ONE-TIME via Railway shell:
npx tsx server/run-seed.ts --admin-only
```

**Index Creation:** Indexes are defined in `shared/schema.ts` and created automatically by Drizzle ORM when using `npm run db:push`. For fresh databases on Railway:

```bash
# Option A: Use Drizzle push (recommended for Railway)
npm run db:push

# Option B: Apply migration SQL directly
psql $DATABASE_URL -f migrations/0001_add_performance_indexes.sql
```

### Architecture Notes
- **Same-origin deployment:** Express serves both API and Vite-built frontend
- **No CORS needed:** Frontend and backend share the same origin
- **WebView compatible:** Works correctly inside Capacitor/iOS/Android WebViews

## External Dependencies

- **PostgreSQL:** Primary database.
- **Helmet.js:** Security headers middleware.
- **Resend:** Transactional email service for OTP verification.
- **Drizzle ORM:** For database interaction and schema management.
- **Passport.js:** Authentication middleware.
- **express-session & connect-pg-simple:** Session management and PostgreSQL session store.
- **@tanstack/react-query:** Frontend server state management.
- **Radix UI:** UI primitives.
- **Recharts:** Data visualization.
- **date-fns:** Date utility library.
- **Wouter:** Lightweight client-side routing.
- **Vite:** Frontend build tool.
- **TypeScript:** Language.
- **Tailwind CSS:** Styling framework.
- **Zod:** Schema validation library.