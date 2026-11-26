import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Sparkles } from 'lucide-react';
import { getSectionChecklist } from '../../core/phrasebank/academicAnalyzer';
import { ALL_SECTIONS, MAJOR_SECTIONS } from '../../core/phrasebank/data';
import { matchesFilters } from '../../core/phrasebank/search';
import type {
  DetectedPaperSection,
  FilterState,
  PlaceholderValues,
  ToneStrength,
} from '../../core/phrasebank/types';
import { PhraseBuilderWidget } from './PhraseBuilderWidget';
import { PhraseItemCard } from './PhraseItemCard';

interface SectionNavigatorTabProps {
  isZh?: boolean;
  detectedSections: DetectedPaperSection[];
  currentSection: DetectedPaperSection | null;
  favoritesSet: Set<string>;
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  hasSelection: boolean;
  readOnly: boolean;
  onJumpToOffset: (offset: number) => void;
  onInsert: (text: string, sourceLabel: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
  onToggleFavorite: (phraseId: string) => void;
  onAddToSkeleton: (text: string, slotId: string | undefined, sourceLabel: string) => void;
}

const ALL_SECTION_CHOICES = [
  ...MAJOR_SECTIONS,
  ...ALL_SECTIONS.filter((s) => s.id === 'writing-abstracts' || s.id === 'writing-acknowledgements'),
];

export const SectionNavigatorTab: React.FC<SectionNavigatorTabProps> = ({
  isZh = true,
  detectedSections,
  currentSection,
  favoritesSet,
  placeholders,
  placeholdersEnabled,
  hasSelection,
  readOnly,
  onJumpToOffset,
  onInsert,
  onCopy,
  onToggleFavorite,
  onAddToSkeleton,
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    currentSection?.mappedSectionId ?? MAJOR_SECTIONS[0].id,
  );
  const [followCursor, setFollowCursor] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    tone: 'all',
    tense: 'all',
    coreOnly: false,
  });

  useEffect(() => {
    if (followCursor && currentSection?.mappedSectionId) {
      setSelectedSectionId(currentSection.mappedSectionId);
    }
  }, [followCursor, currentSection?.mappedSectionId]);

  const activeModule = useMemo(
    () => ALL_SECTIONS.find((s) => s.id === selectedSectionId) ?? MAJOR_SECTIONS[0],
    [selectedSectionId],
  );

  const recommendedFuncs = useMemo(() => {
    const ids = currentSection?.mappedSectionId === activeModule.id
      ? currentSection.recommendedFunctionIds
      : [];
    return ALL_SECTIONS.filter((s) => ids.includes(s.id) && s.id !== activeModule.id);
  }, [currentSection, activeModule.id]);

  const checklist = useMemo(() => getSectionChecklist(activeModule.id), [activeModule.id]);

  return (
    <div className="apb-stack">
      {/* Detected Paper Outline */}
      <div className="apb-ref-card">
        <div className="apb-section-header" style={{ marginBottom: 8 }}>
          <div className="apb-section-title">
            <Compass size={13.5} color="var(--accent)" />
            <span>{isZh ? `已识别论文章节大纲 (${detectedSections.length})` : `Detected Paper Outline (${detectedSections.length})`}</span>
          </div>
          <label className="apb-toggle-inline">
            <input
              type="checkbox"
              checked={followCursor}
              onChange={(e) => setFollowCursor(e.target.checked)}
            />
            <span>{isZh ? '跟随光标自动切换' : 'Follow Cursor'}</span>
          </label>
        </div>

        {detectedSections.length === 0 ? (
          <div className="apb-hint-text">
            {isZh
              ? '暂未检测到 Markdown / LaTeX 章节标题，可在下方手动切换任意标准论文章节句库。'
              : 'No Markdown / LaTeX section headings detected yet. Choose any standard section below.'}
          </div>
        ) : (
          <div className="apb-chip-wrap">
            {detectedSections.map((sec) => {
              const isCurrent = currentSection?.id === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  className={`apb-outline-chip ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => {
                    setSelectedSectionId(sec.mappedSectionId);
                    onJumpToOffset(sec.startOffset);
                  }}
                  data-arc-tooltip={
                    isZh
                      ? `跳转至「${sec.title}」并加载「${sec.mappedSectionLabel}」句库（约 ${sec.wordCount} 词）`
                      : `Jump to "${sec.title}" & load "${sec.mappedSectionLabel}" (~${sec.wordCount} words)`
                  }
                >
                  <span className="apb-outline-title">{sec.title}</span>
                  <span className="apb-outline-map">
                    {isZh
                      ? sec.mappedSectionLabel.split(' · ')[0]
                      : sec.mappedSectionLabel.split(' · ')[1] || sec.mappedSectionLabel.split(' · ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Standard Major Section Switcher */}
      <div className="apb-chip-wrap">
        {ALL_SECTION_CHOICES.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={`apb-filter-chip ${selectedSectionId === sec.id ? 'active' : ''}`}
            onClick={() => {
              setFollowCursor(false);
              setSelectedSectionId(sec.id);
            }}
          >
            {isZh ? sec.shortCn : sec.titleEn}
          </button>
        ))}
        {recommendedFuncs.map((fn) => (
          <button
            key={fn.id}
            type="button"
            className={`apb-filter-chip is-func ${selectedSectionId === fn.id ? 'active' : ''}`}
            onClick={() => {
              setFollowCursor(false);
              setSelectedSectionId(fn.id);
            }}
            data-arc-tooltip={isZh ? '当前章节高相关通用修辞功能' : 'Relevant rhetorical function for this section'}
          >
            + {isZh ? fn.shortCn : fn.titleEn}
          </button>
        ))}
      </div>

      {/* Section Summary & Rules */}
      <div className="apb-summary-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ fontSize: 13.5 }}>{isZh ? activeModule.titleCn : activeModule.titleEn}</strong>
          {isZh && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{activeModule.titleEn}</span>}
        </div>
        {isZh && (
          <p style={{ margin: '5px 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {activeModule.summaryCn}
          </p>
        )}
        {isZh && (checklist.length > 0 || activeModule.keyRulesCn.length > 0) && (
          <ul className="apb-rules-list">
            {[...checklist, ...activeModule.keyRulesCn.slice(0, 3)].map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      <div className="apb-filter-row">
        {(['all', 'cautious', 'neutral', 'assertive'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`apb-filter-chip ${filters.tone === t ? 'active' : ''}`}
            onClick={() => setFilters((f) => ({ ...f, tone: t as ToneStrength | 'all' }))}
          >
            {t === 'all'
              ? isZh
                ? '全部语气'
                : 'All Tones'
              : t === 'cautious'
                ? isZh
                  ? '谨慎'
                  : 'Cautious'
                : t === 'neutral'
                  ? isZh
                    ? '中性'
                    : 'Neutral'
                  : isZh
                    ? '明确'
                    : 'Assertive'}
          </button>
        ))}
        <button
          type="button"
          className={`apb-filter-chip ${filters.coreOnly ? 'active' : ''}`}
          onClick={() => setFilters((f) => ({ ...f, coreOnly: !f.coreOnly }))}
        >
          <Sparkles size={11} />
          <span>{isZh ? '仅核心句型' : 'Core Only'}</span>
        </button>
      </div>

      {/* Moves & Phrases */}
      {activeModule.moves.map((move) => {
        const filteredPhrases = move.phrases.filter((p) => matchesFilters(p, filters));
        if (filteredPhrases.length === 0 && (!move.builders || move.builders.length === 0)) {
          return null;
        }
        return (
          <section key={move.id} className="apb-move-block">
            <div className="apb-move-header">
              <div className="apb-move-title-cn">
                <BookOpen size={12.5} color="var(--accent)" />
                <span>{isZh ? move.titleCn : move.titleEn}</span>
              </div>
              {isZh && <span className="apb-move-title-en">{move.titleEn}</span>}
            </div>
            {isZh && move.tipCn && <div className="apb-move-tip">{move.tipCn}</div>}

            {move.builders?.map((b) => (
              <PhraseBuilderWidget
                key={b.id}
                isZh={isZh}
                builder={b}
                sourceLabel={isZh ? `${activeModule.shortCn} · ${move.titleCn}` : `${activeModule.titleEn} · ${move.titleEn}`}
                skeletonSlot={move.skeletonSlot}
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
              {filteredPhrases.map((p) => (
                <PhraseItemCard
                  key={p.id}
                  isZh={isZh}
                  phrase={p}
                  sourceLabel={isZh ? `${activeModule.shortCn} · ${move.titleCn}` : `${activeModule.titleEn} · ${move.titleEn}`}
                  skeletonSlot={move.skeletonSlot}
                  placeholders={placeholders}
                  placeholdersEnabled={placeholdersEnabled}
                  isFavorite={favoritesSet.has(p.id)}
                  hasSelection={hasSelection}
                  readOnly={readOnly}
                  onInsert={onInsert}
                  onCopy={onCopy}
                  onToggleFavorite={onToggleFavorite}
                  onAddToSkeleton={onAddToSkeleton}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
