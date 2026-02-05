import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harshel.ogym',
  appName: 'OGym',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    allowNavigation: ['app.ogym.fitness'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#0b1220',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'light',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    backgroundColor: '#0b1220',
    webContentsDebuggingEnabled: true,
  },
};

export default config;
