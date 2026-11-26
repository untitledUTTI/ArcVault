import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Fingerprint,
  FolderOpen,
  GitBranch,
  HardDrive,
  Languages,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Palette,
  Play,
  RotateCcw,
  Scissors,
  Shield,
  ShieldAlert,
  Sparkles,
  Square,
  Wifi,
  X,
} from 'lucide-react';
import { ArcVaultLogo } from './ArcVaultLogo';
import {
  MOBILE_PERMISSION_CARDS,
  TUTORIAL_CONFIRM_PHRASE,
  TUTORIAL_MODULES,
  TUTORIAL_WARNING_COUNTDOWN_SECONDS,
  TUTORIAL_WARNING_TEXT,
  areAllMobilePermissionsGranted,
  buildTutorialFlow,
  canConfirmWarning,
  canProceedFromCacheSetup,
  canUnlockWarningInput,
  computeGuideCardPlacement,
  formatActionGateButtonText,
  getInitialTutorialPhase,
  getStepAdvanceRelation,
  shouldShowMobilePermissionsStep,
  type MobilePermissionCardDef,
  type SpotlightRect,
  type TutorialMode,
  type TutorialModuleId,
  type TutorialPhase,
  type TutorialSceneId,
} from '../core/tutorial';
import {
  isTauriRuntime,
  nativeWindowClose,
  nativeWindowIsMaximized,
  nativeWindowMinimize,
  nativeWindowToggleMaximize,
  subscribeNativeWindowResized,
} from '../platform/bridge';
import type { DeviceEnvironment } from '../platform/device';
import type { I18nDict } from '../i18n/dictionaries';
import type { HapticPattern, Locale, ThemeId } from '../types/archive';

const WELCOME_THEMES: ThemeId[] = [
  'light',
  'dark',
  'paper',
  'm3-expressive',
  'celestial-optics',
  'weather-live',
];

export interface TutorialOverlayProps {
  mode: TutorialMode;
  deviceEnv: DeviceEnvironment;
  dict: I18nDict;
  theme: ThemeId;
  locale: Locale;
  readyToStart?: boolean;
  runtimeInfo?: {
    isTauri: boolean;
    platform: string;
    vaultDir: string;
    backupDir?: string;
  };
  onPickVaultDirectory?: () => Promise<string | null>;
  onSetCustomVaultDir?: (path: string) => Promise<void>;
  onSelectTheme: (theme: ThemeId) => void;
  onToggleLocale: () => void;
  onHaptic?: (pattern: HapticPattern) => void;
  onApplyScene: (scene: TutorialSceneId) => void;
  onCompleteFirstRun: () => void;
  onCloseReplay: () => void;
}

function isElementVisible(el: Element): el is HTMLElement {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  return true;
}

function findVisibleElement(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const matches = Array.from(document.querySelectorAll(sel));
    for (const el of matches) {
      if (isElementVisible(el)) return el;
    }
  }
  return null;
}

function findAllVisibleElements(selectors: string[]): HTMLElement[] {
  const result: HTMLElement[] = [];
  const seen = new Set<Element>();
  for (const sel of selectors) {
    const matches = Array.from(document.querySelectorAll(sel));
    for (const el of matches) {
      if (!seen.has(el) && isElementVisible(el)) {
        seen.add(el);
        result.push(el);
      }
    }
  }
  return result;
}

function unionRects(rects: DOMRect[]): DOMRect | null {
  if (rects.length === 0) return null;
  let left = rects[0].left;
  let top = rects[0].top;
  let right = rects[0].right;
  let bottom = rects[0].bottom;
  for (let i = 1; i < rects.length; i++) {
    left = Math.min(left, rects[i].left);
    top = Math.min(top, rects[i].top);
    right = Math.max(right, rects[i].right);
    bottom = Math.max(bottom, rects[i].bottom);
  }
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  mode,
  deviceEnv,
  dict,
  theme,
  locale,
  readyToStart = true,
  runtimeInfo,
  onPickVaultDirectory,
  onSetCustomVaultDir,
  onSelectTheme,
  onToggleLocale,
  onHaptic,
  onApplyScene,
  onCompleteFirstRun,
  onCloseReplay,
}) => {
  const isFirstRun = mode === 'first-run';
  const isCompact = deviceEnv.isPhone || deviceEnv.isTabletPortrait;
  const currentOs = deviceEnv.os ?? 'windows';
  const isDesktopTauri = isTauriRuntime() && !deviceEnv.isPhone && !deviceEnv.isTablet;
  const isMacOverlay = isDesktopTauri && currentOs === 'macos';
  const showCustomWinControls = isDesktopTauri && currentOs !== 'macos';

  const [phase, setPhase] = useState<TutorialPhase>(() => getInitialTutorialPhase(mode));
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<TutorialModuleId[]>(() =>
    TUTORIAL_MODULES.map((m) => m.id),
  );

  const steps = useMemo(
    () => buildTutorialFlow(mode, mode === 'replay' ? selectedIds : undefined),
    [mode, selectedIds],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];

  // First-run mandatory cache directory setup & warning state
  const [cacheChoice, setCacheChoice] = useState<'default' | 'custom' | null>(null);
  const [customCachePath, setCustomCachePath] = useState('');
  const [cacheApplying, setCacheApplying] = useState(false);
  const [cacheAppliedPath, setCacheAppliedPath] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
  const [showIgnorePermWarning, setShowIgnorePermWarning] = useState(false);
  const [remainingSec, setRemainingSec] = useState(TUTORIAL_WARNING_COUNTDOWN_SECONDS);
  const [confirmInput, setConfirmInput] = useState('');

  // Spotlight measurement state (relative to .arc-tour-root)
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1280, height: 800 });
  const [cardSize, setCardSize] = useState({ width: 390, height: 240 });
  const [cutout, setCutout] = useState<SpotlightRect | null>(null);
  const [actionGateFallbackUnlocked, setActionGateFallbackUnlocked] = useState(false);
  const [isCardTranslucent, setIsCardTranslucent] = useState(false);

  const advancingRef = useRef(false);
  const lastScrolledStepIdRef = useRef<string | null>(null);

  const activeSpotlightStep =
    phase === 'player' && currentStep?.kind === 'step' ? currentStep.step : null;
  const activeStepKey = activeSpotlightStep?.id ?? null;

  // Sync window maximize state while the desktop welcome screen is visible
  useEffect(() => {
    if (!isDesktopTauri || phase !== 'welcome') return;
    let active = true;
    let unlisten: (() => void) | null = null;
    nativeWindowIsMaximized().then((max) => {
      if (active) setIsMaximized(max);
    });
    subscribeNativeWindowResized((max) => {
      if (active) setIsMaximized(max);
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [isDesktopTauri, phase]);

  // Apply the real app scene whenever the spotlight step changes
  useEffect(() => {
    advancingRef.current = false;
    setActionGateFallbackUnlocked(false);
    setIsCardTranslucent(false);
    if (phase !== 'player') return;
    if (currentStep?.kind === 'step') {
      onApplyScene(currentStep.step.scene);
    } else if (currentStep?.kind === 'cache-setup' || currentStep?.kind === 'warning') {
      onApplyScene('limitations-overview');
    }
  }, [phase, currentStep, onApplyScene]);

  // Keyboard handling: block Escape in first-run; close on Escape in replay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFirstRun) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          e.preventDefault();
          e.stopPropagation();
          onCloseReplay();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isFirstRun, onCloseReplay]);

  // Mandatory 10-second warning countdown timer
  const isOnWarningStep = phase === 'player' && currentStep?.kind === 'warning';
  const isWarningCountdownDone = remainingSec <= 0;
  useEffect(() => {
    if (!isFirstRun || !isOnWarningStep || isWarningCountdownDone) return;
    const id = window.setInterval(() => {
      setRemainingSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isFirstRun, isOnWarningStep, isWarningCountdownDone]);

  // Measure overlay container & spotlight target dynamically
  const measureSpotlight = useCallback(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const rootRect = rootEl.getBoundingClientRect();
    const cw = Math.max(1, Math.round(rootRect.width));
    const ch = Math.max(1, Math.round(rootRect.height));
    setContainerSize((prev) =>
      prev.width === cw && prev.height === ch ? prev : { width: cw, height: ch },
    );

    if (!activeSpotlightStep || activeSpotlightStep.targetSelectors.length === 0) {
      setCutout(null);
      return;
    }

    const primary = findVisibleElement(activeSpotlightStep.targetSelectors);
    if (!primary) {
      setCutout(null);
      return;
    }

    if (lastScrolledStepIdRef.current !== activeSpotlightStep.id) {
      lastScrolledStepIdRef.current = activeSpotlightStep.id;
      const pRect = primary.getBoundingClientRect();
      if (
        pRect.top < rootRect.top + 8 ||
        pRect.bottom > rootRect.bottom - 8 ||
        pRect.left < rootRect.left + 8 ||
        pRect.right > rootRect.right - 8
      ) {
        try {
          primary.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch {
          // ignore unsupported scrollIntoView options
        }
      }
    }

    const unionEls = activeSpotlightStep.unionSelectors
      ? findAllVisibleElements(activeSpotlightStep.unionSelectors)
      : [];
    const targetEls = unionEls.length > 0 ? unionEls : [primary];
    const union = unionRects(targetEls.map((el) => el.getBoundingClientRect()));
    if (!union || union.width <= 0 || union.height <= 0) {
      setCutout(null);
      return;
    }

    const pad = activeSpotlightStep.padding ?? 6;
    const rawLeft = union.left - rootRect.left - pad;
    const rawTop = union.top - rootRect.top - pad;
    const rawRight = union.right - rootRect.left + pad;
    const rawBottom = union.bottom - rootRect.top + pad;

    const clampedLeft = Math.max(0, Math.round(rawLeft));
    const clampedTop = Math.max(0, Math.round(rawTop));
    const clampedRight = Math.min(cw, Math.round(rawRight));
    const clampedBottom = Math.min(ch, Math.round(rawBottom));
    const width = Math.max(0, clampedRight - clampedLeft);
    const height = Math.max(0, clampedBottom - clampedTop);

    if (width <= 2 || height <= 2) {
      setCutout(null);
      return;
    }

    setCutout((prev) => {
      if (
        prev &&
        Math.abs(prev.top - clampedTop) <= 1 &&
        Math.abs(prev.left - clampedLeft) <= 1 &&
        Math.abs(prev.width - width) <= 1 &&
        Math.abs(prev.height - height) <= 1
      ) {
        return prev;
      }
      return { top: clampedTop, left: clampedLeft, width, height };
    });
  }, [activeSpotlightStep]);

  useLayoutEffect(() => {
    measureSpotlight();
  }, [measureSpotlight]);

  useEffect(() => {
    if (phase !== 'player') return;
    const rafId = requestAnimationFrame(measureSpotlight);
    const t1 = window.setTimeout(measureSpotlight, 70);
    const t2 = window.setTimeout(measureSpotlight, 200);
    const t3 = window.setTimeout(measureSpotlight, 380);

    const onViewportChange = () => measureSpotlight();
    const onTransitionEnd = () => {
      requestAnimationFrame(measureSpotlight);
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    document.addEventListener('transitionend', onTransitionEnd, true);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measureSpotlight);
      if (rootRef.current) ro.observe(rootRef.current);
      if (activeSpotlightStep?.targetSelectors.length) {
        const primary = findVisibleElement(activeSpotlightStep.targetSelectors);
        if (primary) ro.observe(primary);
      }
    }

    let mo: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        requestAnimationFrame(measureSpotlight);
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'open', 'aria-expanded'],
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      document.removeEventListener('transitionend', onTransitionEnd, true);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [phase, activeStepKey, activeSpotlightStep, measureSpotlight]);

  // Measure the guide card itself so placement never overflows viewport or collides with cutout
  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;
    const updateSize = () => {
      const r = cardEl.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w > 0 && h > 0) {
        setCardSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateSize);
    ro.observe(cardEl);
    return () => ro.disconnect();
  }, [activeStepKey, phase, isCompact]);

  const advanceNext = useCallback(() => {
    onHaptic?.('selection');
    setStepIndex((idx) => {
      if (idx + 1 >= steps.length) {
        return idx;
      }
      return idx + 1;
    });
  }, [onHaptic, steps.length]);

  const handleFinishReplay = useCallback(() => {
    onHaptic?.('success');
    onCloseReplay();
  }, [onHaptic, onCloseReplay]);

  // Action-gated auto-advance: listen in capture phase on document so real React handlers run uninterrupted
  useEffect(() => {
    if (phase !== 'player' || !activeSpotlightStep?.actionGate) return;
    const gate = activeSpotlightStep.actionGate;

    // Safeguard: if trigger element isn't present after 900ms, unlock Next button so user is never stuck
    const fallbackTimer = window.setTimeout(() => {
      const triggerEl = findVisibleElement([gate.triggerSelector]);
      if (!triggerEl) {
        setActionGateFallbackUnlocked(true);
      }
    }, 900);

    const onCaptureClick = (e: MouseEvent) => {
      if (advancingRef.current) return;
      const target = e.target as Element | null;
      if (!target) return;
      const matched =
        target.closest(gate.triggerSelector) ??
        (gate.fallbackTriggerSelector ? target.closest(gate.fallbackTriggerSelector) : null);
      if (!matched) return;
      if ((matched as HTMLButtonElement).disabled) return;

      advancingRef.current = true;
      window.setTimeout(() => {
        if (stepIndex + 1 >= steps.length) {
          if (!isFirstRun) handleFinishReplay();
        } else {
          advanceNext();
        }
      }, 220);
    };

    document.addEventListener('click', onCaptureClick, true);
    return () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('click', onCaptureClick, true);
    };
  }, [
    phase,
    activeSpotlightStep,
    stepIndex,
    steps.length,
    isFirstRun,
    advanceNext,
    handleFinishReplay,
  ]);

  // On phone, gently slide the bottom quickbar right and back left on ws-format to hint horizontal scrolling
  useEffect(() => {
    if (phase !== 'player' || activeStepKey !== 'ws-format' || !deviceEnv.isPhone) return;
    let cancelled = false;
    let rafId = 0;
    const timers: number[] = [];

    const startNudge = () => {
      const scrollEl = document.querySelector<HTMLElement>(
        '[data-tour="mobile-format-bar"] .arc-mobile-quickbar-scroll',
      );
      if (!scrollEl) return;
      const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
      if (maxScroll <= 8) return;

      const targetX = Math.min(maxScroll, Math.max(88, Math.round(maxScroll * 0.55)));
      const startX = scrollEl.scrollLeft;

      const animateScroll = (from: number, to: number, durationMs: number, onDone?: () => void) => {
        const startTime = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const t = Math.min(1, (now - startTime) / durationMs);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          scrollEl.scrollLeft = from + (to - from) * eased;
          if (t < 1) {
            rafId = requestAnimationFrame(tick);
          } else {
            onDone?.();
          }
        };
        rafId = requestAnimationFrame(tick);
      };

      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          animateScroll(startX, targetX, 480, () => {
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) {
                  animateScroll(targetX, startX, 460);
                }
              }, 220),
            );
          });
        }, 280),
      );
    };

    timers.push(window.setTimeout(startNudge, 80));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, activeStepKey, deviceEnv.isPhone]);

  const toggleSelectedModule = (id: TutorialModuleId) => {
    onHaptic?.('selection');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const startReplayWith = (ids: TutorialModuleId[]) => {
    if (ids.length === 0) return;
    onHaptic?.('medium');
    setSelectedIds(ids);
    setStepIndex(0);
    setPhase('player');
  };

  const blockOutsideEvent = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 0. First-Launch Welcome Screen (allows adjusting window position/size before starting tutorial)
  if (isFirstRun && phase === 'welcome') {
    const highlightIcons = [Layers, Scissors, GitBranch, Shield];
    const windowHintText = isDesktopTauri
      ? dict.welcome.windowHintDesktop
      : deviceEnv.isTouch
        ? dict.welcome.windowHintTouch
        : dict.welcome.windowHintWeb;

    return (
      <div ref={rootRef} className="arc-tour-root arc-welcome-root">
        <div className="arc-welcome-overlay">
          <div
            className={[
              'arc-welcome-titlebar',
              isDesktopTauri ? 'is-immersive' : '',
              isMacOverlay ? 'is-macos-overlay' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-tauri-drag-region={isDesktopTauri ? '' : undefined}
          >
            <div className="arc-welcome-titlebar-brand">
              <ArcVaultLogo size={22} theme={theme} />
              <span>{dict.brandName}</span>
            </div>

            <div
              className="arc-welcome-titlebar-spacer"
              data-tauri-drag-region={isDesktopTauri ? '' : undefined}
            />

            <div className="arc-welcome-titlebar-actions">
              <button
                type="button"
                className="arc-btn"
                style={{ height: 28, fontSize: 12, padding: '0 10px' }}
                onClick={() => {
                  onHaptic?.('selection');
                  onToggleLocale();
                }}
              >
                <Languages size={14} />
                <span>{locale === 'zh-CN' ? 'EN' : '中文'}</span>
              </button>

              {showCustomWinControls && (
                <div className="arc-win-controls" role="group" aria-label={dict.topbar.winControls}>
                  <button
                    type="button"
                    className="arc-win-ctrl-btn"
                    onClick={() => void nativeWindowMinimize()}
                    title={dict.topbar.winMinimize}
                    aria-label={dict.topbar.winMinimize}
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    type="button"
                    className="arc-win-ctrl-btn"
                    onClick={async () => setIsMaximized(await nativeWindowToggleMaximize())}
                    title={isMaximized ? dict.topbar.winRestore : dict.topbar.winMaximize}
                    aria-label={isMaximized ? dict.topbar.winRestore : dict.topbar.winMaximize}
                  >
                    {isMaximized ? <Copy size={12} /> : <Square size={12} />}
                  </button>
                  <button
                    type="button"
                    className="arc-win-ctrl-btn is-close"
                    onClick={() => void nativeWindowClose()}
                    title={dict.topbar.winClose}
                    aria-label={dict.topbar.winClose}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            className="arc-welcome-stage"
            data-tauri-drag-region={isDesktopTauri ? '' : undefined}
          >
            <div
              className="arc-welcome-card"
              role="dialog"
              aria-modal="true"
              aria-label={dict.welcome.title}
            >
              <div className="arc-welcome-hero">
                <div className="arc-welcome-logo-emblem">
                  <ArcVaultLogo size={58} theme={theme} />
                </div>
                <div className="arc-welcome-hero-copy">
                  <span className="arc-badge" style={{ alignSelf: 'flex-start', fontWeight: 700 }}>
                    {dict.welcome.badge}
                  </span>
                  <h1 className="arc-welcome-title">{dict.welcome.title}</h1>
                  <p className="arc-welcome-subtitle">{dict.welcome.subtitle}</p>
                </div>
              </div>

              <div className="arc-welcome-window-bar">
                <div className="arc-welcome-window-hint">
                  <Move size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span>{windowHintText}</span>
                </div>
                {isDesktopTauri && (
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 28, fontSize: 12, padding: '0 10px', flexShrink: 0 }}
                    onClick={async () => {
                      onHaptic?.('light');
                      setIsMaximized(await nativeWindowToggleMaximize());
                    }}
                  >
                    {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isMaximized ? dict.welcome.restoreBtn : dict.welcome.maximizeBtn}</span>
                  </button>
                )}
              </div>

              <div className="arc-welcome-highlights">
                {dict.welcome.highlights.map((item, idx) => {
                  const IconComp = highlightIcons[idx] ?? Sparkles;
                  return (
                    <div key={item.title} className="arc-welcome-highlight-item">
                      <span className="arc-welcome-highlight-icon">
                        <IconComp size={15} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="arc-welcome-highlight-title">{item.title}</div>
                        <div className="arc-welcome-highlight-desc">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="arc-welcome-theme-row">
                <span className="arc-welcome-theme-label">
                  <Palette size={13} />
                  <span>{dict.welcome.themeLabel}</span>
                </span>
                {WELCOME_THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`arc-welcome-theme-chip ${theme === t ? 'is-active' : ''}`}
                    onClick={() => {
                      onHaptic?.('selection');
                      onSelectTheme(t);
                    }}
                  >
                    {dict.themes[t]}
                  </button>
                ))}
              </div>

              <div className="arc-welcome-footer">
                <p className="arc-welcome-tutorial-hint">{dict.welcome.tutorialHint}</p>
                <button
                  type="button"
                  data-tour="welcome-enter-btn"
                  className="arc-btn arc-btn-primary arc-welcome-enter-btn"
                  disabled={!readyToStart}
                  onClick={() => {
                    onHaptic?.('medium');
                    if (shouldShowMobilePermissionsStep(mode, deviceEnv)) {
                      setPhase('permissions');
                    } else {
                      setStepIndex(0);
                      setPhase('player');
                    }
                  }}
                >
                  <span>{readyToStart ? dict.welcome.enterBtn : dict.welcome.preparingBtn}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 0.5. Android Mobile/Tablet Permission Request Screen (between Welcome & Tutorial)
  if (isFirstRun && phase === 'permissions') {
    const allPermissionsGranted = areAllMobilePermissionsGranted(grantedPermissions);

    const handlePermissionCardClick = async (card: MobilePermissionCardDef) => {
      onHaptic?.('light');
      if (card.id === 'camera' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // Even if system prompt is unavailable in preview WebView, allow user confirmation toggle
        }
      } else if (card.id === 'storage' && onPickVaultDirectory) {
        await onPickVaultDirectory().catch(() => null);
      }
      setGrantedPermissions((prev) =>
        prev.includes(card.id) ? prev : [...prev, card.id],
      );
      onHaptic?.('success');
    };

    const permissionIconMap: Record<MobilePermissionCardDef['id'], React.ReactNode> = {
      storage: <HardDrive size={18} color="var(--accent)" />,
      camera: <Camera size={18} color="var(--accent)" />,
      'local-network': <Wifi size={18} color="var(--accent)" />,
      biometric: <Fingerprint size={18} color="var(--accent)" />,
    };

    return (
      <div ref={rootRef} className="arc-tour-root">
        <div
          className="arc-modal-backdrop arc-tour-modal-backdrop"
          onClick={blockOutsideEvent}
          onMouseDown={blockOutsideEvent}
          onPointerDown={blockOutsideEvent}
        >
          <div
            className={`arc-modal arc-tour-warning-modal ${isCompact ? 'is-compact' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="移动端权限申请"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="arc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="var(--accent)" />
                <strong style={{ fontSize: 15 }}>应用权限申请</strong>
              </div>
              <span className="arc-badge">
                已授权 {grantedPermissions.length} / {MOBILE_PERMISSION_CARDS.length}
              </span>
            </div>

            <div className="arc-modal-body" style={{ padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                为确保本地文档缓存、纸质稿扫码与局域网同步等功能正常使用，请点击下方卡片逐项跳转授权：
              </p>

              <div className="arc-perm-card-list">
                {MOBILE_PERMISSION_CARDS.map((card) => {
                  const granted = grantedPermissions.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`arc-perm-card ${granted ? 'is-granted' : ''}`}
                      onClick={() => void handlePermissionCardClick(card)}
                    >
                      <div className="arc-perm-card-icon">{permissionIconMap[card.id]}</div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 13.5 }}>{card.title}</strong>
                          {card.required && (
                            <span className="arc-badge" style={{ fontSize: 10 }}>
                              建议必开
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                          {card.description}
                        </div>
                      </div>
                      <span
                        className={`arc-badge ${granted ? 'is-granted' : ''}`}
                        style={{
                          flexShrink: 0,
                          color: granted ? '#16a34a' : 'var(--accent)',
                          borderColor: granted ? 'rgba(22, 163, 74, 0.4)' : undefined,
                          background: granted ? 'rgba(22, 163, 74, 0.12)' : undefined,
                        }}
                      >
                        {granted ? '已授权' : card.actionLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="arc-modal-footer arc-tutorial-footer is-warning-footer">
              <button
                type="button"
                className="arc-btn"
                onClick={() => {
                  onHaptic?.('selection');
                  setShowIgnorePermWarning(false);
                  setPhase('welcome');
                }}
              >
                <ChevronLeft size={14} />
                <span>返回</span>
              </button>

              <button
                type="button"
                className={`arc-btn ${allPermissionsGranted ? 'arc-btn-primary' : ''}`}
                onClick={() => {
                  if (allPermissionsGranted) {
                    onHaptic?.('medium');
                    setStepIndex(0);
                    setPhase('player');
                  } else {
                    onHaptic?.('warning');
                    setShowIgnorePermWarning(true);
                  }
                }}
              >
                <span>{allPermissionsGranted ? '开始教程' : '忽略'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {showIgnorePermWarning && (
            <div
              className="arc-modal-backdrop"
              style={{ zIndex: 370 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowIgnorePermWarning(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className="arc-modal"
                style={{ width: 'min(420px, 90vw)' }}
                role="alertdialog"
                aria-modal="true"
                aria-label="权限未完全授权提示"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="arc-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={17} color="#d97706" />
                    <strong style={{ fontSize: 14.5 }}>权限未全部授权</strong>
                  </div>
                </div>
                <div className="arc-modal-body" style={{ padding: 16, fontSize: 13, lineHeight: 1.65 }}>
                  当前仍有部分权限未开启，忽略后可能导致本地文件存储、相机扫描或局域网同步等对应功能暂时不可用（后续仍可在系统设置中开启）。确认直接进入教程吗？
                </div>
                <div className="arc-modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="arc-btn"
                    onClick={() => {
                      onHaptic?.('selection');
                      setShowIgnorePermWarning(false);
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-btn-primary"
                    onClick={() => {
                      onHaptic?.('medium');
                      setShowIgnorePermWarning(false);
                      setStepIndex(0);
                      setPhase('player');
                    }}
                  >
                    确认进入
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 1. Replay Picker Overlay
  if (!isFirstRun && phase === 'picker') {
    return (
      <div ref={rootRef} className="arc-tour-root">
        <div
          className="arc-modal-backdrop arc-tour-modal-backdrop"
          onClick={onCloseReplay}
        >
          <div
            className={`arc-modal arc-tour-picker-modal ${isCompact ? 'is-compact' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="选择重播互动使用教程板块"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="arc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <BookOpen size={18} color="var(--accent)" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    互动使用教程 · 实景交互重播
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    勾选你想重温的 1 个或多个板块，将直接在软件真实界面上高亮引导体验（无末尾警告）
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="arc-btn arc-icon-btn"
                onClick={onCloseReplay}
                aria-label="关闭教程"
              >
                <X size={15} />
              </button>
            </div>

            <div className="arc-modal-body" style={{ padding: 16, overflowY: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  已选 <strong>{selectedIds.length}</strong> / {TUTORIAL_MODULES.length} 个板块
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 28, fontSize: 12 }}
                    onClick={() => setSelectedIds(TUTORIAL_MODULES.map((m) => m.id))}
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 28, fontSize: 12 }}
                    onClick={() => setSelectedIds([])}
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="arc-tutorial-picker-grid">
                {TUTORIAL_MODULES.map((mod, idx) => {
                  const checked = selectedIds.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      className={`arc-tutorial-picker-card ${checked ? 'is-selected' : ''}`}
                      onClick={() => toggleSelectedModule(mod.id)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectedModule(mod.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span>
                            {idx + 1}. {mod.title}
                          </span>
                        </label>
                        <span className="arc-badge">{mod.badge}</span>
                      </div>
                      <p
                        style={{
                          margin: '6px 0 8px',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                        }}
                      >
                        {mod.summary}
                      </p>
                      <button
                        type="button"
                        className="arc-btn"
                        style={{
                          height: 25,
                          fontSize: 11.5,
                          padding: '0 9px',
                          alignSelf: 'flex-start',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startReplayWith([mod.id]);
                        }}
                      >
                        <Play size={11} />
                        <span>单看本节 ({mod.steps.length} 步)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="arc-modal-footer arc-tutorial-footer">
              <button type="button" className="arc-btn" onClick={onCloseReplay}>
                关闭
              </button>
              <button
                type="button"
                className="arc-btn arc-btn-primary"
                disabled={selectedIds.length === 0}
                onClick={() => startReplayWith(selectedIds)}
              >
                <Play size={13} />
                <span>开始实景体验已选板块 ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2A. First-Run Mandatory Cache & Backup Directory Setup (before Warning)
  if (currentStep?.kind === 'cache-setup') {
    const canProceed =
      canProceedFromCacheSetup(cacheChoice, cacheAppliedPath ?? customCachePath) &&
      (cacheChoice === 'default' || Boolean(cacheAppliedPath));

    const applyCustomPath = async (rawPath: string) => {
      const target = rawPath.trim();
      if (!target) {
        setCacheError('请先选择或输入有效的自定义缓存目录路径');
        return;
      }
      setCacheError(null);
      setCacheApplying(true);
      try {
        await onSetCustomVaultDir?.(target);
        setCustomCachePath(target);
        setCacheAppliedPath(target);
        setCacheChoice('custom');
        onHaptic?.('success');
      } catch (err) {
        setCacheError(err instanceof Error ? err.message : String(err));
        onHaptic?.('error');
      } finally {
        setCacheApplying(false);
      }
    };

    return (
      <div ref={rootRef} className="arc-tour-root">
        <div
          className="arc-modal-backdrop arc-tour-modal-backdrop"
          onClick={blockOutsideEvent}
          onMouseDown={blockOutsideEvent}
          onPointerDown={blockOutsideEvent}
        >
          <div
            className="arc-modal arc-tour-warning-modal"
            role="dialog"
            aria-modal="true"
            aria-label="设置缓存与备份目录"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="arc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOpen size={18} color="var(--accent)" />
                <strong style={{ fontSize: 15 }}>
                  设置缓存与自动备份目录（首次启动必选）
                </strong>
              </div>
              <span className="arc-badge">第 {stepIndex + 1} / {steps.length} 步</span>
            </div>

            <div className="arc-modal-body" style={{ padding: 16 }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  建议自定义缓存目录，防止 C 盘 / 系统盘空间占满
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
                  ArcVault 的 CAS 去重快照、封面资源与自动定时备份都会存放在此目录中。
                  <strong style={{ color: 'var(--text-primary)' }}>
                    无论桌面端还是移动端，后续你都可以随时在「设置 → 归档与常规」或「设置 → 关于」中查看目录路径、修改位置，并一键跳转打开缓存目录与自动备份目录。
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                  wordBreak: 'break-all',
                }}
              >
                <div>
                  当前缓存目录：<strong style={{ color: 'var(--text-primary)' }}>{runtimeInfo?.vaultDir ?? '默认本地目录'}</strong>
                </div>
                <div>
                  自动备份目录：<strong style={{ color: 'var(--text-primary)' }}>{runtimeInfo?.backupDir ?? '默认备份目录'}</strong>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  请选择一种方式后继续（必选）：
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `1.5px solid ${cacheChoice === 'custom' ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: cacheChoice === 'custom' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>方式一：指定自定义缓存目录（推荐）</strong>
                    {onPickVaultDirectory && (
                      <button
                        type="button"
                        className="arc-btn arc-btn-primary"
                        style={{ height: 30, fontSize: 12 }}
                        disabled={cacheApplying}
                        onClick={async () => {
                          onHaptic?.('light');
                          const picked = await onPickVaultDirectory();
                          if (picked) {
                            await applyCustomPath(picked);
                          }
                        }}
                      >
                        <FolderOpen size={13} />
                        <span>浏览选择目录…</span>
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="arc-input"
                      style={{ flex: 1, minWidth: 180 }}
                      value={customCachePath}
                      onChange={(e) => {
                        setCustomCachePath(e.target.value);
                        setCacheError(null);
                      }}
                      placeholder={
                        runtimeInfo?.isTauri
                          ? '例如 D:\\ArcVaultCache 或 /sdcard/ArcVaultCache'
                          : '输入自定义缓存标识或点击上方选择目录'
                      }
                    />
                    <button
                      type="button"
                      className="arc-btn"
                      disabled={cacheApplying || !customCachePath.trim()}
                      onClick={() => void applyCustomPath(customCachePath)}
                    >
                      {cacheApplying ? '应用中…' : '应用该目录'}
                    </button>
                  </div>
                  {cacheAppliedPath && cacheChoice === 'custom' && (
                    <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                      已设定自定义目录：{cacheAppliedPath}
                    </div>
                  )}
                  {cacheError && (
                    <div style={{ fontSize: 12, color: '#dc2626' }}>{cacheError}</div>
                  )}
                </div>

                <button
                  type="button"
                  className="arc-btn"
                  style={{
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    height: 'auto',
                    borderColor: cacheChoice === 'default' ? 'var(--accent)' : undefined,
                    background: cacheChoice === 'default' ? 'var(--accent-soft)' : undefined,
                  }}
                  onClick={() => {
                    onHaptic?.('selection');
                    setCacheError(null);
                    setCacheChoice('default');
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    方式二：暂用当前默认目录（后续可在设置页随时迁移）
                  </span>
                  <span className="arc-badge">
                    {cacheChoice === 'default' ? '已选择' : '点击确认'}
                  </span>
                </button>
              </div>
            </div>

            <div className="arc-modal-footer arc-tutorial-footer is-warning-footer">
              <button
                type="button"
                className="arc-btn"
                disabled={stepIndex === 0}
                onClick={() => {
                  onHaptic?.('selection');
                  setStepIndex((i) => Math.max(0, i - 1));
                }}
              >
                <ChevronLeft size={14} />
                <span>上一步</span>
              </button>

              <button
                type="button"
                className="arc-btn arc-btn-primary"
                disabled={!canProceed}
                onClick={() => advanceNext()}
              >
                <span>{canProceed ? '下一步：进入必读警告' : '请先选择或确认缓存目录'}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. First-Run Mandatory Warning Gate
  if (currentStep?.kind === 'warning') {
    const inputUnlocked = canUnlockWarningInput(remainingSec);
    const confirmReady = canConfirmWarning(remainingSec, confirmInput);

    return (
      <div ref={rootRef} className="arc-tour-root">
        <div
          className="arc-modal-backdrop arc-tour-modal-backdrop"
          onClick={blockOutsideEvent}
          onMouseDown={blockOutsideEvent}
          onPointerDown={blockOutsideEvent}
        >
          <div
            className="arc-modal arc-tour-warning-modal"
            role="dialog"
            aria-modal="true"
            aria-label="进入前必读警告"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="arc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={19} color="#dc2626" />
                <strong style={{ fontSize: 15, color: '#dc2626' }}>
                  进入前必读警告（首次启动不可跳过）
                </strong>
              </div>
              <span className="arc-badge">第 {stepIndex + 1} / {steps.length} 步</span>
            </div>

            <div className="arc-modal-body" style={{ padding: 16 }}>
              <div className="arc-tutorial-warning-box">
                <div className="arc-tutorial-warning-copy">
                  <AlertTriangle size={17} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, fontWeight: 600 }}>
                    {TUTORIAL_WARNING_TEXT}
                  </p>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    <span>
                      {inputUnlocked
                        ? '阅读计时已完成，请在下方输入确认词进入软件'
                        : `请认真阅读上述警告（${remainingSec} 秒后解锁输入框）`}
                    </span>
                    <strong>{inputUnlocked ? '已解锁' : `${remainingSec}s`}</strong>
                  </div>
                  <div className="arc-tutorial-progress-track">
                    <div
                      className="arc-tutorial-progress-fill"
                      style={{
                        width: `${((TUTORIAL_WARNING_COUNTDOWN_SECONDS - remainingSec) / TUTORIAL_WARNING_COUNTDOWN_SECONDS) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600 }} htmlFor="arc-tour-warning-input">
                    请输入「{TUTORIAL_CONFIRM_PHRASE}」以确认你已阅读并理解上述全部警告：
                  </label>
                  <input
                    id="arc-tour-warning-input"
                    type="text"
                    className="arc-input"
                    disabled={!inputUnlocked}
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={
                      inputUnlocked
                        ? `请输入 ${TUTORIAL_CONFIRM_PHRASE}`
                        : `请等待倒计时结束 (${remainingSec}s)...`
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && confirmReady) {
                        onHaptic?.('success');
                        onCompleteFirstRun();
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="arc-modal-footer arc-tutorial-footer is-warning-footer">
              <button
                type="button"
                className="arc-btn"
                disabled={stepIndex === 0}
                onClick={() => {
                  onHaptic?.('selection');
                  setStepIndex((i) => Math.max(0, i - 1));
                }}
              >
                <ChevronLeft size={14} />
                <span>上一步</span>
              </button>

              <button
                type="button"
                className="arc-btn arc-btn-primary"
                disabled={!confirmReady}
                onClick={() => {
                  onHaptic?.('success');
                  onCompleteFirstRun();
                }}
              >
                <CheckCircle2 size={14} />
                <span>进入 ArcVault · 穹档</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Live In-App Spotlight Coachmark Step
  if (!currentStep || currentStep.kind !== 'step') return null;

  const { module: mod, step, stepIndexInModule, moduleStepCount } = currentStep;
  const relation = getStepAdvanceRelation(steps, stepIndex);
  const isLastReplayStep = !isFirstRun && stepIndex === steps.length - 1;
  const isActionGated = Boolean(step.actionGate) && !actionGateFallbackUnlocked;

  const cardPos = computeGuideCardPlacement({
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    cutout,
    cardWidth: cardSize.width,
    cardHeight: cardSize.height,
    preferredPlacement: step.preferredPlacement ?? 'auto',
    forcePlacement: deviceEnv.isPhone && step.phoneForceBottom ? 'bottom' : undefined,
    margin: isCompact ? 10 : 14,
    gap: 12,
  });

  const nextBtnLabel = isActionGated && step.actionGate
    ? formatActionGateButtonText(step.actionGate.buttonLabel, relation)
    : isLastReplayStep
      ? '完成重播'
      : relation === 'cache-setup'
        ? '设置缓存目录'
        : relation === 'warning'
          ? '查看必读警告'
        : relation === 'next-module'
          ? '进入下一板块'
          : '下一步';

  return (
    <div ref={rootRef} className="arc-tour-root" aria-live="polite">
      {/* Semi-transparent black blocker outside the active spotlight region */}
      {cutout ? (
        <>
          <div
            className="arc-tour-mask-pane"
            style={{ top: 0, left: 0, right: 0, height: cutout.top }}
            onClick={blockOutsideEvent}
            onMouseDown={blockOutsideEvent}
            onPointerDown={blockOutsideEvent}
          />
          <div
            className="arc-tour-mask-pane"
            style={{
              top: cutout.top + cutout.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={blockOutsideEvent}
            onMouseDown={blockOutsideEvent}
            onPointerDown={blockOutsideEvent}
          />
          <div
            className="arc-tour-mask-pane"
            style={{
              top: cutout.top,
              left: 0,
              width: cutout.left,
              height: cutout.height,
            }}
            onClick={blockOutsideEvent}
            onMouseDown={blockOutsideEvent}
            onPointerDown={blockOutsideEvent}
          />
          <div
            className="arc-tour-mask-pane"
            style={{
              top: cutout.top,
              left: cutout.left + cutout.width,
              right: 0,
              height: cutout.height,
            }}
            onClick={blockOutsideEvent}
            onMouseDown={blockOutsideEvent}
            onPointerDown={blockOutsideEvent}
          />
          <div
            className="arc-tour-highlight-ring"
            style={{
              top: cutout.top,
              left: cutout.left,
              width: cutout.width,
              height: cutout.height,
            }}
          />
        </>
      ) : (
        <div
          className="arc-tour-mask-pane"
          style={{ inset: 0 }}
          onClick={blockOutsideEvent}
          onMouseDown={blockOutsideEvent}
          onPointerDown={blockOutsideEvent}
        />
      )}

      {/* Floating Guide Card positioned above the dark mask */}
      <div
        ref={cardRef}
        className={[
          'arc-tour-card',
          isCompact ? 'is-compact' : '',
          isCompact && isCardTranslucent ? 'is-translucent' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="false"
        aria-label={step.title}
        style={{
          top: cardPos.top,
          left: cardPos.left,
          ...(cardPos.maxHeight ? { maxHeight: cardPos.maxHeight } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-tour-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            <span className="arc-badge" style={{ fontWeight: 700 }}>
              {mod.shortTitle} · {stepIndexInModule + 1}/{moduleStepCount}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              总第 {stepIndex + 1} / {steps.length} 步
            </span>
          </div>

          {(isCompact || !isFirstRun) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {isCompact && (
                <button
                  type="button"
                  className={`arc-btn arc-tour-translucent-btn ${isCardTranslucent ? 'is-active' : ''}`}
                  style={{ height: 24, fontSize: 11, padding: '0 7px' }}
                  aria-pressed={isCardTranslucent}
                  aria-label={isCardTranslucent ? '恢复指引卡片不透明' : '将指引卡片设为半透明'}
                  title={isCardTranslucent ? '恢复指引卡片不透明' : '一键半透明查看下方内容'}
                  onClick={() => {
                    onHaptic?.('selection');
                    setIsCardTranslucent((v) => !v);
                  }}
                >
                  {isCardTranslucent ? <Eye size={11} /> : <EyeOff size={11} />}
                  <span>{isCardTranslucent ? '恢复' : '半透明'}</span>
                </button>
              )}
              {!isFirstRun && (
                <>
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 24, fontSize: 11, padding: '0 7px' }}
                    onClick={() => {
                      onHaptic?.('selection');
                      setPhase('picker');
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>重选板块</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-icon-btn"
                    style={{ height: 24, width: 24, minWidth: 24 }}
                    onClick={onCloseReplay}
                    aria-label="退出教程"
                  >
                    <X size={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="arc-tour-card-body">
          <div className="arc-tour-card-title">
            <Sparkles size={15} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{step.title}</span>
          </div>

          <p className="arc-tour-card-desc">{step.description}</p>

          {step.bullets && step.bullets.length > 0 && (
            <ul className="arc-tour-card-bullets">
              {step.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          {isActionGated && step.actionGate && (
            <div className="arc-tour-action-callout">
              <Crosshair size={13} style={{ flexShrink: 0 }} />
              <span>请直接点击高亮界面中的「{step.actionGate.buttonLabel}」按钮继续</span>
            </div>
          )}
        </div>

        <div className="arc-tour-card-footer">
          <button
            type="button"
            className="arc-btn"
            style={{ height: 30, fontSize: 12 }}
            disabled={stepIndex === 0}
            onClick={() => {
              onHaptic?.('selection');
              setStepIndex((i) => Math.max(0, i - 1));
            }}
          >
            <ChevronLeft size={14} />
            <span>上一步</span>
          </button>

          <button
            type="button"
            className={`arc-btn ${isActionGated ? 'arc-tour-action-hint-btn' : 'arc-btn-primary'}`}
            style={{ height: 30, fontSize: 12 }}
            disabled={isActionGated}
            onClick={() => {
              if (isLastReplayStep) {
                handleFinishReplay();
              } else {
                advanceNext();
              }
            }}
          >
            <span>{nextBtnLabel}</span>
            {!isActionGated && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
