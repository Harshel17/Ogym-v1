import { useState, useRef, useEffect } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const hasMoved = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const constrainPosition = (x: number, y: number) => {
    const buttonSize = 44;
    const margin = 10;
    const bottomNavHeight = 80;
    
    return {
      x: Math.max(margin, Math.min(window.innerWidth - buttonSize - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - buttonSize - margin - bottomNavHeight, y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    hasMoved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    setIsDragging(true);
    
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (!hasMoved.current) {
          onLongPress();
        }
      }, 500);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    hasMoved.current = false;
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
    }
    setIsDragging(true);
    
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (!hasMoved.current) {
          onLongPress();
        }
      }, 500);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < DRAG_THRESHOLD && !hasMoved.current) return;
      
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      
      const newPos = constrainPosition(
        e.clientX - dragOffset.x,
        e.clientY - dragOffset.y
      );
      onPositionChange(newPos);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const dx = touch.clientX - startPos.current.x;
      const dy = touch.clientY - startPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < DRAG_THRESHOLD && !hasMoved.current) return;
      
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      
      const newPos = constrainPosition(
        touch.clientX - dragOffset.x,
        touch.clientY - dragOffset.y
      );
      onPositionChange(newPos);
    };

    const handleEnd = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setIsDragging(false);
      
      if (!hasMoved.current) {
        onClick();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, onClick, onPositionChange]);

  return (
    <button
      ref={buttonRef}
      data-testid="button-dika"
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
        isDragging && "scale-105 opacity-90"
      )}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
      aria-label="Ask Dika"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10" />
      <RoboDIcon className="w-7 h-7 text-white relative z-10" />
    </button>
  );
}
