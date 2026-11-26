import React, { useRef, useState } from 'react';
import { Copy, CornerDownLeft, Download, Pin, Plus, Trash2, Upload } from 'lucide-react';
import { ALL_PHRASES_MAP } from '../../core/phrasebank/data';
import type {
  CustomPhrase,
  PlaceholderValues,
  RecentCopyItem,
  ToneStrength,
  UserBackupPayload,
} from '../../core/phrasebank/types';
import { PhraseItemCard } from './PhraseItemCard';

interface FavoritesLibraryTabProps {
  isZh?: boolean;
  favorites: string[];
  pinnedFavorites: string[];
  recentCopies: RecentCopyItem[];
  customPhrases: CustomPhrase[];
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  hasSelection: boolean;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
  onToggleFavorite: (phraseId: string) => void;
  onTogglePinFavorite: (phraseId: string) => void;
  onAddToSkeleton: (text: string, slotId: string | undefined, sourceLabel: string) => void;
  onAddCustomPhrase: (phrase: Omit<CustomPhrase, 'id' | 'createdAt'>) => void;
  onDeleteCustomPhrase: (id: string) => void;
  onExportBackup: () => void;
  onImportBackup: (payload: UserBackupPayload) => void;
}

export const FavoritesLibraryTab: React.FC<FavoritesLibraryTabProps> = ({
  isZh = true,
  favorites,
  pinnedFavorites,
  recentCopies,
  customPhrases,
  placeholders,
  placeholdersEnabled,
  hasSelection,
  readOnly,
  onInsert,
  onCopy,
  onToggleFavorite,
  onTogglePinFavorite,
  onAddToSkeleton,
  onAddCustomPhrase,
  onDeleteCustomPhrase,
  onExportBackup,
  onImportBackup,
}) => {
  const [subTab, setSubTab] = useState<'favorites' | 'custom' | 'recent'>('favorites');
  const [en, setEn] = useState('');
  const [intentCn, setIntentCn] = useState('');
  const [sectionLabel, setSectionLabel] = useState(isZh ? '引言 / 自定义' : 'Intro / Custom');
  const [tone, setTone] = useState<ToneStrength>('neutral');
  const [tagsRaw, setTagsRaw] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pinnedSet = new Set(pinnedFavorites);
  const sortedFavorites = [...favorites].sort((a, b) => {
    const aPinned = pinnedSet.has(a) ? 1 : 0;
    const bPinned = pinnedSet.has(b) ? 1 : 0;
    return bPinned - aPinned;
  });

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!en.trim() || !intentCn.trim()) return;
    onAddCustomPhrase({
      en: en.trim(),
      intentCn: intentCn.trim(),
      sectionLabel: sectionLabel.trim() || (isZh ? '自定义句型' : 'Custom'),
      tone,
      tags: tagsRaw
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setEn('');
    setIntentCn('');
    setTagsRaw('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as UserBackupPayload;
        if (parsed && typeof parsed === 'object') {
          onImportBackup(parsed);
        }
      } catch {
        // invalid json
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="apb-stack">
      <div className="apb-ref-head">
        <div className="apb-subtab-bar">
          <button
            type="button"
            className={`apb-subtab-btn ${subTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setSubTab('favorites')}
          >
            {isZh ? `我的收藏 (${favorites.length})` : `Favorites (${favorites.length})`}
          </button>
          <button
            type="button"
            className={`apb-subtab-btn ${subTab === 'custom' ? 'active' : ''}`}
            onClick={() => setSubTab('custom')}
          >
            {isZh ? `自建句型 (${customPhrases.length})` : `Custom (${customPhrases.length})`}
          </button>
          <button
            type="button"
            className={`apb-subtab-btn ${subTab === 'recent' ? 'active' : ''}`}
            onClick={() => setSubTab('recent')}
          >
            {isZh ? `最近使用 (${recentCopies.length})` : `Recent (${recentCopies.length})`}
          </button>
        </div>

        <div className="apb-phrase-actions">
          <button type="button" className="arc-btn apb-mini-btn" onClick={onExportBackup}>
            <Download size={11.5} />
            <span>{isZh ? '导出备份' : 'Export'}</span>
          </button>
          <button
            type="button"
            className="arc-btn apb-mini-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={11.5} />
            <span>{isZh ? '导入' : 'Import'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {subTab === 'favorites' && (
        <div className="apb-phrase-list">
          {sortedFavorites.length === 0 ? (
            <div className="apb-empty-card">
              {isZh
                ? '还没有收藏句型。浏览或智能推荐句型时点击卡片右侧星标即可加入收藏。'
                : 'No starred phrases yet. Click the star icon on any phrase card to save it here.'}
            </div>
          ) : (
            sortedFavorites.map((id) => {
              const entry = ALL_PHRASES_MAP.get(id);
              if (!entry) return null;
              const isPinned = pinnedSet.has(id);
              return (
                <div key={id} className="apb-stack" style={{ gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="apb-hint-text">
                      {isZh
                        ? `${entry.section.shortCn} · ${entry.moveTitleCn}`
                        : `${entry.section.titleEn} · ${entry.moveTitleEn}`}
                    </span>
                    <button
                      type="button"
                      className={`arc-btn apb-mini-btn ${isPinned ? 'apb-btn-active' : ''}`}
                      onClick={() => onTogglePinFavorite(id)}
                    >
                      <Pin size={11} />
                      <span>{isPinned ? (isZh ? '已置顶' : 'Pinned') : isZh ? '置顶' : 'Pin'}</span>
                    </button>
                  </div>
                  <PhraseItemCard
                    isZh={isZh}
                    phrase={entry.phrase}
                    sourceLabel={
                      isZh
                        ? `${entry.section.shortCn} · ${entry.moveTitleCn}`
                        : `${entry.section.titleEn} · ${entry.moveTitleEn}`
                    }
                    skeletonSlot={entry.skeletonSlot}
                    placeholders={placeholders}
                    placeholdersEnabled={placeholdersEnabled}
                    isFavorite={true}
                    hasSelection={hasSelection}
                    readOnly={readOnly}
                    onInsert={onInsert}
                    onCopy={onCopy}
                    onToggleFavorite={onToggleFavorite}
                    onAddToSkeleton={onAddToSkeleton}
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {subTab === 'custom' && (
        <div className="apb-stack">
          <form className="apb-ref-card" onSubmit={handleCreateCustom}>
            <h3 className="apb-ref-title" style={{ marginBottom: 8 }}>
              {isZh ? '新增私人学术句型' : 'Add Custom Academic Phrase'}
            </h3>
            <div className="apb-form-grid">
              <label style={{ gridColumn: '1 / -1' }}>
                <div className="apb-field-label">
                  {isZh ? '英文句型（支持 X / Y / Smith (2020) 占位符）*' : 'English Phrase (supports X / Y / Smith (2020) slots) *'}
                </div>
                <textarea
                  className="arc-input"
                  style={{ minHeight: 58, paddingTop: 6, resize: 'vertical' }}
                  required
                  placeholder="e.g., Unlike conventional X models, our proposed Y achieves ..."
                  value={en}
                  onChange={(e) => setEn(e.target.value)}
                />
              </label>
              <label>
                <div className="apb-field-label">{isZh ? '中文用途说明 *' : 'Usage Note *'}</div>
                <input
                  type="text"
                  className="arc-input"
                  required
                  placeholder={isZh ? 'e.g., 对比基线突出本文优势' : 'e.g., Contrast against baseline'}
                  value={intentCn}
                  onChange={(e) => setIntentCn(e.target.value)}
                />
              </label>
              <label>
                <div className="apb-field-label">{isZh ? '归属章节/标签' : 'Section / Tag'}</div>
                <input
                  type="text"
                  className="arc-input"
                  value={sectionLabel}
                  onChange={(e) => setSectionLabel(e.target.value)}
                />
              </label>
              <label>
                <div className="apb-field-label">{isZh ? '语气强度' : 'Tone'}</div>
                <select
                  className="arc-input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ToneStrength)}
                >
                  <option value="cautious">{isZh ? '谨慎/委婉' : 'Cautious'}</option>
                  <option value="neutral">{isZh ? '中性客观' : 'Neutral'}</option>
                  <option value="assertive">{isZh ? '明确/强硬' : 'Assertive'}</option>
                </select>
              </label>
              <label>
                <div className="apb-field-label">{isZh ? '检索关键词（逗号分隔）' : 'Keywords (comma-separated)'}</div>
                <input
                  type="text"
                  className="arc-input"
                  placeholder="baseline, ablation, SOTA"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="arc-btn arc-btn-primary apb-mini-btn" style={{ marginTop: 8 }}>
              <Plus size={12} />
              <span>{isZh ? '保存到本地私人句库' : 'Save to Custom Bank'}</span>
            </button>
          </form>

          {customPhrases.length === 0 ? (
            <div className="apb-empty-card">
              {isZh ? '暂无自建句型，可在上方添加你研究领域专属的高频表达。' : 'No custom phrases yet. Add your own domain-specific expressions above.'}
            </div>
          ) : (
            <div className="apb-phrase-list">
              {customPhrases.map((cp) => (
                <div key={cp.id} className="apb-stack" style={{ gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="apb-tag apb-tag-tense">{cp.sectionLabel}</span>
                    <button
                      type="button"
                      className="arc-btn apb-mini-btn"
                      style={{ color: '#dc2626' }}
                      onClick={() => onDeleteCustomPhrase(cp.id)}
                    >
                      <Trash2 size={11} />
                      <span>{isZh ? '删除' : 'Delete'}</span>
                    </button>
                  </div>
                  <PhraseItemCard
                    isZh={isZh}
                    phrase={{
                      id: cp.id,
                      en: cp.en,
                      intentCn: cp.intentCn,
                      tone: cp.tone,
                      tags: cp.tags,
                    }}
                    sourceLabel={cp.sectionLabel}
                    placeholders={placeholders}
                    placeholdersEnabled={placeholdersEnabled}
                    isFavorite={false}
                    hasSelection={hasSelection}
                    readOnly={readOnly}
                    onInsert={onInsert}
                    onCopy={onCopy}
                    onToggleFavorite={() => {}}
                    onAddToSkeleton={onAddToSkeleton}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'recent' && (
        <div className="apb-phrase-list">
          {recentCopies.length === 0 ? (
            <div className="apb-empty-card">
              {isZh ? '最近使用记录为空。插入或复制任意句型后会自动记录在此。' : 'No recent phrases yet. Inserted or copied phrases appear here.'}
            </div>
          ) : (
            recentCopies.map((item) => (
              <div key={item.id} className="apb-phrase-card">
                <p className="apb-phrase-en">{item.text}</p>
                <div className="apb-phrase-meta-row">
                  <span className="apb-hint-text">{item.sourceLabel}</span>
                  <div className="apb-phrase-actions">
                    <button
                      type="button"
                      className="arc-btn arc-btn-primary apb-mini-btn"
                      disabled={readOnly}
                      onClick={() => onInsert(item.text, item.sourceLabel)}
                    >
                      <CornerDownLeft size={11.5} />
                      <span>{hasSelection ? (isZh ? '替换选中' : 'Replace') : isZh ? '再次插入' : 'Insert Again'}</span>
                    </button>
                    <button
                      type="button"
                      className="arc-btn apb-mini-btn"
                      onClick={() => onCopy(item.text, item.sourceLabel)}
                    >
                      <Copy size={11.5} />
                      <span>{isZh ? '复制' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
