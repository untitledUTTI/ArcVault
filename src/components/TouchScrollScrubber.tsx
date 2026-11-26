import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  HapticPattern,
  ScrollScrubberSettings,
  ScrollScrubberShape,
  ThemeId,
} from '../types/archive';

export interface ScrubberMetricsInput {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  trackHeight: number;
  minThumbHeight?: number;
}

export interface ScrubberMetrics {
  scrollable: boolean;
  ratio: number;
  percent: number;
  thumbHeight: number;
  thumbTop: number;
}

export interface ScrubberHeading {
  title: string;
  level: number;
  ratio: number;
}

export type ResolvedScrubberShape = Exclude<ScrollScrubberShape, 'auto'>;

export const DEFAULT_SCROLL_SCRUBBER: ScrollScrubberSettings = {
  size: 40,
  shape: 'auto',
};

const VALID_SHAPES: readonly ScrollScrubberShape[] = [
  'auto',
  'orb',
  'squircle',
  'm3-clover',
  'm3-burst',
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeScrollScrubberSettings(
  raw?: Partial<ScrollScrubberSettings> | null,
): ScrollScrubberSettings {
  const rawSize = typeof raw?.size === 'number' && Number.isFinite(raw.size)
    ? raw.size
    : DEFAULT_SCROLL_SCRUBBER.size;
  const size = Math.round(clamp(rawSize, 28, 60));
  const shape: ScrollScrubberShape =
    raw?.shape && VALID_SHAPES.includes(raw.shape)
      ? raw.shape
      : DEFAULT_SCROLL_SCRUBBER.shape;
  return { size, shape };
}

export function resolveThemeScrubberShape(
  theme: ThemeId,
  override: ScrollScrubberShape = 'auto',
): ResolvedScrubberShape {
  if (override !== 'auto') return override;
  switch (theme) {
    case 'm3-expressive':
      return 'm3-burst';
    case 'light':
    case 'paper':
      return 'squircle';
    case 'dark':
    case 'celestial-optics':
    case 'weather-live':
    default:
      return 'orb';
  }
}

export function buildM3ScallopPath(
  lobes: number,
  baseR: number,
  amp: number,
  steps = 96,
): string {
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = baseR + amp * Math.cos(lobes * theta);
    const x = 50 + r * Math.cos(theta);
    const y = 50 + r * Math.sin(theta);
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  pts.push('Z');
  return pts.join(' ');
}

const M3_BURST_PATH = buildM3ScallopPath(8, 40.5, 6.2);
const M3_CLOVER_PATH = buildM3ScallopPath(4, 39, 8.5);

function cleanHeadingTitle(raw: string): string {
  return raw
    .replace(/\[@(?:zotero|endnote):\d{3}\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\{|\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDocumentHeadings(text: string): ScrubberHeading[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const totalLines = lines.length;
  const headings: ScrubberHeading[] = [];
  let inCodeFence = false;

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const ratio = totalLines <= 1 ? 0 : i / (totalLines - 1);

    const mdMatch = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (mdMatch) {
      const title = cleanHeadingTitle(mdMatch[2]);
      if (title) {
        headings.push({ title, level: mdMatch[1].length, ratio });
      }
      continue;
    }

    const latexMatch = /^\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]+)\}/.exec(line);
    if (latexMatch) {
      const cmd = latexMatch[1];
      const level =
        cmd === 'part' ? 1 :
        cmd === 'chapter' ? 1 :
        cmd === 'section' ? 2 :
        cmd === 'subsection' ? 3 : 4;
      const title = cleanHeadingTitle(latexMatch[2]);
      if (title) {
        headings.push({ title, level, ratio });
      }
      continue;
    }

    if (
      line.length <= 48 &&
      /^第[一二三四五六七八九十百零\d]+[章节篇部](?:\s+|[:：、.])/.test(line)
    ) {
      const title = cleanHeadingTitle(line);
      if (title) {
        headings.push({ title, level: 2, ratio });
      }
    }
  }

  return headings;
}

export function resolveHeadingAtRatio(
  headings: ScrubberHeading[],
  ratio: number,
): ScrubberHeading | null {
  if (headings.length === 0) return null;
  let active: ScrubberHeading | null = null;
  for (const h of headings) {
    if (h.ratio <= ratio + 0.015) {
      active = h;
    } else {
      break;
    }
  }
  if (!active && headings[0].ratio < 0.08) {
    return headings[0];
  }
  return active;
}

export function computeScrubberMetrics({
  scrollTop,
  scrollHeight,
  clientHeight,
  trackHeight,
  minThumbHeight = 40,
}: ScrubberMetricsInput): ScrubberMetrics {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 1 || clientHeight <= 0 || trackHeight <= 0) {
    return {
      scrollable: false,
      ratio: 0,
      percent: 0,
      thumbHeight: 0,
      thumbTop: 0,
    };
  }

  const ratio = clamp(scrollTop / maxScroll, 0, 1);
  const thumbHeight = Math.min(minThumbHeight, trackHeight);
  const usableSpan = Math.max(0, trackHeight - thumbHeight);
  const thumbTop = usableSpan * ratio;

  return {
    scrollable: true,
    ratio,
    percent: Math.round(ratio * 100),
    thumbHeight,
    thumbTop,
  };
}

export function computeRatioFromPointerY(
  pointerY: number,
  trackTop: number,
  trackHeight: number,
  thumbHeight: number,
  grabOffsetInThumb: number,
): number {
  const usableSpan = Math.max(1, trackHeight - thumbHeight);
  return clamp((pointerY - trackTop - grabOffsetInThumb) / usableSpan, 0, 1);
}

function extractDomElementHeadingText(node: Element): string {
  const titleAttr = node.getAttribute('data-scroll-heading');
  if (titleAttr && titleAttr.trim()) return titleAttr.trim();

  if (node.classList.contains('arc-settings-card-title')) {
    const firstChild = node.firstElementChild;
    if (firstChild && firstChild.tagName !== 'BUTTON') {
      const t = firstChild.textContent?.replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button').forEach((b) => b.remove());
    return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function resolveDomHeadingForContainer(el: HTMLElement): string | null {
  const candidates = el.querySelectorAll(
    'h1, h2, h3, h4, .arc-settings-card-title, [data-scroll-heading]',
  );
  if (candidates.length === 0) return null;

  const containerRect = el.getBoundingClientRect();
  const threshold = containerRect.top + Math.min(96, containerRect.height * 0.25);

  let matched: string | null = null;
  let firstTitle: string | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const node = candidates[i];
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const text = extractDomElementHeadingText(node);
    if (!text) continue;
    if (!firstTitle) firstTitle = text;
    if (rect.top <= threshold) {
      matched = text;
    }
  }

  return matched ?? firstTitle;
}

export function isArticleScrollContainer(el: HTMLElement): boolean {
  if (
    el.closest(
      '.arc-annotation-pane, .arc-annotation-card, .arc-sheet, .arc-modal, .arc-sidebar, .arc-timeline-panel',
    )
  ) {
    return false;
  }
  if (el.classList.contains('arc-editor-pane') || el.classList.contains('arc-preview-pane')) {
    return true;
  }
  if (el.classList.contains('cm-scroller') && Boolean(el.closest('.arc-editor-pane'))) {
    return true;
  }
  return false;
}

export interface ScrubberHandleGlyphProps {
  shape: ResolvedScrubberShape;
  size: number;
  theme?: ThemeId;
  dragging?: boolean;
  rotationDeg?: number;
}

export function ScrubberHandleGlyph({
  shape,
  size,
  theme,
  dragging = false,
  rotationDeg = 0,
}: ScrubberHandleGlyphProps) {
  const gradId = useId();
  const isM3Shape = shape === 'm3-burst' || shape === 'm3-clover';
  const iconSize = Math.round(clamp(size * 0.44, 13, 24));
  const svgPath = shape === 'm3-clover' ? M3_CLOVER_PATH : M3_BURST_PATH;

  return (
    <div
      className={`arc-touch-scrubber-handle shape-${shape} ${dragging ? 'is-dragging' : ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {isM3Shape && (
        <svg
          className="arc-touch-scrubber-svg"
          viewBox="0 0 100 100"
          aria-hidden="true"
          style={{
            transform: `rotate(${rotationDeg.toFixed(1)}deg)`,
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="arc-scrubber-stop-start" />
              <stop offset="100%" className="arc-scrubber-stop-end" />
            </linearGradient>
          </defs>
          <path
            d={svgPath}
            fill={`url(#${gradId})`}
            className="arc-touch-scrubber-svg-path"
          />
        </svg>
      )}
      {!isM3Shape && <span className="arc-touch-scrubber-sheen" aria-hidden="true" />}
      <svg
        className="arc-touch-scrubber-chevrons"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 9l4-4 4 4" />
        <path d="M8 15l4 4 4-4" />
      </svg>
      {theme === 'celestial-optics' && !isM3Shape && (
        <span className="arc-touch-scrubber-star" aria-hidden="true" />
      )}
    </div>
  );
}

interface ScrubberBox {
  top: number;
  right: number;
  height: number;
}

interface ScrubberRenderState {
  visible: boolean;
  dragging: boolean;
  box: ScrubberBox;
  metrics: ScrubberMetrics;
  headingLabel: string;
}

const FADE_OUT_DELAY_MS = 2000;
const MIN_OVERFLOW_PX = 24;
const MIN_TRACK_HEIGHT_PX = 56;

const INITIAL_RENDER_STATE: ScrubberRenderState = {
  visible: false,
  dragging: false,
  box: { top: 0, right: 10, height: 0 },
  metrics: {
    scrollable: false,
    ratio: 0,
    percent: 0,
    thumbHeight: 40,
    thumbTop: 0,
  },
  headingLabel: '',
};

export interface TouchScrollScrubberProps {
  enabled: boolean;
  theme: ThemeId;
  scrubberSettings?: ScrollScrubberSettings;
  activeDocText?: string;
  activeDocTitle?: string;
  onHaptic?: (pattern: HapticPattern) => void;
}

export function TouchScrollScrubber({
  enabled,
  theme,
  scrubberSettings,
  activeDocText = '',
  activeDocTitle = '',
  onHaptic,
}: TouchScrollScrubberProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hitRef = useRef<HTMLDivElement | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const lastScrollTopMapRef = useRef<WeakMap<HTMLElement, number>>(new WeakMap());
  const draggingRef = useRef(false);
  const lastHeadingRef = useRef<string>('');
  const dragContextRef = useRef<{
    trackClientTop: number;
    trackHeight: number;
    thumbHeight: number;
    grabOffset: number;
    hitEdge: 'top' | 'bottom' | null;
  }>({
    trackClientTop: 0,
    trackHeight: 0,
    thumbHeight: 40,
    grabOffset: 20,
    hitEdge: null,
  });

  const normalizedSettings = useMemo(
    () => normalizeScrollScrubberSettings(scrubberSettings),
    [scrubberSettings],
  );
  const resolvedShape = useMemo(
    () => resolveThemeScrubberShape(theme, normalizedSettings.shape),
    [theme, normalizedSettings.shape],
  );
  const docHeadings = useMemo(
    () => extractDocumentHeadings(activeDocText),
    [activeDocText],
  );

  const docHeadingsRef = useRef(docHeadings);
  docHeadingsRef.current = docHeadings;
  const activeDocTitleRef = useRef(activeDocTitle);
  activeDocTitleRef.current = activeDocTitle;
  const handleSizeRef = useRef(normalizedSettings.size);
  handleSizeRef.current = normalizedSettings.size;

  const [state, setState] = useState<ScrubberRenderState>(INITIAL_RENDER_STATE);

  const resolveLabelForTarget = useCallback(
    (el: HTMLElement, ratio: number, percent: number): string => {
      const isEditorPane =
        el.classList.contains('arc-editor-pane') ||
        el.classList.contains('cm-scroller') ||
        Boolean(el.querySelector('.cm-editor'));

      if (isEditorPane) {
        const heading = resolveHeadingAtRatio(docHeadingsRef.current, ratio);
        if (heading?.title) return heading.title;
        if (activeDocTitleRef.current.trim()) return activeDocTitleRef.current.trim();
        return `正文 ${percent}%`;
      }

      const domHeading = resolveDomHeadingForContainer(el);
      if (domHeading) return domHeading;

      if (activeDocTitleRef.current.trim()) return activeDocTitleRef.current.trim();
      return `正文 ${percent}%`;
    },
    [],
  );

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      if (draggingRef.current) return;
      setState((prev) => (prev.visible ? { ...prev, visible: false, dragging: false } : prev));
    }, FADE_OUT_DELAY_MS);
  }, [clearHideTimer]);

  const computeElementGeometry = useCallback(
    (
      el: HTMLElement,
    ): {
      box: ScrubberBox;
      metrics: ScrubberMetrics;
      trackClientTop: number;
    } | null => {
      const hostEl = hostRef.current;
      if (!hostEl || !document.contains(el)) return null;
      if (el.scrollHeight - el.clientHeight <= MIN_OVERFLOW_PX) return null;

      const hostRect = hostEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (hostRect.width <= 0 || hostRect.height <= 0 || elRect.width <= 0 || elRect.height <= 0) {
        return null;
      }

      const visibleTop = Math.max(elRect.top, hostRect.top);
      const visibleBottom = Math.min(elRect.bottom, hostRect.bottom);
      const visibleHeight = visibleBottom - visibleTop;
      if (visibleHeight <= MIN_TRACK_HEIGHT_PX) return null;

      const visibleRight = Math.min(elRect.right, hostRect.right);
      if (visibleRight <= hostRect.left + 44) return null;

      const padY = Math.min(18, Math.max(8, visibleHeight * 0.055));
      const trackHeight = visibleHeight - padY * 2;
      if (trackHeight < MIN_TRACK_HEIGHT_PX) return null;

      const trackClientTop = visibleTop + padY;
      const box: ScrubberBox = {
        top: trackClientTop - hostRect.top,
        right: Math.max(8, hostRect.right - visibleRight + 10),
        height: trackHeight,
      };

      const metrics = computeScrubberMetrics({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        trackHeight,
        minThumbHeight: handleSizeRef.current,
      });
      if (!metrics.scrollable) return null;

      return { box, metrics, trackClientTop };
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      clearHideTimer();
      draggingRef.current = false;
      targetElRef.current = null;
      setState(INITIAL_RENDER_STATE);
      return;
    }

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === document.documentElement || target === document.body) return;
      if (!isArticleScrollContainer(target)) return;

      const prevTop = lastScrollTopMapRef.current.get(target);
      const currentTop = target.scrollTop;
      lastScrollTopMapRef.current.set(target, currentTop);

      if (draggingRef.current) {
        return;
      }

      if (prevTop !== undefined) {
        if (Math.abs(currentTop - prevTop) < 0.5) return;
      } else if (currentTop === 0) {
        return;
      }

      const geom = computeElementGeometry(target);
      if (!geom) return;

      const label = resolveLabelForTarget(target, geom.metrics.ratio, geom.metrics.percent);
      lastHeadingRef.current = label;
      targetElRef.current = target;
      setState({
        visible: true,
        dragging: false,
        box: geom.box,
        metrics: geom.metrics,
        headingLabel: label,
      });
      scheduleHide();
    };

    const handleViewportResize = () => {
      if (draggingRef.current) return;
      clearHideTimer();
      setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleViewportResize);
    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleViewportResize);
      clearHideTimer();
    };
  }, [clearHideTimer, computeElementGeometry, enabled, resolveLabelForTarget, scheduleHide]);

  // Dismiss early when tapping/clicking anywhere outside the scrubber handle
  useEffect(() => {
    if (!enabled || !state.visible) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (draggingRef.current) return;
      const target = event.target;
      if (target instanceof Node && hitRef.current?.contains(target)) {
        return;
      }
      clearHideTimer();
      setState((prev) => (prev.visible ? { ...prev, visible: false, dragging: false } : prev));
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [clearHideTimer, enabled, state.visible]);

  // Reflect live handle size adjustments immediately if currently visible
  useEffect(() => {
    const el = targetElRef.current;
    if (!enabled || !el || !state.visible) return;
    const geom = computeElementGeometry(el);
    if (!geom) return;
    const label = resolveLabelForTarget(el, geom.metrics.ratio, geom.metrics.percent);
    setState((prev) => ({
      ...prev,
      box: geom.box,
      metrics: geom.metrics,
      headingLabel: label,
    }));
  }, [computeElementGeometry, enabled, normalizedSettings.size, resolveLabelForTarget, state.visible]);

  const applyDragScroll = useCallback(
    (el: HTMLElement, nextRatio: number) => {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const nextScrollTop = nextRatio * maxScroll;
      lastScrollTopMapRef.current.set(el, nextScrollTop);
      el.scrollTop = nextScrollTop;

      const { trackHeight, thumbHeight } = dragContextRef.current;
      const usableSpan = Math.max(0, trackHeight - thumbHeight);
      const thumbTop = usableSpan * nextRatio;
      const percent = Math.round(nextRatio * 100);
      const nextLabel = resolveLabelForTarget(el, nextRatio, percent);

      if (nextLabel && nextLabel !== lastHeadingRef.current) {
        lastHeadingRef.current = nextLabel;
        onHaptic?.('selection');
      }

      setState((prev) => ({
        ...prev,
        visible: true,
        dragging: true,
        headingLabel: nextLabel,
        metrics: {
          ...prev.metrics,
          ratio: nextRatio,
          percent,
          thumbTop,
        },
      }));

      if (nextRatio <= 0.002) {
        if (dragContextRef.current.hitEdge !== 'top') {
          dragContextRef.current.hitEdge = 'top';
          onHaptic?.('selection');
        }
      } else if (nextRatio >= 0.998) {
        if (dragContextRef.current.hitEdge !== 'bottom') {
          dragContextRef.current.hitEdge = 'bottom';
          onHaptic?.('selection');
        }
      } else {
        dragContextRef.current.hitEdge = null;
      }
    },
    [onHaptic, resolveLabelForTarget],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = targetElRef.current;
      if (!enabled || !el || !document.contains(el)) {
        setState((prev) => ({ ...prev, visible: false, dragging: false }));
        return;
      }

      const geom = computeElementGeometry(el);
      if (!geom) {
        setState((prev) => ({ ...prev, visible: false, dragging: false }));
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      clearHideTimer();
      draggingRef.current = true;
      onHaptic?.('light');

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer capture errors
      }

      const { trackClientTop, box, metrics } = geom;
      const pointerLocalY = e.clientY - trackClientTop;
      const grabOffset = clamp(pointerLocalY - metrics.thumbTop, 0, metrics.thumbHeight);

      dragContextRef.current = {
        trackClientTop,
        trackHeight: box.height,
        thumbHeight: metrics.thumbHeight,
        grabOffset,
        hitEdge: null,
      };

      const label = resolveLabelForTarget(el, metrics.ratio, metrics.percent);
      lastHeadingRef.current = label;
      setState({
        visible: true,
        dragging: true,
        box,
        metrics,
        headingLabel: label,
      });
    },
    [clearHideTimer, computeElementGeometry, enabled, onHaptic, resolveLabelForTarget],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const el = targetElRef.current;
      if (!el || !document.contains(el)) {
        draggingRef.current = false;
        setState((prev) => ({ ...prev, visible: false, dragging: false }));
        return;
      }

      e.preventDefault();
      const { trackClientTop, trackHeight, thumbHeight, grabOffset } = dragContextRef.current;
      const nextRatio = computeRatioFromPointerY(
        e.clientY,
        trackClientTop,
        trackHeight,
        thumbHeight,
        grabOffset,
      );
      applyDragScroll(el, nextRatio);
    },
    [applyDragScroll],
  );

  const finishDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore synthetic pointer release errors
      }
      setState((prev) => ({ ...prev, dragging: false }));
      scheduleHide();
    },
    [scheduleHide],
  );

  if (!enabled) return null;

  const { visible, dragging, box, metrics, headingLabel } = state;
  const handleSize = metrics.thumbHeight || normalizedSettings.size;
  const anchorTop = box.top + metrics.thumbTop;
  const rotationDeg =
    resolvedShape === 'm3-burst' || resolvedShape === 'm3-clover'
      ? metrics.ratio * 90
      : 0;

  return (
    <div ref={hostRef} className="arc-touch-scrubber-host" aria-hidden={!visible}>
      <div
        className={`arc-touch-scrubber-anchor ${visible ? 'is-visible' : ''} ${dragging ? 'is-dragging' : ''}`}
        style={
          {
            top: `${anchorTop}px`,
            right: `${box.right}px`,
            height: `${handleSize}px`,
          } as CSSProperties
        }
      >
        <div
          className={`arc-touch-scrubber-label shape-${resolvedShape}`}
          aria-live="polite"
        >
          <span className="arc-touch-scrubber-label-title">
            {headingLabel || `位置 ${metrics.percent}%`}
          </span>
          <span className="arc-touch-scrubber-label-pct">{metrics.percent}%</span>
        </div>

        <div
          ref={hitRef}
          className="arc-touch-scrubber-hit"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          role="scrollbar"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={metrics.percent}
          aria-label="页面快速滚动滑块"
        >
          <ScrubberHandleGlyph
            shape={resolvedShape}
            size={handleSize}
            theme={theme}
            dragging={dragging}
            rotationDeg={rotationDeg}
          />
        </div>
      </div>
    </div>
  );
}
