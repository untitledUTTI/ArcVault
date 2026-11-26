import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Play, Pause, Download, X, SkipBack, SkipForward } from 'lucide-react';
import { computeDocumentDiff } from '../core/diffEngine';
import { triggerBrowserDownload } from '../platform/bridge';
import type { ArchiveDocument, Snapshot, WritingActivityDay } from '../types/archive';
import type { CasObjectStore } from '../core/casStore';

interface EvolutionStudioModalProps {
  isZh?: boolean;
  doc: ArchiveDocument;
  snapshots: Snapshot[];
  cas: CasObjectStore;
  activity: WritingActivityDay[];
  onClose: () => void;
}

export const EvolutionStudioModal: React.FC<EvolutionStudioModalProps> = ({
  isZh = true,
  doc,
  snapshots,
  cas,
  activity,
  onClose,
}) => {
  const [tab, setTab] = useState<'heatmap' | 'replay'>('heatmap');
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1400);

  useEffect(() => {
    if (!playing || snapshots.length <= 1) return;
    const timer = setInterval(() => {
      setFrameIdx((prev) => {
        if (prev + 1 >= snapshots.length) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => clearInterval(timer);
  }, [playing, speedMs, snapshots.length]);

  const totalCharsWritten = useMemo(
    () => activity.reduce((acc, d) => acc + d.charsDelta, 0),
    [activity],
  );
  const activeDays = activity.filter((d) => d.charsDelta > 0).length;
  const lateNightDays = activity.filter((d) => d.peakHour >= 21 || d.peakHour <= 4).length;

  const currentSnap = snapshots[frameIdx] ?? snapshots[0];
  const prevSnap = frameIdx > 0 ? snapshots[frameIdx - 1] : null;
  const currentFrameText = currentSnap ? (cas.getText(currentSnap.markdownHash) ?? '') : '';
  const prevFrameText = prevSnap ? (cas.getText(prevSnap.markdownHash) ?? '') : '';
  const frameDiff = useMemo(
    () => (prevSnap ? computeDocumentDiff(prevFrameText, currentFrameText) : null),
    [prevSnap, prevFrameText, currentFrameText],
  );

  const handleExportPosterSvg = () => {
    const milestones = snapshots.filter((s) => s.isMilestone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" rx="24" fill="url(#bg)"/>
  <text x="56" y="74" fill="#94a3b8" font-size="16" font-family="sans-serif">ARCVAULT · 穹档 论文演进纪念海报</text>
  <text x="56" y="122" fill="#f8fafc" font-size="28" font-weight="bold" font-family="sans-serif">${doc.title.replace(/[<>&]/g, '')}</text>
  <path d="M 80 370 Q 480 120 880 370" fill="none" stroke="url(#arc)" stroke-width="4" stroke-linecap="round"/>
  ${snapshots
    .map((s, idx) => {
      const t = snapshots.length <= 1 ? 0.5 : idx / (snapshots.length - 1);
      const x = (1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 480 + t * t * 880;
      const y = (1 - t) * (1 - t) * 370 + 2 * (1 - t) * t * 120 + t * t * 370;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.isMilestone ? 9 : 6}" fill="${s.isMilestone ? '#38bdf8' : '#e2e8f0'}"/><text x="${x.toFixed(1)}" y="${(y + 26).toFixed(1)}" text-anchor="middle" fill="#cbd5e1" font-size="12" font-family="sans-serif">${s.label.slice(0, 10)}</text>`;
    })
    .join('\n  ')}
  <text x="56" y="458" fill="#cbd5e1" font-size="16" font-family="sans-serif">累计迭代版本：${snapshots.length} 版 · 里程碑：${milestones.length} 个 · 近期改稿输出：${totalCharsWritten} 字符 · 深夜爆肝：${lateNightDays} 晚</text>
  <text x="56" y="492" fill="#64748b" font-size="13" font-family="sans-serif">Generated locally by ArcVault · ${new Date().toLocaleDateString()}</text>
</svg>`;
    triggerBrowserDownload(`${doc.title}_演进纪念海报.svg`, svg, 'image/svg+xml;charset=utf-8');
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" data-tour="evolution-studio-modal" style={{ width: 'min(940px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="arc-segmented">
              <button className={tab === 'heatmap' ? 'active' : ''} onClick={() => setTab('heatmap')}>
                <Flame size={13} style={{ marginRight: 5 }} />
                {isZh ? '写作热力图与节律' : 'Writing Heatmap & Cadence'}
              </button>
              <button className={tab === 'replay' ? 'active' : ''} onClick={() => setTab('replay')}>
                <Play size={13} style={{ marginRight: 5 }} />
                {isZh ? `论文进化延时回放 (${snapshots.length} 帧)` : `Evolution Replay (${snapshots.length} frames)`}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="arc-btn arc-btn-primary" onClick={handleExportPosterSvg}>
              <Download size={14} />
              <span>{isZh ? '导出演进纪念海报 (.svg)' : 'Export Evolution Poster (.svg)'}</span>
            </button>
            <button className="arc-btn" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="arc-modal-body">
          {tab === 'heatmap' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {isZh ? '近 14 天累计改稿输出' : '14-Day Total Output'}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {totalCharsWritten} {isZh ? '字' : 'chars'}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {isZh ? '活跃写作天数' : 'Active Writing Days'}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {activeDays} / {activity.length} {isZh ? '天' : 'd'}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {isZh ? '最常爆肝时段' : 'Peak Focus Window'}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>21:00 - 23:59</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {isZh ? '累计留存快照' : 'Saved Snapshots'}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {snapshots.length} {isZh ? '版' : ''}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-app)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  {isZh ? '每日写作贡献格（近 14 日）' : 'Daily Writing Activity (Last 14 Days)'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 6 }}>
                  {activity.map((day) => {
                    const intensity =
                      day.charsDelta === 0
                        ? 0.08
                        : Math.min(1, 0.25 + day.charsDelta / 1100);
                    return (
                      <div
                        key={day.date}
                        title={
                          isZh
                            ? `${day.date}: +${day.charsDelta}字 (${day.editSessions} 次编辑)`
                            : `${day.date}: +${day.charsDelta} chars (${day.editSessions} sessions)`
                        }
                        style={{
                          height: 44,
                          borderRadius: 6,
                          background: `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--bg-subtle))`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: intensity > 0.55 ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        <strong>{day.date.slice(5)}</strong>
                        <span>{day.charsDelta > 0 ? `+${day.charsDelta}` : '-'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-app)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  {isZh ? '各版本字数增长曲线' : 'Word Count Growth Across Versions'}
                </div>
                <svg width="100%" height="110" viewBox="0 0 700 110">
                  {(() => {
                    const maxW = Math.max(100, ...snapshots.map((s) => s.wordCount));
                    const pts = snapshots.map((s, idx) => {
                      const x = snapshots.length <= 1 ? 350 : 30 + (idx / (snapshots.length - 1)) * 640;
                      const y = 92 - (s.wordCount / maxW) * 70;
                      return { x, y, s };
                    });
                    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    return (
                      <>
                        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
                        {pts.map((p) => (
                          <g key={p.s.id}>
                            <circle cx={p.x} cy={p.y} r={4.5} fill="var(--accent)" />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
                              {p.s.wordCount}{isZh ? '字' : 'w'}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="arc-btn"
                    disabled={frameIdx === 0}
                    onClick={() => {
                      setPlaying(false);
                      setFrameIdx((i) => Math.max(0, i - 1));
                    }}
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    className="arc-btn arc-btn-primary"
                    onClick={() => {
                      if (!playing && frameIdx >= snapshots.length - 1) setFrameIdx(0);
                      setPlaying((p) => !p);
                    }}
                  >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                    <span>{playing ? (isZh ? '暂停回放' : 'Pause') : isZh ? '播放演进动画' : 'Play Replay'}</span>
                  </button>
                  <button
                    className="arc-btn"
                    disabled={frameIdx >= snapshots.length - 1}
                    onClick={() => {
                      setPlaying(false);
                      setFrameIdx((i) => Math.min(snapshots.length - 1, i + 1));
                    }}
                  >
                    <SkipForward size={14} />
                  </button>
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, snapshots.length - 1)}
                  value={frameIdx}
                  onChange={(e) => {
                    setPlaying(false);
                    setFrameIdx(Number(e.target.value));
                  }}
                  style={{ flex: 1, margin: '0 16px' }}
                />

                <div className="arc-segmented">
                  <button className={speedMs === 1800 ? 'active' : ''} onClick={() => setSpeedMs(1800)}>
                    1x
                  </button>
                  <button className={speedMs === 900 ? 'active' : ''} onClick={() => setSpeedMs(900)}>
                    2x
                  </button>
                </div>
              </div>

              {currentSnap && (
                <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {isZh ? (
                      <>
                        第 <strong>{frameIdx + 1}/{snapshots.length}</strong> 帧：<strong>{currentSnap.label}</strong>
                      </>
                    ) : (
                      <>
                        Frame <strong>{frameIdx + 1}/{snapshots.length}</strong>: <strong>{currentSnap.label}</strong>
                      </>
                    )}
                    {' — '}
                    {currentSnap.aiSummary}
                  </span>
                  <span className="arc-badge">{currentSnap.wordCount}{isZh ? ' 字' : 'w'}</span>
                </div>
              )}

              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-app)',
                  fontFamily: 'var(--arc-font-mono)',
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  maxHeight: 330,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {frameDiff ? (
                  frameDiff.hunks.map((h) => (
                    <span
                      key={h.id}
                      style={{
                        background:
                          h.type === 'added'
                            ? 'rgba(22,163,74,0.18)'
                            : h.type === 'removed'
                              ? 'rgba(220,38,38,0.16)'
                              : 'transparent',
                        textDecoration: h.type === 'removed' ? 'line-through' : 'none',
                      }}
                    >
                      {h.value}
                    </span>
                  ))
                ) : (
                  currentFrameText
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
