# OGym Mobile App

A React Native + Expo mobile app for the OGym gym management platform.

## Features

- **Role-based navigation**: Owner, Trainer, and Member each see their own tabs
- **Member screens**: Dashboard, My Workout, Attendance, Progress, Profile
- **Trainer screens**: Home, Members, Star Members, Diet Plans, Profile
- **Owner screens**: Dashboard, Members, Payments, Announcements, Profile
- **Modern UI**: Clean design with consistent spacing, colors, and animations
- **Pull-to-refresh**: All list screens support pull-to-refresh
- **Secure authentication**: Session-based auth with secure storage

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your mobile device (for testing)

## Setup

1. Navigate to the mobile folder:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (optional - defaults to the Replit dev URL):
   ```
   EXPO_PUBLIC_API_URL=https://your-backend-url.replit.dev
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Scan the QR code with Expo Go (Android) or Camera app (iOS)

## Project Structure

```
mobile/
├── App.tsx                     # Root component
├── src/
│   ├── api/                    # API client and endpoints
│   │   ├── client.ts           # Axios client with auth
│   │   ├── auth.ts             # Auth endpoints
│   │   └── member.ts           # Member endpoints
│   ├── components/             # Reusable components
│   │   ├── LoadingScreen.tsx
│   │   └── StatCard.tsx
│   ├── contexts/               # React contexts
│   │   └── AuthContext.tsx     # Auth state management
│   ├── navigation/             # Navigation setup
│   │   ├── AppNavigator.tsx    # Main navigator
│   │   ├── AuthNavigator.tsx   # Login/Register stack
│   │   ├── MemberNavigator.tsx # Member tabs
│   │   ├── TrainerNavigator.tsx# Trainer tabs
│   │   └── OwnerNavigator.tsx  # Owner tabs
│   ├── screens/                # Screen components
│   │   ├── auth/               # Login, Register
│   │   ├── member/             # Member screens
│   │   ├── trainer/            # Trainer screens
│   │   ├── owner/              # Owner screens
│   │   └── shared/             # Shared screens
│   └── utils/                  # Utilities
│       └── colors.ts           # Theme colors
├── assets/                     # Images and icons
├── package.json
└── tsconfig.json
```

## Test Accounts

Use the same credentials as the web app:
- **Owner**: `mygym1` / (your password)
- **Trainer**: `vk` / (your password)
- **Member**: `harshel` / (your password)

## API Configuration

The mobile app connects to the same backend as the web app. The base URL is configured in `src/api/client.ts`. By default, it points to the Replit development URL.

For production, update the `EXPO_PUBLIC_API_URL` environment variable.

## Building for Production

### Android APK
```bash
npx expo build:android -t apk
```

### iOS IPA
```bash
npx expo build:ios -t archive
```

Or use EAS Build for modern builds:
```bash
npx eas build --platform all
```

## Notes

- The web app continues to run independently - this mobile app is an additional client
- Authentication is session-based using the same backend endpoints
- All existing features from the web app are supported (or coming soon)
