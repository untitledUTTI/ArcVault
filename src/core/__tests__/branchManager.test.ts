import { describe, it, expect } from 'vitest';
import {
  createParallelBranch,
  computeBranchMergeBlocks,
  resolveBranchMerge,
} from '../branchManager';
import type { ArchiveDocument, Snapshot } from '../../types/archive';

describe('A/B Parallel Branch Manager & Visual Merge', () => {
  it('creates a parallel branch and resolves paragraph-level merge choices cleanly', () => {
    const doc = {
      id: 'doc_b',
      spaceId: 'sp_paper',
      title: '分支测试',
      sourceExt: '.md',
      sourceFileName: 'b.md',
      backupFormat: 'markdown',
      activeFormat: 'markdown',
      markdownText: '',
      latexText: '',
      annotations: [],
      coverXmlNodes: [],
      coverRule: { documentId: 'doc_b', coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
      citationsSidecar: [],
      mediaAssets: {},
      isSealed: false,
      createdAt: '2026-11-25',
      updatedAt: '2026-11-25',
      currentBranchId: 'br_main',
      tags: [],
    } satisfies ArchiveDocument;

    const snap: Snapshot = {
      id: 's1',
      documentId: 'doc_b',
      branchId: 'br_main',
      parentId: null,
      createdAt: '2026-11-25',
      label: 'v1',
      isMilestone: true,
      tags: [],
      contentHash: 'abc',
      markdownHash: 'abc',
      latexHash: 'abc',
      wordCount: 20,
      deltaChars: 20,
      aiSummary: 'init',
      annotationsCount: 0,
    };

    const created = createParallelBranch({ doc, sourceSnapshot: snap, name: '方案 B' });
    expect(created.branch.isMain).toBe(false);
    expect(created.clonedSnapshot?.branchId).toBe(created.branch.id);

    const mainText = '# 引言\n\n工程角度切入：解决桌面文件堆积问题。\n\n# 结论\n\n总结完毕。';
    const branchText = '# 引言\n\n理论角度切入：形式化定义增量检索边界。\n\n# 结论\n\n总结完毕。';

    const blocks = computeBranchMergeBlocks(mainText, branchText);
    const conflict = blocks.find((b) => b.kind === 'conflict')!;
    expect(conflict).toBeDefined();
    expect(conflict.mainText).toContain('工程角度');
    expect(conflict.branchText).toContain('理论角度');

    const pickedBranch = resolveBranchMerge(blocks, { [conflict.id]: 'branch' });
    expect(pickedBranch).toContain('理论角度切入');
    expect(pickedBranch).not.toContain('工程角度切入');

    const pickedBoth = resolveBranchMerge(blocks, { [conflict.id]: 'both' });
    expect(pickedBoth).toContain('工程角度切入');
    expect(pickedBoth).toContain('理论角度切入');
  });
});
