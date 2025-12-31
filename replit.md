# OGym V1 - Multi-Gym Management Platform

## Overview

OGym is a multi-tenant B2B web application for gym management with role-based access control. The platform enables gym owners, trainers, and members to manage attendance tracking, payment tracking, and workout cycles. Multi-tenant safety is enforced at the backend level where all data is isolated by `gym_id`.

**Core Features:**
- Role-based access: Owner, Trainer, Member
- Attendance tracking with daily check-ins
- Payment tracking (not payment processing)
- Workout cycle management for trainers
- Gym code-based membership joining system

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
- `attendance` - Daily attendance records
- `payments` - Monthly payment tracking
- `workout_cycles`, `workouts`, `workout_completions` - Workout management

### Multi-Tenancy Pattern
All queries filter by `gym_id` extracted from the authenticated user's session. The backend enforces tenant isolation - the UI does not control data access boundaries.

### Build System
- **Development:** `tsx` for TypeScript execution with Vite dev server
- **Production Build:** Custom `script/build.ts` using esbuild for server + Vite for client
- **Output:** `dist/` directory with `index.cjs` (server) and `public/` (client assets)

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