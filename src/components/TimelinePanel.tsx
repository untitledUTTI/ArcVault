import React, { useMemo, useState } from 'react';
import {
  GitCompare,
  Search,
  Sparkles,
  Trash2,
  ChevronUp,
  ChevronDown,
  GitBranch,
  Star,
  X,
} from 'lucide-react';
import type {
  ArchiveDocument,
  Branch,
  DeletedDarling,
  HapticPattern,
  Snapshot,
} from '../types/archive';
import type { I18nDict } from '../i18n/dictionaries';
import type { CasObjectStore } from '../core/casStore';
import { useAnimatedPresence } from '../platform/useAnimatedPresence';

interface TimelinePanelProps {
  dict: I18nDict;
  doc: ArchiveDocument | null;
  branches: Branch[];
  snapshots: Snapshot[];
  darlings: DeletedDarling[];
  motivationCountBySnap: Record<string, number>;
  assetCountBySnap: Record<string, number>;
  cas: CasObjectStore;
  collapsed: boolean;
  isSheetMode?: boolean;
  sheetOpen?: boolean;
  onCloseSheet?: () => void;
  onHaptic?: (pattern: HapticPattern) => void;
  onToggleCollapse: () => void;
  onCompareSnapshots: (leftId: string, rightId: string) => void;
  onRestoreSnapshot: (snap: Snapshot) => void;
  onOpenDarlings: () => void;
  onOpenBranches: () => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  dict,
  doc,
  branches,
  snapshots,
  darlings,
  motivationCountBySnap,
  assetCountBySnap,
  cas,
  collapsed,
  isSheetMode = false,
  sheetOpen = false,
  onCloseSheet,
  onHaptic,
  onToggleCollapse,
  onCompareSnapshots,
  onRestoreSnapshot,
  onOpenDarlings,
  onOpenBranches,
}) => {
  const [viewMode, setViewMode] = useState<'arc' | 'list'>('arc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredSnap, setHoveredSnap] = useState<Snapshot | null>(null);

  const toggleSelect = (id: string) => {
    onHaptic?.('selection');
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  // Cross-version full-text fragment archaeology
  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !doc) return [];
    const hits: Array<{ snap: Snapshot; snippet: string }> = [];
    for (const snap of snapshots) {
      const md = cas.getText(snap.markdownHash) ?? '';
      const idx = md.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 24);
        const end = Math.min(md.length, idx + q.length + 36);
        hits.push({
          snap,
          snippet: (start > 0 ? '...' : '') + md.slice(start, end).replace(/\n+/g, ' ') + (end < md.length ? '...' : ''),
        });
      }
    }
    return hits;
  }, [searchQuery, snapshots, cas, doc]);

  const compareReady = selectedIds.length === 2;
  const effectiveCollapsed = isSheetMode ? false : collapsed;
  const sheetPresence = useAnimatedPresence(Boolean(isSheetMode && sheetOpen), 250);

  if (isSheetMode && !sheetPresence.mounted) {
    return null;
  }

  const panelNode = (
    <section data-tour="timeline-panel" className={`arc-timeline-panel ${isSheetMode ? 'is-sheet-mode' : ''}`}>
      <div className="arc-timeline-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isSheetMode ? (
            <strong style={{ fontSize: 13.5 }}>{dict.timeline.title} ({snapshots.length})</strong>
          ) : (
            <button className="arc-btn" style={{ height: 28, padding: '0 8px' }} onClick={onToggleCollapse}>
              {effectiveCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{dict.timeline.title} ({snapshots.length})</span>
            </button>
          )}

          {!effectiveCollapsed && (
            <div className="arc-segmented">
              <button className={viewMode === 'arc' ? 'active' : ''} onClick={() => setViewMode('arc')}>
                {dict.timeline.arcDome}
              </button>
              <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
                {dict.timeline.listCalendar}
              </button>
            </div>
          )}
        </div>

        {!effectiveCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', maxWidth: 460 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 9, top: 8, color: 'var(--text-muted)' }}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={dict.timeline.searchPlaceholder}
                style={{
                  width: '100%',
                  height: 28,
                  padding: '0 10px 0 28px',
                  borderRadius: 999,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!effectiveCollapsed && (
            <>
              <button
                data-tour="timeline-darlings-btn"
                className="arc-btn"
                style={{ height: 28 }}
                onClick={() => {
                  onHaptic?.('light');
                  onCloseSheet?.();
                  onOpenDarlings();
                }}
              >
                <Trash2 size={13} />
                <span>{dict.timeline.deletedDarlings} ({darlings.length})</span>
              </button>

              <button
                className="arc-btn arc-btn-primary"
                style={{ height: 28 }}
                disabled={!compareReady && snapshots.length < 2}
                onClick={() => {
                  onHaptic?.('light');
                  onCloseSheet?.();
                  if (compareReady) {
                    onCompareSnapshots(selectedIds[0], selectedIds[1]);
                  } else if (snapshots.length >= 2) {
                    onCompareSnapshots(snapshots[snapshots.length - 2].id, snapshots[snapshots.length - 1].id);
                  }
                }}
              >
                <GitCompare size={13} />
                <span>
                  {compareReady
                    ? dict.timeline.compareSelected
                    : snapshots.length >= 2
                      ? dict.timeline.compareLatest
                      : dict.actions.diffCompare}
                </span>
              </button>
            </>
          )}
          {isSheetMode && (
            <button
              type="button"
              className="arc-btn arc-icon-btn"
              style={{ height: 28 }}
              onClick={onCloseSheet}
              aria-label={dict.timeline.closeSheet}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {!effectiveCollapsed && (
        <div className="arc-timeline-body">
          {searchQuery.trim().length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {dict.timeline.searchHitsPrefix} {searchHits.length} {dict.timeline.searchHitsMid} “{searchQuery}”
              </div>
              {searchHits.map(({ snap, snippet }) => (
                <div
                  key={snap.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <strong>{snap.label}</strong>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({new Date(snap.createdAt).toLocaleString()})
                    </span>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{snippet}</div>
                  </div>
                  <button className="arc-btn" style={{ height: 26 }} onClick={() => onRestoreSnapshot(snap)}>
                    {dict.timeline.rollbackBtn}
                  </button>
                </div>
              ))}
            </div>
          ) : viewMode === 'arc' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: '100%' }}>
              {/* Interactive Arc Dome SVG Timeline */}
              <svg
                width="560"
                height="156"
                viewBox="0 0 560 168"
                style={{ flexShrink: 0, color: 'var(--accent)' }}
              >
                <defs>
                  <linearGradient id="timelineMainArcGrad" x1="36" y1="132" x2="524" y2="132" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.06" />
                    <stop offset="22%" stopColor="currentColor" stopOpacity="0.34" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="0.56" />
                    <stop offset="78%" stopColor="currentColor" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
                  </linearGradient>
                  <linearGradient id="timelineBranchArcGrad" x1="124" y1="142" x2="436" y2="142" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.02" />
                    <stop offset="25%" stopColor="currentColor" stopOpacity="0.20" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="0.34" />
                    <stop offset="75%" stopColor="currentColor" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Whisper-soft atmospheric glow under-stroke */}
                <path
                  d="M 36 132 Q 280 14 524 132"
                  fill="none"
                  stroke="url(#timelineMainArcGrad)"
                  strokeWidth="7"
                  strokeOpacity="0.18"
                  strokeLinecap="round"
                />
                {/* Main Celestial Dome Arc (monochromatic, soft opacity fade) */}
                <path
                  d="M 36 132 Q 280 14 524 132"
                  fill="none"
                  stroke="url(#timelineMainArcGrad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {(() => {
                  const mainSnaps = snapshots.filter((s) => {
                    const br = branches.find((b) => b.id === s.branchId);
                    return !br || br.isMain;
                  });
                  const altSnaps = snapshots.filter((s) => {
                    const br = branches.find((b) => b.id === s.branchId);
                    return br && !br.isMain;
                  });

                  const nodes: Array<{ snap: Snapshot; x: number; y: number; isAlt: boolean }> = [];
                  mainSnaps.forEach((snap, idx) => {
                    const t = mainSnaps.length <= 1 ? 0.5 : idx / (mainSnaps.length - 1);
                    const x = (1 - t) * (1 - t) * 36 + 2 * (1 - t) * t * 280 + t * t * 524;
                    const y = (1 - t) * (1 - t) * 132 + 2 * (1 - t) * t * 14 + t * t * 132;
                    nodes.push({ snap, x, y, isAlt: false });
                  });
                  altSnaps.forEach((snap, idx) => {
                    const t = altSnaps.length <= 1 ? 0.5 : (idx + 0.5) / altSnaps.length;
                    const x = (1 - t) * (1 - t) * 124 + 2 * (1 - t) * t * 280 + t * t * 436;
                    const y = (1 - t) * (1 - t) * 142 + 2 * (1 - t) * t * 78 + t * t * 142;
                    nodes.push({ snap, x, y, isAlt: true });
                  });

                  return (
                    <>
                      {/* Concentric Secondary Branch Arc (monochromatic softer dashed arc) */}
                      {(altSnaps.length > 0 || branches.length > 1) && (
                        <path
                          d="M 124 142 Q 280 78 436 142"
                          fill="none"
                          stroke="url(#timelineBranchArcGrad)"
                          strokeWidth="1.5"
                          strokeDasharray="4 5"
                          strokeLinecap="round"
                        />
                      )}
                      {nodes.map(({ snap, x, y, isAlt }) => {
                        const isSel = selectedIds.includes(snap.id);
                        return (
                          <g
                            key={snap.id}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredSnap(snap)}
                            onClick={() => toggleSelect(snap.id)}
                          >
                            {isSel && (
                              <circle
                                cx={x}
                                cy={y}
                                r={11}
                                fill="none"
                                stroke="currentColor"
                                strokeOpacity={0.65}
                                strokeWidth={1.6}
                              />
                            )}
                            {snap.isMilestone && !isSel && (
                              <circle cx={x} cy={y} r={10.5} fill="currentColor" fillOpacity={0.1} />
                            )}
                            <circle
                              cx={x}
                              cy={y}
                              r={isSel ? 6.4 : snap.isMilestone ? 5.2 : 4.2}
                              fill={
                                isSel
                                  ? 'currentColor'
                                  : snap.isMilestone && !isAlt
                                    ? 'currentColor'
                                    : 'var(--bg-elevated)'
                              }
                              fillOpacity={isSel ? 0.95 : snap.isMilestone && !isAlt ? 0.85 : 1}
                              stroke="currentColor"
                              strokeOpacity={isSel ? 1 : isAlt ? 0.62 : 0.85}
                              strokeWidth={isAlt ? 1.8 : 2}
                            />
                            <text
                              x={x}
                              y={y + 17}
                              textAnchor="middle"
                              fontSize="10"
                              fill="var(--text-secondary)"
                            >
                              {snap.label.slice(0, 8)}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>

              <div
                style={{
                  flex: 1,
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--arc-radius-sm)',
                  padding: '10px 14px',
                  fontSize: 12.5,
                }}
              >
                {(() => {
                  const active = hoveredSnap ?? snapshots[snapshots.length - 1];
                  if (!active) return <span style={{ color: 'var(--text-muted)' }}>{dict.timeline.emptySnap}</span>;
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {active.isMilestone && <Star size={13} color="#f59e0b" />}
                          {active.label}
                        </strong>
                        <span className="arc-badge">
                          {active.wordCount} {dict.timeline.wordsUnit} ({active.deltaChars >= 0 ? `+${active.deltaChars}` : active.deltaChars})
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={13} color="var(--accent)" />
                        <span>{active.aiSummary}</span>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="arc-btn" style={{ height: 25, fontSize: 11.5 }} onClick={() => toggleSelect(active.id)}>
                          {selectedIds.includes(active.id) ? dict.timeline.unselectDiff : dict.timeline.selectDiff}
                        </button>
                        <button className="arc-btn" style={{ height: 25, fontSize: 11.5 }} onClick={() => onRestoreSnapshot(active)}>
                          {dict.timeline.restoreSnap}
                        </button>
                        <button className="arc-btn" style={{ height: 25, fontSize: 11.5 }} onClick={onOpenBranches}>
                          <GitBranch size={11} />
                          <span>{branches.find((b) => b.id === active.branchId)?.name ?? dict.timeline.mainBranch}</span>
                        </button>
                        {(motivationCountBySnap[active.id] ?? 0) > 0 && (
                          <span className="arc-badge">{dict.timeline.motivationBadge} {motivationCountBySnap[active.id]}</span>
                        )}
                        {(assetCountBySnap[active.id] ?? 0) > 0 && (
                          <span className="arc-badge">{dict.timeline.assetBadge} {assetCountBySnap[active.id]}</span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {snapshots.map((snap) => {
                const isSel = selectedIds.includes(snap.id);
                return (
                  <div
                    key={snap.id}
                    onClick={() => toggleSelect(snap.id)}
                    style={{
                      minWidth: 210,
                      maxWidth: 250,
                      padding: '8px 11px',
                      borderRadius: 'var(--arc-radius-sm)',
                      border: `1px solid ${isSel ? '#f59e0b' : 'var(--border-subtle)'}`,
                      background: isSel ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{snap.label}</span>
                      <span className="arc-badge">
                        <GitBranch size={11} />
                        {snap.wordCount} {dict.timeline.wordsUnit}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>
                      {new Date(snap.createdAt).toLocaleString()}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{snap.aiSummary}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );

  if (isSheetMode) {
    return (
      <div className={`arc-sheet-backdrop phase-${sheetPresence.phase}`} onClick={onCloseSheet}>
        <div
          className={`arc-bottom-sheet is-tall phase-${sheetPresence.phase}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="arc-sheet-handle-row">
            <span className="arc-sheet-handle" />
          </div>
          {panelNode}
        </div>
      </div>
    );
  }

  return panelNode;
};
