import React, { useMemo, useState } from 'react';
import {
  Stethoscope,
  FileCheck2,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  Copy,
  Download,
  Check,
  X,
} from 'lucide-react';
import { runConsistencyCheck, runAiDeepConsistencyCheck } from '../core/consistencyChecker';
import { generateRebuttalWithAi } from '../core/rebuttalGenerator';
import { AiPrivacyBlockedError } from '../core/aiGateway';
import { getEnabledSkills } from '../core/skillRegistry';
import { triggerBrowserDownload } from '../platform/bridge';
import type {
  AiPrivacyPolicy,
  AppSettings,
  ArchiveDocument,
  Snapshot,
} from '../types/archive';
import type { CasObjectStore } from '../core/casStore';

interface PaperStudioModalProps {
  initialTab?: 'consistency' | 'rebuttal';
  doc: ArchiveDocument;
  snapshots: Snapshot[];
  cas: CasObjectStore;
  settings: AppSettings;
  effectiveAiPolicy: AiPrivacyPolicy;
  onApplyQuickFix: (snippet: string, replacement: string) => void;
  onClose: () => void;
}

export const PaperStudioModal: React.FC<PaperStudioModalProps> = ({
  initialTab = 'consistency',
  doc,
  snapshots,
  cas,
  settings,
  effectiveAiPolicy,
  onApplyQuickFix,
  onClose,
}) => {
  const isZh = settings.locale === 'zh-CN';
  const [tab, setTab] = useState<'consistency' | 'rebuttal'>(initialTab);
  const [aiDeepReport, setAiDeepReport] = useState<string | null>(null);
  const [aiDeepLoading, setAiDeepLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [baselineSnapId, setBaselineSnapId] = useState<string>(snapshots[0]?.id ?? '');
  const [reviewerComments, setReviewerComments] = useState(
    isZh
      ? '1. 请核实摘要、实验表与结论章节中的核心准确率数值口径是否完全统一。\n2. 建议补充与传统整文件同步基线在存储压缩率及增量计算开销方面的定量对比。'
      : '1. Please verify that the accuracy figures reported in the abstract, results table, and conclusion are consistent.\n2. Please add a quantitative comparison against full-file sync baselines on storage compression and incremental overhead.',
  );
  const [rebuttalLang, setRebuttalLang] = useState<'zh' | 'en'>(isZh ? 'zh' : 'en');
  const [rebuttalDraft, setRebuttalDraft] = useState('');
  const [rebuttalSkills, setRebuttalSkills] = useState<string[]>([]);
  const [rebuttalLoading, setRebuttalLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const armedSkills = useMemo(() => getEnabledSkills(settings.skills), [settings.skills]);

  const issues = useMemo(
    () => runConsistencyCheck(doc.markdownText, doc.citationsSidecar),
    [doc.markdownText, doc.citationsSidecar],
  );

  const handleRunDeepCheck = async () => {
    setAiDeepLoading(true);
    setAiError(null);
    try {
      const res = await runAiDeepConsistencyCheck({
        text: doc.markdownText,
        ruleIssues: issues,
        settings,
        policy: effectiveAiPolicy,
      });
      const skillNote =
        res.appliedSkillNames.length > 0
          ? ` | Skills: ${res.appliedSkillNames.join(', ')}`
          : '';
      setAiDeepReport(`[${res.source}${skillNote}] ${res.report}`);
    } catch (err) {
      setAiError(err instanceof AiPrivacyBlockedError ? err.message : String(err));
    } finally {
      setAiDeepLoading(false);
    }
  };

  const handleGenerateRebuttal = async () => {
    setRebuttalLoading(true);
    setAiError(null);
    try {
      const snap = snapshots.find((s) => s.id === baselineSnapId);
      const baselineText = snap ? (cas.getText(snap.markdownHash) ?? '') : '';
      const res = await generateRebuttalWithAi({
        baselineText,
        revisedText: doc.markdownText,
        reviewerComments,
        language: rebuttalLang,
        settings,
        policy: effectiveAiPolicy,
      });
      setRebuttalDraft(res.draft);
      setRebuttalSkills(res.appliedSkillNames);
    } catch (err) {
      setAiError(err instanceof AiPrivacyBlockedError ? err.message : String(err));
    } finally {
      setRebuttalLoading(false);
    }
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" data-tour="paper-studio-modal" style={{ width: 'min(960px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="arc-segmented">
              <button className={tab === 'consistency' ? 'active' : ''} onClick={() => setTab('consistency')}>
                <Stethoscope size={13} style={{ marginRight: 5 }} />
                {isZh ? `前后一致性体检官 (${issues.length})` : `Consistency Check (${issues.length})`}
              </button>
              <button className={tab === 'rebuttal' ? 'active' : ''} onClick={() => setTab('rebuttal')}>
                <FileCheck2 size={13} style={{ marginRight: 5 }} />
                {isZh ? '返修说明 Rebuttal 生成器' : 'Rebuttal Generator'}
              </button>
            </div>
            <span className="arc-badge">{isZh ? '隐私策略：' : 'Privacy: '}{effectiveAiPolicy}</span>
            {armedSkills.length > 0 && (
              <span
                className="arc-badge"
                title={armedSkills.map((s) => s.name).join(' · ')}
              >
                {isZh ? `已启用 ${armedSkills.length} 个 Skill` : `${armedSkills.length} Skill(s) Active`}
              </span>
            )}
          </div>
          <button className="arc-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body">
          {aiError && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                background: 'rgba(220,38,38,0.12)',
                color: '#dc2626',
                fontSize: 12.5,
                marginBottom: 12,
              }}
            >
              {aiError}
            </div>
          )}

          {tab === 'consistency' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {isZh
                    ? '自动扫描跨章节指标冲突、悬空图表引用、脚注断链、公式定界符及 Zotero 引文完整性。'
                    : 'Scans cross-section metric conflicts, dangling figure/table refs, footnotes, LaTeX math, and Zotero citations.'}
                </span>
                <button
                  className="arc-btn arc-btn-primary"
                  disabled={aiDeepLoading}
                  onClick={handleRunDeepCheck}
                >
                  <Sparkles size={14} />
                  <span>{aiDeepLoading ? (isZh ? 'AI 复核中...' : 'Checking...') : isZh ? '启动 AI 深度语义复核' : 'Run AI Deep Check'}</span>
                </button>
              </div>

              {aiDeepReport && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent)',
                    fontSize: 12.5,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>{isZh ? 'AI 深度复核结论：' : 'AI Deep Check Summary: '}</strong>
                  {aiDeepReport}
                </div>
              )}

              {issues.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                  {isZh
                    ? '太棒了！当前文稿未发现跨章节数值不一致或引用断链问题。'
                    : 'Great! No cross-section inconsistencies or broken references found.'}
                </div>
              ) : (
                issues.map((issue) => (
                  <div
                    key={issue.id}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                        {issue.severity === 'error' ? (
                          <AlertCircle size={15} color="#dc2626" />
                        ) : issue.severity === 'warning' ? (
                          <AlertTriangle size={15} color="#d97706" />
                        ) : (
                          <Info size={15} color="#2563eb" />
                        )}
                        {issue.title}
                      </span>
                      <span className="arc-badge">{issue.category}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {issue.detail}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <code style={{ fontSize: 11.5, background: 'var(--bg-subtle)', padding: '3px 7px', borderRadius: 5 }}>
                        {isZh ? '片段：' : 'Snippet: '}{issue.snippet}
                      </code>
                      {issue.suggestedFix && (
                        <button
                          className="arc-btn arc-btn-primary"
                          style={{ height: 26, fontSize: 11.5 }}
                          disabled={doc.isSealed}
                          onClick={() => onApplyQuickFix(issue.snippet, issue.suggestedFix!)}
                        >
                          <Check size={12} />
                          <span>{isZh ? '一键同步修正（可 Ctrl+Z）' : 'Quick Fix (Ctrl+Z)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 180px', gap: 10 }}>
                <label style={{ fontSize: 12 }}>
                  {isZh ? '对比提交基线版本：' : 'Baseline Snapshot:'}
                  <select
                    value={baselineSnapId}
                    onChange={(e) => setBaselineSnapId(e.target.value)}
                    style={{ width: '100%', height: 32, marginTop: 4, borderRadius: 6, padding: '0 8px' }}
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({s.wordCount}{isZh ? '字' : 'w'})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: 12 }}>
                  {isZh ? '回复信语言：' : 'Response Language:'}
                  <select
                    value={rebuttalLang}
                    onChange={(e) => setRebuttalLang(e.target.value as 'zh' | 'en')}
                    style={{ width: '100%', height: 32, marginTop: 4, borderRadius: 6, padding: '0 8px' }}
                  >
                    <option value="zh">{isZh ? '中文返修说明' : 'Chinese'}</option>
                    <option value="en">English Point-by-Point</option>
                  </select>
                </label>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    className="arc-btn arc-btn-primary"
                    style={{ width: '100%', height: 32, justifyContent: 'center' }}
                    disabled={rebuttalLoading}
                    onClick={handleGenerateRebuttal}
                  >
                    <Sparkles size={14} />
                    <span>{rebuttalLoading ? (isZh ? '生成中...' : 'Generating...') : isZh ? '生成逐条回复草稿' : 'Generate Rebuttal'}</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={reviewerComments}
                onChange={(e) => setReviewerComments(e.target.value)}
                placeholder={isZh ? '粘贴审稿人 / 导师的逐条意见...' : 'Paste reviewer or advisor comments...'}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  padding: 10,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                }}
              />

              {rebuttalDraft && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 12.5 }}>
                        {isZh ? '已生成的 Point-by-Point Response Letter 草稿：' : 'Generated Point-by-Point Response Letter:'}
                      </strong>
                      {rebuttalSkills.length > 0 && (
                        <span className="arc-badge">
                          {isZh ? '已调用 Skill：' : 'Skills: '}{rebuttalSkills.join(' · ')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="arc-btn"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() => {
                          navigator.clipboard?.writeText(rebuttalDraft).catch(() => {});
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copied ? (isZh ? '已复制' : 'Copied') : isZh ? '复制全文' : 'Copy All'}</span>
                      </button>
                      <button
                        className="arc-btn"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() =>
                          triggerBrowserDownload(
                            `${doc.title}_Response_Letter.md`,
                            rebuttalDraft,
                            'text/markdown;charset=utf-8',
                          )
                        }
                      >
                        <Download size={12} />
                        <span>{isZh ? '导出 .md' : 'Export .md'}</span>
                      </button>
                    </div>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                      whiteSpace: 'pre-wrap',
                      fontSize: 12.5,
                      lineHeight: 1.65,
                      maxHeight: 280,
                      overflowY: 'auto',
                    }}
                  >
                    {rebuttalDraft}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
