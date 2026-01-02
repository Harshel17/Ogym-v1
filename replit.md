# OGym V1 - Multi-Gym Management Platform

## Overview

OGym is a multi-tenant B2B web application for gym management with role-based access control. The platform enables gym owners, trainers, and members to manage attendance tracking, payment tracking, and workout cycles. Multi-tenant safety is enforced at the backend level where all data is isolated by `gym_id`.

**Core Features:**
- Role-based access: Owner, Trainer, Member
- QR code-based attendance with permanent gym code
- Auto-attendance on workout completion (dual verification)
- Payment tracking (not payment processing)
- Workout cycle management with exercises ordered by day
- Member stats (streak, total workouts, last 7 days)
- Trainer activity feed showing member progress
- Gym code-based membership joining system
- User profiles with publicId, email, phone
- Star Members feature for trainers to track top performers
- Diet plans for star members with meal tracking
- Gym transfer requests with dual-owner approval workflow
- Gym history tracking for member transfers

## Recent Changes

**January 2026:**
- **Upgraded Payments to INR-based Membership Tracking System**
  - New tables: `membership_plans`, `member_subscriptions`, `payment_transactions`
  - Amounts stored in paise (100 paise = 1 rupee) for financial precision
  - Subscription statuses: active, endingSoon (7 days before expiry), overdue, ended
  - Payment modes: full, partial, emi | Methods: cash, upi, card, bank, other
  - New Owner endpoints: GET/POST /api/owner/membership-plans, GET/POST /api/owner/subscriptions, POST /api/owner/subscriptions/:id/payments, GET /api/owner/subscription-alerts
  - New Member endpoint: GET /api/member/subscription (read-only view)
  - Completely rewritten Payments UI with Plans tab and Subscriptions tab
  - Payment ledger view per subscription with transaction history
  - Security: memberId derived server-side from verified subscription
- Added Owner Dashboard Analytics with new metrics (checked-in today/yesterday, new enrollments)
  - Clickable "Checked-in Today" card navigates to Attendance Analytics page
  - New endpoint: GET /api/owner/dashboard-metrics
- Added Owner Attendance Analytics page with date filtering and trend visualization
  - New endpoints: GET /api/owner/attendance/summary, /day, /trend
  - Date picker, summary cards, 14-day line chart, checked-in/absent member lists
- Added Owner access to detailed member stats (profile, workout history, progress, PRs)
  - New endpoints: GET /api/owner/members/:memberId/profile, /workouts, /workouts/:date, /stats
  - Reuses trainer star member logic without star member requirement
- Added Announcements module for owner-to-member/trainer communication
  - New tables: announcements, announcement_reads, user_notification_preferences
  - New endpoints: POST/GET/DELETE /api/owner/announcements, GET /api/announcements, POST /api/announcements/:id/read
  - Audience targeting: members, trainers, or everyone
  - Auto-read tracking on view
- Added Star Member Detail page for trainers with full workout history and stats
  - New endpoints: GET /api/trainer/star-members/:memberId, /workouts, /workouts/:date, /stats
  - Clickable starred member cards navigate to detail page
  - Workouts tab: session list with date-based grouping, modal for exercise details
  - Stats tab: streak, weekly/monthly metrics, volume progression, muscle breakdown, PRs
  - 3-level access control: assigned, starred, same gym

**January 2025:**
- Added user profile system with auto-generated publicId (OWN/TRN/MEM prefix + 5-char suffix)
- Added email and phone fields to user profiles
- Added gym history table to track member gym transfers
- Added Star Members feature - trainers can mark top performers for full stats access
- Added Diet Plans system - trainers can create meal plans for star members only
- Added Gym Transfer Requests with dual-owner approval workflow
- Added soft delete for workout cycles (sets isActive=false)
- Removed Payments tab from Trainer sidebar (trainers don't handle payments)
- Added 5 new frontend pages: Profile, Star Members, Diet Plans, My Diet Plan, Transfers

**December 2024:**
- Added QR code attendance system with `verifiedMethod` field (qr, workout, both, manual)
- Added auto-attendance when members complete workouts
- Added trainer activity feed showing member workout completions
- Added member stats endpoint (streak, total workouts, last 7 days)
- Renamed `workouts` table to `workout_items` with `exerciseName` and `orderIndex` fields
- Added `isActive` field to workout_cycles for active cycle tracking
- Updated frontend to use new workout completion and stats APIs

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript, bundled via Vite
- **Routing:** Wouter for client-side navigation
- **State Management:** TanStack React Query for server state, with session-based auth (credentials: "include")
- **UI Components:** shadcn/ui component library built on Radix UI primitives
- **Styling:** Tailwind CSS with CSS variables for theming (Indigo/Slate color scheme)
- **Forms:** React Hook Form with Zod validation via @hookform/resolvers
- **Charts:** Recharts for dashboard data visualization

The frontend uses a protected route pattern where unauthenticated users are redirected to `/auth`. Role-based UI visibility is implemented in the Layout component, showing different navigation items based on user role.

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **Authentication:** Passport.js with Local Strategy, session-based auth stored in PostgreSQL via connect-pg-simple
- **Password Hashing:** Node crypto scrypt with timing-safe comparison
- **API Design:** RESTful endpoints with Zod schema validation shared between client and server via `@shared/routes.ts`

The API contract is defined in `shared/routes.ts` with typed input/output schemas. This enables type-safe API calls and consistent validation on both ends.

### Database Layer
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema Location:** `shared/schema.ts` - defines all tables with relations
- **Migrations:** Drizzle Kit with `db:push` command for schema synchronization
- **Session Store:** PostgreSQL-backed session storage via connect-pg-simple

**Key Tables:**
- `gyms` - Gym entities with unique join codes
- `users` - All user types (owner/trainer/member) with gym association, publicId, email, phone
- `trainer_members` - Many-to-many relationship for trainer assignments
- `attendance` - Daily attendance records with `verifiedMethod` (qr/workout/both/manual)
- `payments` - Monthly payment tracking (legacy)
- `membership_plans` - Subscription pricing tiers with duration and amount in paise
- `member_subscriptions` - Member subscription records with status, dates, payment mode
- `payment_transactions` - Payment ledger entries for each subscription
- `workout_cycles` - Training programs with date range and `isActive` flag
- `workout_items` - Individual exercises with `exerciseName`, `orderIndex`, day of week
- `workout_completions` - Records of completed exercises per member
- `gym_history` - Tracks member/trainer join and leave dates per gym
- `star_members` - Trainer's favorite members with full stats access
- `diet_plans` - Meal plans created by trainers for star members
- `diet_plan_meals` - Individual meals within diet plans
- `transfer_requests` - Gym transfer requests with dual-owner approval
- `announcements` - Owner announcements with audience targeting (members/trainers/everyone)
- `announcement_reads` - Tracks which users have read which announcements
- `user_notification_preferences` - User email/SMS notification preferences

### Multi-Tenancy Pattern
All queries filter by `gym_id` extracted from the authenticated user's session. The backend enforces tenant isolation - the UI does not control data access boundaries.

### Key API Endpoints

**Authentication:**
- `POST /api/auth/register-owner` - Create gym owner with new gym
- `POST /api/auth/register-join` - Join existing gym as trainer/member
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

**Attendance:**
- `POST /api/attendance/checkin` - QR-based check-in with gym code
- `GET /api/attendance/my` - Member's attendance history
- `GET /api/attendance/gym` - All gym attendance (owner only)

**Workouts:**
- `GET /api/workouts/today` - Today's exercises with completion status
- `POST /api/workouts/complete` - Mark exercise complete (auto-marks attendance)
- `GET /api/workouts/stats/my` - Member stats (streak, total, last 7 days)
- `POST /api/trainer/cycles` - Create workout cycle
- `POST /api/trainer/cycles/:cycleId/items` - Add exercise to cycle
- `GET /api/trainer/activity` - Trainer's member activity feed

### Build System
- **Development:** `tsx` for TypeScript execution with Vite dev server
- **Production Build:** Custom `script/build.ts` using esbuild for server + Vite for client
- **Output:** `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## Demo Data

Gym Code: **DEMO01**

Test accounts:
- `owner` / `password123` - Gym owner
- `trainer` / `password123` - Trainer
- `member1` / `password123` - Member (has workout cycle assigned)
- `member2` / `password123` - Member

## External Dependencies

### Database
- **PostgreSQL** - Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM** - Type-safe database queries and schema management

### Authentication & Sessions
- **Passport.js** - Authentication middleware with Local Strategy
- **express-session** - Session management
- **connect-pg-simple** - PostgreSQL session store

### Frontend Libraries
- **@tanstack/react-query** - Server state management and caching
- **Radix UI** - Accessible UI primitives (dialog, select, tabs, etc.)
- **recharts** - Dashboard charts and data visualization
- **date-fns** - Date formatting and manipulation
- **wouter** - Lightweight routing

### Development Tools
- **Vite** - Frontend build tool with HMR
- **TypeScript** - Type safety across full stack
- **Tailwind CSS** - Utility-first styling
- **Zod** - Runtime schema validation shared between client/server

## Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally or via Docker

### Database Setup (Local)

**Option 1: Local PostgreSQL**
```bash
# Create database
psql -U postgres -c "CREATE DATABASE ogym;"
```

**Option 2: Docker**
```bash
docker run --name ogym-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ogym -p 5432:5432 -d postgres:14
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://postgres:password@localhost:5432/ogym`)
- `SESSION_SECRET` - Secure random string for session encryption

### Running Locally

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

### Seed Demo Data

To create demo users and gym, you can use the registration flow or run SQL:
```sql
-- After running db:push, the tables will be created
-- Register via the app UI at /auth
```

### Production Build

```bash
npm run build
npm run start
```

## Notes on Legacy Code

The `/backend` folder contains a legacy Python/FastAPI implementation that is **NOT currently in use**. The active backend is the Express.js server in `/server`. The Python code is preserved for reference but can be safely ignored or removed.
