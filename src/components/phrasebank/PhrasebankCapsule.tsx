import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Braces,
  ChevronLeft,
  ChevronRight,
  Compass,
  GraduationCap,
  GripVertical,
  LayoutList,
  Maximize2,
  Minimize2,
  PowerOff,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wand2,
  X,
} from 'lucide-react';
import {
  analyzeAcademicIssues,
  detectCurrentSection,
  detectPaperSections,
} from '../../core/phrasebank/academicAnalyzer';
import { SKELETON_TEMPLATES } from '../../core/phrasebank/data/writingReference';
import { hasAnyPlaceholderValue } from '../../core/phrasebank/placeholders';
import {
  ALL_CAPSULE_ICONS,
  CAPSULE_ICON_META,
  COMPACT_CAPSULE_ICONS,
  loadPhrasebankUserState,
  normalizePhrasebankSettings,
  savePhrasebankUserState,
} from '../../core/phrasebank/phrasebankStorage';
import type {
  CapsuleIconId,
  CustomPhrase,
  PhrasebankUserState,
  UserBackupPayload,
} from '../../core/phrasebank/types';
import type {
  AiPrivacyPolicy,
  AppSettings,
  HapticPattern,
  PhrasebankSettings,
} from '../../types/archive';
import type { DocumentEditorHandle, EditorSelectionInfo } from '../DocumentEditor';
import { useAnimatedPresence } from '../../platform/useAnimatedPresence';
import { ContextAnalysisTab } from './ContextAnalysisTab';
import { FavoritesLibraryTab } from './FavoritesLibraryTab';
import { PlaceholdersTab, SkeletonTab } from './PlaceholdersAndSkeletonTab';
import { QuickLookupTab } from './QuickLookupTab';
import { ReferenceToolsTab } from './ReferenceToolsTab';
import { SectionNavigatorTab } from './SectionNavigatorTab';
import { SmartAssistTab } from './SmartAssistTab';

interface PhrasebankCapsuleProps {
  active: boolean;
  docText: string;
  readOnly: boolean;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  selectionInfo: EditorSelectionInfo | null;
  editorRef: React.RefObject<DocumentEditorHandle | null>;
  mobileMode?: 'desktop' | 'fab-sheet';
  mobileSheetOpen?: boolean;
  onSetMobileSheetOpen?: (open: boolean) => void;
  onHaptic?: (pattern: HapticPattern) => void;
  onUpdatePhrasebankSettings: (patch: Partial<PhrasebankSettings>) => void;
  onCloseCapsule: () => void;
  onNotify: (msg: string) => void;
}

const ICON_MAP: Record<CapsuleIconId, React.ReactNode> = {
  smart: <Sparkles size={15} />,
  sections: <Compass size={15} />,
  context: <Wand2 size={15} />,
  lookup: <Search size={15} />,
  reference: <BookOpen size={15} />,
  favorites: <Star size={15} />,
  placeholders: <Braces size={15} />,
  skeleton: <LayoutList size={15} />,
};

const VIEWPORT_MARGIN = 16;

interface ContainerBounds {
  w: number;
  h: number;
}

/**
 * The capsule is `position: fixed`, but inside the simulated device preview frame
 * (which uses `transform` to create a containing block) fixed coordinates are
 * relative to the frame — not the browser window. Measure the real containing
 * block via the full-bleed portal root, and also respect the on-screen keyboard
 * (visualViewport) on real tablets.
 */
function readContainerBounds(root: HTMLElement | null): ContainerBounds {
  if (typeof window === 'undefined') return { w: 1360, h: 860 };
  let w = window.innerWidth;
  let h = window.innerHeight;
  let top = 0;
  if (root) {
    const rect = root.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      w = rect.width;
      h = rect.height;
      top = rect.top;
    }
  }
  const vv = window.visualViewport;
  if (vv) {
    const visibleBottom = vv.height + vv.offsetTop - top;
    if (visibleBottom > 120) h = Math.min(h, visibleBottom);
  }
  return { w: Math.round(w), h: Math.round(h) };
}

function clampCoords(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: ContainerBounds,
): { x: number; y: number } {
  const maxX = Math.max(VIEWPORT_MARGIN, bounds.w - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, bounds.h - height - VIEWPORT_MARGIN);
  return {
    x: Math.round(Math.max(VIEWPORT_MARGIN, Math.min(maxX, x))),
    y: Math.round(Math.max(VIEWPORT_MARGIN, Math.min(maxY, y))),
  };
}

export const PhrasebankCapsule: React.FC<PhrasebankCapsuleProps> = ({
  active,
  docText,
  readOnly,
  settings,
  effectiveAiPolicy,
  selectionInfo,
  editorRef,
  mobileMode = 'desktop',
  mobileSheetOpen,
  onSetMobileSheetOpen,
  onHaptic,
  onUpdatePhrasebankSettings,
  onCloseCapsule,
  onNotify,
}) => {
  const pbSettings = useMemo(
    () => normalizePhrasebankSettings(settings.phrasebank),
    [settings.phrasebank],
  );

  // Mount / exit animation lifecycle
  const [mounted, setMounted] = useState(active);
  const [renderPhase, setRenderPhase] = useState<'entering' | 'open' | 'exiting'>(
    active ? 'entering' : 'exiting',
  );

  useEffect(() => {
    if (active) {
      setMounted(true);
      setRenderPhase('entering');
      const raf = requestAnimationFrame(() => setRenderPhase('open'));
      return () => cancelAnimationFrame(raf);
    }
    if (mounted) {
      setRenderPhase('exiting');
      const t = window.setTimeout(() => setMounted(false), 260);
      return () => window.clearTimeout(t);
    }
  }, [active, mounted]);

  // Persistent user state (favorites, custom phrases, placeholders, skeleton, recent)
  const [userState, setUserState] = useState<PhrasebankUserState>(loadPhrasebankUserState);
  useEffect(() => {
    savePhrasebankUserState(userState);
  }, [userState]);

  const [activeSlotId, setActiveSlotId] = useState<string>(() => {
    const tpl =
      SKELETON_TEMPLATES.find((t) => t.id === userState.activeTemplateId) ?? SKELETON_TEMPLATES[0];
    return tpl.slots[0].id;
  });

  // Panel & Popover state
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CapsuleIconId>(
    pbSettings.visibleIcons[0] ?? 'smart',
  );
  const [panelWide, setPanelWide] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Keep activeTab valid when visibleIcons changes
  useEffect(() => {
    if (!pbSettings.visibleIcons.includes(activeTab)) {
      setActiveTab(pbSettings.visibleIcons[0] ?? 'smart');
    }
  }, [pbSettings.visibleIcons, activeTab]);

  // Close panel/customize on Escape cleanly without propagating to fullscreen Esc
  useEffect(() => {
    if (!mounted || (!panelOpen && !customizeOpen)) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (customizeOpen) setCustomizeOpen(false);
        else if (panelOpen) setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [mounted, panelOpen, customizeOpen]);

  // Paper sections & live issue badge
  const detectedSections = useMemo(() => detectPaperSections(docText), [docText]);
  const cursorPos = selectionInfo?.cursorPos ?? 0;
  const currentSection = useMemo(
    () => detectCurrentSection(docText, cursorPos, detectedSections),
    [docText, cursorPos, detectedSections],
  );

  const activeSliceText = useMemo(() => {
    if (selectionInfo?.selectedText.trim()) return selectionInfo.selectedText;
    if (selectionInfo?.currentParagraph.trim()) return selectionInfo.currentParagraph;
    return docText.slice(0, 1200);
  }, [selectionInfo, docText]);

  const liveIssueCount = useMemo(
    () => analyzeAcademicIssues(activeSliceText, 0).length,
    [activeSliceText],
  );

  // Capsule positioning & dragging
  const capsuleRef = useRef<HTMLDivElement | null>(null);
  const [capsuleSize, setCapsuleSize] = useState<{ w: number; h: number }>({ w: 620, h: 48 });
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const portalRootRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState<ContainerBounds>(() => readContainerBounds(null));

  const computeDefaultCoords = useCallback(
    (w: number, h: number) => {
      const x = Math.round((bounds.w - w) / 2);
      const y = Math.round(bounds.h - h - 56);
      return clampCoords(x, y, w, h, bounds);
    },
    [bounds],
  );

  const resolvedCoords = useMemo(() => {
    if (dragCoords) return dragCoords;
    if (pbSettings.position) {
      return clampCoords(
        pbSettings.position.x,
        pbSettings.position.y,
        capsuleSize.w,
        capsuleSize.h,
        bounds,
      );
    }
    return computeDefaultCoords(capsuleSize.w, capsuleSize.h);
  }, [dragCoords, pbSettings.position, capsuleSize.w, capsuleSize.h, computeDefaultCoords, bounds]);

  // Observe capsule dimensions when collapsing/expanding or customizing icons
  useLayoutEffect(() => {
    const el = capsuleRef.current;
    if (!el || !mounted) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCapsuleSize((prev) =>
          Math.abs(prev.w - rect.width) > 1 || Math.abs(prev.h - rect.height) > 1
            ? { w: Math.round(rect.width), h: Math.round(rect.height) }
            : prev,
        );
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, pbSettings.collapsed, pbSettings.visibleIcons.length]);

  // Track the real containing block (window, or simulated device frame) + soft keyboard
  useLayoutEffect(() => {
    if (!mounted) return;
    const update = () => {
      const next = readContainerBounds(portalRootRef.current);
      setBounds((prev) =>
        Math.abs(prev.w - next.w) > 1 || Math.abs(prev.h - next.h) > 1 ? next : prev,
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && portalRootRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(portalRootRef.current);
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [mounted, mobileMode]);

  // Sliding active pill measurement inside icon rail
  const railRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Partial<Record<CapsuleIconId, HTMLButtonElement | null>>>({});
  const [pillGeom, setPillGeom] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0,
    width: 34,
    visible: false,
  });

  const measureActivePill = useCallback(() => {
    if (!panelOpen || pbSettings.collapsed) {
      setPillGeom((p) => (p.visible ? { ...p, visible: false } : p));
      return;
    }
    const btn = btnRefs.current[activeTab];
    const rail = railRef.current;
    if (!btn || !rail) {
      setPillGeom((p) => (p.visible ? { ...p, visible: false } : p));
      return;
    }
    setPillGeom({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      visible: true,
    });
  }, [activeTab, panelOpen, pbSettings.collapsed]);

  useLayoutEffect(() => {
    measureActivePill();
  }, [measureActivePill, pbSettings.visibleIcons]);

  // Pointer drag handler (on grip handle or non-button capsule surface)
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const handleStartDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea') && !target.closest('.apb-drag-grip')) {
      return;
    }
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = resolvedCoords.x;
    const origY = resolvedCoords.y;
    dragStateRef.current = { startX, startY, origX, origY, moved: false };

    const onMove = (ev: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const dx = ev.clientX - ds.startX;
      const dy = ev.clientY - ds.startY;
      if (!ds.moved && Math.hypot(dx, dy) < 5) return;
      if (!ds.moved) {
        ds.moved = true;
        setIsDragging(true);
        setIsSnapping(false);
      }
      const next = clampCoords(ds.origX + dx, ds.origY + dy, capsuleSize.w, capsuleSize.h, bounds);
      setDragCoords(next);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const ds = dragStateRef.current;
      dragStateRef.current = null;
      if (!ds) return;
      if (ds.moved) {
        const finalPos = clampCoords(
          ds.origX + (ev.clientX - ds.startX),
          ds.origY + (ev.clientY - ds.startY),
          capsuleSize.w,
          capsuleSize.h,
          bounds,
        );
        setIsDragging(false);
        setIsSnapping(true);
        setDragCoords(null);
        onUpdatePhrasebankSettings({ position: finalPos });
        window.setTimeout(() => setIsSnapping(false), 380);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const isZh = settings.locale === 'zh-CN';

  const handleResetPosition = () => {
    setIsSnapping(true);
    setDragCoords(null);
    onUpdatePhrasebankSettings({ position: null });
    onNotify(isZh ? '胶囊已恢复默认居中位置' : 'Capsule reset to default center position');
    window.setTimeout(() => setIsSnapping(false), 380);
  };

  // Editor & user state actions
  const favoritesSet = useMemo(() => new Set(userState.favorites), [userState.favorites]);
  const hasSelection = Boolean(selectionInfo && selectionInfo.selectedText.trim().length > 0);
  const placeholdersActive =
    userState.placeholdersEnabled && hasAnyPlaceholderValue(userState.placeholders);

  const recordRecent = useCallback((text: string, sourceLabel: string) => {
    setUserState((prev) => {
      const deduped = prev.recentCopies.filter((item) => item.text !== text);
      return {
        ...prev,
        recentCopies: [
          { id: `${Date.now()}`, text, sourceLabel, copiedAt: Date.now() },
          ...deduped,
        ].slice(0, 25),
      };
    });
  }, []);

  const handleCopy = useCallback(
    async (text: string, sourceLabel: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      recordRecent(text, sourceLabel);
      onNotify(isZh ? '已复制到剪贴板' : 'Copied to clipboard');
    },
    [recordRecent, onNotify, isZh],
  );

  const handleInsert = useCallback(
    (text: string, sourceLabel: string) => {
      if (readOnly) {
        onNotify(isZh ? '当前文档已封存锁定，仅支持复制' : 'Document is sealed read-only; copied only');
        return;
      }
      editorRef.current?.insertAtCursor(text);
      onHaptic?.('medium');
      recordRecent(text, sourceLabel);
      onNotify(
        hasSelection
          ? isZh
            ? '已替换当前选中内容（可 Ctrl+Z 撤销）'
            : 'Replaced selection (Ctrl+Z to undo)'
          : isZh
            ? '已插入光标处（可 Ctrl+Z 撤销）'
            : 'Inserted at cursor (Ctrl+Z to undo)',
      );
    },
    [readOnly, editorRef, recordRecent, onNotify, hasSelection, onHaptic, isZh],
  );

  const handleReplaceRange = useCallback(
    (from: number, to: number, text: string, label?: string) => {
      if (readOnly) {
        onNotify(isZh ? '当前文档已封存锁定，无法直接修改正文' : 'Document is sealed read-only; cannot edit');
        return;
      }
      editorRef.current?.replaceRange(from, to, text);
      onNotify(
        label
          ? isZh
            ? `${label}（可 Ctrl+Z 撤销）`
            : `${label} (Ctrl+Z to undo)`
          : isZh
            ? '已一键替换正文内容（可 Ctrl+Z 撤销）'
            : 'Replaced text in document (Ctrl+Z to undo)',
      );
    },
    [readOnly, editorRef, onNotify, isZh],
  );

  const handleSelectAndScrollTo = useCallback(
    (from: number, to: number) => {
      editorRef.current?.selectAndScrollTo(from, to);
    },
    [editorRef],
  );

  const handleToggleFavorite = useCallback(
    (phraseId: string) => {
      setUserState((prev) => {
        const exists = prev.favorites.includes(phraseId);
        if (exists) {
          onNotify(isZh ? '已移出收藏' : 'Removed from favorites');
          return {
            ...prev,
            favorites: prev.favorites.filter((id) => id !== phraseId),
            pinnedFavorites: prev.pinnedFavorites.filter((p) => p !== phraseId),
          };
        }
        onNotify(isZh ? '已加入收藏' : 'Added to favorites');
        return {
          ...prev,
          favorites: [phraseId, ...prev.favorites],
        };
      });
    },
    [onNotify, isZh],
  );

  const handleTogglePinFavorite = useCallback((phraseId: string) => {
    setUserState((prev) => ({
      ...prev,
      pinnedFavorites: prev.pinnedFavorites.includes(phraseId)
        ? prev.pinnedFavorites.filter((p) => p !== phraseId)
        : [phraseId, ...prev.pinnedFavorites],
    }));
  }, []);

  const handleAddToSkeleton = useCallback(
    (text: string, preferredSlotId: string | undefined, sourceLabel: string) => {
      const tpl =
        SKELETON_TEMPLATES.find((t) => t.id === userState.activeTemplateId) ??
        SKELETON_TEMPLATES[0];
      const targetSlot =
        preferredSlotId && tpl.slots.some((s) => s.id === preferredSlotId)
          ? preferredSlotId
          : tpl.slots.some((s) => s.id === activeSlotId)
            ? activeSlotId
            : tpl.slots[0].id;

      setUserState((prev) => ({
        ...prev,
        skeletonItems: [
          ...prev.skeletonItems,
          {
            id: `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            slotId: targetSlot,
            text,
            sourceLabel,
          },
        ],
      }));
      setActiveSlotId(targetSlot);
      onNotify(isZh ? '已加入写作骨架台' : 'Added to draft skeleton');
    },
    [userState.activeTemplateId, activeSlotId, onNotify, isZh],
  );

  const handleExportBackup = useCallback(() => {
    const payload: UserBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites: userState.favorites,
      pinnedFavorites: userState.pinnedFavorites,
      customPhrases: userState.customPhrases,
      placeholders: userState.placeholders,
      skeletonItems: userState.skeletonItems,
      activeTemplateId: userState.activeTemplateId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-phrasebank-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(isZh ? '已导出学术句库 JSON 备份' : 'Exported Phrasebank JSON backup');
  }, [userState, onNotify, isZh]);

  const handleImportBackup = useCallback(
    (payload: UserBackupPayload) => {
      setUserState((prev) => {
        const nextFavs = Array.isArray(payload.favorites)
          ? Array.from(new Set([...prev.favorites, ...payload.favorites]))
          : prev.favorites;
        const nextPins = Array.isArray(payload.pinnedFavorites)
          ? Array.from(new Set([...prev.pinnedFavorites, ...payload.pinnedFavorites]))
          : prev.pinnedFavorites;
        const existingCustomIds = new Set(prev.customPhrases.map((c) => c.id));
        const nextCustom = Array.isArray(payload.customPhrases)
          ? [...payload.customPhrases.filter((c) => !existingCustomIds.has(c.id)), ...prev.customPhrases]
          : prev.customPhrases;
        return {
          ...prev,
          favorites: nextFavs,
          pinnedFavorites: nextPins,
          customPhrases: nextCustom,
          placeholders: payload.placeholders ?? prev.placeholders,
          skeletonItems: Array.isArray(payload.skeletonItems)
            ? payload.skeletonItems
            : prev.skeletonItems,
          activeTemplateId: payload.activeTemplateId || prev.activeTemplateId,
        };
      });
      onNotify(isZh ? '已成功导入句库备份数据' : 'Imported Phrasebank backup');
    },
    [onNotify, isZh],
  );

  const handleToggleIconVisibility = (id: CapsuleIconId) => {
    const exists = pbSettings.visibleIcons.includes(id);
    if (exists && pbSettings.visibleIcons.length <= 1) {
      onNotify(isZh ? '至少需保留 1 个功能图标' : 'Keep at least 1 icon visible');
      return;
    }
    const next = exists
      ? pbSettings.visibleIcons.filter((item) => item !== id)
      : ALL_CAPSULE_ICONS.filter(
          (item) => item === id || pbSettings.visibleIcons.includes(item),
        );
    onUpdatePhrasebankSettings({ visibleIcons: next });
  };

  const handleIconClick = (id: CapsuleIconId) => {
    setCustomizeOpen(false);
    if (panelOpen && activeTab === id) {
      setPanelOpen(false);
      return;
    }
    setActiveTab(id);
    setPanelOpen(true);
  };

  const isSheetOpen = mobileMode === 'fab-sheet' ? (mobileSheetOpen ?? panelOpen) : panelOpen;
  const mobileSheetPresence = useAnimatedPresence(
    Boolean(mounted && mobileMode === 'fab-sheet' && isSheetOpen),
    250,
  );

  if (!mounted) return null;

  // Compute attached panel geometry relative to current capsule coordinates
  const desiredPanelWidth = Math.min(
    panelWide ? 820 : 620,
    Math.max(280, bounds.w - VIEWPORT_MARGIN * 2),
  );
  const desiredPanelHeight = Math.min(
    540,
    Math.max(220, bounds.h - capsuleSize.h - VIEWPORT_MARGIN * 2 - 24),
  );
  const openBelow = resolvedCoords.y < desiredPanelHeight + 30 && resolvedCoords.y < bounds.h * 0.45;
  const panelLeft = Math.round(
    Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        bounds.w - desiredPanelWidth - VIEWPORT_MARGIN,
        resolvedCoords.x + capsuleSize.w / 2 - desiredPanelWidth / 2,
      ),
    ),
  );
  const panelTop = openBelow
    ? Math.min(bounds.h - desiredPanelHeight - VIEWPORT_MARGIN, resolvedCoords.y + capsuleSize.h + 12)
    : Math.max(VIEWPORT_MARGIN, resolvedCoords.y - desiredPanelHeight - 12);

  const activeMeta = CAPSULE_ICON_META.find((m) => m.id === activeTab) ?? CAPSULE_ICON_META[0];
  const sectionShortLabel = currentSection
    ? isZh
      ? currentSection.mappedSectionLabel.split(' · ')[0]
      : currentSection.mappedSectionLabel.split(' · ')[1] || currentSection.mappedSectionLabel.split(' · ')[0]
    : isZh
      ? '正文'
      : 'Body';

  const setSheetOpen = (next: boolean) => {
    setPanelOpen(next);
    onSetMobileSheetOpen?.(next);
  };

  if (mobileMode === 'fab-sheet') {
    return (
      <>
        <button
          type="button"
          data-tour="phrasebank-capsule"
          className="arc-mobile-fab"
          onClick={() => {
            onHaptic?.('light');
            setSheetOpen(!isSheetOpen);
          }}
          aria-label={isZh ? '打开学术写作句库' : 'Open Academic Phrasebank'}
        >
          <GraduationCap size={20} />
          {liveIssueCount > 0 && <span className="arc-mobile-fab-badge">{liveIssueCount}</span>}
        </button>

        {mobileSheetPresence.mounted && (
          <div
            className={`arc-sheet-backdrop phase-${mobileSheetPresence.phase}`}
            onClick={() => {
              onHaptic?.('selection');
              setSheetOpen(false);
            }}
          >
            <section
              data-tour="phrasebank-panel"
              className={`arc-bottom-sheet is-tall phase-${mobileSheetPresence.phase}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={isZh ? '学术写作句库' : 'Academic Phrasebank'}
            >
              <div className="arc-sheet-handle-row">
                <span className="arc-sheet-handle" />
              </div>
              <header className="arc-sheet-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <GraduationCap size={16} color="var(--accent)" />
                  <strong style={{ fontSize: 14 }}>
                    {isZh ? `学术写作句库 · ${sectionShortLabel}` : `Phrasebank · ${sectionShortLabel}`}
                  </strong>
                </div>
                <button
                  type="button"
                  className="arc-btn arc-icon-btn"
                  onClick={() => setSheetOpen(false)}
                >
                  <X size={14} />
                </button>
              </header>

              <div className="apb-mobile-tab-rail">
                {pbSettings.visibleIcons.map((iconId) => {
                  const meta = CAPSULE_ICON_META.find((m) => m.id === iconId);
                  return (
                    <button
                      key={iconId}
                      type="button"
                      className={`arc-btn ${activeTab === iconId ? 'arc-btn-primary' : ''}`}
                      style={{ height: 32, fontSize: 12, flexShrink: 0 }}
                      onClick={() => {
                        onHaptic?.('selection');
                        setActiveTab(iconId);
                      }}
                    >
                      {ICON_MAP[iconId]}
                      <span>{(isZh ? meta?.shortCn : meta?.shortEn) ?? iconId}</span>
                    </button>
                  );
                })}
              </div>

              <div className="arc-sheet-body">
                {activeTab === 'smart' && (
                  <SmartAssistTab
                    isZh={isZh}
                    docText={docText}
                    selectionInfo={selectionInfo}
                    currentSection={currentSection}
                    favoritesSet={favoritesSet}
                    placeholders={userState.placeholders}
                    placeholdersEnabled={userState.placeholdersEnabled}
                    readOnly={readOnly}
                    onInsert={handleInsert}
                    onReplaceRange={handleReplaceRange}
                    onSelectAndScrollTo={handleSelectAndScrollTo}
                    onCopy={handleCopy}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToSkeleton={handleAddToSkeleton}
                  />
                )}
                {activeTab === 'sections' && (
                  <SectionNavigatorTab
                    isZh={isZh}
                    detectedSections={detectedSections}
                    currentSection={currentSection}
                    favoritesSet={favoritesSet}
                    placeholders={userState.placeholders}
                    placeholdersEnabled={userState.placeholdersEnabled}
                    hasSelection={hasSelection}
                    readOnly={readOnly}
                    onJumpToOffset={(off) => handleSelectAndScrollTo(off, off)}
                    onInsert={handleInsert}
                    onCopy={handleCopy}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToSkeleton={handleAddToSkeleton}
                  />
                )}
                {activeTab === 'context' && (
                  <ContextAnalysisTab
                    docText={docText}
                    selectionInfo={selectionInfo}
                    currentSection={currentSection}
                    settings={settings}
                    effectiveAiPolicy={effectiveAiPolicy}
                    readOnly={readOnly}
                    onInsert={handleInsert}
                    onReplaceRange={handleReplaceRange}
                    onCopy={handleCopy}
                  />
                )}
                {activeTab === 'lookup' && (
                  <QuickLookupTab
                    isZh={isZh}
                    favoritesSet={favoritesSet}
                    placeholders={userState.placeholders}
                    placeholdersEnabled={userState.placeholdersEnabled}
                    hasSelection={hasSelection}
                    readOnly={readOnly}
                    onInsert={handleInsert}
                    onCopy={handleCopy}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToSkeleton={handleAddToSkeleton}
                  />
                )}
                {activeTab === 'reference' && (
                  <ReferenceToolsTab
                    isZh={isZh}
                    hasSelection={hasSelection}
                    readOnly={readOnly}
                    onInsert={handleInsert}
                    onCopy={handleCopy}
                  />
                )}
                {activeTab === 'favorites' && (
                  <FavoritesLibraryTab
                    isZh={isZh}
                    favorites={userState.favorites}
                    pinnedFavorites={userState.pinnedFavorites}
                    recentCopies={userState.recentCopies}
                    customPhrases={userState.customPhrases}
                    placeholders={userState.placeholders}
                    placeholdersEnabled={userState.placeholdersEnabled}
                    hasSelection={hasSelection}
                    readOnly={readOnly}
                    onInsert={handleInsert}
                    onCopy={handleCopy}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePinFavorite={handleTogglePinFavorite}
                    onAddToSkeleton={handleAddToSkeleton}
                    onAddCustomPhrase={(cp: Omit<CustomPhrase, 'id' | 'createdAt'>) => {
                      setUserState((prev) => ({
                        ...prev,
                        customPhrases: [
                          { ...cp, id: `custom-${Date.now()}`, createdAt: Date.now() },
                          ...prev.customPhrases,
                        ],
                      }));
                      onNotify(isZh ? '已保存到自建私人句库' : 'Saved to custom phrasebank');
                    }}
                    onDeleteCustomPhrase={(id) => {
                      setUserState((prev) => ({
                        ...prev,
                        customPhrases: prev.customPhrases.filter((c) => c.id !== id),
                      }));
                      onNotify(isZh ? '已删除自建句型' : 'Deleted custom phrase');
                    }}
                    onExportBackup={handleExportBackup}
                    onImportBackup={handleImportBackup}
                  />
                )}
                {activeTab === 'placeholders' && (
                  <PlaceholdersTab
                    isZh={isZh}
                    values={userState.placeholders}
                    enabled={userState.placeholdersEnabled}
                    onChangeValues={(next) =>
                      setUserState((prev) => ({ ...prev, placeholders: next }))
                    }
                    onToggleEnabled={() =>
                      setUserState((prev) => ({
                        ...prev,
                        placeholdersEnabled: !prev.placeholdersEnabled,
                      }))
                    }
                  />
                )}
                {activeTab === 'skeleton' && (
                  <SkeletonTab
                    isZh={isZh}
                    activeTemplateId={userState.activeTemplateId}
                    onSelectTemplate={(tplId) =>
                      setUserState((prev) => ({ ...prev, activeTemplateId: tplId }))
                    }
                    activeSlotId={activeSlotId}
                    onSelectSlot={setActiveSlotId}
                    items={userState.skeletonItems}
                    readOnly={readOnly}
                    onUpdateItem={(id, text) =>
                      setUserState((prev) => ({
                        ...prev,
                        skeletonItems: prev.skeletonItems.map((it) =>
                          it.id === id ? { ...it, text } : it,
                        ),
                      }))
                    }
                    onMoveItem={(id, dir) =>
                      setUserState((prev) => {
                        const idx = prev.skeletonItems.findIndex((it) => it.id === id);
                        if (idx < 0) return prev;
                        const target = idx + dir;
                        if (target < 0 || target >= prev.skeletonItems.length) return prev;
                        const copy = [...prev.skeletonItems];
                        const [moved] = copy.splice(idx, 1);
                        copy.splice(target, 0, moved);
                        return { ...prev, skeletonItems: copy };
                      })
                    }
                    onRemoveItem={(id) =>
                      setUserState((prev) => ({
                        ...prev,
                        skeletonItems: prev.skeletonItems.filter((it) => it.id !== id),
                      }))
                    }
                    onClearAll={() => {
                      setUserState((prev) => ({ ...prev, skeletonItems: [] }));
                      onNotify(isZh ? '已清空写作骨架台' : 'Cleared draft skeleton');
                    }}
                    onInsert={handleInsert}
                    onCopy={handleCopy}
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={portalRootRef} className="apb-portal-root">
      {/* Attached Floating Workbench Panel */}
      {panelOpen && !pbSettings.collapsed && renderPhase !== 'exiting' && (
        <section
          data-tour="phrasebank-panel"
          className={`apb-floating-panel ${openBelow ? 'from-top' : 'from-bottom'}`}
          style={{
            left: panelLeft,
            top: panelTop,
            width: desiredPanelWidth,
            height: desiredPanelHeight,
          }}
          aria-label={isZh ? activeMeta.labelCn : activeMeta.labelEn}
        >
          <header className="apb-panel-header">
            <div className="apb-panel-title-wrap">
              <span className="apb-panel-icon">{ICON_MAP[activeTab]}</span>
              <strong>{isZh ? activeMeta.labelCn : activeMeta.labelEn}</strong>
              {currentSection && (
                <span className="apb-pill-badge is-accent">{currentSection.mappedSectionLabel}</span>
              )}
              {placeholdersActive && (
                <button
                  type="button"
                  className="apb-pill-badge is-ph"
                  onClick={() => setActiveTab('placeholders')}
                  data-arc-tooltip={isZh ? '占位符自动替换已生效，点击编辑变量' : 'Placeholder auto-fill active; click to edit'}
                >
                  {isZh ? '占位符已替换' : 'Slots Active'}
                </button>
              )}
            </div>

            <div className="apb-panel-header-actions">
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() => setPanelWide((w) => !w)}
                data-arc-tooltip={panelWide ? (isZh ? '恢复标准面板宽度' : 'Restore standard width') : isZh ? '加宽阅读视图' : 'Expand reading width'}
              >
                {panelWide ? <Minimize2 size={12.5} /> : <Maximize2 size={12.5} />}
              </button>
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() => setPanelOpen(false)}
                data-arc-tooltip={isZh ? '收起面板 (Esc)' : 'Close panel (Esc)'}
              >
                <X size={13} />
              </button>
            </div>
          </header>

          <div className="apb-panel-body">
            <div key={activeTab} className="apb-panel-tab-anim">
              {activeTab === 'smart' && (
                <SmartAssistTab
                  isZh={isZh}
                  docText={docText}
                  selectionInfo={selectionInfo}
                  currentSection={currentSection}
                  favoritesSet={favoritesSet}
                  placeholders={userState.placeholders}
                  placeholdersEnabled={userState.placeholdersEnabled}
                  readOnly={readOnly}
                  onInsert={handleInsert}
                  onReplaceRange={handleReplaceRange}
                  onSelectAndScrollTo={handleSelectAndScrollTo}
                  onCopy={handleCopy}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToSkeleton={handleAddToSkeleton}
                />
              )}

              {activeTab === 'sections' && (
                <SectionNavigatorTab
                  isZh={isZh}
                  detectedSections={detectedSections}
                  currentSection={currentSection}
                  favoritesSet={favoritesSet}
                  placeholders={userState.placeholders}
                  placeholdersEnabled={userState.placeholdersEnabled}
                  hasSelection={hasSelection}
                  readOnly={readOnly}
                  onJumpToOffset={(off) => handleSelectAndScrollTo(off, off)}
                  onInsert={handleInsert}
                  onCopy={handleCopy}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToSkeleton={handleAddToSkeleton}
                />
              )}

              {activeTab === 'context' && (
                <ContextAnalysisTab
                  docText={docText}
                  selectionInfo={selectionInfo}
                  currentSection={currentSection}
                  settings={settings}
                  effectiveAiPolicy={effectiveAiPolicy}
                  readOnly={readOnly}
                  onInsert={handleInsert}
                  onReplaceRange={handleReplaceRange}
                  onCopy={handleCopy}
                />
              )}

              {activeTab === 'lookup' && (
                <QuickLookupTab
                  isZh={isZh}
                  favoritesSet={favoritesSet}
                  placeholders={userState.placeholders}
                  placeholdersEnabled={userState.placeholdersEnabled}
                  hasSelection={hasSelection}
                  readOnly={readOnly}
                  onInsert={handleInsert}
                  onCopy={handleCopy}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToSkeleton={handleAddToSkeleton}
                />
              )}

              {activeTab === 'reference' && (
                <ReferenceToolsTab
                  isZh={isZh}
                  hasSelection={hasSelection}
                  readOnly={readOnly}
                  onInsert={handleInsert}
                  onCopy={handleCopy}
                />
              )}

              {activeTab === 'favorites' && (
                <FavoritesLibraryTab
                  isZh={isZh}
                  favorites={userState.favorites}
                  pinnedFavorites={userState.pinnedFavorites}
                  recentCopies={userState.recentCopies}
                  customPhrases={userState.customPhrases}
                  placeholders={userState.placeholders}
                  placeholdersEnabled={userState.placeholdersEnabled}
                  hasSelection={hasSelection}
                  readOnly={readOnly}
                  onInsert={handleInsert}
                  onCopy={handleCopy}
                  onToggleFavorite={handleToggleFavorite}
                  onTogglePinFavorite={handleTogglePinFavorite}
                  onAddToSkeleton={handleAddToSkeleton}
                  onAddCustomPhrase={(cp: Omit<CustomPhrase, 'id' | 'createdAt'>) => {
                    setUserState((prev) => ({
                      ...prev,
                      customPhrases: [
                        { ...cp, id: `custom-${Date.now()}`, createdAt: Date.now() },
                        ...prev.customPhrases,
                      ],
                    }));
                    onNotify(isZh ? '已保存到自建私人句库' : 'Saved to custom phrasebank');
                  }}
                  onDeleteCustomPhrase={(id) => {
                    setUserState((prev) => ({
                      ...prev,
                      customPhrases: prev.customPhrases.filter((c) => c.id !== id),
                    }));
                    onNotify(isZh ? '已删除自建句型' : 'Deleted custom phrase');
                  }}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                />
              )}

              {activeTab === 'placeholders' && (
                <PlaceholdersTab
                  isZh={isZh}
                  values={userState.placeholders}
                  enabled={userState.placeholdersEnabled}
                  onChangeValues={(next) =>
                    setUserState((prev) => ({ ...prev, placeholders: next }))
                  }
                  onToggleEnabled={() =>
                    setUserState((prev) => ({
                      ...prev,
                      placeholdersEnabled: !prev.placeholdersEnabled,
                    }))
                  }
                />
              )}

              {activeTab === 'skeleton' && (
                <SkeletonTab
                  isZh={isZh}
                  activeTemplateId={userState.activeTemplateId}
                  onSelectTemplate={(tplId) =>
                    setUserState((prev) => ({ ...prev, activeTemplateId: tplId }))
                  }
                  activeSlotId={activeSlotId}
                  onSelectSlot={setActiveSlotId}
                  items={userState.skeletonItems}
                  readOnly={readOnly}
                  onUpdateItem={(id, text) =>
                    setUserState((prev) => ({
                      ...prev,
                      skeletonItems: prev.skeletonItems.map((it) =>
                        it.id === id ? { ...it, text } : it,
                      ),
                    }))
                  }
                  onMoveItem={(id, dir) =>
                    setUserState((prev) => {
                      const idx = prev.skeletonItems.findIndex((it) => it.id === id);
                      if (idx < 0) return prev;
                      const target = idx + dir;
                      if (target < 0 || target >= prev.skeletonItems.length) return prev;
                      const copy = [...prev.skeletonItems];
                      const [moved] = copy.splice(idx, 1);
                      copy.splice(target, 0, moved);
                      return { ...prev, skeletonItems: copy };
                    })
                  }
                  onRemoveItem={(id) =>
                    setUserState((prev) => ({
                      ...prev,
                      skeletonItems: prev.skeletonItems.filter((it) => it.id !== id),
                    }))
                  }
                  onClearAll={() => {
                    setUserState((prev) => ({ ...prev, skeletonItems: [] }));
                    onNotify(isZh ? '已清空写作骨架台' : 'Cleared draft skeleton');
                  }}
                  onInsert={handleInsert}
                  onCopy={handleCopy}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Draggable Elongated Capsule Shell */}
      <div
        ref={capsuleRef}
        className={[
          'apb-capsule-shell',
          `phase-${renderPhase}`,
          isDragging ? 'is-dragging' : '',
          isSnapping ? 'is-snapping' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          transform: `translate3d(${resolvedCoords.x}px, ${resolvedCoords.y}px, 0)`,
          maxWidth: Math.max(160, bounds.w - VIEWPORT_MARGIN * 2),
        }}
        onPointerDown={handleStartDrag}
      >
        {/* Customization Popover */}
        {customizeOpen && !pbSettings.collapsed && (
          <div
            className={`apb-customize-popover ${
              resolvedCoords.y < 320 ? 'drop-down' : 'drop-up'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="apb-customize-head">
              <strong>{isZh ? '自定义胶囊工具栏图标' : 'Customize Capsule Icons'}</strong>
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() => setCustomizeOpen(false)}
              >
                <X size={12} />
              </button>
            </div>

            <div className="apb-customize-grid">
              {CAPSULE_ICON_META.map((meta) => {
                const checked = pbSettings.visibleIcons.includes(meta.id);
                return (
                  <label key={meta.id} className={`apb-customize-item ${checked ? 'is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleIconVisibility(meta.id)}
                    />
                    <span className="apb-customize-icon">{ICON_MAP[meta.id]}</span>
                    <span style={{ fontSize: 12 }}>{isZh ? meta.shortCn : meta.shortEn}</span>
                  </label>
                );
              })}
            </div>

            <div className="apb-customize-actions">
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() =>
                  onUpdatePhrasebankSettings({ visibleIcons: [...ALL_CAPSULE_ICONS] })
                }
              >
                {isZh ? '显示全部' : 'Show All'}
              </button>
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() =>
                  onUpdatePhrasebankSettings({ visibleIcons: [...COMPACT_CAPSULE_ICONS] })
                }
              >
                {isZh ? '精简模式' : 'Compact'}
              </button>
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() =>
                  onUpdatePhrasebankSettings({
                    scope: pbSettings.scope === 'paper-only' ? 'all-spaces' : 'paper-only',
                  })
                }
              >
                {pbSettings.scope === 'paper-only'
                  ? isZh
                    ? '范围：仅论文区'
                    : 'Scope: Thesis'
                  : isZh
                    ? '范围：全部文档'
                    : 'Scope: All Docs'}
              </button>
            </div>

            <label
              className={`apb-customize-item ${(pbSettings.preferPhrasebankForAi ?? true) ? 'is-checked' : ''}`}
              style={{ marginTop: 8 }}
            >
              <input
                type="checkbox"
                checked={pbSettings.preferPhrasebankForAi ?? true}
                onChange={() =>
                  onUpdatePhrasebankSettings({
                    preferPhrasebankForAi: !(pbSettings.preferPhrasebankForAi ?? true),
                  })
                }
              />
              <span style={{ fontSize: 11.5 }}>
                {isZh
                  ? 'AI 修改建议优先套用句库句式与用词（降 AI 率）'
                  : 'Prefer Phrasebank patterns in AI rewrites (lower AI score)'}
              </span>
            </label>

            <div className="apb-customize-footer">
              <button
                type="button"
                className="arc-btn apb-mini-btn apb-disable-btn"
                onClick={() => {
                  setCustomizeOpen(false);
                  setPanelOpen(false);
                  onUpdatePhrasebankSettings({ enabled: false });
                  onNotify(
                    isZh
                      ? '已禁用学术写作句库胶囊（可在顶部工具箱或设置中重新开启）'
                      : 'Phrasebank capsule disabled (re-enable from Toolbox or Settings)',
                  );
                }}
              >
                <PowerOff size={12} />
                <span>{isZh ? '禁用学术句库功能' : 'Disable Phrasebank'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Capsule Bar (Morphs smoothly between Expanded Elongated Capsule and Collapsed Pill) */}
        <div data-tour="phrasebank-capsule" className={`apb-capsule-bar ${pbSettings.collapsed ? 'is-collapsed' : ''}`}>
          <div
            className="apb-drag-grip"
            onDoubleClick={handleResetPosition}
            data-arc-tooltip={isZh ? '按住拖动胶囊位置 · 双击恢复默认居中' : 'Drag to move · Double-click to center'}
          >
            <GripVertical size={14} />
          </div>

          {pbSettings.collapsed ? (
            <button
              type="button"
              className="apb-collapsed-trigger"
              onClick={() => onUpdatePhrasebankSettings({ collapsed: false })}
              data-arc-tooltip={isZh ? '展开学术写作句库胶囊 (Alt+P)' : 'Expand Phrasebank Capsule (Alt+P)'}
            >
              <GraduationCap size={15} className="apb-brand-icon" />
              <span className="apb-collapsed-label">
                {isZh ? `学术句库 · ${sectionShortLabel}` : `Phrasebank · ${sectionShortLabel}`}
              </span>
              {liveIssueCount > 0 && <span className="apb-count-badge">{liveIssueCount}</span>}
              <ChevronLeft size={13} />
            </button>
          ) : (
            <>
              {/* Current detected section pill */}
              <button
                type="button"
                className="apb-section-pill"
                onClick={() => handleIconClick('sections')}
                data-arc-tooltip={
                  currentSection
                    ? isZh
                      ? `当前识别章节：${currentSection.mappedSectionLabel}（点击打开章节导航）`
                      : `Detected section: ${currentSection.mappedSectionLabel} (click to open Sections)`
                    : isZh
                      ? '点击打开论文章节导航'
                      : 'Open Section Navigator'
                }
              >
                <BookMarked size={13} />
                <span>{sectionShortLabel}</span>
                {liveIssueCount > 0 && <span className="apb-dot-indicator" />}
              </button>

              <div className="apb-capsule-divider" />

              {/* Customizable Function Icon Rail with Sliding Active Indicator */}
              <div ref={railRef} className="apb-icon-rail">
                <div
                  className={`apb-active-pill ${pillGeom.visible ? 'is-visible' : ''}`}
                  style={{
                    width: pillGeom.width,
                    transform: `translate3d(${pillGeom.left}px, 0, 0)`,
                  }}
                />
                {pbSettings.visibleIcons.map((iconId) => {
                  const meta = CAPSULE_ICON_META.find((m) => m.id === iconId);
                  const isActive = panelOpen && activeTab === iconId;
                  const badgeCount =
                    iconId === 'smart'
                      ? liveIssueCount
                      : iconId === 'favorites'
                        ? userState.favorites.length
                        : iconId === 'skeleton'
                          ? userState.skeletonItems.length
                          : 0;
                  return (
                    <button
                      key={iconId}
                      ref={(el) => {
                        btnRefs.current[iconId] = el;
                      }}
                      type="button"
                      className={`apb-icon-btn ${isActive ? 'is-active' : ''}`}
                      onClick={() => handleIconClick(iconId)}
                      data-arc-tooltip={
                        isZh
                          ? `${meta?.labelCn ?? iconId} — ${meta?.descCn ?? ''}`
                          : `${meta?.labelEn ?? iconId} — ${meta?.descEn ?? ''}`
                      }
                    >
                      {ICON_MAP[iconId]}
                      {badgeCount > 0 && (
                        <span className="apb-icon-badge">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                      {iconId === 'placeholders' && placeholdersActive && (
                        <span className="apb-icon-dot" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="apb-capsule-divider" />

              {/* Right Controls: Customize, Collapse, Close */}
              <div className="apb-capsule-controls">
                <button
                  type="button"
                  className={`apb-ctrl-btn ${customizeOpen ? 'is-active' : ''}`}
                  onClick={() => setCustomizeOpen((v) => !v)}
                  data-arc-tooltip={isZh ? '自定义显示图标与启用设置' : 'Customize icons & settings'}
                >
                  <SlidersHorizontal size={13.5} />
                </button>
                <button
                  type="button"
                  className="apb-ctrl-btn"
                  onClick={() => {
                    setCustomizeOpen(false);
                    setPanelOpen(false);
                    onUpdatePhrasebankSettings({ collapsed: true });
                  }}
                  data-arc-tooltip={isZh ? '收起为迷你胶囊' : 'Collapse to mini pill'}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  className="apb-ctrl-btn is-close"
                  onClick={() => {
                    setCustomizeOpen(false);
                    setPanelOpen(false);
                    onCloseCapsule();
                  }}
                  data-arc-tooltip={
                    isZh
                      ? '关闭胶囊浮窗（可从顶部栏或按 Alt+P 重新打开）'
                      : 'Hide capsule (reopen from top bar or Alt+P)'
                  }
                >
                  <X size={13.5} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
