import { useState, useEffect, useCallback } from 'react';

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

      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
      
      return () => {
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

export function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const native = isNativePlatform();

    if (native) {
      let showHandle: any;
      let hideHandle: any;
      
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

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
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
