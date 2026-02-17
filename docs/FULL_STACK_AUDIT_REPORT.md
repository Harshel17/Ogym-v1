# OGym Full-Stack Application Audit Report
**Date:** February 17, 2026
**Scope:** Comprehensive 7-phase audit of the entire application

## Executive Summary

**Codebase Size:** 74 tables, 11,274 lines (routes.ts), 9,274 lines (storage.ts), 1,375 lines (schema.ts)
**Endpoints:** ~379 API endpoints (356 protected, ~18 public/auth/kiosk/cron)
**Frontend API Calls:** ~235

### Critical Findings Fixed (P0)
| # | Issue | Status |
|---|-------|--------|
| 1 | Password hash leaked in API responses (`/api/auth/me`, `/api/owner/members`, `/api/owner/trainers`, `/api/admin/users/:id`, `/api/profile/my` fallback) | **FIXED** |
| 2 | Response logger captured and logged full JSON responses including password hashes | **FIXED** |

### Remaining Findings by Severity

---

## Phase 1: API Contract & Response Shape Audit

### P1 — Inconsistent Error Response Format
- **99%** of endpoints use `{ message: "..." }` format
- **1 endpoint** (`/api/exercises/search`) uses `{ error: "..." }` (line 4998)
- **Impact:** Frontend error handling may miss errors from inconsistent endpoints
- **Recommendation:** Standardize all error responses to `{ message: "..." }`

### P2 — No Response Envelope / Pagination
- List endpoints return raw arrays with no pagination metadata
- Large lists (members, attendance history, feed posts) can grow unbounded
- **Impact:** Performance degradation at scale; no way for frontend to paginate
- **Recommendation:** Add cursor-based pagination to high-volume list endpoints (members, feed, attendance, payments)

### P2 — Missing Input Validation on Some Endpoints
- Most endpoints use Zod validation (good)
- Some endpoints rely on implicit type coercion from URL params without explicit validation
- **Recommendation:** Add explicit Zod parsing for all request bodies and URL params

---

## Phase 2: Time, Date & Timezone Handling

### Good Practices Found
- Client sends `X-Local-Date` and `X-Local-Timezone` headers
- `getLocalDate(req)` helper centralizes date extraction
- Server falls back to server timezone with console warning

### P2 — Server-side `new Date()` Usage
- **~30 instances** of `new Date()` in routes.ts for date-sensitive operations
- Examples: consent timestamps (line 149), subscription checks, attendance dates
- Most are for timestamps (OK) but some are for date-string generation (risky)
- Date-string usages at lines 3762, 3858, 3887, 3897, 4109, 4574 use `new Date().toISOString().split('T')[0]` as fallback — these default to UTC which may differ from user's local date
- **Impact:** Edge cases around midnight UTC vs user timezone
- **Recommendation:** Replace date-string fallbacks with `getLocalDate(req)` where available

### P3 — Cron Job Uses Server Time
- `/api/cron/automated-emails` uses `new Date()` for day-of-week check (Monday detection)
- **Impact:** May send weekly summaries on wrong day for users in different timezones
- **Recommendation:** Acceptable for a cron system; document the behavior

---

## Phase 3: Authentication, Authorization & Security

### Good Practices Found
- Session-based auth with Passport.js (Local Strategy)
- JWT for admin panel (separate auth flow)
- `requireAuth`, `requireRole(["owner"])`, `requireAdmin` middleware consistently applied
- Rate limiting on auth endpoints, kiosk OTP, and kiosk submissions
- Helmet.js for security headers
- Password hashing with bcrypt
- CSRF-safe: session cookie with `sameSite` settings

### P1 — `gyms.ownerUserId` Has No FK Constraint and Is Nullable
- In `shared/schema.ts` line 25: `ownerUserId: integer("owner_user_id")` — no `.references()` and no `.notNull()`
- Other tables (`gym_requests`, `tournaments`) properly reference users.id
- **Impact:** Orphaned gyms possible; data integrity risk
- **Recommendation:** Add FK constraint and NOT NULL after data audit

### P2 — "Manually Authenticated" Endpoints (No Middleware)
- 6 endpoints check `req.isAuthenticated()` or `req.user` manually instead of using `requireAuth` middleware
- Includes: `/api/users/me` (DELETE), `/api/user/goals` (GET/PUT), `/api/support` (POST, GET, POST/message)
- While functionally equivalent, inconsistency increases maintenance risk
- **Recommendation:** Migrate to `requireAuth` middleware for consistency

### P2 — Cron Endpoint Auth Fallback
- `/api/cron/automated-emails` accepts either `CRON_SECRET` header OR admin session
- If `CRON_SECRET` env var is not set, only admin session works (acceptable)
- **Recommendation:** Ensure `CRON_SECRET` is set in production

### P3 — Admin JWT Secret Reuses SESSION_SECRET
- `getAdminJwtSecret()` uses `process.env.SESSION_SECRET` for JWT signing
- Separate secrets for different auth mechanisms is best practice
- **Impact:** Low — both are server-side secrets
- **Recommendation:** Consider separate `ADMIN_JWT_SECRET` env var

---

## Phase 4: Data Integrity & Schema

### Good Practices Found
- Drizzle ORM with typed schemas
- Zod validation on most mutation endpoints
- Foreign key constraints on most relational columns
- `onDelete: "cascade"` on appropriate child tables

### P2 — Missing Database Indexes
- 58 indexes defined across 74 tables
- Common query patterns may lack indexes:
  - `food_logs.user_id + date` (queried together frequently)
  - `attendance.member_id + date` (queried together frequently)
  - `feed_posts.gym_id + created_at` (feed ordering)
- **Recommendation:** Profile slow queries in production; add composite indexes

### P3 — Several Integer Columns Without FK Constraints
- `workout_items.sportProgramId` (line 216) — no FK to `sport_programs.id`
- `workout_items.cycleId` (line 222) — no FK (managed by application logic)
- `kiosk_visitors.kioskSessionId` (line 738) — no FK to kiosk sessions
- `dika_action_feed.entityId` (line 709) — polymorphic reference (acceptable)
- **Impact:** Low — application logic handles referential integrity
- **Recommendation:** Add FKs where practical; document polymorphic patterns

---

## Phase 5: Error Handling & Resilience

### Good Practices Found
- 174 try/catch blocks across 379 endpoints (~46% coverage)
- Most error-prone endpoints (mutations, AI calls, external API calls) have try/catch
- Consistent error logging with `console.error`
- React Error Boundary on frontend

### P2 — Missing Try/Catch on Some Endpoints
- ~54% of endpoints lack explicit try/catch
- Many are simple read operations where Express default error handler catches errors
- **Impact:** Unhandled errors may leak stack traces in development mode
- **Recommendation:** Add global error handler middleware as safety net

### P3 — No Circuit Breaker for External Services
- OpenAI API calls, Overpass API, and Resend email calls have no circuit breaker
- If external service is down, repeated failures slow the entire app
- **Recommendation:** Add timeout limits and circuit breaker pattern for AI/email calls

---

## Phase 6: Performance

### Good Practices Found
- `getMembersWithDetails` uses `Promise.all` for parallel queries
- Frontend uses React Query with smart caching
- Express serves static assets efficiently

### P2 — N+1 Query Patterns
- Line 7803: `Promise.all(member_ids.map(id => storage.getUser(id)))` — N individual queries
- Lines 10871-10902: Sequential `for...of` loops for exercise insertion (sport cycle creation)
- **Impact:** Slow operations for gyms with many members
- **Recommendation:** Use `WHERE id IN (...)` batch queries; use bulk insert for exercises

### P2 — Large Response Payloads
- `/api/me/calendar/enhanced` returns full month of workout data in one response
- `/api/intelligence-report` makes AI call on every request (no caching)
- **Impact:** Slow page loads; unnecessary AI API costs
- **Recommendation:** Cache intelligence reports (TTL: 1 hour); paginate calendar data

### P3 — Console.log in Production Paths
- Multiple `console.log` statements in hot paths (e.g., `getMembersWithDetails` timing logs)
- **Recommendation:** Use log levels; suppress debug logs in production

---

## Phase 7: Frontend-Backend Contract Alignment

### Good Practices Found
- Shared Zod schemas in `@shared/schema.ts`
- TanStack React Query with proper cache invalidation
- `apiRequest` helper for mutations
- 401 handling with configurable behavior (`on401: "throw"` vs `"returnNull"`)

### P2 — Missing `data-testid` Attributes
- Many interactive elements lack `data-testid` attributes
- **Impact:** E2E testing is harder to maintain
- **Recommendation:** Add `data-testid` to all interactive elements per coding guidelines

### P3 — Frontend Builds Full User Object Expectation
- Frontend `use-auth.tsx` expects the full user object from `/api/auth/me`
- The password field was previously included and serialized
- After the fix, the `password` field is stripped — verify no frontend code references it
- **Verification Done:** No frontend code references `user.password` directly

---

## Actions Taken

### Fix 1: Password Hash Sanitization (P0 — FIXED)
Added `sanitizeUser()` and `sanitizeUsers()` helper functions at the top of `routes.ts` that strip the `password` field from user objects before they are sent in API responses.

**Endpoints Fixed:**
- `GET /api/auth/me` — stripped password from user spread
- `GET /api/owner/members` — sanitized member array
- `GET /api/owner/trainers` — sanitized trainer array
- `GET /api/trainer/members` — sanitized member array
- `GET /api/trainer/new-members` — sanitized member array
- `GET /api/profile/my` (owner fallback) — sanitized user object
- `GET /api/admin/users/:userId` — sanitized user object
- `PATCH /api/admin/users/:userId` — sanitized updated user response
- `POST /api/admin/users/:userId/status` — sanitized updated user response
- `POST /api/admin/users/:userId/move-gym` — sanitized updated user response

### Fix 2: Response Logger Sanitization (P0 — FIXED)
Updated the response logging middleware in `server/index.ts` to:
- Redact `password`, `password_hash`, and `verificationCode` fields from logged JSON
- Truncate logged response bodies to 2000 characters to prevent log bloat

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 2 | Password hash leak in API + logs — **FIXED** |
| P1 (High) | 2 | Error format inconsistency; missing FK on gyms.ownerUserId |
| P2 (Medium) | 9 | Pagination, date handling, manual auth checks, indexes, error handling, N+1 queries, response sizes, test IDs |
| P3 (Low) | 5 | Cron timezone, JWT secret reuse, missing FKs, circuit breakers, console.log in production |

---

## Recommended Next Steps (Priority Order)
1. Add missing FK constraint on `gyms.ownerUserId` (P1)
2. Standardize error response format to `{ message: "..." }` (P1)
3. Add global error handling middleware (P2)
4. Add composite database indexes for common query patterns (P2)
5. Implement pagination for large list endpoints (P2)
6. Replace N+1 patterns with batch queries (P2)
7. Cache intelligence reports (P2)
8. Add `data-testid` attributes to interactive elements (P2)
