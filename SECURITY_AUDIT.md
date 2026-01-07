# OGym V1 Backend Security Audit

## Audit Date: January 7, 2026
## Status: PASS - All sensitive endpoints are protected

---

## Summary

All sensitive API endpoints are protected at the **backend level** using proper middleware:
- **Admin routes**: Protected with `requireAdmin` (JWT-based authentication)
- **Owner routes**: Protected with `requireRole(["owner"])` (session-based + role check)
- **Trainer routes**: Protected with `requireRole(["trainer"])` (session-based + role check)
- **Member routes**: Protected with `requireRole(["member"])` (session-based + role check)

---

## Route Protection Matrix

### Admin Routes (`/api/admin/*`) - JWT Protected

| Method | Path | Middleware | Notes |
|--------|------|------------|-------|
| POST | `/api/admin/login` | None | Login endpoint (intentionally public) |
| GET | `/api/admin/me` | requireAdmin | Get admin info |
| GET | `/api/admin/all-gym-requests` | requireAdmin | List gym requests |
| GET | `/api/admin/gym-requests/:id` | requireAdmin | Get gym request details |
| GET | `/api/admin/all-gyms` | requireAdmin | List all gyms |
| GET | `/api/admin/gyms/:gymId/profile` | requireAdmin | Get gym profile |
| POST | `/api/admin/gym-requests/:id/approve` | requireAdmin | Approve gym request |
| POST | `/api/admin/gym-requests/:id/reject` | requireAdmin | Reject gym request |
| GET | `/api/admin/gym-subscriptions` | requireAdmin | List gym subscriptions |
| GET | `/api/admin/gym-subscriptions/:gymId` | requireAdmin | Get gym subscription |
| POST | `/api/admin/gym-subscriptions/:gymId` | requireAdmin | Update gym subscription |
| GET | `/api/admin/support` | requireAdmin | List support tickets |
| GET | `/api/admin/support/:id` | requireAdmin | Get support ticket |
| PATCH | `/api/admin/support/:id/status` | requireAdmin | Update ticket status |
| POST | `/api/admin/support/:id/message` | requireAdmin | Reply to ticket |
| GET | `/api/admin/gyms-with-owners` | requireAdmin | List gyms with owners |
| GET | `/api/admin/gyms/:gymId/roster` | requireAdmin | Get gym roster |
| GET | `/api/admin/users/:userId` | requireAdmin | Get user details |
| PATCH | `/api/admin/users/:userId` | requireAdmin | Update user |
| POST | `/api/admin/users/:userId/reset-password` | requireAdmin | Reset user password |
| POST | `/api/admin/users/:userId/status` | requireAdmin | Update user status |
| POST | `/api/admin/users/:userId/move-gym` | requireAdmin | Move user to different gym |
| POST | `/api/admin/users/:userId/reassign-trainer` | requireAdmin | Reassign trainer |
| GET | `/api/admin/members/:id/day/:date` | requireAdmin | Get member day details |
| POST | `/api/admin/members/:id/attendance` | requireAdmin | Manage attendance |
| POST | `/api/admin/members/:id/workout/session/create` | requireAdmin | Create workout session |
| PATCH | `/api/admin/workout/session/:sessionId` | requireAdmin | Update workout session |
| DELETE | `/api/admin/workout/session/:sessionId` | requireAdmin | Delete workout session |
| POST | `/api/admin/workout/session/:sessionId/exercise/add` | requireAdmin | Add exercise |
| PATCH | `/api/admin/workout/exercise/:exerciseId` | requireAdmin | Update exercise |
| DELETE | `/api/admin/workout/exercise/:exerciseId` | requireAdmin | Delete exercise |
| POST | `/api/admin/workout/session/:sessionId/exercises/reorder` | requireAdmin | Reorder exercises |
| POST | `/api/admin/members/:id/streak/recalculate` | requireAdmin | Recalculate streak |
| GET | `/api/admin/audit-logs` | requireAdmin | View audit logs |

### Owner Routes (`/api/owner/*`) - Session + Role Protected

| Method | Path | Middleware | Notes |
|--------|------|------------|-------|
| GET | `/api/owner/members` | requireRole(["owner"]) | List gym members |
| GET | `/api/owner/members-details` | requireRole(["owner"]) | List members with details |
| GET | `/api/owner/trainers` | requireRole(["owner"]) | List gym trainers |
| GET | `/api/owner/trainers-overview` | requireRole(["owner"]) | Trainers with member counts |
| POST | `/api/owner/assign-trainer` | requireRole(["owner"]) | Assign trainer to member |
| GET | `/api/owner/assignments` | requireRole(["owner"]) | Get all assignments |
| GET | `/api/owner/qr-data` | requireRole(["owner"]) | Get QR code data |
| GET | `/api/owner/members/:memberId/overview` | requireRole(["owner"]) | Member overview |
| GET | `/api/owner/membership-plans` | requireRole(["owner"]) | List membership plans |
| POST | `/api/owner/membership-plans` | requireRole(["owner"]) | Create membership plan |
| PATCH | `/api/owner/membership-plans/:planId` | requireRole(["owner"]) | Update membership plan |
| DELETE | `/api/owner/membership-plans/:planId` | requireRole(["owner"]) | Delete membership plan |
| GET | `/api/owner/subscriptions` | requireRole(["owner"]) | List member subscriptions |
| POST | `/api/owner/subscriptions` | requireRole(["owner"]) | Create subscription |
| GET | `/api/owner/subscriptions/:id/transactions` | requireRole(["owner"]) | Get transactions |
| POST | `/api/owner/subscriptions/:id/payments` | requireRole(["owner"]) | Record payment |
| GET | `/api/owner/subscription-alerts` | requireRole(["owner"]) | Get subscription alerts |
| GET | `/api/owner/members-need-subscription` | requireRole(["owner"]) | Members needing subscription |
| GET | `/api/owner/profile` | requireRole(["owner"]) | Get owner profile |
| PATCH | `/api/owner/profile` | requireRole(["owner"]) | Update owner profile |
| GET | `/api/owner/transfer-requests` | requireRole(["owner"]) | List transfer requests |
| POST | `/api/owner/transfer-requests/:id/approve` | requireRole(["owner"]) | Approve transfer |
| POST | `/api/owner/transfer-requests/:id/reject` | requireRole(["owner"]) | Reject transfer |
| GET | `/api/owner/gym-history` | requireRole(["owner"]) | Get gym history |
| GET | `/api/owner/gym-subscription` | requireRole(["owner"]) | Get gym platform subscription |
| GET | `/api/owner/dashboard-metrics` | requireRole(["owner"]) | Dashboard metrics |
| GET | `/api/owner/revenue` | requireRole(["owner"]) | Revenue analytics |
| GET | `/api/owner/member-analytics` | requireRole(["owner"]) | Member analytics |
| GET | `/api/owner/members/inactive` | requireRole(["owner"]) | List inactive members |
| GET | `/api/owner/attendance/summary` | requireRole(["owner"]) | Attendance summary |
| GET | `/api/owner/attendance/day` | requireRole(["owner"]) | Day attendance |
| GET | `/api/owner/attendance/trend` | requireRole(["owner"]) | Attendance trend |
| GET | `/api/owner/members/:memberId/profile` | requireRole(["owner"]) | Member profile |
| GET | `/api/owner/members/:memberId/workouts` | requireRole(["owner"]) | Member workouts |
| GET | `/api/owner/members/:memberId/workouts/:date` | requireRole(["owner"]) | Member workout by date |
| GET | `/api/owner/members/:memberId/stats` | requireRole(["owner"]) | Member stats |
| GET | `/api/owner/members/:memberId/payments` | requireRole(["owner"]) | Member payments |
| POST | `/api/owner/announcements` | requireRole(["owner"]) | Create announcement |
| GET | `/api/owner/announcements` | requireRole(["owner"]) | List announcements |
| DELETE | `/api/owner/announcements/:id` | requireRole(["owner"]) | Delete announcement |
| GET | `/api/owner/export/payments` | requireRole(["owner"]) | Export payments CSV |
| GET | `/api/owner/export/attendance` | requireRole(["owner"]) | Export attendance CSV |
| GET | `/api/owner/export/members` | requireRole(["owner"]) | Export members CSV |
| GET | `/api/owner/join-requests` | requireRole(["owner"]) | List join requests |
| POST | `/api/owner/join-requests/:id/approve` | requireRole(["owner"]) | Approve join request |
| POST | `/api/owner/join-requests/:id/reject` | requireRole(["owner"]) | Reject join request |

### Trainer Routes (`/api/trainer/*`) - Session + Role Protected

| Method | Path | Middleware | Notes |
|--------|------|------------|-------|
| GET | `/api/trainer/dashboard` | requireRole(["trainer"]) | Dashboard data |
| GET | `/api/trainer/members` | requireRole(["trainer"]) | Assigned members |
| GET | `/api/trainer/new-members` | requireRole(["trainer"]) | New members |
| GET | `/api/trainer/cycles` | requireRole(["trainer"]) | Trainer's cycles |
| GET | `/api/trainer/active-phases` | requireRole(["trainer"]) | Active phases |
| GET | `/api/trainer/phases/:phaseId/exercises` | requireRole(["trainer"]) | Phase exercises |
| GET | `/api/trainer/members/:memberId/workouts` | requireRole(["trainer"]) | Member workouts |
| POST | `/api/trainer/cycles` | requireRole(["trainer"]) | Create cycle |
| PATCH | `/api/trainer/cycles/:cycleId/labels` | requireRole(["trainer"]) | Update labels |
| PATCH | `/api/trainer/cycles/:cycleId/rest-days` | requireRole(["trainer"]) | Update rest days |
| POST | `/api/trainer/cycles/:cycleId/add-day` | requireRole(["trainer"]) | Add day |
| DELETE | `/api/trainer/cycles/:cycleId/remove-day/:dayIndex` | requireRole(["trainer"]) | Remove day |
| GET | `/api/trainer/cycles/:cycleId/items` | requireRole(["trainer"]) | Get cycle items |
| POST | `/api/trainer/cycles/:cycleId/items` | requireRole(["trainer"]) | Add item |
| DELETE | `/api/trainer/cycles/:cycleId/items/:itemId` | requireRole(["trainer"]) | Delete item |
| GET | `/api/trainer/cycles/:cycleId/items/:itemId/sets` | requireRole(["trainer"]) | Get sets |
| POST | `/api/trainer/cycles/:cycleId/items/:itemId/sets` | requireRole(["trainer"]) | Add sets |
| PATCH | `/api/trainer/plan-sets/:setId` | requireRole(["trainer"]) | Update set |
| DELETE | `/api/trainer/plan-sets/:setId` | requireRole(["trainer"]) | Delete set |
| GET | `/api/trainer/activity` | requireRole(["trainer"]) | Activity feed |
| GET | `/api/trainer/requests` | requireRole(["trainer"]) | Member requests |
| PATCH | `/api/trainer/requests/:requestId/respond` | requireRole(["trainer"]) | Respond to request |
| GET | `/api/trainer/star-members` | requireRole(["trainer"]) | Star members list |
| POST | `/api/trainer/star-members` | requireRole(["trainer"]) | Add star member |
| DELETE | `/api/trainer/star-members/:memberId` | requireRole(["trainer"]) | Remove star |
| GET | `/api/trainer/star-members/:memberId` | requireRole(["trainer"]) | Star member details |
| GET | `/api/trainer/star-members/:memberId/workouts` | requireRole(["trainer"]) | Star workouts |
| GET | `/api/trainer/star-members/:memberId/workouts/:date` | requireRole(["trainer"]) | Workout by date |
| GET | `/api/trainer/star-members/:memberId/stats` | requireRole(["trainer"]) | Star member stats |
| GET | `/api/trainer/star-members/:memberId/missed` | requireRole(["trainer"]) | Missed workouts |
| GET | `/api/trainer/members/:memberId/stats` | requireRole(["trainer"]) | Member stats |
| GET | `/api/trainer/diet-plans` | requireRole(["trainer"]) | Diet plans |
| POST | `/api/trainer/diet-plans` | requireRole(["trainer"]) | Create diet plan |
| POST | `/api/trainer/diet-plans/:planId/meals` | requireRole(["trainer"]) | Add meal |
| DELETE | `/api/trainer/cycles/:cycleId` | requireRole(["trainer"]) | Delete cycle |
| GET | `/api/trainer/templates` | requireRole(["trainer"]) | Templates list |
| GET | `/api/trainer/templates/:id` | requireRole(["trainer"]) | Template details |
| POST | `/api/trainer/templates` | requireRole(["trainer"]) | Create template |
| DELETE | `/api/trainer/templates/:id` | requireRole(["trainer"]) | Delete template |
| POST | `/api/trainer/templates/:id/assign` | requireRole(["trainer"]) | Assign template |
| GET | `/api/trainer/members/:memberId/notes` | requireRole(["trainer"]) | Member notes |
| POST | `/api/trainer/members/:memberId/notes` | requireRole(["trainer"]) | Add note |
| DELETE | `/api/trainer/members/:memberId/notes/:noteId` | requireRole(["trainer"]) | Delete note |
| GET | `/api/trainer/members/:memberId/cycles` | requireRole(["trainer", "owner"]) | Member cycles |

### Member Routes (`/api/member/*`) - Session + Role Protected

| Method | Path | Middleware | Notes |
|--------|------|------------|-------|
| GET | `/api/member/subscription` | requireRole(["member"]) | Get subscription |
| GET | `/api/member/workout/summary` | requireRole(["member"]) | Workout summary |
| GET | `/api/member/workout/history` | requireRole(["member"]) | Workout history |
| GET | `/api/member/workout/session/:sessionId` | requireRole(["member"]) | Session details |
| POST | `/api/member/workout/session` | requireRole(["member"]) | Create session |
| PUT | `/api/member/workout/session/exercise/:exerciseId` | requireRole(["member"]) | Update exercise |
| GET | `/api/member/workout/schedule` | requireRole(["member"]) | Workout schedule |
| POST | `/api/member/workout/day/:date/mark-done` | requireRole(["member"]) | Mark day done |
| GET | `/api/member/workout/missed` | requireRole(["member"]) | Missed workouts |
| GET | `/api/member/profile` | requireRole(["member"]) | Get profile |
| PATCH | `/api/member/profile` | requireRole(["member"]) | Update profile |
| POST | `/api/member/profile/change-request` | requireRole(["member"]) | Request profile change |
| GET | `/api/member/progress` | requireRole(["member"]) | Progress data |
| GET | `/api/member/daily-points` | requireRole(["member"]) | Daily points |
| POST | `/api/member/requests` | requireRole(["member"]) | Create request |
| GET | `/api/member/requests` | requireRole(["member"]) | Get requests |
| GET | `/api/member/diet-plans` | requireRole(["member"]) | Diet plans |
| GET | `/api/member/active-phase` | requireRole(["member"]) | Active phase |
| POST | `/api/member/transfer-request` | requireRole(["member", "trainer"]) | Create transfer |
| GET | `/api/member/transfer-request` | requireRole(["member", "trainer"]) | Get transfer |
| GET | `/api/member/gym-history` | requireRole(["member"]) | Gym history |

---

## Fixes Applied (January 7, 2026)

| Route | Before | After |
|-------|--------|-------|
| GET `/api/owner/join-requests` | requireAuth + inline check | requireRole(["owner"]) |
| POST `/api/owner/join-requests/:id/approve` | requireAuth + inline check | requireRole(["owner"]) |
| POST `/api/owner/join-requests/:id/reject` | requireAuth + inline check | requireRole(["owner"]) |
| GET `/api/owner/gym-subscription` (duplicate) | requireAuth + inline check | Removed (duplicate of line 3197) |

---

## Security Verification Script

```bash
#!/bin/bash
# Security verification script for OGym V1

BASE_URL="https://your-ogym-domain.replit.app"

echo "=== OGym Security Verification ==="
echo ""

# Test 1: Unauthenticated access to admin endpoint
echo "1. Testing unauthenticated access to /api/admin/all-gyms..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/all-gyms")
if [ "$RESULT" == "401" ]; then
  echo "   PASS: Returns 401 Unauthorized"
else
  echo "   FAIL: Expected 401, got $RESULT"
fi

# Test 2: Member token trying to access admin endpoint
echo "2. Testing member token on /api/admin/all-gyms..."
# First login as member
MEMBER_COOKIE=$(curl -s -c - "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ironforge_member1@ogym.demo","password":"demo123"}' | grep connect.sid)

RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$MEMBER_COOKIE" "$BASE_URL/api/admin/all-gyms")
if [ "$RESULT" == "401" ] || [ "$RESULT" == "403" ]; then
  echo "   PASS: Returns 401/403 Forbidden"
else
  echo "   FAIL: Expected 401/403, got $RESULT"
fi

# Test 3: Owner token trying to access admin endpoint
echo "3. Testing owner token on /api/admin/all-gyms..."
OWNER_COOKIE=$(curl -s -c - "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ironforge_owner@ogym.demo","password":"demo123"}' | grep connect.sid)

RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$OWNER_COOKIE" "$BASE_URL/api/admin/all-gyms")
if [ "$RESULT" == "401" ] || [ "$RESULT" == "403" ]; then
  echo "   PASS: Returns 401/403 Forbidden"
else
  echo "   FAIL: Expected 401/403, got $RESULT"
fi

# Test 4: Member trying to access owner endpoint
echo "4. Testing member token on /api/owner/members..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$MEMBER_COOKIE" "$BASE_URL/api/owner/members")
if [ "$RESULT" == "403" ]; then
  echo "   PASS: Returns 403 Forbidden"
else
  echo "   FAIL: Expected 403, got $RESULT"
fi

# Test 5: Trainer trying to access owner endpoint
echo "5. Testing trainer token on /api/owner/members..."
TRAINER_COOKIE=$(curl -s -c - "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ironforge_trainer1@ogym.demo","password":"demo123"}' | grep connect.sid)

RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$TRAINER_COOKIE" "$BASE_URL/api/owner/members")
if [ "$RESULT" == "403" ]; then
  echo "   PASS: Returns 403 Forbidden"
else
  echo "   FAIL: Expected 403, got $RESULT"
fi

# Test 6: Owner accessing their own endpoint (should work)
echo "6. Testing owner token on /api/owner/members..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$OWNER_COOKIE" "$BASE_URL/api/owner/members")
if [ "$RESULT" == "200" ]; then
  echo "   PASS: Returns 200 OK"
else
  echo "   FAIL: Expected 200, got $RESULT"
fi

# Test 7: Member trying to access trainer endpoint
echo "7. Testing member token on /api/trainer/members..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$MEMBER_COOKIE" "$BASE_URL/api/trainer/members")
if [ "$RESULT" == "403" ]; then
  echo "   PASS: Returns 403 Forbidden"
else
  echo "   FAIL: Expected 403, got $RESULT"
fi

# Test 8: Trainer accessing their own endpoint (should work)
echo "8. Testing trainer token on /api/trainer/members..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -b "$TRAINER_COOKIE" "$BASE_URL/api/trainer/members")
if [ "$RESULT" == "200" ]; then
  echo "   PASS: Returns 200 OK"
else
  echo "   FAIL: Expected 200, got $RESULT"
fi

echo ""
echo "=== Security Verification Complete ==="
```

---

## Middleware Implementation

### requireAuth (Session-based)
```typescript
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
```

### requireRole (Session + Role Check)
```typescript
const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!roles.includes(req.user!.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
```

### requireAdmin (JWT-based)
```typescript
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.adminUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired admin token" });
  }
};
```

---

## Verification Checklist

- [x] All `/api/admin/*` routes protected with `requireAdmin` (except login)
- [x] All `/api/owner/*` routes protected with `requireRole(["owner"])`
- [x] All `/api/trainer/*` routes protected with `requireRole(["trainer"])`
- [x] All `/api/member/*` routes protected with `requireRole(["member"])`
- [x] No sensitive endpoints rely only on frontend guards
- [x] Cross-role access blocked (member cannot access owner/trainer/admin routes)
- [x] Multi-tenant isolation enforced via `gymId` in queries
