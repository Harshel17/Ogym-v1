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

## Recent Changes

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
- `users` - All user types (owner/trainer/member) with gym association
- `trainer_members` - Many-to-many relationship for trainer assignments
- `attendance` - Daily attendance records with `verifiedMethod` (qr/workout/both/manual)
- `payments` - Monthly payment tracking
- `workout_cycles` - Training programs with date range and `isActive` flag
- `workout_items` - Individual exercises with `exerciseName`, `orderIndex`, day of week
- `workout_completions` - Records of completed exercises per member

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
