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
import { MobileAnnotationSheet } from './MobileAnnotationSheet';
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
  mobileAnnotationSheetOpen?: boolean;
  onSetMobileAnnotationSheetOpen?: (open: boolean) => void;
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
  mobileAnnotationSheetOpen = false,
  onSetMobileAnnotationSheetOpen,
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

  return (
    <main ref={workspaceRef} data-tour="workspace-main" className={`arc-workspace ${isPhone ? 'is-phone' : ''}`}>
      {!showPhonePreviewOnly && (
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
              onHaptic?.('light');
              if (useMobileSheets) {
                onSetMobileAnnotationSheetOpen?.(true);
              }
              alignViewportToAnnotation(id, 'editor');
            }}
            onAnchorsMeasured={setAnchors}
            scrollContainerRef={editorScrollRef}
          />
        </div>
      </div>
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

      {useMobileSheets && (
        <MobileAnnotationSheet
          open={mobileAnnotationSheetOpen}
          annotations={doc.annotations}
          selectedId={selectedId}
          documentText={currentText}
          settings={settings}
          effectiveAiPolicy={effectiveAiPolicy}
          readOnly={doc.isSealed}
          onSelect={setSelectedId}
          onLocate={(id) => {
            const ann = doc.annotations.find((a) => a.id === id);
            if (ann) {
              documentEditorRef.current?.selectAndScrollTo(ann.anchorStart, ann.anchorEnd);
            }
          }}
          onAcceptRevision={onAcceptRevision}
          onRejectRevision={onRejectRevision}
          onToggleResolveComment={onToggleResolveComment}
          onReplyComment={onReplyComment}
          onApplyAiSuggestion={onApplyAiSuggestion}
          onHaptic={(p) => onHaptic?.(p)}
          onClose={() => onSetMobileAnnotationSheetOpen?.(false)}
        />
      )}

      {isPhone && !isFullscreen && !doc.officePreview && (
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
          onOpenAnnotations={() => onSetMobileAnnotationSheetOpen?.(true)}
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
