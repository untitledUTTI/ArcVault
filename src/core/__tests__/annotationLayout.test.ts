import { describe, expect, it } from 'vitest';
import {
  computeAlignedScrollTargets,
  computeParallelAnnotationLayout,
} from '../annotationLayout';
import type { AnnotationItem } from '../../types/archive';

function makeAnn(id: string, anchorStart: number): AnnotationItem {
  return {
    id,
    type: 'comment',
    author: 'Advisor',
    date: '2026-01-01',
    commentText: `Comment ${id}`,
    originalText: `Source ${id}`,
    anchorStart,
    anchorEnd: anchorStart + 5,
    status: 'open',
    replies: [],
  };
}

describe('computeParallelAnnotationLayout', () => {
  it('returns empty array when annotations are empty', () => {
    expect(
      computeParallelAnnotationLayout({
        annotations: [],
        anchors: {},
        heights: {},
        expandedId: null,
      }),
    ).toEqual([]);
  });

  it('stacks collapsed cards top-down without overlaps', () => {
    const annotations = [makeAnn('b', 20), makeAnn('a', 10), makeAnn('c', 30)];
    const anchors = {
      a: { top: 100 },
      b: { top: 110 },
      c: { top: 120 },
    };
    const heights = { a: 60, b: 60, c: 60 };

    const layout = computeParallelAnnotationLayout({
      annotations,
      anchors,
      heights,
      expandedId: null,
      gap: 10,
      minTop: 8,
      anchorOffset: -24,
    });

    expect(layout.map((p) => p.ann.id)).toEqual(['a', 'b', 'c']);
    expect(layout.map((p) => p.top)).toEqual([76, 146, 216]);
  });

  it('moves expanded card directly parallel to its source anchor and pushes neighbors cleanly', () => {
    const annotations = [makeAnn('a', 10), makeAnn('b', 20), makeAnn('c', 30), makeAnn('d', 40)];
    const anchors = {
      a: { top: 300 },
      b: { top: 320 },
      c: { top: 340 },
      d: { top: 500 },
    };
    const heights = { a: 60, b: 60, c: 60, d: 190 };

    // First verify collapsed baseline: d was pushed down to 486 (below 500 - 24 = 476)
    const collapsed = computeParallelAnnotationLayout({
      annotations,
      anchors,
      heights: { a: 60, b: 60, c: 60, d: 60 },
      expandedId: null,
      gap: 10,
      minTop: 8,
      anchorOffset: -24,
    });
    expect(collapsed[3].top).toBe(486);

    // Expanding d pins d directly at anchor.top - 24 = 476; c returns to its own anchor 316,
    // and b/a sit above c without overlap
    const expanded = computeParallelAnnotationLayout({
      annotations,
      anchors,
      heights,
      expandedId: 'd',
      gap: 10,
      minTop: 8,
      anchorOffset: -24,
    });

    expect(expanded.map((p) => p.ann.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(expanded[3].top).toBe(476);
    expect(expanded[2].top).toBe(316);
    expect(expanded[1].top).toBe(246);
    expect(expanded[0].top).toBe(176);

    // When a preceding card's desiredTop would collide with the pinned expanded card,
    // it is pushed upward just enough to preserve the gap
    const tightAbove = computeParallelAnnotationLayout({
      annotations: [makeAnn('c', 30), makeAnn('d', 40)],
      anchors: { c: { top: 450 }, d: { top: 500 } },
      heights: { c: 60, d: 190 },
      expandedId: 'd',
      gap: 10,
      minTop: 8,
      anchorOffset: -24,
    });
    expect(tightAbove[1].top).toBe(476);
    expect(tightAbove[0].top).toBe(406);

    // Strictly non-overlapping with >= gap spacing
    for (let i = 0; i < expanded.length - 1; i += 1) {
      expect(expanded[i + 1].top).toBeGreaterThanOrEqual(expanded[i].top + expanded[i].height + 10);
    }
  });

  it('clamps to minTop without overlaps when expanding near the top of the document', () => {
    const annotations = [makeAnn('a', 10), makeAnn('b', 20), makeAnn('c', 30), makeAnn('d', 40)];
    const anchors = {
      a: { top: 20 },
      b: { top: 35 },
      c: { top: 50 },
      d: { top: 220 },
    };
    const heights = { a: 60, b: 60, c: 180, d: 60 };

    const layout = computeParallelAnnotationLayout({
      annotations,
      anchors,
      heights,
      expandedId: 'c',
      gap: 10,
      minTop: 8,
      anchorOffset: -24,
    });

    expect(layout[0].top).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < layout.length - 1; i += 1) {
      expect(layout[i + 1].top).toBeGreaterThanOrEqual(layout[i].top + layout[i].height + 10);
    }
  });

  it('handles missing anchors with monotonic fallback spacing', () => {
    const annotations = [makeAnn('a', 10), makeAnn('b', 20)];
    const layout = computeParallelAnnotationLayout({
      annotations,
      anchors: {},
      heights: { a: 58, b: 58 },
      expandedId: null,
      gap: 10,
      minTop: 8,
    });

    expect(layout[0].top).toBe(8);
    expect(layout[1].top).toBe(76);
  });
});

describe('computeAlignedScrollTargets', () => {
  it('scrolls source text into view when card is far below dense annotations', () => {
    const res = computeAlignedScrollTargets({
      source: 'card',
      anchorTop: 400,
      cardTop: 3200,
      cardHeight: 180,
      editorScrollTop: 2800,
      editorClientHeight: 700,
      editorScrollHeight: 6000,
      annScrollTop: 3000,
      annClientHeight: 700,
      annScrollHeight: 6000,
    });

    expect(res.shouldScrollEditor).toBe(true);
    expect(res.editorScrollTop).toBe(204); // 400 - min(200, 700*0.28=196)
    expect(res.shouldScrollAnnotation).toBe(true);
    // Card remains aligned horizontally across from anchorScreenY (~196)
    expect(res.annotationScrollTop).toBe(3200 - 196 + 16);
  });

  it('scrolls source text down when card sits far above source anchor', () => {
    const res = computeAlignedScrollTargets({
      source: 'card',
      anchorTop: 4800,
      cardTop: 900,
      cardHeight: 160,
      editorScrollTop: 0,
      editorClientHeight: 700,
      editorScrollHeight: 6000,
      annScrollTop: 700,
      annClientHeight: 700,
      annScrollHeight: 6000,
    });

    expect(res.shouldScrollEditor).toBe(true);
    expect(res.editorScrollTop).toBe(4604);
    expect(res.annotationScrollTop).toBe(900 - 196 + 16);
  });

  it('aligns annotation card to clicked editor highlight without moving editor', () => {
    const res = computeAlignedScrollTargets({
      source: 'editor',
      anchorTop: 350,
      cardTop: 1800,
      cardHeight: 160,
      editorScrollTop: 150,
      editorClientHeight: 700,
      editorScrollHeight: 5000,
      annScrollTop: 150,
      annClientHeight: 700,
      annScrollHeight: 5000,
    });

    expect(res.shouldScrollEditor).toBe(false);
    expect(res.shouldScrollAnnotation).toBe(true);
    // anchorScreenY = 350 - 150 = 200; card aligns at 1800 - 200 + 16 = 1616
    expect(res.annotationScrollTop).toBe(1616);
  });
});
