import type { AnnotationItem } from '../types/archive';

export interface AnnotationLayoutInput {
  annotations: AnnotationItem[];
  anchors: Record<string, { top: number }>;
  heights: Record<string, number>;
  expandedId: string | null;
  gap?: number;
  minTop?: number;
  anchorOffset?: number;
  fallbackHeight?: number;
}

export interface AnnotationLayoutPlacement {
  ann: AnnotationItem;
  top: number;
  height: number;
}

/**
 * Computes non-overlapping vertical positions for annotation cards while ensuring
 * the currently expanded card aligns directly parallel with its source text anchor.
 */
export function computeParallelAnnotationLayout(
  input: AnnotationLayoutInput,
): AnnotationLayoutPlacement[] {
  const {
    annotations,
    anchors,
    heights,
    expandedId,
    gap = 10,
    minTop = 8,
    anchorOffset = -24,
    fallbackHeight = 60,
  } = input;

  if (annotations.length === 0) return [];

  const sorted = annotations
    .map((ann, idx) => ({ ann, idx }))
    .sort((a, b) => a.ann.anchorStart - b.ann.anchorStart || a.idx - b.idx)
    .map((entry) => entry.ann);

  const cardHeights = sorted.map((ann) => Math.max(1, heights[ann.id] ?? fallbackHeight));

  const desiredTops: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const ann = sorted[i];
    const anchor = anchors[ann.id];
    if (anchor) {
      desiredTops.push(Math.max(minTop, Math.round(anchor.top + anchorOffset)));
    } else if (i === 0) {
      desiredTops.push(minTop);
    } else {
      desiredTops.push(desiredTops[i - 1] + cardHeights[i - 1] + gap);
    }
  }

  const tops = new Array<number>(sorted.length);
  const pivotIdx = expandedId ? sorted.findIndex((ann) => ann.id === expandedId) : -1;

  if (pivotIdx < 0) {
    let cursor = minTop;
    for (let i = 0; i < sorted.length; i += 1) {
      const top = Math.max(cursor, desiredTops[i]);
      tops[i] = top;
      cursor = top + cardHeights[i] + gap;
    }
  } else {
    // Pin the expanded card at its ideal parallel Y coordinate
    tops[pivotIdx] = desiredTops[pivotIdx];

    // Push subsequent cards downward from the expanded card
    let cursor = tops[pivotIdx] + cardHeights[pivotIdx] + gap;
    for (let i = pivotIdx + 1; i < sorted.length; i += 1) {
      const top = Math.max(cursor, desiredTops[i]);
      tops[i] = top;
      cursor = top + cardHeights[i] + gap;
    }

    // Push preceding cards upward so none collide with the expanded card
    let maxBottom = tops[pivotIdx] - gap;
    for (let i = pivotIdx - 1; i >= 0; i -= 1) {
      const top = Math.min(desiredTops[i], maxBottom - cardHeights[i]);
      tops[i] = top;
      maxBottom = top - gap;
    }

    // Repair top boundary only if preceding cards were forced above minTop
    if (tops[0] < minTop) {
      let repairCursor = minTop;
      for (let i = 0; i < sorted.length; i += 1) {
        if (tops[i] < repairCursor) {
          tops[i] = repairCursor;
        }
        repairCursor = tops[i] + cardHeights[i] + gap;
      }
    }
  }

  return sorted.map((ann, i) => ({
    ann,
    top: tops[i],
    height: cardHeights[i],
  }));
}

export interface AlignedScrollInput {
  source: 'editor' | 'card';
  anchorTop: number;
  cardTop: number | null;
  cardHeight?: number;
  editorScrollTop: number;
  editorClientHeight: number;
  editorScrollHeight: number;
  annScrollTop: number;
  annClientHeight: number;
  annScrollHeight: number;
}

export interface AlignedScrollTargets {
  editorScrollTop: number;
  annotationScrollTop: number;
  shouldScrollEditor: boolean;
  shouldScrollAnnotation: boolean;
}

function clampScroll(val: number, maxVal: number): number {
  return Math.max(0, Math.min(Math.max(0, maxVal), Math.round(val)));
}

/**
 * Computes independent scroll targets for the editor and annotation panes so clicking
 * a card (even when dense annotations push it far from its source text) scrolls the
 * source text into comfortable view while keeping the card aligned and visible.
 */
export function computeAlignedScrollTargets(
  input: AlignedScrollInput,
): AlignedScrollTargets {
  const {
    source,
    anchorTop,
    cardTop,
    cardHeight = 160,
    editorScrollTop,
    editorClientHeight,
    editorScrollHeight,
    annScrollTop,
    annClientHeight,
    annScrollHeight,
  } = input;

  const editorMax = Math.max(0, editorScrollHeight - editorClientHeight);
  const annMax = Math.max(0, annScrollHeight - annClientHeight);
  const desiredViewportY = Math.min(200, Math.round(editorClientHeight * 0.28));

  if (source === 'editor') {
    const anchorScreenY = anchorTop - editorScrollTop;
    let targetAnnTop = clampScroll(editorScrollTop, annMax);
    if (cardTop !== null) {
      const idealAnnTop = cardTop - anchorScreenY + 16;
      targetAnnTop = clampScroll(idealAnnTop, annMax);
      const visibleCardHeight = Math.min(cardHeight, Math.max(60, annClientHeight - 36));
      const minAnnTopForVisibility = cardTop + visibleCardHeight + 16 - annClientHeight;
      const maxAnnTopForVisibility = cardTop - 12;
      if (targetAnnTop < minAnnTopForVisibility) {
        targetAnnTop = clampScroll(minAnnTopForVisibility, annMax);
      } else if (targetAnnTop > maxAnnTopForVisibility) {
        targetAnnTop = clampScroll(maxAnnTopForVisibility, annMax);
      }
    }
    return {
      editorScrollTop,
      annotationScrollTop: targetAnnTop,
      shouldScrollEditor: false,
      shouldScrollAnnotation: Math.abs(targetAnnTop - annScrollTop) > 2,
    };
  }

  const comfortableVisible =
    anchorTop >= editorScrollTop + 36 &&
    anchorTop <= Math.max(editorScrollTop + 80, editorScrollTop + editorClientHeight - 140);

  const targetEditorTop = comfortableVisible
    ? editorScrollTop
    : clampScroll(anchorTop - desiredViewportY, editorMax);

  const anchorScreenY = anchorTop - targetEditorTop;
  let targetAnnTop = annScrollTop;

  if (cardTop !== null) {
    const idealAnnTop = cardTop - anchorScreenY + 16;
    targetAnnTop = clampScroll(idealAnnTop, annMax);
    const visibleCardHeight = Math.min(cardHeight, Math.max(60, annClientHeight - 36));
    const minAnnTopForVisibility = cardTop + visibleCardHeight + 16 - annClientHeight;
    const maxAnnTopForVisibility = cardTop - 12;
    if (targetAnnTop < minAnnTopForVisibility) {
      targetAnnTop = clampScroll(minAnnTopForVisibility, annMax);
    } else if (targetAnnTop > maxAnnTopForVisibility) {
      targetAnnTop = clampScroll(maxAnnTopForVisibility, annMax);
    }
  }

  return {
    editorScrollTop: targetEditorTop,
    annotationScrollTop: targetAnnTop,
    shouldScrollEditor: Math.abs(targetEditorTop - editorScrollTop) > 2,
    shouldScrollAnnotation: Math.abs(targetAnnTop - annScrollTop) > 2,
  };
}
