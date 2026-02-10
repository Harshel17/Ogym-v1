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
  const isDraggingRef = useRef(false);
  const posRef = useRef({ x: position.x, y: position.y });
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebug = useCallback((msg: string) => {
    if (!DEBUG_TOUCH) return;
    const t = new Date();
    const ts = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
    setDebugLog(prev => [...prev, `${ts}: ${msg}`].slice(-10));
  }, []);

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const addDebugRef = useRef(addDebug);
  addDebugRef.current = addDebug;

  const applyPosition = useCallback((x: number, y: number) => {
    const btn = buttonRef.current;
    if (btn) {
      btn.style.transform = `translate3d(${x}px, ${y}px, 0)`;
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

      addDebugRef.current(`TSTART x=${Math.round(startX)} y=${Math.round(startY)} btnX=${Math.round(currentPos.x)} btnY=${Math.round(currentPos.y)}`);

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
          addDebugRef.current(`DRAG_START`);
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }

        const newPos = constrainPosition(t.clientX - offsetX, t.clientY - offsetY);
        posRef.current = newPos;
        button.style.transform = `translate3d(${newPos.x}px, ${newPos.y}px, 0)`;

        if (moveCount <= 3 || moveCount % 20 === 0) {
          addDebugRef.current(`MOVE #${moveCount} -> ${Math.round(newPos.x)},${Math.round(newPos.y)}`);
        }
      };

      const handleTouchEnd = (ev: TouchEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);

        addDebugRef.current(`TEND moves=${moveCount} dragged=${draggedRef.current} pos=${Math.round(posRef.current.x)},${Math.round(posRef.current.y)}`);

        if (!draggedRef.current) {
          isDraggingRef.current = false;
          addDebugRef.current(`TAP -> open`);
          onClickRef.current();
        } else {
          const finalPos = posRef.current;
          isDraggingRef.current = false;
          onPositionChangeRef.current(finalPos);
        }
        draggedRef.current = false;
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    };

    button.addEventListener('touchstart', handleTouchStart, { passive: false });

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
