import React, { useState } from 'react';
import { Check, Copy, CornerDownLeft, Dices, ListPlus, Wand2 } from 'lucide-react';
import { assembleBuilder } from '../../core/phrasebank/builderFormat';
import { applyPlaceholders, tokenizeWithHighlights } from '../../core/phrasebank/placeholders';
import type { PhraseBuilder, PlaceholderValues } from '../../core/phrasebank/types';

interface PhraseBuilderWidgetProps {
  isZh?: boolean;
  builder: PhraseBuilder;
  sourceLabel: string;
  skeletonSlot?: string;
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  hasSelection: boolean;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
  onAddToSkeleton: (text: string, slotId: string | undefined, sourceLabel: string) => void;
}

export const PhraseBuilderWidget: React.FC<PhraseBuilderWidgetProps> = ({
  isZh = true,
  builder,
  sourceLabel,
  skeletonSlot,
  placeholders,
  placeholdersEnabled,
  hasSelection,
  readOnly,
  onInsert,
  onCopy,
  onAddToSkeleton,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() =>
    builder.columns.map(() => 0),
  );
  const [copied, setCopied] = useState(false);

  const rawAssembled = assembleBuilder(builder.columns, selectedIndices);
  const finalPlain = applyPlaceholders(rawAssembled, placeholders, placeholdersEnabled);
  const segments = tokenizeWithHighlights(rawAssembled, placeholders, placeholdersEnabled);

  const handleSelect = (colIdx: number, optIdx: number) => {
    setSelectedIndices((prev) => prev.map((val, idx) => (idx === colIdx ? optIdx : val)));
  };

  const handleRandomize = () => {
    setSelectedIndices(
      builder.columns.map((col) => Math.floor(Math.random() * col.options.length)),
    );
  };

  const handleCopy = () => {
    onCopy(finalPlain, `${sourceLabel} · ${isZh ? '拼句器' : 'Builder'}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="apb-builder-card">
      <div className="apb-builder-header">
        <span className="apb-builder-title">
          <Wand2 size={13.5} />
          <span>{builder.titleCn}</span>
        </span>
        <button
          type="button"
          className="arc-btn apb-mini-btn"
          onClick={handleRandomize}
          data-arc-tooltip={isZh ? '随机搭配一组学术表达' : 'Randomize academic phrase combination'}
        >
          <Dices size={11.5} />
          <span>{isZh ? '随机组合' : 'Randomize'}</span>
        </button>
      </div>

      {builder.descCn && <p className="apb-builder-desc">{builder.descCn}</p>}

      <div className="apb-builder-columns">
        {builder.columns.map((col, colIdx) => (
          <div key={colIdx} className="apb-builder-col">
            <span className="apb-builder-col-label">{col.labelCn}</span>
            <div className="apb-builder-options">
              {col.options.map((opt, optIdx) => (
                <button
                  key={optIdx}
                  type="button"
                  className={`apb-builder-opt ${selectedIndices[colIdx] === optIdx ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(colIdx, optIdx)}
                >
                  {opt === '(omit)' ? (isZh ? '（省略）' : '(omit)') : opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="apb-builder-preview-box">
        <div className="apb-builder-preview-text">
          {segments.map((seg, i) =>
            seg.replaced ? (
              <span key={i} className="apb-ph-replaced">
                {seg.text}
              </span>
            ) : (
              <React.Fragment key={i}>{seg.text}</React.Fragment>
            ),
          )}
        </div>

        <div className="apb-phrase-actions">
          <button
            type="button"
            className="arc-btn arc-btn-primary apb-mini-btn"
            disabled={readOnly}
            onClick={() => onInsert(finalPlain, `${sourceLabel} · ${isZh ? '拼句器' : 'Builder'}`)}
          >
            <CornerDownLeft size={11.5} />
            <span>{hasSelection ? (isZh ? '替换选中' : 'Replace') : isZh ? '插入拼接句' : 'Insert'}</span>
          </button>
          <button type="button" className="arc-btn apb-mini-btn" onClick={handleCopy}>
            {copied ? <Check size={11.5} /> : <Copy size={11.5} />}
            <span>{copied ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="arc-btn apb-mini-btn"
            onClick={() => onAddToSkeleton(finalPlain, skeletonSlot, `${sourceLabel} · ${isZh ? '拼句器' : 'Builder'}`)}
          >
            <ListPlus size={11.5} />
            <span>{isZh ? '骨架' : 'Skeleton'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
