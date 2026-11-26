import React, { useEffect, useId, useRef, useState } from 'react';
import type { AnnotationItem } from '../types/archive';

export interface LinkCoordinates {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ArcLinkOverlayProps {
  activeAnnotation: AnnotationItem | null;
  coords: LinkCoordinates | null;
}

type ArcPhase = 'entering' | 'visible' | 'exiting';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates a cubic Bezier curve for t in [0, 1] and linearly extrapolates
 * along the endpoint tangents outside [0, 1] so moving gradients keep a
 * consistent span as they glide into and out of the anchor endpoints.
 */
function evalCubicBezier(
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number,
  t: number,
): { x: number; y: number } {
  if (t < 0) {
    return {
      x: x1 + 3 * (cx1 - x1) * t,
      y: y1 + 3 * (cy1 - y1) * t,
    };
  }
  if (t > 1) {
    const dt = t - 1;
    return {
      x: x2 + 3 * (x2 - cx2) * dt,
      y: y2 + 3 * (y2 - cy2) * dt,
    };
  }
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * x1 + 3 * mt2 * t * cx1 + 3 * mt * t2 * cx2 + t2 * t * x2,
    y: mt2 * mt * y1 + 3 * mt2 * t * cy1 + 3 * mt * t2 * cy2 + t2 * t * y2,
  };
}

/**
 * Renders the signature ArcVault optical Bezier Arc-Link connecting the highlighted
 * text anchor inside the editor `(x1, y1)` to its parallel Comment/Revision card `(x2, y2)`,
 * featuring silky entrance/exit transitions, smooth coordinate morphing when switching
 * cards, and a luminous directional pulse flowing from source text toward the card.
 */
export const ArcLinkOverlay: React.FC<ArcLinkOverlayProps> = ({ activeAnnotation, coords }) => {
  const uid = useId().replace(/:/g, '');
  const glowFilterId = `arc-link-glow-${uid}`;
  const baseGradId = `arc-link-grad-${uid}`;
  const pulseColorGradId = `arc-link-pulse-color-${uid}`;
  const pulseCoreGradId = `arc-link-pulse-core-${uid}`;

  const isActive = Boolean(activeAnnotation && coords);
  const [mounted, setMounted] = useState(isActive);
  const [phase, setPhase] = useState<ArcPhase>(isActive ? 'visible' : 'exiting');
  const [renderCoords, setRenderCoords] = useState<LinkCoordinates | null>(coords);
  const [cachedType, setCachedType] = useState<AnnotationItem['type']>(
    activeAnnotation?.type ?? 'comment',
  );

  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const renderCoordsRef = useRef(renderCoords);
  renderCoordsRef.current = renderCoords;
  const targetCoordsRef = useRef<LinkCoordinates | null>(coords);
  targetCoordsRef.current = coords;

  const pulseColorGradRef = useRef<SVGLinearGradientElement | null>(null);
  const pulseCoreGradRef = useRef<SVGLinearGradientElement | null>(null);
  const pulseInnerGroupRef = useRef<SVGGElement | null>(null);

  const morphRafRef = useRef<number | null>(null);
  const pulseRafRef = useRef<number | null>(null);
  const enterRaf1Ref = useRef<number | null>(null);
  const enterRaf2Ref = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeAnnotation) {
      setCachedType(activeAnnotation.type);
    }
  }, [activeAnnotation]);

  // Handle mount -> draw-in and graceful fade-out -> unmount
  useEffect(() => {
    if (enterRaf1Ref.current !== null) cancelAnimationFrame(enterRaf1Ref.current);
    if (enterRaf2Ref.current !== null) cancelAnimationFrame(enterRaf2Ref.current);
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (isActive && coords) {
      if (!mountedRef.current) {
        setRenderCoords(coords);
        renderCoordsRef.current = coords;
        setMounted(true);
        mountedRef.current = true;
        setPhase('entering');
        enterRaf1Ref.current = requestAnimationFrame(() => {
          enterRaf2Ref.current = requestAnimationFrame(() => {
            setPhase('visible');
          });
        });
      } else {
        setPhase('visible');
      }
    } else if (mountedRef.current) {
      setPhase('exiting');
      exitTimerRef.current = window.setTimeout(() => {
        setMounted(false);
        mountedRef.current = false;
        exitTimerRef.current = null;
      }, 260);
    }
  }, [isActive, coords]);

  // Smooth damped coordinate morphing when moving across annotations or scrolling
  useEffect(() => {
    if (!isActive || !coords) return;

    if (!renderCoordsRef.current) {
      setRenderCoords(coords);
      renderCoordsRef.current = coords;
      return;
    }

    if (morphRafRef.current !== null) cancelAnimationFrame(morphRafRef.current);

    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const cur = renderCoordsRef.current;
      const target = targetCoordsRef.current;
      if (!cur || !target) {
        morphRafRef.current = null;
        return;
      }

      const k = 1 - Math.exp(-dt * 16);
      const next: LinkCoordinates = {
        x1: cur.x1 + (target.x1 - cur.x1) * k,
        y1: cur.y1 + (target.y1 - cur.y1) * k,
        x2: cur.x2 + (target.x2 - cur.x2) * k,
        y2: cur.y2 + (target.y2 - cur.y2) * k,
      };

      const maxDiff = Math.max(
        Math.abs(target.x1 - next.x1),
        Math.abs(target.y1 - next.y1),
        Math.abs(target.x2 - next.x2),
        Math.abs(target.y2 - next.y2),
      );

      if (maxDiff < 0.25) {
        setRenderCoords(target);
        renderCoordsRef.current = target;
        morphRafRef.current = null;
        return;
      }

      setRenderCoords(next);
      renderCoordsRef.current = next;
      morphRafRef.current = requestAnimationFrame(tick);
    };

    morphRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (morphRafRef.current !== null) {
        cancelAnimationFrame(morphRafRef.current);
        morphRafRef.current = null;
      }
    };
  }, [isActive, coords]);

  // Animate the highlight pulse gradient along the Bezier curve with head/tail opacity fade
  useEffect(() => {
    if (!mounted) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      pulseInnerGroupRef.current?.setAttribute('opacity', '0');
      return;
    }

    const CYCLE_MS = 2400;
    const DELAY_MS = 280;
    const TRAVEL_FRAC = 0.68;
    const PULSE_LEN = 0.34;
    const startTs = performance.now() + DELAY_MS;

    const tickPulse = (now: number) => {
      const cur = renderCoordsRef.current;
      const inner = pulseInnerGroupRef.current;
      const colorGrad = pulseColorGradRef.current;
      const coreGrad = pulseCoreGradRef.current;

      if (!cur || !inner || !colorGrad || !coreGrad || now < startTs) {
        inner?.setAttribute('opacity', '0');
        pulseRafRef.current = requestAnimationFrame(tickPulse);
        return;
      }

      const cyclePos = ((now - startTs) % CYCLE_MS) / CYCLE_MS;
      if (cyclePos >= TRAVEL_FRAC) {
        inner.setAttribute('opacity', '0');
        pulseRafRef.current = requestAnimationFrame(tickPulse);
        return;
      }

      const rawU = cyclePos / TRAVEL_FRAC;
      const u = rawU * 0.45 + (3 * rawU * rawU - 2 * rawU * rawU * rawU) * 0.55;
      const center = -PULSE_LEN * 0.5 + u * (1 + PULSE_LEN);
      const tTail = center - PULSE_LEN * 0.5;
      const tHead = center + PULSE_LEN * 0.5;

      const spanX = Math.max(40, Math.abs(cur.x2 - cur.x1));
      const archLift = Math.min(26, Math.max(10, spanX * 0.08));
      const cx1 = cur.x1 + (cur.x2 - cur.x1) * 0.42;
      const cx2 = cur.x1 + (cur.x2 - cur.x1) * 0.58;

      const tailPt = evalCubicBezier(cur.x1, cur.y1, cx1, cur.y1 - archLift, cx2, cur.y2 - archLift, cur.x2, cur.y2, tTail);
      const headPt = evalCubicBezier(cur.x1, cur.y1, cx1, cur.y1 - archLift, cx2, cur.y2 - archLift, cur.x2, cur.y2, tHead);
      if (Math.hypot(headPt.x - tailPt.x, headPt.y - tailPt.y) < 0.5) {
        headPt.x += 1;
      }

      const x1Str = tailPt.x.toFixed(2);
      const y1Str = tailPt.y.toFixed(2);
      const x2Str = headPt.x.toFixed(2);
      const y2Str = headPt.y.toFixed(2);

      colorGrad.setAttribute('x1', x1Str);
      colorGrad.setAttribute('y1', y1Str);
      colorGrad.setAttribute('x2', x2Str);
      colorGrad.setAttribute('y2', y2Str);

      coreGrad.setAttribute('x1', x1Str);
      coreGrad.setAttribute('y1', y1Str);
      coreGrad.setAttribute('x2', x2Str);
      coreGrad.setAttribute('y2', y2Str);

      const env = smoothstep(0, 0.14, u) * (1 - smoothstep(0.84, 1, u));
      inner.setAttribute('opacity', env.toFixed(3));

      pulseRafRef.current = requestAnimationFrame(tickPulse);
    };

    pulseRafRef.current = requestAnimationFrame(tickPulse);
    return () => {
      if (pulseRafRef.current !== null) {
        cancelAnimationFrame(pulseRafRef.current);
        pulseRafRef.current = null;
      }
    };
  }, [mounted]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      if (morphRafRef.current !== null) cancelAnimationFrame(morphRafRef.current);
      if (pulseRafRef.current !== null) cancelAnimationFrame(pulseRafRef.current);
      if (enterRaf1Ref.current !== null) cancelAnimationFrame(enterRaf1Ref.current);
      if (enterRaf2Ref.current !== null) cancelAnimationFrame(enterRaf2Ref.current);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  if (!mounted || !renderCoords) return null;

  const { x1, y1, x2, y2 } = renderCoords;
  const spanX = Math.max(40, Math.abs(x2 - x1));
  const archLift = Math.min(26, Math.max(10, spanX * 0.08));
  const cx1 = x1 + (x2 - x1) * 0.42;
  const cx2 = x1 + (x2 - x1) * 0.58;
  const path = `M ${x1} ${y1} C ${cx1} ${y1 - archLift}, ${cx2} ${y2 - archLift}, ${x2} ${y2}`;

  const strokeColor =
    cachedType === 'comment'
      ? 'var(--arc-comment-color)'
      : 'var(--arc-revision-color)';

  const svgClassName = [
    'arc-link-svg',
    phase === 'visible' ? 'is-visible' : phase === 'exiting' ? 'is-exiting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg className={svgClassName} aria-hidden="true">
      <defs>
        <filter id={glowFilterId} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <linearGradient
          id={baseGradId}
          gradientUnits="userSpaceOnUse"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
        >
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.55} />
          <stop offset="18%" stopColor={strokeColor} stopOpacity={0.95} />
          <stop offset="82%" stopColor={strokeColor} stopOpacity={0.95} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.78} />
        </linearGradient>
        <linearGradient
          ref={pulseColorGradRef}
          id={pulseColorGradId}
          gradientUnits="userSpaceOnUse"
          x1={x1}
          y1={y1}
          x2={x1 + 1}
          y2={y1}
        >
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0} />
          <stop offset="22%" stopColor={strokeColor} stopOpacity={0.32} />
          <stop offset="54%" stopColor={strokeColor} stopOpacity={1} />
          <stop offset="80%" stopColor={strokeColor} stopOpacity={0.72} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
        <linearGradient
          ref={pulseCoreGradRef}
          id={pulseCoreGradId}
          gradientUnits="userSpaceOnUse"
          x1={x1}
          y1={y1}
          x2={x1 + 1}
          y2={y1}
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="28%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="56%" stopColor="#ffffff" stopOpacity={0.92} />
          <stop offset="76%" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Ambient soft glow guide */}
      <path
        className="arc-link-glow-path"
        d={path}
        pathLength={100}
        fill="none"
        stroke={strokeColor}
        strokeWidth={6.5}
        strokeOpacity={0.18}
        strokeLinecap="round"
      />

      {/* Tapered optical Bezier guide */}
      <path
        className="arc-link-base-path"
        d={path}
        pathLength={100}
        fill="none"
        stroke={`url(#${baseGradId})`}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Directional luminous pulse flowing from source text (x1, y1) -> card (x2, y2) */}
      <g className="arc-link-pulse-group">
        <g ref={pulseInnerGroupRef} opacity={0}>
          <path
            className="arc-link-pulse-glow"
            d={path}
            fill="none"
            stroke={`url(#${pulseColorGradId})`}
            strokeWidth={6.5}
            strokeOpacity={0.52}
            strokeLinecap="round"
            filter={`url(#${glowFilterId})`}
          />
          <path
            className="arc-link-pulse-mid"
            d={path}
            fill="none"
            stroke={`url(#${pulseColorGradId})`}
            strokeWidth={2.8}
            strokeOpacity={0.95}
            strokeLinecap="round"
          />
          <path
            className="arc-link-pulse-core"
            d={path}
            fill="none"
            stroke={`url(#${pulseCoreGradId})`}
            strokeWidth={1.35}
            strokeOpacity={0.9}
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* Source anchor expanding ripple + dot */}
      <circle
        className="arc-link-origin-ring"
        cx={x1}
        cy={y1}
        r={5}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.6}
      />
      <circle className="arc-link-dot" cx={x1} cy={y1} r={3.8} fill={strokeColor} />

      {/* Target card halo + dot */}
      <circle
        className="arc-link-dot"
        cx={x2}
        cy={y2}
        r={7}
        fill={strokeColor}
        fillOpacity={0.18}
      />
      <circle className="arc-link-dot" cx={x2} cy={y2} r={4} fill={strokeColor} />
    </svg>
  );
};
