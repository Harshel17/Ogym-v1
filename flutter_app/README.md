# OGym Flutter App

A complete cross-platform mobile app for OGym - Multi-Gym Management Platform.

## Setup Instructions

### 1. Install Flutter on your Mac
```bash
brew install flutter
flutter doctor
```

### 2. Create the project
```bash
flutter create ogym_app --org com.ogym
cd ogym_app
```

### 3. Copy all files from this folder into your project

### 4. Install dependencies
```bash
flutter pub get
```

### 5. Run on iOS
```bash
open ios/Runner.xcworkspace
# Select your iPhone and click Run
```

## Project Structure
```
lib/
├── main.dart                 # App entry point
├── config/
│   └── theme.dart            # App theme (Indigo/Slate)
├── models/                   # Data models
├── services/
│   ├── api_service.dart      # HTTP client
│   └── auth_service.dart     # Authentication
├── providers/                # State management
├── screens/
│   ├── auth/                 # Login screens
│   ├── member/               # Member screens
│   ├── owner/                # Owner screens
│   └── trainer/              # Trainer screens
└── widgets/                  # Reusable components
```

## Backend API
Connects to: https://app.ogym.fitness
