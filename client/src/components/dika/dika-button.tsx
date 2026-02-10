import { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';
import { DikaCircleIcon, SunflowerIcon, BatIcon, RoboDIcon } from './dika-icons';

const DRAG_THRESHOLD = 8;

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
      body: JSON.stringify({ events, ua: navigator.userAgent, time: new Date().toISOString() }),
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
  const draggedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const posRef = useRef({ x: position.x, y: position.y });

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const rafRef = useRef<number>(0);

  const applyPosition = useCallback((x: number, y: number) => {
    const btn = buttonRef.current;
    if (btn) {
      const t = `translate3d(${x}px, ${y}px, 0)`;
      btn.style.transform = t;
      (btn.style as any).webkitTransform = t;
    }
  }, []);

  useEffect(() => {
    if (!isDraggingRef.current) {
      posRef.current = { x: position.x, y: position.y };
      applyPosition(position.x, position.y);
    }
  }, [position.x, position.y, applyPosition]);

  useEffect(() => {
    applyPosition(posRef.current.x, posRef.current.y);
  }, [applyPosition]);

  const constrainPosition = useCallback((x: number, y: number) => {
    const buttonSize = 44;
    const margin = 10;
    const bottomNavHeight = 80;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - buttonSize - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - buttonSize - margin - bottomNavHeight, y)),
    };
  }, []);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      draggedRef.current = false;
      isDraggingRef.current = false;

      const currentPos = posRef.current;
      const offsetX = touch.clientX - currentPos.x;
      const offsetY = touch.clientY - currentPos.y;

      const debugEvents: string[] = [];
      debugEvents.push(`TSTART sx=${Math.round(startX)} sy=${Math.round(startY)} bx=${Math.round(currentPos.x)} by=${Math.round(currentPos.y)}`);

      if (onLongPressRef.current) {
        longPressTimer.current = setTimeout(() => {
          if (!draggedRef.current) {
            onLongPressRef.current?.();
          }
        }, 500);
      }

      let moveCount = 0;

      const handleTouchMove = (ev: TouchEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        moveCount++;
        const t = ev.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < DRAG_THRESHOLD && !draggedRef.current) return;

        if (!draggedRef.current) {
          draggedRef.current = true;
          isDraggingRef.current = true;
          debugEvents.push(`DRAG_START at move #${moveCount}`);
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }

        const newPos = constrainPosition(t.clientX - offsetX, t.clientY - offsetY);
        posRef.current = newPos;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const t3d = `translate3d(${newPos.x}px, ${newPos.y}px, 0)`;
          button.style.transform = t3d;
          (button.style as any).webkitTransform = t3d;
        });

        if (moveCount <= 3 || moveCount % 50 === 0) {
          debugEvents.push(`MOVE #${moveCount} -> ${Math.round(newPos.x)},${Math.round(newPos.y)} (dx=${Math.round(dx)} dy=${Math.round(dy)})`);
        }
      };

      const handleTouchEnd = (ev: TouchEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }

        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);

        const finalT = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
        button.style.transform = finalT;
        (button.style as any).webkitTransform = finalT;

        debugEvents.push(`TEND moves=${moveCount} dragged=${draggedRef.current} finalPos=${Math.round(posRef.current.x)},${Math.round(posRef.current.y)} transform=${button.style.transform}`);

        if (!draggedRef.current) {
          isDraggingRef.current = false;
          debugEvents.push(`TAP -> open drawer`);
          onClickRef.current();
        } else {
          const finalPos = posRef.current;
          isDraggingRef.current = false;
          onPositionChangeRef.current(finalPos);
          debugEvents.push(`DRAG_END -> saved pos ${Math.round(finalPos.x)},${Math.round(finalPos.y)}`);
        }
        draggedRef.current = false;

        sendDebug(debugEvents);
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    };

    button.addEventListener('touchstart', handleTouchStart, { passive: false });
    sendDebug([`INIT listener attached, pos=${Math.round(posRef.current.x)},${Math.round(posRef.current.y)}`]);

    return () => {
      button.removeEventListener('touchstart', handleTouchStart);
    };
  }, [constrainPosition, applyPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    draggedRef.current = false;

    const currentPos = posRef.current;
    const offsetX = e.clientX - currentPos.x;
    const offsetY = e.clientY - currentPos.y;

    if (onLongPressRef.current) {
      longPressTimer.current = setTimeout(() => {
        if (!draggedRef.current) {
          onLongPressRef.current?.();
        }
      }, 500);
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < DRAG_THRESHOLD && !draggedRef.current) return;

      draggedRef.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const newPos = constrainPosition(ev.clientX - offsetX, ev.clientY - offsetY);
      posRef.current = newPos;
      applyPosition(newPos.x, newPos.y);
    };

    const handleMouseUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (draggedRef.current) {
        onPositionChangeRef.current(posRef.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [constrainPosition, applyPosition]);

  const handleClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onClick();
  }, [onClick]);

  return (
    <button
      ref={buttonRef}
      data-testid="button-dika"
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
    </button>
  );
}
