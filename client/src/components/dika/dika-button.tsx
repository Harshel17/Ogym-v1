import { useRef, useCallback } from 'react';
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

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    draggedRef.current = false;

    const rect = buttonRef.current?.getBoundingClientRect();
    const offsetX = rect ? touch.clientX - rect.left : 0;
    const offsetY = rect ? touch.clientY - rect.top : 0;

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
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      ev.preventDefault();
      const newPos = constrainPosition(t.clientX - offsetX, t.clientY - offsetY);
      onPositionChangeRef.current(newPos);
    };

    const handleTouchEnd = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
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
      onTouchStart={handleTouchStart}
      className={cn(
        "fixed z-50 w-12 h-12 rounded-xl",
        "bg-gradient-to-br from-amber-500 to-orange-600",
        "shadow-lg shadow-amber-500/30",
        "flex items-center justify-center",
        "cursor-grab active:cursor-grabbing",
        "transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-amber-500/40",
        "border border-amber-400/30",
      )}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'manipulation',
      }}
      aria-label="Ask Dika"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10" />
      <RoboDIcon className="w-7 h-7 text-white relative z-10" />
    </button>
  );
}
