# OGym V1 - Multi-Gym Management Platform

## Overview
OGym is a multi-tenant B2B web application designed to streamline gym operations and enhance member engagement. It offers comprehensive features for gym owners, trainers, and members, including attendance tracking, multi-currency payment and subscription management, and detailed workout cycle organization. Key capabilities span member statistics, a gym code-based joining system, "Star Members" tracking, gym transfer requests, and an administrative panel. The platform also includes a dedicated mobile application, "Personal Mode" for self-managed fitness, an AI-powered workout importer, "Training Mode" for flexible workout management, calorie analytics, an "Enhanced Nutrition Page" with flexible meal logging, a "Find My Food" feature for healthy restaurant suggestions, and "Dika Assistant," an AI-powered personal assistant providing contextual insights and conversational meal logging. OGym aims to be an all-in-one solution for the modern fitness industry, providing significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
- **Frontend:** React 18 with TypeScript and Vite, utilizing shadcn/ui (built on Radix UI) and Tailwind CSS for styling.
- **Data Visualization:** Recharts for dashboards.
- **Mobile:** Capacitor wraps the web app for iOS/Android, featuring a mobile-first responsive design, client-side QR code generation, and a fixed bottom navigation bar.
- **iOS Specifics:** Compliance with Apple App Store guidelines, including status bar, safe areas, rubber-band scroll, and account deletion handling.

### Technical Implementations
- **Backend:** Express.js with TypeScript.
- **Authentication:** Passport.js (Local Strategy, session-based) for gym users; JWT for Admin.
- **State Management:** TanStack React Query for frontend.
- **Form Handling:** React Hook Form with Zod validation.
- **API:** RESTful design with shared Zod schemas.
- **Database:** PostgreSQL with Drizzle ORM.
- **Multi-Tenancy:** Enforced via `gym_id` filtering.
- **Core Features:** Attendance, payments, workout management, user profiles, role-based access, admin system, announcements, and member engagement features.
- **Guest Mode & Personal Mode:** Anonymous access and self-managed fitness with data isolation.
- **AI Integrations:**
    - **AI Import Workouts:** Supports importing from AI assistants via regex parsing and client-side OCR.
    - **Dika Assistant:** GPT-4o-mini powered personal assistant for contextual insights, conversational meal logging, and owner actions with cross-device chat sync.
    - **Dika Voice:** Hands-free voice AI assistant (Web Speech API) with continuous conversation, multilingual support, intent detection, and emotional intelligence.
    - **Dika Multi-Chat Web Experience:** ChatGPT-style interface for Dika with multi-chat, search, pinned insights, and health-aware AI using a Recovery Score.
    - **AI Insights:** AI-generated weekly reports for members, and AI-driven churn explanations, briefings, and re-engagement suggestions for owners (5-Pillar System). AI Coach System for members provides workout insights, progress summaries, and nutrition coaching.
    - **AI Follow-up Engine:** Transforms follow-ups into an AI-powered execution engine with priority queues, GPT-4o-mini message generation, outcome tracking, and next-action suggestions.
    - **Walk-in Visitors AI Pipeline:** Upgraded walk-in visitors page with a conversion funnel, AI-driven lead scoring, repeat visitor detection, and Dika AI action suggestions.
    - **Trainer AI Intelligence:** Trainer dashboard upgraded with AI-powered insights, at-risk member alerts, and Dika briefings with team status summaries.
    - **Food Camera (Snap & Score):** AI analyzes food photos for nutrition and provides a health score with reasons.
    - **Quick Log Bar:** AI-powered natural language workout logging.
- **Nutrition Features:** Calorie analytics, enhanced nutrition page with global food logging, and "Find My Food" for healthy restaurant suggestions.
- **Sports Mode:** AI-powered sport-specific training programs, fitness assessments, and match logging.
- **Fitness Device Integration:** Health & Activity page with HealthKit (iOS) / Google Fit (Android) integration for activity overview, recovery score, and calorie balance, utilizing advanced health plugins for accurate data. Retroactive 7-day sync: on every app open or manual sync, `syncHistoricalData(7)` re-fetches the last 7 days from HealthKit/Google Fit and upserts to backend, fixing stale partial snapshots (e.g. 814 steps → full 6,000).
- **Gym Intelligence Dashboard:** Provides data-driven insights for owners, including Peak Hour Pressure, Muscle Trend Intelligence, and Equipment Intelligence, with Dika AI context for queries.
- **Property Manager Dashboard:** Multi-property-type support (gym, apartment, recreation_center, corporate, society). Property managers get a simplified door access tracking dashboard showing total residents, checked-in today, self check-in kiosk link, and a chronological access log (today + previous days). Sidebar and mobile nav are stripped down for property managers (Dashboard, Residents, Access History, Intelligence, Self Check-in, Profile). Component: `client/src/pages/property-manager-dashboard.tsx`. API: `/api/owner/property-analytics`.
- **Property Access History:** Filterable attendance page for property managers with date range selection (Today/7d/30d/custom), name search, grouped-by-date display. Component: `client/src/pages/property-access-history.tsx`. API: `/api/owner/access-history`.
- **Property Intelligence:** Adapted Dika Intelligence for property managers showing peak hours heatmap, weekly usage trends (4-week view with growth %), and resident engagement breakdown (regulars/occasional/inactive segments). Component: `client/src/pages/property-intelligence-page.tsx`. API: `/api/owner/property-intelligence`.
- **Demo Accounts:**
    - **Sunrise Apartments (Property):** gymId=4, code=SUN247, propertyType=apartment
    - Property Manager: `sunrise_owner` / `Owner@123` / `sunrise@demo.com`
    - Trainer: `sunrise_trainer` / `Trainer@123`
    - Members: sarah_mitchell, david_lee, priya_sharma, chris_thomas, ananya_reddy, rahul_kumar, neha_gupta, arun_patel (all `Member@123`)
- **Equipment Management:** Two-layer system for registering equipment and mapping exercises, with generic fallbacks.
- **Automated Reminders:** Email reminders for subscription expiry and owner summaries.
- **Security:** Helmet.js, secure session cookies, rate limiting.
- **Error Handling:** React Error Boundary.
- **Deployment:** Same-origin with Express serving API and static frontend.
- **OGym Score (Discipline Score):** A dual-score system (Daily Discipline Score and OGym Score) calculated based on workout, nutrition, consistency, and recovery, visible to members, trainers, and owners.

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
- **OpenAI GPT-4o-mini (via Replit AI Integrations):** AI assistant for various features (Dika Assistant, AI insights, follow-up engine, etc.).
- **OpenStreetMap Overpass API:** Location-based restaurant data.
- **Tesseract.js:** Client-side OCR.
- **Capacitor Plugins:** For camera, push notifications, splash screen, status bar, keyboard, haptics, app, and browser functionalities.
- **@capgo/capacitor-health (v7.2.15):** Health plugin for passive heart rate, distance, calories, steps, and weight data from Apple Health/Google Fit.
- **capacitor-health (v7.0.0):** Health plugin for aggregated steps, active calories, mindfulness, and workout session queries.