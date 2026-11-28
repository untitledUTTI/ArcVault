import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  GitPullRequestDraft,
  ImagePlus,
  Layers,
  List,
  LocateFixed,
  MessageSquare,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  StickyNote,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AiPrivacyBlockedError, generateAnnotationRewrite } from '../core/aiGateway';
import {
  DEFAULT_ANNOTATION_FILTER,
  countAnnotationStats,
  filterAnnotations,
  isAnnotationFilterActive,
  type AnnotationFilterState,
} from '../core/annotationFilter';
import {
  DEFAULT_REVISION_STICKERS,
  JOURNAL_STRIP_STICKERS,
  createDefaultStickerTextStyle,
  getEffectiveStickerTextStyle,
  getStickerCategory,
  isStripImageSticker,
  type RevisionArchiveStickerItem,
  type RevisionDraftEntry,
  type RevisionStickerDef,
  type StickerCategory,
  type StickerTextStyle,
} from '../core/revisionStickers';
import { StickerPickerTabs } from './StickerPickerTabs';
import { StickerTextStyleControls } from './StickerTextStyleControls';
import { StickerOverlayText, StickerVisual } from './StickerVisual';
import { registerBackHandler, shouldStartBoardPan } from '../platform/backProtection';
import type {
  AiPrivacyPolicy,
  AnnotationItem,
  AppSettings,
  HapticPattern,
} from '../types/archive';

const BOARD_DRAG_THRESHOLD = 6;

interface RevisionSplitWorkspaceProps {
  docId: string;
  annotations: AnnotationItem[];
  selectedId: string | null;
  documentText: string;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  readOnly: boolean;
  allStickers: RevisionStickerDef[];
  archiveStickers: RevisionArchiveStickerItem[];
  onAddCustomSticker: (stk: RevisionStickerDef) => void;
  onDeleteCustomSticker?: (id: string) => void;
  onAddArchiveSticker: (item: RevisionArchiveStickerItem) => void;
  onUpdateArchiveSticker: (
    archiveId: string,
    patch: Partial<Pick<RevisionArchiveStickerItem, 'stickerId' | 'textOverlay'>>,
  ) => void;
  onSelect: (id: string) => void;
  onLocate: (id: string) => void;
  onJumpToPosition: (pos: number) => void;
  onAcceptRevision: (id: string) => void;
  onRejectRevision: (id: string) => void;
  onToggleResolveComment: (id: string) => void;
  onReplyComment: (id: string, text: string) => void;
  onApplyAiSuggestion: (id: string, rewrite: string) => void;
  onBatchAcceptRevisions?: (targetIds?: string[]) => void;
  onBatchRejectRevisions?: (targetIds?: string[]) => void;
  onBatchResolveComments?: (targetIds?: string[]) => void;
  onHaptic: (pattern: HapticPattern) => void;
}

export const RevisionSplitWorkspace: React.FC<RevisionSplitWorkspaceProps> = ({
  docId,
  annotations,
  selectedId,
  documentText,
  settings,
  effectiveAiPolicy,
  readOnly,
  allStickers,
  archiveStickers,
  onAddCustomSticker,
  onDeleteCustomSticker,
  onAddArchiveSticker,
  onUpdateArchiveSticker,
  onSelect,
  onLocate,
  onJumpToPosition,
  onAcceptRevision,
  onRejectRevision,
  onToggleResolveComment,
  onReplyComment,
  onApplyAiSuggestion,
  onBatchAcceptRevisions,
  onBatchRejectRevisions,
  onBatchResolveComments,
  onHaptic,
}) => {
  const isZh = settings.locale === 'zh-CN';
  const [blackboardMode, setBlackboardMode] = useState(false);
  const [boardZoom, setBoardZoom] = useState(1);
  const [boardPan, setBoardPan] = useState({ x: 0, y: 0 });
  const [boardSearch, setBoardSearch] = useState('');
  const [annFilter, setAnnFilter] = useState<AnnotationFilterState>(DEFAULT_ANNOTATION_FILTER);
  const [showListOverview, setShowListOverview] = useState(false);
  const [activeSectionPos, setActiveSectionPos] = useState<number | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<{
    annId: string;
    text: string;
    source?: string;
    error?: boolean;
  } | null>(null);

  // Per-note independent unsaved drafts bound to annId
  const draftsStorageKey = `arcvault_rev_drafts_v1_${docId}`;
  const [draftsByAnnId, setDraftsByAnnId] = useState<Record<string, RevisionDraftEntry>>(() => {
    try {
      const raw = localStorage.getItem(draftsStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, RevisionDraftEntry>) : {};
    } catch {
      return {};
    }
  });

  // Sticker Library & Sticker Detail / Style Edit Modals (hidden by default)
  const [stickerLibraryOpen, setStickerLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<StickerCategory>('journal');
  const [librarySelectedStickerId, setLibrarySelectedStickerId] = useState<string>(
    () => allStickers[0]?.id ?? JOURNAL_STRIP_STICKERS[0].id,
  );
  const [libraryTextStyle, setLibraryTextStyle] = useState<StickerTextStyle>(() =>
    createDefaultStickerTextStyle(allStickers[0] ?? JOURNAL_STRIP_STICKERS[0]),
  );
  const [libraryUserTouchedColor, setLibraryUserTouchedColor] = useState(false);
  const [customStickerName, setCustomStickerName] = useState('');
  const [customStickerEmoji, setCustomStickerEmoji] = useState('🏷️');
  const [customStickerColor, setCustomStickerColor] = useState('#0ea5e9');
  const pngInputRef = useRef<HTMLInputElement>(null);

  const [viewingStickerArchive, setViewingStickerArchive] =
    useState<RevisionArchiveStickerItem | null>(null);
  const [editingStickerArchive, setEditingStickerArchive] =
    useState<RevisionArchiveStickerItem | null>(null);
  const [editStickerId, setEditStickerId] = useState<string>('');
  const [editPickerTab, setEditPickerTab] = useState<StickerCategory>('journal');
  const [editTextStyle, setEditTextStyle] = useState<StickerTextStyle>(() =>
    createDefaultStickerTextStyle(JOURNAL_STRIP_STICKERS[0]),
  );
  const [editUserTouchedColor, setEditUserTouchedColor] = useState(false);

  const openEditStickerModal = (arc: RevisionArchiveStickerItem) => {
    const stk = allStickers.find((s) => s.id === arc.stickerId) ?? allStickers[0] ?? DEFAULT_REVISION_STICKERS[0];
    setEditingStickerArchive(arc);
    setEditStickerId(stk.id);
    setEditPickerTab(getStickerCategory(stk));
    setEditTextStyle(getEffectiveStickerTextStyle(stk, arc));
    setEditUserTouchedColor(false);
  };

  useEffect(() => {
    try {
      const rawD = localStorage.getItem(`arcvault_rev_drafts_v1_${docId}`);
      setDraftsByAnnId(rawD ? (JSON.parse(rawD) as Record<string, RevisionDraftEntry>) : {});
    } catch {
      setDraftsByAnnId({});
    }
    setAnnFilter(DEFAULT_ANNOTATION_FILTER);
    setShowListOverview(false);
  }, [docId]);

  useEffect(() => {
    try {
      localStorage.setItem(draftsStorageKey, JSON.stringify(draftsByAnnId));
    } catch {
      // ignore storage quota
    }
  }, [draftsStorageKey, draftsByAnnId]);

  const allStats = useMemo(() => countAnnotationStats(annotations), [annotations]);
  const filteredAnnotations = useMemo(
    () => filterAnnotations(annotations, annFilter),
    [annotations, annFilter],
  );
  const filteredStats = useMemo(
    () => countAnnotationStats(filteredAnnotations),
    [filteredAnnotations],
  );

  const ordered = useMemo(() => {
    const openFirst = filteredAnnotations.filter((a) => a.status === 'open');
    const resolvedRest = filteredAnnotations.filter((a) => a.status !== 'open');
    return [...openFirst, ...resolvedRest];
  }, [filteredAnnotations]);

  const activeIdx = Math.max(
    0,
    ordered.findIndex((a) => a.id === selectedId),
  );
  const current = ordered[activeIdx] ?? null;

  const sections = useMemo(() => {
    const out: Array<{ title: string; pos: number }> = [];
    const lines = documentText.split('\n');
    let offset = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^#{1,3}\s+/.test(trimmed)) {
        out.push({ title: trimmed.replace(/^#{1,3}\s+/, ''), pos: offset });
      }
      offset += line.length + 1;
    }
    return out;
  }, [documentText]);

  const currentDraftText = current ? (draftsByAnnId[current.id]?.text ?? '') : '';

  const updateCurrentDraft = (annId: string, text: string) => {
    setDraftsByAnnId((prev) => {
      if (!text.trim() && !prev[annId]) return prev;
      return {
        ...prev,
        [annId]: { annId, text, updatedAt: Date.now() },
      };
    });
  };

  // Bind & archive unsaved draft when switching sticky notes; newest archive appears at bottom
  const archiveCurrentDraftIfNeeded = (fromAnn: AnnotationItem | null) => {
    if (!fromAnn) return;
    const draft = draftsByAnnId[fromAnn.id]?.text ?? '';
    if (!draft.trim()) return;
    const lastForAnn = [...archiveStickers].reverse().find((s) => s.annId === fromAnn.id);
    if (lastForAnn && lastForAnn.draftText === draft) return;
    onAddArchiveSticker({
      id: `arcstk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      annId: fromAnn.id,
      stickerId: allStickers[0]?.id ?? DEFAULT_REVISION_STICKERS[0].id,
      draftText: draft,
      snippet: fromAnn.originalText.slice(0, 24) || fromAnn.author,
      savedAt: Date.now(),
    });
  };

  const switchToNote = (nextId: string) => {
    if (current && current.id !== nextId) {
      archiveCurrentDraftIfNeeded(current);
    }
    onHaptic('selection');
    onSelect(nextId);
    onLocate(nextId);
  };

  const stepCard = (dir: -1 | 1) => {
    if (ordered.length <= 1) return;
    const nextIdx = (activeIdx + dir + ordered.length) % ordered.length;
    switchToNote(ordered[nextIdx].id);
  };

  // Long-press on revision area -> shrink into Review Board View
  const lpTimerRef = useRef<number | null>(null);
  const lpStartRef = useRef<{ x: number; y: number } | null>(null);
  const clearLp = () => {
    if (lpTimerRef.current !== null) {
      window.clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
  };

  const handleRevisionPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (blackboardMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a')) return;
    clearLp();
    lpStartRef.current = { x: e.clientX, y: e.clientY };
    lpTimerRef.current = window.setTimeout(() => {
      lpTimerRef.current = null;
      onHaptic('medium');
      setBlackboardMode(true);
    }, 430);
  };

  const handleRevisionPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lpStartRef.current || lpTimerRef.current === null) return;
    if (Math.hypot(e.clientX - lpStartRef.current.x, e.clientY - lpStartRef.current.y) > 10) {
      clearLp();
    }
  };

  // Sticker long-press handler (edit sticker style) vs tap (view sticker content)
  const stickerLpTimerRef = useRef<number | null>(null);
  const stickerLpTriggeredRef = useRef(false);
  const stickerLpStartRef = useRef<{ x: number; y: number } | null>(null);
  const clearStickerLp = () => {
    if (stickerLpTimerRef.current !== null) {
      window.clearTimeout(stickerLpTimerRef.current);
      stickerLpTimerRef.current = null;
    }
    stickerLpStartRef.current = null;
  };

  // Blackboard pan & two-finger pinch zoom
  const boardDragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const boardDidDragRef = useRef(false);
  const boardDidDragResetTimerRef = useRef<number | null>(null);
  const [isBoardDragging, setIsBoardDragging] = useState(false);

  const markBoardDragged = () => {
    boardDidDragRef.current = true;
    if (boardDidDragResetTimerRef.current !== null) {
      window.clearTimeout(boardDidDragResetTimerRef.current);
      boardDidDragResetTimerRef.current = null;
    }
    clearStickerLp();
  };

  const finishBoardDrag = () => {
    const didMove = Boolean(boardDragRef.current?.moved);
    pinchRef.current = null;
    boardDragRef.current = null;
    setIsBoardDragging(false);
    if (didMove || boardDidDragRef.current) {
      if (boardDidDragResetTimerRef.current !== null) {
        window.clearTimeout(boardDidDragResetTimerRef.current);
      }
      boardDidDragResetTimerRef.current = window.setTimeout(() => {
        boardDidDragRef.current = false;
        boardDidDragResetTimerRef.current = null;
      }, 140);
    }
  };

  useEffect(() => {
    return () => {
      if (boardDidDragResetTimerRef.current !== null) {
        window.clearTimeout(boardDidDragResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!blackboardMode) return;
    return registerBackHandler(() => {
      if (editingStickerArchive) {
        setEditingStickerArchive(null);
        return true;
      }
      if (viewingStickerArchive) {
        setViewingStickerArchive(null);
        return true;
      }
      if (stickerLibraryOpen) {
        setStickerLibraryOpen(false);
        return true;
      }
      setBlackboardMode(false);
      return true;
    }, 60);
  }, [blackboardMode, editingStickerArchive, viewingStickerArchive, stickerLibraryOpen]);

  const handleBoardTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom: boardZoom };
      boardDragRef.current = null;
      setIsBoardDragging(false);
      markBoardDragged();
    } else if (e.touches.length === 1) {
      const target = e.target as HTMLElement | null;
      if (!shouldStartBoardPan(target)) return;
      boardDidDragRef.current = false;
      boardDragRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: boardPan.x,
        panY: boardPan.y,
        moved: false,
      };
    }
  };

  const handleBoardTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const nextZoom = Math.max(
        0.5,
        Math.min(1.9, pinchRef.current.zoom * (dist / Math.max(1, pinchRef.current.dist))),
      );
      markBoardDragged();
      setBoardZoom(Number(nextZoom.toFixed(2)));
    } else if (e.touches.length === 1 && boardDragRef.current) {
      const dx = e.touches[0].clientX - boardDragRef.current.x;
      const dy = e.touches[0].clientY - boardDragRef.current.y;
      if (!boardDragRef.current.moved) {
        if (Math.hypot(dx, dy) < BOARD_DRAG_THRESHOLD) return;
        boardDragRef.current.moved = true;
        setIsBoardDragging(true);
        markBoardDragged();
      }
      setBoardPan({
        x: boardDragRef.current.panX + dx,
        y: boardDragRef.current.panY + dy,
      });
    }
  };

  const handleBoardTouchEnd = () => {
    finishBoardDrag();
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const target = e.target as HTMLElement | null;
    if (!shouldStartBoardPan(target)) return;
    boardDidDragRef.current = false;
    boardDragRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: boardPan.x,
      panY: boardPan.y,
      moved: false,
    };
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !boardDragRef.current) return;
    const dx = e.clientX - boardDragRef.current.x;
    const dy = e.clientY - boardDragRef.current.y;
    if (!boardDragRef.current.moved) {
      if (Math.hypot(dx, dy) < BOARD_DRAG_THRESHOLD) return;
      boardDragRef.current.moved = true;
      setIsBoardDragging(true);
      markBoardDragged();
    }
    setBoardPan({
      x: boardDragRef.current.panX + dx,
      y: boardDragRef.current.panY + dy,
    });
  };

  const handleBoardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    finishBoardDrag();
  };

  const handleAiRewrite = async (ann: AnnotationItem) => {
    setAiLoading(true);
    onHaptic('light');
    try {
      const ctxStart = Math.max(0, ann.anchorStart - 60);
      const ctxEnd = Math.min(documentText.length, ann.anchorEnd + 60);
      const res = await generateAnnotationRewrite({
        annotation: ann,
        contextSnippet: documentText.slice(ctxStart, ctxEnd),
        settings,
        policy: effectiveAiPolicy,
      });
      setAiPreview({ annId: ann.id, text: res.text, source: res.source });
      onHaptic('success');
    } catch (err) {
      const msg =
        err instanceof AiPrivacyBlockedError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'AI 建议生成失败';
      setAiPreview({ annId: ann.id, text: msg, error: true });
      onHaptic('error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImportStickerPng = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      const newId = `stk-png-${Date.now()}`;
      const newStk: RevisionStickerDef = {
        id: newId,
        label: file.name.replace(/\.png$/i, '').slice(0, 10) || 'PNG贴纸',
        color: '#6366f1',
        category: 'custom',
        isStripImage: true,
        textInset: [14, 14, 14, 14],
        pngDataUrl: dataUrl,
        isCustom: true,
      };
      onAddCustomSticker(newStk);
      setLibraryTab('custom');
      setLibrarySelectedStickerId(newId);
      onHaptic('success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredNotes = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((a) => {
      const draft = draftsByAnnId[a.id]?.text ?? '';
      return (
        a.originalText.toLowerCase().includes(q) ||
        (a.commentText ?? '').toLowerCase().includes(q) ||
        (a.suggestedText ?? '').toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        draft.toLowerCase().includes(q)
      );
    });
  }, [ordered, boardSearch, draftsByAnnId]);

  const commentNotes = useMemo(
    () => filteredNotes.filter((a) => a.type === 'comment'),
    [filteredNotes],
  );
  const revisionNotes = useMemo(
    () => filteredNotes.filter((a) => a.type === 'revision'),
    [filteredNotes],
  );

  const renderBlackboardPortal = (node: React.ReactNode) =>
    typeof document !== 'undefined' ? createPortal(node, document.body) : node;

  const stopModalPropagation = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation(),
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation(),
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation(),
    onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => e.stopPropagation(),
    onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => e.stopPropagation(),
    onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => e.stopPropagation(),
  };

  if (blackboardMode) {
    const renderBoardNode = (ann: AnnotationItem, kind: 'comment' | 'revision', idx: number) => {
      const draft = draftsByAnnId[ann.id]?.text ?? '';
      const isSel = ann.id === current?.id;
      const noteStickers = archiveStickers.filter((s) => s.annId === ann.id);
      const tiltDeg = idx % 3 === 0 ? -1.4 : idx % 3 === 1 ? 1.1 : -0.5;
      return (
        <div key={ann.id} className="arc-caseboard-node">
          <button
            type="button"
            className={`arc-sticky-note is-${kind} ${isSel ? 'is-active' : ''}`}
            style={{
              transform: isSel
                ? 'rotate(0deg) translateY(-4px) scale(1.03)'
                : `rotate(${tiltDeg}deg)`,
            }}
            onClick={() => {
              if (boardDidDragRef.current) {
                boardDidDragRef.current = false;
                return;
              }
              if (ann.id === current?.id) {
                onHaptic('light');
                setBlackboardMode(false);
              } else {
                switchToNote(ann.id);
              }
            }}
            onDoubleClick={() => {
              switchToNote(ann.id);
              setBlackboardMode(false);
            }}
          >
            <span className={`arc-sticky-pin ${kind === 'comment' ? 'is-blue' : 'is-red'}`} aria-hidden="true" />
            <div className="arc-sticky-head">
              <span>{ann.author}</span>
              <span>
                {ann.status === 'open'
                  ? kind === 'comment'
                    ? isZh ? '待处理' : 'Open'
                    : isZh ? '待修订' : 'Open'
                  : isZh ? '已处理' : ann.status}
              </span>
            </div>
            <div className="arc-sticky-quote">“{ann.originalText}”</div>
            {kind === 'comment' && ann.commentText && (
              <div className="arc-sticky-body">{ann.commentText}</div>
            )}
            {kind === 'revision' && ann.suggestedText && (
              <div className="arc-sticky-suggest">→ {ann.suggestedText}</div>
            )}
            {draft.trim() && (
              <div className="arc-sticky-draft-badge">
                {isZh ? '未保存草稿：' : 'Draft: '}
                {draft}
              </div>
            )}
          </button>

          {noteStickers.length > 0 && (
            <div className="arc-node-stickers-col">
              <div className="arc-node-yarn" aria-hidden="true" />
              {noteStickers.map((arc) => {
                const stk =
                  allStickers.find((s) => s.id === arc.stickerId) ??
                  allStickers[0] ??
                  DEFAULT_REVISION_STICKERS[0];
                const hash = arc.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
                const tapeModes = ['tape-left', 'tape-right', 'tape-top-left', 'tape-top-right'] as const;
                const tapeCls = tapeModes[hash % tapeModes.length];
                const slipTilt = hash % 2 === 0 ? '-1.4deg' : '1.3deg';
                const stripMode = isStripImageSticker(stk);

                const stickerPointerHandlers = {
                  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
                    clearStickerLp();
                    stickerLpTriggeredRef.current = false;
                    stickerLpStartRef.current = { x: e.clientX, y: e.clientY };
                    stickerLpTimerRef.current = window.setTimeout(() => {
                      stickerLpTimerRef.current = null;
                      stickerLpTriggeredRef.current = true;
                      onHaptic('medium');
                      openEditStickerModal(arc);
                    }, 440);
                  },
                  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
                    if (!stickerLpStartRef.current || stickerLpTimerRef.current === null) return;
                    if (
                      Math.hypot(
                        e.clientX - stickerLpStartRef.current.x,
                        e.clientY - stickerLpStartRef.current.y,
                      ) > 8
                    ) {
                      clearStickerLp();
                    }
                  },
                  onPointerUp: clearStickerLp,
                  onPointerCancel: clearStickerLp,
                  onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHaptic('medium');
                    openEditStickerModal(arc);
                  },
                  onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    if (boardDidDragRef.current) {
                      boardDidDragRef.current = false;
                      return;
                    }
                    if (stickerLpTriggeredRef.current) {
                      stickerLpTriggeredRef.current = false;
                      return;
                    }
                    onHaptic('selection');
                    setViewingStickerArchive(arc);
                  },
                };

                if (stripMode) {
                  const effectiveStyle = getEffectiveStickerTextStyle(stk, arc);
                  return (
                    <button
                      key={arc.id}
                      type="button"
                      className="arc-archive-sticker-strip"
                      style={{ transform: `rotate(${slipTilt})` }}
                      {...stickerPointerHandlers}
                    >
                      <StickerVisual
                        sticker={stk}
                        textStyle={effectiveStyle}
                        fallbackText={arc.draftText}
                        mode="board"
                        isZh={isZh}
                      />
                    </button>
                  );
                }

                return (
                  <button
                    key={arc.id}
                    type="button"
                    className={`arc-archive-sticker-card is-journal-slip ${tapeCls}`}
                    style={{
                      borderLeftColor: stk.color,
                      transform: `rotate(${slipTilt})`,
                    }}
                    {...stickerPointerHandlers}
                  >
                    <span
                      className="arc-washi-tape"
                      style={{ backgroundColor: stk.color }}
                      aria-hidden="true"
                    />
                    <div className="arc-archive-sticker-icon">
                      {stk.pngDataUrl ? (
                        <img src={stk.pngDataUrl} alt={stk.label} style={{ width: 18, height: 18, objectFit: 'contain' }} />
                      ) : (
                        <span>{stk.emoji}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stk.label}</span>
                        <span style={{ opacity: 0.65, fontSize: 10, flexShrink: 0 }}>
                          {new Date(arc.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {arc.textOverlay && (arc.textOverlay.text.trim() || arc.draftText.trim()) ? (
                        <div style={{ marginTop: 1 }}>
                          <StickerOverlayText
                            style={arc.textOverlay}
                            fallbackText={arc.draftText}
                            maxLines={1}
                            scale={0.86}
                          />
                        </div>
                      ) : (
                        <div style={{ fontSize: 10.5, color: 'rgba(248,250,252,0.78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {arc.draftText}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        data-tour="annotation-sidebar"
        className="arc-blackboard"
        onTouchStart={handleBoardTouchStart}
        onTouchMove={handleBoardTouchMove}
        onTouchEnd={handleBoardTouchEnd}
        onTouchCancel={handleBoardTouchEnd}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerCancel={handleBoardPointerUp}
      >
        <div className="arc-blackboard-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <StickyNote size={14} color="#fbbf24" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
              {isZh ? '审阅黑板' : 'Review Board'}
            </span>
            <span style={{ fontSize: 10.5, color: 'rgba(248,250,252,0.6)', whiteSpace: 'nowrap' }}>
              {commentNotes.length} · {revisionNotes.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="arc-bb-icon-btn"
              onClick={() => {
                onHaptic('selection');
                setStickerLibraryOpen(true);
              }}
            >
              <Palette size={12} /> {isZh ? '贴纸库' : 'Stickers'}
            </button>
            <button
              type="button"
              className="arc-bb-icon-btn"
              onClick={() => {
                onHaptic('selection');
                setBoardZoom(1);
                setBoardPan({ x: 0, y: 0 });
              }}
              title={isZh ? '回到页面中心' : 'Back to Center'}
            >
              <LocateFixed size={12} /> {isZh ? '回到中心' : 'Center'}
            </button>
            <button
              type="button"
              className="arc-bb-icon-btn"
              onClick={() => setBoardZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              className="arc-bb-icon-btn"
              onClick={() => setBoardZoom((z) => Math.min(1.9, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
            <button
              type="button"
              className="arc-bb-primary-btn"
              onClick={() => {
                onHaptic('light');
                setBlackboardMode(false);
              }}
            >
              {isZh ? '返回编辑' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="arc-blackboard-viewport">
          <div
            className={`arc-caseboard-world ${isBoardDragging ? 'is-dragging' : ''}`}
            style={{
              transform: `translate3d(${boardPan.x}px, ${boardPan.y}px, 0) scale(${boardZoom})`,
            }}
          >
            <div className="arc-caseboard-row-section">
              <div className="arc-blackboard-row-label">
                {isZh ? 'ROW 01 · 批注便签' : 'ROW 01 · COMMENTS'}
              </div>
              <div className="arc-blackboard-row">
                {commentNotes.length === 0 ? (
                  <div className="arc-blackboard-empty">{isZh ? '暂无批注便签' : 'No comment notes'}</div>
                ) : (
                  commentNotes.map((ann, idx) => renderBoardNode(ann, 'comment', idx))
                )}
              </div>
            </div>

            <div className="arc-caseboard-row-section is-second-row">
              <div className="arc-blackboard-row-label">
                {isZh ? 'ROW 02 · 修订便签' : 'ROW 02 · REVISIONS'}
              </div>
              <div className="arc-blackboard-row">
                {revisionNotes.length === 0 ? (
                  <div className="arc-blackboard-empty">{isZh ? '暂无修订便签' : 'No revision notes'}</div>
                ) : (
                  revisionNotes.map((ann, idx) => renderBoardNode(ann, 'revision', idx))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fade-in Bottom Capsule */}
        <div className="arc-blackboard-capsule">
          <div className="arc-bb-capsule-search">
            <Search size={13} color="rgba(248,250,252,0.72)" />
            <input
              type="text"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              placeholder={isZh ? '搜索便签/草稿...' : 'Search notes...'}
              className="arc-bb-capsule-input"
            />
          </div>
          {sections.length > 0 && (
            <div className="arc-bb-capsule-sections">
              <Layers size={13} color="#fbbf24" style={{ flexShrink: 0 }} />
              {sections.map((sec, i) => (
                <button
                  key={`${sec.pos}-${i}`}
                  type="button"
                  className={`arc-bb-sec-pill ${activeSectionPos === sec.pos ? 'is-active' : ''}`}
                  onClick={() => {
                    onHaptic('selection');
                    setActiveSectionPos(sec.pos);
                    onJumpToPosition(sec.pos);
                  }}
                >
                  {sec.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticker Library Modal (opened only via "贴纸库" button) */}
        {stickerLibraryOpen &&
          renderBlackboardPortal(
            <div
              className="arc-bb-modal-backdrop"
              {...stopModalPropagation}
              onClick={() => setStickerLibraryOpen(false)}
            >
              <div className="arc-bb-modal is-wide is-sheet-scroll" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const selectedStk =
                    allStickers.find((s) => s.id === librarySelectedStickerId) ??
                    allStickers[0] ??
                    JOURNAL_STRIP_STICKERS[0];
                  return (
                    <>
                      <div className="arc-bb-modal-header">
                        <strong style={{ fontSize: 14, color: '#f8fafc' }}>
                          {isZh ? '贴纸库（手帐贴纸 & 文字叠加）' : 'Sticker Library & Text Overlay'}
                        </strong>
                        <button type="button" className="arc-bb-icon-btn" onClick={() => setStickerLibraryOpen(false)}>
                          <X size={13} />
                        </button>
                      </div>

                      <div className="arc-bb-modal-scroll">
                        <StickerPickerTabs
                          allStickers={allStickers}
                          selectedStickerId={selectedStk.id}
                          activeTab={libraryTab}
                          onTabChange={setLibraryTab}
                          onSelect={(stk) => {
                            onHaptic('selection');
                            setLibrarySelectedStickerId(stk.id);
                            setLibraryTextStyle((prev) => {
                              if (stk.defaultTextStyle) {
                                return {
                                  ...stk.defaultTextStyle,
                                  text: prev.text || stk.defaultTextStyle.text,
                                };
                              }
                              if (libraryUserTouchedColor) return prev;
                              return {
                                ...prev,
                                color: stk.defaultTextColor ?? prev.color,
                                strokeColor: stk.defaultStrokeColor ?? prev.strokeColor,
                              };
                            });
                          }}
                          onDeleteCustomSticker={onDeleteCustomSticker}
                          isZh={isZh}
                          surface="dark"
                        />

                        {/* WYSIWYG Preview Stage */}
                        <div className="arc-sticker-preview-stage">
                          <StickerVisual
                            sticker={selectedStk}
                            textStyle={libraryTextStyle}
                            mode="preview"
                            isZh={isZh}
                          />
                        </div>

                        {/* Text Overlay Customizer */}
                        <StickerTextStyleControls
                          value={libraryTextStyle}
                          onChange={setLibraryTextStyle}
                          onColorTouched={() => setLibraryUserTouchedColor(true)}
                          isZh={isZh}
                          surface="dark"
                          compact
                          draftFallbackText={currentDraftText}
                        />

                        {libraryTab === 'custom' && (
                          <div className="arc-custom-sticker-form">
                            <input
                              type="text"
                              className="arc-input"
                              style={{ height: 28, fontSize: 12, flex: 1, minWidth: 90 }}
                              placeholder={isZh ? '新建贴纸名称' : 'New sticker name'}
                              value={customStickerName}
                              onChange={(e) => setCustomStickerName(e.target.value)}
                            />
                            <input
                              type="text"
                              className="arc-input"
                              style={{ height: 28, fontSize: 12, width: 44, textAlign: 'center' }}
                              value={customStickerEmoji}
                              onChange={(e) => setCustomStickerEmoji(e.target.value)}
                            />
                            <input
                              type="color"
                              value={customStickerColor}
                              onChange={(e) => setCustomStickerColor(e.target.value)}
                              style={{ width: 28, height: 28, border: 'none', background: 'transparent' }}
                            />
                            <button
                              type="button"
                              className="arc-bb-primary-btn"
                              onClick={() => {
                                const newId = `stk-custom-${Date.now()}`;
                                onAddCustomSticker({
                                  id: newId,
                                  label: customStickerName.trim() || (isZh ? '自定义' : 'Custom'),
                                  emoji: customStickerEmoji || '🏷️',
                                  color: customStickerColor,
                                  category: 'custom',
                                  isCustom: true,
                                });
                                setCustomStickerName('');
                                setLibrarySelectedStickerId(newId);
                                onHaptic('success');
                              }}
                            >
                              <Plus size={12} /> {isZh ? '添加' : 'Add'}
                            </button>
                            <button type="button" className="arc-bb-icon-btn" onClick={() => pngInputRef.current?.click()}>
                              <ImagePlus size={12} /> {isZh ? '导入 PNG' : 'PNG'}
                            </button>
                            <input
                              ref={pngInputRef}
                              type="file"
                              accept="image/png"
                              style={{ display: 'none' }}
                              onChange={handleImportStickerPng}
                            />
                          </div>
                        )}
                      </div>

                      <div className="arc-bb-modal-footer">
                        <button
                          type="button"
                          className="arc-bb-icon-btn"
                          onClick={() => {
                            const newId = `stk-custom-txt-${Date.now()}`;
                            onAddCustomSticker({
                              id: newId,
                              label: libraryTextStyle.text.trim().slice(0, 10) || selectedStk.label,
                              labelEn: libraryTextStyle.text.trim().slice(0, 14) || selectedStk.labelEn,
                              emoji: selectedStk.emoji,
                              color: selectedStk.color,
                              category: 'custom',
                              pngUrl: selectedStk.pngUrl,
                              pngDataUrl: selectedStk.pngDataUrl,
                              isStripImage: isStripImageSticker(selectedStk),
                              textInset: selectedStk.textInset,
                              defaultTextColor: libraryTextStyle.color,
                              defaultStrokeColor: libraryTextStyle.strokeColor,
                              defaultTextStyle: { ...libraryTextStyle },
                              isCustom: true,
                            });
                            setLibraryTab('custom');
                            setLibrarySelectedStickerId(newId);
                            onHaptic('success');
                          }}
                        >
                          <Plus size={12} /> {isZh ? '保存为自定义贴纸' : 'Save as Custom'}
                        </button>

                        {current && (
                          <button
                            type="button"
                            className="arc-bb-primary-btn"
                            onClick={() => {
                              onAddArchiveSticker({
                                id: `arcstk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                annId: current.id,
                                stickerId: selectedStk.id,
                                draftText:
                                  libraryTextStyle.text.trim() ||
                                  currentDraftText.trim() ||
                                  current.originalText.slice(0, 24) ||
                                  current.author,
                                snippet: current.originalText.slice(0, 24) || current.author,
                                savedAt: Date.now(),
                                textOverlay: { ...libraryTextStyle },
                              });
                              onHaptic('success');
                              setStickerLibraryOpen(false);
                            }}
                          >
                            {isZh ? '贴到当前便签' : 'Attach to Note'}
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>,
          )}

        {/* Click Sticker -> View Modified Content */}
        {viewingStickerArchive &&
          renderBlackboardPortal(
            <div
              className="arc-bb-modal-backdrop"
              {...stopModalPropagation}
              onClick={() => setViewingStickerArchive(null)}
            >
              <div className="arc-bb-modal is-sheet-scroll" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const stk =
                    allStickers.find((s) => s.id === viewingStickerArchive.stickerId) ??
                    allStickers[0] ??
                    DEFAULT_REVISION_STICKERS[0];
                  const effectiveStyle = getEffectiveStickerTextStyle(stk, viewingStickerArchive);
                  return (
                    <>
                      <div className="arc-bb-modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {stk.pngDataUrl || stk.pngUrl ? (
                            <img
                              src={stk.pngDataUrl || stk.pngUrl}
                              alt={stk.label}
                              style={{ width: 32, height: 20, objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ fontSize: 18 }}>{stk.emoji}</span>
                          )}
                          <strong style={{ fontSize: 13.5, color: '#f8fafc' }}>
                            {isZh ? stk.label : stk.labelEn || stk.label}
                          </strong>
                        </div>
                        <button type="button" className="arc-bb-icon-btn" onClick={() => setViewingStickerArchive(null)}>
                          <X size={13} />
                        </button>
                      </div>
                      <div className="arc-bb-modal-scroll">
                        {isStripImageSticker(stk) && (
                          <div className="arc-sticker-preview-stage">
                            <StickerVisual
                              sticker={stk}
                              textStyle={effectiveStyle}
                              fallbackText={viewingStickerArchive.draftText}
                              mode="preview"
                              isZh={isZh}
                            />
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'rgba(248,250,252,0.68)',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {viewingStickerArchive.snippet} ·{' '}
                          {new Date(viewingStickerArchive.savedAt).toLocaleString()}
                        </div>
                        <div className="arc-bb-modal-content">{viewingStickerArchive.draftText}</div>
                      </div>
                      <div className="arc-bb-modal-footer">
                        <button
                          type="button"
                          className="arc-bb-icon-btn"
                          onClick={() => {
                            const target = viewingStickerArchive;
                            setViewingStickerArchive(null);
                            openEditStickerModal(target);
                          }}
                        >
                          <Palette size={12} /> {isZh ? '编辑贴纸' : 'Edit Sticker'}
                        </button>
                        <button
                          type="button"
                          className="arc-bb-icon-btn"
                          onClick={() => setViewingStickerArchive(null)}
                        >
                          {isZh ? '关闭' : 'Close'}
                        </button>
                        <button
                          type="button"
                          className="arc-bb-primary-btn"
                          onClick={() => {
                            onHaptic('medium');
                            updateCurrentDraft(viewingStickerArchive.annId, viewingStickerArchive.draftText);
                            onSelect(viewingStickerArchive.annId);
                            onLocate(viewingStickerArchive.annId);
                            setViewingStickerArchive(null);
                            setBlackboardMode(false);
                          }}
                        >
                          {isZh ? '载入并定位' : 'Load & Locate'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>,
          )}

        {/* Long-press Sticker -> Edit Sticker Style, Text, Font, Stroke & Color */}
        {editingStickerArchive &&
          renderBlackboardPortal(
            <div
              className="arc-bb-modal-backdrop"
              {...stopModalPropagation}
              onClick={() => setEditingStickerArchive(null)}
            >
              <div className="arc-bb-modal is-wide is-sheet-scroll" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const editStk =
                    allStickers.find((s) => s.id === editStickerId) ??
                    allStickers[0] ??
                    DEFAULT_REVISION_STICKERS[0];
                  return (
                    <>
                      <div className="arc-bb-modal-header">
                        <strong style={{ fontSize: 14, color: '#f8fafc' }}>
                          {isZh ? '编辑黑板贴纸（样式与叠加文字）' : 'Edit Board Sticker'}
                        </strong>
                        <button type="button" className="arc-bb-icon-btn" onClick={() => setEditingStickerArchive(null)}>
                          <X size={13} />
                        </button>
                      </div>

                      <div className="arc-bb-modal-scroll">
                        <div className="arc-sticker-preview-stage">
                          <StickerVisual
                            sticker={editStk}
                            textStyle={editTextStyle}
                            fallbackText={editingStickerArchive.draftText}
                            mode="preview"
                            isZh={isZh}
                          />
                        </div>

                        <StickerPickerTabs
                          allStickers={allStickers}
                          selectedStickerId={editStk.id}
                          activeTab={editPickerTab}
                          onTabChange={setEditPickerTab}
                          onSelect={(stk) => {
                            onHaptic('selection');
                            setEditStickerId(stk.id);
                            setEditTextStyle((prev) => {
                              if (stk.defaultTextStyle) {
                                return {
                                  ...stk.defaultTextStyle,
                                  text: prev.text || stk.defaultTextStyle.text,
                                };
                              }
                              if (editUserTouchedColor) return prev;
                              return {
                                ...prev,
                                color: stk.defaultTextColor ?? prev.color,
                                strokeColor: stk.defaultStrokeColor ?? prev.strokeColor,
                              };
                            });
                          }}
                          isZh={isZh}
                          surface="dark"
                        />

                        <StickerTextStyleControls
                          value={editTextStyle}
                          onChange={setEditTextStyle}
                          onColorTouched={() => setEditUserTouchedColor(true)}
                          draftFallbackText={editingStickerArchive.draftText}
                          isZh={isZh}
                          surface="dark"
                          compact
                        />
                      </div>

                      <div className="arc-bb-modal-footer">
                        <button
                          type="button"
                          className="arc-bb-icon-btn"
                          onClick={() => setEditingStickerArchive(null)}
                        >
                          {isZh ? '取消' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          className="arc-bb-primary-btn"
                          onClick={() => {
                            onHaptic('success');
                            onUpdateArchiveSticker(editingStickerArchive.id, {
                              stickerId: editStk.id,
                              textOverlay: { ...editTextStyle },
                            });
                            setEditingStickerArchive(null);
                          }}
                        >
                          <Check size={12} /> {isZh ? '保存修改' : 'Save Changes'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>,
          )}
      </div>
    );
  }

  return (
    <div
      data-tour="annotation-sidebar"
      className="arc-revision-pane"
      onPointerDown={handleRevisionPointerDown}
      onPointerMove={handleRevisionPointerMove}
      onPointerUp={clearLp}
      onPointerCancel={clearLp}
    >
      <div className="arc-revision-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <strong style={{ fontSize: 13 }}>
            {isZh
              ? `批注与修订 (${filteredStats.open}/${filteredAnnotations.length})`
              : `Review (${filteredStats.open}/${filteredAnnotations.length})`}
          </strong>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isZh ? '· 长按进入审阅黑板' : '· Long-press for Review Board'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {annotations.length > 0 && (
            <button
              type="button"
              className={`arc-btn ${showListOverview ? 'arc-btn-primary' : ''}`}
              style={{ height: 28, fontSize: 11.5, padding: '0 8px' }}
              onClick={() => {
                onHaptic('selection');
                setShowListOverview((v) => !v);
              }}
            >
              <List size={13} />
              <span>{showListOverview ? (isZh ? '卡片' : 'Card') : (isZh ? '速览' : 'List')}</span>
            </button>
          )}
          {ordered.length > 1 && (
            <>
              <button
                type="button"
                className="arc-btn arc-icon-btn"
                style={{ height: 28, width: 28 }}
                onClick={() => stepCard(-1)}
                aria-label="Prev"
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 32, textAlign: 'center' }}>
                {activeIdx + 1}/{ordered.length}
              </span>
              <button
                type="button"
                data-tour="revision-next-btn"
                className="arc-btn arc-icon-btn"
                style={{ height: 28, width: 28 }}
                onClick={() => stepCard(1)}
                aria-label="Next"
              >
                <ChevronRight size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            className="arc-btn"
            style={{ height: 28, fontSize: 11.5, padding: '0 8px' }}
            onClick={() => {
              onHaptic('medium');
              setBlackboardMode(true);
            }}
          >
            <StickyNote size={13} />
            <span>{isZh ? '黑板' : 'Board'}</span>
          </button>
        </div>
      </div>

      {annotations.length > 0 && (
        <div className="arc-annotation-toolbar" style={{ padding: '6px 12px' }}>
          <div className="arc-annotation-search">
            <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={annFilter.query}
              onChange={(e) => setAnnFilter((p) => ({ ...p, query: e.target.value }))}
              placeholder={isZh ? '搜索批注、原文或作者...' : 'Search notes, quotes, authors...'}
            />
            {annFilter.query && (
              <button
                type="button"
                className="arc-ann-clear-btn"
                onClick={() => setAnnFilter((p) => ({ ...p, query: '' }))}
              >
                <X size={11} />
              </button>
            )}
            <span className="arc-badge" style={{ fontSize: 10 }}>
              {filteredAnnotations.length}/{allStats.total}
            </span>
          </div>
          <div className="arc-annotation-filter-row">
            {(['all', 'open', 'handled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`arc-ann-chip ${annFilter.status === st ? 'is-active' : ''}`}
                onClick={() => setAnnFilter((p) => ({ ...p, status: st }))}
              >
                {st === 'all'
                  ? `${isZh ? '全部' : 'All'} (${allStats.total})`
                  : st === 'open'
                    ? `${isZh ? '待处理' : 'Open'} (${allStats.open})`
                    : `${isZh ? '已处理' : 'Handled'} (${allStats.handled})`}
              </button>
            ))}
            <span className="arc-ann-chip-sep" aria-hidden="true" />
            {(['all', 'comment', 'revision'] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                className={`arc-ann-chip ${annFilter.type === tp ? 'is-active' : ''}`}
                onClick={() => setAnnFilter((p) => ({ ...p, type: tp }))}
              >
                {tp === 'all'
                  ? (isZh ? '全类型' : 'Any')
                  : tp === 'comment'
                    ? `${isZh ? '批注' : 'Comment'} (${allStats.comments})`
                    : `${isZh ? '修订' : 'Revision'} (${allStats.revisions})`}
              </button>
            ))}
          </div>
          {!readOnly && (filteredStats.openRevisions > 0 || filteredStats.openComments > 0) && (
            <div className="arc-annotation-batch-row">
              {filteredStats.openRevisions > 0 && onBatchAcceptRevisions && (
                <button
                  type="button"
                  className="arc-btn arc-btn-primary"
                  style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                  onClick={() =>
                    onBatchAcceptRevisions(
                      filteredAnnotations
                        .filter((a) => a.type === 'revision' && a.status === 'open')
                        .map((a) => a.id),
                    )
                  }
                >
                  <Check size={11} />
                  <span>{isZh ? `批量接受 (${filteredStats.openRevisions})` : `Accept (${filteredStats.openRevisions})`}</span>
                </button>
              )}
              {filteredStats.openRevisions > 0 && onBatchRejectRevisions && (
                <button
                  type="button"
                  className="arc-btn"
                  style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                  onClick={() =>
                    onBatchRejectRevisions(
                      filteredAnnotations
                        .filter((a) => a.type === 'revision' && a.status === 'open')
                        .map((a) => a.id),
                    )
                  }
                >
                  <X size={11} />
                  <span>{isZh ? `批量拒绝 (${filteredStats.openRevisions})` : `Reject (${filteredStats.openRevisions})`}</span>
                </button>
              )}
              {filteredStats.openComments > 0 && onBatchResolveComments && (
                <button
                  type="button"
                  className="arc-btn"
                  style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                  onClick={() =>
                    onBatchResolveComments(
                      filteredAnnotations
                        .filter((a) => a.type === 'comment' && a.status === 'open')
                        .map((a) => a.id),
                    )
                  }
                >
                  <Check size={11} />
                  <span>{isZh ? `批量解决 (${filteredStats.openComments})` : `Resolve (${filteredStats.openComments})`}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="arc-revision-body">
        {!current ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
            <div>
              {annotations.length > 0 && isAnnotationFilterActive(annFilter)
                ? (isZh ? '没有符合筛选条件的批注或修订' : 'No matching annotations or revisions')
                : (isZh ? '当前文档暂无批注与修订' : 'No annotations or revisions')}
            </div>
            {annotations.length > 0 && isAnnotationFilterActive(annFilter) && (
              <button
                type="button"
                className="arc-btn"
                style={{ marginTop: 8, height: 26, fontSize: 11.5 }}
                onClick={() => setAnnFilter(DEFAULT_ANNOTATION_FILTER)}
              >
                {isZh ? '重置筛选' : 'Reset Filters'}
              </button>
            )}
          </div>
        ) : showListOverview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ordered.map((ann, listIdx) => {
              const isComment = ann.type === 'comment';
              const isSel = ann.id === current.id;
              return (
                <button
                  key={ann.id}
                  type="button"
                  className={`arc-mobile-ann-row ${isSel ? 'is-active' : ''}`}
                  onClick={() => {
                    switchToNote(ann.id);
                    setShowListOverview(false);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>#{listIdx + 1}</span>
                      {isComment ? (
                        <MessageSquare size={12} color="var(--arc-comment-color)" />
                      ) : (
                        <GitPullRequestDraft size={12} color="var(--arc-revision-color)" />
                      )}
                      {ann.author}
                    </span>
                    <span className="arc-badge" style={{ fontSize: 10 }}>
                      {ann.status === 'open' ? (isZh ? '待处理' : 'Open') : ann.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left', marginTop: 3 }}>
                    {isComment
                      ? ann.commentText || ann.originalText
                      : `${ann.originalText} → ${ann.suggestedText || (isZh ? '(删除)' : '(delete)')}`}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="arc-revision-detail">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`arc-ann-badge ${current.type === 'comment' ? 'comment' : 'revision'}`}>
                  {current.type === 'comment' ? <MessageSquare size={11} /> : <GitPullRequestDraft size={11} />}
                  {current.type === 'comment' ? (isZh ? '批注' : 'Comment') : (isZh ? '修订' : 'Revision')}
                </span>
                <strong style={{ fontSize: 12.5 }}>{current.author}</strong>
              </div>
              <button
                type="button"
                className="arc-btn arc-icon-btn"
                style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                onClick={() => {
                  onHaptic('selection');
                  onLocate(current.id);
                }}
              >
                <Crosshair size={12} />
                <span>{isZh ? '定位原文' : 'Locate'}</span>
              </button>
            </div>

            <div className="arc-ann-quote" style={{ marginTop: 8 }}>
              “{current.originalText}”
            </div>

            {current.commentText && (
              <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>{current.commentText}</div>
            )}

            {current.suggestedText && (
              <div className="arc-ann-suggest" style={{ marginTop: 6 }}>
                {isZh ? '建议修改为：' : 'Suggested: '}
                <strong>{current.suggestedText}</strong>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>{isZh ? '便签草稿 / 回复' : 'Note Draft / Reply'}</span>
                {currentDraftText.trim() && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {isZh ? '已绑定当前便签' : 'Bound to note'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <textarea
                  className="arc-input"
                  rows={2}
                  style={{ flex: 1, fontSize: 12.5, padding: '6px 8px', resize: 'none' }}
                  placeholder={isZh ? '输入未保存草稿或回复内容...' : 'Write draft or reply...'}
                  value={currentDraftText}
                  disabled={readOnly}
                  onChange={(e) => updateCurrentDraft(current.id, e.target.value)}
                />
                <button
                  type="button"
                  className="arc-btn arc-btn-primary"
                  style={{ height: 32, fontSize: 11.5, padding: '0 10px', alignSelf: 'flex-end' }}
                  disabled={readOnly || !currentDraftText.trim()}
                  onClick={() => {
                    onHaptic('success');
                    onReplyComment(current.id, currentDraftText.trim());
                    updateCurrentDraft(current.id, '');
                  }}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>

            {current.replies.length > 0 && (
              <div className="arc-ann-replies" style={{ marginTop: 8 }}>
                {current.replies.map((r) => (
                  <div key={r.id} className="arc-ann-reply-item">
                    <strong>{r.author}</strong>: {r.text}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {current.type === 'revision' ? (
                <>
                  <button
                    type="button"
                    className="arc-btn arc-btn-primary"
                    style={{ height: 30, fontSize: 12 }}
                    disabled={readOnly}
                    onClick={() => {
                      onHaptic('success');
                      onAcceptRevision(current.id);
                    }}
                  >
                    <Check size={13} /> {isZh ? '采纳修订' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 30, fontSize: 12 }}
                    disabled={readOnly}
                    onClick={() => {
                      onHaptic('warning');
                      onRejectRevision(current.id);
                    }}
                  >
                    <RotateCcw size={13} /> {isZh ? '拒绝' : 'Reject'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="arc-btn"
                  style={{ height: 30, fontSize: 12 }}
                  disabled={readOnly}
                  onClick={() => {
                    onHaptic('medium');
                    onToggleResolveComment(current.id);
                  }}
                >
                  <Check size={13} />
                  {current.status === 'open' ? (isZh ? '标记解决' : 'Resolve') : (isZh ? '重新打开' : 'Reopen')}
                </button>
              )}

              <button
                type="button"
                className="arc-btn"
                style={{ height: 30, fontSize: 12 }}
                disabled={aiLoading}
                onClick={() => handleAiRewrite(current)}
              >
                <Sparkles size={13} />
                {aiLoading ? (isZh ? '生成中...' : 'Thinking...') : (isZh ? 'AI 改写建议' : 'AI Rewrite')}
              </button>
            </div>

            {aiPreview && aiPreview.annId === current.id && (
              <div className={`arc-ann-ai-preview ${aiPreview.error ? 'is-error' : ''}`} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>{aiPreview.text}</div>
                {!aiPreview.error && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      type="button"
                      className="arc-btn arc-btn-primary"
                      style={{ height: 26, fontSize: 11.5 }}
                      disabled={readOnly}
                      onClick={() => {
                        onHaptic('success');
                        onApplyAiSuggestion(current.id, aiPreview.text);
                        setAiPreview(null);
                      }}
                    >
                      {isZh ? '应用到正文' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
