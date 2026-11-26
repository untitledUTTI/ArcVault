import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Crosshair, Info, Sparkles, Wand2 } from 'lucide-react';
import {
  analyzeAcademicIssues,
  recommendPhrasesForContext,
} from '../../core/phrasebank/academicAnalyzer';
import type {
  DetectedPaperSection,
  PlaceholderValues,
  SmartIssue,
} from '../../core/phrasebank/types';
import type { EditorSelectionInfo } from '../DocumentEditor';
import { PhraseBuilderWidget } from './PhraseBuilderWidget';
import { PhraseItemCard } from './PhraseItemCard';

interface SmartAssistTabProps {
  isZh?: boolean;
  docText: string;
  selectionInfo: EditorSelectionInfo | null;
  currentSection: DetectedPaperSection | null;
  favoritesSet: Set<string>;
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onReplaceRange: (from: number, to: number, text: string, label?: string) => void;
  onSelectAndScrollTo: (from: number, to: number) => void;
  onCopy: (text: string, sourceLabel: string) => void;
  onToggleFavorite: (phraseId: string) => void;
  onAddToSkeleton: (text: string, slotId: string | undefined, sourceLabel: string) => void;
}

export const SmartAssistTab: React.FC<SmartAssistTabProps> = ({
  isZh = true,
  docText,
  selectionInfo,
  currentSection,
  favoritesSet,
  placeholders,
  placeholdersEnabled,
  readOnly,
  onInsert,
  onReplaceRange,
  onSelectAndScrollTo,
  onCopy,
  onToggleFavorite,
  onAddToSkeleton,
}) => {
  const [scanFullDoc, setScanFullDoc] = useState(false);

  const hasSelection = Boolean(selectionInfo && selectionInfo.selectedText.trim().length > 0);

  const { targetSlice, baseOffset, scopeLabel } = useMemo(() => {
    if (scanFullDoc) {
      return {
        targetSlice: docText,
        baseOffset: 0,
        scopeLabel: isZh ? '整篇文稿扫描' : 'Full Document',
      };
    }
    if (selectionInfo && selectionInfo.selectedText.trim().length > 0) {
      return {
        targetSlice: selectionInfo.selectedText,
        baseOffset: selectionInfo.from,
        scopeLabel: isZh ? '当前选中文本' : 'Selected Text',
      };
    }
    if (selectionInfo && selectionInfo.currentParagraph.trim().length > 0) {
      return {
        targetSlice: selectionInfo.currentParagraph,
        baseOffset: selectionInfo.paragraphStart,
        scopeLabel: isZh ? '光标所在段落' : 'Current Paragraph',
      };
    }
    return {
      targetSlice: docText.slice(0, 1600),
      baseOffset: 0,
      scopeLabel: isZh ? '正文首段' : 'Opening Paragraph',
    };
  }, [scanFullDoc, docText, selectionInfo, isZh]);

  const issues = useMemo(
    () => analyzeAcademicIssues(targetSlice, baseOffset),
    [targetSlice, baseOffset],
  );

  const safeBatchIssues = useMemo(
    () =>
      issues.filter(
        (iss) =>
          iss.replacements.length > 0 &&
          (iss.kind === 'contraction' ||
            iss.kind === 'everyday-word' ||
            iss.kind === 'spelling-bre' ||
            iss.kind === 'zh-colloquial'),
      ),
    [issues],
  );

  const recommendations = useMemo(
    () =>
      recommendPhrasesForContext({
        text: docText,
        selectedText: selectionInfo?.selectedText ?? '',
        currentParagraph: selectionInfo?.currentParagraph ?? docText.slice(0, 400),
        currentSection,
        limit: 8,
      }),
    [docText, selectionInfo?.selectedText, selectionInfo?.currentParagraph, currentSection],
  );

  const handleBatchFix = () => {
    if (readOnly || safeBatchIssues.length === 0) return;
    // Apply from end to start so offsets remain valid inside targetSlice
    const sorted = [...safeBatchIssues].sort((a, b) => b.startOffset - a.startOffset);
    const localStart = baseOffset;
    const localEnd = baseOffset + targetSlice.length;
    let nextSlice = targetSlice;
    for (const iss of sorted) {
      const relStart = iss.startOffset - baseOffset;
      const relEnd = iss.endOffset - baseOffset;
      if (relStart >= 0 && relEnd <= nextSlice.length) {
        nextSlice = nextSlice.slice(0, relStart) + iss.replacements[0] + nextSlice.slice(relEnd);
      }
    }
    onReplaceRange(
      localStart,
      localEnd,
      nextSlice,
      isZh ? `批量学术化替换 (${sorted.length} 处)` : `Batch academic replace (${sorted.length})`,
    );
  };

  const renderSeverityIcon = (sev: SmartIssue['severity']) => {
    if (sev === 'warning') return <AlertTriangle size={13} color="#d97706" />;
    if (sev === 'suggestion') return <Wand2 size={13} color="var(--accent)" />;
    return <Info size={13} color="var(--text-muted)" />;
  };

  return (
    <div className="apb-stack">
      <div className="apb-summary-bar">
        <div className="apb-summary-meta">
          <span className="apb-pill-badge">{isZh ? '分析范围：' : 'Scope: '}{scopeLabel}</span>
          {currentSection && (
            <span className="apb-pill-badge is-accent">
              {isZh ? '识别章节：' : 'Section: '}{currentSection.mappedSectionLabel}
            </span>
          )}
        </div>

        <div className="apb-segmented-mini">
          <button
            type="button"
            className={!scanFullDoc ? 'active' : ''}
            onClick={() => setScanFullDoc(false)}
          >
            {isZh ? '聚焦选区/当前段' : 'Selection / Para'}
          </button>
          <button
            type="button"
            className={scanFullDoc ? 'active' : ''}
            onClick={() => setScanFullDoc(true)}
          >
            {isZh ? '扫描全文' : 'Full Doc'}
          </button>
        </div>
      </div>

      {/* Section A: Smart Recognition & 1-Click Replacement */}
      <div className="apb-section-block">
        <div className="apb-section-header">
          <div className="apb-section-title">
            <Sparkles size={13.5} color="var(--accent)" />
            <span>{isZh ? `智能识别与一键替换 (${issues.length})` : `Smart Detection & Quick Fix (${issues.length})`}</span>
          </div>
          {safeBatchIssues.length > 1 && !readOnly && (
            <button
              type="button"
              className="arc-btn arc-btn-primary apb-mini-btn"
              onClick={handleBatchFix}
            >
              <Wand2 size={11.5} />
              <span>{isZh ? `一键全部替换 (${safeBatchIssues.length})` : `Fix All (${safeBatchIssues.length})`}</span>
            </button>
          )}
        </div>

        {issues.length === 0 ? (
          <div className="apb-empty-card">
            <CheckCircle2 size={16} color="#16a34a" />
            <span>
              {isZh
                ? '当前文本未检出口语词、缩写、拼写不一致或绝对化断言，学术规范良好！'
                : 'No colloquialisms, contractions, spelling drift, or absolute claims detected.'}
            </span>
          </div>
        ) : (
          <div className="apb-issue-list">
            {issues.map((iss) => (
              <div key={iss.id} className={`apb-issue-card sev-${iss.severity}`}>
                <div className="apb-issue-top">
                  <div className="apb-issue-title">
                    {renderSeverityIcon(iss.severity)}
                    <span>{iss.title}</span>
                  </div>
                  <button
                    type="button"
                    className="arc-btn apb-mini-btn"
                    onClick={() => onSelectAndScrollTo(iss.startOffset, iss.endOffset)}
                    data-arc-tooltip={isZh ? '在正文中定位并高亮' : 'Locate & highlight in editor'}
                  >
                    <Crosshair size={11} />
                    <span>{isZh ? '定位' : 'Locate'}</span>
                  </button>
                </div>

                <div className="apb-issue-detail">{iss.detail}</div>

                {iss.replacements.length > 0 && (
                  <div className="apb-replace-row">
                    <span className="apb-replace-label">{isZh ? '一键替换：' : 'Replace:'}</span>
                    {iss.replacements.map((rep) => (
                      <button
                        key={rep}
                        type="button"
                        disabled={readOnly}
                        className="apb-replace-chip"
                        onClick={() =>
                          onReplaceRange(
                            iss.startOffset,
                            iss.endOffset,
                            rep,
                            isZh ? `替换为 ${rep}` : `Replaced with ${rep}`,
                          )
                        }
                        data-arc-tooltip={
                          readOnly
                            ? isZh
                              ? '文档已封存'
                              : 'Document sealed'
                            : isZh
                              ? `将 "${iss.matchedText}" 替换为 "${rep}"`
                              : `Replace "${iss.matchedText}" with "${rep}"`
                        }
                      >
                        {rep}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section B: Smart Context Phrase Recommendations */}
      <div className="apb-section-block">
        <div className="apb-section-header">
          <div className="apb-section-title">
            <Wand2 size={13.5} color="var(--accent)" />
            <span>{isZh ? '智能推荐句型 & 拼句器' : 'Recommended Phrases & Builders'}</span>
          </div>
          <span className="apb-hint-text">{isZh ? '基于当前章节与语义自动匹配' : 'Matched to current section & context'}</span>
        </div>

        {recommendations.builders.map((b) => (
          <PhraseBuilderWidget
            key={b.builder.id}
            isZh={isZh}
            builder={b.builder}
            sourceLabel={`${b.sectionShortCn} · ${b.moveTitleCn}`}
            skeletonSlot={b.skeletonSlot}
            placeholders={placeholders}
            placeholdersEnabled={placeholdersEnabled}
            hasSelection={hasSelection}
            readOnly={readOnly}
            onInsert={onInsert}
            onCopy={onCopy}
            onAddToSkeleton={onAddToSkeleton}
          />
        ))}

        <div className="apb-phrase-list">
          {recommendations.phrases.map((rec) => (
            <PhraseItemCard
              key={rec.phrase.id}
              isZh={isZh}
              phrase={rec.phrase}
              sourceLabel={`${rec.sectionShortCn} · ${rec.moveTitleCn}`}
              skeletonSlot={rec.skeletonSlot}
              reason={rec.reason}
              placeholders={placeholders}
              placeholdersEnabled={placeholdersEnabled}
              isFavorite={favoritesSet.has(rec.phrase.id)}
              hasSelection={hasSelection}
              readOnly={readOnly}
              onInsert={onInsert}
              onCopy={onCopy}
              onToggleFavorite={onToggleFavorite}
              onAddToSkeleton={onAddToSkeleton}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
