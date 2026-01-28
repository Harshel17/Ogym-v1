# OGym V1 - Multi-Gym Management Platform

## Overview

OGym is a multi-tenant B2B web application for gym management, offering role-based access for gym owners, trainers, and members. It facilitates attendance tracking (QR code & auto), multi-currency payment and subscription management, and comprehensive workout cycle organization. The platform also includes member statistics, a gym code-based joining system, "Star Members" tracking with diet plans, gym transfer requests, and an admin panel for platform oversight. A mobile application is available for all user roles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework:** React 18 with TypeScript and Vite.
- **UI Components:** shadcn/ui built on Radix UI primitives.
- **Styling:** Tailwind CSS with CSS variables for theming (Indigo/Slate).
- **Chart Visualization:** Recharts for dashboards.
- **Mobile Application:** Capacitor (wraps web app for iOS/Android).
- **Responsive Design:** Mobile-first approach with `md:` breakpoint for tablets/desktop. Layout patterns include responsive grids, stacked-to-inline elements, content truncation, and a responsive typography scale.
- **QR Code Generation:** Client-side via `qrcode.react`.
- **Mobile Navigation:** Fixed bottom navigation bar with content padding.

### Technical Implementations
- **Backend:** Express.js with TypeScript.
- **Authentication:** Passport.js (Local Strategy, session-based with PostgreSQL store) for gym users; JWT for Admin.
- **State Management (Frontend):** TanStack React Query.
- **Form Handling:** React Hook Form with Zod validation.
- **API Design:** RESTful with shared Zod schemas for type-safe communication.
- **Database ORM:** Drizzle ORM with PostgreSQL.
- **Multi-Tenancy:** Enforced via `gym_id` filtering in all backend queries.
- **Build System:** `tsx` for development, `esbuild` and Vite for production.
- **Attendance:** QR-based check-in, auto-attendance, and analytics.
- **Payment & Subscriptions:** Multi-currency (INR/USD) plans, transaction tracking, amounts stored in smallest unit.
- **Workout Management:** Creation, assignment, exercise tracking, progress monitoring.
- **User Management:** Profiles, gym joining, role-based access.
- **Admin System:** Separate interface for managing gyms and platform subscriptions.
- **Announcements:** Owner-to-member/trainer communication.
- **Trainer-Member Relationship:** Historical assignment tracking.
- **Star Members & Diet Plans:** Trainer-managed top performers with custom diet plans.
- **Social Feed:** Activity feed with workout completions, milestones, reactions, and comments.
- **Tournaments:** Monthly gym challenges with leaderboards.
- **Daily Points:** Dynamically computed from workout completions.
- **Walk-in Visitors:** Tracking for day passes, trials, and inquiries, including self check-in kiosk functionality.
- **Personal Mode:** Members can use the app without joining a gym for self-managed workout tracking. Personal workouts use `source='self'` in `workout_cycles`, while gym-assigned workouts use `source='trainer'`. Data isolation is enforced via source filtering in storage queries. Personal Mode users now have optional onboarding to enter body measurements (height/weight), which can be skipped. Body measurements for Personal Mode users are stored with `gymId=null` and queried using `isNull` conditions.
- **AI Import Workouts:** Personal Mode and Self-Guided users can import workouts from AI assistants (ChatGPT, etc.) via paste or screenshot. Uses regex-based parser (`server/ai-workout-parser.ts`) with ~120 exercise-to-muscle mappings. 3-step wizard (instructions, preview/edit, settings) in `client/src/components/ai-import-wizard.tsx`. Format: pipe-separated (`CYCLE: Name`, `DAY 1: Label`, `- Exercise | Sets | Reps | Rest`). Parser handles DAY/Workout/Session/weekday patterns. Endpoint: `POST /api/personal/workout/parse-import` with 15k char limit, safeParse validation. Screenshot import uses Tesseract.js for client-side OCR with progress indicator and recommendation to copy-paste for better results. Zero AI cost - purely regex parsing and client-side OCR.
- **Training Mode:** Gym members can be set to "Trainer-Led" (default, trainer manages workouts) or "Self-Guided" (member manages own workouts). Owners control the training mode when assigning trainers via Members page. Self-guided members get the same workout creation experience as Personal Mode (wizard with questions + AI suggestions, or create from scratch). They remain in the gym for attendance and payment tracking. Training mode is stored in `users.training_mode` column.
- **Dika Assistant:** AI-powered Q&A assistant that answers factual questions about workouts, attendance, and payments. Uses pattern-based intent classification with 10 predefined intents across member/trainer/owner roles. Read-only system (no advice/recommendations) with session-only context memory (3-5 turns). Frontend includes floating draggable button with icon picker (circle/sunflower/bat) and chat drawer UI with suggestion chips. User settings stored in `hide_dika` and `dika_icon_preference` columns in users table. Located at `server/dika/` (backend) and `client/src/components/dika/` (frontend).
- **Production Security:** Helmet.js, secure session cookies, rate limiting, request body limits, session cleanup.
- **Database Indexing:** Optimized for common queries (attendance, workout completions, payments, feed posts).
- **Deployment:** Same-origin deployment via Express serving API and static frontend.

## Pending Production Migrations

Before deploying new code to Render, run these SQL commands on the **production database**:

### Since commit a63c0aa (Jan 26, 2026)
```sql
-- Allow Personal Mode users to store body measurements without gym
ALTER TABLE body_measurements ALTER COLUMN gym_id DROP NOT NULL;
```

### Since commit 10616631 (Jan 28, 2026)
```sql
-- Allow Personal Mode users to log workouts without gym
ALTER TABLE workout_logs ALTER COLUMN gym_id DROP NOT NULL;
```

**Note:** AI Import Workouts feature has NO schema changes - uses existing tables.

---

## External Dependencies

- **PostgreSQL:** Primary database.
- **Resend:** Transactional email service for OTP verification.
- **Helmet.js:** Security headers middleware.
- **Drizzle ORM:** Database interaction and schema management.
- **Passport.js:** Authentication middleware.
- **express-session & connect-pg-simple:** Session management.
- **@tanstack/react-query:** Frontend server state management.
- **Radix UI:** UI primitives.
- **Recharts:** Data visualization.
- **date-fns:** Date utility library.
- **Wouter:** Client-side routing.
- **Vite:** Frontend build tool.
- **TypeScript:** Language.
- **Tailwind CSS:** Styling framework.
- **Zod:** Schema validation library.
- **Capacitor Plugins:**
    - `@capacitor/camera`
    - `@capacitor/push-notifications`
    - `@capacitor/splash-screen`
    - `@capacitor/status-bar`
    - `@capacitor/keyboard`
    - `@capacitor/haptics`
    - `@capacitor/app`
    - `@capacitor/browser`