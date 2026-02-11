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

function setAndroidSafeAreaTop() {
  const platform = getPlatform();
  if (platform !== 'android') return;

  const existing = getComputedStyle(document.documentElement).getPropertyValue('--cached-safe-top').trim();
  if (existing && existing !== '0px' && existing !== '') return;

  const dpr = window.devicePixelRatio || 1;
  const screenTop = (window.screen as any).availTop || 0;
  let statusBarHeight = 0;

  if (screenTop > 0) {
    statusBarHeight = screenTop;
  } else {
    statusBarHeight = Math.round(24 * dpr) / dpr;
    if (window.innerHeight < window.screen.height) {
      statusBarHeight = window.screen.height - window.innerHeight;
      if (statusBarHeight > 60) statusBarHeight = Math.round(24 * dpr) / dpr;
    }
  }

  if (statusBarHeight > 0 && statusBarHeight <= 60) {
    document.documentElement.style.setProperty('--cached-safe-top', statusBarHeight + 'px');
    document.documentElement.style.setProperty('--safe-top', statusBarHeight + 'px');
    console.log(`Android safe-area-top set to ${statusBarHeight}px`);
  }
}

export async function initializeCapacitor() {
  const native = isNativePlatform();
  const platform = native ? getPlatform() : detectPlatformFromUserAgent();

  if (platform === 'android') {
    document.documentElement.classList.add('capacitor-android');
    document.documentElement.classList.add('is-android');
    setAndroidSafeAreaTop();
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
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.show();
    const isDark = document.documentElement.classList.contains('dark');
    await updateStatusBarForTheme(isDark);

    if (platform === 'android') {
      try {
        const info = await StatusBar.getInfo();
        if (info.overlays) {
          setAndroidSafeAreaTop();
        }
      } catch {}
    }

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
