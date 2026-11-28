import { describe, it, expect } from 'vitest';
import { CasObjectStore, createDocumentSnapshot } from '../casStore';
import {
  buildDiffLinesAndChapters,
  computeDocumentDiff,
  extractDeletedDarlings,
  parseDiffHeadingLine,
} from '../diffEngine';
import type { ArchiveDocument } from '../../types/archive';

function makeDoc(md: string): ArchiveDocument {
  return {
    id: 'doc_1',
    spaceId: 'sp_paper',
    title: '测试论文',
    sourceExt: '.docx',
    sourceFileName: 'test.docx',
    backupFormat: 'both',
    activeFormat: 'markdown',
    markdownText: md,
    latexText: md,
    annotations: [],
    coverXmlNodes: [],
    coverRule: { documentId: 'doc_1', coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
    citationsSidecar: [],
    mediaAssets: {},
    isSealed: false,
    createdAt: '2026-11-25T00:00:00Z',
    updatedAt: '2026-11-25T00:00:00Z',
    currentBranchId: 'br_1',
    tags: [],
  };
}

describe('CAS Deduplication, Diff Engine, and Deleted Darlings', () => {
  it('deduplicates identical snapshots and skips redundant snapshot creation', async () => {
    const cas = new CasObjectStore();
    const doc = makeDoc('# 第一章\n\n这是一段正文内容。');

    const res1 = await createDocumentSnapshot({
      cas,
      doc,
      latestSnapshot: null,
      label: 'v1',
      isMilestone: true,
    });
    expect(res1.created).toBe(true);

    // Identical content without forceMilestone should be skipped
    const resDup = await createDocumentSnapshot({
      cas,
      doc,
      latestSnapshot: res1.snapshot!,
      label: 'v1-dup',
      isMilestone: false,
    });
    expect(resDup.created).toBe(false);
    expect(resDup.skippedReason).toBe('unchanged');

    // Changed content creates new snapshot
    const doc2 = makeDoc('# 第一章\n\n这是一段修改后的正文内容。');
    const res2 = await createDocumentSnapshot({
      cas,
      doc: doc2,
      latestSnapshot: res1.snapshot!,
      label: 'v2',
    });
    expect(res2.created).toBe(true);
    expect(cas.getStats().totalObjects).toBeGreaterThanOrEqual(2);
  });

  it('computes diff hunks and captures deleted segments >= 50 chars into Deleted Darlings', () => {
    const oldText =
      '保留第一段。\n\n这是一段在修改论文时被大段删除的讨论文字，包含很多关于系统架构可扩展性、存储压缩比与局部索引演进的深入思考，总字数明显超过五十个汉字。';
    const newText = '保留第一段。\n\n补充了新的实验结论。';

    const report = computeDocumentDiff(oldText, newText);
    expect(report.removedChars).toBeGreaterThanOrEqual(50);
    expect(report.addedChars).toBeGreaterThan(0);

    const darlings = extractDeletedDarlings({
      oldText,
      newText,
      documentId: 'doc_1',
      snapshotId: 'snap_2',
      minChars: 50,
    });
    expect(darlings).toHaveLength(1);
    expect(darlings[0].charCount).toBeGreaterThanOrEqual(50);
    expect(darlings[0].text).toContain('深入思考');
  });

  it('computes character-level diff inside long paragraphs without replacing the whole paragraph', () => {
    const oldText =
      '在长段落学术写作测试中，我们在相同的数据集和实验配置下验证了模型的整体收敛稳定性，其中核心对比指标准确率为 91.6%，并且保持了较低的显存占用开销。';
    const newText =
      '在长段落学术写作测试中，我们在相同的数据集和实验配置下验证了模型的整体收敛稳定性，其中核心对比指标准确率为 94.2%，并且保持了较低的显存占用开销。';

    const report = computeDocumentDiff(oldText, newText);
    expect(report.removedChars).toBeLessThanOrEqual(8);
    expect(report.addedChars).toBeLessThanOrEqual(8);
    expect(report.changedBlocks).toBe(1);
    expect(report.hunks.some((h) => h.type === 'unchanged' && h.value.includes('核心对比指标准确率为'))).toBe(true);
    expect(report.hunks.some((h) => h.type === 'removed' && h.value === '1.6')).toBe(true);
    expect(report.hunks.some((h) => h.type === 'added' && h.value === '4.2')).toBe(true);
  });

  it('applies semantic cleanup to avoid fragmented 1-char coincidental matches', () => {
    const report = computeDocumentDiff('This yields method results.', 'This yields design results.');
    const removed = report.hunks.filter((h) => h.type === 'removed').map((h) => h.value).join('');
    const added = report.hunks.filter((h) => h.type === 'added').map((h) => h.value).join('');
    expect(removed).toBe('method');
    expect(added).toBe('design');
  });

  it('extracts chapter outline across Markdown, LaTeX, and Chinese headings while ignoring code fences', () => {
    const oldText = [
      '导言说明文字。',
      '',
      '# 1 引言',
      '本文探讨跨平台版本控制。',
      '```markdown',
      '# 代码块中的伪标题',
      '```',
      '## 1.1 研究背景',
      '已有方法准确率达到 91.6%。',
      '\\section{方法设计}',
      '采用两阶段索引。',
      '第3章 实验评估',
      '实验结果良好。',
      '# 旧附录',
      '待删除附录内容。',
    ].join('\n');

    const newText = [
      '导言说明文字。',
      '',
      '# 1 引言',
      '本文探讨跨平台版本控制。',
      '```markdown',
      '# 代码块中的伪标题',
      '```',
      '## 1.1 研究背景与动机',
      '已有方法准确率达到 94.2%。',
      '\\section{方法设计}',
      '采用两阶段索引。',
      '第3章 实验评估',
      '实验结果良好。',
      '# 4 结论',
      '总结全文贡献。',
    ].join('\n');

    const report = computeDocumentDiff(oldText, newText);
    const structured = buildDiffLinesAndChapters(report.hunks, '文首导言');

    const titles = structured.chapters.map((c) => c.title);
    expect(titles).toContain('文首导言');
    expect(titles).toContain('1 引言');
    expect(titles).toContain('1.1 研究背景与动机');
    expect(titles).toContain('方法设计');
    expect(titles).toContain('第3章 实验评估');
    expect(titles).toContain('旧附录');
    expect(titles).toContain('4 结论');
    expect(titles).not.toContain('代码块中的伪标题');

    const intro = structured.chapters.find((c) => c.title === '1 引言')!;
    expect(intro.hasChanges).toBe(false);

    const bg = structured.chapters.find((c) => c.title === '1.1 研究背景与动机')!;
    expect(bg.headingStatus).toBe('modified');
    expect(bg.hasChanges).toBe(true);
    expect(bg.addedChars).toBeGreaterThan(0);

    const oldApp = structured.chapters.find((c) => c.title === '旧附录')!;
    expect(oldApp.headingStatus).toBe('removed');

    const concl = structured.chapters.find((c) => c.title === '4 结论')!;
    expect(concl.headingStatus).toBe('added');

    expect(parseDiffHeadingLine('\\begin{abstract}')).toEqual({ title: 'Abstract', level: 1 });
    expect(buildDiffLinesAndChapters(computeDocumentDiff('纯文本第一行', '纯文本第二行').hunks).chapters).toEqual([]);
  });
});
