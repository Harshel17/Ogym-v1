# OGym Flutter App - Setup Instructions

## Quick Start Guide

### Step 1: Install Flutter on your Mac

**Option A: Using Homebrew (Recommended)**
```bash
brew install flutter
```

**Option B: Manual Installation**
1. Download Flutter SDK from https://flutter.dev/docs/get-started/install/macos
2. Extract to `~/development/flutter`
3. Add to PATH: `export PATH="$PATH:~/development/flutter/bin"`

### Step 2: Verify Installation
```bash
flutter doctor
```
Fix any issues shown (Xcode, Android SDK, etc.)

### Step 3: Create the Project
```bash
# Navigate to where you want the project
cd ~/Documents

# Create new Flutter project
flutter create ogym_app --org com.ogym

# Navigate into project
cd ogym_app
```

### Step 4: Copy the Code

1. **Delete the default lib folder:**
   ```bash
   rm -rf lib
   ```

2. **Copy the lib folder from flutter_app:**
   Copy the entire `lib/` folder from this repository to your project.

3. **Replace pubspec.yaml:**
   Copy `pubspec.yaml` from this repository to your project root.

### Step 5: Get Dependencies
```bash
flutter pub get
```

### Step 6: Run on iOS Simulator
```bash
# List available simulators
flutter devices

# Run on iOS simulator
flutter run
```

### Step 7: Run on Physical iPhone

1. Open iOS project in Xcode:
   ```bash
   open ios/Runner.xcworkspace
   ```

2. In Xcode:
   - Select your team in Signing & Capabilities
   - Connect your iPhone
   - Select your iPhone as the target device
   - Click Run (▶️)

## Project Structure

```
lib/
├── main.dart                    # App entry point
├── config/
│   ├── theme.dart               # App theme (Indigo/Slate)
│   └── constants.dart           # API endpoints & constants
├── models/
│   ├── user.dart                # User model
│   ├── workout.dart             # Workout models
│   ├── nutrition.dart           # Nutrition models
│   ├── owner.dart               # Owner dashboard models
│   ├── trainer.dart             # Trainer models
│   └── measurements.dart        # Body measurement models
├── services/
│   ├── api_service.dart         # HTTP client
│   ├── storage_service.dart     # Local storage
│   └── auth_service.dart        # Authentication
├── providers/
│   ├── auth_provider.dart       # Auth state management
│   └── theme_provider.dart      # Theme state management
├── screens/
│   ├── splash_screen.dart       # Splash/loading screen
│   ├── main_screen.dart         # Main container with bottom nav
│   ├── auth/
│   │   ├── login_screen.dart    # Login page
│   │   └── register_screen.dart # Registration page
│   ├── member/
│   │   ├── member_home_tab.dart     # Member dashboard
│   │   ├── member_workouts_tab.dart # Workout cycles
│   │   ├── member_nutrition_tab.dart# Nutrition tracking
│   │   └── member_profile_tab.dart  # Profile & settings
│   ├── owner/
│   │   ├── owner_home_tab.dart      # Owner dashboard
│   │   ├── owner_members_tab.dart   # Member management
│   │   ├── owner_payments_tab.dart  # Payment tracking
│   │   └── owner_profile_tab.dart   # Owner profile
│   └── trainer/
│       ├── trainer_home_tab.dart    # Trainer dashboard
│       ├── trainer_members_tab.dart # Assigned members
│       └── trainer_profile_tab.dart # Trainer profile
└── widgets/
    ├── today_workout_card.dart  # Today's workout expandable
    ├── stats_card.dart          # Statistics cards
    ├── week_progress.dart       # Weekly progress view
    └── workout_calendar.dart    # Monthly calendar
```

## Features Implemented

### Authentication
- ✅ Login with email/password
- ✅ Registration with role selection
- ✅ Personal Mode for members
- ✅ Gym code joining
- ✅ JWT token storage
- ✅ Auto-login on app restart

### Member Features
- ✅ Dashboard with greeting
- ✅ Day streak counter
- ✅ Today's workout (expandable)
- ✅ Exercise completion checkboxes
- ✅ Mark all as done
- ✅ Workout reorder (swap/push)
- ✅ Rest day handling
- ✅ This week progress
- ✅ Workout calendar
- ✅ Nutrition tracking
- ✅ Meal logging
- ✅ Calorie/macro display
- ✅ Profile & settings
- ✅ Theme toggle
- ✅ Account deletion

### Owner Features
- ✅ Dashboard stats
- ✅ AI Insights display
- ✅ Quick actions
- ✅ Recent activity
- ✅ Member list with search
- ✅ Member filtering
- ✅ Payment tracking
- ✅ Payment status tabs
- ✅ Gym code display
- ✅ Profile settings

### Trainer Features
- ✅ Dashboard stats
- ✅ Today's sessions
- ✅ Assigned members list
- ✅ Star members view
- ✅ Workout adherence display
- ✅ Diet plan status
- ✅ Profile settings

## API Connection
The app connects to: `https://app.ogym.fitness`

All API calls use JWT authentication stored securely on the device.

## Theme
- Primary: Indigo (#6366F1)
- Secondary: Slate (#64748B)
- Light/Dark mode support
- Matches web app exactly

## Next Steps (Additional Features)

The following features can be added in future updates:
- [ ] Dika AI Assistant
- [ ] Find My Food (location-based)
- [ ] My Body measurements
- [ ] QR code check-in
- [ ] Push notifications
- [ ] Walk-in management
- [ ] Auto email settings
- [ ] Export data
- [ ] Social feed
- [ ] Tournaments
- [ ] AI workout import

## Troubleshooting

**Flutter not found:**
```bash
export PATH="$PATH:`flutter`/bin"
```

**iOS build fails:**
```bash
cd ios
pod install
cd ..
flutter clean
flutter pub get
```

**Android build fails:**
Ensure Android SDK is installed and `ANDROID_HOME` is set.

**API connection issues:**
Check that your backend is running and accessible at `app.ogym.fitness`
