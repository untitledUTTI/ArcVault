import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
  placeBelow: boolean;
}

/**
 * Automatically intercepts native browser `title` attributes across the entire app
 * and renders a single, smooth, theme-integrated tooltip matching Light, Dark, Paper,
 * and Material 3 Expressive (including live Monet colors).
 */
export const GlobalTooltipHost: React.FC = () => {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    text: '',
    x: 0,
    y: 0,
    placeBelow: true,
  });

  const activeElRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const hideTooltip = () => {
      clearTimer();
      activeElRef.current = null;
      setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    const normalizeTooltipElement = (rawTarget: EventTarget | null): { el: HTMLElement | null; text: string | null } => {
      const targetEl = rawTarget instanceof HTMLElement ? rawTarget : null;
      const el = targetEl?.closest?.('[title], [data-arc-tooltip]') as HTMLElement | null;
      if (!el) return { el: null, text: null };

      // Always normalize native `title` -> `data-arc-tooltip` so browsers never show
      // an unstyled native tooltip (including on mobile tap or long-press).
      let tipText = el.getAttribute('title');
      if (tipText && tipText.trim()) {
        el.setAttribute('data-arc-tooltip', tipText);
        el.removeAttribute('title');
      } else {
        tipText = el.getAttribute('data-arc-tooltip');
      }
      return { el, text: tipText };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        lastTouchTimeRef.current = Date.now();
      }
      normalizeTooltipElement(e.target);
      hideTooltip();
    };

    const onTouchStart = (e: TouchEvent) => {
      lastTouchTimeRef.current = Date.now();
      normalizeTooltipElement(e.target);
      hideTooltip();
    };

    const onFocusIn = (e: FocusEvent) => {
      normalizeTooltipElement(e.target);
      if (document.documentElement.dataset.device === 'phone') {
        hideTooltip();
      }
    };

    const showForElement = (el: HTMLElement, text: string) => {
      if (document.documentElement.dataset.device === 'phone') return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const placeBelow = rect.top < 72;
      const centerX = rect.left + rect.width / 2;
      const clampedX = Math.max(88, Math.min(window.innerWidth - 88, centerX));
      const y = placeBelow ? rect.bottom + 8 : rect.top - 8;

      setState({
        visible: true,
        text,
        x: clampedX,
        y,
        placeBelow,
      });
    };

    const onMouseOver = (e: MouseEvent) => {
      const { el, text: tipText } = normalizeTooltipElement(e.target);

      if (!el) {
        if (activeElRef.current) hideTooltip();
        return;
      }

      // Phone: strictly disable hover tooltips to prevent accidental popups on tap.
      // Tablet & Desktop: allow hover tooltips (mouse/trackpad/stylus), while ignoring
      // synthetic mouseover events emitted right after a finger tap.
      const isPhone = document.documentElement.dataset.device === 'phone';
      const isRecentTouch = Date.now() - lastTouchTimeRef.current < 800;
      if (isPhone || isRecentTouch) {
        hideTooltip();
        return;
      }

      if (!tipText || !tipText.trim()) {
        hideTooltip();
        return;
      }

      if (activeElRef.current === el) return;
      clearTimer();
      activeElRef.current = el;

      const capturedText = tipText;
      timerRef.current = window.setTimeout(() => {
        if (
          document.documentElement.dataset.device !== 'phone' &&
          activeElRef.current === el &&
          document.body.contains(el)
        ) {
          showForElement(el, capturedText);
        }
      }, 240);
    };

    const onMouseOut = (e: MouseEvent) => {
      const current = activeElRef.current;
      if (!current) return;
      const related = e.relatedTarget as Node | null;
      if (related && current.contains(related)) return;
      hideTooltip();
    };

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('blur', hideTooltip);

    return () => {
      clearTimer();
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('scroll', hideTooltip, true);
      window.removeEventListener('blur', hideTooltip);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="tooltip"
      className={`arc-global-tooltip ${state.visible ? 'is-visible' : ''} ${state.placeBelow ? 'below' : 'above'}`}
      style={{
        left: state.x,
        top: state.y,
      }}
    >
      {state.text}
    </div>,
    document.body,
  );
};
