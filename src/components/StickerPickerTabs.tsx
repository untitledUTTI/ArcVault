import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  getStickerCategory,
  isStripImageSticker,
  type RevisionStickerDef,
  type StickerCategory,
} from '../core/revisionStickers';
import { StickerVisual } from './StickerVisual';

interface StickerPickerTabsProps {
  allStickers: RevisionStickerDef[];
  selectedStickerId: string;
  activeTab: StickerCategory;
  onTabChange: (tab: StickerCategory) => void;
  onSelect: (sticker: RevisionStickerDef) => void;
  isZh: boolean;
  surface?: 'dark' | 'theme';
  onDeleteCustomSticker?: (id: string) => void;
}

export const StickerPickerTabs: React.FC<StickerPickerTabsProps> = ({
  allStickers,
  selectedStickerId,
  activeTab,
  onTabChange,
  onSelect,
  isZh,
  surface = 'dark',
  onDeleteCustomSticker,
}) => {
  const isTheme = surface === 'theme';
  const clsSuffix = isTheme ? ' is-theme' : '';
  const pillLightCls = isTheme ? ' is-light' : '';

  const grouped = useMemo(() => {
    const journal: RevisionStickerDef[] = [];
    const basic: RevisionStickerDef[] = [];
    const custom: RevisionStickerDef[] = [];
    for (const s of allStickers) {
      const cat = getStickerCategory(s);
      if (cat === 'journal') journal.push(s);
      else if (cat === 'custom') custom.push(s);
      else basic.push(s);
    }
    return { journal, basic, custom };
  }, [allStickers]);

  const tabs: Array<{ id: StickerCategory; zh: string; en: string; count: number }> = [
    { id: 'journal', zh: '手帐贴纸', en: 'Journal', count: grouped.journal.length },
    { id: 'basic', zh: '基础贴纸', en: 'Basic', count: grouped.basic.length },
    { id: 'custom', zh: '自定义', en: 'Custom', count: grouped.custom.length },
  ];

  const renderStripTile = (stk: RevisionStickerDef, allowDelete: boolean) => {
    const isSel = selectedStickerId === stk.id;
    const label = isZh ? stk.label : stk.labelEn || stk.label;
    return (
      <div
        key={stk.id}
        className={`arc-journal-sticker-tile-wrap${clsSuffix}`}
      >
        <button
          type="button"
          className={`arc-journal-sticker-tile${clsSuffix} ${isSel ? 'is-selected' : ''}`}
          onClick={() => onSelect(stk)}
          title={label}
        >
          <StickerVisual
            sticker={stk}
            textStyle={stk.defaultTextStyle}
            mode="tile"
            isZh={isZh}
          />
          <span className="arc-journal-sticker-caption">{label}</span>
        </button>
        {allowDelete && onDeleteCustomSticker && (
          <button
            type="button"
            className="arc-journal-tile-del"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCustomSticker(stk.id);
            }}
            title={isZh ? '删除自定义贴纸' : 'Delete custom sticker'}
            aria-label="Delete"
          >
            <X size={10} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="arc-sticker-picker-tabs-root">
      <div className={`arc-sticker-tabs${clsSuffix}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`arc-sticker-tab${clsSuffix} ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span>{isZh ? tab.zh : tab.en}</span>
            <span className="arc-sticker-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'journal' && (
        <div className={`arc-journal-sticker-grid${clsSuffix}`}>
          {grouped.journal.map((stk) => renderStripTile(stk, false))}
        </div>
      )}

      {activeTab === 'basic' && (
        <div className="arc-sticker-palette">
          {grouped.basic.map((stk) => (
            <button
              key={stk.id}
              type="button"
              className={`arc-sticker-pill${pillLightCls} ${selectedStickerId === stk.id ? 'is-selected' : ''}`}
              style={{ borderColor: stk.color }}
              onClick={() => onSelect(stk)}
            >
              <span>{stk.emoji}</span>
              <span>{stk.label}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'custom' && (
        <div className="arc-custom-tab-body">
          {grouped.custom.length === 0 ? (
            <div className={`arc-sticker-empty-hint${clsSuffix}`}>
              {isZh
                ? '暂无自定义贴纸，可下方创建、导入 PNG，或在任意贴纸叠加文字后“保存为自定义贴纸”。'
                : 'No custom stickers yet. Create one below, import PNG, or save a customized text sticker.'}
            </div>
          ) : (
            <>
              {grouped.custom.some((s) => isStripImageSticker(s)) && (
                <div className={`arc-journal-sticker-grid${clsSuffix}`}>
                  {grouped.custom
                    .filter((s) => isStripImageSticker(s))
                    .map((stk) => renderStripTile(stk, true))}
                </div>
              )}
              {grouped.custom.some((s) => !isStripImageSticker(s)) && (
                <div className="arc-sticker-palette">
                  {grouped.custom
                    .filter((s) => !isStripImageSticker(s))
                    .map((stk) => (
                      <div key={stk.id} style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          type="button"
                          className={`arc-sticker-pill${pillLightCls} ${selectedStickerId === stk.id ? 'is-selected' : ''}`}
                          style={{ borderColor: stk.color }}
                          onClick={() => onSelect(stk)}
                        >
                          <span>{stk.emoji ?? '🏷️'}</span>
                          <span>{stk.label}</span>
                        </button>
                        {onDeleteCustomSticker && (
                          <button
                            type="button"
                            className="arc-journal-tile-del"
                            style={{ position: 'static', marginLeft: 2 }}
                            onClick={() => onDeleteCustomSticker(stk.id)}
                            aria-label="Delete"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
