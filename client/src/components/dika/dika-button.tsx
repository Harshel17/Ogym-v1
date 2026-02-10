import { useRef, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';
import { DikaCircleIcon, SunflowerIcon, BatIcon, RoboDIcon } from './dika-icons';

const DRAG_THRESHOLD = 8;
const DEBUG_TOUCH = true;

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
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebug = useCallback((msg: string) => {
    if (!DEBUG_TOUCH) return;
    setDebugLog(prev => {
      const next = [...prev, `${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}: ${msg}`];
      return next.slice(-8);
    });
  }, []);

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const addDebugRef = useRef(addDebug);
  addDebugRef.current = addDebug;

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

      addDebugRef.current(`TSTART x=${Math.round(startX)} y=${Math.round(startY)}`);

      const rect = button.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;

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

        if (moveCount <= 3 || moveCount % 10 === 0) {
          addDebugRef.current(`TMOVE #${moveCount} dx=${Math.round(dx)} dy=${Math.round(dy)} dist=${Math.round(distance)}`);
        }

        if (distance < DRAG_THRESHOLD && !draggedRef.current) return;

        if (!draggedRef.current) {
          draggedRef.current = true;
          addDebugRef.current(`DRAG_START`);
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }

        const newPos = constrainPosition(t.clientX - offsetX, t.clientY - offsetY);
        onPositionChangeRef.current(newPos);
      };

      const handleTouchEnd = (ev: TouchEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        addDebugRef.current(`TEND moves=${moveCount} dragged=${draggedRef.current}`);

        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);

        if (!draggedRef.current) {
          addDebugRef.current(`TAP -> opening drawer`);
          onClickRef.current();
        }
        draggedRef.current = false;
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    };

    button.addEventListener('touchstart', handleTouchStart, { passive: false });

    addDebugRef.current(`INIT listener attached`);

    return () => {
      button.removeEventListener('touchstart', handleTouchStart);
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

  const handleClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onClick();
  }, [onClick]);

  return (
    <>
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
          "transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-amber-500/40",
          "border border-amber-400/30",
        )}
        style={{
          left: position.x,
          top: position.y,
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

      {DEBUG_TOUCH && debugLog.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 50,
            left: 8,
            right: 8,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.85)',
            color: '#0f0',
            fontSize: '11px',
            fontFamily: 'monospace',
            padding: '8px',
            borderRadius: '8px',
            pointerEvents: 'none',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {debugLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </>
  );
}
