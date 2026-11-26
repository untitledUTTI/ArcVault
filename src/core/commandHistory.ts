import type { AnnotationItem, DocEditableState } from '../types/archive';

export interface HistoryEntry<T> {
  label: string;
  timestamp: number;
  before: T;
  after: T;
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

  push(label: string, before: T, after: T): void {
    this.undoStack.push({
      label,
      timestamp: Date.now(),
      before: structuredClone(before),
      after: structuredClone(after),
    });
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack = [];
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
    return { state: structuredClone(entry.before), label: entry.label };
  }

  redo(): { state: T; label: string } | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return { state: structuredClone(entry.after), label: entry.label };
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
  if (oldText === newText) return annotations;

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

  return annotations.map((ann) => {
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
    return {
      ...ann,
      anchorStart: clampedStart,
      anchorEnd: clampedEnd,
    };
  });
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
