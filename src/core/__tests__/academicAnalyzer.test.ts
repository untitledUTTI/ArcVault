import { describe, expect, it } from 'vitest';
import {
  analyzeAcademicIssues,
  analyzeContextAndSuggest,
  detectCurrentSection,
  detectPaperSections,
  recommendPhrasesForContext,
} from '../phrasebank/academicAnalyzer';
import { assembleBuilder } from '../phrasebank/builderFormat';
import { applyPlaceholders } from '../phrasebank/placeholders';
import type { AppSettings } from '../../types/archive';

const BASE_SETTINGS: AppSettings = {
  theme: 'light',
  locale: 'zh-CN',
  commentColor: '#2563eb',
  revisionColor: '#dc2626',
  defaultBackupFormat: 'both',
  autoBackup: {
    enabled: true,
    debounceMinutes: 3,
    dailyTime: '23:00',
    minCharChangeThreshold: 80,
  },
  aiProvider: 'offline-smart',
  aiEndpoint: 'http://localhost:11434/v1',
  aiModel: 'qwen2.5:14b',
  aiApiKey: '',
  watchDirectory: '',
  watchActive: false,
};

describe('academicAnalyzer', () => {
  it('detects Markdown and LaTeX paper sections and locates cursor section', () => {
    const mdDoc = [
      '# 摘要',
      '本文研究高效增量检索算法。',
      '',
      '# 1 引言',
      '近年来长文档管理面临研究空白。',
      '',
      '## 2.1 实验方法',
      '我们构建了分层内容寻址索引。',
      '',
      '# 3 结论与展望',
      '综上所述，本方法显著降低了延迟。',
    ].join('\n');

    const sections = detectPaperSections(mdDoc);
    expect(sections).toHaveLength(4);
    expect(sections[0].mappedSectionId).toBe('writing-abstracts');
    expect(sections[1].mappedSectionId).toBe('introducing-work');
    expect(sections[2].mappedSectionId).toBe('describing-methods');
    expect(sections[3].mappedSectionId).toBe('writing-conclusions');

    const methodOffset = mdDoc.indexOf('分层内容寻址索引');
    const active = detectCurrentSection(mdDoc, methodOffset, sections);
    expect(active?.mappedSectionId).toBe('describing-methods');

    const texDoc = `\\begin{abstract}\nSample abstract.\n\\end{abstract}\n\\section{Related Work}\nPrevious studies...\n\\section{Discussion}\nLimitations...`;
    const texSections = detectPaperSections(texDoc);
    expect(texSections.map((s) => s.mappedSectionId)).toEqual([
      'writing-abstracts',
      'reviewing-literature',
      'discussing-findings',
    ]);
  });

  it('detects everyday words, contractions, BrE spelling, evidence errors, and hedging issues', () => {
    const snippet =
      "A lot of studies show that it's hard to find out the cause. This proves our method works, and we analyse evidences with you.";
    const issues = analyzeAcademicIssues(snippet);

    const kinds = new Set(issues.map((i) => i.kind));
    expect(kinds.has('everyday-word')).toBe(true);
    expect(kinds.has('contraction')).toBe(true);
    expect(kinds.has('hedging')).toBe(true);
    expect(kinds.has('spelling-bre')).toBe(true);
    expect(kinds.has('confused-word')).toBe(true);
    expect(kinds.has('impersonal')).toBe(true);

    const aLotOf = issues.find((i) => i.matchedText.toLowerCase() === 'a lot of');
    expect(aLotOf?.replacements[0]).toBe('Considerable');
    const itsIssue = issues.find((i) => i.matchedText.toLowerCase() === "it's");
    expect(itsIssue?.replacements).toContain('it is');
  });

  it('recommends phrases by Chinese intent, section context, and anti-repetition', () => {
    const currentSection = detectCurrentSection('# 1 引言\n本文关注研究空白与局限。', 12);
    const recs = recommendPhrasesForContext({
      text: '# 1 引言\n本文关注研究空白与局限。',
      selectedText: '',
      currentParagraph: '现有工作较少关注局部增量检索，存在明显研究空白。',
      currentSection,
      limit: 6,
    });

    expect(recs.phrases.length).toBeGreaterThan(0);
    expect(recs.builders.length).toBeGreaterThan(0);
  });

  it('produces actionable offline contextual advice and safe rewrite', async () => {
    const paragraph = "A lot of researchers find out that it's difficult to scale.";
    const section = detectCurrentSection(`# Introduction\n${paragraph}`, 25);
    const res = await analyzeContextAndSuggest({
      fullText: `# Introduction\n${paragraph}`,
      selectionText: '',
      selectionStart: 15,
      selectionEnd: 15,
      paragraphText: paragraph,
      paragraphStart: 15,
      paragraphEnd: 15 + paragraph.length,
      currentSection: section,
      settings: BASE_SETTINGS,
      policy: 'cloud-or-local',
    });

    expect(res.source).toBe('offline-smart');
    expect(res.advice.length).toBeGreaterThanOrEqual(2);
    const rewriteCard = res.advice.find((a) => Boolean(a.suggestedRewrite));
    expect(rewriteCard?.suggestedRewrite).toContain('it is');
    expect(rewriteCard?.suggestedRewrite?.toLowerCase()).not.toContain('a lot of');
  });

  it('formats builder sentences and substitutes placeholders safely', () => {
    const out = assembleBuilder(
      [
        { labelCn: 'A', options: ['A(n)'] },
        { labelCn: 'B', options: ['empirical'] },
        { labelCn: 'C', options: ['study of X.'] },
      ],
      [0, 0, 0],
    );
    expect(out).toBe('An empirical study of X.');
    const substituted = applyPlaceholders(
      'Examine how X affects Xs and Smith (2020).',
      { X: 'retrieval', Y: '', Z: '', Author: 'Zhang', Year: '2024', Author2: '', Year2: '' },
      true,
    );
    expect(substituted).toBe('Examine how retrieval affects retrievals and Zhang (2024).');
  });
});
