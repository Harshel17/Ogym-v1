# OGym iOS App - SwiftUI Rebuild Specification

**Version:** 1.0  
**Date:** February 2026  
**Target:** iOS 16+  

---

## 1. Executive Summary

Rebuild the OGym mobile frontend in native SwiftUI to deliver a premium, Instagram/Spotify-quality iOS experience. The existing Express.js + PostgreSQL backend remains unchanged - only the mobile frontend is rebuilt.

### Goals
- 100% native iOS experience
- 60fps smooth animations
- Haptic feedback throughout
- Face ID / Touch ID authentication
- Smaller app size, faster performance
- App Store compliance built-in

---

## 2. Architecture

```
┌──────────────────────────────────────────────────┐
│           Existing Backend (No Changes)           │
│  Express.js + PostgreSQL + Resend + OpenAI        │
│  URL: https://app.ogym.fitness/api/*              │
└──────────────────────────────────────────────────┘
                        ↑
                   HTTPS/JSON
                        ↓
┌──────────────────────────────────────────────────┐
│              New SwiftUI iOS App                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Views (SwiftUI)                           │  │
│  │  - Screens for each feature                │  │
│  │  - Reusable components                     │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  ViewModels (ObservableObject)             │  │
│  │  - Business logic                          │  │
│  │  - State management                        │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  Services                                  │  │
│  │  - APIService (network calls)              │  │
│  │  - AuthService (login, tokens)             │  │
│  │  - HealthKitService (Apple Health)         │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  Models (Codable structs)                  │  │
│  │  - User, Gym, Workout, Payment, etc.       │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Design Pattern: MVVM
- **Model:** Swift structs matching API responses
- **View:** SwiftUI views (declarative UI)
- **ViewModel:** ObservableObject classes for state

---

## 3. User Roles & Access

| Role | Description | Key Features |
|------|-------------|--------------|
| **Owner** | Gym owner/admin | Full gym management, payments, analytics |
| **Trainer** | Gym staff | Assign workouts, track members, attendance |
| **Member** | Gym member | Workouts, nutrition, attendance, profile |
| **Personal** | Self-managed user | Personal workout/nutrition tracking (no gym) |

---

## 4. Screen Specifications

### 4.1 Authentication Flow

#### 4.1.1 Splash Screen
- OGym logo animation
- Check stored session
- Auto-login if valid token

#### 4.1.2 Onboarding Carousel
- 3-4 slides explaining app
- Native PageTabView with dots
- Skip button, Get Started button

#### 4.1.3 Login Screen
- Email input (iOS keyboard, email type)
- "Send OTP" button
- Switch to register

#### 4.1.4 OTP Verification
- 6-digit native OTP input
- Auto-advance on paste
- Resend timer (60s)
- Haptic on success

#### 4.1.5 Role Selection (New Users)
- Three cards: Owner, Trainer, Member
- Personal Mode option
- Animated selection

---

### 4.2 Member Screens

#### 4.2.1 Member Dashboard
```
┌─────────────────────────────────┐
│  Good morning, [Name]           │
│  [Gym Name]                     │
├─────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐       │
│  │ Streak  │ │ Today   │       │
│  │  🔥 12  │ │ ✓ Done  │       │
│  └─────────┘ └─────────┘       │
├─────────────────────────────────┤
│  Today's Workout                │
│  [Workout Card - Tap to start]  │
├─────────────────────────────────┤
│  Quick Stats                    │
│  Calories: 1,850 / 2,200        │
│  Protein: 120g / 150g           │
├─────────────────────────────────┤
│  Recent Activity                │
│  - Chest Day completed          │
│  - Logged breakfast             │
└─────────────────────────────────┘
```

**Native Features:**
- Pull-to-refresh
- Haptic on streak milestone
- Activity rings for goals

#### 4.2.2 Workouts Tab
- List of assigned workout cycles
- Current week highlighted
- Tap to expand day
- Swipe to mark complete

#### 4.2.3 Active Workout Screen
```
┌─────────────────────────────────┐
│  ← Back          Timer: 45:23   │
├─────────────────────────────────┤
│  Exercise 3 of 8                │
│  BENCH PRESS                    │
│  Target: 4 sets × 10 reps       │
├─────────────────────────────────┤
│  Set 1: ✓ 10 × 60kg            │
│  Set 2: ✓ 10 × 60kg            │
│  Set 3: [ ] ___ × ___kg        │
│  Set 4: [ ] ___ × ___kg        │
├─────────────────────────────────┤
│  [Previous Exercise] [Next]     │
└─────────────────────────────────┘
```

**Native Features:**
- Swipe between exercises
- Haptic tick on set completion
- Rest timer with notification
- Keep screen awake during workout

#### 4.2.4 Nutrition Tab
```
┌─────────────────────────────────┐
│  Today's Nutrition    [+ Add]   │
├─────────────────────────────────┤
│  Calories    Protein   Carbs    │
│   1,850       120g      180g    │
│  ═══════     ═══════   ═══════  │
│  /2,200      /150g     /250g    │
├─────────────────────────────────┤
│  🍳 Breakfast           450 cal │
│  🍛 Lunch               680 cal │
│  🥗 Dinner              520 cal │
│  🥤 Snacks              200 cal │
├─────────────────────────────────┤
│  [Find My Food 📍]              │
└─────────────────────────────────┘
```

**Native Features:**
- Animated progress rings
- Quick-add floating button
- Native search for food database
- Location-based restaurant finder

#### 4.2.5 Food Search & Add
- Native search bar
- Recent foods section
- Barcode scanner (camera)
- Quick portion selector
- Haptic on add

#### 4.2.6 Profile Tab
- Avatar with camera option
- Body measurements chart
- Subscription status
- Settings access

#### 4.2.7 Body Measurements
- Weight, body fat, muscle mass
- Native charts (Swift Charts)
- Add new measurement sheet
- Progress photos grid

#### 4.2.8 Attendance
- QR code display (for gym scan)
- Manual check-in button
- Attendance history calendar
- Streak display

---

### 4.3 Owner Screens

#### 4.3.1 Owner Dashboard
```
┌─────────────────────────────────┐
│  [Gym Name] Dashboard           │
├─────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │ 45 │ │ 12 │ │ 3  │ │₹25K│   │
│  │Memb│ │Here│ │Pend│ │Rev │   │
│  └────┘ └────┘ └────┘ └────┘   │
├─────────────────────────────────┤
│  AI Insights                    │
│  🔴 8 At Risk  🟡 3 Follow-ups  │
├─────────────────────────────────┤
│  Today's Tasks                  │
│  □ 2 payments to confirm        │
│  □ 3 expiring subscriptions     │
│  □ 1 transfer request           │
├─────────────────────────────────┤
│  Attendance (Last 7 days)       │
│  [Bar Chart]                    │
└─────────────────────────────────┘
```

**Native Features:**
- Tap metrics to drill down
- Pull-to-refresh
- Badge notifications

#### 4.3.2 Members Management
- Searchable member list
- Filter by status (active, expired, at-risk)
- Tap for member detail
- Swipe for quick actions

#### 4.3.3 Member Detail (Owner View)
- Full profile
- Subscription info
- Payment history
- Assign trainer
- Workout cycles
- Notes

#### 4.3.4 Trainers Management
- List of gym trainers
- Assigned members count
- Add new trainer
- Trainer performance stats

#### 4.3.5 Payments
- Pending confirmations
- Payment history
- Record new payment
- Multi-currency support (₹/USD)

#### 4.3.6 Attendance Management
- Today's check-ins
- QR scanner for manual check-in
- Attendance reports
- Export option

#### 4.3.7 Walk-in Visitors
- Today's walk-ins
- Day pass management
- Trial users
- Convert to member

#### 4.3.8 Self Check-in Kiosk
- QR code for visitors
- Kiosk link management
- Day pass settings

#### 4.3.9 Announcements
- Send to all members
- Send to trainers
- Announcement history

#### 4.3.10 Gym Settings
- Gym profile
- Payment methods setup
- Subscription plans
- Currency settings

---

### 4.4 Trainer Screens

#### 4.4.1 Trainer Dashboard
- Assigned members list
- Today's schedule
- Quick stats
- Pending tasks

#### 4.4.2 Member Management (Trainer View)
- Assigned members only
- Workout assignment
- Progress tracking
- Notes

#### 4.4.3 Workout Builder
- Create workout cycles
- Add exercises from library
- Set reps/sets/weights
- Assign to members

#### 4.4.4 Diet Plans
- Create diet plans
- Calorie/macro targets
- Assign to star members

---

### 4.5 Shared Screens

#### 4.5.1 Dika AI Assistant
```
┌─────────────────────────────────┐
│  Dika AI          [×]          │
├─────────────────────────────────┤
│                                 │
│  💬 How can I help you today?  │
│                                 │
│  ┌─────────────────────────┐   │
│  │ What should I eat today?│   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Show my progress        │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  [Type a message...]    [Send] │
└─────────────────────────────────┘
```

**Native Features:**
- Native sheet presentation
- Streaming text animation
- Markdown rendering
- Haptic on response
- Quick suggestion chips

#### 4.5.2 Settings
- Theme toggle (iOS follows system)
- Notifications preferences
- Privacy settings
- Account deletion
- Logout

#### 4.5.3 Notifications
- Push notification list
- Mark as read
- Deep link to relevant screen

---

### 4.6 Personal Mode Screens

#### 4.6.1 Personal Dashboard
- Self-managed workouts
- Nutrition tracking
- Body measurements
- No gym affiliation

#### 4.6.2 Personal Workout Builder
- Create own workouts
- Exercise library access
- Track progress

---

## 5. Navigation Structure

### Tab Bar (5 tabs)

**Member:**
```
[Dashboard] [Workouts] [Nutrition] [Attendance] [Profile]
```

**Owner:**
```
[Dashboard] [Members] [Payments] [Attendance] [Settings]
```

**Trainer:**
```
[Dashboard] [Members] [Workouts] [Attendance] [Profile]
```

### Floating Action Button
- Dika AI assistant (bottom-right, above tab bar)
- Animated pulse when suggestions available

---

## 6. API Endpoints Used

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/request-otp` | POST | Request email OTP |
| `/api/auth/verify-otp` | POST | Verify OTP, get session |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/logout` | POST | End session |

### Members
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/members` | GET | List gym members |
| `/api/members/:id` | GET | Member details |
| `/api/member/dashboard` | GET | Member dashboard data |
| `/api/member/profile` | GET | Member profile |

### Workouts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/member/workout-cycles` | GET | Assigned workouts |
| `/api/workout-days/:id/complete` | POST | Mark day complete |
| `/api/workout-logs` | POST | Log exercise set |

### Nutrition
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/nutrition/entries` | GET/POST | Food entries |
| `/api/nutrition/foods/search` | GET | Search food database |
| `/api/nutrition/targets` | GET | Calorie/macro targets |

### Attendance
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/attendance/check-in` | POST | Manual check-in |
| `/api/attendance/history` | GET | Attendance records |
| `/api/attendance/qr` | GET | Get QR code |

### Owner
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/owner/dashboard` | GET | Owner dashboard |
| `/api/owner/payment-confirmations` | GET | Pending payments |
| `/api/payments` | POST | Record payment |
| `/api/gym/trainers` | GET/POST | Manage trainers |

### AI Assistant
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dika/chat` | POST | Send message to Dika |

---

## 7. Data Models (Swift)

```swift
// User
struct User: Codable, Identifiable {
    let id: Int
    let email: String
    let name: String?
    let role: UserRole
    let gymId: Int?
    let profilePicture: String?
}

enum UserRole: String, Codable {
    case owner, trainer, member, personal
}

// Gym
struct Gym: Codable, Identifiable {
    let id: Int
    let name: String
    let code: String
    let currency: String
    let ownerId: Int
}

// Workout
struct WorkoutCycle: Codable, Identifiable {
    let id: Int
    let name: String
    let days: [WorkoutDay]
}

struct WorkoutDay: Codable, Identifiable {
    let id: Int
    let dayNumber: Int
    let exercises: [Exercise]
    let isCompleted: Bool
}

struct Exercise: Codable, Identifiable {
    let id: Int
    let name: String
    let targetSets: Int
    let targetReps: Int
    let targetWeight: Double?
}

// Nutrition
struct FoodEntry: Codable, Identifiable {
    let id: Int
    let foodName: String
    let calories: Int
    let protein: Double
    let carbs: Double
    let fat: Double
    let mealType: MealType
    let date: Date
}

enum MealType: String, Codable {
    case breakfast, lunch, dinner, snack, protein, extra
}

// Payment
struct Payment: Codable, Identifiable {
    let id: Int
    let amount: Int
    let currency: String
    let status: PaymentStatus
    let memberId: Int
    let createdAt: Date
}
```

---

## 8. Native iOS Features

### 8.1 Face ID / Touch ID
- Biometric login after first email login
- Optional setting to enable/disable
- Keychain storage for session

### 8.2 Apple Health Integration
- Sync weight from Health app
- Write workout data to Health
- Read step count
- Permission request flow

### 8.3 Push Notifications
- Workout reminders
- Payment due alerts
- New message from trainer
- Subscription expiry

### 8.4 Haptic Feedback
| Action | Haptic Type |
|--------|-------------|
| Button tap | Light impact |
| Set complete | Medium impact |
| Workout complete | Success notification |
| Error | Error notification |
| Swipe action | Selection changed |

### 8.5 Widgets (iOS 17+)
- Daily workout summary
- Calorie progress ring
- Streak counter
- Quick check-in

### 8.6 Shortcuts & Siri
- "Start my workout"
- "Log my breakfast"
- "Check me in at gym"

---

## 9. Design System

### Colors
```swift
// Primary (Indigo)
static let primary = Color(hex: "6366F1")
static let primaryDark = Color(hex: "4F46E5")

// Backgrounds
static let background = Color(hex: "0F172A")  // Dark
static let backgroundLight = Color(hex: "FFFFFF")
static let card = Color(hex: "1E293B")

// Text
static let textPrimary = Color.white
static let textSecondary = Color(hex: "94A3B8")
static let textMuted = Color(hex: "64748B")

// Status
static let success = Color(hex: "22C55E")
static let warning = Color(hex: "F59E0B")
static let error = Color(hex: "EF4444")
```

### Typography
- SF Pro (system font)
- Titles: Bold, 24-32pt
- Body: Regular, 16-17pt
- Caption: Regular, 13-14pt

### Spacing
- xs: 4pt
- sm: 8pt
- md: 16pt
- lg: 24pt
- xl: 32pt

### Border Radius
- Small: 8pt
- Medium: 12pt
- Large: 16pt
- Full: 9999pt (pills)

---

## 10. Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Xcode project setup
- [ ] API service layer
- [ ] Authentication flow (OTP)
- [ ] User session management
- [ ] Basic navigation structure
- [ ] Theme/design system

### Phase 2: Member Experience (Week 2)
- [ ] Member dashboard
- [ ] Workout list & detail
- [ ] Active workout screen
- [ ] Nutrition logging
- [ ] Food search
- [ ] Profile & measurements

### Phase 3: Owner & Trainer (Week 3)
- [ ] Owner dashboard
- [ ] Member management
- [ ] Payment recording
- [ ] Trainer screens
- [ ] Workout assignment
- [ ] Attendance management

### Phase 4: AI & Polish (Week 4)
- [ ] Dika AI integration
- [ ] Push notifications
- [ ] Haptic feedback
- [ ] Animations & transitions
- [ ] Error handling
- [ ] Loading states

### Phase 5: Launch (Week 5)
- [ ] Apple Health integration
- [ ] Face ID / Touch ID
- [ ] Final testing
- [ ] App Store assets
- [ ] App Store submission
- [ ] Production deployment

---

## 11. Testing Plan

### Unit Tests
- API response parsing
- Business logic in ViewModels
- Date/currency formatting

### UI Tests
- Login flow
- Workout completion flow
- Payment recording
- Navigation paths

### Manual Testing
- All user roles
- Both currencies (₹ / $)
- Offline behavior
- Push notifications
- Background sync

---

## 12. App Store Requirements

### Already Handled
- Account deletion (implemented)
- UGC moderation (post reporting)
- Location permission descriptions
- Health permission descriptions

### For SwiftUI Build
- Privacy nutrition labels
- App preview videos
- Screenshots (6.5", 5.5")
- App description
- Keywords
- Age rating: 4+

### iOS Guideline 3.1.1 Compliance
- Owner registration hidden on iOS
- Only informational text shown
- No external links for registration

---

## 13. File Structure

```
OGym-iOS/
├── OGym.xcodeproj
├── OGym/
│   ├── App/
│   │   ├── OGymApp.swift
│   │   └── AppDelegate.swift
│   ├── Views/
│   │   ├── Auth/
│   │   │   ├── LoginView.swift
│   │   │   ├── OTPView.swift
│   │   │   └── OnboardingView.swift
│   │   ├── Member/
│   │   │   ├── MemberDashboard.swift
│   │   │   ├── WorkoutsView.swift
│   │   │   ├── ActiveWorkoutView.swift
│   │   │   ├── NutritionView.swift
│   │   │   └── ProfileView.swift
│   │   ├── Owner/
│   │   │   ├── OwnerDashboard.swift
│   │   │   ├── MembersListView.swift
│   │   │   ├── PaymentsView.swift
│   │   │   └── SettingsView.swift
│   │   ├── Trainer/
│   │   │   └── TrainerDashboard.swift
│   │   ├── Shared/
│   │   │   ├── DikaAssistant.swift
│   │   │   └── SettingsView.swift
│   │   └── Components/
│   │       ├── StatCard.swift
│   │       ├── WorkoutCard.swift
│   │       ├── FoodEntryRow.swift
│   │       └── LoadingView.swift
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift
│   │   ├── MemberViewModel.swift
│   │   ├── OwnerViewModel.swift
│   │   ├── WorkoutViewModel.swift
│   │   └── NutritionViewModel.swift
│   ├── Models/
│   │   ├── User.swift
│   │   ├── Gym.swift
│   │   ├── Workout.swift
│   │   ├── Nutrition.swift
│   │   └── Payment.swift
│   ├── Services/
│   │   ├── APIService.swift
│   │   ├── AuthService.swift
│   │   ├── HealthKitService.swift
│   │   └── NotificationService.swift
│   ├── Utilities/
│   │   ├── Constants.swift
│   │   ├── Extensions.swift
│   │   └── Formatters.swift
│   └── Resources/
│       ├── Assets.xcassets
│       └── Localizable.strings
└── OGymTests/
```

---

## 14. Success Metrics

| Metric | Target |
|--------|--------|
| App launch time | < 2 seconds |
| Screen transitions | 60fps |
| API response handling | < 100ms UI update |
| Crash-free rate | > 99.5% |
| App Store rating | 4.5+ stars |
| App size | < 50MB |

---

## 15. Next Steps

1. **User Approval:** Review this spec, request changes
2. **Development Start:** Set up Xcode project
3. **Weekly Updates:** Demo each phase
4. **Beta Testing:** TestFlight distribution
5. **Launch:** App Store submission

---

*Document prepared for OGym SwiftUI rebuild project*
