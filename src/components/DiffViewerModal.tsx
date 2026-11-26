import React, { useEffect, useMemo, useState } from 'react';
import { GitCompare, Trash2, Copy, X, Check } from 'lucide-react';
import { computeDocumentDiff } from '../core/diffEngine';
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

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const report = useMemo(() => computeDocumentDiff(leftText, rightText), [leftText, rightText]);

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" data-tour="diff-modal" style={{ width: 'min(960px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="arc-segmented">
              <button className={tab === 'diff' ? 'active' : ''} onClick={() => setTab('diff')}>
                <GitCompare size={13} style={{ marginRight: 5 }} />
                {isZh ? '跨版本智能 Diff' : 'Cross-Version Diff'}
              </button>
              <button className={tab === 'darlings' ? 'active' : ''} onClick={() => setTab('darlings')}>
                <Trash2 size={13} style={{ marginRight: 5 }} />
                {isZh ? `废稿墓地 (${darlings.length})` : `Deleted Darlings (${darlings.length})`}
              </button>
            </div>
          </div>
          <button className="arc-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body">
          {tab === 'diff' ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  marginBottom: 12,
                  fontSize: 12.5,
                }}
              >
                <span>
                  {isZh ? '对比：' : 'Comparing: '}
                  <strong>{leftSnap?.label ?? (isZh ? '基线版' : 'Baseline')}</strong> →{' '}
                  <strong>{rightSnap?.label ?? (isZh ? '当前版' : 'Current')}</strong>
                </span>
                <span className="arc-badge">{report.summary}</span>
              </div>

              <div
                style={{
                  fontFamily: 'var(--arc-font-mono)',
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {report.hunks.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: '4px 12px',
                      whiteSpace: 'pre-wrap',
                      background:
                        h.type === 'added'
                          ? 'rgba(22, 163, 74, 0.14)'
                          : h.type === 'removed'
                            ? 'rgba(220, 38, 38, 0.13)'
                            : 'transparent',
                      borderLeft:
                        h.type === 'added'
                          ? '4px solid #16a34a'
                          : h.type === 'removed'
                            ? '4px solid #dc2626'
                            : '4px solid transparent',
                    }}
                  >
                    <span style={{ marginRight: 8, opacity: 0.7 }}>
                      {h.type === 'added' ? '+' : h.type === 'removed' ? '-' : ' '}
                    </span>
                    {h.value}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ marginTop: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {isZh
                  ? '凡在修改中整段删除 ≥ 50 字的段落，穹档自动为你保留在此灵感回收库，方便后续写答辩 PPT、基金或 Discussion 时一键捡回。'
                  : 'Paragraphs ≥ 50 chars deleted during revisions are preserved here so you can recover them for slides, grants, or Discussion.'}
              </p>
              {darlings.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
                      <span className="arc-badge">
                        {d.charCount} {isZh ? '字' : 'chars'} · {new Date(d.deletedAt).toLocaleString()}
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
                        {copiedId === d.id ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedId === d.id ? (isZh ? '已复制' : 'Copied') : isZh ? '一键复制捡回' : 'Copy to Recover'}</span>
                      </button>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{d.text}</div>
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
