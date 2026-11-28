import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GitCompare,
  Trash2,
  Copy,
  X,
  Check,
  ListTree,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import {
  buildDiffLinesAndChapters,
  computeDocumentDiff,
  type DiffChapter,
  type DiffLine,
} from '../core/diffEngine';
import type { DeletedDarling, Snapshot } from '../types/archive';

interface DiffViewerModalProps {
  isZh?: boolean;
  initialTab?: 'diff' | 'darlings';
  leftSnap: Snapshot | null;
  rightSnap: Snapshot | null;
  leftText: string;
  rightText: string;
  darlings: DeletedDarling[];
  onCopyDarling: (text: string) => void;
  onClose: () => void;
}

function renderHeadingBadge(chapter: DiffChapter, isZh: boolean) {
  if (chapter.headingStatus === 'added') {
    return (
      <span className="arc-diff-status-pill is-added">
        {isZh ? '新增' : 'New'}
      </span>
    );
  }
  if (chapter.headingStatus === 'removed') {
    return (
      <span className="arc-diff-status-pill is-removed">
        {isZh ? '已删' : 'Del'}
      </span>
    );
  }
  if (chapter.addedChars > 0 || chapter.removedChars > 0) {
    return (
      <span className="arc-diff-chapter-counts">
        {chapter.addedChars > 0 && (
          <span className="is-added">+{chapter.addedChars}</span>
        )}
        {chapter.removedChars > 0 && (
          <span className="is-removed">-{chapter.removedChars}</span>
        )}
      </span>
    );
  }
  return null;
}

function renderDiffLine(
  line: DiffLine,
  isHeadingLine: boolean,
  isFlashing: boolean,
) {
  const hasContent = line.tokens.some((tok) => tok.value.length > 0);
  return (
    <div
      key={line.index}
      className={`arc-diff-line ${isHeadingLine ? 'is-heading' : ''} ${
        isFlashing ? 'is-flashing' : ''
      }`}
    >
      {hasContent ? (
        line.tokens.map((tok, idx) => (
          <span
            key={idx}
            className={
              tok.type === 'added'
                ? 'arc-diff-token-added'
                : tok.type === 'removed'
                  ? 'arc-diff-token-removed'
                  : 'arc-diff-token-unchanged'
            }
          >
            {tok.value}
          </span>
        ))
      ) : (
        <span className="arc-diff-token-unchanged">{'\u00A0'}</span>
      )}
    </div>
  );
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isZh = true,
  initialTab = 'diff',
  leftSnap,
  rightSnap,
  leftText,
  rightText,
  darlings,
  onCopyDarling,
  onClose,
}) => {
  const [tab, setTab] = useState<'diff' | 'darlings'>(initialTab);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [onlyChangedChapters, setOnlyChangedChapters] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const [mobileTocExpanded, setMobileTocExpanded] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [flashingChapterId, setFlashingChapterId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const flashTimerRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const report = useMemo(
    () => computeDocumentDiff(leftText, rightText),
    [leftText, rightText],
  );

  const structured = useMemo(
    () =>
      buildDiffLinesAndChapters(
        report.hunks,
        isZh ? '文首导言' : 'Preamble',
      ),
    [report.hunks, isZh],
  );

  const chapters = structured.chapters;
  const changedChapterCount = useMemo(
    () => chapters.filter((ch) => ch.hasChanges).length,
    [chapters],
  );

  const visibleChapters = useMemo(
    () =>
      onlyChangedChapters
        ? chapters.filter((ch) => ch.hasChanges)
        : chapters,
    [chapters, onlyChangedChapters],
  );

  useEffect(() => {
    if (chapters.length === 0) {
      setActiveChapterId(null);
      return;
    }
    setActiveChapterId((prev) =>
      prev && chapters.some((c) => c.id === prev) ? prev : chapters[0].id,
    );
  }, [chapters]);

  const jumpToChapter = useCallback((chapterId: string) => {
    const container = scrollContainerRef.current;
    const sectionEl = sectionRefs.current[chapterId];
    if (!container || !sectionEl) return;

    const containerRect = container.getBoundingClientRect();
    const sectionRect = sectionEl.getBoundingClientRect();
    const targetTop =
      container.scrollTop + (sectionRect.top - containerRect.top) - 8;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });

    setActiveChapterId(chapterId);
    setFlashingChapterId(chapterId);
    setMobileTocExpanded(false);

    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      setFlashingChapterId((cur) => (cur === chapterId ? null : cur));
    }, 900);
  }, []);

  const handleViewportScroll = useCallback(() => {
    if (chapters.length === 0) return;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      const containerTop = container.getBoundingClientRect().top;
      let currentId: string | null = chapters[0]?.id ?? null;

      for (const ch of chapters) {
        const el = sectionRefs.current[ch.id];
        if (!el) continue;
        const relTop = el.getBoundingClientRect().top - containerTop;
        if (relTop <= 42) {
          currentId = ch.id;
        } else {
          break;
        }
      }
      if (currentId) {
        setActiveChapterId((prev) => (prev === currentId ? prev : currentId));
      }
    });
  }, [chapters]);

  const localizedSummary = isZh
    ? report.summary
    : `+${report.addedChars} / -${report.removedChars} chars (${report.changedBlocks} changes)`;

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div
        className="arc-modal arc-diff-modal"
        data-tour="diff-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="arc-segmented">
              <button
                className={tab === 'diff' ? 'active' : ''}
                onClick={() => setTab('diff')}
              >
                <GitCompare size={13} style={{ marginRight: 5 }} />
                {isZh ? '跨版本逐字 Diff' : 'Cross-Version Diff'}
              </button>
              <button
                className={tab === 'darlings' ? 'active' : ''}
                onClick={() => setTab('darlings')}
              >
                <Trash2 size={13} style={{ marginRight: 5 }} />
                {isZh
                  ? `废稿墓地 (${darlings.length})`
                  : `Deleted Darlings (${darlings.length})`}
              </button>
            </div>
          </div>
          <button className="arc-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div
          className={`arc-modal-body ${tab === 'diff' ? 'is-diff-tab' : ''}`}
        >
          {tab === 'diff' ? (
            <>
              <div className="arc-diff-meta-bar">
                <span className="arc-diff-meta-versions">
                  {isZh ? '对比：' : 'Comparing: '}
                  <strong>
                    {leftSnap?.label ?? (isZh ? '基线版' : 'Baseline')}
                  </strong>{' '}
                  →{' '}
                  <strong>
                    {rightSnap?.label ?? (isZh ? '当前版' : 'Current')}
                  </strong>
                </span>
                <div className="arc-diff-meta-actions">
                  {chapters.length > 0 && (
                    <>
                      <button
                        type="button"
                        className={`arc-btn arc-diff-ctrl-btn ${
                          onlyChangedChapters ? 'is-active' : ''
                        }`}
                        onClick={() =>
                          setOnlyChangedChapters((prev) => !prev)
                        }
                        title={
                          isZh
                            ? '仅筛选存在改动的章节'
                            : 'Filter chapters with changes'
                        }
                      >
                        <Filter size={12} />
                        <span>
                          {isZh
                            ? `仅变动 (${changedChapterCount})`
                            : `Changed (${changedChapterCount})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`arc-btn arc-diff-ctrl-btn arc-diff-toc-toggle ${
                          tocOpen ? 'is-active' : ''
                        }`}
                        onClick={() => setTocOpen((prev) => !prev)}
                      >
                        <ListTree size={12} />
                        <span>
                          {isZh
                            ? `章节 (${chapters.length})`
                            : `Chapters (${chapters.length})`}
                        </span>
                      </button>
                    </>
                  )}
                  <span className="arc-badge">{localizedSummary}</span>
                </div>
              </div>

              {chapters.length > 0 && (
                <div className="arc-diff-mobile-toc">
                  <div className="arc-diff-mobile-toc-row">
                    <button
                      type="button"
                      className="arc-btn arc-diff-mobile-toc-btn"
                      onClick={() => setMobileTocExpanded((prev) => !prev)}
                    >
                      <ListTree size={13} />
                      <span>
                        {isZh
                          ? `章节 (${visibleChapters.length}/${chapters.length})`
                          : `Chapters (${visibleChapters.length}/${chapters.length})`}
                      </span>
                      {mobileTocExpanded ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>

                    <div className="arc-diff-chip-strip">
                      {visibleChapters.length === 0 ? (
                        <span className="arc-diff-empty-filter">
                          {isZh ? '无变动章节' : 'No changed chapters'}
                        </span>
                      ) : (
                        visibleChapters.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            className={`arc-diff-chip ${
                              activeChapterId === ch.id ? 'is-active' : ''
                            } ${ch.hasChanges ? 'has-changes' : ''}`}
                            onClick={() => jumpToChapter(ch.id)}
                          >
                            {ch.hasChanges && (
                              <span
                                className="arc-diff-chip-dot"
                                aria-hidden="true"
                              />
                            )}
                            <span className="arc-diff-chip-title">
                              {ch.title}
                            </span>
                            {renderHeadingBadge(ch, isZh)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {mobileTocExpanded && (
                    <div className="arc-diff-mobile-dropdown">
                      {visibleChapters.length === 0 ? (
                        <div className="arc-diff-toc-empty">
                          {isZh
                            ? '当前筛选下没有发生变动的章节'
                            : 'No chapters have changes'}
                        </div>
                      ) : (
                        visibleChapters.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            className={`arc-diff-toc-item ${
                              activeChapterId === ch.id ? 'is-active' : ''
                            } ${ch.hasChanges ? 'has-changes' : ''}`}
                            style={{
                              paddingLeft: `${10 + Math.min(3, ch.level - 1) * 12}px`,
                            }}
                            onClick={() => jumpToChapter(ch.id)}
                          >
                            <span className="arc-diff-toc-title">
                              {ch.title}
                            </span>
                            {renderHeadingBadge(ch, isZh)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div
                className={`arc-diff-workspace ${
                  chapters.length > 0 && tocOpen ? 'has-toc' : ''
                }`}
              >
                {chapters.length > 0 && tocOpen && (
                  <aside
                    className="arc-diff-toc"
                    aria-label={isZh ? '章节跳转目录' : 'Chapter Navigation'}
                  >
                    <div className="arc-diff-toc-header">
                      <span>{isZh ? '章节快捷跳转' : 'Chapter Jump'}</span>
                      <span className="arc-badge">{visibleChapters.length}</span>
                    </div>
                    <div className="arc-diff-toc-list">
                      {visibleChapters.length === 0 ? (
                        <div className="arc-diff-toc-empty">
                          {isZh
                            ? '当前筛选下没有变动的章节'
                            : 'No changed chapters'}
                        </div>
                      ) : (
                        visibleChapters.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            className={`arc-diff-toc-item ${
                              activeChapterId === ch.id ? 'is-active' : ''
                            } ${ch.hasChanges ? 'has-changes' : ''}`}
                            style={{
                              paddingLeft: `${10 + Math.min(3, ch.level - 1) * 12}px`,
                            }}
                            onClick={() => jumpToChapter(ch.id)}
                            title={ch.title}
                          >
                            <span className="arc-diff-toc-title">
                              {ch.title}
                            </span>
                            {renderHeadingBadge(ch, isZh)}
                          </button>
                        ))
                      )}
                    </div>
                  </aside>
                )}

                <div
                  ref={scrollContainerRef}
                  className="arc-diff-content"
                  onScroll={handleViewportScroll}
                >
                  {structured.sections.length > 0
                    ? structured.sections.map((section) => {
                        const ch = section.chapter;
                        const isFlashing = flashingChapterId === ch.id;
                        return (
                          <section
                            key={ch.id}
                            ref={(el) => {
                              sectionRefs.current[ch.id] = el;
                            }}
                            data-chapter-id={ch.id}
                            className={`arc-diff-section ${
                              isFlashing ? 'is-flashing' : ''
                            }`}
                          >
                            {section.lines.map((line, idx) =>
                              renderDiffLine(
                                line,
                                !ch.isPreamble && idx === 0,
                                !ch.isPreamble && idx === 0 && isFlashing,
                              ),
                            )}
                          </section>
                        );
                      })
                    : structured.lines.map((line) =>
                        renderDiffLine(line, false, false),
                      )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p
                style={{
                  marginTop: 0,
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                }}
              >
                {isZh
                  ? '凡在修改中整段删除 ≥ 50 字的段落，穹档自动为你保留在此灵感回收库，方便后续写答辩 PPT、基金或 Discussion 时一键捡回。'
                  : 'Paragraphs ≥ 50 chars deleted during revisions are preserved here so you can recover them for slides, grants, or Discussion.'}
              </p>
              {darlings.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  {isZh
                    ? '暂无已捕获的废稿段落（产生大段删除快照后自动归集）。'
                    : 'No deleted darlings captured yet (collected automatically when large paragraphs are removed).'}
                </div>
              ) : (
                darlings.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 11.5,
                      }}
                    >
                      <span className="arc-badge">
                        {d.charCount} {isZh ? '字' : 'chars'} ·{' '}
                        {new Date(d.deletedAt).toLocaleString()}
                      </span>
                      <button
                        className="arc-btn"
                        style={{ height: 25, fontSize: 11.5 }}
                        onClick={() => {
                          onCopyDarling(d.text);
                          setCopiedId(d.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                      >
                        {copiedId === d.id ? (
                          <Check size={12} />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>
                          {copiedId === d.id
                            ? isZh
                              ? '已复制'
                              : 'Copied'
                            : isZh
                              ? '一键复制捡回'
                              : 'Copy to Recover'}
                        </span>
                      </button>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                      {d.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
