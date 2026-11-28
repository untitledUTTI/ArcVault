import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANNOTATION_FILTER,
  countAnnotationStats,
  filterAnnotations,
} from '../annotationFilter';
import type { AnnotationItem } from '../../types/archive';

const SAMPLE_ANNS: AnnotationItem[] = [
  {
    id: 'c1',
    type: 'comment',
    author: 'Prof. Zhang',
    date: '2026-11-28',
    commentText: 'Clarify baseline hyperparameters',
    originalText: 'learning rate was set to 1e-4',
    anchorStart: 0,
    anchorEnd: 27,
    status: 'open',
    replies: [
      { id: 'r1', author: 'Me', date: '2026-11-28', text: 'Added ablation table' },
    ],
  },
  {
    id: 'c2',
    type: 'comment',
    author: 'Reviewer 2',
    date: '2026-11-28',
    commentText: 'Typo in caption',
    originalText: 'Figrue 1',
    anchorStart: 40,
    anchorEnd: 48,
    status: 'resolved',
    replies: [],
  },
  {
    id: 'rev1',
    type: 'revision',
    revisionKind: 'replace',
    author: 'Prof. Li',
    date: '2026-11-28',
    originalText: 'very good',
    suggestedText: 'statistically significant',
    anchorStart: 60,
    anchorEnd: 69,
    status: 'open',
    replies: [],
  },
  {
    id: 'rev2',
    type: 'revision',
    revisionKind: 'delete',
    author: 'Prof. Li',
    date: '2026-11-28',
    originalText: 'obviously',
    anchorStart: 80,
    anchorEnd: 89,
    status: 'accepted',
    replies: [],
  },
];

describe('annotationFilter', () => {
  it('counts totals, open/handled, comments/revisions accurately', () => {
    expect(countAnnotationStats(SAMPLE_ANNS)).toEqual({
      total: 4,
      open: 2,
      handled: 2,
      comments: 2,
      revisions: 2,
      openComments: 1,
      openRevisions: 1,
    });
  });

  it('filters by status and type', () => {
    expect(
      filterAnnotations(SAMPLE_ANNS, {
        ...DEFAULT_ANNOTATION_FILTER,
        status: 'open',
      }).map((a) => a.id),
    ).toEqual(['c1', 'rev1']);

    expect(
      filterAnnotations(SAMPLE_ANNS, {
        ...DEFAULT_ANNOTATION_FILTER,
        status: 'handled',
      }).map((a) => a.id),
    ).toEqual(['c2', 'rev2']);

    expect(
      filterAnnotations(SAMPLE_ANNS, {
        ...DEFAULT_ANNOTATION_FILTER,
        type: 'revision',
        status: 'open',
      }).map((a) => a.id),
    ).toEqual(['rev1']);
  });

  it('searches across author, quote, comment, suggestedText, and replies', () => {
    expect(
      filterAnnotations(SAMPLE_ANNS, {
        ...DEFAULT_ANNOTATION_FILTER,
        query: 'ablation',
      }).map((a) => a.id),
    ).toEqual(['c1']);

    expect(
      filterAnnotations(SAMPLE_ANNS, {
        ...DEFAULT_ANNOTATION_FILTER,
        query: 'statistically',
      }).map((a) => a.id),
    ).toEqual(['rev1']);

    expect(
      filterAnnotations(SAMPLE_ANNS, {
        ...DEFAULT_ANNOTATION_FILTER,
        query: 'reviewer 2',
      }).map((a) => a.id),
    ).toEqual(['c2']);
  });
});
