import React, { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { I18nDict } from '../i18n/dictionaries';
import type { ArchiveDocument, HapticPattern, Locale, Space } from '../types/archive';

interface TrashModalProps {
  dict: I18nDict;
  locale: Locale;
  spaces: Space[];
  trashedDocs: ArchiveDocument[];
  snapshotCountByDoc: Record<string, number>;
  onRestore: (docId: string) => void;
  onHaptic?: (pattern: HapticPattern) => void;
  onClose: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({
  dict,
  locale,
  spaces,
  trashedDocs,
  snapshotCountByDoc,
  onRestore,
  onHaptic,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trashedDocs;
    return trashedDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.markdownText.toLowerCase().includes(q) ||
        d.sourceFileName.toLowerCase().includes(q),
    );
  }, [trashedDocs, query]);

  const resolveSpaceLabel = (spaceId: string): string => {
    const sp = spaces.find((s) => s.id === spaceId);
    if (!sp) return spaceId;
    return locale === 'zh-CN' ? sp.nameZh : sp.nameEn;
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div
        className="arc-modal"
        data-tour="trash-modal"
        style={{ width: 'min(760px, 95vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Trash2 size={18} color="var(--accent)" />
            <strong>{dict.trash.title}</strong>
            <span className="arc-badge">{trashedDocs.length}</span>
            <span
              className="arc-badge"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              {dict.trash.permanentBadge}
            </span>
          </div>
          <button
            type="button"
            className="arc-btn arc-icon-btn"
            onClick={onClose}
            aria-label={locale === 'zh-CN' ? '关闭回收站' : 'Close Trash'}
          >
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="arc-trash-banner">
            <ShieldCheck size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{dict.trash.noticeText}</span>
          </div>

          {trashedDocs.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="arc-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={dict.trash.searchPlaceholder}
                style={{ width: '100%', paddingLeft: 32 }}
              />
            </div>
          )}

          {trashedDocs.length === 0 ? (
            <div className="arc-trash-empty">
              <Trash2 size={28} color="var(--text-muted)" style={{ opacity: 0.6 }} />
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{dict.trash.emptyTitle}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 420 }}>
                {dict.trash.emptyDesc}
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {dict.trash.noMatch}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredDocs.map((doc) => {
                const origSpaceId = doc.trashedFromSpaceId ?? doc.spaceId;
                const snapCount = snapshotCountByDoc[doc.id] ?? 1;
                const isPreviewing = previewDocId === doc.id;
                const previewText = doc.markdownText.trim().slice(0, 360);
                return (
                  <div key={doc.id} className="arc-trash-card">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, wordBreak: 'break-word' }}>
                          {doc.title}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 5,
                            fontSize: 11.5,
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span className="arc-badge">{doc.sourceExt}</span>
                          <span className="arc-badge">
                            {dict.trash.originalSpacePrefix}
                            {resolveSpaceLabel(origSpaceId)}
                          </span>
                          <span>
                            {snapCount} {dict.sidebar.snapUnit}
                          </span>
                          {doc.trashedAt && (
                            <span>
                              {dict.trash.trashedAtPrefix}
                              {new Date(doc.trashedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="arc-btn"
                          style={{ height: 28, fontSize: 12 }}
                          onClick={() => {
                            onHaptic?.('selection');
                            setPreviewDocId(isPreviewing ? null : doc.id);
                          }}
                        >
                          {isPreviewing ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>
                            {isPreviewing ? dict.trash.hidePreviewBtn : dict.trash.previewBtn}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="arc-btn arc-btn-primary"
                          style={{ height: 28, fontSize: 12 }}
                          onClick={() => {
                            onHaptic?.('success');
                            onRestore(doc.id);
                          }}
                        >
                          <RotateCcw size={13} />
                          <span>{dict.trash.restoreBtn}</span>
                        </button>
                      </div>
                    </div>

                    {isPreviewing && (
                      <div className="arc-trash-preview">
                        {previewText || dict.trash.emptyContent}
                        {doc.markdownText.trim().length > 360 ? ' ...' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
