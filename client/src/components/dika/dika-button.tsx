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
  const activeRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

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

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      activeRef.current = true;
      draggedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };

      const rect = button.getBoundingClientRect();
      offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      button.setPointerCapture(e.pointerId);

      if (onLongPressRef.current) {
        longPressTimer.current = setTimeout(() => {
          if (!draggedRef.current && activeRef.current) {
            onLongPressRef.current?.();
          }
        }, 500);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < DRAG_THRESHOLD && !draggedRef.current) return;

      if (!draggedRef.current) {
        draggedRef.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      const newPos = constrainPosition(
        e.clientX - offsetRef.current.x, 
        e.clientY - offsetRef.current.y
      );
      onPositionChangeRef.current(newPos);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      activeRef.current = false;

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      try {
        button.releasePointerCapture(e.pointerId);
      } catch {}

      if (!draggedRef.current) {
        onClickRef.current();
      }
      draggedRef.current = false;
    };

    const onPointerCancel = (e: PointerEvent) => {
      activeRef.current = false;
      draggedRef.current = false;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      try {
        button.releasePointerCapture(e.pointerId);
      } catch {}
    };

    button.addEventListener('pointerdown', onPointerDown, { passive: false });
    button.addEventListener('pointermove', onPointerMove, { passive: false });
    button.addEventListener('pointerup', onPointerUp, { passive: false });
    button.addEventListener('pointercancel', onPointerCancel, { passive: false });

    return () => {
      button.removeEventListener('pointerdown', onPointerDown);
      button.removeEventListener('pointermove', onPointerMove);
      button.removeEventListener('pointerup', onPointerUp);
      button.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [constrainPosition]);

  return (
    <button
      ref={buttonRef}
      data-testid="button-dika"
      className={cn(
        "fixed z-50 w-12 h-12 rounded-xl",
        "bg-gradient-to-br from-amber-500 to-orange-600",
        "shadow-lg shadow-amber-500/30",
        "flex items-center justify-center",
        "cursor-grab active:cursor-grabbing",
        "transition-shadow duration-200 hover:shadow-xl hover:shadow-amber-500/40",
        "border border-amber-400/30",
        "select-none",
      )}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
      aria-label="Ask Dika"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10 pointer-events-none" />
      <RoboDIcon className="w-7 h-7 text-white relative z-10 pointer-events-none" />
    </button>
  );
}
