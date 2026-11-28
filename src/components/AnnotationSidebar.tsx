import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  GitPullRequestDraft,
  Check,
  X,
  Sparkles,
  Send,
  RotateCcw,
  ChevronDown,
  Crosshair,
} from 'lucide-react';
import { generateAnnotationRewrite, AiPrivacyBlockedError } from '../core/aiGateway';
import {
  computeParallelAnnotationLayout,
  computeVisibleAnnotationWindow,
} from '../core/annotationLayout';
import type { AiPrivacyPolicy, AnnotationItem, AppSettings } from '../types/archive';
import type { AnchorGeometry } from './DocumentEditor';
import type { I18nDict } from '../i18n/dictionaries';

interface CardHeightMetrics {
  collapsedHeight: number;
  expandedHeight?: number;
}

interface AnnotationSidebarProps {
  dict: I18nDict;
  annotations: AnnotationItem[];
  totalAnnotationCount?: number;
  isFiltered?: boolean;
  onClearFilters?: () => void;
  anchors: Record<string, AnchorGeometry>;
  documentText: string;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  hoveredId: string | null;
  selectedId: string | null;
  minCanvasHeight?: number;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  readOnly: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onLocate?: (id: string) => void;
  onAcceptRevision: (id: string) => void;
  onRejectRevision: (id: string) => void;
  onToggleResolveComment: (id: string) => void;
  onReplyComment: (id: string, text: string) => void;
  onApplyAiSuggestion: (id: string, rewrite: string) => void;
  onCardRectsMeasured: (cardTops: Record<string, { top: number; height: number }>) => void;
}

const CARD_VERTICAL_CHROME = 20; // 9px top padding + 9px bottom padding + 2px border

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  dict,
  annotations,
  totalAnnotationCount,
  isFiltered = false,
  onClearFilters,
  anchors,
  documentText,
  settings,
  effectiveAiPolicy,
  hoveredId,
  selectedId,
  minCanvasHeight = 0,
  scrollContainerRef,
  readOnly,
  onHover,
  onSelect,
  onLocate,
  onAcceptRevision,
  onRejectRevision,
  onToggleResolveComment,
  onReplyComment,
  onApplyAiSuggestion,
  onCardRectsMeasured,
}) => {
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [aiPreviews, setAiPreviews] = useState<
    Record<string, { text: string; source?: string; appliedSkillNames?: string[]; error?: boolean }>
  >({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [measuredMetrics, setMeasuredMetrics] = useState<Record<string, CardHeightMetrics>>({});
  const [viewport, setViewport] = useState<{ scrollTop: number; viewportHeight: number }>({
    scrollTop: 0,
    viewportHeight: 800,
  });
  const [closingId, setClosingId] = useState<string | null>(null);
  const prevSelectedIdRef = useRef<string | null>(selectedId);

  const cardNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const headerNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const previewInnerNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const bodyInnerNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const roRef = useRef<ResizeObserver | null>(null);
  const observedElsRef = useRef<Set<Element>>(new Set());
  const measureRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Retain closing card body briefly during CSS collapse animation, then unmount heavy body DOM
  useEffect(() => {
    const prev = prevSelectedIdRef.current;
    prevSelectedIdRef.current = selectedId;
    if (prev && prev !== selectedId) {
      setClosingId(prev);
      const timer = window.setTimeout(() => {
        setClosingId((cur) => (cur === prev ? null : cur));
      }, 340);
      return () => window.clearTimeout(timer);
    }
  }, [selectedId]);

  const syncHeights = useCallback(() => {
    const scrollEl = scrollContainerRef?.current;
    if (scrollEl) {
      const vh = scrollEl.clientHeight;
      if (vh > 0) {
        setViewport((prev) =>
          Math.abs(prev.viewportHeight - vh) > 2
            ? { ...prev, viewportHeight: vh }
            : prev,
        );
      }
    }

    setMeasuredMetrics((prev) => {
      let changed = false;
      const next: Record<string, CardHeightMetrics> = { ...prev };

      for (const [annId, headerEl] of Object.entries(headerNodesRef.current)) {
        if (!headerEl) continue;
        const previewInnerEl = previewInnerNodesRef.current[annId];
        const bodyInnerEl = bodyInnerNodesRef.current[annId];

        const headerH = Math.ceil(headerEl.offsetHeight);
        const previewH = Math.ceil(previewInnerEl?.scrollHeight ?? 0);
        const collapsedHeight = Math.max(48, headerH + previewH + CARD_VERTICAL_CHROME);
        const existing = prev[annId];
        const expandedHeight = bodyInnerEl
          ? Math.max(
              collapsedHeight + 48,
              headerH + Math.ceil(bodyInnerEl.scrollHeight) + CARD_VERTICAL_CHROME,
            )
          : existing?.expandedHeight;

        if (
          !existing ||
          Math.abs(existing.collapsedHeight - collapsedHeight) > 1 ||
          (expandedHeight !== undefined &&
            (existing.expandedHeight === undefined ||
              Math.abs(existing.expandedHeight - expandedHeight) > 1))
        ) {
          next[annId] = { collapsedHeight, expandedHeight };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [scrollContainerRef]);

  const scheduleSyncHeights = useCallback(() => {
    if (measureRafRef.current !== null) return;
    measureRafRef.current = requestAnimationFrame(() => {
      measureRafRef.current = null;
      syncHeights();
    });
  }, [syncHeights]);

  // Single persistent ResizeObserver reused across renders and card virtualization
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      scheduleSyncHeights();
    });
    roRef.current = ro;
    const observed = observedElsRef.current;
    return () => {
      if (measureRafRef.current !== null) {
        cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = null;
      }
      ro.disconnect();
      roRef.current = null;
      observed.clear();
    };
  }, [scheduleSyncHeights]);

  // Track annotation pane scroll viewport for virtualization (rAF-throttled, >=40px threshold)
  useEffect(() => {
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl) return;

    setViewport({
      scrollTop: scrollEl.scrollTop,
      viewportHeight: scrollEl.clientHeight > 0 ? scrollEl.clientHeight : 800,
    });

    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const st = scrollEl.scrollTop;
        const vh = scrollEl.clientHeight > 0 ? scrollEl.clientHeight : 800;
        setViewport((prev) =>
          Math.abs(prev.scrollTop - st) >= 40 || Math.abs(prev.viewportHeight - vh) > 2
            ? { scrollTop: st, viewportHeight: vh }
            : prev,
        );
      });
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [scrollContainerRef]);

  const targetHeights = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ann of annotations) {
      const isExpanded = selectedId === ann.id;
      const metrics = measuredMetrics[ann.id];
      const hasAi = Boolean(aiPreviews[ann.id]);
      const fallbackExpanded =
        164 + ann.replies.length * 32 + (ann.suggestedText ? 44 : 0) + (hasAi ? 82 : 0);
      const fallbackCollapsed = 60;
      map[ann.id] = isExpanded
        ? (metrics?.expandedHeight ?? fallbackExpanded)
        : (metrics?.collapsedHeight ?? fallbackCollapsed);
    }
    return map;
  }, [annotations, selectedId, measuredMetrics, aiPreviews]);

  // Bidirectional parallel layout: pin expanded card horizontally aligned with its source anchor
  const positionedCards = useMemo(
    () =>
      computeParallelAnnotationLayout({
        annotations,
        anchors,
        heights: targetHeights,
        expandedId: selectedId,
        gap: 10,
        minTop: 8,
        anchorOffset: -24,
        fallbackHeight: 60,
      }),
    [annotations, anchors, targetHeights, selectedId],
  );

  // Viewport virtualization: only mount cards near the visible scroll window + pinned cards
  const visibleCards = useMemo(
    () =>
      scrollContainerRef
        ? computeVisibleAnnotationWindow({
            placements: positionedCards,
            scrollTop: viewport.scrollTop,
            viewportHeight: viewport.viewportHeight,
            overscanPx: 480,
            pinnedIds: [selectedId, hoveredId, closingId],
          })
        : positionedCards,
    [
      scrollContainerRef,
      positionedCards,
      viewport.scrollTop,
      viewport.viewportHeight,
      selectedId,
      hoveredId,
      closingId,
    ],
  );

  // Sync ResizeObserver targets strictly to currently mounted visible cards + scroller
  useLayoutEffect(() => {
    syncHeights();
    const ro = roRef.current;
    if (!ro) return;

    const desired = new Set<Element>();
    if (scrollContainerRef?.current) desired.add(scrollContainerRef.current);
    for (const { ann } of visibleCards) {
      const cardEl = cardNodesRef.current[ann.id];
      const bodyInnerEl = bodyInnerNodesRef.current[ann.id];
      if (cardEl) desired.add(cardEl);
      if (bodyInnerEl) desired.add(bodyInnerEl);
    }

    for (const el of observedElsRef.current) {
      if (!desired.has(el)) {
        ro.unobserve(el);
      }
    }
    for (const el of desired) {
      if (!observedElsRef.current.has(el)) {
        ro.observe(el);
      }
    }
    observedElsRef.current = desired;
  }, [visibleCards, aiPreviews, selectedId, scrollContainerRef, syncHeights]);

  useEffect(() => {
    const rectMap: Record<string, { top: number; height: number }> = {};
    for (const p of positionedCards) {
      rectMap[p.ann.id] = { top: p.top, height: p.height };
    }
    onCardRectsMeasured(rectMap);
  }, [positionedCards, onCardRectsMeasured]);

  const cardsBottom =
    positionedCards.length > 0
      ? positionedCards[positionedCards.length - 1].top +
        positionedCards[positionedCards.length - 1].height +
        80
      : 400;
  const totalHeight = Math.max(400, cardsBottom, minCanvasHeight);

  const hasAnyInDoc = (totalAnnotationCount ?? annotations.length) > 0;

  return (
    <div
      className="arc-annotation-canvas"
      style={{ height: totalHeight }}
      onClick={(e) => {
        if (e.target === e.currentTarget && selectedId) {
          onSelect(null);
        }
      }}
    >
      {annotations.length === 0 && (
        <div style={{ padding: 18, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
          <div>{isFiltered && hasAnyInDoc ? dict.annotations.noMatch : dict.annotations.empty}</div>
          {isFiltered && hasAnyInDoc && onClearFilters && (
            <button
              type="button"
              className="arc-btn"
              style={{ marginTop: 10, height: 28, fontSize: 11.5 }}
              onClick={onClearFilters}
            >
              {dict.annotations.clearFilters}
            </button>
          )}
        </div>
      )}

      {visibleCards.map(({ ann, top }) => {
        const isExpanded = selectedId === ann.id;
        const mountBody = isExpanded || closingId === ann.id;
        const isHovered = hoveredId === ann.id;
        const isResolved = ann.status !== 'open';
        const isComment = ann.type === 'comment';
        const aiText = aiPreviews[ann.id];
        const shiftX = isExpanded || isHovered ? -4 : 0;

        const previewSummary = isComment
          ? ann.commentText?.trim() || (ann.originalText ? `${dict.annotations.originalPrefix}${ann.originalText}` : dict.annotations.noComment)
          : ann.revisionKind === 'delete'
            ? `${dict.annotations.deletePrefix}${ann.originalText}`
            : `${dict.annotations.replacePrefix}${ann.suggestedText ?? ''}`;

        return (
          <div
            key={ann.id}
            data-ann-card-id={ann.id}
            data-tour="annotation-card"
            ref={(el) => {
              if (el) cardNodesRef.current[ann.id] = el;
              else delete cardNodesRef.current[ann.id];
            }}
            style={{ transform: `translate3d(${shiftX}px, ${top}px, 0)` }}
            className={`arc-annotation-card ${isComment ? 'type-comment' : 'type-revision'} ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${isHovered ? 'hovered' : ''} ${isResolved ? 'resolved' : ''}`}
            onMouseEnter={() => onHover(ann.id)}
            onMouseLeave={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (!isExpanded) {
                onSelect(ann.id);
              }
            }}
          >
            <div
              ref={(el) => {
                if (el) headerNodesRef.current[ann.id] = el;
                else delete headerNodesRef.current[ann.id];
              }}
              className="arc-annotation-header"
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isExpanded ? null : ann.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(isExpanded ? null : ann.id);
                }
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: isComment ? 'var(--arc-comment-color)' : 'var(--arc-revision-color)',
                  flexShrink: 0,
                }}
              >
                {isComment ? <MessageSquare size={13} /> : <GitPullRequestDraft size={13} />}
                <span>
                  {isComment
                    ? dict.annotations.typeComment
                    : ann.revisionKind === 'delete'
                      ? dict.annotations.typeDelete
                      : ann.revisionKind === 'insert'
                        ? dict.annotations.typeInsert
                        : dict.annotations.typeReplace}
                </span>
              </span>

              <div className="arc-annotation-header-meta">
                {!isExpanded && ann.replies.length > 0 && (
                  <span className="arc-annotation-reply-count" title={`${ann.replies.length} ${dict.annotations.repliesTitle}`}>
                    {ann.replies.length} {dict.annotations.repliesShort}
                  </span>
                )}
                <span className="arc-badge arc-annotation-meta-badge">
                  {ann.author} · {ann.status === 'open' ? dict.annotations.statusOpen : ann.status}
                </span>
                <ChevronDown size={14} className="arc-annotation-chevron" aria-hidden="true" />
              </div>
            </div>

            <div className="arc-annotation-preview-wrap" aria-hidden={isExpanded}>
              <div
                ref={(el) => {
                  if (el) previewInnerNodesRef.current[ann.id] = el;
                  else delete previewInnerNodesRef.current[ann.id];
                }}
                className="arc-annotation-preview-inner"
              >
                <div className="arc-annotation-preview-line" title={previewSummary}>
                  {previewSummary}
                </div>
              </div>
            </div>

            {mountBody && (
              <div className="arc-annotation-body-wrap" aria-hidden={!isExpanded}>
                <div
                  ref={(el) => {
                    if (el) bodyInnerNodesRef.current[ann.id] = el;
                    else delete bodyInnerNodesRef.current[ann.id];
                  }}
                  className="arc-annotation-body-inner"
                  onClick={(e) => e.stopPropagation()}
                >
                {ann.originalText && (
                  <div
                    className="arc-annotation-quote"
                    style={onLocate ? { cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 } : undefined}
                    onClick={() => onLocate?.(ann.id)}
                    title={onLocate ? dict.annotations.locateTip : ann.originalText}
                  >
                    <span style={{ minWidth: 0, flex: 1 }}>{dict.annotations.originalPrefix}{ann.originalText}</span>
                    {onLocate && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10.5,
                          color: 'var(--accent)',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        <Crosshair size={11} />
                        <span>{dict.annotations.locateBtn}</span>
                      </span>
                    )}
                  </div>
                )}

                {isComment && ann.commentText && (
                  <div className="arc-annotation-comment-body">{ann.commentText}</div>
                )}

                {!isComment && (
                  <div className="arc-annotation-comment-body">
                    {ann.revisionKind === 'delete' ? (
                      <span style={{ color: 'var(--arc-revision-color)', textDecoration: 'line-through' }}>
                        {dict.annotations.deletePrefix}{ann.originalText}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--arc-revision-color)', fontWeight: 500 }}>
                        {dict.annotations.replacePrefix}{ann.suggestedText}
                      </span>
                    )}
                  </div>
                )}

                {ann.replies.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {ann.replies.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          fontSize: 11.5,
                          padding: '4px 7px',
                          borderRadius: 6,
                          background: 'var(--bg-app)',
                          borderLeft: '2px solid var(--accent)',
                          wordBreak: 'break-word',
                        }}
                      >
                        <strong>{r.author}: </strong>
                        {r.text}
                      </div>
                    ))}
                  </div>
                )}

                {aiText && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: aiText.error ? 'rgba(220,38,38,0.12)' : 'var(--accent-soft)',
                      color: aiText.error ? '#dc2626' : 'inherit',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: aiText.error ? '#dc2626' : 'var(--accent)',
                        marginBottom: 4,
                      }}
                    >
                      {aiText.error
                        ? dict.annotations.aiBlockedTitle
                        : `${dict.annotations.aiPreviewTitle} (${aiText.source ?? 'offline-smart'}):`}
                    </div>
                    {!aiText.error && aiText.appliedSkillNames && aiText.appliedSkillNames.length > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {dict.annotations.skillsUsedPrefix}{aiText.appliedSkillNames.join(' · ')}
                      </div>
                    )}
                    <div style={{ marginBottom: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {aiText.text}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!aiText.error && (
                        <button
                          className="arc-btn arc-btn-primary"
                          style={{ height: 24, fontSize: 11 }}
                          disabled={readOnly}
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplyAiSuggestion(ann.id, aiText.text);
                            setAiPreviews((prev) => {
                              const next = { ...prev };
                              delete next[ann.id];
                              return next;
                            });
                          }}
                        >
                          <Check size={12} />
                          <span>{dict.actions.applyAi}</span>
                        </button>
                      )}
                      <button
                        className="arc-btn"
                        style={{ height: 24, fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAiPreviews((prev) => {
                            const next = { ...prev };
                            delete next[ann.id];
                            return next;
                          });
                        }}
                      >
                        {dict.annotations.collapse}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {!isComment && ann.status === 'open' && (
                    <>
                      <button
                        className="arc-btn arc-btn-primary"
                        style={{ height: 26, fontSize: 11.5, padding: '0 8px' }}
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcceptRevision(ann.id);
                        }}
                      >
                        <Check size={12} />
                        <span>{dict.actions.acceptRevision}</span>
                      </button>
                      <button
                        className="arc-btn"
                        style={{ height: 26, fontSize: 11.5, padding: '0 8px' }}
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRejectRevision(ann.id);
                        }}
                      >
                        <X size={12} />
                        <span>{dict.actions.rejectRevision}</span>
                      </button>
                    </>
                  )}

                  {isComment && (
                    <button
                      className="arc-btn"
                      style={{ height: 26, fontSize: 11.5, padding: '0 8px' }}
                      disabled={readOnly}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleResolveComment(ann.id);
                      }}
                    >
                      {ann.status === 'resolved' ? <RotateCcw size={12} /> : <Check size={12} />}
                      <span>
                        {ann.status === 'resolved'
                          ? dict.actions.reopenComment
                          : dict.actions.resolveComment}
                      </span>
                    </button>
                  )}

                  <button
                    className="arc-btn"
                    style={{ height: 26, fontSize: 11.5, padding: '0 8px' }}
                    disabled={aiLoadingId === ann.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setAiLoadingId(ann.id);
                      try {
                        const ctxStart = Math.max(0, ann.anchorStart - 60);
                        const ctxEnd = Math.min(documentText.length, ann.anchorEnd + 60);
                        const res = await generateAnnotationRewrite({
                          annotation: ann,
                          contextSnippet: documentText.slice(ctxStart, ctxEnd),
                          settings,
                          policy: effectiveAiPolicy,
                        });
                        setAiPreviews((prev) => ({
                          ...prev,
                          [ann.id]: {
                            text: res.text,
                            source: res.source,
                            appliedSkillNames: res.appliedSkillNames,
                          },
                        }));
                      } catch (err) {
                        setAiPreviews((prev) => ({
                          ...prev,
                          [ann.id]: {
                            text: err instanceof AiPrivacyBlockedError ? err.message : String(err),
                            error: true,
                          },
                        }));
                      } finally {
                        setAiLoadingId(null);
                      }
                    }}
                  >
                    <Sparkles size={12} />
                    <span>{aiLoadingId === ann.id ? dict.annotations.generating : dict.actions.aiSuggest}</span>
                  </button>
                </div>

                {isComment && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 7 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      value={replyDrafts[ann.id] ?? ''}
                      onChange={(e) => setReplyDrafts((p) => ({ ...p, [ann.id]: e.target.value }))}
                      placeholder={dict.annotations.replyPlaceholder}
                      tabIndex={isExpanded ? 0 : -1}
                      style={{
                        flex: 1,
                        height: 26,
                        fontSize: 11.5,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-app)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      className="arc-btn"
                      style={{ height: 26, padding: '0 8px' }}
                      tabIndex={isExpanded ? 0 : -1}
                      disabled={readOnly || !(replyDrafts[ann.id] ?? '').trim()}
                      onClick={() => {
                        const txt = (replyDrafts[ann.id] ?? '').trim();
                        if (txt) {
                          onReplyComment(ann.id, txt);
                          setReplyDrafts((p) => ({ ...p, [ann.id]: '' }));
                        }
                      }}
                    >
                      <Send size={11} />
                    </button>
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
