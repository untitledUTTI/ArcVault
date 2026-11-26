import { sha256Hex, countCharsAndWords } from './hash';
import type { ArchiveDocument, Snapshot } from '../types/archive';

export interface CasStats {
  totalObjects: number;
  totalBytes: number;
  logicalSnapshotCount: number;
  dedupSavedBytes: number;
}

/**
 * Content-Addressed Storage (CAS) engine.
 * Stores immutable text/binary blobs keyed by SHA-256 hash so unchanged revisions
 * never duplicate disk/storage space.
 */
export class CasObjectStore {
  private objects = new Map<string, string>();
  private logicalRefs = 0;
  private logicalTotalBytes = 0;

  constructor(initialObjects?: Record<string, string>) {
    if (initialObjects) {
      for (const [k, v] of Object.entries(initialObjects)) {
        this.objects.set(k, v);
      }
    }
  }

  async putText(content: string): Promise<{ hash: string; deduplicated: boolean }> {
    const hash = await sha256Hex(content);
    const byteLen = new TextEncoder().encode(content).byteLength;
    this.logicalRefs += 1;
    this.logicalTotalBytes += byteLen;

    const existed = this.objects.has(hash);
    if (!existed) {
      this.objects.set(hash, content);
    }
    return { hash, deduplicated: existed };
  }

  getText(hash: string): string | undefined {
    return this.objects.get(hash);
  }

  has(hash: string): boolean {
    return this.objects.has(hash);
  }

  exportAll(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.objects.entries()) {
      out[k] = v;
    }
    return out;
  }

  getStats(): CasStats {
    let totalBytes = 0;
    const encoder = new TextEncoder();
    for (const v of this.objects.values()) {
      totalBytes += encoder.encode(v).byteLength;
    }
    return {
      totalObjects: this.objects.size,
      totalBytes,
      logicalSnapshotCount: this.logicalRefs,
      dedupSavedBytes: Math.max(0, this.logicalTotalBytes - totalBytes),
    };
  }
}

export interface SnapshotAttemptResult {
  created: boolean;
  skippedReason?: 'unchanged';
  snapshot?: Snapshot;
}

/**
 * Creates a deduplicated snapshot in CAS.
 * If contentHash equals latestSnapshot.contentHash and forceMilestone is false,
 * skips creating redundant snapshots.
 */
export async function createDocumentSnapshot(params: {
  cas: CasObjectStore;
  doc: ArchiveDocument;
  latestSnapshot: Snapshot | null;
  label: string;
  isMilestone?: boolean;
  tags?: string[];
  aiSummary?: string;
  motivationNote?: string;
  forceMilestone?: boolean;
}): Promise<SnapshotAttemptResult> {
  const {
    cas,
    doc,
    latestSnapshot,
    label,
    isMilestone = false,
    tags = [],
    aiSummary,
    motivationNote,
    forceMilestone = false,
  } = params;

  const combinedPayload = `${doc.markdownText}\n---ARCVAULT_LATEX---\n${doc.latexText}`;
  const contentHash = await sha256Hex(combinedPayload);

  if (latestSnapshot && latestSnapshot.contentHash === contentHash && !forceMilestone) {
    return { created: false, skippedReason: 'unchanged' };
  }

  const mdPut = await cas.putText(doc.markdownText);
  const texPut = await cas.putText(doc.latexText);
  const wordCount = countCharsAndWords(
    doc.activeFormat === 'latex' ? doc.latexText : doc.markdownText,
  );
  const prevCount = latestSnapshot?.wordCount ?? 0;
  const deltaChars = wordCount - prevCount;

  const snapshot: Snapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    documentId: doc.id,
    branchId: doc.currentBranchId,
    parentId: latestSnapshot?.id ?? null,
    createdAt: new Date().toISOString(),
    label,
    isMilestone,
    tags,
    contentHash,
    markdownHash: mdPut.hash,
    latexHash: texPut.hash,
    wordCount,
    deltaChars,
    aiSummary:
      aiSummary ??
      (deltaChars >= 0
        ? `记录归档快照（+${deltaChars} 字符），当前共 ${wordCount} 字符。`
        : `记录归档快照（${deltaChars} 字符），当前共 ${wordCount} 字符。`),
    motivationNote,
    annotationsCount: doc.annotations.filter((a) => a.status === 'open').length,
  };

  return { created: true, snapshot };
}
