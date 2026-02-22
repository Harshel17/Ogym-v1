# OGym V1 - Multi-Gym Management Platform

## Overview
OGym is a multi-tenant B2B web application designed for comprehensive gym management, targeting gym owners, trainers, and members. It streamlines operations with features like attendance tracking, multi-currency payment and subscription management, and detailed workout cycle organization. Key capabilities include member statistics, a gym code-based joining system, "Star Members" tracking, gym transfer requests, and an administrative panel. The platform also features a dedicated mobile application, "Personal Mode" for self-managed fitness, an AI-powered workout importer, "Training Mode" for flexible workout management, calorie analytics, an "Enhanced Nutrition Page" with flexible meal logging, a "Find My Food" feature for healthy restaurant suggestions, and "Dika Assistant," an AI-powered personal assistant providing contextual insights and conversational meal logging. The project aims to provide a robust, all-in-one solution for modern gym operations and member engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework:** React 18 with TypeScript and Vite.
- **UI Components:** shadcn/ui built on Radix UI primitives.
- **Styling:** Tailwind CSS with CSS variables for theming.
- **Chart Visualization:** Recharts for dashboards.
- **Mobile Application:** Capacitor wraps the web app for iOS/Android, with a mobile-first responsive design approach.
- **QR Code Generation:** Client-side via `qrcode.react`.
- **Mobile Navigation:** Fixed bottom navigation bar.

### Technical Implementations
- **Backend:** Express.js with TypeScript.
- **Authentication:** Passport.js (Local Strategy, session-based) for gym users; JWT for Admin.
- **State Management (Frontend):** TanStack React Query.
- **Form Handling:** React Hook Form with Zod validation.
- **API Design:** RESTful with shared Zod schemas for type-safe communication.
- **Database ORM:** Drizzle ORM with PostgreSQL.
- **Multi-Tenancy:** Enforced via `gym_id` filtering.
- **Core Features:** Attendance tracking (QR code & auto), multi-currency payment/subscription management, workout management, user profiles, role-based access, admin system, and announcements.
- **Member Engagement:** Trainer-member assignment history, "Star Members" with diet plans, social feed, tournaments, and daily points.
- **Walk-in Visitors:** Tracking day passes, trials, and inquiries with a self-check-in kiosk.
- **Mobile Performance:** Optimizations for Capacitor include CSS touch optimizations, iOS-style page transitions, pull-to-refresh with haptic feedback, smart API caching, and skeleton loading screens.
- **Personal Mode:** Enables self-managed workout tracking for members without gym affiliation, with data isolation.
- **Guest Mode:** Anonymous login via "Continue as Guest" button. Creates temporary account with `isGuest` flag, full Personal Mode access (workouts, nutrition, Dika AI). Guests cannot join gyms, access social feed, or tournaments. Conversion flow upgrades existing account in-place (username/email/password) preserving all data. Guest banner shown on dashboard and profile page. Endpoints: `/api/auth/guest`, `/api/auth/convert-guest`. Component: `client/src/components/guest-conversion-banner.tsx`.
- **AI Import Workouts:** Supports importing workouts from AI assistants using regex parsing and client-side OCR (Tesseract.js).
- **Training Mode:** Configurable "Trainer-Led" or "Self-Guided" workout management for gym members.
- **Calorie Analytics:** Weekly and monthly analytics for calorie tracking against goals.
- **Enhanced Nutrition Page:** Features global "+ Add Food" button, multiple meal types, protein/water intake tracking, recent foods quick-add, and AI-powered nutrition estimation (OpenAI GPT-4o-mini). Includes an expanded American food database.
- **Sports Mode:** AI-powered sport-specific training programs. Users select a sport (Football, Basketball, Tennis, Swimming, Boxing, MMA, Cricket, Volleyball), choose their role/position, take an optional fitness assessment (score out of 100), then pick a skill to improve OR select "Just Track" to skip training programs and only log matches. GPT-4o-mini generates personalized multi-week training programs with drills, warmups, and cooldowns. Database: `sport_profiles`, `sport_programs`, `match_logs` tables. Page: `client/src/pages/sports-mode-page.tsx`.
- **Match Day Logging:** Dashboard "Log a Match" button with 3 timing options (Tomorrow is Match, Match Day, Yesterday was Match). For tomorrow: offers rest or warm-up for today. For today: asks if going or done, suggests recovery. For yesterday: logs match and adjusts today to recovery. Includes duration, intensity (casual/competitive), and estimated calorie tracking per sport. Match logs don't disturb the actual workout cycle. Requires sport profile selection first (redirects to Sports Mode if none). Cancel option to restore regular workout.
- **Find My Food:** Location-based restaurant finder suggesting healthy options using OpenStreetMap Overpass API.
- **Dika Assistant:** AI-powered personal assistant (OpenAI GPT-4o-mini) offering contextual insights, conversational meal logging, and owner actions (navigation, member addition, payment logging, trainer assignment). Supports cross-device chat synchronization.
- **Dika Voice:** Hands-free voice AI assistant using Web Speech API (SpeechRecognition + SpeechSynthesis). Features: floating mic button on all pages, full-screen voice conversation panel, continuous conversation mode (auto-resumes listening after AI speaks), voice/speed/language settings persisted in localStorage, multilingual support (15+ languages including Telugu, Hindi, Arabic, Spanish, Tamil, Kannada, Bengali), language auto-detection with same-language AI replies. AI prompt enhanced with intent detection (distinguishes "can I eat X?" questions from "I ate X" log commands), emotional intelligence (adapts tone for frustration/excitement/tiredness/guilt/discouragement), and voice-optimized responses (no markdown, natural speech patterns, shorter replies). **Shared conversation history:** Voice and text chat share the same `dika_chats` + `dika_chat_messages` database. Voice messages are tagged with `source='voice'` for visual distinction (mic icon in Dika Web). `/api/dika/ask` accepts optional `chatId` + `source` params, auto-finds/creates chat, persists messages, and returns `chatId`. Voice panel loads chat history from DB on open. Service: `client/src/lib/voice-service.ts`. Component: `client/src/components/dika/dika-voice.tsx`. Integrated via Layout component.
- **Dika Multi-Chat Web Experience:** ChatGPT-style web interface at `/dika-web` with dark sidebar, multi-chat management (create, rename, pin, delete), search across chats, pinned insights (auto-extracted from conversations: goals, diet type, weight, restrictions), action feed timeline, 4 quick actions (Log Meal, Generate Workout, Check Stats, Health Report), auto-categorization (nutrition/workouts/sports/general), auto-title generation, follow-up chips, and responsive mobile sidebar. Database: `dika_chats`, `dika_chat_messages`, `dika_insights`, `dika_action_feed` tables. Health-aware AI with 7-day rolling averages (steps, calories, HR, sleep, active minutes) and Recovery Score (0-100) based on sleep (35%), HR deviation (25%), activity (20%), steps (20%). Page: `client/src/pages/dika-web-page.tsx`.
- **Centralized Goals System:** User-defined fitness targets via `user_goals` table (all optional): target weight, daily calorie/protein targets, weekly workout frequency, primary goal (lose fat/build muscle/maintain/endurance/general health), custom text. Goals page at `/goals`. Goals feed into Intelligence Report (GPT references real targets vs guesses) and Dika conversations (context-aware coaching, nudges if no goals set). Dashboard nudge card prompts goal setting, dismissible for 7 days.
- **Dika Weekly Report:** AI-generated personalized fitness progress reports viewable publicly via token or emailed.
- **Owner AI Insights (5-Pillar System):** Production-grade AI intelligence for gym owners: (1) GPT Churn Explanations analyzing WHY each at-risk member might leave, (2) AI Weekly Owner Briefing with priorities and action items, (3) GPT-Powered Insight of the Day replacing rule-based patterns, (4) AI Trainer Performance Summaries evaluating each trainer's member engagement, (5) AI Re-engagement Campaign suggestions for expired members. Backend: `server/dika/owner-ai-engine.ts`. All 5 features are iOS-blocked per Apple compliance. All GPT calls use gpt-4o-mini with graceful fallback if AI fails.
- **Member AI Coach System:** GPT-4o-mini powered AI coaching for gym members and personal mode users. Backend: `server/dika/member-ai-engine.ts`. Features: (1) AI Workout Insights with 30-day analysis, muscle balance detection, and coach's notes, (2) AI Progress Summary with monthly report card showing workout/nutrition/streak highlights, (3) Smart Workout Suggestions with 3 prioritized focus areas based on patterns, (4) AI Nutrition Coaching with 7-day food log review and quick tips, (5) Proactive Dashboard Nudges for missed meals, low water, workout streaks, and goal gaps. UI Components: `client/src/components/ai-coach-cards.tsx`. Dashboard integration on member dashboard, nutrition coaching on nutrition page. Dika system prompt updated with AI Coach awareness so Dika can answer questions about all features contextually. API routes: `/api/member/ai/workout-insights`, `/progress-summary`, `/workout-suggestions`, `/nutrition-coaching`, `/nudges`.
- **Automated Email Reminders:** System for subscription expiry and owner summaries via Resend API.
- **Production Security:** Implemented with Helmet.js, secure session cookies, rate limiting, and request body limits.
- **Error Handling:** React Error Boundary for graceful UI error recovery.
- **Deployment:** Same-origin deployment with Express serving API and static frontend.
- **Fitness Device Integration (Level 2):** Full Health & Activity page (`/health`) with HealthKit (iOS) / Google Fit (Android) integration. Features: daily activity overview with progress rings (steps, calories, HR, sleep), AI-powered Recovery Score (1-100), Calorie Balance (eaten vs burned from nutrition data), weekly trends charts, heart rate zone visualization, and smart health insights. Components: `client/src/pages/health-page.tsx`, `client/src/components/health-summary.tsx`, `client/src/components/connect-health.tsx`. Service: `client/src/lib/health-service.ts`. Hooks: `client/src/hooks/use-health-data.ts`. Feature flags enabled. Web fallback shows "Connect via mobile app" message. Member/personal-mode only.
- **iOS App Store Compliance:** Comprehensive implementations for Guideline 3.1.1 (owner registration + all business/payment features hidden on iOS native: nav items, dashboard widgets, route-level guards via `blockOnIOSOwner`), Guideline 2.5.1 (HealthKit references removed from Info.plist/Podfile/Gradle), Guideline 5.1.1 (account deletion with cascade), and Guideline 1.2 (UGC moderation for social feed). Detection via `isNative() && isIOS()` from `capacitor-init.ts`.
- **iOS Specific UI/UX:** Handles status bar, safe areas, rubber-band scroll prevention, toast positioning, and Dika drawer spacing.
- **Feature Discovery Tips:** Role-specific rotating tips on dashboards (owner: 8, trainer: 5, member: 6, personal: 5) with localStorage-persisted dismissal, auto-rotation, and navigation links. Component: `client/src/components/feature-discovery-tips.tsx`.
- **Guided Empty States:** Enhanced empty state component with icon, description, feature highlights, and action buttons used across members, payments, workouts, progress, tournaments, and body measurement pages. Component: `client/src/components/guided-empty-state.tsx`.

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
- **Capacitor Plugins:** For camera, push notifications, splash screen, status bar, keyboard, haptics, app, and browser functionalities.