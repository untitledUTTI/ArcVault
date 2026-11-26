import { diffLines, diffWordsWithSpace } from 'diff';
import type { DeletedDarling } from '../types/archive';

export interface DiffHunk {
  id: string;
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineCount: number;
}

export interface DiffReport {
  hunks: DiffHunk[];
  addedChars: number;
  removedChars: number;
  changedBlocks: number;
  summary: string;
}

export function computeDocumentDiff(oldText: string, newText: string): DiffReport {
  const lineChanges = diffLines(oldText, newText);
  const hunks: DiffHunk[] = [];
  let addedChars = 0;
  let removedChars = 0;
  let changedBlocks = 0;

  lineChanges.forEach((part, idx) => {
    const cleanLen = part.value.replace(/\s+/g, '').length;
    const lineCount = part.count ?? part.value.split('\n').length;
    if (part.added) {
      addedChars += cleanLen;
      changedBlocks += 1;
      hunks.push({ id: `h_${idx}`, type: 'added', value: part.value, lineCount });
    } else if (part.removed) {
      removedChars += cleanLen;
      changedBlocks += 1;
      hunks.push({ id: `h_${idx}`, type: 'removed', value: part.value, lineCount });
    } else {
      hunks.push({ id: `h_${idx}`, type: 'unchanged', value: part.value, lineCount });
    }
  });

  const summary = `新增 ${addedChars} 字 / 删除 ${removedChars} 字（共 ${changedBlocks} 处段落变动）`;

  return {
    hunks,
    addedChars,
    removedChars,
    changedBlocks,
    summary,
  };
}

export interface InlineTokenDiff {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function computeInlineDiff(oldText: string, newText: string): InlineTokenDiff[] {
  return diffWordsWithSpace(oldText, newText).map((p) => ({
    type: p.added ? 'added' : p.removed ? 'removed' : 'unchanged',
    value: p.value,
  }));
}

/**
 * Automatically captures removed segments >= minChars (default 50) as "Deleted Darlings" (废稿墓地).
 */
export function extractDeletedDarlings(params: {
  oldText: string;
  newText: string;
  documentId: string;
  snapshotId: string;
  minChars?: number;
}): DeletedDarling[] {
  const { oldText, newText, documentId, snapshotId, minChars = 50 } = params;
  const changes = diffLines(oldText, newText);
  const results: DeletedDarling[] = [];
  const now = new Date().toISOString();

  changes.forEach((part, idx) => {
    if (!part.removed) return;
    const trimmed = part.value.trim();
    const charCount = trimmed.replace(/\s+/g, '').length;
    if (charCount >= minChars) {
      results.push({
        id: `darling_${Date.now()}_${idx}`,
        documentId,
        snapshotId,
        deletedAt: now,
        text: trimmed,
        charCount,
        tags: ['废稿回收'],
      });
    }
  });

  return results;
}
