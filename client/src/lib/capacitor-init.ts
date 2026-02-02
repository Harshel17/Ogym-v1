import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initializeCapacitor() {
  // Add platform classes to document for CSS targeting
  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add('capacitor-native');
    document.documentElement.classList.add(`capacitor-${Capacitor.getPlatform()}`);
  }

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Disable status bar overlay so content doesn't go under it
    await StatusBar.setOverlaysWebView({ overlay: false });
    
    // Set status bar style - Light style for dark backgrounds (light icons on dark bg)
    await StatusBar.setStyle({ style: Style.Light });
    
    // Set status bar background color (matching dark theme)
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0b1220' });
    }
    
    console.log('Capacitor StatusBar configured successfully');
  } catch (error) {
    console.error('Failed to configure StatusBar:', error);
  }
}

// Export helper to check platform
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
