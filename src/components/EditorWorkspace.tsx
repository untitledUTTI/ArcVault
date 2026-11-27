import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { GraduationCap, ShieldAlert, Sparkles } from 'lucide-react';
import {
  DocumentEditor,
  type AnchorGeometry,
  type DocumentEditorHandle,
  type EditorSelectionInfo,
} from './DocumentEditor';
import { AnnotationSidebar } from './AnnotationSidebar';
import { ArcLinkOverlay, type LinkCoordinates } from './ArcLinkOverlay';
import { OfficePreviewPane } from './OfficePreviewPane';
import { ResizeSash } from './ResizeSash';
import { PhrasebankCapsule } from './phrasebank/PhrasebankCapsule';
import { MobileQuickFormatBar } from './MobileQuickFormatBar';
import { RevisionSplitWorkspace } from './RevisionSplitWorkspace';
import {
  DEFAULT_REVISION_STICKERS,
  JOURNAL_STRIP_STICKERS,
  createDefaultStickerTextStyle,
  getStickerCategory,
  loadCustomStickers,
  loadDocArchiveStickers,
  saveCustomStickers,
  saveDocArchiveStickers,
  type RevisionArchiveStickerItem,
  type RevisionStickerDef,
  type StickerCategory,
  type StickerTextStyle,
} from '../core/revisionStickers';
import { StickerPickerTabs } from './StickerPickerTabs';
import { StickerTextStyleControls } from './StickerTextStyleControls';
import { StickerVisual } from './StickerVisual';
import { normalizePhrasebankSettings } from '../core/phrasebank/phrasebankStorage';
import { computeAlignedScrollTargets } from '../core/annotationLayout';
import type { DocumentScrollState } from '../core/workspaceLayout';
import { formatShortcut, type DeviceEnvironment } from '../platform/device';
import { startResizeDrag } from '../platform/resizeDrag';
import { getEnabledSkills } from '../core/skillRegistry';
import type {
  AiPrivacyPolicy,
  AppSettings,
  ArchiveDocument,
  EditorFormat,
  HapticPattern,
  PhrasebankSettings,
} from '../types/archive';
import type { I18nDict } from '../i18n/dictionaries';

interface EditorWorkspaceProps {
  dict: I18nDict;
  doc: ArchiveDocument;
  activeFormat: EditorFormat;
  isPaperSpace: boolean;
  splitPreview: boolean;
  isFullscreen: boolean;
  rightSidebarCollapsed: boolean;
  previewWidth: number;
  annotationWidth: number;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  deviceEnv?: DeviceEnvironment;
  canUndo?: boolean;
  canRedo?: boolean;
  revisionMode?: boolean;
  onSetRevisionMode?: (open: boolean) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFormatChange?: (fmt: EditorFormat) => void;
  onToggleSplitPreview?: () => void;
  onSaveMilestone?: () => void;
  onOpenCameraScan?: () => void;
  onHaptic?: (pattern: HapticPattern) => void;
  initialScroll?: DocumentScrollState;
  onScrollPositionChange?: (docId: string, scroll: DocumentScrollState) => void;
  capsuleDismissed: boolean;
  onSetCapsuleDismissed: (dismissed: boolean) => void;
  onUpdatePhrasebankSettings: (patch: Partial<PhrasebankSettings>) => void;
  onNotify: (msg: string) => void;
  onResizePreview: (w: number) => void;
  onResizeAnnotation: (w: number) => void;
  onCycleAiPolicy: () => void;
  onTextChange: (nextText: string) => void;
  onAcceptRevision: (id: string) => void;
  onRejectRevision: (id: string) => void;
  onToggleResolveComment: (id: string) => void;
  onReplyComment: (id: string, text: string) => void;
  onApplyAiSuggestion: (id: string, rewrite: string) => void;
  onOpenSkillsManager?: () => void;
}

function renderInlinePreviewHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Render inline $...$ with KaTeX
  return escaped
    .replace(/\$([^$\n]+)\$/g, (_, math) => {
      try {
        return katex.renderToString(math, { throwOnError: false });
      } catch {
        return math;
      }
    })
    .replace(
      /(\[@(?:zotero|endnote):\d{3}\])/g,
      '<span class="cm-arc-citation-shield">$1</span>',
    )
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  dict,
  doc,
  activeFormat,
  isPaperSpace,
  splitPreview,
  isFullscreen,
  rightSidebarCollapsed,
  previewWidth,
  annotationWidth,
  settings,
  effectiveAiPolicy,
  deviceEnv,
  canUndo = false,
  canRedo = false,
  revisionMode = false,
  onSetRevisionMode,
  onUndo,
  onRedo,
  onFormatChange,
  onToggleSplitPreview,
  onSaveMilestone,
  onOpenCameraScan,
  onHaptic,
  initialScroll,
  onScrollPositionChange,
  capsuleDismissed,
  onSetCapsuleDismissed,
  onUpdatePhrasebankSettings,
  onNotify,
  onResizePreview,
  onResizeAnnotation,
  onCycleAiPolicy,
  onTextChange,
  onAcceptRevision,
  onRejectRevision,
  onToggleResolveComment,
  onReplyComment,
  onApplyAiSuggestion,
  onOpenSkillsManager,
}) => {
  const enabledSkills = useMemo(() => getEnabledSkills(settings.skills), [settings.skills]);
  const pbSettings = useMemo(
    () => normalizePhrasebankSettings(settings.phrasebank),
    [settings.phrasebank],
  );
  const capsuleScopeMatches = pbSettings.scope === 'all-spaces' || isPaperSpace;
  const capsuleActive =
    pbSettings.enabled && capsuleScopeMatches && !capsuleDismissed && !doc.officePreview;

  const workspaceRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const annotationScrollRef = useRef<HTMLDivElement>(null);
  const documentEditorRef = useRef<DocumentEditorHandle>(null);

  const initialScrollRef = useRef(initialScroll);
  initialScrollRef.current = initialScroll;
  const onScrollChangeRef = useRef(onScrollPositionChange);
  onScrollChangeRef.current = onScrollPositionChange;
  const isRestoringScrollRef = useRef(false);
  const scrollSaveTimerRef = useRef<number | null>(null);

  const [selectionInfo, setSelectionInfo] = useState<EditorSelectionInfo | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [longPressMenu, setLongPressMenu] = useState<{
    x: number;
    y: number;
    annotationId: string | null;
  } | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardFocusZone, setKeyboardFocusZone] = useState<'original' | 'revision' | null>(null);
  const revisionSplitRef = useRef<HTMLDivElement>(null);
  const revisionParaScrollRef = useRef<HTMLDivElement>(null);
  const activeParaTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Shared sticker library & per-doc archive stickers
  const [customStickers, setCustomStickers] = useState<RevisionStickerDef[]>(loadCustomStickers);
  const [archiveStickers, setArchiveStickers] = useState<RevisionArchiveStickerItem[]>(() =>
    loadDocArchiveStickers(doc.id),
  );
  useEffect(() => {
    setArchiveStickers(loadDocArchiveStickers(doc.id));
  }, [doc.id]);
  useEffect(() => {
    saveCustomStickers(customStickers);
  }, [customStickers]);
  useEffect(() => {
    saveDocArchiveStickers(doc.id, archiveStickers);
  }, [doc.id, archiveStickers]);
  const allStickers = useMemo(
    () => [...JOURNAL_STRIP_STICKERS, ...DEFAULT_REVISION_STICKERS, ...customStickers],
    [customStickers],
  );

  // Paragraph editing & dirty confirmation state in Revision Mode
  const [editingParaStart, setEditingParaStart] = useState<number | null>(null);
  const paraSessionRef = useRef<{
    paraStart: number;
    annId: string;
    originalFullText: string;
    originalParaText: string;
    latestParaText: string;
    dirty: boolean;
  } | null>(null);
  const [pendingParaConfirm, setPendingParaConfirm] = useState<{
    paraStart: number;
    annId: string;
    originalFullText: string;
    originalParaText: string;
    latestParaText: string;
    step: 'confirm' | 'pick-sticker';
    revertConfirm: boolean;
    pickedStickerId: string;
    pickerTab: StickerCategory;
    textOverlay: StickerTextStyle;
    showTextCustomizer: boolean;
    userTouchedColor: boolean;
    nextAnnId?: string;
  } | null>(null);

  // Detect soft keyboard open/close via visualViewport so portrait split-screen
  // adapts dynamically to whichever pane currently holds input focus.
  useEffect(() => {
    if (!revisionMode || typeof window === 'undefined') {
      setKeyboardOpen(false);
      return;
    }
    const baseHeightRef = { current: window.visualViewport?.height ?? window.innerHeight };
    const checkViewport = () => {
      const vv = window.visualViewport;
      const currentH = vv ? vv.height : window.innerHeight;
      if (currentH > baseHeightRef.current) {
        baseHeightRef.current = currentH;
      }
      const delta = baseHeightRef.current - currentH;
      setKeyboardOpen(delta > 120);
    };
    const vv = window.visualViewport;
    vv?.addEventListener('resize', checkViewport);
    window.addEventListener('resize', checkViewport);
    return () => {
      vv?.removeEventListener('resize', checkViewport);
      window.removeEventListener('resize', checkViewport);
    };
  }, [revisionMode]);
  const [anchors, setAnchors] = useState<Record<string, AnchorGeometry>>({});
  const [cardRects, setCardRects] = useState<Record<string, { top: number; height: number }>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorScrollHeight, setEditorScrollHeight] = useState<number>(400);
  const [scrollTick, setScrollTick] = useState<number>(0);

  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const cardRectsRef = useRef(cardRects);
  cardRectsRef.current = cardRects;
  const annotationsRef = useRef(doc.annotations);
  annotationsRef.current = doc.annotations;
  const scrollRafRef = useRef<number | null>(null);
  const programmaticScrollUntilRef = useRef(0);
  const lastEditorScrollTopRef = useRef(0);
  const alignRefineTimerRef = useRef<number | null>(null);

  const currentText = activeFormat === 'markdown' ? doc.markdownText : doc.latexText;

  // Reset active selection when switching documents
  useEffect(() => {
    setSelectedId(null);
    setHoveredId(null);
    setSelectionInfo(null);
  }, [doc.id]);

  // Collapse if the selected annotation is removed (e.g., Undo)
  useEffect(() => {
    if (selectedId && !doc.annotations.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [doc.annotations, selectedId]);

  // Allow Escape key to collapse the currently expanded card
  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId]);

  const scheduleScrollTick = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (alignRefineTimerRef.current !== null) {
        window.clearTimeout(alignRefineTimerRef.current);
      }
    };
  }, []);

  // Keep right annotation canvas height synced with editor height and update overlay on resize
  useEffect(() => {
    const syncEditorHeight = () => {
      const ed = editorScrollRef.current;
      if (ed) {
        setEditorScrollHeight(ed.scrollHeight);
      }
    };
    syncEditorHeight();

    const onResize = () => {
      syncEditorHeight();
      scheduleScrollTick();
    };
    window.addEventListener('resize', onResize);

    let ro: ResizeObserver | null = null;
    const inner = editorScrollRef.current?.firstElementChild;
    if (typeof ResizeObserver !== 'undefined' && inner) {
      ro = new ResizeObserver(syncEditorHeight);
      ro.observe(inner);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [doc.id, activeFormat, currentText, anchors, scheduleScrollTick]);

  const alignViewportToAnnotation = useCallback((id: string, source: 'editor' | 'card') => {
    if (alignRefineTimerRef.current !== null) {
      window.clearTimeout(alignRefineTimerRef.current);
      alignRefineTimerRef.current = null;
    }

    const resolveAnchorTop = (): number | null => {
      const cached = anchorsRef.current[id];
      if (cached) return cached.top;
      const ann = annotationsRef.current.find((a) => a.id === id);
      if (!ann) return null;
      return documentEditorRef.current?.getPositionTop(ann.anchorStart) ?? null;
    };

    // Wait two frames so AnnotationSidebar commits expanded card heights and cardRectsRef updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const editorEl = editorScrollRef.current;
        const annEl = annotationScrollRef.current;
        const anchorTop = resolveAnchorTop();
        if (!editorEl || !annEl || anchorTop === null) return;

        const cardRect = cardRectsRef.current[id] ?? null;
        const plan = computeAlignedScrollTargets({
          source,
          anchorTop,
          cardTop: cardRect?.top ?? null,
          cardHeight: cardRect?.height,
          editorScrollTop: editorEl.scrollTop,
          editorClientHeight: editorEl.clientHeight,
          editorScrollHeight: editorEl.scrollHeight,
          annScrollTop: annEl.scrollTop,
          annClientHeight: annEl.clientHeight,
          annScrollHeight: annEl.scrollHeight,
        });

        programmaticScrollUntilRef.current = performance.now() + 750;

        if (plan.shouldScrollEditor) {
          editorEl.scrollTo({ top: plan.editorScrollTop, behavior: 'smooth' });
          lastEditorScrollTopRef.current = plan.editorScrollTop;
        }
        if (plan.shouldScrollAnnotation) {
          annEl.scrollTo({ top: plan.annotationScrollTop, behavior: 'smooth' });
        }

        // Refine after CodeMirror finishes measuring wrapped lines at the destination
        if (source === 'card' && plan.shouldScrollEditor) {
          alignRefineTimerRef.current = window.setTimeout(() => {
            alignRefineTimerRef.current = null;
            const ed = editorScrollRef.current;
            const an = annotationScrollRef.current;
            const ann = annotationsRef.current.find((a) => a.id === id);
            if (!ed || !ann) return;
            const exactTop =
              documentEditorRef.current?.getPositionTop(ann.anchorStart) ??
              anchorsRef.current[id]?.top ??
              null;
            if (exactTop === null) return;
            const viewTop = ed.scrollTop;
            const viewBottom = viewTop + ed.clientHeight;
            const inComfortZone =
              exactTop >= viewTop + 32 &&
              exactTop <= Math.max(viewTop + 80, viewBottom - 120);
            if (!inComfortZone) {
              const latestCard = cardRectsRef.current[id] ?? null;
              const refined = computeAlignedScrollTargets({
                source: 'card',
                anchorTop: exactTop,
                cardTop: latestCard?.top ?? null,
                cardHeight: latestCard?.height,
                editorScrollTop: ed.scrollTop,
                editorClientHeight: ed.clientHeight,
                editorScrollHeight: ed.scrollHeight,
                annScrollTop: an?.scrollTop ?? 0,
                annClientHeight: an?.clientHeight ?? ed.clientHeight,
                annScrollHeight: an?.scrollHeight ?? ed.scrollHeight,
              });
              programmaticScrollUntilRef.current = performance.now() + 500;
              if (refined.shouldScrollEditor) {
                ed.scrollTo({ top: refined.editorScrollTop, behavior: 'smooth' });
                lastEditorScrollTopRef.current = refined.editorScrollTop;
              }
              if (an && refined.shouldScrollAnnotation) {
                an.scrollTo({ top: refined.annotationScrollTop, behavior: 'smooth' });
              }
            }
          }, 300);
        }
      });
    });
  }, []);

  const handleCardRectsMeasured = useCallback(
    (next: Record<string, { top: number; height: number }>) => {
      setCardRects((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length) {
          let same = true;
          for (const k of nextKeys) {
            if (
              !prev[k] ||
              Math.abs(prev[k].top - next[k].top) > 1 ||
              Math.abs(prev[k].height - next[k].height) > 1
            ) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    },
    [],
  );

  // Compute Arc-Link curve coordinates in workspace coordinate space
  const activeId = hoveredId ?? selectedId;
  const activeAnn = useMemo(
    () => doc.annotations.find((a) => a.id === activeId) ?? null,
    [doc.annotations, activeId],
  );

  const linkCoords: LinkCoordinates | null = useMemo(() => {
    void scrollTick;
    if (!activeId || !workspaceRef.current || !editorScrollRef.current || !annotationScrollRef.current) {
      return null;
    }
    const anchor = anchors[activeId];
    const card = cardRects[activeId];
    if (!anchor || !card) return null;

    const wsRect = workspaceRef.current.getBoundingClientRect();
    const edRect = editorScrollRef.current.getBoundingClientRect();
    const anRect = annotationScrollRef.current.getBoundingClientRect();

    const x1 = edRect.left - wsRect.left + Math.min(edRect.width - 14, anchor.right + 4);
    const y1 = edRect.top - wsRect.top + (anchor.top - editorScrollRef.current.scrollTop) + 10;

    const x2 = anRect.left - wsRect.left + 16;
    const y2 = anRect.top - wsRect.top + (card.top + 16 - annotationScrollRef.current.scrollTop) + 18;

    return { x1, y1, x2, y2 };
  }, [activeId, anchors, cardRects, scrollTick]);

  const flushScrollPosition = useCallback((targetDocId: string) => {
    if (scrollSaveTimerRef.current !== null) {
      window.clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = null;
    }
    if (isRestoringScrollRef.current) return;
    onScrollChangeRef.current?.(targetDocId, {
      editorScrollTop: Math.max(0, Math.round(editorScrollRef.current?.scrollTop ?? 0)),
      previewScrollTop: Math.max(0, Math.round(previewScrollRef.current?.scrollTop ?? 0)),
      annotationScrollTop: Math.max(0, Math.round(annotationScrollRef.current?.scrollTop ?? 0)),
      updatedAt: Date.now(),
    });
  }, []);

  const scheduleScrollSave = useCallback(() => {
    if (isRestoringScrollRef.current) return;
    if (scrollSaveTimerRef.current !== null) {
      window.clearTimeout(scrollSaveTimerRef.current);
    }
    const targetDocId = doc.id;
    scrollSaveTimerRef.current = window.setTimeout(() => {
      scrollSaveTimerRef.current = null;
      flushScrollPosition(targetDocId);
    }, 140);
  }, [doc.id, flushScrollPosition]);

  // Restore saved scroll positions when switching documents or editor formats
  useEffect(() => {
    const saved = initialScrollRef.current;
    const targetEdTop = saved?.editorScrollTop ?? 0;
    const targetPrevTop = saved?.previewScrollTop ?? 0;
    const targetAnnTop = saved?.annotationScrollTop ?? targetEdTop;

    isRestoringScrollRef.current = true;
    const applyTargets = () => {
      if (editorScrollRef.current) {
        editorScrollRef.current.scrollTop = targetEdTop;
        lastEditorScrollTopRef.current = editorScrollRef.current.scrollTop;
      }
      if (previewScrollRef.current) previewScrollRef.current.scrollTop = targetPrevTop;
      if (annotationScrollRef.current) annotationScrollRef.current.scrollTop = targetAnnTop;
    };

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      applyTargets();
      raf2 = requestAnimationFrame(() => {
        applyTargets();
        scheduleScrollTick();
      });
    });

    const settleTimer = window.setTimeout(() => {
      applyTargets();
      isRestoringScrollRef.current = false;
      scheduleScrollTick();
    }, 110);

    const onBeforeUnload = () => {
      isRestoringScrollRef.current = false;
      flushScrollPosition(doc.id);
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(settleTimer);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (scrollSaveTimerRef.current !== null) {
        window.clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = null;
      }
      isRestoringScrollRef.current = false;
      flushScrollPosition(doc.id);
    };
  }, [doc.id, activeFormat, flushScrollPosition, scheduleScrollTick]);

  // Sync scroll gently by delta between editor and annotation sidebar (skipping programmatic alignment)
  const handleEditorScroll = () => {
    const editorEl = editorScrollRef.current;
    const annEl = annotationScrollRef.current;
    if (editorEl) {
      const currentTop = editorEl.scrollTop;
      const delta = currentTop - lastEditorScrollTopRef.current;
      lastEditorScrollTopRef.current = currentTop;

      if (
        !isRestoringScrollRef.current &&
        performance.now() >= programmaticScrollUntilRef.current &&
        annEl &&
        delta !== 0
      ) {
        const annMax = Math.max(0, annEl.scrollHeight - annEl.clientHeight);
        annEl.scrollTop = Math.max(0, Math.min(annMax, annEl.scrollTop + delta));
      }
    }
    scheduleScrollTick();
    scheduleScrollSave();
  };

  const handlePreviewScroll = () => {
    scheduleScrollSave();
  };

  const handleAnnotationScroll = () => {
    scheduleScrollTick();
    scheduleScrollSave();
  };

  const previewBlocks = useMemo(() => currentText.split(/\n{2,}/), [currentText]);

  const isPhone = Boolean(deviceEnv?.isPhone);
  const isTabletPortrait = Boolean(deviceEnv?.isTabletPortrait);
  const useMobileSheets = isPhone || isTabletPortrait;
  const [mobilePbSheetOpen, setMobilePbSheetOpen] = useState(false);

  const showPreview = !isPhone && splitPreview && !isFullscreen;
  const showPhonePreviewOnly = isPhone && splitPreview && !isFullscreen;
  const showAnnotations = !useMobileSheets && (isFullscreen || !rightSidebarCollapsed);
  const typoKey = JSON.stringify(settings.typography ?? {});
  const openAnnotationCount = useMemo(
    () => doc.annotations.filter((a) => a.status === 'open').length,
    [doc.annotations],
  );
  const undoKeyLabel = formatShortcut('Mod+Z', deviceEnv?.os ?? 'windows');
  const redoKeyLabel = formatShortcut('Mod+Shift+Z', deviceEnv?.os ?? 'windows');

  const handleQuickInsert = useCallback(
    (snippet: string, wrapPair?: [string, string]) => {
      if (doc.isSealed) return;
      if (wrapPair && selectionInfo && selectionInfo.selectedText.trim()) {
        documentEditorRef.current?.insertAtCursor(
          `${wrapPair[0]}${selectionInfo.selectedText}${wrapPair[1]}`,
        );
      } else {
        documentEditorRef.current?.insertAtCursor(snippet);
      }
      documentEditorRef.current?.focus();
    },
    [doc.isSealed, selectionInfo],
  );

  const isLandscapeSplit = deviceEnv?.isTabletLandscape ?? false;
  const effectiveSplitRatio = useMemo(() => {
    if (!revisionMode || isLandscapeSplit || !keyboardOpen) return splitRatio;
    if (keyboardFocusZone === 'original') return Math.max(splitRatio, 0.72);
    if (keyboardFocusZone === 'revision') return Math.min(splitRatio, 0.28);
    return splitRatio;
  }, [revisionMode, isLandscapeSplit, keyboardOpen, keyboardFocusZone, splitRatio]);

  // Extract only paragraphs that contain annotations/revisions for Revision Mode
  const annotatedParagraphs = useMemo(() => {
    if (!revisionMode) return [];
    const anns = doc.annotations
      .filter((a) => a.status === 'open' || a.status === 'resolved' || a.status === 'accepted' || a.status === 'rejected')
      .slice()
      .sort((a, b) => a.anchorStart - b.anchorStart);
    if (anns.length === 0) return [];

    const paragraphs: Array<{ start: number; end: number; text: string }> = [];
    const lines = currentText.split('\n');
    let offset = 0;
    let blockStart = -1;
    let blockLines: string[] = [];
    for (const line of lines) {
      const lineStart = offset;
      const lineEnd = offset + line.length;
      if (line.trim().length > 0) {
        if (blockStart === -1) blockStart = lineStart;
        blockLines.push(line);
      } else if (blockStart !== -1) {
        paragraphs.push({
          start: blockStart,
          end: lineStart - 1,
          text: blockLines.join('\n'),
        });
        blockStart = -1;
        blockLines = [];
      }
      offset = lineEnd + 1;
    }
    if (blockStart !== -1) {
      paragraphs.push({
        start: blockStart,
        end: currentText.length,
        text: blockLines.join('\n'),
      });
    }

    return paragraphs
      .map((p) => ({
        ...p,
        anns: anns.filter((a) => a.anchorEnd >= p.start && a.anchorStart <= p.end),
      }))
      .filter((p) => p.anns.length > 0);
  }, [revisionMode, doc.annotations, currentText]);

  const scrollRevisionParaToAnn = useCallback((id: string) => {
    const container = revisionParaScrollRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-ann-id="${id}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const scrollRevisionParaToPos = useCallback((pos: number) => {
    const container = revisionParaScrollRef.current;
    if (!container) return;
    const blocks = Array.from(container.querySelectorAll('[data-para-start]')) as HTMLElement[];
    if (blocks.length === 0) return;
    let best = blocks[0];
    let bestDist = Infinity;
    for (const blk of blocks) {
      const pStart = Number(blk.getAttribute('data-para-start') ?? 0);
      const dist = Math.abs(pStart - pos);
      if (dist < bestDist) {
        bestDist = dist;
        best = blk;
      }
    }
    best.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const lpRevTimerRef = useRef<number | null>(null);
  const lpRevStartRef = useRef<{ x: number; y: number } | null>(null);
  const clearRevLp = () => {
    if (lpRevTimerRef.current !== null) {
      window.clearTimeout(lpRevTimerRef.current);
      lpRevTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!longPressMenu) return;
    const onDocDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.arc-longpress-capsule')) return;
      setLongPressMenu(null);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [longPressMenu]);

  useEffect(() => {
    document.addEventListener('selectionchange', clearRevLp);
    return () => document.removeEventListener('selectionchange', clearRevLp);
  }, []);

  const focusParaEditor = useCallback((paraStart: number) => {
    setEditingParaStart(paraStart);
    window.setTimeout(() => {
      activeParaTextareaRef.current?.focus();
    }, 40);
  }, []);

  const buildParaConfirmState = useCallback(
    (
      sess: NonNullable<typeof paraSessionRef.current>,
      nextAnnId?: string,
    ) => {
      const defaultSticker = allStickers[0] ?? DEFAULT_REVISION_STICKERS[0];
      return {
        paraStart: sess.paraStart,
        annId: sess.annId,
        originalFullText: sess.originalFullText,
        originalParaText: sess.originalParaText,
        latestParaText: sess.latestParaText,
        step: 'confirm' as const,
        revertConfirm: false,
        pickedStickerId: defaultSticker.id,
        pickerTab: getStickerCategory(defaultSticker),
        textOverlay: createDefaultStickerTextStyle(
          defaultSticker,
          sess.latestParaText.trim().slice(0, 18),
        ),
        showTextCustomizer: true,
        userTouchedColor: false,
        nextAnnId,
      };
    },
    [allStickers],
  );

  const handleRevisionSelectNote = useCallback(
    (nextId: string) => {
      const sess = paraSessionRef.current;
      if (sess && sess.dirty && !pendingParaConfirm) {
        setPendingParaConfirm(buildParaConfirmState(sess, nextId));
        return;
      }
      setSelectedId(nextId);
    },
    [pendingParaConfirm, buildParaConfirmState],
  );

  const splitContainerClass = revisionMode
    ? `arc-revision-split ${isLandscapeSplit ? 'is-landscape' : 'is-portrait'} ${keyboardOpen ? 'is-keyboard-open' : ''}`
    : '';

  const renderAnnotatedParagraphContent = (p: {
    start: number;
    end: number;
    text: string;
    anns: typeof doc.annotations;
  }) => {
    const sorted = p.anns
      .map((a) => ({
        ann: a,
        relStart: Math.max(0, a.anchorStart - p.start),
        relEnd: Math.min(p.text.length, a.anchorEnd - p.start),
      }))
      .filter((r) => r.relEnd > r.relStart)
      .sort((a, b) => a.relStart - b.relStart);

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const item of sorted) {
      if (item.relStart > cursor) {
        nodes.push(p.text.slice(cursor, item.relStart));
      }
      const start = Math.max(cursor, item.relStart);
      if (item.relEnd > start) {
        const cls =
          (item.ann.type === 'comment' ? 'cm-arc-comment' : 'cm-arc-revision') +
          (selectedId === item.ann.id ? ' cm-arc-selected' : '');
        nodes.push(
          <span
            key={item.ann.id}
            data-ann-id={item.ann.id}
            className={cls}
            onClick={(e) => {
              e.stopPropagation();
              onHaptic?.('selection');
              setSelectedId(item.ann.id);
            }}
          >
            {p.text.slice(start, item.relEnd)}
          </span>,
        );
        cursor = item.relEnd;
      }
    }
    if (cursor < p.text.length) {
      nodes.push(p.text.slice(cursor));
    }
    return nodes;
  };

  const renderOriginalEditorPane = () => {
    if (revisionMode) {
      return (
        <div
          className="arc-revision-original-pane"
          onFocusCapture={() => setKeyboardFocusZone('original')}
          style={{
            flex: `0 0 ${(effectiveSplitRatio * 100).toFixed(2)}%`,
            minHeight: 0,
            minWidth: 0,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
          }}
        >
          <div
            ref={revisionParaScrollRef}
            className="arc-revision-paragraphs-scroll"
            onContextMenu={(e) => {
              if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return;
              e.preventDefault();
              const target = e.target as HTMLElement | null;
              const annEl = target?.closest('[data-ann-id]') as HTMLElement | null;
              const annId = annEl?.getAttribute('data-ann-id') ?? null;
              onHaptic?.('medium');
              if (annId) setSelectedId(annId);
              setLongPressMenu({ x: e.clientX, y: e.clientY, annotationId: annId });
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              const domSel = typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '';
              if (domSel.length > 0) {
                clearRevLp();
                return;
              }
              clearRevLp();
              lpRevStartRef.current = { x: e.clientX, y: e.clientY };
              const target = e.target as HTMLElement | null;
              const annEl = target?.closest('[data-ann-id]') as HTMLElement | null;
              const annId = annEl?.getAttribute('data-ann-id') ?? null;
              lpRevTimerRef.current = window.setTimeout(() => {
                lpRevTimerRef.current = null;
                const curDomSel = typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '';
                if (curDomSel.length > 0) return;
                onHaptic?.('medium');
                if (annId) setSelectedId(annId);
                setLongPressMenu({
                  x: lpRevStartRef.current?.x ?? e.clientX,
                  y: lpRevStartRef.current?.y ?? e.clientY,
                  annotationId: annId,
                });
              }, 480);
            }}
            onPointerMove={(e) => {
              if (!lpRevStartRef.current || lpRevTimerRef.current === null) return;
              if (Math.hypot(e.clientX - lpRevStartRef.current.x, e.clientY - lpRevStartRef.current.y) > 8) {
                clearRevLp();
              }
            }}
            onPointerUp={clearRevLp}
            onPointerCancel={clearRevLp}
          >
            {annotatedParagraphs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {settings.locale === 'zh-CN'
                  ? '当前文档暂无批注或修订对应的段落'
                  : 'No annotated or revised paragraphs in this document'}
              </div>
            ) : (
              annotatedParagraphs.map((p) => {
                const hasSelected = p.anns.some((a) => a.id === selectedId);
                const isEditingThis = editingParaStart === p.start && !doc.isSealed;
                return (
                  <div
                    key={p.start}
                    data-para-start={p.start}
                    className={`arc-revision-para-block ${hasSelected ? 'is-focused-para' : ''}`}
                    onClick={() => {
                      if (doc.isSealed || isEditingThis) return;
                      const domSel = typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '';
                      if (domSel.length > 0) return;
                      paraSessionRef.current = {
                        paraStart: p.start,
                        annId: selectedId && p.anns.some((a) => a.id === selectedId) ? selectedId : p.anns[0].id,
                        originalFullText: currentText,
                        originalParaText: p.text,
                        latestParaText: p.text,
                        dirty: false,
                      };
                      focusParaEditor(p.start);
                    }}
                  >
                    {isEditingThis ? (
                      <textarea
                        ref={activeParaTextareaRef}
                        className="arc-revision-para-textarea"
                        value={p.text}
                        rows={Math.max(3, Math.min(8, p.text.split('\n').length + 1))}
                        onChange={(e) => {
                          const nextPara = e.target.value;
                          const nextFull =
                            currentText.slice(0, p.start) + nextPara + currentText.slice(p.end);
                          if (paraSessionRef.current && paraSessionRef.current.paraStart === p.start) {
                            paraSessionRef.current.dirty = nextPara !== paraSessionRef.current.originalParaText;
                            paraSessionRef.current.latestParaText = nextPara;
                          }
                          onTextChange(nextFull);
                        }}
                        onBlur={() => {
                          setEditingParaStart(null);
                          const sess = paraSessionRef.current;
                          if (sess && sess.paraStart === p.start && sess.dirty) {
                            setPendingParaConfirm(buildParaConfirmState(sess));
                          } else {
                            paraSessionRef.current = null;
                          }
                        }}
                      />
                    ) : (
                      renderAnnotatedParagraphContent(p)
                    )}
                  </div>
                );
              })
            )}
          </div>

          {!doc.officePreview && (
            <MobileQuickFormatBar
              isZh={settings.locale === 'zh-CN'}
              inRevisionMode
              readOnly={doc.isSealed}
              activeFormat={activeFormat}
              splitPreview={splitPreview}
              canUndo={canUndo}
              canRedo={canRedo}
              openAnnotationCount={openAnnotationCount}
              phrasebankActive={mobilePbSheetOpen}
              onUndo={() => onUndo?.()}
              onRedo={() => onRedo?.()}
              onInsertSnippet={handleQuickInsert}
              onToggleFormat={() =>
                onFormatChange?.(activeFormat === 'markdown' ? 'latex' : 'markdown')
              }
              onToggleSplitPreview={() => onToggleSplitPreview?.()}
              onOpenAnnotations={() => onSetRevisionMode?.(false)}
              onTogglePhrasebank={() => {
                if (!pbSettings.enabled) {
                  onUpdatePhrasebankSettings({ enabled: true, collapsed: false });
                }
                onSetCapsuleDismissed(false);
                setMobilePbSheetOpen((v) => !v);
              }}
              onOpenCameraScan={() => onOpenCameraScan?.()}
              onSaveMilestone={() => onSaveMilestone?.()}
              onHaptic={(p) => onHaptic?.(p)}
            />
          )}
        </div>
      );
    }

    return (
      <div
        ref={editorScrollRef}
        className="arc-editor-pane"
        onScroll={handleEditorScroll}
      >
        <div key={`${doc.id}-${activeFormat}`} className="arc-doc-transition">
          <div className="arc-editor-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color="var(--accent)" />
              <span>
                {doc.coverXmlNodes.length > 0
                  ? `${dict.editor.coverStrippedPrefix} ${doc.coverXmlNodes.length} ${dict.editor.coverStrippedSuffix}`
                  : `${dict.editor.editHintPrefix} ${undoKeyLabel} / ${redoKeyLabel}`}
              </span>
            </div>
            <div data-tour="editor-ai-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                data-tour="editor-ai-policy-btn"
                className="arc-btn"
                style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                onClick={onCycleAiPolicy}
                title={dict.editor.aiPolicyTip}
              >
                {dict.editor.aiPolicyLabel}
                {effectiveAiPolicy === 'cloud-or-local'
                  ? dict.editor.aiCloudLocal
                  : effectiveAiPolicy === 'local-only'
                    ? dict.editor.aiLocalOnly
                    : dict.editor.aiDisabled}
              </button>
              {onOpenSkillsManager && (
                <button
                  className={`arc-btn ${enabledSkills.length > 0 ? 'arc-btn-primary' : ''}`}
                  style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                  onClick={onOpenSkillsManager}
                  title={
                    enabledSkills.length > 0
                      ? `${dict.editor.skillsEnabledTip}\n${enabledSkills.map((s) => `• ${s.name}`).join('\n')}`
                      : dict.editor.skillsDisabledTip
                  }
                >
                  Skills: {enabledSkills.length > 0 ? `${enabledSkills.length} ${dict.editor.skillsEnabledCount}` : dict.editor.skillsOff}
                </button>
              )}
              {!doc.officePreview && capsuleScopeMatches && (
                <button
                  className={`arc-btn ${capsuleActive ? 'arc-btn-primary' : ''}`}
                  style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                  onClick={() => {
                    if (!pbSettings.enabled) {
                      onUpdatePhrasebankSettings({ enabled: true, collapsed: false });
                      onSetCapsuleDismissed(false);
                    } else if (capsuleDismissed) {
                      onSetCapsuleDismissed(false);
                    } else {
                      onSetCapsuleDismissed(true);
                    }
                  }}
                  data-arc-tooltip={
                    !pbSettings.enabled
                      ? dict.editor.phrasebankReenableTip
                      : capsuleDismissed
                        ? dict.editor.phrasebankShowTip
                        : dict.editor.phrasebankHideTip
                  }
                >
                  <GraduationCap size={12} />
                  <span>
                    {!pbSettings.enabled
                      ? dict.editor.phrasebankEnableBtn
                      : capsuleDismissed
                        ? dict.editor.phrasebankBtn
                        : dict.editor.phrasebankActiveBtn}
                  </span>
                </button>
              )}
              {doc.citationsSidecar.length > 0 && (
                <span className="arc-badge" title={dict.editor.citationsTip}>
                  {dict.editor.citationsProtectedPrefix} {doc.citationsSidecar.length} {dict.editor.citationsProtectedSuffix}
                </span>
              )}
            </div>
          </div>

          {doc.isSealed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                marginBottom: 12,
                borderRadius: 'var(--arc-radius-sm)',
                background: 'rgba(220, 38, 38, 0.1)',
                color: '#dc2626',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <ShieldAlert size={15} />
              <span>
                {dict.editor.sealedBannerPrefix}（SHA-256: {doc.sealedHash?.slice(0, 12)}...）{dict.editor.sealedBannerSuffix}
              </span>
            </div>
          )}

          <DocumentEditor
            ref={documentEditorRef}
            value={currentText}
            format={activeFormat}
            readOnly={doc.isSealed}
            typographyKey={typoKey}
            annotations={doc.annotations}
            hoveredAnnotationId={hoveredId}
            selectedAnnotationId={selectedId}
            onChange={onTextChange}
            onSelectionChange={setSelectionInfo}
            onHoverAnnotation={setHoveredId}
            onClickAnnotation={(id) => {
              setSelectedId(id);
              onHaptic?.('selection');
              alignViewportToAnnotation(id, 'editor');
            }}
            onLongPressMenu={(info) => {
              onHaptic?.('medium');
              if (info.annotationId) {
                setSelectedId(info.annotationId);
              }
              setLongPressMenu(info);
            }}
            onAnchorsMeasured={setAnchors}
            scrollContainerRef={editorScrollRef}
          />
        </div>
      </div>
    );
  };

  return (
    <main ref={workspaceRef} data-tour="workspace-main" className={`arc-workspace ${isPhone ? 'is-phone' : ''}`}>
      {revisionMode ? (
        <div ref={revisionSplitRef} className={splitContainerClass}>
          {renderOriginalEditorPane()}
          <ResizeSash
            orientation={isLandscapeSplit ? 'vertical' : 'horizontal'}
            title={settings.locale === 'zh-CN' ? '拖动调整分屏比例' : 'Drag to resize split'}
            onPointerDown={(e) => {
              const box = revisionSplitRef.current?.getBoundingClientRect();
              const total = isLandscapeSplit ? (box?.width ?? window.innerWidth) : (box?.height ?? window.innerHeight);
              const initialPx = splitRatio * total;
              startResizeDrag({
                event: e,
                axis: isLandscapeSplit ? 'x' : 'y',
                initialSize: initialPx,
                min: total * 0.24,
                max: total * 0.76,
                onResize: (nextPx) => {
                  setSplitRatio(Math.max(0.24, Math.min(0.76, nextPx / Math.max(1, total))));
                },
              });
            }}
          />
          <div
            style={{ flex: '1 1 0%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}
            onFocusCapture={(e) => {
              setKeyboardFocusZone('revision');
              const target = e.target as HTMLElement | null;
              if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
                window.setTimeout(() => {
                  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }, 120);
              }
            }}
          >
            <RevisionSplitWorkspace
              docId={doc.id}
              annotations={doc.annotations}
              selectedId={selectedId}
              documentText={currentText}
              settings={settings}
              effectiveAiPolicy={effectiveAiPolicy}
              readOnly={doc.isSealed}
              allStickers={allStickers}
              archiveStickers={archiveStickers}
              onAddCustomSticker={(stk) => setCustomStickers((prev) => [...prev, stk])}
              onDeleteCustomSticker={(id) =>
                setCustomStickers((prev) => prev.filter((s) => s.id !== id))
              }
              onAddArchiveSticker={(item) => setArchiveStickers((prev) => [...prev, item])}
              onUpdateArchiveSticker={(archiveId, patch) =>
                setArchiveStickers((prev) =>
                  prev.map((a) => (a.id === archiveId ? { ...a, ...patch } : a)),
                )
              }
              onSelect={handleRevisionSelectNote}
              onLocate={(id) => {
                scrollRevisionParaToAnn(id);
              }}
              onJumpToPosition={(pos) => {
                scrollRevisionParaToPos(pos);
              }}
              onAcceptRevision={onAcceptRevision}
              onRejectRevision={onRejectRevision}
              onToggleResolveComment={onToggleResolveComment}
              onReplyComment={onReplyComment}
              onApplyAiSuggestion={onApplyAiSuggestion}
              onHaptic={(p) => onHaptic?.(p)}
            />
          </div>
        </div>
      ) : (
        !showPhonePreviewOnly && renderOriginalEditorPane()
      )}

      {showPhonePreviewOnly && (
        <div ref={previewScrollRef} className="arc-preview-pane is-phone-full" onScroll={handlePreviewScroll}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dict.editor.previewSubtitle}</span>
            {onToggleSplitPreview && (
              <button
                type="button"
                className="arc-btn arc-btn-primary"
                style={{ height: 30, fontSize: 12 }}
                onClick={() => {
                  onHaptic?.('selection');
                  onToggleSplitPreview();
                }}
              >
                {dict.editor.backToEdit}
              </button>
            )}
          </div>
          {doc.officePreview ? (
            <OfficePreviewPane isZh={settings.locale === 'zh-CN'} title={doc.title} preview={doc.officePreview} />
          ) : (
            previewBlocks.map((blk, i) => {
              const t = blk.trim();
              if (!t) return null;
              if (t.startsWith('$$') && t.endsWith('$$')) {
                const math = t.slice(2, -2).trim();
                return (
                  <div
                    key={i}
                    style={{ margin: '12px 0', textAlign: 'center' }}
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(math, { displayMode: true, throwOnError: false }),
                    }}
                  />
                );
              }
              if (t.startsWith('# ')) {
                return <h1 key={i} dangerouslySetInnerHTML={{ __html: renderInlinePreviewHtml(t.slice(2)) }} />;
              }
              if (t.startsWith('## ')) {
                return <h2 key={i} dangerouslySetInnerHTML={{ __html: renderInlinePreviewHtml(t.slice(3)) }} />;
              }
              return <p key={i} dangerouslySetInnerHTML={{ __html: renderInlinePreviewHtml(t) }} />;
            })
          )}
        </div>
      )}

      <div
        className={`arc-collapsible-pane ${showPreview ? '' : 'is-collapsed'}`}
        style={{ width: showPreview ? previewWidth + 6 : 0 }}
      >
        <ResizeSash
          orientation="vertical"
          title={dict.editor.resizePreviewTip}
          onPointerDown={(e) =>
            startResizeDrag({
              event: e,
              axis: 'x',
              initialSize: previewWidth,
              min: 220,
              max: 680,
              invert: true,
              onResize: onResizePreview,
            })
          }
        />
        <div ref={previewScrollRef} className="arc-preview-pane" onScroll={handlePreviewScroll}>
          {doc.officePreview ? (
            <OfficePreviewPane isZh={settings.locale === 'zh-CN'} title={doc.title} preview={doc.officePreview} />
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                {dict.editor.previewSubtitle}
              </div>
              {previewBlocks.map((blk, i) => {
                const t = blk.trim();
                if (!t) return null;
                if (t.startsWith('$$') && t.endsWith('$$')) {
                  const math = t.slice(2, -2).trim();
                  return (
                    <div
                      key={i}
                      style={{ margin: '12px 0', textAlign: 'center' }}
                      dangerouslySetInnerHTML={{
                        __html: katex.renderToString(math, { displayMode: true, throwOnError: false }),
                      }}
                    />
                  );
                }
                if (t.startsWith('# ')) {
                  return <h1 key={i} dangerouslySetInnerHTML={{ __html: renderInlinePreviewHtml(t.slice(2)) }} />;
                }
                if (t.startsWith('## ')) {
                  return <h2 key={i} dangerouslySetInnerHTML={{ __html: renderInlinePreviewHtml(t.slice(3)) }} />;
                }
                if (t.startsWith('|')) {
                  const rows = t
                    .split('\n')
                    .filter((r) => r.trim().startsWith('|'))
                    .map((r) => r.trim().slice(1, -1).split('|').map((c) => c.trim()))
                    .filter((cells) => !cells.every((c) => /^:?-+:?$/.test(c)));
                  if (rows.length > 0) {
                    return (
                      <table key={i}>
                        <thead>
                          <tr>{rows[0].map((c, ci) => <th key={ci}>{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.slice(1).map((r, ri) => (
                            <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  }
                }
                return (
                  <p key={i} dangerouslySetInnerHTML={{ __html: renderInlinePreviewHtml(t) }} />
                );
              })}
            </>
          )}
        </div>
      </div>

      <div
        className={`arc-collapsible-pane ${showAnnotations ? '' : 'is-collapsed'}`}
        style={{ width: showAnnotations ? annotationWidth + 6 : 0 }}
      >
        <ResizeSash
          orientation="vertical"
          title={dict.editor.resizeAnnotationTip}
          onPointerDown={(e) =>
            startResizeDrag({
              event: e,
              axis: 'x',
              initialSize: annotationWidth,
              min: 230,
              max: 580,
              invert: true,
              onResize: onResizeAnnotation,
            })
          }
        />
        <div
          ref={annotationScrollRef}
          data-tour="annotation-sidebar"
          className="arc-annotation-pane"
          onScroll={handleAnnotationScroll}
          onClick={(e) => {
            if (e.target === e.currentTarget && selectedId) {
              setSelectedId(null);
            }
          }}
        >
          <AnnotationSidebar
            dict={dict}
            annotations={doc.annotations}
            anchors={anchors}
            documentText={currentText}
            settings={settings}
            effectiveAiPolicy={effectiveAiPolicy}
            hoveredId={hoveredId}
            selectedId={selectedId}
            minCanvasHeight={editorScrollHeight}
            readOnly={doc.isSealed}
            onHover={setHoveredId}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) {
                alignViewportToAnnotation(id, 'card');
              }
            }}
            onLocate={(id) => alignViewportToAnnotation(id, 'card')}
            onAcceptRevision={onAcceptRevision}
            onRejectRevision={onRejectRevision}
            onToggleResolveComment={onToggleResolveComment}
            onReplyComment={onReplyComment}
            onApplyAiSuggestion={onApplyAiSuggestion}
            onCardRectsMeasured={handleCardRectsMeasured}
          />
        </div>
      </div>

      {showAnnotations && <ArcLinkOverlay activeAnnotation={activeAnn} coords={linkCoords} />}

      <PhrasebankCapsule
        active={capsuleActive}
        docText={currentText}
        readOnly={doc.isSealed}
        settings={settings}
        effectiveAiPolicy={effectiveAiPolicy}
        selectionInfo={selectionInfo}
        editorRef={documentEditorRef}
        mobileMode={useMobileSheets ? 'fab-sheet' : 'desktop'}
        mobileSheetOpen={mobilePbSheetOpen}
        onSetMobileSheetOpen={setMobilePbSheetOpen}
        onHaptic={onHaptic}
        onUpdatePhrasebankSettings={onUpdatePhrasebankSettings}
        onCloseCapsule={() => {
          onSetCapsuleDismissed(true);
          onNotify(dict.editor.capsuleClosedToast);
        }}
        onNotify={onNotify}
      />

      {pendingParaConfirm && (
        <div className="arc-bb-modal-backdrop">
          <div
            className={`arc-bb-modal arc-para-confirm-modal${pendingParaConfirm.step === 'pick-sticker' ? ' is-wide' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {pendingParaConfirm.step === 'confirm' ? (
              pendingParaConfirm.revertConfirm ? (
                <>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    {settings.locale === 'zh-CN' ? '二次确认：回退段落修改？' : 'Confirm Revert?'}
                  </strong>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {settings.locale === 'zh-CN'
                      ? '确定要放弃并撤销刚才对该段落的修改，并重新聚焦该段落吗？'
                      : 'Discard and revert your recent edits to this paragraph and refocus it?'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="arc-btn"
                      style={{ height: 30, fontSize: 12 }}
                      onClick={() =>
                        setPendingParaConfirm((prev) => (prev ? { ...prev, revertConfirm: false } : null))
                      }
                    >
                      {settings.locale === 'zh-CN' ? '返回' : 'Back'}
                    </button>
                    <button
                      type="button"
                      className="arc-btn arc-btn-primary"
                      style={{ height: 30, fontSize: 12, background: '#dc2626', borderColor: '#dc2626' }}
                      onClick={() => {
                        onHaptic?.('warning');
                        onTextChange(pendingParaConfirm.originalFullText);
                        const pStart = pendingParaConfirm.paraStart;
                        paraSessionRef.current = null;
                        setPendingParaConfirm(null);
                        focusParaEditor(pStart);
                      }}
                    >
                      {settings.locale === 'zh-CN' ? '确认回退' : 'Confirm Revert'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    {settings.locale === 'zh-CN' ? '确认保存刚才的修改？' : 'Save Paragraph Changes?'}
                  </strong>
                  <div className="arc-para-confirm-preview">
                    {pendingParaConfirm.latestParaText}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="arc-btn"
                      style={{ height: 30, fontSize: 12 }}
                      onClick={() => {
                        onHaptic?.('selection');
                        const pStart = pendingParaConfirm.paraStart;
                        setPendingParaConfirm(null);
                        focusParaEditor(pStart);
                      }}
                    >
                      {settings.locale === 'zh-CN' ? '取消' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      className="arc-btn"
                      style={{ height: 30, fontSize: 12, color: '#dc2626' }}
                      onClick={() => {
                        onHaptic?.('warning');
                        setPendingParaConfirm((prev) => (prev ? { ...prev, revertConfirm: true } : null));
                      }}
                    >
                      {settings.locale === 'zh-CN' ? '取消并回退修改' : 'Cancel & Revert'}
                    </button>
                    <button
                      type="button"
                      className="arc-btn arc-btn-primary"
                      style={{ height: 30, fontSize: 12 }}
                      onClick={() => {
                        onHaptic?.('light');
                        setPendingParaConfirm((prev) => (prev ? { ...prev, step: 'pick-sticker' } : null));
                      }}
                    >
                      {settings.locale === 'zh-CN' ? '选择贴纸保存' : 'Save with Sticker'}
                    </button>
                  </div>
                </>
              )
            ) : (
              (() => {
                const isZhLocale = settings.locale === 'zh-CN';
                const pickedSticker =
                  allStickers.find((s) => s.id === pendingParaConfirm.pickedStickerId) ??
                  allStickers[0] ??
                  DEFAULT_REVISION_STICKERS[0];
                return (
                  <>
                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                      {isZhLocale ? '从贴纸库选择贴纸' : 'Choose a Sticker'}
                    </strong>

                    <div className="arc-sticker-preview-stage is-theme">
                      <StickerVisual
                        sticker={pickedSticker}
                        textStyle={pendingParaConfirm.textOverlay}
                        fallbackText={pendingParaConfirm.latestParaText}
                        mode="preview"
                        isZh={isZhLocale}
                      />
                    </div>

                    <StickerPickerTabs
                      allStickers={allStickers}
                      selectedStickerId={pendingParaConfirm.pickedStickerId}
                      activeTab={pendingParaConfirm.pickerTab}
                      onTabChange={(tab) =>
                        setPendingParaConfirm((prev) =>
                          prev ? { ...prev, pickerTab: tab } : null,
                        )
                      }
                      onSelect={(stk) => {
                        onHaptic?.('selection');
                        setPendingParaConfirm((prev) => {
                          if (!prev) return null;
                          const nextOverlay: StickerTextStyle = stk.defaultTextStyle
                            ? {
                                ...stk.defaultTextStyle,
                                text: prev.textOverlay.text || stk.defaultTextStyle.text,
                              }
                            : prev.userTouchedColor
                              ? prev.textOverlay
                              : {
                                  ...prev.textOverlay,
                                  color: stk.defaultTextColor ?? prev.textOverlay.color,
                                  strokeColor:
                                    stk.defaultStrokeColor ?? prev.textOverlay.strokeColor,
                                };
                          return {
                            ...prev,
                            pickedStickerId: stk.id,
                            textOverlay: nextOverlay,
                          };
                        });
                      }}
                      isZh={isZhLocale}
                      surface="theme"
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {isZhLocale ? '贴纸叠加文字与样式' : 'Overlay Text & Style'}
                      </span>
                      <button
                        type="button"
                        className="arc-sticker-chip is-theme"
                        onClick={() =>
                          setPendingParaConfirm((prev) =>
                            prev
                              ? { ...prev, showTextCustomizer: !prev.showTextCustomizer }
                              : null,
                          )
                        }
                      >
                        {pendingParaConfirm.showTextCustomizer
                          ? isZhLocale
                            ? '收起样式'
                            : 'Hide'
                          : isZhLocale
                            ? '展开样式'
                            : 'Customize'}
                      </button>
                    </div>

                    {pendingParaConfirm.showTextCustomizer && (
                      <StickerTextStyleControls
                        value={pendingParaConfirm.textOverlay}
                        onChange={(nextStyle) =>
                          setPendingParaConfirm((prev) =>
                            prev ? { ...prev, textOverlay: nextStyle } : null,
                          )
                        }
                        onColorTouched={() =>
                          setPendingParaConfirm((prev) =>
                            prev ? { ...prev, userTouchedColor: true } : null,
                          )
                        }
                        draftFallbackText={pendingParaConfirm.latestParaText}
                        isZh={isZhLocale}
                        surface="theme"
                        compact
                      />
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="arc-btn"
                        style={{ height: 30, fontSize: 12 }}
                        onClick={() =>
                          setPendingParaConfirm((prev) =>
                            prev ? { ...prev, step: 'confirm' } : null,
                          )
                        }
                      >
                        {isZhLocale ? '返回' : 'Back'}
                      </button>
                      <button
                        type="button"
                        className="arc-btn arc-btn-primary"
                        style={{ height: 30, fontSize: 12 }}
                        onClick={() => {
                          const ann = doc.annotations.find(
                            (a) => a.id === pendingParaConfirm.annId,
                          );
                          setArchiveStickers((prev) => [
                            ...prev,
                            {
                              id: `arcstk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              annId: pendingParaConfirm.annId,
                              stickerId: pendingParaConfirm.pickedStickerId,
                              draftText: pendingParaConfirm.latestParaText,
                              snippet: ann?.originalText.slice(0, 24) || ann?.author || '段落修改',
                              savedAt: Date.now(),
                              textOverlay: pendingParaConfirm.textOverlay,
                            },
                          ]);
                          const nextAnn = pendingParaConfirm.nextAnnId;
                          paraSessionRef.current = null;
                          setPendingParaConfirm(null);
                          if (nextAnn) {
                            setSelectedId(nextAnn);
                          }
                        }}
                      >
                        {isZhLocale ? '就要这个' : 'Use This'}
                      </button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {longPressMenu && (
        <div
          className="arc-longpress-backdrop"
          onClick={() => setLongPressMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setLongPressMenu(null);
          }}
        >
          <div
            className="arc-longpress-capsule"
            style={{
              left: Math.max(12, Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - 240, longPressMenu.x - 90)),
              top: Math.max(56, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 70, longPressMenu.y - 54)),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="arc-btn arc-btn-primary"
              style={{ height: 30, fontSize: 12, borderRadius: 999 }}
              onClick={() => {
                onHaptic?.('medium');
                if (longPressMenu.annotationId) {
                  setSelectedId(longPressMenu.annotationId);
                }
                onSetRevisionMode?.(!revisionMode);
                setLongPressMenu(null);
              }}
            >
              {revisionMode
                ? settings.locale === 'zh-CN'
                  ? '退出修订模式'
                  : 'Exit Revision Mode'
                : settings.locale === 'zh-CN'
                  ? '进入修订模式'
                  : 'Enter Revision Mode'}
            </button>
            {longPressMenu.annotationId && (
              <button
                type="button"
                className="arc-btn"
                style={{ height: 30, fontSize: 12, borderRadius: 999 }}
                onClick={() => {
                  onHaptic?.('selection');
                  setSelectedId(longPressMenu.annotationId);
                  setLongPressMenu(null);
                }}
              >
                {settings.locale === 'zh-CN' ? '选中批注' : 'Focus Note'}
              </button>
            )}
          </div>
        </div>
      )}

      {isPhone && !revisionMode && !isFullscreen && !doc.officePreview && (
        <MobileQuickFormatBar
          isZh={settings.locale === 'zh-CN'}
          readOnly={doc.isSealed}
          activeFormat={activeFormat}
          splitPreview={splitPreview}
          canUndo={canUndo}
          canRedo={canRedo}
          openAnnotationCount={openAnnotationCount}
          phrasebankActive={mobilePbSheetOpen}
          onUndo={() => onUndo?.()}
          onRedo={() => onRedo?.()}
          onInsertSnippet={handleQuickInsert}
          onToggleFormat={() =>
            onFormatChange?.(activeFormat === 'markdown' ? 'latex' : 'markdown')
          }
          onToggleSplitPreview={() => onToggleSplitPreview?.()}
          onOpenAnnotations={() => onSetRevisionMode?.(true)}
          onTogglePhrasebank={() => {
            if (!pbSettings.enabled) {
              onUpdatePhrasebankSettings({ enabled: true, collapsed: false });
            }
            onSetCapsuleDismissed(false);
            setMobilePbSheetOpen((v) => !v);
          }}
          onOpenCameraScan={() => onOpenCameraScan?.()}
          onSaveMilestone={() => onSaveMilestone?.()}
          onHaptic={(p) => onHaptic?.(p)}
        />
      )}
    </main>
  );
};
