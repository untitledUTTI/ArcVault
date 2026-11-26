import { describe, it, expect } from 'vitest';
import { CasObjectStore, createDocumentSnapshot } from '../casStore';
import { computeDocumentDiff, extractDeletedDarlings } from '../diffEngine';
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
});
