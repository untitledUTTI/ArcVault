import React, { useState } from 'react';
import { ArrowRight, Check, Copy, CornerDownLeft, Search } from 'lucide-react';
import {
  ACADEMIC_STYLE_RULES,
  ACADEMIC_VERBS,
  BRE_US_SPELLING,
  CONFUSED_WORDS,
  CONNECTING_WORDS_MATRIX,
  EVERYDAY_TO_ACADEMIC,
  EVIDENCE_COLLOCATIONS,
  WRITING_NOTES_CARDS,
} from '../../core/phrasebank/data/writingReference';

interface ReferenceToolsTabProps {
  isZh?: boolean;
  hasSelection: boolean;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
}

type RefSubTab = 'style' | 'connectors' | 'confused' | 'evidence' | 'notes';

export const ReferenceToolsTab: React.FC<ReferenceToolsTabProps> = ({
  isZh = true,
  hasSelection,
  readOnly,
  onInsert,
  onCopy,
}) => {
  const [subTab, setSubTab] = useState<RefSubTab>('style');
  const [wordQuery, setWordQuery] = useState('');
  const [verbGroupId, setVerbGroupId] = useState<string>('all');
  const [verbQuery, setVerbQuery] = useState('');

  // Interactive Evidence Collocation Builder state
  const [evMode, setEvMode] = useState<'type' | 'strength' | 'premod' | 'verb'>('strength');
  const [evTypeIdx, setEvTypeIdx] = useState(4); // empirical
  const [evSubjIdx, setEvSubjIdx] = useState(0);
  const [evAdvIdx, setEvAdvIdx] = useState(3); // particularly
  const [evPredStrong, setEvPredStrong] = useState(true);
  const [evPredIdx, setEvPredIdx] = useState(3);
  const [evPreTier, setEvPreTier] = useState<'no' | 'growing' | 'strong'>('growing');
  const [evPreIdx, setEvPreIdx] = useState(1);
  const [evLocIdx, setEvLocIdx] = useState(4);
  const [evVerbIdx, setEvVerbIdx] = useState(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleQuickCopy = (text: string, label: string, key: string) => {
    onCopy(text, label);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1200);
  };

  const assembleEvidenceSentence = (): string => {
    if (evMode === 'type') {
      return `${EVIDENCE_COLLOCATIONS.types[evTypeIdx]} evidence`;
    }
    if (evMode === 'strength') {
      const preds = evPredStrong
        ? EVIDENCE_COLLOCATIONS.strongPredicates
        : EVIDENCE_COLLOCATIONS.weakPredicates;
      const safeIdx = evPredIdx % preds.length;
      return `${EVIDENCE_COLLOCATIONS.subjects[evSubjIdx]} evidence for X is ${EVIDENCE_COLLOCATIONS.adverbs[evAdvIdx]} ${preds[safeIdx]}`;
    }
    if (evMode === 'premod') {
      const list =
        evPreTier === 'no'
          ? EVIDENCE_COLLOCATIONS.premodifiersNo
          : evPreTier === 'growing'
            ? EVIDENCE_COLLOCATIONS.premodifiersGrowing
            : EVIDENCE_COLLOCATIONS.premodifiersStrong;
      const safeIdx = evPreIdx % list.length;
      return `There is ${list[safeIdx]} evidence to suggest that ...`;
    }
    return `The evidence presented ${EVIDENCE_COLLOCATIONS.locations[evLocIdx]} ${EVIDENCE_COLLOCATIONS.verbsWithEvidence[evVerbIdx]}`;
  };

  const evSentence = assembleEvidenceSentence();

  const filteredEveryday = EVERYDAY_TO_ACADEMIC.filter((item) => {
    const q = wordQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.everyday.toLowerCase().includes(q) ||
      item.academic.toLowerCase().includes(q) ||
      item.categoryCn.toLowerCase().includes(q)
    );
  });

  const filteredConfused = CONFUSED_WORDS.filter((item) => {
    const q = wordQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.pair.toLowerCase().includes(q) ||
      item.summaryCn.toLowerCase().includes(q) ||
      item.detailEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="apb-stack">
      <div className="apb-subtab-bar" role="tablist">
        <button
          type="button"
          className={`apb-subtab-btn ${subTab === 'style' ? 'active' : ''}`}
          onClick={() => setSubTab('style')}
        >
          {isZh ? '口语→学术替换 & 风格自查' : 'Formal Lexicon & Style'}
        </button>
        <button
          type="button"
          className={`apb-subtab-btn ${subTab === 'connectors' ? 'active' : ''}`}
          onClick={() => setSubTab('connectors')}
        >
          {isZh ? '连接词语法矩阵' : 'Connectors Matrix'}
        </button>
        <button
          type="button"
          className={`apb-subtab-btn ${subTab === 'confused' ? 'active' : ''}`}
          onClick={() => setSubTab('confused')}
        >
          {isZh ? '易混词 & 英美拼写' : 'Confusables & US/BrE'}
        </button>
        <button
          type="button"
          className={`apb-subtab-btn ${subTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setSubTab('evidence')}
        >
          {isZh ? 'Evidence 搭配 & 学术动词' : 'Evidence & Verbs'}
        </button>
        <button
          type="button"
          className={`apb-subtab-btn ${subTab === 'notes' ? 'active' : ''}`}
          onClick={() => setSubTab('notes')}
        >
          {isZh ? '标点·冠词·句段·流程' : 'Mechanics & Process'}
        </button>
      </div>

      {subTab === 'style' && (
        <>
          <div className="apb-ref-card">
            <div className="apb-ref-head">
              <div>
                <h3 className="apb-ref-title">
                  {isZh ? '口语词 → 正式学术词汇替换器' : 'Colloquial → Formal Academic Lexicon'}
                </h3>
                <div className="apb-hint-text">
                  {isZh
                    ? `点击任意学术替换词即可一键复制，点击右侧按钮可直接${hasSelection ? '替换选中文本' : '插入光标处'}（含原书 pp.135–136 词汇与高频扩展）`
                    : `Click any formal term to copy, or use the arrow to ${hasSelection ? 'replace selection' : 'insert at cursor'}.`}
                </div>
              </div>
              <div className="apb-search-wrap" style={{ minWidth: 185, maxWidth: 220 }}>
                <Search size={12.5} className="apb-search-icon" />
                <input
                  type="text"
                  className="arc-input apb-search-input"
                  style={{ height: 28, fontSize: 12 }}
                  placeholder={isZh ? '过滤口语词或学术词...' : 'Filter everyday or formal...'}
                  value={wordQuery}
                  onChange={(e) => setWordQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="apb-matrix-table-wrap">
              <table className="apb-matrix-table">
                <thead>
                  <tr>
                    <th>{isZh ? '日常口语表达' : 'Everyday'}</th>
                    <th></th>
                    <th>{isZh ? '正式学术替换' : 'Academic'}</th>
                    <th>{isZh ? '来源 / 用法提示' : 'Category / Note'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEveryday.map((row, idx) => {
                    const primaryTerm = row.academic.split('/')[0].trim();
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-secondary)' }}>{row.everyday}</td>
                        <td style={{ width: 24, color: 'var(--text-muted)' }}>
                          <ArrowRight size={12} />
                        </td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="apb-word-pill"
                              onClick={() => handleQuickCopy(row.academic, isZh ? '口语→学术替换' : 'Formal Lexicon', `ev-${idx}`)}
                              data-arc-tooltip={isZh ? '点击复制' : 'Click to copy'}
                            >
                              <strong>{row.academic}</strong>{' '}
                              {copiedKey === `ev-${idx}` && <Check size={11} style={{ verticalAlign: 'middle' }} />}
                            </button>
                            {!readOnly && (
                              <button
                                type="button"
                                className="apb-inline-insert-btn"
                                onClick={() => onInsert(primaryTerm, isZh ? '口语→学术替换' : 'Formal Lexicon')}
                                data-arc-tooltip={
                                  hasSelection
                                    ? isZh
                                      ? `替换为 ${primaryTerm}`
                                      : `Replace with ${primaryTerm}`
                                    : isZh
                                      ? `插入 ${primaryTerm}`
                                      : `Insert ${primaryTerm}`
                                }
                              >
                                <CornerDownLeft size={10.5} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {row.categoryCn}
                          {row.noteCn ? ` · ${row.noteCn}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="apb-ref-card">
            <h3 className="apb-ref-title" style={{ marginBottom: 10 }}>
              {isZh ? '学术写作风格 8 项核心准则 & 句型复用边界' : '8 Core Academic Style Rules'}
            </h3>
            <div className="apb-grid-cards">
              {ACADEMIC_STYLE_RULES.map((rule) => (
                <div key={rule.id} className="apb-sub-card">
                  <div className="apb-sub-card-title">{rule.titleCn}</div>
                  <p className="apb-sub-card-body">{rule.explanationCn}</p>
                  {rule.badExample && <div className="apb-bad-ex">✗ {rule.badExample}</div>}
                  {rule.goodExample && <div className="apb-good-ex">✓ {rule.goodExample}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {subTab === 'connectors' && (
        <div className="apb-ref-card">
          <h3 className="apb-ref-title" style={{ marginBottom: 4 }}>
            {isZh ? '连接词三大句法位置矩阵（Connecting Words）' : 'Connecting Words Syntactic Matrix'}
          </h3>
          <p className="apb-hint-text" style={{ marginBottom: 10 }}>
            {isZh ? (
              <>
                切忌混用三类连接词的句法位置：① <strong>跨句连接词</strong>（句首加逗号，或分号+词+逗号）；②{' '}
                <strong>介词性短语</strong>（后直接跟名词/动名词短语）；③ <strong>从属连词</strong>
                （单句内连接主句与从句，不可单独成句）。点击任意词即可复制，双击或点箭头可插入。
              </>
            ) : (
              <>
                Keep syntactic roles distinct: (1) <strong>Sentence connectors</strong> (comma or semicolon); (2){' '}
                <strong>Prepositional phrases</strong> (+ NP/gerund); (3) <strong>Subordinators</strong>{' '}
                (join clauses within one sentence). Click to copy, double-click to insert.
              </>
            )}
          </p>
          <div className="apb-matrix-table-wrap">
            <table className="apb-matrix-table">
              <thead>
                <tr>
                  <th>{isZh ? '逻辑关系' : 'Relation'}</th>
                  <th>{isZh ? '① 跨两个句子（加标点停顿）' : '1. Across Sentences'}</th>
                  <th>{isZh ? '② 后接名词短语（+ NP）' : '2. Before Noun Phrase'}</th>
                  <th>{isZh ? '③ 句内从属连词（两分句）' : '3. Subordinators'}</th>
                </tr>
              </thead>
              <tbody>
                {CONNECTING_WORDS_MATRIX.map((row) => (
                  <tr key={row.relationEn}>
                    <td>
                      <strong>{isZh ? row.relationCn : row.relationEn}</strong>
                      {isZh && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.relationEn}</div>}
                    </td>
                    <td>
                      {row.acrossSentences.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className="apb-word-pill"
                          onClick={() => handleQuickCopy(w, isZh ? '连接词矩阵' : 'Connectors', `conn-a-${w}`)}
                          onDoubleClick={() => !readOnly && onInsert(w, isZh ? '连接词矩阵' : 'Connectors')}
                          data-arc-tooltip={readOnly ? (isZh ? '单击复制' : 'Click to copy') : isZh ? '单击复制 · 双击插入光标' : 'Click to copy · Double-click to insert'}
                        >
                          {w}
                          {copiedKey === `conn-a-${w}` && <Check size={10} style={{ marginLeft: 3 }} />}
                        </button>
                      ))}
                      {row.exampleAcross && (
                        <div className="apb-matrix-example">{isZh ? '例：' : 'Ex: '}{row.exampleAcross}</div>
                      )}
                    </td>
                    <td>
                      {row.beforeNounPhrase.length > 0 ? (
                        row.beforeNounPhrase.map((w) => (
                          <button
                            key={w}
                            type="button"
                            className="apb-word-pill"
                            onClick={() => handleQuickCopy(w, isZh ? '连接词矩阵' : 'Connectors', `conn-n-${w}`)}
                            onDoubleClick={() => !readOnly && onInsert(w, isZh ? '连接词矩阵' : 'Connectors')}
                            data-arc-tooltip={readOnly ? (isZh ? '单击复制' : 'Click to copy') : isZh ? '单击复制 · 双击插入光标' : 'Click to copy · Double-click to insert'}
                          >
                            {w}
                            {copiedKey === `conn-n-${w}` && <Check size={10} style={{ marginLeft: 3 }} />}
                          </button>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                      {row.exampleNounPhrase && (
                        <div className="apb-matrix-example">{isZh ? '例：' : 'Ex: '}{row.exampleNounPhrase}</div>
                      )}
                    </td>
                    <td>
                      {row.subordinators.length > 0 ? (
                        row.subordinators.map((w) => (
                          <button
                            key={w}
                            type="button"
                            className="apb-word-pill"
                            onClick={() => handleQuickCopy(w, isZh ? '连接词矩阵' : 'Connectors', `conn-s-${w}`)}
                            onDoubleClick={() => !readOnly && onInsert(w, isZh ? '连接词矩阵' : 'Connectors')}
                            data-arc-tooltip={readOnly ? (isZh ? '单击复制' : 'Click to copy') : isZh ? '单击复制 · 双击插入光标' : 'Click to copy · Double-click to insert'}
                          >
                            {w}
                            {copiedKey === `conn-s-${w}` && <Check size={10} style={{ marginLeft: 3 }} />}
                          </button>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                      {row.exampleSubordinator && (
                        <div className="apb-matrix-example">{isZh ? '例：' : 'Ex: '}{row.exampleSubordinator}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'confused' && (
        <>
          <div className="apb-ref-card">
            <div className="apb-ref-head">
              <div>
                <h3 className="apb-ref-title">
                  {isZh ? '14 组高频易混词速查（拼写没错但语义易错）' : '14 Commonly Confused Academic Word Pairs'}
                </h3>
                <div className="apb-hint-text">
                  {isZh
                    ? 'Word / LaTeX 拼写检查器抓不出这些词误用，投稿前务必自查。'
                    : 'Spell-checkers will not catch these semantic mix-ups; review before submission.'}
                </div>
              </div>
              <input
                type="text"
                className="arc-input"
                style={{ maxWidth: 210, height: 28, fontSize: 12 }}
                placeholder={isZh ? '搜索易混词...' : 'Search confusables...'}
                value={wordQuery}
                onChange={(e) => setWordQuery(e.target.value)}
              />
            </div>

            <div className="apb-grid-cards">
              {filteredConfused.map((cw) => (
                <div key={cw.id} className="apb-sub-card">
                  <div className="apb-confused-pair">{cw.pair}</div>
                  {isZh && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{cw.summaryCn}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {cw.detailEn}
                  </div>
                  <div className="apb-confused-ex">{isZh ? '例：' : 'Ex: '}{cw.example}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="apb-ref-card">
            <h3 className="apb-ref-title" style={{ marginBottom: 4 }}>
              {isZh ? '英式 (BrE) vs. 美式 (US) 拼写对照表' : 'British (BrE) vs. American (US) Spelling'}
            </h3>
            <p className="apb-hint-text" style={{ marginBottom: 8 }}>
              {isZh ? (
                <>
                  本工具全部主库句型已统一为<strong>美式英语（US）</strong>。若投稿英系期刊或英联邦高校学位论文，可参考下表反向切换，并保持全文一致。
                </>
              ) : (
                <>
                  All core phrases default to <strong>US English</strong>. Use this table if submitting to UK/Commonwealth venues and stay consistent throughout.
                </>
              )}
            </p>
            <ul className="apb-rules-list" style={{ marginBottom: 10 }}>
              {BRE_US_SPELLING.patterns.map((p, i) => (
                <li key={i}>
                  <strong>{p.ruleCn}</strong>: {p.examples}
                </li>
              ))}
            </ul>
            <div className="apb-matrix-table-wrap">
              <table className="apb-matrix-table">
                <thead>
                  <tr>
                    <th>British (BrE)</th>
                    <th>{isZh ? 'US (本工具默认)' : 'US (Default)'}</th>
                    <th>British (BrE)</th>
                    <th>{isZh ? 'US (本工具默认)' : 'US (Default)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.ceil(BRE_US_SPELLING.pairs.length / 2) }).map((_, rowIdx) => {
                    const left = BRE_US_SPELLING.pairs[rowIdx * 2];
                    const right = BRE_US_SPELLING.pairs[rowIdx * 2 + 1];
                    return (
                      <tr key={rowIdx}>
                        <td>{left.british}</td>
                        <td>
                          <button
                            type="button"
                            className="apb-word-pill"
                            onClick={() => handleQuickCopy(left.us, isZh ? '美式拼写' : 'US Spelling', `sp-l-${rowIdx}`)}
                          >
                            <strong>{left.us}</strong>
                          </button>
                        </td>
                        <td>{right ? right.british : ''}</td>
                        <td>
                          {right ? (
                            <button
                              type="button"
                              className="apb-word-pill"
                              onClick={() => handleQuickCopy(right.us, isZh ? '美式拼写' : 'US Spelling', `sp-r-${rowIdx}`)}
                            >
                              <strong>{right.us}</strong>
                            </button>
                          ) : (
                            ''
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {subTab === 'evidence' && (
        <>
          <div className="apb-builder-card">
            <div className="apb-builder-header">
              <span className="apb-builder-title">
                {isZh ? '交互式 Evidence（证据）高频搭配拼装台' : 'Interactive Evidence Collocation Builder'}
              </span>
            </div>
            <p className="apb-builder-desc">
              {isZh
                ? 'evidence 为不可数名词（不可加 an / evidences）。选择搭配维度，一键复制或直接插入正文。'
                : '"Evidence" is uncountable (never "an evidence" or "evidences"). Pick a dimension below to copy or insert.'}
            </p>

            <div className="apb-filter-row" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`apb-filter-chip ${evMode === 'strength' ? 'active' : ''}`}
                onClick={() => setEvMode('strength')}
              >
                {isZh ? '评价现有证据强弱' : 'Evaluate Strength'}
              </button>
              <button
                type="button"
                className={`apb-filter-chip ${evMode === 'premod' ? 'active' : ''}`}
                onClick={() => setEvMode('premod')}
              >
                {isZh ? 'There is + 证据量' : 'There is + Amount'}
              </button>
              <button
                type="button"
                className={`apb-filter-chip ${evMode === 'verb' ? 'active' : ''}`}
                onClick={() => setEvMode('verb')}
              >
                {isZh ? '本文所呈证据 + 动词' : 'Presented Evidence + Verb'}
              </button>
              <button
                type="button"
                className={`apb-filter-chip ${evMode === 'type' ? 'active' : ''}`}
                onClick={() => setEvMode('type')}
              >
                {isZh ? '证据类型修饰词' : 'Evidence Types'}
              </button>
            </div>

            {evMode === 'type' && (
              <div className="apb-builder-options" style={{ marginBottom: 8 }}>
                {EVIDENCE_COLLOCATIONS.types.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    className={`apb-builder-opt ${evTypeIdx === i ? 'is-selected' : ''}`}
                    onClick={() => setEvTypeIdx(i)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {evMode === 'strength' && (
              <div className="apb-builder-columns">
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '定语' : 'Modifier'}</span>
                  <div className="apb-builder-options">
                    {EVIDENCE_COLLOCATIONS.subjects.map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        className={`apb-builder-opt ${evSubjIdx === i ? 'is-selected' : ''}`}
                        onClick={() => setEvSubjIdx(i)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '程度副词' : 'Adverb'}</span>
                  <div className="apb-builder-options">
                    {EVIDENCE_COLLOCATIONS.adverbs.map((a, i) => (
                      <button
                        key={a}
                        type="button"
                        className={`apb-builder-opt ${evAdvIdx === i ? 'is-selected' : ''}`}
                        onClick={() => setEvAdvIdx(i)}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '强/弱表语' : 'Predicate'}</span>
                  <div className="apb-builder-options" style={{ marginBottom: 4 }}>
                    <button
                      type="button"
                      className={`apb-filter-chip ${evPredStrong ? 'active' : ''}`}
                      onClick={() => setEvPredStrong(true)}
                    >
                      {isZh ? '强有力' : 'Strong'}
                    </button>
                    <button
                      type="button"
                      className={`apb-filter-chip ${!evPredStrong ? 'active' : ''}`}
                      onClick={() => setEvPredStrong(false)}
                    >
                      {isZh ? '薄弱/存疑' : 'Weak'}
                    </button>
                  </div>
                  <div className="apb-builder-options">
                    {(evPredStrong
                      ? EVIDENCE_COLLOCATIONS.strongPredicates
                      : EVIDENCE_COLLOCATIONS.weakPredicates
                    ).map((p, i) => (
                      <button
                        key={p}
                        type="button"
                        className={`apb-builder-opt ${evPredIdx % 6 === i ? 'is-selected' : ''}`}
                        onClick={() => setEvPredIdx(i)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {evMode === 'premod' && (
              <div className="apb-builder-columns">
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '证据充足度层级' : 'Sufficiency Tier'}</span>
                  <div className="apb-builder-options">
                    <button
                      type="button"
                      className={`apb-filter-chip ${evPreTier === 'no' ? 'active' : ''}`}
                      onClick={() => setEvPreTier('no')}
                    >
                      {isZh ? '匮乏/不足' : 'Scarce'}
                    </button>
                    <button
                      type="button"
                      className={`apb-filter-chip ${evPreTier === 'growing' ? 'active' : ''}`}
                      onClick={() => setEvPreTier('growing')}
                    >
                      {isZh ? '逐步积累' : 'Growing'}
                    </button>
                    <button
                      type="button"
                      className={`apb-filter-chip ${evPreTier === 'strong' ? 'active' : ''}`}
                      onClick={() => setEvPreTier('strong')}
                    >
                      {isZh ? '充分扎实' : 'Strong'}
                    </button>
                  </div>
                </div>
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '前修饰词' : 'Premodifier'}</span>
                  <div className="apb-builder-options">
                    {(evPreTier === 'no'
                      ? EVIDENCE_COLLOCATIONS.premodifiersNo
                      : evPreTier === 'growing'
                        ? EVIDENCE_COLLOCATIONS.premodifiersGrowing
                        : EVIDENCE_COLLOCATIONS.premodifiersStrong
                    ).map((w, i) => (
                      <button
                        key={w}
                        type="button"
                        className={`apb-builder-opt ${evPreIdx === i ? 'is-selected' : ''}`}
                        onClick={() => setEvPreIdx(i)}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {evMode === 'verb' && (
              <div className="apb-builder-columns">
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '位置限定' : 'Location'}</span>
                  <div className="apb-builder-options">
                    {EVIDENCE_COLLOCATIONS.locations.map((loc, i) => (
                      <button
                        key={loc}
                        type="button"
                        className={`apb-builder-opt ${evLocIdx === i ? 'is-selected' : ''}`}
                        onClick={() => setEvLocIdx(i)}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="apb-builder-col">
                  <span className="apb-builder-col-label">{isZh ? '搭配动词' : 'Verb'}</span>
                  <div className="apb-builder-options">
                    {EVIDENCE_COLLOCATIONS.verbsWithEvidence.map((v, i) => (
                      <button
                        key={v}
                        type="button"
                        className={`apb-builder-opt ${evVerbIdx === i ? 'is-selected' : ''}`}
                        onClick={() => setEvVerbIdx(i)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="apb-builder-preview-box">
              <div className="apb-builder-preview-text">{evSentence}</div>
              <div className="apb-phrase-actions">
                <button
                  type="button"
                  className="arc-btn arc-btn-primary apb-mini-btn"
                  disabled={readOnly}
                  onClick={() => onInsert(evSentence, isZh ? 'Evidence 搭配' : 'Evidence Collocation')}
                >
                  <CornerDownLeft size={11.5} />
                  <span>{hasSelection ? (isZh ? '替换选中' : 'Replace') : isZh ? '插入搭配句' : 'Insert'}</span>
                </button>
                <button
                  type="button"
                  className="arc-btn apb-mini-btn"
                  onClick={() => handleQuickCopy(evSentence, isZh ? 'Evidence 搭配' : 'Evidence Collocation', 'ev-built')}
                >
                  {copiedKey === 'ev-built' ? <Check size={11.5} /> : <Copy size={11.5} />}
                  <span>{copiedKey === 'ev-built' ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="apb-ref-card">
            <div className="apb-ref-head">
              <div>
                <h3 className="apb-ref-title">
                  {isZh ? '常用学术动词分类词库（全美式拼写）' : 'Academic Verbs Lexicon (US Spelling)'}
                </h3>
                <div className="apb-hint-text">
                  {isZh
                    ? '单击复制动词，双击直接插入光标处，告别重复使用 show / do / make。'
                    : 'Click to copy, double-click to insert at cursor. Avoid overusing show / do / make.'}
                </div>
              </div>
              <input
                type="text"
                className="arc-input"
                style={{ maxWidth: 205, height: 28, fontSize: 12 }}
                placeholder={isZh ? '筛选动词（如 eval / synth）...' : 'Filter verbs (e.g. eval / synth)...'}
                value={verbQuery}
                onChange={(e) => setVerbQuery(e.target.value)}
              />
            </div>

            <div className="apb-filter-row" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`apb-filter-chip ${verbGroupId === 'all' ? 'active' : ''}`}
                onClick={() => setVerbGroupId('all')}
              >
                {isZh ? '全部分类' : 'All Categories'}
              </button>
              {ACADEMIC_VERBS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`apb-filter-chip ${verbGroupId === g.id ? 'active' : ''}`}
                  onClick={() => setVerbGroupId(g.id)}
                >
                  {g.labelCn.split('（')[0]}
                </button>
              ))}
            </div>

            <div className="apb-stack">
              {ACADEMIC_VERBS.filter((g) => verbGroupId === 'all' || g.id === verbGroupId).map(
                (group) => {
                  const q = verbQuery.trim().toLowerCase();
                  const filtered = q
                    ? group.verbs.filter((v) => v.toLowerCase().includes(q))
                    : group.verbs;
                  if (filtered.length === 0) return null;
                  return (
                    <div key={group.id}>
                      <div className="apb-verb-group-title">
                        {group.labelCn} ({filtered.length})
                      </div>
                      <div>
                        {filtered.map((verb) => (
                          <button
                            key={verb}
                            type="button"
                            className="apb-word-pill"
                            onClick={() => handleQuickCopy(verb, isZh ? '学术动词库' : 'Academic Verbs', `v-${verb}`)}
                            onDoubleClick={() => !readOnly && onInsert(verb, isZh ? '学术动词库' : 'Academic Verbs')}
                            data-arc-tooltip={readOnly ? (isZh ? '单击复制' : 'Click to copy') : isZh ? '单击复制 · 双击插入光标' : 'Click to copy · Double-click to insert'}
                          >
                            {verb}
                            {copiedKey === `v-${verb}` && (
                              <Check size={10} style={{ marginLeft: 3 }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </>
      )}

      {subTab === 'notes' && (
        <div className="apb-stack">
          {WRITING_NOTES_CARDS.map((card) => (
            <div key={card.id} className="apb-ref-card">
              <div className="apb-ref-head" style={{ marginBottom: 8 }}>
                <h3 className="apb-ref-title">{isZh ? card.titleCn : card.titleEn}</h3>
                {isZh && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.titleEn}</span>}
              </div>
              <div className="apb-grid-cards">
                {card.bullets.map((b, i) => (
                  <div key={i} className="apb-sub-card">
                    <div className="apb-sub-card-title">{b.headingCn}</div>
                    <div className="apb-sub-card-body">{b.detailCn}</div>
                    {b.exampleEn && <div className="apb-note-ex">{b.exampleEn}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
