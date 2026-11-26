import { describe, it, expect } from 'vitest';
import { runConsistencyCheck } from '../consistencyChecker';
import { parseReviewerComments, buildStructuredRebuttalDraft } from '../rebuttalGenerator';

describe('Consistency Checker & Rebuttal Response Generator', () => {
  it('detects cross-section numeric mismatch, dangling figure refs, broken footnotes, and unbalanced math', () => {
    const sample = `# 摘要

实验表明准确率提升至 94.2%，同时具备 $E=mc^2 能量约束。

# 3 结论

综上所述，模型准确率达到 93.6%（系统结构如图 3 所示）[^fn9]。`;

    const issues = runConsistencyCheck(sample, []);
    const categories = issues.map((i) => i.category);

    expect(categories).toContain('numeric-mismatch');
    expect(categories).toContain('broken-ref');
    expect(categories).toContain('math-syntax');

    const numIssue = issues.find((i) => i.category === 'numeric-mismatch')!;
    expect(numIssue.detail).toContain('94.2%');
    expect(numIssue.detail).toContain('93.6%');
    expect(numIssue.suggestedFix).toContain('94.2%');
  });

  it('parses reviewer comments and builds Chinese & English Point-by-Point Rebuttal drafts', () => {
    const commentsRaw = `1. Please clarify the baseline comparison in the abstract.
2. Add quantitative runtime complexity analysis in Section 2.`;

    const parsed = parseReviewerComments(commentsRaw);
    expect(parsed).toHaveLength(2);

    const baseline = '# 摘要\n\n准确率提升至 91.6%。\n\n# 2 方法\n\n采用分层索引。';
    const revised = '# 摘要\n\n相较 BM25 基线，准确率提升至 94.2%。\n\n# 2 方法\n\n采用分层索引，单轮编码复杂度为 O(k)。';

    const enDraft = buildStructuredRebuttalDraft({
      baselineText: baseline,
      revisedText: revised,
      reviewerComments: commentsRaw,
      language: 'en',
    });
    expect(enDraft).toContain('Point-by-Point Response to Reviewers');
    expect(enDraft).toContain('## Comment 1');
    expect(enDraft).toContain('**Original:**');
    expect(enDraft).toContain('**Revised:**');

    const zhDraft = buildStructuredRebuttalDraft({
      baselineText: baseline,
      revisedText: revised,
      reviewerComments: commentsRaw,
      language: 'zh',
    });
    expect(zhDraft).toContain('返修说明');
    expect(zhDraft).toContain('## 意见 1');
  });
});
