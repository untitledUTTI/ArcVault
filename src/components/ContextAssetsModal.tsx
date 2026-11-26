import React, { useRef, useState } from 'react';
import {
  Paperclip,
  FolderGit2,
  ImagePlus,
  Plus,
  X,
  FileSpreadsheet,
  FileCode2,
  BookOpen,
  Image as ImageIcon,
} from 'lucide-react';
import { sha256Hex } from '../core/hash';
import type { LinkedAsset, MotivationAttachment, Snapshot } from '../types/archive';

interface ContextAssetsModalProps {
  isZh?: boolean;
  docId: string;
  docTitle: string;
  snapshots: Snapshot[];
  motivations: MotivationAttachment[];
  linkedAssets: LinkedAsset[];
  onAddMotivation: (item: MotivationAttachment) => void;
  onAddLinkedAsset: (asset: LinkedAsset) => void;
  onClose: () => void;
}

export const ContextAssetsModal: React.FC<ContextAssetsModalProps> = ({
  isZh = true,
  docId,
  docTitle,
  snapshots,
  motivations,
  linkedAssets,
  onAddMotivation,
  onAddLinkedAsset,
  onClose,
}) => {
  const [tab, setTab] = useState<'motivation' | 'assets'>('motivation');
  const [motKind, setMotKind] = useState<MotivationAttachment['kind']>('screenshot');
  const [motTitle, setMotTitle] = useState('');
  const [motContent, setMotContent] = useState('');
  const [motImageUrl, setMotImageUrl] = useState<string | undefined>(undefined);
  const [motSnapId, setMotSnapId] = useState<string>(snapshots[snapshots.length - 1]?.id ?? '');

  const imgInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMotImageUrl(reader.result);
        if (!motTitle) setMotTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAssetFiles = async (files: FileList) => {
    const latestSnap = snapshots[snapshots.length - 1]?.id;
    for (const f of Array.from(files)) {
      const buf = new Uint8Array(await f.arrayBuffer());
      const hash = await sha256Hex(buf);
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      const category: LinkedAsset['category'] =
        ['png', 'jpg', 'jpeg', 'svg', 'vsdx', 'opju'].includes(ext)
          ? 'figure'
          : ['csv', 'xlsx', 'xls', 'tsv'].includes(ext)
            ? 'data'
            : ['bib', 'ris', 'enw'].includes(ext)
              ? 'bibliography'
              : 'code';

      onAddLinkedAsset({
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        documentId: docId,
        name: f.name,
        category,
        relativePath: `${category}/${f.name}`,
        sizeBytes: f.size,
        contentHash: hash.slice(0, 12),
        updatedAt: new Date().toISOString(),
        snapshotIds: latestSnap ? [latestSnap] : [],
      });
    }
  };

  const catIcon = (cat: LinkedAsset['category']) => {
    if (cat === 'figure') return <ImageIcon size={15} color="#0ea5e9" />;
    if (cat === 'data') return <FileSpreadsheet size={15} color="#16a34a" />;
    if (cat === 'bibliography') return <BookOpen size={15} color="#f59e0b" />;
    return <FileCode2 size={15} color="#8b5cf6" />;
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" data-tour="context-assets-modal" style={{ width: 'min(880px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="arc-segmented">
              <button className={tab === 'motivation' ? 'active' : ''} onClick={() => setTab('motivation')}>
                <Paperclip size={13} style={{ marginRight: 5 }} />
                {isZh ? `修改动机留痕 (${motivations.length})` : `Revision Context (${motivations.length})`}
              </button>
              <button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}>
                <FolderGit2 size={13} style={{ marginRight: 5 }} />
                {isZh ? `关联科研资产快照 (${linkedAssets.length})` : `Linked Research Assets (${linkedAssets.length})`}
              </button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{docTitle}</span>
          </div>
          <button className="arc-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body">
          {tab === 'motivation' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {isZh ? '记录本次修改原因（微信截图 / 导师邮件 / 审稿意见）' : 'Log Revision Motivation (Screenshots / Emails / Reviewer Notes)'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 180px', gap: 8 }}>
                  <select
                    value={motKind}
                    onChange={(e) => setMotKind(e.target.value as MotivationAttachment['kind'])}
                    style={{ height: 32, borderRadius: 6, padding: '0 8px' }}
                  >
                    <option value="screenshot">{isZh ? '微信/聊天截图' : 'Chat Screenshot'}</option>
                    <option value="email">{isZh ? '导师邮件原文' : 'Advisor Email'}</option>
                    <option value="reviewer-comment">{isZh ? '审稿人意见' : 'Reviewer Comment'}</option>
                    <option value="note">{isZh ? '自我修改备忘' : 'Personal Note'}</option>
                  </select>
                  <input
                    value={motTitle}
                    onChange={(e) => setMotTitle(e.target.value)}
                    placeholder={isZh ? '标题（如：导师微信语音整理）' : 'Title (e.g. Advisor Feedback)'}
                    style={{ height: 32, borderRadius: 6, padding: '0 10px', border: '1px solid var(--border-subtle)' }}
                  />
                  <select
                    value={motSnapId}
                    onChange={(e) => setMotSnapId(e.target.value)}
                    style={{ height: 32, borderRadius: 6, padding: '0 8px' }}
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {isZh ? '关联：' : 'Link: '}{s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={motContent}
                  onChange={(e) => setMotContent(e.target.value)}
                  placeholder={isZh ? '粘贴导师邮件、审稿人意见原文，或备注为什么这么改...' : 'Paste advisor email, reviewer comment, or rationale for this revision...'}
                  style={{
                    width: '100%',
                    borderRadius: 6,
                    padding: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                      }}
                    />
                    <button className="arc-btn" onClick={() => imgInputRef.current?.click()}>
                      <ImagePlus size={14} />
                      <span>
                        {motImageUrl
                          ? isZh
                            ? '已附带截图（点击更换）'
                            : 'Image Attached (Replace)'
                          : isZh
                            ? '上传微信/手写截图'
                            : 'Attach Screenshot'}
                      </span>
                    </button>
                  </div>
                  <button
                    className="arc-btn arc-btn-primary"
                    disabled={!motTitle.trim() && !motContent.trim() && !motImageUrl}
                    onClick={() => {
                      onAddMotivation({
                        id: `mot_${Date.now()}`,
                        documentId: docId,
                        snapshotId: motSnapId || undefined,
                        kind: motKind,
                        title: motTitle.trim() || (isZh ? '修改动机记录' : 'Revision Note'),
                        content: motContent.trim(),
                        imageDataUrl: motImageUrl,
                        createdAt: new Date().toISOString(),
                      });
                      setMotTitle('');
                      setMotContent('');
                      setMotImageUrl(undefined);
                    }}
                  >
                    <Plus size={14} />
                    <span>{isZh ? '绑定保存到版本' : 'Save & Link to Snapshot'}</span>
                  </button>
                </div>
              </div>

              {motivations.map((m) => {
                const snapLabel = snapshots.find((s) => s.id === m.snapshotId)?.label;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13 }}>{m.title}</strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {snapLabel && <span className="arc-badge">{isZh ? '绑定快照：' : 'Snapshot: '}{snapLabel}</span>}
                        <span className="arc-badge">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {m.content && <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{m.content}</div>}
                    {m.imageDataUrl && (
                      <img
                        src={m.imageDataUrl}
                        alt={m.title}
                        style={{ maxWidth: '100%', maxHeight: 220, marginTop: 8, borderRadius: 6 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {isZh
                    ? '把 Origin/Visio 图表源文件、实验数据表、Python 绘图脚本与 `.bib` 文献库“连坐”归档，避免正文退回历史版本时图和数据对不上。'
                    : 'Archive Origin/Visio figures, datasets, plotting scripts, and `.bib` files alongside snapshots so assets always match.'}
                </span>
                <input
                  ref={assetInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) handleAssetFiles(e.target.files);
                  }}
                />
                <button className="arc-btn arc-btn-primary" onClick={() => assetInputRef.current?.click()}>
                  <Plus size={14} />
                  <span>{isZh ? '添加关联资产文件' : 'Add Linked Asset'}</span>
                </button>
              </div>

              {linkedAssets.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-app)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {catIcon(a.category)}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {isZh ? '路径：' : 'Path: '}{a.relativePath} · {(a.sizeBytes / 1024).toFixed(1)} KB · Hash: <code>{a.contentHash}</code>
                      </div>
                    </div>
                  </div>
                  <span className="arc-badge">
                    {isZh ? `已联动 ${a.snapshotIds.length} 个版本快照` : `Linked to ${a.snapshotIds.length} snapshot(s)`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
