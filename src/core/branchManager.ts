import { diffArrays } from 'diff';
import type { ArchiveDocument, Branch, Snapshot } from '../types/archive';

export interface MergeBlock {
  id: string;
  kind: 'same' | 'conflict';
  mainText: string;
  branchText: string;
}

export function createParallelBranch(params: {
  doc: ArchiveDocument;
  sourceSnapshot: Snapshot | null;
  name: string;
}): { branch: Branch; clonedSnapshot: Snapshot | null } {
  const { doc, sourceSnapshot, name } = params;
  const branchId = `branch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const clonedSnapshot: Snapshot | null = sourceSnapshot
    ? {
        ...sourceSnapshot,
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        branchId,
        parentId: sourceSnapshot.id,
        createdAt: now,
        label: `${name} · 起点`,
        isMilestone: false,
      }
    : null;

  const branch: Branch = {
    id: branchId,
    documentId: doc.id,
    name: name.trim() || '平行草稿分支',
    isMain: false,
    createdAt: now,
    headSnapshotId: clonedSnapshot?.id ?? null,
  };

  return { branch, clonedSnapshot };
}

/**
 * Splits two markdown texts into paragraph blocks and detects aligned vs conflicting blocks
 * for intuitive visual A/B branch merging (zero Git jargon).
 */
export function computeBranchMergeBlocks(mainText: string, branchText: string): MergeBlock[] {
  const mainParas = mainText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const branchParas = branchText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const parts = diffArrays(mainParas, branchParas);
  const blocks: MergeBlock[] = [];
  let idx = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.added && !part.removed) {
      for (const p of part.value) {
        blocks.push({
          id: `mb_${idx++}`,
          kind: 'same',
          mainText: p,
          branchText: p,
        });
      }
      continue;
    }

    if (part.removed) {
      const next = parts[i + 1];
      const addedParas = next && next.added ? next.value : [];
      if (addedParas.length > 0) i += 1;

      blocks.push({
        id: `mb_${idx++}`,
        kind: 'conflict',
        mainText: part.value.join('\n\n'),
        branchText: addedParas.join('\n\n'),
      });
    } else if (part.added) {
      blocks.push({
        id: `mb_${idx++}`,
        kind: 'conflict',
        mainText: '',
        branchText: part.value.join('\n\n'),
      });
    }
  }

  return blocks;
}

export function resolveBranchMerge(
  blocks: MergeBlock[],
  choices: Record<string, 'main' | 'branch' | 'both'>,
): string {
  const out: string[] = [];

  for (const b of blocks) {
    if (b.kind === 'same') {
      if (b.mainText) out.push(b.mainText);
      continue;
    }

    const pick = choices[b.id] ?? 'main';
    if (pick === 'main') {
      if (b.mainText) out.push(b.mainText);
    } else if (pick === 'branch') {
      if (b.branchText) out.push(b.branchText);
    } else {
      if (b.mainText) out.push(b.mainText);
      if (b.branchText && b.branchText !== b.mainText) out.push(b.branchText);
    }
  }

  return out.join('\n\n');
}
