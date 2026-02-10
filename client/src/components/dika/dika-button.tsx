import { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';
import { DikaCircleIcon, SunflowerIcon, BatIcon, RoboDIcon } from './dika-icons';

const DRAG_THRESHOLD = 8;
const BUILD_TAG = 'v5-diag';
const BUTTON_SELECTOR = '[data-dika-drag="true"]';

interface DikaButtonProps {
  icon: DikaIcon;
  position: { x: number; y: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
  onClick: () => void;
  onLongPress?: () => void;
}

function sendDebug(events: string[]) {
  try {
    fetch('/api/debug-touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, ua: navigator.userAgent, time: new Date().toISOString(), build: BUILD_TAG }),
    }).catch(() => {});
  } catch {}
}

export function DikaButton({ 
  icon, 
  position, 
  onPositionChange, 
  onClick,
  onLongPress 
}: DikaButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const posRef = useRef({ x: position.x, y: position.y });

  const touchState = useRef({
    active: false,
    touchId: -1,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    dragged: false,
    moveCount: 0,
  });

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const debugRef = useRef<string[]>([]);

  const constrainPosition = useCallback((x: number, y: number) => {
    const buttonSize = 44;
    const margin = 10;
    const bottomNavHeight = 80;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - buttonSize - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - buttonSize - margin - bottomNavHeight, y)),
    };
  }, []);

  const applyTransform = useCallback((x: number, y: number) => {
    const btn = buttonRef.current;
    if (btn) {
      const t = `translate3d(${x}px, ${y}px, 0)`;
      btn.style.transform = t;
      (btn.style as any).webkitTransform = t;
    }
  }, []);

  useEffect(() => {
    if (!touchState.current.active) {
      posRef.current = { x: position.x, y: position.y };
      applyTransform(position.x, position.y);
    }
  }, [position.x, position.y, applyTransform]);

  useEffect(() => {
    applyTransform(posRef.current.x, posRef.current.y);
  }, [applyTransform]);

  useEffect(() => {
    function getButton(): HTMLElement | null {
      return document.querySelector(BUTTON_SELECTOR);
    }

    let diagCount = 0;
    const onAnyTouch = (e: TouchEvent) => {
      diagCount++;
      if (diagCount <= 5) {
        const t = e.target as HTMLElement;
        const btn = getButton();
        const tag = t?.tagName || 'null';
        const cls = (t?.className || '').toString().slice(0, 40);
        const hasAttr = t?.getAttribute?.('data-dika-drag') || 'no';
        const btnFound = btn ? 'yes' : 'no';
        const isInBtn = btn && t instanceof Node ? (btn === t || btn.contains(t)) : false;
        sendDebug([`DIAG-TOUCH#${diagCount} tag=${tag} attr=${hasAttr} btnFound=${btnFound} isInBtn=${isInBtn} cls=${cls}`]);
      }
    };
    document.addEventListener('touchstart', onAnyTouch, { passive: true, capture: true });

    const onTouchStart = (e: TouchEvent) => {
      if (touchState.current.active) return;

      const target = e.target as HTMLElement;
      const btn = getButton();
      if (!btn) return;
      if (!(target instanceof Node)) return;
      if (btn !== target && !btn.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      const pos = posRef.current;

      touchState.current = {
        active: true,
        touchId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        offsetX: touch.clientX - pos.x,
        offsetY: touch.clientY - pos.y,
        dragged: false,
        moveCount: 0,
      };

      debugRef.current = [`TSTART sx=${Math.round(touch.clientX)} sy=${Math.round(touch.clientY)} bx=${Math.round(pos.x)} by=${Math.round(pos.y)} build=${BUILD_TAG}`];

      if (onLongPressRef.current) {
        longPressTimer.current = setTimeout(() => {
          if (touchState.current.active && !touchState.current.dragged) {
            onLongPressRef.current?.();
          }
        }, 500);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const st = touchState.current;
      if (!st.active) return;

      e.preventDefault();
      e.stopPropagation();

      const touch = Array.from(e.touches).find(t => t.identifier === st.touchId);
      if (!touch) return;

      st.moveCount++;

      const dx = touch.clientX - st.startX;
      const dy = touch.clientY - st.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!st.dragged && distance < DRAG_THRESHOLD) return;

      if (!st.dragged) {
        st.dragged = true;
        debugRef.current.push(`DRAG_START move#${st.moveCount}`);
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      const newPos = constrainPosition(touch.clientX - st.offsetX, touch.clientY - st.offsetY);
      posRef.current = newPos;

      const btn = getButton();
      if (btn) {
        const t = `translate3d(${newPos.x}px, ${newPos.y}px, 0)`;
        btn.style.transform = t;
        (btn.style as any).webkitTransform = t;
      }

      if (st.moveCount <= 3) {
        debugRef.current.push(`MOVE#${st.moveCount} ${Math.round(newPos.x)},${Math.round(newPos.y)}`);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const st = touchState.current;
      if (!st.active) return;

      const found = Array.from(e.changedTouches).find(t => t.identifier === st.touchId);
      if (!found) return;

      e.preventDefault();
      e.stopPropagation();

      const wasDragged = st.dragged;
      const finalPos = { ...posRef.current };

      st.active = false;
      st.dragged = false;
      st.touchId = -1;

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const btn = getButton();
      if (btn) {
        const t = `translate3d(${finalPos.x}px, ${finalPos.y}px, 0)`;
        btn.style.transform = t;
        (btn.style as any).webkitTransform = t;
      }

      debugRef.current.push(`TEND moves=${st.moveCount} dragged=${wasDragged} pos=${Math.round(finalPos.x)},${Math.round(finalPos.y)} type=${e.type}`);

      if (wasDragged) {
        onPositionChangeRef.current(finalPos);
        debugRef.current.push(`DRAG_END`);
      } else {
        debugRef.current.push(`TAP`);
        onClickRef.current();
      }

      sendDebug(debugRef.current);
      debugRef.current = [];
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('touchcancel', onTouchEnd, { passive: false });

    sendDebug([`INIT ${BUILD_TAG} pos=${Math.round(posRef.current.x)},${Math.round(posRef.current.y)}`]);

    return () => {
      document.removeEventListener('touchstart', onAnyTouch, true);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [constrainPosition, applyTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragged = false;

    const currentPos = posRef.current;
    const offsetX = e.clientX - currentPos.x;
    const offsetY = e.clientY - currentPos.y;

    if (onLongPressRef.current) {
      longPressTimer.current = setTimeout(() => {
        if (!dragged) {
          onLongPressRef.current?.();
        }
      }, 500);
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < DRAG_THRESHOLD && !dragged) return;

      dragged = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const newPos = constrainPosition(ev.clientX - offsetX, ev.clientY - offsetY);
      posRef.current = newPos;
      applyTransform(newPos.x, newPos.y);
    };

    const handleMouseUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (dragged) {
        onPositionChangeRef.current(posRef.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [constrainPosition, applyTransform]);

  const handleClick = useCallback(() => {
    if (touchState.current.dragged) return;
    onClick();
  }, [onClick]);

  return (
    <button
      ref={buttonRef}
      data-testid="button-dika"
      data-dika-drag="true"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      className={cn(
        "fixed z-50 w-12 h-12 rounded-xl",
        "bg-gradient-to-br from-amber-500 to-orange-600",
        "shadow-lg shadow-amber-500/30",
        "flex items-center justify-center",
        "cursor-grab active:cursor-grabbing",
        "border border-amber-400/30",
      )}
      style={{
        left: 0,
        top: 0,
        willChange: 'transform',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      aria-label="Ask Dika"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10" />
      <RoboDIcon className="w-7 h-7 text-white relative z-10" />
      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[6px] font-bold rounded-full w-3 h-3 flex items-center justify-center z-20">5</span>
    </button>
  );
}
