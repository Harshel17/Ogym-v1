import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harshel.ogym',
  appName: 'OGym',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    url: 'https://app.ogym.fitness',
    cleartext: true,
    allowNavigation: ['app.ogym.fitness', '*.ogym.fitness', 'ogym.fitness'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0b1220',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'light',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    backgroundColor: '#0b1220',
  },
};

export default config;
