import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initializeCapacitor() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Disable status bar overlay so content doesn't go under it
    await StatusBar.setOverlaysWebView({ overlay: false });
    
    // Set status bar style
    await StatusBar.setStyle({ style: Style.Dark });
    
    // Set status bar background color
    await StatusBar.setBackgroundColor({ color: '#1e3a5f' });
    
    console.log('Capacitor StatusBar configured successfully');
  } catch (error) {
    console.error('Failed to configure StatusBar:', error);
  }
}
