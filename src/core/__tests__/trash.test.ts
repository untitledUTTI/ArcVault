import { describe, expect, it } from 'vitest';
import {
  canMoveDocumentToTrash,
  getActiveDocuments,
  getTrashedDocuments,
  moveDocumentToTrash,
  restoreDocumentFromTrash,
} from '../trash';
import type { ArchiveDocument } from '../../types/archive';

function makeDoc(overrides: Partial<ArchiveDocument>): ArchiveDocument {
  return {
    id: 'doc_1',
    spaceId: 'sp_paper',
    title: '测试论文',
    sourceExt: '.md',
    sourceFileName: 'test.md',
    backupFormat: 'markdown',
    activeFormat: 'markdown',
    markdownText: '# 正文',
    latexText: '\\section{正文}',
    annotations: [],
    coverXmlNodes: [],
    coverRule: {
      documentId: 'doc_1',
      coverEndBlockIndex: 0,
      remember: true,
      coverBlockCount: 0,
    },
    citationsSidecar: [],
    mediaAssets: {},
    isSealed: false,
    updatedAt: '2026-11-26T10:00:00.000Z',
    createdAt: '2026-11-26T09:00:00.000Z',
    currentBranchId: 'br_1',
    tags: [],
    ...overrides,
  };
}

describe('Built-in Permanent Trash', () => {
  it('moves a document to trash, keeps it permanently, and picks next active sibling doc', () => {
    const docs = [
      makeDoc({ id: 'doc_a', spaceId: 'sp_paper', title: '论文 A' }),
      makeDoc({ id: 'doc_b', spaceId: 'sp_paper', title: '论文 B' }),
      makeDoc({ id: 'doc_c', spaceId: 'sp_writing', title: '随笔 C' }),
    ];

    const res = moveDocumentToTrash(docs, 'doc_a', '2026-11-26T16:30:00.000Z');
    expect(res.trashedDoc?.trashedAt).toBe('2026-11-26T16:30:00.000Z');
    expect(res.trashedDoc?.trashedFromSpaceId).toBe('sp_paper');
    expect(res.nextActiveDocId).toBe('doc_b');

    const active = getActiveDocuments(res.documents);
    expect(active.map((d) => d.id)).toEqual(['doc_b', 'doc_c']);

    const trashed = getTrashedDocuments(res.documents);
    expect(trashed.map((d) => d.id)).toEqual(['doc_a']);
  });

  it('sorts trashed documents newest-first and restores to original space intact', () => {
    const docs = [
      makeDoc({
        id: 'doc_old',
        spaceId: 'sp_office',
        title: '旧汇报',
        trashedAt: '2026-11-20T08:00:00.000Z',
        trashedFromSpaceId: 'sp_office',
      }),
      makeDoc({
        id: 'doc_new',
        spaceId: 'sp_paper',
        title: '新草稿',
        markdownText: '保留完整正文与版本',
        trashedAt: '2026-11-26T12:00:00.000Z',
        trashedFromSpaceId: 'sp_paper',
      }),
    ];

    const trashed = getTrashedDocuments(docs);
    expect(trashed.map((d) => d.id)).toEqual(['doc_new', 'doc_old']);

    const restored = restoreDocumentFromTrash(docs, 'doc_new');
    expect(restored.restoredDoc).not.toBeNull();
    expect(restored.restoredDoc?.spaceId).toBe('sp_paper');
    expect(restored.restoredDoc?.trashedAt).toBeUndefined();
    expect(restored.restoredDoc?.trashedFromSpaceId).toBeUndefined();
    expect(restored.restoredDoc?.markdownText).toBe('保留完整正文与版本');
    expect(getActiveDocuments(restored.documents).map((d) => d.id)).toEqual(['doc_new']);
    expect(getTrashedDocuments(restored.documents).map((d) => d.id)).toEqual(['doc_old']);
  });

  it('blocks moving sealed or locked-vault documents to trash', () => {
    const sealedDoc = makeDoc({ id: 'doc_sealed', spaceId: 'sp_paper', isSealed: true });
    expect(canMoveDocumentToTrash(sealedDoc, true)).toEqual({
      allowed: false,
      reason: 'sealed',
    });

    const vaultDoc = makeDoc({ id: 'doc_vault', spaceId: 'sp_vault', isSealed: false });
    expect(canMoveDocumentToTrash(vaultDoc, false)).toEqual({
      allowed: false,
      reason: 'vault-locked',
    });
    expect(canMoveDocumentToTrash(vaultDoc, true)).toEqual({ allowed: true });
  });
});
