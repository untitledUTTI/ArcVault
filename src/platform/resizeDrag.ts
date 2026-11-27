import type React from 'react';

/**
 * Starts a smooth pointer-based drag resize operation across horizontal or vertical panel boundaries.
 * Toggles `is-resizing` on root so CSS transitions pause during live drag and resume cleanly after release.
 */
export function startResizeDrag(params: {
  event: React.PointerEvent;
  axis: 'x' | 'y';
  initialSize: number;
  min: number;
  max: number;
  invert?: boolean;
  onResize: (nextSize: number) => void;
}): void {
  const { event, axis, initialSize, min, max, invert = false, onResize } = params;
  event.preventDefault();
  const startCoord = axis === 'x' ? event.clientX : event.clientY;
  const prevSelect = document.body.style.userSelect;
  const prevCursor = document.body.style.cursor;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
  document.documentElement.classList.add('is-resizing');

  const onMove = (moveEvt: PointerEvent) => {
    const currentCoord = axis === 'x' ? moveEvt.clientX : moveEvt.clientY;
    const rawDelta = currentCoord - startCoord;
    const delta = invert ? -rawDelta : rawDelta;
    const clamped = Math.max(min, Math.min(max, Math.round(initialSize + delta)));
    onResize(clamped);
  };

  const onUp = () => {
    document.body.style.userSelect = prevSelect;
    document.body.style.cursor = prevCursor;
    document.documentElement.classList.remove('is-resizing');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
