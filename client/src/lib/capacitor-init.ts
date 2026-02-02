import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Detect platform from user agent as fallback
function detectPlatformFromUserAgent(): 'android' | 'ios' | 'web' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  return 'web';
}

export async function initializeCapacitor() {
  // Add platform classes to document for CSS targeting
  // Use both Capacitor detection AND user-agent detection
  const isNative = Capacitor.isNativePlatform();
  const platform = isNative ? Capacitor.getPlatform() : detectPlatformFromUserAgent();
  
  // Always add platform class for CSS targeting (works in browser too)
  if (platform === 'android') {
    document.documentElement.classList.add('capacitor-android');
    document.documentElement.classList.add('is-android');
  } else if (platform === 'ios') {
    document.documentElement.classList.add('capacitor-ios');
    document.documentElement.classList.add('is-ios');
  }
  
  if (isNative) {
    document.documentElement.classList.add('capacitor-native');
  }

  console.log(`Platform detected: ${platform}, isNative: ${isNative}`);

  if (!isNative) {
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
