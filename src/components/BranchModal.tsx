import React, { useMemo, useState } from 'react';
import { GitBranch, GitMerge, Plus, Check, X } from 'lucide-react';
import { computeBranchMergeBlocks, resolveBranchMerge } from '../core/branchManager';
import type { Branch, Snapshot } from '../types/archive';
import type { CasObjectStore } from '../core/casStore';

interface BranchModalProps {
  isZh?: boolean;
  isTouch?: boolean;
  docTitle: string;
  currentBranchId: string;
  branches: Branch[];
  snapshots: Snapshot[];
  cas: CasObjectStore;
  currentText: string;
  readOnly: boolean;
  onCreateBranch: (name: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onMergeIntoMain: (mergedText: string, sourceBranchName: string) => void;
  onClose: () => void;
}

export const BranchModal: React.FC<BranchModalProps> = ({
  isZh = true,
  isTouch = false,
  docTitle,
  currentBranchId,
  branches,
  snapshots,
  cas,
  currentText,
  readOnly,
  onCreateBranch,
  onSwitchBranch,
  onMergeIntoMain,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, 'main' | 'branch' | 'both'>>({});

  const mainBranch = branches.find((b) => b.isMain) ?? branches[0];

  const getBranchLatestText = (branchId: string): string => {
    if (branchId === currentBranchId) return currentText;
    const branchSnaps = snapshots.filter((s) => s.branchId === branchId);
    const head = branchSnaps[branchSnaps.length - 1];
    return head ? (cas.getText(head.markdownHash) ?? '') : '';
  };

  const mergeBlocks = useMemo(() => {
    if (!mergeSourceId || !mainBranch) return [];
    const mainText = getBranchLatestText(mainBranch.id);
    const branchText = getBranchLatestText(mergeSourceId);
    return computeBranchMergeBlocks(mainText, branchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeSourceId, mainBranch, snapshots, currentText]);

  const conflictCount = mergeBlocks.filter((b) => b.kind === 'conflict').length;
  const mergeSourceBranch = branches.find((b) => b.id === mergeSourceId);

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" data-tour="branch-modal" style={{ width: 'min(920px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={18} color="var(--accent)" />
            <strong>{isZh ? `A/B 平行思路分支 — ${docTitle}` : `A/B Parallel Branches — ${docTitle}`}</strong>
          </div>
          <button className="arc-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body">
          {!mergeSourceId ? (
            <>
              <p style={{ marginTop: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                {isZh
                  ? '无需懂 Git 命令：在纠结“引言偏理论切入还是应用切入”时，随时分出平行草稿线独立修改，满意后一键可视化合并回主线。'
                  : 'No Git commands needed: fork a parallel draft to try alternative framing or edits, then visually merge back into main.'}
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={isZh ? '输入新分支名称（例如：方案 C · 精简压缩版）...' : 'New branch name (e.g. Option C · Concise)...'}
                  style={{
                    flex: 1,
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
                <button
                  className="arc-btn arc-btn-primary"
                  style={{ height: 34 }}
                  disabled={readOnly || !newName.trim()}
                  onClick={() => {
                    onCreateBranch(newName.trim());
                    setNewName('');
                  }}
                >
                  <Plus size={14} />
                  <span>{isZh ? '分出平行草稿' : 'Create Branch'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {branches.map((br) => {
                  const isCurrent = br.id === currentBranchId;
                  const count = snapshots.filter((s) => s.branchId === br.id).length;
                  return (
                    <div
                      key={br.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--arc-radius-sm)',
                        border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        background: isCurrent ? 'var(--accent-soft)' : 'var(--bg-app)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{br.name}</span>
                          {br.isMain && <span className="arc-badge">{isZh ? '主线' : 'Main'}</span>}
                          {isCurrent && (
                            <span className="arc-badge" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                              {isZh ? '当前编辑中' : 'Active'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                          {isZh
                            ? `${count} 个版本快照 · 创建于 ${new Date(br.createdAt).toLocaleString()}`
                            : `${count} snapshots · Created ${new Date(br.createdAt).toLocaleString()}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {!isCurrent && (
                          <button className="arc-btn" onClick={() => onSwitchBranch(br.id)}>
                            {isZh ? '切换到此分支' : 'Switch'}
                          </button>
                        )}
                        {!br.isMain && (
                          <button
                            className="arc-btn arc-btn-primary"
                            disabled={readOnly}
                            onClick={() => {
                              setChoices({});
                              setMergeSourceId(br.id);
                            }}
                          >
                            <GitMerge size={14} />
                            <span>{isZh ? '对比合并到主线' : 'Compare & Merge'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
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
                  {isZh ? '正在合并：' : 'Merging: '}
                  <strong>{mergeSourceBranch?.name}</strong> → <strong>{mainBranch?.name}</strong>
                </span>
                <span className="arc-badge">
                  {isZh ? `共 ${conflictCount} 处段落差异需要确认` : `${conflictCount} section diff(s) to resolve`}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mergeBlocks.map((b) => {
                  if (b.kind === 'same') {
                    return (
                      <div
                        key={b.id}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-app)',
                        }}
                      >
                        {b.mainText.slice(0, 120)}
                        {b.mainText.length > 120 ? '...' : ''}
                      </div>
                    );
                  }
                  const pick = choices[b.id] ?? 'main';
                  return (
                    <div
                      key={b.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--accent)',
                        background: 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <strong style={{ fontSize: 12.5, color: 'var(--accent)' }}>
                          {isZh ? '差异段落选择' : 'Select Version'}
                        </strong>
                        <div className="arc-segmented">
                          <button
                            className={pick === 'main' ? 'active' : ''}
                            onClick={() => setChoices((c) => ({ ...c, [b.id]: 'main' }))}
                          >
                            {isZh ? '采用主线' : 'Use Main'}
                          </button>
                          <button
                            className={pick === 'branch' ? 'active' : ''}
                            onClick={() => setChoices((c) => ({ ...c, [b.id]: 'branch' }))}
                          >
                            {isZh ? '采用分支' : 'Use Branch'}
                          </button>
                          <button
                            className={pick === 'both' ? 'active' : ''}
                            onClick={() => setChoices((c) => ({ ...c, [b.id]: 'both' }))}
                          >
                            {isZh ? '保留两者' : 'Keep Both'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                        <div
                          style={{
                            padding: 8,
                            borderRadius: 6,
                            background: pick === 'main' || pick === 'both' ? 'rgba(59,91,219,0.09)' : 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            {isZh ? '主线内容：' : 'Main:'}
                          </div>
                          {b.mainText || <span style={{ color: 'var(--text-muted)' }}>{isZh ? '（此段为空）' : '(Empty)'}</span>}
                        </div>
                        <div
                          style={{
                            padding: 8,
                            borderRadius: 6,
                            background: pick === 'branch' || pick === 'both' ? 'rgba(16,185,129,0.1)' : 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            {isZh ? '分支内容：' : 'Branch:'}
                          </div>
                          {b.branchText || <span style={{ color: 'var(--text-muted)' }}>{isZh ? '（此段为空）' : '(Empty)'}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="arc-modal-footer">
          {mergeSourceId ? (
            <>
              <button className="arc-btn" onClick={() => setMergeSourceId(null)}>
                {isZh ? '返回分支列表' : 'Back to Branches'}
              </button>
              <button
                className="arc-btn arc-btn-primary"
                disabled={readOnly}
                onClick={() => {
                  const merged = resolveBranchMerge(mergeBlocks, choices);
                  onMergeIntoMain(merged, mergeSourceBranch?.name ?? (isZh ? '平行分支' : 'Parallel Branch'));
                  setMergeSourceId(null);
                }}
              >
                <Check size={14} />
                <span>
                  {isTouch
                    ? isZh
                      ? '确认合并到主线（支持撤销）'
                      : 'Confirm Merge to Main (Undoable)'
                    : isZh
                      ? '确认合并到主线（支持 Ctrl+Z 撤销）'
                      : 'Confirm Merge to Main (Ctrl+Z to undo)'}
                </span>
              </button>
            </>
          ) : (
            <button className="arc-btn" onClick={onClose}>
              {isZh ? '关闭' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
