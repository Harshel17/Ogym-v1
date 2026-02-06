# OGym V1 - Multi-Gym Management Platform

## Overview

OGym is a multi-tenant B2B web application designed for comprehensive gym management. It offers role-based access for gym owners, trainers, and members, streamlining operations such as attendance tracking (QR code & auto), multi-currency payment and subscription management, and detailed workout cycle organization. Key features include member statistics, a gym code-based joining system, "Star Members" tracking with diet plans, gym transfer requests, and an administrative panel for platform oversight. The platform also provides a dedicated mobile application for all user roles, enhancing accessibility and user experience. Recent enhancements include "Personal Mode" for self-managed fitness, an AI-powered workout importer, "Training Mode" for flexible workout management, calorie analytics, an "Enhanced Nutrition Page" with flexible meal logging, a "Find My Food" feature for healthy restaurant suggestions, and "Dika Assistant," an AI-powered personal assistant providing contextual insights.

## User Preferences

Preferred communication style: Simple, everyday language.

**Future Discussion (in ~10 days):** Evaluate rebuilding the iOS app in Swift/SwiftUI or Flutter for a premium native feel (like Instagram/Spotify). The backend API and database would remain the same - only the mobile frontend would be rebuilt natively. This would solve the iOS spacing issues and provide true 100% native experience.

**Flutter App (flutter_app/):** Native mobile app built with Flutter for cross-platform iOS/Android. Connects to existing backend at app.ogym.fitness via JWT authentication. All API endpoints verified to match server routes.ts with camelCase responses. Key API patterns:
- Owner dashboard: `/api/owner/dashboard-metrics` → totalMembers, checkedInToday, checkedInYesterday, newEnrollmentsLast30Days, pendingPayments, totalRevenue
- Trainer dashboard: `/api/trainer/dashboard` → totalMembers, activeWorkouts, starMembers, recentActivity, memberProgress
- Nutrition: `/api/nutrition/summary?date=YYYY-MM-DD` for daily data, `/api/nutrition/logs` for logging meals
- Dika AI: `/api/dika/ask` for chat, `/api/dika/suggestions` for chips (no insights endpoint)
- Authentication: JWT mobileToken with 30-day expiry, Bearer token + X-Mobile-App header required

## System Architecture

### UI/UX Decisions
- **Frontend Framework:** React 18 with TypeScript and Vite.
- **UI Components:** shadcn/ui built on Radix UI primitives.
- **Styling:** Tailwind CSS with CSS variables for theming (Indigo/Slate).
- **Chart Visualization:** Recharts for dashboards.
- **Mobile Application:** Capacitor wraps the web app for iOS/Android.
- **Responsive Design:** Mobile-first approach with responsive grids, stacked-to-inline elements, content truncation, and responsive typography.
- **QR Code Generation:** Client-side via `qrcode.react`.
- **Mobile Navigation:** Fixed bottom navigation bar.

### Technical Implementations
- **Backend:** Express.js with TypeScript.
- **Authentication:** Passport.js (Local Strategy, session-based with PostgreSQL store) for gym users; JWT for Admin.
- **State Management (Frontend):** TanStack React Query.
- **Form Handling:** React Hook Form with Zod validation.
- **API Design:** RESTful with shared Zod schemas for type-safe communication.
- **Database ORM:** Drizzle ORM with PostgreSQL.
- **Multi-Tenancy:** Enforced via `gym_id` filtering.
- **Build System:** `tsx` for development, `esbuild` and Vite for production.
- **Core Features:** Attendance tracking, multi-currency payment/subscription management, workout management, user profiles, role-based access, and an admin system.
- **Communication:** Announcements for owner-to-member/trainer communication.
- **Member Engagement:** Trainer-member assignment history, "Star Members" with diet plans, social feed with activity, tournaments, and daily points based on workout completions.
- **Walk-in Visitors:** Tracking day passes, trials, and inquiries with a self-check-in kiosk, including external payment links and payment verification.
- **Mobile Performance Optimizations (Capacitor):** Premium native-like experience through: (1) CSS touch optimizations removing tap delays, adding touch-action, scroll momentum, hardware-accelerated animations; (2) iOS-style page transitions via `page-fade-scale` CSS class; (3) Pull-to-refresh with Capacitor haptic feedback (`usePullRefresh` hook in `client/src/hooks/use-pull-refresh.tsx`); (4) Smart API caching with 2-minute staleTime, 10-minute gcTime, background refetch; (5) Premium skeleton loading screens for all dashboard types (`client/src/components/dashboard-skeleton.tsx`).
- **Personal Mode:** Allows members to use the app without joining a gym for self-managed workout tracking, with data isolation and optional body measurement onboarding.
- **AI Import Workouts:** Enables importing workouts from AI assistants via paste or screenshot, using regex parsing and client-side OCR (Tesseract.js).
- **Training Mode:** Configurable for gym members as "Trainer-Led" or "Self-Guided," providing flexible workout management options within the gym context.
- **Calorie Analytics:** Weekly and monthly analytics for calorie tracking, including target vs. actual intake, adherence, and trainer-set goals.
- **Enhanced Nutrition Page:** Features a global "+ Add Food" button, supports various meal types (Breakfast, Lunch, Dinner, Snack, Protein, Extra Meals), and tracks protein intake.
- **Find My Food:** A location-based restaurant finder suggesting healthy meal options using OpenStreetMap Overpass API and an internal database of chains.
- **Dika Assistant:** An AI-powered personal assistant using OpenAI GPT-4o-mini (via Replit AI Integrations) providing contextual, role-specific insights to owners, members, and trainers. Includes conversational meal logging: users can naturally describe what they ate (e.g., "I had 2 eggs and toast for breakfast") and Dika will parse the food items with AI, estimate calories/macros, log to the database, and display a MealLoggedCard with nutritional breakdown and daily progress. Dika's system prompt includes real-time nutrition context (today's calories, protein, goals, remaining calories). **Owner Assistant Actions:** Gym owners can use natural language commands to perform actions: (1) **Navigate** - "Go to payments", "Show me members" auto-navigates with 600ms delay; (2) **Add Member** - "Add John Doe as a member" creates account with auto-generated credentials (Welcome@XXXX password); (3) **Log Payment (Subscription+Payment Flow)** - "Log payment for Ahmed" triggers guided multi-turn conversation: member identification → plan selection (shows available plans with prices) → full/partial payment amount → payment method → confirmation. Creates new subscription with calculated start/end dates and logs payment transaction. Supports partial payments with balance tracking. Guards against duplicate active subscriptions. Accepts all payment methods (cash, upi, card, bank, venmo, cashapp, zelle, paypal, other); (4) **Assign Trainer** - "Assign Sarah to trainer Mike" resolves both names, sets training mode. Uses DIKA_ACTION_DATA embedding pattern (like MEAL_LOG_DATA) with ActionCard confirmation UI (Confirm/Cancel buttons). Execution via `/api/dika/execute` endpoint with owner-only access. Name-to-ID resolution handles ambiguity with follow-up questions. Cache invalidation after mutations updates relevant dashboard/list queries. Architecture in `server/dika/owner-actions.ts`.
- **Automated Email Reminders:** System for sending subscription expiry reminders and weekly owner summaries using Resend API.
- **Production Security:** Implemented with Helmet.js, secure session cookies, rate limiting, request body limits, and session cleanup.
- **Error Handling:** React Error Boundary component for graceful UI error recovery.
- **Logging:** Server-side logger utility (`server/logger.ts`) with log levels and production filtering.
- **Database Indexing:** Optimized for common queries.
- **Deployment:** Same-origin deployment with Express serving API and static frontend.
- **Fitness Device Integration:** Health tracking columns in `users` and a `health_data` table for fitness device data.
- **iOS App Store Compliance (Guideline 3.1.1):** Gym owner registration is hidden on iOS native app to comply with Apple's in-app purchase requirements. Gym owners must register via web (app.ogym.fitness). Existing owners can still log in on iOS. The iOS app shows only informational text: "Gym owner accounts are created outside the app. Existing accounts can sign in." - no links, no URLs, no buttons.
- **Account Deletion (App Store Guideline 5.1.1):** Users can delete their account from Profile > Settings. Implements comprehensive cascade deletion across 40+ related tables (workouts, payments, subscriptions, measurements, health data, social feed, etc.). Gym owners can only delete if their gym has no active members. DELETE /api/users/me endpoint with "delete" confirmation word required.
- **UGC Moderation (App Store Guideline 1.2):** Social feed posts can be reported (inappropriate/spam/harassment/other) and users can be blocked. Blocked users' posts are filtered from feed display. Reports stored in `post_reports` table with pending/reviewed/dismissed status tracking. User blocks stored in `user_blocks` table with unique constraint. Owners/trainers can hide posts from their gym feed.
- **Location & Health Permissions (iOS Info.plist):** NSLocationWhenInUseUsageDescription for "Find My Food" feature, NSHealthShareUsageDescription and NSHealthUpdateUsageDescription for Apple Health integration via capacitor-health plugin.
- **iOS Status Bar & Safe Area Handling:** Status bar uses `overlay: false` so iOS handles safe area automatically. Theme-aware status bar icons via `updateStatusBarForTheme()` - light theme shows dark icons, dark theme shows light icons. Mobile header uses simple 8px padding (28px Android), content offset is just header height (56px iOS, 76px Android). Dika drawer no longer adds redundant safe-area padding. Status bar style is refreshed on every route change via `refreshStatusBar()` in RouteChangeHandler.
- **iOS Rubber-Band Scroll Prevention:** Main content area uses `.app-main-scroll` class with `overscroll-behavior-y: contain` to prevent bounce scrolling gaps. Applied only to main scroll container to preserve nested scrolling in modals and sheets.
- **Toast Positioning:** ToastViewport z-index 100001 (above header's 99999), positioned using CSS variable `--mobile-header-height: 56px` to ensure visibility below header.
- **Bottom Safe Area:** Main content uses `.pb-safe-bottom` class (mobile only) with `calc(tab-bar-height + safe-area-inset-bottom + 16px)` to prevent content from being clipped behind the home indicator and tab bar.
- **Onboarding Safe Areas:** All onboarding pages (carousel, member-onboarding, personal-onboarding) have explicit safe area padding for both top and bottom insets. Skip button and ThemeToggle positioned below top safe area, bottom controls positioned above bottom safe area.
- **iOS Dika Spacing Fix:** Dika drawer now has safe-area-inset-top padding on header and close button. Aggressive body/html style cleanup runs on close (at 0/50/150/300ms intervals) to remove any residual Radix Dialog styles (overflow, padding-right, pointer-events, data-scroll-locked). Scoped to iOS native only. Form bottom padding reduced when keyboard is open to avoid double safe-area.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Resend:** Transactional email service.
- **Helmet.js:** Security headers middleware.
- **Drizzle ORM:** Database interaction.
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
- **Zod:** Schema validation.
- **OpenAI GPT-4o-mini (via Replit AI Integrations):** AI assistant.
- **OpenStreetMap Overpass API:** Location-based restaurant data.
- **Tesseract.js:** Client-side OCR for image processing.
- **Capacitor Plugins:** @capacitor/camera, @capacitor/push-notifications, @capacitor/splash-screen, @capacitor/status-bar, @capacitor/keyboard, @capacitor/haptics, @capacitor/app, @capacitor/browser.