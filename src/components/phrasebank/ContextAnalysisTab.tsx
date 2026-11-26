import React, { useState } from 'react';
import {
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { analyzeContextAndSuggest } from '../../core/phrasebank/academicAnalyzer';
import type { ContextAdviceItem, DetectedPaperSection } from '../../core/phrasebank/types';
import type { AiPrivacyPolicy, AppSettings } from '../../types/archive';
import type { EditorSelectionInfo } from '../DocumentEditor';

interface ContextAnalysisTabProps {
  docText: string;
  selectionInfo: EditorSelectionInfo | null;
  currentSection: DetectedPaperSection | null;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  readOnly: boolean;
  onInsert: (text: string, sourceLabel: string) => void;
  onReplaceRange: (from: number, to: number, text: string, label?: string) => void;
  onCopy: (text: string, sourceLabel: string) => void;
}

const CATEGORY_LABEL: Record<ContextAdviceItem['category'], { zh: string; en: string }> = {
  'academic-tone': { zh: '学术语体升级', en: 'Academic Tone' },
  'logic-cohesion': { zh: '逻辑与衔接', en: 'Logic & Cohesion' },
  'clarity-conciseness': { zh: '清晰与紧凑度', en: 'Clarity & Conciseness' },
  'section-structure': { zh: '章节修辞结构', en: 'Section Structure' },
  'phrase-upgrade': { zh: '句型替换建议', en: 'Phrase Upgrade' },
};

export const ContextAnalysisTab: React.FC<ContextAnalysisTabProps> = ({
  docText,
  selectionInfo,
  currentSection,
  settings,
  effectiveAiPolicy,
  readOnly,
  onInsert,
  onReplaceRange,
  onCopy,
}) => {
  const isZh = settings.locale === 'zh-CN';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    source: 'cloud' | 'ollama' | 'offline-smart';
    summary: string;
    advice: ContextAdviceItem[];
    appliedSkillNames: string[];
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const hasSelection = Boolean(selectionInfo && selectionInfo.selectedText.trim().length > 0);
  const previewSlice = (
    hasSelection
      ? selectionInfo!.selectedText
      : selectionInfo?.currentParagraph || docText.slice(0, 600)
  ).trim();

  const handleRunAnalysis = async () => {
    if (!previewSlice) return;
    setBusy(true);
    try {
      const res = await analyzeContextAndSuggest({
        fullText: docText,
        selectionText: selectionInfo?.selectedText ?? '',
        selectionStart: selectionInfo?.from ?? 0,
        selectionEnd: selectionInfo?.to ?? 0,
        paragraphText: selectionInfo?.currentParagraph || docText.slice(0, 600),
        paragraphStart: selectionInfo?.paragraphStart ?? 0,
        paragraphEnd: selectionInfo?.paragraphEnd ?? Math.min(docText.length, 600),
        currentSection,
        settings,
        policy: effectiveAiPolicy,
      });
      setResult(res);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    onCopy(text, isZh ? '上下文修改建议' : 'Context Advice');
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1200);
  };

  return (
    <div className="apb-stack">
      <div className="apb-ref-card">
        <div className="apb-section-header" style={{ marginBottom: 8 }}>
          <div className="apb-section-title">
            <Sparkles size={13.5} color="var(--accent)" />
            <span>
              {isZh
                ? `待分析上下文（${hasSelection ? '选中文本' : '当前段落'}）`
                : `Context to Analyze (${hasSelection ? 'Selection' : 'Current Paragraph'})`}
            </span>
          </div>
          <span className="apb-pill-badge">
            <ShieldCheck size={11} />
            <span>
              {effectiveAiPolicy === 'disabled'
                ? isZh
                  ? '仅离线规则'
                  : 'Offline Rules Only'
                : settings.aiProvider === 'offline-smart'
                  ? isZh
                    ? '离线智能引擎'
                    : 'Offline Heuristic'
                  : settings.aiProvider === 'ollama'
                    ? isZh
                      ? '本地 Ollama'
                      : 'Local Ollama'
                    : isZh
                      ? '云端 + 离线兜底'
                      : 'Cloud + Offline Fallback'}
            </span>
          </span>
        </div>

        <div className="apb-context-preview">
          {previewSlice
            ? previewSlice.slice(0, 320) + (previewSlice.length > 320 ? '…' : '')
            : isZh
              ? '当前段落为空，请在编辑器中输入或选中需要润色的论文段落。'
              : 'Current paragraph is empty. Type or select text in the editor to analyze.'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="apb-hint-text">
              {isZh ? '章节语境：' : 'Section: '}
              {currentSection ? currentSection.mappedSectionLabel : isZh ? '通用学术正文' : 'General Academic'}
            </span>
            {(settings.phrasebank?.preferPhrasebankForAi ?? true) && (
              <span className="apb-pill-badge is-accent">
                {isZh ? 'Phrasebank 降AI优先' : 'Phrasebank De-AI Priority'}
              </span>
            )}
          </div>
          <button
            type="button"
            className="arc-btn arc-btn-primary apb-mini-btn"
            disabled={busy || !previewSlice}
            onClick={handleRunAnalysis}
          >
            {busy ? <Loader2 size={12} className="arc-spin" /> : <Wand2 size={12} />}
            <span>{busy ? (isZh ? '分析中...' : 'Analyzing...') : isZh ? '开始上下文分析与建议' : 'Analyze Context'}</span>
          </button>
        </div>
      </div>

      {result && (
        <div className="apb-stack">
          <div className="apb-summary-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 12.5 }}>{isZh ? '诊断结论' : 'Diagnosis Summary'}</strong>
              <span className="apb-pill-badge is-accent">
                {result.source === 'offline-smart'
                  ? isZh
                    ? '本地规则诊断'
                    : 'Local Rules'
                  : result.source === 'ollama'
                    ? isZh
                      ? '本地 Ollama'
                      : 'Local Ollama'
                    : isZh
                      ? 'AI 深度润色'
                      : 'AI Polish'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.summary}</div>
            {result.appliedSkillNames.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {isZh ? '已执行 Skills：' : 'Applied Skills: '}{result.appliedSkillNames.join(', ')}
              </div>
            )}
          </div>

          {result.advice.map((item) => (
            <div key={item.id} className="apb-advice-card">
              <div className="apb-advice-head">
                <span className="apb-tag apb-tag-core">
                  {isZh ? CATEGORY_LABEL[item.category].zh : CATEGORY_LABEL[item.category].en}
                </span>
                <strong style={{ fontSize: 12.5 }}>{item.title}</strong>
              </div>
              <p className="apb-advice-rationale">{item.rationale}</p>

              {item.suggestedRewrite && (
                <div className="apb-rewrite-box">
                  <div className="apb-rewrite-label">{isZh ? '建议改写结果：' : 'Suggested Rewrite:'}</div>
                  <div className="apb-rewrite-text">{item.suggestedRewrite}</div>
                  <div className="apb-phrase-actions" style={{ marginTop: 6 }}>
                    {typeof item.startOffset === 'number' && typeof item.endOffset === 'number' && (
                      <button
                        type="button"
                        className="arc-btn arc-btn-primary apb-mini-btn"
                        disabled={readOnly}
                        onClick={() =>
                          onReplaceRange(
                            item.startOffset!,
                            item.endOffset!,
                            item.suggestedRewrite!,
                            isZh ? '应用上下文改写建议' : 'Applied context rewrite',
                          )
                        }
                      >
                        <CornerDownLeft size={11.5} />
                        <span>{isZh ? '一键替换原文' : 'Replace Original'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="arc-btn apb-mini-btn"
                      disabled={readOnly}
                      onClick={() => onInsert(item.suggestedRewrite!, isZh ? '上下文改写建议' : 'Context Rewrite')}
                    >
                      <span>{isZh ? '插入光标' : 'Insert'}</span>
                    </button>
                    <button
                      type="button"
                      className="arc-btn apb-mini-btn"
                      onClick={() => handleCopyText(item.suggestedRewrite!, item.id)}
                    >
                      {copiedKey === item.id ? <Check size={11.5} /> : <Copy size={11.5} />}
                      <span>{copiedKey === item.id ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {item.recommendedPhrases && item.recommendedPhrases.length > 0 && (
                <div className="apb-rec-phrases">
                  <div className="apb-rewrite-label">
                    {isZh ? '推荐衔接/学术句型（点击插入或复制）：' : 'Recommended Transitions / Phrases:'}
                  </div>
                  {item.recommendedPhrases.map((p, idx) => (
                    <div key={idx} className="apb-rec-phrase-row">
                      <span className="apb-rec-phrase-en">{p}</span>
                      <div className="apb-phrase-actions">
                        <button
                          type="button"
                          className="arc-btn arc-btn-primary apb-mini-btn"
                          disabled={readOnly}
                          onClick={() => onInsert(p, isZh ? '上下文推荐句型' : 'Context Phrase')}
                        >
                          <CornerDownLeft size={11} />
                          <span>{isZh ? '插入' : 'Insert'}</span>
                        </button>
                        <button
                          type="button"
                          className="arc-btn apb-mini-btn"
                          onClick={() => handleCopyText(p, `${item.id}-${idx}`)}
                        >
                          {copiedKey === `${item.id}-${idx}` ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
