import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';
import { DikaCircleIcon, SunflowerIcon, BatIcon } from './dika-icons';

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

  const constrainPosition = (x: number, y: number) => {
    const buttonSize = 44;
    const margin = 10;
    const bottomNavHeight = 80; // Account for mobile bottom navigation
    
    return {
      x: Math.max(margin, Math.min(window.innerWidth - buttonSize - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - buttonSize - margin - bottomNavHeight, y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    hasMoved.current = false;
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
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      
      const touch = e.touches[0];
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
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, onClick, onPositionChange]);

  const renderIcon = () => {
    const iconClass = "w-6 h-6 text-white";
    switch (icon) {
      case 'sunflower':
        return <SunflowerIcon className={iconClass} />;
      case 'bat':
        return <BatIcon className={iconClass} />;
      case 'circle':
      default:
        return <DikaCircleIcon className={iconClass} />;
    }
  };

  return (
    <button
      ref={buttonRef}
      data-testid="button-dika"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "fixed z-50 w-12 h-12 rounded-full",
        "bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600",
        "shadow-[0_0_20px_rgba(139,92,246,0.5)]",
        "flex items-center justify-center",
        "cursor-grab active:cursor-grabbing",
        "transition-all duration-200 hover:scale-110 hover:shadow-[0_0_30px_rgba(139,92,246,0.7)]",
        "ring-2 ring-white/20",
        isDragging && "scale-110 opacity-90"
      )}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
      aria-label="Ask Dika"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
      {renderIcon()}
    </button>
  );
}
