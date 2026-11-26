import React, { useMemo, useState } from 'react';
import { BookOpen, Search, Sparkles, X } from 'lucide-react';
import {
  ALL_SECTIONS,
  GENERAL_FUNCTIONS,
  MAJOR_SECTIONS,
  PRESENTATION_SECTIONS,
} from '../../core/phrasebank/data';
import { searchModules } from '../../core/phrasebank/search';
import type {
  FilterState,
  PlaceholderValues,
  TenseTag,
  ToneStrength,
} from '../../core/phrasebank/types';
import { PhraseBuilderWidget } from './PhraseBuilderWidget';
import { PhraseItemCard } from './PhraseItemCard';

interface QuickLookupTabProps {
  isZh?: boolean;
  favoritesSet: Set<string>;
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  hasSelection: boolean;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
  onToggleFavorite: (phraseId: string) => void;
  onAddToSkeleton: (text: string, slotId: string | undefined, sourceLabel: string) => void;
}

const QUICK_INTENT_CHIPS: Array<{ zh: string; en: string; qEn: string }> = [
  { zh: '研究空白', en: 'Research Gap', qEn: 'gap' },
  { zh: '局限性', en: 'Limitations', qEn: 'limitation' },
  { zh: '显著差异', en: 'Significance', qEn: 'significant' },
  { zh: '谨慎推测', en: 'Hedging', qEn: 'may' },
  { zh: '因果解释', en: 'Causality', qEn: 'cause' },
  { zh: '对比分析', en: 'Comparison', qEn: 'contrast' },
  { zh: '批判质疑', en: 'Critique', qEn: 'critique' },
  { zh: '过渡衔接', en: 'Transitions', qEn: 'transition' },
  { zh: '总结展望', en: 'Conclusion', qEn: 'future' },
];

export const QuickLookupTab: React.FC<QuickLookupTabProps> = ({
  isZh = true,
  favoritesSet,
  placeholders,
  placeholdersEnabled,
  hasSelection,
  readOnly,
  onInsert,
  onCopy,
  onToggleFavorite,
  onAddToSkeleton,
}) => {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<'written' | 'presentations'>('written');
  const [browseGroup, setBrowseGroup] = useState<'sections' | 'functions'>('functions');
  const [activeFuncId, setActiveFuncId] = useState(GENERAL_FUNCTIONS[0].id);
  const [activeMajorId, setActiveMajorId] = useState(MAJOR_SECTIONS[0].id);
  const [filters, setFilters] = useState<FilterState>({
    tone: 'all',
    tense: 'all',
    coreOnly: false,
  });

  const isSearching = query.trim().length > 0;

  const searchBundle = useMemo(() => {
    if (!isSearching) return null;
    const domains: ('sections' | 'functions' | 'presentations')[] =
      domain === 'presentations' ? ['presentations'] : ['sections', 'functions'];
    return searchModules(ALL_SECTIONS, query, filters, domains);
  }, [isSearching, query, filters, domain]);

  const activeBrowseSection = useMemo(() => {
    if (domain === 'presentations') return PRESENTATION_SECTIONS[0];
    if (browseGroup === 'sections') {
      return MAJOR_SECTIONS.find((s) => s.id === activeMajorId) ?? MAJOR_SECTIONS[0];
    }
    return GENERAL_FUNCTIONS.find((s) => s.id === activeFuncId) ?? GENERAL_FUNCTIONS[0];
  }, [domain, browseGroup, activeMajorId, activeFuncId]);

  return (
    <div className="apb-stack">
      {/* Search + Domain Bar */}
      <div className="apb-search-row">
        <div className="apb-search-wrap">
          <Search size={13.5} className="apb-search-icon" />
          <input
            type="text"
            className="arc-input apb-search-input"
            placeholder={
              isZh
                ? '搜索中文意图（如：研究空白、局限、因果）或英文关键词（paucity, ANOVA）...'
                : 'Search intent or keywords (e.g. gap, limitation, paucity, ANOVA)...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="apb-search-clear"
              onClick={() => setQuery('')}
              aria-label={isZh ? '清空搜索' : 'Clear search'}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="apb-segmented-mini">
          <button
            type="button"
            className={domain === 'written' ? 'active' : ''}
            onClick={() => setDomain('written')}
          >
            {isZh ? '书面论文库' : 'Written Paper'}
          </button>
          <button
            type="button"
            className={domain === 'presentations' ? 'active' : ''}
            onClick={() => setDomain('presentations')}
          >
            {isZh ? '汇报答辩库' : 'Presentations'}
          </button>
        </div>
      </div>

      {/* Quick Intent Chips + Filters */}
      <div className="apb-chip-wrap">
        {QUICK_INTENT_CHIPS.map((chip) => {
          const val = isZh ? chip.zh : chip.qEn;
          return (
            <button
              key={chip.zh}
              type="button"
              className={`apb-filter-chip ${query === val ? 'active' : ''}`}
              onClick={() => setQuery((cur) => (cur === val ? '' : val))}
            >
              {isZh ? chip.zh : chip.en}
            </button>
          );
        })}
      </div>

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
        {(['all', 'present', 'past', 'present_perfect'] as const).map((ts) => (
          <button
            key={ts}
            type="button"
            className={`apb-filter-chip ${filters.tense === ts ? 'active' : ''}`}
            onClick={() => setFilters((f) => ({ ...f, tense: ts as TenseTag | 'all' }))}
          >
            {ts === 'all'
              ? isZh
                ? '全时态'
                : 'All Tenses'
              : ts === 'present'
                ? isZh
                  ? '现在时'
                  : 'Present'
                : ts === 'past'
                  ? isZh
                    ? '过去时'
                    : 'Past'
                  : isZh
                    ? '完成时'
                    : 'Pres. Perfect'}
          </button>
        ))}
        <button
          type="button"
          className={`apb-filter-chip ${filters.coreOnly ? 'active' : ''}`}
          onClick={() => setFilters((f) => ({ ...f, coreOnly: !f.coreOnly }))}
        >
          <Sparkles size={11} />
          <span>{isZh ? '仅核心' : 'Core Only'}</span>
        </button>
      </div>

      {isSearching && searchBundle ? (
        <div className="apb-stack">
          <div className="apb-summary-bar">
            <span>
              {isZh ? (
                <>
                  检索到 <strong>{searchBundle.totalPhrases}</strong> 条句型 ·{' '}
                  <strong>{searchBundle.totalBuilders}</strong> 个交互拼句器
                </>
              ) : (
                <>
                  Found <strong>{searchBundle.totalPhrases}</strong> phrases ·{' '}
                  <strong>{searchBundle.totalBuilders}</strong> builders
                </>
              )}
            </span>
            {searchBundle.crossDomainMatchCount > 0 && (
              <button
                type="button"
                className="arc-btn apb-mini-btn"
                onClick={() => setDomain((d) => (d === 'written' ? 'presentations' : 'written'))}
              >
                {isZh
                  ? `切换到${domain === 'written' ? '汇报答辩库' : '书面论文库'}（${searchBundle.crossDomainMatchCount} 条）`
                  : `Switch to ${domain === 'written' ? 'Presentations' : 'Written Paper'} (${searchBundle.crossDomainMatchCount})`}
              </button>
            )}
          </div>

          {searchBundle.groups.length === 0 ? (
            <div className="apb-empty-card">
              {isZh
                ? `未找到与 “${query}” 匹配的句型，可尝试中文意图词（如：空白、局限、显著、谨慎、反驳）。`
                : `No phrases matching "${query}". Try keywords like gap, limitation, significant, or contrast.`}
            </div>
          ) : (
            searchBundle.groups.map((grp) => (
              <section key={`${grp.section.id}-${grp.move.id}`} className="apb-move-block">
                <div className="apb-move-header">
                  <div className="apb-move-title-cn">
                    <BookOpen size={12.5} color="var(--accent)" />
                    <span>
                      {isZh
                        ? `${grp.section.shortCn} · ${grp.move.titleCn}`
                        : `${grp.section.titleEn} · ${grp.move.titleEn}`}
                    </span>
                  </div>
                  {isZh && <span className="apb-move-title-en">{grp.move.titleEn}</span>}
                </div>

                {grp.builders.map((b) => (
                  <PhraseBuilderWidget
                    key={b.id}
                    isZh={isZh}
                    builder={b}
                    sourceLabel={isZh ? `${grp.section.shortCn} · ${grp.move.titleCn}` : `${grp.section.titleEn} · ${grp.move.titleEn}`}
                    skeletonSlot={grp.move.skeletonSlot}
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
                  {grp.phrases.map((p) => (
                    <PhraseItemCard
                      key={p.id}
                      isZh={isZh}
                      phrase={p}
                      sourceLabel={isZh ? `${grp.section.shortCn} · ${grp.move.titleCn}` : `${grp.section.titleEn} · ${grp.move.titleEn}`}
                      skeletonSlot={grp.move.skeletonSlot}
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
            ))
          )}
        </div>
      ) : (
        <div className="apb-stack">
          {domain === 'written' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div className="apb-segmented-mini">
                  <button
                    type="button"
                    className={browseGroup === 'functions' ? 'active' : ''}
                    onClick={() => setBrowseGroup('functions')}
                  >
                    {isZh ? `通用修辞功能 (${GENERAL_FUNCTIONS.length})` : `Rhetorical Functions (${GENERAL_FUNCTIONS.length})`}
                  </button>
                  <button
                    type="button"
                    className={browseGroup === 'sections' ? 'active' : ''}
                    onClick={() => setBrowseGroup('sections')}
                  >
                    {isZh ? `论文主章节 (${MAJOR_SECTIONS.length})` : `Major Sections (${MAJOR_SECTIONS.length})`}
                  </button>
                </div>
              </div>

              <div className="apb-chip-wrap">
                {(browseGroup === 'functions' ? GENERAL_FUNCTIONS : MAJOR_SECTIONS).map((sec) => {
                  const isActive =
                    browseGroup === 'functions'
                      ? activeFuncId === sec.id
                      : activeMajorId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      className={`apb-filter-chip ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        browseGroup === 'functions'
                          ? setActiveFuncId(sec.id)
                          : setActiveMajorId(sec.id)
                      }
                    >
                      {isZh ? sec.shortCn : sec.titleEn}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="apb-summary-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{isZh ? activeBrowseSection.titleCn : activeBrowseSection.titleEn}</strong>
              {isZh && (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {activeBrowseSection.titleEn}
                </span>
              )}
            </div>
            {isZh && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                {activeBrowseSection.summaryCn}
              </p>
            )}
          </div>

          {activeBrowseSection.moves.map((move) => (
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
                  sourceLabel={isZh ? `${activeBrowseSection.shortCn} · ${move.titleCn}` : `${activeBrowseSection.titleEn} · ${move.titleEn}`}
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
                {move.phrases
                  .filter((p) =>
                    (filters.tone === 'all' || p.tone === filters.tone) &&
                    (filters.tense === 'all' || p.tense === filters.tense) &&
                    (!filters.coreOnly || p.isCore),
                  )
                  .map((p) => (
                    <PhraseItemCard
                      key={p.id}
                      isZh={isZh}
                      phrase={p}
                      sourceLabel={isZh ? `${activeBrowseSection.shortCn} · ${move.titleCn}` : `${activeBrowseSection.titleEn} · ${move.titleEn}`}
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
          ))}
        </div>
      )}
    </div>
  );
};
