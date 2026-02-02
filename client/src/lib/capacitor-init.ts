import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initializeCapacitor() {
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
