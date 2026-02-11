function detectPlatformFromUserAgent(): 'android' | 'ios' | 'web' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  return 'web';
}

function isNativePlatform(): boolean {
  try {
    const w = window as any;
    return !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

function getPlatform(): string {
  try {
    const w = window as any;
    if (w.Capacitor && w.Capacitor.getPlatform) return w.Capacitor.getPlatform();
  } catch {}
  return detectPlatformFromUserAgent();
}

export async function updateStatusBarForTheme(isDarkTheme: boolean) {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.show();
    const style = isDarkTheme ? Style.Light : Style.Dark;
    await StatusBar.setStyle({ style });

    if (getPlatform() === 'android') {
      const bgColor = isDarkTheme ? '#0b1220' : '#f5f7fa';
      await StatusBar.setBackgroundColor({ color: bgColor });
    }
  } catch (error) {
    console.error('Failed to update StatusBar style:', error);
  }
}

export async function refreshStatusBar() {
  if (!isNativePlatform()) return;
  const isDark = document.documentElement.classList.contains('dark');
  await updateStatusBarForTheme(isDark);
}

async function disableAndroidOverlay() {
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    console.log('Android: disabled status bar overlay - WebView now below status bar');
  } catch (e) {
    console.warn('Failed to disable Android overlay:', e);
  }
}

export async function initializeCapacitor() {
  const native = isNativePlatform();
  const platform = native ? getPlatform() : detectPlatformFromUserAgent();

  if (platform === 'android') {
    document.documentElement.classList.add('capacitor-android');
    document.documentElement.classList.add('is-android');
  } else if (platform === 'ios') {
    document.documentElement.classList.add('capacitor-ios');
    document.documentElement.classList.add('is-ios');
  }

  if (native) {
    document.documentElement.classList.add('capacitor-native');
  }

  console.log(`Platform detected: ${platform}, isNative: ${native}`);

  if (!native) return;

  try {
    if (platform === 'android') {
      await disableAndroidOverlay();
    }

    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.show();
    const isDark = document.documentElement.classList.contains('dark');
    await updateStatusBarForTheme(isDark);

    console.log('Capacitor StatusBar initialized');
  } catch (error) {
    console.error('Failed to configure StatusBar:', error);
  }

  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: 'none' as any });
    console.log('Capacitor Keyboard resize mode set to none');
  } catch (error) {
    console.error('Failed to configure Keyboard:', error);
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

export function isNative(): boolean {
  return isNativePlatform();
}
