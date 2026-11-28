import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  GitPullRequestDraft,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AiPrivacyBlockedError, generateAnnotationRewrite } from '../core/aiGateway';
import {
  DEFAULT_ANNOTATION_FILTER,
  countAnnotationStats,
  filterAnnotations,
  isAnnotationFilterActive,
  type AnnotationFilterState,
} from '../core/annotationFilter';
import { useAnimatedPresence } from '../platform/useAnimatedPresence';
import type {
  AiPrivacyPolicy,
  AnnotationItem,
  AppSettings,
  HapticPattern,
} from '../types/archive';

interface MobileAnnotationSheetProps {
  open: boolean;
  annotations: AnnotationItem[];
  selectedId: string | null;
  documentText: string;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onLocate: (id: string) => void;
  onAcceptRevision: (id: string) => void;
  onRejectRevision: (id: string) => void;
  onToggleResolveComment: (id: string) => void;
  onReplyComment: (id: string, text: string) => void;
  onApplyAiSuggestion: (id: string, rewrite: string) => void;
  onBatchAcceptRevisions?: (targetIds?: string[]) => void;
  onBatchRejectRevisions?: (targetIds?: string[]) => void;
  onBatchResolveComments?: (targetIds?: string[]) => void;
  onHaptic: (pattern: HapticPattern) => void;
  onClose: () => void;
}

export const MobileAnnotationSheet: React.FC<MobileAnnotationSheetProps> = ({
  open,
  annotations,
  selectedId,
  documentText,
  settings,
  effectiveAiPolicy,
  readOnly,
  onSelect,
  onLocate,
  onAcceptRevision,
  onRejectRevision,
  onToggleResolveComment,
  onReplyComment,
  onApplyAiSuggestion,
  onBatchAcceptRevisions,
  onBatchRejectRevisions,
  onBatchResolveComments,
  onHaptic,
  onClose,
}) => {
  const [showListMode, setShowListMode] = useState(false);
  const [annFilter, setAnnFilter] = useState<AnnotationFilterState>(DEFAULT_ANNOTATION_FILTER);
  const [replyDraft, setReplyDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<{
    annId: string;
    text: string;
    source?: string;
    error?: boolean;
  } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const sheetPresence = useAnimatedPresence(open, 250);

  const allStats = useMemo(() => countAnnotationStats(annotations), [annotations]);
  const filtered = useMemo(
    () => filterAnnotations(annotations, annFilter),
    [annotations, annFilter],
  );
  const filteredStats = useMemo(() => countAnnotationStats(filtered), [filtered]);

  const ordered = useMemo(() => {
    const openFirst = filtered.filter((a) => a.status === 'open');
    const resolvedRest = filtered.filter((a) => a.status !== 'open');
    return [...openFirst, ...resolvedRest];
  }, [filtered]);

  if (!sheetPresence.mounted) return null;

  const activeIdx = Math.max(
    0,
    ordered.findIndex((a) => a.id === selectedId),
  );
  const current = ordered[activeIdx] ?? null;

  const stepCard = (dir: -1 | 1) => {
    if (ordered.length <= 1) return;
    const nextIdx = (activeIdx + dir + ordered.length) % ordered.length;
    onHaptic('selection');
    onSelect(ordered[nextIdx].id);
    onLocate(ordered[nextIdx].id);
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

  return (
    <div
      className={`arc-sheet-backdrop phase-${sheetPresence.phase}`}
      onClick={() => {
        onHaptic('selection');
        onClose();
      }}
    >
      <div
        data-tour="annotation-sidebar"
        className={`arc-bottom-sheet phase-${sheetPresence.phase}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start || showListMode) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            stepCard(dx < 0 ? 1 : -1);
          }
        }}
      >
        <div className="arc-sheet-handle-row">
          <span className="arc-sheet-handle" />
        </div>

        <div className="arc-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>
              {settings.locale === 'zh-CN'
                ? `批注与修订 (${ordered.filter((a) => a.status === 'open').length} 待处理 / ${ordered.length})`
                : `Annotations (${ordered.filter((a) => a.status === 'open').length} open / ${ordered.length})`}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className={`arc-btn ${showListMode ? 'arc-btn-primary' : ''}`}
              style={{ height: 30, fontSize: 12 }}
              onClick={() => {
                onHaptic('selection');
                setShowListMode((v) => !v);
              }}
            >
              {showListMode
                ? settings.locale === 'zh-CN'
                  ? '卡片视图'
                  : 'Card View'
                : settings.locale === 'zh-CN'
                  ? '全部列表'
                  : 'List All'}
            </button>
            <button
              type="button"
              className="arc-btn arc-icon-btn"
              style={{ height: 30 }}
              onClick={onClose}
              aria-label={settings.locale === 'zh-CN' ? '关闭' : 'Close'}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {annotations.length > 0 && (
          <div className="arc-annotation-toolbar" style={{ padding: '6px 14px' }}>
            <div className="arc-annotation-search">
              <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={annFilter.query}
                onChange={(e) => setAnnFilter((p) => ({ ...p, query: e.target.value }))}
                placeholder={
                  settings.locale === 'zh-CN'
                    ? '搜索批注、原文或作者...'
                    : 'Search notes, quotes, authors...'
                }
              />
              {annFilter.query && (
                <button
                  type="button"
                  className="arc-ann-clear-btn"
                  onClick={() => setAnnFilter((p) => ({ ...p, query: '' }))}
                >
                  <X size={12} />
                </button>
              )}
              <span className="arc-badge" style={{ fontSize: 10.5 }}>
                {ordered.length}/{allStats.total}
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
                    ? `${settings.locale === 'zh-CN' ? '全部' : 'All'} (${allStats.total})`
                    : st === 'open'
                      ? `${settings.locale === 'zh-CN' ? '待处理' : 'Open'} (${allStats.open})`
                      : `${settings.locale === 'zh-CN' ? '已处理' : 'Handled'} (${allStats.handled})`}
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
                    ? (settings.locale === 'zh-CN' ? '全类型' : 'Any')
                    : tp === 'comment'
                      ? `${settings.locale === 'zh-CN' ? '批注' : 'Comment'} (${allStats.comments})`
                      : `${settings.locale === 'zh-CN' ? '修订' : 'Revision'} (${allStats.revisions})`}
                </button>
              ))}
            </div>
            {!readOnly && (filteredStats.openRevisions > 0 || filteredStats.openComments > 0) && (
              <div className="arc-annotation-batch-row">
                {filteredStats.openRevisions > 0 && onBatchAcceptRevisions && (
                  <button
                    type="button"
                    className="arc-btn arc-btn-primary"
                    style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                    onClick={() => {
                      onHaptic('success');
                      onBatchAcceptRevisions(
                        filtered
                          .filter((a) => a.type === 'revision' && a.status === 'open')
                          .map((a) => a.id),
                      );
                    }}
                  >
                    <Check size={11} />
                    <span>
                      {settings.locale === 'zh-CN'
                        ? `批量接受 (${filteredStats.openRevisions})`
                        : `Accept (${filteredStats.openRevisions})`}
                    </span>
                  </button>
                )}
                {filteredStats.openRevisions > 0 && onBatchRejectRevisions && (
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                    onClick={() => {
                      onHaptic('warning');
                      onBatchRejectRevisions(
                        filtered
                          .filter((a) => a.type === 'revision' && a.status === 'open')
                          .map((a) => a.id),
                      );
                    }}
                  >
                    <X size={11} />
                    <span>
                      {settings.locale === 'zh-CN'
                        ? `批量拒绝 (${filteredStats.openRevisions})`
                        : `Reject (${filteredStats.openRevisions})`}
                    </span>
                  </button>
                )}
                {filteredStats.openComments > 0 && onBatchResolveComments && (
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                    onClick={() => {
                      onHaptic('success');
                      onBatchResolveComments(
                        filtered
                          .filter((a) => a.type === 'comment' && a.status === 'open')
                          .map((a) => a.id),
                      );
                    }}
                  >
                    <Check size={11} />
                    <span>
                      {settings.locale === 'zh-CN'
                        ? `批量解决 (${filteredStats.openComments})`
                        : `Resolve (${filteredStats.openComments})`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="arc-sheet-body">
          {ordered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {annotations.length > 0 && isAnnotationFilterActive(annFilter) ? (
                <>
                  <div>
                    {settings.locale === 'zh-CN'
                      ? '没有符合当前筛选或搜索条件的批注与修订。'
                      : 'No matching annotations or revisions.'}
                  </div>
                  <button
                    type="button"
                    className="arc-btn"
                    style={{ marginTop: 10, height: 30, fontSize: 12 }}
                    onClick={() => setAnnFilter(DEFAULT_ANNOTATION_FILTER)}
                  >
                    {settings.locale === 'zh-CN' ? '重置筛选' : 'Reset Filters'}
                  </button>
                </>
              ) : settings.locale === 'zh-CN' ? (
                '当前文档暂无批注或修订。导入包含导师批注/修订的 `.docx` 后，点击正文高亮即可在此快速审阅。'
              ) : (
                'No comments or track-changes yet. Import a `.docx` with reviewer annotations to review them here.'
              )}
            </div>
          ) : showListMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ordered.map((ann) => {
                const isComment = ann.type === 'comment';
                const active = current?.id === ann.id;
                return (
                  <button
                    key={ann.id}
                    type="button"
                    data-tour="annotation-card"
                    className={`arc-mobile-ann-row ${active ? 'is-active' : ''}`}
                    onClick={() => {
                      onHaptic('light');
                      onSelect(ann.id);
                      onLocate(ann.id);
                      setShowListMode(false);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12.5 }}>
                        {isComment ? (
                          <MessageSquare size={13} color="var(--arc-comment-color)" />
                        ) : (
                          <GitPullRequestDraft size={13} color="var(--arc-revision-color)" />
                        )}
                        {ann.author}
                      </span>
                      <span className="arc-badge" style={{ fontSize: 10.5 }}>
                        {ann.status === 'open' ? (settings.locale === 'zh-CN' ? '待处理' : 'Open') : ann.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'left', marginTop: 4 }}>
                      {isComment
                        ? ann.commentText || ann.originalText
                        : `${ann.originalText} → ${ann.suggestedText || (settings.locale === 'zh-CN' ? '(删除)' : '(delete)')}`}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : current ? (
            <div data-tour="annotation-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Card Navigation Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {current.type === 'comment' ? (
                    <MessageSquare size={15} color="var(--arc-comment-color)" />
                  ) : (
                    <GitPullRequestDraft size={15} color="var(--arc-revision-color)" />
                  )}
                  <strong style={{ fontSize: 13.5 }}>{current.author}</strong>
                  <span className="arc-badge" style={{ fontSize: 11 }}>
                    {activeIdx + 1} / {ordered.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="arc-btn arc-icon-btn"
                    style={{ height: 32 }}
                    disabled={ordered.length <= 1}
                    onClick={() => stepCard(-1)}
                    aria-label={settings.locale === 'zh-CN' ? '上一条' : 'Previous'}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    data-tour="mobile-ann-next-btn"
                    className="arc-btn arc-icon-btn"
                    style={{ height: 32 }}
                    disabled={ordered.length <= 1}
                    onClick={() => stepCard(1)}
                    aria-label={settings.locale === 'zh-CN' ? '下一条' : 'Next'}
                  >
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-icon-btn"
                    style={{ height: 32 }}
                    onClick={() => {
                      onHaptic('selection');
                      onLocate(current.id);
                    }}
                    title={settings.locale === 'zh-CN' ? '定位到正文锚点' : 'Locate in document'}
                  >
                    <Crosshair size={14} />
                  </button>
                </div>
              </div>

              <div className="arc-annotation-quote">
                <strong>{settings.locale === 'zh-CN' ? '原文锚点：' : 'Original Anchor: '}</strong>
                {current.originalText}
              </div>

              {current.type === 'comment' ? (
                <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{current.commentText}</div>
              ) : (
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {current.revisionKind !== 'insert' && (
                    <div style={{ color: 'var(--arc-revision-color)', textDecoration: 'line-through' }}>
                      - {current.originalText}
                    </div>
                  )}
                  {current.revisionKind !== 'delete' && (
                    <div style={{ color: '#16a34a', fontWeight: 600 }}>
                      + {current.suggestedText}
                    </div>
                  )}
                </div>
              )}

              {current.replies.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {current.replies.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: 'var(--bg-subtle)',
                        fontSize: 12,
                      }}
                    >
                      <strong>{r.author}: </strong>
                      {r.text}
                    </div>
                  ))}
                </div>
              )}

              {aiPreview && aiPreview.annId === current.id && (
                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: 10,
                    background: aiPreview.error ? 'rgba(220,38,38,0.1)' : 'var(--accent-soft)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {aiPreview.error
                      ? settings.locale === 'zh-CN'
                        ? 'AI 隐私锁提示'
                        : 'AI Privacy Blocked'
                      : settings.locale === 'zh-CN'
                        ? `AI 润色建议 (${aiPreview.source ?? 'Smart'})`
                        : `AI Rewrite (${aiPreview.source ?? 'Smart'})`}
                  </div>
                  <div>{aiPreview.text}</div>
                  {!aiPreview.error && !readOnly && (
                    <button
                      type="button"
                      className="arc-btn arc-btn-primary"
                      style={{ marginTop: 8, height: 32, fontSize: 12 }}
                      onClick={() => {
                        onHaptic('success');
                        onApplyAiSuggestion(current.id, aiPreview.text);
                        setAiPreview(null);
                      }}
                    >
                      <Check size={13} />
                      <span>{settings.locale === 'zh-CN' ? '采纳并替换原文' : 'Apply & Replace'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Touch-friendly Action Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                {current.type === 'revision' ? (
                  <>
                    <button
                      type="button"
                      className="arc-btn arc-btn-primary"
                      style={{ flex: 1, minWidth: 110, height: 38, justifyContent: 'center' }}
                      disabled={readOnly || current.status !== 'open'}
                      onClick={() => {
                        onHaptic('success');
                        onAcceptRevision(current.id);
                      }}
                    >
                      <Check size={14} />
                      <span>{settings.locale === 'zh-CN' ? '接受修订' : 'Accept'}</span>
                    </button>
                    <button
                      type="button"
                      className="arc-btn"
                      style={{ flex: 1, minWidth: 110, height: 38, justifyContent: 'center' }}
                      disabled={readOnly || current.status !== 'open'}
                      onClick={() => {
                        onHaptic('warning');
                        onRejectRevision(current.id);
                      }}
                    >
                      <X size={14} />
                      <span>{settings.locale === 'zh-CN' ? '拒绝修订' : 'Reject'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="arc-btn arc-btn-primary"
                    style={{ flex: 1, minWidth: 120, height: 38, justifyContent: 'center' }}
                    onClick={() => {
                      onHaptic(current.status === 'resolved' ? 'light' : 'success');
                      onToggleResolveComment(current.id);
                    }}
                  >
                    {current.status === 'resolved' ? <RotateCcw size={14} /> : <Check size={14} />}
                    <span>
                      {current.status === 'resolved'
                        ? settings.locale === 'zh-CN'
                          ? '重新打开'
                          : 'Reopen'
                        : settings.locale === 'zh-CN'
                          ? '标记已解决'
                          : 'Resolve'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="arc-btn"
                  style={{ height: 38, justifyContent: 'center' }}
                  disabled={aiLoading}
                  onClick={() => handleAiRewrite(current)}
                >
                  <Sparkles size={14} />
                  <span>
                    {aiLoading
                      ? settings.locale === 'zh-CN'
                        ? '推演中...'
                        : 'Generating...'
                      : settings.locale === 'zh-CN'
                        ? 'AI 改写'
                        : 'AI Rewrite'}
                  </span>
                </button>
              </div>

              {current.type === 'comment' && (
                <form
                  style={{ display: 'flex', gap: 6, marginTop: 2 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!replyDraft.trim()) return;
                    onHaptic('medium');
                    onReplyComment(current.id, replyDraft.trim());
                    setReplyDraft('');
                  }}
                >
                  <input
                    className="arc-input"
                    style={{ flex: 1, height: 38 }}
                    placeholder={settings.locale === 'zh-CN' ? '回复导师或自己备忘...' : 'Write a reply...'}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                  />
                  <button type="submit" className="arc-btn arc-btn-primary" style={{ height: 38 }}>
                    <Send size={14} />
                  </button>
                </form>
              )}

              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                {settings.locale === 'zh-CN'
                  ? '提示：左右滑动卡片可切换下一条批注/修订'
                  : 'Tip: Swipe left/right to switch between annotations'}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
