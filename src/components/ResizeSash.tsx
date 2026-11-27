import React, { useEffect, useRef, useState } from 'react';

export interface ResizeSashProps {
  orientation: 'vertical' | 'horizontal';
  title?: string;
  style?: React.CSSProperties;
  className?: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Interactive resize divider with center-outward expanding highlight on hover
 * and periodic dual-direction traveling glow pulses while hovered or dragged.
 */
export const ResizeSash: React.FC<ResizeSashProps> = ({
  orientation,
  title,
  style,
  className,
  onPointerDown,
}) => {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pulseMounted, setPulseMounted] = useState(false);

  const hoveredRef = useRef(false);
  const leaveTimerRef = useRef<number | null>(null);
  const pointerUpCleanupRef = useRef<(() => void) | null>(null);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLeaveTimer();
      pointerUpCleanupRef.current?.();
      pointerUpCleanupRef.current = null;
    };
  }, []);

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    clearLeaveTimer();
    hoveredRef.current = true;
    setHovered(true);
    setPulseMounted(true);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    hoveredRef.current = false;
    setHovered(false);
    if (!dragging) {
      clearLeaveTimer();
      leaveTimerRef.current = window.setTimeout(() => {
        setPulseMounted(false);
        leaveTimerRef.current = null;
      }, 300);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLeaveTimer();
    if (e.pointerType === 'touch') {
      hoveredRef.current = false;
      setHovered(false);
    }
    setDragging(true);
    setPulseMounted(true);

    pointerUpCleanupRef.current?.();
    const onPointerUp = () => {
      setDragging(false);
      hoveredRef.current = false;
      setHovered(false);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      pointerUpCleanupRef.current = null;
      clearLeaveTimer();
      leaveTimerRef.current = window.setTimeout(() => {
        setPulseMounted(false);
        leaveTimerRef.current = null;
      }, 220);
    };
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    pointerUpCleanupRef.current = () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    onPointerDown(e);
  };

  const rootClassName = [
    orientation === 'vertical' ? 'arc-resizer-v' : 'arc-resizer-h',
    hovered || dragging ? 'is-active' : '',
    pulseMounted ? 'is-pulsing' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClassName}
      title={title}
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <span className="arc-resizer-highlight" aria-hidden="true" />
      <span className="arc-resizer-pulses" aria-hidden="true">
        <span className="arc-resizer-half is-start">
          <span className="arc-resizer-pulse is-start" />
        </span>
        <span className="arc-resizer-half is-end">
          <span className="arc-resizer-pulse is-end" />
        </span>
      </span>
    </div>
  );
};
