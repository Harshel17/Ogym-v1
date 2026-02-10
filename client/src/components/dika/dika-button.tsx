import { useRef, useCallback, useState, useEffect } from 'react';
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
  isDrawerOpen?: boolean;
}

export function DikaButton({ 
  icon, 
  position, 
  onPositionChange, 
  onClick,
  onLongPress,
  isDrawerOpen = false,
}: DikaButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const draggedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const positionRef = useRef(position);
  positionRef.current = position;
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const isDrawerOpenRef = useRef(isDrawerOpen);
  isDrawerOpenRef.current = isDrawerOpen;

  const constrainPosition = useCallback((x: number, y: number) => {
    const buttonSize = 48;
    const margin = 8;
    const bottomNavHeight = 80;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - buttonSize - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - buttonSize - margin - bottomNavHeight, y)),
    };
  }, []);

  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isDrawerOpenRef.current) return;

      e.stopPropagation();
      e.preventDefault();

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      draggedRef.current = false;
      isDraggingRef.current = false;

      const rect = el.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;

      if (onLongPressRef.current) {
        longPressTimer.current = setTimeout(() => {
          if (!draggedRef.current) {
            onLongPressRef.current?.();
          }
        }, 500);
      }

      const handleTouchMove = (ev: TouchEvent) => {
        const t = ev.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < DRAG_THRESHOLD && !draggedRef.current) return;

        if (!draggedRef.current) {
          draggedRef.current = true;
          isDraggingRef.current = true;
          setIsDragging(true);
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }

        ev.preventDefault();
        ev.stopPropagation();
        const newPos = constrainPosition(t.clientX - offsetX, t.clientY - offsetY);
        onPositionChangeRef.current(newPos);
      };

      const handleTouchEnd = (ev: TouchEvent) => {
        ev.stopPropagation();
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        const wasDragging = draggedRef.current;
        isDraggingRef.current = false;
        setIsDragging(false);
        draggedRef.current = false;

        window.removeEventListener('touchmove', handleTouchMove, true);
        window.removeEventListener('touchend', handleTouchEnd, true);
        window.removeEventListener('touchcancel', handleTouchEnd, true);

        if (!wasDragging) {
          onClickRef.current();
        }
      };

      window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
      window.addEventListener('touchend', handleTouchEnd, { capture: true });
      window.addEventListener('touchcancel', handleTouchEnd, { capture: true });
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
    };
  }, [constrainPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    draggedRef.current = false;

    const rect = buttonRef.current?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : 0;
    const offsetY = rect ? e.clientY - rect.top : 0;

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
      onPositionChangeRef.current(newPos);
    };

    const handleMouseUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [constrainPosition]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
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
        "fixed w-12 h-12 rounded-xl",
        "bg-gradient-to-br from-amber-500 to-orange-600",
        "shadow-lg shadow-amber-500/30",
        "flex items-center justify-center",
        "cursor-grab active:cursor-grabbing",
        "border border-amber-400/30",
        "select-none",
        isDrawerOpen ? "z-[99998] pointer-events-none opacity-0" : "z-[100001]",
        isDragging ? "scale-110 shadow-xl shadow-amber-500/40" : "",
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
      aria-label="Ask Dika"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10" />
      <RoboDIcon className="w-7 h-7 text-white relative z-10" />
    </button>
  );
}
