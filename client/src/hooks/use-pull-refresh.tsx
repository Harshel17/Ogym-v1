import { useRef, useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

interface PullRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export function usePullRefresh({ onRefresh, threshold = 80, disabled = false }: PullRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const scrollRef = useRef<HTMLElement | null>(null);
  const isPulling = useRef(false);
  const thresholdHapticFired = useRef(false);

  const triggerHaptic = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  }, []);

  const triggerLightHaptic = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || disabled) return;
    setIsRefreshing(true);
    triggerHaptic();
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh, isRefreshing, disabled, triggerHaptic]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    const scrollContainer = scrollRef.current;
    if (scrollContainer && scrollContainer.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
      thresholdHapticFired.current = false;
    }
  }, [disabled, isRefreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;
    if (delta > 0) {
      const dampened = Math.min(delta * 0.4, threshold * 1.5);
      setPullDistance(dampened);
      if (dampened >= threshold && !thresholdHapticFired.current) {
        thresholdHapticFired.current = true;
        triggerLightHaptic();
      }
    }
  }, [disabled, isRefreshing, threshold, triggerLightHaptic]);

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= threshold) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, handleRefresh]);

  const setScrollElement = useCallback((el: HTMLElement | null) => {
    if (scrollRef.current) {
      scrollRef.current.removeEventListener("touchstart", onTouchStart);
      scrollRef.current.removeEventListener("touchmove", onTouchMove);
      scrollRef.current.removeEventListener("touchend", onTouchEnd);
    }
    scrollRef.current = el;
    if (el) {
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: true });
      el.addEventListener("touchend", onTouchEnd, { passive: true });
    }
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        scrollRef.current.removeEventListener("touchstart", onTouchStart);
        scrollRef.current.removeEventListener("touchmove", onTouchMove);
        scrollRef.current.removeEventListener("touchend", onTouchEnd);
      }
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const PullIndicator = () => {
    if (pullDistance <= 0 && !isRefreshing) return null;
    const progress = Math.min(pullDistance / threshold, 1);
    return (
      <div 
        className="pull-refresh-indicator flex items-center justify-center"
        style={{ 
          transform: `translateX(-50%) translateY(${isRefreshing ? 40 : pullDistance}px)`,
          opacity: isRefreshing ? 1 : progress
        }}
      >
        <div className={`w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center ${isRefreshing ? '' : ''}`}>
          {isRefreshing ? (
            <div className="pull-refresh-spinner" />
          ) : (
            <svg 
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{ transform: `rotate(${progress * 180}deg)`, transition: 'transform 0.1s ease' }}
            >
              <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"/>
            </svg>
          )}
        </div>
      </div>
    );
  };

  return { 
    setScrollElement, 
    isRefreshing, 
    pullDistance, 
    PullIndicator 
  };
}
