import { useState, useEffect, useCallback, useRef } from 'react';

function isNativePlatform(): boolean {
  try {
    const w = window as any;
    return !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isNativePlatform()) {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const handleResize = () => {
        const windowHeight = window.innerHeight;
        const viewportHeight = viewport.height;
        const newKeyboardHeight = Math.max(0, windowHeight - viewportHeight);
        setKeyboardHeight(newKeyboardHeight);
      };

      handleResize();

      let pollCount = 0;
      const pollTimer = setInterval(() => {
        handleResize();
        pollCount++;
        if (pollCount >= 8) clearInterval(pollTimer);
      }, 100);

      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
      
      return () => {
        clearInterval(pollTimer);
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      };
    }

    let showHandle: any;
    let hideHandle: any;

    import('@capacitor/keyboard').then(({ Keyboard }) => {
      Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardHeight(info.keyboardHeight);
      }).then(h => { showHandle = h; });

      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
      }).then(h => { hideHandle = h; });
    }).catch(() => {});

    return () => {
      if (showHandle) showHandle.remove();
      if (hideHandle) hideHandle.remove();
    };
  }, []);

  return keyboardHeight;
}

function getPlatformName(): string {
  try {
    const w = window as any;
    if (w.Capacitor && w.Capacitor.getPlatform) return w.Capacitor.getPlatform();
  } catch {}
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  return 'web';
}

export function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    const native = isNativePlatform();
    const platform = getPlatformName();
    const isAndroid = platform === 'android';

    if (native) {
      let showHandle: any;
      let hideHandle: any;
      
      if (isAndroid) {
        const handleResize = () => {
          const viewport = window.visualViewport;
          const viewH = viewport ? viewport.height : window.innerHeight;
          const windowH = window.screen.height;
          const diff = windowH - viewH;
          if (diff > 150) {
            setKeyboardVisible(true);
            setHeight(viewH);
          } else {
            setKeyboardVisible(false);
            setHeight(null);
          }
        };
        
        const viewport = window.visualViewport;
        if (viewport) {
          viewport.addEventListener('resize', handleResize);
          window.addEventListener('resize', handleResize);
          return () => {
            viewport.removeEventListener('resize', handleResize);
            window.removeEventListener('resize', handleResize);
          };
        }
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }

      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.addListener('keyboardWillShow', (info) => {
          setKeyboardVisible(true);
          const screenH = window.innerHeight || document.documentElement.clientHeight;
          setHeight(screenH - info.keyboardHeight);
        }).then(h => { showHandle = h; });

        Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardVisible(false);
          setHeight(null);
        }).then(h => { hideHandle = h; });
      }).catch(() => {});

      return () => {
        if (showHandle) showHandle.remove();
        if (hideHandle) hideHandle.remove();
      };
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const diff = windowHeight - viewportHeight;
      if (diff > 100) {
        setKeyboardVisible(true);
        setHeight(viewportHeight);
      } else {
        setKeyboardVisible(false);
        setHeight(null);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        focusedRef.current = true;
        setTimeout(handleResize, 300);
        setTimeout(handleResize, 600);
      }
    };

    const handleFocusOut = () => {
      focusedRef.current = false;
      setTimeout(handleResize, 100);
    };

    handleResize();

    let pollCount = 0;
    const pollTimer = setInterval(() => {
      handleResize();
      pollCount++;
      if (pollCount >= 10) clearInterval(pollTimer);
    }, 80);

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    
    return () => {
      clearInterval(pollTimer);
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return { visualHeight: height, keyboardVisible };
}

export function resetBodyStyles() {
  const props = [
    'overflow', 'padding-right', 'margin-right', 'padding-bottom', 'margin-bottom',
    'pointer-events', 'position', 'top', 'width', 'height', 'max-height', 'min-height',
  ];
  props.forEach(p => {
    document.body.style.removeProperty(p);
    document.documentElement.style.removeProperty(p);
  });
  document.documentElement.removeAttribute('data-scroll-locked');
  document.body.removeAttribute('data-scroll-locked');
  document.body.style.removeProperty('height');
}

export function useKeyboardAwareScroll() {
  const keyboardHeight = useKeyboardHeight();
  
  useEffect(() => {
    if (keyboardHeight > 0) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [keyboardHeight]);

  return keyboardHeight;
}
