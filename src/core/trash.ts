import type { ArchiveDocument } from '../types/archive';

export function isDocumentTrashed(doc: Pick<ArchiveDocument, 'trashedAt'>): boolean {
  return Boolean(doc.trashedAt);
}

export function getActiveDocuments(documents: ArchiveDocument[]): ArchiveDocument[] {
  return documents.filter((d) => !isDocumentTrashed(d));
}

export function getTrashedDocuments(documents: ArchiveDocument[]): ArchiveDocument[] {
  return documents
    .filter((d) => isDocumentTrashed(d))
    .slice()
    .sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''));
}

export function canMoveDocumentToTrash(
  doc: Pick<ArchiveDocument, 'spaceId' | 'isSealed'>,
  vaultUnlocked: boolean,
): { allowed: boolean; reason?: 'sealed' | 'vault-locked' } {
  if (doc.spaceId === 'sp_vault' && !vaultUnlocked) {
    return { allowed: false, reason: 'vault-locked' };
  }
  if (doc.isSealed) {
    return { allowed: false, reason: 'sealed' };
  }
  return { allowed: true };
}

export function moveDocumentToTrash(
  documents: ArchiveDocument[],
  docId: string,
  nowIso?: string,
): {
  documents: ArchiveDocument[];
  trashedDoc: ArchiveDocument | null;
  nextActiveDocId: string | null;
} {
  const target = documents.find((d) => d.id === docId);
  if (!target) {
    return { documents, trashedDoc: null, nextActiveDocId: null };
  }
  if (isDocumentTrashed(target)) {
    const active = getActiveDocuments(documents);
    const sameSpace = active.find((d) => d.spaceId === (target.trashedFromSpaceId ?? target.spaceId));
    return {
      documents,
      trashedDoc: target,
      nextActiveDocId: sameSpace?.id ?? active[0]?.id ?? null,
    };
  }

  const trashedAt = nowIso ?? new Date().toISOString();
  const updatedTarget: ArchiveDocument = {
    ...target,
    trashedAt,
    trashedFromSpaceId: target.spaceId,
  };
  const nextDocs = documents.map((d) => (d.id === docId ? updatedTarget : d));
  const remainingActive = getActiveDocuments(nextDocs);
  const sameSpaceDoc = remainingActive.find((d) => d.spaceId === target.spaceId);

  return {
    documents: nextDocs,
    trashedDoc: updatedTarget,
    nextActiveDocId: sameSpaceDoc?.id ?? remainingActive[0]?.id ?? null,
  };
}

export function restoreDocumentFromTrash(
  documents: ArchiveDocument[],
  docId: string,
): {
  documents: ArchiveDocument[];
  restoredDoc: ArchiveDocument | null;
} {
  const target = documents.find((d) => d.id === docId);
  if (!target || !isDocumentTrashed(target)) {
    return { documents, restoredDoc: null };
  }

  const restoredDoc: ArchiveDocument = {
    ...target,
    spaceId: target.trashedFromSpaceId ?? target.spaceId,
    trashedAt: undefined,
    trashedFromSpaceId: undefined,
  };

  return {
    documents: documents.map((d) => (d.id === docId ? restoredDoc : d)),
    restoredDoc,
  };
}
