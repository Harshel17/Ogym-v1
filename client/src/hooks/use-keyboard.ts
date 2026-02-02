import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
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

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.then(handle => handle.remove());
      hideListener.then(handle => handle.remove());
    };
  }, []);

  return keyboardHeight;
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
