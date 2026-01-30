import { useEffect, useRef, useCallback } from "react";
import { useBackNavigation } from "./use-back-navigation";
import { useIsMobile } from "./use-mobile";

interface SwipeConfig {
  minSwipeDistance?: number;
  maxSwipeTime?: number;
  edgeThreshold?: number;
}

export function useSwipeNavigation(config: SwipeConfig = {}) {
  const {
    minSwipeDistance = 80,
    maxSwipeTime = 300,
    edgeThreshold = 50
  } = config;

  const { goBack } = useBackNavigation();
  const isMobile = useIsMobile();

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isEdgeSwipe = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    isEdgeSwipe.current = touch.clientX <= edgeThreshold;
  }, [edgeThreshold]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isEdgeSwipe.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);
    const swipeTime = Date.now() - touchStartTime.current;

    const isHorizontalSwipe = deltaX > deltaY;
    const isRightSwipe = deltaX > minSwipeDistance;
    const isFastEnough = swipeTime < maxSwipeTime;

    if (isHorizontalSwipe && isRightSwipe && isFastEnough) {
      e.preventDefault();
      goBack();
    }
  }, [minSwipeDistance, maxSwipeTime, goBack]);

  useEffect(() => {
    if (!isMobile) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, handleTouchStart, handleTouchEnd]);

  return null;
}

export function SwipeNavigationProvider({ children }: { children: React.ReactNode }) {
  useSwipeNavigation();
  return <>{children}</>;
}
