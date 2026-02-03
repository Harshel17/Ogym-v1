import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Detect platform from user agent as fallback
function detectPlatformFromUserAgent(): 'android' | 'ios' | 'web' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  return 'web';
}

// Update status bar style based on current theme
// Should be called on theme change AND on route/screen transitions
export async function updateStatusBarForTheme(isDarkTheme: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // Always ensure status bar is visible first
    await StatusBar.show();
    
    // Style.Light = light/white icons (use on DARK backgrounds)
    // Style.Dark = dark/black icons (use on LIGHT backgrounds)
    const style = isDarkTheme ? Style.Light : Style.Dark;
    await StatusBar.setStyle({ style });
    
    // Set background color based on theme for Android
    const platform = Capacitor.getPlatform();
    if (platform === 'android') {
      const bgColor = isDarkTheme ? '#0b1220' : '#f5f7fa';
      await StatusBar.setBackgroundColor({ color: bgColor });
    }
    
    console.log(`StatusBar: show + style=${isDarkTheme ? 'Light (white icons)' : 'Dark (black icons)'}`);
  } catch (error) {
    console.error('Failed to update StatusBar style:', error);
  }
}

// Force refresh status bar - call on route changes to ensure visibility
export async function refreshStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  
  const isDark = document.documentElement.classList.contains('dark');
  await updateStatusBarForTheme(isDark);
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
    // Don't overlay - let content respect safe area naturally
    await StatusBar.setOverlaysWebView({ overlay: false });
    
    // Check current theme and set appropriate style
    const isDark = document.documentElement.classList.contains('dark');
    await updateStatusBarForTheme(isDark);
    
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
