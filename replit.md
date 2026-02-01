# OGym V1 - Multi-Gym Management Platform

## Overview

OGym is a multi-tenant B2B web application designed for comprehensive gym management. It offers role-based access for gym owners, trainers, and members, streamlining operations such as attendance tracking (QR code & auto), multi-currency payment and subscription management, and detailed workout cycle organization. Key features include member statistics, a gym code-based joining system, "Star Members" tracking with diet plans, gym transfer requests, and an administrative panel for platform oversight. The platform also provides a dedicated mobile application for all user roles, enhancing accessibility and user experience. Recent enhancements include "Personal Mode" for self-managed fitness, an AI-powered workout importer, "Training Mode" for flexible workout management, calorie analytics, an "Enhanced Nutrition Page" with flexible meal logging, a "Find My Food" feature for healthy restaurant suggestions, and "Dika Assistant," an AI-powered personal assistant providing contextual insights.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Personal Mode:** Allows members to use the app without joining a gym for self-managed workout tracking, with data isolation and optional body measurement onboarding.
- **AI Import Workouts:** Enables importing workouts from AI assistants via paste or screenshot, using regex parsing and client-side OCR (Tesseract.js).
- **Training Mode:** Configurable for gym members as "Trainer-Led" or "Self-Guided," providing flexible workout management options within the gym context.
- **Calorie Analytics:** Weekly and monthly analytics for calorie tracking, including target vs. actual intake, adherence, and trainer-set goals.
- **Enhanced Nutrition Page:** Features a global "+ Add Food" button, supports various meal types (Breakfast, Lunch, Dinner, Snack, Protein, Extra Meals), and tracks protein intake.
- **Find My Food:** A location-based restaurant finder suggesting healthy meal options using OpenStreetMap Overpass API and an internal database of chains.
- **Dika Assistant:** An AI-powered personal assistant using OpenAI GPT-4o-mini (via Replit AI Integrations) providing contextual, role-specific insights to owners, members, and trainers.
- **Automated Email Reminders:** System for sending subscription expiry reminders and weekly owner summaries using Resend API.
- **Production Security:** Implemented with Helmet.js, secure session cookies, rate limiting, request body limits, and session cleanup.
- **Database Indexing:** Optimized for common queries.
- **Deployment:** Same-origin deployment with Express serving API and static frontend.
- **Fitness Device Integration:** Health tracking columns in `users` and a `health_data` table for fitness device data.

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