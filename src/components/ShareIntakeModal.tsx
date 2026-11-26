import React, { useState } from 'react';
import { ClipboardPaste, FilePlus2, Share2, X } from 'lucide-react';
import type { SharePayload } from '../core/shareIntake';
import type { HapticPattern, Space } from '../types/archive';
import { ArcSelect } from './ArcSelect';

interface ShareIntakeModalProps {
  isZh?: boolean;
  initialPayload: SharePayload | null;
  spaces: Space[];
  defaultSpaceId: string;
  onCommitShare: (payload: SharePayload, targetSpaceId: string) => void;
  onHaptic: (pattern: HapticPattern) => void;
  onClose: () => void;
}

export const ShareIntakeModal: React.FC<ShareIntakeModalProps> = ({
  isZh = true,
  initialPayload,
  spaces,
  defaultSpaceId,
  onCommitShare,
  onHaptic,
  onClose,
}) => {
  const [title, setTitle] = useState(initialPayload?.title ?? '');
  const [url, setUrl] = useState(initialPayload?.url ?? '');
  const [text, setText] = useState(initialPayload?.text ?? '');
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [notice, setNotice] = useState<string | null>(null);

  const handleReadClipboard = async () => {
    setNotice(null);
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setNotice(isZh ? '剪贴板为空' : 'Clipboard is empty');
        onHaptic('warning');
        return;
      }
      if (/^https?:\/\//i.test(clip.trim())) {
        setUrl(clip.trim());
      } else {
        setText((prev) => (prev ? `${prev}\n\n${clip}` : clip));
      }
      onHaptic('light');
      setNotice(isZh ? '已从系统剪贴板导入内容' : 'Imported from clipboard');
    } catch {
      onHaptic('error');
      setNotice(isZh ? '无法自动读取剪贴板，请长按粘贴到下方文本框' : 'Cannot read clipboard automatically; please paste below');
    }
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div
        className="arc-modal"
        style={{ width: 'min(580px, 95vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={17} color="var(--accent)" />
            <strong>{isZh ? '系统分享入库 · 网页 / 文献摘录' : 'Share Intake · Web & Literature Clips'}</strong>
          </div>
          <button type="button" className="arc-btn arc-icon-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {isZh
                ? '支持从系统分享菜单、URL Intent 或剪贴板一键沉淀进穹档空间'
                : 'Archive web clips, citations, or notes from share sheets or clipboard'}
            </span>
            <button type="button" className="arc-btn" style={{ height: 32, fontSize: 12 }} onClick={handleReadClipboard}>
              <ClipboardPaste size={13} />
              <span>{isZh ? '读取剪贴板' : 'Paste Clipboard'}</span>
            </button>
          </div>

          {notice && (
            <div style={{ fontSize: 12, color: 'var(--accent)', padding: '6px 10px', borderRadius: 8, background: 'var(--accent-soft)' }}>
              {notice}
            </div>
          )}

          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '归档标题' : 'Title'}</div>
            <input
              className="arc-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isZh ? '例如：Nature Methods 实验协议摘录' : 'e.g. Nature Methods Protocol Clip'}
            />
          </label>

          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '来源链接（可选）' : 'Source URL (Optional)'}</div>
            <input
              className="arc-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '目标空间' : 'Target Space'}</div>
            <ArcSelect
              value={spaceId}
              options={spaces.map((sp) => ({
                value: sp.id,
                label: isZh ? `${sp.nameZh} (${sp.nameEn})` : sp.nameEn,
              }))}
              onChange={setSpaceId}
            />
          </label>

          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '分享正文 / 摘录内容' : 'Clip Content'}</div>
            <textarea
              className="arc-textarea"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isZh ? '粘贴来自浏览器、微信、Zotero 或其他 App 的文字摘录...' : 'Paste text from browser, Zotero, or other apps...'}
            />
          </label>
        </div>

        <div className="arc-modal-footer">
          <button type="button" className="arc-btn" onClick={onClose}>
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            className="arc-btn arc-btn-primary"
            disabled={!title.trim() && !text.trim() && !url.trim()}
            onClick={() => {
              onHaptic('success');
              onCommitShare(
                {
                  title: title.trim() || undefined,
                  url: url.trim() || undefined,
                  text: text.trim() || undefined,
                  source: initialPayload?.source ?? 'manual',
                },
                spaceId,
              );
              onClose();
            }}
          >
            <FilePlus2 size={14} />
            <span>{isZh ? '立即归档入库' : 'Archive Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
