import type { AnnotationItem, DocEditableState } from '../types/archive';

export interface HistoryEntry<T> {
  label: string;
  timestamp: number;
  before: T;
  after: T;
  mergeKey?: string;
  immutable?: boolean;
}

export interface HistoryPushOptions {
  mergeKey?: string;
  mergeWindowMs?: number;
  skipClone?: boolean;
  now?: number;
}

/**
 * Unified transactional CommandHistory for Undo / Redo across text edits,
 * accepting/rejecting revisions, resolving/replying to comments, and applying AI suggestions.
 */
export class CommandHistory<T = DocEditableState> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  push(label: string, before: T, after: T, options?: HistoryPushOptions): void {
    const now = options?.now ?? Date.now();
    const skipClone = Boolean(options?.skipClone);
    const mergeKey = options?.mergeKey;
    const mergeWindowMs = options?.mergeWindowMs ?? 500;

    if (mergeKey && this.undoStack.length > 0) {
      const top = this.undoStack[this.undoStack.length - 1];
      if (top.mergeKey === mergeKey && now - top.timestamp <= mergeWindowMs) {
        top.after = skipClone ? after : structuredClone(after);
        top.timestamp = now;
        top.label = label;
        if (skipClone) {
          top.immutable = true;
        }
        this.redoStack = [];
        return;
      }
    }

    this.undoStack.push({
      label,
      timestamp: now,
      before: skipClone ? before : structuredClone(before),
      after: skipClone ? after : structuredClone(after),
      mergeKey,
      immutable: skipClone,
    });
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  breakMergeChain(): void {
    if (this.undoStack.length > 0) {
      this.undoStack[this.undoStack.length - 1].mergeKey = undefined;
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoCount(): number {
    return this.undoStack.length;
  }

  redoCount(): number {
    return this.redoStack.length;
  }

  peekUndoLabel(): string | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].label : null;
  }

  peekRedoLabel(): string | null {
    return this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].label : null;
  }

  undo(): { state: T; label: string } | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return {
      state: entry.immutable ? entry.before : structuredClone(entry.before),
      label: entry.label,
    };
  }

  redo(): { state: T; label: string } | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return {
      state: entry.immutable ? entry.after : structuredClone(entry.after),
      label: entry.label,
    };
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/**
 * Adjusts annotation anchor offsets when the user edits text manually from `oldText` to `newText`.
 * Finds minimal common prefix & suffix and shifts/clamps annotation ranges cleanly.
 */
export function adjustAnchorsForTextEdit(
  oldText: string,
  newText: string,
  annotations: AnnotationItem[],
): AnnotationItem[] {
  if (oldText === newText || annotations.length === 0) return annotations;

  let prefix = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefix < minLen && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) {
    prefix++;
  }

  let oldSuffix = oldText.length;
  let newSuffix = newText.length;
  while (
    oldSuffix > prefix &&
    newSuffix > prefix &&
    oldText.charCodeAt(oldSuffix - 1) === newText.charCodeAt(newSuffix - 1)
  ) {
    oldSuffix--;
    newSuffix--;
  }

  const deletedLen = oldSuffix - prefix;
  const insertedLen = newSuffix - prefix;
  const delta = insertedLen - deletedLen;

  let changed = false;
  const nextAnnotations = annotations.map((ann) => {
    let start = ann.anchorStart;
    let end = ann.anchorEnd;

    if (end <= prefix) {
      // Completely before the edit
      return ann;
    }

    if (start >= oldSuffix) {
      // Completely after the edit
      start += delta;
      end += delta;
    } else {
      // Overlaps the edit region
      if (start > prefix) {
        start = Math.min(prefix + insertedLen, start + delta);
      }
      if (end >= oldSuffix) {
        end = Math.max(start, end + delta);
      } else {
        end = Math.max(start, Math.min(prefix + insertedLen, end));
      }
    }

    const clampedStart = Math.max(0, Math.min(newText.length, start));
    const clampedEnd = Math.max(clampedStart, Math.min(newText.length, end));
    if (clampedStart === ann.anchorStart && clampedEnd === ann.anchorEnd) {
      return ann;
    }
    changed = true;
    return {
      ...ann,
      anchorStart: clampedStart,
      anchorEnd: clampedEnd,
    };
  });

  return changed ? nextAnnotations : annotations;
}

/**
 * Applies a revision accept/reject or AI suggestion replacement onto text + shifts all sibling anchors.
 */
export function applyAnnotationTextReplacement(params: {
  text: string;
  annotations: AnnotationItem[];
  targetId: string;
  replacementText: string;
  newStatus: AnnotationItem['status'];
}): { text: string; annotations: AnnotationItem[] } {
  const { text, annotations, targetId, replacementText, newStatus } = params;
  const target = annotations.find((a) => a.id === targetId);
  if (!target) {
    return { text, annotations };
  }

  const start = Math.max(0, Math.min(text.length, target.anchorStart));
  const end = Math.max(start, Math.min(text.length, target.anchorEnd));

  const nextText = text.slice(0, start) + replacementText + text.slice(end);
  const delta = replacementText.length - (end - start);

  const nextAnnotations = annotations.map((ann) => {
    if (ann.id === targetId) {
      return {
        ...ann,
        anchorStart: start,
        anchorEnd: start + replacementText.length,
        status: newStatus,
      };
    }

    if (ann.anchorStart >= end) {
      return {
        ...ann,
        anchorStart: Math.max(0, ann.anchorStart + delta),
        anchorEnd: Math.max(0, ann.anchorEnd + delta),
      };
    }

    if (ann.anchorEnd > start && ann.anchorStart < end) {
      // Overlapping sibling annotation: adjust end proportionally
      const nextEnd = Math.max(ann.anchorStart, ann.anchorEnd + delta);
      return {
        ...ann,
        anchorEnd: Math.min(nextText.length, nextEnd),
      };
    }

    return ann;
  });

  return { text: nextText, annotations: nextAnnotations };
}

/**
 * Extracts the non-empty paragraph block containing `offset` (separated by blank lines).
 */
export function extractParagraphAtOffset(
  text: string,
  offset: number,
): { start: number; end: number; text: string } {
  const clamped = Math.max(0, Math.min(text.length, offset));
  const paragraphs: Array<{ start: number; end: number; text: string }> = [];
  const lines = text.split('\n');
  let cur = 0;
  let blockStart = -1;
  let blockLines: string[] = [];

  for (const line of lines) {
    const lineStart = cur;
    const lineEnd = cur + line.length;
    if (line.trim().length > 0) {
      if (blockStart === -1) blockStart = lineStart;
      blockLines.push(line);
    } else if (blockStart !== -1) {
      paragraphs.push({
        start: blockStart,
        end: lineStart - 1,
        text: blockLines.join('\n'),
      });
      blockStart = -1;
      blockLines = [];
    }
    cur = lineEnd + 1;
  }

  if (blockStart !== -1) {
    paragraphs.push({
      start: blockStart,
      end: text.length,
      text: blockLines.join('\n'),
    });
  }

  const matched =
    paragraphs.find((p) => clamped >= p.start && clamped <= p.end) ??
    paragraphs.find((p) => p.end >= clamped) ??
    paragraphs[paragraphs.length - 1];
  return matched ?? { start: 0, end: text.length, text };
}

export type BatchAnnotationAction =
  | 'accept-revisions'
  | 'reject-revisions'
  | 'resolve-comments'
  | 'reopen-comments';

interface AppliedBatchEdit {
  id: string;
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  cumDelta: number;
}

function remapOffsetWithBatchEdits(
  pos: number,
  edits: AppliedBatchEdit[],
  isEnd: boolean,
  newTextLen: number,
): number {
  if (edits.length === 0) return Math.max(0, Math.min(newTextLen, pos));

  let lo = 0;
  let hi = edits.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (edits[mid].oldStart <= pos) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  let mapped = pos;
  if (idx >= 0) {
    const e = edits[idx];
    if (pos < e.oldEnd) {
      mapped = isEnd ? e.newEnd : e.newStart;
    } else if (pos === e.oldEnd && e.oldStart === e.oldEnd) {
      mapped = isEnd ? e.newEnd : e.newStart;
    } else {
      mapped = pos + e.cumDelta;
    }
  }
  return Math.max(0, Math.min(newTextLen, mapped));
}

/**
 * Applies a batch action across annotations/revisions in O(N log N + |text|) time
 * using single-pass text assembly and binary-search offset remapping.
 */
export function applyBatchAnnotationAction(params: {
  text: string;
  annotations: AnnotationItem[];
  action: BatchAnnotationAction;
  targetIds?: ReadonlySet<string> | string[];
}): { text: string; annotations: AnnotationItem[]; affectedCount: number } {
  const { text, annotations, action, targetIds } = params;
  const targetSet =
    targetIds === undefined
      ? null
      : targetIds instanceof Set
        ? targetIds
        : new Set(targetIds);

  const isSelected = (id: string) => targetSet === null || targetSet.has(id);

  if (action === 'resolve-comments' || action === 'reopen-comments') {
    const fromStatus: AnnotationItem['status'] =
      action === 'resolve-comments' ? 'open' : 'resolved';
    const toStatus: AnnotationItem['status'] =
      action === 'resolve-comments' ? 'resolved' : 'open';
    let affectedCount = 0;
    const nextAnnotations = annotations.map((ann) => {
      if (ann.type === 'comment' && ann.status === fromStatus && isSelected(ann.id)) {
        affectedCount += 1;
        return { ...ann, status: toStatus };
      }
      return ann;
    });
    return {
      text,
      annotations: affectedCount > 0 ? nextAnnotations : annotations,
      affectedCount,
    };
  }

  const nextStatus: AnnotationItem['status'] =
    action === 'accept-revisions' ? 'accepted' : 'rejected';

  const textEdits: Array<{ ann: AnnotationItem; replacement: string }> = [];
  const statusOnlyIds = new Set<string>();

  for (const ann of annotations) {
    if (ann.type !== 'revision' || ann.status !== 'open' || !isSelected(ann.id)) {
      continue;
    }
    if (action === 'accept-revisions') {
      const replacement =
        ann.revisionKind === 'delete' ? '' : (ann.suggestedText ?? '');
      textEdits.push({ ann, replacement });
    } else {
      if (ann.revisionKind === 'insert') {
        textEdits.push({ ann, replacement: '' });
      } else {
        statusOnlyIds.add(ann.id);
      }
    }
  }

  const totalAffected = textEdits.length + statusOnlyIds.size;
  if (totalAffected === 0) {
    return { text, annotations, affectedCount: 0 };
  }

  if (textEdits.length === 0) {
    const nextAnnotations = annotations.map((ann) =>
      statusOnlyIds.has(ann.id) ? { ...ann, status: nextStatus } : ann,
    );
    return { text, annotations: nextAnnotations, affectedCount: totalAffected };
  }

  textEdits.sort(
    (a, b) => a.ann.anchorStart - b.ann.anchorStart || a.ann.anchorEnd - b.ann.anchorEnd,
  );

  const chunks: string[] = [];
  const appliedEdits: AppliedBatchEdit[] = [];
  const appliedById = new Map<string, AppliedBatchEdit>();

  let cursor = 0;
  let newCursor = 0;
  let cumDelta = 0;

  for (const { ann, replacement } of textEdits) {
    const start = Math.max(cursor, Math.min(text.length, ann.anchorStart));
    const end = Math.max(start, Math.min(text.length, ann.anchorEnd));
    chunks.push(text.slice(cursor, start));
    newCursor += start - cursor;

    const newStart = newCursor;
    chunks.push(replacement);
    newCursor += replacement.length;
    const newEnd = newCursor;

    cumDelta += replacement.length - (end - start);
    const edit: AppliedBatchEdit = {
      id: ann.id,
      oldStart: start,
      oldEnd: end,
      newStart,
      newEnd,
      cumDelta,
    };
    appliedEdits.push(edit);
    appliedById.set(ann.id, edit);
    cursor = end;
  }

  chunks.push(text.slice(cursor));
  const nextText = chunks.join('');

  const nextAnnotations = annotations.map((ann) => {
    const applied = appliedById.get(ann.id);
    if (applied) {
      return {
        ...ann,
        anchorStart: applied.newStart,
        anchorEnd: applied.newEnd,
        status: nextStatus,
      };
    }

    const mappedStart = remapOffsetWithBatchEdits(
      ann.anchorStart,
      appliedEdits,
      false,
      nextText.length,
    );
    const mappedEnd = Math.max(
      mappedStart,
      remapOffsetWithBatchEdits(ann.anchorEnd, appliedEdits, true, nextText.length),
    );
    const updatedStatus = statusOnlyIds.has(ann.id) ? nextStatus : ann.status;

    if (
      mappedStart === ann.anchorStart &&
      mappedEnd === ann.anchorEnd &&
      updatedStatus === ann.status
    ) {
      return ann;
    }

    return {
      ...ann,
      anchorStart: mappedStart,
      anchorEnd: mappedEnd,
      status: updatedStatus,
    };
  });

  return { text: nextText, annotations: nextAnnotations, affectedCount: totalAffected };
}
