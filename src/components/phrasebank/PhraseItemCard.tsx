import React, { useState } from 'react';
import { Check, Copy, CornerDownLeft, ListPlus, RefreshCw, Star } from 'lucide-react';
import { GROUP_PHRASES_MAP } from '../../core/phrasebank/data';
import { applyPlaceholders, tokenizeWithHighlights } from '../../core/phrasebank/placeholders';
import type {
  PhraseItem,
  PlaceholderValues,
  TenseTag,
  ToneStrength,
} from '../../core/phrasebank/types';

interface PhraseItemCardProps {
  isZh?: boolean;
  phrase: PhraseItem;
  sourceLabel: string;
  skeletonSlot?: string;
  reason?: string;
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  isFavorite: boolean;
  hasSelection: boolean;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
  onToggleFavorite: (phraseId: string) => void;
  onAddToSkeleton: (text: string, slotId: string | undefined, sourceLabel: string) => void;
}

const TONE_LABELS: Record<ToneStrength, { labelZh: string; labelEn: string; cls: string }> = {
  cautious: { labelZh: '谨慎/委婉', labelEn: 'Cautious', cls: 'apb-tag-cautious' },
  neutral: { labelZh: '中性客观', labelEn: 'Neutral', cls: 'apb-tag-neutral' },
  assertive: { labelZh: '明确/强硬', labelEn: 'Assertive', cls: 'apb-tag-assertive' },
};

const TENSE_LABELS: Partial<Record<TenseTag, { zh: string; en: string }>> = {
  present: { zh: '一般现在时', en: 'Present' },
  past: { zh: '一般过去时', en: 'Past' },
  present_perfect: { zh: '现在完成时', en: 'Pres. Perfect' },
  future: { zh: '将来/预告', en: 'Future' },
};

export const PhraseItemCard: React.FC<PhraseItemCardProps> = ({
  isZh = true,
  phrase,
  sourceLabel,
  skeletonSlot,
  reason,
  placeholders,
  placeholdersEnabled,
  isFavorite,
  hasSelection,
  readOnly,
  onInsert,
  onCopy,
  onToggleFavorite,
  onAddToSkeleton,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showVariants, setShowVariants] = useState(false);

  const siblings = phrase.groupId
    ? (GROUP_PHRASES_MAP.get(phrase.groupId) ?? []).filter((e) => e.phrase.id !== phrase.id)
    : [];

  const mainSegments = tokenizeWithHighlights(phrase.en, placeholders, placeholdersEnabled);
  const finalPlainText = applyPlaceholders(phrase.en, placeholders, placeholdersEnabled);

  const handleCopyText = (text: string, key: string) => {
    onCopy(text, sourceLabel);
    setCopiedId(key);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 1200);
  };

  const toneMeta = TONE_LABELS[phrase.tone];
  const tenseMeta = phrase.tense ? TENSE_LABELS[phrase.tense] : undefined;
  const tenseLabel = tenseMeta ? (isZh ? tenseMeta.zh : tenseMeta.en) : undefined;

  return (
    <article className="apb-phrase-card">
      {reason && <div className="apb-reason-pill">{reason}</div>}
      <p className="apb-phrase-en">
        {mainSegments.map((seg, i) =>
          seg.replaced ? (
            <span key={i} className="apb-ph-replaced">
              {seg.text}
            </span>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </p>

      <div className="apb-phrase-meta-row">
        <div className="apb-phrase-intent-wrap">
          {isZh && <span className="apb-phrase-intent">{phrase.intentCn}</span>}
          {phrase.isCore && <span className="apb-tag apb-tag-core">{isZh ? '核心' : 'Core'}</span>}
          <span className={`apb-tag ${toneMeta.cls}`}>{isZh ? toneMeta.labelZh : toneMeta.labelEn}</span>
          {tenseLabel && <span className="apb-tag apb-tag-tense">{tenseLabel}</span>}
          {phrase.voice === 'passive' && <span className="apb-tag apb-tag-neutral">{isZh ? '被动语态' : 'Passive'}</span>}
        </div>

        <div className="apb-phrase-actions">
          <button
            type="button"
            className="arc-btn arc-btn-primary apb-mini-btn"
            disabled={readOnly}
            onClick={() => onInsert(finalPlainText, sourceLabel)}
            data-arc-tooltip={
              readOnly
                ? isZh
                  ? '文档已封存，仅支持复制'
                  : 'Document sealed; copy only'
                : hasSelection
                  ? isZh
                    ? '用此句型替换当前选中文本'
                    : 'Replace selected text'
                  : isZh
                    ? '在当前光标处插入句型'
                    : 'Insert at cursor'
            }
          >
            <CornerDownLeft size={11.5} />
            <span>{hasSelection ? (isZh ? '替换选中' : 'Replace') : isZh ? '插入' : 'Insert'}</span>
          </button>

          <button
            type="button"
            className="arc-btn apb-mini-btn"
            onClick={() => handleCopyText(finalPlainText, phrase.id)}
            data-arc-tooltip={isZh ? '复制到剪贴板' : 'Copy to clipboard'}
          >
            {copiedId === phrase.id ? <Check size={11.5} /> : <Copy size={11.5} />}
            <span>{copiedId === phrase.id ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}</span>
          </button>

          {siblings.length > 0 && (
            <button
              type="button"
              className={`arc-btn apb-mini-btn ${showVariants ? 'apb-btn-active' : ''}`}
              onClick={() => setShowVariants((v) => !v)}
              data-arc-tooltip={isZh ? '防重复：查看同功能替换表达' : 'View alternative phrasings'}
            >
              <RefreshCw size={11.5} />
              <span>{isZh ? `换说法 (${siblings.length})` : `Variants (${siblings.length})`}</span>
            </button>
          )}

          <button
            type="button"
            className="arc-btn apb-mini-btn"
            onClick={() => onAddToSkeleton(finalPlainText, skeletonSlot, sourceLabel)}
            data-arc-tooltip={isZh ? '加入写作骨架台' : 'Add to Draft Skeleton'}
          >
            <ListPlus size={11.5} />
          </button>

          <button
            type="button"
            className={`arc-btn apb-mini-btn apb-fav-btn ${isFavorite ? 'is-favorited' : ''}`}
            onClick={() => onToggleFavorite(phrase.id)}
            data-arc-tooltip={isFavorite ? (isZh ? '移出收藏' : 'Remove favorite') : isZh ? '加入收藏' : 'Add favorite'}
            aria-label={isFavorite ? (isZh ? '取消收藏' : 'Unfavorite') : isZh ? '收藏' : 'Favorite'}
          >
            <Star size={11.5} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {showVariants && siblings.length > 0 && (
        <div className="apb-variants-panel">
          <div className="apb-variants-title">
            {isZh ? '同修辞功能替换表达（避免连续重复用句）：' : 'Alternative phrasings (avoid repetition):'}
          </div>
          {siblings.map(({ phrase: sib }) => {
            const sibText = applyPlaceholders(sib.en, placeholders, placeholdersEnabled);
            const sibSegments = tokenizeWithHighlights(sib.en, placeholders, placeholdersEnabled);
            return (
              <div key={sib.id} className="apb-variant-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="apb-variant-en">
                    {sibSegments.map((seg, i) =>
                      seg.replaced ? (
                        <span key={i} className="apb-ph-replaced">
                          {seg.text}
                        </span>
                      ) : (
                        <React.Fragment key={i}>{seg.text}</React.Fragment>
                      ),
                    )}
                  </div>
                  {isZh && <div className="apb-variant-cn">{sib.intentCn}</div>}
                </div>
                <div className="apb-phrase-actions" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="arc-btn arc-btn-primary apb-mini-btn"
                    disabled={readOnly}
                    onClick={() => onInsert(sibText, sourceLabel)}
                  >
                    <CornerDownLeft size={11} />
                    <span>{hasSelection ? (isZh ? '替换' : 'Replace') : isZh ? '插入' : 'Insert'}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn apb-mini-btn"
                    onClick={() => handleCopyText(sibText, sib.id)}
                  >
                    {copiedId === sib.id ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
};
